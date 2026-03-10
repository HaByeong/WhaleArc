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
import com.project.whalearc.trade.repository.PortfolioRepository;
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
    private final PortfolioService portfolioService;
    private final UserRepository userRepository;
    private final ProductPurchaseRepository purchaseRepository;
    private final QuantProductRepository productRepository;
    private final QuantStoreService quantStoreService;

    private static final int MAX_RANKING_SIZE = 100;

    public RankingResponseDto getRankings(String currentUserId) {
        List<Portfolio> allPortfolios = portfolioRepository.findAll();

        // 수익률 기준 정렬 (BigDecimal compareTo, reversed)
        List<Portfolio> sorted = allPortfolios.stream()
                .sorted((a, b) -> b.getReturnRate().compareTo(a.getReturnRate()))
                .toList();

        // 상위 N명 + 현재 유저 포함 보장
        List<Portfolio> displayList;
        if (sorted.size() <= MAX_RANKING_SIZE) {
            displayList = sorted;
        } else {
            Set<String> topUserIds = sorted.stream()
                    .limit(MAX_RANKING_SIZE)
                    .map(Portfolio::getUserId)
                    .collect(Collectors.toSet());
            // 현재 유저가 Top N 밖이면 추가
            if (!topUserIds.contains(currentUserId)) {
                displayList = new ArrayList<>(sorted.subList(0, MAX_RANKING_SIZE));
                sorted.stream()
                        .filter(p -> p.getUserId().equals(currentUserId))
                        .findFirst()
                        .ifPresent(displayList::add);
            } else {
                displayList = sorted.subList(0, MAX_RANKING_SIZE);
            }
        }

        // 표시 대상 유저 정보만 조회
        Set<String> displayUserIds = displayList.stream()
                .map(Portfolio::getUserId)
                .collect(Collectors.toSet());
        Map<String, User> userMap = userRepository.findAllBySupabaseIdIn(displayUserIds).stream()
                .collect(Collectors.toMap(User::getSupabaseId, u -> u, (a, b) -> a));

        // 전체 순위 맵 (정렬된 전체 목록 기준)
        Map<String, Integer> rankMap = new HashMap<>();
        for (int i = 0; i < sorted.size(); i++) {
            rankMap.put(sorted.get(i).getUserId(), i + 1);
        }

        List<RankingEntryDto> rankings = new ArrayList<>();
        for (Portfolio p : displayList) {
            User user = userMap.get(p.getUserId());
            String nickname = (user != null && user.getName() != null) ? user.getName() : "익명";
            String email = (user != null && user.getEmail() != null) ? user.getEmail() : "";

            // 대표 항로 정보
            String routeName = null;
            String routeStrategyType = null;
            Double routeReturnRate = null;
            String routeDescription = null;

            if (p.getRepresentativePurchaseId() != null) {
                try {
                    ProductPurchase purchase = purchaseRepository.findById(p.getRepresentativePurchaseId()).orElse(null);
                    if (purchase != null && purchase.getStatus() == ProductPurchase.Status.ACTIVE) {
                        routeName = purchase.getProductName();
                        QuantProduct product = productRepository.findById(purchase.getProductId()).orElse(null);
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

            double returnRate = p.getReturnRate().doubleValue();
            rankings.add(RankingEntryDto.builder()
                    .portfolioId(p.getId())
                    .rank(rankMap.getOrDefault(p.getUserId(), sorted.size() + 1))
                    .nickname(nickname)
                    .portfolioName(email.contains("@") ? email.split("@")[0] + "의 포트폴리오" : nickname + "의 포트폴리오")
                    .totalReturn(Math.round(returnRate * 100.0) / 100.0)
                    .totalValue(p.getTotalValue().doubleValue())
                    .rankChange(0)
                    .isMyRanking(p.getUserId().equals(currentUserId))
                    .routeName(routeName)
                    .routeStrategyType(routeStrategyType)
                    .routeReturnRate(routeReturnRate)
                    .routeDescription(routeDescription)
                    .build());
        }

        return RankingResponseDto.builder()
                .rankingType("all")
                .snapshotDate(LocalDate.now().toString())
                .totalCount(sorted.size())
                .rankings(rankings)
                .build();
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
        RankingResponseDto all = getRankings(userId);
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
     * 보유종목 상세, 거래 내역, 현금 잔고는 비공개
     */
    public PortfolioDetailDto getPortfolioDetail(String portfolioId) {
        Portfolio portfolio = portfolioRepository.findById(portfolioId)
                .orElseThrow(() -> new IllegalArgumentException("포트폴리오를 찾을 수 없습니다."));

        // 유저 정보
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

        // 종목 수만 공개
        int stockCount = (int) portfolio.getHoldings().stream().filter(h -> h.isStock()).count();
        int cryptoCount = portfolio.getHoldings().size() - stockCount;

        // 대표 항로 정보
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
