package com.project.whalearc.live.service;

import com.project.whalearc.live.domain.LiveStrategyDeployment;
import com.project.whalearc.live.domain.LiveStrategyDeployment.LivePosition;
import com.project.whalearc.live.dto.CreateDeploymentRequest;
import com.project.whalearc.live.repository.LiveOrderLogRepository;
import com.project.whalearc.live.repository.LiveStrategyDeploymentRepository;
import com.project.whalearc.market.dto.CandlestickResponse;
import com.project.whalearc.market.service.CandlestickService;
import com.project.whalearc.market.service.ExchangeRateService;
import com.project.whalearc.market.service.UsEtfCatalog;
import com.project.whalearc.market.service.UsStockPriceProvider;
import com.project.whalearc.notification.service.NotificationService;
import com.project.whalearc.strategy.domain.Condition;
import com.project.whalearc.strategy.repository.StrategyRepository;
import com.project.whalearc.strategy.service.IndicatorContextBuilder;
import com.project.whalearc.strategy.service.SignalEvaluator;
import com.project.whalearc.trade.domain.Order;
import com.project.whalearc.trade.domain.Portfolio;
import com.project.whalearc.trade.service.PortfolioService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * 라이브 자동매매 엔진 핵심 로직 검증 — 진입/청산 시그널 → 주문 발주 → 포지션 상태 전이,
 * 실계좌(미지원 브로커) 배포 거부, 배포 생성 시 포지션 초기화. 실제 SignalEvaluator/IndicatorContextBuilder를
 * 사용하고 주문 게이트웨이만 가짜로 대체해 동작을 격리 검증한다.
 */
class LiveStrategyServiceTest {

    private LiveStrategyDeploymentRepository deploymentRepo;
    private CandlestickService candlestickService;
    private PortfolioService portfolioService;
    private RecordingGateway gateway;
    private LiveStrategyService svc;

    /** 발주 내역을 기록하고 항상 FILLED를 반환하는 가짜 MOCK 게이트웨이. */
    static class RecordingGateway implements OrderGateway {
        final List<Order> placed = new ArrayList<>();
        @Override public boolean supports(LiveStrategyDeployment.BrokerType b) {
            return b == LiveStrategyDeployment.BrokerType.MOCK;
        }
        @Override public Order placeMarketOrder(String userId, String code, String name,
                                                Order.OrderType side, BigDecimal quantity, String assetType, String clientOrderId) {
            Order o = new Order();
            o.setUserId(userId);
            o.setStockCode(code);
            o.setOrderType(side);
            o.setQuantity(quantity);
            o.setAssetType(assetType);
            o.setStatus(Order.OrderStatus.FILLED);
            o.setFilledQuantity(quantity);
            o.setFilledPrice(BigDecimal.valueOf(100));   // 체결가 100원 고정
            placed.add(o);
            return o;
        }
    }

    @BeforeEach
    void setUp() {
        deploymentRepo = mock(LiveStrategyDeploymentRepository.class);
        StrategyRepository strategyRepo = mock(StrategyRepository.class);
        candlestickService = mock(CandlestickService.class);
        NotificationService notificationService = mock(NotificationService.class);
        portfolioService = mock(PortfolioService.class);
        ExchangeRateService exchangeRateService = mock(ExchangeRateService.class);
        UsEtfCatalog usEtfCatalog = mock(UsEtfCatalog.class);
        UsStockPriceProvider usStockPriceProvider = mock(UsStockPriceProvider.class);
        LiveOrderLogRepository orderLogRepo = mock(LiveOrderLogRepository.class);
        gateway = new RecordingGateway();

        when(deploymentRepo.save(org.mockito.ArgumentMatchers.any()))
                .thenAnswer(inv -> inv.getArgument(0));
        // 기본: 충분한 모의 가용 현금 + USD/KRW 환율 1300
        stubCashBalance(BigDecimal.valueOf(100_000_000));
        when(exchangeRateService.getUsdKrwRate()).thenReturn(1300.0);
        // 주문 원장: clientOrderId 기반 멱등성 동작을 인메모리로 흉내
        java.util.Set<String> logged = new java.util.HashSet<>();
        when(orderLogRepo.existsByClientOrderId(anyString())).thenAnswer(inv -> logged.contains(inv.getArgument(0)));
        when(orderLogRepo.save(org.mockito.ArgumentMatchers.any())).thenAnswer(inv -> {
            com.project.whalearc.live.domain.LiveOrderLog l = inv.getArgument(0);
            logged.add(l.getClientOrderId());
            return l;
        });

        svc = new LiveStrategyService(
                deploymentRepo, strategyRepo, candlestickService,
                new IndicatorContextBuilder(), new SignalEvaluator(),
                notificationService, portfolioService,
                exchangeRateService, usEtfCatalog, usStockPriceProvider, List.of(gateway), orderLogRepo);
    }

