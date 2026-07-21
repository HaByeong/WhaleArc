package com.project.whalearc.market.spi.impl;

import com.project.whalearc.market.domain.AssetType;
import com.project.whalearc.market.service.CandlestickService;
import com.project.whalearc.market.service.UsEtfPriceProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** 기존 UsEtfPriceProvider/CandlestickService에 1:1 위임하는지 검증. */
class EtfMarketDataProviderTest {

    private UsEtfPriceProvider usEtfPriceProvider;
    private CandlestickService candlestickService;
    private EtfMarketDataProvider provider;

    @BeforeEach
    void setUp() {
        usEtfPriceProvider = mock(UsEtfPriceProvider.class);
        candlestickService = mock(CandlestickService.class);
        provider = new EtfMarketDataProvider(usEtfPriceProvider, candlestickService);
    }

    @Test
    void supports는_ETF만() {
        assertTrue(provider.supports(AssetType.ETF));
        assertFalse(provider.supports(AssetType.US_STOCK));
    }

    @Test
    void 각_메서드는_기존_프로바이더에_그대로_위임() {
        provider.getAllPrices();
        verify(usEtfPriceProvider).getAllEtfPrices();

        provider.getPrice("SPY");
        verify(usEtfPriceProvider).getEtfPriceBySymbol("SPY");

        provider.getExchange("SPY");
        verify(usEtfPriceProvider).getExchange("SPY");

        provider.exists("SPY");
        verify(usEtfPriceProvider).exists("SPY");
    }

    @Test
    void 캔들은_ETF_문자열로_위임() {
        provider.getCandles("SPY", "1d");
        verify(candlestickService).getCandlesticks("SPY", "1d", "ETF");
    }
}
