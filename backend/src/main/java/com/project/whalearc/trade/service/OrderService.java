package com.project.whalearc.trade.service;

import com.project.whalearc.market.dto.MarketPriceResponse;
import com.project.whalearc.market.service.CryptoPriceProvider;
import com.project.whalearc.market.service.KisApiClient;
import com.project.whalearc.market.service.StockPriceProvider;
import com.project.whalearc.notification.domain.Notification;
import com.project.whalearc.notification.service.NotificationService;
import com.project.whalearc.trade.domain.*;
import com.project.whalearc.trade.repository.OrderRepository;
import com.project.whalearc.trade.repository.TradeRecordRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final TradeRecordRepository tradeRecordRepository;
    private final PortfolioService portfolioService;
    private final CryptoPriceProvider cryptoPriceProvider;
    private final StockPriceProvider stockPriceProvider;
    private final KisApiClient kisApiClient;
    private final NotificationService notificationService;

    // 유저별 동시 주문 방지 락
    private final ConcurrentHashMap<String, ReentrantLock> userLocks = new ConcurrentHashMap<>();

    private ReentrantLock getUserLock(String userId) {
        return userLocks.computeIfAbsent(userId, k -> new ReentrantLock());
    }

    /**
     * 주문 생성 + 시장가 주문은 즉시 체결
     * - 동일 유저의 동시 주문을 락으로 보호 (잔고/수량 race condition 방지)
     */
    public Order createOrder(String userId, String stockCode, String stockName,
                             Order.OrderType orderType, Order.OrderMethod orderMethod,
                             BigDecimal quantity, BigDecimal limitPrice) {
        return createOrder(userId, stockCode, stockName, orderType, orderMethod, quantity, limitPrice, "CRYPTO");
    }

    public Order createOrder(String userId, String stockCode, String stockName,
                             Order.OrderType orderType, Order.OrderMethod orderMethod,
                             BigDecimal quantity, BigDecimal limitPrice, String assetType) {

        if (quantity.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("수량은 0보다 커야 합니다.");
        }
        if (orderMethod == Order.OrderMethod.LIMIT && (limitPrice == null || limitPrice.compareTo(BigDecimal.ZERO) <= 0)) {
            throw new IllegalArgumentException("지정가 주문은 가격을 입력해야 합니다.");
        }
        // 주식은 정수 단위만 거래 가능
        if ("STOCK".equals(assetType) && quantity.stripTrailingZeros().scale() > 0) {
            throw new IllegalArgumentException("주식은 1주 단위로만 거래할 수 있습니다.");
        }

        ReentrantLock lock = getUserLock(userId);
        lock.lock();
        try {
            BigDecimal executionPrice = getExecutionPrice(stockCode, orderMethod, limitPrice, assetType);

            if (executionPrice.compareTo(BigDecimal.ZERO) <= 0) {
                throw new IllegalArgumentException("유효하지 않은 체결 가격입니다: " + stockCode);
            }

            Portfolio portfolio = portfolioService.getOrCreatePortfolio(userId);

            validateOrder(orderType, stockCode, stockName, quantity, executionPrice, portfolio);

            Order order = new Order(userId, stockCode, stockName, orderType, orderMethod, quantity, executionPrice, assetType);
            order = orderRepository.save(order);

            // 시장가 주문은 즉시 체결
            if (orderMethod == Order.OrderMethod.MARKET) {
                executeOrder(order, portfolio, executionPrice);
            }

            return order;
        } finally {
            lock.unlock();
        }
    }

    /**
     * 매수/매도 사전 검증
     */
    private void validateOrder(Order.OrderType orderType, String stockCode, String stockName,
                                BigDecimal quantity, BigDecimal executionPrice, Portfolio portfolio) {
        if (orderType == Order.OrderType.BUY) {
            BigDecimal totalCost = executionPrice.multiply(quantity).multiply(new BigDecimal("1.001")); // 수수료 0.1% 포함
            if (portfolio.getCashBalance().compareTo(totalCost) < 0) {
                throw new IllegalArgumentException("잔고가 부족합니다. 필요: " +
                        String.format("%,.0f", totalCost.doubleValue()) + "원, 보유: " +
                        String.format("%,.0f", portfolio.getCashBalance().doubleValue()) + "원");
            }
        } else {
            Holding holding = portfolio.getHoldings().stream()
                    .filter(h -> h.getStockCode().equals(stockCode))
                    .findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("보유하지 않은 종목입니다: " + stockName));
            if (holding.getQuantity().compareTo(quantity.subtract(new BigDecimal("0.0000001"))) < 0) {
                throw new IllegalArgumentException("보유 수량이 부족합니다. 보유: " +
                        holding.getQuantity().toPlainString() + "개, 요청: " + quantity.toPlainString() + "개");
            }
        }
    }

    /**
     * 주문 체결 처리
     */
    private void executeOrder(Order order, Portfolio portfolio, BigDecimal executionPrice) {
        // 체결 기록 생성
        TradeRecord trade = new TradeRecord(order.getUserId(), order, executionPrice);
        tradeRecordRepository.save(trade);

        // 주문 상태 업데이트
        order.setStatus(Order.OrderStatus.FILLED);
        order.setFilledQuantity(order.getQuantity());
        order.setFilledPrice(executionPrice);
        order.setUpdatedAt(Instant.now());
        orderRepository.save(order);

        // 포트폴리오 업데이트
        if (order.getOrderType() == Order.OrderType.BUY) {
            BigDecimal newBalance = portfolio.getCashBalance().subtract(trade.getNetAmount());
            if (newBalance.compareTo(BigDecimal.ZERO) < 0) {
                throw new IllegalStateException("체결 후 잔고가 음수가 됩니다. 주문을 처리할 수 없습니다.");
            }
            portfolio.setCashBalance(newBalance);
            addOrUpdateHolding(portfolio, order.getStockCode(), order.getStockName(),
                    order.getQuantity(), executionPrice, order.getAssetType());
        } else {
            portfolio.setCashBalance(portfolio.getCashBalance().add(trade.getNetAmount()));
            reduceHolding(portfolio, order.getStockCode(), order.getQuantity());
        }

        portfolioService.save(portfolio);
        log.info("체결 완료: userId={}, stock={}, type={}, qty={}, price={}",
                order.getUserId(), order.getStockCode(), order.getOrderType(),
                order.getQuantity(), executionPrice.toPlainString());
    }

    private void addOrUpdateHolding(Portfolio portfolio, String stockCode, String stockName,
                                     BigDecimal quantity, BigDecimal price, String assetType) {
        Holding existing = portfolio.getHoldings().stream()
                .filter(h -> h.getStockCode().equals(stockCode))
                .findFirst()
                .orElse(null);

        if (existing != null) {
            BigDecimal totalCost = existing.getAveragePrice().multiply(existing.getQuantity()).add(price.multiply(quantity));
            BigDecimal totalQty = existing.getQuantity().add(quantity);
            existing.setAveragePrice(totalCost.divide(totalQty, 10, RoundingMode.HALF_UP));
            existing.setQuantity(totalQty);
            existing.setCurrentPrice(price);
        } else {
            portfolio.getHoldings().add(new Holding(stockCode, stockName, quantity, price, assetType != null ? assetType : "CRYPTO"));
        }
    }

    private void reduceHolding(Portfolio portfolio, String stockCode, BigDecimal quantity) {
        Holding holding = portfolio.getHoldings().stream()
                .filter(h -> h.getStockCode().equals(stockCode))
                .findFirst()
                .orElse(null);

        if (holding != null) {
            BigDecimal remaining = holding.getQuantity().subtract(quantity);
            if (remaining.compareTo(new BigDecimal("0.0000001")) <= 0) {
                portfolio.getHoldings().removeIf(h -> h.getStockCode().equals(stockCode));
            } else {
                holding.setQuantity(remaining);
            }
        }
    }

    /**
     * 실행 가격 결정 (시장가: 현재가 조회, 지정가: 유저 입력값)
     */
    private BigDecimal getExecutionPrice(String stockCode, Order.OrderMethod method, BigDecimal limitPrice, String assetType) {
        if (method == Order.OrderMethod.LIMIT && limitPrice != null) {
            return limitPrice;
        }

        if ("STOCK".equals(assetType)) {
            return getStockCurrentPrice(stockCode);
        }

        // 가상화폐: 빗썸 현재가
        List<MarketPriceResponse> prices = cryptoPriceProvider.getAllKrwTickers();
        if (prices.isEmpty()) {
            throw new IllegalStateException("시세 데이터를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.");
        }
        return prices.stream()
                .filter(p -> p.getSymbol().equals(stockCode))
                .findFirst()
                .map(p -> BigDecimal.valueOf(p.getPrice()))
                .orElseThrow(() -> new IllegalArgumentException("해당 종목의 시세를 찾을 수 없습니다: " + stockCode));
    }

    /** 주식 현재가 조회 (KIS API) */
    private BigDecimal getStockCurrentPrice(String stockCode) {
        // 인기 종목 캐시에서 먼저 조회
        List<MarketPriceResponse> cached = stockPriceProvider.getAllStockPrices();
        for (MarketPriceResponse p : cached) {
            if (p.getSymbol().equals(stockCode)) {
                return BigDecimal.valueOf(p.getPrice());
            }
        }
        // 캐시에 없으면 개별 조회
        Map<String, String> output = kisApiClient.getStockPrice(stockCode);
        if (output == null) {
            throw new IllegalStateException("주식 시세를 불러올 수 없습니다: " + stockCode);
        }
        long price = 0;
        try { price = Long.parseLong(output.get("stck_prpr")); } catch (Exception ignored) {}
        if (price <= 0) {
            throw new IllegalStateException("유효하지 않은 주식 시세입니다: " + stockCode);
        }
        return BigDecimal.valueOf(price);
    }

    public List<Order> getOrders(String userId) {
        return orderRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    public List<TradeRecord> getTrades(String userId) {
        return tradeRecordRepository.findByUserIdOrderByExecutedAtDesc(userId);
    }

    /**
     * 지정가 주문 자동 체결 (스케줄러에서 호출)
     * 현재 시장가가 지정가 조건을 만족하면 체결 처리
     */
    public boolean tryExecuteLimitOrder(Order order, BigDecimal currentMarketPrice) {
        if (order.getStatus() != Order.OrderStatus.PENDING
                || order.getOrderMethod() != Order.OrderMethod.LIMIT) {
            return false;
        }

        // 매수: 시장가가 지정가 이하일 때 체결
        // 매도: 시장가가 지정가 이상일 때 체결
        boolean shouldExecute = (order.getOrderType() == Order.OrderType.BUY && currentMarketPrice.compareTo(order.getPrice()) <= 0)
                || (order.getOrderType() == Order.OrderType.SELL && currentMarketPrice.compareTo(order.getPrice()) >= 0);

        if (!shouldExecute) return false;

        ReentrantLock lock = getUserLock(order.getUserId());
        lock.lock();
        try {
            // 락 획득 후 최신 상태 재조회
            Order fresh = orderRepository.findById(order.getId()).orElse(null);
            if (fresh == null || fresh.getStatus() != Order.OrderStatus.PENDING) return false;

            Portfolio portfolio = portfolioService.getOrCreatePortfolio(fresh.getUserId());

            try {
                validateOrder(fresh.getOrderType(), fresh.getStockCode(), fresh.getStockName(),
                        fresh.getQuantity(), fresh.getPrice(), portfolio);
            } catch (IllegalArgumentException e) {
                log.warn("지정가 주문 자동 체결 검증 실패 [{}]: {}", fresh.getId(), e.getMessage());
                return false;
            }

            executeOrder(fresh, portfolio, fresh.getPrice());
            log.info("지정가 주문 자동 체결: orderId={}, stock={}, price={}",
                    fresh.getId(), fresh.getStockCode(), fresh.getPrice().toPlainString());

            // 지정가 주문 체결 알림
            notificationService.createNotificationWithMeta(
                    fresh.getUserId(),
                    Notification.NotificationType.LIMIT_ORDER_FILLED,
                    "지정가 주문 체결",
                    fresh.getStockName() + " " + fresh.getQuantity().toPlainString() + "개 "
                            + (fresh.getOrderType() == Order.OrderType.BUY ? "매수" : "매도")
                            + " 체결 (" + fresh.getFilledPrice().toPlainString() + "원)",
                    Map.of("orderId", fresh.getId(), "stockCode", fresh.getStockCode(), "assetType", fresh.getAssetType())
            );

            return true;
        } finally {
            lock.unlock();
        }
    }

    public List<Order> getPendingLimitOrders() {
        return orderRepository.findByStatusAndOrderMethod(Order.OrderStatus.PENDING, Order.OrderMethod.LIMIT);
    }

    public void cancelOrder(String userId, String orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("주문을 찾을 수 없습니다."));
        if (!order.getUserId().equals(userId)) {
            throw new IllegalArgumentException("본인의 주문만 취소할 수 있습니다.");
        }
        if (order.getStatus() != Order.OrderStatus.PENDING) {
            throw new IllegalArgumentException("대기 중인 주문만 취소할 수 있습니다.");
        }
        order.setStatus(Order.OrderStatus.CANCELLED);
        order.setUpdatedAt(Instant.now());
        orderRepository.save(order);
    }
}
