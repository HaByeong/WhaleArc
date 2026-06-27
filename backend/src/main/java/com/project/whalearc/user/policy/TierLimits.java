package com.project.whalearc.user.policy;

import com.project.whalearc.user.domain.User;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 유저 유효 등급 기준 기능 한도 묶음 — 프론트 사전 게이팅(잠금 배지·비활성화·한도 표시)용 단일 출처.
 *
 * <p>프론트가 정책을 미러링하지 않고 이 값을 그대로 소비한다. <b>무제한은 {@code -1}로 직렬화</b>되며
 * (FREE의 정당한 0과 구분), 프론트는 음수를 "무제한"으로 해석한다.
 */
@Getter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class TierLimits {

    /** 무제한 표식(JSON 직렬화 값). 프론트는 이 값(또는 음수)을 무제한으로 본다. */
    public static final int UNLIMITED = -1;

    private int maxBacktestYears;
    private int maxBacktestPositions;
    private int dailyBacktestQuota;
    private int maxSavedStrategies;
    private int maxAlerts;
    private int maxLiveStrategies;
    private int maxLiveSymbols;
    private boolean canUseCustomBuilder;
    private boolean canUseAdvancedStrategy;

    public static TierLimits of(User.Tier tier) {
        return TierLimits.builder()
                .maxBacktestYears(cap(TierPolicy.maxBacktestYears(tier)))
                .maxBacktestPositions(cap(TierPolicy.maxBacktestPositions(tier)))
                .dailyBacktestQuota(cap(TierPolicy.dailyBacktestQuota(tier)))
                .maxSavedStrategies(cap(TierPolicy.maxSavedStrategies(tier)))
                .maxAlerts(cap(TierPolicy.maxAlerts(tier)))
                .maxLiveStrategies(cap(TierPolicy.maxLiveStrategies(tier)))
                .maxLiveSymbols(cap(TierPolicy.maxLiveSymbols(tier)))
                .canUseCustomBuilder(TierPolicy.canUseCustomBuilder(tier))
                .canUseAdvancedStrategy(TierPolicy.canUseAdvancedStrategy(tier))
                .build();
    }

    /** TierPolicy.UNLIMITED(Integer.MAX_VALUE) → 프론트 친화적 -1로 변환. 그 외는 그대로. */
    private static int cap(int v) {
        return v == TierPolicy.UNLIMITED ? UNLIMITED : v;
    }
}
