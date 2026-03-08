package com.project.whalearc.strategy.controller;

import com.project.whalearc.strategy.domain.Strategy;
import com.project.whalearc.strategy.dto.StrategyRequest;
import com.project.whalearc.strategy.dto.StrategyResponse;
import com.project.whalearc.strategy.service.StrategyService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/strategies")
@RequiredArgsConstructor
public class StrategyController {

    private final StrategyService strategyService;

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
}
