package com.project.whalearc.live.dto;

import com.project.whalearc.live.domain.LiveStrategyDeployment;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * 배포 조회 응답. 전략 스냅샷(indicators/conditions) 같은 내부 디테일은 제외하고
 * 화면에 필요한 요약 + 심볼별 포지션 현황만 노출한다.
 */
@Getter
public class DeploymentResponse {

    private final String id;
    private final String strategyId;
    private final String strategyName;
    private final List<String> targetAssets;
    private final String assetType;
    private final String interval;
    private final String accountMode;
    private final String brokerType;
    private final String status;
    private final BigDecimal allocatedCash;
    private final BigDecimal stopLossPct;
    private final BigDecimal takeProfitPct;
    private final BigDecimal trailingStopPct;
    private final BigDecimal dailyLossLimit;
    private final BigDecimal todayRealizedPnl;
    private final BigDecimal realizedPnl;
    private final int tradeCount;
    private final int winCount;
    private final List<PositionDto> positions;
    private final Instant lastEvaluatedAt;
    private final Instant createdAt;

    private DeploymentResponse(LiveStrategyDeployment d) {
        this.id = d.getId();
        this.strategyId = d.getStrategyId();
        this.strategyName = d.getStrategyName();
        this.targetAssets = d.getTargetAssets();
        this.assetType = d.getAssetType();
        this.interval = d.getInterval();
        this.accountMode = d.getAccountMode() != null ? d.getAccountMode().name() : null;
        this.brokerType = d.getBrokerType() != null ? d.getBrokerType().name() : null;
        this.status = d.getStatus() != null ? d.getStatus().name() : null;
        this.allocatedCash = d.getAllocatedCash();
        this.stopLossPct = d.getStopLossPct();
        this.takeProfitPct = d.getTakeProfitPct();
        this.trailingStopPct = d.getTrailingStopPct();
        this.dailyLossLimit = d.getDailyLossLimit();
        this.todayRealizedPnl = d.getTodayRealizedPnl();
        this.realizedPnl = d.getRealizedPnl();
        this.tradeCount = d.getTradeCount();
        this.winCount = d.getWinCount();
        this.positions = d.getPositions() == null ? List.of()
                : d.getPositions().stream().map(PositionDto::new).toList();
        this.lastEvaluatedAt = d.getLastEvaluatedAt();
        this.createdAt = d.getCreatedAt();
    }

    public static DeploymentResponse from(LiveStrategyDeployment d) {
        return new DeploymentResponse(d);
    }

    @Getter
    public static class PositionDto {
        private final String symbol;
        private final String assetType;
        private final String direction;
        private final BigDecimal avgPrice;
        private final BigDecimal quantity;
        private final BigDecimal allocatedCash;
        private final BigDecimal stopLoss;
        private final BigDecimal realizedPnl;
        private final int tradeCount;
        private final int winCount;

        private PositionDto(LiveStrategyDeployment.LivePosition p) {
            this.symbol = p.getSymbol();
            this.assetType = p.getAssetType();
            this.direction = p.getDirection() != null ? p.getDirection().name() : null;
            this.avgPrice = p.getAvgPrice();
            this.quantity = p.getQuantity();
            this.allocatedCash = p.getAllocatedCash();
            this.stopLoss = p.getStopLoss();
            this.realizedPnl = p.getRealizedPnl();
            this.tradeCount = p.getTradeCount();
            this.winCount = p.getWinCount();
        }
    }
}
