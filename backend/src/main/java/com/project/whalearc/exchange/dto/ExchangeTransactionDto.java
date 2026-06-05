package com.project.whalearc.exchange.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 거래소 체결 내역 1건 (현재 KIS 주식 체결만 지원).
 * KIS inquire-daily-ccld(TTTC8001R) output1 → 매핑.
 */
@Getter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ExchangeTransactionDto {
    private String orderId;     // odno
    private String stockCode;   // pdno
    private String stockName;   // prdt_name
    private String side;        // BUY(매수, 02) / SELL(매도)
    private double quantity;    // tot_ccld_qty
    private double price;       // avg_prvs (체결평균가)
    private double totalAmount; // tot_ccld_amt
    private String executedAt;  // ord_dt + ord_tmd
    private String status;      // FILLED / PENDING
}
