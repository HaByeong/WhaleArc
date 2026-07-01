package com.project.whalearc.payment.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

/** 토스페이먼츠 결제(Payment) 객체 — 빌링 청구 응답과 단건 조회(GET) 응답에 공통으로 쓰인다. */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class TossPaymentResponse {

    private String paymentKey;
    private String orderId;
    /** READY, IN_PROGRESS, DONE, CANCELED, ABORTED, EXPIRED 등. */
    private String status;
    private long totalAmount;
    private String approvedAt;
}
