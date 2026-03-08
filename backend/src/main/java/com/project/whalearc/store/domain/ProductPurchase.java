package com.project.whalearc.store.domain;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

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
    private double paidPrice;
    private double investmentAmount;
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
        private double quantity;

        public PurchasedAsset(String code, double quantity) {
            this.code = code;
            this.quantity = quantity;
        }
    }

    public ProductPurchase(String userId, String productId, String productName,
                           double paidPrice, double investmentAmount) {
        this.userId = userId;
        this.productId = productId;
        this.productName = productName;
        this.paidPrice = paidPrice;
        this.investmentAmount = investmentAmount;
        this.status = Status.ACTIVE;
        this.purchasedAt = Instant.now();
    }
}
