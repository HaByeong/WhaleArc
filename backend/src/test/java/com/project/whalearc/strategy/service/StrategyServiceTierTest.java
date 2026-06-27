package com.project.whalearc.strategy.service;

import com.project.whalearc.strategy.domain.Strategy;
import com.project.whalearc.strategy.dto.StrategyRequest;
import com.project.whalearc.strategy.repository.StrategyRepository;
import com.project.whalearc.user.domain.User;
import com.project.whalearc.user.policy.TierResolver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** 커스텀 빌더(BASIC+) + 저장 전략 개수(FREE 3 / BASIC 20 / PRO 무제한) 게이팅 검증. */
@ExtendWith(MockitoExtension.class)
class StrategyServiceTierTest {

    @Mock StrategyRepository strategyRepository;
    @Mock TierResolver tierResolver;
    private StrategyService service;

    @BeforeEach
    void setUp() {
        service = new StrategyService(strategyRepository, null, null, null, null, null, null, null, tierResolver);
    }

    private StrategyRequest req() {
        StrategyRequest r = new StrategyRequest();
        r.setName("내 전략");
        return r;
    }

    @Test
    void freeUserCannotUseCustomBuilder() {
        when(tierResolver.effectiveTier("u1")).thenReturn(User.Tier.FREE);
        IllegalArgumentException e = assertThrows(IllegalArgumentException.class,
                () -> service.createStrategy("u1", req()));
        assertTrue(e.getMessage().contains("Basic"));
        verify(strategyRepository, never()).save(any());
    }

    @Test
    void basicUserBlockedWhenAtSavedLimit() {
        when(tierResolver.effectiveTier("u1")).thenReturn(User.Tier.BASIC);
        when(strategyRepository.countByUserId("u1")).thenReturn(20L); // BASIC 한도=20 도달
        assertThrows(IllegalArgumentException.class, () -> service.createStrategy("u1", req()));
        verify(strategyRepository, never()).save(any());
    }

    @Test
    void basicUserUnderLimitSucceeds() {
        when(tierResolver.effectiveTier("u1")).thenReturn(User.Tier.BASIC);
        when(strategyRepository.countByUserId("u1")).thenReturn(5L);
        when(strategyRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        Strategy saved = service.createStrategy("u1", req());
        assertNotNull(saved);
        verify(strategyRepository).save(any());
    }

    @Test
    void proUserHasNoSavedLimit() {
        when(tierResolver.effectiveTier("u1")).thenReturn(User.Tier.PRO);
        when(strategyRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        // PRO는 countByUserId 조회 없이 통과
        assertNotNull(service.createStrategy("u1", req()));
        verify(strategyRepository, never()).countByUserId(any());
        verify(strategyRepository).save(any());
    }
}
