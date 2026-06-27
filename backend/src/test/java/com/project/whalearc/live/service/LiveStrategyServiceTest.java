package com.project.whalearc.live.service;

import com.project.whalearc.exchange.service.client.BitgetApiClient;
import com.project.whalearc.live.domain.LiveStrategyDeployment;
import com.project.whalearc.live.domain.LiveStrategyDeployment.LivePosition;
import com.project.whalearc.live.dto.CreateDeploymentRequest;
import com.project.whalearc.live.repository.LiveDeploymentEquitySnapshotRepository;
import com.project.whalearc.live.repository.LiveOrderLogRepository;
import com.project.whalearc.live.repository.LiveStrategyDeploymentRepository;
import com.project.whalearc.market.dto.CandlestickResponse;
import com.project.whalearc.market.service.BacktestDataProvider;
import com.project.whalearc.market.service.CandlestickService;
import com.project.whalearc.market.service.ExchangeRateService;
import com.project.whalearc.market.service.MomentumDataCache;
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
import com.project.whalearc.trade.service.UserLockRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
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
    private MomentumDataCache momentumDataCache;
    private ExchangeRateService exchangeRateService;
    private com.project.whalearc.user.policy.TierResolver tierResolver;
    private LiveStrategyService svc;
    // 배포 저장소 인메모리 모사 — evaluateDeployment 가 락 안에서 findById 로 최신본을 다시 읽으므로
    // save/findById 가 같은 인스턴스를 주고받아야 테스트가 그 인스턴스의 상태 전이를 검증할 수 있다.
    private java.util.Map<String, LiveStrategyDeployment> store;

    /** 발주 내역을 기록하고 항상 FILLED를 반환하는 가짜 MOCK 게이트웨이. */
    static class RecordingGateway implements OrderGateway {
        final List<Order> placed = new ArrayList<>();
        boolean reject = false;   // true면 주문을 거부(예외) — 장 마감/거부 시나리오 모사
        @Override public boolean supports(LiveStrategyDeployment.BrokerType b) {
            return b == LiveStrategyDeployment.BrokerType.MOCK;
        }
        @Override public Order placeMarketOrder(LiveStrategyDeployment deployment, String userId, String code, String name,
                                                Order.OrderType side, BigDecimal quantity, BigDecimal price,
                                                String assetType, String clientOrderId) {
            if (reject) throw new IllegalStateException("주문 거부(장 운영시간 아님)");
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
        exchangeRateService = mock(ExchangeRateService.class);
        momentumDataCache = mock(MomentumDataCache.class);
        UsEtfCatalog usEtfCatalog = mock(UsEtfCatalog.class);
        UsStockPriceProvider usStockPriceProvider = mock(UsStockPriceProvider.class);
        LiveOrderLogRepository orderLogRepo = mock(LiveOrderLogRepository.class);
        LiveDeploymentEquitySnapshotRepository equitySnapshotRepo = mock(LiveDeploymentEquitySnapshotRepository.class);
        BitgetApiClient bitgetApiClient = mock(BitgetApiClient.class);
        gateway = new RecordingGateway();
        store = new java.util.HashMap<>();

        when(deploymentRepo.save(org.mockito.ArgumentMatchers.any()))
                .thenAnswer(inv -> {
                    LiveStrategyDeployment d = inv.getArgument(0);
                    if (d.getId() != null) store.put(d.getId(), d);
                    return d;
                });
        when(deploymentRepo.findById(anyString()))
                .thenAnswer(inv -> java.util.Optional.ofNullable(store.get(inv.getArgument(0))));
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

        tierResolver = mock(com.project.whalearc.user.policy.TierResolver.class);
        svc = new LiveStrategyService(
                deploymentRepo, strategyRepo, candlestickService,
                new IndicatorContextBuilder(), new SignalEvaluator(),
                notificationService, portfolioService,
                exchangeRateService, usEtfCatalog, usStockPriceProvider,
                bitgetApiClient, List.of(gateway), orderLogRepo,
                equitySnapshotRepo, new UserLockRegistry(), momentumDataCache,
                mock(BacktestDataProvider.class), tierResolver);
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
        store.put(d.getId(), d);   // evaluateDeployment 의 락 안 findById 가 이 인스턴스를 돌려주도록 등록
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
        assertEquals(0, d.getTradeCount(), "진입은 거래수 미포함 — 청산(왕복 완료) 시 1회 집계");
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
    void closeNowCoversShortPosition() {
        // 회귀 방지: '지금 청산'이 숏 포지션도 COVER(환매)로 청산해야 한다(이전엔 롱만 청산).
        when(candlestickService.getCandlesticks(anyString(), anyString(), anyString()))
                .thenReturn(flatCandles(130, 100));
        when(deploymentRepo.findByIdAndUserId("dep1", "u1"))
                .thenAnswer(inv -> java.util.Optional.ofNullable(store.get("dep1")));

        LiveStrategyDeployment d = baseDeployment();
        LivePosition p = d.getPositions().get(0);
        p.setDirection(LivePosition.Direction.SHORT);
        p.setAvgPrice(BigDecimal.valueOf(100));
        p.setQuantity(BigDecimal.valueOf(5000));

        svc.closeNow("u1", "dep1");

        assertEquals(LivePosition.Direction.NONE, p.getDirection(), "숏 청산 후 NONE 리셋");
        assertEquals(1, gateway.placed.size(), "환매 주문 1건 발주");
        assertEquals(Order.OrderType.COVER, gateway.placed.get(0).getOrderType(), "숏 청산은 COVER(매수 환매)");
        assertEquals(0, p.getQuantity().compareTo(BigDecimal.ZERO), "청산 후 수량 0");
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
    void dailyLossLimitAutoPauses() {
        when(candlestickService.getCandlesticks(anyString(), anyString(), anyString()))
                .thenReturn(flatCandles(130, 100));   // 체결가 100

        LiveStrategyDeployment d = baseDeployment();
        d.setDailyLossLimit(BigDecimal.valueOf(100_000));   // 10만원 한도
        d.setExitConditions(List.of(cond("PRICE", Condition.Operator.GT, 0)));   // 항상 청산
        LivePosition p = d.getPositions().get(0);
        p.setDirection(LivePosition.Direction.LONG);
        p.setAvgPrice(BigDecimal.valueOf(200));   // 평단 200 > 체결가 100 → 손실
        p.setQuantity(BigDecimal.valueOf(10000));
        p.setTrailRef(BigDecimal.valueOf(200));

        svc.evaluateDeployment(d);

        // 손익 = (100-200)×10000 = -1,000,000 → 한도 -100,000 초과 → 자동 일시정지
        assertEquals(LiveStrategyDeployment.Status.PAUSED, d.getStatus(), "일일 손실한도 도달 시 자동 PAUSED");
        assertEquals(1, gateway.placed.size(), "청산 매도 1건 발주");
    }

    @Test
    void overReservedAllocationIsRejected() {
        stubCashBalance(BigDecimal.valueOf(1_000_000));   // 가용 현금 100만
        LiveStrategyDeployment existing = new LiveStrategyDeployment();
        existing.setAllocatedCash(BigDecimal.valueOf(800_000));   // 이미 80만 예약
        existing.setStatus(LiveStrategyDeployment.Status.RUNNING);
        when(deploymentRepo.findByUserIdAndStatusIn(anyString(), any())).thenReturn(List.of(existing));

        CreateDeploymentRequest req = new CreateDeploymentRequest();
        req.setEntryConditions(List.of(cond("PRICE", Condition.Operator.GT, 0)));
        req.setTargetAssets(List.of("BTC"));
        req.setAllocatedCash(BigDecimal.valueOf(300_000));   // 80만 + 30만 = 110만 > 100만

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

    @Test
    void concurrentEvaluationDoesNotDuplicateOrderOrCorruptLedger() throws Exception {
        // 스케줄러(cron)와 수동 evaluate가 같은 봉에 같은 배포를 동시에 평가하는 경합을 재현한다.
        // 유저 락 + 락 안 findById 재조회가 없으면 여러 스레드가 모두 NONE 스냅샷을 읽어 매수를 N건
        // 발주(중복) + 늦은 save가 이른 save를 덮어써 장부(tradeCount/포지션)가 깨진다.
        // 수정 후에는 정확히 1건만 진입한다(중복 방지는 주문 1건·LONG으로 검증).
        // 거래수는 청산 시 집계라 진입 단계선 0 — 핵심은 경합에도 진입이 1회뿐이라는 점.
        when(candlestickService.getCandlesticks(anyString(), anyString(), anyString()))
                .thenReturn(flatCandles(130, 100));

        LiveStrategyDeployment d = baseDeployment();

        int threads = 4;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch start = new CountDownLatch(1);
        CountDownLatch done = new CountDownLatch(threads);
        List<Throwable> errors = Collections.synchronizedList(new ArrayList<>());
        for (int i = 0; i < threads; i++) {
            pool.submit(() -> {
                try {
                    start.await();                 // 모든 스레드를 동시에 출발시켜 경합 창을 넓힌다
                    svc.evaluateDeployment(d);
                } catch (Throwable t) {
                    errors.add(t);
                } finally {
                    done.countDown();
                }
            });
        }
        start.countDown();
        assertTrue(done.await(10, TimeUnit.SECONDS), "동시 평가가 시간 내 완료되어야 함");
        pool.shutdownNow();

        assertTrue(errors.isEmpty(), "동시 평가 중 예외가 없어야 함(경합/자료구조 손상 없음): " + errors);
        assertEquals(1, gateway.placed.size(), "동시 평가에도 매수 주문은 정확히 1건(중복 발주 없음)");
        LivePosition p = d.getPositions().get(0);
        assertEquals(LivePosition.Direction.LONG, p.getDirection(), "1회만 진입해 LONG 상태");
        assertEquals(0, d.getTradeCount(), "진입 1회 → 거래수 0(청산 시 집계). 중복 방지는 주문 1건·LONG으로 확인");
    }

    // ── 모멘텀 Top-N 로테이션 ──────────────────────────────────────────────

    /** 시간 오름차순 상승/하락 종가 시계열(캐시 모사). n개, start→end 선형. */
    private List<CandlestickResponse> trend(int n, double start, double end) {
        List<CandlestickResponse> out = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            double p = start + (end - start) * i / (n - 1);
            out.add(new CandlestickResponse(1_700_000_000L + i * 86400L, p, p, p, p, 1000));
        }
        return out;
    }

    private LiveStrategyDeployment momentumDeployment(int topN, double allocKrw) {
        LiveStrategyDeployment d = new LiveStrategyDeployment();
        d.setId("mom1");
        d.setUserId("u1");
        d.setDeploymentType("MOMENTUM_ROTATION");
        d.setRotationTopN(topN);
        d.setRotationLookbackDays(20);
        d.setRotationRegimeFilter(false);   // SPY 의존 제거(로테이션 자체 검증에 집중)
        d.setRotationUniverse(new ArrayList<>(List.of("AAA", "BBB", "CCC")));
        d.setAssetType("US_STOCK");
        d.setInterval("1d");
        d.setAccountMode(LiveStrategyDeployment.AccountMode.PAPER);
        d.setBrokerType(LiveStrategyDeployment.BrokerType.MOCK);
        d.setStatus(LiveStrategyDeployment.Status.RUNNING);
        d.setAllocatedCash(BigDecimal.valueOf(allocKrw));
        d.setPositions(new ArrayList<>());
        store.put(d.getId(), d);
        return d;
    }

    @Test
    void momentumRotation_buysPositiveTopN() {
        // 캐시: AAA 강한 상승, BBB 약한 상승, CCC 하락(음수→제외). 현재가는 모두 $100(candlestickService).
        when(momentumDataCache.get("AAA")).thenReturn(trend(30, 100, 300));
        when(momentumDataCache.get("BBB")).thenReturn(trend(30, 100, 150));
        when(momentumDataCache.get("CCC")).thenReturn(trend(30, 100, 50));
        when(candlestickService.getCandlesticks(anyString(), anyString(), anyString()))
                .thenReturn(flatCandles(5, 100));   // 현재가 $100
        when(exchangeRateService.getUsdKrwRate()).thenReturn(1300.0);

        // 할당 2,600,000원 / topN 2 = 1,300,000원/종목 ÷ ($100×1300=130,000원/주) = 10주
        LiveStrategyDeployment d = momentumDeployment(2, 2_600_000);
        svc.rebalanceMomentum(d);

        LiveStrategyDeployment saved = store.get("mom1");
        LivePosition aaa = saved.getPositions().stream().filter(p -> p.getSymbol().equals("AAA")).findFirst().orElse(null);
        LivePosition bbb = saved.getPositions().stream().filter(p -> p.getSymbol().equals("BBB")).findFirst().orElse(null);
        assertNotNull(aaa); assertNotNull(bbb);
        assertEquals(LivePosition.Direction.LONG, aaa.getDirection(), "AAA(양수 모멘텀) 보유");
        assertEquals(0, aaa.getQuantity().compareTo(BigDecimal.valueOf(10)), "목표비중 기반 정수 수량 10주");
        assertEquals(LivePosition.Direction.LONG, bbb.getDirection());
        assertTrue(saved.getPositions().stream().noneMatch(p ->
                p.getSymbol().equals("CCC") && p.getDirection() == LivePosition.Direction.LONG), "CCC(음수)는 미보유");
        assertEquals(2, gateway.placed.size(), "매수 2건");
        assertEquals(List.of("AAA", "BBB"), saved.getCurrentTopHoldings());
        assertNotNull(saved.getLastRotationMonth(), "리밸런싱 달 기록(멱등키)");
    }

    @Test
    void momentumRotation_idempotentWithinSameMonth() {
        when(momentumDataCache.get("AAA")).thenReturn(trend(30, 100, 300));
        when(momentumDataCache.get("BBB")).thenReturn(trend(30, 100, 150));
        when(momentumDataCache.get("CCC")).thenReturn(trend(30, 100, 50));
        when(candlestickService.getCandlesticks(anyString(), anyString(), anyString()))
                .thenReturn(flatCandles(5, 100));
        when(exchangeRateService.getUsdKrwRate()).thenReturn(1300.0);

        LiveStrategyDeployment d = momentumDeployment(2, 2_600_000);
        svc.rebalanceMomentum(d);
        int after1 = gateway.placed.size();
        svc.rebalanceMomentum(d);   // 같은 달 재호출 → 멱등(무동작)
        assertEquals(after1, gateway.placed.size(), "같은 달 재실행은 추가 주문 없음(멱등)");
    }

    @Test
    void momentumRotation_poolsBudgetToFundExpensiveName() {
        // 정수주 균등배분(풀링): AAA(비쌈) 1주값 52만 > 종목당목표 50만이라 단순 floor면 0주.
        // 그러나 싼 BBB/CCC(8만) floor 후 남는 예산으로 AAA 1주를 채워야 한다(비중밴드 내).
        // 기대: AAA=1, BBB=6, CCC=6 (투입 150만, target 50만, cap 54.5만).
        when(momentumDataCache.get("AAA")).thenReturn(trend(30, 100, 300));
        when(momentumDataCache.get("BBB")).thenReturn(trend(30, 100, 250));
        when(momentumDataCache.get("CCC")).thenReturn(trend(30, 100, 200));
        // 종목별 현재가(USD): candlestickService가 심볼마다 다른 평탄가를 주도록 스텁
        when(candlestickService.getCandlesticks(eq("AAA"), anyString(), anyString())).thenReturn(flatCandles(5, 520));
        when(candlestickService.getCandlesticks(eq("BBB"), anyString(), anyString())).thenReturn(flatCandles(5, 80));
        when(candlestickService.getCandlesticks(eq("CCC"), anyString(), anyString())).thenReturn(flatCandles(5, 80));
        when(exchangeRateService.getUsdKrwRate()).thenReturn(1000.0);

        LiveStrategyDeployment d = momentumDeployment(3, 1_500_000);
        svc.rebalanceMomentum(d);

        LiveStrategyDeployment saved = store.get("mom1");
        java.util.function.Function<String, BigDecimal> qty = sym -> saved.getPositions().stream()
                .filter(p -> p.getSymbol().equals(sym)).map(LivePosition::getQuantity).findFirst().orElse(BigDecimal.ZERO);
        assertEquals(0, qty.apply("AAA").compareTo(BigDecimal.valueOf(1)), "비싼 AAA도 풀링된 잉여로 1주 편입");
        assertEquals(0, qty.apply("BBB").compareTo(BigDecimal.valueOf(6)), "BBB 6주");
        assertEquals(0, qty.apply("CCC").compareTo(BigDecimal.valueOf(6)), "CCC 6주");
        assertEquals(3, gateway.placed.size(), "3종목 매수");
    }

    @Test
    void momentumRotation_fullInvestSpendsBudgetOnAffordableNames() {
        // 자본 최대 활용 모드: 비싼 AAA/CCC(1주 52만)는 못 사고, 싼 BBB(1주 8만)에 예산을 몰아 2주 매수.
        // 기본(균등비중)이면 슬라이스(20만/3≈6.7만)<BBB 8만이라 0주(현금). 둘을 대비 검증.
        when(momentumDataCache.get("AAA")).thenReturn(trend(30, 100, 300));
        when(momentumDataCache.get("BBB")).thenReturn(trend(30, 100, 250));
        when(momentumDataCache.get("CCC")).thenReturn(trend(30, 100, 200));
        when(candlestickService.getCandlesticks(eq("AAA"), anyString(), anyString())).thenReturn(flatCandles(5, 520));
        when(candlestickService.getCandlesticks(eq("BBB"), anyString(), anyString())).thenReturn(flatCandles(5, 80));
        when(candlestickService.getCandlesticks(eq("CCC"), anyString(), anyString())).thenReturn(flatCandles(5, 520));
        when(exchangeRateService.getUsdKrwRate()).thenReturn(1000.0);

        // 기본(균등비중): 200,000 / 3 ≈ 66,667 슬라이스 < BBB 80,000 → 전부 0주(현금)
        LiveStrategyDeployment def = momentumDeployment(3, 200_000);
        svc.rebalanceMomentum(def);
        assertTrue(gateway.placed.isEmpty(), "균등비중 기본 모드는 슬라이스<1주값이라 매수 없음");

        // 자본최대활용: BBB(8만)에 예산 소진 → 2주(16만), 잔여 4만<1주
        LiveStrategyDeployment full = momentumDeployment(3, 200_000);
        full.setRotationFullInvest(true);
        svc.rebalanceMomentum(full);
        LiveStrategyDeployment saved = store.get("mom1");
        BigDecimal bbb = saved.getPositions().stream().filter(p -> p.getSymbol().equals("BBB"))
                .map(LivePosition::getQuantity).findFirst().orElse(BigDecimal.ZERO);
        assertEquals(0, bbb.compareTo(BigDecimal.valueOf(2)), "자본최대활용: 싼 BBB 2주로 예산 소진, 실제 " + bbb);
        assertTrue(saved.getPositions().stream().filter(p -> !p.getSymbol().equals("BBB"))
                .allMatch(p -> nz(p.getQuantity()).signum() == 0), "비싼 AAA/CCC는 미편입");
    }

    private static BigDecimal nz(BigDecimal v) { return v != null ? v : BigDecimal.ZERO; }

    @Test
    void momentumRotation_rejectedOrdersLeaveMonthUnmarkedForRetry() {
        // 장 마감/거부로 주문이 안 나가면 lastRotationMonth를 찍지 않아 다음 세션에 재시도되어야 한다.
        when(momentumDataCache.get("AAA")).thenReturn(trend(30, 100, 300));
        when(momentumDataCache.get("BBB")).thenReturn(trend(30, 100, 150));
        when(momentumDataCache.get("CCC")).thenReturn(trend(30, 100, 50));
        when(candlestickService.getCandlesticks(anyString(), anyString(), anyString())).thenReturn(flatCandles(5, 100));
        when(exchangeRateService.getUsdKrwRate()).thenReturn(1300.0);
        gateway.reject = true;   // 모든 주문 거부

        LiveStrategyDeployment d = momentumDeployment(2, 2_600_000);
        svc.rebalanceMomentum(d);

        LiveStrategyDeployment saved = store.get("mom1");
        assertNull(saved.getLastRotationMonth(), "거부로 미체결 → 이번 달 미완료(재시도 위해 마킹 안 함)");
        assertTrue(saved.getPositions().stream().allMatch(p -> nz(p.getQuantity()).signum() == 0), "체결 0");

        // 장 열림(거부 해제) 후 재호출 → 이제 체결되고 월 마킹
        gateway.reject = false;
        svc.rebalanceMomentum(d);
        saved = store.get("mom1");
        assertNotNull(saved.getLastRotationMonth(), "재시도 시 체결 → 월 마킹");
        assertFalse(gateway.placed.isEmpty(), "재시도 매수 발생");
    }

    @Test
    void momentumRotation_allNegativeGoesToCash() {
        when(momentumDataCache.get("AAA")).thenReturn(trend(30, 300, 100));   // 하락
        when(momentumDataCache.get("BBB")).thenReturn(trend(30, 200, 120));   // 하락
        when(momentumDataCache.get("CCC")).thenReturn(trend(30, 100, 50));    // 하락
        when(candlestickService.getCandlesticks(anyString(), anyString(), anyString()))
                .thenReturn(flatCandles(5, 100));
        when(exchangeRateService.getUsdKrwRate()).thenReturn(1300.0);

        LiveStrategyDeployment d = momentumDeployment(2, 2_600_000);
        svc.rebalanceMomentum(d);

        LiveStrategyDeployment saved = store.get("mom1");
        assertTrue(gateway.placed.isEmpty(), "양수 모멘텀 없음 → 매수 없음(전액 현금)");
        assertTrue(saved.getCurrentTopHoldings().isEmpty(), "보유 종목 없음");
        assertNotNull(saved.getLastRotationMonth());
    }

    // ── 실거래(LIVE) 등급 한도: 종목 수(BASIC 3) · 동시 전략 수(BASIC 1) ──

    private LiveStrategyDeployment liveDeploymentWithAssets(int symbolCount) {
        LiveStrategyDeployment d = new LiveStrategyDeployment();
        List<String> assets = new ArrayList<>();
        for (int i = 0; i < symbolCount; i++) assets.add("SYM" + i);
        d.setTargetAssets(assets);
        d.setAccountMode(LiveStrategyDeployment.AccountMode.LIVE);
        return d;
    }

    @Test
    void liveBlockedWhenTooManySymbols() {
        IllegalArgumentException e = assertThrows(IllegalArgumentException.class,
                () -> svc.enforceLiveTierLimitsLocked("u1", com.project.whalearc.user.domain.User.Tier.BASIC,
                        liveDeploymentWithAssets(4)));
        assertTrue(e.getMessage().contains("종목"));
    }

    @Test
    void liveBlockedWhenStrategyLimitReached() {
        when(deploymentRepo.countByUserIdAndAccountModeAndStatusIn(anyString(), any(), any())).thenReturn(1L);
        IllegalArgumentException e = assertThrows(IllegalArgumentException.class,
                () -> svc.enforceLiveTierLimitsLocked("u1", com.project.whalearc.user.domain.User.Tier.BASIC,
                        liveDeploymentWithAssets(1)));
        assertTrue(e.getMessage().contains("전략"));
    }

    @Test
    void liveAllowedWithinLimits() {
        when(deploymentRepo.countByUserIdAndAccountModeAndStatusIn(anyString(), any(), any())).thenReturn(0L);
        assertDoesNotThrow(() -> svc.enforceLiveTierLimitsLocked("u1",
                com.project.whalearc.user.domain.User.Tier.BASIC, liveDeploymentWithAssets(3)));
    }

    @Test
    void momentumLiveCountsTopNAsSymbols() {
        LiveStrategyDeployment d = new LiveStrategyDeployment();
        d.setDeploymentType("MOMENTUM_ROTATION");
        d.setRotationTopN(5);                 // 초기 targetAssets는 비어 있고 topN이 실질 종목수
        d.setTargetAssets(new ArrayList<>());
        d.setAccountMode(LiveStrategyDeployment.AccountMode.LIVE);
        assertThrows(IllegalArgumentException.class, () -> svc.enforceLiveTierLimitsLocked("u1",
                com.project.whalearc.user.domain.User.Tier.BASIC, d)); // 5 > BASIC 3
    }

    @Test
    void proLiveHasNoLimits() {
        assertDoesNotThrow(() -> svc.enforceLiveTierLimitsLocked("u1",
                com.project.whalearc.user.domain.User.Tier.PRO, liveDeploymentWithAssets(10)));
        // PRO는 동시 전략 수 조회조차 하지 않음
        org.mockito.Mockito.verify(deploymentRepo, org.mockito.Mockito.never())
                .countByUserIdAndAccountModeAndStatusIn(anyString(), any(), any());
    }
}
