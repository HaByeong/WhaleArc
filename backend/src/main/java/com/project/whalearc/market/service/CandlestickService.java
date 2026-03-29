package com.project.whalearc.market.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.project.whalearc.market.dto.CandlestickResponse;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class CandlestickService {

    private final KisApiClient kisApiClient;

    @Value("${bithumb.api.base-url:https://api.bithumb.com}")
    private String baseUrl;

    @Value("${bithumb.api.timeout-ms:5000}")
    private int timeoutMs;

    private RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /* ───── 캔들스틱 캐시 (주식 10분, 암호화폐 1분) ───── */
    private record CandleCache(List<CandlestickResponse> data, long expireAt) {
        boolean isValid() { return System.currentTimeMillis() < expireAt; }
    }
    private static final long STOCK_CACHE_TTL = 10 * 60 * 1000L;  // 10분
    private static final long CRYPTO_CACHE_TTL = 60 * 1000L;       // 1분
    private static final int MAX_CACHE_SIZE = 100;
    private final ConcurrentHashMap<String, CandleCache> candleCache = new ConcurrentHashMap<>();

    @PostConstruct
    public void init() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(timeoutMs);
        factory.setReadTimeout(timeoutMs);
        this.restTemplate = new RestTemplate(factory);
    }

    /**
     * 캔들스틱 조회 — 암호화폐 or 주식
     * @param symbol 가상화폐 심볼(BTC 등) 또는 주식 종목코드(005930 등)
     * @param interval 차트 간격
     * @param assetType "STOCK" 또는 null(=CRYPTO)
     */
    public List<CandlestickResponse> getCandlesticks(String symbol, String interval, String assetType) {
        boolean isStock = "STOCK".equalsIgnoreCase(assetType);
        String cacheKey = symbol + ":" + interval + ":" + (isStock ? "STOCK" : "CRYPTO");

        // 캐시 확인
        CandleCache cached = candleCache.get(cacheKey);
        if (cached != null && cached.isValid()) {
            log.debug("캔들스틱 캐시 히트: {}", cacheKey);
            return cached.data();
        }

        // API 조회
        List<CandlestickResponse> result = isStock
                ? getStockCandlesticks(symbol)
                : getCryptoCandlesticks(symbol, interval);

        // 빈 응답은 캐시하지 않음
        if (!result.isEmpty()) {
            long ttl = isStock ? STOCK_CACHE_TTL : CRYPTO_CACHE_TTL;
            candleCache.put(cacheKey, new CandleCache(result, System.currentTimeMillis() + ttl));

            // 캐시 크기 제한
            if (candleCache.size() > MAX_CACHE_SIZE) {
                candleCache.entrySet().stream()
                        .min(java.util.Comparator.comparingLong(e -> e.getValue().expireAt()))
                        .ifPresent(e -> candleCache.remove(e.getKey()));
            }
        }

        return result;
    }

    /** 기존 빗썸 캔들스틱 (하위 호환) */
    public List<CandlestickResponse> getCandlesticks(String symbol, String interval) {
        return getCandlesticks(symbol, interval, null);
    }

    /** 국내주식 일봉 (KIS API) — 최대 2년치 데이터를 3개월 단위로 반복 조회 */
    private List<CandlestickResponse> getStockCandlesticks(String stockCode) {
        if (!kisApiClient.isConfigured()) {
            log.warn("KIS API 미설정 — 주식 캔들스틱 조회 불가: {}", stockCode);
            return List.of();
        }

        try {
            DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyyMMdd");
            LocalDate now = LocalDate.now();
            List<CandlestickResponse> allResults = new ArrayList<>();
            int consecutiveEmpty = 0;

            // 3개월 단위로 최대 2년(8구간) 반복 조회
            for (int i = 0; i < 8; i++) {
                LocalDate chunkEnd = now.minusMonths(3L * i);
                LocalDate chunkStart = now.minusMonths(3L * (i + 1)).plusDays(1);

                // 개별 청크에 대해 최대 2회 재시도
                List<Map<String, String>> candles = null;
                for (int retry = 0; retry < 2; retry++) {
                    candles = kisApiClient.getStockDailyCandles(
                            stockCode, chunkStart.format(fmt), chunkEnd.format(fmt));
                    if (candles != null && !candles.isEmpty()) break;
                    // 재시도 전 대기
                    try { Thread.sleep(1000); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
                }

                if (candles == null || candles.isEmpty()) {
                    consecutiveEmpty++;
                    // 연속 2번 빈 응답이면 더 이상 과거 데이터 없다고 판단
                    if (consecutiveEmpty >= 2) {
                        log.debug("주식 일봉 [{}]: 연속 빈 응답 {}회, 과거 데이터 조회 중단", stockCode, consecutiveEmpty);
                        break;
                    }
                    continue; // 한 번 빈 응답은 건너뛰고 다음 구간 시도
                }
                consecutiveEmpty = 0;

                for (Map<String, String> c : candles) {
                    String dateStr = c.get("stck_bsop_date");
                    if (dateStr == null || dateStr.isEmpty()) continue;

                    LocalDate date = LocalDate.parse(dateStr, fmt);
                    long time = date.atStartOfDay().toEpochSecond(java.time.ZoneOffset.of("+09:00"));
                    double open = parseDouble(c.get("stck_oprc"));
                    double high = parseDouble(c.get("stck_hgpr"));
                    double low = parseDouble(c.get("stck_lwpr"));
                    double close = parseDouble(c.get("stck_clpr"));
                    double volume = parseDouble(c.get("acml_vol"));

                    allResults.add(new CandlestickResponse(time, open, high, low, close, volume));
                }

                // KIS API 속도 제한 준수 (초당 1회 이하)
                if (i < 7) {
                    try { Thread.sleep(1000); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
                }
            }

            // 시간순 정렬 + 중복 제거
            allResults.sort(java.util.Comparator.comparingLong(CandlestickResponse::getTime));
            List<CandlestickResponse> deduped = new ArrayList<>();
            long prevTime = -1;
            for (CandlestickResponse cr : allResults) {
                if (cr.getTime() != prevTime) {
                    deduped.add(cr);
                    prevTime = cr.getTime();
                }
            }

            log.info("주식 일봉 {}개 조회 (최대 2년): {}", deduped.size(), stockCode);
            return deduped;
        } catch (Exception e) {
            log.error("주식 캔들스틱 조회 실패 [{}]: {}", stockCode, e.getMessage());
            return List.of();
        }
    }

    /** 앱 interval 형식을 빗썸 API 형식으로 변환 */
    private String toBithumbInterval(String interval) {
        return switch (interval) {
            case "1d" -> "24h";
            case "1w" -> "24h";
            default -> interval; // 1m, 3m, 5m, 10m, 30m, 1h, 6h, 12h 그대로 사용
        };
    }

    /** 빗썸 캔들스틱 API 호출 (최대 3회 재시도) */
    @SuppressWarnings("unchecked")
    private List<CandlestickResponse> getCryptoCandlesticks(String symbol, String interval) {
        String bithumbInterval = toBithumbInterval(interval);
        String url = baseUrl + "/public/candlestick/" + symbol + "_KRW/" + bithumbInterval;

        for (int attempt = 1; attempt <= 3; attempt++) {
            try {
                Map<String, Object> response = restTemplate.getForObject(url, Map.class);

                if (response == null || !"0000".equals(response.get("status"))) {
                    log.warn("빗썸 캔들스틱 API 오류 (시도 {}/3): symbol={}, interval={}", attempt, symbol, bithumbInterval);
                    if (attempt < 3) {
                        try { Thread.sleep(500L * attempt); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
                        continue;
                    }
                    return List.of();
                }

                List<List<Object>> data = objectMapper.convertValue(
                        response.get("data"), new TypeReference<List<List<Object>>>() {}
                );

                if (data == null) return List.of();

                List<CandlestickResponse> result = new ArrayList<>();
                for (List<Object> candle : data) {
                    if (candle == null || candle.size() < 6) continue;
                    long time = ((Number) candle.get(0)).longValue() / 1000;
                    double open = parseDouble(candle.get(1));
                    double close = parseDouble(candle.get(2));
                    double high = parseDouble(candle.get(3));
                    double low = parseDouble(candle.get(4));
                    double volume = parseDouble(candle.get(5));

                    result.add(new CandlestickResponse(time, open, high, low, close, volume));
                }

                log.debug("캔들스틱 {}개 조회: {} / {}", result.size(), symbol, interval);
                return result;
            } catch (Exception e) {
                log.warn("캔들스틱 조회 오류 [{}/{}] (시도 {}/3): {}", symbol, interval, attempt, e.getMessage());
                if (attempt < 3) {
                    try { Thread.sleep(500L * attempt); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
                }
            }
        }

        log.error("캔들스틱 조회 최종 실패 [{}/{}]: 3회 재시도 후 실패", symbol, interval);
        return List.of();
    }

    private long parseLong(Object value) {
        try {
            return Long.parseLong(String.valueOf(value).replace("\"", ""));
        } catch (Exception e) {
            return 0L;
        }
    }

    private double parseDouble(Object value) {
        try {
            return Double.parseDouble(String.valueOf(value).replace("\"", ""));
        } catch (Exception e) {
            return 0.0;
        }
    }
}
