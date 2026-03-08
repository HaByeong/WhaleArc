package com.project.whalearc.strategy.repository;

import com.project.whalearc.strategy.domain.Strategy;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StrategyRepository extends MongoRepository<Strategy, String> {
    List<Strategy> findByUserIdOrderByCreatedAtDesc(String userId);
}
