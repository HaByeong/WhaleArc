package com.project.whalearc.trade.domain;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
@Document(collection = "portfolio_snapshots")
@CompoundIndex(name = "userId_date", def = "{'userId': 1, 'date': 1}", unique = true)
public class PortfolioSnapshot {

    @Id
    private String id;

    private String userId;
    private LocalDate date;
    private BigDecimal totalValue;
    private BigDecimal cashBalance;
    private BigDecimal holdingsValue;
    private BigDecimal turtleAllocated;
    private BigDecimal returnRate;

    public PortfolioSnapshot(String userId, LocalDate date, Portfolio portfolio) {
        this.userId = userId;
        this.date = date;
        this.totalValue = portfolio.getTotalValue();
        this.cashBalance = portfolio.getCashBalance();
        this.holdingsValue = portfolio.getHoldings().stream()
                .map(Holding::getMarketValue)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        this.turtleAllocated = portfolio.getTurtleAllocated();
        this.returnRate = portfolio.getReturnRate();
    }
}
