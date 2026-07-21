package com.project.whalearc.market.spi.impl;

import com.project.whalearc.market.domain.AssetType;
import com.project.whalearc.market.dto.MarketPriceResponse;
import com.project.whalearc.market.service.CandlestickService;
import com.project.whalearc.market.service.CryptoPriceProvider;
import com.project.whalearc.market.websocket.RealtimePriceHolder;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * 핵심: REST+WS 병합이 기존 MarketController CRYPTO 분기와 동일하게 동작하는지
 * (WS 덮어쓰기, REST 순서 보존, WS 데이터 없으면 REST 그대로).
 */
class CryptoMarketDataProviderTest {

    private CryptoPriceProvider cryptoPriceProvider;
    private RealtimePriceHolder realtimePriceHolder;
    private CandlestickService candlestickService;
    private CryptoMarketDataProvider provider;

    private static MarketPriceResponse price(String symbol, double p) {
        MarketPriceResponse r = new MarketPriceResponse();
        r.setSymbol(symbol);
        r.setPrice(p);
        return r;
    }

    @BeforeEach
    void setUp() {
        cryptoPriceProvider = mock(CryptoPriceProvider.class);
        realtimePriceHolder = mock(RealtimePriceHolder.class);
        candlestickService = mock(CandlestickService.class);
        provider = new CryptoMarketDataProvider(cryptoPriceProvider, realtimePriceHolder, candlestickService);
    }

    @Test
    void supports는_CRYPTO만() {
        assertTrue(provider.supports(AssetType.CRYPTO));
        assertFalse(provider.supports(AssetType.STOCK));
        assertFalse(provider.supports(AssetType.US_STOCK));
        assertFalse(provider.supports(AssetType.ETF));
    }

    @Test
    void WS데이터가_있으면_REST를_덮어쓰고_REST순서를_보존한다() {
        when(cryptoPriceProvider.getAllKrwTickers()).thenReturn(List.of(
                price("BTC", 100_000_000), price("ETH", 5_000_000), price("XRP", 3_000)));
        when(realtimePriceHolder.hasData()).thenReturn(true);
        when(realtimePriceHolder.getAllLatestPrices()).thenReturn(List.of(
                price("ETH", 5_100_000), price("SOL", 250_000)));

        List<MarketPriceResponse> merged = provider.getAllPrices();

        // REST 3개 순서 보존 + ETH는 WS값으로 덮어씀 + WS 신규 SOL은 뒤에 추가
        assertEquals(4, merged.size());
        assertEquals("BTC", merged.get(0).getSymbol());
        assertEquals("ETH", merged.get(1).getSymbol());
        assertEquals(5_100_000, merged.get(1).getPrice());
        assertEquals("XRP", merged.get(2).getSymbol());
        assertEquals("SOL", merged.get(3).getSymbol());
    }

    @Test
    void WS데이터가_없으면_REST_스냅샷을_그대로_반환한다() {
        List<MarketPriceResponse> rest = List.of(price("BTC", 100_000_000));
        when(cryptoPriceProvider.getAllKrwTickers()).thenReturn(rest);
        when(realtimePriceHolder.hasData()).thenReturn(false);

        assertSame(rest, provider.getAllPrices());
        verify(realtimePriceHolder, never()).getAllLatestPrices();
    }

    @Test
    void 단건은_실시간_우선_없으면_REST_스캔() {
        when(realtimePriceHolder.getPrice("BTC")).thenReturn(price("BTC", 101_000_000));
        assertEquals(101_000_000, provider.getPrice("BTC").getPrice());

        when(realtimePriceHolder.getPrice("ETH")).thenReturn(null);
        when(cryptoPriceProvider.getAllKrwTickers()).thenReturn(List.of(price("ETH", 5_000_000)));
        assertEquals(5_000_000, provider.getPrice("ETH").getPrice());

        when(realtimePriceHolder.getPrice("NONE")).thenReturn(null);
        assertNull(provider.getPrice("NONE"));
    }

    @Test
    void 캔들은_CandlestickService에_null_assetType으로_위임한다() {
        provider.getCandles("BTC", "10m");
        verify(candlestickService).getCandlesticks("BTC", "10m", null);
    }
}
