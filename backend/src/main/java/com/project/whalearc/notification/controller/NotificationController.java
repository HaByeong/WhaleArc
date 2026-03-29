package com.project.whalearc.notification.controller;

import com.project.whalearc.common.dto.ApiResponse;
import com.project.whalearc.notification.domain.Notification;
import com.project.whalearc.notification.domain.PriceAlert;
import com.project.whalearc.notification.service.NotificationService;
import com.project.whalearc.notification.service.PriceAlertService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;
    private final PriceAlertService priceAlertService;

    @GetMapping
    public ApiResponse<List<Notification>> getNotifications(@AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();
        return ApiResponse.ok(notificationService.getNotifications(userId));
    }

    @GetMapping("/unread-count")
    public ApiResponse<Long> getUnreadCount(@AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();
        return ApiResponse.ok(notificationService.getUnreadCount(userId));
    }

    @PutMapping("/{id}/read")
    public ApiResponse<Void> markAsRead(@AuthenticationPrincipal Jwt jwt,
                                        @PathVariable String id) {
        String userId = jwt.getSubject();
        notificationService.markAsRead(userId, id);
        return ApiResponse.ok(null);
    }

    @PutMapping("/read-all")
    public ApiResponse<Void> markAllAsRead(@AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();
        notificationService.markAllAsRead(userId);
        return ApiResponse.ok(null);
    }

    /* ───── 가격 알림 ───── */

    @PostMapping("/price-alerts")
    public ApiResponse<PriceAlert> createPriceAlert(@AuthenticationPrincipal Jwt jwt,
                                                      @RequestBody Map<String, Object> body) {
        String userId = jwt.getSubject();
        String stockCode = (String) body.get("stockCode");
        String stockName = (String) body.get("stockName");
        String assetType = (String) body.getOrDefault("assetType", "CRYPTO");
        String condition = (String) body.get("condition");

        if (stockCode == null || stockCode.isBlank()) {
            throw new IllegalArgumentException("종목 코드를 입력해주세요.");
        }
        if (stockName == null || stockName.isBlank()) {
            throw new IllegalArgumentException("종목 이름을 입력해주세요.");
        }
        PriceAlert.AlertCondition alertCondition;
        try {
            alertCondition = PriceAlert.AlertCondition.valueOf(condition);
        } catch (Exception e) {
            throw new IllegalArgumentException("조건은 ABOVE, BELOW, CHANGE_UP, CHANGE_DOWN 중 하나여야 합니다.");
        }

        double targetPrice = 0;
        double changePercent = 0;

        if (alertCondition == PriceAlert.AlertCondition.CHANGE_UP || alertCondition == PriceAlert.AlertCondition.CHANGE_DOWN) {
            // 급등/급락 알림: changePercent 필수
            try {
                changePercent = Double.parseDouble(String.valueOf(body.get("changePercent")));
                if (changePercent <= 0) throw new NumberFormatException();
            } catch (Exception e) {
                throw new IllegalArgumentException("유효한 변동률(%)을 입력해주세요.");
            }
        } else {
            // 목표가 알림: targetPrice 필수
            try {
                targetPrice = Double.parseDouble(String.valueOf(body.get("targetPrice")));
                if (targetPrice <= 0) throw new NumberFormatException();
            } catch (Exception e) {
                throw new IllegalArgumentException("유효한 목표가를 입력해주세요.");
            }
        }

        PriceAlert alert = priceAlertService.createAlert(
                userId, stockCode, stockName, assetType,
                alertCondition, targetPrice, changePercent
        );
        return ApiResponse.ok(alert);
    }

    @GetMapping("/price-alerts")
    public ApiResponse<List<PriceAlert>> getMyPriceAlerts(@AuthenticationPrincipal Jwt jwt) {
        return ApiResponse.ok(priceAlertService.getMyAlerts(jwt.getSubject()));
    }

    @DeleteMapping("/price-alerts/{alertId}")
    public ApiResponse<Void> deletePriceAlert(@AuthenticationPrincipal Jwt jwt,
                                                @PathVariable String alertId) {
        priceAlertService.deleteAlert(jwt.getSubject(), alertId);
        return ApiResponse.ok(null);
    }
}
