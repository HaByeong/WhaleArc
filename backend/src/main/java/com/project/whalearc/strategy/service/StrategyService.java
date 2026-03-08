package com.project.whalearc.strategy.service;

import com.project.whalearc.strategy.domain.Strategy;
import com.project.whalearc.strategy.dto.StrategyRequest;
import com.project.whalearc.strategy.repository.StrategyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class StrategyService {

    private final StrategyRepository strategyRepository;

    public List<Strategy> getUserStrategies(String userId) {
        return strategyRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    public Strategy createStrategy(String userId, StrategyRequest request) {
        Strategy strategy = new Strategy(
                userId,
                request.getName(),
                request.getDescription(),
                request.getIndicators(),
                request.getEntryConditions(),
                request.getExitConditions()
        );
        return strategyRepository.save(strategy);
    }

    public Strategy updateStrategy(String userId, String strategyId, StrategyRequest request) {
        Strategy strategy = strategyRepository.findById(strategyId)
                .orElseThrow(() -> new IllegalArgumentException("전략을 찾을 수 없습니다."));

        if (!strategy.getUserId().equals(userId)) {
            throw new IllegalArgumentException("본인의 전략만 수정할 수 있습니다.");
        }

        if (request.getName() != null) strategy.setName(request.getName());
        if (request.getDescription() != null) strategy.setDescription(request.getDescription());
        if (request.getIndicators() != null) strategy.setIndicators(request.getIndicators());
        if (request.getEntryConditions() != null) strategy.setEntryConditions(request.getEntryConditions());
        if (request.getExitConditions() != null) strategy.setExitConditions(request.getExitConditions());
        strategy.setUpdatedAt(Instant.now());

        return strategyRepository.save(strategy);
    }

    public void deleteStrategy(String userId, String strategyId) {
        Strategy strategy = strategyRepository.findById(strategyId)
                .orElseThrow(() -> new IllegalArgumentException("전략을 찾을 수 없습니다."));

        if (!strategy.getUserId().equals(userId)) {
            throw new IllegalArgumentException("본인의 전략만 삭제할 수 있습니다.");
        }

        strategyRepository.delete(strategy);
    }
}
