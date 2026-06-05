package com.project.whalearc.strategy.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.project.whalearc.strategy.domain.SavedBacktest;
import com.project.whalearc.strategy.dto.BacktestHistoryItemDto;
import com.project.whalearc.strategy.dto.BacktestResponse;
import com.project.whalearc.strategy.repository.SavedBacktestRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * 백테스트 결과 서버 저장 서비스 로직 검증:
 *  - 저장: 요약 컬럼 + 전체결과 JSON 보관 / 사용자당 30개 초과 프룬
 *  - 상세: JSON 라운드트립 + 소유권 확인
 *  - 삭제: 소유자만 / 목록: 요약 매핑
 */
@ExtendWith(MockitoExtension.class)
class BacktestHistoryServiceTest {

    @Mock SavedBacktestRepository repo;
    private final ObjectMapper om = new ObjectMapper();
    private BacktestHistoryService service;

    @BeforeEach
    void setUp() {
        service = new BacktestHistoryService(repo, om);
    }

    private BacktestResponse sample(String name, double ret) {
        return BacktestResponse.builder()
                .strategyName(name).stockCode("BTC").stockName("비트코인")
                .startDate("2024-01-01").endDate("2024-06-30")
                .totalReturnRate(ret).sharpeRatio(1.2).maxDrawdown(8.0).totalTrades(5)
                .build();
    }

    @Test
    void save_persistsSummaryAndJson() {
        when(repo.findByUserIdOrderByCreatedAtDesc("u1")).thenReturn(List.of()); // 프룬: 초과 없음

        service.save("u1", sample("골든크로스", 12.5));

        ArgumentCaptor<SavedBacktest> cap = ArgumentCaptor.forClass(SavedBacktest.class);
        verify(repo).save(cap.capture());
        SavedBacktest s = cap.getValue();
        assertEquals("u1", s.getUserId());
        assertEquals("골든크로스", s.getStrategyName());
        assertEquals(12.5, s.getTotalReturnRate());
        assertEquals(5, s.getTotalTrades());
        assertNotNull(s.getCreatedAt());
        assertNotNull(s.getResultJson());
        assertTrue(s.getResultJson().contains("골든크로스"), "전체 결과가 JSON으로 직렬화됨");
    }

    @Test
    void save_prunesBeyondThirty() {
        List<SavedBacktest> existing = new ArrayList<>();
        for (int i = 0; i < 31; i++) { SavedBacktest s = new SavedBacktest(); s.setUserId("u1"); existing.add(s); }
        when(repo.findByUserIdOrderByCreatedAtDesc("u1")).thenReturn(existing);

        service.save("u1", sample("x", 1.0));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<SavedBacktest>> del = ArgumentCaptor.forClass(List.class);
        verify(repo).deleteAll(del.capture());
        assertEquals(1, del.getValue().size(), "30개 초과분 1개 삭제");
    }

    @Test
    void save_failureIsSwallowed_neverThrows() {
        when(repo.save(any())).thenThrow(new RuntimeException("DB down")); // save에서 바로 throw → prune 미도달
        // 저장 실패가 백테스트 응답을 막지 않도록 예외를 삼켜야 함
        assertDoesNotThrow(() -> service.save("u1", sample("x", 1.0)));
    }

    @Test
    void getSavedResult_roundTripsJson_andEnforcesOwnership() throws Exception {
        BacktestResponse r = sample("RSI 반전", 5.5);
        SavedBacktest s = new SavedBacktest();
        s.setId("id1"); s.setUserId("u1"); s.setResultJson(om.writeValueAsString(r));
        when(repo.findById("id1")).thenReturn(Optional.of(s));

        Object result = service.getSavedResult("u1", "id1");
        assertTrue(result instanceof Map, "JSON → 객체(Map)로 파싱");
        assertEquals("RSI 반전", ((Map<?, ?>) result).get("strategyName"), "라운드트립 일치");

        // 다른 유저는 접근 불가 (소유권)
        assertThrows(IllegalArgumentException.class, () -> service.getSavedResult("other", "id1"));
    }

    @Test
    void delete_onlyOwnerCanDelete() {
        SavedBacktest s = new SavedBacktest();
        s.setId("id1"); s.setUserId("u1");
        when(repo.findById("id1")).thenReturn(Optional.of(s));

        service.delete("other", "id1");
        verify(repo, never()).delete(any()); // 타인은 삭제 불가

        service.delete("u1", "id1");
        verify(repo).delete(s); // 소유자는 삭제
    }

    @Test
    void getHistory_mapsToSummaries() {
        SavedBacktest s = new SavedBacktest();
        s.setId("id1"); s.setUserId("u1"); s.setStrategyName("터틀"); s.setTotalReturnRate(3.3);
        s.setStockCode("ETH"); s.setCreatedAt(Instant.now());
        when(repo.findByUserIdOrderByCreatedAtDesc("u1")).thenReturn(List.of(s));

        List<BacktestHistoryItemDto> hist = service.getHistory("u1");
        assertEquals(1, hist.size());
        assertEquals("id1", hist.get(0).getId());
        assertEquals("터틀", hist.get(0).getStrategyName());
        assertEquals("ETH", hist.get(0).getStockCode());
        assertTrue(hist.get(0).getCreatedAt() > 0, "createdAt epoch 변환");
    }
}
