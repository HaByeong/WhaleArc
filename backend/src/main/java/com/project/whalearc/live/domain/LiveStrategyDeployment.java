package com.project.whalearc.live.domain;

import com.project.whalearc.strategy.domain.Condition;
import com.project.whalearc.strategy.domain.Indicator;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * 라이브 자동매매 "배포(deployment)" — 하나의 전략을 특정 계좌에 일정 금액으로 가동하는 단위.
 *
 * <p>터틀의 TurtlePosition(심볼 1개 = 레코드 1개)을 일반화한 모델이다. 한 배포가 여러 심볼을
 * 들고 있고, 심볼별 라이브 상태(LivePosition)를 임베드한다. 전략 정의(지표/진입·청산 조건)는
 * 배포 시점에 깊은 복사로 "동결"되어, 사용자가 원본 전략을 수정해도 가동 중 배포는 흔들리지 않는다.
 *
 * <p>1단계 범위: accountMode=PAPER(모의 가상자금) + brokerType=MOCK + assetType=CRYPTO 위주.
 * 실계좌(LIVE)·주식 자산군·다중 포지션(피라미딩)은 이후 단계에서 확장한다.
 */
@Getter
@Setter
@NoArgsConstructor
@Document(collection = "live_strategy_deployments")
public class LiveStrategyDeployment {

    @Id
    private String id;

    @Indexed
    private String userId;

    /** 원본 전략 id (프리셋/직접 입력이면 null). 스냅샷 출처 추적용. */
    private String strategyId;
    private String strategyName;

    // ── 전략 스냅샷 (배포 시점 깊은 복사로 동결) ──
    private List<Indicator> indicators = new ArrayList<>();
    private List<Condition> entryConditions = new ArrayList<>();   // 롱 진입 (LSF에서 롱 entry)
    private List<Condition> exitConditions = new ArrayList<>();    // 롱 청산
    // 독립 양방향(LONG_SHORT_FLAT) 전용 숏 조건. 비어있으면 숏 미사용(롱만).
    private List<Condition> shortEntryConditions = new ArrayList<>();
    private List<Condition> shortExitConditions = new ArrayList<>();

    // 배포 유형: null/기본=시그널 기반(단일종목 지표-조건) / "MOMENTUM_ROTATION"=미국주식 모멘텀 top-N 로테이션.
    // 모멘텀이면 GenericStrategyScheduler(매정시)는 스킵하고 MomentumRotationScheduler(일간)가 담당.
    private String deploymentType;

    // ── 모멘텀 로테이션 전용(deploymentType=MOMENTUM_ROTATION일 때만 의미) ──
    private Integer rotationTopN;          // 상위 N종목(기본 5)
    private Integer rotationLookbackDays;  // 모멘텀 룩백 거래일(기본 252)
    private Boolean rotationRegimeFilter;  // SPY 200SMA 레짐 필터 사용
    private Double rotationRegimeFloor;    // 약세장 노출 배수(기본 0.5)
    // 자본 최대 활용(bin-packing) 모드. true면 비중밴드를 풀고 할당금을 최대한 소진(살 수 있는 한 매수).
    // 소액에서 비싼 상위종목 대신 싼 종목에 집중됨(가격 편향) — 검증된 균등비중과 다른 거동. 기본 false(균등비중).
    private boolean rotationFullInvest;
    private List<String> rotationUniverse; // null이면 내장 132종목 유니버스
    private boolean regimeBear;            // 현재 레짐 약세 여부(상태)
    private List<String> currentTopHoldings = new ArrayList<>(); // 현 보유 top-N 심볼(표시/추적용)
    private String lastRotationMonth;      // 마지막 월간 리밸런싱 처리 달(yyyy-MM) — 멱등
    private String lastRegimeDay;          // 마지막 레짐 점검 일(yyyy-MM-dd) — 멱등

    // 매매 방향: null/LONG_ONLY(기존, 롱만) / LONG_SHORT_FLAT(독립 롱+숏+flat)
    private String tradeDirection;
    // 피라미딩 최대 유닛 수 (null/1이면 단일 진입, 기존 동작). +ATR 또는 진입신호 재충족 시 추가.
    private Integer maxUnits;
    // 피라미딩 추가진입 트리거: ATR(직전진입가±ATR 돌파) / SIGNAL(진입신호 재충족). null이면 피라미딩 안 함.
    private String pyramidMode;

    private List<String> targetAssets = new ArrayList<>();
    private String assetType;          // CRYPTO / STOCK / US_STOCK / ETF
    private String interval = "1h";    // 평가 봉 단위 (1h / 1d)

    private AccountMode accountMode = AccountMode.PAPER;
    private BrokerType brokerType = BrokerType.MOCK;

    // ── 거래 시장/레버리지 (Bitget 전용; KIS/MOCK은 SPOT·레버리지 1 고정) ──
    private MarketType marketType = MarketType.SPOT;   // SPOT(현물) / FUTURES(USDT 무기한 선물)
    private Integer leverage;                          // 선물 레버리지 배수 (현물/미설정이면 1로 취급)

