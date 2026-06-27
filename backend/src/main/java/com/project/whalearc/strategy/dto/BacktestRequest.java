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
    private String strategyName;        // 표시용 전략명(프리셋/직접조건 실행 시 — 저장 히스토리에 올바른 이름 보관)
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
    private String tradeDirection;      // LONG_ONLY(기본), SHORT_ONLY, LONG_SHORT, LONG_SHORT_FLAT(독립 롱+숏+flat)

    // 독립 양방향(LONG_SHORT_FLAT) 전용 — 숏 진입/청산 조건. null이면 숏 미평가(롱만 동작).
    // entryConditions/exitConditions 는 롱 진입/청산으로 해석된다.
    private List<Condition> shortEntryConditions;
    private List<Condition> shortExitConditions;

    // 다중 포지션 (분할매수)
    private Integer maxPositions;       // 최대 동시 포지션 수 (기본: 1)

    // 피라미딩(분할 진입) 추가 트리거: null/SIGNAL=진입신호 재충족 시 추가, ATR=직전진입가+ATR 돌파 시 추가(터틀)
    private String pyramidMode;

    // 레버리지 (선물). null/1 = 현물 동일(무회귀). >1이면 명목가=증거금×leverage, 손익·청산 증폭.
    private Integer leverage;

    // ─── 모멘텀 TopN 로테이션 (strategyType=MOMENTUM_ROTATION 일 때만) ───
    // null/미지정이면 기존 단일·2자산 경로(무회귀). 설정 시 유니버스 랭킹 로테이션 엔진으로 위임.
    private String strategyType;          // "MOMENTUM_ROTATION"
    private String momentumAssetType;     // 자산군: US_STOCK(기본)·ETF·STOCK(한국)·CRYPTO. 유니버스·레짐·통화 결정.
    private Integer topN;                 // 상위 N종목 (기본 5)
    private Integer lookbackDays;         // 모멘텀 거래일 수 (기본 252)
    private Boolean regimeFilter;         // 레짐 필터(벤치마크 200SMA, 기본 true)
    private Double regimeFloor;           // 약세장 노출 비율 (기본 0.5)
    private List<String> universe;        // 종목 풀. null/빈값이면 자산군 기본 풀
    private Double rebalanceBandPct;      // 잔존 종목 비중 유지 밴드(±%p, 기본 3)

    // 적립식 투자: 매월 첫 거래일에 추가 납입할 금액 (KRW)
    // null 또는 0 이면 적립식 off (기존 동작). 양수면 시뮬레이션 중 매월 첫 거래일마다 cash 에 가산.
    private Double monthlyContribution;

    // ─── 2자산 리밸런싱 (둘 다 채워져 있을 때만 활성화) ───
    // 두 자산 각각이 자기 캔들·지표로 매수/매도 신호를 평가하고,
    // 매수 시점 + 매월 첫 거래일에 비중을 firstAssetWeight 로 재조정한다.
    private String secondStockCode;
    private String secondStockName;
    private String secondAssetType;     // STOCK / CRYPTO / US_STOCK / ETF
    private Double firstAssetWeight;    // 0~100. 자산1 비중 (%). 자산2 비중 = 100 - 이 값. 기본 50.
    private String rebalanceFrequency;  // MONTHLY (기본) / QUARTERLY / YEARLY

    // 배당 처리 (미국주식·ETF 한정. 국내주식은 KIS 수정주가, 가상화폐는 무관)
    // null/true (기본): adjclose 사용 → 배당 자동 재투자 (Total Return)
    // false: 일반 close + 배당 지급일에 cash += qty × dividendPerShare (DRIP off, 현금 누적)
    private Boolean dividendReinvest;
}
