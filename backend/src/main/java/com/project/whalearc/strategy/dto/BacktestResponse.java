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
    // 비율형 지표는 분모가 0 이면 "정의 불가" 라 nullable 로 둔다 (프런트에서 "—" 표시).
    private Double profitFactor;          // 총 이익 / 총 손실. 손실 거래 0 건이면 null
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
    private Double recoveryFactor;        // 총 수익 / 최대 낙폭. maxDrawdown 0 이면 null
    private Double payoffRatio;           // 평균 이익 / 평균 손실. avgLoss 0 이면 null

    // 드로다운 데이터
    private List<EquityPointDto> drawdownCurve;

    // 가격 데이터 (매매 마커용)
    private List<PricePointDto> priceData;

    // 통화 정보 (US_STOCK 백테스트: "USD", 그 외: "KRW")
    private String currency;
    private double exchangeRate; // 시뮬레이션 시점의 USD/KRW 환율 (currency=USD일 때만 유효)

    // 적립식 투자 (monthlyContribution > 0 일 때만 의미 있음)
    // 단위는 initialCapital / finalValue 와 동일(native): currency=USD면 USD, KRW면 KRW.
    private double monthlyContribution;  // 월 납입액
    private double totalContribution;    // initialCapital + monthlyContribution × contributionCount
    private int contributionCount;       // 실제 적립 발생 횟수 (월 첫 거래일 hits)

    // ─── 2자산 리밸런싱 (secondStockCode 가 채워졌을 때만 의미) ───
    private String secondStockCode;
    private String secondStockName;
    private double firstAssetWeight;        // 0~100
    private double secondAssetWeight;       // 100 - firstAssetWeight
    // 단위는 initialCapital 과 동일(native, USD/KRW).
    private double firstAssetFinalValue;    // 자산1 의 종료 시점 평가가치 (cash + 보유)
    private double secondAssetFinalValue;   // 자산2 의 종료 시점 평가가치
    private int firstAssetTradeCount;       // 자산1 매매 발생 횟수
    private int secondAssetTradeCount;      // 자산2 매매 발생 횟수
    private int rebalanceCount;             // 리밸런싱 발생 횟수
    private String rebalanceFrequency;      // MONTHLY / QUARTERLY / YEARLY

    // 배당 처리
    private boolean dividendReinvest;       // true = adjclose 사용 (자동 재투자)
    private double totalDividendsReceived;  // OFF 모드일 때 누적 배당 cash 입금액 (native 단위)

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
