package com.project.whalearc.market.spi.impl;

import com.project.whalearc.market.domain.AssetType;
import com.project.whalearc.market.dto.CandlestickResponse;
import com.project.whalearc.market.dto.MarketPriceResponse;
import com.project.whalearc.market.service.CandlestickService;
import com.project.whalearc.market.service.UsStockPriceProvider;
import com.project.whalearc.market.spi.MarketDataProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.List;

/** 미국주식 — 기존 KIS 해외 파이프라인(UsStockPriceProvider·CandlestickService) 위임. */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "market.source.us-stock.enabled", havingValue = "true", matchIfMissing = true)
public class UsStockMarketDataProvider implements MarketDataProvider {

    private final UsStockPriceProvider usStockPriceProvider;
    private final CandlestickService candlestickService;

    @Override
    public boolean supports(AssetType assetType) {
        return assetType == AssetType.US_STOCK;
    }

    @Override
    public List<MarketPriceResponse> getAllPrices() {
        return usStockPriceProvider.getAllUsStockPrices();
    }

    @Override
    public MarketPriceResponse getPrice(String symbol) {
        return usStockPriceProvider.getUsStockPriceBySymbol(symbol);
    }

    @Override
    public List<CandlestickResponse> getCandles(String symbol, String interval) {
        return candlestickService.getCandlesticks(symbol, interval, "US_STOCK");
    }

    @Override
    public String getExchange(String symbol) {
        return usStockPriceProvider.getExchange(symbol);
    }

    @Override
    public boolean exists(String symbol) {
        return usStockPriceProvider.exists(symbol);
    }
}
