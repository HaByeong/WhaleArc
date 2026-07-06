package com.project.whalearc.market.service;

import com.project.whalearc.market.dto.CandlestickResponse;
import com.project.whalearc.market.dto.MomentumSignalResponse;
import com.project.whalearc.strategy.service.MomentumRanker;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 모멘텀 로테이션 <b>범용 시그널</b> 계산 — 주문 없이 랭킹·레짐·종가만 제공한다(기기 실행형 App용).
 *
 * <p>{@code LiveStrategyService.doRebalanceMomentumLocked}의 계산부(유니버스→일봉→랭킹→레짐)만 추출했다.
 * 주문(momentumBuy/Sell)·목표비중·주수는 포함하지 않는다 — 그건 "내 계좌 판단"이라 App이 한다(INV-2).
 * 데이터 헬퍼(momentumDailyCandles/recentCloses/isRegimeBear)는 LiveStrategyService와 동일 규약으로
 * 복제했다(미국주식=사전워밍 디스크 캐시, 그 외=온디맨드 프로바이더).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MomentumSignalService {

    private final MomentumDataCache momentumDataCache;
    private final BacktestDataProvider backtestDataProvider;
    private final UsStockPriceProvider usStockPriceProvider;
    private final UsEtfCatalog usEtfCatalog;

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    /** 미국주식/ETF의 KIS EXCD(NAS/NYS/AMS) — App 해외주문 거래소 코드용. 그 외 자산군은 "". */
    private String exchangeOf(String assetType, String symbol) {
        if ("US_STOCK".equals(assetType)) return usStockPriceProvider.getExchange(symbol);
        if ("ETF".equals(assetType)) return usEtfCatalog.getExchange(symbol);
        return "";
    }

    public MomentumSignalResponse calculate(String assetType, int topN, int lookback, boolean regime) {
        String ac = MomentumUniverses.normalize(assetType);
        if (topN < 1) topN = 5;
        if (topN > 20) topN = 20;
        if (lookback < 20) lookback = 252;
        if (lookback > 500) lookback = 500;

        List<String> universe = MomentumUniverses.defaultUniverse(ac);
        Map<String, double[]> closes = new HashMap<>();
        Map<String, Double> lastClose = new HashMap<>();
        for (String s : universe) {
            double[] arr = recentCloses(ac, s, lookback + 1);
            if (arr != null) {
                closes.put(s, arr);
                lastClose.put(s, arr[arr.length - 1]);
            }
        }
        if (closes.isEmpty() && "US_STOCK".equals(ac)) momentumDataCache.triggerWarmAsync();

        List<MomentumRanker.Ranked> ranked = MomentumRanker.rank(closes, lookback, lookback, topN);
        boolean bear = regime && isRegimeBear(ac);

        List<MomentumSignalResponse.RankedHolding> holdings = new ArrayList<>();
        for (MomentumRanker.Ranked r : ranked) {
            holdings.add(new MomentumSignalResponse.RankedHolding(
                    r.symbol(), r.symbol(), r.momentum(), lastClose.getOrDefault(r.symbol(), 0.0),
                    exchangeOf(ac, r.symbol())));
        }
        return new MomentumSignalResponse(
                ac, LocalDate.now(KST).toString(),
                MomentumUniverses.isUsd(ac) ? "USD" : "KRW",
                bear, MomentumUniverses.regimeSymbol(ac), topN, lookback, holdings);
    }

    // ── 데이터 헬퍼 (LiveStrategyService와 동일 규약 복제) ──

    private List<CandlestickResponse> momentumDailyCandles(String assetType, String symbol) {
        if ("US_STOCK".equalsIgnoreCase(assetType)) {
            return momentumDataCache.get(symbol);
        }
        try {
            String end = LocalDate.now(KST).toString();
            String start = LocalDate.now(KST).minusDays(1000).toString();
            return backtestDataProvider.getBacktestCandles(symbol, assetType, start, end, true);
        } catch (Exception e) {
            log.debug("모멘텀 시그널 일봉 조회 실패: {} ({}) — {}", symbol, assetType, e.getMessage());
            return null;
        }
    }

    private double[] recentCloses(String assetType, String symbol, int n) {
        List<CandlestickResponse> c = momentumDailyCandles(assetType, symbol);
        if (c == null || c.size() < n) return null;
        c = new ArrayList<>(c);
        c.sort(Comparator.comparingLong(CandlestickResponse::getTime));
        double[] out = new double[n];
        int from = c.size() - n;
        for (int i = 0; i < n; i++) out[i] = c.get(from + i).getClose();
        return out;
    }

    private boolean isRegimeBear(String assetType) {
        String benchSym = MomentumUniverses.regimeSymbol(assetType);
        String benchAc = MomentumUniverses.regimeAssetType(assetType);
        List<CandlestickResponse> bench = momentumDailyCandles(benchAc, benchSym);
        if (bench == null || bench.size() < 200) return false;
        bench = new ArrayList<>(bench);
        bench.sort(Comparator.comparingLong(CandlestickResponse::getTime));
        int n = bench.size();
        double sum = 0;
        for (int i = n - 200; i < n; i++) sum += bench.get(i).getClose();
        double sma = sum / 200.0;
        return bench.get(n - 1).getClose() < sma;
    }
}