    private void stubCashBalance(BigDecimal cash) {
        Portfolio pf = new Portfolio();
        pf.setCashBalance(cash);
        when(portfolioService.getOrCreatePortfolio(anyString())).thenReturn(pf);
    }

    private List<CandlestickResponse> flatCandles(int n, double price) {
        List<CandlestickResponse> candles = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            candles.add(new CandlestickResponse(1_700_000_000L + i * 3600L, price, price, price, price, 1000));
        }
        return candles;
    }

    private Condition cond(String indicator, Condition.Operator op, double value) {
        return new Condition(indicator, op, BigDecimal.valueOf(value), Condition.Logic.AND, null);
    }

    private LiveStrategyDeployment baseDeployment() {
        LiveStrategyDeployment d = new LiveStrategyDeployment();
        d.setId("dep1");
        d.setUserId("u1");
        d.setIndicators(List.of());
        d.setEntryConditions(List.of(cond("PRICE", Condition.Operator.GT, 0)));   // 항상 충족
        d.setExitConditions(List.of(cond("PRICE", Condition.Operator.LT, 0)));    // 기본은 미충족
        d.setTargetAssets(List.of("BTC"));
        d.setAssetType("CRYPTO");
        d.setInterval("1h");
        d.setAccountMode(LiveStrategyDeployment.AccountMode.PAPER);
        d.setBrokerType(LiveStrategyDeployment.BrokerType.MOCK);
        d.setStatus(LiveStrategyDeployment.Status.RUNNING);
        d.setAllocatedCash(BigDecimal.valueOf(1_000_000));
        LivePosition p = new LivePosition("BTC", BigDecimal.valueOf(1_000_000));
        p.setAssetType("CRYPTO");
        d.setPositions(new ArrayList<>(List.of(p)));
        return d;
    }

    @Test
    void entrySignalOpensLongAndPlacesBuy() {
        when(candlestickService.getCandlesticks(anyString(), anyString(), anyString()))
                .thenReturn(flatCandles(130, 100));

        LiveStrategyDeployment d = baseDeployment();
        svc.evaluateDeployment(d);

        LivePosition p = d.getPositions().get(0);
        assertEquals(LivePosition.Direction.LONG, p.getDirection(), "진입 신호 충족 시 LONG 전이");
        assertEquals(1, gateway.placed.size(), "매수 주문 1건 발주");
        assertEquals(Order.OrderType.BUY, gateway.placed.get(0).getOrderType());
        // 100만원 / 100원 = 10000 (코인 8자리 floor)
        assertEquals(0, p.getQuantity().compareTo(BigDecimal.valueOf(10000)), "수량 = 할당금/체결가");
        assertEquals(1, d.getTradeCount());
    }

    @Test
    void duplicateBarDoesNotPlaceDuplicateOrder() {
        when(candlestickService.getCandlesticks(anyString(), anyString(), anyString()))
                .thenReturn(flatCandles(130, 100));   // 동일 캔들 → 동일 봉 타임스탬프

        LiveStrategyDeployment d = baseDeployment();
        svc.evaluateDeployment(d);
        assertEquals(1, gateway.placed.size(), "첫 평가: 매수 1건");

        // 같은 봉에서 포지션이 NONE으로 보이는 상태로 재평가(스케줄러 중복 발화/재시도 시뮬레이션)
        LivePosition p = d.getPositions().get(0);
        p.setDirection(LivePosition.Direction.NONE);
        p.setQuantity(java.math.BigDecimal.ZERO);
        svc.evaluateDeployment(d);

        assertEquals(1, gateway.placed.size(), "같은 봉 재평가 시 멱등성으로 중복 발주 없음");
    }

    @Test
    void exitSignalClosesPositionAndPlacesSell() {
        when(candlestickService.getCandlesticks(anyString(), anyString(), anyString()))
                .thenReturn(flatCandles(130, 100));

        LiveStrategyDeployment d = baseDeployment();
        // 이미 LONG 보유 상태로 세팅 + 청산 신호를 항상 충족하도록 변경
        d.setExitConditions(List.of(cond("PRICE", Condition.Operator.GT, 0)));
        LivePosition p = d.getPositions().get(0);
        p.setDirection(LivePosition.Direction.LONG);
        p.setAvgPrice(BigDecimal.valueOf(100));
        p.setQuantity(BigDecimal.valueOf(10000));
        p.setTrailRef(BigDecimal.valueOf(100));

        svc.evaluateDeployment(d);

        assertEquals(LivePosition.Direction.NONE, p.getDirection(), "청산 신호 충족 시 NONE 리셋");
        assertEquals(1, gateway.placed.size(), "매도 주문 1건 발주");
        assertEquals(Order.OrderType.SELL, gateway.placed.get(0).getOrderType());
        assertEquals(0, p.getQuantity().compareTo(BigDecimal.ZERO), "청산 후 수량 0");
        assertEquals(1, d.getTradeCount());
    }

    @Test
    void noEntryWhenSignalNotMet() {
        when(candlestickService.getCandlesticks(anyString(), anyString(), anyString()))
                .thenReturn(flatCandles(130, 100));

        LiveStrategyDeployment d = baseDeployment();
        d.setEntryConditions(List.of(cond("PRICE", Condition.Operator.LT, 0)));  // 절대 미충족

        svc.evaluateDeployment(d);

        assertEquals(LivePosition.Direction.NONE, d.getPositions().get(0).getDirection());
        assertTrue(gateway.placed.isEmpty(), "신호 미충족 시 주문 없음");
    }

    @Test
    void liveModeWithUnsupportedBrokerIsRejected() {
        CreateDeploymentRequest req = new CreateDeploymentRequest();
        req.setEntryConditions(List.of(cond("PRICE", Condition.Operator.GT, 0)));
        req.setTargetAssets(List.of("BTC"));
        req.setAllocatedCash(BigDecimal.valueOf(1_000_000));
        req.setAccountMode(LiveStrategyDeployment.AccountMode.LIVE);
        req.setBrokerType(LiveStrategyDeployment.BrokerType.KIS);   // 1단계에 게이트웨이 없음

        // 실계좌(LIVE) + 미지원 브로커 → 배포 생성 거부
        assertThrows(IllegalArgumentException.class, () -> svc.createDeployment("u1", req));
    }

    @Test
    void usStockSizingConvertsKrwToUsd() {
        when(candlestickService.getCandlesticks(anyString(), anyString(), anyString()))
                .thenReturn(flatCandles(130, 100));   // 가격 $100 (USD)

        LiveStrategyDeployment d = baseDeployment();
        LivePosition p = d.getPositions().get(0);
        p.setAssetType("US_STOCK");
        p.setAllocatedCash(BigDecimal.valueOf(1_300_000));   // 130만원 할당

        svc.evaluateDeployment(d);

        // 130만원 / ($100 × 환율 1300) = 10주 (정수)
        assertEquals(LivePosition.Direction.LONG, p.getDirection());
        assertEquals(1, gateway.placed.size());
        assertEquals(0, p.getQuantity().compareTo(BigDecimal.valueOf(10)), "USD 환산 후 정수 수량 10주여야 함");
        assertEquals("US_STOCK", gateway.placed.get(0).getAssetType(), "주문에 심볼 자산군 전달");
    }

    @Test
    void invalidStopLossPctIsRejected() {
        CreateDeploymentRequest req = new CreateDeploymentRequest();
        req.setEntryConditions(List.of(cond("PRICE", Condition.Operator.GT, 0)));
        req.setTargetAssets(List.of("BTC"));
        req.setAllocatedCash(BigDecimal.valueOf(1_000_000));
        req.setStopLossPct(BigDecimal.valueOf(150));   // 100% 이상 → 음수 손절가 유발 → 거부돼야 함

        assertThrows(IllegalArgumentException.class, () -> svc.createDeployment("u1", req));
    }

    @Test
    void allocationExceedingCashIsRejected() {
        stubCashBalance(BigDecimal.valueOf(100_000));   // 가용 현금 10만원
        CreateDeploymentRequest req = new CreateDeploymentRequest();
        req.setEntryConditions(List.of(cond("PRICE", Condition.Operator.GT, 0)));
        req.setTargetAssets(List.of("BTC"));
        req.setAllocatedCash(BigDecimal.valueOf(1_000_000));   // 100만원 할당 → 잔고 초과

        assertThrows(IllegalArgumentException.class, () -> svc.createDeployment("u1", req));
    }

    @Test
    void createPaperDeploymentInitializesPositions() {
        CreateDeploymentRequest req = new CreateDeploymentRequest();
        req.setStrategyName("프리셋 RSI");
        req.setEntryConditions(List.of(cond("PRICE", Condition.Operator.GT, 0)));
        req.setTargetAssets(List.of("BTC", "ETH"));
        req.setAllocatedCash(BigDecimal.valueOf(1_000_000));
        // accountMode/brokerType 미지정 → PAPER/MOCK 기본

        LiveStrategyDeployment d = svc.createDeployment("u1", req);

        assertEquals(LiveStrategyDeployment.Status.RUNNING, d.getStatus());
        assertEquals(LiveStrategyDeployment.AccountMode.PAPER, d.getAccountMode());
        assertEquals(2, d.getPositions().size(), "심볼 수만큼 포지션 생성");
        // 100만원 / 2자산 = 50만원씩 (NONE 상태, 매수는 스케줄러가 시그널 따라)
        assertEquals(0, d.getPositions().get(0).getAllocatedCash().compareTo(BigDecimal.valueOf(500_000)));
        assertEquals(LivePosition.Direction.NONE, d.getPositions().get(0).getDirection());
    }
}
