package com.project.whalearc.market.spi.impl;

import com.project.whalearc.market.domain.AssetType;
import com.project.whalearc.market.dto.CandlestickResponse;
import com.project.whalearc.market.dto.MarketPriceResponse;
import com.project.whalearc.market.service.CandlestickService;
import com.project.whalearc.market.service.UsEtfPriceProvider;
import com.project.whalearc.market.spi.MarketDataProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.List;

/** 미국 ETF — 기존 KIS 해외 파이프라인(UsEtfPriceProvider·CandlestickService) 위임. */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "market.source.etf.enabled", havingValue = "true", matchIfMissing = true)
public class EtfMarketDataProvider implements MarketDataProvider {

    private final UsEtfPriceProvider usEtfPriceProvider;
    private final CandlestickService candlestickService;

    @Override
    public boolean supports(AssetType assetType) {
        return assetType == AssetType.ETF;
    }

    @Override
    public List<MarketPriceResponse> getAllPrices() {
        return usEtfPriceProvider.getAllEtfPrices();
    }

    @Override
    public MarketPriceResponse getPrice(String symbol) {
        return usEtfPriceProvider.getEtfPriceBySymbol(symbol);
    }

    @Override
    public List<CandlestickResponse> getCandles(String symbol, String interval) {
        return candlestickService.getCandlesticks(symbol, interval, "ETF");
    }

    @Override
    public String getExchange(String symbol) {
        return usEtfPriceProvider.getExchange(symbol);
    }

    @Override
    public boolean exists(String symbol) {
        return usEtfPriceProvider.exists(symbol);
    }
}
