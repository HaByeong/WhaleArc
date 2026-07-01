package com.project.whalearc.payment.controller;

import com.project.whalearc.common.dto.ApiResponse;
import com.project.whalearc.payment.domain.PaymentPlan;
import com.project.whalearc.payment.domain.Subscription;
import com.project.whalearc.payment.dto.BillingRegisterRequest;
import com.project.whalearc.payment.dto.SubscriptionResponse;
import com.project.whalearc.payment.repository.SubscriptionRepository;
import com.project.whalearc.payment.service.BillingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/billing")
@RequiredArgsConstructor
public class BillingController {

    private final BillingService billingService;
    private final SubscriptionRepository subscriptionRepository;

    @GetMapping("/subscription")
    public ApiResponse<SubscriptionResponse> getSubscription(@AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();
        return subscriptionRepository.findByUserId(userId)
                .map(s -> ApiResponse.ok(new SubscriptionResponse(s)))
                .orElseGet(() -> ApiResponse.ok(null));
    }

    /** 프론트에서 토스 빌링 인증(requestBillingAuth) 성공 리다이렉트로 받은 authKey/customerKey를 그대로 전달받는다. */
    @PostMapping("/register")
    public ApiResponse<SubscriptionResponse> register(@AuthenticationPrincipal Jwt jwt,
                                                        @RequestBody BillingRegisterRequest request) {
        String userId = jwt.getSubject();
        PaymentPlan plan = PaymentPlan.valueOf(request.getPlan());
        Subscription subscription = billingService.register(userId, request.getAuthKey(), request.getCustomerKey(), plan);
        return ApiResponse.ok(new SubscriptionResponse(subscription));
    }

    @PostMapping("/cancel")
    public ApiResponse<Void> cancel(@AuthenticationPrincipal Jwt jwt) {
        billingService.cancel(jwt.getSubject());
        return ApiResponse.ok(null);
    }

    /**
     * 토스페이먼츠 웹훅 수신 엔드포인트. 인증 없이 호출되므로(SecurityConfig에서 permitAll) 본문의
     * status를 신뢰하지 않고 paymentKey만 꺼내 서버 간 재조회로 진위를 확인한다({@link BillingService#reconcilePayment}).
     * 처리 실패 시 500을 반환해 토스의 자동 재전송(최대 7회)을 유도한다.
     */
    @PostMapping("/webhook")
    public ResponseEntity<Void> webhook(@RequestBody Map<String, Object> body) {
        Object dataObj = body.get("data");
        @SuppressWarnings("unchecked")
        Map<String, Object> data = dataObj instanceof Map ? (Map<String, Object>) dataObj : body;
        Object paymentKey = data.get("paymentKey");
        if (paymentKey == null) {
            return ResponseEntity.ok().build(); // 결제 상태와 무관한 이벤트(BILLING_DELETED 등)는 무시
        }
        try {
            billingService.reconcilePayment(paymentKey.toString());
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            log.error("웹훅 처리 실패(paymentKey={}): {}", paymentKey, e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }
}
