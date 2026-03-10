package com.project.whalearc.strategy.service;

import com.project.whalearc.market.dto.CandlestickResponse;
import com.project.whalearc.market.service.CandlestickService;
import com.project.whalearc.market.service.IndicatorCalculator;
import com.project.whalearc.strategy.domain.Condition;
import com.project.whalearc.strategy.domain.Indicator;
import com.project.whalearc.strategy.domain.Strategy;
import com.project.whalearc.strategy.dto.BacktestRequest;
import com.project.whalearc.strategy.dto.BacktestResponse;
import com.project.whalearc.strategy.repository.StrategyRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class BacktestService {

    private final StrategyRepository strategyRepository;
    private final CandlestickService candlestickService;

    private static final double DEFAULT_COMMISSION_RATE = 0.001; // 0.1%
    private static final ZoneOffset KST = ZoneOffset.of("+09:00");
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    public BacktestResponse runBacktest(BacktestRequest request) {
        if (request.getInitialCapital() <= 0) {
            throw new IllegalArgumentException("초기 자본금은 0보다 커야 합니다.");
        }

        // 전략 or 직접 조건 분기
        String strategyName;
        String strategyId;
        List<Indicator> indicators;
        List<Condition> entryConditions;
        List<Condition> exitConditions;

        if (request.getStrategyId() != null && !request.getStrategyId().isEmpty()) {
            Strategy strategy = strategyRepository.findById(request.getStrategyId())
                    .orElseThrow(() -> new IllegalArgumentException("전략을 찾을 수 없습니다."));
            strategyName = strategy.getName();
            strategyId = strategy.getId();
            indicators = strategy.getIndicators();
            entryConditions = strategy.getEntryConditions();
            exitConditions = strategy.getExitConditions();
        } else {
            strategyName = "종목 분석";
            strategyId = "direct";
            indicators = request.getIndicators();
            entryConditions = request.getEntryConditions();
            exitConditions = request.getExitConditions();

            if ((entryConditions == null || entryConditions.isEmpty()) &&
                (exitConditions == null || exitConditions.isEmpty())) {
                throw new IllegalArgumentException("진입 조건 또는 청산 조건을 최소 1개 설정해주세요.");
            }
        }

        // 자산 타입 자동 감지
        String assetType = request.getAssetType();
        if (assetType == null || assetType.isEmpty()) {
            assetType = request.getStockCode().matches("\\d{6}") ? "STOCK" : "CRYPTO";
        }

        // 캔들스틱 데이터 조회
        String interval = "STOCK".equals(assetType) ? "1d" : "24h";
        List<CandlestickResponse> allCandles = candlestickService.getCandlesticks(
                request.getStockCode(), interval, assetType);

        if (allCandles == null || allCandles.isEmpty()) {
            throw new IllegalArgumentException("캔들스틱 데이터를 가져올 수 없습니다: " + request.getStockCode());
        }

        allCandles = allCandles.stream()
                .sorted(Comparator.comparingLong(CandlestickResponse::getTime))
                .toList();

        // 날짜 범위 필터링
        LocalDate startDate = LocalDate.parse(request.getStartDate());
        LocalDate endDate = LocalDate.parse(request.getEndDate());
        long startEpoch = startDate.atStartOfDay().toEpochSecond(KST);
        long endEpoch = endDate.plusDays(1).atStartOfDay().toEpochSecond(KST);

        List<CandlestickResponse> candles = allCandles.stream()
                .filter(c -> c.getTime() >= startEpoch && c.getTime() < endEpoch)
                .sorted(Comparator.comparingLong(CandlestickResponse::getTime))
                .toList();

        if (candles.size() < 2) {
            throw new IllegalArgumentException("선택한 기간에 충분한 데이터가 없습니다. (최소 2개 캔들 필요)");
        }

        // 지표 계산
        Map<String, double[]> indicatorValues = calculateIndicators(
                allCandles, indicators, entryConditions, exitConditions);

        int globalOffset = 0;
        for (int i = 0; i < allCandles.size(); i++) {
            if (allCandles.get(i).getTime() == candles.get(0).getTime()) {
                globalOffset = i;
                break;
            }
        }

        return simulate(strategyId, strategyName, entryConditions, exitConditions,
                candles, indicatorValues, globalOffset, request, assetType);
    }

    // ── 지표 계산 ─────────────────────────────────────────────────────────

    private Map<String, double[]> calculateIndicators(List<CandlestickResponse> candles,
                                                       List<Indicator> indicators,
                                                       List<Condition> entryConditions,
                                                       List<Condition> exitConditions) {
        int len = candles.size();
        double[] closes = new double[len];
        double[] highs = new double[len];
        double[] lows = new double[len];
        double[] volumes = new double[len];

        for (int i = 0; i < len; i++) {
            closes[i] = candles.get(i).getClose();
            highs[i] = candles.get(i).getHigh();
            lows[i] = candles.get(i).getLow();
            volumes[i] = candles.get(i).getVolume();
        }

        Map<String, double[]> result = new HashMap<>();

        if (indicators != null) {
            for (Indicator ind : indicators) {
                Map<String, Number> params = ind.getParameters() != null ? ind.getParameters() : Map.of();
                calculateIndicator(ind.getType().name(), params, closes, highs, lows, volumes, result);
            }
        }

        // 조건에서 참조하는 지표 자동 추가 (크로스오버 키 분해 포함)
        Set<String> neededKeys = new HashSet<>();
        if (entryConditions != null) entryConditions.forEach(c -> { if (c.getIndicator() != null) neededKeys.add(c.getIndicator().toUpperCase()); });
        if (exitConditions != null) exitConditions.forEach(c -> { if (c.getIndicator() != null) neededKeys.add(c.getIndicator().toUpperCase()); });

        // 크로스오버 키("A_CROSS_B", "A_CROSSUNDER_B")를 분해하여 각 구성 지표를 추가
        Set<String> expandedKeys = new HashSet<>();
        for (String key : neededKeys) {
            if (key.contains("_CROSSUNDER_")) {
                String[] parts = key.split("_CROSSUNDER_", 2);
                expandedKeys.add(parts[0]);
                expandedKeys.add(parts[1]);
            } else if (key.contains("_CROSS_")) {
                String[] parts = key.split("_CROSS_", 2);
                expandedKeys.add(parts[0]);
                expandedKeys.add(parts[1]);
            } else {
                expandedKeys.add(key);
            }
        }

        for (String key : expandedKeys) {
            if (result.containsKey(key) || "PRICE".equals(key) || "CLOSE".equals(key)) continue;

            ensureIndicatorCalculated(key, closes, highs, lows, volumes, result);
        }

        result.put("PRICE", closes);
        return result;
    }

    private void calculateIndicator(String type, Map<String, Number> params,
                                     double[] closes, double[] highs, double[] lows, double[] volumes,
                                     Map<String, double[]> result) {
        switch (type) {
            case "RSI" -> {
                int period = getParam(params, "period", 14);
                result.put("RSI", IndicatorCalculator.rsi(closes, period));
            }
            case "MACD" -> {
                int fast = getParam(params, "fast", 12);
                int slow = getParam(params, "slow", 26);
                int signal = getParam(params, "signal", 9);
                var macd = IndicatorCalculator.macd(closes, fast, slow, signal);
                result.put("MACD", macd.getMacdLine());
                result.put("MACD_SIGNAL", macd.getSignalLine());
                result.put("MACD_HISTOGRAM", macd.getHistogram());
            }
            case "MA", "SMA" -> {
                int period = getParam(params, "period", 20);
                result.put("MA", IndicatorCalculator.sma(closes, period));
            }
            case "EMA" -> {
                int period = getParam(params, "period", 20);
                result.put("EMA", IndicatorCalculator.ema(closes, period));
            }
            case "BOLLINGER_BANDS" -> {
                int period = getParam(params, "period", 20);
                double stdDev = params.getOrDefault("stdDev", 2.0).doubleValue();
                var bb = IndicatorCalculator.bollingerBands(closes, period, stdDev);
                result.put("BOLLINGER_UPPER", bb.getUpper());
                result.put("BOLLINGER_MIDDLE", bb.getMiddle());
                result.put("BOLLINGER_LOWER", bb.getLower());

                double[] pctB = new double[closes.length];
                for (int j = 0; j < closes.length; j++) {
                    double range = bb.getUpper()[j] - bb.getLower()[j];
                    pctB[j] = range > 0 ? (closes[j] - bb.getLower()[j]) / range : 0.5;
                }
                result.put("BOLLINGER_PCT_B", pctB);
            }
            case "STOCHASTIC" -> {
                int kPeriod = getParam(params, "kPeriod", 14);
                int dPeriod = getParam(params, "dPeriod", 3);
                var stoch = IndicatorCalculator.stochastic(highs, lows, closes, kPeriod, dPeriod);
                result.put("STOCH_K", stoch.getK());
                result.put("STOCH_D", stoch.getD());
            }
            case "ATR" -> {
                int period = getParam(params, "period", 14);
                result.put("ATR", IndicatorCalculator.atr(highs, lows, closes, period));
            }
            case "OBV" -> {
                result.put("OBV", IndicatorCalculator.obv(closes, volumes));
            }
            case "WILLIAMS_R" -> {
                int period = getParam(params, "period", 14);
                result.put("WILLIAMS_R", IndicatorCalculator.williamsR(highs, lows, closes, period));
            }
            case "CCI" -> {
                int period = getParam(params, "period", 20);
                result.put("CCI", IndicatorCalculator.cci(highs, lows, closes, period));
            }
        }
    }

    /**
     * 지표 키 하나를 받아, 아직 계산되지 않았으면 자동으로 계산
     */
    private void ensureIndicatorCalculated(String key, double[] closes, double[] highs,
                                            double[] lows, double[] volumes, Map<String, double[]> result) {
        if ("RSI".equals(key) && !result.containsKey("RSI")) {
            calculateIndicator("RSI", Map.of(), closes, highs, lows, volumes, result);
        } else if (key.startsWith("MACD") && !result.containsKey("MACD")) {
            calculateIndicator("MACD", Map.of(), closes, highs, lows, volumes, result);
        } else if (("MA".equals(key) || "SMA".equals(key)) && !result.containsKey("MA")) {
            calculateIndicator("MA", Map.of(), closes, highs, lows, volumes, result);
        } else if ("EMA".equals(key) && !result.containsKey("EMA")) {
            calculateIndicator("EMA", Map.of(), closes, highs, lows, volumes, result);
        } else if ((key.startsWith("BOLLINGER") || "PCT_B".equals(key) || "BB_PCT_B".equals(key)) && !result.containsKey("BOLLINGER_UPPER")) {
            calculateIndicator("BOLLINGER_BANDS", Map.of(), closes, highs, lows, volumes, result);
        } else if ((key.startsWith("STOCH") || "STOCH_K".equals(key) || "STOCH_D".equals(key)) && !result.containsKey("STOCH_K")) {
            calculateIndicator("STOCHASTIC", Map.of(), closes, highs, lows, volumes, result);
        } else if ("ATR".equals(key) && !result.containsKey("ATR")) {
            calculateIndicator("ATR", Map.of(), closes, highs, lows, volumes, result);
        } else if ("OBV".equals(key) && !result.containsKey("OBV")) {
            calculateIndicator("OBV", Map.of(), closes, highs, lows, volumes, result);
        } else if ("WILLIAMS_R".equals(key) && !result.containsKey("WILLIAMS_R")) {
            calculateIndicator("WILLIAMS_R", Map.of(), closes, highs, lows, volumes, result);
        } else if ("CCI".equals(key) && !result.containsKey("CCI")) {
            calculateIndicator("CCI", Map.of(), closes, highs, lows, volumes, result);
        }
    }

    // ── 시뮬레이션 ─────────────────────────────────────────────────────────

    private BacktestResponse simulate(String strategyId, String strategyName,
                                       List<Condition> entryConditions, List<Condition> exitConditions,
                                       List<CandlestickResponse> candles,
                                       Map<String, double[]> indicatorValues,
                                       int globalOffset, BacktestRequest request, String assetType) {

        double initialCapital = request.getInitialCapital();
        double cash = initialCapital;
        double position = 0;
        double entryPrice = 0;
        double entryCost = 0; // 매수 시 실제 지출 금액 (수수료 포함)
        int entryDayIndex = 0;
        double peakEquity = initialCapital;
        double highSinceEntry = 0; // 트레일링 스탑용: 진입 이후 최고가

        // 리스크 파라미터 (null-safe)
        double stopLoss = request.getStopLossPercent() != null ? request.getStopLossPercent() : 0;
        double takeProfit = request.getTakeProfitPercent() != null ? request.getTakeProfitPercent() : 0;
        double trailingStop = request.getTrailingStopPercent() != null ? request.getTrailingStopPercent() : 0;
        double slippage = request.getSlippagePercent() != null ? request.getSlippagePercent() / 100.0 : 0;
        String positionSizing = request.getPositionSizing() != null ? request.getPositionSizing() : "ALL_IN";
        double positionValue = request.getPositionValue() != null ? request.getPositionValue() : 0;
        double commissionRate = request.getCommissionRate() != null ? request.getCommissionRate() / 100.0 : DEFAULT_COMMISSION_RATE;

        List<BacktestResponse.TradeDto> trades = new ArrayList<>();
        List<BacktestResponse.EquityPointDto> equityCurve = new ArrayList<>();
        List<BacktestResponse.EquityPointDto> drawdownCurve = new ArrayList<>();
        List<BacktestResponse.DailyReturnDto> dailyReturns = new ArrayList<>();
        List<BacktestResponse.PricePointDto> priceData = new ArrayList<>();

        double prevEquity = initialCapital;
        double maxDrawdown = 0;
        int profitableTrades = 0;
        int losingTrades = 0;
        List<Double> winAmounts = new ArrayList<>();
        List<Double> lossAmounts = new ArrayList<>();
        List<Double> winRates = new ArrayList<>();
        List<Double> lossRates = new ArrayList<>();
        List<Integer> holdingDaysList = new ArrayList<>();

        // 연승/연패 계산용
        int currentStreak = 0;
        int maxWinStreak = 0;
        int maxLossStreak = 0;

        // 최대 낙폭 지속 기간
        int drawdownStart = -1;
        int maxDrawdownDuration = 0;

        for (int i = 0; i < candles.size(); i++) {
            CandlestickResponse candle = candles.get(i);
            int gi = globalOffset + i;
            double price = candle.getClose();
            String date = Instant.ofEpochSecond(candle.getTime())
                    .atZone(KST).toLocalDate().format(DATE_FMT);

            // 가격 데이터 기록
            priceData.add(BacktestResponse.PricePointDto.builder()
                    .date(date)
                    .open(candle.getOpen())
                    .high(candle.getHigh())
                    .low(candle.getLow())
                    .close(candle.getClose())
                    .volume(candle.getVolume())
                    .build());

            double equity = cash + position * price;

            // ── 트레일링 스탑: 고점 추적 ──
            boolean trailingStopHit = false;
            if (position > 0) {
                if (price > highSinceEntry) highSinceEntry = price;
                if (trailingStop > 0 && highSinceEntry > 0) {
                    double dropFromHigh = (highSinceEntry - price) / highSinceEntry * 100;
                    if (dropFromHigh >= trailingStop) trailingStopHit = true;
                }
            }

            // ── 손절/익절 체크 (조건 평가보다 우선) ──
            boolean stopLossHit = false;
            boolean takeProfitHit = false;
            if (position > 0 && entryPrice > 0) {
                double unrealizedPct = (price - entryPrice) / entryPrice * 100;
                if (stopLoss > 0 && unrealizedPct <= -stopLoss) stopLossHit = true;
                if (takeProfit > 0 && unrealizedPct >= takeProfit) takeProfitHit = true;
            }

            // ── 진입/청산 조건 평가 ──
            boolean riskExit = stopLossHit || takeProfitHit || trailingStopHit;
            boolean entrySignal = position == 0 && !riskExit
                    && evaluateConditions(entryConditions, indicatorValues, gi, price);
            boolean exitSignal = position > 0 && !riskExit
                    && evaluateConditions(exitConditions, indicatorValues, gi, price);

            // ── 매매 실행 ──
            if (riskExit) {
                // 손절/익절 실행
                double execPrice = price * (1 - slippage); // 슬리피지 (매도)
                double sellProceeds = position * execPrice * (1 - commissionRate);
                double pnl = sellProceeds - entryCost; // 매수 수수료 포함 순손익
                double pnlPct = entryCost > 0 ? (sellProceeds - entryCost) / entryCost * 100 : 0;
                int holdDays = i - entryDayIndex;
                cash += sellProceeds;

                String reason = stopLossHit
                        ? String.format("손절 (%.1f%%)", -stopLoss)
                        : trailingStopHit
                        ? String.format("트레일링 스탑 (고점 대비 -%.1f%%)", trailingStop)
                        : String.format("익절 (+%.1f%%)", takeProfit);

                recordSell(trades, date, execPrice, position, pnl, pnlPct, reason, holdDays, cash);
                if (pnl > 0) {
                    profitableTrades++;
                    winAmounts.add(pnl);
                    winRates.add(pnlPct);
                    currentStreak = currentStreak >= 0 ? currentStreak + 1 : 1;
                } else {
                    losingTrades++;
                    lossAmounts.add(Math.abs(pnl));
                    lossRates.add(Math.abs(pnlPct));
                    currentStreak = currentStreak <= 0 ? currentStreak - 1 : -1;
                }
                holdingDaysList.add(holdDays);
                if (currentStreak > maxWinStreak) maxWinStreak = currentStreak;
                if (-currentStreak > maxLossStreak) maxLossStreak = -currentStreak;

                position = 0;
                entryPrice = 0;
                highSinceEntry = 0;
            } else if (entrySignal && price > 0) {
                // 매수: 포지션 사이징 적용
                double allocAmount = calculateAllocation(cash, positionSizing, positionValue);
                double execPrice = price * (1 + slippage); // 슬리피지 (매수)
                double buyAmount = allocAmount * (1 - commissionRate);
                position = buyAmount / execPrice;
                double commission = allocAmount * commissionRate;
                cash -= allocAmount;
                entryPrice = execPrice;
                entryCost = allocAmount; // 매수 총비용 (수수료 포함)
                entryDayIndex = i;
                highSinceEntry = price; // 트레일링 스탑 초기화

                trades.add(BacktestResponse.TradeDto.builder()
                        .date(date).type("BUY").price(execPrice)
                        .quantity(position).pnl(-commission).pnlPercent(0)
                        .reason("진입 조건 충족").holdingDays(0)
                        .balance(Math.round(cash + position * price))
                        .build());
            } else if (exitSignal) {
                double execPrice = price * (1 - slippage);
                double sellProceeds = position * execPrice * (1 - commissionRate);
                double pnl = sellProceeds - entryCost; // 매수 수수료 포함 순손익
                double pnlPct = entryCost > 0 ? (sellProceeds - entryCost) / entryCost * 100 : 0;
                int holdDays = i - entryDayIndex;
                cash += sellProceeds;

                recordSell(trades, date, execPrice, position, pnl, pnlPct, "청산 조건 충족", holdDays, cash);
                if (pnl > 0) {
                    profitableTrades++;
                    winAmounts.add(pnl);
                    winRates.add(pnlPct);
                    currentStreak = currentStreak >= 0 ? currentStreak + 1 : 1;
                } else {
                    losingTrades++;
                    lossAmounts.add(Math.abs(pnl));
                    lossRates.add(Math.abs(pnlPct));
                    currentStreak = currentStreak <= 0 ? currentStreak - 1 : -1;
                }
                holdingDaysList.add(holdDays);
                if (currentStreak > maxWinStreak) maxWinStreak = currentStreak;
                if (-currentStreak > maxLossStreak) maxLossStreak = -currentStreak;

                position = 0;
                entryPrice = 0;
                highSinceEntry = 0;
            }

            // 자산가치 재계산
            equity = cash + position * price;

            // 최대 낙폭 & 지속기간
            if (equity >= peakEquity) {
                peakEquity = equity;
                if (drawdownStart >= 0) {
                    int duration = i - drawdownStart;
                    if (duration > maxDrawdownDuration) maxDrawdownDuration = duration;
                }
                drawdownStart = -1;
            } else if (drawdownStart < 0) {
                drawdownStart = i;
            }
            double drawdown = peakEquity > 0 ? (peakEquity - equity) / peakEquity * 100 : 0;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;

            // 드로다운 커브
            drawdownCurve.add(BacktestResponse.EquityPointDto.builder()
                    .date(date).value(Math.round(-drawdown * 100.0) / 100.0).build());

            double dailyReturn = prevEquity > 0 ? (equity - prevEquity) / prevEquity * 100 : 0;
            double cumulativeReturn = (equity - initialCapital) / initialCapital * 100;

            equityCurve.add(BacktestResponse.EquityPointDto.builder()
                    .date(date).value(equity).build());
            dailyReturns.add(BacktestResponse.DailyReturnDto.builder()
                    .date(date).dailyReturn(dailyReturn)
                    .cumulativeReturn(cumulativeReturn)
                    .portfolioValue(equity).build());

            prevEquity = equity;
        }

        // 마지막 낙폭 지속기간 처리
        if (drawdownStart >= 0) {
            int duration = candles.size() - 1 - drawdownStart;
            if (duration > maxDrawdownDuration) maxDrawdownDuration = duration;
        }

        // 강제 청산
        if (position > 0 && !candles.isEmpty()) {
            double lastPrice = candles.get(candles.size() - 1).getClose();
            double execPrice = lastPrice * (1 - slippage);
            double sellProceeds = position * execPrice * (1 - commissionRate);
            double pnl = sellProceeds - entryCost; // 매수 수수료 포함 순손익
            double pnlPct = entryCost > 0 ? (sellProceeds - entryCost) / entryCost * 100 : 0;
            int holdDays = candles.size() - 1 - entryDayIndex;
            cash += sellProceeds;

            String lastDate = Instant.ofEpochSecond(candles.get(candles.size() - 1).getTime())
                    .atZone(KST).toLocalDate().format(DATE_FMT);

            recordSell(trades, lastDate, execPrice, position, pnl, pnlPct,
                    "백테스트 종료 (강제 청산)", holdDays, cash);
            if (pnl > 0) {
                profitableTrades++; winAmounts.add(pnl); winRates.add(pnlPct);
                currentStreak = currentStreak >= 0 ? currentStreak + 1 : 1;
            } else {
                losingTrades++; lossAmounts.add(Math.abs(pnl)); lossRates.add(Math.abs(pnlPct));
                currentStreak = currentStreak <= 0 ? currentStreak - 1 : -1;
            }
            holdingDaysList.add(holdDays);
            if (currentStreak > maxWinStreak) maxWinStreak = currentStreak;
            if (-currentStreak > maxLossStreak) maxLossStreak = -currentStreak;

            position = 0;

            // 마지막 equity/daily 갱신
            double finalEquity = cash;
            double dailyReturn = prevEquity > 0 ? (finalEquity - prevEquity) / prevEquity * 100 : 0;
            double cumulativeReturn = (finalEquity - initialCapital) / initialCapital * 100;
            if (!equityCurve.isEmpty()) {
                equityCurve.set(equityCurve.size() - 1,
                        BacktestResponse.EquityPointDto.builder().date(lastDate).value(finalEquity).build());
            }
            if (!dailyReturns.isEmpty()) {
                dailyReturns.set(dailyReturns.size() - 1,
                        BacktestResponse.DailyReturnDto.builder()
                                .date(lastDate).dailyReturn(dailyReturn)
                                .cumulativeReturn(cumulativeReturn)
                                .portfolioValue(finalEquity).build());
            }
        }

        // ── 최종 지표 계산 ──
        double finalValue = cash;
        double totalReturn = finalValue - initialCapital;
        double totalReturnRate = (totalReturn / initialCapital) * 100;
        int totalTrades = profitableTrades + losingTrades;
        double winRate = totalTrades > 0 ? (double) profitableTrades / totalTrades * 100 : 0;

        double sharpeRatio = calculateSharpeRatio(dailyReturns, assetType);
        double sortinoRatio = calculateSortinoRatio(dailyReturns, assetType);

        // Profit Factor
        double totalWinAmount = winAmounts.stream().mapToDouble(Double::doubleValue).sum();
        double totalLossAmount = lossAmounts.stream().mapToDouble(Double::doubleValue).sum();
        double profitFactor = totalLossAmount > 0 ? totalWinAmount / totalLossAmount : totalWinAmount > 0 ? Double.MAX_VALUE : 0;

        // 평균 이익/손실
        double avgWin = winAmounts.isEmpty() ? 0 : winAmounts.stream().mapToDouble(Double::doubleValue).average().orElse(0);
        double avgLoss = lossAmounts.isEmpty() ? 0 : lossAmounts.stream().mapToDouble(Double::doubleValue).average().orElse(0);
        double avgWinRate = winRates.isEmpty() ? 0 : winRates.stream().mapToDouble(Double::doubleValue).average().orElse(0);
        double avgLossRate = lossRates.isEmpty() ? 0 : lossRates.stream().mapToDouble(Double::doubleValue).average().orElse(0);

        // 평균 보유기간
        double avgHoldingDays = holdingDaysList.isEmpty() ? 0 : holdingDaysList.stream().mapToInt(Integer::intValue).average().orElse(0);

        // Payoff Ratio (RR 비율)
        double payoffRatio = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Double.MAX_VALUE : 0;

        // CAGR (실제 달력 일수 기반)
        LocalDate actualStart = LocalDate.parse(request.getStartDate());
        LocalDate actualEnd = LocalDate.parse(request.getEndDate());
        long calendarDays = java.time.temporal.ChronoUnit.DAYS.between(actualStart, actualEnd);
        double years = Math.max(calendarDays, 1) / 365.0;
        double cagrRatio = finalValue / initialCapital;
        double cagr = years > 0.01 && cagrRatio > 0
                ? (Math.pow(cagrRatio, 1.0 / years) - 1) * 100
                : totalReturnRate;

        // Recovery Factor
        double recoveryFactor = maxDrawdown > 0 ? totalReturnRate / maxDrawdown : 0;

        // Buy & Hold 벤치마크
        double firstPrice = candles.get(0).getClose();
        double buyHoldQuantity = (initialCapital * (1 - commissionRate)) / firstPrice;
        List<BacktestResponse.EquityPointDto> buyHoldCurve = new ArrayList<>();
        for (CandlestickResponse c : candles) {
            String d = Instant.ofEpochSecond(c.getTime()).atZone(KST).toLocalDate().format(DATE_FMT);
            buyHoldCurve.add(BacktestResponse.EquityPointDto.builder()
                    .date(d).value(Math.round(buyHoldQuantity * c.getClose())).build());
        }
        double buyHoldFinal = buyHoldQuantity * candles.get(candles.size() - 1).getClose();
        double buyHoldReturnRate = (buyHoldFinal - initialCapital) / initialCapital * 100;

        return BacktestResponse.builder()
                .id("backtest-" + UUID.randomUUID().toString().substring(0, 8))
                .strategyId(strategyId)
                .strategyName(strategyName)
                .stockCode(request.getStockCode())
                .stockName(request.getStockName() != null && !request.getStockName().isEmpty()
                        ? request.getStockName() : request.getStockCode())
                .startDate(request.getStartDate())
                .endDate(request.getEndDate())
                .initialCapital(initialCapital)
                .finalValue(Math.round(finalValue))
                .totalReturn(Math.round(totalReturn))
                .totalReturnRate(round2(totalReturnRate))
                .maxDrawdown(round2(-maxDrawdown))
                .sharpeRatio(round2(sharpeRatio))
                .winRate(round2(winRate))
                .totalTrades(totalTrades)
                .profitableTrades(profitableTrades)
                .losingTrades(losingTrades)
                .dailyReturns(dailyReturns)
                .equityCurve(equityCurve)
                .trades(trades)
                .buyHoldReturnRate(round2(buyHoldReturnRate))
                .buyHoldCurve(buyHoldCurve)
                // 고급 지표
                .profitFactor(round2(Math.min(profitFactor, 9999)))
                .sortinoRatio(round2(sortinoRatio))
                .cagr(round2(cagr))
                .avgWin(Math.round(avgWin))
                .avgLoss(Math.round(avgLoss))
                .avgWinRate(round2(avgWinRate))
                .avgLossRate(round2(avgLossRate))
                .maxConsecutiveWins(maxWinStreak)
                .maxConsecutiveLosses(maxLossStreak)
                .avgHoldingDays(round2(avgHoldingDays))
                .maxDrawdownDuration(maxDrawdownDuration)
                .recoveryFactor(round2(recoveryFactor))
                .payoffRatio(round2(Math.min(payoffRatio, 9999)))
                // 차트 데이터
                .drawdownCurve(drawdownCurve)
                .priceData(priceData)
                .build();
    }

    // ── 매도 기록 ──
    private void recordSell(List<BacktestResponse.TradeDto> trades, String date,
                             double price, double quantity, double pnl, double pnlPct,
                             String reason, int holdDays, double balance) {
        trades.add(BacktestResponse.TradeDto.builder()
                .date(date).type("SELL").price(price)
                .quantity(quantity).pnl(pnl).pnlPercent(round2(pnlPct))
                .reason(reason).holdingDays(holdDays)
                .balance(Math.round(balance))
                .build());
    }

    // ── 포지션 사이징 ──
    private double calculateAllocation(double cash, String sizingType, double value) {
        return switch (sizingType) {
            case "FIXED_AMOUNT" -> Math.min(value, cash);
            case "PERCENT" -> cash * Math.min(value, 100) / 100.0;
            default -> cash; // ALL_IN
        };
    }

    // ── 조건 평가 ──
    private boolean evaluateConditions(List<Condition> conditions,
                                        Map<String, double[]> indicatorValues,
                                        int index, double currentPrice) {
        if (conditions == null || conditions.isEmpty()) return false;

        Boolean accumulated = null;
        for (Condition cond : conditions) {
            String indicatorName = cond.getIndicator();
            if (indicatorName == null) continue;

            // CROSSOVER / CROSSUNDER 지원: "MACD_CROSS_SIGNAL" → MACD가 SIGNAL을 상향돌파
            if (indicatorName.contains("_CROSS_") || indicatorName.contains("_CROSSUNDER_")) {
                boolean crossResult = evaluateCrossover(indicatorName, indicatorValues, index);
                if (accumulated == null) accumulated = crossResult;
                else accumulated = cond.getLogic() == Condition.Logic.AND ? accumulated && crossResult : accumulated || crossResult;
                continue;
            }

            double indicatorValue = getIndicatorValue(indicatorName, indicatorValues, index, currentPrice);
            if (Double.isNaN(indicatorValue)) {
                // NaN이면 조건 불충족으로 처리 (AND: false 전파, OR: 무시)
                boolean nanResult = false;
                if (accumulated == null) accumulated = nanResult;
                else accumulated = cond.getLogic() == Condition.Logic.AND ? false : accumulated;
                continue;
            }

            double targetValue = cond.getValue().doubleValue();
            boolean matches = switch (cond.getOperator()) {
                case GT -> indicatorValue > targetValue;
                case LT -> indicatorValue < targetValue;
                case GTE -> indicatorValue >= targetValue;
                case LTE -> indicatorValue <= targetValue;
                case EQ -> Math.abs(indicatorValue - targetValue) < 0.0001;
            };

            if (accumulated == null) accumulated = matches;
            else accumulated = cond.getLogic() == Condition.Logic.AND ? accumulated && matches : accumulated || matches;
        }

        return accumulated != null && accumulated;
    }

    /**
     * CROSSOVER 평가: "A_CROSS_B" → 전봉에서 A<B 이고 현재봉에서 A>B (골든크로스)
     * "A_CROSSUNDER_B" → 전봉에서 A>B 이고 현재봉에서 A<B (데드크로스)
     */
    private boolean evaluateCrossover(String crossKey, Map<String, double[]> indicatorValues, int index) {
        if (index < 1) return false;

        boolean isUnder = crossKey.contains("_CROSSUNDER_");
        String[] parts = isUnder
                ? crossKey.split("_CROSSUNDER_", 2)
                : crossKey.split("_CROSS_", 2);
        if (parts.length != 2) return false;

        double[] valuesA = indicatorValues.get(parts[0]);
        double[] valuesB = indicatorValues.get(parts[1]);
        if (valuesA == null || valuesB == null) return false;
        if (index >= valuesA.length || index >= valuesB.length) return false;

        double prevA = valuesA[index - 1], prevB = valuesB[index - 1];
        double currA = valuesA[index], currB = valuesB[index];
        if (Double.isNaN(prevA) || Double.isNaN(prevB) || Double.isNaN(currA) || Double.isNaN(currB)) return false;

        if (isUnder) return prevA >= prevB && currA < currB;
        else return prevA <= prevB && currA > currB;
    }

    // ── 지표값 조회 ──
    private double getIndicatorValue(String indicator, Map<String, double[]> indicatorValues,
                                      int index, double currentPrice) {
        if (indicator == null) return Double.NaN;
        String key = indicator.toUpperCase().trim();

        if ("PRICE".equals(key) || "CLOSE".equals(key)) return currentPrice;

        String mappedKey = switch (key) {
            case "RSI" -> "RSI";
            case "MACD" -> "MACD";
            case "MACD_SIGNAL", "SIGNAL" -> "MACD_SIGNAL";
            case "MACD_HISTOGRAM", "HISTOGRAM" -> "MACD_HISTOGRAM";
            case "MA", "SMA" -> "MA";
            case "EMA" -> "EMA";
            case "BOLLINGER_UPPER", "BB_UPPER" -> "BOLLINGER_UPPER";
            case "BOLLINGER_MIDDLE", "BB_MIDDLE" -> "BOLLINGER_MIDDLE";
            case "BOLLINGER_LOWER", "BB_LOWER" -> "BOLLINGER_LOWER";
            case "BOLLINGER_PCT_B", "BB_PCT_B", "PCT_B" -> "BOLLINGER_PCT_B";
            case "STOCH_K", "STOCHASTIC_K" -> "STOCH_K";
            case "STOCH_D", "STOCHASTIC_D" -> "STOCH_D";
            case "ATR" -> "ATR";
            case "OBV" -> "OBV";
            case "WILLIAMS_R" -> "WILLIAMS_R";
            case "CCI" -> "CCI";
            default -> key;
        };

        double[] values = indicatorValues.get(mappedKey);
        if (values == null || index < 0 || index >= values.length) return Double.NaN;
        return values[index];
    }

    // ── 샤프 비율 ──
    private double calculateSharpeRatio(List<BacktestResponse.DailyReturnDto> dailyReturns, String assetType) {
        if (dailyReturns.size() < 2) return 0;
        double[] returns = dailyReturns.stream().mapToDouble(d -> d.getDailyReturn() / 100.0).toArray();
        double mean = Arrays.stream(returns).average().orElse(0);
        double variance = Arrays.stream(returns).map(r -> (r - mean) * (r - mean)).average().orElse(0);
        double stdDev = Math.sqrt(variance);
        if (stdDev == 0) return 0;
        double factor = "STOCK".equalsIgnoreCase(assetType) ? Math.sqrt(252) : Math.sqrt(365);
        return (mean / stdDev) * factor;
    }

    // ── 소르티노 비율 (하방 편차만 사용) ──
    private double calculateSortinoRatio(List<BacktestResponse.DailyReturnDto> dailyReturns, String assetType) {
        if (dailyReturns.size() < 2) return 0;
        double[] returns = dailyReturns.stream().mapToDouble(d -> d.getDailyReturn() / 100.0).toArray();
        double mean = Arrays.stream(returns).average().orElse(0);

        // 하방 편차: 전체 수익률에 min(r, 0)^2 적용 (표준 Sortino 공식)
        double downVariance = Arrays.stream(returns)
                .map(r -> r < 0 ? r * r : 0)
                .average().orElse(0);
        double downDev = Math.sqrt(downVariance);
        if (downDev == 0) return 0;

        double factor = "STOCK".equalsIgnoreCase(assetType) ? Math.sqrt(252) : Math.sqrt(365);
        return (mean / downDev) * factor;
    }

    private int getParam(Map<String, Number> params, String key, int defaultValue) {
        Number val = params.get(key);
        return val != null ? val.intValue() : defaultValue;
    }

    private double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
