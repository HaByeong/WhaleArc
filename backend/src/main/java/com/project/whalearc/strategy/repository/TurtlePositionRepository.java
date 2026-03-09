package com.project.whalearc.strategy.repository;

import com.project.whalearc.strategy.domain.TurtlePosition;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface TurtlePositionRepository extends MongoRepository<TurtlePosition, String> {

    List<TurtlePosition> findByPurchaseId(String purchaseId);

    List<TurtlePosition> findByUserId(String userId);

    Optional<TurtlePosition> findByPurchaseIdAndSymbol(String purchaseId, String symbol);

    /** 포지션이 있는(LONG) 모든 터틀 포지션 조회 — 스케줄러에서 사용 */
    List<TurtlePosition> findByDirection(TurtlePosition.Direction direction);

    void deleteByPurchaseId(String purchaseId);
    void deleteByUserId(String userId);
}
