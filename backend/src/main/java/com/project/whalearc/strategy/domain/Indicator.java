package com.project.whalearc.strategy.domain;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Indicator {
    private IndicatorType type;
    private Map<String, Number> parameters;

    public enum IndicatorType {
        RSI, MACD, MA, BOLLINGER_BANDS
    }
}
