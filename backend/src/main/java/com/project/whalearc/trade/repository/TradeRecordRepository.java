package com.project.whalearc.trade.repository;

import com.project.whalearc.trade.domain.TradeRecord;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TradeRecordRepository extends MongoRepository<TradeRecord, String> {
    List<TradeRecord> findByUserIdOrderByExecutedAtDesc(String userId);
    void deleteByUserId(String userId);
}
