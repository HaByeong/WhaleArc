package com.project.whalearc.live.dto;

import com.project.whalearc.live.domain.LiveOrderLog;
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
    private final String marketType;
    private final Integer leverage;
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
    // ── 카드 표시용 확장 필드 ──
    private final int todayFilledCount;       // 오늘(KST) 체결 수
    private final LastOrderDto lastOrder;     // 가장 최근 주문(최근 신호), 없으면 null
    private final List<Double> equitySpark;   // 일별 평가손익률(%) 시계열, 스파크라인용
    // ── 모멘텀 로테이션 전용(아니면 null/기본값) ──
    private final String deploymentType;          // "MOMENTUM_ROTATION" or null
    private final Integer rotationTopN;
    private final Integer rotationLookbackDays;
    private final Boolean rotationRegimeFilter;
    private final Boolean rotationFullInvest;     // 자본 최대 활용 모드
    private final Boolean regimeBear;             // 현재 레짐 약세 여부
    private final List<String> currentTopHoldings;// 현 보유 top-N 심볼
    private final String lastRotationMonth;       // 마지막 리밸런싱 달(yyyy-MM)

    private DeploymentResponse(LiveStrategyDeployment d, int todayFilledCount,
                               LiveOrderLog lastOrder, List<Double> equitySpark) {
        this.id = d.getId();
        this.strategyId = d.getStrategyId();
        this.strategyName = d.getStrategyName();
        this.targetAssets = d.getTargetAssets();
        this.assetType = d.getAssetType();
        this.interval = d.getInterval();
        this.accountMode = d.getAccountMode() != null ? d.getAccountMode().name() : null;
        this.brokerType = d.getBrokerType() != null ? d.getBrokerType().name() : null;
        this.marketType = d.getMarketType() != null ? d.getMarketType().name() : null;
        this.leverage = d.getLeverage();
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
        this.todayFilledCount = todayFilledCount;
        this.lastOrder = lastOrder != null ? new LastOrderDto(lastOrder) : null;
        this.equitySpark = equitySpark != null ? equitySpark : List.of();
        this.deploymentType = d.getDeploymentType();
        this.rotationTopN = d.getRotationTopN();
        this.rotationLookbackDays = d.getRotationLookbackDays();
        this.rotationRegimeFilter = d.getRotationRegimeFilter();
        this.rotationFullInvest = d.isMomentumRotation() ? d.isRotationFullInvest() : null;
        this.regimeBear = d.isMomentumRotation() ? d.isRegimeBear() : null;
        this.currentTopHoldings = d.getCurrentTopHoldings() != null ? d.getCurrentTopHoldings() : List.of();
        this.lastRotationMonth = d.getLastRotationMonth();
    }

    /** 변이 응답 등 확장 데이터 없이 매핑(체결수 0·최근주문 null·스파크 빈 목록). */
    public static DeploymentResponse from(LiveStrategyDeployment d) {
        return new DeploymentResponse(d, 0, null, List.of());
    }

    /** 카드 표시용 확장 데이터 포함 매핑(목록·변이 응답 공용). */
    public static DeploymentResponse from(LiveStrategyDeployment d, int todayFilledCount,
                                          LiveOrderLog lastOrder, List<Double> equitySpark) {
        return new DeploymentResponse(d, todayFilledCount, lastOrder, equitySpark);
    }

    /** 최근 주문 요약 — 카드 '최근 신호' 표시용. */
    @Getter
    public static class LastOrderDto {
        private final String side;        // BUY / SELL
        private final String status;      // FILLED / REJECTED / SUBMITTED
        private final String reason;      // ENTRY / STOP / TAKE_PROFIT / EXIT_SIGNAL ...
        private final Instant createdAt;

        private LastOrderDto(LiveOrderLog o) {
            this.side = o.getSide();
            this.status = o.getStatus();
            this.reason = o.getReason();
            this.createdAt = o.getCreatedAt();
        }
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
