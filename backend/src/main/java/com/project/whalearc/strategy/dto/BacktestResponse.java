package com.project.whalearc.strategy.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;
import java.util.Map;

@Getter
@Builder
public class BacktestResponse {
    private String id;
    private String strategyId;
    private String strategyName;
    private String stockCode;
    private String stockName;
    private String startDate;
    private String endDate;
    private double initialCapital;
    private double finalValue;
    private double totalReturn;
    private double totalReturnRate;
    private double maxDrawdown;
    private double sharpeRatio;
    private double winRate;
    private int totalTrades;
    private int profitableTrades;
    private int losingTrades;
    private List<DailyReturnDto> dailyReturns;
    private List<EquityPointDto> equityCurve;
    private List<TradeDto> trades;

    // Buy & Hold 벤치마크
    private double buyHoldReturnRate;
    private List<EquityPointDto> buyHoldCurve;

    // 고급 지표
    private double profitFactor;          // 총 이익 / 총 손실
    private double sortinoRatio;          // 하방 리스크만 고려한 샤프 비율
    private double cagr;                  // 연평균 복합 성장률 (%)
    private double avgWin;                // 평균 이익 금액
    private double avgLoss;               // 평균 손실 금액
    private double avgWinRate;            // 평균 이익률 (%)
    private double avgLossRate;           // 평균 손실률 (%)
    private double maxConsecutiveWins;    // 최대 연승
    private double maxConsecutiveLosses;  // 최대 연패
    private double avgHoldingDays;        // 평균 보유 기간 (일)
    private double maxDrawdownDuration;   // 최대 낙폭 지속 기간 (일)
    private double recoveryFactor;        // 총 수익 / 최대 낙폭
    private double payoffRatio;           // 평균 이익 / 평균 손실 (RR비율)

    // 드로다운 데이터
    private List<EquityPointDto> drawdownCurve;

    // 가격 데이터 (매매 마커용)
    private List<PricePointDto> priceData;

    // 지표 요약 (0-trade 디버깅용: 지표명 → {min, max, avg, last})
    private Map<String, IndicatorSummaryDto> indicatorSummary;

    @Getter
    @Builder
    public static class DailyReturnDto {
        private String date;
        private double dailyReturn;
        private double cumulativeReturn;
        private double portfolioValue;
    }

    @Getter
    @Builder
    public static class EquityPointDto {
        private String date;
        private double value;
    }

    @Getter
    @Builder
    public static class TradeDto {
        private String date;
        private String type;       // BUY or SELL
        private double price;
        private double quantity;
        private double pnl;
        private double pnlPercent;
        private String reason;
        private int holdingDays;   // 보유 기간 (SELL일 때만)
        private double balance;    // 거래 후 잔고
    }

    @Getter
    @Builder
    public static class PricePointDto {
        private String date;
        private double open;
        private double high;
        private double low;
        private double close;
        private double volume;
    }

    @Getter
    @Builder
    public static class IndicatorSummaryDto {
        private double min;
        private double max;
        private double avg;
        private double last;
    }
}
