package com.project.whalearc.mirror.service;

import com.project.whalearc.mirror.domain.EmotionCapture;
import com.project.whalearc.mirror.repository.EmotionCaptureRepository;
import com.project.whalearc.notification.domain.Notification;
import com.project.whalearc.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * 감정 거울 개봉 배치 — 매시간 만기된 봉인을 열고 알림을 보낸다.
 * (사용자가 목록을 직접 열면 {@link EmotionMirrorService#getUserCaptures}가 즉시 개봉하므로, 이 배치는 백스톱·알림용.)
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class EmotionRevealScheduler {

    private final EmotionCaptureRepository repository;
    private final EmotionMirrorService mirrorService;
    private final NotificationService notificationService;

    /** 매시 정각(KST) — 개봉 시점이 지난 봉인을 연다. */
    @Scheduled(cron = "0 0 * * * *", zone = "Asia/Seoul")
    public void revealDue() {
        List<EmotionCapture> due = repository.findByRevealedFalseAndRevealAtLessThanEqual(Instant.now());
        if (due.isEmpty()) return;

        int opened = 0;
        for (EmotionCapture c : due) {
            try {
                if (!mirrorService.reveal(c)) continue;  // 시세 못 구하면 다음 배치에 재시도
                repository.save(c);
                notifyRevealed(c);
                opened++;
            } catch (Exception e) {
                log.debug("감정 거울 개봉 스킵 [{}]: {}", c.getId(), e.getMessage());
            }
        }
        log.info("감정 거울 개봉 완료: {}건 / 만기 {}건", opened, due.size());
    }

    private void notifyRevealed(EmotionCapture c) {
        double cost = nz(c.getRuleOutcomePct()) - nz(c.getImpulseOutcomePct());
        String body = cost >= 0
                ? String.format("'%s' — 항로를 지켰다면 충동보다 %+.1f%%p 나았어요. 유리병이 돌아왔어요.", c.getAssetName() != null ? c.getAssetName() : c.getAssetSymbol(), cost)
                : String.format("'%s' — 이번엔 충동이 %+.1f%%p 나았네요. 파도가 정직하게 실어왔어요.", c.getAssetName() != null ? c.getAssetName() : c.getAssetSymbol(), -cost);
        notificationService.createNotificationWithMeta(
                c.getUserId(), Notification.NotificationType.EMOTION_MIRROR_REVEALED,
                "🌊 유리병이 돌아왔어요", body,
                Map.of("captureId", c.getId(), "symbol", c.getAssetSymbol()));
    }

    private static double nz(Double v) {
        return v != null ? v : 0.0;
    }
}
