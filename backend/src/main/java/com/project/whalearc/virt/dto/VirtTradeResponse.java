package com.project.whalearc.virt.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class VirtTradeResponse {
    private String orderId;
    private String stockCode;
    private String stockName;
    private String orderType;     // "BUY" or "SELL"
    private int quantity;
    private long price;
    private long totalAmount;
    private String executedAt;    // 체결시각
    private String status;        // 체결상태
}
