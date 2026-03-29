package com.project.whalearc.ranking.service;

import com.project.whalearc.ranking.dto.MyRankingDto;
import com.project.whalearc.ranking.dto.PortfolioDetailDto;
import com.project.whalearc.ranking.dto.RankingEntryDto;
import com.project.whalearc.ranking.dto.RankingResponseDto;
import com.project.whalearc.store.domain.ProductPurchase;
import com.project.whalearc.store.domain.QuantProduct;
import com.project.whalearc.store.dto.PurchasePerformanceDto;
import com.project.whalearc.store.repository.ProductPurchaseRepository;
import com.project.whalearc.store.repository.QuantProductRepository;
import com.project.whalearc.store.service.QuantStoreService;
import com.project.whalearc.trade.domain.Portfolio;
import com.project.whalearc.trade.domain.PortfolioSnapshot;
import com.project.whalearc.trade.repository.PortfolioRepository;
import com.project.whalearc.trade.repository.PortfolioSnapshotRepository;
import com.project.whalearc.trade.service.PortfolioService;
import com.project.whalearc.user.domain.User;
import com.project.whalearc.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class RankingService {

    private final PortfolioRepository portfolioRepository;
    private final PortfolioSnapshotRepository snapshotRepository;
    private final PortfolioService portfolioService;
    private final UserRepository userRepository;
    private final ProductPurchaseRepository purchaseRepository;
    private final QuantProductRepository productRepository;
    private final QuantStoreService quantStoreService;

    private static final int MAX_RANKING_SIZE = 100;

    /**
     * 랭킹 조회 (기간별 필터 + 페이지네이션)
     * type: all(전체 수익률), daily(일간 변화), weekly(주간 변화), monthly(월간 변화)
     */
    public RankingResponseDto getRankings(String currentUserId, String type, int page, int size) {
        size = Math.min(Math.max(size, 1), 100);
        page = Math.max(page, 0);

        // 전체 포트폴리오 조회 (유저 존재 여부는 표시 시점에 필터)
        List<Portfolio> allPortfolios = portfolioRepository.findAll();

        // 기간별 스냅샷 기준 수익률 변화 계산
        Map<String, Double> periodReturnMap = null;
        if (!"all".equals(type)) {
            periodReturnMap = calculatePeriodReturns(allPortfolios, type);
        }

        // 정렬 기준: all → 전체 수익률, 기간별 → 해당 기간 수익률 변화
        final Map<String, Double> sortMap = periodReturnMap;
        List<Portfolio> sorted;
        if (sortMap != null) {
            sorted = allPortfolios.stream()
                    .sorted((a, b) -> {
                        double ra = sortMap.getOrDefault(a.getUserId(), 0.0);
                        double rb = sortMap.getOrDefault(b.getUserId(), 0.0);
                        return Double.compare(rb, ra);
                    })
                    .toList();
        } else {
            sorted = allPortfolios.stream()
                    .sorted((a, b) -> b.getReturnRate().compareTo(a.getReturnRate()))
                    .toList();
        }

        int totalCount = sorted.size();

        // 전체 순위 맵
        Map<String, Integer> rankMap = new HashMap<>();
        for (int i = 0; i < sorted.size(); i++) {
            rankMap.put(sorted.get(i).getUserId(), i + 1);
        }

        // 페이지네이션 적용
        int fromIndex = Math.min(page * size, totalCount);
        int toIndex = Math.min(fromIndex + size, totalCount);
        List<Portfolio> pageList = sorted.subList(fromIndex, toIndex);

        // 현재 유저가 페이지에 없으면 별도 myRanking으로 분리 (페이지 사이즈 유지)
        boolean currentUserInPage = pageList.stream().anyMatch(p -> p.getUserId().equals(currentUserId));
        List<Portfolio> displayList = new ArrayList<>(pageList);
        Portfolio myPortfolio = null;
        if (!currentUserInPage) {
            myPortfolio = sorted.stream()
                    .filter(p -> p.getUserId().equals(currentUserId))
                    .findFirst()
                    .orElse(null);
            // myPortfolio의 유저 정보도 조회해야 하므로 displayList에는 넣지 않음
        }

        // 유저 정보 조회 (myPortfolio 포함)
        Set<String> displayUserIds = displayList.stream()
                .map(Portfolio::getUserId)
                .collect(Collectors.toSet());
        if (myPortfolio != null) {
            displayUserIds.add(myPortfolio.getUserId());
        }
        Map<String, User> userMap = userRepository.findAllBySupabaseIdIn(displayUserIds).stream()
                .collect(Collectors.toMap(User::getSupabaseId, u -> u, (a, b) -> a));

        // 통계 계산 (전체 기준)
        double avgReturn = 0;
        int positiveCount = 0;
        int negativeCount = 0;
        for (Portfolio p : sorted) {
            double ret = sortMap != null
                    ? sortMap.getOrDefault(p.getUserId(), 0.0)
                    : p.getReturnRate().doubleValue();
            avgReturn += ret;
            if (ret > 0) positiveCount++;
            else if (ret < 0) negativeCount++;
        }
        avgReturn = totalCount > 0 ? avgReturn / totalCount : 0;

        // 대표 항로 정보 배치 조회 (N+1 방지, myPortfolio 포함)
        Set<String> purchaseIds = displayList.stream()
                .map(Portfolio::getRepresentativePurchaseId)
                .filter(id -> id != null)
                .collect(Collectors.toSet());
        if (myPortfolio != null && myPortfolio.getRepresentativePurchaseId() != null) {
            purchaseIds.add(myPortfolio.getRepresentativePurchaseId());
        }
        Map<String, ProductPurchase> purchaseMap = purchaseIds.isEmpty()
                ? Map.of()
                : purchaseRepository.findAllById(purchaseIds).stream()
                        .collect(Collectors.toMap(ProductPurchase::getId, pp -> pp, (a, b) -> a));
        Set<String> productIds = purchaseMap.values().stream()
                .map(ProductPurchase::getProductId)
                .collect(Collectors.toSet());
        Map<String, QuantProduct> productMap = productIds.isEmpty()
                ? Map.of()
                : productRepository.findAllById(productIds).stream()
                        .collect(Collectors.toMap(QuantProduct::getId, qp -> qp, (a, b) -> a));

        List<RankingEntryDto> rankings = new ArrayList<>();
        for (Portfolio p : displayList) {
            rankings.add(buildRankingEntry(p, currentUserId, userMap, rankMap,
                    sortMap, totalCount, purchaseMap, productMap));
        }

        // 현재 유저가 페이지에 없으면 별도 myRanking 엔트리 생성
        RankingEntryDto myRankingEntry = null;
        if (myPortfolio != null) {
            myRankingEntry = buildRankingEntry(myPortfolio, currentUserId, userMap, rankMap,
                    sortMap, totalCount, purchaseMap, productMap);
        }

        return RankingResponseDto.builder()
                .rankingType(type)
                .snapshotDate(LocalDate.now().toString())
                .totalCount(totalCount)
                .page(page)
                .size(size)
                .totalPages((int) Math.ceil((double) totalCount / size))
                .avgReturn(Math.round(avgReturn * 100.0) / 100.0)
                .positiveCount(positiveCount)
                .negativeCount(negativeCount)
                .rankings(rankings)
                .myRanking(myRankingEntry)
                .build();
    }

    /**
     * 포트폴리오 → RankingEntryDto 변환 (공통 헬퍼)
     */
    private RankingEntryDto buildRankingEntry(Portfolio p, String currentUserId,
                                               Map<String, User> userMap, Map<String, Integer> rankMap,
                                               Map<String, Double> sortMap, int totalCount,
                                               Map<String, ProductPurchase> purchaseMap,
                                               Map<String, QuantProduct> productMap) {
        User user = userMap.get(p.getUserId());
        String nickname = (user != null && user.getName() != null) ? user.getName() : "익명";
        String email = (user != null && user.getEmail() != null) ? user.getEmail() : "";

        String routeName = null;
        String routeStrategyType = null;
        Double routeReturnRate = null;
        String routeDescription = null;

        if (p.getRepresentativePurchaseId() != null) {
            try {
                ProductPurchase purchase = purchaseMap.get(p.getRepresentativePurchaseId());
                if (purchase != null && purchase.getStatus() == ProductPurchase.Status.ACTIVE) {
                    routeName = purchase.getProductName();
                    QuantProduct product = productMap.get(purchase.getProductId());
                    if (product != null) {
                        routeStrategyType = product.getStrategyType() != null ? product.getStrategyType().name() : "SIMPLE";
                        routeDescription = product.getStrategyLogic();
                    }
                    routeReturnRate = getRouteReturnRate(p.getUserId(), p.getRepresentativePurchaseId());
                }
            } catch (Exception e) {
                log.debug("대표 항로 조회 실패: {}", p.getRepresentativePurchaseId());
            }
        }

        double displayReturn = sortMap != null
                ? sortMap.getOrDefault(p.getUserId(), 0.0)
                : p.getReturnRate().doubleValue();

        return RankingEntryDto.builder()
                .portfolioId(p.getId())
                .rank(rankMap.getOrDefault(p.getUserId(), totalCount + 1))
                .nickname(nickname)
                .portfolioName(email.contains("@") ? email.split("@")[0] + "의 포트폴리오" : nickname + "의 포트폴리오")
                .totalReturn(Math.round(displayReturn * 100.0) / 100.0)
                .totalValue(p.getTotalValue().doubleValue())
                .rankChange(0)
                .isMyRanking(p.getUserId().equals(currentUserId))
                .routeName(routeName)
                .routeStrategyType(routeStrategyType)
                .routeReturnRate(routeReturnRate)
                .routeDescription(routeDescription)
                .build();
    }

    /**
     * 기간별 수익률 변화 계산
     * 현재 수익률 - 기준일 수익률 = 해당 기간 수익률 변화
     */
    private Map<String, Double> calculatePeriodReturns(List<Portfolio> portfolios, String type) {
        LocalDate baseDate = switch (type) {
            case "daily" -> LocalDate.now().minusDays(1);
            case "weekly" -> LocalDate.now().minusWeeks(1);
            case "monthly" -> LocalDate.now().minusMonths(1);
            default -> null;
        };
        if (baseDate == null) return null;

        // 기준일 스냅샷 조회 (해당 날짜에 없으면 이전 날짜로 최대 3일 탐색)
        Map<String, Double> snapshotReturnMap = new HashMap<>();
        for (int attempt = 0; attempt < 4; attempt++) {
            LocalDate checkDate = baseDate.minusDays(attempt);
            List<PortfolioSnapshot> snapshots = snapshotRepository.findByDate(checkDate);
            for (PortfolioSnapshot s : snapshots) {
                if (!snapshotReturnMap.containsKey(s.getUserId())) {
                    snapshotReturnMap.put(s.getUserId(), s.getReturnRate().doubleValue());
                }
            }
            if (snapshotReturnMap.size() >= portfolios.size()) break;
        }

        // 현재 수익률 - 기준일 수익률
        Map<String, Double> periodReturns = new HashMap<>();
        for (Portfolio p : portfolios) {
            double currentReturn = p.getReturnRate().doubleValue();
            double baseReturn = snapshotReturnMap.getOrDefault(p.getUserId(), 0.0);
            periodReturns.put(p.getUserId(), currentReturn - baseReturn);
        }
        return periodReturns;
    }

    private Double getRouteReturnRate(String userId, String purchaseId) {
        try {
            List<PurchasePerformanceDto> perfs = quantStoreService.getMyPurchasesPerformance(userId);
            return perfs.stream()
                    .filter(p -> p.getPurchaseId().equals(purchaseId))
                    .findFirst()
                    .map(PurchasePerformanceDto::getTotalReturnRate)
                    .orElse(null);
        } catch (Exception e) {
            return null;
        }
    }

    public MyRankingDto getMyRanking(String userId) {
        RankingResponseDto all = getRankings(userId, "all", 0, MAX_RANKING_SIZE);
        RankingEntryDto mine = all.getRankings().stream()
                .filter(RankingEntryDto::isMyRanking)
                .findFirst()
                .orElse(null);

        if (mine == null) {
            portfolioService.getOrCreatePortfolio(userId);
            return MyRankingDto.builder()
                    .currentRank(all.getTotalCount() + 1)
                    .previousRank(0)
                    .totalReturn(0)
                    .totalValue(10_000_000)
                    .build();
        }

        return MyRankingDto.builder()
                .currentRank(mine.getRank())
                .previousRank(mine.getRank())
                .totalReturn(mine.getTotalReturn())
                .totalValue(mine.getTotalValue())
                .build();
    }

    /**
     * 포트폴리오 공개 요약 조회 (랭킹에서 클릭 시 — 프라이버시 보호)
     */
    public PortfolioDetailDto getPortfolioDetail(String portfolioId) {
        Portfolio portfolio = portfolioRepository.findById(portfolioId)
                .orElseThrow(() -> new IllegalArgumentException("포트폴리오를 찾을 수 없습니다."));

        User user = userRepository.findBySupabaseId(portfolio.getUserId()).orElse(null);
        String nickname = (user != null && user.getName() != null) ? user.getName() : "익명";
        String email = (user != null && user.getEmail() != null) ? user.getEmail() : "";
        String portfolioName = email.contains("@") ? email.split("@")[0] + "의 포트폴리오" : nickname + "의 포트폴리오";

        int rank = calculateRank(portfolio);
        BigDecimal initialCash = portfolio.getInitialCash();
        double initialCapital = (initialCash.compareTo(BigDecimal.ZERO) > 0)
                ? initialCash.doubleValue() : 10_000_000;
        double totalValue = portfolio.getTotalValue().doubleValue();
        double totalReturn = portfolio.getReturnRate().doubleValue();
        double totalReturnAmount = totalValue - initialCapital;

        int stockCount = (int) portfolio.getHoldings().stream().filter(h -> h.isStock()).count();
        int cryptoCount = portfolio.getHoldings().size() - stockCount;

        String routeName = null;
        String routeStrategyType = null;
        Double routeReturnRate = null;
        String routeDescription = null;

        if (portfolio.getRepresentativePurchaseId() != null) {
            try {
                var purchase = purchaseRepository.findById(portfolio.getRepresentativePurchaseId()).orElse(null);
                if (purchase != null && purchase.getStatus() == ProductPurchase.Status.ACTIVE) {
                    routeName = purchase.getProductName();
                    var product = productRepository.findById(purchase.getProductId()).orElse(null);
                    if (product != null) {
                        routeStrategyType = product.getStrategyType() != null ? product.getStrategyType().name() : "SIMPLE";
                        routeDescription = product.getStrategyLogic();
                    }
                    routeReturnRate = getRouteReturnRate(portfolio.getUserId(), portfolio.getRepresentativePurchaseId());
                }
            } catch (Exception e) {
                log.debug("대표 항로 조회 실패: {}", e.getMessage());
            }
        }

        return PortfolioDetailDto.builder()
                .portfolioId(portfolio.getId())
                .portfolioName(portfolioName)
                .nickname(nickname)
                .currentRank(rank)
                .totalReturn(Math.round(totalReturn * 100.0) / 100.0)
                .totalReturnAmount(Math.round(totalReturnAmount))
                .initialCapital(initialCapital)
                .totalValue(totalValue)
                .stockCount(stockCount)
                .cryptoCount(cryptoCount)
                .routeName(routeName)
                .routeStrategyType(routeStrategyType)
                .routeReturnRate(routeReturnRate)
                .routeDescription(routeDescription)
                .build();
    }

    private int calculateRank(Portfolio target) {
        BigDecimal targetRate = target.getReturnRate();
        long higherCount = portfolioRepository.findAll().stream()
                .filter(p -> p.getReturnRate().compareTo(targetRate) > 0)
                .count();
        return (int) higherCount + 1;
    }
}
