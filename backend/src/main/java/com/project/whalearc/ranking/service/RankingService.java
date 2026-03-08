package com.project.whalearc.ranking.service;

import com.project.whalearc.ranking.dto.MyRankingDto;
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

    public RankingResponseDto getRankings(String currentUserId) {
        List<Portfolio> allPortfolios = portfolioRepository.findAll();

        Map<String, User> userMap = userRepository.findAll().stream()
                .collect(Collectors.toMap(User::getSupabaseId, u -> u, (a, b) -> a));

        List<Portfolio> sorted = allPortfolios.stream()
                .sorted(Comparator.comparingDouble(Portfolio::getReturnRate).reversed())
                .toList();

        List<RankingEntryDto> rankings = new ArrayList<>();
        for (int i = 0; i < sorted.size(); i++) {
            Portfolio p = sorted.get(i);
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

            rankings.add(RankingEntryDto.builder()
                    .portfolioId(p.getId())
                    .rank(i + 1)
                    .nickname(nickname)
                    .portfolioName(email.contains("@") ? email.split("@")[0] + "의 포트폴리오" : nickname + "의 포트폴리오")
                    .totalReturn(Math.round(p.getReturnRate() * 100.0) / 100.0)
                    .totalValue(p.getTotalValue())
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
                .totalCount(rankings.size())
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
}
