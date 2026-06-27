package com.project.whalearc.live.service;

import com.project.whalearc.live.domain.LiveDeploymentEquitySnapshot;
import com.project.whalearc.live.domain.LiveStrategyDeployment;
import com.project.whalearc.live.repository.LiveDeploymentEquitySnapshotRepository;
import com.project.whalearc.live.repository.LiveStrategyDeploymentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

import static com.project.whalearc.live.domain.LiveStrategyDeployment.Status.PAUSED;
import static com.project.whalearc.live.domain.LiveStrategyDeployment.Status.RUNNING;

/**
 * 라이브 배포(자동매매)의 일별 손익 스냅샷 스케줄러.
 * 매일 00:00(KST) 활성(RUNNING/PAUSED) 배포의 평가손익률(%)을 1건씩 저장 → 카드 손익 스파크라인 데이터.
 * (실계좌 {@link com.project.whalearc.exchange.service.ExchangeSnapshotScheduler} 와 동일 패턴, 배포 단위)
 *
 * <p>손익률 산정은 {@link LiveStrategyService#currentPnlPct} 가 보유 포지션의 현재가를 조회하므로
 * 외부 시세 호출이 발생한다. 하루 1회만 도는 배치라 비용이 제한적이고, 배포별 예외는 격리한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class LiveDeploymentSnapshotScheduler {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final LiveStrategyDeploymentRepository deploymentRepository;
    private final LiveDeploymentEquitySnapshotRepository snapshotRepository;
    private final LiveStrategyService liveStrategyService;

    /** 매일 00:00(KST) — 페이퍼(자정)·실계좌(00:30)와 함께 배포 손익 스냅샷을 적재. */
    @Scheduled(cron = "0 0 0 * * *", zone = "Asia/Seoul")
    public void captureDaily() {
        LocalDate today = LocalDate.now(KST);
        // 정지(STOPPED/ERROR) 배포는 더 이상 가동되지 않으므로 손익 스냅샷에서 제외 —
        // 매일 잔여 포지션 시세를 재조회하는 불필요한 외부 호출(KIS/Bitget/빗썸)을 막는다.
        List<LiveStrategyDeployment> all = deploymentRepository.findByStatusIn(List.of(RUNNING, PAUSED));

        int saved = 0;
        for (LiveStrategyDeployment d : all) {
            try {
                if (snapshotRepository.findByDeploymentIdAndDate(d.getId(), today).isPresent()) {
                    continue; // 이미 오늘치 있으면 중복 방지
                }
                double pnlPct = liveStrategyService.currentPnlPct(d);
                snapshotRepository.save(new LiveDeploymentEquitySnapshot(d.getId(), d.getUserId(), today, pnlPct));
                saved++;
            } catch (Exception e) {
                log.debug("배포 손익 스냅샷 스킵 [{}]: {}", d.getId(), e.getMessage());
            }
        }

        log.info("라이브 배포 손익 스냅샷 완료: {}건 / 전체 {}건", saved, all.size());
    }
}
