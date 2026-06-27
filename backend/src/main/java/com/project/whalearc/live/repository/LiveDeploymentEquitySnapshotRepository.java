package com.project.whalearc.live.repository;

import com.project.whalearc.live.domain.LiveDeploymentEquitySnapshot;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface LiveDeploymentEquitySnapshotRepository extends MongoRepository<LiveDeploymentEquitySnapshot, String> {

    /** 오늘치 스냅샷 존재 여부(중복 저장 방지). */
    Optional<LiveDeploymentEquitySnapshot> findByDeploymentIdAndDate(String deploymentId, LocalDate date);

    /** 배포의 최근 24일 손익 스냅샷(최신순) — 스파크라인용. 핫패스라 상한을 둔다(서비스에서 과거→현재로 뒤집어 사용). */
    List<LiveDeploymentEquitySnapshot> findTop24ByDeploymentIdOrderByDateDesc(String deploymentId);

    /** 배포 삭제 시 스냅샷 정리. */
    void deleteByDeploymentId(String deploymentId);
}
