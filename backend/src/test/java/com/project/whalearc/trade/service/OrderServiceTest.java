package com.project.whalearc.trade.service;

import com.project.whalearc.market.dto.MarketPriceResponse;
import com.project.whalearc.market.service.*;
import com.project.whalearc.notification.service.NotificationService;
import com.project.whalearc.trade.domain.Holding;
import com.project.whalearc.trade.domain.Order;
import com.project.whalearc.trade.domain.Portfolio;
import com.project.whalearc.trade.repository.OrderRepository;
import com.project.whalearc.trade.repository.TradeRecordRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.locks.ReentrantLock;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * OrderService 핵심 머니 경로 단위 테스트 (Mockito).
 *  - 멱등성(L7): 동일 clientOrderId 재요청은 재체결하지 않고 기존 주문 반환
 *  - 검증: 수량 0 이하 / 주식 소수주 거부, 잔고 부족 거부
 *  - 매수: 현금 감소 + 보유 추가 / 매도 전량: 보유 제거(L6) + 현금 증가
 */
@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock OrderRepository orderRepository;
    @Mock TradeRecordRepository tradeRecordRepository;
    @Mock PortfolioService portfolioService;
    @Mock CryptoPriceProvider cryptoPriceProvider;
    @Mock StockPriceProvider stockPriceProvider;
    @Mock UsStockPriceProvider usStockPriceProvider;
    @Mock UsEtfPriceProvider usEtfPriceProvider;
    @Mock UsEtfCatalog usEtfCatalog;
    @Mock KisApiClient kisApiClient;
    @Mock ExchangeRateService exchangeRateService;
    @Mock NotificationService notificationService;
    @Mock UserLockRegistry userLockRegistry;

    @InjectMocks OrderService orderService;

    private static final String USER = "user-1";
    private static final String SYM = "BTC";

    @BeforeEach
    void setUp() {
        // 락은 실제 ReentrantLock 으로 (재진입/직렬화 동작 보존)
        lenient().when(userLockRegistry.getUserLock(anyString())).thenReturn(new ReentrantLock());
    }

    private MarketPriceResponse ticker(String symbol, double price) {
        MarketPriceResponse m = new MarketPriceResponse();
        m.setSymbol(symbol);
        m.setPrice(price);
        return m;
    }

    private Portfolio portfolioWithCash(double cash) {
        return new Portfolio(USER, BigDecimal.valueOf(cash));
    }

    // ── 멱등성 (L7) ──
    @Test
    void sameClientOrderId_returnsExisting_withoutReExecuting() {
        Order existing = new Order(USER, SYM, "비트코인", Order.OrderType.BUY, Order.OrderMethod.MARKET,
                BigDecimal.ONE, BigDecimal.valueOf(1000), "CRYPTO");
        when(orderRepository.findByUserIdAndClientOrderId(USER, "key-1")).thenReturn(Optional.of(existing));

        Order result = orderService.createOrder(USER, SYM, "비트코인",
                Order.OrderType.BUY, Order.OrderMethod.MARKET, BigDecimal.ONE, null, "CRYPTO", null, "key-1");

        assertSame(existing, result, "기존 주문을 그대로 반환");
        verify(cryptoPriceProvider, never()).getAllKrwTickers(); // 재체결 안 함
        verify(portfolioService, never()).save(any());
        verify(orderRepository, never()).save(any());
    }

    // ── 검증 ──
    @Test
    void rejectsZeroOrNegativeQuantity() {
        assertThrows(IllegalArgumentException.class, () -> orderService.createOrder(
                USER, SYM, "비트코인", Order.OrderType.BUY, Order.OrderMethod.MARKET, BigDecimal.ZERO, null, "CRYPTO"));
    }

    @Test
    void rejectsFractionalStockQuantity() {
        assertThrows(IllegalArgumentException.class, () -> orderService.createOrder(
                USER, "005930", "삼성전자", Order.OrderType.BUY, Order.OrderMethod.MARKET,
                new BigDecimal("1.5"), null, "STOCK"));
    }

    @Test
    void insufficientCash_isRejected() {
        when(cryptoPriceProvider.getAllKrwTickers()).thenReturn(List.of(ticker(SYM, 1000)));
        when(portfolioService.getOrCreatePortfolio(USER)).thenReturn(portfolioWithCash(100)); // 100원뿐

        assertThrows(IllegalArgumentException.class, () -> orderService.createOrder(
                USER, SYM, "비트코인", Order.OrderType.BUY, Order.OrderMethod.MARKET,
                BigDecimal.valueOf(10), null, "CRYPTO")); // 약 10,000원 필요
        verify(portfolioService, never()).save(any()); // 체결 전 차단
    }

    // ── 매수: 현금 감소 + 보유 추가 ──
    @Test
    void marketBuy_reducesCash_andAddsHolding() {
        Portfolio pf = portfolioWithCash(1_000_000);
        when(cryptoPriceProvider.getAllKrwTickers()).thenReturn(List.of(ticker(SYM, 1000)));
        when(portfolioService.getOrCreatePortfolio(USER)).thenReturn(pf);
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> {
            Order o = inv.getArgument(0);
            if (o.getId() == null) o.setId("oid-test"); // Mongo가 채우는 id를 모킹(체결 알림이 null id로 NPE 안 나도록)
            return o;
        });

        orderService.createOrder(USER, SYM, "비트코인", Order.OrderType.BUY, Order.OrderMethod.MARKET,
                BigDecimal.valueOf(10), null, "CRYPTO");

        assertTrue(pf.getCashBalance().compareTo(BigDecimal.valueOf(1_000_000)) < 0, "현금이 감소");
        Holding h = pf.getHoldings().stream().filter(x -> SYM.equals(x.getStockCode())).findFirst().orElse(null);
        assertNotNull(h, "보유 종목 추가됨");
        assertEquals(0, h.getQuantity().compareTo(BigDecimal.valueOf(10)), "수량 10");
        verify(portfolioService).save(pf);
    }

    // ── 매도 전량: 보유 제거(L6) + 현금 증가 ──
    @Test
    void marketSellAll_removesHolding_andIncreasesCash() {
        Portfolio pf = portfolioWithCash(0);
        pf.getHoldings().add(new Holding(SYM, "비트코인", BigDecimal.valueOf(10), BigDecimal.valueOf(1000), "CRYPTO"));
        when(cryptoPriceProvider.getAllKrwTickers()).thenReturn(List.of(ticker(SYM, 1000)));
        when(portfolioService.getOrCreatePortfolio(USER)).thenReturn(pf);
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> {
            Order o = inv.getArgument(0);
            if (o.getId() == null) o.setId("oid-test"); // Mongo가 채우는 id를 모킹(체결 알림이 null id로 NPE 안 나도록)
            return o;
        });

        orderService.createOrder(USER, SYM, "비트코인", Order.OrderType.SELL, Order.OrderMethod.MARKET,
                BigDecimal.valueOf(10), null, "CRYPTO");

        assertTrue(pf.getHoldings().stream().noneMatch(x -> SYM.equals(x.getStockCode())),
                "전량 매도 → 보유 제거 (L6: 잔량 0 이하만 제거)");
        assertTrue(pf.getCashBalance().compareTo(BigDecimal.ZERO) > 0, "현금 증가");
    }

    @Test
    void sellMoreThanHeld_isRejected() {
        Portfolio pf = portfolioWithCash(0);
        pf.getHoldings().add(new Holding(SYM, "비트코인", BigDecimal.valueOf(2), BigDecimal.valueOf(1000), "CRYPTO"));
        when(cryptoPriceProvider.getAllKrwTickers()).thenReturn(List.of(ticker(SYM, 1000)));
        when(portfolioService.getOrCreatePortfolio(USER)).thenReturn(pf);

        assertThrows(IllegalArgumentException.class, () -> orderService.createOrder(
                USER, SYM, "비트코인", Order.OrderType.SELL, Order.OrderMethod.MARKET,
                BigDecimal.valueOf(5), null, "CRYPTO")); // 2개 보유인데 5개 매도
    }
}
