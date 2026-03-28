package com.project.whalearc.strategy.controller;

import com.project.whalearc.strategy.domain.Strategy;
import com.project.whalearc.strategy.dto.BacktestRequest;
import com.project.whalearc.strategy.dto.BacktestResponse;
import com.project.whalearc.strategy.dto.StrategyRequest;
import com.project.whalearc.strategy.dto.StrategyResponse;
import com.project.whalearc.strategy.service.BacktestService;
import com.project.whalearc.strategy.service.StrategyService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/strategies")
@RequiredArgsConstructor
public class StrategyController {

    private final StrategyService strategyService;
    private final BacktestService backtestService;

    @GetMapping
    public ResponseEntity<Map<String, Object>> getStrategies(@AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();
        List<StrategyResponse> strategies = strategyService.getUserStrategies(userId).stream()
                .map(StrategyResponse::from)
                .toList();
        return ResponseEntity.ok(Map.of("data", strategies));
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> createStrategy(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody StrategyRequest request) {
        String userId = jwt.getSubject();
        Strategy created = strategyService.createStrategy(userId, request);
        return ResponseEntity.ok(Map.of("data", StrategyResponse.from(created)));
    }

    @PutMapping("/{strategyId}")
    public ResponseEntity<Map<String, Object>> updateStrategy(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String strategyId,
            @RequestBody StrategyRequest request) {
        String userId = jwt.getSubject();
        Strategy updated = strategyService.updateStrategy(userId, strategyId, request);
        return ResponseEntity.ok(Map.of("data", StrategyResponse.from(updated)));
    }

    @DeleteMapping("/{strategyId}")
    public ResponseEntity<Void> deleteStrategy(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String strategyId) {
        String userId = jwt.getSubject();
        strategyService.deleteStrategy(userId, strategyId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/backtest")
    public ResponseEntity<?> runBacktest(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody BacktestRequest request) {
        try {
            String userId = jwt.getSubject();
            BacktestResponse result = backtestService.runBacktest(request, userId);
            return ResponseEntity.ok(Map.of("data", result));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("백테스팅 실행 실패: {}", e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of("error", "백테스팅 실행 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."));
        }
    }

    @PostMapping("/{strategyId}/apply")
    public ResponseEntity<Map<String, Object>> applyStrategy(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String strategyId,
            @RequestBody Map<String, Object> body) {
        String userId = jwt.getSubject();
        Object rawAmount = body.get("investmentAmount");
        java.math.BigDecimal investmentAmount = (rawAmount instanceof Number)
                ? java.math.BigDecimal.valueOf(((Number) rawAmount).doubleValue())
                : java.math.BigDecimal.ZERO;
        try {
            Strategy applied = strategyService.applyStrategy(userId, strategyId, investmentAmount);
            return ResponseEntity.ok(Map.of("data", StrategyResponse.from(applied)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/{strategyId}/unapply")
    public ResponseEntity<Map<String, Object>> unapplyStrategy(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String strategyId) {
        String userId = jwt.getSubject();
        try {
            Strategy unapplied = strategyService.unapplyStrategy(userId, strategyId);
            return ResponseEntity.ok(Map.of("data", StrategyResponse.from(unapplied)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
