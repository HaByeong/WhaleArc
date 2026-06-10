package com.project.whalearc.strategy.service;

import com.project.whalearc.market.dto.CandlestickResponse;
import com.project.whalearc.strategy.domain.Condition;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * 전략 시그널 평가 엔진.
 *
 * <p>BacktestService에서 추출한 순수 평가 로직이다. 인스턴스 상태나 외부 의존성 없이
 * (지표값 맵 + 캔들 + 인덱스)만으로 진입/청산 조건의 충족 여부를 계산한다.
 * 백테스트와 라이브 자동매매가 동일한 시그널 로직을 공유하기 위한 공통 컴포넌트.
 *
 * <p>주의: 본 추출은 동작 보존(behavior-preserving) 리팩터링이다. 메서드 본문은
 * BacktestService의 기존 구현과 동일하다. AND/OR 우선순위·괄호 그룹 미지원,
 * 워밍업 구간 NaN의 OR 누적 유지, valueExpression 파싱 오류의 조용한 NaN 반환 등
 * 기존 동작상의 한계도 그대로 유지된다(별도 단계에서 개선 예정).
 */
@Component
public class SignalEvaluator {

    // ── 조건 평가 ──
    public boolean evaluateConditions(List<Condition> conditions,
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
}
