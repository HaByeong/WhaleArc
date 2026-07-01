package com.project.whalearc.payment.client;

import com.project.whalearc.payment.dto.TossBillingKeyResponse;
import com.project.whalearc.payment.dto.TossPaymentResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;

/**
 * 토스페이먼츠 자동결제(빌링) API 클라이언트.
 * 문서: https://docs.tosspayments.com/guides/v2/billing/integration
 * 인증은 시크릿키 Basic Auth({@code secretKey + ":"} 를 base64) — 별도 토큰 발급 절차 없음.
 */
@Component
public class TossPaymentsClient {

    private static final String BASE_URL = "https://api.tosspayments.com/v1";
    private final RestTemplate restTemplate = new RestTemplate();
    private final String secretKey;

    public TossPaymentsClient(@Value("${toss.payments.secret-key}") String secretKey) {
        this.secretKey = secretKey;
    }

    /** authKey(프론트 인증 성공 리다이렉트로 받은 1회성 키)를 billingKey로 교환한다. */
    public TossBillingKeyResponse issueBillingKey(String authKey, String customerKey) {
        Map<String, String> body = Map.of("authKey", authKey, "customerKey", customerKey);
        return restTemplate.exchange(
                BASE_URL + "/billing/authorizations/issue",
                HttpMethod.POST,
                new HttpEntity<>(body, authHeaders()),
                TossBillingKeyResponse.class
        ).getBody();
    }

    /** 저장된 billingKey로 정기결제를 청구한다. */
    public TossPaymentResponse chargeBillingKey(String billingKey, String customerKey, long amount,
                                                 String orderId, String orderName) {
        Map<String, Object> body = Map.of(
                "customerKey", customerKey,
                "amount", amount,
                "orderId", orderId,
                "orderName", orderName
        );
        return restTemplate.exchange(
                BASE_URL + "/billing/" + billingKey,
                HttpMethod.POST,
                new HttpEntity<>(body, authHeaders()),
                TossPaymentResponse.class
        ).getBody();
    }

    /**
     * paymentKey로 결제 상태를 서버 간 직접 조회한다.
     * 토스 웹훅은 표준화된 서명 헤더가 문서화돼 있지 않아 본문을 그대로 신뢰하지 않는다 — 웹훅은
     * "무엇을 조회할지"만 알려주는 트리거로 쓰고, 실제 상태 반영은 항상 이 메서드의 응답을 기준으로 한다.
     */
    public TossPaymentResponse getPayment(String paymentKey) {
        return restTemplate.exchange(
                BASE_URL + "/payments/" + paymentKey,
                HttpMethod.GET,
                new HttpEntity<>(authHeaders()),
                TossPaymentResponse.class
        ).getBody();
    }

    private HttpHeaders authHeaders() {
        HttpHeaders headers = new HttpHeaders();
        String encoded = Base64.getEncoder().encodeToString((secretKey + ":").getBytes(StandardCharsets.UTF_8));
        headers.set("Authorization", "Basic " + encoded);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }
}
