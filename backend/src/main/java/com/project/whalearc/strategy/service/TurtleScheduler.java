package com.project.whalearc.strategy.service;

import com.project.whalearc.strategy.domain.TurtlePosition;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 1시간마다 모든 활성 터틀 포지션의 시그널을 체크하고 자동 매매를 수행합니다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TurtleScheduler {

    private final TurtleStrategyService strategyService;

    /**
     * 매 정시 (1시간 간격)에 터틀 시그널 체크
     */
    @Scheduled(cron = "0 0 * * * *")
    public void checkTurtleSignals() {
        List<TurtlePosition> allPositions = strategyService.getAllActivePositions();
        if (allPositions.isEmpty()) return;

        log.info("터틀 스케줄러: {}개 포지션 시그널 체크 시작", allPositions.size());
        int executed = 0;

        for (TurtlePosition pos : allPositions) {
            try {
                strategyService.checkAndExecute(pos);
                executed++;
            } catch (Exception e) {
                log.error("터틀 시그널 체크 실패: userId={}, symbol={}, error={}",
                        pos.getUserId(), pos.getSymbol(), e.getMessage());
            }
        }

        log.info("터틀 스케줄러: {}개 포지션 처리 완료", executed);
    }
}
