package com.project.whalearc.market.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;

/**
 * 한국투자증권 Open API 클라이언트.
 * - OAuth 토큰 자동 발급/갱신
 * - 국내주식 현재가 조회 (리트라이 + 캐시 폴백)
 * - 국내주식 기간별 시세 (캔들스틱) 조회
 */
@Slf4j
@Service
public class KisApiClient {

    @Value("${kis.api.base-url:https://openapivts.koreainvestment.com:29443}")
    private String baseUrl;

    @Value("${kis.api.appkey:}")
    private String appkey;

    @Value("${kis.api.appsecret:}")
    private String appsecret;

    @Value("${kis.api.max-retries:3}")
    private int maxRetries;

    @Value("${kis.api.retry-delay-ms:500}")
    private long retryDelayMs;

    @Value("${kis.api.cache-ttl-ms:15000}")
    private long cacheTtlMs;

    private RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    // 토큰 캐시
    private final AtomicReference<String> accessToken = new AtomicReference<>(null);
    private volatile long tokenExpiresAt = 0;

    // 응답 캐시: key → {data, expireAt}
    private final ConcurrentHashMap<String, CacheEntry<?>> responseCache = new ConcurrentHashMap<>();

    @PostConstruct
    public void init() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5_000);
        factory.setReadTimeout(8_000);
        this.restTemplate = new RestTemplate(factory);
        log.info("KIS API 클라이언트 초기화: baseUrl={}, maxRetries={}, retryDelay={}ms, cacheTTL={}ms",
                baseUrl, maxRetries, retryDelayMs, cacheTtlMs);
    }

    /* ───── 토큰 관리 ───── */

    public String getAccessToken() {
        if (accessToken.get() != null && System.currentTimeMillis() < tokenExpiresAt - 60_000) {
            return accessToken.get();
        }
        return refreshToken();
    }

    @SuppressWarnings("unchecked")
    private synchronized String refreshToken() {
        if (accessToken.get() != null && System.currentTimeMillis() < tokenExpiresAt - 60_000) {
            return accessToken.get();
        }

        String url = baseUrl + "/oauth2/tokenP";
        Map<String, String> body = Map.of(
                "grant_type", "client_credentials",
                "appkey", appkey,
                "appsecret", appsecret
        );

        for (int attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                HttpEntity<Map<String, String>> request = new HttpEntity<>(body, headers);

                ResponseEntity<String> response = restTemplate.postForEntity(url, request, String.class);
                Map<String, Object> result = objectMapper.readValue(response.getBody(),
                        new TypeReference<Map<String, Object>>() {});

                String token = (String) result.get("access_token");
                tokenExpiresAt = System.currentTimeMillis() + 23 * 60 * 60 * 1000L;
                accessToken.set(token);
                log.info("KIS API 토큰 발급 성공");
                return token;
            } catch (Exception e) {
                log.warn("KIS API 토큰 발급 실패 (시도 {}/{}): {}", attempt, maxRetries, e.getMessage());
                if (attempt < maxRetries) {
                    sleep(retryDelayMs * attempt);
                }
            }
        }

        // 모든 리트라이 실패 → 이전 토큰은 아직 유효한 경우에만 재사용 (최소 1분 이상 남아야 함)
        String existing = accessToken.get();
        if (existing != null && System.currentTimeMillis() < tokenExpiresAt - 60_000) {
            log.warn("KIS API 이전 토큰 재사용 (만료까지 {}초)", (tokenExpiresAt - System.currentTimeMillis()) / 1000);
            return existing;
        }
        // 만료된 토큰은 제거하여 이후 요청에서 재발급 시도하도록 함
        accessToken.set(null);
        tokenExpiresAt = 0;
        throw new RuntimeException("KIS 토큰 발급 실패: " + maxRetries + "회 재시도 후 실패");
    }

    /* ───── 국내주식 현재가 조회 ───── */

    @SuppressWarnings("unchecked")
    public Map<String, String> getStockPrice(String stockCode) {
        String cacheKey = "price:" + stockCode;

        for (int attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                String url = baseUrl + "/uapi/domestic-stock/v1/quotations/inquire-price"
                        + "?FID_COND_MRKT_DIV_CODE=J"
                        + "&FID_INPUT_ISCD=" + stockCode;

                HttpHeaders headers = buildHeaders("FHKST01010100");
                HttpEntity<Void> request = new HttpEntity<>(headers);

                ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, request, String.class);
                Map<String, Object> result = objectMapper.readValue(response.getBody(),
                        new TypeReference<Map<String, Object>>() {});

                if (!"0".equals(String.valueOf(result.get("rt_cd")))) {
                    log.warn("KIS 현재가 조회 실패 [{}]: {}", stockCode, result.get("msg1"));
                    return getCachedOrNull(cacheKey);
                }

                Map<String, String> output = objectMapper.convertValue(result.get("output"),
                        new TypeReference<Map<String, String>>() {});
                putCache(cacheKey, output);

                if (attempt > 1) {
                    log.info("KIS 현재가 조회 성공 [{}] ({}번째 시도)", stockCode, attempt);
                }
                return output;
            } catch (Exception e) {
                log.warn("KIS 현재가 조회 오류 [{}] (시도 {}/{}): {}", stockCode, attempt, maxRetries, e.getMessage());
                if (attempt < maxRetries) {
                    sleep(retryDelayMs * attempt);
                }
            }
        }

        // 모든 리트라이 실패 → 캐시 폴백
        Map<String, String> cached = getCachedOrNull(cacheKey);
        if (cached != null) {
            log.warn("KIS 현재가 [{}]: API 실패, 캐시 폴백 사용", stockCode);
        }
        return cached;
    }

    /* ───── 국내주식 일봉 조회 ───── */

    @SuppressWarnings("unchecked")
    public List<Map<String, String>> getStockDailyCandles(String stockCode, String startDate, String endDate) {
        String cacheKey = "candle:" + stockCode + ":" + startDate + ":" + endDate;

        for (int attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                String url = baseUrl + "/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice"
                        + "?FID_COND_MRKT_DIV_CODE=J"
                        + "&FID_INPUT_ISCD=" + stockCode
                        + "&FID_INPUT_DATE_1=" + startDate
                        + "&FID_INPUT_DATE_2=" + endDate
                        + "&FID_PERIOD_DIV_CODE=D"
                        + "&FID_ORG_ADJ_PRC=0";

                HttpHeaders headers = buildHeaders("FHKST03010100");
                HttpEntity<Void> request = new HttpEntity<>(headers);

                ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, request, String.class);
                Map<String, Object> result = objectMapper.readValue(response.getBody(),
                        new TypeReference<Map<String, Object>>() {});

                if (!"0".equals(String.valueOf(result.get("rt_cd")))) {
                    log.warn("KIS 일봉 조회 실패 [{}]: {}", stockCode, result.get("msg1"));
                    List<Map<String, String>> cached = getCachedOrNull(cacheKey);
                    return cached != null ? cached : List.of();
                }

                List<Map<String, String>> output = objectMapper.convertValue(result.get("output2"),
                        new TypeReference<List<Map<String, String>>>() {});
                putCache(cacheKey, output);

                if (attempt > 1) {
                    log.info("KIS 일봉 조회 성공 [{}] ({}번째 시도)", stockCode, attempt);
                }
                return output;
            } catch (Exception e) {
                log.warn("KIS 일봉 조회 오류 [{}] (시도 {}/{}): {}", stockCode, attempt, maxRetries, e.getMessage());
                if (attempt < maxRetries) {
                    sleep(retryDelayMs * attempt);
                }
            }
        }

        List<Map<String, String>> cached = getCachedOrNull(cacheKey);
        if (cached != null) {
            log.warn("KIS 일봉 [{}]: API 실패, 캐시 폴백 사용", stockCode);
            return cached;
        }
        return List.of();
    }

    /* ───── 업종(지수) 일봉 조회 ───── */

    @SuppressWarnings("unchecked")
    public List<Map<String, String>> getIndexDailyCandles(String indexCode, String startDate, String endDate) {
        String cacheKey = "indexCandle:" + indexCode + ":" + startDate + ":" + endDate;

        for (int attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                String url = baseUrl + "/uapi/domestic-stock/v1/quotations/inquire-daily-indexchartprice"
                        + "?FID_COND_MRKT_DIV_CODE=U"
                        + "&FID_INPUT_ISCD=" + indexCode
                        + "&FID_INPUT_DATE_1=" + startDate
                        + "&FID_INPUT_DATE_2=" + endDate
                        + "&FID_PERIOD_DIV_CODE=D";

                HttpHeaders headers = buildHeaders("FHKUP03500100");
                HttpEntity<Void> request = new HttpEntity<>(headers);

                ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, request, String.class);
                Map<String, Object> result = objectMapper.readValue(response.getBody(),
                        new TypeReference<Map<String, Object>>() {});

                if (!"0".equals(String.valueOf(result.get("rt_cd")))) {
                    log.warn("KIS 지수 일봉 조회 실패 [{}]: {}", indexCode, result.get("msg1"));
                    List<Map<String, String>> cached = getCachedOrNull(cacheKey);
                    return cached != null ? cached : List.of();
                }

                List<Map<String, String>> output = objectMapper.convertValue(result.get("output2"),
                        new TypeReference<List<Map<String, String>>>() {});
                putCache(cacheKey, output);
                return output;
            } catch (Exception e) {
                log.warn("KIS 지수 일봉 조회 오류 [{}] (시도 {}/{}): {}", indexCode, attempt, maxRetries, e.getMessage());
                if (attempt < maxRetries) {
                    sleep(retryDelayMs * attempt);
                }
            }
        }

        List<Map<String, String>> cached = getCachedOrNull(cacheKey);
        if (cached != null) {
            log.warn("KIS 지수 일봉 [{}]: API 실패, 캐시 폴백 사용", indexCode);
            return cached;
        }
        return List.of();
    }

    /* ───── 업종(지수) 현재가 조회 ───── */

    @SuppressWarnings("unchecked")
    public Map<String, String> getIndexPrice(String indexCode) {
        String cacheKey = "index:" + indexCode;

        for (int attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                String url = baseUrl + "/uapi/domestic-stock/v1/quotations/inquire-index-price"
                        + "?FID_COND_MRKT_DIV_CODE=U"
                        + "&FID_INPUT_ISCD=" + indexCode;

                HttpHeaders headers = buildHeaders("FHPUP02100000");
                HttpEntity<Void> request = new HttpEntity<>(headers);

                ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, request, String.class);
                Map<String, Object> result = objectMapper.readValue(response.getBody(),
                        new TypeReference<Map<String, Object>>() {});

                if (!"0".equals(String.valueOf(result.get("rt_cd")))) {
                    log.warn("KIS 지수 조회 실패 [{}]: {}", indexCode, result.get("msg1"));
                    return getCachedOrNull(cacheKey);
                }

                Map<String, String> output = objectMapper.convertValue(result.get("output"),
                        new TypeReference<Map<String, String>>() {});
                putCache(cacheKey, output);

                if (attempt > 1) {
                    log.info("KIS 지수 조회 성공 [{}] ({}번째 시도)", indexCode, attempt);
                }
                return output;
            } catch (Exception e) {
                log.warn("KIS 지수 조회 오류 [{}] (시도 {}/{}): {}", indexCode, attempt, maxRetries, e.getMessage());
                if (attempt < maxRetries) {
                    sleep(retryDelayMs * attempt);
                }
            }
        }

        Map<String, String> cached = getCachedOrNull(cacheKey);
        if (cached != null) {
            log.warn("KIS 지수 [{}]: API 실패, 캐시 폴백 사용", indexCode);
        }
        return cached;
    }

    /* ───── 해외주식 현재가 조회 ───── */

    @SuppressWarnings("unchecked")
    public Map<String, String> getUsStockPrice(String exchange, String symbol) {
        String cacheKey = "us-price:" + exchange + ":" + symbol;

        for (int attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                String url = baseUrl + "/uapi/overseas-price/v1/quotations/price"
                        + "?AUTH="
                        + "&EXCD=" + exchange
                        + "&SYMB=" + symbol;

                HttpHeaders headers = buildHeaders("HHDFS00000300");
                HttpEntity<Void> request = new HttpEntity<>(headers);

                ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, request, String.class);
                Map<String, Object> result = objectMapper.readValue(response.getBody(),
                        new TypeReference<Map<String, Object>>() {});

                if (!"0".equals(String.valueOf(result.get("rt_cd")))) {
                    log.warn("KIS 해외주식 현재가 조회 실패 [{}/{}]: {}", exchange, symbol, result.get("msg1"));
                    return getCachedOrNull(cacheKey);
                }

                Map<String, String> output = objectMapper.convertValue(result.get("output"),
                        new TypeReference<Map<String, String>>() {});
                putCache(cacheKey, output);

                if (attempt > 1) {
                    log.info("KIS 해외주식 현재가 조회 성공 [{}/{}] ({}번째 시도)", exchange, symbol, attempt);
                }
                return output;
            } catch (Exception e) {
                log.warn("KIS 해외주식 현재가 조회 오류 [{}/{}] (시도 {}/{}): {}", exchange, symbol, attempt, maxRetries, e.getMessage());
                if (attempt < maxRetries) {
                    sleep(retryDelayMs * attempt);
                }
            }
        }

        Map<String, String> cached = getCachedOrNull(cacheKey);
        if (cached != null) {
            log.warn("KIS 해외주식 [{}/{}]: API 실패, 캐시 폴백 사용", exchange, symbol);
        }
        return cached;
    }

    /* ───── 해외주식 일봉 조회 ───── */

    @SuppressWarnings("unchecked")
    public List<Map<String, String>> getUsStockDailyCandles(String exchange, String symbol) {
        return getUsStockDailyCandles(exchange, symbol, "");
    }

    public List<Map<String, String>> getUsStockDailyCandles(String exchange, String symbol, String bymd) {
        String cacheKey = "us-candle:" + exchange + ":" + symbol + ":" + bymd;

        for (int attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                String url = baseUrl + "/uapi/overseas-price/v1/quotations/dailyprice"
                        + "?AUTH="
                        + "&EXCD=" + exchange
                        + "&SYMB=" + symbol
                        + "&GUBN=0"
                        + "&MODP=1"
                        + "&BYMD=" + bymd;

                HttpHeaders headers = buildHeaders("HHDFS76240000");
                HttpEntity<Void> request = new HttpEntity<>(headers);

                ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, request, String.class);
                Map<String, Object> result = objectMapper.readValue(response.getBody(),
                        new TypeReference<Map<String, Object>>() {});

                if (!"0".equals(String.valueOf(result.get("rt_cd")))) {
                    log.warn("KIS 해외주식 일봉 조회 실패 [{}/{}]: {}", exchange, symbol, result.get("msg1"));
                    List<Map<String, String>> cached = getCachedOrNull(cacheKey);
                    return cached != null ? cached : List.of();
                }

                List<Map<String, String>> output = objectMapper.convertValue(result.get("output2"),
                        new TypeReference<List<Map<String, String>>>() {});
                putCache(cacheKey, output);

                if (attempt > 1) {
                    log.info("KIS 해외주식 일봉 조회 성공 [{}/{}] ({}번째 시도)", exchange, symbol, attempt);
                }
                return output;
            } catch (Exception e) {
                log.warn("KIS 해외주식 일봉 조회 오류 [{}/{}] (시도 {}/{}): {}", exchange, symbol, attempt, maxRetries, e.getMessage());
                if (attempt < maxRetries) {
                    sleep(retryDelayMs * attempt);
                }
            }
        }

        List<Map<String, String>> cached = getCachedOrNull(cacheKey);
        if (cached != null) {
            log.warn("KIS 해외주식 일봉 [{}/{}]: API 실패, 캐시 폴백 사용", exchange, symbol);
            return cached;
        }
        return List.of();
    }

    /* ───── 캐시 유틸 ───── */

    private <T> void putCache(String key, T data) {
        responseCache.put(key, new CacheEntry<>(data, System.currentTimeMillis() + cacheTtlMs));
    }

    @SuppressWarnings("unchecked")
    private <T> T getCachedOrNull(String key) {
        CacheEntry<?> entry = responseCache.get(key);
        // 캐시가 있으면 만료와 관계없이 폴백으로 반환 (stale cache 허용)
        if (entry != null) {
            return (T) entry.data;
        }
        return null;
    }

    /** 주기적 캐시 정리 (TTL의 10배 초과 항목 제거) */
    public void evictStaleCache() {
        long threshold = System.currentTimeMillis() - (cacheTtlMs * 10);
        responseCache.entrySet().removeIf(e -> e.getValue().expireAt < threshold);
    }

    /* ───── 유틸 ───── */

    private HttpHeaders buildHeaders(String trId) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("authorization", "Bearer " + getAccessToken());
        headers.set("appkey", appkey);
        headers.set("appsecret", appsecret);
        headers.set("tr_id", trId);
        return headers;
    }

    private void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    public boolean isConfigured() {
        return appkey != null && !appkey.isEmpty() && appsecret != null && !appsecret.isEmpty();
    }

    private record CacheEntry<T>(T data, long expireAt) {}
}
