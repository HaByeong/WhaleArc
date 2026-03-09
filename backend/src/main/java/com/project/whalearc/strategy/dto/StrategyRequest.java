package com.project.whalearc.strategy.dto;

import com.project.whalearc.strategy.domain.Condition;
import com.project.whalearc.strategy.domain.Indicator;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
public class StrategyRequest {
    private String name;
    private String description;
    private List<Indicator> indicators;
    private List<Condition> entryConditions;
    private List<Condition> exitConditions;
    private List<String> targetAssets;
    private Map<String, String> targetAssetNames; // 자산코드 → 자산명
    private String assetType;       // CRYPTO, STOCK, MIXED
    private String strategyLogic;
}
