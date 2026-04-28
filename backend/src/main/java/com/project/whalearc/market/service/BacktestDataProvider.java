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

    private final KisApiClient kisApiClient;
    private final UsStockPriceProvider usStockPriceProvider;
    private final UsEtfCatalog usEtfCatalog;

    public BacktestDataProvider(KisApiClient kisApiClient,
                                UsStockPriceProvider usStockPriceProvider,
                                UsEtfCatalog usEtfCatalog) {
        this.kisApiClient = kisApiClient;
        this.usStockPriceProvider = usStockPriceProvider;
        this.usEtfCatalog = usEtfCatalog;
    }

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

    // ── 데이터 캐시 (종목+기간 → 캔들 + adjclose + 배당, 30분 TTL) ──
    private static final long CACHE_TTL_MS = 30 * 60 * 1000; // 30분
    private static final int MAX_CACHE_SIZE = 100;
    private final ConcurrentHashMap<String, CacheEntry> candleCache = new ConcurrentHashMap<>();

    private record CacheEntry(FetchResult data, long expiry) {
        boolean isExpired() { return System.currentTimeMillis() > expiry; }
    }

    /**
     * 내부 페치 결과: regular close 캔들 + (옵션) adjclose 평행 리스트 + (옵션) 배당 맵.
     * 도메스틱/암호화폐는 adjcloses=빈 리스트, dividends=빈 맵.
     */
    private record FetchResult(
            List<CandlestickResponse> candles,
            List<Double> adjcloses,                        // candles 와 같은 size 이거나 빈 리스트
            java.util.SortedMap<Long, Double> dividends   // epoch(초) → dividend per share
    ) {
        static FetchResult empty() {
            return new FetchResult(List.of(), List.of(), new java.util.TreeMap<>());
        }
        static FetchResult ofCandlesOnly(List<CandlestickResponse> c) {
            return new FetchResult(c, List.of(), new java.util.TreeMap<>());
        }
        boolean isEmpty() { return candles.isEmpty(); }
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
     * 백테스트용 캔들 데이터 조회 (지표 워밍업 기간 포함, 30분 캐시).
     * 기본 close 사용. 미국주식/ETF 의 adjclose 가 필요하면 오버로드를 사용.
     */
    public List<CandlestickResponse> getBacktestCandles(String symbol, String assetType,
                                                         String startDate, String endDate) {
        return getBacktestCandles(symbol, assetType, startDate, endDate, false);
    }

    /**
     * useAdjclose=true 이고 미국주식/ETF 면 close 자리에 adjclose 를 채워서 반환.
     * 그 외 자산은 useAdjclose 를 무시하고 일반 close.
     */
    public List<CandlestickResponse> getBacktestCandles(String symbol, String assetType,
                                                         String startDate, String endDate,
                                                         boolean useAdjclose) {
        FetchResult fr = getOrFetch(symbol, assetType, startDate, endDate);
        if (!useAdjclose || fr.adjcloses().isEmpty() || fr.adjcloses().size() != fr.candles().size()) {
            return fr.candles();
        }
        List<CandlestickResponse> out = new ArrayList<>(fr.candles().size());
        for (int i = 0; i < fr.candles().size(); i++) {
            CandlestickResponse c = fr.candles().get(i);
            Double adj = fr.adjcloses().get(i);
            if (adj != null && adj > 0) {
                out.add(new CandlestickResponse(c.getTime(), c.getOpen(), c.getHigh(), c.getLow(), adj, c.getVolume()));
            } else {
                out.add(c);
            }
        }
        return out;
    }

    /**
     * 종목 배당 이벤트 조회. 키는 Yahoo 가 알려주는 ex-dividend epoch(초), 값은 주당 배당.
     * 미국주식/ETF 만 의미 있음. 그 외는 빈 맵 반환.
     */
    public Map<Long, Double> getBacktestDividends(String symbol, String assetType,
                                                   String startDate, String endDate) {
        FetchResult fr = getOrFetch(symbol, assetType, startDate, endDate);
        return fr.dividends();
    }

    private FetchResult getOrFetch(String symbol, String assetType, String startDate, String endDate) {
        LocalDate warmupStart = LocalDate.parse(startDate).minusDays(WARMUP_DAYS);
        String cacheKey = symbol + ":" + assetType + ":" + warmupStart + ":" + endDate;

        CacheEntry cached = candleCache.get(cacheKey);
        if (cached != null && !cached.isExpired()) {
            log.debug("캔들 캐시 히트: {} ({}건)", cacheKey, cached.data().candles().size());
            return cached.data();
        }

        try {
            FetchResult result;
            if ("STOCK".equalsIgnoreCase(assetType)) {
                result = FetchResult.ofCandlesOnly(getStockCandles(symbol, warmupStart.toString(), endDate));
            } else if ("US_STOCK".equalsIgnoreCase(assetType) || "ETF".equalsIgnoreCase(assetType)) {
                result = getUsStockData(symbol, warmupStart.toString(), endDate, assetType);
            } else {
                result = FetchResult.ofCandlesOnly(getCryptoCandles(symbol, warmupStart.toString(), endDate));
            }

            if (!result.isEmpty()) {
                if (candleCache.size() >= MAX_CACHE_SIZE) {
                    candleCache.entrySet().removeIf(e -> e.getValue().isExpired());
                    if (candleCache.size() >= MAX_CACHE_SIZE) {
                        candleCache.clear();
                    }
                }
                candleCache.put(cacheKey, new CacheEntry(result,
                        System.currentTimeMillis() + CACHE_TTL_MS));
            }
            return result;
        } catch (Exception e) {
            log.error("백테스트 데이터 조회 실패: symbol={}, error={}", symbol, e.getMessage());
            return FetchResult.empty();
        }
    }

    // ── 주식: Yahoo Finance ──────────────────────────────────────────────

    private List<CandlestickResponse> getStockCandles(String stockCode, String start, String end) {
        // KOSPI (.KS) → KOSDAQ (.KQ) 순서로 시도. 국내는 KIS 수정주가 정책상 close 만 사용.
        FetchResult result = fetchYahoo(stockCode + ".KS", start, end);
        if (result.isEmpty()) {
            result = fetchYahoo(stockCode + ".KQ", start, end);
        }
        if (result.isEmpty()) {
            log.warn("Yahoo Finance 주식 데이터 없음: {}", stockCode);
        }
        return result.candles();
    }

    /** 미국주식/ETF: Yahoo Finance(adjclose+배당 포함) 우선, 실패 시 KIS API 페이지네이션 폴백 (USD 원가 유지) */
    private FetchResult getUsStockData(String symbol, String start, String end, String assetType) {
        FetchResult result = fetchYahoo(symbol, start, end);

        if (result.isEmpty() && kisApiClient.isConfigured()) {
            log.info("Yahoo Finance 실패, KIS 해외주식 API 폴백 사용: {}", symbol);
            // KIS 폴백은 adjclose / 배당 정보가 없음 → DRIP off 모드는 효과 없음, 그냥 close 만 채움
            result = FetchResult.ofCandlesOnly(fetchUsStockFromKis(symbol, start, assetType));
        }

        if (result.isEmpty()) {
            log.warn("미국주식/ETF 백테스트 데이터 없음: {}", symbol);
        }
        return result;
    }

    /** KIS 해외주식 일봉 페이지네이션 (BYMD 기반, 최대 10 페이지 = ~1000 거래일 ≈ 4년) */
    private List<CandlestickResponse> fetchUsStockFromKis(String symbol, String startDate, String assetType) {
        String exchange = "ETF".equalsIgnoreCase(assetType)
                ? usEtfCatalog.getExchange(symbol)
                : usStockPriceProvider.getExchange(symbol);
        java.time.format.DateTimeFormatter fmt = java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd");
        long startEpoch = LocalDate.parse(startDate).atStartOfDay().toEpochSecond(ZoneOffset.UTC);

        List<CandlestickResponse> allCandles = new ArrayList<>();
        String bymd = ""; // 빈값 = 오늘부터

        for (int page = 0; page < 10; page++) {
            try {
                List<Map<String, String>> raw = kisApiClient.getUsStockDailyCandles(exchange, symbol, bymd);
                if (raw == null || raw.isEmpty()) break;

                String oldestDate = null;
                boolean hasOlderData = false;

                for (Map<String, String> row : raw) {
                    String dateStr = row.get("xymd");
                    if (dateStr == null || dateStr.isBlank()) continue;
                    try {
                        LocalDate date = LocalDate.parse(dateStr, fmt);
                        long epochSec = date.atStartOfDay(ZoneOffset.UTC).toEpochSecond();
                        double open = Double.parseDouble(row.getOrDefault("open", "0"));
                        double high = Double.parseDouble(row.getOrDefault("high", "0"));
                        double low = Double.parseDouble(row.getOrDefault("low", "0"));
                        double close = Double.parseDouble(row.getOrDefault("clos", "0"));
                        double volume = Double.parseDouble(row.getOrDefault("tvol", "0"));
                        if (close > 0) {
                            allCandles.add(new CandlestickResponse(epochSec, open, high, low, close, volume));
                        }
                        if (oldestDate == null || dateStr.compareTo(oldestDate) < 0) {
                            oldestDate = dateStr;
                        }
                        if (epochSec < startEpoch) {
                            hasOlderData = true;
                        }
                    } catch (Exception ignored) {}
                }

                // 시작일보다 오래된 데이터까지 도달했으면 중단
                if (hasOlderData || oldestDate == null) break;

                // 다음 페이지: 가장 오래된 날짜로 이동
                bymd = oldestDate;

                // KIS API rate limit 준수
                Thread.sleep(300);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                break;
            } catch (Exception e) {
                log.warn("KIS 해외주식 페이지네이션 오류 [{}/page={}]: {}", symbol, page, e.getMessage());
                break;
            }
        }

        // 중복 제거 및 시간순 정렬
        Map<Long, CandlestickResponse> deduped = new TreeMap<>();
        for (CandlestickResponse c : allCandles) {
            deduped.putIfAbsent(c.getTime(), c);
        }

        log.info("KIS 해외주식 백테스트 데이터 {}건 조회 완료: {}", deduped.size(), symbol);
        return new ArrayList<>(deduped.values());
    }

    @SuppressWarnings("unchecked")
    private FetchResult fetchYahoo(String symbol, String start, String end) {
        ensureYahooCrumb();

        long p1 = LocalDate.parse(start).atStartOfDay().toEpochSecond(KST);
        long p2 = LocalDate.parse(end).plusDays(1).atStartOfDay().toEpochSecond(KST);

        // events=div 로 배당 이벤트도 같이 받음
        String url = "https://query2.finance.yahoo.com/v8/finance/chart/" + symbol
                + "?period1=" + p1 + "&period2=" + p2 + "&interval=1d&events=div";
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
            if (body == null) return FetchResult.empty();

            Map<String, Object> chart = (Map<String, Object>) body.get("chart");
            if (chart == null) return FetchResult.empty();

            List<Map<String, Object>> results = (List<Map<String, Object>>) chart.get("result");
            if (results == null || results.isEmpty()) return FetchResult.empty();

            Map<String, Object> result = results.get(0);
            List<Number> timestamps = (List<Number>) result.get("timestamp");
            if (timestamps == null || timestamps.isEmpty()) return FetchResult.empty();

            Map<String, Object> indicators = (Map<String, Object>) result.get("indicators");
            if (indicators == null) return FetchResult.empty();
            List<Map<String, Object>> quotes =
                    (List<Map<String, Object>>) indicators.get("quote");
            if (quotes == null || quotes.isEmpty()) return FetchResult.empty();
            Map<String, Object> q = quotes.get(0);

            List<Number> opens   = (List<Number>) q.get("open");
            List<Number> highs   = (List<Number>) q.get("high");
            List<Number> lows    = (List<Number>) q.get("low");
            List<Number> closes  = (List<Number>) q.get("close");
            List<Number> volumes = (List<Number>) q.get("volume");

            // adjclose 평행 리스트 (timestamps 와 동일 인덱스)
            List<Number> adjcloseRaw = null;
            List<Map<String, Object>> adjList =
                    (List<Map<String, Object>>) indicators.get("adjclose");
            if (adjList != null && !adjList.isEmpty()) {
                adjcloseRaw = (List<Number>) adjList.get(0).get("adjclose");
            }

            List<CandlestickResponse> candles = new ArrayList<>();
            List<Double> adjcloses = new ArrayList<>();
            for (int i = 0; i < timestamps.size(); i++) {
                if (closes.get(i) == null) continue; // 거래 없는 날 건너뛰기
                candles.add(new CandlestickResponse(
                        timestamps.get(i).longValue(),
                        num(opens, i), num(highs, i), num(lows, i),
                        num(closes, i), num(volumes, i)
                ));
                if (adjcloseRaw != null && i < adjcloseRaw.size() && adjcloseRaw.get(i) != null) {
                    adjcloses.add(adjcloseRaw.get(i).doubleValue());
                } else {
                    adjcloses.add(null);
                }
            }

            // 배당 이벤트: events.dividends → { "<epochSec>": { amount, date } }
            java.util.SortedMap<Long, Double> dividends = new java.util.TreeMap<>();
            Map<String, Object> events = (Map<String, Object>) result.get("events");
            if (events != null) {
                Map<String, Object> divMap = (Map<String, Object>) events.get("dividends");
                if (divMap != null) {
                    for (Map.Entry<String, Object> e : divMap.entrySet()) {
                        try {
                            Map<String, Object> div = (Map<String, Object>) e.getValue();
                            Number amount = (Number) div.get("amount");
                            Number date = (Number) div.get("date");
                            if (amount != null && date != null && amount.doubleValue() > 0) {
                                dividends.put(date.longValue(), amount.doubleValue());
                            }
                        } catch (Exception ignored) {}
                    }
                }
            }

            // adjclose 가 전부 null 이면 빈 리스트로 교체 (도메스틱 등 일부 심볼 대비)
            boolean hasAnyAdj = adjcloses.stream().anyMatch(d -> d != null && d > 0);
            log.info("Yahoo Finance 조회 성공: {} → {}건, adjclose={}, 배당={}건 ({}~{})",
                    symbol, candles.size(), hasAnyAdj ? "있음" : "없음", dividends.size(), start, end);
            return new FetchResult(candles, hasAnyAdj ? adjcloses : List.of(), dividends);
        } catch (Exception e) {
            log.debug("Yahoo Finance 조회 실패 ({}): {}", symbol, e.getMessage());
            return FetchResult.empty();
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
