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
        if ("STOCK".equalsIgnoreCase(assetType)) {
            return getStockCandlesticks(symbol);
        }
        return getCryptoCandlesticks(symbol, interval);
    }

    /** 기존 빗썸 캔들스틱 (하위 호환) */
    public List<CandlestickResponse> getCandlesticks(String symbol, String interval) {
        return getCryptoCandlesticks(symbol, interval);
    }

    /** 국내주식 일봉 (KIS API) — 최대 2년치 데이터를 3개월 단위로 반복 조회 */
    private List<CandlestickResponse> getStockCandlesticks(String stockCode) {
        if (!kisApiClient.isConfigured()) {
            return List.of();
        }

        try {
            DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyyMMdd");
            LocalDate now = LocalDate.now();
            List<CandlestickResponse> allResults = new ArrayList<>();

            // 3개월 단위로 최대 2년(8구간) 반복 조회
            for (int i = 0; i < 8; i++) {
                LocalDate chunkEnd = now.minusMonths(3L * i);
                LocalDate chunkStart = now.minusMonths(3L * (i + 1)).plusDays(1);

                List<Map<String, String>> candles = kisApiClient.getStockDailyCandles(
                        stockCode, chunkStart.format(fmt), chunkEnd.format(fmt));

                if (candles == null || candles.isEmpty()) break;

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

                // KIS API 호출 간격 제한 준수 (초당 제한 방지)
                if (i < 7) {
                    try { Thread.sleep(200); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
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

    /** 빗썸 캔들스틱 API 호출 */
    @SuppressWarnings("unchecked")
    private List<CandlestickResponse> getCryptoCandlesticks(String symbol, String interval) {
        String bithumbInterval = toBithumbInterval(interval);
        String url = baseUrl + "/public/candlestick/" + symbol + "_KRW/" + bithumbInterval;

        try {
            Map<String, Object> response = restTemplate.getForObject(url, Map.class);

            if (response == null || !"0000".equals(response.get("status"))) {
                log.warn("빗썸 캔들스틱 API 오류: symbol={}, interval={} (bithumb={})", symbol, interval, bithumbInterval);
                return List.of();
            }

            List<List<Object>> data = objectMapper.convertValue(
                    response.get("data"), new TypeReference<List<List<Object>>>() {}
            );

            if (data == null) return List.of();

            List<CandlestickResponse> result = new ArrayList<>();
            for (List<Object> candle : data) {
                // [timestamp, open, close, high, low, volume]
                long time = ((Number) candle.get(0)).longValue() / 1000; // ms -> seconds
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
            log.error("캔들스틱 조회 실패 [{}/{}]: {}", symbol, interval, e.getMessage());
            return List.of();
        }
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
