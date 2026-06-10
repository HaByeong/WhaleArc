package com.project.whalearc.live.service;

import com.project.whalearc.live.domain.LiveStrategyDeployment;
import com.project.whalearc.live.domain.LiveStrategyDeployment.LivePosition;
import com.project.whalearc.live.domain.LiveOrderLog;
import com.project.whalearc.live.dto.CreateDeploymentRequest;
import com.project.whalearc.live.repository.LiveOrderLogRepository;
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

        LiveStrategyDeployment d = new LiveStrategyDeployment();
        d.setUserId(userId);
        d.setStrategyId(strategyId);
        d.setStrategyName(strategyName);
        d.setIndicators(indicators);
        d.setEntryConditions(entryConditions);
        d.setExitConditions(exitConditions);
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
            deploymentRepository.delete(d);
            try {
                orderLogRepository.deleteByDeploymentId(deploymentId);
            } catch (Exception e) {
                log.warn("배포 삭제 시 주문 로그 정리 실패: deploymentId={}, error={}", deploymentId, e.getMessage());
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
            if (pos.getDirection() != LivePosition.Direction.LONG) continue;
            try {
                double price = latestPrice(d, pos);
                if (price <= 0) {
                    log.warn("지금 청산 스킵(현재가 0 이하): deploymentId={}, symbol={}", d.getId(), pos.getSymbol());
                    continue;
                }
                // 멱등 barTime은 현재 초 — 같은 초 더블클릭은 디듀프, 청산 후 direction=NONE이라 재청산도 방지.
                closePosition(d, pos, gateway, price, "MANUAL", Instant.now().getEpochSecond());
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
            boolean entrySignal = signalEvaluator.evaluateConditions(
                    d.getEntryConditions(), iv, idx, currentPrice, candles, 0, idx);
            if (!entrySignal) return;
            openPosition(d, pos, gateway, currentPrice, barTime);
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
        // 선물은 레버리지만큼 노출(수량)을 키운다: 수량 = (할당증거금 × 레버리지) / 단가. 현물은 레버리지=1.
        BigDecimal exposure = alloc.multiply(BigDecimal.valueOf(d.effectiveLeverage()));
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
        pos.setTradeCount(pos.getTradeCount() + 1);
        d.setTradeCount(d.getTradeCount() + 1);

        notifyTrade(d, "자동매매 매수 진입", pos.getSymbol(), fill, "ENTRY", null);
    }

    private void managePosition(LiveStrategyDeployment d, LivePosition pos, OrderGateway gateway,
                                Map<String, double[]> iv, List<CandlestickResponse> candles, int idx, double currentPrice, long barTime) {
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

        if (!(stopHit || takeProfitHit || exitSignal)) return;

        String reason = stopHit ? "STOP" : takeProfitHit ? "TAKE_PROFIT" : "EXIT_SIGNAL";
        closePosition(d, pos, gateway, currentPrice, reason, barTime);
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
