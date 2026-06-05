package com.project.whalearc.strategy.controller;

import com.project.whalearc.common.dto.ApiResponse;
import com.project.whalearc.strategy.domain.Strategy;
import com.project.whalearc.strategy.dto.BacktestHistoryItemDto;
import com.project.whalearc.strategy.dto.BacktestRequest;
import com.project.whalearc.strategy.dto.BacktestResponse;
import com.project.whalearc.strategy.dto.StrategyRequest;
import com.project.whalearc.strategy.dto.StrategyResponse;
import com.project.whalearc.strategy.service.BacktestHistoryService;
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
    private final BacktestHistoryService backtestHistoryService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<StrategyResponse>>> getStrategies(@AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();
        List<StrategyResponse> strategies = strategyService.getUserStrategies(userId).stream()
                .map(StrategyResponse::from)
                .toList();
        return ResponseEntity.ok(ApiResponse.ok(strategies));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<StrategyResponse>> createStrategy(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody StrategyRequest request) {
        String userId = jwt.getSubject();
        Strategy created = strategyService.createStrategy(userId, request);
        return ResponseEntity.ok(ApiResponse.ok(StrategyResponse.from(created)));
    }

    @PutMapping("/{strategyId}")
    public ResponseEntity<ApiResponse<StrategyResponse>> updateStrategy(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String strategyId,
            @RequestBody StrategyRequest request) {
        String userId = jwt.getSubject();
        Strategy updated = strategyService.updateStrategy(userId, strategyId, request);
        return ResponseEntity.ok(ApiResponse.ok(StrategyResponse.from(updated)));
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
    public ResponseEntity<ApiResponse<?>> runBacktest(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody BacktestRequest request) {
        try {
            String userId = jwt.getSubject();
            BacktestResponse result = backtestService.runBacktest(request, userId);
            backtestHistoryService.save(userId, result); // 결과 서버 보관(자동, 실패해도 응답 유지)
            return ResponseEntity.ok(ApiResponse.ok(result));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        } catch (Exception e) {
            log.error("백테스팅 실행 실패: {}", e.getMessage());
            return ResponseEntity.internalServerError().body(ApiResponse.error("백테스팅 실행 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."));
        }
    }

    /** 저장된 백테스트 히스토리 목록 (요약). */
    @GetMapping("/backtest/history")
    public ResponseEntity<ApiResponse<List<BacktestHistoryItemDto>>> getBacktestHistory(@AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(ApiResponse.ok(backtestHistoryService.getHistory(jwt.getSubject())));
    }

    /** 저장된 백테스트 전체 결과 (상세 재표시용). */
    @GetMapping("/backtest/history/{id}")
    public ResponseEntity<ApiResponse<?>> getSavedBacktest(
            @AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
        try {
            return ResponseEntity.ok(ApiResponse.ok(backtestHistoryService.getSavedResult(jwt.getSubject(), id)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    /** 저장된 백테스트 삭제. */
    @DeleteMapping("/backtest/history/{id}")
    public ResponseEntity<Void> deleteSavedBacktest(
            @AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
        backtestHistoryService.delete(jwt.getSubject(), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{strategyId}/apply")
    public ResponseEntity<ApiResponse<?>> applyStrategy(
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
            return ResponseEntity.ok(ApiResponse.ok(StrategyResponse.from(applied)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @PostMapping("/{strategyId}/unapply")
    public ResponseEntity<ApiResponse<?>> unapplyStrategy(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String strategyId) {
        String userId = jwt.getSubject();
        try {
            Strategy unapplied = strategyService.unapplyStrategy(userId, strategyId);
            return ResponseEntity.ok(ApiResponse.ok(StrategyResponse.from(unapplied)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    /** VIRT 자동매매 ON/OFF — body: { enabled: boolean, amount?: number } */
    @PostMapping("/{strategyId}/auto-trade")
    public ResponseEntity<ApiResponse<?>> setAutoTrading(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String strategyId,
            @RequestBody Map<String, Object> body) {
        String userId = jwt.getSubject();
        boolean enabled = Boolean.TRUE.equals(body.get("enabled"));
        Object rawAmount = body.get("amount");
        java.math.BigDecimal amount = (rawAmount instanceof Number)
                ? java.math.BigDecimal.valueOf(((Number) rawAmount).doubleValue()) : null;
        try {
            Strategy updated = strategyService.setAutoTrading(userId, strategyId, enabled, amount);
            return ResponseEntity.ok(ApiResponse.ok(StrategyResponse.from(updated)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }
}
