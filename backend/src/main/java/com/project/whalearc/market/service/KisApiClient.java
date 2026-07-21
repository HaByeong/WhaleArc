package com.project.whalearc.market.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
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

    // 호출 간 최소 간격(ms) — KIS 초당 거래건수 한도(EGW00201) 초과를 방지하는 전역 스로틀. 기본 70ms(≈14 req/s, 20/s 한도 여유).
    @Value("${kis.api.min-interval-ms:70}")
    private long minIntervalMs;
    private final Object rateLock = new Object();
    private long lastCallAt = 0;

    /** 모든 KIS HTTP 호출 직전에 호출 — 스레드 전역으로 최소 간격을 보장해 레이트리밋 초과를 줄인다. */
    private void throttle() {
        synchronized (rateLock) {
            long wait = lastCallAt + minIntervalMs - System.currentTimeMillis();
            if (wait > 0) {
                try { Thread.sleep(wait); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            }
            lastCallAt = System.currentTimeMillis();
        }
    }

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

                throttle();
                ResponseEntity<String> response = restTemplate.postForEntity(url, request, String.class);
                Map<String, Object> result = objectMapper.readValue(response.getBody(),
                        new TypeReference<Map<String, Object>>() {});

                String token = (String) result.get("access_token");
                if (token == null || token.isBlank()) {
                    // HTTP 200이라도 access_token이 없으면(예: error_description 본문) 발급 실패로 간주하고 재시도
                    log.warn("KIS 토큰 응답에 access_token 없음 (시도 {}/{}): {}", attempt, maxRetries, response.getBody());
                    if (attempt < maxRetries) {
                        sleep(retryDelayMs * attempt);
                    }
                    continue;
                }
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

                throttle();
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

                throttle();
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

    /** 지수 일봉 페이지네이션 안전 상한 — 실측상 페이지당 ~750 거래일(약 3년)이라 5년은 2페이지면 충분. 여유 상한. */
    private static final int MAX_INDEX_CANDLE_PAGES = 15;
    private static final DateTimeFormatter YYYYMMDD = DateTimeFormatter.ofPattern("yyyyMMdd");

    /**
     * 업종(지수) 일봉 조회 — 기간 전체를 페이지네이션으로 수집.
     * KIS FHKUP03500100은 시작일을 존중하지만 호출당 반환 행수가 잘린다(실측 ~750건 ≈ 3년).
     * 그래서 조회 끝 날짜를 페이지의 가장 오래된 거래일 하루 전으로 옮겨가며 startDate까지 반복 수집한다.
     * (이전엔 1회 호출이라 3년 이전 구간이 잘려, 오래 기록된 계정의 KOSPI 벤치마크 시작점이
     * 최근 값으로 클램프되고 알파가 왜곡됐다.)
     */
    public List<Map<String, String>> getIndexDailyCandles(String indexCode, String startDate, String endDate) {
        String cacheKey = "indexCandle:" + indexCode + ":" + startDate + ":" + endDate;

        // read-through: 일봉은 하루 1건 늘어나는 데이터라 캐시 폴백 창(≤15분) 재사용이 안전하고,
        // 페이지네이션(최대 15회 KIS 호출) 부담을 페이지 로드마다 반복하지 않게 해준다.
        List<Map<String, String>> cachedFresh = getCachedOrNull(cacheKey);
        if (cachedFresh != null) {
            return cachedFresh;
        }

        List<Map<String, String>> merged = new ArrayList<>();
        Set<String> seenDates = new HashSet<>();
        String windowEnd = endDate;

        for (int page = 0; page < MAX_INDEX_CANDLE_PAGES; page++) {
            List<Map<String, String>> rows = fetchIndexCandlePage(indexCode, startDate, windowEnd);
            if (rows == null) {                       // 페이지 조회 실패(리트라이 소진)
                if (!merged.isEmpty()) break;         // 이미 모은 최근 구간이라도 반환
                List<Map<String, String>> cached = getCachedOrNull(cacheKey);
                if (cached != null) {
                    log.warn("KIS 지수 일봉 [{}]: API 실패, 캐시 폴백 사용", indexCode);
                    return cached;
                }
                return List.of();
            }
            for (Map<String, String> row : rows) {
                String d = row.get("stck_bsop_date");
                if (d == null || d.isBlank() || !seenDates.add(d)) continue;  // 페이지 경계 중복 방어
                merged.add(row);
            }
            String oldest = oldestDateOf(rows);
            if (oldest == null || oldest.compareTo(startDate) <= 0) break;    // 목표 범위 도달(또는 빈 페이지)
            windowEnd = prevDay(oldest);
        }

        putCache(cacheKey, merged);
        return merged;
    }

    /** 지수 일봉 1페이지 조회(리트라이 포함). 실패 시 null — 호출부에서 부분 결과/캐시 폴백을 결정한다. */
    private List<Map<String, String>> fetchIndexCandlePage(String indexCode, String startDate, String endDate) {
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

                throttle();
                ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, request, String.class);
                Map<String, Object> result = objectMapper.readValue(response.getBody(),
                        new TypeReference<Map<String, Object>>() {});

                if (!"0".equals(String.valueOf(result.get("rt_cd")))) {
                    log.warn("KIS 지수 일봉 조회 실패 [{}]: {}", indexCode, result.get("msg1"));
                    return null;
                }

                List<Map<String, String>> output = objectMapper.convertValue(result.get("output2"),
                        new TypeReference<List<Map<String, String>>>() {});
                return output != null ? output : List.of();
            } catch (Exception e) {
                log.warn("KIS 지수 일봉 조회 오류 [{}] (시도 {}/{}): {}", indexCode, attempt, maxRetries, e.getMessage());
                if (attempt < maxRetries) {
                    sleep(retryDelayMs * attempt);
                }
            }
        }
        return null;
    }

    /** 페이지에서 가장 오래된 거래일(yyyyMMdd). KIS는 보통 최신→과거 순이지만 순서에 의존하지 않는다. */
    static String oldestDateOf(List<Map<String, String>> rows) {
        String oldest = null;
        for (Map<String, String> row : rows) {
            String d = row.get("stck_bsop_date");
            if (d == null || d.isBlank()) continue;
            if (oldest == null || d.compareTo(oldest) < 0) oldest = d;
        }
        return oldest;
    }

    /** yyyyMMdd 하루 전 날짜 — 페이지네이션 다음 윈도우의 끝. */
    static String prevDay(String yyyymmdd) {
        return LocalDate.parse(yyyymmdd, YYYYMMDD).minusDays(1).format(YYYYMMDD);
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

                throttle();
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

                throttle();
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

                throttle();
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

    /** 에러 폴백으로 허용하는 캐시 최대 staleness — 이 시간을 넘은 캐시는 '임의로 오래된 데이터'이므로 폴백을 거부(null 반환)하여
     *  사용자가 며칠 전 시세를 현재가로 오인하지 않도록 한다. */
    private static final long STALE_FALLBACK_MS = 15 * 60 * 1000L; // 15분

    @SuppressWarnings("unchecked")
    private <T> T getCachedOrNull(String key) {
        CacheEntry<?> entry = responseCache.get(key);
        if (entry == null) return null;
        // 만료된 캐시라도 폴백 허용하되, put 이후 경과가 max(TTL, 15분) 이내인 경우만 (무한 stale 방지)
        long age = System.currentTimeMillis() - (entry.expireAt - cacheTtlMs);
        if (age > Math.max(cacheTtlMs, STALE_FALLBACK_MS)) return null;
        return (T) entry.data;
    }

    /** 주기적 캐시 정리 — 10분마다 실행해 무한 메모리 증가 방지(@EnableScheduling은 이미 적용됨).
     *  단, 에러 폴백 창(STALE_FALLBACK_MS)보다 먼저 제거하면 폴백 커버리지가 줄어드므로 둘 중 큰 창을 사용. */
    @Scheduled(fixedDelay = 600_000L)
    public void evictStaleCache() {
        long threshold = System.currentTimeMillis() - Math.max(cacheTtlMs * 10, STALE_FALLBACK_MS);
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
