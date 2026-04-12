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
        this(userId, date, portfolio, 0);
    }

    public PortfolioSnapshot(String userId, LocalDate date, Portfolio portfolio, double usdKrwRate) {
        this.userId = userId;
        this.date = date;
        this.cashBalance = portfolio.getCashBalance();
        this.turtleAllocated = portfolio.getTurtleAllocated();

        if (usdKrwRate > 0) {
            this.totalValue = portfolio.getTotalValueWithExchangeRate(usdKrwRate);
            this.returnRate = portfolio.getReturnRateWithExchangeRate(usdKrwRate);
            // 홀딩 가치도 환율 적용
            BigDecimal hv = BigDecimal.ZERO;
            for (Holding h : portfolio.getHoldings()) {
                BigDecimal mv = h.getMarketValue();
                if (h.isUsStock()) mv = mv.multiply(BigDecimal.valueOf(usdKrwRate));
                hv = hv.add(mv);
            }
            this.holdingsValue = hv;
        } else {
            this.totalValue = portfolio.getTotalValue();
            this.returnRate = portfolio.getReturnRate();
            this.holdingsValue = portfolio.getHoldings().stream()
                    .map(Holding::getMarketValue)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
        }
    }
}
