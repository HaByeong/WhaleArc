package com.project.whalearc.strategy.domain;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@Document(collection = "strategies")
public class Strategy {

    @Id
    private String id;

    @Indexed
    private String userId;

    private String name;
    private String description;
    private List<Indicator> indicators = new ArrayList<>();
    private List<Condition> entryConditions = new ArrayList<>();
    private List<Condition> exitConditions = new ArrayList<>();
    private List<String> targetAssets = new ArrayList<>();  // 투자 대상 자산 코드 (BTC, ETH, 005930 등)
    private Map<String, String> targetAssetNames = new HashMap<>(); // 자산코드 → 자산명 매핑
    private String assetType;       // CRYPTO, STOCK, MIXED
    private String strategyLogic;   // 전략 로직 설명
    @Indexed
    private boolean applied;        // 포트폴리오에 적용 여부
    private int appliedSuccessCount; // 적용 시 매수 성공 자산 수
    private int appliedTotalCount;   // 적용 시 전체 대상 자산 수
    private Instant createdAt;
    private Instant updatedAt;

    public Strategy(String userId, String name, String description,
                    List<Indicator> indicators,
                    List<Condition> entryConditions,
                    List<Condition> exitConditions) {
        this.userId = userId;
        this.name = name;
        this.description = description;
        this.indicators = indicators != null ? indicators : new ArrayList<>();
        this.entryConditions = entryConditions != null ? entryConditions : new ArrayList<>();
        this.exitConditions = exitConditions != null ? exitConditions : new ArrayList<>();
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public Strategy(String userId, String name, String description,
                    List<Indicator> indicators,
                    List<Condition> entryConditions,
                    List<Condition> exitConditions,
                    List<String> targetAssets, String assetType, String strategyLogic) {
        this(userId, name, description, indicators, entryConditions, exitConditions);
        this.targetAssets = targetAssets != null ? targetAssets : new ArrayList<>();
        this.assetType = assetType;
        this.strategyLogic = strategyLogic;
    }
}
