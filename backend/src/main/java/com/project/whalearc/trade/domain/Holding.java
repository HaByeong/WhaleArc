package com.project.whalearc.trade.domain;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class Holding {

    private String stockCode;
    private String stockName;
    private double quantity;
    private double averagePrice;
    private double currentPrice;

    public Holding(String stockCode, String stockName, double quantity, double averagePrice) {
        this.stockCode = stockCode;
        this.stockName = stockName;
        this.quantity = quantity;
        this.averagePrice = averagePrice;
        this.currentPrice = averagePrice;
    }

    public double getMarketValue() {
        return currentPrice * quantity;
    }

    public double getProfitLoss() {
        return (currentPrice - averagePrice) * quantity;
    }

    public double getReturnRate() {
        if (averagePrice == 0) return 0;
        return ((currentPrice - averagePrice) / averagePrice) * 100;
    }
}
