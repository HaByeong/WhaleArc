package com.project.whalearc.market.service;

import com.project.whalearc.market.dto.CandlestickResponse;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 백테스트 전용 데이터 제공자
 * - 주식: Yahoo Finance (20년+ 히스토리)
 * - 암호화폐: Binance (상장일부터 전체 히스토리)
 */
@Slf4j
@Service
public class BacktestDataProvider {

    private static final ZoneOffset KST = ZoneOffset.of("+09:00");
    private static final int WARMUP_DAYS = 400; // 지표 워밍업 (MA200 + 여유)

    // Binance USDT → KRW 근사 환율 (백테스트 성과 지표에는 영향 없음, 표시 가격만 영향)
    private static final double KRW_PER_USD = 1400.0;

    private static final String YAHOO_USER_AGENT =
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                    + "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

    private RestTemplate restTemplate;

    // Yahoo Finance crumb/cookie 캐시
    private String yahooCrumb;
    private String yahooCookie;
    private long yahooCrumbExpiry;

    // ── 데이터 캐시 (종목+기간 → 캔들 리스트, 30분 TTL) ──
    private static final long CACHE_TTL_MS = 30 * 60 * 1000; // 30분
    private static final int MAX_CACHE_SIZE = 100;
    private final ConcurrentHashMap<String, CacheEntry> candleCache = new ConcurrentHashMap<>();

    private record CacheEntry(List<CandlestickResponse> data, long expiry) {
        boolean isExpired() { return System.currentTimeMillis() > expiry; }
    }

