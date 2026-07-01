package com.project.whalearc.payment.dto;

import lombok.Data;

/** 프론트가 토스 빌링 인증(requestBillingAuth) 성공 후 리다이렉트로 받은 값을 그대로 전달한다. */
@Data
public class BillingRegisterRequest {
    private String authKey;
    private String customerKey;
    /** {@link com.project.whalearc.payment.domain.PaymentPlan} 이름 (예: "BASIC_MONTHLY"). */
    private String plan;
}
