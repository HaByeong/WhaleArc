package com.project.whalearc.trade.domain;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@Document(collection = "trades")
@CompoundIndex(name = "idx_user_executed", def = "{'userId': 1, 'executedAt': -1}")
public class TradeRecord {

    @Id
    private String id;

    @Indexed
    private String userId;

    private String orderId;
    private String stockCode;
    private String stockName;
    private Order.OrderType orderType;
    private String assetType;
    private BigDecimal quantity;
    private BigDecimal price;
    private BigDecimal totalAmount;
    private BigDecimal commission;
    private BigDecimal netAmount;
    private Instant executedAt;

    private static final BigDecimal COMMISSION_RATE = new BigDecimal("0.001");

    public TradeRecord(String userId, Order order, BigDecimal executionPrice) {
        this.userId = userId;
        this.orderId = order.getId();
        this.stockCode = order.getStockCode();
        this.stockName = order.getStockName();
        this.orderType = order.getOrderType();
        this.assetType = order.getAssetType();
        this.quantity = order.getQuantity();
        this.price = executionPrice;
        this.totalAmount = executionPrice.multiply(order.getQuantity());
        this.commission = this.totalAmount.multiply(COMMISSION_RATE);
        this.netAmount = (order.getOrderType() == Order.OrderType.BUY)
                ? this.totalAmount.add(this.commission)
                : this.totalAmount.subtract(this.commission);
        this.executedAt = Instant.now();
    }
}
