package com.project.whalearc.strategy.domain;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * 터틀 트레이딩 전략의 심볼별 포지션 상태를 추적합니다.
 * 하나의 purchaseId(항로 구매)에 여러 심볼(BTC, ETH 등)의 포지션이 존재합니다.
 */
@Getter
@Setter
@NoArgsConstructor
@Document(collection = "turtle_positions")
@CompoundIndex(name = "idx_purchase_symbol", def = "{'purchaseId': 1, 'symbol': 1}", unique = true)
public class TurtlePosition {

    @Id
    private String id;

    @Indexed
    private String userId;
    private String purchaseId;
    private String symbol;

    /** 포지션 방향 */
    @Indexed
    private Direction direction = Direction.NONE;

    /** 첫 진입가 */
    private BigDecimal entryPrice;
    /** 마지막 진입가 (피라미딩 기준) */
    private BigDecimal lastEntryPrice;
    /** 평균 단가 */
    private BigDecimal avgPrice;
    /** 보유 유닛 수 (피라미딩) */
    private int units;
    /** 유닛당 배분 비중 */
    private BigDecimal unitWeight;
    /** 손절 라인 */
    private BigDecimal stopLoss;
    /** 트레일링 기준가 */
    private BigDecimal trailRef;

    /** 이 심볼에 할당된 투자금 (현금) */
    private BigDecimal allocatedCash;

    /** 누적 실현 손익 */
    private BigDecimal realizedPnl;
    private int tradeCount;
    private int winCount;

    private Instant createdAt;
    private Instant updatedAt;

    public enum Direction {
        NONE, LONG
    }

    public TurtlePosition(String userId, String purchaseId, String symbol, BigDecimal allocatedCash) {
        this.userId = userId;
        this.purchaseId = purchaseId;
        this.symbol = symbol;
        this.allocatedCash = allocatedCash;
        this.direction = Direction.NONE;
        this.units = 0;
        this.realizedPnl = BigDecimal.ZERO;
        this.tradeCount = 0;
        this.winCount = 0;
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }
}
