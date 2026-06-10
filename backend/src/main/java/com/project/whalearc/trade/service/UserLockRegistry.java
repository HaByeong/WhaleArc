package com.project.whalearc.trade.service;

import org.springframework.stereotype.Component;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;
import java.util.function.Supplier;

/**
 * 유저별 단일 재진입 락(ReentrantLock) 레지스트리.
 *
 * 한 유저의 포트폴리오를 변경하는 모든 경로(주문 체결, 스토어 구매/취소, 대표 항로 설정, 리셋)가
 * 이 레지스트리의 "동일한" 락을 공유하도록 하여 read-modify-write 의 lost-update 를 방지한다.
 * (이전에는 OrderService 와 PortfolioService 가 각자 별도 락맵을 사용해 서로 직렬화되지 않았다.)
 *
 * ReentrantLock 이므로 같은 스레드의 중첩 호출(예: placeOrder → getOrCreatePortfolio)은 안전하다.
 */
@Component
public class UserLockRegistry {

    private static final int MAX_LOCKS = 10_000;
    private final ConcurrentHashMap<String, ReentrantLock> userLocks = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Long> lockLastUsed = new ConcurrentHashMap<>();

    public ReentrantLock getUserLock(String userId) {
        lockLastUsed.put(userId, System.currentTimeMillis());
        if (userLocks.size() > MAX_LOCKS) {
            long expiry = System.currentTimeMillis() - 600_000; // 10분 미사용 락 정리
            lockLastUsed.entrySet().removeIf(e -> {
                if (e.getValue() < expiry) {
                    ReentrantLock lock = userLocks.get(e.getKey());
                    if (lock != null && !lock.isLocked()) {
                        userLocks.remove(e.getKey());
                        return true;
                    }
                }
                return false;
            });
        }
        return userLocks.computeIfAbsent(userId, k -> new ReentrantLock());
    }

    /** 유저 락을 잡고 작업 수행 후 반환값 전달 (재진입 안전). */
    public <T> T withLock(String userId, Supplier<T> work) {
        ReentrantLock lock = getUserLock(userId);
        lock.lock();
        try {
            return work.get();
        } finally {
            lock.unlock();
        }
    }

    /** 유저 락을 잡고 작업 수행 (반환값 없음). */
    public void withLock(String userId, Runnable work) {
        withLock(userId, () -> {
            work.run();
            return null;
        });
    }
}
