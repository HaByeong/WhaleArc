package com.project.whalearc.virt.service;

import com.project.whalearc.virt.domain.VirtCredential;
import com.project.whalearc.virt.dto.VirtCredentialRequest;
import com.project.whalearc.virt.dto.VirtPortfolioResponse;
import com.project.whalearc.virt.dto.VirtTradeResponse;
import com.project.whalearc.virt.repository.VirtCredentialRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class VirtService {

    private final VirtCredentialRepository credentialRepo;
    private final VirtKisApiClient kisClient;
    private final VirtUpbitClient upbitClient;
    private final VirtBitgetClient bitgetClient;

    @Value("${virt.encryption-key:WhaleArcVirt2026SecretKey!!}")
    private String encryptionKey;

    /* ───── 포트폴리오 응답 캐시 (10초 TTL) ───── */
    private record CacheEntry<T>(T data, long expireAt) {
        boolean isValid() { return System.currentTimeMillis() < expireAt; }
    }
    private static final long CACHE_TTL_MS = 10_000; // 10초
    private final ConcurrentHashMap<String, CacheEntry<VirtPortfolioResponse>> portfolioCache = new ConcurrentHashMap<>();

    @SuppressWarnings("unchecked")
    private <T> T getCachedOrFetch(ConcurrentHashMap<String, CacheEntry<T>> cache, String key, java.util.function.Supplier<T> fetcher) {
        CacheEntry<T> entry = cache.get(key);
        if (entry != null && entry.isValid()) return entry.data();
        T result = fetcher.get();
        if (result != null) {
            cache.put(key, new CacheEntry<>(result, System.currentTimeMillis() + CACHE_TTL_MS));
        }
        return result;
    }

    /* ───── 자격증명 관리 ───── */

    public void saveCredential(String userId, VirtCredentialRequest req) {
        VirtCredential cred = credentialRepo.findByUserId(userId)
                .orElse(new VirtCredential(userId));

        cred.setEncryptedAppkey(CryptoUtil.encrypt(req.getAppkey(), encryptionKey));
        cred.setEncryptedAppsecret(CryptoUtil.encrypt(req.getAppsecret(), encryptionKey));
        cred.setAccountNumber(req.getAccountNumber());
        cred.setAccountProductCode(req.getAccountProductCode() != null ? req.getAccountProductCode() : "01");
        cred.setUpdatedAt(java.time.LocalDateTime.now());

        credentialRepo.save(cred);
        kisClient.evictToken(userId); // 키 변경 시 토큰 캐시 삭제
        portfolioCache.remove("kis:" + userId);
        portfolioCache.remove("upbit:" + userId);
        portfolioCache.remove("bitget:" + userId);
        log.info("[Virt] 자격증명 저장: userId={}", userId);
    }

    public boolean hasCredential(String userId) {
        return credentialRepo.findByUserId(userId)
                .map(c -> c.getEncryptedAppkey() != null && !c.getEncryptedAppkey().isEmpty())
                .orElse(false);
    }

    public void deleteCredential(String userId) {
        credentialRepo.findByUserId(userId).ifPresent(cred -> {
            cred.setEncryptedAppkey(null);
            cred.setEncryptedAppsecret(null);
            cred.setAccountNumber(null);
            cred.setAccountProductCode(null);
            cred.setUpdatedAt(java.time.LocalDateTime.now());
            credentialRepo.save(cred);
        });
        kisClient.evictToken(userId);
        portfolioCache.remove("kis:" + userId);
        log.info("[Virt] KIS 자격증명 삭제: userId={}", userId);
    }

    /** 마스킹된 자격증명 정보 반환 (키 노출 방지) */
    public Map<String, Object> getCredentialInfo(String userId) {
        VirtCredential cred = credentialRepo.findByUserId(userId).orElse(null);
        if (cred == null || cred.getEncryptedAppkey() == null || cred.getEncryptedAppkey().isEmpty()) {
            return Map.of("connected", false);
        }
        String appkey = CryptoUtil.decrypt(cred.getEncryptedAppkey(), encryptionKey);
        String maskedKey = appkey.length() >= 6
                ? appkey.substring(0, 4) + "****" + appkey.substring(appkey.length() - 2)
                : "****";
        String acctNo = cred.getAccountNumber();
        String maskedAcct = acctNo != null && acctNo.length() >= 4
                ? acctNo.substring(0, 4) + "****"
                : "****";
        return Map.of(
                "appkey", maskedKey,
                "accountNumber", maskedAcct,
                "accountProductCode", cred.getAccountProductCode() != null ? cred.getAccountProductCode() : "01",
                "connected", true
        );
    }

    /* ───── 실계좌 포트폴리오 조회 ───── */

    public VirtPortfolioResponse getPortfolio(String userId) {
        return getCachedOrFetch(portfolioCache, "kis:" + userId, () -> fetchKisPortfolio(userId));
    }

    @SuppressWarnings("unchecked")
    private VirtPortfolioResponse fetchKisPortfolio(String userId) {
        VirtCredential cred = getCredentialOrThrow(userId);
        String appkey = CryptoUtil.decrypt(cred.getEncryptedAppkey(), encryptionKey);
        String appsecret = CryptoUtil.decrypt(cred.getEncryptedAppsecret(), encryptionKey);

        Map<String, Object> result = kisClient.getAccountBalance(
                userId, appkey, appsecret,
                cred.getAccountNumber(), cred.getAccountProductCode()
        );

        // output1: 보유종목 리스트
        List<Map<String, String>> output1 = (List<Map<String, String>>) result.get("output1");
        // output2: 계좌 요약 (배열, 첫 번째 요소 사용)
        List<Map<String, String>> output2 = (List<Map<String, String>>) result.get("output2");

        List<VirtPortfolioResponse.VirtHolding> holdings = new ArrayList<>();
        if (output1 != null) {
            for (Map<String, String> item : output1) {
                int qty = safeInt(item.get("hldg_qty"));
                if (qty <= 0) continue;

                holdings.add(VirtPortfolioResponse.VirtHolding.builder()
                        .stockCode(item.getOrDefault("pdno", ""))
                        .stockName(item.getOrDefault("prdt_name", ""))
                        .quantity(qty)
                        .averagePrice(safeLong(item.get("pchs_avg_pric")))
                        .currentPrice(safeLong(item.get("prpr")))
                        .marketValue(safeLong(item.get("evlu_amt")))
                        .profitLoss(safeLong(item.get("evlu_pfls_amt")))
                        .returnRate(safeDouble(item.get("evlu_pfls_rt")))
                        .build());
            }
        }

        long holdingsValue = holdings.stream().mapToLong(VirtPortfolioResponse.VirtHolding::getMarketValue).sum();
        long totalPnl = holdings.stream().mapToLong(VirtPortfolioResponse.VirtHolding::getProfitLoss).sum();

        // 예수금: output2[0].dnca_tot_amt 또는 d2_deposit (D+2 예수금)
        long cashBalance = 0;
        if (output2 != null && !output2.isEmpty()) {
            cashBalance = safeLong(output2.get(0).get("dnca_tot_amt"));
        }

        long totalValue = cashBalance + holdingsValue;
        long investedAmount = totalValue - totalPnl;
        double returnRate = investedAmount != 0
                ? (double) totalPnl / investedAmount * 100
                : 0;

        return VirtPortfolioResponse.builder()
                .totalValue(totalValue)
                .cashBalance(cashBalance)
                .holdingsValue(holdingsValue)
                .totalPnl(totalPnl)
                .returnRate(Math.round(returnRate * 100.0) / 100.0)
                .holdings(holdings)
                .build();
    }

    /* ───── 체결내역 조회 ───── */

    @SuppressWarnings("unchecked")
    public List<VirtTradeResponse> getTradeHistory(String userId, int days) {
        VirtCredential cred = getCredentialOrThrow(userId);
        String appkey = CryptoUtil.decrypt(cred.getEncryptedAppkey(), encryptionKey);
        String appsecret = CryptoUtil.decrypt(cred.getEncryptedAppsecret(), encryptionKey);

        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyyMMdd");
        String endDate = LocalDate.now().format(fmt);
        String startDate = LocalDate.now().minusDays(days).format(fmt);

        Map<String, Object> result = kisClient.getTradeHistory(
                userId, appkey, appsecret,
                cred.getAccountNumber(), cred.getAccountProductCode(),
                startDate, endDate
        );

        List<Map<String, String>> output1 = (List<Map<String, String>>) result.get("output1");
        if (output1 == null) return List.of();

        return output1.stream()
                .map(item -> VirtTradeResponse.builder()
                        .orderId(item.getOrDefault("odno", ""))
                        .stockCode(item.getOrDefault("pdno", ""))
                        .stockName(item.getOrDefault("prdt_name", ""))
                        .orderType("02".equals(item.get("sll_buy_dvsn_cd")) ? "BUY" : "SELL")
                        .quantity(safeInt(item.get("tot_ccld_qty")))
                        .price(safeLong(item.get("avg_prvs")))
                        .totalAmount(safeLong(item.get("tot_ccld_amt")))
                        .executedAt(item.getOrDefault("ord_dt", "") + " " + item.getOrDefault("ord_tmd", ""))
                        .status(safeInt(item.get("tot_ccld_qty")) > 0 ? "FILLED" : "PENDING")
                        .build())
                .collect(Collectors.toList());
    }

    /* ═══════ 업비트 (코인) ═══════ */

    /** 업비트 API 키 저장 */
    public void saveUpbitCredential(String userId, String accessKey, String secretKey) {
        VirtCredential cred = credentialRepo.findByUserId(userId)
                .orElse(new VirtCredential(userId));

        cred.setEncryptedUpbitAccessKey(CryptoUtil.encrypt(accessKey, encryptionKey));
        cred.setEncryptedUpbitSecretKey(CryptoUtil.encrypt(secretKey, encryptionKey));
        cred.setUpdatedAt(java.time.LocalDateTime.now());
        credentialRepo.save(cred);
        log.info("[Virt] 업비트 자격증명 저장: userId={}", userId);
    }

    public boolean hasUpbitCredential(String userId) {
        return credentialRepo.findByUserId(userId)
                .map(c -> c.getEncryptedUpbitAccessKey() != null && !c.getEncryptedUpbitAccessKey().isEmpty())
                .orElse(false);
    }

    public void deleteUpbitCredential(String userId) {
        credentialRepo.findByUserId(userId).ifPresent(cred -> {
            cred.setEncryptedUpbitAccessKey(null);
            cred.setEncryptedUpbitSecretKey(null);
            cred.setUpdatedAt(java.time.LocalDateTime.now());
            credentialRepo.save(cred);
        });
        portfolioCache.remove("upbit:" + userId);
        log.info("[Virt] 업비트 자격증명 삭제: userId={}", userId);
    }

    /** 업비트 연결 정보 (마스킹) */
    public Map<String, Object> getUpbitCredentialInfo(String userId) {
        VirtCredential cred = credentialRepo.findByUserId(userId).orElse(null);
        if (cred == null || cred.getEncryptedUpbitAccessKey() == null) {
            return Map.of("connected", false);
        }
        String ak = CryptoUtil.decrypt(cred.getEncryptedUpbitAccessKey(), encryptionKey);
        String masked = ak.length() >= 6 ? ak.substring(0, 4) + "****" : "****";
        return Map.of("connected", true, "accessKey", masked);
    }

    /** 업비트 코인 포트폴리오 조회 */
    public VirtPortfolioResponse getUpbitPortfolio(String userId) {
        return getCachedOrFetch(portfolioCache, "upbit:" + userId, () -> fetchUpbitPortfolio(userId));
    }

    @SuppressWarnings("unchecked")
    private VirtPortfolioResponse fetchUpbitPortfolio(String userId) {
        VirtCredential cred = credentialRepo.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("업비트 API 키가 등록되지 않았습니다."));

        if (cred.getEncryptedUpbitAccessKey() == null) {
            throw new RuntimeException("업비트 API 키가 등록되지 않았습니다.");
        }

        String accessKey = CryptoUtil.decrypt(cred.getEncryptedUpbitAccessKey(), encryptionKey);
        String secretKey = CryptoUtil.decrypt(cred.getEncryptedUpbitSecretKey(), encryptionKey);

        // 1) 잔고 조회
        List<Map<String, Object>> accounts = upbitClient.getAccounts(accessKey, secretKey);

        // KRW 잔고와 코인 잔고 분리
        long cashBalance = 0;
        List<String> markets = new ArrayList<>();
        Map<String, Map<String, Object>> coinMap = new LinkedHashMap<>();

        for (Map<String, Object> acct : accounts) {
            String currency = (String) acct.get("currency");
            double balance = Double.parseDouble(String.valueOf(acct.get("balance")));
            double locked = Double.parseDouble(String.valueOf(acct.get("locked")));
            double total = balance + locked;

            if ("KRW".equals(currency)) {
                cashBalance = (long) balance;
            } else if (total > 0.00000001) {
                String market = "KRW-" + currency;
                markets.add(market);
                coinMap.put(currency, acct);
            }
        }

        // 2) 현재가 일괄 조회
        Map<String, Double> priceMap = new HashMap<>();
        if (!markets.isEmpty()) {
            String marketsParam = String.join(",", markets);
            List<Map<String, Object>> tickers = upbitClient.getTicker(marketsParam);
            for (Map<String, Object> t : tickers) {
                String market = (String) t.get("market"); // "KRW-BTC"
                String coin = market.replace("KRW-", "");
                double price = ((Number) t.get("trade_price")).doubleValue();
                priceMap.put(coin, price);
            }
        }

        // 3) 포트폴리오 구성
        List<VirtPortfolioResponse.VirtHolding> holdings = new ArrayList<>();
        for (Map.Entry<String, Map<String, Object>> entry : coinMap.entrySet()) {
            String currency = entry.getKey();
            Map<String, Object> acct = entry.getValue();

            double balance = Double.parseDouble(String.valueOf(acct.get("balance")));
            double locked = Double.parseDouble(String.valueOf(acct.get("locked")));
            double quantity = balance + locked;
            double avgPrice = Double.parseDouble(String.valueOf(acct.get("avg_buy_price")));
            double currentPrice = priceMap.getOrDefault(currency, 0.0);

            long marketValue = (long) (quantity * currentPrice);
            long investedValue = (long) (quantity * avgPrice);
            long profitLoss = marketValue - investedValue;
            double returnRate = investedValue > 0 ? (double) profitLoss / investedValue * 100 : 0;

            holdings.add(VirtPortfolioResponse.VirtHolding.builder()
                    .stockCode(currency)
                    .stockName(currency)
                    .quantity(quantity)
                    .averagePrice((long) avgPrice)
                    .currentPrice((long) currentPrice)
                    .marketValue(marketValue)
                    .profitLoss(profitLoss)
                    .returnRate(Math.round(returnRate * 100.0) / 100.0)
                    .build());
        }

        long holdingsValue = holdings.stream().mapToLong(VirtPortfolioResponse.VirtHolding::getMarketValue).sum();
        long totalPnl = holdings.stream().mapToLong(VirtPortfolioResponse.VirtHolding::getProfitLoss).sum();
        long totalValue = cashBalance + holdingsValue;
        long investedAmount = totalValue - totalPnl;
        double returnRate = investedAmount != 0 ? (double) totalPnl / investedAmount * 100 : 0;

        return VirtPortfolioResponse.builder()
                .totalValue(totalValue)
                .cashBalance(cashBalance)
                .holdingsValue(holdingsValue)
                .totalPnl(totalPnl)
                .returnRate(Math.round(returnRate * 100.0) / 100.0)
                .holdings(holdings)
                .build();
    }

    /* ═══════ 비트겟 (코인) ═══════ */

    public void saveBitgetCredential(String userId, String apiKey, String secretKey, String passphrase) {
        VirtCredential cred = credentialRepo.findByUserId(userId)
                .orElse(new VirtCredential(userId));
        cred.setEncryptedBitgetApiKey(CryptoUtil.encrypt(apiKey, encryptionKey));
        cred.setEncryptedBitgetSecretKey(CryptoUtil.encrypt(secretKey, encryptionKey));
        cred.setEncryptedBitgetPassphrase(CryptoUtil.encrypt(passphrase, encryptionKey));
        cred.setUpdatedAt(java.time.LocalDateTime.now());
        credentialRepo.save(cred);
        log.info("[Virt] 비트겟 자격증명 저장: userId={}", userId);
    }

    public boolean hasBitgetCredential(String userId) {
        return credentialRepo.findByUserId(userId)
                .map(c -> c.getEncryptedBitgetApiKey() != null && !c.getEncryptedBitgetApiKey().isEmpty())
                .orElse(false);
    }

    public void deleteBitgetCredential(String userId) {
        credentialRepo.findByUserId(userId).ifPresent(cred -> {
            cred.setEncryptedBitgetApiKey(null);
            cred.setEncryptedBitgetSecretKey(null);
            cred.setEncryptedBitgetPassphrase(null);
            cred.setUpdatedAt(java.time.LocalDateTime.now());
            credentialRepo.save(cred);
        });
        portfolioCache.remove("bitget:" + userId);
        log.info("[Virt] 비트겟 자격증명 삭제: userId={}", userId);
    }

    public Map<String, Object> getBitgetCredentialInfo(String userId) {
        VirtCredential cred = credentialRepo.findByUserId(userId).orElse(null);
        if (cred == null || cred.getEncryptedBitgetApiKey() == null) {
            return Map.of("connected", false);
        }
        String ak = CryptoUtil.decrypt(cred.getEncryptedBitgetApiKey(), encryptionKey);
        String masked = ak.length() >= 6 ? ak.substring(0, 4) + "****" : "****";
        return Map.of("connected", true, "apiKey", masked);
    }

    /** 비트겟 현물 포트폴리오 조회 */
    public VirtPortfolioResponse getBitgetPortfolio(String userId) {
        return getCachedOrFetch(portfolioCache, "bitget:" + userId, () -> fetchBitgetPortfolio(userId));
    }

    private VirtPortfolioResponse fetchBitgetPortfolio(String userId) {
        VirtCredential cred = credentialRepo.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("비트겟 API 키가 등록되지 않았습니다."));
        if (cred.getEncryptedBitgetApiKey() == null) {
            throw new RuntimeException("비트겟 API 키가 등록되지 않았습니다.");
        }

        String apiKey = CryptoUtil.decrypt(cred.getEncryptedBitgetApiKey(), encryptionKey);
        String secretKey = CryptoUtil.decrypt(cred.getEncryptedBitgetSecretKey(), encryptionKey);
        String passphrase = CryptoUtil.decrypt(cred.getEncryptedBitgetPassphrase(), encryptionKey);

        // 1) 자산 조회
        List<Map<String, Object>> assets = bitgetClient.getSpotAssets(apiKey, secretKey, passphrase);

        // 2) 시세 일괄 조회 (USDT 마켓)
        List<Map<String, Object>> tickers = bitgetClient.getSpotTickers();
        Map<String, Double> priceMap = new HashMap<>();
        for (Map<String, Object> t : tickers) {
            String symbol = String.valueOf(t.get("symbol")); // "BTCUSDT"
            double lastPrice = Double.parseDouble(String.valueOf(t.get("lastPr")));
            priceMap.put(symbol, lastPrice);
        }

        // USDT/KRW 환율 (업비트 시세 참조 또는 고정값)
        double usdtKrw = priceMap.getOrDefault("USDTKRW", 1380.0); // 기본 환율

        long cashBalance = 0;
        List<VirtPortfolioResponse.VirtHolding> holdings = new ArrayList<>();

        for (Map<String, Object> asset : assets) {
            String coin = String.valueOf(asset.get("coin"));
            double available = Double.parseDouble(String.valueOf(asset.get("available")));
            double frozen = Double.parseDouble(String.valueOf(asset.get("frozen")));
            double total = available + frozen;

            if (total < 0.00000001) continue;

            if ("USDT".equals(coin)) {
                cashBalance = (long) (total * usdtKrw);
                continue;
            }

            String symbol = coin + "USDT";
            double priceUsdt = priceMap.getOrDefault(symbol, 0.0);
            double priceKrw = priceUsdt * usdtKrw;
            long marketValue = (long) (total * priceKrw);

            // 비트겟 API는 평균매입가를 직접 제공하지 않으므로 현재가 기준으로 표시
            holdings.add(VirtPortfolioResponse.VirtHolding.builder()
                    .stockCode(coin)
                    .stockName(coin)
                    .quantity(total)
                    .averagePrice((long) priceKrw)
                    .currentPrice((long) priceKrw)
                    .marketValue(marketValue)
                    .profitLoss(0) // 평균매입가 미제공
                    .returnRate(0)
                    .build());
        }

        long holdingsValue = holdings.stream().mapToLong(VirtPortfolioResponse.VirtHolding::getMarketValue).sum();
        long totalValue = cashBalance + holdingsValue;

        return VirtPortfolioResponse.builder()
                .totalValue(totalValue)
                .cashBalance(cashBalance)
                .holdingsValue(holdingsValue)
                .totalPnl(0)
                .returnRate(0)
                .holdings(holdings)
                .build();
    }

    /* ───── 유틸 ───── */

    private VirtCredential getCredentialOrThrow(String userId) {
        return credentialRepo.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("API 키가 등록되지 않았습니다. Virt 설정에서 KIS API 키를 등록해주세요."));
    }

    private static long safeLong(String value) {
        if (value == null || value.isEmpty()) return 0;
        try { return (long) Double.parseDouble(value); } catch (NumberFormatException e) { return 0; }
    }

    private static int safeInt(String value) {
        if (value == null || value.isEmpty()) return 0;
        try { return (int) Double.parseDouble(value); } catch (NumberFormatException e) { return 0; }
    }

    private static double safeDouble(String value) {
        if (value == null || value.isEmpty()) return 0;
        try { return Double.parseDouble(value); } catch (NumberFormatException e) { return 0; }
    }
}
