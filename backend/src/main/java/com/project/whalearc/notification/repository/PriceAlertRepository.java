package com.project.whalearc.notification.repository;

import com.project.whalearc.notification.domain.PriceAlert;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PriceAlertRepository extends MongoRepository<PriceAlert, String> {
    List<PriceAlert> findByUserIdAndActiveTrue(String userId);
    List<PriceAlert> findByActiveTrueAndTriggeredFalse();
    long countByUserIdAndActiveTrue(String userId);
}
