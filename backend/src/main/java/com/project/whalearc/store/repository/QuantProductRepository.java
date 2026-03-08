package com.project.whalearc.store.repository;

import com.project.whalearc.store.domain.QuantProduct;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface QuantProductRepository extends MongoRepository<QuantProduct, String> {
    List<QuantProduct> findByActiveTrueOrderBySubscribersDesc();
    List<QuantProduct> findByCategoryAndActiveTrueOrderBySubscribersDesc(QuantProduct.Category category);
}
