package com.project.whalearc.market.spi.impl;

import com.project.whalearc.market.domain.AssetType;
import com.project.whalearc.market.service.CandlestickService;
import com.project.whalearc.market.service.UsStockPriceProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** 기존 UsStockPriceProvider/CandlestickService에 1:1 위임하는지 검증. */
class UsStockMarketDataProviderTest {

    private UsStockPriceProvider usStockPriceProvider;
    private CandlestickService candlestickService;
    private UsStockMarketDataProvider provider;

    @BeforeEach
    void setUp() {
        usStockPriceProvider = mock(UsStockPriceProvider.class);
        candlestickService = mock(CandlestickService.class);
        provider = new UsStockMarketDataProvider(usStockPriceProvider, candlestickService);
    }

    @Test
    void supports는_US_STOCK만() {
        assertTrue(provider.supports(AssetType.US_STOCK));
        assertFalse(provider.supports(AssetType.ETF));
    }

    @Test
    void 각_메서드는_기존_프로바이더에_그대로_위임() {
        provider.getAllPrices();
        verify(usStockPriceProvider).getAllUsStockPrices();

        provider.getPrice("AAPL");
        verify(usStockPriceProvider).getUsStockPriceBySymbol("AAPL");

        provider.getExchange("AAPL");
        verify(usStockPriceProvider).getExchange("AAPL");

        provider.exists("AAPL");
        verify(usStockPriceProvider).exists("AAPL");
    }

    @Test
    void 캔들은_US_STOCK_문자열로_위임() {
        provider.getCandles("AAPL", "1d");
        verify(candlestickService).getCandlesticks("AAPL", "1d", "US_STOCK");
    }
}
