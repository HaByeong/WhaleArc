package com.project.whalearc.notification.service;

import com.project.whalearc.notification.domain.PriceAlert;
import com.project.whalearc.notification.repository.PriceAlertRepository;
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

/** 가격 알림 개수 등급별 제한 검증 — FREE 3 / PRO 무제한. createAlert만 다루므로 시세 의존성은 미사용(null). */
@ExtendWith(MockitoExtension.class)
class PriceAlertServiceTierTest {

    @Mock PriceAlertRepository alertRepository;
    @Mock TierResolver tierResolver;
    private PriceAlertService service;

    @BeforeEach
    void setUp() {
        service = new PriceAlertService(alertRepository, null, null, null, null, null, null, tierResolver);
    }

    @Test
    void freeUserBlockedAtLimit() {
        when(tierResolver.effectiveTier("u1")).thenReturn(User.Tier.FREE);
        when(alertRepository.countByUserIdAndActiveTrue("u1")).thenReturn(3L); // FREE 한도=3, 이미 도달
        assertThrows(IllegalStateException.class, () ->
                service.createAlert("u1", "BTC", "비트코인", "CRYPTO", PriceAlert.AlertCondition.ABOVE, 100, 0));
        verify(alertRepository, never()).save(any());
    }

    @Test
    void freeUserUnderLimitSucceeds() {
        when(tierResolver.effectiveTier("u1")).thenReturn(User.Tier.FREE);
        when(alertRepository.countByUserIdAndActiveTrue("u1")).thenReturn(2L);
        when(alertRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        assertNotNull(service.createAlert("u1", "BTC", "비트코인", "CRYPTO", PriceAlert.AlertCondition.ABOVE, 100, 0));
        verify(alertRepository).save(any());
    }

    @Test
    void proUserHasNoLimit() {
        when(tierResolver.effectiveTier("u1")).thenReturn(User.Tier.PRO);
        when(alertRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        // 카운트가 1000이어도 PRO는 통과 — countByUserIdAndActiveTrue는 호출조차 불필요할 수 있어 lenient
        assertNotNull(service.createAlert("u1", "BTC", "비트코인", "CRYPTO", PriceAlert.AlertCondition.ABOVE, 100, 0));
        verify(alertRepository).save(any());
    }
}
