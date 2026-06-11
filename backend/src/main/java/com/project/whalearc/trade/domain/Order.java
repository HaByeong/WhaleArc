package com.project.whalearc.trade.domain;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@Document(collection = "orders")
@CompoundIndexes({
    @CompoundIndex(name = "idx_status_method", def = "{'status': 1, 'orderMethod': 1}"),
    @CompoundIndex(name = "idx_user_created", def = "{'userId': 1, 'createdAt': -1}"),
    // 멱등성 조회 + 이중체결 방지용 unique(부분: clientOrderId가 문자열일 때만 — null 주문은 제외).
    // ※ auto-index-creation 이 꺼져 있으면 자동 생성되지 않으므로, 멀티 인스턴스 운영 시
    //   배포에서 이 인덱스를 수동 생성하거나 auto-index-creation 활성화 필요. 단일 인스턴스는 UserLockRegistry로 직렬화됨.
    @CompoundIndex(name = "idx_user_clientorder", def = "{'userId': 1, 'clientOrderId': 1}",
            unique = true, partialFilter = "{ 'clientOrderId': { $type: 'string' } }")
})
public class Order {

    @Id
    private String id;

    @Indexed
    private String userId;

    private String stockCode;
    private String stockName;
    private OrderType orderType;
    private OrderMethod orderMethod;
    private BigDecimal quantity;
    private BigDecimal price;
    private OrderStatus status;
    private BigDecimal filledQuantity;
    private BigDecimal filledPrice;
    private String assetType; // "STOCK", "CRYPTO", "US_STOCK", "ETF" (null → CRYPTO)
    private String memo;
    private String clientOrderId; // 멱등성 키 (null = 내부/서버 발행 주문)
    private Instant createdAt;
    private Instant updatedAt;

    // BUY=롱 개시, SELL=롱 청산, SHORT=숏 개시, COVER=숏 청산.
    // SHORT/COVER는 Bitget 선물(FUTURES)에서만 실거래된다(현물/KIS 미지원). OrderService(모의 현물 장부)는 BUY/SELL만 받는다.
    public enum OrderType { BUY, SELL, SHORT, COVER }
    public enum OrderMethod { MARKET, LIMIT }
    public enum OrderStatus { PENDING, FILLED, CANCELLED }

    public Order(String userId, String stockCode, String stockName,
                 OrderType orderType, OrderMethod orderMethod,
                 BigDecimal quantity, BigDecimal price) {
        this(userId, stockCode, stockName, orderType, orderMethod, quantity, price, "CRYPTO");
    }

    public Order(String userId, String stockCode, String stockName,
                 OrderType orderType, OrderMethod orderMethod,
                 BigDecimal quantity, BigDecimal price, String assetType) {
        this.userId = userId;
        this.stockCode = stockCode;
        this.stockName = stockName;
        this.orderType = orderType;
        this.orderMethod = orderMethod;
        this.quantity = quantity;
        this.price = price;
        this.assetType = assetType;
        this.status = OrderStatus.PENDING;
        this.filledQuantity = BigDecimal.ZERO;
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public boolean isStock() {
        return "STOCK".equals(assetType);
    }

    public boolean isUsStock() {
        return "US_STOCK".equals(assetType);
    }

    public boolean isEtf() {
        return "ETF".equals(assetType);
    }
}
