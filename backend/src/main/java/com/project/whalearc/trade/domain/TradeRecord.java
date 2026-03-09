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
@Document(collection = "trades")
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
    private double quantity;
    private double price;
    private double totalAmount;
    private double commission;
    private double netAmount;
    private Instant executedAt;

    public TradeRecord(String userId, Order order, double executionPrice) {
        this.userId = userId;
        this.orderId = order.getId();
        this.stockCode = order.getStockCode();
        this.stockName = order.getStockName();
        this.orderType = order.getOrderType();
        this.assetType = order.getAssetType();
        this.quantity = order.getQuantity();
        this.price = executionPrice;
        this.totalAmount = executionPrice * order.getQuantity();
        this.commission = this.totalAmount * 0.001; // 0.1% 수수료
        this.netAmount = (order.getOrderType() == Order.OrderType.BUY)
                ? this.totalAmount + this.commission
                : this.totalAmount - this.commission;
        this.executedAt = Instant.now();
    }
}
