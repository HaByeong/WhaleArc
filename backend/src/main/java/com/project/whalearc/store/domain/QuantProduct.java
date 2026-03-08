package com.project.whalearc.store.domain;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@Document(collection = "quant_products")
public class QuantProduct {

    @Id
    private String id;

    private String name;
    private String description;
    private String creatorId;
    private String creatorName;

    private Category category;
    private RiskLevel riskLevel;
    private double price;
    private double expectedReturn;
    private double maxDrawdown;
    private double sharpeRatio;
    private double winRate;
    private int totalTrades;
    private int subscribers;

    private List<String> tags = new ArrayList<>();
    private List<String> targetAssets = new ArrayList<>();
    private String strategyLogic;

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
}
