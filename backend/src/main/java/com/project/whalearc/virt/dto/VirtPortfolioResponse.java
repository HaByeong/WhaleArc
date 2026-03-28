package com.project.whalearc.virt.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class VirtPortfolioResponse {
    private long totalValue;          // 총 평가금액
    private long cashBalance;         // 예수금(현금)
    private long holdingsValue;       // 보유종목 평가금액
    private long totalPnl;            // 총 손익
    private double returnRate;        // 수익률 %
    private Double usdtKrwRate;       // USDT/KRW 환율 (비트겟 전용, null이면 미사용)
    private List<VirtHolding> holdings;

    @Getter
    @Builder
    public static class VirtHolding {
        private String stockCode;     // 종목코드
        private String stockName;     // 종목명
        private double quantity;      // 보유수량 (코인은 소수점)
        private long averagePrice;    // 평균매입가
        private long currentPrice;    // 현재가
        private long marketValue;     // 평가금액
        private long profitLoss;      // 평가손익
        private double returnRate;    // 수익률 %
    }
}
