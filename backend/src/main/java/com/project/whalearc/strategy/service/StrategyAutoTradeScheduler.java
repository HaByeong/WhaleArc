package com.project.whalearc.strategy.service;

import com.project.whalearc.market.dto.CandlestickResponse;
import com.project.whalearc.market.service.CandlestickService;
import com.project.whalearc.market.service.UsEtfCatalog;
import com.project.whalearc.market.service.UsStockPriceProvider;
import com.project.whalearc.notification.domain.Notification;
import com.project.whalearc.notification.service.NotificationService;
import com.project.whalearc.strategy.domain.Strategy;
import com.project.whalearc.strategy.repository.StrategyRepository;
import com.project.whalearc.trade.domain.Holding;
import com.project.whalearc.trade.domain.Order;
import com.project.whalearc.trade.domain.Portfolio;
import com.project.whalearc.trade.domain.TradeRecord;
import com.project.whalearc.trade.service.OrderService;
import com.project.whalearc.trade.service.PortfolioService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

/**
 * VIRT 자동매매 스케줄러.
 * autoTradingEnabled=true 전략을 주기적으로 평가해, 최신 캔들 기준 진입/청산 신호 발생 시
 * 모의(VIRT) 계좌에 시장가 매수/매도를 자동 집행한다. (실계좌 키는 읽기전용이라 모의 전용)
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class StrategyAutoTradeScheduler {

    private final StrategyRepository strategyRepository;
    private final BacktestService backtestService;
    private final CandlestickService candlestickService;
    private final OrderService orderService;
    private final PortfolioService portfolioService;
    private final NotificationService notificationService;
    private final UsEtfCatalog usEtfCatalog;
    private final UsStockPriceProvider usStockPriceProvider;

    private static final BigDecimal DEFAULT_AMOUNT = BigDecimal.valueOf(1_000_000);
    // 매수 시 OrderService 가 수수료(0.1%)를 더해 잔고를 검증하므로, 사전 잔고 체크에도 동일 버퍼 반영
    private static final BigDecimal COST_BUFFER = BigDecimal.ONE.add(TradeRecord.COMMISSION_RATE);
    private static final long COOLDOWN_MS = 30 * 60 * 1000L; // 동일 전략·종목 재매매 최소 간격(과도한 churn 방지)
    private final ConcurrentHashMap<String, Long> lastTradeAt = new ConcurrentHashMap<>();

    @Scheduled(fixedRate = 60_000, initialDelay = 30_000) // 1분마다, 부팅 30초 후 시작
    public void run() {
        List<Strategy> strategies;
        try {
            strategies = strategyRepository.findByAutoTradingEnabledTrue();
        } catch (Exception e) {
            log.warn("[AutoTrade] 전략 조회 실패: {}", e.getMessage());
            return;
        }
        if (strategies.isEmpty()) return;
        for (Strategy s : strategies) {
            try {
                process(s);
            } catch (Exception e) {
                log.warn("[AutoTrade] 전략 {} 처리 실패: {}", s.getId(), e.getMessage());
            }
        }
    }

    private void process(Strategy s) {
        if (s.getTargetAssets() == null || s.getTargetAssets().isEmpty()) return;
        BigDecimal perAsset = (s.getAutoTradeAmount() != null && s.getAutoTradeAmount().compareTo(BigDecimal.ZERO) > 0)
                ? s.getAutoTradeAmount() : DEFAULT_AMOUNT;
        for (String code : s.getTargetAssets()) {
            try {
                processAsset(s, code, perAsset);
            } catch (Exception e) {
                log.warn("[AutoTrade] {} {} 처리 실패: {}", s.getId(), code, e.getMessage());
            }
        }
    }

    private void processAsset(Strategy s, String code, BigDecimal perAsset) {
        String userId = s.getUserId();
        String assetType = resolveAssetType(s, code);
        String interval = "CRYPTO".equals(assetType) ? "24h" : "1d";

        List<CandlestickResponse> candles = candlestickService.getCandlesticks(code, interval, assetType);
        if (candles == null || candles.size() < 3) {
            log.warn("[AutoTrade] 캔들 데이터 부족: strategy={}, asset={}, type={} (신호 평가 불가)", s.getId(), code, assetType);
            return;
        }

        BacktestService.SignalCheck sig = backtestService.evaluateLatestSignal(
                s.getIndicators(), s.getEntryConditions(), s.getExitConditions(), candles);
        if (!sig.entry() && !sig.exit()) return;

        double price = candles.get(candles.size() - 1).getClose(); // 현재가(체결가는 OrderService가 시장가로 재조회)
        if (price <= 0) return;

        // 과도한 churn 방지: 동일 전략·종목 최근 거래 쿨다운
        String cdKey = s.getId() + ":" + code;
        Long last = lastTradeAt.get(cdKey);
        if (last != null && System.currentTimeMillis() - last < COOLDOWN_MS) return;

        // 매 종목마다 최신 포트폴리오 재조회 — 직전 거래로 변동된 현금·보유 반영
        Portfolio pf = portfolioService.getOrCreatePortfolio(userId);
        Holding heldPos = pf.getHoldings() == null ? null : pf.getHoldings().stream()
                .filter(h -> code.equals(h.getStockCode())).findFirst().orElse(null);
        boolean isHolding = heldPos != null && heldPos.getQuantity() != null
                && heldPos.getQuantity().compareTo(BigDecimal.ZERO) > 0;

        String name = (s.getTargetAssetNames() != null) ? s.getTargetAssetNames().getOrDefault(code, code) : code;
        boolean stockLike = !"CRYPTO".equals(assetType);
        BigDecimal priceBd = BigDecimal.valueOf(price);

        if (sig.entry() && !isHolding) {
            BigDecimal qty = perAsset.divide(priceBd, 10, RoundingMode.HALF_UP);
            qty = stockLike ? qty.setScale(0, RoundingMode.FLOOR) : qty.setScale(8, RoundingMode.FLOOR);
            if (qty.compareTo(BigDecimal.ZERO) <= 0) {
                log.debug("[AutoTrade] 수량 0 — 종목당 금액({})이 1주/최소단위 가격보다 작음: {} @ {}", perAsset, code, price);
                return;
            }
            BigDecimal cost = qty.multiply(priceBd).multiply(COST_BUFFER); // 수수료 포함 추정 비용
            if (pf.getCashBalance() == null || pf.getCashBalance().compareTo(cost) < 0) return; // 잔고 부족 → 스킵
            orderService.createOrder(userId, code, name, Order.OrderType.BUY, Order.OrderMethod.MARKET, qty, null, assetType, "자동매매");
            lastTradeAt.put(cdKey, System.currentTimeMillis());
            notify(userId, s.getName(), name, "매수", qty, stockLike);
            log.info("[AutoTrade] 매수 체결: user={}, strategy={}, asset={}, qty={}, price={}", userId, s.getName(), code, qty, price);
        } else if (sig.exit() && isHolding) {
            BigDecimal qty = heldPos.getQuantity();
            orderService.createOrder(userId, code, name, Order.OrderType.SELL, Order.OrderMethod.MARKET, qty, null, assetType, "자동매매");
            lastTradeAt.put(cdKey, System.currentTimeMillis());
            notify(userId, s.getName(), name, "매도", qty, stockLike);
            log.info("[AutoTrade] 매도 체결: user={}, strategy={}, asset={}, qty={}, price={}", userId, s.getName(), code, qty, price);
        }
    }

    private String resolveAssetType(Strategy s, String code) {
        String at = s.getAssetType();
        if (at != null && !"MIXED".equals(at)) return at;
        // MIXED/미지정: 백테스트와 동일하게 코드로 추론 (6자리=국내주식, ETF목록, 미국주식, 그 외 크립토)
        if (code == null) return "CRYPTO";
        if (code.matches("\\d{6}")) return "STOCK";
        if (usEtfCatalog.isEtfSymbol(code)) return "ETF";
        if (usStockPriceProvider.exists(code.toUpperCase())) return "US_STOCK";
        return "CRYPTO";
    }

    private void notify(String userId, String stratName, String assetName, String side, BigDecimal qty, boolean stockLike) {
        String qtyStr = stockLike
                ? qty.setScale(0, RoundingMode.FLOOR).toPlainString() + "주"
                : qty.stripTrailingZeros().toPlainString() + "개";
        notificationService.createNotification(userId,
                Notification.NotificationType.AUTO_TRADE_EXECUTED,
                "자동매매 " + side + " 체결",
                "'" + stratName + "' 신호 발생 — " + assetName + " " + qtyStr + " 시장가 " + side + " (모의)");
    }
}
