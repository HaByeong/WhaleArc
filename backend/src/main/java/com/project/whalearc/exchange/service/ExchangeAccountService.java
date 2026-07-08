package com.project.whalearc.exchange.service;

import com.project.whalearc.exchange.domain.ExchangeAccount;
import com.project.whalearc.exchange.dto.ExchangeAccountRequestDto;
import com.project.whalearc.exchange.dto.ExchangePortfolioDto;
import com.project.whalearc.exchange.dto.ExchangeTransactionDto;
import com.project.whalearc.exchange.repository.ExchangeAccountRepository;
import com.project.whalearc.exchange.service.client.KisApiClient;
import com.project.whalearc.exchange.service.client.UpbitApiClient;
import com.project.whalearc.exchange.service.client.BitgetApiClient;
import com.project.whalearc.exchange.util.AESCryptoUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
public class ExchangeAccountService {

    private final ExchangeAccountRepository exchangeAccountRepository;
    private final AESCryptoUtil aesCryptoUtil;
    private final KisApiClient kisApiClient;
    private final UpbitApiClient upbitApiClient;
    private final BitgetApiClient bitgetApiClient;
    // 기기 보고 잔고 스냅샷 직렬화용 (초기화된 final이라 @RequiredArgsConstructor 대상 아님)
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper =
            new com.fasterxml.jackson.databind.ObjectMapper();

    // 거래소 잔고 짧은 캐시(8초) — 대시보드/포트폴리오 10초 폴링 + 동시 사용자가 외부 거래소 API를
    // 반복 호출(특히 Bitget 코인당 N+1)하지 않도록 (userId,exchangeType)별 디듀프. KIS/Upbit/Bitget 공통.
    private static final long PORTFOLIO_CACHE_TTL_MS = 8000;
    private final Map<String, CachedPortfolio> portfolioCache = new ConcurrentHashMap<>();
    private record CachedPortfolio(ExchangePortfolioDto dto, long expiresAt) {}
    // 마지막 "정상 조회" 스냅샷 — 거래소 일시 오류(레이트리밋 등)로 fetchOk=false가 오면 0원 대신 이 값을 유지해 깜빡임을 막는다.
    private final Map<String, ExchangePortfolioDto> lastGoodPortfolio = new ConcurrentHashMap<>();

    /**
     * 거래소 API 키 등록/수정 (암호화 저장)
     */
    public ExchangeAccount saveAccount(String userId, ExchangeAccountRequestDto request) {
        Optional<ExchangeAccount> existing = exchangeAccountRepository
                .findByUserIdAndExchangeType(userId, request.getExchangeType());

        ExchangeAccount account;
        if (existing.isPresent()) {
            account = existing.get();
        } else {
            account = new ExchangeAccount();
            account.setUserId(userId);
            account.setExchangeType(request.getExchangeType());
            account.setCreatedAt(LocalDateTime.now().toString());
        }

        // API 키 암호화 저장.
        // 조회 시 '****'로 마스킹되므로, 수정 폼이 마스킹값/빈값을 그대로 재전송하면 기존 암호문을 유지한다.
        // (실제 키를 encrypt("****")로 덮어써 영구 손상시키던 버그 방지)
        if (isRealCredential(request.getApiKey())) {
            account.setApiKey(aesCryptoUtil.encrypt(request.getApiKey()));
        }
        if (isRealCredential(request.getSecretKey())) {
            account.setSecretKey(aesCryptoUtil.encrypt(request.getSecretKey()));
        }
        if (isRealCredential(request.getAppSecret())) {
            account.setAppSecret(aesCryptoUtil.encrypt(request.getAppSecret()));
        }
        if (request.getAccountNumber() != null && !request.getAccountNumber().isEmpty()
                && !MASKED_VALUE.equals(request.getAccountNumber())) {
            account.setAccountNumber(request.getAccountNumber()); // 계좌번호는 암호화 안함 (조회용)
        }

        // 연결 상태는 저장된(=실제) apiKey 기준으로 판정
        account.setConnected(account.getApiKey() != null && !account.getApiKey().isEmpty());
        account.setUpdatedAt(LocalDateTime.now().toString());

        ExchangeAccount saved = exchangeAccountRepository.save(account);
        portfolioCache.remove(userId + "|" + request.getExchangeType()); // 키 변경 후 stale 잔고 방지
        lastGoodPortfolio.remove(userId + "|" + request.getExchangeType());
        maskSensitiveFields(saved); // 응답에 암호문 노출 방지 (저장 후 메모리 객체만 마스킹)
        return saved;
    }

