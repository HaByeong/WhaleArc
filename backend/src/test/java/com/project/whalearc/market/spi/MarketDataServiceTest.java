package com.project.whalearc.market.spi;

import com.project.whalearc.market.domain.AssetType;
import com.project.whalearc.market.dto.MarketPriceResponse;
import com.project.whalearc.market.service.ExchangeRateService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** 파사드 라우팅(supports 셀렉터) + 문자열 오버로드 규약 검증. */
class MarketDataServiceTest {

    private MarketDataProvider stockProvider;
    private MarketDataProvider cryptoProvider;
    private ExchangeRateService exchangeRateService;
    private MarketDataService service;

    @BeforeEach
    void setUp() {
        stockProvider = mock(MarketDataProvider.class);
        when(stockProvider.supports(AssetType.STOCK)).thenReturn(true);
        cryptoProvider = mock(MarketDataProvider.class);
        when(cryptoProvider.supports(AssetType.CRYPTO)).thenReturn(true);
        exchangeRateService = mock(ExchangeRateService.class);
        service = new MarketDataService(List.of(stockProvider, cryptoProvider), exchangeRateService);
    }

    @Test
    void 자산군에_맞는_프로바이더로만_라우팅한다() {
        List<MarketPriceResponse> expected = List.of(new MarketPriceResponse());
        when(stockProvider.getAllPrices()).thenReturn(expected);

        assertSame(expected, service.getAllPrices(AssetType.STOCK));
        verify(stockProvider).getAllPrices();
        verify(cryptoProvider, never()).getAllPrices();
    }

    @Test
    void 지원_프로바이더가_없으면_IllegalArgumentException() {
        assertThrows(IllegalArgumentException.class, () -> service.getAllPrices(AssetType.ETF));
    }

    @Test
    void 문자열_오버로드는_대소문자_무관하게_enum으로_라우팅한다() {
        service.getAllPrices("stock");
        verify(stockProvider).getAllPrices();
    }

    @Test
    void 문자열_null_빈값_미지의값은_CRYPTO로_해석한다() {
        service.getAllPrices((String) null);
        service.getAllPrices("");
        service.getAllPrices("UNKNOWN_TYPE");
        verify(cryptoProvider, times(3)).getAllPrices();
        verify(stockProvider, never()).getAllPrices();
    }

    @Test
    void 캔들과_단건과_메타도_동일_라우팅을_탄다() {
        service.getCandles("BTC", "10m", AssetType.CRYPTO);
        verify(cryptoProvider).getCandles("BTC", "10m");

        service.getPrice("005930", AssetType.STOCK);
        verify(stockProvider).getPrice("005930");

        service.exists("005930", AssetType.STOCK);
        verify(stockProvider).exists("005930");

        service.getExchange("BTC", AssetType.CRYPTO);
        verify(cryptoProvider).getExchange("BTC");
    }

    @Test
    void 환율은_ExchangeRateService에_위임한다() {
        when(exchangeRateService.getUsdKrwRate()).thenReturn(1400.5);
        assertEquals(1400.5, service.getUsdKrwRate());
        verify(exchangeRateService).getUsdKrwRate();
    }
}
