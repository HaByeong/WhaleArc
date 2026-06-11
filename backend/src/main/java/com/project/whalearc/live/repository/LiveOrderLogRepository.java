package com.project.whalearc.live.repository;

import com.project.whalearc.live.domain.LiveOrderLog;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface LiveOrderLogRepository extends MongoRepository<LiveOrderLog, String> {

    /** 멱등성 체크: 같은 봉의 동일 (배포·심볼·방향) 주문이 이미 기록됐는지. */
    boolean existsByClientOrderId(String clientOrderId);

    /** 배포의 체결 로그(최신순) — 상세 화면/감사용. */
    List<LiveOrderLog> findByDeploymentIdOrderByCreatedAtDesc(String deploymentId);

    /** 배포 삭제 시 해당 배포의 주문 로그를 함께 정리. */
    void deleteByDeploymentId(String deploymentId);
}
