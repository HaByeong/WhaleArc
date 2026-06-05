package com.project.whalearc.exchange.repository;

import com.project.whalearc.exchange.domain.ExchangeAccount;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ExchangeAccountRepository extends MongoRepository<ExchangeAccount, String> {

    List<ExchangeAccount> findByUserId(String userId);

    Optional<ExchangeAccount> findByUserIdAndExchangeType(String userId, String exchangeType);

    void deleteByUserIdAndExchangeType(String userId, String exchangeType);
}