    /**
     * Model A/INV-1(β): 사용자 기기가 로컬 키로 조회한 거래소 잔고를 사후 보고 → 서버는 표시용으로만 저장.
     * 서버는 이 값으로 어떤 주문·조회도 하지 않는다(키 불요). 계정이 없으면 키 없이 생성(기기 실행형 연결).
     */
    public void reportBalance(String userId, String exchangeType, ExchangePortfolioDto portfolio) {
        ExchangeAccount account = exchangeAccountRepository
                .findByUserIdAndExchangeType(userId, exchangeType)
                .orElseGet(() -> {
                    ExchangeAccount a = new ExchangeAccount();
                    a.setUserId(userId);
                    a.setExchangeType(exchangeType);
                    a.setCreatedAt(LocalDateTime.now().toString());
                    return a;
                });
        try {
            account.setReportedPortfolioJson(objectMapper.writeValueAsString(portfolio));
        } catch (Exception e) {
            throw new IllegalArgumentException("잔고 보고 직렬화에 실패했습니다.");
        }
        account.setBalanceReportedAt(LocalDateTime.now().toString());
        account.setConnected(true);   // 기기가 연결된 계좌를 보고 = 연결됨
        account.setUpdatedAt(LocalDateTime.now().toString());
        exchangeAccountRepository.save(account);
        portfolioCache.remove(userId + "|" + exchangeType);   // 최신 보고 즉시 반영
    }

    /**
     * 사용자의 모든 거래소 계정 조회 (API 키는 마스킹)
     */
    public List<ExchangeAccount> getAccounts(String userId) {
        List<ExchangeAccount> accounts = exchangeAccountRepository.findByUserId(userId);
        accounts.forEach(this::maskSensitiveFields);
        return accounts;
    }

    /**
     * 특정 거래소 계정 조회 (API 키는 마스킹)
     */
    public Optional<ExchangeAccount> getAccount(String userId, String exchangeType) {
        Optional<ExchangeAccount> account = exchangeAccountRepository
                .findByUserIdAndExchangeType(userId, exchangeType);
        account.ifPresent(this::maskSensitiveFields);
        return account;
    }

    /**
     * 거래소 계정 삭제
     */
    public void deleteAccount(String userId, String exchangeType) {
        exchangeAccountRepository.deleteByUserIdAndExchangeType(userId, exchangeType);
        portfolioCache.remove(userId + "|" + exchangeType); // 연결 해제 후 stale 잔고 즉시 제거
        lastGoodPortfolio.remove(userId + "|" + exchangeType);
    }

