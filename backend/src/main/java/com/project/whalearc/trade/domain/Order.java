package com.project.whalearc.trade.domain;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@Document(collection = "orders")
public class Order {

    @Id
    private String id;

    @Indexed
    private String userId;

    private String stockCode;
    private String stockName;
    private OrderType orderType;
    private OrderMethod orderMethod;
    private double quantity;
    private double price;
    private OrderStatus status;
    private double filledQuantity;
    private Double filledPrice;
    private String assetType; // "STOCK" or "CRYPTO"
    private Instant createdAt;
    private Instant updatedAt;

    public enum OrderType { BUY, SELL }
    public enum OrderMethod { MARKET, LIMIT }
    public enum OrderStatus { PENDING, FILLED, CANCELLED }

    public Order(String userId, String stockCode, String stockName,
                 OrderType orderType, OrderMethod orderMethod,
                 double quantity, double price) {
        this(userId, stockCode, stockName, orderType, orderMethod, quantity, price, "CRYPTO");
    }

    public Order(String userId, String stockCode, String stockName,
                 OrderType orderType, OrderMethod orderMethod,
                 double quantity, double price, String assetType) {
        this.userId = userId;
        this.stockCode = stockCode;
        this.stockName = stockName;
        this.orderType = orderType;
        this.orderMethod = orderMethod;
        this.quantity = quantity;
        this.price = price;
        this.assetType = assetType;
        this.status = OrderStatus.PENDING;
        this.filledQuantity = 0.0;
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public boolean isStock() {
        return "STOCK".equals(assetType);
    }
}
