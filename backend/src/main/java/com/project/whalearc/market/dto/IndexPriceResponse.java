package com.project.whalearc.market.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class IndexPriceResponse {
    private String code;        // "KOSPI" or "KOSDAQ"
    private String name;        // "코스피" or "코스닥"
    private double price;       // 현재 지수
    private double change;      // 전일 대비
    private double changeRate;  // 전일 대비율 (%)
}
