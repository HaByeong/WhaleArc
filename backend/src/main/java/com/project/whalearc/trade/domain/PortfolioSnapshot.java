package com.project.whalearc.trade.domain;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

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
    private double totalValue;
    private double cashBalance;
    private double holdingsValue;
    private double turtleAllocated;
    private double returnRate;

    public PortfolioSnapshot(String userId, LocalDate date, Portfolio portfolio) {
        this.userId = userId;
        this.date = date;
        this.totalValue = portfolio.getTotalValue();
        this.cashBalance = portfolio.getCashBalance();
        this.holdingsValue = portfolio.getHoldings().stream()
                .mapToDouble(Holding::getMarketValue).sum();
        this.turtleAllocated = portfolio.getTurtleAllocated();
        this.returnRate = portfolio.getReturnRate();
    }
}
