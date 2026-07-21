package com.project.whalearc.market.spi.impl;

import com.project.whalearc.market.domain.AssetType;
import com.project.whalearc.market.dto.CandlestickResponse;
import com.project.whalearc.market.dto.MarketPriceResponse;
import com.project.whalearc.market.service.CandlestickService;
import com.project.whalearc.market.service.StockMasterService;
import com.project.whalearc.market.service.StockPriceProvider;
import com.project.whalearc.market.spi.MarketDataProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.List;

/** 국내주식 — 기존 KIS 서버키 파이프라인(StockPriceProvider·CandlestickService) 위임. */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "market.source.stock.enabled", havingValue = "true", matchIfMissing = true)
public class StockMarketDataProvider implements MarketDataProvider {

    private final StockPriceProvider stockPriceProvider;
    private final CandlestickService candlestickService;
    private final StockMasterService stockMasterService;

    @Override
    public boolean supports(AssetType assetType) {
        return assetType == AssetType.STOCK;
    }

    @Override
    public List<MarketPriceResponse> getAllPrices() {
        return stockPriceProvider.getAllStockPrices();
    }

    @Override
    public MarketPriceResponse getPrice(String symbol) {
        return stockPriceProvider.getStockPriceByCode(symbol, stockMasterService.getStockName(symbol));
    }

    @Override
    public List<CandlestickResponse> getCandles(String symbol, String interval) {
        return candlestickService.getCandlesticks(symbol, interval, "STOCK");
    }

    @Override
    public String getExchange(String symbol) {
        return "KRX";
    }

    @Override
    public boolean exists(String symbol) {
        return stockMasterService.exists(symbol);
    }
}
