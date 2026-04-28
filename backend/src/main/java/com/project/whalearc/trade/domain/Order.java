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
    @CompoundIndex(name = "idx_user_created", def = "{'userId': 1, 'createdAt': -1}")
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
    private Instant createdAt;
    private Instant updatedAt;

    public enum OrderType { BUY, SELL }
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
