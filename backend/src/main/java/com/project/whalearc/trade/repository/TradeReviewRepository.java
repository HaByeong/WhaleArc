package com.project.whalearc.trade.repository;

import com.project.whalearc.trade.domain.TradeReview;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TradeReviewRepository extends MongoRepository<TradeReview, String> {
    List<TradeReview> findByUserId(String userId);
}
