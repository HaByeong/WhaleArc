package com.project.whalearc.store.repository;

import com.project.whalearc.store.domain.ProductPurchase;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProductPurchaseRepository extends MongoRepository<ProductPurchase, String> {
    List<ProductPurchase> findByUserIdOrderByPurchasedAtDesc(String userId);
    Optional<ProductPurchase> findByUserIdAndProductIdAndStatus(String userId, String productId, ProductPurchase.Status status);
    boolean existsByUserIdAndProductIdAndStatus(String userId, String productId, ProductPurchase.Status status);
    void deleteByUserId(String userId);
}
