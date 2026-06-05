package com.project.whalearc.exchange.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ExchangeHoldingDto {
    private String assetCode;      // 종목코드 or 코인심볼
    private String assetName;      // 종목명 or 코인명
    private double quantity;       // 보유수량
    private double averagePrice;   // 평균매입가
    private double currentPrice;   // 현재가
    private double marketValue;    // 평가금액
    private double profitLoss;     // 손익
    private double returnRate;     // 수익률
}
