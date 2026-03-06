package com.project.whalearc.ranking.controller;

import com.project.whalearc.common.dto.ApiResponse;
import com.project.whalearc.ranking.dto.MyRankingDto;
import com.project.whalearc.ranking.dto.RankingResponseDto;
import com.project.whalearc.ranking.service.RankingService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/rankings")
@RequiredArgsConstructor
public class RankingController {

    private final RankingService rankingService;

    @GetMapping
    public ApiResponse<RankingResponseDto> getRankings(@AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();
        return ApiResponse.ok(rankingService.getRankings(userId));
    }

    @GetMapping("/me")
    public ApiResponse<MyRankingDto> getMyRanking(@AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();
        return ApiResponse.ok(rankingService.getMyRanking(userId));
    }
}
