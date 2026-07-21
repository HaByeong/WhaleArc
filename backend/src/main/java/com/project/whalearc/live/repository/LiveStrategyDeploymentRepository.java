package com.project.whalearc.live.repository;

import com.project.whalearc.live.domain.LiveStrategyDeployment;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface LiveStrategyDeploymentRepository extends MongoRepository<LiveStrategyDeployment, String> {

    List<LiveStrategyDeployment> findByUserIdOrderByCreatedAtDesc(String userId);

    /** 스케줄러 진입점: RUNNING 배포만 인덱스 쿼리로 조회 (터틀 findAll 풀스캔 회피). */
    List<LiveStrategyDeployment> findByStatus(LiveStrategyDeployment.Status status);

    /**
     * Model A(기기 실행형) 실행 스케줄러 진입점 — 서버는 모의(PAPER)만 실행한다.
     * 실계좌(LIVE) 자동매매는 사용자 기기가 로컬 키로 실행하므로 서버는 절대 주문을 내지 않는다(투자일임업 회피 불변식).
     */
    List<LiveStrategyDeployment> findByStatusAndAccountMode(LiveStrategyDeployment.Status status,
                                                            LiveStrategyDeployment.AccountMode accountMode);

    /** 손익 스냅샷 스케줄러: 활성(RUNNING/PAUSED) 배포만 조회 — 정지 배포의 불필요한 외부 시세 호출 회피. */
    List<LiveStrategyDeployment> findByStatusIn(Collection<LiveStrategyDeployment.Status> statuses);

    /** 자금 예약 가드: 유저의 활성(RUNNING/PAUSED) 배포 — 할당금 합산에 사용. */
    List<LiveStrategyDeployment> findByUserIdAndStatusIn(String userId, Collection<LiveStrategyDeployment.Status> statuses);

    /** 등급 한도(동시 실거래 전략 수): 유저의 특정 모드(LIVE)·활성 상태 배포 개수. */
    long countByUserIdAndAccountModeAndStatusIn(String userId, LiveStrategyDeployment.AccountMode accountMode,
                                                Collection<LiveStrategyDeployment.Status> statuses);

    /** 본인 소유 검증과 단건 조회를 한 번에. */
    Optional<LiveStrategyDeployment> findByIdAndUserId(String id, String userId);
}
