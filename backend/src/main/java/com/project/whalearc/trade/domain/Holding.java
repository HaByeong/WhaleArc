package com.project.whalearc.trade.domain;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Getter
@Setter
@NoArgsConstructor
public class Holding {

    private String stockCode;
    private String stockName;
    private BigDecimal quantity;
    private BigDecimal averagePrice;
    private BigDecimal currentPrice;
    private String assetType; // "STOCK" or "CRYPTO" (null → CRYPTO for backward compat)

    public Holding(String stockCode, String stockName, BigDecimal quantity, BigDecimal averagePrice) {
        this(stockCode, stockName, quantity, averagePrice, "CRYPTO");
    }

    public Holding(String stockCode, String stockName, BigDecimal quantity, BigDecimal averagePrice, String assetType) {
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

    public BigDecimal getMarketValue() {
        return currentPrice.multiply(quantity);
    }

    public BigDecimal getProfitLoss() {
        return currentPrice.subtract(averagePrice).multiply(quantity);
    }

    public BigDecimal getReturnRate() {
        if (averagePrice.compareTo(BigDecimal.ZERO) == 0) return BigDecimal.ZERO;
        return currentPrice.subtract(averagePrice)
                .divide(averagePrice, 10, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100));
    }
}
