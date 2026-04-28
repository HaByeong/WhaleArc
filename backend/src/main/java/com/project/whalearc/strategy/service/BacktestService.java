package com.project.whalearc.strategy.service;

import com.project.whalearc.market.dto.CandlestickResponse;
import com.project.whalearc.market.service.BacktestDataProvider;
import com.project.whalearc.market.service.CandlestickService;
import com.project.whalearc.market.service.IndicatorCalculator;
import com.project.whalearc.market.service.UsEtfCatalog;
import com.project.whalearc.market.service.UsStockPriceProvider;
import com.project.whalearc.strategy.domain.Condition;
import com.project.whalearc.strategy.domain.Indicator;
import com.project.whalearc.strategy.domain.Strategy;
import com.project.whalearc.market.service.ExchangeRateService;
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
    private final ExchangeRateService exchangeRateService;
    private final UsEtfCatalog usEtfCatalog;
    private final UsStockPriceProvider usStockPriceProvider;

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

        // 자산 타입 자동 감지 (명시 전송 우선, 화이트리스트 → 폴백 순)
        String assetType = request.getAssetType();
        if (assetType == null || assetType.isEmpty()) {
            String code = request.getStockCode();
            if (code != null && code.matches("\\d{6}")) {
                assetType = "STOCK";
            } else if (code != null && usEtfCatalog.isEtfSymbol(code)) {
                assetType = "ETF";
            } else if (code != null && usStockPriceProvider.exists(code.toUpperCase())) {
                assetType = "US_STOCK";
            } else {
                assetType = "CRYPTO";
            }
        }

        // 캔들스틱 데이터 조회 (Yahoo Finance / Binance 우선, 실패 시 기존 소스 폴백)
        List<CandlestickResponse> allCandles = backtestDataProvider.getBacktestCandles(
                request.getStockCode(), assetType, request.getStartDate(), request.getEndDate());

        if (allCandles == null || allCandles.isEmpty()) {
            log.info("백테스트 데이터 폴백: 기존 CandlestickService 사용 ({})", request.getStockCode());
            String interval = ("STOCK".equals(assetType) || "US_STOCK".equals(assetType) || "ETF".equals(assetType)) ? "1d" : "24h";
            allCandles = candlestickService.getCandlesticks(
                    request.getStockCode(), interval, assetType);
        }

        if (allCandles == null || allCandles.isEmpty()) {
            throw new IllegalArgumentException("캔들스틱 데이터를 가져올 수 없습니다: " + request.getStockCode());
        }

        if (allCandles.size() > 50_000) {
            throw new IllegalArgumentException("데이터 범위가 너무 큽니다. 기간을 줄여주세요. (최대 약 5년)");
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

        // 2자산 리밸런싱 모드: secondStockCode 가 채워져 있으면 별도 시뮬레이션 경로
        if (request.getSecondStockCode() != null && !request.getSecondStockCode().isBlank()) {
            String assetTypeB = request.getSecondAssetType();
            List<CandlestickResponse> allCandlesB = backtestDataProvider.getBacktestCandles(
                    request.getSecondStockCode(), assetTypeB, request.getStartDate(), request.getEndDate());
            if (allCandlesB == null || allCandlesB.isEmpty()) {
                String intervalB = ("STOCK".equals(assetTypeB) || "US_STOCK".equals(assetTypeB) || "ETF".equals(assetTypeB)) ? "1d" : "24h";
                allCandlesB = candlestickService.getCandlesticks(request.getSecondStockCode(), intervalB, assetTypeB);
            }
            if (allCandlesB == null || allCandlesB.isEmpty()) {
                throw new IllegalArgumentException("두 번째 자산의 캔들스틱 데이터를 가져올 수 없습니다: " + request.getSecondStockCode());
            }
            allCandlesB = allCandlesB.stream().sorted(Comparator.comparingLong(CandlestickResponse::getTime)).toList();
            List<CandlestickResponse> candlesB = allCandlesB.stream()
                    .filter(c -> c.getTime() >= startEpoch && c.getTime() < endEpoch)
                    .sorted(Comparator.comparingLong(CandlestickResponse::getTime)).toList();
            if (candlesB.size() < 2) {
                throw new IllegalArgumentException("두 번째 자산: 선택한 기간에 충분한 데이터가 없습니다.");
            }
            Map<String, double[]> indicatorValuesB = calculateIndicators(
                    allCandlesB, indicators, entryConditions, exitConditions);
            int globalOffsetB = 0;
            for (int i = 0; i < allCandlesB.size(); i++) {
                if (allCandlesB.get(i).getTime() == candlesB.get(0).getTime()) { globalOffsetB = i; break; }
            }
            return simulateRebalance(strategyId, strategyName, entryConditions, exitConditions,
                    candles, indicatorValues, globalOffset, assetType,
                    candlesB, indicatorValuesB, globalOffsetB, assetTypeB,
                    request);
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
        if (request.getMaxPositions() != null && (request.getMaxPositions() < 1 || request.getMaxPositions() > 999)) {
            // 적립식(DCA) + Buy & Hold 조합에서는 매월 추가 매수마다 PosEntry 가 생성돼
            // 장기간(예: 30년 × 12개월) 시나리오까지 커버하려면 한도가 충분히 커야 한다.
            throw new IllegalArgumentException("최대 포지션 수는 1~999 사이로 설정해주세요.");
        }
        if (request.getMonthlyContribution() != null) {
            double mc = request.getMonthlyContribution();
            if (mc < 0) {
                throw new IllegalArgumentException("월 적립금은 0 이상이어야 합니다.");
            }
            if (mc > 100_000_000_000L) {
                throw new IllegalArgumentException("월 적립금은 1,000억원 이하로 설정해주세요.");
            }
        }
        // 2자산 리밸런싱 검증
        if (request.getSecondStockCode() != null && !request.getSecondStockCode().isBlank()) {
            if (request.getSecondAssetType() == null || request.getSecondAssetType().isBlank()) {
                throw new IllegalArgumentException("두 번째 자산의 자산 타입을 입력해주세요.");
            }
            if (request.getSecondStockCode().equalsIgnoreCase(request.getStockCode())) {
                throw new IllegalArgumentException("두 자산은 서로 다른 종목이어야 합니다.");
            }
            // 통화가 같아야 합산 의미가 있음 (USD vs KRW 혼합 금지)
            boolean firstUsd = "US_STOCK".equalsIgnoreCase(request.getAssetType()) || "ETF".equalsIgnoreCase(request.getAssetType());
            boolean secondUsd = "US_STOCK".equalsIgnoreCase(request.getSecondAssetType()) || "ETF".equalsIgnoreCase(request.getSecondAssetType());
            if (firstUsd != secondUsd) {
                throw new IllegalArgumentException("두 자산의 통화가 같아야 합니다 (둘 다 미국주식·ETF 이거나, 둘 다 그 외).");
            }
            Double w = request.getFirstAssetWeight();
            if (w == null) w = 50.0;
            if (w <= 0 || w >= 100) {
                throw new IllegalArgumentException("첫 자산 비중은 0%와 100% 사이여야 합니다.");
            }
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

        boolean isUsStock = "US_STOCK".equalsIgnoreCase(assetType);
        double usdKrwRate = isUsStock ? exchangeRateService.getUsdKrwRate() : 0;
        // US_STOCK: KRW 투자금을 USD로 변환하여 USD 단위 시뮬레이션
        double initialCapital = isUsStock
                ? request.getInitialCapital() / usdKrwRate
                : request.getInitialCapital();
        double cash = initialCapital;
        double peakEquity = initialCapital;

        // 적립식 (매월 첫 거래일에 cash 가산) — monthlyNative 는 시뮬레이션 단위(USD 또는 KRW)
        double monthlyKrw = request.getMonthlyContribution() != null ? request.getMonthlyContribution() : 0.0;
        double monthlyNative = isUsStock && monthlyKrw > 0 ? monthlyKrw / usdKrwRate : monthlyKrw;
        boolean isMonthlyMode = monthlyNative > 0;
        double cumContribNative = initialCapital; // 현재 시점까지 누적 납입액 (수익률 분모)
        int contribCount = 0;
        java.time.YearMonth prevYm = null;

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
            java.time.LocalDate curDate = Instant.ofEpochSecond(candle.getTime())
                    .atZone(KST).toLocalDate();
            String date = curDate.format(DATE_FMT);

            // 매월 첫 거래일에 적립금 가산 (시작 캔들은 제외 — initialCapital 이 이미 시작점)
            java.time.YearMonth curYm = java.time.YearMonth.from(curDate);
            if (isMonthlyMode && prevYm != null && !curYm.equals(prevYm)) {
                cash += monthlyNative;
                cumContribNative += monthlyNative;
                contribCount++;
            }
            prevYm = curYm;

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
                double margin = posEntries.stream().mapToDouble(PosEntry::cost).sum();
                equity = cash + margin + (shortEntryValue - totalQty * price);
            } else {
                equity = cash;
            }

            // ── 가중 평균 진입가 ──
            double avgPrice = hasPosition
                    ? posEntries.stream().mapToDouble(e -> e.execPrice * e.quantity).sum() / totalQty
                    : 0;

            // ── 장중 고가/저가 (손절·익절·트레일링 스탑에 사용) ──
            double candleHigh = candle.getHigh();
            double candleLow = candle.getLow();

            // ── 트레일링 스탑 ──
            boolean trailingStopHit = false;
            if (hasPosition && "LONG".equals(currentDir)) {
                if (candleHigh > highSinceEntry) highSinceEntry = candleHigh;
                if (trailingStop > 0 && highSinceEntry > 0) {
                    double drop = (highSinceEntry - candleLow) / highSinceEntry * 100;
                    if (drop >= trailingStop) trailingStopHit = true;
                }
            } else if (hasPosition && "SHORT".equals(currentDir)) {
                if (candleLow < lowSinceEntry) lowSinceEntry = candleLow;
                if (trailingStop > 0 && lowSinceEntry > 0 && lowSinceEntry < Double.MAX_VALUE) {
                    double rise = (candleHigh - lowSinceEntry) / lowSinceEntry * 100;
                    if (rise >= trailingStop) trailingStopHit = true;
                }
            }

            // ── 손절/익절 (장중 고가/저가 기반) ──
            boolean stopLossHit = false;
            boolean takeProfitHit = false;
            if (hasPosition && avgPrice > 0) {
                if ("LONG".equals(currentDir)) {
                    double worstPct = (candleLow - avgPrice) / avgPrice * 100;
                    double bestPct = (candleHigh - avgPrice) / avgPrice * 100;
                    if (stopLoss > 0 && worstPct <= -stopLoss) stopLossHit = true;
                    if (takeProfit > 0 && bestPct >= takeProfit) takeProfitHit = true;
                } else {
                    // SHORT: 가격 상승 = 손실, 가격 하락 = 이익
                    double worstPct = (avgPrice - candleHigh) / avgPrice * 100;
                    double bestPct = (avgPrice - candleLow) / avgPrice * 100;
                    if (stopLoss > 0 && worstPct <= -stopLoss) stopLossHit = true;
                    if (takeProfit > 0 && bestPct >= takeProfit) takeProfitHit = true;
                }
                // 같은 캔들에서 손절·익절 동시 충족 시 손절 우선 (보수적 접근)
                if (stopLossHit && takeProfitHit) takeProfitHit = false;
            }

            // ── 마진콜: 자산가치가 0 이하로 떨어지면 강제 청산 ──
            boolean marginCallHit = hasPosition && equity <= 0;

            // ── 조건 평가 ──
            boolean riskExit = hasPosition && (stopLossHit || takeProfitHit || trailingStopHit || marginCallHit);
            // LONG_SHORT 모드에서는 방향 전환을 위해 진입 신호 평가를 항상 허용
            boolean canAddPosition = !hasPosition || posEntries.size() < maxPos
                    || ("LONG_SHORT".equals(tradeDir) && hasPosition);
            boolean entrySignal = !riskExit && canAddPosition
                    && evaluateConditions(entryConditions, indicatorValues, gi, price, candles, globalOffset, i);
            boolean exitSignal = hasPosition && !riskExit
                    && evaluateConditions(exitConditions, indicatorValues, gi, price, candles, globalOffset, i);

            // ── 매매 실행 ──

            // 1) 리스크 청산
            if (riskExit) {
                String reason = marginCallHit
                        ? "마진콜 (자산가치 소진)"
                        : stopLossHit
                        ? String.format("손절 (%.1f%%)", -stopLoss)
                        : trailingStopHit
                        ? String.format("트레일링 스탑 (-%.1f%%)", trailingStop)
                        : String.format("익절 (+%.1f%%)", takeProfit);

                // 리스크 청산 시 실제 체결 가격 결정 (종가 대신 손절가/익절가/트레일링 가격)
                double riskExitPrice = price; // 기본: 종가
                if (!marginCallHit && avgPrice > 0) {
                    if (stopLossHit) {
                        // 손절가에서 체결
                        riskExitPrice = "LONG".equals(currentDir)
                                ? avgPrice * (1 - stopLoss / 100.0)
                                : avgPrice * (1 + stopLoss / 100.0);
                    } else if (takeProfitHit) {
                        // 익절가에서 체결
                        riskExitPrice = "LONG".equals(currentDir)
                                ? avgPrice * (1 + takeProfit / 100.0)
                                : avgPrice * (1 - takeProfit / 100.0);
                    } else if (trailingStopHit) {
                        // 트레일링 스탑 가격에서 체결
                        riskExitPrice = "LONG".equals(currentDir)
                                ? highSinceEntry * (1 - trailingStop / 100.0)
                                : lowSinceEntry * (1 + trailingStop / 100.0);
                    }
                }

                int[] streaks = {currentStreak, maxWinStreak, maxLossStreak};
                int[] tradeCounts = {profitableTrades, losingTrades};
                cash = executeCloseAll(trades, posEntries, currentDir, riskExitPrice, slippage, commissionRate,
                        date, i, reason, cash,
                        winAmounts, lossAmounts, winRates, lossRates, holdingDaysList,
                        streaks, tradeCounts);
                // 마진콜 시 손실을 초기 자본금으로 제한 (cash가 음수가 되지 않도록)
                if (marginCallHit && cash < 0) cash = 0;
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
                        if (cash < 0) cash = 0; // 숏 대손실 시 음수 방지
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
                            date, i, "방향 전환 (롱→숏)", cash,
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
                } else if ("LONG_SHORT".equals(tradeDir) && "SHORT".equals(currentDir)) {
                    // LONG_SHORT 모드: 숏 보유 중 청산 신호 → 숏 청산 + 롱 진입 (방향 전환)
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
                    // 롱 오픈
                    cash = openPosition(trades, posEntries, "LONG", price, slippage, commissionRate,
                            positionSizing, positionValue, cash, date, i);
                    currentDir = "LONG";
                    highSinceEntry = price;
                    firstEntryDayIndex = i;
                } else {
                    // 일반 청산 (LONG_ONLY / SHORT_ONLY)
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
                double margin = posEntries.stream().mapToDouble(PosEntry::cost).sum();
                equity = cash + margin + (sev - totalQty * price);
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
            double cumulativeReturn = cumContribNative > 0 ? (equity - cumContribNative) / cumContribNative * 100 : 0;

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
            double cumulativeReturn = cumContribNative > 0 ? (finalEquity - cumContribNative) / cumContribNative * 100 : 0;
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
        // 적립식 모드 여부와 상관없이 "지금까지 납입한 총 자본" 기준으로 수익률 계산
        // (적립식 off 일 때 cumContribNative == initialCapital 이라 기존 동작과 동일)
        double totalReturn = finalValue - cumContribNative;
        double totalReturnRate = cumContribNative > 0 ? (totalReturn / cumContribNative) * 100 : 0;
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

        // CAGR (실제 달력 일수 기반) — 분모는 총 납입액
        // 주의: 적립식의 money-weighted IRR 완전 대체는 아니지만 MVP 근사로 충분
        LocalDate actualStart = LocalDate.parse(request.getStartDate());
        LocalDate actualEnd = LocalDate.parse(request.getEndDate());
        long calendarDays = java.time.temporal.ChronoUnit.DAYS.between(actualStart, actualEnd);
        double years = Math.max(calendarDays, 1) / 365.0;
        double cagrRatio = cumContribNative > 0 ? finalValue / cumContribNative : 0;
        double cagr = years > 0.01 && cagrRatio > 0
                ? (Math.pow(cagrRatio, 1.0 / years) - 1) * 100
                : totalReturnRate;

        // Recovery Factor (드로다운 없이 수익이면 최대값 표시)
        double recoveryFactor = maxDrawdown > 0 ? totalReturnRate / maxDrawdown
                : (totalReturnRate > 0 ? 999.99 : 0);

        // Buy & Hold 벤치마크
        // 적립식 off: 시작일 initialCapital 일시불 매수 후 보유 (기존 로직)
        // 적립식 on : 시작일 initialCapital 매수 + 매월 첫 거래일마다 monthlyNative 로 추가 매수 (DCA Buy&Hold)
        List<BacktestResponse.EquityPointDto> buyHoldCurve = new ArrayList<>();
        double buyHoldFinal;
        if (isMonthlyMode) {
            double bhQty = 0;
            java.time.YearMonth bhPrevYm = null;
            for (int i = 0; i < candles.size(); i++) {
                CandlestickResponse c = candles.get(i);
                double p = c.getClose();
                java.time.LocalDate dLocal = Instant.ofEpochSecond(c.getTime()).atZone(KST).toLocalDate();
                java.time.YearMonth ym = java.time.YearMonth.from(dLocal);
                if (i == 0) {
                    bhQty = (initialCapital * (1 - commissionRate)) / p;
                } else if (bhPrevYm != null && !ym.equals(bhPrevYm) && monthlyNative > 0) {
                    bhQty += (monthlyNative * (1 - commissionRate)) / p;
                }
                bhPrevYm = ym;
                double bhValue = bhQty * p;
                buyHoldCurve.add(BacktestResponse.EquityPointDto.builder()
                        .date(dLocal.format(DATE_FMT)).value(Math.round(bhValue)).build());
            }
            buyHoldFinal = bhQty * candles.get(candles.size() - 1).getClose();
        } else {
            double firstPrice = candles.get(0).getClose();
            double buyHoldQuantity = (initialCapital * (1 - commissionRate)) / firstPrice;
            for (CandlestickResponse c : candles) {
                String d = Instant.ofEpochSecond(c.getTime()).atZone(KST).toLocalDate().format(DATE_FMT);
                double bhValue = buyHoldQuantity * c.getClose();
                buyHoldCurve.add(BacktestResponse.EquityPointDto.builder()
                        .date(d).value(Math.round(bhValue)).build());
            }
            buyHoldFinal = buyHoldQuantity * candles.get(candles.size() - 1).getClose();
        }
        double buyHoldReturnRate = cumContribNative > 0
                ? (buyHoldFinal - cumContribNative) / cumContribNative * 100
                : 0;

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
                // 통화 정보
                .currency(isUsStock ? "USD" : "KRW")
                .exchangeRate(isUsStock ? usdKrwRate : 0)
                // 적립식 투자
                .monthlyContribution(monthlyNative)
                .totalContribution(cumContribNative)
                .contributionCount(contribCount)
                .build();
    }

    // ── 2자산 리밸런싱 시뮬레이션 ───────────────────────────────────────────
    // 단순화 사양 (Phase 1):
    //   - 두 자산이 각자 자기 캔들·지표로 entry/exit 신호 평가 (같은 conditions 공유)
    //   - tradeDirection LONG_ONLY 고정 (자산당 단일 진입/청산, 분할매수 없음)
    //   - positionSizing ALL_IN (자산별 cash 의 100% 매수)
    //   - stopLoss/takeProfit/trailingStop 미지원
    //   - 두 자산이 같은 통화(USD or KRW). validateRequest 에서 강제.
    //   - 캔들 inner join: 두 자산 모두 거래일인 시점만 시뮬레이션.
    //   - 매월 첫 거래일: 적립금 비중대로 분배 + 비중 재조정 (cash 만 옮김 → 다음 신호에 매매)
    private BacktestResponse simulateRebalance(
            String strategyId, String strategyName,
            List<Condition> entryConditions, List<Condition> exitConditions,
            List<CandlestickResponse> candlesA, Map<String, double[]> indicatorsA, int globalOffsetA, String assetTypeA,
            List<CandlestickResponse> candlesB, Map<String, double[]> indicatorsB, int globalOffsetB, String assetTypeB,
            BacktestRequest request) {

        boolean isUsd = "US_STOCK".equalsIgnoreCase(assetTypeA) || "ETF".equalsIgnoreCase(assetTypeA);
        double usdKrwRate = isUsd ? exchangeRateService.getUsdKrwRate() : 0;
        double initialCap = isUsd ? request.getInitialCapital() / usdKrwRate : request.getInitialCapital();
        double weightA = (request.getFirstAssetWeight() != null ? request.getFirstAssetWeight() : 50.0) / 100.0;
        double weightB = 1.0 - weightA;
        // 리밸런싱 주기: MONTHLY (기본) / QUARTERLY / YEARLY
        String rebalanceFreq = request.getRebalanceFrequency() != null ? request.getRebalanceFrequency().toUpperCase() : "MONTHLY";
        if (!"MONTHLY".equals(rebalanceFreq) && !"QUARTERLY".equals(rebalanceFreq) && !"YEARLY".equals(rebalanceFreq)) {
            rebalanceFreq = "MONTHLY";
        }

        // Inner join by epoch second
        java.util.Map<Long, Integer> aIndexByTime = new java.util.HashMap<>();
        for (int i = 0; i < candlesA.size(); i++) aIndexByTime.put(candlesA.get(i).getTime(), i);
        List<int[]> joined = new java.util.ArrayList<>();   // [aIdx, bIdx]
        for (int i = 0; i < candlesB.size(); i++) {
            Integer ai = aIndexByTime.get(candlesB.get(i).getTime());
            if (ai != null) joined.add(new int[]{ai, i});
        }
        if (joined.size() < 2) {
            throw new IllegalArgumentException("두 자산의 공통 거래일이 충분하지 않습니다.");
        }

        // 자본 분배
        double cashA = initialCap * weightA;
        double cashB = initialCap * weightB;
        double qtyA = 0, qtyB = 0;
        double entryPriceA = 0, entryPriceB = 0;
        int entryDayIndexA = 0, entryDayIndexB = 0;

        // 적립식
        double monthlyKrw = request.getMonthlyContribution() != null ? request.getMonthlyContribution() : 0.0;
        double monthlyNative = isUsd && monthlyKrw > 0 ? monthlyKrw / usdKrwRate : monthlyKrw;
        boolean isMonthly = monthlyNative > 0;
        double cumContribNative = initialCap;
        int contribCount = 0;

        // 매매 파라미터
        double slippage = request.getSlippagePercent() != null ? request.getSlippagePercent() / 100.0 : 0;
        double commissionRate = request.getCommissionRate() != null ? request.getCommissionRate() / 100.0 : DEFAULT_COMMISSION_RATE;

        List<BacktestResponse.TradeDto> trades = new java.util.ArrayList<>();
        List<BacktestResponse.EquityPointDto> equityCurve = new java.util.ArrayList<>();
        List<BacktestResponse.EquityPointDto> drawdownCurve = new java.util.ArrayList<>();
        List<BacktestResponse.DailyReturnDto> dailyReturns = new java.util.ArrayList<>();
        List<BacktestResponse.PricePointDto> priceData = new java.util.ArrayList<>();

        int aTrades = 0, bTrades = 0, rebalanceCount = 0;
        int profitable = 0, losing = 0;
        double prevEquity = initialCap;
        double peakEquity = initialCap;
        double maxDrawdown = 0;
        java.time.YearMonth prevYm = null;

        for (int idx = 0; idx < joined.size(); idx++) {
            int aIdx = joined.get(idx)[0];
            int bIdx = joined.get(idx)[1];
            CandlestickResponse cA = candlesA.get(aIdx);
            CandlestickResponse cB = candlesB.get(bIdx);
            int gA = globalOffsetA + aIdx;
            int gB = globalOffsetB + bIdx;
            double priceA = cA.getClose();
            double priceB = cB.getClose();
            java.time.LocalDate curDate = Instant.ofEpochSecond(cA.getTime()).atZone(KST).toLocalDate();
            String date = curDate.format(DATE_FMT);
            java.time.YearMonth curYm = java.time.YearMonth.from(curDate);

            priceData.add(BacktestResponse.PricePointDto.builder()
                    .date(date).open(cA.getOpen()).high(cA.getHigh()).low(cA.getLow())
                    .close(cA.getClose()).volume(cA.getVolume()).build());

            // ── 월 첫 거래일: 적립(항상 매월) + 리밸런싱(freq 에 따라) ──
            if (prevYm != null && !curYm.equals(prevYm)) {
                // 적립금은 항상 매월 (사용자 결정에 따라 적립과 리밸런싱은 분리)
                if (isMonthly) {
                    cashA += monthlyNative * weightA;
                    cashB += monthlyNative * weightB;
                    cumContribNative += monthlyNative;
                    contribCount++;
                }
                // 리밸런싱 주기 판단
                int curMonth = curYm.getMonthValue();
                boolean doRebalance =
                        "MONTHLY".equals(rebalanceFreq)
                        || ("QUARTERLY".equals(rebalanceFreq) && (curMonth == 1 || curMonth == 4 || curMonth == 7 || curMonth == 10))
                        || ("YEARLY".equals(rebalanceFreq) && curMonth == 1);
                if (doRebalance) {
                // 리밸런싱: 두 자산 측의 총 가치(cash + 보유 평가)를 비중대로 재조정.
                // 한 측이 과다하면 그 측에서 (cash 우선, 부족분은 보유 일부 매도) 다른 측 cash 로 이전.
                // 다른 측의 매수는 룰 일관성을 위해 다음 entry 신호 시점에 발생하도록 둠.
                double vA = cashA + qtyA * priceA;
                double vB = cashB + qtyB * priceB;
                double total = vA + vB;
                double targetA = total * weightA;
                double diff = vA - targetA;
                if (Math.abs(diff) > total * 0.005 && total > 0) {
                    if (diff > 0) {
                        double moveAmount = diff;
                        double fromCashA = Math.min(cashA, moveAmount);
                        if (fromCashA > 0) {
                            cashA -= fromCashA;
                            cashB += fromCashA;
                            moveAmount -= fromCashA;
                        }
                        if (moveAmount > 0 && qtyA > 0) {
                            double sellExec = priceA * (1 - slippage);
                            double sellQty = Math.min(qtyA, moveAmount / (sellExec * (1 - commissionRate)));
                            double sellProceeds = sellQty * sellExec * (1 - commissionRate);
                            qtyA -= sellQty;
                            cashB += sellProceeds;
                            trades.add(BacktestResponse.TradeDto.builder()
                                    .date(date).type("REBALANCE_SELL_A").price(round2(sellExec)).quantity(sellQty)
                                    .pnl(0).pnlPercent(0).reason("리밸런싱: 자산A 일부 매도").holdingDays(0)
                                    .balance(Math.round(cashA + cashB + qtyA * priceA + qtyB * priceB))
                                    .build());
                            aTrades++;
                        }
                    } else {
                        double moveAmount = -diff;
                        double fromCashB = Math.min(cashB, moveAmount);
                        if (fromCashB > 0) {
                            cashB -= fromCashB;
                            cashA += fromCashB;
                            moveAmount -= fromCashB;
                        }
                        if (moveAmount > 0 && qtyB > 0) {
                            double sellExec = priceB * (1 - slippage);
                            double sellQty = Math.min(qtyB, moveAmount / (sellExec * (1 - commissionRate)));
                            double sellProceeds = sellQty * sellExec * (1 - commissionRate);
                            qtyB -= sellQty;
                            cashA += sellProceeds;
                            trades.add(BacktestResponse.TradeDto.builder()
                                    .date(date).type("REBALANCE_SELL_B").price(round2(sellExec)).quantity(sellQty)
                                    .pnl(0).pnlPercent(0).reason("리밸런싱: 자산B 일부 매도").holdingDays(0)
                                    .balance(Math.round(cashA + cashB + qtyA * priceA + qtyB * priceB))
                                    .build());
                            bTrades++;
                        }
                    }
                }
                rebalanceCount++;
                }  // doRebalance
            }
            prevYm = curYm;

            // ── 자산A: 자기 신호로 매매 ──
            if (qtyA == 0 && cashA > 0
                    && evaluateConditions(entryConditions, indicatorsA, gA, priceA, candlesA, globalOffsetA, aIdx)) {
                double execPrice = priceA * (1 + slippage);
                double commAmt = cashA * commissionRate;
                double buyQty = (cashA - commAmt) / execPrice;
                qtyA = buyQty;
                entryPriceA = execPrice;
                entryDayIndexA = idx;
                cashA = 0;
                trades.add(BacktestResponse.TradeDto.builder()
                        .date(date).type("BUY_A").price(round2(execPrice)).quantity(buyQty)
                        .pnl(-commAmt).pnlPercent(0).reason("자산A 진입").holdingDays(0)
                        .balance(Math.round(cashA + cashB + qtyA * priceA + qtyB * priceB))
                        .build());
                aTrades++;
            } else if (qtyA > 0
                    && evaluateConditions(exitConditions, indicatorsA, gA, priceA, candlesA, globalOffsetA, aIdx)) {
                double execPrice = priceA * (1 - slippage);
                double sellProceeds = qtyA * execPrice * (1 - commissionRate);
                double pnl = sellProceeds - qtyA * entryPriceA;
                double pnlRate = entryPriceA > 0 ? (execPrice - entryPriceA) / entryPriceA * 100 : 0;
                if (pnl >= 0) profitable++; else losing++;
                cashA += sellProceeds;
                trades.add(BacktestResponse.TradeDto.builder()
                        .date(date).type("SELL_A").price(round2(execPrice)).quantity(qtyA)
                        .pnl(round2(pnl)).pnlPercent(round2(pnlRate)).reason("자산A 청산")
                        .holdingDays(idx - entryDayIndexA)
                        .balance(Math.round(cashA + cashB + qtyB * priceB))
                        .build());
                qtyA = 0;
                entryPriceA = 0;
                aTrades++;
            }

            // ── 자산B: 자기 신호로 매매 ──
            if (qtyB == 0 && cashB > 0
                    && evaluateConditions(entryConditions, indicatorsB, gB, priceB, candlesB, globalOffsetB, bIdx)) {
                double execPrice = priceB * (1 + slippage);
                double commAmt = cashB * commissionRate;
                double buyQty = (cashB - commAmt) / execPrice;
                qtyB = buyQty;
                entryPriceB = execPrice;
                entryDayIndexB = idx;
                cashB = 0;
                trades.add(BacktestResponse.TradeDto.builder()
                        .date(date).type("BUY_B").price(round2(execPrice)).quantity(buyQty)
                        .pnl(-commAmt).pnlPercent(0).reason("자산B 진입").holdingDays(0)
                        .balance(Math.round(cashA + cashB + qtyA * priceA + qtyB * priceB))
                        .build());
                bTrades++;
            } else if (qtyB > 0
                    && evaluateConditions(exitConditions, indicatorsB, gB, priceB, candlesB, globalOffsetB, bIdx)) {
                double execPrice = priceB * (1 - slippage);
                double sellProceeds = qtyB * execPrice * (1 - commissionRate);
                double pnl = sellProceeds - qtyB * entryPriceB;
                double pnlRate = entryPriceB > 0 ? (execPrice - entryPriceB) / entryPriceB * 100 : 0;
                if (pnl >= 0) profitable++; else losing++;
                cashB += sellProceeds;
                trades.add(BacktestResponse.TradeDto.builder()
                        .date(date).type("SELL_B").price(round2(execPrice)).quantity(qtyB)
                        .pnl(round2(pnl)).pnlPercent(round2(pnlRate)).reason("자산B 청산")
                        .holdingDays(idx - entryDayIndexB)
                        .balance(Math.round(cashA + cashB + qtyA * priceA))
                        .build());
                qtyB = 0;
                entryPriceB = 0;
                bTrades++;
            }

            // ── equity / drawdown / dailyReturn ──
            double equity = cashA + qtyA * priceA + cashB + qtyB * priceB;
            if (equity >= peakEquity) peakEquity = equity;
            double drawdown = peakEquity > 0 ? (peakEquity - equity) / peakEquity * 100 : 0;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;
            drawdownCurve.add(BacktestResponse.EquityPointDto.builder().date(date).value(Math.round(-drawdown * 100.0) / 100.0).build());
            equityCurve.add(BacktestResponse.EquityPointDto.builder().date(date).value(equity).build());
            double dailyReturn = prevEquity > 0 ? (equity - prevEquity) / prevEquity * 100 : 0;
            double cumReturn = cumContribNative > 0 ? (equity - cumContribNative) / cumContribNative * 100 : 0;
            dailyReturns.add(BacktestResponse.DailyReturnDto.builder()
                    .date(date).dailyReturn(dailyReturn).cumulativeReturn(cumReturn)
                    .portfolioValue(equity).build());
            prevEquity = equity;
        }

        // ── 강제 청산 ──
        int lastIdx = joined.size() - 1;
        double lastPriceA = candlesA.get(joined.get(lastIdx)[0]).getClose();
        double lastPriceB = candlesB.get(joined.get(lastIdx)[1]).getClose();
        String lastDate = Instant.ofEpochSecond(candlesA.get(joined.get(lastIdx)[0]).getTime()).atZone(KST).toLocalDate().format(DATE_FMT);
        if (qtyA > 0) {
            double execPrice = lastPriceA * (1 - slippage);
            double proceeds = qtyA * execPrice * (1 - commissionRate);
            double pnl = proceeds - qtyA * entryPriceA;
            if (pnl >= 0) profitable++; else losing++;
            cashA += proceeds;
            trades.add(BacktestResponse.TradeDto.builder()
                    .date(lastDate).type("SELL_A").price(round2(execPrice)).quantity(qtyA)
                    .pnl(round2(pnl)).pnlPercent(0).reason("종료 강제 청산 (자산A)")
                    .holdingDays(lastIdx - entryDayIndexA).balance(Math.round(cashA + cashB))
                    .build());
            qtyA = 0;
            aTrades++;
        }
        if (qtyB > 0) {
            double execPrice = lastPriceB * (1 - slippage);
            double proceeds = qtyB * execPrice * (1 - commissionRate);
            double pnl = proceeds - qtyB * entryPriceB;
            if (pnl >= 0) profitable++; else losing++;
            cashB += proceeds;
            trades.add(BacktestResponse.TradeDto.builder()
                    .date(lastDate).type("SELL_B").price(round2(execPrice)).quantity(qtyB)
                    .pnl(round2(pnl)).pnlPercent(0).reason("종료 강제 청산 (자산B)")
                    .holdingDays(lastIdx - entryDayIndexB).balance(Math.round(cashA + cashB))
                    .build());
            qtyB = 0;
            bTrades++;
        }

        double finalValue = cashA + cashB;
        double totalReturn = finalValue - cumContribNative;
        double totalReturnRate = cumContribNative > 0 ? (totalReturn / cumContribNative) * 100 : 0;
        int totalTradeCount = profitable + losing;
        double winRate = totalTradeCount > 0 ? (double) profitable / totalTradeCount * 100 : 0;

        // Sharpe / Sortino — 단일 자산 시뮬레이션과 동일 helper 재사용
        double sharpeRatio = calculateSharpeRatio(dailyReturns, assetTypeA);
        double sortinoRatio = calculateSortinoRatio(dailyReturns, assetTypeA);

        // CAGR
        java.time.LocalDate actualStart = java.time.LocalDate.parse(request.getStartDate());
        java.time.LocalDate actualEnd = java.time.LocalDate.parse(request.getEndDate());
        long calendarDays = java.time.temporal.ChronoUnit.DAYS.between(actualStart, actualEnd);
        double years = Math.max(calendarDays, 1) / 365.0;
        double cagrRatio = cumContribNative > 0 ? finalValue / cumContribNative : 0;
        double cagr = years > 0.01 && cagrRatio > 0
                ? (Math.pow(cagrRatio, 1.0 / years) - 1) * 100
                : totalReturnRate;

        // ── Buy & Hold 벤치마크 (두 자산 비중대로 시작 매수, 적립이면 매월 추가 매수) ──
        List<BacktestResponse.EquityPointDto> bhCurve = new java.util.ArrayList<>();
        double bhQtyA = (initialCap * weightA * (1 - commissionRate)) / candlesA.get(joined.get(0)[0]).getClose();
        double bhQtyB = (initialCap * weightB * (1 - commissionRate)) / candlesB.get(joined.get(0)[1]).getClose();
        java.time.YearMonth bhPrevYm = null;
        for (int idx = 0; idx < joined.size(); idx++) {
            CandlestickResponse cA = candlesA.get(joined.get(idx)[0]);
            CandlestickResponse cB = candlesB.get(joined.get(idx)[1]);
            java.time.LocalDate dLocal = Instant.ofEpochSecond(cA.getTime()).atZone(KST).toLocalDate();
            java.time.YearMonth ym = java.time.YearMonth.from(dLocal);
            if (idx > 0 && bhPrevYm != null && !ym.equals(bhPrevYm) && isMonthly) {
                bhQtyA += (monthlyNative * weightA * (1 - commissionRate)) / cA.getClose();
                bhQtyB += (monthlyNative * weightB * (1 - commissionRate)) / cB.getClose();
            }
            bhPrevYm = ym;
            double bhValue = bhQtyA * cA.getClose() + bhQtyB * cB.getClose();
            bhCurve.add(BacktestResponse.EquityPointDto.builder()
                    .date(dLocal.format(DATE_FMT)).value(Math.round(bhValue)).build());
        }
        double bhFinal = bhQtyA * lastPriceA + bhQtyB * lastPriceB;
        double bhReturnRate = cumContribNative > 0 ? (bhFinal - cumContribNative) / cumContribNative * 100 : 0;

        return BacktestResponse.builder()
                .id("backtest-" + java.util.UUID.randomUUID().toString().substring(0, 8))
                .strategyId(strategyId).strategyName(strategyName)
                .stockCode(request.getStockCode())
                .stockName(request.getStockName() != null && !request.getStockName().isEmpty()
                        ? request.getStockName() : request.getStockCode())
                .startDate(request.getStartDate()).endDate(request.getEndDate())
                .initialCapital(initialCap)
                .finalValue(Math.round(finalValue))
                .totalReturn(Math.round(totalReturn))
                .totalReturnRate(round2(totalReturnRate))
                .maxDrawdown(round2(-maxDrawdown))
                .sharpeRatio(round2(sharpeRatio))
                .sortinoRatio(round2(sortinoRatio))
                .winRate(round2(winRate))
                .totalTrades(totalTradeCount)
                .profitableTrades(profitable)
                .losingTrades(losing)
                .dailyReturns(dailyReturns)
                .equityCurve(equityCurve)
                .trades(trades)
                .buyHoldReturnRate(round2(bhReturnRate))
                .buyHoldCurve(bhCurve)
                .cagr(round2(cagr))
                .drawdownCurve(drawdownCurve)
                .priceData(priceData)
                .currency(isUsd ? "USD" : "KRW")
                .exchangeRate(isUsd ? usdKrwRate : 0)
                // 적립식
                .monthlyContribution(monthlyNative)
                .totalContribution(cumContribNative)
                .contributionCount(contribCount)
                // 2자산 리밸런싱
                .secondStockCode(request.getSecondStockCode())
                .secondStockName(request.getSecondStockName() != null && !request.getSecondStockName().isEmpty()
                        ? request.getSecondStockName() : request.getSecondStockCode())
                .firstAssetWeight(round2(weightA * 100))
                .secondAssetWeight(round2(weightB * 100))
                .firstAssetFinalValue(Math.round(cashA))
                .secondAssetFinalValue(Math.round(cashB))
                .firstAssetTradeCount(aTrades)
                .secondAssetTradeCount(bTrades)
                .rebalanceCount(rebalanceCount)
                .rebalanceFrequency(rebalanceFreq)
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
                                        int index, double currentPrice,
                                        List<CandlestickResponse> candles, int globalOffset, int localIndex) {
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

            double indicatorValue = getIndicatorValue(indicatorName, indicatorValues, index, currentPrice, candles, localIndex);
            if (Double.isNaN(indicatorValue)) {
                boolean nanResult = false;
                if (accumulated == null) accumulated = nanResult;
                else accumulated = cond.getLogic() == Condition.Logic.AND ? false : accumulated;
                continue;
            }

            // valueExpression이 있으면 수식으로 비교값 계산, 없으면 고정 value 사용
            double targetValue;
            if (cond.getValueExpression() != null && !cond.getValueExpression().isBlank()) {
                targetValue = evaluateExpression(cond.getValueExpression(), indicatorValues, index, currentPrice, candles, localIndex);
                if (Double.isNaN(targetValue)) {
                    boolean nanResult = false;
                    if (accumulated == null) accumulated = nanResult;
                    else accumulated = cond.getLogic() == Condition.Logic.AND ? false : accumulated;
                    continue;
                }
            } else if (cond.getValue() != null && cond.getOperator() != null) {
                targetValue = cond.getValue().doubleValue();
            } else {
                boolean nullResult = false;
                if (accumulated == null) accumulated = nullResult;
                else accumulated = cond.getLogic() == Condition.Logic.AND ? false : accumulated;
                continue;
            }

            if (cond.getOperator() == null) {
                if (accumulated == null) accumulated = false;
                continue;
            }

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

    // ── 지표값 조회 (OHLC + 전일 OHLC 참조 지원) ──
    private double getIndicatorValue(String indicator, Map<String, double[]> indicatorValues,
                                      int index, double currentPrice,
                                      List<CandlestickResponse> candles, int localIndex) {
        if (indicator == null) return Double.NaN;
        String key = indicator.toUpperCase().trim();

        // 현재 봉 OHLC
        if ("PRICE".equals(key) || "CLOSE".equals(key)) return currentPrice;
        if ("OPEN".equals(key) && localIndex >= 0 && localIndex < candles.size()) return candles.get(localIndex).getOpen();
        if ("HIGH".equals(key) && localIndex >= 0 && localIndex < candles.size()) return candles.get(localIndex).getHigh();
        if ("LOW".equals(key) && localIndex >= 0 && localIndex < candles.size()) return candles.get(localIndex).getLow();
        if ("VOLUME".equals(key) && localIndex >= 0 && localIndex < candles.size()) return candles.get(localIndex).getVolume();

        // 전일 봉 OHLC
        if ("PREV_CLOSE".equals(key) && localIndex >= 1) return candles.get(localIndex - 1).getClose();
        if ("PREV_OPEN".equals(key) && localIndex >= 1) return candles.get(localIndex - 1).getOpen();
        if ("PREV_HIGH".equals(key) && localIndex >= 1) return candles.get(localIndex - 1).getHigh();
        if ("PREV_LOW".equals(key) && localIndex >= 1) return candles.get(localIndex - 1).getLow();
        if ("PREV_VOLUME".equals(key) && localIndex >= 1) return candles.get(localIndex - 1).getVolume();

        // 전일 변동폭 (변동성 돌파 전략용)
        if ("PREV_RANGE".equals(key) && localIndex >= 1) {
            return candles.get(localIndex - 1).getHigh() - candles.get(localIndex - 1).getLow();
        }

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

    // ── 수식 평가 엔진 (valueExpression) ──
    // 지원: 변수(OPEN, HIGH, LOW, CLOSE, PREV_HIGH, PREV_LOW, PREV_OPEN, PREV_CLOSE, PREV_RANGE, ATR 등)
    //       연산자(+, -, *, /), 괄호, 숫자 리터럴
    private double evaluateExpression(String expression, Map<String, double[]> indicatorValues,
                                       int index, double currentPrice,
                                       List<CandlestickResponse> candles, int localIndex) {
        if (expression == null || expression.isBlank()) return Double.NaN;
        try {
            String expr = expression.toUpperCase().trim();
            return parseExpression(expr, new int[]{0}, indicatorValues, index, currentPrice, candles, localIndex);
        } catch (Exception e) {
            return Double.NaN;
        }
    }

    // 재귀 하향 파서: expr = term ((+|-) term)*
    private double parseExpression(String expr, int[] pos, Map<String, double[]> iv,
                                    int index, double price, List<CandlestickResponse> candles, int li) {
        double result = parseTerm(expr, pos, iv, index, price, candles, li);
        while (pos[0] < expr.length()) {
            char c = expr.charAt(pos[0]);
            if (c == '+' || c == '-') {
                pos[0]++;
                double term = parseTerm(expr, pos, iv, index, price, candles, li);
                result = c == '+' ? result + term : result - term;
            } else break;
        }
        return result;
    }

    // term = factor ((*|/) factor)*
    private double parseTerm(String expr, int[] pos, Map<String, double[]> iv,
                              int index, double price, List<CandlestickResponse> candles, int li) {
        double result = parseFactor(expr, pos, iv, index, price, candles, li);
        while (pos[0] < expr.length()) {
            char c = expr.charAt(pos[0]);
            if (c == '*' || c == '/') {
                pos[0]++;
                double factor = parseFactor(expr, pos, iv, index, price, candles, li);
                result = c == '*' ? result * factor : (factor != 0 ? result / factor : Double.NaN);
            } else break;
        }
        return result;
    }

    // factor = '-' factor | '(' expr ')' | number | variable
    private double parseFactor(String expr, int[] pos, Map<String, double[]> iv,
                                int index, double price, List<CandlestickResponse> candles, int li) {
        while (pos[0] < expr.length() && expr.charAt(pos[0]) == ' ') pos[0]++;
        if (pos[0] >= expr.length()) return Double.NaN;

        // 음수 부호 처리: -factor → factor의 음수값
        if (expr.charAt(pos[0]) == '-') {
            pos[0]++;
            return -parseFactor(expr, pos, iv, index, price, candles, li);
        }

        // 괄호
        if (expr.charAt(pos[0]) == '(') {
            pos[0]++;
            double result = parseExpression(expr, pos, iv, index, price, candles, li);
            if (pos[0] < expr.length() && expr.charAt(pos[0]) == ')') {
                pos[0]++;
            } else {
                return Double.NaN; // 괄호 불일치 → 수식 오류
            }
            return result;
        }

        // 숫자 (정수, 소수)
        if (Character.isDigit(expr.charAt(pos[0])) || expr.charAt(pos[0]) == '.') {
            int start = pos[0];
            while (pos[0] < expr.length() && (Character.isDigit(expr.charAt(pos[0])) || expr.charAt(pos[0]) == '.')) pos[0]++;
            return Double.parseDouble(expr.substring(start, pos[0]));
        }

        // 변수 (알파벳+언더스코어)
        if (Character.isLetter(expr.charAt(pos[0])) || expr.charAt(pos[0]) == '_') {
            int start = pos[0];
            while (pos[0] < expr.length() && (Character.isLetterOrDigit(expr.charAt(pos[0])) || expr.charAt(pos[0]) == '_')) pos[0]++;
            String varName = expr.substring(start, pos[0]);
            while (pos[0] < expr.length() && expr.charAt(pos[0]) == ' ') pos[0]++;
            return getIndicatorValue(varName, iv, index, price, candles, li);
        }

        return Double.NaN;
    }

    // ── 샤프 비율 ──
    private double calculateSharpeRatio(List<BacktestResponse.DailyReturnDto> dailyReturns, String assetType) {
        if (dailyReturns.size() < 2) return 0;
        double[] returns = dailyReturns.stream().mapToDouble(d -> d.getDailyReturn() / 100.0).toArray();
        double mean = Arrays.stream(returns).average().orElse(0);
        double sumSquares = Arrays.stream(returns).map(r -> (r - mean) * (r - mean)).sum();
        double variance = returns.length > 1 ? sumSquares / (returns.length - 1) : 0;
        double stdDev = Math.sqrt(variance);
        if (stdDev == 0) return 0;
        double factor = ("STOCK".equalsIgnoreCase(assetType) || "US_STOCK".equalsIgnoreCase(assetType)) ? Math.sqrt(252) : Math.sqrt(365);
        return (mean / stdDev) * factor;
    }

    // ── 소르티노 비율 (하방 편차만 사용) ──
    private double calculateSortinoRatio(List<BacktestResponse.DailyReturnDto> dailyReturns, String assetType) {
        if (dailyReturns.size() < 2) return 0;
        double[] returns = dailyReturns.stream().mapToDouble(d -> d.getDailyReturn() / 100.0).toArray();
        double mean = Arrays.stream(returns).average().orElse(0);

        // 하방 편차: 전체 수익률에 min(r, 0)^2 적용 (표준 Sortino 공식)
        double downSumSquares = Arrays.stream(returns)
                .map(r -> r < 0 ? r * r : 0)
                .sum();
        double downVariance = returns.length > 1 ? downSumSquares / (returns.length - 1) : 0;
        double downDev = Math.sqrt(downVariance);
        if (downDev == 0) return 0;

        double factor = ("STOCK".equalsIgnoreCase(assetType) || "US_STOCK".equalsIgnoreCase(assetType)) ? Math.sqrt(252) : Math.sqrt(365);
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