    @Indexed
    private Status status = Status.RUNNING;

    private BigDecimal allocatedCash;  // 이 배포에 할당된 총 투자금 (baseCurrency 단위)
    // 할당금액(allocatedCash)의 기초통화: "KRW"/"USD"/"USDT". null=레거시(KRW)로 해석.
    // 모의(PAPER)=KRW, 실거래는 자산군별(Bitget=USDT, 미국주식/ETF=USD, 국내주식=KRW). 손익 원장은 항상 KRW.
    private String baseCurrency;

    // ── 리스크 파라미터 (퍼센트, null이면 미적용) ──
    private BigDecimal stopLossPct;
    private BigDecimal takeProfitPct;
    private BigDecimal trailingStopPct;

    // ── 일일 손실한도 (KRW 절대금액, 양수). 오늘 실현손실이 이 값에 도달하면 자동 일시정지 ──
    private BigDecimal dailyLossLimit;
    private String dayKey;                          // 오늘 날짜(yyyy-MM-dd, KST) — 일별 손익 리셋 기준
    private BigDecimal todayRealizedPnl = BigDecimal.ZERO;

    // ── 심볼별 라이브 포지션 상태 (임베드) ──
    private List<LivePosition> positions = new ArrayList<>();

    // ── 누적 성과 ──
    private BigDecimal realizedPnl = BigDecimal.ZERO;
    private int tradeCount;
    private int winCount;

    private Instant lastEvaluatedAt;
    private Instant createdAt;
    private Instant updatedAt;

    public enum AccountMode { PAPER, LIVE }

    public enum BrokerType { MOCK, KIS, UPBIT, BITGET }

    /** 거래 시장 종류. SPOT=현물, FUTURES=USDT 무기한 선물(레버리지). */
    public enum MarketType { SPOT, FUTURES }

    public enum Status { RUNNING, PAUSED, STOPPED, ERROR }

    /** 레버리지 배수(미설정/현물이면 1). */
    public int effectiveLeverage() {
        return (marketType == MarketType.FUTURES && leverage != null && leverage > 0) ? leverage : 1;
    }

    public boolean isFutures() {
        return marketType == MarketType.FUTURES;
    }

    /** 독립 롱+숏+flat 모드 여부. */
    public boolean isLongShortFlat() {
        return "LONG_SHORT_FLAT".equals(tradeDirection);
    }

    /** 모멘텀 top-N 로테이션 배포 여부. */
    public boolean isMomentumRotation() {
        return "MOMENTUM_ROTATION".equalsIgnoreCase(deploymentType);
    }

    public int effectiveRotationTopN() { return (rotationTopN != null && rotationTopN > 0) ? rotationTopN : 5; }
    public int effectiveRotationLookback() { return (rotationLookbackDays != null && rotationLookbackDays > 0) ? rotationLookbackDays : 252; }
    public boolean effectiveRegimeFilter() { return rotationRegimeFilter == null || rotationRegimeFilter; }
    public double effectiveRegimeFloor() { return (rotationRegimeFloor != null && rotationRegimeFloor > 0) ? rotationRegimeFloor : 0.5; }

    /** 최대 유닛 수(피라미딩). null/<1이면 1(단일 진입). */
    public int effectiveMaxUnits() {
        return (maxUnits != null && maxUnits > 1) ? maxUnits : 1;
    }

    /** 피라미딩 활성(트리거 지정 + maxUnits>1). */
    public boolean isPyramiding() {
        return pyramidMode != null && !pyramidMode.isBlank() && effectiveMaxUnits() > 1;
    }

    /**
     * 심볼 1개의 라이브 포지션 상태. (Strategy의 Condition/Indicator처럼 별도 컬렉션이 아닌 임베드 객체)
     * 청산 시 레코드를 지우지 않고 direction=NONE으로 리셋해 재사용한다(터틀 패턴).
     */
    @Getter
    @Setter
    @NoArgsConstructor
    public static class LivePosition {
        private String symbol;
        private String assetType;           // 심볼별 자산군 (CRYPTO/STOCK/US_STOCK/ETF) — 배포 시점 판별
        private Direction direction = Direction.NONE;
        private BigDecimal avgPrice;        // 평균 진입가
        private BigDecimal quantity = BigDecimal.ZERO;
        private BigDecimal allocatedCash;   // 이 심볼에 배분된 투자금
        private BigDecimal stopLoss;        // 손절/트레일링 라인 (롱=하단, 숏=상단)
        private BigDecimal trailRef;        // 트레일링 기준가 (롱=최고가, 숏=최저가)
        private int units;                  // 피라미딩 유닛 수 (0=무포지션)
        private BigDecimal lastEntryPrice;  // 마지막 진입가 (+ATR 피라미딩 트리거 기준)
        private BigDecimal realizedPnl = BigDecimal.ZERO;
        private int tradeCount;
        private int winCount;

        public LivePosition(String symbol, BigDecimal allocatedCash) {
            this.symbol = symbol;
            this.allocatedCash = allocatedCash;
        }

        public enum Direction { NONE, LONG, SHORT }
    }
}
