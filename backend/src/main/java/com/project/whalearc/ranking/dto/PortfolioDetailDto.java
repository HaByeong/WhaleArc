package com.project.whalearc.ranking.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class PortfolioDetailDto {
    private String portfolioId;
    private String portfolioName;
    private String nickname;
    private int currentRank;
    private double totalReturn;        // 수익률 (%) — 절대 금액(원금·총자산·수익금액)은 프라이버시상 비공개

    // 요약 정보만 공개 (프라이버시 보호)
    private int stockCount;            // 보유 주식 종목 수
    private int cryptoCount;           // 보유 가상화폐 종목 수

    // 대표 항로
    private String routeName;
    private String routeStrategyType;
    private Double routeReturnRate;
    private String routeDescription;
}
