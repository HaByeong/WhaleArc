package com.project.whalearc.market.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.project.whalearc.market.dto.CandlestickResponse;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class CandlestickService {

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
     * 빗썸 캔들스틱 API 호출
     * @param symbol 코인 심볼 (BTC, ETH 등)
     * @param interval 차트 간격 (1m, 3m, 5m, 10m, 30m, 1h, 6h, 12h, 24h)
     */
    @SuppressWarnings("unchecked")
    public List<CandlestickResponse> getCandlesticks(String symbol, String interval) {
        String url = baseUrl + "/public/candlestick/" + symbol + "_KRW/" + interval;

        try {
            Map<String, Object> response = restTemplate.getForObject(url, Map.class);

            if (response == null || !"0000".equals(response.get("status"))) {
                log.warn("빗썸 캔들스틱 API 오류: symbol={}, interval={}", symbol, interval);
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
                long open = parseLong(candle.get(1));
                long close = parseLong(candle.get(2));
                long high = parseLong(candle.get(3));
                long low = parseLong(candle.get(4));
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
