package com.project.whalearc.exchange.domain;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Getter
@Setter
@NoArgsConstructor
@Document(collection = "exchange_accounts")
public class ExchangeAccount {

    @Id
    private String id;

    private String userId;

    // KIS, UPBIT, BITGET
    private String exchangeType;

    private String apiKey;

    private String secretKey;

    // KIS 전용: 앱시크릿, 계좌번호
    private String appSecret;
    private String accountNumber;

    private boolean connected;

    private String createdAt;
    private String updatedAt;

    public ExchangeAccount(String userId, String exchangeType, String apiKey, String secretKey) {
        this.userId = userId;
        this.exchangeType = exchangeType;
        this.apiKey = apiKey;
        this.secretKey = secretKey;
        this.connected = false;
    }
}
