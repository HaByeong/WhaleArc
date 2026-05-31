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
        private double quantity;      // 보유수량 (코인/해외주식은 소수점)
        private long averagePrice;    // 평균매입가 (KRW 환산)
        private long currentPrice;    // 현재가 (KRW 환산)
        private long marketValue;     // 평가금액 (KRW 환산)
        private long profitLoss;      // 평가손익 (KRW 환산)
        private double returnRate;    // 수익률 %

        // 해외주식·외화 자산 표기를 위한 추가 필드 (국내주식·코인은 null/0)
        private String currency;              // 통화코드 (KRW, USD, HKD, JPY, CNY 등)
        private String exchange;              // 거래소 (NASD, NYSE, KOSPI 등), 코인은 null
        private Double originalAveragePrice;  // 외화 기준 평균매입가
        private Double originalCurrentPrice;  // 외화 기준 현재가
        private Double originalMarketValue;   // 외화 기준 평가금액
        private Double exchangeRate;          // 적용 환율 (외화 → KRW)
    }
}
