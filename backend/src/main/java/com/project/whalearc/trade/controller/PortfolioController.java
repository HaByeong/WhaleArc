package com.project.whalearc.trade.controller;

import com.project.whalearc.common.dto.ApiResponse;
import com.project.whalearc.trade.domain.Portfolio;
import com.project.whalearc.trade.domain.PortfolioSnapshot;
import com.project.whalearc.trade.repository.PortfolioSnapshotRepository;
import com.project.whalearc.trade.service.PortfolioService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/portfolio")
@RequiredArgsConstructor
public class PortfolioController {

    private final PortfolioService portfolioService;
    private final PortfolioSnapshotRepository snapshotRepository;

    @GetMapping
    public ApiResponse<Portfolio> getPortfolio(@AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();
        Portfolio portfolio = portfolioService.getOrCreatePortfolio(userId);
        return ApiResponse.ok(portfolio);
    }

    @PutMapping("/representative-route")
    public ApiResponse<Void> setRepresentativeRoute(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody Map<String, String> body) {
        String userId = jwt.getSubject();
        String purchaseId = body.get("purchaseId"); // null이면 해제
        Portfolio portfolio = portfolioService.getOrCreatePortfolio(userId);
        portfolio.setRepresentativePurchaseId(purchaseId);
        portfolioService.save(portfolio);
        return ApiResponse.ok(null);
    }

    @GetMapping("/history")
    public ApiResponse<List<PortfolioSnapshot>> getHistory(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "30") int days) {
        String userId = jwt.getSubject();
        LocalDate from = LocalDate.now(ZoneId.of("Asia/Seoul")).minusDays(days);
        LocalDate to = LocalDate.now(ZoneId.of("Asia/Seoul"));
        List<PortfolioSnapshot> snapshots =
                snapshotRepository.findByUserIdAndDateBetweenOrderByDateAsc(userId, from, to);
        return ApiResponse.ok(snapshots);
    }
}
