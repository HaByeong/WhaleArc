package com.project.whalearc.strategy.service;

import com.project.whalearc.market.dto.CandlestickResponse;
import com.project.whalearc.market.service.BacktestDataProvider;
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
    private final BacktestDataProvider backtestDataProvider;

    private static final double DEFAULT_COMMISSION_RATE = 0.001; // 0.1%
    private static final ZoneOffset KST = ZoneOffset.of("+09:00");
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    public BacktestResponse runBacktest(BacktestRequest request, String userId) {
        validateRequest(request);

        // 전략 or 직접 조건 분기
        String strategyName;
        String strategyId;
        List<Indicator> indicators;
        List<Condition> entryConditions;
        List<Condition> exitConditions;

        if (request.getStrategyId() != null && !request.getStrategyId().isEmpty()) {
            Strategy strategy = strategyRepository.findById(request.getStrategyId())
                    .orElseThrow(() -> new IllegalArgumentException("전략을 찾을 수 없습니다."));
            // 소유권 검증: 본인 전략만 백테스트 가능
            if (!strategy.getUserId().equals(userId)) {
                throw new IllegalArgumentException("해당 전략에 대한 권한이 없습니다.");
            }
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

        // 캔들스틱 데이터 조회 (Yahoo Finance / Binance 우선, 실패 시 기존 소스 폴백)
        List<CandlestickResponse> allCandles = backtestDataProvider.getBacktestCandles(
                request.getStockCode(), assetType, request.getStartDate(), request.getEndDate());

        if (allCandles == null || allCandles.isEmpty()) {
            log.info("백테스트 데이터 폴백: 기존 CandlestickService 사용 ({})", request.getStockCode());
            String interval = "STOCK".equals(assetType) ? "1d" : "24h";
            allCandles = candlestickService.getCandlesticks(
                    request.getStockCode(), interval, assetType);
        }

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

    // ── 입력 검증 ─────────────────────────────────────────────────────────

    private void validateRequest(BacktestRequest request) {
        if (request.getInitialCapital() <= 0) {
            throw new IllegalArgumentException("초기 자본금은 0보다 커야 합니다.");
        }
        if (request.getInitialCapital() > 100_000_000_000L) {
            throw new IllegalArgumentException("초기 자본금은 1,000억원 이하로 설정해주세요.");
        }
        if (request.getStockCode() == null || request.getStockCode().isBlank()) {
            throw new IllegalArgumentException("종목 코드를 입력해주세요.");
        }
        if (request.getStartDate() == null || request.getEndDate() == null) {
            throw new IllegalArgumentException("시작일과 종료일을 입력해주세요.");
        }

        LocalDate start, end;
        try {
            start = LocalDate.parse(request.getStartDate());
            end = LocalDate.parse(request.getEndDate());
        } catch (Exception e) {
            throw new IllegalArgumentException("날짜 형식이 올바르지 않습니다. (yyyy-MM-dd)");
        }

        if (start.isAfter(end)) {
            throw new IllegalArgumentException("시작일이 종료일보다 늦을 수 없습니다.");
        }
        if (end.isAfter(LocalDate.now())) {
            throw new IllegalArgumentException("종료일은 오늘 이후로 설정할 수 없습니다.");
        }
        if (start.isBefore(LocalDate.of(2000, 1, 1))) {
            throw new IllegalArgumentException("시작일은 2000년 이후로 설정해주세요.");
        }

        // 리스크 파라미터 범위 검증
        if (request.getStopLossPercent() != null && (request.getStopLossPercent() <= 0 || request.getStopLossPercent() > 100)) {
            throw new IllegalArgumentException("손절 비율은 0~100% 사이로 설정해주세요.");
        }
        if (request.getTakeProfitPercent() != null && (request.getTakeProfitPercent() <= 0 || request.getTakeProfitPercent() > 1000)) {
            throw new IllegalArgumentException("익절 비율은 0~1000% 사이로 설정해주세요.");
        }
        if (request.getSlippagePercent() != null && (request.getSlippagePercent() < 0 || request.getSlippagePercent() > 10)) {
            throw new IllegalArgumentException("슬리피지는 0~10% 사이로 설정해주세요.");
        }
        if (request.getCommissionRate() != null && (request.getCommissionRate() < 0 || request.getCommissionRate() > 10)) {
            throw new IllegalArgumentException("수수료율은 0~10% 사이로 설정해주세요.");
        }
        if (request.getMaxPositions() != null && (request.getMaxPositions() < 1 || request.getMaxPositions() > 20)) {
            throw new IllegalArgumentException("최대 포지션 수는 1~20 사이로 설정해주세요.");
        }
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
                double[] sma = IndicatorCalculator.sma(closes, period);
                result.put("MA", sma);            // 기본 키 (마지막 계산 값)
                result.put("MA_" + period, sma);   // 기간별 키 (다중 기간 지원)
            }
            case "EMA" -> {
                int period = getParam(params, "period", 20);
                double[] ema = IndicatorCalculator.ema(closes, period);
                result.put("EMA", ema);            // 기본 키
                result.put("EMA_" + period, ema);  // 기간별 키
            }
            case "BOLLINGER_BANDS" -> {
                int period = getParam(params, "period", 20);
                double stdDev = params.getOrDefault("stdDev", 2.0).doubleValue();
                var bb = IndicatorCalculator.bollingerBands(closes, period, stdDev);
                result.put("BOLLINGER_UPPER", bb.getUpper());
                result.put("BOLLINGER_MIDDLE", bb.getMiddle());
                result.put("BOLLINGER_LOWER", bb.getLower());

                double[] pctB = new double[closes.length];
                Arrays.fill(pctB, Double.NaN);
                for (int j = 0; j < closes.length; j++) {
                    if (Double.isNaN(bb.getUpper()[j]) || Double.isNaN(bb.getLower()[j])) continue;
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
        // 이미 해당 키가 존재하면 스킵
        if (result.containsKey(key)) return;

        if ("RSI".equals(key) && !result.containsKey("RSI")) {
            calculateIndicator("RSI", Map.of(), closes, highs, lows, volumes, result);
        } else if (key.startsWith("MACD") && !result.containsKey("MACD")) {
            calculateIndicator("MACD", Map.of(), closes, highs, lows, volumes, result);
        } else if (("MA".equals(key) || "SMA".equals(key)) && !result.containsKey("MA")) {
            calculateIndicator("MA", Map.of(), closes, highs, lows, volumes, result);
        } else if (key.startsWith("MA_") && key.matches("MA_\\d+")) {
            // MA_20, MA_50 등 기간별 키 → 해당 기간으로 계산
            int period = Integer.parseInt(key.substring(3));
            calculateIndicator("MA", Map.of("period", (Number) period), closes, highs, lows, volumes, result);
        } else if ("EMA".equals(key) && !result.containsKey("EMA")) {
            calculateIndicator("EMA", Map.of(), closes, highs, lows, volumes, result);
        } else if (key.startsWith("EMA_") && key.matches("EMA_\\d+")) {
            // EMA_12, EMA_26 등 기간별 키
            int period = Integer.parseInt(key.substring(4));
            calculateIndicator("EMA", Map.of("period", (Number) period), closes, highs, lows, volumes, result);
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

    // ── 포지션 엔트리 ──
    private record PosEntry(double execPrice, double quantity, double cost, int dayIndex) {}

    // ── 시뮬레이션 ─────────────────────────────────────────────────────────

    private BacktestResponse simulate(String strategyId, String strategyName,
                                       List<Condition> entryConditions, List<Condition> exitConditions,
                                       List<CandlestickResponse> candles,
                                       Map<String, double[]> indicatorValues,
                                       int globalOffset, BacktestRequest request, String assetType) {

        double initialCapital = request.getInitialCapital();
        double cash = initialCapital;
        double peakEquity = initialCapital;

        // 다중 포지션 추적 (signed: long=양수, short=음수)
        List<PosEntry> posEntries = new ArrayList<>();
        String currentDir = "NONE"; // LONG, SHORT, NONE
        double highSinceEntry = 0;           // 롱 트레일링 스탑: 진입 후 최고가
        double lowSinceEntry = Double.MAX_VALUE; // 숏 트레일링 스탑: 진입 후 최저가
        int firstEntryDayIndex = 0;

        // 매매 방향 & 다중 포지션
        String tradeDir = request.getTradeDirection() != null ? request.getTradeDirection() : "LONG_ONLY";
        int maxPos = request.getMaxPositions() != null ? Math.max(request.getMaxPositions(), 1) : 1;

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

        int currentStreak = 0;
        int maxWinStreak = 0;
        int maxLossStreak = 0;
        int drawdownStart = -1;
        int maxDrawdownDuration = 0;

        for (int i = 0; i < candles.size(); i++) {
            CandlestickResponse candle = candles.get(i);
            int gi = globalOffset + i;
            double price = candle.getClose();
            String date = Instant.ofEpochSecond(candle.getTime())
                    .atZone(KST).toLocalDate().format(DATE_FMT);

            priceData.add(BacktestResponse.PricePointDto.builder()
                    .date(date).open(candle.getOpen()).high(candle.getHigh())
                    .low(candle.getLow()).close(candle.getClose()).volume(candle.getVolume())
                    .build());

            double totalQty = posEntries.stream().mapToDouble(PosEntry::quantity).sum();
            double totalCost = posEntries.stream().mapToDouble(PosEntry::cost).sum();
            boolean hasPosition = !posEntries.isEmpty();

            // ── 자산 가치 계산 ──
            // LONG: cash + qty * price, SHORT: cash - qty * price + shortEntryValue
            double equity;
            if ("LONG".equals(currentDir)) {
                equity = cash + totalQty * price;
            } else if ("SHORT".equals(currentDir)) {
                double shortEntryValue = posEntries.stream()
                        .mapToDouble(e -> e.quantity * e.execPrice).sum();
                equity = cash - totalQty * price + shortEntryValue;
            } else {
                equity = cash;
            }

            // ── 가중 평균 진입가 ──
            double avgPrice = hasPosition
                    ? posEntries.stream().mapToDouble(e -> e.execPrice * e.quantity).sum() / totalQty
                    : 0;

            // ── 트레일링 스탑 ──
            boolean trailingStopHit = false;
            if (hasPosition && "LONG".equals(currentDir)) {
                if (price > highSinceEntry) highSinceEntry = price;
                if (trailingStop > 0 && highSinceEntry > 0) {
                    double drop = (highSinceEntry - price) / highSinceEntry * 100;
                    if (drop >= trailingStop) trailingStopHit = true;
                }
            } else if (hasPosition && "SHORT".equals(currentDir)) {
                if (price < lowSinceEntry) lowSinceEntry = price;
                if (trailingStop > 0 && lowSinceEntry > 0 && lowSinceEntry < Double.MAX_VALUE) {
                    double rise = (price - lowSinceEntry) / lowSinceEntry * 100;
                    if (rise >= trailingStop) trailingStopHit = true;
                }
            }

            // ── 손절/익절 ──
            boolean stopLossHit = false;
            boolean takeProfitHit = false;
            if (hasPosition && avgPrice > 0) {
                double unrealizedPct = "LONG".equals(currentDir)
                        ? (price - avgPrice) / avgPrice * 100
                        : (avgPrice - price) / avgPrice * 100; // SHORT: 가격 하락 = 이익
                if (stopLoss > 0 && unrealizedPct <= -stopLoss) stopLossHit = true;
                if (takeProfit > 0 && unrealizedPct >= takeProfit) takeProfitHit = true;
            }

            // ── 조건 평가 ──
            boolean riskExit = hasPosition && (stopLossHit || takeProfitHit || trailingStopHit);
            boolean canAddPosition = !hasPosition || posEntries.size() < maxPos;
            boolean entrySignal = !riskExit && canAddPosition
                    && evaluateConditions(entryConditions, indicatorValues, gi, price);
            boolean exitSignal = hasPosition && !riskExit
                    && evaluateConditions(exitConditions, indicatorValues, gi, price);

            // ── 매매 실행 ──

            // 1) 리스크 청산
            if (riskExit) {
                String reason = stopLossHit
                        ? String.format("손절 (%.1f%%)", -stopLoss)
                        : trailingStopHit
                        ? String.format("트레일링 스탑 (-%.1f%%)", trailingStop)
                        : String.format("익절 (+%.1f%%)", takeProfit);
                int[] streaks = {currentStreak, maxWinStreak, maxLossStreak};
                int[] tradeCounts = {profitableTrades, losingTrades};
                cash = executeCloseAll(trades, posEntries, currentDir, price, slippage, commissionRate,
                        date, i, reason, cash,
                        winAmounts, lossAmounts, winRates, lossRates, holdingDaysList,
                        streaks, tradeCounts);
                currentStreak = streaks[0]; maxWinStreak = streaks[1]; maxLossStreak = streaks[2];
                profitableTrades = tradeCounts[0]; losingTrades = tradeCounts[1];
                posEntries.clear();
                currentDir = "NONE";
                highSinceEntry = 0;
                lowSinceEntry = Double.MAX_VALUE;

            // 2) 진입 신호
            } else if (entrySignal && price > 0) {
                if ("SHORT_ONLY".equals(tradeDir)) {
                    // SHORT_ONLY: 진입 = 숏 오픈
                    if (!hasPosition || ("SHORT".equals(currentDir) && posEntries.size() < maxPos)) {
                        cash = openPosition(trades, posEntries, "SHORT", price, slippage, commissionRate,
                                positionSizing, positionValue, cash, date, i);
                        if (posEntries.size() == 1) {
                            currentDir = "SHORT";
                            lowSinceEntry = price;
                            firstEntryDayIndex = i;
                        }
                    }
                } else {
                    // LONG_ONLY / LONG_SHORT: 진입 = 롱 오픈
                    if ("SHORT".equals(currentDir) && "LONG_SHORT".equals(tradeDir)) {
                        // 숏 포지션 청산 후 롱 전환
                        int[] streaks = {currentStreak, maxWinStreak, maxLossStreak};
                        int[] tradeCounts = {profitableTrades, losingTrades};
                        cash = executeCloseAll(trades, posEntries, currentDir, price, slippage, commissionRate,
                                date, i, "방향 전환 (숏→롱)", cash,
                                winAmounts, lossAmounts, winRates, lossRates, holdingDaysList,
                                streaks, tradeCounts);
                        currentStreak = streaks[0]; maxWinStreak = streaks[1]; maxLossStreak = streaks[2];
                        profitableTrades = tradeCounts[0]; losingTrades = tradeCounts[1];
                        posEntries.clear();
                        currentDir = "NONE";
                    }
                    if (!hasPosition || posEntries.isEmpty() || ("LONG".equals(currentDir) && posEntries.size() < maxPos)) {
                        cash = openPosition(trades, posEntries, "LONG", price, slippage, commissionRate,
                                positionSizing, positionValue, cash, date, i);
                        if (currentDir.equals("NONE")) {
                            currentDir = "LONG";
                            highSinceEntry = price;
                            firstEntryDayIndex = i;
                        }
                    }
                }

            // 3) 청산 신호
            } else if (exitSignal) {
                if ("LONG_SHORT".equals(tradeDir) && "LONG".equals(currentDir)) {
                    // 롱 청산 + 숏 진입
                    int[] streaks = {currentStreak, maxWinStreak, maxLossStreak};
                    int[] tradeCounts = {profitableTrades, losingTrades};
                    cash = executeCloseAll(trades, posEntries, currentDir, price, slippage, commissionRate,
                            date, i, "청산 조건 충족", cash,
                            winAmounts, lossAmounts, winRates, lossRates, holdingDaysList,
                            streaks, tradeCounts);
                    currentStreak = streaks[0]; maxWinStreak = streaks[1]; maxLossStreak = streaks[2];
                    profitableTrades = tradeCounts[0]; losingTrades = tradeCounts[1];
                    posEntries.clear();
                    currentDir = "NONE";
                    // 숏 오픈
                    cash = openPosition(trades, posEntries, "SHORT", price, slippage, commissionRate,
                            positionSizing, positionValue, cash, date, i);
                    currentDir = "SHORT";
                    lowSinceEntry = price;
                    firstEntryDayIndex = i;
                } else {
                    // 일반 청산
                    int[] streaks = {currentStreak, maxWinStreak, maxLossStreak};
                    int[] tradeCounts = {profitableTrades, losingTrades};
                    cash = executeCloseAll(trades, posEntries, currentDir, price, slippage, commissionRate,
                            date, i, "청산 조건 충족", cash,
                            winAmounts, lossAmounts, winRates, lossRates, holdingDaysList,
                            streaks, tradeCounts);
                    currentStreak = streaks[0]; maxWinStreak = streaks[1]; maxLossStreak = streaks[2];
                    profitableTrades = tradeCounts[0]; losingTrades = tradeCounts[1];
                    posEntries.clear();
                    currentDir = "NONE";
                    highSinceEntry = 0;
                    lowSinceEntry = Double.MAX_VALUE;
                }
            }

            // ── 자산가치 재계산 ──
            totalQty = posEntries.stream().mapToDouble(PosEntry::quantity).sum();
            if ("LONG".equals(currentDir)) {
                equity = cash + totalQty * price;
            } else if ("SHORT".equals(currentDir)) {
                double sev = posEntries.stream().mapToDouble(e -> e.quantity * e.execPrice).sum();
                equity = cash - totalQty * price + sev;
            } else {
                equity = cash;
            }

            // ── 최대 낙폭 & 지속기간 ──
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

        // ── 강제 청산 ──
        if (!posEntries.isEmpty() && !candles.isEmpty()) {
            double lastPrice = candles.get(candles.size() - 1).getClose();
            String lastDate = Instant.ofEpochSecond(candles.get(candles.size() - 1).getTime())
                    .atZone(KST).toLocalDate().format(DATE_FMT);
            int lastIdx = candles.size() - 1;

            int[] streaks = {currentStreak, maxWinStreak, maxLossStreak};
            int[] tradeCounts = {profitableTrades, losingTrades};
            cash = executeCloseAll(trades, posEntries, currentDir, lastPrice, slippage, commissionRate,
                    lastDate, lastIdx, "백테스트 종료 (강제 청산)", cash,
                    winAmounts, lossAmounts, winRates, lossRates, holdingDaysList,
                    streaks, tradeCounts);
            currentStreak = streaks[0]; maxWinStreak = streaks[1]; maxLossStreak = streaks[2];
            profitableTrades = tradeCounts[0]; losingTrades = tradeCounts[1];
            posEntries.clear();

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

        // Recovery Factor (드로다운 없이 수익이면 최대값 표시)
        double recoveryFactor = maxDrawdown > 0 ? totalReturnRate / maxDrawdown
                : (totalReturnRate > 0 ? 999.99 : 0);

        // Buy & Hold 벤치마크
        double firstPrice = candles.get(0).getClose();
        double buyHoldQuantity = (initialCapital * (1 - commissionRate)) / firstPrice;
        List<BacktestResponse.EquityPointDto> buyHoldCurve = new ArrayList<>();
        for (CandlestickResponse c : candles) {
            String d = Instant.ofEpochSecond(c.getTime()).atZone(KST).toLocalDate().format(DATE_FMT);
            double bhValue = buyHoldQuantity * c.getClose();
            buyHoldCurve.add(BacktestResponse.EquityPointDto.builder()
                    .date(d).value(Math.round(bhValue)).build());
        }
        double buyHoldFinal = buyHoldQuantity * candles.get(candles.size() - 1).getClose();
        double buyHoldReturnRate = (buyHoldFinal - initialCapital) / initialCapital * 100;

        // 지표 요약 (조건이 왜 트리거되지 않았는지 디버깅용)
        Map<String, BacktestResponse.IndicatorSummaryDto> indicatorSummary = new HashMap<>();
        Set<String> summaryKeys = new HashSet<>();
        if (entryConditions != null) entryConditions.forEach(c -> { if (c.getIndicator() != null) summaryKeys.add(c.getIndicator().toUpperCase()); });
        if (exitConditions != null) exitConditions.forEach(c -> { if (c.getIndicator() != null) summaryKeys.add(c.getIndicator().toUpperCase()); });

        for (String key : summaryKeys) {
            // 크로스오버 키는 건너뜀 (개별 지표로 분해됨)
            if (key.contains("_CROSS_") || key.contains("_CROSSUNDER_")) continue;

            String mappedKey = switch (key) {
                case "PRICE", "CLOSE" -> "PRICE";
                case "SIGNAL" -> "MACD_SIGNAL";
                case "HISTOGRAM" -> "MACD_HISTOGRAM";
                case "SMA" -> "MA";
                case "BB_UPPER" -> "BOLLINGER_UPPER";
                case "BB_MIDDLE" -> "BOLLINGER_MIDDLE";
                case "BB_LOWER" -> "BOLLINGER_LOWER";
                case "BB_PCT_B", "PCT_B" -> "BOLLINGER_PCT_B";
                case "STOCHASTIC_K" -> "STOCH_K";
                case "STOCHASTIC_D" -> "STOCH_D";
                default -> key;
            };

            double[] vals = indicatorValues.get(mappedKey);
            if (vals == null) continue;

            double min = Double.MAX_VALUE, max = -Double.MAX_VALUE, sum = 0;
            int count = 0;
            double last = Double.NaN;
            for (int i = globalOffset; i < globalOffset + candles.size(); i++) {
                if (i < vals.length && !Double.isNaN(vals[i])) {
                    if (vals[i] < min) min = vals[i];
                    if (vals[i] > max) max = vals[i];
                    sum += vals[i];
                    count++;
                    last = vals[i];
                }
            }
            if (count > 0) {
                indicatorSummary.put(key, BacktestResponse.IndicatorSummaryDto.builder()
                        .min(round2(min)).max(round2(max))
                        .avg(round2(sum / count)).last(round2(last))
                        .build());
            }
        }

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
                .indicatorSummary(indicatorSummary)
                .build();
    }

    // ── 포지션 오픈 (롱/숏 공통) ──
    private double openPosition(List<BacktestResponse.TradeDto> trades, List<PosEntry> entries,
                                  String direction, double price, double slippage, double commissionRate,
                                  String sizingType, double sizingValue, double cash,
                                  String date, int dayIndex) {
        double allocAmount = calculateAllocation(cash, sizingType, sizingValue);
        if (allocAmount <= 0) return cash;

        if ("LONG".equals(direction)) {
            double execPrice = price * (1 + slippage);
            double commission = allocAmount * commissionRate;
            double qty = (allocAmount - commission) / execPrice;
            cash -= allocAmount;
            entries.add(new PosEntry(execPrice, qty, allocAmount, dayIndex));
            trades.add(BacktestResponse.TradeDto.builder()
                    .date(date).type("BUY").price(execPrice).quantity(qty)
                    .pnl(-commission).pnlPercent(0).reason("진입 조건 충족 (롱)").holdingDays(0)
                    .balance(Math.round(cash + qty * price))
                    .build());
        } else {
            // SHORT: 빌려서 매도 → 현금 유입, 부채(수량) 발생
            double execPrice = price * (1 - slippage);
            double commission = allocAmount * commissionRate;
            double qty = (allocAmount - commission) / execPrice;
            // 숏 진입 시 매도 대금은 즉시 받지만, 마진으로 allocAmount 를 잡아둠
            cash -= allocAmount; // 마진 차감 (보증금)
            entries.add(new PosEntry(execPrice, qty, allocAmount, dayIndex));
            trades.add(BacktestResponse.TradeDto.builder()
                    .date(date).type("SHORT").price(execPrice).quantity(qty)
                    .pnl(-commission).pnlPercent(0).reason("진입 조건 충족 (숏)").holdingDays(0)
                    .balance(Math.round(cash + qty * execPrice))
                    .build());
        }
        return cash;
    }

    // ── 전체 포지션 청산 ──
    private double executeCloseAll(List<BacktestResponse.TradeDto> trades, List<PosEntry> entries,
                                     String direction, double price, double slippage, double commissionRate,
                                     String date, int dayIndex, String reason, double cash,
                                     List<Double> winAmounts, List<Double> lossAmounts,
                                     List<Double> winRates, List<Double> lossRates,
                                     List<Integer> holdingDaysList,
                                     int[] streaks, int[] tradeCounts) {
        if (entries.isEmpty()) return cash;

        double totalQty = entries.stream().mapToDouble(PosEntry::quantity).sum();
        double totalCost = entries.stream().mapToDouble(PosEntry::cost).sum();
        // 가중평균 보유기간 (각 포지션의 수량 비중 반영)
        int holdDays = (int) Math.round(entries.stream()
                .mapToDouble(e -> (double)(dayIndex - e.dayIndex) * e.quantity)
                .sum() / totalQty);

        double pnl;
        double closeExecPrice;
        String tradeType;

        if ("LONG".equals(direction)) {
            closeExecPrice = price * (1 - slippage);
            double sellProceeds = totalQty * closeExecPrice * (1 - commissionRate);
            pnl = sellProceeds - totalCost;
            cash += sellProceeds;
            tradeType = "SELL";
        } else {
            // SHORT 커버: 주식 매수하여 반환
            closeExecPrice = price * (1 + slippage);
            double shortEntryValue = entries.stream().mapToDouble(e -> e.quantity * e.execPrice).sum();
            double exitCommission = totalQty * closeExecPrice * commissionRate;
            // 숏 PnL = (진입가 - 청산가) × 수량 - 청산 수수료 (진입 수수료는 이미 qty에 반영됨)
            pnl = shortEntryValue - totalQty * closeExecPrice - exitCommission;
            cash += totalCost + pnl; // 마진 반환 + 손익
            tradeType = "COVER";
        }

        double pnlPct = totalCost > 0 ? pnl / totalCost * 100 : 0;

        trades.add(BacktestResponse.TradeDto.builder()
                .date(date).type(tradeType).price(closeExecPrice)
                .quantity(totalQty).pnl(pnl).pnlPercent(round2(pnlPct))
                .reason(reason).holdingDays(holdDays)
                .balance(Math.round(cash))
                .build());

        // 통계 업데이트 (streaks[0]=current, [1]=maxWin, [2]=maxLoss, tradeCounts[0]=profitable, [1]=losing)
        if (pnl > 0) {
            tradeCounts[0]++;
            winAmounts.add(pnl);
            winRates.add(pnlPct);
            streaks[0] = streaks[0] >= 0 ? streaks[0] + 1 : 1;
        } else if (pnl < 0) {
            tradeCounts[1]++;
            lossAmounts.add(Math.abs(pnl));
            lossRates.add(Math.abs(pnlPct));
            streaks[0] = streaks[0] <= 0 ? streaks[0] - 1 : -1;
        }
        // pnl == 0 (본전 거래)은 승/패 어느 쪽에도 포함하지 않음, 연승/연패 스트릭도 유지
        holdingDaysList.add(holdDays);
        if (streaks[0] > streaks[1]) streaks[1] = streaks[0];
        if (-streaks[0] > streaks[2]) streaks[2] = -streaks[0];

        return cash;
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

            // value 또는 operator가 null이면 조건 불충족 처리 (크로스오버가 아닌데 값이 없는 경우)
            if (cond.getValue() == null || cond.getOperator() == null) {
                boolean nullResult = false;
                if (accumulated == null) accumulated = nullResult;
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
