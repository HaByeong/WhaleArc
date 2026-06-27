package com.project.whalearc.strategy.service;

import com.project.whalearc.strategy.dto.BacktestRequest;
import com.project.whalearc.user.domain.User;
import com.project.whalearc.user.policy.TierPolicy;
import com.project.whalearc.user.policy.TierResolver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** 백테스트 등급 한도(기간·포지션·고급전략) + 일일 쿼터 게이팅 검증. 무거운 시뮬레이션을 피해 게이트 메서드를 직접 검증. */
@ExtendWith(MockitoExtension.class)
class BacktestServiceTierTest {

    @Mock TierResolver tierResolver;
    @Mock DailyBacktestQuotaService quota;
    @Mock MomentumRotationBacktestService momentum;
    private BacktestService service;

    @BeforeEach
    void setUp() {
        service = new BacktestService(null, null, null, null, null, null, momentum, tierResolver, quota);
    }

    private BacktestRequest req(String start, String end) {
        BacktestRequest r = new BacktestRequest();
        r.setStartDate(start);
        r.setEndDate(end);
        return r;
    }

    // ── 게이트 메서드 직접 검증 (데이터 fetch 없음) ──

    @Test
    void freeBlockedOnPeriodOverOneYear() {
        BacktestRequest r = req("2024-01-01", "2026-01-01"); // 2년
        IllegalArgumentException e = assertThrows(IllegalArgumentException.class,
                () -> service.enforceBacktestTierLimits(r, User.Tier.FREE));
        assertTrue(e.getMessage().contains("기간"));
    }

    @Test
    void proHasUnlimitedPeriod() {
        BacktestRequest r = req("2010-01-01", "2026-01-01"); // 16년
        assertDoesNotThrow(() -> service.enforceBacktestTierLimits(r, User.Tier.PRO));
    }

    @Test
    void freeBlockedOnMultiPositions() {
        BacktestRequest r = req("2025-09-01", "2026-01-01"); // 기간은 1년 이내
        r.setMaxPositions(5);
        IllegalArgumentException e = assertThrows(IllegalArgumentException.class,
                () -> service.enforceBacktestTierLimits(r, User.Tier.FREE));
        assertTrue(e.getMessage().contains("포지션"));
    }

    @Test
    void basicAllowsFivePositions() {
        BacktestRequest r = req("2022-01-01", "2026-01-01"); // 4년 ≤ BASIC 5년
        r.setMaxPositions(5);
        assertDoesNotThrow(() -> service.enforceBacktestTierLimits(r, User.Tier.BASIC));
    }

    @Test
    void freeBlockedOnSecondAsset() {
        BacktestRequest r = req("2025-09-01", "2026-01-01");
        r.setSecondStockCode("005930");
        assertThrows(IllegalArgumentException.class,
                () -> service.enforceBacktestTierLimits(r, User.Tier.FREE));
    }

    @Test
    void nonProBlockedOnAdvancedStrategy() {
        BacktestRequest r = req("2025-09-01", "2026-01-01");
        r.setStrategyType("MOMENTUM_ROTATION");
        IllegalArgumentException e = assertThrows(IllegalArgumentException.class,
                () -> service.enforceBacktestTierLimits(r, User.Tier.BASIC));
        assertTrue(e.getMessage().contains("Pro"));
    }

    // ── runBacktest 레벨: 쿼터 통합 ──

    @Test
    void quotaExhaustedBlocksAndAdvancedNotReached() {
        when(tierResolver.effectiveTier("u1")).thenReturn(User.Tier.FREE);
        when(quota.tryConsume(eq("u1"), anyInt())).thenReturn(false);
        BacktestRequest r = req("2025-09-01", "2026-01-01"); // 게이트는 통과하는 유효 요청
        IllegalArgumentException e = assertThrows(IllegalArgumentException.class,
                () -> service.runBacktest(r, "u1"));
        assertTrue(e.getMessage().contains("한도"));
        verifyNoInteractions(momentum); // 위임까지 가지 않음
    }

    @Test
    void invalidRequestDoesNotConsumeQuota() {
        when(tierResolver.effectiveTier("u1")).thenReturn(User.Tier.FREE);
        BacktestRequest r = req("2024-01-01", "2026-01-01"); // 기간 초과 → 게이트에서 차단
        assertThrows(IllegalArgumentException.class, () -> service.runBacktest(r, "u1"));
        verify(quota, never()).tryConsume(any(), anyInt()); // 무효 요청은 쿼터 미차감
    }
}
