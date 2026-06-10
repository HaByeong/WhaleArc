package com.project.whalearc.exchange.domain;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 실계좌(거래소) 자산 일별 스냅샷.
 * 연결된 모든 거래소의 평가금액(KRW 정규화)을 합산해 유저·날짜별 1건 저장 →
 * 실계좌 포트폴리오 화면의 '자산 추이' 그래프 데이터로 사용.
 * (페이퍼 PortfolioSnapshot 과 동일 패턴, 거래소 합계만 보관)
 */
@Getter
@Setter
@NoArgsConstructor
@Document(collection = "exchange_portfolio_snapshots")
@CompoundIndex(name = "userId_date", def = "{'userId': 1, 'date': 1}", unique = true)
public class ExchangePortfolioSnapshot {

    @Id
    private String id;

    private String userId;
    private LocalDate date;
    private double totalValueKrw;   // 연결된 모든 거래소 평가금액 합계(KRW 정규화)
    private String createdAt;

    public ExchangePortfolioSnapshot(String userId, LocalDate date, double totalValueKrw) {
        this.userId = userId;
        this.date = date;
        this.totalValueKrw = totalValueKrw;
        this.createdAt = LocalDateTime.now().toString();
    }
}
