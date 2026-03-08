package com.project.whalearc.market.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class CandlestickResponse {
    private long time;       // Unix timestamp (seconds)
    private long open;
    private long high;
    private long low;
    private long close;
    private double volume;
}
