package com.project.whalearc.market.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.Map;

/**
 * 기술적 지표 API 응답 DTO.
 *
 * type별 data 키 구조:
 *  - RSI      : { "values": double[] }
 *  - MACD     : { "macd": double[], "signal": double[], "histogram": double[] }
 *  - MA       : { "values": double[] }
 *  - BOLLINGER: { "upper": double[], "middle": double[], "lower": double[] }
 */
@Getter
@AllArgsConstructor
public class IndicatorResponse {
    private String type;
    private Map<String, double[]> data;
    private Map<String, Number> parameters;
}
