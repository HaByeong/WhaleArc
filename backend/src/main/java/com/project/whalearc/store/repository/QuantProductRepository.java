package com.project.whalearc.store.repository;

import com.project.whalearc.store.domain.QuantProduct;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.data.mongodb.repository.Update;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface QuantProductRepository extends MongoRepository<QuantProduct, String> {
    List<QuantProduct> findByActiveTrueOrderBySubscribersDesc();
    List<QuantProduct> findByCategoryAndActiveTrueOrderBySubscribersDesc(QuantProduct.Category category);

    // 원자적 $inc — 서로 다른 유저가 같은 상품을 동시 구매할 때 구독자 수 lost-update 방지
    @Query("{ '_id': ?0 }")
    @Update("{ '$inc': { 'subscribers': 1 } }")
    void incrementSubscribers(String id);

    // 원자적 $inc(-1) — subscribers>0 일 때만 감소해 음수 방지. 취소 경합 시 lost-update 방지(증가와 동일 규약).
    @Query("{ '_id': ?0, 'subscribers': { $gt: 0 } }")
    @Update("{ '$inc': { 'subscribers': -1 } }")
    void decrementSubscribers(String id);
}
