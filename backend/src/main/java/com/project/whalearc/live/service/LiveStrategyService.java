package com.project.whalearc.live.service;

import com.project.whalearc.live.domain.LiveStrategyDeployment;
import com.project.whalearc.live.domain.LiveStrategyDeployment.LivePosition;
import com.project.whalearc.live.domain.LiveOrderLog;
import com.project.whalearc.live.domain.LiveDeploymentEquitySnapshot;
import com.project.whalearc.live.dto.CreateDeploymentRequest;
import com.project.whalearc.live.dto.DeploymentResponse;
import com.project.whalearc.live.repository.LiveOrderLogRepository;
import com.project.whalearc.live.repository.LiveDeploymentEquitySnapshotRepository;
import com.project.whalearc.live.repository.LiveStrategyDeploymentRepository;
import com.project.whalearc.exchange.service.client.BitgetApiClient;
import com.project.whalearc.market.dto.CandlestickResponse;
import com.project.whalearc.market.service.CandlestickService;
import com.project.whalearc.market.service.ExchangeRateService;
import com.project.whalearc.market.service.UsEtfCatalog;
import com.project.whalearc.market.service.UsStockPriceProvider;
import com.project.whalearc.notification.domain.Notification;
import com.project.whalearc.notification.service.NotificationService;
import com.project.whalearc.strategy.domain.Condition;
import com.project.whalearc.strategy.domain.Indicator;
import com.project.whalearc.strategy.domain.Strategy;
import com.project.whalearc.strategy.repository.StrategyRepository;
import com.project.whalearc.strategy.service.IndicatorContextBuilder;
import com.project.whalearc.strategy.service.SignalEvaluator;
import com.project.whalearc.trade.domain.Order;
import com.project.whalearc.trade.domain.Portfolio;
import com.project.whalearc.trade.service.PortfolioService;
import com.project.whalearc.trade.service.UserLockRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Objects;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * 라이브 자동매매 엔진(일반화). 터틀(TurtleStrategyService)을 일반 전략으로 확장한 것.
 *
 * <p>역할: (1) 배포 생성/조회/시작/일시정지/정지 (2) 스케줄러가 호출하는 시그널 평가·주문 실행.
 * 시그널 평가는 백테스트와 공유하는 SignalEvaluator + IndicatorContextBuilder를 그대로 쓰고,
 * 주문은 OrderGateway 추상화를 통해 모의(MOCK)/실계좌로 분기한다.
 *
 * <p>1단계 범위: PAPER(모의) + MOCK 게이트웨이 + 단일 포지션(피라미딩 없음). 실계좌(LIVE)는
 * 해당 브로커 게이트웨이가 없어 배포 생성 단계에서 거부된다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LiveStrategyService {

    private final LiveStrategyDeploymentRepository deploymentRepository;
    private final StrategyRepository strategyRepository;
    private final CandlestickService candlestickService;
    private final IndicatorContextBuilder indicatorContextBuilder;
    private final SignalEvaluator signalEvaluator;
    private final NotificationService notificationService;
    private final PortfolioService portfolioService;
    private final ExchangeRateService exchangeRateService;
    private final UsEtfCatalog usEtfCatalog;
    private final UsStockPriceProvider usStockPriceProvider;
    private final BitgetApiClient bitgetApiClient;
    private final List<OrderGateway> orderGateways;
    private final LiveOrderLogRepository orderLogRepository;
    private final LiveDeploymentEquitySnapshotRepository equitySnapshotRepository;
    private final UserLockRegistry userLockRegistry;

    /** 전역 킬스위치 — 켜지면 스케줄러가 모든 평가를 건너뛴다. */
    private final AtomicBoolean killSwitch = new AtomicBoolean(false);

    /** 실거래(KIS) 1건당 할당 상한(KRW) — 팻핑거 방지 가드. 소액 검증 후 config로 상향. (null=미설정 시 무제한) */
    @org.springframework.beans.factory.annotation.Value("${live.broker.kis.max-allocated-krw:100000}")
    private BigDecimal kisMaxAllocatedKrw;

    /** 실거래(Bitget) 1건당 할당 상한(KRW) — KIS와 동일한 팻핑거 방지 가드. */
    @org.springframework.beans.factory.annotation.Value("${live.broker.bitget.max-allocated-krw:100000}")
    private BigDecimal bitgetMaxAllocatedKrw;

    /** 선물 레버리지 허용 상한 — 과도한 레버리지 방지(소액 검증 단계). config로 상향. */
    @org.springframework.beans.factory.annotation.Value("${live.broker.bitget.max-leverage:10}")
    private int bitgetMaxLeverage;

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    // ── 배포 라이프사이클 ─────────────────────────────────────────────

    public LiveStrategyDeployment createDeployment(String userId, CreateDeploymentRequest req) {
        List<Indicator> indicators;
        List<Condition> entryConditions;
        List<Condition> exitConditions;
        List<String> targetAssets;
        String assetType;
        String strategyName;
        String strategyId;

        if (req.getStrategyId() != null && !req.getStrategyId().isBlank()) {
            Strategy strategy = strategyRepository.findById(req.getStrategyId())
                    .orElseThrow(() -> new IllegalArgumentException("전략을 찾을 수 없습니다."));
            if (!strategy.getUserId().equals(userId)) {
                throw new IllegalArgumentException("해당 전략에 대한 권한이 없습니다.");
            }
            // 배포 시점 스냅샷 동결(깊은 복사) — 원본 전략을 수정해도 가동 중 배포는 불변
            indicators = copyIndicators(strategy.getIndicators());
            entryConditions = copyConditions(strategy.getEntryConditions());
            exitConditions = copyConditions(strategy.getExitConditions());
            targetAssets = (req.getTargetAssets() != null && !req.getTargetAssets().isEmpty())
                    ? new ArrayList<>(req.getTargetAssets())
                    : new ArrayList<>(strategy.getTargetAssets());
            assetType = req.getAssetType() != null ? req.getAssetType() : strategy.getAssetType();
            strategyName = strategy.getName();
            strategyId = strategy.getId();
        } else {
            indicators = copyIndicators(req.getIndicators());
            entryConditions = copyConditions(req.getEntryConditions());
            exitConditions = copyConditions(req.getExitConditions());
            targetAssets = req.getTargetAssets() != null ? new ArrayList<>(req.getTargetAssets()) : new ArrayList<>();
            assetType = req.getAssetType();
            strategyName = req.getStrategyName() != null ? req.getStrategyName() : "직접 입력 전략";
            strategyId = null;
            if (entryConditions.isEmpty() && exitConditions.isEmpty()) {
                throw new IllegalArgumentException("진입 조건 또는 청산 조건을 최소 1개 설정해주세요.");
            }
        }

        if (targetAssets.isEmpty()) {
            throw new IllegalArgumentException("대상 자산을 1개 이상 선택해주세요.");
        }
        BigDecimal allocatedCash = req.getAllocatedCash();
        if (allocatedCash == null || allocatedCash.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("할당 금액은 0보다 커야 합니다.");
        }
        validateRiskParams(req);

        LiveStrategyDeployment.AccountMode accountMode =
                req.getAccountMode() != null ? req.getAccountMode() : LiveStrategyDeployment.AccountMode.PAPER;
        LiveStrategyDeployment.BrokerType brokerType =
                req.getBrokerType() != null ? req.getBrokerType() : LiveStrategyDeployment.BrokerType.MOCK;

        // 계좌 모드 ↔ 브로커 정합성 검증
        if (accountMode == LiveStrategyDeployment.AccountMode.PAPER
                && brokerType != LiveStrategyDeployment.BrokerType.MOCK) {
            throw new IllegalArgumentException("모의(PAPER) 모드는 MOCK 브로커만 사용할 수 있습니다.");
        }
        if (accountMode == LiveStrategyDeployment.AccountMode.LIVE
                && brokerType == LiveStrategyDeployment.BrokerType.MOCK) {
            throw new IllegalArgumentException("실계좌(LIVE) 모드는 실거래 브로커가 필요합니다.");
        }
        // 처리 가능한 게이트웨이가 없으면 거부 (MOCK 외 미지원이면 실계좌 자동 차단)
        resolveGateway(brokerType);

        // 실거래(KIS) 1건당 할당 상한 가드 — 팻핑거로 큰 실주문이 나가는 사고 방지(소액 검증 단계)
        if (brokerType == LiveStrategyDeployment.BrokerType.KIS
                && kisMaxAllocatedKrw != null
                && allocatedCash.compareTo(kisMaxAllocatedKrw) > 0) {
            throw new IllegalArgumentException(
                    "실거래(KIS) 1건당 할당 한도(" + kisMaxAllocatedKrw + "원)를 초과했습니다. 소액으로 먼저 검증한 뒤 한도를 올리세요.");
        }
        // 실거래(Bitget) 1건당 할당 상한 가드 — KIS와 동일
        if (brokerType == LiveStrategyDeployment.BrokerType.BITGET
                && bitgetMaxAllocatedKrw != null
                && allocatedCash.compareTo(bitgetMaxAllocatedKrw) > 0) {
            throw new IllegalArgumentException(
                    "실거래(Bitget) 1건당 할당 한도(" + bitgetMaxAllocatedKrw + "원)를 초과했습니다. 소액으로 먼저 검증한 뒤 한도를 올리세요.");
        }

        // 시장 종류/레버리지 — 선물(FUTURES)은 현재 Bitget만 지원. 레버리지는 [1, 상한] 범위.
        LiveStrategyDeployment.MarketType marketType =
                req.getMarketType() != null ? req.getMarketType() : LiveStrategyDeployment.MarketType.SPOT;
        Integer leverage = req.getLeverage();
        if (marketType == LiveStrategyDeployment.MarketType.FUTURES) {
            if (brokerType != LiveStrategyDeployment.BrokerType.BITGET) {
                throw new IllegalArgumentException("선물(FUTURES) 자동매매는 현재 Bitget만 지원합니다.");
            }
            int lev = leverage != null ? leverage : 1;
            if (lev < 1 || lev > bitgetMaxLeverage) {
                throw new IllegalArgumentException("레버리지는 1배 이상 " + bitgetMaxLeverage + "배 이하여야 합니다.");
            }
            leverage = lev;
        } else {
            leverage = null;   // 현물은 레버리지 무의미 — 저장하지 않음
        }

        // 독립 양방향/피라미딩 스냅샷 (숏 조건은 프리셋/직접 입력 모드에서만 전달됨)
        List<Condition> shortEntryConditions = copyConditions(req.getShortEntryConditions());
        List<Condition> shortExitConditions = copyConditions(req.getShortExitConditions());
        boolean isLsf = "LONG_SHORT_FLAT".equals(req.getTradeDirection());
        boolean hasShort = !shortEntryConditions.isEmpty();
        if (hasShort) {
            if (brokerType == LiveStrategyDeployment.BrokerType.KIS) {
                throw new IllegalArgumentException("공매도(숏)는 주식(KIS)에서 지원하지 않습니다. 롱 전용으로 가동하세요.");
            }
            if (brokerType == LiveStrategyDeployment.BrokerType.BITGET
                    && marketType != LiveStrategyDeployment.MarketType.FUTURES) {
                throw new IllegalArgumentException("공매도(숏)는 Bitget 선물(FUTURES)에서만 가능합니다. 현물은 롱만 지원합니다.");
            }
        }
        Integer maxUnits = req.getMaxUnits();
        if (maxUnits != null && (maxUnits < 1 || maxUnits > 10)) {
            throw new IllegalArgumentException("피라미딩 최대 유닛 수는 1~10 사이여야 합니다.");
        }

        LiveStrategyDeployment d = new LiveStrategyDeployment();
        d.setUserId(userId);
        d.setStrategyId(strategyId);
        d.setStrategyName(strategyName);
        d.setIndicators(indicators);
        d.setEntryConditions(entryConditions);
        d.setExitConditions(exitConditions);
        d.setShortEntryConditions(shortEntryConditions);
        d.setShortExitConditions(shortExitConditions);
        d.setTradeDirection(isLsf ? "LONG_SHORT_FLAT" : "LONG_ONLY");
        d.setMaxUnits(maxUnits);
        d.setPyramidMode(req.getPyramidMode());
        d.setTargetAssets(targetAssets);
        d.setInterval(req.getInterval() != null && !req.getInterval().isBlank() ? req.getInterval() : "1h");
        d.setAccountMode(accountMode);
        d.setBrokerType(brokerType);
        d.setMarketType(marketType);
        d.setLeverage(leverage);
        d.setStatus(LiveStrategyDeployment.Status.RUNNING);
        d.setAllocatedCash(allocatedCash);
        d.setStopLossPct(req.getStopLossPct());
        d.setTakeProfitPct(req.getTakeProfitPct());
        d.setTrailingStopPct(req.getTrailingStopPct());
        d.setDailyLossLimit(req.getDailyLossLimit());
        d.setDayKey(LocalDate.now(KST).toString());

        // 투자금을 심볼 수로 균등 분배해 심볼별 포지션을 NONE으로 초기화(터틀 패턴, 실매수는 스케줄러가 시그널 따라).
        // 자산군은 심볼별로 판별(MIXED 전략 지원). 단 요청/전략이 단일 자산군을 명시하면 그 값을 그대로 사용.
        boolean detectPerSymbol = (assetType == null || assetType.isBlank() || "MIXED".equalsIgnoreCase(assetType));
        BigDecimal perAsset = allocatedCash.divide(BigDecimal.valueOf(targetAssets.size()), 10, RoundingMode.HALF_UP);
        List<LivePosition> positions = new ArrayList<>();
        Set<String> resolvedTypes = new HashSet<>();
        for (String symbol : targetAssets) {
            LivePosition p = new LivePosition(symbol, perAsset);
            String at = detectPerSymbol ? resolveAssetType(symbol) : assetType.toUpperCase();
            p.setAssetType(at);
            resolvedTypes.add(at);
            positions.add(p);
        }
        d.setPositions(positions);
        // 배포 요약 자산군: 단일이면 그 타입, 섞였으면 MIXED
        d.setAssetType(resolvedTypes.size() == 1 ? resolvedTypes.iterator().next() : "MIXED");

        Instant now = Instant.now();
        d.setCreatedAt(now);
        d.setUpdatedAt(now);

        // 자금 예약 가드(over-allocation 방지) + 저장을 유저 락 안에서 원자적으로 수행한다.
        // 활성(RUNNING/PAUSED) 배포들의 할당금 합 + 신규 할당이 가용 현금을 넘지 않게 한다. 현금을 별도
        // 버킷으로 옮기지 않고 cashBalance를 단일 출처로 유지(터틀 이중트랙 정합성 문제 회피). 정지(STOPPED)는
        // 자동 예약 해제됨. 락이 없으면 동시 2건 생성이 같은 reserved를 읽어 둘 다 통과(가용현금 초과 예약)할 수 있다.
        final BigDecimal allocatedCashFinal = allocatedCash;
        return userLockRegistry.withLock(userId, () -> {
            Portfolio portfolio = portfolioService.getOrCreatePortfolio(userId);
            BigDecimal cash = portfolio.getCashBalance() != null ? portfolio.getCashBalance() : BigDecimal.ZERO;
            BigDecimal reserved = deploymentRepository
                    .findByUserIdAndStatusIn(userId, List.of(
                            LiveStrategyDeployment.Status.RUNNING, LiveStrategyDeployment.Status.PAUSED))
                    .stream()
                    .map(LiveStrategyDeployment::getAllocatedCash)
                    .filter(Objects::nonNull)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            if (reserved.add(allocatedCashFinal).compareTo(cash) > 0) {
                throw new IllegalArgumentException(
                        "할당 금액이 가용 현금을 초과합니다(이미 자동매매에 예약된 금액 포함). 가용=" + cash + ", 기예약=" + reserved);
            }
            LiveStrategyDeployment saved = deploymentRepository.save(d);
            log.info("라이브 배포 생성: userId={}, deploymentId={}, strategy={}, assets={}, mode={}",
                    userId, saved.getId(), strategyName, targetAssets, accountMode);
            return saved;
        });
    }

    public List<LiveStrategyDeployment> getUserDeployments(String userId) {
        return deploymentRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    /** 유저의 배포 목록을 카드 표시용 확장 DTO(오늘 체결·최근 신호·스파크라인 포함)로 반환. */
    public List<DeploymentResponse> getUserDeploymentResponses(String userId) {
        return getUserDeployments(userId).stream().map(this::toResponse).toList();
    }

    /**
     * 배포 1건을 카드 표시용 확장 DTO로 변환.
     * 오늘 체결 수 + 최근 주문 + 일별 손익 스파크라인을 함께 채운다(모두 가벼운 DB 조회).
     */
    public DeploymentResponse toResponse(LiveStrategyDeployment d) {
        int todayFills = (int) orderLogRepository
                .countByDeploymentIdAndStatusAndCreatedAtGreaterThanEqual(d.getId(), "FILLED", startOfTodayKst());
        LiveOrderLog last = orderLogRepository.findFirstByDeploymentIdOrderByCreatedAtDesc(d.getId()).orElse(null);
        // 최신순 최근 N건을 받아 과거→현재로 뒤집어 스파크라인 y값으로
        List<LiveDeploymentEquitySnapshot> recent = equitySnapshotRepository.findTop24ByDeploymentIdOrderByDateDesc(d.getId());
        List<Double> spark = new ArrayList<>(recent.size());
        for (int i = recent.size() - 1; i >= 0; i--) spark.add(recent.get(i).getPnlPct());
        return DeploymentResponse.from(d, todayFills, last, spark);
    }

    /** 오늘(KST) 자정의 Instant — '오늘 체결' 집계 경계. */
    private Instant startOfTodayKst() {
        return LocalDate.now(KST).atStartOfDay(KST).toInstant();
    }

    /**
     * 배포의 현재 평가손익률(%) = (실현 + 미실현) / 할당금 × 100.
     * 미실현은 보유 포지션의 현재가로 산정(롱: 현재가−평균가, 숏: 평균가−현재가). FX는 KRW 환산.
     * 현재가 조회가 발생하므로 일별 스냅샷 산정용으로만 쓰고 핫패스(목록 조회)에서는 호출하지 않는다.
     */
    public double currentPnlPct(LiveStrategyDeployment d) {
        BigDecimal alloc = nz(d.getAllocatedCash());
        if (alloc.compareTo(BigDecimal.ZERO) <= 0) return 0;
        BigDecimal unreal = BigDecimal.ZERO;
        for (LivePosition pos : d.getPositions()) {
            LivePosition.Direction dir = pos.getDirection();
            if (dir == null || dir == LivePosition.Direction.NONE) continue;
            if (pos.getAvgPrice() == null || nz(pos.getQuantity()).compareTo(BigDecimal.ZERO) == 0) continue;
            double price = latestPrice(d, pos);
            if (price <= 0) continue;
            BigDecimal cur = BigDecimal.valueOf(price);
            BigDecimal pnlNative = dir == LivePosition.Direction.SHORT
                    ? pos.getAvgPrice().subtract(cur).multiply(pos.getQuantity())
                    : cur.subtract(pos.getAvgPrice()).multiply(pos.getQuantity());
            BigDecimal pnlKrw = priceInForeign(d, pos.getAssetType())
                    ? pnlNative.multiply(BigDecimal.valueOf(nativeKrwRate(d, pos.getAssetType())))
                    : pnlNative;
            unreal = unreal.add(pnlKrw);
        }
        BigDecimal total = nz(d.getRealizedPnl()).add(unreal);
        return total.doubleValue() / alloc.doubleValue() * 100.0;
    }

    public List<LiveStrategyDeployment> getRunningDeployments() {
        return deploymentRepository.findByStatus(LiveStrategyDeployment.Status.RUNNING);
    }

    /** 배포의 체결 주문 원장(최신순). 본인 소유 검증. */
    public List<LiveOrderLog> getDeploymentOrders(String userId, String deploymentId) {
        deploymentRepository.findByIdAndUserId(deploymentId, userId)
                .orElseThrow(() -> new IllegalArgumentException("배포를 찾을 수 없습니다."));
        return orderLogRepository.findByDeploymentIdOrderByCreatedAtDesc(deploymentId);
    }

    public LiveStrategyDeployment start(String userId, String deploymentId) {
        return transition(userId, deploymentId, LiveStrategyDeployment.Status.RUNNING);
    }

    public LiveStrategyDeployment pause(String userId, String deploymentId) {
        return transition(userId, deploymentId, LiveStrategyDeployment.Status.PAUSED);
    }

    public LiveStrategyDeployment stop(String userId, String deploymentId) {
        return transition(userId, deploymentId, LiveStrategyDeployment.Status.STOPPED);
    }

    /**
     * 배포 삭제. 가동 중(RUNNING)인 배포는 삭제 불가 — 먼저 정지/일시정지해야 한다(실행 중 평가와의 경합 방지).
     * 주의: 정지된 배포라도 거래소에 열린 포지션은 청산되지 않으므로(앱은 추적만 중단), 잔여 포지션은
     * 거래소에서 직접 정리해야 한다. 유저 락 안에서 평가와 직렬화한다.
     */
    public void deleteDeployment(String userId, String deploymentId) {
        userLockRegistry.withLock(userId, () -> {
            LiveStrategyDeployment d = deploymentRepository.findByIdAndUserId(deploymentId, userId)
                    .orElseThrow(() -> new IllegalArgumentException("배포를 찾을 수 없습니다."));
            if (d.getStatus() == LiveStrategyDeployment.Status.RUNNING) {
                throw new IllegalArgumentException("가동 중인 자동매매는 삭제할 수 없습니다. 먼저 정지(또는 일시정지)하세요.");
            }
            // 보유 포지션이 있으면 삭제 거부 — 그냥 지우면 거래소 포지션이 추적 불가한 고아로 남는다.
            // '지금 청산'으로 닫은 뒤 삭제하게 한다(스테일 LONG도 지금청산이 상태 동기화로 풀어줌).
            boolean hasOpenPosition = d.getPositions() != null && d.getPositions().stream()
                    .anyMatch(p -> p.getDirection() != LivePosition.Direction.NONE);   // 롱·숏 모두 — 열린 포지션 있으면 삭제 거부
            if (hasOpenPosition) {
                throw new IllegalArgumentException(
                        "보유 중인 포지션이 있어 삭제할 수 없습니다. 먼저 '지금 청산'으로 포지션을 닫은 뒤 삭제하세요.");
            }
            deploymentRepository.delete(d);
            try {
                orderLogRepository.deleteByDeploymentId(deploymentId);
                equitySnapshotRepository.deleteByDeploymentId(deploymentId);
            } catch (Exception e) {
                log.warn("배포 삭제 시 주문 로그/스냅샷 정리 실패: deploymentId={}, error={}", deploymentId, e.getMessage());
            }
            log.info("라이브 배포 삭제: userId={}, deploymentId={}", userId, deploymentId);
        });
    }

    private LiveStrategyDeployment transition(String userId, String deploymentId, LiveStrategyDeployment.Status target) {
        // 유저 락 안에서 상태 전이 — 평가(evaluateDeployment)와 직렬화해 사용자의 stop/pause가
        // 동시 평가의 전체문서 save에 덮어써지지 않게 한다(lost-update 방지).
        return userLockRegistry.withLock(userId, () -> {
            LiveStrategyDeployment d = deploymentRepository.findByIdAndUserId(deploymentId, userId)
                    .orElseThrow(() -> new IllegalArgumentException("배포를 찾을 수 없습니다."));
            d.setStatus(target);
            d.setUpdatedAt(Instant.now());
            return deploymentRepository.save(d);
        });
    }

    // ── 킬스위치 ──────────────────────────────────────────────────────

    public boolean isKillSwitchEngaged() {
        return killSwitch.get();
    }

    public void setKillSwitch(boolean engaged) {
        killSwitch.set(engaged);
        log.warn("라이브 자동매매 전역 킬스위치 = {}", engaged ? "ON(전체 정지)" : "OFF");
    }

    // ── 시그널 평가 + 주문 실행 (스케줄러 진입점) ──────────────────────

    /** 수동 "지금 평가" — 본인 배포를 즉시 1회 평가(정시 cron 대기 없이 확인용). 소유권 검증. */
    public LiveStrategyDeployment evaluateNow(String userId, String deploymentId) {
        LiveStrategyDeployment d = deploymentRepository.findByIdAndUserId(deploymentId, userId)
                .orElseThrow(() -> new IllegalArgumentException("배포를 찾을 수 없습니다."));
        if (killSwitch.get()) {
            throw new IllegalArgumentException("전역 킬스위치가 켜져 있어 평가할 수 없습니다.");
        }
        if (d.getStatus() != LiveStrategyDeployment.Status.RUNNING) {
            throw new IllegalArgumentException("가동 중(RUNNING)인 배포만 평가할 수 있습니다.");
        }
        evaluateDeployment(d);
        return deploymentRepository.findById(deploymentId).orElse(d);
    }

    /**
     * 수동 "지금 청산" — 배포의 모든 보유(LONG) 포지션을 즉시 시장가 청산한다. 신호/익절·손절을 기다리지
     * 않고 사용자가 직접 닫는다. 유저 락 안에서 평가와 직렬화하고, DB 최신본을 읽어 처리한다.
     * @return 청산 후 최신 배포. 보유 포지션이 없으면 예외.
     */
    public LiveStrategyDeployment closeNow(String userId, String deploymentId) {
        deploymentRepository.findByIdAndUserId(deploymentId, userId)
                .orElseThrow(() -> new IllegalArgumentException("배포를 찾을 수 없습니다."));
        userLockRegistry.withLock(userId, () -> doCloseNowLocked(deploymentId));
        return deploymentRepository.findById(deploymentId)
                .orElseThrow(() -> new IllegalArgumentException("배포를 찾을 수 없습니다."));
    }

    private void doCloseNowLocked(String deploymentId) {
        LiveStrategyDeployment d = deploymentRepository.findById(deploymentId).orElse(null);
        if (d == null) return;
        OrderGateway gateway = resolveGateway(d.getBrokerType());
        boolean closedAny = false;
        for (LivePosition pos : d.getPositions()) {
            if (pos.getDirection() == LivePosition.Direction.NONE) continue;   // 롱·숏 모두 청산(무포지션만 스킵)
            try {
                double price = latestPrice(d, pos);
                if (price <= 0) {
                    log.warn("지금 청산 스킵(현재가 0 이하): deploymentId={}, symbol={}", d.getId(), pos.getSymbol());
                    continue;
                }
                // 멱등 barTime은 현재 초 — 같은 초 더블클릭은 디듀프, 청산 후 direction=NONE이라 재청산도 방지.
                long barTime = Instant.now().getEpochSecond();
                if (pos.getDirection() == LivePosition.Direction.SHORT) {
                    closeShort(d, pos, gateway, price, "MANUAL", barTime);     // 숏=COVER(매수 환매)
                } else {
                    closePosition(d, pos, gateway, price, "MANUAL", barTime);  // 롱=SELL
                }
                closedAny = true;
            } catch (Exception e) {
                log.error("지금 청산 실패: deploymentId={}, symbol={}, error={}", d.getId(), pos.getSymbol(), e.getMessage());
            }
        }
        if (!closedAny) {
            throw new IllegalArgumentException("청산할 보유 포지션이 없습니다.");
        }
        d.setUpdatedAt(Instant.now());
        deploymentRepository.save(d);
    }

    /** 포지션의 최신 현재가(네이티브 통화) — 브로커별 캔들 출처에서 마지막 종가. 청산가 산정용. */
    private double latestPrice(LiveStrategyDeployment d, LivePosition pos) {
        String assetType = pos.getAssetType();
        List<CandlestickResponse> candles;
        if (d.getBrokerType() == LiveStrategyDeployment.BrokerType.BITGET) {
            String sym = BitgetApiClient.toSpotSymbol(pos.getSymbol());
            candles = d.isFutures()
                    ? bitgetApiClient.getFuturesCandles(sym, d.getInterval(), 2)
                    : bitgetApiClient.getSpotCandles(sym, d.getInterval(), 2);
        } else {
            String interval = isStockLike(assetType) ? "1d" : d.getInterval();
            candles = candlestickService.getCandlesticks(pos.getSymbol(), interval, assetType);
        }
        if (candles == null || candles.isEmpty()) return 0;
        candles = new ArrayList<>(candles);
        candles.sort(Comparator.comparingLong(CandlestickResponse::getTime));
        return candles.get(candles.size() - 1).getClose();
    }

    /**
     * RUNNING 배포 1건의 모든 심볼을 평가하고 필요 시 주문을 낸다. 포지션별 예외는 격리.
     *
     * <p>동시성: 스케줄러(cron)와 수동 evaluateNow가 같은 배포를 동시에 평가하면 read-modify-save 가
     * lost-update 를 일으켜 포지션/실현손익 장부가 유실될 수 있다. 이를 막기 위해 유저 락 안에서
     * <b>DB에서 최신 배포를 다시 읽어</b> 그 사본을 평가·저장한다(인자 d는 stale 스냅샷일 수 있어 식별자로만 사용).
     * OrderGateway가 거치는 OrderService도 같은 유저 락(ReentrantLock)을 재진입하므로 안전하다.
     */
    public void evaluateDeployment(LiveStrategyDeployment d) {
        if (d == null || d.getId() == null) return;
        userLockRegistry.withLock(d.getUserId(), () -> doEvaluateLocked(d.getId()));
    }

    private void doEvaluateLocked(String deploymentId) {
        LiveStrategyDeployment d = deploymentRepository.findById(deploymentId).orElse(null);
        if (d == null || d.getStatus() != LiveStrategyDeployment.Status.RUNNING) return;
        OrderGateway gateway = resolveGateway(d.getBrokerType());

        // 일별 손익 리셋(KST 자정 경계)
        String today = LocalDate.now(KST).toString();
        if (!today.equals(d.getDayKey())) {
            d.setDayKey(today);
            d.setTodayRealizedPnl(BigDecimal.ZERO);
        }

        for (LivePosition pos : d.getPositions()) {
            try {
                evaluatePosition(d, pos, gateway);
            } catch (Exception e) {
                log.error("라이브 포지션 평가 실패: deploymentId={}, symbol={}, error={}",
                        d.getId(), pos.getSymbol(), e.getMessage());
            }
        }

        // 일일 손실한도 도달 시 자동 일시정지(엔진 결정). 락 안에서 최신본을 읽어 평가하므로 status는
        // 이미 권위 있는 값(전이도 같은 락으로 직렬화됨). 한도 도달 시에만 PAUSED로 전환한다.
        boolean lossLimitHit = d.getDailyLossLimit() != null
                && d.getDailyLossLimit().compareTo(BigDecimal.ZERO) > 0
                && nz(d.getTodayRealizedPnl()).compareTo(d.getDailyLossLimit().negate()) <= 0;
        if (lossLimitHit) {
            d.setStatus(LiveStrategyDeployment.Status.PAUSED);
            log.warn("일일 손실한도 도달 → 자동 일시정지: deploymentId={}, todayPnl={}, limit={}",
                    d.getId(), d.getTodayRealizedPnl(), d.getDailyLossLimit());
            notifyAutoPause(d);
        }
        d.setLastEvaluatedAt(Instant.now());
        d.setUpdatedAt(Instant.now());
        deploymentRepository.save(d);
    }

    private void evaluatePosition(LiveStrategyDeployment d, LivePosition pos, OrderGateway gateway) {
        String assetType = pos.getAssetType();
        // 시세 출처: Bitget 브로커면 Bitget 현물 캔들(USDT 기준), 그 외엔 기존 경로(주식=KIS 일봉, 코인=빗썸 KRW).
        // 거래소와 신호 평가 시세를 일치시켜 가격 괴리를 막는다.
        String interval = isStockLike(assetType) ? "1d" : d.getInterval();
        List<CandlestickResponse> candles;
        if (d.getBrokerType() == LiveStrategyDeployment.BrokerType.BITGET) {
            String bgSymbol = BitgetApiClient.toSpotSymbol(pos.getSymbol());   // BTCUSDT (현물·선물 공통)
            candles = d.isFutures()
                    ? bitgetApiClient.getFuturesCandles(bgSymbol, d.getInterval(), 200)
                    : bitgetApiClient.getSpotCandles(bgSymbol, d.getInterval(), 200);
        } else {
            candles = candlestickService.getCandlesticks(pos.getSymbol(), interval, assetType);
        }
        if (candles == null || candles.isEmpty()) {
            log.warn("라이브 평가 스킵(캔들 비어있음): deploymentId={}, symbol={}, assetType={}, interval={}, broker={} — 캔들조회 실패/한도 가능",
                    d.getId(), pos.getSymbol(), assetType, interval, d.getBrokerType());
            return;
        }
        // 시간순(과거→현재) 정렬 보장 (코인 빗썸 응답은 정렬 미보장)
        candles = new ArrayList<>(candles);
        candles.sort(Comparator.comparingLong(CandlestickResponse::getTime));

        int idx = candles.size() - 1;
        double currentPrice = candles.get(idx).getClose();
        if (currentPrice <= 0) {
            log.warn("라이브 평가 스킵(현재가 0 이하): deploymentId={}, symbol={}, close={}", d.getId(), pos.getSymbol(), currentPrice);
            return;
        }
        log.info("라이브 평가: deploymentId={}, symbol={}, assetType={}, dir={}, price={}({})",
                d.getId(), pos.getSymbol(), assetType, pos.getDirection(), currentPrice, priceInForeign(d, assetType) ? "FX" : "KRW");

        Map<String, double[]> iv = indicatorContextBuilder.calculateIndicators(
                candles, d.getIndicators(), d.getEntryConditions(), d.getExitConditions());

        long barTime = candles.get(idx).getTime();   // 멱등키용 봉 타임스탬프
        if (pos.getDirection() == LivePosition.Direction.NONE) {
            boolean longEntry = signalEvaluator.evaluateConditions(
                    d.getEntryConditions(), iv, idx, currentPrice, candles, 0, idx);
            if (longEntry) { openPosition(d, pos, gateway, currentPrice, barTime); return; }
            // 독립 양방향: 롱 진입이 없을 때만 숏 진입 평가(롱 우선). 숏 조건 미설정이면 롱 전용으로 동작.
            if (d.isLongShortFlat() && d.getShortEntryConditions() != null && !d.getShortEntryConditions().isEmpty()) {
                boolean shortEntry = signalEvaluator.evaluateConditions(
                        d.getShortEntryConditions(), iv, idx, currentPrice, candles, 0, idx);
                if (shortEntry) openShort(d, pos, gateway, currentPrice, barTime);
            }
        } else {
            managePosition(d, pos, gateway, iv, candles, idx, currentPrice, barTime);
        }
    }

    private void openPosition(LiveStrategyDeployment d, LivePosition pos, OrderGateway gateway, double currentPrice, long barTime) {
        BigDecimal alloc = pos.getAllocatedCash();
        if (alloc == null || alloc.compareTo(BigDecimal.ZERO) <= 0) return;

        // 멱등성: 같은 봉의 동일 매수가 이미 처리됐으면 스킵(중복 발주 방지 + 1봉 중복평가 디듀프)
        String clientOrderId = clientOrderId(d, pos, "BUY", barTime);
        if (orderLogRepository.existsByClientOrderId(clientOrderId)) return;

        String assetType = pos.getAssetType();
        BigDecimal price = BigDecimal.valueOf(currentPrice);   // 네이티브 통화(미국주식/ETF=USD, Bitget 코인=USDT, 그 외 KRW)
        // allocatedCash는 KRW 기준. 외화 표시 자산(미국주식/ETF=USD, Bitget=USDT)은 KRW 환산 단가로 나눠 수량을 산정한다.
        BigDecimal krwPerUnit = priceInForeign(d, assetType)
                ? price.multiply(BigDecimal.valueOf(nativeKrwRate(d, assetType)))
                : price;
        if (krwPerUnit.compareTo(BigDecimal.ZERO) <= 0) {
            log.warn("라이브 매수 불가(환산 단가 0 이하): deploymentId={}, symbol={}, price={}", d.getId(), pos.getSymbol(), price);
            return;
        }
        int scale = isStockLike(assetType) ? 0 : 8;   // 주식류는 정수 수량, 코인은 소수 8자리
        // 1유닛 증거금 = 할당금 / 최대유닛(피라미딩). maxUnits=1이면 전액(기존과 동일).
        // 선물은 레버리지만큼 노출(수량)을 키운다: 수량 = (1유닛증거금 × 레버리지) / 단가. 현물은 레버리지=1.
        BigDecimal unitAlloc = alloc.divide(BigDecimal.valueOf(d.effectiveMaxUnits()), 10, RoundingMode.HALF_UP);
        BigDecimal exposure = unitAlloc.multiply(BigDecimal.valueOf(d.effectiveLeverage()));
        BigDecimal quantity = exposure.divide(krwPerUnit, scale, RoundingMode.DOWN);
        if (quantity.compareTo(BigDecimal.ZERO) <= 0) {
            // 분배 금액이 1주(또는 최소 단위) 가격보다 작아 수량이 0이 됨 — 조용한 무동작 방지용 경고
            log.warn("라이브 매수 불가(분배 자금으로 수량 0): deploymentId={}, symbol={}, alloc={}, krwPerUnit={}",
                    d.getId(), pos.getSymbol(), alloc, krwPerUnit);
            return;
        }

        log.info("라이브 매수 시도: deploymentId={}, symbol={}, assetType={}, qty={}, price={}({}), broker={}",
                d.getId(), pos.getSymbol(), assetType, quantity, price, priceInForeign(d, assetType) ? "FX" : "KRW", d.getBrokerType());
        Order order;
        try {
            order = gateway.placeMarketOrder(d, d.getUserId(), pos.getSymbol(), pos.getSymbol(),
                    Order.OrderType.BUY, quantity, price, assetType, clientOrderId);
        } catch (Exception e) {
            log.warn("라이브 매수 주문 실패: deploymentId={}, symbol={}, error={}", d.getId(), pos.getSymbol(), e.getMessage());
            return;
        }
        if (order == null || order.getStatus() != Order.OrderStatus.FILLED) return;

        BigDecimal fill = order.getFilledPrice() != null ? order.getFilledPrice() : price;
        // 실제 체결수량이 있으면 그 값을 장부에 반영(Bitget 시장가 매수는 USDT 금액 주문이라 체결 base 수량이 산정값과 다를 수 있음)
        BigDecimal filledQty = order.getFilledQuantity() != null && order.getFilledQuantity().compareTo(BigDecimal.ZERO) > 0
                ? order.getFilledQuantity() : quantity;
        recordOrder(d, pos, "BUY", filledQty, fill, clientOrderId, order.getId(), "ENTRY");
        pos.setDirection(LivePosition.Direction.LONG);
        pos.setAvgPrice(fill);
        pos.setQuantity(filledQty);
        pos.setTrailRef(fill);
        pos.setStopLoss(d.getStopLossPct() != null ? pctBelow(fill, d.getStopLossPct()) : null);
        pos.setUnits(1);
        pos.setLastEntryPrice(fill);
        // 거래수는 청산(왕복 완료) 시에만 1회 카운트 — 백테스트 totalTrades(왕복)와 단위 일치. 진입에선 세지 않음.

        notifyTrade(d, "자동매매 매수 진입", pos.getSymbol(), fill, "ENTRY", null);
    }

    /** 숏 개시(독립 양방향 전용). openPosition의 거울상 — side=SHORT, 손절선=상단(pctAbove). */
    private void openShort(LiveStrategyDeployment d, LivePosition pos, OrderGateway gateway, double currentPrice, long barTime) {
        BigDecimal alloc = pos.getAllocatedCash();
        if (alloc == null || alloc.compareTo(BigDecimal.ZERO) <= 0) return;
        String clientOrderId = clientOrderId(d, pos, "SHORT", barTime);
        if (orderLogRepository.existsByClientOrderId(clientOrderId)) return;

        String assetType = pos.getAssetType();
        BigDecimal price = BigDecimal.valueOf(currentPrice);
        BigDecimal krwPerUnit = priceInForeign(d, assetType) ? price.multiply(BigDecimal.valueOf(nativeKrwRate(d, assetType))) : price;
        if (krwPerUnit.compareTo(BigDecimal.ZERO) <= 0) return;
        int scale = isStockLike(assetType) ? 0 : 8;
        BigDecimal unitAlloc = alloc.divide(BigDecimal.valueOf(d.effectiveMaxUnits()), 10, RoundingMode.HALF_UP);
        BigDecimal exposure = unitAlloc.multiply(BigDecimal.valueOf(d.effectiveLeverage()));
        BigDecimal quantity = exposure.divide(krwPerUnit, scale, RoundingMode.DOWN);
        if (quantity.compareTo(BigDecimal.ZERO) <= 0) {
            log.warn("라이브 숏 불가(분배 자금으로 수량 0): deploymentId={}, symbol={}", d.getId(), pos.getSymbol());
            return;
        }
        log.info("라이브 숏 진입 시도: deploymentId={}, symbol={}, qty={}, price={}, broker={}",
                d.getId(), pos.getSymbol(), quantity, price, d.getBrokerType());
        Order order;
        try {
            order = gateway.placeMarketOrder(d, d.getUserId(), pos.getSymbol(), pos.getSymbol(),
                    Order.OrderType.SHORT, quantity, price, assetType, clientOrderId);
        } catch (Exception e) {
            log.warn("라이브 숏 주문 실패: deploymentId={}, symbol={}, error={}", d.getId(), pos.getSymbol(), e.getMessage());
            return;
        }
        if (order == null || order.getStatus() != Order.OrderStatus.FILLED) return;

        BigDecimal fill = order.getFilledPrice() != null ? order.getFilledPrice() : price;
        BigDecimal filledQty = order.getFilledQuantity() != null && order.getFilledQuantity().compareTo(BigDecimal.ZERO) > 0
                ? order.getFilledQuantity() : quantity;
        recordOrder(d, pos, "SHORT", filledQty, fill, clientOrderId, order.getId(), "ENTRY");
        pos.setDirection(LivePosition.Direction.SHORT);
        pos.setAvgPrice(fill);
        pos.setQuantity(filledQty);
        pos.setTrailRef(fill);
        pos.setStopLoss(d.getStopLossPct() != null ? pctAbove(fill, d.getStopLossPct()) : null);
        pos.setUnits(1);
        pos.setLastEntryPrice(fill);
        // 거래수는 청산 시에만 카운트(왕복 기준) — 진입에선 세지 않음.
        notifyTrade(d, "자동매매 숏 진입", pos.getSymbol(), fill, "ENTRY", null);
    }

    /** 추가 진입(피라미딩) — 롱/숏 공통. 가중평균가·수량·유닛·lastEntryPrice 갱신. */
    private void addUnit(LiveStrategyDeployment d, LivePosition pos, OrderGateway gateway, double currentPrice, long barTime, boolean isLong) {
        BigDecimal alloc = pos.getAllocatedCash();
        if (alloc == null || alloc.compareTo(BigDecimal.ZERO) <= 0) return;
        String side = isLong ? "BUY" : "SHORT";
        String clientOrderId = clientOrderId(d, pos, side + "_ADD" + pos.getUnits(), barTime);
        if (orderLogRepository.existsByClientOrderId(clientOrderId)) return;

        String assetType = pos.getAssetType();
        BigDecimal price = BigDecimal.valueOf(currentPrice);
        BigDecimal krwPerUnit = priceInForeign(d, assetType) ? price.multiply(BigDecimal.valueOf(nativeKrwRate(d, assetType))) : price;
        if (krwPerUnit.compareTo(BigDecimal.ZERO) <= 0) return;
        int scale = isStockLike(assetType) ? 0 : 8;
        BigDecimal unitAlloc = alloc.divide(BigDecimal.valueOf(d.effectiveMaxUnits()), 10, RoundingMode.HALF_UP);
        BigDecimal exposure = unitAlloc.multiply(BigDecimal.valueOf(d.effectiveLeverage()));
        BigDecimal quantity = exposure.divide(krwPerUnit, scale, RoundingMode.DOWN);
        if (quantity.compareTo(BigDecimal.ZERO) <= 0) return;

        Order order;
        try {
            order = gateway.placeMarketOrder(d, d.getUserId(), pos.getSymbol(), pos.getSymbol(),
                    isLong ? Order.OrderType.BUY : Order.OrderType.SHORT, quantity, price, assetType, clientOrderId);
        } catch (Exception e) {
            log.warn("라이브 피라미딩 주문 실패: deploymentId={}, symbol={}, error={}", d.getId(), pos.getSymbol(), e.getMessage());
            return;
        }
        if (order == null || order.getStatus() != Order.OrderStatus.FILLED) return;

        BigDecimal fill = order.getFilledPrice() != null ? order.getFilledPrice() : price;
        BigDecimal filledQty = order.getFilledQuantity() != null && order.getFilledQuantity().compareTo(BigDecimal.ZERO) > 0
                ? order.getFilledQuantity() : quantity;
        recordOrder(d, pos, side, filledQty, fill, clientOrderId, order.getId(), "PYRAMID");
        BigDecimal oldQty = nz(pos.getQuantity());
        BigDecimal newQty = oldQty.add(filledQty);
        BigDecimal oldAvg = pos.getAvgPrice() != null ? pos.getAvgPrice() : fill;
        BigDecimal newAvg = newQty.compareTo(BigDecimal.ZERO) > 0
                ? oldAvg.multiply(oldQty).add(fill.multiply(filledQty)).divide(newQty, 10, RoundingMode.HALF_UP)
                : fill;
        pos.setQuantity(newQty);
        pos.setAvgPrice(newAvg);
        pos.setUnits(pos.getUnits() + 1);
        pos.setLastEntryPrice(fill);
        // 피라미딩은 같은 왕복의 추가진입 — 거래수에 포함하지 않음(청산 시 1회만).
        notifyTrade(d, "자동매매 추가 진입 (피라미딩 " + pos.getUnits() + "유닛)", pos.getSymbol(), fill, "ENTRY", null);
    }

    /** +ATR 피라미딩 트리거: 직전 진입가 대비 ATR 이상 유리하게 움직였는지. */
    private boolean atrTrigger(Map<String, double[]> iv, int idx, BigDecimal lastEntryPrice, double currentPrice, boolean isLong) {
        if (lastEntryPrice == null) return false;
        double[] atrArr = iv.get("ATR");
        if (atrArr == null || idx < 0 || idx >= atrArr.length) return false;
        double atr = atrArr[idx];
        if (Double.isNaN(atr) || atr <= 0) return false;
        double last = lastEntryPrice.doubleValue();
        return isLong ? currentPrice >= last + atr : currentPrice <= last - atr;
    }

    private void managePosition(LiveStrategyDeployment d, LivePosition pos, OrderGateway gateway,
                                Map<String, double[]> iv, List<CandlestickResponse> candles, int idx, double currentPrice, long barTime) {
        if (pos.getDirection() == LivePosition.Direction.SHORT) {
            manageShort(d, pos, gateway, iv, candles, idx, currentPrice, barTime);
            return;
        }
        // 트레일링 스탑 갱신
        if (d.getTrailingStopPct() != null) {
            BigDecimal price = BigDecimal.valueOf(currentPrice);
            if (pos.getTrailRef() == null || price.compareTo(pos.getTrailRef()) > 0) {
                pos.setTrailRef(price);
            }
            BigDecimal trailStop = pctBelow(pos.getTrailRef(), d.getTrailingStopPct());
            if (pos.getStopLoss() == null || trailStop.compareTo(pos.getStopLoss()) > 0) {
                pos.setStopLoss(trailStop);
            }
        }

        double avg = pos.getAvgPrice() != null ? pos.getAvgPrice().doubleValue() : currentPrice;
        boolean stopHit = pos.getStopLoss() != null && currentPrice <= pos.getStopLoss().doubleValue();
        boolean takeProfitHit = d.getTakeProfitPct() != null
                && currentPrice >= avg * (1 + d.getTakeProfitPct().doubleValue() / 100.0);
        boolean exitSignal = signalEvaluator.evaluateConditions(
                d.getExitConditions(), iv, idx, currentPrice, candles, 0, idx);

        if (!(stopHit || takeProfitHit || exitSignal)) {
            // 청산 신호가 없으면 피라미딩(추가 진입) 검토
            if (d.isPyramiding() && pos.getUnits() < d.effectiveMaxUnits()) {
                boolean trigger = "ATR".equalsIgnoreCase(d.getPyramidMode())
                        ? atrTrigger(iv, idx, pos.getLastEntryPrice(), currentPrice, true)
                        : signalEvaluator.evaluateConditions(d.getEntryConditions(), iv, idx, currentPrice, candles, 0, idx);
                if (trigger) addUnit(d, pos, gateway, currentPrice, barTime, true);
            }
            return;
        }

        String reason = stopHit ? "STOP" : takeProfitHit ? "TAKE_PROFIT" : "EXIT_SIGNAL";
        closePosition(d, pos, gateway, currentPrice, reason, barTime);
    }

    /** 숏 포지션 관리(독립 양방향). managePosition의 거울상: 손절선=상단, 트레일링=최저가 추적, 익절=하락. */
    private void manageShort(LiveStrategyDeployment d, LivePosition pos, OrderGateway gateway,
                             Map<String, double[]> iv, List<CandlestickResponse> candles, int idx, double currentPrice, long barTime) {
        if (d.getTrailingStopPct() != null) {
            BigDecimal price = BigDecimal.valueOf(currentPrice);
            if (pos.getTrailRef() == null || price.compareTo(pos.getTrailRef()) < 0) {
                pos.setTrailRef(price);   // 숏은 최저가를 추적
            }
            BigDecimal trailStop = pctAbove(pos.getTrailRef(), d.getTrailingStopPct());
            if (pos.getStopLoss() == null || trailStop.compareTo(pos.getStopLoss()) < 0) {
                pos.setStopLoss(trailStop);   // 상단으로 내려오는 손절선
            }
        }

        double avg = pos.getAvgPrice() != null ? pos.getAvgPrice().doubleValue() : currentPrice;
        boolean stopHit = pos.getStopLoss() != null && currentPrice >= pos.getStopLoss().doubleValue();
        boolean takeProfitHit = d.getTakeProfitPct() != null
                && currentPrice <= avg * (1 - d.getTakeProfitPct().doubleValue() / 100.0);
        boolean exitSignal = d.getShortExitConditions() != null && !d.getShortExitConditions().isEmpty()
                && signalEvaluator.evaluateConditions(d.getShortExitConditions(), iv, idx, currentPrice, candles, 0, idx);

        if (!(stopHit || takeProfitHit || exitSignal)) {
            if (d.isPyramiding() && pos.getUnits() < d.effectiveMaxUnits()) {
                boolean trigger = "ATR".equalsIgnoreCase(d.getPyramidMode())
                        ? atrTrigger(iv, idx, pos.getLastEntryPrice(), currentPrice, false)
                        : (d.getShortEntryConditions() != null && !d.getShortEntryConditions().isEmpty()
                            && signalEvaluator.evaluateConditions(d.getShortEntryConditions(), iv, idx, currentPrice, candles, 0, idx));
                if (trigger) addUnit(d, pos, gateway, currentPrice, barTime, false);
            }
            return;
        }

        String reason = stopHit ? "STOP" : takeProfitHit ? "TAKE_PROFIT" : "EXIT_SIGNAL";
        closeShort(d, pos, gateway, currentPrice, reason, barTime);
    }

    /** 숏 청산(COVER). closePosition의 거울상 — PnL = (평균진입가 - 청산가) × 수량. */
    private void closeShort(LiveStrategyDeployment d, LivePosition pos, OrderGateway gateway,
                            double currentPrice, String reason, long barTime) {
        BigDecimal quantity = pos.getQuantity();
        if (quantity == null || quantity.compareTo(BigDecimal.ZERO) <= 0) {
            resetPosition(pos);
            return;
        }
        String clientOrderId = clientOrderId(d, pos, "COVER", barTime);
        if (orderLogRepository.existsByClientOrderId(clientOrderId)) return;

        Order order;
        try {
            order = gateway.placeMarketOrder(d, d.getUserId(), pos.getSymbol(), pos.getSymbol(),
                    Order.OrderType.COVER, quantity, BigDecimal.valueOf(currentPrice), pos.getAssetType(), clientOrderId);
        } catch (Exception e) {
            log.warn("라이브 숏 청산(COVER) 주문 실패: deploymentId={}, symbol={}, reason={}, error={}",
                    d.getId(), pos.getSymbol(), reason, e.getMessage());
            return;
        }
        if (order == null || order.getStatus() != Order.OrderStatus.FILLED) return;

        BigDecimal fill = order.getFilledPrice() != null ? order.getFilledPrice() : BigDecimal.valueOf(currentPrice);
        recordOrder(d, pos, "COVER", quantity, fill, clientOrderId, order.getId(), reason);
        // 숏 손익 = (진입가 - 청산가) × 수량 (가격 하락 시 이익)
        BigDecimal pnlNative = pos.getAvgPrice() != null
                ? pos.getAvgPrice().subtract(fill).multiply(quantity)
                : BigDecimal.ZERO;
        BigDecimal pnl = priceInForeign(d, pos.getAssetType())
                ? pnlNative.multiply(BigDecimal.valueOf(nativeKrwRate(d, pos.getAssetType())))
                : pnlNative;

        pos.setRealizedPnl(nz(pos.getRealizedPnl()).add(pnl));
        pos.setTradeCount(pos.getTradeCount() + 1);
        if (pnl.compareTo(BigDecimal.ZERO) > 0) pos.setWinCount(pos.getWinCount() + 1);
        d.setRealizedPnl(nz(d.getRealizedPnl()).add(pnl));
        d.setTodayRealizedPnl(nz(d.getTodayRealizedPnl()).add(pnl));
        d.setTradeCount(d.getTradeCount() + 1);
        if (pnl.compareTo(BigDecimal.ZERO) > 0) d.setWinCount(d.getWinCount() + 1);

        resetPosition(pos);
        notifyTrade(d, "자동매매 숏 청산 (" + reason + ")", pos.getSymbol(), fill, "EXIT", pnl);
    }

    private void closePosition(LiveStrategyDeployment d, LivePosition pos, OrderGateway gateway,
                               double currentPrice, String reason, long barTime) {
        BigDecimal quantity = pos.getQuantity();
        if (quantity == null || quantity.compareTo(BigDecimal.ZERO) <= 0) {
            resetPosition(pos);
            return;
        }

        // 멱등성: 같은 봉의 동일 매도가 이미 처리됐으면 스킵
        String clientOrderId = clientOrderId(d, pos, "SELL", barTime);
        if (orderLogRepository.existsByClientOrderId(clientOrderId)) return;

        Order order;
        try {
            order = gateway.placeMarketOrder(d, d.getUserId(), pos.getSymbol(), pos.getSymbol(),
                    Order.OrderType.SELL, quantity, BigDecimal.valueOf(currentPrice), pos.getAssetType(), clientOrderId);
        } catch (Exception e) {
            log.warn("라이브 매도 주문 실패: deploymentId={}, symbol={}, reason={}, error={}",
                    d.getId(), pos.getSymbol(), reason, e.getMessage());
            return;  // 주문 실패 시 포지션 상태를 청산으로 바꾸지 않음(장부-실보유 불일치 방지)
        }
        if (order == null || order.getStatus() != Order.OrderStatus.FILLED) return;

        BigDecimal fill = order.getFilledPrice() != null ? order.getFilledPrice() : BigDecimal.valueOf(currentPrice);
        recordOrder(d, pos, "SELL", quantity, fill, clientOrderId, order.getId(), reason);
        BigDecimal pnlNative = pos.getAvgPrice() != null
                ? fill.subtract(pos.getAvgPrice()).multiply(quantity)
                : BigDecimal.ZERO;
        // 손익은 KRW로 통일(외화 표시 자산은 환산). avgPrice/fill은 네이티브 통화(미국=USD, Bitget=USDT).
        BigDecimal pnl = priceInForeign(d, pos.getAssetType())
                ? pnlNative.multiply(BigDecimal.valueOf(nativeKrwRate(d, pos.getAssetType())))
                : pnlNative;

        pos.setRealizedPnl(nz(pos.getRealizedPnl()).add(pnl));
        pos.setTradeCount(pos.getTradeCount() + 1);
        if (pnl.compareTo(BigDecimal.ZERO) > 0) pos.setWinCount(pos.getWinCount() + 1);

        d.setRealizedPnl(nz(d.getRealizedPnl()).add(pnl));
        d.setTodayRealizedPnl(nz(d.getTodayRealizedPnl()).add(pnl));   // 일일 손실한도 판정용
        d.setTradeCount(d.getTradeCount() + 1);
        if (pnl.compareTo(BigDecimal.ZERO) > 0) d.setWinCount(d.getWinCount() + 1);

        resetPosition(pos);
        notifyTrade(d, "자동매매 청산 (" + reason + ")", pos.getSymbol(), fill, "EXIT", pnl);
    }

    private void resetPosition(LivePosition pos) {
        pos.setDirection(LivePosition.Direction.NONE);
        pos.setAvgPrice(null);
        pos.setQuantity(BigDecimal.ZERO);
        pos.setStopLoss(null);
        pos.setTrailRef(null);
        pos.setUnits(0);
        pos.setLastEntryPrice(null);
    }

    // ── 헬퍼 ──────────────────────────────────────────────────────────

    /** 리스크 파라미터 범위 검증 — 손절/트레일링은 0~100% 사이여야 음수 손절가를 막을 수 있다. */
    private void validateRiskParams(CreateDeploymentRequest req) {
        if (req.getStopLossPct() != null
                && (req.getStopLossPct().compareTo(BigDecimal.ZERO) <= 0 || req.getStopLossPct().compareTo(HUNDRED) >= 0)) {
            throw new IllegalArgumentException("손절률은 0%보다 크고 100%보다 작아야 합니다.");
        }
        if (req.getTrailingStopPct() != null
                && (req.getTrailingStopPct().compareTo(BigDecimal.ZERO) <= 0 || req.getTrailingStopPct().compareTo(HUNDRED) >= 0)) {
            throw new IllegalArgumentException("트레일링 스탑률은 0%보다 크고 100%보다 작아야 합니다.");
        }
        if (req.getTakeProfitPct() != null && req.getTakeProfitPct().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("익절률은 0%보다 커야 합니다.");
        }
        if (req.getDailyLossLimit() != null && req.getDailyLossLimit().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("일일 손실한도는 0보다 커야 합니다.");
        }
    }

    /** 멱등키: 배포+심볼+방향+봉타임스탬프. 같은 봉의 동일 주문이 1회만 나가게 한다. */
    private String clientOrderId(LiveStrategyDeployment d, LivePosition pos, String side, long barTime) {
        return d.getId() + ":" + pos.getSymbol() + ":" + side + ":" + barTime;
    }

    /** 체결 주문을 원장에 기록(감사 + 멱등성 키 영속). 기록 실패가 매매를 막지 않도록 흡수. */
    private void recordOrder(LiveStrategyDeployment d, LivePosition pos, String side,
                             BigDecimal quantity, BigDecimal fill, String clientOrderId, String brokerOrderId, String reason) {
        try {
            orderLogRepository.save(new LiveOrderLog(d.getId(), d.getUserId(), pos.getSymbol(), pos.getAssetType(),
                    side, quantity, fill, clientOrderId, brokerOrderId, "FILLED", reason));
        } catch (Exception e) {
            log.warn("주문 원장 기록 실패: clientOrderId={}, error={}", clientOrderId, e.getMessage());
        }
    }

    private OrderGateway resolveGateway(LiveStrategyDeployment.BrokerType brokerType) {
        return orderGateways.stream()
                .filter(g -> g.supports(brokerType))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("지원하지 않는 브로커입니다: " + brokerType));
    }

    private void notifyTrade(LiveStrategyDeployment d, String title, String symbol, BigDecimal price, String action, BigDecimal pnl) {
        Map<String, String> meta = new HashMap<>();
        meta.put("deploymentId", d.getId());
        meta.put("symbol", symbol);
        meta.put("action", action);
        meta.put("price", String.valueOf(price));
        if (pnl != null) meta.put("pnl", String.valueOf(pnl));
        String message = symbol + " " + String.format("%,.0f", price.doubleValue()) + "원 ("
                + ("ENTRY".equals(action) ? "매수" : "매도") + ")";
        try {
            notificationService.createNotificationWithMeta(
                    d.getUserId(), Notification.NotificationType.STRATEGY_EXECUTED, title, message, meta);
        } catch (Exception e) {
            log.warn("라이브 매매 알림 발송 실패: {}", e.getMessage());
        }
    }

    private void notifyAutoPause(LiveStrategyDeployment d) {
        try {
            notificationService.createNotificationWithMeta(
                    d.getUserId(), Notification.NotificationType.STRATEGY_EXECUTED,
                    "자동매매 일시정지 (일일 손실한도)",
                    d.getStrategyName() + " 오늘 실현손실이 한도(" + String.format("%,.0f", d.getDailyLossLimit().doubleValue())
                            + "원)에 도달해 자동 일시정지되었습니다.",
                    Map.of("deploymentId", d.getId(), "action", "AUTO_PAUSE",
                            "todayPnl", String.valueOf(d.getTodayRealizedPnl())));
        } catch (Exception e) {
            log.warn("자동 일시정지 알림 발송 실패: {}", e.getMessage());
        }
    }

    private static boolean isStockLike(String assetType) {
        return "STOCK".equalsIgnoreCase(assetType)
                || "US_STOCK".equalsIgnoreCase(assetType)
                || "ETF".equalsIgnoreCase(assetType);
    }

    /** USD 표시 자산(미국주식/ETF) 여부 — KRW 환산이 필요한 자산. */
    private static boolean isUsd(String assetType) {
        return "US_STOCK".equalsIgnoreCase(assetType) || "ETF".equalsIgnoreCase(assetType);
    }

    /**
     * 현재가가 외화 표시(KRW 환산 필요)인지. 미국주식/ETF=USD, Bitget 코인=USDT 캔들이라 외화.
     * MOCK 코인(빗썸 KRW 캔들)은 외화가 아니다 — 브로커까지 봐야 통화를 정확히 판별할 수 있다.
     */
    private boolean priceInForeign(LiveStrategyDeployment d, String assetType) {
        return isUsd(assetType) || d.getBrokerType() == LiveStrategyDeployment.BrokerType.BITGET;
    }

    /** 네이티브(외화)→KRW 환율. 미국주식/ETF=USD/KRW, Bitget 코인=USDT/KRW. */
    private double nativeKrwRate(LiveStrategyDeployment d, String assetType) {
        if (d.getBrokerType() == LiveStrategyDeployment.BrokerType.BITGET) {
            return bitgetApiClient.getUsdtKrwRate();
        }
        return exchangeRateService.getUsdKrwRate();
    }

    /**
     * 심볼 1개의 자산군을 판별한다 (백테스트 BacktestService와 동일 규칙):
     * 6자리 숫자→국내주식, ETF 카탈로그 등록→ETF, 미국주식 목록 존재→미국주식, 그 외→코인.
     */
    private String resolveAssetType(String code) {
        if (code == null) return "CRYPTO";
        if (code.matches("\\d{6}")) return "STOCK";
        if (usEtfCatalog.isEtfSymbol(code)) return "ETF";
        if (usStockPriceProvider.exists(code.toUpperCase())) return "US_STOCK";
        return "CRYPTO";
    }

    private static BigDecimal pctBelow(BigDecimal base, BigDecimal pct) {
        // base * (1 - pct/100)
        return base.multiply(BigDecimal.ONE.subtract(pct.divide(BigDecimal.valueOf(100), 10, RoundingMode.HALF_UP)));
    }

    private static BigDecimal pctAbove(BigDecimal base, BigDecimal pct) {
        // base * (1 + pct/100) — 숏 손절선(상단)
        return base.multiply(BigDecimal.ONE.add(pct.divide(BigDecimal.valueOf(100), 10, RoundingMode.HALF_UP)));
    }

    private static BigDecimal nz(BigDecimal v) {
        return v != null ? v : BigDecimal.ZERO;
    }

    private List<Indicator> copyIndicators(List<Indicator> src) {
        List<Indicator> out = new ArrayList<>();
        if (src == null) return out;
        for (Indicator i : src) {
            Map<String, Number> params = i.getParameters() != null ? new HashMap<>(i.getParameters()) : null;
            out.add(new Indicator(i.getType(), params));
        }
        return out;
    }

    private List<Condition> copyConditions(List<Condition> src) {
        List<Condition> out = new ArrayList<>();
        if (src == null) return out;
        for (Condition c : src) {
            out.add(new Condition(c.getIndicator(), c.getOperator(), c.getValue(), c.getLogic(), c.getValueExpression()));
        }
        return out;
    }
}
