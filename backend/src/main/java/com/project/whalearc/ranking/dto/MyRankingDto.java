package com.project.whalearc.ranking.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
@AllArgsConstructor
public class MyRankingDto {
    private int currentRank;
    private int previousRank;
    private double totalReturn;
    private double totalValue;
}
