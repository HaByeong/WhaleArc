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
    private double averagePrice;   // 평균매입가(표시 통화 기준)
    private double currentPrice;   // 현재가(표시 통화 기준)
    private double marketValue;    // 평가금액(표시 통화 기준)
    private double profitLoss;     // 손익(표시 통화 기준)
    private double returnRate;     // 수익률(%)
    private String currency;       // 단가/평가 표시 통화: "KRW"(국내) | "USD"(해외)

    /** 기존 8-arg 호출부 호환 — currency 기본 KRW. */
    public ExchangeHoldingDto(String assetCode, String assetName, double quantity, double averagePrice,
                              double currentPrice, double marketValue, double profitLoss, double returnRate) {
        this(assetCode, assetName, quantity, averagePrice, currentPrice, marketValue, profitLoss, returnRate, "KRW");
    }
}
