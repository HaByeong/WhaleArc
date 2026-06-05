package com.project.whalearc.exchange.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class ExchangeAccountRequestDto {
    private String exchangeType; // KIS, UPBIT, BITGET
    private String apiKey;
    private String secretKey;
    private String appSecret;      // KIS 전용
    private String accountNumber;  // KIS 전용
}