    @PostConstruct
    public void init() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(15_000);
        factory.setReadTimeout(30_000);
        this.restTemplate = new RestTemplate(factory);
        log.info("BacktestDataProvider 초기화 완료 (Yahoo Finance + Binance)");
    }

    // ── Yahoo Finance crumb/cookie 인증 ──────────────────────────────────

    /**
     * Yahoo Finance API 인증용 crumb + cookie 획득 (1시간 캐시)
     */
    private synchronized void ensureYahooCrumb() {
        if (yahooCrumb != null && System.currentTimeMillis() < yahooCrumbExpiry) {
            return;
        }

        try {
            // Step 1: Yahoo 접속 → 쿠키 획득
            HttpHeaders initHeaders = new HttpHeaders();
            initHeaders.set("User-Agent", YAHOO_USER_AGENT);

            ResponseEntity<String> initResp = restTemplate.exchange(
                    "https://fc.yahoo.com/", HttpMethod.GET,
                    new HttpEntity<>(initHeaders), String.class);

            List<String> setCookies = initResp.getHeaders().get(HttpHeaders.SET_COOKIE);
            if (setCookies == null || setCookies.isEmpty()) {
                log.warn("Yahoo Finance 쿠키 획득 실패: Set-Cookie 없음");
                return;
            }

            StringBuilder cookieBuilder = new StringBuilder();
            for (String sc : setCookies) {
                if (cookieBuilder.length() > 0) cookieBuilder.append("; ");
                cookieBuilder.append(sc.split(";")[0]);
            }
            String cookies = cookieBuilder.toString();

            // Step 2: crumb 토큰 획득
            HttpHeaders crumbHeaders = new HttpHeaders();
            crumbHeaders.set("User-Agent", YAHOO_USER_AGENT);
            crumbHeaders.set("Cookie", cookies);

            ResponseEntity<String> crumbResp = restTemplate.exchange(
                    "https://query2.finance.yahoo.com/v1/test/getcrumb",
                    HttpMethod.GET, new HttpEntity<>(crumbHeaders), String.class);

            String crumb = crumbResp.getBody();
            if (crumb != null && !crumb.isBlank()) {
                this.yahooCrumb = crumb;
                this.yahooCookie = cookies;
                this.yahooCrumbExpiry = System.currentTimeMillis() + 3_600_000; // 1시간
                log.info("Yahoo Finance crumb 획득 성공");
            } else {
                log.warn("Yahoo Finance crumb 응답 비어있음");
            }
        } catch (Exception e) {
            log.warn("Yahoo Finance crumb 획득 실패: {}", e.getMessage());
        }
    }

    /**
     * 백테스트용 캔들 데이터 조회 (지표 워밍업 기간 포함, 30분 캐시)
     */
    public List<CandlestickResponse> getBacktestCandles(String symbol, String assetType,
                                                         String startDate, String endDate) {
        LocalDate warmupStart = LocalDate.parse(startDate).minusDays(WARMUP_DAYS);
        String cacheKey = symbol + ":" + assetType + ":" + warmupStart + ":" + endDate;

        // 캐시 히트 확인
        CacheEntry cached = candleCache.get(cacheKey);
        if (cached != null && !cached.isExpired()) {
            log.debug("캔들 캐시 히트: {} ({}건)", cacheKey, cached.data().size());
            return cached.data();
        }

        try {
            List<CandlestickResponse> result;
            if ("STOCK".equalsIgnoreCase(assetType)) {
                result = getStockCandles(symbol, warmupStart.toString(), endDate);
            } else {
                result = getCryptoCandles(symbol, warmupStart.toString(), endDate);
            }

            // 결과가 있으면 캐시 저장
            if (!result.isEmpty()) {
                // 캐시 크기 초과 시 만료된 항목 정리
                if (candleCache.size() >= MAX_CACHE_SIZE) {
                    candleCache.entrySet().removeIf(e -> e.getValue().isExpired());
                    // 그래도 초과면 전체 초기화
                    if (candleCache.size() >= MAX_CACHE_SIZE) {
                        candleCache.clear();
                    }
                }
                candleCache.put(cacheKey, new CacheEntry(List.copyOf(result),
                        System.currentTimeMillis() + CACHE_TTL_MS));
            }

            return result;
        } catch (Exception e) {
            log.error("백테스트 데이터 조회 실패: symbol={}, error={}", symbol, e.getMessage());
            return List.of();
        }
    }

    // ── 주식: Yahoo Finance ──────────────────────────────────────────────

    private List<CandlestickResponse> getStockCandles(String stockCode, String start, String end) {
        // KOSPI (.KS) → KOSDAQ (.KQ) 순서로 시도
        List<CandlestickResponse> result = fetchYahoo(stockCode + ".KS", start, end);
        if (result.isEmpty()) {
            result = fetchYahoo(stockCode + ".KQ", start, end);
        }
        if (result.isEmpty()) {
            log.warn("Yahoo Finance 주식 데이터 없음: {}", stockCode);
        }
        return result;
    }

    @SuppressWarnings("unchecked")
    private List<CandlestickResponse> fetchYahoo(String symbol, String start, String end) {
        ensureYahooCrumb();

        long p1 = LocalDate.parse(start).atStartOfDay().toEpochSecond(KST);
        long p2 = LocalDate.parse(end).plusDays(1).atStartOfDay().toEpochSecond(KST);

        String url = "https://query2.finance.yahoo.com/v8/finance/chart/" + symbol
                + "?period1=" + p1 + "&period2=" + p2 + "&interval=1d";
        if (yahooCrumb != null) {
            url += "&crumb=" + URLEncoder.encode(yahooCrumb, StandardCharsets.UTF_8);
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("User-Agent", YAHOO_USER_AGENT);
            if (yahooCookie != null) {
                headers.set("Cookie", yahooCookie);
            }

            ResponseEntity<Map> resp = restTemplate.exchange(
                    url, HttpMethod.GET, new HttpEntity<>(headers), Map.class);

            Map<String, Object> body = resp.getBody();
            if (body == null) return List.of();

            Map<String, Object> chart = (Map<String, Object>) body.get("chart");
            if (chart == null) return List.of();

            List<Map<String, Object>> results = (List<Map<String, Object>>) chart.get("result");
            if (results == null || results.isEmpty()) return List.of();

            Map<String, Object> result = results.get(0);
            List<Number> timestamps = (List<Number>) result.get("timestamp");
            if (timestamps == null || timestamps.isEmpty()) return List.of();

            Map<String, Object> indicators = (Map<String, Object>) result.get("indicators");
            if (indicators == null) return List.of();
            List<Map<String, Object>> quotes =
                    (List<Map<String, Object>>) indicators.get("quote");
            if (quotes == null || quotes.isEmpty()) return List.of();
            Map<String, Object> q = quotes.get(0);

            List<Number> opens   = (List<Number>) q.get("open");
            List<Number> highs   = (List<Number>) q.get("high");
            List<Number> lows    = (List<Number>) q.get("low");
            List<Number> closes  = (List<Number>) q.get("close");
            List<Number> volumes = (List<Number>) q.get("volume");

            List<CandlestickResponse> candles = new ArrayList<>();
            for (int i = 0; i < timestamps.size(); i++) {
                if (closes.get(i) == null) continue; // 거래 없는 날 건너뛰기
                candles.add(new CandlestickResponse(
                        timestamps.get(i).longValue(),
                        num(opens, i), num(highs, i), num(lows, i),
                        num(closes, i), num(volumes, i)
                ));
            }

            log.info("Yahoo Finance 조회 성공: {} → {}건 ({}~{})",
                    symbol, candles.size(), start, end);
            return candles;
        } catch (Exception e) {
            log.debug("Yahoo Finance 조회 실패 ({}): {}", symbol, e.getMessage());
            return List.of();
        }
    }

    // ── 암호화폐: Binance ────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private List<CandlestickResponse> getCryptoCandles(String symbol, String start, String end) {
        String pair = symbol.toUpperCase() + "USDT";
        long startMs = LocalDate.parse(start).atStartOfDay().toEpochSecond(ZoneOffset.UTC) * 1000;
        long endMs = LocalDate.parse(end).plusDays(1).atStartOfDay().toEpochSecond(ZoneOffset.UTC) * 1000;

        List<CandlestickResponse> candles = new ArrayList<>();
        long cursor = startMs;

        while (cursor < endMs) {
            String url = "https://api.binance.com/api/v3/klines?symbol=" + pair
                    + "&interval=1d&startTime=" + cursor + "&endTime=" + endMs + "&limit=1000";
            try {
                List<List<Object>> klines = restTemplate.getForObject(url, List.class);
                if (klines == null || klines.isEmpty()) break;

                for (List<Object> k : klines) {
                    candles.add(new CandlestickResponse(
                            ((Number) k.get(0)).longValue() / 1000,  // ms → seconds
                            parseD(k.get(1)) * KRW_PER_USD,
                            parseD(k.get(2)) * KRW_PER_USD,
                            parseD(k.get(3)) * KRW_PER_USD,
                            parseD(k.get(4)) * KRW_PER_USD,
                            parseD(k.get(5))  // 거래량은 변환하지 않음
                    ));
                }

                // 다음 페이지 커서
                cursor = ((Number) klines.get(klines.size() - 1).get(0)).longValue() + 1;

                Thread.sleep(100); // Binance rate limit 방지
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            } catch (Exception e) {
                log.warn("Binance 조회 실패 ({}): {}", pair, e.getMessage());
                break;
            }
        }

        log.info("Binance 조회 성공: {} → {}건 ({}~{})", pair, candles.size(), start, end);
        return candles;
    }

    // ── 유틸 ─────────────────────────────────────────────────────────────

    private double num(List<Number> list, int i) {
        Number n = list.get(i);
        return n != null ? n.doubleValue() : 0;
    }

    private double parseD(Object o) {
        return Double.parseDouble(o.toString());
    }
}
