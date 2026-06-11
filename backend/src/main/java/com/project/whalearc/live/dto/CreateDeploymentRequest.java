package com.project.whalearc.live.dto;

import com.project.whalearc.live.domain.LiveStrategyDeployment;
import com.project.whalearc.strategy.domain.Condition;
import com.project.whalearc.strategy.domain.Indicator;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.List;

/**
 * 라이브 자동매매 배포 생성 요청.
 *
 * <p>두 가지 모드: (1) strategyId로 저장된 전략을 가동 (2) 프리셋/직접 입력 —
 * indicators+entryConditions+exitConditions를 직접 전달(프리셋은 DB에 없으므로). 백테스트(BacktestRequest)와 동일한 패턴.
 */
@Getter
@Setter
public class CreateDeploymentRequest {

    /** 저장된 전략 사용 시 지정. 직접 입력(프리셋)이면 null. */
    private String strategyId;
    private String strategyName;

    // 직접 입력(프리셋) 모드용 — strategyId가 없을 때 사용
    private List<Indicator> indicators;
    private List<Condition> entryConditions;
    private List<Condition> exitConditions;
    // 독립 양방향(LONG_SHORT_FLAT) 전용 숏 조건 (선택)
    private List<Condition> shortEntryConditions;
    private List<Condition> shortExitConditions;

    // 매매 방향: null/LONG_ONLY(롱만) / LONG_SHORT_FLAT(독립 롱+숏+flat)
    private String tradeDirection;
    // 피라미딩 최대 유닛 수 (null/1=단일). 트리거: ATR / SIGNAL.
    private Integer maxUnits;
    private String pyramidMode;

    private List<String> targetAssets;
    private String assetType;
    private String interval;            // null이면 1h

    private BigDecimal allocatedCash;   // 총 할당 투자금 (KRW)

    private LiveStrategyDeployment.AccountMode accountMode;  // null이면 PAPER
    private LiveStrategyDeployment.BrokerType brokerType;    // null이면 MOCK

    // 거래 시장/레버리지 (Bitget 전용) — null이면 SPOT, leverage는 선물에서만 사용
    private LiveStrategyDeployment.MarketType marketType;
    private Integer leverage;

    // 리스크 파라미터 (퍼센트, 선택)
    private BigDecimal stopLossPct;
    private BigDecimal takeProfitPct;
    private BigDecimal trailingStopPct;

    // 일일 손실한도 (KRW 절대금액, 선택). 오늘 실현손실이 도달하면 자동 일시정지
    private BigDecimal dailyLossLimit;
}
