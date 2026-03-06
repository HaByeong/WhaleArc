package com.project.whalearc.trade.service;

import com.project.whalearc.market.dto.MarketPriceResponse;
import com.project.whalearc.market.service.CryptoPriceProvider;
import com.project.whalearc.trade.domain.*;
import com.project.whalearc.trade.repository.OrderRepository;
import com.project.whalearc.trade.repository.TradeRecordRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
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
                             int quantity, Double limitPrice) {

        if (quantity <= 0) {
            throw new IllegalArgumentException("수량은 1 이상이어야 합니다.");
        }
        if (orderMethod == Order.OrderMethod.LIMIT && (limitPrice == null || limitPrice <= 0)) {
            throw new IllegalArgumentException("지정가 주문은 가격을 입력해야 합니다.");
        }

        ReentrantLock lock = getUserLock(userId);
        lock.lock();
        try {
            double executionPrice = getExecutionPrice(stockCode, orderMethod, limitPrice);

            if (executionPrice <= 0) {
                throw new IllegalArgumentException("유효하지 않은 체결 가격입니다: " + stockCode);
            }

            Portfolio portfolio = portfolioService.getOrCreatePortfolio(userId);

            validateOrder(orderType, stockCode, stockName, quantity, executionPrice, portfolio);

            Order order = new Order(userId, stockCode, stockName, orderType, orderMethod, quantity, executionPrice);
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
                                int quantity, double executionPrice, Portfolio portfolio) {
        if (orderType == Order.OrderType.BUY) {
            double totalCost = executionPrice * quantity * 1.001; // 수수료 0.1% 포함
            if (portfolio.getCashBalance() < totalCost) {
                throw new IllegalArgumentException("잔고가 부족합니다. 필요: " +
                        String.format("%,.0f", totalCost) + "원, 보유: " +
                        String.format("%,.0f", portfolio.getCashBalance()) + "원");
            }
        } else {
            Holding holding = portfolio.getHoldings().stream()
                    .filter(h -> h.getStockCode().equals(stockCode))
                    .findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("보유하지 않은 종목입니다: " + stockName));
            if (holding.getQuantity() < quantity) {
                throw new IllegalArgumentException("보유 수량이 부족합니다. 보유: " +
                        holding.getQuantity() + "개, 요청: " + quantity + "개");
            }
        }
    }

    /**
     * 주문 체결 처리
     */
    private void executeOrder(Order order, Portfolio portfolio, double executionPrice) {
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
            double newBalance = portfolio.getCashBalance() - trade.getNetAmount();
            if (newBalance < 0) {
                throw new IllegalStateException("체결 후 잔고가 음수가 됩니다. 주문을 처리할 수 없습니다.");
            }
            portfolio.setCashBalance(newBalance);
            addOrUpdateHolding(portfolio, order.getStockCode(), order.getStockName(),
                    order.getQuantity(), executionPrice);
        } else {
            portfolio.setCashBalance(portfolio.getCashBalance() + trade.getNetAmount());
            reduceHolding(portfolio, order.getStockCode(), order.getQuantity());
        }

        portfolioService.save(portfolio);
        log.info("체결 완료: userId={}, stock={}, type={}, qty={}, price={}",
                order.getUserId(), order.getStockCode(), order.getOrderType(),
                order.getQuantity(), String.format("%.0f", executionPrice));
    }

    private void addOrUpdateHolding(Portfolio portfolio, String stockCode, String stockName,
                                     int quantity, double price) {
        Holding existing = portfolio.getHoldings().stream()
                .filter(h -> h.getStockCode().equals(stockCode))
                .findFirst()
                .orElse(null);

        if (existing != null) {
            double totalCost = existing.getAveragePrice() * existing.getQuantity() + price * quantity;
            int totalQty = existing.getQuantity() + quantity;
            existing.setAveragePrice(totalCost / totalQty);
            existing.setQuantity(totalQty);
            existing.setCurrentPrice(price);
        } else {
            portfolio.getHoldings().add(new Holding(stockCode, stockName, quantity, price));
        }
    }

    private void reduceHolding(Portfolio portfolio, String stockCode, int quantity) {
        Holding holding = portfolio.getHoldings().stream()
                .filter(h -> h.getStockCode().equals(stockCode))
                .findFirst()
                .orElse(null);

        if (holding != null) {
            int remaining = holding.getQuantity() - quantity;
            if (remaining <= 0) {
                portfolio.getHoldings().removeIf(h -> h.getStockCode().equals(stockCode));
            } else {
                holding.setQuantity(remaining);
            }
        }
    }

    /**
     * 실행 가격 결정 (시장가: 빗썸 현재가, 지정가: 유저 입력값)
     */
    private double getExecutionPrice(String stockCode, Order.OrderMethod method, Double limitPrice) {
        if (method == Order.OrderMethod.LIMIT && limitPrice != null) {
            return limitPrice;
        }
        List<MarketPriceResponse> prices = cryptoPriceProvider.getAllKrwTickers();
        if (prices.isEmpty()) {
            throw new IllegalStateException("시세 데이터를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.");
        }
        return prices.stream()
                .filter(p -> p.getSymbol().equals(stockCode))
                .findFirst()
                .map(MarketPriceResponse::getPrice)
                .orElseThrow(() -> new IllegalArgumentException("해당 종목의 시세를 찾을 수 없습니다: " + stockCode));
    }

    public List<Order> getOrders(String userId) {
        return orderRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    public List<TradeRecord> getTrades(String userId) {
        return tradeRecordRepository.findByUserIdOrderByExecutedAtDesc(userId);
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
