package com.project.whalearc.ranking.controller;

import com.project.whalearc.common.dto.ApiResponse;
import com.project.whalearc.ranking.dto.MyRankingDto;
import com.project.whalearc.ranking.dto.PortfolioDetailDto;
import com.project.whalearc.ranking.dto.RankingResponseDto;
import com.project.whalearc.ranking.service.RankingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/rankings")
@RequiredArgsConstructor
public class RankingController {

    private final RankingService rankingService;

    @GetMapping
    public ApiResponse<RankingResponseDto> getRankings(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "all") String type,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        String userId = jwt.getSubject();
        return ApiResponse.ok(rankingService.getRankings(userId, type, page, size));
    }

    @GetMapping("/me")
    public ApiResponse<MyRankingDto> getMyRanking(@AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();
        return ApiResponse.ok(rankingService.getMyRanking(userId));
    }

    @GetMapping("/portfolios/{portfolioId}")
    public ResponseEntity<ApiResponse<PortfolioDetailDto>> getPortfolioDetail(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String portfolioId) {
        if (jwt == null) {
            return ResponseEntity.status(401).body(ApiResponse.error("로그인이 필요합니다."));
        }
        try {
            return ResponseEntity.ok(ApiResponse.ok(rankingService.getPortfolioDetail(portfolioId)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(404).body(ApiResponse.error("포트폴리오를 찾을 수 없습니다."));
        } catch (Exception e) {
            log.error("포트폴리오 상세 조회 실패 [{}]: {}", portfolioId, e.getMessage());
            return ResponseEntity.status(500).body(ApiResponse.error("포트폴리오 조회 중 오류가 발생했습니다."));
        }
    }
}
