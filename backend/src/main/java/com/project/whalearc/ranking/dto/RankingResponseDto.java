package com.project.whalearc.ranking.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
@AllArgsConstructor
public class RankingResponseDto {
    private String rankingType;
    private String snapshotDate;
    private int totalCount;
    private int page;
    private int size;
    private int totalPages;
    private double avgReturn;
    private int positiveCount;
    private int negativeCount;
    private List<RankingEntryDto> rankings;
}
