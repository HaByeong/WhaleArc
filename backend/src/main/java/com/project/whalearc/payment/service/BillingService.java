package com.project.whalearc.payment.service;

import com.project.whalearc.payment.client.TossPaymentsClient;
import com.project.whalearc.payment.domain.PaymentPlan;
import com.project.whalearc.payment.domain.PaymentRecord;
import com.project.whalearc.payment.domain.Subscription;
import com.project.whalearc.payment.domain.Subscription.SubscriptionStatus;
import com.project.whalearc.payment.dto.TossBillingKeyResponse;
import com.project.whalearc.payment.dto.TossPaymentResponse;
import com.project.whalearc.payment.repository.PaymentRecordRepository;
import com.project.whalearc.payment.repository.SubscriptionRepository;
import com.project.whalearc.payment.util.PaymentCryptoUtil;
import com.project.whalearc.user.domain.User;
import com.project.whalearc.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class BillingService {

    /** 연속 청구 실패 허용 횟수 — 초과 시 무한 재시도 대신 구독을 해지하고 FREE로 내린다. */
    private static final int MAX_CONSECUTIVE_FAILURES = 3;

    private final TossPaymentsClient tossPaymentsClient;
    private final SubscriptionRepository subscriptionRepository;
    private final PaymentRecordRepository paymentRecordRepository;
    private final PaymentCryptoUtil paymentCryptoUtil;
    private final UserRepository userRepository;

    /** 카드 등록(빌링키 발급) 후 구독을 시작하고 첫 결제를 즉시 청구한다. */
    public Subscription register(String userId, String authKey, String customerKey, PaymentPlan plan) {
        TossBillingKeyResponse billingKeyRes = tossPaymentsClient.issueBillingKey(authKey, customerKey);

        Subscription subscription = subscriptionRepository.findByUserId(userId).orElseGet(Subscription::new);
        subscription.setUserId(userId);
        subscription.setCustomerKey(customerKey);
        subscription.setBillingKeyEncrypted(paymentCryptoUtil.encrypt(billingKeyRes.getBillingKey()));
        if (billingKeyRes.getCard() != null) {
            subscription.setCardCompany(billingKeyRes.getCard().getCompany());
            subscription.setCardNumberMasked(billingKeyRes.getCard().getNumber());
        }
        subscription.setPlan(plan);
        subscription.setStatus(SubscriptionStatus.ACTIVE);
        subscription.setFailCount(0);
        subscription.setNextBillingDate(LocalDate.now());
        if (subscription.getCreatedAt() == null) subscription.setCreatedAt(LocalDateTime.now());
        subscription.setCanceledAt(null);
        subscription = subscriptionRepository.save(subscription);

        charge(subscription); // 등록 즉시 1회 청구(월 구독 시작) — 실패해도 카드 등록 자체는 유지, 상태만 PAST_DUE/CANCELED로 반영됨
        return subscription;
    }

    /**
     * 구독 해지 — 남은 기간 환불 없이 즉시 tier를 FREE로 내리는 단순 정책.
     * 일할 환불·기간 만료 시점 해지가 필요해지면 이 메서드를 확장한다.
     */
    public void cancel(String userId) {
        Subscription subscription = subscriptionRepository.findByUserId(userId)
                .orElseThrow(() -> new IllegalStateException("구독 내역이 없습니다: " + userId));
        subscription.setStatus(SubscriptionStatus.CANCELED);
        subscription.setCanceledAt(LocalDateTime.now());
        subscriptionRepository.save(subscription);
        applyTier(userId, User.Tier.FREE);
    }

    /** 저장된 billingKey로 실제 청구를 수행하고 결과에 따라 tier·다음 청구일·실패 카운트를 갱신한다. */
    public void charge(Subscription subscription) {
        String orderId = "sub_" + subscription.getUserId() + "_" + UUID.randomUUID();
        PaymentRecord record = new PaymentRecord(
                subscription.getUserId(), subscription.getId(), orderId, subscription.getPlan().amount());

        try {
            String billingKey = paymentCryptoUtil.decrypt(subscription.getBillingKeyEncrypted());
            TossPaymentResponse payment = tossPaymentsClient.chargeBillingKey(
                    billingKey, subscription.getCustomerKey(), subscription.getPlan().amount(),
                    orderId, "WhaleArc " + subscription.getPlan().name() + " 구독");

            record.setPaymentKey(payment.getPaymentKey());
            record.setStatus(payment.getStatus());
            record.setApprovedAt(LocalDateTime.now());
            paymentRecordRepository.save(record);

            onChargeSuccess(subscription);
        } catch (Exception e) {
            log.warn("정기결제 청구 실패 [{}]: {}", subscription.getUserId(), e.getMessage());
            record.setStatus("FAILED");
            record.setFailReason(e.getMessage());
            paymentRecordRepository.save(record);
            onChargeFailure(subscription);
        }
    }

    private void onChargeSuccess(Subscription subscription) {
        subscription.setFailCount(0);
        subscription.setStatus(SubscriptionStatus.ACTIVE);
        subscription.setNextBillingDate(subscription.getNextBillingDate().plusMonths(1));
        subscriptionRepository.save(subscription);
        applyTier(subscription.getUserId(), subscription.getPlan().tier());
    }

    private void onChargeFailure(Subscription subscription) {
        int fails = subscription.getFailCount() + 1;
        subscription.setFailCount(fails);
        if (fails >= MAX_CONSECUTIVE_FAILURES) {
            subscription.setStatus(SubscriptionStatus.CANCELED);
            subscription.setCanceledAt(LocalDateTime.now());
            subscriptionRepository.save(subscription);
            applyTier(subscription.getUserId(), User.Tier.FREE);
        } else {
            subscription.setStatus(SubscriptionStatus.PAST_DUE);
            subscription.setNextBillingDate(LocalDate.now().plusDays(1)); // 익일 재시도
            subscriptionRepository.save(subscription);
        }
    }

    private void applyTier(String userId, User.Tier tier) {
        userRepository.findBySupabaseId(userId).ifPresent(user -> {
            user.setTier(tier);
            userRepository.save(user);
        });
    }

    /**
     * 웹훅이 알려준 paymentKey의 실제 상태를 토스 서버에 직접 재조회해 로컬 기록에 반영한다.
     * 웹훅 본문의 status는 신뢰하지 않는다 — {@link TossPaymentsClient#getPayment}의 서버 응답만 신뢰한다.
     */
    public void reconcilePayment(String paymentKey) {
        TossPaymentResponse payment = tossPaymentsClient.getPayment(paymentKey);
        paymentRecordRepository.findByOrderId(payment.getOrderId()).ifPresent(record -> {
            record.setPaymentKey(payment.getPaymentKey());
            record.setStatus(payment.getStatus());
            if ("DONE".equals(payment.getStatus()) && record.getApprovedAt() == null) {
                record.setApprovedAt(LocalDateTime.now());
            }
            paymentRecordRepository.save(record);
        });
    }
}
