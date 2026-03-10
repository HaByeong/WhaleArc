package com.project.whalearc.strategy.dto;

import com.project.whalearc.strategy.domain.Condition;
import com.project.whalearc.strategy.domain.Indicator;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
public class BacktestRequest {
    private String strategyId;          // 항로 백테스트 모드: 기존 전략 ID
    private String stockCode;
    private String stockName;           // 종목명 (프론트에서 전달, 결과 표시용)
    private String startDate;           // yyyy-MM-dd
    private String endDate;             // yyyy-MM-dd
    private double initialCapital;
    private String assetType;           // STOCK or CRYPTO (null → auto-detect)

    // 종목 분석 모드: 전략 없이 조건 직접 입력
    private List<Indicator> indicators;
    private List<Condition> entryConditions;
    private List<Condition> exitConditions;

    // 리스크 관리
    private Double stopLossPercent;     // 손절 % (예: 5.0 → -5% 시 청산)
    private Double takeProfitPercent;   // 익절 % (예: 10.0 → +10% 시 청산)

    // 포지션 사이징
    private String positionSizing;      // ALL_IN, FIXED_AMOUNT, PERCENT (기본: ALL_IN)
    private Double positionValue;       // FIXED_AMOUNT → 금액, PERCENT → 비율(예: 50.0)

    // 슬리피지
    private Double slippagePercent;     // 슬리피지 % (예: 0.1 → 매수시 +0.1%, 매도시 -0.1%)

    // 트레일링 스탑
    private Double trailingStopPercent; // 트레일링 스탑 % (예: 5.0 → 고점 대비 -5% 하락 시 청산)

    // 수수료율
    private Double commissionRate;      // 수수료율 % (예: 0.1 → 0.1%, 기본값 0.1%)

    // 매매 방향
    private String tradeDirection;      // LONG_ONLY(기본), SHORT_ONLY, LONG_SHORT

    // 다중 포지션 (분할매수)
    private Integer maxPositions;       // 최대 동시 포지션 수 (기본: 1)
}
