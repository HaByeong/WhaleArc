package com.project.whalearc.strategy.repository;

import com.project.whalearc.strategy.domain.SavedBacktest;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SavedBacktestRepository extends MongoRepository<SavedBacktest, String> {
    List<SavedBacktest> findByUserIdOrderByCreatedAtDesc(String userId);
    long countByUserId(String userId);
    void deleteByUserId(String userId);
}
