package com.project.whalearc.ranking.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
@AllArgsConstructor
public class RankingEntryDto {
    private String portfolioId;
    private int rank;
    private String nickname;
    private String portfolioName;
    private double totalReturn;    // 수익률 (%)
    private double totalValue;     // 총 자산
    private int rankChange;        // 순위 변동 (현재는 0)

    @JsonProperty("isMyRanking")
    private boolean isMyRanking;

    // 대표 항로 정보
    private String routeName;         // 항로 이름 (null이면 미설정)
    private String routeStrategyType; // SIMPLE / TURTLE
    private Double routeReturnRate;   // 항로 수익률
    private String routeDescription;  // 전략 로직 요약
}
