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
    private String assetType; // "STOCK" or "CRYPTO" (null → CRYPTO for backward compat)

    public Holding(String stockCode, String stockName, double quantity, double averagePrice) {
        this(stockCode, stockName, quantity, averagePrice, "CRYPTO");
    }

    public Holding(String stockCode, String stockName, double quantity, double averagePrice, String assetType) {
        this.stockCode = stockCode;
        this.stockName = stockName;
        this.quantity = quantity;
        this.averagePrice = averagePrice;
        this.currentPrice = averagePrice;
        this.assetType = assetType;
    }

    /** 주식 여부 판단 (null/빈값은 CRYPTO로 간주) */
    public boolean isStock() {
        return "STOCK".equals(assetType);
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
