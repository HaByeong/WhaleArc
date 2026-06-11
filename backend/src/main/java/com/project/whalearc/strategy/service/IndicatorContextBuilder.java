package com.project.whalearc.strategy.service;

import com.project.whalearc.market.dto.CandlestickResponse;
import com.project.whalearc.market.service.IndicatorCalculator;
import com.project.whalearc.strategy.domain.Condition;
import com.project.whalearc.strategy.domain.Indicator;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 캔들 리스트 → 지표값 맵(Map&lt;String, double[]&gt;) 빌더.
 *
 * <p>BacktestService에서 추출한 "지표 계산 글루" 로직이다. IndicatorCalculator(순수 계산기)
 * 위에, 전략의 지표 키 명명 규칙(MACD_SIGNAL / MA_20 / BOLLINGER_PCT_B / PRICE 별칭 등),
 * 조건이 참조하는 지표 키 자동 추가, 크로스오버 합성키(A_CROSS_B) 분해를 얹는다.
 * 이 글루가 있어야 SignalEvaluator가 기대하는 형태의 맵이 만들어지므로,
 * 백테스트와 라이브 자동매매가 동일한 지표 컨텍스트를 공유하기 위한 공통 컴포넌트다.
 *
 * <p>주의: 동작 보존(behavior-preserving) 추출이다. 메서드 본문은 BacktestService의 기존
 * 구현과 동일하다(같은 기본 파라미터·NaN 워밍업·키 매핑). 입력 candles는 호출자가 반드시
 * 시간순(과거→현재)으로 정렬해 넘겨야 한다.
 */
@Component
public class IndicatorContextBuilder {

    public Map<String, double[]> calculateIndicators(List<CandlestickResponse> candles,
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
            case "ADX" -> {
                int period = getParam(params, "period", 14);
                double[] adx = IndicatorCalculator.adx(highs, lows, closes, period);
                result.put("ADX", adx);
                result.put("ADX_" + period, adx);
            }
            case "DONCHIAN" -> {
                int period = getParam(params, "period", 20);
                double[] dHigh = IndicatorCalculator.donchianHigh(highs, period);
                double[] dLow = IndicatorCalculator.donchianLow(lows, period);
                result.put("DONCHIAN_HIGH", dHigh);
                result.put("DONCHIAN_LOW", dLow);
                result.put("DONCHIAN_HIGH_" + period, dHigh);
                result.put("DONCHIAN_LOW_" + period, dLow);
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
        } else if ("ADX".equals(key) && !result.containsKey("ADX")) {
            calculateIndicator("ADX", Map.of(), closes, highs, lows, volumes, result);
        } else if (key.startsWith("ADX_") && key.matches("ADX_\\d+")) {
            int period = Integer.parseInt(key.substring(4));
            calculateIndicator("ADX", Map.of("period", (Number) period), closes, highs, lows, volumes, result);
        } else if ((key.equals("DONCHIAN_HIGH") || key.equals("DONCHIAN_LOW")) && !result.containsKey(key)) {
            calculateIndicator("DONCHIAN", Map.of(), closes, highs, lows, volumes, result);
        } else if (key.matches("DONCHIAN_(HIGH|LOW)_\\d+")) {
            int period = Integer.parseInt(key.substring(key.lastIndexOf('_') + 1));
            calculateIndicator("DONCHIAN", Map.of("period", (Number) period), closes, highs, lows, volumes, result);
        }
    }

    private int getParam(Map<String, Number> params, String key, int defaultValue) {
        Number val = params.get(key);
        return val != null ? val.intValue() : defaultValue;
    }
}
