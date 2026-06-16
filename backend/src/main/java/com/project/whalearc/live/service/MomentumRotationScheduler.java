package com.project.whalearc.live.service;

import com.project.whalearc.live.domain.LiveStrategyDeployment;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 미국주식 모멘텀 Top-N 로테이션 전용 스케줄러.
 *
 * <p>시그널 기반(GenericStrategyScheduler, 매 정시)과 달리 <b>일 1회</b> 깨어:
 * (1) 일간 레짐 점검(applyRegimeDaily — 전일과 레짐이 바뀐 경우에만 비중 조정),
 * (2) 이번 달 미처리면 월간 리밸런싱(rebalanceMomentum — lastRotationMonth로 멱등).
 *
 * <p>멱등키(lastRotationMonth/lastRegimeDay)로 중복 실행이 무해하므로, 미국장 마감(KST 새벽) 후
 * 캐시 갱신(MomentumDataCache, 06:30)이 끝난 직후인 07:00에 실행한다. 휴장일은 캔들 미갱신이라
 * 랭킹/레짐이 전일과 동일 → 사실상 무동작. 배포별 try-catch로 한 건 실패가 나머지를 막지 않는다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MomentumRotationScheduler {

    private final LiveStrategyService liveStrategyService;

    @Scheduled(cron = "0 0 7 * * *", zone = "Asia/Seoul")   // 매일 KST 07:00 (캐시 워밍 06:30 이후)
    public void rotate() {
        if (liveStrategyService.isKillSwitchEngaged()) {
            log.warn("라이브 자동매매 킬스위치 ON — 모멘텀 로테이션 이번 주기 건너뜀");
            return;
        }
        List<LiveStrategyDeployment> running = liveStrategyService.getRunningMomentumDeployments();
        if (running.isEmpty()) return;

        log.info("모멘텀 로테이션 스케줄러: {}개 배포 점검 시작", running.size());
        for (LiveStrategyDeployment d : running) {
            try {
                liveStrategyService.applyRegimeDaily(d);   // 일간 레짐 (멱등)
                liveStrategyService.rebalanceMomentum(d);  // 월간 리밸런싱 (멱등)
            } catch (Exception e) {
                log.error("모멘텀 로테이션 실패: deploymentId={}, userId={}, error={}",
                        d.getId(), d.getUserId(), e.getMessage());
            }
        }
        log.info("모멘텀 로테이션 스케줄러: 점검 완료");
    }
}
