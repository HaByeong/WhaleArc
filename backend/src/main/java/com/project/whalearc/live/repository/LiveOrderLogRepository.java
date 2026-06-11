package com.project.whalearc.live.repository;

import com.project.whalearc.live.domain.LiveOrderLog;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface LiveOrderLogRepository extends MongoRepository<LiveOrderLog, String> {

    /** 멱등성 체크: 같은 봉의 동일 (배포·심볼·방향) 주문이 이미 기록됐는지. */
    boolean existsByClientOrderId(String clientOrderId);

    /** 배포의 체결 로그(최신순) — 상세 화면/감사용. */
    List<LiveOrderLog> findByDeploymentIdOrderByCreatedAtDesc(String deploymentId);

    /** 배포의 가장 최근 주문 1건 — 카드의 '최근 신호' 표시용. */
    Optional<LiveOrderLog> findFirstByDeploymentIdOrderByCreatedAtDesc(String deploymentId);

    /** 특정 시각 이후 해당 상태 주문 수 — '오늘 체결(FILLED)' 집계용. */
    long countByDeploymentIdAndStatusAndCreatedAtGreaterThanEqual(String deploymentId, String status, Instant from);

    /** 배포 삭제 시 해당 배포의 주문 로그를 함께 정리. */
    void deleteByDeploymentId(String deploymentId);
}
