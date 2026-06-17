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
 * <p>주문은 <b>미국장 개장 중에만 체결</b>되므로(장외 발주는 거부), 미국 세션(KST 22:30~05:00, 서머타임/
 * 겨울 모두 커버) 동안 <b>매시 :30</b>에 깨어 실행한다. 멱등키(lastRotationMonth/lastRegimeDay)로
 * 성공 1회만 실행되고, 부분 실패(거부)면 lastRotationMonth가 안 찍혀 다음 시간대에 자동 재시도된다.
 * 휴장일은 캔들 미갱신이라 사실상 무동작. 배포별 try-catch로 한 건 실패가 나머지를 막지 않는다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MomentumRotationScheduler {

    private final LiveStrategyService liveStrategyService;

    // 미국 세션 중 매시 :30 (KST 22:30~05:30). 첫 거래일 장중에 주문이 들어가 체결되고, 멱등으로 1회만 실행.
    @Scheduled(cron = "0 30 22,23,0,1,2,3,4,5 * * *", zone = "Asia/Seoul")
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
