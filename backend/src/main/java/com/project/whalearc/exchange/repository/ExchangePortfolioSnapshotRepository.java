package com.project.whalearc.exchange.repository;

import com.project.whalearc.exchange.domain.ExchangePortfolioSnapshot;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface ExchangePortfolioSnapshotRepository extends MongoRepository<ExchangePortfolioSnapshot, String> {

    List<ExchangePortfolioSnapshot> findByUserIdAndDateBetweenOrderByDateAsc(
            String userId, LocalDate from, LocalDate to);

    Optional<ExchangePortfolioSnapshot> findByUserIdAndDate(String userId, LocalDate date);
}
