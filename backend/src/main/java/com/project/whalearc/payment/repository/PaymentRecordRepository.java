package com.project.whalearc.payment.repository;

import com.project.whalearc.payment.domain.PaymentRecord;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PaymentRecordRepository extends MongoRepository<PaymentRecord, String> {

    List<PaymentRecord> findByUserIdOrderByRequestedAtDesc(String userId);

    Optional<PaymentRecord> findByOrderId(String orderId);
}
