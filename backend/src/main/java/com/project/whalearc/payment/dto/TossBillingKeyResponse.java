package com.project.whalearc.payment.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

/** 토스페이먼츠 빌링키 발급 응답(POST /v1/billing/authorizations/issue) — 필요한 필드만 매핑. */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class TossBillingKeyResponse {

    private String billingKey;
    private String customerKey;
    private CardInfo card;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class CardInfo {
        private String company;
        /** 토스가 앞6/뒤4 외 마스킹해 반환하는 카드번호 — 그대로 저장해 노출해도 안전. */
        private String number;
    }
}
