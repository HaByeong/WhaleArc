package com.project.whalearc.strategy.dto;

import com.project.whalearc.strategy.domain.Condition;
import com.project.whalearc.strategy.domain.Indicator;
import com.project.whalearc.strategy.domain.Strategy;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.time.Instant;
import java.util.List;

@Getter
@Builder
@AllArgsConstructor
public class StrategyResponse {
    private String id;
    private String name;
    private String description;
    private List<Indicator> indicators;
    private List<Condition> entryConditions;
    private List<Condition> exitConditions;
    private Instant createdAt;
    private Instant updatedAt;

    public static StrategyResponse from(Strategy s) {
        return StrategyResponse.builder()
                .id(s.getId())
                .name(s.getName())
                .description(s.getDescription())
                .indicators(s.getIndicators())
                .entryConditions(s.getEntryConditions())
                .exitConditions(s.getExitConditions())
                .createdAt(s.getCreatedAt())
                .updatedAt(s.getUpdatedAt())
                .build();
    }
}
