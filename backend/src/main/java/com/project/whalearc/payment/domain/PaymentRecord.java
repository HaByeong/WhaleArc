package com.project.whalearc.payment.domain;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

/** 정기결제 청구 이력 — 성공/실패 모두 기록한다(재시도 판단·정산 추적용). */
@Getter
@Setter
@NoArgsConstructor
@Document(collection = "payment_records")
public class PaymentRecord {

    @Id
    private String id;

    private String userId;
    private String subscriptionId;
    private String paymentKey;
    private String orderId;
    private long amount;
    /** 토스 status(DONE 등) 또는 자체 실패 사유 구분용 "FAILED". */
    private String status;
    private String failReason;

    private LocalDateTime requestedAt;
    private LocalDateTime approvedAt;

    public PaymentRecord(String userId, String subscriptionId, String orderId, long amount) {
        this.userId = userId;
        this.subscriptionId = subscriptionId;
        this.orderId = orderId;
        this.amount = amount;
        this.requestedAt = LocalDateTime.now();
    }
}
