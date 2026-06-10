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
import java.time.Instant;
import java.util.*;

/**
 * 비트겟(Bitget) Open API 클라이언트
 * API 문서: https://www.bitget.com/api-doc
 */
@Component
@RequiredArgsConstructor
public class BitgetApiClient {

    private static final String BASE_URL = "https://api.bitget.com";
    private static final String SPOT_ASSETS_PATH = "/api/v2/spot/account/assets";
    private final RestTemplate restTemplate = new RestTemplate();

    @SuppressWarnings("unchecked")
    public ExchangePortfolioDto getPortfolio(String apiKey, String secretKey, String passphrase) {
        try {
            String timestamp = String.valueOf(Instant.now().toEpochMilli());
            String method = "GET";
            String requestPath = SPOT_ASSETS_PATH;

            // HMAC 서명 생성 (passphrase는 서명에 포함하지 않고 별도 헤더로 전달)
            String preSign = timestamp + method + requestPath;
            String signature = hmacSha256(secretKey, preSign);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("ACCESS-KEY", apiKey);
            headers.set("ACCESS-SIGN", signature);
            headers.set("ACCESS-TIMESTAMP", timestamp);
            headers.set("ACCESS-PASSPHRASE", passphrase); // Bitget 인증 필수 헤더 (누락 시 항상 인증 실패)
            headers.set("locale", "ko-KR");

            HttpEntity<Void> request = new HttpEntity<>(headers);
            ResponseEntity<Map> response = restTemplate.exchange(
                    BASE_URL + requestPath, HttpMethod.GET, request, Map.class);

            List<ExchangeHoldingDto> holdings = new ArrayList<>();
            double totalValue = 0;
            double totalProfitLoss = 0;
            double cashBalance = 0;
            // USDT 기준 코인 시세를 KRW 환산하는 데 쓰는 환율 (응답에 무관하게 한 번 조회)
            double usdtToKrw = getUsdtToKrw();

            if (response.getBody() != null && response.getBody().get("data") != null) {
                List<Map<String, Object>> assets = (List<Map<String, Object>>) response.getBody().get("data");

                for (Map<String, Object> asset : assets) {
                    String coin = (String) asset.get("coin");
                    double available = parseDouble(asset.get("available"));
                    double frozen = parseDouble(asset.get("frozen"));
                    double qty = available + frozen;

                    if (qty <= 0) continue;

                    if ("USDT".equals(coin) || "USDC".equals(coin)) {
                        cashBalance += qty * usdtToKrw;
                        continue;
                    }

                    // 코인별 현재가 조회
                    double priceUsdt = getCoinPriceUsdt(coin);
                    double currentPriceKrw = priceUsdt * usdtToKrw;
                    double marketValue = qty * currentPriceKrw;

                    // 한계: Bitget spot assets 엔드포인트는 평단가(avg cost)를 제공하지 않아
                    // 손익(profitLoss/Rate)을 산출할 수 없다. 정확한 손익은 체결내역 재구성이 필요(추후 과제).
                    // 평가액·현재가는 정상 산출되며, 손익은 0이 아니라 '미산출'임에 유의.
                    holdings.add(new ExchangeHoldingDto(
                            coin, getCoinName(coin), qty,
                            0, currentPriceKrw, marketValue, 0, 0));
                    totalValue += marketValue;
                }
            }

            totalValue += cashBalance;
            ExchangePortfolioDto dto = new ExchangePortfolioDto("BITGET", true, totalValue, totalProfitLoss,
                    0, cashBalance, holdings);
            dto.setUsdtKrwRate(usdtToKrw);
            return dto;

        } catch (Exception e) {
            System.err.println("비트겟 API 호출 실패: " + e.getMessage());
            ExchangePortfolioDto failed = new ExchangePortfolioDto("BITGET", true, 0, 0, 0, 0, new ArrayList<>());
            failed.setFetchOk(false);   // 조회 실패 → 빈 계좌와 구분(에러 UI·자산추이 스냅샷 스킵)
            return failed;
        }
    }

    @SuppressWarnings("unchecked")
    private double getCoinPriceUsdt(String coin) {
        try {
            ResponseEntity<Map> response = restTemplate.getForEntity(
                    BASE_URL + "/api/v2/spot/market/tickers?symbol=" + coin + "USDT", Map.class);
            if (response.getBody() != null && response.getBody().get("data") != null) {
                List<Map<String, Object>> data = (List<Map<String, Object>>) response.getBody().get("data");
                if (!data.isEmpty()) {
                    return parseDouble(data.get(0).get("lastPr"));
                }
            }
        } catch (Exception e) {
            System.err.println("비트겟 시세 조회 실패 (" + coin + "): " + e.getMessage());
        }
        return 0;
    }

    @SuppressWarnings("unchecked")
    private double getUsdtToKrw() {
        try {
            // 업비트 USDT/KRW 시세 활용
            ResponseEntity<List> response = restTemplate.getForEntity(
                    "https://api.upbit.com/v1/ticker?markets=KRW-USDT", List.class);
            if (response.getBody() != null && !response.getBody().isEmpty()) {
                Map<String, Object> ticker = (Map<String, Object>) response.getBody().get(0);
                return parseDouble(ticker.get("trade_price"));
            }
        } catch (Exception e) {
            System.err.println("USDT/KRW 환율 조회 실패: " + e.getMessage());
        }
        return 1350; // 기본 환율
    }

    private String hmacSha256(String secret, String message) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] hash = mac.doFinal(message.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(hash);
        } catch (Exception e) {
            throw new RuntimeException("HMAC 서명 생성 실패", e);
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
