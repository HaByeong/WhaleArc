package com.project.whalearc.market.spi.impl;

import com.project.whalearc.market.domain.AssetType;
import com.project.whalearc.market.dto.MarketPriceResponse;
import com.project.whalearc.market.service.CandlestickService;
import com.project.whalearc.market.service.StockMasterService;
import com.project.whalearc.market.service.StockPriceProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** 기존 StockPriceProvider/CandlestickService에 1:1 위임하는지 검증. */
class StockMarketDataProviderTest {

    private StockPriceProvider stockPriceProvider;
    private CandlestickService candlestickService;
    private StockMasterService stockMasterService;
    private StockMarketDataProvider provider;

    @BeforeEach
    void setUp() {
        stockPriceProvider = mock(StockPriceProvider.class);
        candlestickService = mock(CandlestickService.class);
        stockMasterService = mock(StockMasterService.class);
        provider = new StockMarketDataProvider(stockPriceProvider, candlestickService, stockMasterService);
    }

    @Test
    void supports는_STOCK만() {
        assertTrue(provider.supports(AssetType.STOCK));
        assertFalse(provider.supports(AssetType.CRYPTO));
    }

    @Test
    void 벌크는_getAllStockPrices에_위임() {
        List<MarketPriceResponse> expected = List.of(new MarketPriceResponse());
        when(stockPriceProvider.getAllStockPrices()).thenReturn(expected);
        assertSame(expected, provider.getAllPrices());
    }

    @Test
    void 단건은_종목마스터_이름과_함께_getStockPriceByCode에_위임() {
        when(stockMasterService.getStockName("005930")).thenReturn("삼성전자");
        provider.getPrice("005930");
        verify(stockPriceProvider).getStockPriceByCode("005930", "삼성전자");
    }

    @Test
    void 캔들은_STOCK_문자열로_CandlestickService에_위임() {
        provider.getCandles("005930", "1d");
        verify(candlestickService).getCandlesticks("005930", "1d", "STOCK");
    }

    @Test
    void 거래소는_KRX_상수_존재여부는_종목마스터() {
        assertEquals("KRX", provider.getExchange("005930"));
        when(stockMasterService.exists("005930")).thenReturn(true);
        assertTrue(provider.exists("005930"));
    }
}
