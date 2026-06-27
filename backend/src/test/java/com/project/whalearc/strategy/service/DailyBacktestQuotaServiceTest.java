package com.project.whalearc.strategy.service;

import com.project.whalearc.user.policy.TierPolicy;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;

/** 일일 쿼터 소비·리셋 검증. */
class DailyBacktestQuotaServiceTest {

    @Test
    void consumesUpToLimitThenBlocks() {
        DailyBacktestQuotaService q = new DailyBacktestQuotaService(() -> LocalDate.of(2026, 6, 22));
        assertTrue(q.tryConsume("u1", 2));
        assertTrue(q.tryConsume("u1", 2));
        assertFalse(q.tryConsume("u1", 2)); // 3회째 차단
    }

    @Test
    void unlimitedAlwaysPasses() {
        DailyBacktestQuotaService q = new DailyBacktestQuotaService(() -> LocalDate.of(2026, 6, 22));
        for (int i = 0; i < 1000; i++) {
            assertTrue(q.tryConsume("u1", TierPolicy.UNLIMITED));
        }
    }

    @Test
    void countersAreIndependentPerUser() {
        DailyBacktestQuotaService q = new DailyBacktestQuotaService(() -> LocalDate.of(2026, 6, 22));
        assertTrue(q.tryConsume("u1", 1));
        assertFalse(q.tryConsume("u1", 1));
        assertTrue(q.tryConsume("u2", 1)); // 다른 유저는 영향 없음
    }

    @Test
    void resetsWhenDayChanges() {
        AtomicReference<LocalDate> day = new AtomicReference<>(LocalDate.of(2026, 6, 22));
        DailyBacktestQuotaService q = new DailyBacktestQuotaService(day::get);
        assertTrue(q.tryConsume("u1", 1));
        assertFalse(q.tryConsume("u1", 1)); // 한도 소진
        day.set(LocalDate.of(2026, 6, 23));  // 날짜 변경
        assertTrue(q.tryConsume("u1", 1));   // 리셋되어 다시 통과
    }
}
