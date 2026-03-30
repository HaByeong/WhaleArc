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
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.*;

import jakarta.annotation.PreDestroy;

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

    private ExecutorService chunkExecutor;

    @PostConstruct
    public void init() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(timeoutMs);
        factory.setReadTimeout(timeoutMs);
        this.restTemplate = new RestTemplate(factory);
        this.chunkExecutor = Executors.newFixedThreadPool(4);
    }

    @PreDestroy
    public void destroy() {
        if (chunkExecutor != null) chunkExecutor.shutdownNow();
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

    /** 국내주식 일봉 (KIS API) — 최대 2년치 데이터를 3개월 단위로 병렬 조회 */
    private List<CandlestickResponse> getStockCandlesticks(String stockCode) {
        if (!kisApiClient.isConfigured()) {
            log.warn("KIS API 미설정 — 주식 캔들스틱 조회 불가: {}", stockCode);
            return List.of();
        }

        try {
            DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyyMMdd");
            LocalDate now = LocalDate.now();

            // 8청크를 병렬 요청 (300ms 간격 stagger로 rate limit 준수)
            List<CompletableFuture<List<CandlestickResponse>>> futures = new ArrayList<>();
            for (int i = 0; i < 8; i++) {
                final int idx = i;
                futures.add(CompletableFuture.supplyAsync(() -> {
                    if (idx > 0) {
                        try { Thread.sleep(300L * idx); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
                    }
                    return fetchStockChunk(stockCode, idx, fmt, now);
                }, chunkExecutor));
            }

            List<CandlestickResponse> allResults = new ArrayList<>();
            for (CompletableFuture<List<CandlestickResponse>> future : futures) {
                try {
                    allResults.addAll(future.get(15, TimeUnit.SECONDS));
                } catch (Exception e) {
                    log.debug("주식 캔들 청크 조회 타임아웃 [{}]: {}", stockCode, e.getMessage());
                }
            }

            // 시간순 정렬 + 중복 제거
            allResults.sort(Comparator.comparingLong(CandlestickResponse::getTime));
            List<CandlestickResponse> deduped = new ArrayList<>();
            long prevTime = -1;
            for (CandlestickResponse cr : allResults) {
                if (cr.getTime() != prevTime) {
                    deduped.add(cr);
                    prevTime = cr.getTime();
                }
            }

            log.info("주식 일봉 {}개 조회 (병렬, 최대 2년): {}", deduped.size(), stockCode);
            return deduped;
        } catch (Exception e) {
            log.error("주식 캔들스틱 조회 실패 [{}]: {}", stockCode, e.getMessage());
            return List.of();
        }
    }

    /** 단일 3개월 청크 조회 (최대 2회 재시도) */
    private List<CandlestickResponse> fetchStockChunk(String stockCode, int chunkIndex, DateTimeFormatter fmt, LocalDate now) {
        LocalDate chunkEnd = now.minusMonths(3L * chunkIndex);
        LocalDate chunkStart = now.minusMonths(3L * (chunkIndex + 1)).plusDays(1);

        for (int retry = 0; retry < 2; retry++) {
            List<Map<String, String>> candles = kisApiClient.getStockDailyCandles(
                    stockCode, chunkStart.format(fmt), chunkEnd.format(fmt));
            if (candles != null && !candles.isEmpty()) {
                List<CandlestickResponse> result = new ArrayList<>();
                for (Map<String, String> c : candles) {
                    String dateStr = c.get("stck_bsop_date");
                    if (dateStr == null || dateStr.isEmpty()) continue;
                    LocalDate date = LocalDate.parse(dateStr, fmt);
                    long time = date.atStartOfDay().toEpochSecond(java.time.ZoneOffset.of("+09:00"));
                    result.add(new CandlestickResponse(time,
                            parseDouble(c.get("stck_oprc")), parseDouble(c.get("stck_hgpr")),
                            parseDouble(c.get("stck_lwpr")), parseDouble(c.get("stck_clpr")),
                            parseDouble(c.get("acml_vol"))));
                }
                return result;
            }
            if (retry < 1) {
                try { Thread.sleep(500); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
            }
        }
        return List.of();
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
