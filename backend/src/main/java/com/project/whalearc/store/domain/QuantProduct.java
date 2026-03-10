package com.project.whalearc.store.domain;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@Document(collection = "quant_products")
@CompoundIndex(name = "idx_active_category", def = "{'active': 1, 'category': 1, 'subscribers': -1}")
public class QuantProduct {

    @Id
    private String id;

    private String name;
    private String description;
    private String creatorId;
    private String creatorName;

    private Category category;
    private RiskLevel riskLevel;
    private BigDecimal price;
    private BigDecimal expectedReturn;
    private BigDecimal maxDrawdown;
    private BigDecimal sharpeRatio;
    private BigDecimal winRate;
    private int totalTrades;
    private int subscribers;

    private List<String> tags = new ArrayList<>();
    private List<String> targetAssets = new ArrayList<>();
    private String strategyLogic;

    /** SIMPLE: 균등 분배 즉시 매수, TURTLE: 터틀 트레이딩 자동매매 */
    private StrategyType strategyType = StrategyType.SIMPLE;

    /** STOCK: 주식 전용, CRYPTO: 가상화폐 전용 (null → CRYPTO 호환) */
    private String assetType; // "STOCK" or "CRYPTO"

    public boolean isStock() {
        return "STOCK".equals(assetType);
    }

    private boolean active;
    private Instant createdAt;
    private Instant updatedAt;

    public enum Category {
        MOMENTUM,
        MEAN_REVERSION,
        ARBITRAGE,
        TREND_FOLLOWING,
        VOLATILITY,
        MULTI_FACTOR
    }

    public enum RiskLevel {
        LOW, MEDIUM, HIGH
    }

    public enum StrategyType {
        SIMPLE, TURTLE
    }
}
