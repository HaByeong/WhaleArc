package com.project.whalearc.store.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class PurchasePerformanceDto {
    private String purchaseId;
    private String productName;
    private String strategyType;
    private double investmentAmount;
    private double totalCurrentValue;
    private double totalPnl;
    private double totalReturnRate;
    private List<AssetPerformance> assets;

    // 터틀 전용
    private Double realizedPnl;
    private Double unrealizedPnl;
    private Integer totalTradeCount;
    private Integer totalWinCount;

    @Getter
    @Builder
    public static class AssetPerformance {
        private String code;
        private String name;
        private double quantity;
        private double purchasePrice;
        private double currentPrice;
        private double pnl;
        private double returnRate;

        // 터틀 전용
        private String direction;
        private Double realizedPnl;
        private Integer tradeCount;
        private Integer winCount;
    }
}
