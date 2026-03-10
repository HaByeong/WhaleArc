package com.project.whalearc.store.domain;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@Document(collection = "product_purchases")
public class ProductPurchase {

    @Id
    private String id;

    @Indexed
    private String userId;

    @Indexed
    private String productId;

    private String productName;
    private BigDecimal paidPrice;
    private BigDecimal investmentAmount;
    private List<PurchasedAsset> purchasedAssets = new ArrayList<>();
    private Status status;
    private Instant purchasedAt;

    public enum Status {
        ACTIVE, EXPIRED, REFUNDED
    }

    @Getter
    @Setter
    @NoArgsConstructor
    public static class PurchasedAsset {
        private String code;
        private BigDecimal quantity;
        private BigDecimal purchasePrice;

        public PurchasedAsset(String code, BigDecimal quantity) {
            this.code = code;
            this.quantity = quantity;
            this.purchasePrice = BigDecimal.ZERO;
        }

        public PurchasedAsset(String code, BigDecimal quantity, BigDecimal purchasePrice) {
            this.code = code;
            this.quantity = quantity;
            this.purchasePrice = purchasePrice;
        }
    }

    public ProductPurchase(String userId, String productId, String productName,
                           BigDecimal paidPrice, BigDecimal investmentAmount) {
        this.userId = userId;
        this.productId = productId;
        this.productName = productName;
        this.paidPrice = paidPrice;
        this.investmentAmount = investmentAmount;
        this.status = Status.ACTIVE;
        this.purchasedAt = Instant.now();
    }
}
