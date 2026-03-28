package com.project.whalearc.notification.service;

import com.project.whalearc.market.dto.MarketPriceResponse;
import com.project.whalearc.market.service.CryptoPriceProvider;
import com.project.whalearc.market.websocket.RealtimePriceHolder;
import com.project.whalearc.notification.domain.Notification;
import com.project.whalearc.notification.domain.PriceAlert;
import com.project.whalearc.notification.repository.PriceAlertRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class PriceAlertService {

    private final PriceAlertRepository alertRepository;
    private final NotificationService notificationService;
    private final RealtimePriceHolder realtimePriceHolder;
    private final CryptoPriceProvider cryptoPriceProvider;

    private static final int MAX_ALERTS_PER_USER = 20;

    /** 가격 알림 생성 */
    public PriceAlert createAlert(String userId, String stockCode, String stockName,
                                   String assetType, PriceAlert.AlertCondition condition, double targetPrice) {
        long count = alertRepository.countByUserIdAndActiveTrue(userId);
        if (count >= MAX_ALERTS_PER_USER) {
            throw new IllegalStateException("가격 알림은 최대 " + MAX_ALERTS_PER_USER + "개까지 설정할 수 있습니다.");
        }

        PriceAlert alert = new PriceAlert(userId, stockCode, stockName, assetType, condition, targetPrice);
        return alertRepository.save(alert);
    }

    /** 내 알림 목록 조회 */
    public List<PriceAlert> getMyAlerts(String userId) {
        return alertRepository.findByUserIdAndActiveTrue(userId);
    }

    /** 알림 삭제 */
    public void deleteAlert(String userId, String alertId) {
        PriceAlert alert = alertRepository.findById(alertId)
                .orElseThrow(() -> new IllegalArgumentException("알림을 찾을 수 없습니다."));
        if (!alert.getUserId().equals(userId)) {
            throw new IllegalArgumentException("본인의 알림만 삭제할 수 있습니다.");
        }
        alert.setActive(false);
        alertRepository.save(alert);
    }

    /** 10초마다 가격 알림 체크 */
    @Scheduled(fixedRate = 10_000)
    public void checkPriceAlerts() {
        List<PriceAlert> activeAlerts = alertRepository.findByActiveTrueAndTriggeredFalse();
        if (activeAlerts.isEmpty()) return;

        // 현재 가격 수집 (실시간 + REST)
        Map<String, Double> priceMap = new HashMap<>();
        for (MarketPriceResponse p : realtimePriceHolder.getAllLatestPrices()) {
            priceMap.put(p.getSymbol(), p.getPrice());
        }
        for (MarketPriceResponse p : cryptoPriceProvider.getAllKrwTickers()) {
            priceMap.putIfAbsent(p.getSymbol(), p.getPrice());
        }

        int triggered = 0;
        for (PriceAlert alert : activeAlerts) {
            Double currentPrice = priceMap.get(alert.getStockCode());
            if (currentPrice == null) continue;

            boolean hit = false;
            if (alert.getCondition() == PriceAlert.AlertCondition.ABOVE && currentPrice >= alert.getTargetPrice()) {
                hit = true;
            } else if (alert.getCondition() == PriceAlert.AlertCondition.BELOW && currentPrice <= alert.getTargetPrice()) {
                hit = true;
            }

            if (hit) {
                alert.setTriggered(true);
                alert.setActive(false);
                alert.setTriggeredAt(Instant.now());
                alertRepository.save(alert);

                String direction = alert.getCondition() == PriceAlert.AlertCondition.ABOVE ? "이상" : "이하";
                String title = alert.getStockName() + " 목표가 도달";
                String message = String.format("%s이(가) 설정하신 %,.0f원 %s에 도달했습니다. (현재가: %,.0f원)",
                        alert.getStockName(), alert.getTargetPrice(), direction, currentPrice);

                notificationService.createNotificationWithMeta(
                        alert.getUserId(),
                        Notification.NotificationType.PRICE_ALERT,
                        title, message,
                        Map.of("stockCode", alert.getStockCode(), "currentPrice", String.valueOf(currentPrice.longValue()))
                );
                triggered++;
            }
        }

        if (triggered > 0) {
            log.info("가격 알림 {}건 트리거됨", triggered);
        }
    }
}
