package com.project.whalearc.live.repository;

import com.project.whalearc.live.domain.LiveStrategyDeployment;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface LiveStrategyDeploymentRepository extends MongoRepository<LiveStrategyDeployment, String> {

    List<LiveStrategyDeployment> findByUserIdOrderByCreatedAtDesc(String userId);

    /** 스케줄러 진입점: RUNNING 배포만 인덱스 쿼리로 조회 (터틀 findAll 풀스캔 회피). */
    List<LiveStrategyDeployment> findByStatus(LiveStrategyDeployment.Status status);

    /** 본인 소유 검증과 단건 조회를 한 번에. */
    Optional<LiveStrategyDeployment> findByIdAndUserId(String id, String userId);
}
