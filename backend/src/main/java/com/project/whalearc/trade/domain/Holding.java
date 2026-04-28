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
    private String assetType; // "STOCK", "CRYPTO", "US_STOCK", "ETF" (null → CRYPTO for backward compat)

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

    /** 국내주식 여부 판단 (null/빈값은 CRYPTO로 간주) */
    public boolean isStock() {
        return "STOCK".equals(assetType);
    }

    /** 미국주식 여부 판단 */
    public boolean isUsStock() {
        return "US_STOCK".equals(assetType);
    }

    /** 미국 ETF 여부 판단 (USD 단위 거래·평가 — US_STOCK 과 동일 환율 파이프) */
    public boolean isEtf() {
        return "ETF".equals(assetType);
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
