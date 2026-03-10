package com.project.whalearc.strategy.service;

import com.project.whalearc.market.dto.MarketPriceResponse;
import com.project.whalearc.market.service.CryptoPriceProvider;
import com.project.whalearc.market.service.StockMasterService;
import com.project.whalearc.market.service.StockPriceProvider;
import com.project.whalearc.notification.domain.Notification;
import com.project.whalearc.notification.service.NotificationService;
import com.project.whalearc.store.domain.ProductPurchase;
import com.project.whalearc.store.repository.ProductPurchaseRepository;
import com.project.whalearc.strategy.domain.Strategy;
import com.project.whalearc.strategy.dto.StrategyRequest;
import com.project.whalearc.strategy.repository.StrategyRepository;
import com.project.whalearc.trade.domain.Order;
import com.project.whalearc.trade.domain.Portfolio;
import com.project.whalearc.trade.service.OrderService;
import com.project.whalearc.trade.service.PortfolioService;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class StrategyService {

    private final StrategyRepository strategyRepository;
    private final ProductPurchaseRepository purchaseRepository;
    private final OrderService orderService;
    private final CryptoPriceProvider cryptoPriceProvider;
    private final StockPriceProvider stockPriceProvider;
    private final StockMasterService stockMasterService;
    private final PortfolioService portfolioService;
    private final NotificationService notificationService;

    /**
     * 서버 시작 시: applied=true인 전략 중 ProductPurchase가 없는 경우 자동 생성 (마이그레이션)
     */
    @PostConstruct
    public void migrateAppliedStrategies() {
        List<Strategy> appliedStrategies = strategyRepository.findByAppliedTrue();
        int migrated = 0;
        for (Strategy strategy : appliedStrategies) {
            String productId = "strategy_" + strategy.getId();
            boolean exists = purchaseRepository.existsByUserIdAndProductIdAndStatus(
                    strategy.getUserId(), productId, ProductPurchase.Status.ACTIVE);
            if (!exists) {
                // 포트폴리오 홀딩에서 전략 대상 자산의 투자금·매입가 복원
                Portfolio portfolio = portfolioService.getOrCreatePortfolio(strategy.getUserId());
                List<String> targetAssets = strategy.getTargetAssets();
                double totalInvestment = 0;
                List<ProductPurchase.PurchasedAsset> purchasedAssets = new ArrayList<>();

                if (targetAssets != null && portfolio.getHoldings() != null) {
                    for (var holding : portfolio.getHoldings()) {
                        if (holding.getStockCode() == null) continue;
                        if (targetAssets.contains(holding.getStockCode())) {
                            BigDecimal avgPrice = holding.getAveragePrice().max(BigDecimal.ZERO);
                            double investedValue = avgPrice.multiply(holding.getQuantity()).doubleValue();
                            totalInvestment += investedValue;
                            purchasedAssets.add(new ProductPurchase.PurchasedAsset(
                                    holding.getStockCode(), holding.getQuantity(), avgPrice));
                        }
                    }
                }

                ProductPurchase purchase = new ProductPurchase(
                        strategy.getUserId(), productId,
                        "[전략] " + strategy.getName(), BigDecimal.ZERO, BigDecimal.valueOf(totalInvestment));
                purchase.setPurchasedAssets(purchasedAssets);
                purchaseRepository.save(purchase);
                migrated++;
                log.info("전략 마이그레이션: strategy={}, user={}, investment={}",
                        strategy.getName(), strategy.getUserId(), totalInvestment);
            }
        }
        if (migrated > 0) {
            log.info("전략 → ProductPurchase 마이그레이션 완료: {}건", migrated);
        }
    }

    public List<Strategy> getUserStrategies(String userId) {
        return strategyRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    public Strategy createStrategy(String userId, StrategyRequest request) {
        Strategy strategy = new Strategy(
                userId,
                request.getName(),
                request.getDescription(),
                request.getIndicators(),
                request.getEntryConditions(),
                request.getExitConditions(),
                request.getTargetAssets(),
                request.getAssetType(),
                request.getStrategyLogic()
        );
        if (request.getTargetAssetNames() != null) {
            strategy.setTargetAssetNames(request.getTargetAssetNames());
        }
        return strategyRepository.save(strategy);
    }

    public Strategy updateStrategy(String userId, String strategyId, StrategyRequest request) {
        Strategy strategy = strategyRepository.findById(strategyId)
                .orElseThrow(() -> new IllegalArgumentException("전략을 찾을 수 없습니다."));

        if (!strategy.getUserId().equals(userId)) {
            throw new IllegalArgumentException("본인의 전략만 수정할 수 있습니다.");
        }

        if (request.getName() != null) strategy.setName(request.getName());
        if (request.getDescription() != null) strategy.setDescription(request.getDescription());
        if (request.getIndicators() != null) strategy.setIndicators(request.getIndicators());
        if (request.getEntryConditions() != null) strategy.setEntryConditions(request.getEntryConditions());
        if (request.getExitConditions() != null) strategy.setExitConditions(request.getExitConditions());
        if (request.getTargetAssets() != null) strategy.setTargetAssets(request.getTargetAssets());
        if (request.getTargetAssetNames() != null) strategy.setTargetAssetNames(request.getTargetAssetNames());
        if (request.getAssetType() != null) strategy.setAssetType(request.getAssetType());
        if (request.getStrategyLogic() != null) strategy.setStrategyLogic(request.getStrategyLogic());
        strategy.setUpdatedAt(Instant.now());

        return strategyRepository.save(strategy);
    }

    public void deleteStrategy(String userId, String strategyId) {
        Strategy strategy = strategyRepository.findById(strategyId)
                .orElseThrow(() -> new IllegalArgumentException("전략을 찾을 수 없습니다."));

        if (!strategy.getUserId().equals(userId)) {
            throw new IllegalArgumentException("본인의 전략만 삭제할 수 있습니다.");
        }

        strategyRepository.delete(strategy);
    }

    /**
     * 전략을 포트폴리오에 적용: 투자 금액을 타겟 자산에 균등 분배하여 시장가 매수
     */
    public Strategy applyStrategy(String userId, String strategyId, BigDecimal investmentAmount) {
        Strategy strategy = strategyRepository.findById(strategyId)
                .orElseThrow(() -> new IllegalArgumentException("전략을 찾을 수 없습니다."));

        if (!strategy.getUserId().equals(userId)) {
            throw new IllegalArgumentException("본인의 전략만 적용할 수 있습니다.");
        }

        if (strategy.isApplied()) {
            throw new IllegalArgumentException("이미 적용된 전략입니다.");
        }

        List<String> targetAssets = strategy.getTargetAssets();
        if (targetAssets == null || targetAssets.isEmpty()) {
            throw new IllegalArgumentException("투자 대상 자산이 설정되지 않았습니다.");
        }

        if (investmentAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("투자 금액은 0보다 커야 합니다.");
        }

        Portfolio portfolio = portfolioService.getOrCreatePortfolio(userId);
        if (portfolio.getCashBalance().compareTo(investmentAmount) < 0) {
            throw new IllegalArgumentException("잔고가 부족합니다. 보유: " +
                    String.format("%,.0f", portfolio.getCashBalance().doubleValue()) + "원");
        }

        // 자산 유형 판단
        String assetType = strategy.getAssetType();
        boolean hasCrypto = !"STOCK".equals(assetType);
        boolean hasStock = "STOCK".equals(assetType) || "MIXED".equals(assetType);

        // 현재가 조회
        Map<String, MarketPriceResponse> priceMap = new java.util.HashMap<>();
        if (hasCrypto) {
            cryptoPriceProvider.getAllKrwTickers().forEach(p -> priceMap.put(p.getSymbol(), p));
        }
        if (hasStock) {
            stockPriceProvider.getAllStockPrices().forEach(p -> priceMap.put(p.getSymbol(), p));
        }

        BigDecimal perAssetAmount = investmentAmount.divide(BigDecimal.valueOf(targetAssets.size()), 10, java.math.RoundingMode.HALF_UP);
        int successCount = 0;
        List<String> failedAssets = new ArrayList<>();
        List<ProductPurchase.PurchasedAsset> purchasedAssets = new ArrayList<>();

        for (String asset : targetAssets) {
            MarketPriceResponse priceInfo = priceMap.get(asset);

            // 인기 종목에 없는 주식 → 개별 KIS API 조회
            if (priceInfo == null && asset.matches("\\d{6}")) {
                String stockName = stockMasterService.getStockName(asset);
                if (stockName != null) {
                    priceInfo = stockPriceProvider.getStockPriceByCode(asset, stockName);
                    if (priceInfo != null) {
                        priceMap.put(asset, priceInfo);
                    }
                }
            }

            if (priceInfo == null || priceInfo.getPrice() <= 0) {
                log.warn("시세를 찾을 수 없는 자산 스킵: {}", asset);
                failedAssets.add(asset + "(시세 조회 실패)");
                continue;
            }

            BigDecimal priceBd = BigDecimal.valueOf(priceInfo.getPrice()).multiply(new BigDecimal("1.001"));
            BigDecimal quantity = perAssetAmount.divide(priceBd, 10, java.math.RoundingMode.HALF_UP);
            if (quantity.compareTo(BigDecimal.ZERO) <= 0) {
                failedAssets.add(asset + "(수량 계산 불가)");
                continue;
            }

            boolean isStock = asset.matches("\\d{6}");
            String orderAssetType = isStock ? "STOCK" : "CRYPTO";

            if (isStock) {
                quantity = quantity.setScale(0, java.math.RoundingMode.FLOOR);
                if (quantity.compareTo(BigDecimal.ZERO) <= 0) {
                    log.warn("투자 금액 부족 (1주 미만): asset={}, price={}", asset, priceInfo.getPrice());
                    failedAssets.add(asset + "(1주 미만)");
                    continue;
                }
            } else {
                quantity = quantity.setScale(8, java.math.RoundingMode.FLOOR);
            }

            try {
                orderService.createOrder(userId, asset, priceInfo.getName(),
                        Order.OrderType.BUY, Order.OrderMethod.MARKET, quantity, null, orderAssetType);
                purchasedAssets.add(new ProductPurchase.PurchasedAsset(asset, quantity, priceBd));
                successCount++;
                log.info("전략 적용 매수: strategy={}, asset={}, qty={}, price={}",
                        strategy.getName(), asset, quantity, priceInfo.getPrice());
            } catch (Exception e) {
                log.warn("전략 적용 매수 실패: asset={}, reason={}", asset, e.getMessage());
                failedAssets.add(asset + "(" + e.getMessage() + ")");
            }
        }

        if (successCount == 0) {
            throw new IllegalArgumentException("매수 가능한 자산이 없습니다. 실패: " + String.join(", ", failedAssets));
        }

        // 실제 투자된 금액 계산 (매수 성공한 자산들의 price * quantity 합산)
        BigDecimal actualInvestment = purchasedAssets.stream()
                .map(pa -> pa.getPurchasePrice().multiply(pa.getQuantity()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // ProductPurchase 레코드 생성 → 포트폴리오 "항해 중인 항로"에 표시
        ProductPurchase purchase = new ProductPurchase(
                userId, "strategy_" + strategyId,
                "[전략] " + strategy.getName(), BigDecimal.ZERO, actualInvestment);
        purchase.setPurchasedAssets(purchasedAssets);
        purchaseRepository.save(purchase);

        strategy.setApplied(true);
        strategy.setAppliedSuccessCount(successCount);
        strategy.setAppliedTotalCount(targetAssets.size());
        strategy.setUpdatedAt(Instant.now());
        Strategy saved = strategyRepository.save(strategy);

        // 전략 적용 알림
        notificationService.createNotification(
                userId,
                Notification.NotificationType.STRATEGY_EXECUTED,
                "항로 적용 완료",
                "'" + strategy.getName() + "' 항로가 적용되었습니다. ("
                        + successCount + "/" + targetAssets.size() + "개 종목 매수 성공)"
        );

        return saved;
    }

    /**
     * 전략 적용 해제: applied 플래그만 초기화 (이미 체결된 주문은 유지)
     */
    public Strategy unapplyStrategy(String userId, String strategyId) {
        Strategy strategy = strategyRepository.findById(strategyId)
                .orElseThrow(() -> new IllegalArgumentException("전략을 찾을 수 없습니다."));

        if (!strategy.getUserId().equals(userId)) {
            throw new IllegalArgumentException("본인의 전략만 수정할 수 있습니다.");
        }

        if (!strategy.isApplied()) {
            throw new IllegalArgumentException("적용되지 않은 전략입니다.");
        }

        // 연결된 ProductPurchase 비활성화
        purchaseRepository.findByUserIdAndProductIdAndStatus(
                userId, "strategy_" + strategyId, ProductPurchase.Status.ACTIVE)
                .ifPresent(purchase -> {
                    purchase.setStatus(ProductPurchase.Status.EXPIRED);
                    purchaseRepository.save(purchase);
                });

        strategy.setApplied(false);
        strategy.setAppliedSuccessCount(0);
        strategy.setAppliedTotalCount(0);
        strategy.setUpdatedAt(Instant.now());
        Strategy saved = strategyRepository.save(strategy);

        // 전략 해제 알림
        notificationService.createNotification(
                userId,
                Notification.NotificationType.STRATEGY_EXECUTED,
                "항로 해제 완료",
                "'" + strategy.getName() + "' 항로가 해제되었습니다."
        );

        return saved;
    }
}