    /**
     * 거래소 포트폴리오 조회 (실제 API 연동)
     */
    public ExchangePortfolioDto getPortfolio(String userId, String exchangeType) {
        String cacheKey = userId + "|" + exchangeType;
        CachedPortfolio cached = portfolioCache.get(cacheKey);
        if (cached != null && System.currentTimeMillis() < cached.expiresAt()) {
            return cached.dto();   // 8초 이내 재요청은 캐시(폴링/동시요청 디듀프)
        }

        Optional<ExchangeAccount> accountOpt = exchangeAccountRepository
                .findByUserIdAndExchangeType(userId, exchangeType);

        if (accountOpt.isEmpty() || !accountOpt.get().isConnected()) {
            return new ExchangePortfolioDto(exchangeType, false, 0, 0, 0, 0, new ArrayList<>());
        }

        ExchangeAccount account = accountOpt.get();

        // Model A/INV-1(β): 기기가 보고한 잔고가 있으면 그것을 표시한다 — 서버는 키로 거래소를 조회하지 않는다.
        if (account.getReportedPortfolioJson() != null && !account.getReportedPortfolioJson().isBlank()) {
            try {
                ExchangePortfolioDto reported = objectMapper.readValue(
                        account.getReportedPortfolioJson(), ExchangePortfolioDto.class);
                reported.setBalanceReportedAt(account.getBalanceReportedAt()); // 웹에 '기준 시각' 표시용
                portfolioCache.put(cacheKey, new CachedPortfolio(reported, System.currentTimeMillis() + PORTFOLIO_CACHE_TTL_MS));
                return reported;
            } catch (Exception e) {
                // 역직렬화 실패 시 아래 전환기 폴백(키 조회)으로 진행
            }
        }

        try {
            // 복호화된 키로 실제 거래소 API 호출 (전환기 폴백 — 기기 보고 정착 후 이 경로와 키 저장을 제거)
            String apiKey = aesCryptoUtil.decrypt(account.getApiKey());
            String secretKey = aesCryptoUtil.decrypt(account.getSecretKey());

            ExchangePortfolioDto dto;
            switch (exchangeType) {
                case "KIS": {
                    String appSecret = account.getAppSecret() != null
                            ? aesCryptoUtil.decrypt(account.getAppSecret()) : "";
                    dto = kisApiClient.getPortfolio(apiKey, secretKey, appSecret, account.getAccountNumber());
                    break;
                }
                case "UPBIT":
                    dto = upbitApiClient.getPortfolio(apiKey, secretKey);
                    break;
                case "BITGET": {
                    // Bitget은 ACCESS-PASSPHRASE 필수. appSecret 필드를 passphrase로 사용.
                    String passphrase = account.getAppSecret() != null
                            ? aesCryptoUtil.decrypt(account.getAppSecret()) : "";
                    dto = bitgetApiClient.getPortfolio(apiKey, secretKey, passphrase);
                    break;
                }
                default:
                    dto = new ExchangePortfolioDto(exchangeType, true, 0, 0, 0, 0, new ArrayList<>());
            }
            // 조회 성공(fetchOk)일 때만 캐시·마지막정상 스냅샷 갱신. 실패(fetchOk=false)면 0원 대신 직전 정상 스냅샷 유지.
            if (dto.isFetchOk()) {
                portfolioCache.put(cacheKey, new CachedPortfolio(dto, System.currentTimeMillis() + PORTFOLIO_CACHE_TTL_MS));
                lastGoodPortfolio.put(cacheKey, dto);
                return dto;
            }
            ExchangePortfolioDto lastGood = lastGoodPortfolio.get(cacheKey);
            return lastGood != null ? lastGood : dto;   // 첫 조회부터 실패면 폴백 없음 → 실패 dto 그대로
        } catch (Exception e) {
            System.err.println("거래소 API 호출 실패 (" + exchangeType + "): " + e.getMessage());
            // 일시 오류 시 마지막 정상 스냅샷을 유지(없으면 fetchOk=false 빈 계좌로 구분)
            ExchangePortfolioDto lastGood = lastGoodPortfolio.get(cacheKey);
            if (lastGood != null) return lastGood;
            ExchangePortfolioDto failed = new ExchangePortfolioDto(exchangeType, true, 0, 0, 0, 0, new ArrayList<>());
            failed.setFetchOk(false); // 실제 API 실패 → 빈 계좌(연결됨+0)와 구분 가능하도록 표시
            return failed;
        }
    }

    /**
     * 거래소 체결 내역 조회 (현재 KIS 주식만 지원)
     */
    public List<ExchangeTransactionDto> getTransactions(String userId, String exchangeType, int days) {
        Optional<ExchangeAccount> accountOpt = exchangeAccountRepository
                .findByUserIdAndExchangeType(userId, exchangeType);

        if (accountOpt.isEmpty() || !accountOpt.get().isConnected()) {
            return new ArrayList<>();
        }
        // 체결 내역은 현재 KIS(주식)만 지원 — 업비트/비트겟은 추후 지원
        if (!"KIS".equals(exchangeType)) {
            return new ArrayList<>();
        }

        ExchangeAccount account = accountOpt.get();
        try {
            // KIS OAuth 토큰은 (apiKey=appkey, secretKey=appsecret) 쌍을 사용한다.
            // getPortfolio 도 동일 쌍으로 토큰을 발급한다(거기 3번째 secretKey 파라미터는 미사용 死파라미터).
            String apiKey = aesCryptoUtil.decrypt(account.getApiKey());
            String secretKey = aesCryptoUtil.decrypt(account.getSecretKey());
            return kisApiClient.getTransactions(apiKey, secretKey, account.getAccountNumber(), days);
        } catch (Exception e) {
            System.err.println("거래소 체결내역 조회 실패 (" + exchangeType + "): " + e.getMessage());
            return new ArrayList<>();
        }
    }

    /** 조회 응답에서 자격증명 자리에 노출하는 마스킹 문자열 */
    private static final String MASKED_VALUE = "****";

    /** 마스킹값('****')·빈값이 아닌, 실제로 새로 입력된 자격증명일 때만 true */
    private static boolean isRealCredential(String v) {
        return v != null && !v.isEmpty() && !MASKED_VALUE.equals(v.trim());
    }

    /**
     * 민감 정보 마스킹 (프론트에 전달 시)
     */
    private void maskSensitiveFields(ExchangeAccount account) {
        if (account.getApiKey() != null) {
            account.setApiKey(MASKED_VALUE);
        }
        if (account.getSecretKey() != null) {
            account.setSecretKey(MASKED_VALUE);
        }
        if (account.getAppSecret() != null) {
            account.setAppSecret(MASKED_VALUE);
        }
    }
}
