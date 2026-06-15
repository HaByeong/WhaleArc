package com.project.whalearc.strategy.service;

import com.project.whalearc.market.dto.CandlestickResponse;
import com.project.whalearc.market.service.ExchangeRateService;
import com.project.whalearc.market.service.IndicatorCalculator;
import com.project.whalearc.market.service.MomentumDataCache;
import com.project.whalearc.market.service.MomentumUniverse;
import com.project.whalearc.strategy.dto.BacktestRequest;
import com.project.whalearc.strategy.dto.BacktestResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * 미국주식 상대모멘텀 top-N 로테이션 백테스트 엔진 (신규, 기존 simulate/simulateRebalance와 격리).
 *
 * <p>명세 STRATEGY_TOP5_MOMENTUM.md §2: 132+ 유니버스를 매월 첫 거래일에 252거래일 모멘텀으로 랭킹 →
 * 양수 모멘텀 상위 N종목(각 1/N) → SPY 200일 SMA 레짐 약세 시 노출 ×regimeFloor → 월간 리밸런싱.
 * 룩어헤드 방지: 직전 거래일(전월 종가) 기준으로 결정해 당일 체결(shift(1) 동치), 레짐도 1일 지연.
 * USD 단위 시뮬레이션(수정주가), 편도 비용 반영.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MomentumRotationBacktestService {

    private final MomentumDataCache momentumDataCache;   // 디스크 영구 캐시(백그라운드 워밍) — 버스트 429 회피
    private final ExchangeRateService exchangeRateService;

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final int FETCH_LEAD_DAYS = 540;   // 252거래일 모멘텀 + 200SMA 워밍업 확보용 마스터축 선행 일수

    private static final class Position {
        double shares;
        double avgCost;   // USD/주
    }

    public BacktestResponse run(BacktestRequest req, String userId) {
        int topN = req.getTopN() != null && req.getTopN() > 0 ? req.getTopN() : 5;
        int lookback = req.getLookbackDays() != null && req.getLookbackDays() > 1 ? req.getLookbackDays() : 252;
        boolean regimeFilter = req.getRegimeFilter() == null || req.getRegimeFilter();
        double regimeFloor = req.getRegimeFloor() != null ? req.getRegimeFloor() : 0.5;
        double band = (req.getRebalanceBandPct() != null ? req.getRebalanceBandPct() : 3.0) / 100.0;
        double cost = (req.getCommissionRate() != null ? req.getCommissionRate() / 100.0 : 0.0005)
                + (req.getSlippagePercent() != null ? req.getSlippagePercent() / 100.0 : 0.0);
        double initialCapitalKrw = req.getInitialCapital();

        List<String> universe = (req.getUniverse() != null && !req.getUniverse().isEmpty())
                ? req.getUniverse() : MomentumUniverse.symbols();

        String reqStart = req.getStartDate();
        String reqEnd = req.getEndDate();
        String fetchStart = LocalDate.parse(reqStart).minusDays(FETCH_LEAD_DAYS).format(DATE_FMT);

        // ── 1) 디스크 영구 캐시에서 SPY + 유니버스 일봉 로드 (백그라운드에서 천천히 워밍됨 → 버스트 429 회피) ──
        LocalDate fetchStartD = LocalDate.parse(fetchStart);
        LocalDate reqEndD = LocalDate.parse(reqEnd);
        List<CandlestickResponse> spy = clip(momentumDataCache.get(MomentumUniverse.SPY_SYMBOL), fetchStartD, reqEndD);
        if (spy.size() < lookback + 30) {
            momentumDataCache.triggerWarmAsync();   // 캐시 워밍 시작(이미 진행 중이면 무시)
            long left = momentumDataCache.staleCount();
            throw new IllegalArgumentException("미국주식 일봉을 준비 중입니다(백그라운드 캐시 워밍, 종목당 ~2.5초로 천천히 수집). "
                    + (left > 0 ? "남은 종목 약 " + left + "개 — " : "") + "수 분 후 다시 시도해주세요. (한 번 받아두면 이후엔 즉시 실행됩니다)");
        }
        Map<String, List<CandlestickResponse>> raw = new HashMap<>();
        for (String sym : universe) {
            List<CandlestickResponse> c = momentumDataCache.get(sym);
            if (!c.isEmpty()) raw.put(sym, c);
        }

        // ── 2) 마스터 거래일축 = SPY 거래일 ──
        int n = spy.size();
        LocalDate[] dates = new LocalDate[n];
        double[] spyClose = new double[n];
        for (int i = 0; i < n; i++) {
            dates[i] = Instant.ofEpochSecond(spy.get(i).getTime()).atZone(KST).toLocalDate();
            spyClose[i] = spy.get(i).getClose();
        }
        double[] spySma200 = IndicatorCalculator.sma(spyClose, 200);

        // 종목별 마스터축 정렬 종가(결측 NaN) + 평가용 forward-fill
        Map<String, double[]> alignedClose = new LinkedHashMap<>();   // 모멘텀 랭킹용(NaN 유지)
        Map<String, double[]> ffillClose = new HashMap<>();           // 보유 평가용(직전값 채움)
        for (String sym : universe) {
            List<CandlestickResponse> c = raw.get(sym);
            if (c == null || c.isEmpty()) continue;   // 404/상폐 등 → 조용히 제외
            Map<LocalDate, Double> byDate = new TreeMap<>();
            for (CandlestickResponse k : c) {
                byDate.put(Instant.ofEpochSecond(k.getTime()).atZone(KST).toLocalDate(), k.getClose());
            }
            double[] aligned = new double[n];
            double[] ff = new double[n];
            double last = Double.NaN;
            for (int i = 0; i < n; i++) {
                Double v = byDate.get(dates[i]);
                if (v != null && v > 0) { aligned[i] = v; last = v; }
                else aligned[i] = Double.NaN;
                ff[i] = last;   // 직전 유효가(없으면 NaN)
            }
            alignedClose.put(sym, aligned);
            ffillClose.put(sym, ff);
        }

        // ── 3) 시뮬레이션 시작 인덱스(요청 시작일 이후 첫 거래일) ──
        LocalDate startD = LocalDate.parse(reqStart);
        int simStart = 0;
        while (simStart < n && dates[simStart].isBefore(startD)) simStart++;
        if (simStart >= n - 1) throw new IllegalArgumentException("백테스트 기간이 너무 짧습니다.");
        // 첫 결정일의 모멘텀 계산 가능 여부(simStart-1 기준 lookback 확보)
        if (simStart - 1 - lookback < 0) {
            throw new IllegalArgumentException("모멘텀 계산에 필요한 과거 데이터가 부족합니다. 시작일을 늦추거나 lookback을 줄이세요.");
        }

        // ── 4) USD 시뮬레이션 ──
        double usdKrw = exchangeRateService.getUsdKrwRate();
        if (usdKrw <= 0) usdKrw = 1400;
        double initialCapital = initialCapitalKrw / usdKrw;   // USD 단위
        double cash = initialCapital;
        Map<String, Position> holdings = new HashMap<>();

        List<BacktestResponse.EquityPointDto> equityCurve = new ArrayList<>();
        List<BacktestResponse.DailyReturnDto> dailyReturns = new ArrayList<>();
        List<BacktestResponse.EquityPointDto> drawdownCurve = new ArrayList<>();
        List<BacktestResponse.EquityPointDto> buyHoldCurve = new ArrayList<>();
        List<BacktestResponse.TradeDto> trades = new ArrayList<>();
        List<BacktestResponse.RotationSnapshotDto> rotationHistory = new ArrayList<>();

        double peak = initialCapital, maxDrawdown = 0, prevEquity = initialCapital;
        double spyStart = spyClose[simStart];
        int profitable = 0, losing = 0;
        List<Double> winAmts = new ArrayList<>();
        List<Double> lossAmts = new ArrayList<>();
        List<Double> dailyRets = new ArrayList<>();

        for (int i = simStart; i < n; i++) {
            // 리밸런싱: 첫 거래일 or 월 변경(전 거래일과 YearMonth 다름)
            boolean firstDayOfMonth = (i == simStart) || !YearMonth.from(dates[i]).equals(YearMonth.from(dates[i - 1]));
            if (firstDayOfMonth) {
                int decisionIdx = i - 1;   // 룩어헤드 방지: 직전(전월) 종가 기준 결정, 당일(i) 체결
                boolean regimeBear = regimeFilter && !Double.isNaN(spySma200[decisionIdx])
                        && spyClose[decisionIdx] < spySma200[decisionIdx];
                double regimeMult = regimeBear ? regimeFloor : 1.0;
                List<MomentumRanker.Ranked> ranked = MomentumRanker.rank(alignedClose, decisionIdx, lookback, topN);
                cash = doRebalance(i, dates[i], ranked, topN, regimeMult, band, cost, cash, holdings, ffillClose, trades, winAmts, lossAmts);

                List<BacktestResponse.HoldingDto> snap = new ArrayList<>();
                for (MomentumRanker.Ranked r : ranked) {
                    snap.add(BacktestResponse.HoldingDto.builder()
                            .symbol(r.symbol()).momentum(round4(r.momentum())).weight(round4(regimeMult / topN)).build());
                }
                rotationHistory.add(BacktestResponse.RotationSnapshotDto.builder()
                        .date(dates[i].format(DATE_FMT)).regimeBear(regimeBear).holdings(snap).build());
            }

            // ── 일별 평가 ──
            double equity = cash + holdingsValue(holdings, ffillClose, i);
            String date = dates[i].format(DATE_FMT);
            if (equity > peak) peak = equity;
            double dd = peak > 0 ? (peak - equity) / peak * 100 : 0;
            if (dd > maxDrawdown) maxDrawdown = dd;
            double dr = prevEquity > 0 ? (equity / prevEquity - 1) * 100 : 0;
            if (i > simStart) dailyRets.add(dr / 100.0);
            double cumRet = (equity / initialCapital - 1) * 100;

            equityCurve.add(BacktestResponse.EquityPointDto.builder().date(date).value(equity).build());
            drawdownCurve.add(BacktestResponse.EquityPointDto.builder().date(date).value(Math.round(-dd * 100.0) / 100.0).build());
            dailyReturns.add(BacktestResponse.DailyReturnDto.builder().date(date).dailyReturn(dr).cumulativeReturn(cumRet).portfolioValue(equity).build());
            buyHoldCurve.add(BacktestResponse.EquityPointDto.builder().date(date).value(initialCapital * spyClose[i] / spyStart).build());
            prevEquity = equity;
        }

        // ── 5) 최종 평가 + 지표 ──
        double finalValue = cash + holdingsValue(holdings, ffillClose, n - 1);
        double totalReturnRate = (finalValue / initialCapital - 1) * 100;
        double years = Math.max(1.0 / 365.25, (double) (dates[n - 1].toEpochDay() - dates[simStart].toEpochDay()) / 365.25);
        double cagr = (Math.pow(finalValue / initialCapital, 1.0 / years) - 1) * 100;
        double sharpe = sharpe(dailyRets, 0.03);
        double sortino = sortino(dailyRets, 0.03);
        for (double w : winAmts) if (w > 0) profitable++;
        for (double l : lossAmts) if (l > 0) losing++;
        int totalTrades = profitable + losing;
        double winRate = totalTrades > 0 ? (double) profitable / totalTrades * 100 : 0;
        double grossWin = winAmts.stream().mapToDouble(Double::doubleValue).sum();
        double grossLoss = lossAmts.stream().mapToDouble(Double::doubleValue).sum();
        Double profitFactor = grossLoss > 0 ? grossWin / grossLoss : null;
        double avgWin = profitable > 0 ? grossWin / profitable : 0;
        double avgLoss = losing > 0 ? grossLoss / losing : 0;
        double buyHoldReturnRate = (spyClose[n - 1] / spyStart - 1) * 100;

        return BacktestResponse.builder()
                .strategyId(req.getStrategyId())
                .strategyName(req.getStrategyName() != null ? req.getStrategyName() : "미국주식 모멘텀 Top" + topN)
                .stockCode("US_MOMENTUM_TOP" + topN).stockName("미국주식 모멘텀 로테이션")
                .startDate(reqStart).endDate(reqEnd)
                .initialCapital(initialCapital).finalValue(finalValue)
                .totalReturn(finalValue - initialCapital).totalReturnRate(round2(totalReturnRate))
                .maxDrawdown(round2(maxDrawdown)).sharpeRatio(round2(sharpe)).sortinoRatio(round2(sortino))
                .cagr(round2(cagr))
                .winRate(round2(winRate)).totalTrades(totalTrades).profitableTrades(profitable).losingTrades(losing)
                .profitFactor(profitFactor == null ? null : round2(profitFactor))
                .avgWin(round2(avgWin)).avgLoss(round2(avgLoss))
                .dailyReturns(dailyReturns).equityCurve(equityCurve).drawdownCurve(drawdownCurve).trades(trades)
                .buyHoldReturnRate(round2(buyHoldReturnRate)).buyHoldCurve(buyHoldCurve)
                .currency("USD").exchangeRate(usdKrw)
                .rotationHistory(rotationHistory)
                .build();
    }

    // ── 리밸런싱: 밀린 종목 매도 / 신규·트림 매수, 잔존은 밴드 안이면 유지. 갱신된 cash 반환 ──
    private double doRebalance(int i, LocalDate date, List<MomentumRanker.Ranked> ranked, int topN, double regimeMult,
                              double band, double cost, double cash, Map<String, Position> holdings, Map<String, double[]> ffill,
                              List<BacktestResponse.TradeDto> trades, List<Double> winAmts, List<Double> lossAmts) {
        double targetWeight = regimeMult / topN;   // 종목당 목표 비중(레짐 반영)
        Map<String, Double> targets = new LinkedHashMap<>();
        for (MomentumRanker.Ranked r : ranked) targets.put(r.symbol(), targetWeight);

        double equity = cash + holdingsValue(holdings, ffill, i);

        // 1) 타깃에서 빠진 보유 종목 전량 매도
        for (String sym : new ArrayList<>(holdings.keySet())) {
            if (!targets.containsKey(sym)) {
                cash = sell(sym, holdings.get(sym).shares, i, date, cost, cash, holdings, ffill, trades, winAmts, lossAmts, "로테이션 탈락");
            }
        }
        // 2) 타깃 종목: 신규 매수 / 밴드 밖 트림. 잔존이 밴드 안이면 유지.
        for (Map.Entry<String, Double> t : targets.entrySet()) {
            String sym = t.getKey();
            double[] p = ffill.get(sym);
            double price = (p != null && i < p.length && !Double.isNaN(p[i])) ? p[i] : 0;
            if (price <= 0) continue;   // 가격 결측이면 이번 회차 거래 불가
            Position pos = holdings.get(sym);
            double curVal = pos != null ? pos.shares * price : 0;
            double targetVal = equity * t.getValue();
            boolean held = pos != null && pos.shares > 0;
            double curWeight = equity > 0 ? curVal / equity : 0;
            if (held && Math.abs(curWeight - t.getValue()) <= band) continue;   // 밴드 안 → 유지

            double diffVal = targetVal - curVal;
            if (diffVal > 0) {
                double execPrice = price * (1 + cost);
                double buyShares = diffVal / execPrice;
                if (buyShares > 0) cash = buy(sym, buyShares, execPrice, i, date, cash, holdings, trades);
            } else if (diffVal < 0 && held) {
                double execPrice = price * (1 - cost);
                double sellShares = Math.min(pos.shares, (-diffVal) / execPrice);
                if (sellShares > 0) cash = sellAt(sym, sellShares, execPrice, i, date, cash, holdings, trades, winAmts, lossAmts, "비중 조정");
            }
        }
        return cash;
    }

    private double buy(String sym, double shares, double execPrice, int i, LocalDate date, double cash,
                       Map<String, Position> holdings, List<BacktestResponse.TradeDto> trades) {
        double notional = shares * execPrice;
        if (notional > cash) { shares = cash / execPrice; notional = cash; }   // 현금 한도
        if (shares <= 0) return cash;
        Position pos = holdings.computeIfAbsent(sym, k -> new Position());
        double newShares = pos.shares + shares;
        pos.avgCost = newShares > 0 ? (pos.avgCost * pos.shares + execPrice * shares) / newShares : execPrice;
        pos.shares = newShares;
        cash -= notional;
        trades.add(BacktestResponse.TradeDto.builder().date(date.format(DATE_FMT)).type("BUY")
                .price(round4(execPrice)).quantity(round4(shares)).pnl(0).pnlPercent(0)
                .reason(sym + " 진입/추가").holdingDays(0).balance(Math.round(cash)).build());
        return cash;
    }

    /** 보유 전량 매도(탈락). */
    private double sell(String sym, double shares, int i, LocalDate date, double cost, double cash,
                        Map<String, Position> holdings, Map<String, double[]> ffill,
                        List<BacktestResponse.TradeDto> trades, List<Double> winAmts, List<Double> lossAmts, String reason) {
        double[] p = ffill.get(sym);
        double price = (p != null && i < p.length && !Double.isNaN(p[i])) ? p[i] : 0;
        if (price <= 0) { holdings.remove(sym); return cash; }   // 가격 결측 → 장부상 제거(평가 0)
        return sellAt(sym, shares, price * (1 - cost), i, date, cash, holdings, trades, winAmts, lossAmts, reason);
    }

    private double sellAt(String sym, double shares, double execPrice, int i, LocalDate date, double cash,
                          Map<String, Position> holdings, List<BacktestResponse.TradeDto> trades,
                          List<Double> winAmts, List<Double> lossAmts, String reason) {
        Position pos = holdings.get(sym);
        if (pos == null || shares <= 0) return cash;
        shares = Math.min(shares, pos.shares);
        double proceeds = shares * execPrice;
        double pnl = (execPrice - pos.avgCost) * shares;
        cash += proceeds;
        pos.shares -= shares;
        if (pos.shares <= 1e-9) holdings.remove(sym);
        if (pnl >= 0) winAmts.add(pnl); else lossAmts.add(-pnl);
        trades.add(BacktestResponse.TradeDto.builder().date(date.format(DATE_FMT)).type("SELL")
                .price(round4(execPrice)).quantity(round4(shares)).pnl(round2(pnl))
                .pnlPercent(pos.avgCost > 0 ? round2((execPrice / pos.avgCost - 1) * 100) : 0)
                .reason(sym + " " + reason).holdingDays(0).balance(Math.round(cash)).build());
        return cash;
    }

    private double holdingsValue(Map<String, Position> holdings, Map<String, double[]> ffill, int i) {
        double v = 0;
        for (Map.Entry<String, Position> e : holdings.entrySet()) {
            double[] p = ffill.get(e.getKey());
            double price = (p != null && i < p.length && !Double.isNaN(p[i])) ? p[i] : 0;
            v += e.getValue().shares * price;
        }
        return v;
    }

    /** 캐시 전체 일봉을 [from, to] 범위로 자른다(마스터축 경계 설정용). */
    private List<CandlestickResponse> clip(List<CandlestickResponse> all, LocalDate from, LocalDate to) {
        List<CandlestickResponse> out = new ArrayList<>();
        for (CandlestickResponse c : all) {
            LocalDate d = Instant.ofEpochSecond(c.getTime()).atZone(KST).toLocalDate();
            if (!d.isBefore(from) && !d.isAfter(to)) out.add(c);
        }
        return out;
    }

    private static double sharpe(List<Double> rets, double rfAnnual) {
        if (rets.size() < 2) return 0;
        double rfDaily = rfAnnual / 252.0;
        double mean = rets.stream().mapToDouble(Double::doubleValue).average().orElse(0);
        double var = 0;
        for (double r : rets) var += (r - mean) * (r - mean);
        double sd = Math.sqrt(var / (rets.size() - 1));
        return sd > 0 ? (mean - rfDaily) / sd * Math.sqrt(252) : 0;
    }

    private static double sortino(List<Double> rets, double rfAnnual) {
        if (rets.size() < 2) return 0;
        double rfDaily = rfAnnual / 252.0;
        double mean = rets.stream().mapToDouble(Double::doubleValue).average().orElse(0);
        double dv = 0; int cnt = 0;
        for (double r : rets) { if (r < rfDaily) { dv += (r - rfDaily) * (r - rfDaily); cnt++; } }
        double dsd = cnt > 0 ? Math.sqrt(dv / cnt) : 0;
        return dsd > 0 ? (mean - rfDaily) / dsd * Math.sqrt(252) : 0;
    }

    private static double round2(double v) { return Double.isFinite(v) ? Math.round(v * 100.0) / 100.0 : 0; }
    private static double round4(double v) { return Double.isFinite(v) ? Math.round(v * 10000.0) / 10000.0 : 0; }
}
