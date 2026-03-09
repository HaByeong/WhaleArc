package com.project.whalearc.store.service;

import com.project.whalearc.market.dto.MarketPriceResponse;
import com.project.whalearc.market.service.CryptoPriceProvider;
import com.project.whalearc.market.service.StockPriceProvider;
import com.project.whalearc.store.domain.ProductPurchase;
import com.project.whalearc.store.domain.QuantProduct;
import com.project.whalearc.store.dto.PurchasePerformanceDto;
import com.project.whalearc.store.repository.ProductPurchaseRepository;
import com.project.whalearc.store.repository.QuantProductRepository;
import com.project.whalearc.strategy.domain.TurtlePosition;
import com.project.whalearc.strategy.repository.TurtlePositionRepository;
import com.project.whalearc.trade.domain.Holding;
import com.project.whalearc.trade.domain.Order;
import com.project.whalearc.trade.domain.Portfolio;
import com.project.whalearc.trade.service.OrderService;
import com.project.whalearc.trade.service.PortfolioService;
import com.project.whalearc.strategy.service.TurtleStrategyService;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class QuantStoreService {

    private final QuantProductRepository productRepository;
    private final ProductPurchaseRepository purchaseRepository;
    private final OrderService orderService;
    private final CryptoPriceProvider cryptoPriceProvider;
    private final StockPriceProvider stockPriceProvider;
    private final PortfolioService portfolioService;
    private final TurtleStrategyService turtleStrategyService;
    private final TurtlePositionRepository turtlePositionRepository;

    /**
     * 최초 실행 시 샘플 퀀트 상품 시드
     */
    @PostConstruct
    public void seedProducts() {
        if (productRepository.count() > 0) {
            seedNewProducts();
            recalculateSubscribers();
            return;
        }

        List<QuantProduct> seeds = List.of(
                // ── 무료 기본 항로 ──
                createProduct("골든크로스 추종 전략",
                        "20일/60일 이동평균선 골든크로스 발생 시 매수, 데드크로스 시 매도하는 추세추종 전략입니다. 중장기 상승 추세에서 안정적인 수익을 추구합니다.",
                        "WhaleArc", QuantProduct.Category.TREND_FOLLOWING, QuantProduct.RiskLevel.MEDIUM,
                        0, 18.5, -12.3, 1.45, 58.2, 0,
                        List.of("추세추종", "이동평균", "중장기", "무료"), List.of("BTC", "ETH", "SOL"),
                        "MA(20) > MA(60) → 매수 / MA(20) < MA(60) → 매도"),

                createProduct("RSI 반전 스캘핑",
                        "RSI 과매도 구간(30 이하) 진입 후 반등 시 매수, 과매수 구간(70 이상) 도달 시 매도. 빠른 회전매매로 소폭 수익을 누적합니다.",
                        "WhaleArc", QuantProduct.Category.MEAN_REVERSION, QuantProduct.RiskLevel.HIGH,
                        0, 32.1, -18.7, 1.82, 64.8, 0,
                        List.of("RSI", "스캘핑", "단타", "무료"), List.of("BTC", "ETH", "XRP", "DOGE"),
                        "RSI(14) < 30 → 매수 / RSI(14) > 70 → 매도"),

                createProduct("볼린저 밴드 수축 돌파",
                        "볼린저 밴드 수축 구간에서 상단 돌파 시 매수, 중심선 하회 시 손절. 변동성 확대 구간에서 큰 수익을 노리는 전략입니다.",
                        "WhaleArc", QuantProduct.Category.VOLATILITY, QuantProduct.RiskLevel.HIGH,
                        0, 42.3, -22.1, 1.95, 52.1, 0,
                        List.of("볼린저밴드", "변동성", "돌파", "무료"), List.of("BTC", "ETH", "SOL", "AVAX"),
                        "BB(20,2) 수축 후 상단 돌파 → 매수 / 중심선 하회 → 매도"),

                createProduct("안전 자산 리밸런싱",
                        "BTC 60% + ETH 30% + 스테이블 10% 비율을 매주 리밸런싱하는 보수적 전략입니다. 장기 우상향 시장에서 안정적 수익을 추구합니다.",
                        "WhaleArc", QuantProduct.Category.MULTI_FACTOR, QuantProduct.RiskLevel.LOW,
                        0, 12.8, -8.2, 1.15, 72.3, 0,
                        List.of("리밸런싱", "안전", "장기투자", "무료"), List.of("BTC", "ETH"),
                        "주간 리밸런싱: BTC 60% / ETH 30% / 현금 10%"),

                createProduct("모멘텀 스코어 전략",
                        "최근 7일/30일/90일 수익률을 가중 합산한 모멘텀 스코어 상위 5개 코인에 동일 비중 투자. 강한 상승세 코인에 집중합니다.",
                        "WhaleArc", QuantProduct.Category.MOMENTUM, QuantProduct.RiskLevel.MEDIUM,
                        0, 28.7, -15.4, 1.68, 61.5, 0,
                        List.of("모멘텀", "상대강도", "포트폴리오", "무료"), List.of("BTC", "ETH", "SOL", "AVAX", "LINK"),
                        "모멘텀 스코어 = 7일(40%) + 30일(35%) + 90일(25%) 수익률"),

                createProduct("김프 차익거래 봇",
                        "국내외 거래소 간 가격 차이(김치 프리미엄)를 이용한 차익거래 전략. 김프 3% 이상 시 매도, -1% 이하 시 매수합니다.",
                        "WhaleArc", QuantProduct.Category.ARBITRAGE, QuantProduct.RiskLevel.LOW,
                        0, 15.2, -3.8, 2.45, 81.2, 0,
                        List.of("차익거래", "김프", "안전", "무료"), List.of("BTC", "ETH", "XRP"),
                        "김프 > 3% → 매도 / 김프 < -1% → 매수"),

                // ── 주식 전용 항로 ──
                createProduct("래리 윌리엄스 변동성 돌파",
                        "래리 윌리엄스가 1987년 로빈스 월드컵에서 11,376% 수익을 달성한 전설적 전략입니다. "
                        + "전일 변동폭(고가-저가)의 일정 비율(k=0.5)을 당일 시가에 더한 가격을 돌파하면 매수, "
                        + "당일 종가에 전량 청산합니다. 단기 모멘텀을 포착하는 데이트레이딩 전략입니다.",
                        "Larry Williams", QuantProduct.Category.VOLATILITY, QuantProduct.RiskLevel.HIGH,
                        0, 38.2, -16.5, 1.92, 56.8, 0,
                        List.of("변동성돌파", "래리윌리엄스", "데이트레이딩", "무료", "주식"),
                        List.of("005930", "000660", "005380", "035420", "035720"),
                        "매수: 시가 + (전일 고가-저가) × 0.5 돌파 / 매도: 당일 종가 청산",
                        "STOCK"),

                createProduct("듀얼 모멘텀",
                        "Gary Antonacci가 개발한 노벨상 수상 개념(상대 모멘텀 + 절대 모멘텀) 기반 전략입니다. "
                        + "12개월 수익률이 양(+)이면서 동시에 상대적으로 강한 자산에만 투자합니다. "
                        + "시장 하락기에는 현금 비중을 높여 MDD를 크게 줄이는 것이 특징입니다.",
                        "Gary Antonacci", QuantProduct.Category.MOMENTUM, QuantProduct.RiskLevel.MEDIUM,
                        0, 22.4, -11.2, 1.78, 65.3, 0,
                        List.of("듀얼모멘텀", "상대강도", "절대모멘텀", "무료", "주식"),
                        List.of("005930", "000660", "373220", "005380", "035420"),
                        "12개월 수익률 > 0 (절대 모멘텀) + 상대 강도 상위 종목 선별 → 매수 / 조건 미충족 → 현금",
                        "STOCK"),

                createProduct("마크 미너비니 트렌드 템플릿",
                        "미국 투자 챔피언십 우승자 Mark Minervini의 VCP(Volatility Contraction Pattern) 전략입니다. "
                        + "150일/200일 이동평균선 위에 있고, 52주 신고가 대비 25% 이내인 종목 중 "
                        + "변동성이 수축하며 거래량이 감소하는 패턴을 찾아 돌파 시 매수합니다.",
                        "Mark Minervini", QuantProduct.Category.TREND_FOLLOWING, QuantProduct.RiskLevel.MEDIUM,
                        0, 26.8, -13.5, 1.85, 48.7, 0,
                        List.of("VCP", "트렌드템플릿", "미너비니", "무료", "주식"),
                        List.of("005930", "000660", "207940", "068270", "035420"),
                        "조건: 주가 > MA(150) > MA(200), 52주 고가 대비 -25% 이내 / 매수: VCP 수축 후 돌파 / 손절: -8%",
                        "STOCK"),

                // ── 코인 추가 항로 ──
                createProduct("MACD 다이버전스",
                        "Gerald Appel이 1979년 개발한 MACD 지표의 다이버전스(괴리) 신호를 활용합니다. "
                        + "가격은 저점을 낮추는데 MACD는 저점을 높이는 상승 다이버전스 시 매수, "
                        + "가격은 고점을 높이는데 MACD는 고점을 낮추는 하락 다이버전스 시 매도합니다. "
                        + "50년 이상 검증된 클래식 기술적 분석 전략입니다.",
                        "Gerald Appel", QuantProduct.Category.MEAN_REVERSION, QuantProduct.RiskLevel.MEDIUM,
                        0, 25.6, -14.2, 1.72, 59.4, 0,
                        List.of("MACD", "다이버전스", "클래식", "무료"),
                        List.of("BTC", "ETH", "SOL", "XRP"),
                        "매수: 가격 저점↓ + MACD 저점↑ (상승 다이버전스) / 매도: 가격 고점↑ + MACD 고점↓ (하락 다이버전스)"),

                createProduct("래리 코너스 RSI(2) 평균회귀",
                        "Larry Connors가 개발한 초단기 RSI(2) 평균회귀 전략입니다. "
                        + "200일 이동평균 위에 있는 상승 추세 종목에서 RSI(2)가 5 이하로 극단적 과매도일 때 매수, "
                        + "종가가 5일 이동평균을 상회하면 매도합니다. "
                        + "20년간의 백테스트에서 승률 80% 이상을 기록한 검증된 전략입니다.",
                        "Larry Connors", QuantProduct.Category.MEAN_REVERSION, QuantProduct.RiskLevel.MEDIUM,
                        0, 29.3, -10.8, 2.15, 82.1, 0,
                        List.of("RSI2", "코너스", "평균회귀", "고승률", "무료"),
                        List.of("BTC", "ETH", "SOL", "AVAX", "LINK"),
                        "조건: 종가 > MA(200) / 매수: RSI(2) ≤ 5 / 매도: 종가 > MA(5)"),

                // ── 유료 프리미엄 항로: 터틀 트레이딩 (자체 알고리즘) ──
                createTurtleProduct()
        );

        productRepository.saveAll(seeds);
        log.info("퀀트 상품 시드 데이터 {}개 생성 완료", seeds.size());
    }

    /**
     * 기존 상품의 subscribers 수를 실제 구매 데이터 기반으로 재계산
     */
    private void recalculateSubscribers() {
        List<QuantProduct> allProducts = productRepository.findAll();
        if (allProducts.isEmpty()) return;

        List<ProductPurchase> activePurchases = purchaseRepository.findAll().stream()
                .filter(p -> p.getStatus() == ProductPurchase.Status.ACTIVE)
                .toList();

        Map<String, Long> realCounts = activePurchases.stream()
                .collect(Collectors.groupingBy(ProductPurchase::getProductId, Collectors.counting()));

        boolean updated = false;
        for (QuantProduct product : allProducts) {
            int realCount = realCounts.getOrDefault(product.getId(), 0L).intValue();
            if (product.getSubscribers() != realCount) {
                log.info("구독자 수 보정: {} ({} → {})", product.getName(), product.getSubscribers(), realCount);
                product.setSubscribers(realCount);
                productRepository.save(product);
                updated = true;
            }
        }
        if (updated) {
            log.info("구독자 수 재계산 완료");
        }
    }

    /** 기존 DB에 없는 새 전략만 추가 */
    private void seedNewProducts() {
        Set<String> existingNames = productRepository.findAll().stream()
                .map(QuantProduct::getName)
                .collect(Collectors.toSet());

        List<QuantProduct> newProducts = new ArrayList<>();

        if (!existingNames.contains("래리 윌리엄스 변동성 돌파")) {
            newProducts.add(createProduct("래리 윌리엄스 변동성 돌파",
                    "래리 윌리엄스가 1987년 로빈스 월드컵에서 11,376% 수익을 달성한 전설적 전략입니다. "
                    + "전일 변동폭(고가-저가)의 일정 비율(k=0.5)을 당일 시가에 더한 가격을 돌파하면 매수, "
                    + "당일 종가에 전량 청산합니다. 단기 모멘텀을 포착하는 데이트레이딩 전략입니다.",
                    "Larry Williams", QuantProduct.Category.VOLATILITY, QuantProduct.RiskLevel.HIGH,
                    0, 38.2, -16.5, 1.92, 56.8, 0,
                    List.of("변동성돌파", "래리윌리엄스", "데이트레이딩", "무료", "주식"),
                    List.of("005930", "000660", "005380", "035420", "035720"),
                    "매수: 시가 + (전일 고가-저가) × 0.5 돌파 / 매도: 당일 종가 청산",
                    "STOCK"));
        }

        if (!existingNames.contains("듀얼 모멘텀")) {
            newProducts.add(createProduct("듀얼 모멘텀",
                    "Gary Antonacci가 개발한 노벨상 수상 개념(상대 모멘텀 + 절대 모멘텀) 기반 전략입니다. "
                    + "12개월 수익률이 양(+)이면서 동시에 상대적으로 강한 자산에만 투자합니다. "
                    + "시장 하락기에는 현금 비중을 높여 MDD를 크게 줄이는 것이 특징입니다.",
                    "Gary Antonacci", QuantProduct.Category.MOMENTUM, QuantProduct.RiskLevel.MEDIUM,
                    0, 22.4, -11.2, 1.78, 65.3, 0,
                    List.of("듀얼모멘텀", "상대강도", "절대모멘텀", "무료", "주식"),
                    List.of("005930", "000660", "373220", "005380", "035420"),
                    "12개월 수익률 > 0 (절대 모멘텀) + 상대 강도 상위 종목 선별 → 매수 / 조건 미충족 → 현금",
                    "STOCK"));
        }

        if (!existingNames.contains("마크 미너비니 트렌드 템플릿")) {
            newProducts.add(createProduct("마크 미너비니 트렌드 템플릿",
                    "미국 투자 챔피언십 우승자 Mark Minervini의 VCP(Volatility Contraction Pattern) 전략입니다. "
                    + "150일/200일 이동평균선 위에 있고, 52주 신고가 대비 25% 이내인 종목 중 "
                    + "변동성이 수축하며 거래량이 감소하는 패턴을 찾아 돌파 시 매수합니다.",
                    "Mark Minervini", QuantProduct.Category.TREND_FOLLOWING, QuantProduct.RiskLevel.MEDIUM,
                    0, 26.8, -13.5, 1.85, 48.7, 0,
                    List.of("VCP", "트렌드템플릿", "미너비니", "무료", "주식"),
                    List.of("005930", "000660", "207940", "068270", "035420"),
                    "조건: 주가 > MA(150) > MA(200), 52주 고가 대비 -25% 이내 / 매수: VCP 수축 후 돌파 / 손절: -8%",
                    "STOCK"));
        }

        if (!existingNames.contains("MACD 다이버전스")) {
            newProducts.add(createProduct("MACD 다이버전스",
                    "Gerald Appel이 1979년 개발한 MACD 지표의 다이버전스(괴리) 신호를 활용합니다. "
                    + "가격은 저점을 낮추는데 MACD는 저점을 높이는 상승 다이버전스 시 매수, "
                    + "가격은 고점을 높이는데 MACD는 고점을 낮추는 하락 다이버전스 시 매도합니다. "
                    + "50년 이상 검증된 클래식 기술적 분석 전략입니다.",
                    "Gerald Appel", QuantProduct.Category.MEAN_REVERSION, QuantProduct.RiskLevel.MEDIUM,
                    0, 25.6, -14.2, 1.72, 59.4, 0,
                    List.of("MACD", "다이버전스", "클래식", "무료"),
                    List.of("BTC", "ETH", "SOL", "XRP"),
                    "매수: 가격 저점↓ + MACD 저점↑ (상승 다이버전스) / 매도: 가격 고점↑ + MACD 고점↓ (하락 다이버전스)"));
        }

        if (!existingNames.contains("래리 코너스 RSI(2) 평균회귀")) {
            newProducts.add(createProduct("래리 코너스 RSI(2) 평균회귀",
                    "Larry Connors가 개발한 초단기 RSI(2) 평균회귀 전략입니다. "
                    + "200일 이동평균 위에 있는 상승 추세 종목에서 RSI(2)가 5 이하로 극단적 과매도일 때 매수, "
                    + "종가가 5일 이동평균을 상회하면 매도합니다. "
                    + "20년간의 백테스트에서 승률 80% 이상을 기록한 검증된 전략입니다.",
                    "Larry Connors", QuantProduct.Category.MEAN_REVERSION, QuantProduct.RiskLevel.MEDIUM,
                    0, 29.3, -10.8, 2.15, 82.1, 0,
                    List.of("RSI2", "코너스", "평균회귀", "고승률", "무료"),
                    List.of("BTC", "ETH", "SOL", "AVAX", "LINK"),
                    "조건: 종가 > MA(200) / 매수: RSI(2) ≤ 5 / 매도: 종가 > MA(5)"));
        }

        if (!newProducts.isEmpty()) {
            productRepository.saveAll(newProducts);
            log.info("새 퀀트 전략 {}개 추가 완료", newProducts.size());
        }
    }

    private QuantProduct createProduct(String name, String description, String creatorName,
                                        QuantProduct.Category category, QuantProduct.RiskLevel riskLevel,
                                        double price, double expectedReturn, double maxDrawdown,
                                        double sharpeRatio, double winRate, int subscribers,
                                        List<String> tags, List<String> targetAssets, String strategyLogic) {
        return createProduct(name, description, creatorName, category, riskLevel, price,
                expectedReturn, maxDrawdown, sharpeRatio, winRate, subscribers, tags, targetAssets, strategyLogic, "CRYPTO");
    }

    private QuantProduct createProduct(String name, String description, String creatorName,
                                        QuantProduct.Category category, QuantProduct.RiskLevel riskLevel,
                                        double price, double expectedReturn, double maxDrawdown,
                                        double sharpeRatio, double winRate, int subscribers,
                                        List<String> tags, List<String> targetAssets, String strategyLogic,
                                        String assetType) {
        QuantProduct p = new QuantProduct();
        p.setName(name);
        p.setDescription(description);
        p.setCreatorId("system");
        p.setCreatorName(creatorName);
        p.setCategory(category);
        p.setRiskLevel(riskLevel);
        p.setPrice(price);
        p.setExpectedReturn(expectedReturn);
        p.setMaxDrawdown(maxDrawdown);
        p.setSharpeRatio(sharpeRatio);
        p.setWinRate(winRate);
        p.setTotalTrades(0);
        p.setSubscribers(subscribers);
        p.setTags(tags);
        p.setTargetAssets(targetAssets);
        p.setStrategyLogic(strategyLogic);
        p.setAssetType(assetType);
        p.setActive(true);
        p.setCreatedAt(Instant.now());
        p.setUpdatedAt(Instant.now());
        return p;
    }

    private QuantProduct createTurtleProduct() {
        QuantProduct p = createProduct("터틀 트레이딩",
                "Donchian Channel Breakout + ADX 필터를 핵심으로 하는 자체 개발 알고리즘입니다. "
                + "100시간 채널 돌파 시 진입, 30시간 채널 이탈 또는 4% 트레일링 스탑으로 청산합니다. "
                + "ATR 기반 포지션 사이징과 최대 5단계 피라미딩으로 추세에서 최대 수익을 추구하며, "
                + "1.75 ATR 손절로 리스크를 엄격히 관리합니다. 매 시간 자동으로 시그널을 분석하여 매매합니다.",
                "WhaleArc", QuantProduct.Category.TREND_FOLLOWING, QuantProduct.RiskLevel.MEDIUM,
                500000, 35.6, -14.8, 2.12, 42.5, 0,
                List.of("터틀", "Donchian", "ADX", "ATR", "피라미딩", "프리미엄"),
                List.of("BTC", "ETH", "SOL", "AVAX", "LINK"),
                "진입: 100h Donchian 상단 돌파 + ADX(14) > 15 / "
                + "청산: 30h 채널 이탈 or 트레일링 스탑 4% / "
                + "사이징: 4% 리스크, 1.75 ATR 손절 / 최대 5유닛 피라미딩");
        p.setStrategyType(QuantProduct.StrategyType.TURTLE);
        return p;
    }

    public List<QuantProduct> getAllProducts() {
        return productRepository.findByActiveTrueOrderBySubscribersDesc();
    }

    public List<QuantProduct> getProductsByCategory(QuantProduct.Category category) {
        return productRepository.findByCategoryAndActiveTrueOrderBySubscribersDesc(category);
    }

    public QuantProduct getProduct(String productId) {
        return productRepository.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("상품을 찾을 수 없습니다."));
    }

    /**
     * 항로 구매 + 투자 금액을 타겟 자산에 균등 분배하여 시장가 매수
     */
    public ProductPurchase purchaseProduct(String userId, String productId, double investmentAmount) {
        QuantProduct product = getProduct(productId);

        if (purchaseRepository.existsByUserIdAndProductIdAndStatus(
                userId, productId, ProductPurchase.Status.ACTIVE)) {
            throw new IllegalArgumentException("이미 구매한 상품입니다.");
        }

        if (investmentAmount <= 0) {
            throw new IllegalArgumentException("투자 금액은 0보다 커야 합니다.");
        }

        // 잔고 확인
        Portfolio portfolio = portfolioService.getOrCreatePortfolio(userId);
        if (portfolio.getCashBalance() < investmentAmount) {
            throw new IllegalArgumentException("잔고가 부족합니다. 보유: " +
                    String.format("%,.0f", portfolio.getCashBalance()) + "원");
        }

        List<String> targetAssets = product.getTargetAssets();
        if (targetAssets == null || targetAssets.isEmpty()) {
            throw new IllegalArgumentException("이 상품에 설정된 투자 대상 자산이 없습니다.");
        }

        // 구매 기록 저장 (공통)
        ProductPurchase purchase = new ProductPurchase(userId, productId, product.getName(),
                product.getPrice(), investmentAmount);

        // ── 터틀 전략: 즉시 매수하지 않고 포지션 초기화 (스케줄러가 시그널에 따라 자동매매) ──
        if (product.getStrategyType() == QuantProduct.StrategyType.TURTLE) {
            // 현금을 포트폴리오에서 차감하고, 터틀 할당금으로 이동 (totalValue 유지)
            portfolio.setCashBalance(portfolio.getCashBalance() - investmentAmount);
            portfolio.setTurtleAllocated(portfolio.getTurtleAllocated() + investmentAmount);
            portfolioService.save(portfolio);

            purchase.setPurchasedAssets(new ArrayList<>());
            purchase = purchaseRepository.save(purchase);

            turtleStrategyService.initializePositions(userId, purchase.getId(), targetAssets, investmentAmount);
            log.info("터틀 항로 구매: userId={}, investment={}, assets={}", userId, investmentAmount, targetAssets);
        } else {
            // ── 일반 전략: 균등 분배 즉시 매수 (코인 or 주식) ──
            boolean isStockProduct = product.isStock();
            String assetType = isStockProduct ? "STOCK" : "CRYPTO";

            List<MarketPriceResponse> allPrices = isStockProduct
                    ? stockPriceProvider.getAllStockPrices()
                    : cryptoPriceProvider.getAllKrwTickers();
            Map<String, MarketPriceResponse> priceMap = allPrices.stream()
                    .collect(Collectors.toMap(MarketPriceResponse::getSymbol, p -> p, (a, b) -> a));

            double perAssetAmount = investmentAmount / targetAssets.size();
            List<ProductPurchase.PurchasedAsset> purchasedAssets = new ArrayList<>();

            for (String asset : targetAssets) {
                MarketPriceResponse priceInfo = priceMap.get(asset);
                if (priceInfo == null || priceInfo.getPrice() <= 0) {
                    log.warn("시세를 찾을 수 없는 자산 스킵: {}", asset);
                    continue;
                }

                double quantity = perAssetAmount / (priceInfo.getPrice() * 1.001);
                if (quantity <= 0) {
                    log.warn("투자 금액 부족으로 스킵: asset={}, price={}, perAssetAmount={}",
                            asset, priceInfo.getPrice(), perAssetAmount);
                    continue;
                }

                // 주식은 정수 단위, 코인은 소수점 8자리
                if (isStockProduct) {
                    quantity = Math.floor(quantity);
                    if (quantity <= 0) {
                        log.warn("투자 금액 부족 (1주 미만): asset={}, price={}", asset, priceInfo.getPrice());
                        continue;
                    }
                } else {
                    quantity = Math.floor(quantity * 100000000.0) / 100000000.0;
                }

                try {
                    orderService.createOrder(userId, asset, priceInfo.getName(),
                            Order.OrderType.BUY, Order.OrderMethod.MARKET, quantity, null, assetType);
                    purchasedAssets.add(new ProductPurchase.PurchasedAsset(asset, quantity, priceInfo.getPrice()));
                    log.info("항로 자동 매수: asset={}, qty={}, price={}, type={}", asset, quantity, priceInfo.getPrice(), assetType);
                } catch (Exception e) {
                    log.warn("항로 자동 매수 실패: asset={}, reason={}", asset, e.getMessage());
                }
            }

            if (purchasedAssets.isEmpty()) {
                throw new IllegalArgumentException("투자 금액이 너무 적어 매수할 수 있는 자산이 없습니다.");
            }

            // 실제 투자된 금액으로 갱신 (일부 자산 매수 실패 시 요청 금액과 다를 수 있음)
            double actualInvestment = purchasedAssets.stream()
                    .mapToDouble(pa -> pa.getPurchasePrice() * pa.getQuantity())
                    .sum();
            purchase.setInvestmentAmount(actualInvestment);
            purchase.setPurchasedAssets(purchasedAssets);
            purchase = purchaseRepository.save(purchase);
        }

        product.setSubscribers(product.getSubscribers() + 1);
        productRepository.save(product);

        log.info("항로 구매 완료: userId={}, product={}, investment={}, assets={}",
                userId, product.getName(), investmentAmount, purchase.getPurchasedAssets());
        return purchase;
    }

    public List<ProductPurchase> getMyPurchases(String userId) {
        return purchaseRepository.findByUserIdOrderByPurchasedAtDesc(userId);
    }

    /**
     * 항로 구매 취소 — 해당 항로로 매수한 자산을 전량 시장가 매도
     */
    public ProductPurchase cancelPurchase(String userId, String purchaseId) {
        ProductPurchase purchase = purchaseRepository.findById(purchaseId)
                .orElseThrow(() -> new IllegalArgumentException("구매 내역을 찾을 수 없습니다."));

        if (!purchase.getUserId().equals(userId)) {
            throw new IllegalArgumentException("본인의 구매만 취소할 수 있습니다.");
        }

        if (purchase.getStatus() != ProductPurchase.Status.ACTIVE) {
            throw new IllegalArgumentException("이미 취소된 구매입니다.");
        }

        // 터틀 전략인지 확인
        QuantProduct product = productRepository.findById(purchase.getProductId()).orElse(null);
        boolean isTurtle = product != null && product.getStrategyType() == QuantProduct.StrategyType.TURTLE;

        if (isTurtle) {
            // 터틀: 포지션 청산 + 할당 현금 반환
            turtleStrategyService.closeAllPositions(purchase.getId());
            Portfolio portfolio = portfolioService.getOrCreatePortfolio(userId);
            double allocated = purchase.getInvestmentAmount();
            portfolio.setTurtleAllocated(Math.max(0, portfolio.getTurtleAllocated() - allocated));
            portfolio.setCashBalance(portfolio.getCashBalance() + allocated);
            portfolioService.save(portfolio);
        } else {
            // 일반: 매수한 자산들을 항로 매수 수량만큼만 매도
            boolean isStockProduct = product != null && product.isStock();
            String cancelAssetType = isStockProduct ? "STOCK" : "CRYPTO";

            for (ProductPurchase.PurchasedAsset pa : purchase.getPurchasedAssets()) {
                // 매 매도 시 최신 포트폴리오 조회 (이전 매도가 반영된 상태)
                Portfolio portfolio = portfolioService.getOrCreatePortfolio(userId);
                Holding holding = portfolio.getHoldings().stream()
                        .filter(h -> h.getStockCode() != null && h.getStockCode().equals(pa.getCode()))
                        .findFirst()
                        .orElse(null);

                if (holding != null && holding.getQuantity() > 0) {
                    double sellQty = Math.min(pa.getQuantity(), holding.getQuantity());
                    try {
                        orderService.createOrder(userId, pa.getCode(), holding.getStockName(),
                                Order.OrderType.SELL, Order.OrderMethod.MARKET,
                                sellQty, null, cancelAssetType);
                        log.info("항로 취소 자동 매도: asset={}, qty={} (항로 매수량: {})",
                                pa.getCode(), sellQty, pa.getQuantity());
                    } catch (Exception e) {
                        log.warn("항로 취소 자동 매도 실패: asset={}, reason={}", pa.getCode(), e.getMessage());
                    }
                } else {
                    log.warn("항로 취소: 보유 종목에서 {} 찾을 수 없음 (이미 매도됨)", pa.getCode());
                }
            }
        }

        // 대표 항로가 취소된 항로였으면 해제
        Portfolio repPortfolio = portfolioService.getOrCreatePortfolio(userId);
        if (purchaseId.equals(repPortfolio.getRepresentativePurchaseId())) {
            repPortfolio.setRepresentativePurchaseId(null);
            portfolioService.save(repPortfolio);
        }

        purchase.setStatus(ProductPurchase.Status.REFUNDED);
        purchase = purchaseRepository.save(purchase);

        // 구독자 수 감소
        productRepository.findById(purchase.getProductId()).ifPresent(p -> {
            p.setSubscribers(Math.max(0, p.getSubscribers() - 1));
            productRepository.save(p);
        });

        log.info("항로 구매 취소 완료: userId={}, product={}", userId, purchase.getProductName());
        return purchase;
    }

    public Set<String> getMyPurchasedProductIds(String userId) {
        return purchaseRepository.findByUserIdOrderByPurchasedAtDesc(userId).stream()
                .filter(p -> p.getStatus() == ProductPurchase.Status.ACTIVE)
                .map(ProductPurchase::getProductId)
                .collect(Collectors.toSet());
    }

    /**
     * 사용자의 활성 항로별 수익률 성과를 계산합니다.
     */
    public List<PurchasePerformanceDto> getMyPurchasesPerformance(String userId) {
        List<ProductPurchase> activePurchases = purchaseRepository.findByUserIdOrderByPurchasedAtDesc(userId)
                .stream()
                .filter(p -> p.getStatus() == ProductPurchase.Status.ACTIVE)
                .toList();

        if (activePurchases.isEmpty()) return List.of();

        // 현재가 한번에 조회 (코인 + 주식)
        Map<String, MarketPriceResponse> priceMap = new java.util.HashMap<>();
        cryptoPriceProvider.getAllKrwTickers().forEach(p -> priceMap.put(p.getSymbol(), p));
        stockPriceProvider.getAllStockPrices().forEach(p -> priceMap.put(p.getSymbol(), p));

        List<PurchasePerformanceDto> results = new ArrayList<>();

        for (ProductPurchase purchase : activePurchases) {
            QuantProduct product = productRepository.findById(purchase.getProductId()).orElse(null);
            boolean isTurtle = product != null && product.getStrategyType() == QuantProduct.StrategyType.TURTLE;

            if (isTurtle) {
                results.add(buildTurtlePerformance(purchase, priceMap));
            } else {
                results.add(buildSimplePerformance(purchase, priceMap));
            }
        }

        return results;
    }

    private PurchasePerformanceDto buildSimplePerformance(ProductPurchase purchase,
                                                           Map<String, MarketPriceResponse> priceMap) {
        // 레거시 데이터(purchasePrice=0) 폴백용: 포트폴리오의 Holding 평균단가 사용
        Portfolio portfolio = portfolioService.getOrCreatePortfolio(purchase.getUserId());
        Map<String, Double> holdingAvgPrices = portfolio.getHoldings().stream()
                .collect(Collectors.toMap(Holding::getStockCode, Holding::getAveragePrice, (a, b) -> a));

        List<PurchasePerformanceDto.AssetPerformance> assetPerfs = new ArrayList<>();
        double totalCurrent = 0;
        double totalCost = 0;

        for (ProductPurchase.PurchasedAsset pa : purchase.getPurchasedAssets()) {
            MarketPriceResponse mp = priceMap.get(pa.getCode());
            double currentPrice = mp != null ? mp.getPrice() : 0;
            double buyPrice = pa.getPurchasePrice();
            // 레거시 데이터: purchasePrice가 0이면 Holding 평균단가로 폴백
            if (buyPrice <= 0) {
                buyPrice = holdingAvgPrices.getOrDefault(pa.getCode(), 0.0);
            }

            double cost = buyPrice * pa.getQuantity();
            double current = currentPrice * pa.getQuantity();
            double pnl = current - cost;
            double returnRate = cost > 0 ? (pnl / cost) * 100 : 0;

            totalCost += cost;
            totalCurrent += current;

            assetPerfs.add(PurchasePerformanceDto.AssetPerformance.builder()
                    .code(pa.getCode())
                    .name(mp != null ? mp.getName() : pa.getCode())
                    .quantity(pa.getQuantity())
                    .purchasePrice(buyPrice)
                    .currentPrice(currentPrice)
                    .pnl(pnl)
                    .returnRate(returnRate)
                    .build());
        }

        double totalPnl = totalCurrent - totalCost;
        double totalReturn = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

        return PurchasePerformanceDto.builder()
                .purchaseId(purchase.getId())
                .productName(purchase.getProductName())
                .strategyType("SIMPLE")
                .investmentAmount(purchase.getInvestmentAmount())
                .totalCurrentValue(totalCurrent)
                .totalPnl(totalPnl)
                .totalReturnRate(totalReturn)
                .assets(assetPerfs)
                .build();
    }

    private PurchasePerformanceDto buildTurtlePerformance(ProductPurchase purchase,
                                                           Map<String, MarketPriceResponse> priceMap) {
        List<TurtlePosition> positions = turtlePositionRepository.findByPurchaseId(purchase.getId());

        List<PurchasePerformanceDto.AssetPerformance> assetPerfs = new ArrayList<>();
        double totalRealized = 0;
        double totalUnrealized = 0;
        int totalTrades = 0;
        int totalWins = 0;

        for (TurtlePosition pos : positions) {
            MarketPriceResponse mp = priceMap.get(pos.getSymbol());
            double currentPrice = mp != null ? mp.getPrice() : 0;

            double unrealized = 0;
            if (pos.getDirection() == TurtlePosition.Direction.LONG && pos.getAvgPrice() > 0) {
                unrealized = pos.getAllocatedCash() * pos.getUnitWeight() * pos.getUnits()
                        * ((currentPrice - pos.getAvgPrice()) / pos.getAvgPrice());
            }

            totalRealized += pos.getRealizedPnl();
            totalUnrealized += unrealized;
            totalTrades += pos.getTradeCount();
            totalWins += pos.getWinCount();

            assetPerfs.add(PurchasePerformanceDto.AssetPerformance.builder()
                    .code(pos.getSymbol())
                    .name(mp != null ? mp.getName() : pos.getSymbol())
                    .quantity(pos.getUnits())
                    .purchasePrice(pos.getAvgPrice())
                    .currentPrice(currentPrice)
                    .pnl(pos.getRealizedPnl() + unrealized)
                    .returnRate(pos.getAllocatedCash() > 0
                            ? ((pos.getRealizedPnl() + unrealized) / pos.getAllocatedCash()) * 100 : 0)
                    .direction(pos.getDirection().name())
                    .realizedPnl(pos.getRealizedPnl())
                    .tradeCount(pos.getTradeCount())
                    .winCount(pos.getWinCount())
                    .build());
        }

        double totalPnl = totalRealized + totalUnrealized;
        double totalReturn = purchase.getInvestmentAmount() > 0
                ? (totalPnl / purchase.getInvestmentAmount()) * 100 : 0;

        return PurchasePerformanceDto.builder()
                .purchaseId(purchase.getId())
                .productName(purchase.getProductName())
                .strategyType("TURTLE")
                .investmentAmount(purchase.getInvestmentAmount())
                .totalCurrentValue(purchase.getInvestmentAmount() + totalPnl)
                .totalPnl(totalPnl)
                .totalReturnRate(totalReturn)
                .assets(assetPerfs)
                .realizedPnl(totalRealized)
                .unrealizedPnl(totalUnrealized)
                .totalTradeCount(totalTrades)
                .totalWinCount(totalWins)
                .build();
    }
}
