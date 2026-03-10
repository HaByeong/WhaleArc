package com.project.whalearc.notification.service;

import com.project.whalearc.notification.domain.Notification;
import com.project.whalearc.notification.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;

    public Notification createNotification(String userId, Notification.NotificationType type,
                                           String title, String message) {
        Notification notification = new Notification(userId, type, title, message);
        notification = notificationRepository.save(notification);
        log.info("알림 생성: userId={}, type={}, title={}", userId, type, title);
        return notification;
    }

    public Notification createNotificationWithMeta(String userId, Notification.NotificationType type,
                                                   String title, String message,
                                                   Map<String, String> metadata) {
        Notification notification = new Notification(userId, type, title, message);
        notification.setMetadata(metadata);
        notification = notificationRepository.save(notification);
        log.info("알림 생성: userId={}, type={}, title={}", userId, type, title);
        return notification;
    }

    public List<Notification> getNotifications(String userId) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(0, 50));
    }

    public long getUnreadCount(String userId) {
        return notificationRepository.countByUserIdAndReadFalse(userId);
    }

    public void markAsRead(String userId, String notificationId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new IllegalArgumentException("알림을 찾을 수 없습니다."));
        if (!notification.getUserId().equals(userId)) {
            throw new IllegalArgumentException("본인의 알림만 읽음 처리할 수 있습니다.");
        }
        notification.setRead(true);
        notificationRepository.save(notification);
    }

    public void markAllAsRead(String userId) {
        List<Notification> unread = notificationRepository.findByUserIdAndReadFalse(userId);
        if (unread.isEmpty()) return;
        unread.forEach(n -> n.setRead(true));
        notificationRepository.saveAll(unread);
    }
}
