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

    private AlertCondition condition; // ABOVE, BELOW
    private double targetPrice;
    private boolean triggered;
    private boolean active;

    private Instant createdAt;
    private Instant triggeredAt;

    public enum AlertCondition {
        ABOVE,  // 목표가 이상 도달
        BELOW   // 목표가 이하 도달
    }

    public PriceAlert(String userId, String stockCode, String stockName, String assetType,
                      AlertCondition condition, double targetPrice) {
        this.userId = userId;
        this.stockCode = stockCode;
        this.stockName = stockName;
        this.assetType = assetType;
        this.condition = condition;
        this.targetPrice = targetPrice;
        this.triggered = false;
        this.active = true;
        this.createdAt = Instant.now();
    }
}
