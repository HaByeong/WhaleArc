package com.project.whalearc.payment.service;

import com.project.whalearc.payment.domain.Subscription;
import com.project.whalearc.payment.domain.Subscription.SubscriptionStatus;
import com.project.whalearc.payment.repository.SubscriptionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

/** 정기결제 청구 스케줄러. 매일 새벽 01:00(KST) 청구일이 도래한 ACTIVE·PAST_DUE 구독을 순회 청구한다. */
@Slf4j
@Component
@RequiredArgsConstructor
public class BillingScheduler {

    private final SubscriptionRepository subscriptionRepository;
    private final BillingService billingService;

    @Scheduled(cron = "0 0 1 * * *", zone = "Asia/Seoul")
    public void chargeDueSubscriptions() {
        LocalDate today = LocalDate.now();
        List<Subscription> due = new java.util.ArrayList<>();
        due.addAll(subscriptionRepository.findByStatusAndNextBillingDateLessThanEqual(SubscriptionStatus.ACTIVE, today));
        due.addAll(subscriptionRepository.findByStatusAndNextBillingDateLessThanEqual(SubscriptionStatus.PAST_DUE, today));

        for (Subscription subscription : due) {
            try {
                billingService.charge(subscription);
            } catch (Exception e) {
                // charge() 내부에서 실패를 이미 기록·반영하므로 여기서는 스케줄 루프가 멈추지 않게만 방어
                log.error("정기결제 스케줄 처리 중 예외 [{}]: {}", subscription.getUserId(), e.getMessage());
            }
        }
        log.info("정기결제 청구 스케줄 완료: 대상 {}건", due.size());
    }
}
