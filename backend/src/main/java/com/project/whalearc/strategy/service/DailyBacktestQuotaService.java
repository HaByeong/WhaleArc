package com.project.whalearc.strategy.service;

import com.project.whalearc.user.policy.TierPolicy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

/**
 * 유저별 일일 백테스트 실행 횟수 카운터 — 인메모리, KST 날짜 기준 자동 리셋.
 *
 * <p>prod는 EC2 단일 인스턴스라 인메모리로 충분하고, 일일 쿼터는 보안이 아닌 부하/비용 방어이므로
 * 재시작 시 리셋되어도(사용자에게 유리) 무방하다. {@link com.project.whalearc.common.filter.RateLimitingFilter}의
 * {@link ConcurrentHashMap} 카운터 패턴을 차용. PRO(무제한)는 맵에 기록조차 하지 않아 메모리를 아낀다.
 */
@Slf4j
@Component
public class DailyBacktestQuotaService {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final Map<String, DayCounter> counters = new ConcurrentHashMap<>();
    private final Supplier<LocalDate> today;

    public DailyBacktestQuotaService() {
        this(() -> LocalDate.now(KST));
    }

    /** 테스트용 — 오늘 날짜 공급자를 주입해 날짜 경계 동작을 검증할 수 있다. */
    DailyBacktestQuotaService(Supplier<LocalDate> today) {
        this.today = today;
    }

    /**
     * 오늘 한도가 남아 있으면 1회 소비하고 true, 한도 초과면 소비 없이 false.
     * limit이 {@link TierPolicy#UNLIMITED}면 즉시 통과(미기록).
     */
    public boolean tryConsume(String userId, int limit) {
        if (limit == TierPolicy.UNLIMITED) return true;
        String dayKey = today.get().toString();
        DayCounter counter = counters.computeIfAbsent(userId, k -> new DayCounter(dayKey));
        synchronized (counter) {
            if (!counter.dayKey.equals(dayKey)) {
                counter.dayKey = dayKey;
                counter.count = 0;
            }
            if (counter.count >= limit) return false;
            counter.count++;
            return true;
        }
    }

    /**
     * 지난 날짜 엔트리 제거(메모리 누수 방지). 매시간 1회.
     *
     * <p>tryConsume의 computeIfAbsent와 eviction이 자정 경계에서 동시에 도는 극히 드문 경합에서
     * 방금 차감한 카운터가 제거될 수 있으나, tryConsume이 항상 today.get() 기준 dayKey로 카운터를
     * 재검증·재생성하므로(47·49라인) 한도가 비정상 허용될 여지는 사실상 없다(동작 영향 미미).
     */
    @Scheduled(fixedDelay = 3_600_000L)
    void evictStaleCounters() {
        String dayKey = today.get().toString();
        int before = counters.size();
        for (Iterator<Map.Entry<String, DayCounter>> it = counters.entrySet().iterator(); it.hasNext(); ) {
            DayCounter c = it.next().getValue();
            synchronized (c) {
                if (!c.dayKey.equals(dayKey)) it.remove();
            }
        }
        int removed = before - counters.size();
        if (removed > 0) log.debug("일일 백테스트 쿼터 카운터 {}건 정리(전날 엔트리)", removed);
    }

    private static final class DayCounter {
        private String dayKey;
        private int count;

        DayCounter(String dayKey) {
            this.dayKey = dayKey;
        }
    }
}
