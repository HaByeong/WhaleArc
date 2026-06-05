package com.project.whalearc.trade.repository;

import com.project.whalearc.trade.domain.Order;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OrderRepository extends MongoRepository<Order, String> {
    List<Order> findByUserIdOrderByCreatedAtDesc(String userId);
    List<Order> findByStatusAndOrderMethod(Order.OrderStatus status, Order.OrderMethod orderMethod);
    Optional<Order> findByUserIdAndClientOrderId(String userId, String clientOrderId); // 멱등성 조회
    void deleteByUserId(String userId);
}
