package com.project.whalearc.trade.repository;

import com.project.whalearc.trade.domain.Portfolio;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface PortfolioRepository extends MongoRepository<Portfolio, String> {
    Optional<Portfolio> findByUserId(String userId);
    List<Portfolio> findByUserIdIn(Collection<String> userIds);
}
