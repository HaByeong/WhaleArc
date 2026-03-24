package com.project.whalearc.strategy.domain;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Condition {
    private String indicator;
    private Operator operator;
    private BigDecimal value;
    private Logic logic;

    /**
     * 수식 기반 비교값 (선택).
     * 설정하면 value 대신 이 수식을 런타임에 계산하여 비교합니다.
     * 예: "OPEN + (PREV_HIGH - PREV_LOW) * 0.5"
     * 지원 변수: PRICE, OPEN, HIGH, LOW, CLOSE, VOLUME,
     *           PREV_OPEN, PREV_HIGH, PREV_LOW, PREV_CLOSE, PREV_VOLUME, PREV_RANGE,
     *           RSI, MACD, MA, EMA, ATR, CCI, WILLIAMS_R, OBV, BOLLINGER_PCT_B, STOCH_K, STOCH_D 등 모든 지표
     * 지원 연산: +, -, *, /, 괄호, 음수(-)
     */
    private String valueExpression;

    public enum Operator { GT, LT, EQ, GTE, LTE }
    public enum Logic { AND, OR }
}
