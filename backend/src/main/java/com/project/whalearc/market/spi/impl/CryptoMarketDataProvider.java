package com.project.whalearc.market.spi.impl;

import com.project.whalearc.market.domain.AssetType;
import com.project.whalearc.market.dto.CandlestickResponse;
import com.project.whalearc.market.dto.MarketPriceResponse;
import com.project.whalearc.market.service.CandlestickService;
import com.project.whalearc.market.service.CryptoPriceProvider;
import com.project.whalearc.market.spi.MarketDataProvider;
import com.project.whalearc.market.websocket.RealtimePriceHolder;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 코인 — 기존 빗썸 파이프라인(CryptoPriceProvider REST + RealtimePriceHolder WS) 위임.
 *
 * <p>getAllPrices는 REST 스냅샷 위에 실시간 WS 틱을 덮어쓰는 병합을 수행한다
 * (기존 MarketController.getPrices CRYPTO 분기 로직을 그대로 이동).
 * 주의: 다른 소비자(OrderService 등)는 아직 REST-only(getAllKrwTickers)를 쓰므로,
 * Phase 2 이관 시 병합/비병합 의미 차이를 소비자별로 확인해야 한다.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "market.source.crypto.enabled", havingValue = "true", matchIfMissing = true)
public class CryptoMarketDataProvider implements MarketDataProvider {

    private final CryptoPriceProvider cryptoPriceProvider;
    private final RealtimePriceHolder realtimePriceHolder;
    private final CandlestickService candlestickService;

    @Override
    public boolean supports(AssetType assetType) {
        return assetType == AssetType.CRYPTO;
    }

    @Override
    public List<MarketPriceResponse> getAllPrices() {
        // REST 데이터를 기본으로, 실시간 WebSocket 데이터로 덮어쓰기
        List<MarketPriceResponse> restData = cryptoPriceProvider.getAllKrwTickers();
        if (realtimePriceHolder.hasData()) {
            Map<String, MarketPriceResponse> merged = new LinkedHashMap<>();
            for (MarketPriceResponse r : restData) {
                merged.put(r.getSymbol(), r);
            }
            for (MarketPriceResponse rt : realtimePriceHolder.getAllLatestPrices()) {
                merged.put(rt.getSymbol(), rt); // 실시간 데이터로 덮어쓰기
            }
            return new ArrayList<>(merged.values());
        }
        return restData;
    }

    @Override
    public MarketPriceResponse getPrice(String symbol) {
        // getAllPrices의 병합 의미와 일치: 실시간 틱 우선, 없으면 REST 스냅샷에서 조회
        MarketPriceResponse realtime = realtimePriceHolder.getPrice(symbol);
        if (realtime != null) return realtime;
        return cryptoPriceProvider.getAllKrwTickers().stream()
                .filter(p -> p.getSymbol().equals(symbol))
                .findFirst()
                .orElse(null);
    }

    @Override
    public List<CandlestickResponse> getCandles(String symbol, String interval) {
        // CandlestickService는 STOCK/US_STOCK/ETF 외 assetType을 전부 CRYPTO로 처리 (기존 규약)
        return candlestickService.getCandlesticks(symbol, interval, null);
    }

    @Override
    public String getExchange(String symbol) {
        return "BITHUMB_KRW";
    }

    @Override
    public boolean exists(String symbol) {
        return cryptoPriceProvider.getAllKrwTickers().stream()
                .anyMatch(p -> p.getSymbol().equals(symbol));
    }
}
