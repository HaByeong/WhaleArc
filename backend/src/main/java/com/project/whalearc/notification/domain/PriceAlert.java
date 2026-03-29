package com.project.whalearc.notification.domain;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * 가격 알림 설정.
 * 사용자가 설정한 목표가에 도달하면 알림을 생성한다.
 */
@Getter
@Setter
@NoArgsConstructor
@Document(collection = "price_alerts")
public class PriceAlert {

    @Id
    private String id;

    @Indexed
    private String userId;

    private String stockCode;
    private String stockName;
    private String assetType;        // STOCK, CRYPTO

    private AlertCondition condition; // ABOVE, BELOW, CHANGE_UP, CHANGE_DOWN
    private double targetPrice;
    private double changePercent;     // 변동률 기준 (예: 5.0 = 5%) - CHANGE_UP/CHANGE_DOWN 전용
    private boolean triggered;
    private boolean active;

    private Instant createdAt;
    private Instant triggeredAt;

    public enum AlertCondition {
        ABOVE,       // 목표가 이상 도달
        BELOW,       // 목표가 이하 도달
        CHANGE_UP,   // 급등: N% 이상 상승
        CHANGE_DOWN  // 급락: N% 이상 하락
    }

    public PriceAlert(String userId, String stockCode, String stockName, String assetType,
                      AlertCondition condition, double targetPrice) {
        this(userId, stockCode, stockName, assetType, condition, targetPrice, 0);
    }

    public PriceAlert(String userId, String stockCode, String stockName, String assetType,
                      AlertCondition condition, double targetPrice, double changePercent) {
        this.userId = userId;
        this.stockCode = stockCode;
        this.stockName = stockName;
        this.assetType = assetType;
        this.condition = condition;
        this.targetPrice = targetPrice;
        this.changePercent = changePercent;
        this.triggered = false;
        this.active = true;
        this.createdAt = Instant.now();
    }
}
