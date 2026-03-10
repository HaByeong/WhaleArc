package com.project.whalearc.market.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.project.whalearc.market.domain.AssetType;
import com.project.whalearc.market.dto.MarketPriceResponse;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.concurrent.atomic.AtomicLong;

@Slf4j
@Service
public class CryptoPriceProvider {

    @Value("${bithumb.api.base-url:https://api.bithumb.com}")
    private String baseUrl;

    @Value("${bithumb.api.timeout-ms:5000}")
    private int timeoutMs;

    @Value("${bithumb.api.cache-ttl-ms:10000}")
    private long cacheTtlMs;

    @Value("${bithumb.api.max-retries:2}")
    private int maxRetries;

    private RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    // 인메모리 캐시
    private volatile List<MarketPriceResponse> cachedPrices = List.of();
    private final AtomicLong lastFetchTime = new AtomicLong(0);

    // 주요 가상화폐 한글명 매핑
    private static final Map<String, String> COIN_NAMES = Map.ofEntries(
            Map.entry("BTC", "비트코인"), Map.entry("ETH", "이더리움"),
            Map.entry("XRP", "리플"), Map.entry("SOL", "솔라나"),
            Map.entry("DOGE", "도지코인"), Map.entry("ADA", "에이다"),
            Map.entry("DOT", "폴카닷"), Map.entry("MATIC", "폴리곤"), Map.entry("POL", "폴리곤"),
            Map.entry("AVAX", "아발란체"), Map.entry("LINK", "체인링크"),
            Map.entry("TRX", "트론"), Map.entry("ATOM", "코스모스"),
            Map.entry("UNI", "유니스왑"), Map.entry("APT", "앱토스"),
            Map.entry("ARB", "아비트럼"), Map.entry("OP", "옵티미즘"),
            Map.entry("NEAR", "니어프로토콜"), Map.entry("AAVE", "에이브"),
            Map.entry("EOS", "이오스"), Map.entry("BCH", "비트코인캐시"),
            Map.entry("LTC", "라이트코인"), Map.entry("ETC", "이더리움클래식"),
            Map.entry("XLM", "스텔라루멘"), Map.entry("SAND", "샌드박스"),
            Map.entry("MANA", "디센트럴랜드"), Map.entry("AXS", "엑시인피니티"),
            Map.entry("SHIB", "시바이누"), Map.entry("FIL", "파일코인"),
            Map.entry("ALGO", "알고랜드"), Map.entry("HBAR", "헤데라"),
            Map.entry("ICP", "인터넷컴퓨터"), Map.entry("VET", "비체인"),
            Map.entry("THETA", "쎄타토큰"), Map.entry("SUI", "수이"),
            Map.entry("SEI", "세이"), Map.entry("STX", "스택스"),
            Map.entry("IMX", "이뮤터블X"), Map.entry("PEPE", "페페"),
            Map.entry("WLD", "월드코인"), Map.entry("BLUR", "블러")
    );

