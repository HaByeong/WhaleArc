package com.project.whalearc.strategy.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.project.whalearc.strategy.domain.SavedBacktest;
import com.project.whalearc.strategy.dto.BacktestHistoryItemDto;
import com.project.whalearc.strategy.dto.BacktestResponse;
import com.project.whalearc.strategy.repository.SavedBacktestRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

/**
 * 백테스트 결과 서버 보관 — 사용자가 실행한 백테스트를 저장하고(자동), 목록·상세·삭제를 제공한다.
 * 사용자당 최근 {@value #MAX_PER_USER}개만 유지(초과분 오래된 것부터 삭제).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BacktestHistoryService {

    private static final int MAX_PER_USER = 30;

    private final SavedBacktestRepository repository;
    private final ObjectMapper objectMapper;

    /** 백테스트 결과 저장 — 실패해도 백테스트 응답을 막지 않도록 예외를 삼킨다. */
    public void save(String userId, BacktestResponse result) {
        if (userId == null || result == null) return;
        try {
            SavedBacktest s = new SavedBacktest();
            s.setUserId(userId);
            s.setStrategyName(result.getStrategyName());
            s.setStockCode(result.getStockCode());
            s.setStockName(result.getStockName());
            s.setStartDate(result.getStartDate());
            s.setEndDate(result.getEndDate());
            s.setTotalReturnRate(result.getTotalReturnRate());
            s.setSharpeRatio(result.getSharpeRatio());
            s.setMaxDrawdown(result.getMaxDrawdown());
            s.setTotalTrades(result.getTotalTrades());
            s.setWinRate(result.getWinRate());
            s.setResultJson(objectMapper.writeValueAsString(result));
            s.setCreatedAt(Instant.now());
            repository.save(s);
            prune(userId);
        } catch (Exception e) {
            log.warn("백테스트 결과 저장 실패(무시): userId={}, {}", userId, e.getMessage());
        }
    }

    private void prune(String userId) {
        List<SavedBacktest> all = repository.findByUserIdOrderByCreatedAtDesc(userId);
        if (all.size() > MAX_PER_USER) {
            repository.deleteAll(all.subList(MAX_PER_USER, all.size()));
        }
    }

    public List<BacktestHistoryItemDto> getHistory(String userId) {
        return repository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(BacktestHistoryItemDto::from)
                .toList();
    }

    /** 저장된 백테스트 전체 결과(JSON 파싱 객체) 반환 — 소유권 확인. */
    public Object getSavedResult(String userId, String id) {
        SavedBacktest s = repository.findById(id)
                .filter(x -> userId.equals(x.getUserId()))
                .orElseThrow(() -> new IllegalArgumentException("저장된 백테스트를 찾을 수 없습니다."));
        try {
            return objectMapper.readValue(s.getResultJson(), Object.class);
        } catch (Exception e) {
            throw new IllegalStateException("백테스트 결과를 불러올 수 없습니다.");
        }
    }

    public void delete(String userId, String id) {
        repository.findById(id)
                .filter(x -> userId.equals(x.getUserId()))
                .ifPresent(repository::delete);
    }
}
