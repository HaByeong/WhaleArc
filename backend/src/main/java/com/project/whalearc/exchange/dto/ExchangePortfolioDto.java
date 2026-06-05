package com.project.whalearc.exchange.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
public class ExchangePortfolioDto {
    private String exchangeType;
    private boolean connected;
    private double totalValue;        // 총 평가금액
    private double totalProfitLoss;   // 총 손익
    private double totalReturnRate;   // 총 수익률
    private double cashBalance;       // 예수금
    private List<ExchangeHoldingDto> holdings;
    private double usdtKrwRate;       // BITGET: USDT→KRW 환산에 쓴 환율 (0이면 미적용)
    private boolean fetchOk = true;   // 실제 거래소 API 조회 성공 여부 (false면 실패/staleness → 빈 계좌와 구분)

    // 기존 7-arg 생성자 유지 (KIS/UPBIT/BITGET 호출부 호환) — usdtKrwRate 는 setter 로 주입
    public ExchangePortfolioDto(String exchangeType, boolean connected, double totalValue,
                                double totalProfitLoss, double totalReturnRate, double cashBalance,
                                List<ExchangeHoldingDto> holdings) {
        this.exchangeType = exchangeType;
        this.connected = connected;
        this.totalValue = totalValue;
        this.totalProfitLoss = totalProfitLoss;
        this.totalReturnRate = totalReturnRate;
        this.cashBalance = cashBalance;
        this.holdings = holdings;
    }
}
