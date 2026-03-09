package com.project.whalearc.market.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class CandlestickResponse {
    private long time;       // Unix timestamp (seconds)
    private double open;
    private double high;
    private double low;
    private double close;
    private double volume;
}
