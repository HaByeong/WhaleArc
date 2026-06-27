package com.project.whalearc.exchange.service.client;

import com.project.whalearc.exchange.dto.ExchangeHoldingDto;
import com.project.whalearc.exchange.dto.ExchangePortfolioDto;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * 업비트(Upbit) Open API 클라이언트
 * API 문서: https://docs.upbit.com
 */
@Component
@RequiredArgsConstructor
public class UpbitApiClient {

    private static final String BASE_URL = "https://api.upbit.com/v1";
    private final RestTemplate restTemplate = new RestTemplate();

    @SuppressWarnings("unchecked")
    public ExchangePortfolioDto getPortfolio(String accessKey, String secretKey) {
        try {
            // 1. JWT 토큰 생성
            String token = generateJwtToken(accessKey, secretKey);

            // 2. 전체 계좌 조회
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + token);

            HttpEntity<Void> request = new HttpEntity<>(headers);
            ResponseEntity<List> response = restTemplate.exchange(
                    BASE_URL + "/accounts", HttpMethod.GET, request, List.class);

            List<ExchangeHoldingDto> holdings = new ArrayList<>();
            double totalValue = 0;
            double totalProfitLoss = 0;
            double cashBalance = 0;
            boolean priceFetchFailed = false;   // 보유종목 존재 + 시세 일괄조회 전면 실패 시 true

            if (response.getBody() != null) {
                List<Map<String, Object>> accounts = response.getBody();

                // KRW 잔고와 코인 보유분 분리
                List<String> markets = new ArrayList<>();
                Map<String, Map<String, Object>> accountMap = new HashMap<>();

                for (Map<String, Object> account : accounts) {
                    String currency = (String) account.get("currency");
                    if ("KRW".equals(currency)) {
                        cashBalance = parseDouble(account.get("balance"));
                    } else {
                        String market = "KRW-" + currency;
                        markets.add(market);
                        accountMap.put(currency, account);
                    }
                }

                // 3. 현재가 조회
                if (!markets.isEmpty()) {
                    Map<String, Double> prices = getCurrentPrices(markets);
                    // 보유 종목이 있는데 시세 일괄조회가 전면 실패(빈 맵)하면, 아래에서 현재가가 매입가로 폴백돼
                    // 손익이 전부 0인 잘못된 스냅샷이 만들어진다. 이 부분 실패를 fetchOk=false로 표시해
                    // ExchangeAccountService의 lastGood 유지 보호가 작동하게 한다.
                    priceFetchFailed = prices.isEmpty();

                    for (Map.Entry<String, Map<String, Object>> entry : accountMap.entrySet()) {
                        String currency = entry.getKey();
                        Map<String, Object> acc = entry.getValue();

                        double balance = parseDouble(acc.get("balance"));
                        double locked = parseDouble(acc.get("locked"));
                        double avgBuyPrice = parseDouble(acc.get("avg_buy_price"));
                        double qty = balance + locked;

                        Double currentPrice = prices.get("KRW-" + currency);
                        if (currentPrice == null) currentPrice = avgBuyPrice;

                        double marketValue = qty * currentPrice;
                        double profitLoss = marketValue - (qty * avgBuyPrice);
                        double returnRate = avgBuyPrice > 0
                                ? ((currentPrice - avgBuyPrice) / avgBuyPrice) * 100 : 0;

                        if (qty > 0) {
                            holdings.add(new ExchangeHoldingDto(
                                    currency, getCoinName(currency), qty,
                                    avgBuyPrice, currentPrice, marketValue, profitLoss, returnRate));
                            totalValue += marketValue;
                            totalProfitLoss += profitLoss;
                        }
                    }
                }
            }

            totalValue += cashBalance;
            double invested = totalValue - cashBalance - totalProfitLoss;
            double totalReturnRate = invested > 0 ? (totalProfitLoss / invested) * 100 : 0;

            ExchangePortfolioDto dto = new ExchangePortfolioDto("UPBIT", true, totalValue, totalProfitLoss,
                    totalReturnRate, cashBalance, holdings);
            if (priceFetchFailed) {
                // 시세 일괄조회 전면 실패 → 손익이 매입가 기준(0)으로 묻힌 잘못된 스냅샷이므로 정상 응답과 구분
                dto.setFetchOk(false);
            }
            return dto;

        } catch (Exception e) {
            System.err.println("업비트 API 호출 실패: " + e.getMessage());
            ExchangePortfolioDto failed = new ExchangePortfolioDto("UPBIT", true, 0, 0, 0, 0, new ArrayList<>());
            failed.setFetchOk(false);   // 조회 실패 → 빈 계좌와 구분(에러 UI·자산추이 스냅샷 스킵)
            return failed;
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Double> getCurrentPrices(List<String> markets) {
        Map<String, Double> prices = new HashMap<>();
        try {
            String marketsParam = String.join(",", markets);
            ResponseEntity<List> response = restTemplate.getForEntity(
                    BASE_URL + "/ticker?markets=" + marketsParam, List.class);

            if (response.getBody() != null) {
                for (Object item : response.getBody()) {
                    Map<String, Object> ticker = (Map<String, Object>) item;
                    String market = (String) ticker.get("market");
                    double price = parseDouble(ticker.get("trade_price"));
                    prices.put(market, price);
                }
            }
        } catch (Exception e) {
            System.err.println("업비트 시세 조회 실패: " + e.getMessage());
        }
        return prices;
    }

    private String generateJwtToken(String accessKey, String secretKey) {
        try {
            long now = System.currentTimeMillis();
            String header = Base64.getUrlEncoder().withoutPadding()
                    .encodeToString("{\"alg\":\"HS256\",\"typ\":\"JWT\"}".getBytes(StandardCharsets.UTF_8));
            String payload = Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(("{\"access_key\":\"" + accessKey
                            + "\",\"nonce\":\"" + UUID.randomUUID()
                            + "\",\"timestamp\":" + now + "}").getBytes(StandardCharsets.UTF_8));

            String signingInput = header + "." + payload;
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secretKey.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            String signature = Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(mac.doFinal(signingInput.getBytes(StandardCharsets.UTF_8)));

            return signingInput + "." + signature;
        } catch (Exception e) {
            throw new RuntimeException("JWT 토큰 생성 실패", e);
        }
    }

    private String getCoinName(String currency) {
        Map<String, String> names = Map.ofEntries(
                Map.entry("BTC", "비트코인"), Map.entry("ETH", "이더리움"),
                Map.entry("XRP", "리플"), Map.entry("SOL", "솔라나"),
                Map.entry("DOGE", "도지코인"), Map.entry("ADA", "에이다"),
                Map.entry("DOT", "폴카닷"), Map.entry("MATIC", "폴리곤"),
                Map.entry("AVAX", "아발란체"), Map.entry("LINK", "체인링크")
        );
        return names.getOrDefault(currency, currency);
    }

    private double parseDouble(Object value) {
        if (value == null) return 0;
        try {
            return Double.parseDouble(value.toString());
        } catch (NumberFormatException e) {
            return 0;
        }
    }
}
