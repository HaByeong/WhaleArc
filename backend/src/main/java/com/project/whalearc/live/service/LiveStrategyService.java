package com.project.whalearc.live.service;

import com.project.whalearc.live.domain.LiveStrategyDeployment;
import com.project.whalearc.live.domain.LiveStrategyDeployment.LivePosition;
import com.project.whalearc.live.dto.CreateDeploymentRequest;
import com.project.whalearc.live.repository.LiveStrategyDeploymentRepository;
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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
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
    private final List<OrderGateway> orderGateways;

    /** 전역 킬스위치 — 켜지면 스케줄러가 모든 평가를 건너뛴다. */
    private final AtomicBoolean killSwitch = new AtomicBoolean(false);

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

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

        // 모의(PAPER) 잔고 검증: 할당 금액이 현재 모의 가용 현금을 넘지 않게 (기본 over-allocation 가드).
        // 주의: 여러 배포가 같은 모의 Portfolio를 공유하므로 배포별 자금 예약은 아직 없다(이후 단계 보강).
        Portfolio portfolio = portfolioService.getOrCreatePortfolio(userId);
        if (portfolio.getCashBalance() == null || portfolio.getCashBalance().compareTo(allocatedCash) < 0) {
            throw new IllegalArgumentException("할당 금액이 모의 투자 가용 현금을 초과합니다.");
        }

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
        // 처리 가능한 게이트웨이가 없으면 거부 (1단계: MOCK 외 미지원 → 실계좌 자동 차단)
        resolveGateway(brokerType);

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
        d.setStatus(LiveStrategyDeployment.Status.RUNNING);
        d.setAllocatedCash(allocatedCash);
        d.setStopLossPct(req.getStopLossPct());
        d.setTakeProfitPct(req.getTakeProfitPct());
        d.setTrailingStopPct(req.getTrailingStopPct());

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

        LiveStrategyDeployment saved = deploymentRepository.save(d);
        log.info("라이브 배포 생성: userId={}, deploymentId={}, strategy={}, assets={}, mode={}",
                userId, saved.getId(), strategyName, targetAssets, accountMode);
        return saved;
    }

    public List<LiveStrategyDeployment> getUserDeployments(String userId) {
        return deploymentRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    public List<LiveStrategyDeployment> getRunningDeployments() {
        return deploymentRepository.findByStatus(LiveStrategyDeployment.Status.RUNNING);
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

    private LiveStrategyDeployment transition(String userId, String deploymentId, LiveStrategyDeployment.Status target) {
        LiveStrategyDeployment d = deploymentRepository.findByIdAndUserId(deploymentId, userId)
                .orElseThrow(() -> new IllegalArgumentException("배포를 찾을 수 없습니다."));
        d.setStatus(target);
        d.setUpdatedAt(Instant.now());
        return deploymentRepository.save(d);
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

    /** RUNNING 배포 1건의 모든 심볼을 평가하고 필요 시 주문을 낸다. 포지션별 예외는 격리. */
    public void evaluateDeployment(LiveStrategyDeployment d) {
        if (d.getStatus() != LiveStrategyDeployment.Status.RUNNING) return;
        OrderGateway gateway = resolveGateway(d.getBrokerType());

        for (LivePosition pos : d.getPositions()) {
            try {
                evaluatePosition(d, pos, gateway);
            } catch (Exception e) {
                log.error("라이브 포지션 평가 실패: deploymentId={}, symbol={}, error={}",
                        d.getId(), pos.getSymbol(), e.getMessage());
            }
        }
        // 평가 도중 사용자가 pause/stop 했을 수 있다. 최신 status를 다시 읽어 보존함으로써
        // 스케줄러의 save가 사용자의 상태 변경을 RUNNING으로 되돌리지 않게 한다(체결된 포지션 변경은 그대로 영속).
        // (완전한 동시성 보호 — 분산 락/@Version — 는 이후 단계)
        deploymentRepository.findById(d.getId()).ifPresent(fresh -> d.setStatus(fresh.getStatus()));
        d.setLastEvaluatedAt(Instant.now());
        d.setUpdatedAt(Instant.now());
        deploymentRepository.save(d);
    }

    private void evaluatePosition(LiveStrategyDeployment d, LivePosition pos, OrderGateway gateway) {
        String assetType = pos.getAssetType();
        // 주식류(국내/미국/ETF)는 KIS가 일봉만 제공하므로 인터벌을 1d로 고정, 코인은 배포 인터벌 사용
        String interval = isStockLike(assetType) ? "1d" : d.getInterval();
        List<CandlestickResponse> candles = candlestickService.getCandlesticks(pos.getSymbol(), interval, assetType);
        if (candles == null || candles.isEmpty()) return;
        // 시간순(과거→현재) 정렬 보장 (코인 빗썸 응답은 정렬 미보장)
        candles = new ArrayList<>(candles);
        candles.sort(Comparator.comparingLong(CandlestickResponse::getTime));

        int idx = candles.size() - 1;
        double currentPrice = candles.get(idx).getClose();
        if (currentPrice <= 0) return;

        Map<String, double[]> iv = indicatorContextBuilder.calculateIndicators(
                candles, d.getIndicators(), d.getEntryConditions(), d.getExitConditions());

        if (pos.getDirection() == LivePosition.Direction.NONE) {
            boolean entrySignal = signalEvaluator.evaluateConditions(
                    d.getEntryConditions(), iv, idx, currentPrice, candles, 0, idx);
            if (!entrySignal) return;
            openPosition(d, pos, gateway, currentPrice);
        } else {
            managePosition(d, pos, gateway, iv, candles, idx, currentPrice);
        }
    }

    private void openPosition(LiveStrategyDeployment d, LivePosition pos, OrderGateway gateway, double currentPrice) {
        BigDecimal alloc = pos.getAllocatedCash();
        if (alloc == null || alloc.compareTo(BigDecimal.ZERO) <= 0) return;

        String assetType = pos.getAssetType();
        BigDecimal price = BigDecimal.valueOf(currentPrice);   // 네이티브 통화(미국주식/ETF는 USD, 그 외 KRW)
        // allocatedCash는 KRW 기준. 미국주식/ETF는 가격이 USD이므로 KRW 환산 단가로 나눠 수량을 산정한다.
        BigDecimal krwPerUnit = isUsd(assetType)
                ? price.multiply(BigDecimal.valueOf(exchangeRateService.getUsdKrwRate()))
                : price;
        if (krwPerUnit.compareTo(BigDecimal.ZERO) <= 0) {
            log.warn("라이브 매수 불가(환산 단가 0 이하): deploymentId={}, symbol={}, price={}", d.getId(), pos.getSymbol(), price);
            return;
        }
        int scale = isStockLike(assetType) ? 0 : 8;   // 주식류는 정수 수량, 코인은 소수 8자리
        BigDecimal quantity = alloc.divide(krwPerUnit, scale, RoundingMode.DOWN);
        if (quantity.compareTo(BigDecimal.ZERO) <= 0) {
            // 분배 금액이 1주(또는 최소 단위) 가격보다 작아 수량이 0이 됨 — 조용한 무동작 방지용 경고
            log.warn("라이브 매수 불가(분배 자금으로 수량 0): deploymentId={}, symbol={}, alloc={}, krwPerUnit={}",
                    d.getId(), pos.getSymbol(), alloc, krwPerUnit);
            return;
        }

        Order order;
        try {
            order = gateway.placeMarketOrder(d.getUserId(), pos.getSymbol(), pos.getSymbol(),
                    Order.OrderType.BUY, quantity, assetType);
        } catch (Exception e) {
            log.warn("라이브 매수 주문 실패: deploymentId={}, symbol={}, error={}", d.getId(), pos.getSymbol(), e.getMessage());
            return;
        }
        if (order == null || order.getStatus() != Order.OrderStatus.FILLED) return;

        BigDecimal fill = order.getFilledPrice() != null ? order.getFilledPrice() : price;
        pos.setDirection(LivePosition.Direction.LONG);
        pos.setAvgPrice(fill);
        pos.setQuantity(quantity);
        pos.setTrailRef(fill);
        pos.setStopLoss(d.getStopLossPct() != null ? pctBelow(fill, d.getStopLossPct()) : null);
        pos.setTradeCount(pos.getTradeCount() + 1);
        d.setTradeCount(d.getTradeCount() + 1);

        notifyTrade(d, "자동매매 매수 진입", pos.getSymbol(), fill, "ENTRY", null);
    }

    private void managePosition(LiveStrategyDeployment d, LivePosition pos, OrderGateway gateway,
                                Map<String, double[]> iv, List<CandlestickResponse> candles, int idx, double currentPrice) {
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
        closePosition(d, pos, gateway, currentPrice, reason);
    }

    private void closePosition(LiveStrategyDeployment d, LivePosition pos, OrderGateway gateway,
                               double currentPrice, String reason) {
        BigDecimal quantity = pos.getQuantity();
        if (quantity == null || quantity.compareTo(BigDecimal.ZERO) <= 0) {
            resetPosition(pos);
            return;
        }

        Order order;
        try {
            order = gateway.placeMarketOrder(d.getUserId(), pos.getSymbol(), pos.getSymbol(),
                    Order.OrderType.SELL, quantity, pos.getAssetType());
        } catch (Exception e) {
            log.warn("라이브 매도 주문 실패: deploymentId={}, symbol={}, reason={}, error={}",
                    d.getId(), pos.getSymbol(), reason, e.getMessage());
            return;  // 주문 실패 시 포지션 상태를 청산으로 바꾸지 않음(장부-실보유 불일치 방지)
        }
        if (order == null || order.getStatus() != Order.OrderStatus.FILLED) return;

        BigDecimal fill = order.getFilledPrice() != null ? order.getFilledPrice() : BigDecimal.valueOf(currentPrice);
        BigDecimal pnlNative = pos.getAvgPrice() != null
                ? fill.subtract(pos.getAvgPrice()).multiply(quantity)
                : BigDecimal.ZERO;
        // 손익은 KRW로 통일(미국주식/ETF는 USD→KRW 환산). avgPrice/fill은 네이티브 통화.
        BigDecimal pnl = isUsd(pos.getAssetType())
                ? pnlNative.multiply(BigDecimal.valueOf(exchangeRateService.getUsdKrwRate()))
                : pnlNative;

        pos.setRealizedPnl(nz(pos.getRealizedPnl()).add(pnl));
        pos.setTradeCount(pos.getTradeCount() + 1);
        if (pnl.compareTo(BigDecimal.ZERO) > 0) pos.setWinCount(pos.getWinCount() + 1);

        d.setRealizedPnl(nz(d.getRealizedPnl()).add(pnl));
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
