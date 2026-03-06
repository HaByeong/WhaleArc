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
    private List<RankingEntryDto> rankings;
}
