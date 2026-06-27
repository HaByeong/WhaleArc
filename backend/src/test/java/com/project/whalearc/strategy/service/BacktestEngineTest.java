package com.project.whalearc.strategy.service;

import com.project.whalearc.market.dto.CandlestickResponse;
import com.project.whalearc.strategy.dto.BacktestRequest;
import com.project.whalearc.strategy.dto.BacktestResponse;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 백테스트 엔진 기본 동작 — 거래 없는 전략의 buy & hold 벤치마크가 가격 추이를 정확히 반영하는지.
 * (결과 해석 패널이 '전략 vs 단순 보유' 비교에 buyHoldReturnRate 를 사용하므로 핵심)
 */
class BacktestEngineTest {

    private static final ZoneOffset KST = ZoneOffset.of("+09:00");

    private BacktestResponse runNoTrade(double startPrice, double endPrice, int days) throws Exception {
        List<CandlestickResponse> candles = new ArrayList<>();
        LocalDate d = LocalDate.of(2024, 1, 1);
        for (int i = 0; i < days; i++) {
            double p = startPrice + (endPrice - startPrice) * i / (days - 1); // 선형 변화
            long t = d.atStartOfDay().toEpochSecond(KST);
            candles.add(new CandlestickResponse(t, p, p, p, p, 1000));
            d = d.plusDays(1);
        }

        BacktestRequest req = new BacktestRequest();
        req.setStockCode("TEST");
        req.setStartDate("2024-01-01");
        req.setEndDate("2024-06-30");
        req.setInitialCapital(10_000_000);
        req.setAssetType("CRYPTO");
        req.setEntryConditions(Collections.emptyList()); // 거래 신호 없음 → 전략은 무포지션
        req.setExitConditions(Collections.emptyList());

        BacktestService svc = new BacktestService(null, null, null, null, null, null, null, null, null);
        Method m = BacktestService.class.getDeclaredMethod(
                "simulate", String.class, String.class, List.class, List.class,
                List.class, Map.class, int.class, BacktestRequest.class, String.class,
                Map.class, boolean.class);
        m.setAccessible(true);
        return (BacktestResponse) m.invoke(svc,
                "direct", "테스트", Collections.emptyList(), Collections.emptyList(),
                candles, Map.of(), 0, req, "CRYPTO", Map.of(), false);
    }

    @Test
    void noTradeStrategy_hasZeroReturn_butBuyHoldReflectsRise() throws Exception {
        BacktestResponse res = runNoTrade(100, 150, 120); // +50% 상승

        // 전략은 거래를 안 했으므로 거래수 0, 전략 수익률 ~0
        assertEquals(0, res.getTotalTrades(), "거래 신호 없음 → 거래 0");
        assertEquals(0.0, res.getTotalReturnRate(), 1e-6, "무포지션 → 전략 수익률 0");
        // 단순 보유(Buy&Hold)는 가격 상승(+50%)을 반영해야 함
        assertNotNull(res.getBuyHoldReturnRate(), "buyHold 벤치마크 존재");
        assertTrue(res.getBuyHoldReturnRate() > 40, "단순 보유는 +50% 부근(수수료 차감) — 실제 "
                + res.getBuyHoldReturnRate());
    }

    @Test
    void noTradeStrategy_fallingPrice_buyHoldNegative() throws Exception {
        BacktestResponse res = runNoTrade(200, 100, 120); // -50% 하락
        assertEquals(0.0, res.getTotalReturnRate(), 1e-6, "무포지션 전략은 하락장에서도 0(손실 회피)");
        assertTrue(res.getBuyHoldReturnRate() < -40, "단순 보유는 -50% 부근 — 실제 "
                + res.getBuyHoldReturnRate());
    }
}
