package com.project.whalearc.trade.service;

import com.project.whalearc.market.dto.MarketPriceResponse;
import com.project.whalearc.market.service.CryptoPriceProvider;
import com.project.whalearc.market.service.KisApiClient;
import com.project.whalearc.market.service.StockPriceProvider;
import com.project.whalearc.store.repository.ProductPurchaseRepository;
import com.project.whalearc.strategy.repository.StrategyRepository;
import com.project.whalearc.strategy.repository.TurtlePositionRepository;
import com.project.whalearc.trade.domain.Holding;
import com.project.whalearc.trade.domain.Portfolio;
import com.project.whalearc.trade.domain.PortfolioSnapshot;
import com.project.whalearc.trade.repository.OrderRepository;
import com.project.whalearc.trade.repository.PortfolioRepository;
import com.project.whalearc.trade.repository.PortfolioSnapshotRepository;
import com.project.whalearc.trade.repository.TradeRecordRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class PortfolioService {

    private static final BigDecimal INITIAL_CASH = BigDecimal.valueOf(10_000_000); // 1000만원
    private static final int MAX_LOCKS = 10_000;
    private final ConcurrentHashMap<String, ReentrantLock> userLocks = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Long> lockLastUsed = new ConcurrentHashMap<>();

    private ReentrantLock getUserLock(String userId) {
        lockLastUsed.put(userId, System.currentTimeMillis());
        if (userLocks.size() > MAX_LOCKS) {
            long expiry = System.currentTimeMillis() - 600_000;
            lockLastUsed.entrySet().removeIf(e -> {
                if (e.getValue() < expiry) {
                    ReentrantLock lock = userLocks.get(e.getKey());
                    if (lock != null && !lock.isLocked()) {
                        userLocks.remove(e.getKey());
                        return true;
                    }
                }
                return false;
            });
        }
        return userLocks.computeIfAbsent(userId, k -> new ReentrantLock());
    }

    private final PortfolioRepository portfolioRepository;
    private final CryptoPriceProvider cryptoPriceProvider;
    private final StockPriceProvider stockPriceProvider;
    private final KisApiClient kisApiClient;
    private final PortfolioSnapshotRepository snapshotRepository;
    private final OrderRepository orderRepository;
    private final TradeRecordRepository tradeRecordRepository;
    private final ProductPurchaseRepository purchaseRepository;
    private final TurtlePositionRepository turtlePositionRepository;
    private final StrategyRepository strategyRepository;

    /**
     * 유저의 포트폴리오를 조회 (없으면 초기 자산 1000만원으로 생성)
     * 보유 종목의 currentPrice를 빗썸 실시간 가격으로 갱신
     */
    public Portfolio getOrCreatePortfolio(String userId) {
        ReentrantLock lock = getUserLock(userId);
        lock.lock();
        try {
            Portfolio portfolio = portfolioRepository.findByUserId(userId)
                    .orElseGet(() -> portfolioRepository.save(new Portfolio(userId, INITIAL_CASH)));

            updateHoldingPrices(portfolio);
            ensureTodaySnapshot(portfolio);
            return portfolio;
        } finally {
            lock.unlock();
        }
    }

    /**
     * 보유 종목의 현재가를 갱신 (가상화폐: 빗썸, 주식: KIS API)
     */
    private void updateHoldingPrices(Portfolio portfolio) {
        if (portfolio.getHoldings().isEmpty()) return;

        try {
            // 가상화폐 시세 맵
            Map<String, BigDecimal> cryptoPriceMap = Map.of();
            boolean hasCrypto = portfolio.getHoldings().stream().anyMatch(h -> !h.isStock());
            if (hasCrypto) {
                List<MarketPriceResponse> cryptoPrices = cryptoPriceProvider.getAllKrwTickers();
                if (!cryptoPrices.isEmpty()) {
                    cryptoPriceMap = cryptoPrices.stream()
                            .collect(Collectors.toMap(MarketPriceResponse::getSymbol, p -> BigDecimal.valueOf(p.getPrice()), (a, b) -> a));
                }
            }

            // 주식 시세 맵 (캐시된 인기종목)
            Map<String, BigDecimal> stockPriceMap = Map.of();
            boolean hasStock = portfolio.getHoldings().stream().anyMatch(Holding::isStock);
            if (hasStock) {
                List<MarketPriceResponse> stockPrices = stockPriceProvider.getAllStockPrices();
                if (!stockPrices.isEmpty()) {
                    stockPriceMap = stockPrices.stream()
                            .collect(Collectors.toMap(MarketPriceResponse::getSymbol, p -> BigDecimal.valueOf(p.getPrice()), (a, b) -> a));
                }
            }

            for (Holding holding : portfolio.getHoldings()) {
                if (holding.isStock()) {
                    BigDecimal price = stockPriceMap.get(holding.getStockCode());
                    if (price != null) {
                        holding.setCurrentPrice(price);
                    } else {
                        // 캐시에 없는 주식은 개별 조회
                        try {
                            Map<String, String> output = kisApiClient.getStockPrice(holding.getStockCode());
                            if (output != null) {
                                long p = Long.parseLong(output.get("stck_prpr"));
                                if (p > 0) holding.setCurrentPrice(BigDecimal.valueOf(p));
                            }
                        } catch (Exception e) {
                            log.debug("주식 시세 개별 조회 실패 [{}]: {}", holding.getStockCode(), e.getMessage());
                        }
                    }
                } else {
                    BigDecimal price = cryptoPriceMap.get(holding.getStockCode());
                    if (price != null) {
                        holding.setCurrentPrice(price);
                    }
                }
            }
        } catch (Exception e) {
            log.error("보유 종목 시세 갱신 실패: {}", e.getMessage());
        }
    }

    /**
     * 오늘 스냅샷이 없으면 생성
     */
    public void ensureTodaySnapshot(Portfolio portfolio) {
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));
        if (snapshotRepository.findByUserIdAndDate(portfolio.getUserId(), today).isEmpty()) {
            try {
                snapshotRepository.save(new PortfolioSnapshot(portfolio.getUserId(), today, portfolio));
            } catch (Exception e) {
                log.debug("스냅샷 저장 스킵 [{}]: {}", portfolio.getUserId(), e.getMessage());
            }
        }
    }

    public Portfolio save(Portfolio portfolio) {
        return portfolioRepository.save(portfolio);
    }

    /**
     * 모의투자 완전 초기화: 포트폴리오, 주문, 거래, 구매, 터틀 포지션, 스냅샷, 전략 적용상태 전부 리셋
     * MongoDB Standalone에서는 multi-doc 트랜잭션 불가 → 각 단계별 에러 격리
     */
    public Portfolio resetPortfolio(String userId) {
        ReentrantLock lock = getUserLock(userId);
        lock.lock();
        try {
            List<String> errors = new java.util.ArrayList<>();

            // 1. 포트폴리오 초기화 (핵심 — 실패 시 전체 중단)
            Portfolio portfolio = portfolioRepository.findByUserId(userId)
                    .orElse(new Portfolio(userId, INITIAL_CASH));
            portfolio.setCashBalance(INITIAL_CASH);
            portfolio.setInitialCash(INITIAL_CASH);
            portfolio.setHoldings(new java.util.ArrayList<>());
            portfolio.setTurtleAllocated(BigDecimal.ZERO);
            portfolio.setRepresentativePurchaseId(null);
            portfolio = portfolioRepository.save(portfolio);

            // 2~5. 부속 데이터 삭제 (각각 실패해도 다음 단계 진행)
            try { orderRepository.deleteByUserId(userId); }
            catch (Exception e) { errors.add("주문 기록: " + e.getMessage()); }

            try { tradeRecordRepository.deleteByUserId(userId); }
            catch (Exception e) { errors.add("거래 기록: " + e.getMessage()); }

            try { purchaseRepository.deleteByUserId(userId); }
            catch (Exception e) { errors.add("항로 구매: " + e.getMessage()); }

            try { turtlePositionRepository.deleteByUserId(userId); }
            catch (Exception e) { errors.add("터틀 포지션: " + e.getMessage()); }

            try {
                strategyRepository.findByUserIdOrderByCreatedAtDesc(userId).forEach(strategy -> {
                    if (strategy.isApplied()) {
                        strategy.setApplied(false);
                        strategy.setAppliedSuccessCount(0);
                        strategy.setAppliedTotalCount(0);
                        strategyRepository.save(strategy);
                    }
                });
            } catch (Exception e) { errors.add("전략 초기화: " + e.getMessage()); }

            try { snapshotRepository.deleteByUserId(userId); }
            catch (Exception e) { errors.add("스냅샷: " + e.getMessage()); }

            if (!errors.isEmpty()) {
                log.warn("모의투자 초기화 부분 실패: userId={}, errors={}", userId, errors);
            }
            log.info("모의투자 초기화 완료: userId={}", userId);
            return portfolio;
        } catch (Exception e) {
            log.error("모의투자 초기화 중 오류 발생: userId={}, error={}", userId, e.getMessage());
            throw new RuntimeException("초기화 중 오류가 발생했습니다. 다시 시도해주세요.", e);
        } finally {
            lock.unlock();
        }
    }
}
