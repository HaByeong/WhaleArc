package com.project.whalearc.ranking.dto;

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
    private boolean isMyRanking;
}
