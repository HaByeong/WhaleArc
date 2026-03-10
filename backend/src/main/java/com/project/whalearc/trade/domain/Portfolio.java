package com.project.whalearc.trade.domain;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.math.RoundingMode;
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

    private BigDecimal cashBalance;

    private BigDecimal initialCash; // 초기 자산 (DB에 저장)

    private List<Holding> holdings = new ArrayList<>();

    /** 터틀 전략에 할당된 현금 (cashBalance에서 차감되었지만 자산으로 포함) */
    private BigDecimal turtleAllocated;

    /** 대표 항로 구매 ID (투자 현황에 공개) */
    private String representativePurchaseId;

    public Portfolio(String userId, BigDecimal cashBalance) {
        this.userId = userId;
        this.cashBalance = cashBalance;
        this.initialCash = cashBalance;
        this.turtleAllocated = BigDecimal.ZERO;
    }

    public BigDecimal getTotalValue() {
        BigDecimal holdingsValue = holdings.stream()
                .map(Holding::getMarketValue)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return cashBalance.add(holdingsValue).add(turtleAllocated);
    }

    public BigDecimal getReturnRate() {
        BigDecimal initial = (initialCash.compareTo(BigDecimal.ZERO) > 0)
                ? initialCash : BigDecimal.valueOf(10_000_000);
        BigDecimal current = getTotalValue();
        if (initial.compareTo(BigDecimal.ZERO) == 0) return BigDecimal.ZERO;
        return current.subtract(initial)
                .divide(initial, 10, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100));
    }
}
