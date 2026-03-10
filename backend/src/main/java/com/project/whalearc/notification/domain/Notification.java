package com.project.whalearc.notification.domain;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@Document(collection = "notifications")
public class Notification {

    @Id
    private String id;

    @Indexed
    private String userId;

    private NotificationType type;
    private String title;
    private String message;
    private boolean read;
    private Map<String, String> metadata;
    private Instant createdAt;

    public enum NotificationType {
        LIMIT_ORDER_FILLED,      // 지정가 주문 체결
        MARKET_ORDER_FILLED,     // 시장가 주문 체결
        STRATEGY_EXECUTED,       // 전략(항로) 적용/해제
        TURTLE_TRADE             // 터틀 전략 매매 실행
    }

    public Notification(String userId, NotificationType type, String title, String message) {
        this.userId = userId;
        this.type = type;
        this.title = title;
        this.message = message;
        this.read = false;
        this.metadata = new HashMap<>();
        this.createdAt = Instant.now();
    }
}
