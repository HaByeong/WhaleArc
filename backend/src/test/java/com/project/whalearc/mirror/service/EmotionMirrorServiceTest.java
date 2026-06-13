package com.project.whalearc.mirror.service;

import com.project.whalearc.market.dto.MarketPriceResponse;
import com.project.whalearc.market.service.CandlestickService;
import com.project.whalearc.market.service.CryptoPriceProvider;
import com.project.whalearc.market.service.StockPriceProvider;
import com.project.whalearc.market.service.UsEtfPriceProvider;
import com.project.whalearc.market.service.UsStockPriceProvider;
import com.project.whalearc.mirror.domain.EmotionCapture;
import com.project.whalearc.mirror.repository.EmotionCaptureRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.lenient;

/** 반사실(counterfactual) 계산 정확성 — 감정 거울의 진실성 핵심. */
@ExtendWith(MockitoExtension.class)
class EmotionMirrorServiceTest {

    @Mock EmotionCaptureRepository repository;
    @Mock CryptoPriceProvider cryptoPriceProvider;
    @Mock StockPriceProvider stockPriceProvider;
    @Mock UsStockPriceProvider usStockPriceProvider;
    @Mock UsEtfPriceProvider usEtfPriceProvider;
    @Mock CandlestickService candlestickService;
    @Mock com.project.whalearc.live.repository.LiveStrategyDeploymentRepository deploymentRepository;

    @InjectMocks EmotionMirrorService service;

    private void priceNow(double price) {
        MarketPriceResponse m = new MarketPriceResponse();
        m.setSymbol("BTC");
        m.setPrice(price);
        lenient().when(cryptoPriceProvider.getAllKrwTickers()).thenReturn(List.of(m));
        lenient().when(candlestickService.getCandlesticks(anyStr(), anyStr(), anyStr())).thenReturn(List.of());
    }

    private static String anyStr() { return org.mockito.ArgumentMatchers.anyString(); }

    private EmotionCapture sellCapture(double priceAtEvent) {
        return new EmotionCapture("u1", "PANIC_DROP", "SELL", "BTC", "비트코인", "CRYPTO",
                priceAtEvent, -6.2, 1_000_000.0, "FOLLOW_RULE", "무서워서 팔고 싶었다", 4, Instant.now(), Instant.now());
    }

    @Test
    void panicSell_priceRose_holdingWasBetter() {
        priceNow(110.0);                       // 이벤트가 100 → 개봉가 110 (+10%)
        EmotionCapture c = sellCapture(100.0);

        assertTrue(service.reveal(c));
        assertEquals(10.0, c.getRuleOutcomePct(), 1e-9, "항로(보유) = 자산 변동 +10%");
        assertEquals(0.0, c.getImpulseOutcomePct(), 1e-9, "충동(현금화) = 0%");
        // 감정의 비용 = 항로 − 충동 = +10%p (참길 잘함)
        assertEquals(10.0, c.getRuleOutcomePct() - c.getImpulseOutcomePct(), 1e-9);
    }

    @Test
    void panicSell_priceFell_impulseWasRight() {
        priceNow(90.0);                        // 이벤트가 100 → 개봉가 90 (−10%)
        EmotionCapture c = sellCapture(100.0);

        assertTrue(service.reveal(c));
        assertEquals(-10.0, c.getRuleOutcomePct(), 1e-9, "항로(보유) = −10%");
        assertEquals(0.0, c.getImpulseOutcomePct(), 1e-9, "충동(현금화) = 0%");
        // 비용 = −10%p (이번엔 충동/매도가 옳았음) → 정직하게 음수로 열림
        assertTrue(c.getRuleOutcomePct() - c.getImpulseOutcomePct() < 0);
    }

    @Test
    void fomoBuy_priceFell_notBuyingWasBetter() {
        priceNow(90.0);                        // 이벤트가 100 → 개봉가 90 (−10%)
        EmotionCapture c = new EmotionCapture("u1", "FOMO_SPIKE", "BUY", "BTC", "비트코인", "CRYPTO",
                100.0, 15.0, 500_000.0, "FOLLOW_RULE", "놓칠까 무섭다", 3, Instant.now(), Instant.now());

        assertTrue(service.reveal(c));
        assertEquals(-10.0, c.getImpulseOutcomePct(), 1e-9, "충동(매수) = −10%");
        assertEquals(0.0, c.getRuleOutcomePct(), 1e-9, "항로(관망) = 0%");
        // 비용 = 항로 − 충동 = +10%p (안 사길 잘함)
        assertEquals(10.0, c.getRuleOutcomePct() - c.getImpulseOutcomePct(), 1e-9);
    }

    @Test
    void reveal_noPrice_staysSealed() {
        lenient().when(cryptoPriceProvider.getAllKrwTickers()).thenReturn(List.of());
        EmotionCapture c = sellCapture(100.0);

        assertFalse(service.reveal(c), "시세 없으면 개봉 보류(다음 기회 재시도)");
        assertFalse(c.isRevealed());
    }
}
