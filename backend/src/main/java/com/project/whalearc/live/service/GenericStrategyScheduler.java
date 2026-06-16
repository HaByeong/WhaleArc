package com.project.whalearc.live.service;

import com.project.whalearc.live.domain.LiveStrategyDeployment;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 일반 전략 라이브 자동매매 스케줄러. 터틀 스케줄러를 일반화한 것.
 *
 * <p>얇게 유지: RUNNING 배포만 조회 → 배포별 try-catch 격리로 LiveStrategyService에 위임.
 * 한 배포의 예외가 나머지 순회를 막지 않는다. 봉 단위 배치(매 정시 1시간) 평가.
 *
 * <p>참고(1단계 한계): interval이 1d인 배포도 매시간 재평가된다. 포지션 상태(LONG/NONE)로
 * 중복 진입은 막히지만, 동일 봉 재평가 디듀프(lastEvaluatedAt vs 캔들 타임스탬프)는 이후 단계에서 보강.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class GenericStrategyScheduler {

    private final LiveStrategyService liveStrategyService;

    @Scheduled(cron = "0 0 * * * *")  // 매 정시 (1시간 간격) — 터틀과 동일 빈도
    public void evaluateLiveStrategies() {
        if (liveStrategyService.isKillSwitchEngaged()) {
            log.warn("라이브 자동매매 킬스위치 ON — 이번 주기 평가 건너뜀");
            return;
        }

        List<LiveStrategyDeployment> running = liveStrategyService.getRunningDeployments();
        if (running.isEmpty()) return;

        log.info("라이브 스케줄러: {}개 배포 시그널 체크 시작", running.size());
        int executed = 0;
        for (LiveStrategyDeployment d : running) {
            // 모멘텀 로테이션은 시그널 평가 대상이 아님 — 전용 MomentumRotationScheduler(일간)가 담당.
            if (d.isMomentumRotation()) continue;
            try {
                liveStrategyService.evaluateDeployment(d);
                executed++;
            } catch (Exception e) {
                log.error("라이브 배포 평가 실패: deploymentId={}, userId={}, error={}",
                        d.getId(), d.getUserId(), e.getMessage());
            }
        }
        log.info("라이브 스케줄러: {}개 배포 처리 완료", executed);
    }
}
