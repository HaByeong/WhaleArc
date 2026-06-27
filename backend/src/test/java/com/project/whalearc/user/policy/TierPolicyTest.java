package com.project.whalearc.user.policy;

import com.project.whalearc.user.domain.User.Tier;
import org.junit.jupiter.api.Test;

import static com.project.whalearc.user.policy.TierPolicy.UNLIMITED;
import static org.junit.jupiter.api.Assertions.*;

/** 등급별 한도 테이블 검증 — FREE < BASIC < PRO 순서대로 커지고 PRO는 무제한. */
class TierPolicyTest {

    @Test
    void backtestYears() {
        assertEquals(1, TierPolicy.maxBacktestYears(Tier.FREE));
        assertEquals(5, TierPolicy.maxBacktestYears(Tier.BASIC));
        assertEquals(UNLIMITED, TierPolicy.maxBacktestYears(Tier.PRO));
    }

    @Test
    void backtestPositions() {
        assertEquals(1, TierPolicy.maxBacktestPositions(Tier.FREE));
        assertEquals(5, TierPolicy.maxBacktestPositions(Tier.BASIC));
        assertEquals(UNLIMITED, TierPolicy.maxBacktestPositions(Tier.PRO));
    }

    @Test
    void dailyBacktestQuota() {
        assertEquals(10, TierPolicy.dailyBacktestQuota(Tier.FREE));
        assertEquals(100, TierPolicy.dailyBacktestQuota(Tier.BASIC));
        assertEquals(UNLIMITED, TierPolicy.dailyBacktestQuota(Tier.PRO));
    }

    @Test
    void savedStrategies() {
        assertEquals(3, TierPolicy.maxSavedStrategies(Tier.FREE));
        assertEquals(20, TierPolicy.maxSavedStrategies(Tier.BASIC));
        assertEquals(UNLIMITED, TierPolicy.maxSavedStrategies(Tier.PRO));
    }

    @Test
    void alerts() {
        assertEquals(3, TierPolicy.maxAlerts(Tier.FREE));
        assertEquals(20, TierPolicy.maxAlerts(Tier.BASIC));
        assertEquals(UNLIMITED, TierPolicy.maxAlerts(Tier.PRO));
    }

    @Test
    void liveStrategiesAndSymbols() {
        assertEquals(0, TierPolicy.maxLiveStrategies(Tier.FREE));
        assertEquals(1, TierPolicy.maxLiveStrategies(Tier.BASIC));
        assertEquals(UNLIMITED, TierPolicy.maxLiveStrategies(Tier.PRO));
        assertEquals(0, TierPolicy.maxLiveSymbols(Tier.FREE));
        assertEquals(3, TierPolicy.maxLiveSymbols(Tier.BASIC));
        assertEquals(UNLIMITED, TierPolicy.maxLiveSymbols(Tier.PRO));
    }

    @Test
    void advancedStrategyIsProOnly() {
        assertFalse(TierPolicy.canUseAdvancedStrategy(Tier.FREE));
        assertFalse(TierPolicy.canUseAdvancedStrategy(Tier.BASIC));
        assertTrue(TierPolicy.canUseAdvancedStrategy(Tier.PRO));
    }

    @Test
    void customBuilderIsBasicAndAbove() {
        assertFalse(TierPolicy.canUseCustomBuilder(Tier.FREE));
        assertTrue(TierPolicy.canUseCustomBuilder(Tier.BASIC));
        assertTrue(TierPolicy.canUseCustomBuilder(Tier.PRO));
    }

    @Test
    void nullTierTreatedAsFree() {
        assertEquals(1, TierPolicy.maxBacktestYears(null));
        assertFalse(TierPolicy.canUseCustomBuilder(null));
    }
}
