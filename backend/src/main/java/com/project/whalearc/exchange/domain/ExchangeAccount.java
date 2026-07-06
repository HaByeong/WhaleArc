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

    // Model A/INV-1(β): 기기가 보고한 잔고 스냅샷(ExchangePortfolioDto JSON). 서버는 키로 조회하지 않고 이 값을 표시한다.
    // (전환기: 이 값이 없으면 저장 키로 조회하는 기존 경로로 폴백. 키 완전 제거 시 폴백도 제거.)
    private String reportedPortfolioJson;
    private String balanceReportedAt;

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
