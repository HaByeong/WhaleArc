package com.project.whalearc.trade.domain;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@Document(collection = "portfolios")
public class Portfolio {

    @Id
    private String id;

    @Indexed(unique = true)
    private String userId; // supabaseId

    private double cashBalance;

    private double initialCash; // 초기 자산 (DB에 저장)

    private List<Holding> holdings = new ArrayList<>();

    public Portfolio(String userId, double cashBalance) {
        this.userId = userId;
        this.cashBalance = cashBalance;
        this.initialCash = cashBalance;
    }

    public double getTotalValue() {
        double holdingsValue = holdings.stream()
                .mapToDouble(Holding::getMarketValue)
                .sum();
        return cashBalance + holdingsValue;
    }

    public double getReturnRate() {
        double initial = (initialCash > 0) ? initialCash : 10_000_000;
        double current = getTotalValue();
        if (initial == 0) return 0;
        return ((current - initial) / initial) * 100;
    }
}
