package com.project.whalearc.payment.domain;

import com.project.whalearc.user.domain.User.Tier;

/** 결제 플랜 정의 — 가격은 프론트 ConsoleBillingPage.tsx의 PLANS와 동일하게 맞춰 관리한다. */
public enum PaymentPlan {
    BASIC_MONTHLY(Tier.BASIC, 19_900),
    PRO_MONTHLY(Tier.PRO, 49_900);

    private final Tier tier;
    private final long amount;

    PaymentPlan(Tier tier, long amount) {
        this.tier = tier;
        this.amount = amount;
    }

    public Tier tier() {
        return tier;
    }

    public long amount() {
        return amount;
    }
}
