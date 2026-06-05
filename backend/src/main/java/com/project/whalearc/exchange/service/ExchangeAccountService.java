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
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ExchangeAccountService {

    private final ExchangeAccountRepository exchangeAccountRepository;
    private final AESCryptoUtil aesCryptoUtil;
    private final KisApiClient kisApiClient;
    private final UpbitApiClient upbitApiClient;
    private final BitgetApiClient bitgetApiClient;

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
        maskSensitiveFields(saved); // 응답에 암호문 노출 방지 (저장 후 메모리 객체만 마스킹)
        return saved;
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
    }

    /**
     * 거래소 포트폴리오 조회 (실제 API 연동)
     */
    public ExchangePortfolioDto getPortfolio(String userId, String exchangeType) {
        Optional<ExchangeAccount> accountOpt = exchangeAccountRepository
                .findByUserIdAndExchangeType(userId, exchangeType);

        if (accountOpt.isEmpty() || !accountOpt.get().isConnected()) {
            return new ExchangePortfolioDto(exchangeType, false, 0, 0, 0, 0, new ArrayList<>());
        }

        ExchangeAccount account = accountOpt.get();

        try {
            // 복호화된 키로 실제 거래소 API 호출
            String apiKey = aesCryptoUtil.decrypt(account.getApiKey());
            String secretKey = aesCryptoUtil.decrypt(account.getSecretKey());

            switch (exchangeType) {
                case "KIS":
                    String appSecret = account.getAppSecret() != null
                            ? aesCryptoUtil.decrypt(account.getAppSecret()) : "";
                    return kisApiClient.getPortfolio(apiKey, secretKey, appSecret, account.getAccountNumber());

                case "UPBIT":
                    return upbitApiClient.getPortfolio(apiKey, secretKey);

                case "BITGET":
                    // Bitget은 ACCESS-PASSPHRASE 필수. appSecret 필드를 passphrase로 사용.
                    String passphrase = account.getAppSecret() != null
                            ? aesCryptoUtil.decrypt(account.getAppSecret()) : "";
                    return bitgetApiClient.getPortfolio(apiKey, secretKey, passphrase);

                default:
                    return new ExchangePortfolioDto(exchangeType, true, 0, 0, 0, 0, new ArrayList<>());
            }
        } catch (Exception e) {
            System.err.println("거래소 API 호출 실패 (" + exchangeType + "): " + e.getMessage());
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
