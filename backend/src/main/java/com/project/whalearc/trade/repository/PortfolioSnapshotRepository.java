package com.project.whalearc.trade.repository;

import com.project.whalearc.trade.domain.PortfolioSnapshot;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface PortfolioSnapshotRepository extends MongoRepository<PortfolioSnapshot, String> {

    List<PortfolioSnapshot> findByUserIdAndDateBetweenOrderByDateAsc(
            String userId, LocalDate from, LocalDate to);

    Optional<PortfolioSnapshot> findByUserIdAndDate(String userId, LocalDate date);

    List<PortfolioSnapshot> findByUserIdOrderByDateAsc(String userId);
    void deleteByUserId(String userId);

    /** 특정 날짜의 모든 유저 스냅샷 조회 (기간별 랭킹 계산용) */
    List<PortfolioSnapshot> findByDate(LocalDate date);
}
