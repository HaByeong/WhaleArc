package com.project.whalearc.market.dto;

import com.project.whalearc.market.domain.AssetType;
import lombok.Getter;
import lombok.Setter;

/**
 * 공통 시세 응답 DTO
 * - 주식/코인 모두 이 형태로 내려서 프론트는 assetType으로만 구분하도록 한다.
 */
@Getter
@Setter
public class MarketPriceResponse {

    private AssetType assetType; // STOCK or CRYPTO
    private String symbol;       // 종목 코드 or 코인 심볼 (005930, BTC 등)
    private String name;         // 종목/코인 이름
    private double price;        // 현재가
    private double change;       // 전일 대비 절대값
    private double changeRate;   // 전일 대비 %
    private long volume;         // 거래량 (24h 등)
    private String market;       // KRX, BITHUMB_KRW 등
}

