package com.project.whalearc.strategy.dto;

import com.project.whalearc.strategy.domain.SavedBacktest;
import lombok.Builder;
import lombok.Getter;

/** 백테스트 히스토리 목록 항목 (요약 — 무거운 곡선/거래내역 제외). */
@Getter
@Builder
public class BacktestHistoryItemDto {
    private String id;
    private String strategyName;
    private String stockCode;
    private String stockName;
    private String startDate;
    private String endDate;
    private double totalReturnRate;
    private double sharpeRatio;
    private double maxDrawdown;
    private int totalTrades;
    private Double winRate;  // 승률(%) — 구 레코드는 null
    private long createdAt; // epoch millis

    public static BacktestHistoryItemDto from(SavedBacktest s) {
        return BacktestHistoryItemDto.builder()
                .id(s.getId())
                .strategyName(s.getStrategyName())
                .stockCode(s.getStockCode())
                .stockName(s.getStockName())
                .startDate(s.getStartDate())
                .endDate(s.getEndDate())
                .totalReturnRate(s.getTotalReturnRate())
                .sharpeRatio(s.getSharpeRatio())
                .maxDrawdown(s.getMaxDrawdown())
                .totalTrades(s.getTotalTrades())
                .winRate(s.getWinRate())
                .createdAt(s.getCreatedAt() != null ? s.getCreatedAt().toEpochMilli() : 0L)
                .build();
    }
}