    @PostConstruct
    public void init() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(timeoutMs);
        factory.setReadTimeout(timeoutMs);
        this.restTemplate = new RestTemplate(factory);
        log.info("CryptoPriceProvider 초기화 완료: baseUrl={}, timeout={}ms, cacheTTL={}ms", baseUrl, timeoutMs, cacheTtlMs);
    }

    /** 캐시 우선 조회 */
    public List<MarketPriceResponse> getAllKrwTickers() {
        long now = System.currentTimeMillis();

        if (!cachedPrices.isEmpty() && (now - lastFetchTime.get()) < cacheTtlMs) {
            return cachedPrices;
        }

        List<MarketPriceResponse> freshData = fetchWithRetry();

        if (!freshData.isEmpty()) {
            cachedPrices = freshData;
            lastFetchTime.set(now);
        } else if (!cachedPrices.isEmpty()) {
            log.warn("빗썸 API 실패 — 기존 캐시 유지 (age={}ms)", now - lastFetchTime.get());
        }

        return cachedPrices;
    }

    /** 캐시 무시 강제 새로고침 */
    public List<MarketPriceResponse> forceRefresh() {
        List<MarketPriceResponse> freshData = fetchWithRetry();
        if (!freshData.isEmpty()) {
            cachedPrices = freshData;
            lastFetchTime.set(System.currentTimeMillis());
        }
        return cachedPrices;
    }

    /** 캐시 상태 */
    public Map<String, Object> getCacheStatus() {
        long age = System.currentTimeMillis() - lastFetchTime.get();
        return Map.of(
                "cachedCount", cachedPrices.size(),
                "cacheAgeMs", age,
                "cacheTtlMs", cacheTtlMs,
                "isStale", age > cacheTtlMs
        );
    }

    private List<MarketPriceResponse> fetchWithRetry() {
        for (int attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                List<MarketPriceResponse> result = fetchFromBithumb();
                if (attempt > 1) {
                    log.info("빗썸 API 호출 성공 ({}번째 시도)", attempt);
                }
                return result;
            } catch (Exception e) {
                log.error("빗썸 API 호출 실패 (시도 {}/{}): {}", attempt, maxRetries, e.getMessage());
                if (attempt < maxRetries) {
                    try {
                        Thread.sleep(500L * attempt);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        break;
                    }
                }
            }
        }
        return List.of();
    }

    @SuppressWarnings("unchecked")
    private List<MarketPriceResponse> fetchFromBithumb() {
        String url = baseUrl + "/public/ticker/ALL_KRW";

        Map<String, Object> response = restTemplate.getForObject(url, Map.class);

        if (response == null || !"0000".equals(response.get("status"))) {
            String status = response != null ? String.valueOf(response.get("status")) : "null";
            throw new RuntimeException("빗썸 API 응답 상태 오류: " + status);
        }

        Object data = response.get("data");
        if (data == null) {
            throw new RuntimeException("빗썸 API 응답에 data 없음");
        }

        Map<String, Object> rawData = objectMapper.convertValue(
                data, new TypeReference<Map<String, Object>>() {}
        );

        List<MarketPriceResponse> result = new ArrayList<>();

        for (Map.Entry<String, Object> entry : rawData.entrySet()) {
            String symbol = entry.getKey();
            if ("date".equalsIgnoreCase(symbol)) continue;

            try {
                Map<String, String> ticker = objectMapper.convertValue(
                        entry.getValue(), new TypeReference<Map<String, String>>() {}
                );

                double closingPrice = Double.parseDouble(ticker.get("closing_price"));
                double prevClosing = Double.parseDouble(ticker.get("prev_closing_price"));
                double change = closingPrice - prevClosing;
                double changeRate = prevClosing == 0
                        ? 0
                        : Math.round((change * 10000.0 / prevClosing)) / 100.0;

                MarketPriceResponse dto = new MarketPriceResponse();
                dto.setAssetType(AssetType.CRYPTO);
                dto.setSymbol(symbol);
                dto.setName(COIN_NAMES.getOrDefault(symbol, symbol));
                dto.setPrice(closingPrice);
                dto.setChange(change);
                dto.setChangeRate(changeRate);
                // units_traded_24H는 가상화폐 단위 → KRW 환산 거래대금
                double coinVolume = parseDoubleSafe(ticker.getOrDefault("units_traded_24H", "0"));
                dto.setVolume((long) (coinVolume * closingPrice));
                dto.setMarket("BITHUMB_KRW");

                result.add(dto);
            } catch (Exception e) {
                log.debug("가상화폐 파싱 실패 [{}]: {}", symbol, e.getMessage());
            }
        }

        result.sort(Comparator.comparingLong(MarketPriceResponse::getVolume).reversed());
        log.debug("빗썸 시세 {}개 가상화폐 조회 완료", result.size());
        return result;
    }

    private double parseDoubleSafe(String value) {
        try {
            return Double.parseDouble(value);
        } catch (Exception e) {
            return 0.0;
        }
    }
}
