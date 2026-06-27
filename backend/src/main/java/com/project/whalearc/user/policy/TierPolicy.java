package com.project.whalearc.user.policy;

import com.project.whalearc.user.domain.User.Tier;

/**
 * 등급(Tier)별 기능 한도 — 흩어진 매직넘버를 한 곳에 모은 순수 정책 함수군.
 *
 * <p>의존성·스프링 빈 없이 {@link Tier}만 받아 한도를 돌려준다(단위테스트 용이). "무제한"은
 * {@link #UNLIMITED}로 표현하며, 모든 호출부는 {@code limit != UNLIMITED && value > limit} 형태로
 * 비교해 PRO가 자연히 통과하도록 한다. ADMIN 역할은 호출 전에 PRO로 매핑된다({@link TierResolver}).
 */
public final class TierPolicy {

    /** 무제한 한도 표식. 호출부는 이 값과 같으면 검사를 건너뛴다. */
    public static final int UNLIMITED = Integer.MAX_VALUE;

    private TierPolicy() {}

    /** 백테스트 허용 기간(년). FREE 1 / BASIC 5 / PRO 무제한. */
    public static int maxBacktestYears(Tier tier) {
        return switch (normalize(tier)) {
            case FREE -> 1;
            case BASIC -> 5;
            case PRO -> UNLIMITED;
        };
    }

    /** 백테스트 동시 종목·포지션 수(maxPositions). FREE 1 / BASIC 5 / PRO 무제한. */
    public static int maxBacktestPositions(Tier tier) {
        return switch (normalize(tier)) {
            case FREE -> 1;
            case BASIC -> 5;
            case PRO -> UNLIMITED;
        };
    }

    /** 백테스트 일일 실행 횟수. FREE 10 / BASIC 100 / PRO 무제한. */
    public static int dailyBacktestQuota(Tier tier) {
        return switch (normalize(tier)) {
            case FREE -> 10;
            case BASIC -> 100;
            case PRO -> UNLIMITED;
        };
    }

    /** 저장 가능한 전략 개수. FREE 3 / BASIC 20 / PRO 무제한. */
    public static int maxSavedStrategies(Tier tier) {
        return switch (normalize(tier)) {
            case FREE -> 3;
            case BASIC -> 20;
            case PRO -> UNLIMITED;
        };
    }

    /** 가격 알림 개수. FREE 3 / BASIC 20 / PRO 무제한. */
    public static int maxAlerts(Tier tier) {
        return switch (normalize(tier)) {
            case FREE -> 3;
            case BASIC -> 20;
            case PRO -> UNLIMITED;
        };
    }

    /** 동시 실거래(LIVE) 전략(배포) 수. FREE 0 / BASIC 1 / PRO 무제한. */
    public static int maxLiveStrategies(Tier tier) {
        return switch (normalize(tier)) {
            case FREE -> 0;
            case BASIC -> 1;
            case PRO -> UNLIMITED;
        };
    }

    /** 실거래(LIVE) 배포당 종목 수. FREE 0 / BASIC 3 / PRO 무제한. */
    public static int maxLiveSymbols(Tier tier) {
        return switch (normalize(tier)) {
            case FREE -> 0;
            case BASIC -> 3;
            case PRO -> UNLIMITED;
        };
    }

    /** 고급 전략(모멘텀 로테이션 등) 백테스트 가능 여부 — PRO 전용. */
    public static boolean canUseAdvancedStrategy(Tier tier) {
        return normalize(tier) == Tier.PRO;
    }

    /** 커스텀 전략 빌더(직접 지표·조건 조합) 사용 가능 여부 — BASIC 이상. FREE는 프리셋만. */
    public static boolean canUseCustomBuilder(Tier tier) {
        return normalize(tier).ordinal() >= Tier.BASIC.ordinal();
    }

    /** null 방어 — tier 미설정 유저는 가장 보수적인 FREE로 취급. */
    private static Tier normalize(Tier tier) {
        return tier != null ? tier : Tier.FREE;
    }
}
