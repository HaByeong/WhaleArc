package com.project.whalearc.market.service;

import com.project.whalearc.market.dto.CandlestickResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * 미국주식 모멘텀 유니버스(132+SPY)의 일봉(수정주가)을 디스크에 영구 캐시한다.
 *
 * <p>백테스트가 132종목을 한꺼번에(버스트) Yahoo에 요청하면 rate-limit(429)에 걸린다. 대신 백그라운드에서
 * 종목당 간격을 두고 "천천히" 받아 디스크에 저장해두고, 백테스트는 이 캐시에서 즉시 읽는다.
 * 재시작해도 디스크 캐시가 남아 첫 워밍 후엔 항상 빠르다. 일 1회(미국장 마감 후) 갱신.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MomentumDataCache {

    private final BacktestDataProvider backtestDataProvider;

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final String WARM_START = "2000-01-01";   // 골든 검증(2000~)까지 커버하도록 장기 수집
    private static final long FRESH_MS = 20L * 3600 * 1000;  // 20시간 이내면 신선(일 1회 갱신과 정합)
    private static final long PACE_MS = 2500;                // 종목 간 간격 — Yahoo rate-limit 회피

    @Value("${momentum.cache-dir:${user.home}/.whalearc/usdaily}")
    private String cacheDir;

    // 로컬 사전수집 데이터셋(파이썬 봇이 받아둔 {TICKER}_1d.csv). 있으면 Yahoo 대신 즉시 시드.
    // 환경에 없으면(예: prod) 무시되고 Yahoo 페이스드 페치로 폴백.
    @Value("${momentum.seed-dir:${user.home}/crypto/dataset}")
    private String seedDir;

    private final AtomicBoolean warming = new AtomicBoolean(false);

    private Path fileFor(String symbol) {
        return Path.of(cacheDir, symbol.toUpperCase() + ".csv");
    }

    /** 디스크 캐시에서 전체 일봉을 읽는다(없으면 빈 리스트). close 자리에 수정주가 저장됨. */
    public List<CandlestickResponse> get(String symbol) {
        Path f = fileFor(symbol);
        if (!Files.exists(f)) return List.of();
        List<CandlestickResponse> out = new ArrayList<>();
        try {
            for (String line : Files.readAllLines(f)) {
                int comma = line.indexOf(',');
                if (comma <= 0) continue;
                try {
                    long t = Long.parseLong(line.substring(0, comma).trim());
                    double c = Double.parseDouble(line.substring(comma + 1).trim());
                    if (c > 0) out.add(new CandlestickResponse(t, c, c, c, c, 0));
                } catch (NumberFormatException ignore) { /* 헤더/손상 라인 스킵 */ }
            }
        } catch (IOException e) {
            log.warn("모멘텀 캐시 읽기 실패: {} — {}", symbol, e.getMessage());
            return List.of();
        }
        return out;
    }

    public boolean isFresh(String symbol) {
        Path f = fileFor(symbol);
        try {
            return Files.exists(f) && (System.currentTimeMillis() - Files.getLastModifiedTime(f).toMillis()) < FRESH_MS;
        } catch (IOException e) {
            return false;
        }
    }

    private void save(String symbol, List<CandlestickResponse> candles) {
        try {
            Files.createDirectories(Path.of(cacheDir));
            StringBuilder sb = new StringBuilder();
            for (CandlestickResponse c : candles) sb.append(c.getTime()).append(',').append(c.getClose()).append('\n');
            Path tmp = fileFor(symbol).resolveSibling(symbol.toUpperCase() + ".csv.tmp");
            Files.writeString(tmp, sb.toString());
            Files.move(tmp, fileFor(symbol), java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            log.warn("모멘텀 캐시 저장 실패: {} — {}", symbol, e.getMessage());
        }
    }

    /** 워밍 진행 중인지(에러 메시지/상태 표시용). */
    public boolean isWarming() { return warming.get(); }

    /** 비신선 종목 수(0이면 모두 준비됨). */
    public long staleCount() {
        long n = 0;
        for (String s : allSymbols()) if (!isFresh(s)) n++;
        return n;
    }

    /** 로컬 데이터셋(<seedDir>/<TICKER>_1d.csv)에서 비신선 종목을 즉시 캐시에 시드. 반환=시드한 종목 수. */
    private int seedFromDisk() {
        if (seedDir == null || seedDir.isBlank() || !Files.isDirectory(Path.of(seedDir))) return 0;
        int n = 0;
        for (String s : allSymbols()) {
            if (isFresh(s)) continue;
            Path src = Path.of(seedDir, s.toUpperCase() + "_1d.csv");
            if (!Files.exists(src)) continue;
            try {
                List<CandlestickResponse> c = parseDatasetCsv(src);
                if (!c.isEmpty()) { save(s, c); n++; }
            } catch (IOException e) {
                log.debug("데이터셋 시드 실패(스킵): {} — {}", s, e.getMessage());
            }
        }
        return n;
    }

    /** 데이터셋 CSV 파싱: 헤더 time,open,high,low,close,volume — date(yyyy-MM-dd)+close(수정주가) 사용. */
    private List<CandlestickResponse> parseDatasetCsv(Path f) throws IOException {
        List<CandlestickResponse> out = new ArrayList<>();
        for (String line : Files.readAllLines(f)) {
            String[] p = line.split(",");
            if (p.length < 5 || p[0].equalsIgnoreCase("time")) continue;
            try {
                // 거래일 epoch는 UTC 자정 기준 — Yahoo/KIS 캔들 경로(CandlestickService·BacktestDataProvider)와
                // 동일 규약으로 맞춰, 로컬 시드 종목과 페치 종목이 같은 거래일에 9시간 어긋나지 않게 한다.
                long t = LocalDate.parse(p[0].trim()).atStartOfDay(java.time.ZoneOffset.UTC).toEpochSecond();
                double close = Double.parseDouble(p[4].trim());
                if (close > 0) out.add(new CandlestickResponse(t, close, close, close, close, 0));
            } catch (Exception ignore) { /* 손상 라인 스킵 */ }
        }
        return out;
    }

    private static void sleep(long ms) {
        try { Thread.sleep(ms); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); }
    }

    private List<String> allSymbols() {
        List<String> all = new ArrayList<>();
        all.add(MomentumUniverse.SPY_SYMBOL);
        all.addAll(MomentumUniverse.symbols());
        return all;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void warmOnStartup() {
        triggerWarmAsync();
    }

    @Scheduled(cron = "0 30 6 * * *", zone = "Asia/Seoul")   // 미국장 마감(KST 새벽) 후 일 1회 갱신
    public void warmDaily() {
        triggerWarmAsync();
    }

    /** 비동기 워밍 트리거(이미 진행 중이면 무시). 별도 데몬 스레드로 실행해 시작/요청을 막지 않는다. */
    public void triggerWarmAsync() {
        if (warming.get()) return;
        Thread t = new Thread(this::warmAll, "momentum-cache-warmer");
        t.setDaemon(true);
        t.start();
    }

    /** 비신선 종목만 천천히(종목 간 PACE_MS) Yahoo에서 받아 디스크에 저장. 버스트 금지로 429 회피. */
    public void warmAll() {
        if (!warming.compareAndSet(false, true)) {
            log.debug("모멘텀 캐시 워밍 이미 진행 중 — 스킵");
            return;
        }
        long t0 = System.currentTimeMillis();
        int fetched = 0, skipped = 0, failed = 0;
        try {
            // 0) 로컬 데이터셋에서 즉시 시드(있으면) — Yahoo 버스트 없이 대부분 채움
            int seeded = seedFromDisk();
            if (seeded > 0) log.info("모멘텀 캐시: 로컬 데이터셋에서 {}종목 즉시 시드", seeded);

            String today = LocalDate.now(KST).toString();
            for (String s : allSymbols()) {
                if (isFresh(s)) { skipped++; continue; }
                boolean ok = false;
                for (int attempt = 0; attempt < 3 && !ok; attempt++) {   // 일시 실패(429 등) 같은-실행 내 재시도
                    try {
                        List<CandlestickResponse> c = backtestDataProvider.getBacktestCandles(s, "US_STOCK", WARM_START, today, true);
                        if (c != null && !c.isEmpty()) { save(s, c); fetched++; ok = true; break; }
                    } catch (Exception e) {
                        log.debug("모멘텀 캐시 워밍 실패(재시도 {}/3): {} — {}", attempt + 1, s, e.getMessage());
                    }
                    sleep(PACE_MS * (attempt + 1));   // 재시도 백오프
                }
                if (!ok) failed++;
                else sleep(PACE_MS);
            }
            log.info("모멘텀 캐시 워밍 완료: 신규 {}건, 신선스킵 {}건, 실패 {}건 ({}초)",
                    fetched, skipped, failed, (System.currentTimeMillis() - t0) / 1000);
        } finally {
            warming.set(false);
        }
    }
}
