package com.project.whalearc.ranking.service;

import com.project.whalearc.ranking.dto.MyRankingDto;
import com.project.whalearc.ranking.dto.RankingEntryDto;
import com.project.whalearc.ranking.dto.RankingResponseDto;
import com.project.whalearc.trade.domain.Portfolio;
import com.project.whalearc.trade.repository.PortfolioRepository;
import com.project.whalearc.trade.service.PortfolioService;
import com.project.whalearc.user.domain.User;
import com.project.whalearc.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RankingService {

    private final PortfolioRepository portfolioRepository;
    private final PortfolioService portfolioService;
    private final UserRepository userRepository;

    public RankingResponseDto getRankings(String currentUserId) {
        List<Portfolio> allPortfolios = portfolioRepository.findAll();

        // 유저 정보 맵 (supabaseId -> User)
        Map<String, User> userMap = userRepository.findAll().stream()
                .collect(Collectors.toMap(User::getSupabaseId, u -> u, (a, b) -> a));

        // 수익률 기준 내림차순 정렬
        List<Portfolio> sorted = allPortfolios.stream()
                .sorted(Comparator.comparingDouble(Portfolio::getReturnRate).reversed())
                .toList();

        List<RankingEntryDto> rankings = new java.util.ArrayList<>();
        for (int i = 0; i < sorted.size(); i++) {
            Portfolio p = sorted.get(i);
            User user = userMap.get(p.getUserId());
            String nickname = (user != null && user.getName() != null) ? user.getName() : "익명";
            String email = (user != null && user.getEmail() != null) ? user.getEmail() : "";

            rankings.add(RankingEntryDto.builder()
                    .portfolioId(p.getId())
                    .rank(i + 1)
                    .nickname(nickname)
                    .portfolioName(email.contains("@") ? email.split("@")[0] + "의 포트폴리오" : nickname + "의 포트폴리오")
                    .totalReturn(Math.round(p.getReturnRate() * 100.0) / 100.0)
                    .totalValue(p.getTotalValue())
                    .rankChange(0)
                    .isMyRanking(p.getUserId().equals(currentUserId))
                    .build());
        }

        return RankingResponseDto.builder()
                .rankingType("all")
                .snapshotDate(LocalDate.now().toString())
                .totalCount(rankings.size())
                .rankings(rankings)
                .build();
    }

    public MyRankingDto getMyRanking(String userId) {
        RankingResponseDto all = getRankings(userId);
        RankingEntryDto mine = all.getRankings().stream()
                .filter(RankingEntryDto::isMyRanking)
                .findFirst()
                .orElse(null);

        if (mine == null) {
            // 포트폴리오가 없으면 생성 후 다시 조회
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
