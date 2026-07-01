package com.project.whalearc.payment.dto;

import com.project.whalearc.payment.domain.Subscription;
import lombok.Getter;

import java.time.LocalDate;

@Getter
public class SubscriptionResponse {

    private final String plan;
    private final String status;
    private final String cardCompany;
    private final String cardNumberMasked;
    private final LocalDate nextBillingDate;

    public SubscriptionResponse(Subscription s) {
        this.plan = s.getPlan() != null ? s.getPlan().name() : null;
        this.status = s.getStatus() != null ? s.getStatus().name() : null;
        this.cardCompany = s.getCardCompany();
        this.cardNumberMasked = s.getCardNumberMasked();
        this.nextBillingDate = s.getNextBillingDate();
    }
}
