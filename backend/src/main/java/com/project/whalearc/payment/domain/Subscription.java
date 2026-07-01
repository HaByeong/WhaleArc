package com.project.whalearc.payment.domain;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.time.LocalDateTime;

/** 사용자 정기결제 구독 상태. userId(Supabase sub)당 1건만 유지 — 플랜 변경 시 기존 문서를 갱신한다. */
@Getter
@Setter
@NoArgsConstructor
@Document(collection = "subscriptions")
public class Subscription {

    @Id
    private String id;

    @Indexed(unique = true)
    private String userId;

    private String customerKey;
    /** AES-256-GCM 암호화된 토스 billingKey. 평문 저장 금지 — {@code payment.encryption-key}로 복호화. */
    private String billingKeyEncrypted;
    private String cardCompany;
    private String cardNumberMasked;

    private PaymentPlan plan;
    private SubscriptionStatus status;

    private LocalDate nextBillingDate;
    /** 연속 청구 실패 횟수. {@code BillingService.MAX_CONSECUTIVE_FAILURES} 도달 시 자동 해지. */
    private int failCount;

    private LocalDateTime createdAt;
    private LocalDateTime canceledAt;

    public enum SubscriptionStatus { ACTIVE, PAST_DUE, CANCELED }
}
