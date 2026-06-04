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
    private List<Condition> entryConditions = new ArrayList<>();
    private List<Condition> exitConditions = new ArrayList<>();

    private List<String> targetAssets = new ArrayList<>();
    private String assetType;          // CRYPTO / STOCK / US_STOCK / ETF
    private String interval = "1h";    // 평가 봉 단위 (1h / 1d)

    private AccountMode accountMode = AccountMode.PAPER;
    private BrokerType brokerType = BrokerType.MOCK;

    @Indexed
    private Status status = Status.RUNNING;

    private BigDecimal allocatedCash;  // 이 배포에 할당된 총 투자금 (KRW)

    // ── 리스크 파라미터 (퍼센트, null이면 미적용) ──
    private BigDecimal stopLossPct;
    private BigDecimal takeProfitPct;
    private BigDecimal trailingStopPct;

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

    public enum Status { RUNNING, PAUSED, STOPPED, ERROR }

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
        private BigDecimal stopLoss;        // 손절/트레일링 라인
        private BigDecimal trailRef;        // 트레일링 최고가 기준
        private BigDecimal realizedPnl = BigDecimal.ZERO;
        private int tradeCount;
        private int winCount;

        public LivePosition(String symbol, BigDecimal allocatedCash) {
            this.symbol = symbol;
            this.allocatedCash = allocatedCash;
        }

        public enum Direction { NONE, LONG }
    }
}
