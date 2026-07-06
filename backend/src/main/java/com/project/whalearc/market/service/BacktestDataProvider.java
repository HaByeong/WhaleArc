package com.project.whalearc.market.service;

import com.project.whalearc.market.dto.CandlestickResponse;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Stream;

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
    private static final int MAX_CACHE_SIZE = 400;   // 모멘텀 유니버스(132+) 한 번에 캐시 유지 → 재실행 즉시(첫 실행만 콜드)
    private final ConcurrentHashMap<String, CacheEntry> candleCache = new ConcurrentHashMap<>();

    // ── 디스크 영구 캐시 (종목별 OHLCV+수정주가+배당을 파일로 영속, 외부 호출은 최초 적재·일 1회 갱신만) ──
    // 모멘텀 MomentumDataCache 와 같은 철학을 일반 백테스트(임의 종목)로 확장. Yahoo 등 외부 rate-limit 을 구조적으로 제거.
    @Value("${backtest.cache-dir:${user.home}/.whalearc/dailycandles}")
    private String diskCacheDir;
    // 로컬 사전수집 데이터셋(파이썬 봇이 받아둔 {TICKER}_1d.csv, 도메스틱은 {CODE}.KS_1d.csv). 있으면 외부 fetch 없이 즉시 부트스트랩.
    @Value("${backtest.seed-dir:${user.home}/crypto/dataset}")
    private String seedDir;
    private static final String PERSIST_START = "2000-01-01"; // 디스크 적재 시작일 — 1회 최대 범위 수집 후 재사용
    private static final long DISK_FRESH_MS = 20L * 3600 * 1000; // 20시간 — 매일 1회 갱신과 정합
    private static final long DISK_PACE_MS = 2500;  // 일일 갱신 시 종목 간 간격(rate-limit 회피)

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
        // 성공 시 1시간, 실패 시 10분 쿨다운 — 크럼 획득 실패 때 매 요청마다 쿠키 엔드포인트를 다시 때려
        // (132종목이면 수백 회) Yahoo rate-limit을 스스로 유발하던 문제 방지. chart는 크럼 없이도 동작한다.
        if (System.currentTimeMillis() < yahooCrumbExpiry) {
            return;
        }
        yahooCrumbExpiry = System.currentTimeMillis() + 600_000;   // 우선 10분 쿨다운(성공하면 아래에서 1시간으로 연장)

        try {
            // Step 1: Yahoo 접속 → 쿠키(A1/A3) 획득.
            // 과거 쿠키 발급 URL이던 fc.yahoo.com 은 현재 404(폐기) → 모든 요청이 크럼 없이 429가 됨.
            // finance.yahoo.com 메인이 Set-Cookie 를 내려주므로 이를 사용한다.
            HttpHeaders initHeaders = new HttpHeaders();
            initHeaders.set("User-Agent", YAHOO_USER_AGENT);
            initHeaders.set("Accept", "text/html,application/xhtml+xml");

            List<String> setCookies = null;
            for (String primeUrl : new String[]{"https://finance.yahoo.com/", "https://fc.yahoo.com/"}) {
                try {
                    ResponseEntity<String> initResp = restTemplate.exchange(
                            primeUrl, HttpMethod.GET, new HttpEntity<>(initHeaders), String.class);
                    List<String> sc = initResp.getHeaders().get(HttpHeaders.SET_COOKIE);
                    if (sc != null && !sc.isEmpty()) { setCookies = sc; break; }
                } catch (Exception primeErr) {
                    log.debug("Yahoo 쿠키 프라이밍 실패({}): {}", primeUrl, primeErr.getMessage());
                }
            }
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

        // 1) 디스크 영구 캐시가 신선하면 외부 호출 없이 사용(요청 범위로 슬라이스). rate-limit 구조적 회피의 핵심.
        if (diskFresh(symbol, assetType)) {
            FetchResult sliced = sliceRange(loadDisk(symbol, assetType), warmupStart.toString(), endDate);
            if (!sliced.isEmpty()) {
                putMemCache(cacheKey, sliced);
                log.debug("디스크 캐시 히트: {} ({}) {}건", symbol, assetType, sliced.candles().size());
                return sliced;
            }
        }

        // 2) 디스크 파일이 아예 없으면 로컬 시드 데이터셋에서 부트스트랩(외부 rate-limit 무관 즉시 적재)
        if (!Files.exists(mainFile(symbol, assetType))) {
            FetchResult seed = loadSeed(symbol, assetType);
            if (!seed.isEmpty()) {
                saveDisk(symbol, assetType, seed);
                log.info("백테스트 캐시 시드 부트스트랩: {} ({}) {}건", symbol, assetType, seed.candles().size());
            }
        }

        // 3) 외부 fetch로 최신화(성공 시 디스크 덮어씀). 최대 범위(PERSIST_START~오늘) 1회 수집.
        FetchResult full = FetchResult.empty();
        try {
            String today = LocalDate.now(KST).toString();
            String fetchStart = warmupStart.isBefore(LocalDate.parse(PERSIST_START)) ? warmupStart.toString() : PERSIST_START;
            full = fetchRange(symbol, assetType, fetchStart, today);
        } catch (Exception e) {
            log.warn("백테스트 외부 fetch 실패(디스크/시드 폴백 시도): symbol={}, error={}", symbol, e.getMessage());
        }
        if (!full.isEmpty()) {
            saveDisk(symbol, assetType, full);
            FetchResult sliced = sliceRange(full, warmupStart.toString(), endDate);
            FetchResult ret = sliced.isEmpty() ? full : sliced;
            putMemCache(cacheKey, ret);
            return ret;
        }

        // 4) 외부 실패 → 디스크(시드 부트스트랩분 포함, 만료 허용)로 폴백 — 데이터 0건보다 stale 이라도 낫다.
        FetchResult disk = loadDisk(symbol, assetType);
        if (!disk.isEmpty()) {
            FetchResult sliced = sliceRange(disk, warmupStart.toString(), endDate);
            if (!sliced.isEmpty()) {
                putMemCache(cacheKey, sliced);
                log.info("외부 fetch 실패 → 디스크/시드 폴백: {} ({}) {}건", symbol, assetType, sliced.candles().size());
                return sliced;
            }
        }
        return FetchResult.empty();
    }

    /**
     * 로컬 시드 데이터셋에서 OHLCV 적재 — {SYMBOL}_1d.csv (도메스틱 STOCK 은 {CODE}.KS_1d.csv).
     * 헤더 time,open,high,low,close,volume. 거래일 epoch 는 UTC 자정(MomentumDataCache 와 동일 규약).
     * close<=0(과거 수정주가 역산 손상분) 라인은 건너뛴다.
     */
    private FetchResult loadSeed(String symbol, String assetType) {
        if (seedDir == null || seedDir.isBlank()) return FetchResult.empty();
        String fname = "STOCK".equalsIgnoreCase(assetType)
                ? symbol.toUpperCase() + ".KS_1d.csv"
                : symbol.toUpperCase() + "_1d.csv";
        Path src = Path.of(seedDir, fname);
        if (!Files.exists(src)) return FetchResult.empty();
        try {
            List<CandlestickResponse> candles = new ArrayList<>();
            for (String line : Files.readAllLines(src)) {
                String[] p = line.split(",");
                if (p.length < 5 || p[0].equalsIgnoreCase("time")) continue;
                try {
                    long t = LocalDate.parse(p[0].trim()).atStartOfDay(ZoneOffset.UTC).toEpochSecond();
                    double o = Double.parseDouble(p[1].trim()), h = Double.parseDouble(p[2].trim()),
                           l = Double.parseDouble(p[3].trim()), c = Double.parseDouble(p[4].trim());
                    double v = p.length >= 6 && !p[5].trim().isEmpty() ? Double.parseDouble(p[5].trim()) : 0;
                    if (c > 0) candles.add(new CandlestickResponse(t, o, h, l, c, v));   // 음수/0 손상 필터
                } catch (NumberFormatException ignore) { /* 손상 라인 스킵 */ }
            }
            return candles.isEmpty() ? FetchResult.empty() : FetchResult.ofCandlesOnly(candles);
        } catch (IOException e) {
            log.warn("시드 적재 실패: {} ({}) — {}", symbol, assetType, e.getMessage());
            return FetchResult.empty();
        }
    }

    /** 자산군별 외부 fetch (디스크 캐시 미스/갱신 시에만 호출). */
    private FetchResult fetchRange(String symbol, String assetType, String start, String end) {
        if ("STOCK".equalsIgnoreCase(assetType)) {
            return FetchResult.ofCandlesOnly(getStockCandles(symbol, start, end));
        } else if ("US_STOCK".equalsIgnoreCase(assetType) || "ETF".equalsIgnoreCase(assetType)) {
            return getUsStockData(symbol, start, end, assetType);
        } else {
            return FetchResult.ofCandlesOnly(getCryptoCandles(symbol, start, end));
        }
    }

    private void putMemCache(String cacheKey, FetchResult result) {
        if (result.isEmpty()) return;
        if (candleCache.size() >= MAX_CACHE_SIZE) {
            candleCache.entrySet().removeIf(e -> e.getValue().isExpired());
            if (candleCache.size() >= MAX_CACHE_SIZE) candleCache.clear();
        }
        candleCache.put(cacheKey, new CacheEntry(result, System.currentTimeMillis() + CACHE_TTL_MS));
    }

    // ── 디스크 영구 캐시 입출력 ─────────────────────────────────────────────

    private static String safeName(String s) { return s.toUpperCase().replaceAll("[^A-Z0-9._-]", "_"); }
    private Path mainFile(String symbol, String assetType) {
        return Path.of(diskCacheDir, safeName(symbol) + "__" + assetType.toUpperCase() + ".csv");
    }
    private Path divFile(String symbol, String assetType) {
        return Path.of(diskCacheDir, safeName(symbol) + "__" + assetType.toUpperCase() + ".div.csv");
    }

    /** 디스크 캐시가 존재하고 20시간 이내 갱신됐는지. */
    private boolean diskFresh(String symbol, String assetType) {
        if (diskCacheDir == null || diskCacheDir.isBlank()) return false;
        Path mf = mainFile(symbol, assetType);
        try {
            return Files.exists(mf) && (System.currentTimeMillis() - Files.getLastModifiedTime(mf).toMillis()) < DISK_FRESH_MS;
        } catch (IOException e) {
            return false;
        }
    }

    /** 디스크에서 종목 전체 일봉(OHLCV+수정주가+배당)을 FetchResult 로 복원. */
    private FetchResult loadDisk(String symbol, String assetType) {
        Path mf = mainFile(symbol, assetType);
        if (!Files.exists(mf)) return FetchResult.empty();
        try {
            List<CandlestickResponse> candles = new ArrayList<>();
            List<Double> adjcloses = new ArrayList<>();
            boolean anyAdj = false;
            for (String line : Files.readAllLines(mf)) {
                String[] p = line.split(",", -1);
                if (p.length < 6) continue;
                try {
                    long t = Long.parseLong(p[0].trim());
                    double o = Double.parseDouble(p[1].trim()), h = Double.parseDouble(p[2].trim()),
                           l = Double.parseDouble(p[3].trim()), c = Double.parseDouble(p[4].trim());
                    double v = p[5].trim().isEmpty() ? 0 : Double.parseDouble(p[5].trim());
                    if (c <= 0) continue;
                    candles.add(new CandlestickResponse(t, o, h, l, c, v));
                    Double adj = (p.length >= 7 && !p[6].trim().isEmpty()) ? Double.parseDouble(p[6].trim()) : null;
                    adjcloses.add(adj);
                    if (adj != null && adj > 0) anyAdj = true;
                } catch (NumberFormatException ignore) { /* 헤더/손상 라인 스킵 */ }
            }
            if (candles.isEmpty()) return FetchResult.empty();
            java.util.SortedMap<Long, Double> dividends = new java.util.TreeMap<>();
            Path df = divFile(symbol, assetType);
            if (Files.exists(df)) {
                for (String line : Files.readAllLines(df)) {
                    int comma = line.indexOf(',');
                    if (comma <= 0) continue;
                    try {
                        dividends.put(Long.parseLong(line.substring(0, comma).trim()),
                                Double.parseDouble(line.substring(comma + 1).trim()));
                    } catch (NumberFormatException ignore) { /* 손상 라인 스킵 */ }
                }
            }
            return new FetchResult(candles, anyAdj ? adjcloses : List.of(), dividends);
        } catch (IOException e) {
            log.warn("디스크 캐시 읽기 실패: {} ({}) — {}", symbol, assetType, e.getMessage());
            return FetchResult.empty();
        }
    }

    /** FetchResult 를 디스크에 영속(메인 OHLCV+수정주가 + 배당 별도 파일, atomic). */
    private void saveDisk(String symbol, String assetType, FetchResult fr) {
        if (diskCacheDir == null || diskCacheDir.isBlank() || fr.isEmpty()) return;
        try {
            Files.createDirectories(Path.of(diskCacheDir));
            List<CandlestickResponse> cs = fr.candles();
            List<Double> adj = fr.adjcloses();
            boolean hasAdj = !adj.isEmpty() && adj.size() == cs.size();
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < cs.size(); i++) {
                CandlestickResponse c = cs.get(i);
                sb.append(c.getTime()).append(',').append(c.getOpen()).append(',').append(c.getHigh())
                        .append(',').append(c.getLow()).append(',').append(c.getClose()).append(',').append(c.getVolume())
                        .append(',').append(hasAdj && adj.get(i) != null ? adj.get(i).toString() : "").append('\n');
            }
            writeAtomic(mainFile(symbol, assetType), sb.toString());
            if (!fr.dividends().isEmpty()) {
                StringBuilder db = new StringBuilder();
                for (Map.Entry<Long, Double> e : fr.dividends().entrySet()) db.append(e.getKey()).append(',').append(e.getValue()).append('\n');
                writeAtomic(divFile(symbol, assetType), db.toString());
            }
        } catch (IOException e) {
            log.warn("디스크 캐시 저장 실패: {} ({}) — {}", symbol, assetType, e.getMessage());
        }
    }

    private void writeAtomic(Path target, String content) throws IOException {
        Path tmp = target.resolveSibling(target.getFileName() + ".tmp");
        Files.writeString(tmp, content);
        Files.move(tmp, target, StandardCopyOption.REPLACE_EXISTING);
    }

    /** 디스크 전체본을 요청 범위[warmupStart, endDate]로 슬라이스 — 기존 fetch 반환과 동일한 범위를 유지. */
    private FetchResult sliceRange(FetchResult fr, String warmupStart, String endDate) {
        if (fr.isEmpty()) return fr;
        long from = LocalDate.parse(warmupStart).atStartOfDay().toEpochSecond(KST);
        long to = LocalDate.parse(endDate).plusDays(1).atStartOfDay().toEpochSecond(KST);
        List<CandlestickResponse> cs = new ArrayList<>();
        List<Double> adj = new ArrayList<>();
        boolean hasAdj = !fr.adjcloses().isEmpty() && fr.adjcloses().size() == fr.candles().size();
        boolean anyAdj = false;
        for (int i = 0; i < fr.candles().size(); i++) {
            long t = fr.candles().get(i).getTime();
            if (t < from || t >= to) continue;
            cs.add(fr.candles().get(i));
            if (hasAdj) { Double a = fr.adjcloses().get(i); adj.add(a); if (a != null && a > 0) anyAdj = true; }
        }
        java.util.SortedMap<Long, Double> divs = fr.dividends().isEmpty()
                ? new java.util.TreeMap<>() : new java.util.TreeMap<>(fr.dividends().subMap(from, to));
        return new FetchResult(cs, anyAdj ? adj : List.of(), divs);
    }

    /** 매일 07:00(KST) — 디스크에 쌓인 종목만 증분 갱신(만료분 재수집). 모멘텀 워밍(06:30) 이후. */
    @Scheduled(cron = "0 0 7 * * *", zone = "Asia/Seoul")
    public void refreshDiskCacheDaily() {
        if (diskCacheDir == null || diskCacheDir.isBlank()) return;
        Path dir = Path.of(diskCacheDir);
        if (!Files.isDirectory(dir)) return;
        Thread t = new Thread(() -> {
            String today = LocalDate.now(KST).toString();
            int updated = 0, failed = 0;
            List<Path> mains;
            try (Stream<Path> files = Files.list(dir)) {
                mains = files.filter(p -> {
                    String n = p.getFileName().toString();
                    return n.endsWith(".csv") && !n.endsWith(".div.csv") && !n.endsWith(".tmp");
                }).toList();
            } catch (IOException e) {
                log.warn("디스크 캐시 갱신 디렉토리 스캔 실패: {}", e.getMessage());
                return;
            }
            for (Path mf : mains) {
                String base = mf.getFileName().toString();
                base = base.substring(0, base.length() - 4); // ".csv" 제거
                int sep = base.lastIndexOf("__");
                if (sep <= 0) continue;
                String symbol = base.substring(0, sep);
                String assetType = base.substring(sep + 2);
                if (diskFresh(symbol, assetType)) continue;
                try {
                    FetchResult fr = fetchRange(symbol, assetType, PERSIST_START, today);
                    if (!fr.isEmpty()) { saveDisk(symbol, assetType, fr); updated++; }
                    else failed++;
                } catch (Exception e) {
                    failed++;
                    log.debug("디스크 캐시 갱신 실패: {} ({}) — {}", symbol, assetType, e.getMessage());
                }
                paceSleep(DISK_PACE_MS);
            }
            log.info("백테스트 디스크 캐시 갱신 완료: {}종목 갱신, {}실패 (총 {}개 파일)", updated, failed, mains.size());
        }, "backtest-cache-refresh");
        t.setDaemon(true);
        t.start();
    }

    private static void paceSleep(long ms) {
        try { Thread.sleep(ms); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
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
        // Yahoo chart API 는 크럼 없이도 동작한다(실측). 오히려 getcrumb 호출이 429(rate-limit)를 유발해
        // chart 요청까지 실패시키므로, 먼저 크럼/쿠키 없이 시도하고 비었을 때만 크럼을 획득해 한 번 재시도한다.
        FetchResult r = fetchYahooChart(symbol, start, end);
        if (!r.isEmpty()) return r;
        ensureYahooCrumb();
        if (yahooCrumb != null || yahooCookie != null) {
            r = fetchYahooChart(symbol, start, end);
        }
        return r;
    }

    private FetchResult fetchYahooChart(String symbol, String start, String end) {
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
