package com.project.whalearc.strategy.service;

import com.project.whalearc.market.dto.CandlestickResponse;
import com.project.whalearc.strategy.domain.Condition;
import com.project.whalearc.strategy.dto.BacktestRequest;
import com.project.whalearc.strategy.dto.BacktestResponse;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 레버리지 / 독립 양방향(LONG_SHORT_FLAT) / 피라미딩 확장의 핵심 동작 검증.
 * BacktestEngineTest 와 동일하게 리플렉션으로 private simulate() 를 직접 호출한다.
 */
class BacktestLeverageShortPyramidTest {

    private static final ZoneOffset KST = ZoneOffset.of("+09:00");

    private static Condition cond(String ind, Condition.Operator op, double val, Condition.Logic logic) {
        return new Condition(ind, op, BigDecimal.valueOf(val), logic, null);
    }

    private List<CandlestickResponse> closes(double... cs) {
        List<CandlestickResponse> out = new ArrayList<>();
        LocalDate d = LocalDate.of(2024, 1, 1);
        for (double c : cs) {
            long t = d.atStartOfDay().toEpochSecond(KST);
            out.add(new CandlestickResponse(t, c, c, c, c, 1000)); // o=h=l=c (장중폭 없음)
            d = d.plusDays(1);
        }
        return out;
    }

    private List<CandlestickResponse> linear(double start, double end, int days) {
        double[] cs = new double[days];
        for (int i = 0; i < days; i++) cs[i] = start + (end - start) * i / (days - 1);
        return closes(cs);
    }

    private BacktestResponse run(List<CandlestickResponse> candles, BacktestRequest req,
                                 List<Condition> entry, List<Condition> exit) throws Exception {
        req.setStockCode("TEST");
        req.setStartDate("2024-01-01");
        req.setEndDate("2024-12-31");
        req.setInitialCapital(10_000_000);
        req.setAssetType("CRYPTO");
        req.setCommissionRate(0.0);   // 수수료 0 → 깔끔한 산술 검증
        req.setSlippagePercent(0.0);
        req.setEntryConditions(entry);
        req.setExitConditions(exit);

        BacktestService svc = new BacktestService(null, null, null, null, null, null, null, null, null);
        Method m = BacktestService.class.getDeclaredMethod(
                "simulate", String.class, String.class, List.class, List.class,
                List.class, Map.class, int.class, BacktestRequest.class, String.class,
                Map.class, boolean.class);
        m.setAccessible(true);
        return (BacktestResponse) m.invoke(svc,
                "direct", "테스트", entry, exit, candles, Map.of(), 0, req, "CRYPTO", Map.of(), false);
    }

    private List<Condition> alwaysEnter() { return List.of(cond("PRICE", Condition.Operator.GT, 0, Condition.Logic.AND)); }
    private List<Condition> neverExit() { return List.of(cond("PRICE", Condition.Operator.LT, 0, Condition.Logic.AND)); }

    // ── 레버리지: 같은 가격 변동에 손익이 배수만큼 증폭 ──
    @Test
    void leverage_amplifiesReturnProportionally() throws Exception {
        BacktestRequest r1 = new BacktestRequest();
        BacktestResponse lev1 = run(linear(100, 110, 11), r1, alwaysEnter(), neverExit());

        BacktestRequest r2 = new BacktestRequest();
        r2.setLeverage(2);
        BacktestResponse lev2 = run(linear(100, 110, 11), r2, alwaysEnter(), neverExit());

        assertEquals(10.0, lev1.getTotalReturnRate(), 0.5, "1배 롱 +10% — 실제 " + lev1.getTotalReturnRate());
        assertEquals(20.0, lev2.getTotalReturnRate(), 0.5, "2배 롱 +20% — 실제 " + lev2.getTotalReturnRate());
    }

    // ── 레버리지 청산: 증거금 소진가(avg×(1-1/lev)) 터치 시 강제청산, 손실은 증거금으로 제한 ──
    @Test
    void leverage_liquidatesWhenMarginExhausted() throws Exception {
        BacktestRequest r = new BacktestRequest();
        r.setLeverage(5); // 청산가 = 100×(1-1/5) = 80
        BacktestResponse res = run(linear(100, 70, 31), r, alwaysEnter(), neverExit());
        assertTrue(res.getTotalReturnRate() <= -95, "증거금 전액 손실(≈ -100%) — 실제 " + res.getTotalReturnRate());
    }

    // ── 레버리지=1 회귀: 무포지션(거래없음) 전략은 기존과 동일하게 0% ──
    @Test
    void leverageOne_isRegressionSafe() throws Exception {
        BacktestRequest r = new BacktestRequest(); // leverage 미지정
        BacktestResponse res = run(linear(100, 150, 21), r, List.of(), List.of());
        assertEquals(0, res.getTotalTrades(), "신호 없음 → 거래 0");
        assertEquals(0.0, res.getTotalReturnRate(), 1e-6, "무포지션 → 0%");
    }

    // ── 독립 양방향(LONG_SHORT_FLAT): 청산은 전환이 아니라 flat. 롱→flat→숏→flat→롱 순서 ──
    @Test
    void longShortFlat_exitsToFlat_notReverse() throws Exception {
        BacktestRequest r = new BacktestRequest();
        r.setTradeDirection("LONG_SHORT_FLAT");
        r.setShortEntryConditions(List.of(cond("CLOSE", Condition.Operator.LT, 90, Condition.Logic.AND)));
        r.setShortExitConditions(List.of(cond("CLOSE", Condition.Operator.GT, 110, Condition.Logic.AND)));

        List<Condition> longEntry = List.of(cond("CLOSE", Condition.Operator.GT, 100, Condition.Logic.AND));
        List<Condition> longExit = List.of(cond("CLOSE", Condition.Operator.LT, 100, Condition.Logic.AND));

        // 95(flat) 105(롱진입) 98(롱청산→flat) 85(숏진입) 115(숏청산→flat) 120(롱진입) → 종료 강제청산
        BacktestResponse res = run(closes(95, 105, 98, 85, 115, 120), r, longEntry, longExit);

        List<String> types = res.getTrades().stream().map(BacktestResponse.TradeDto::getType).toList();
        assertEquals(List.of("BUY", "SELL", "SHORT", "COVER", "BUY", "SELL"), types,
                "롱→flat→숏→flat→롱(전환 아님) — 실제 " + types);
    }

    // ── 피라미딩(SIGNAL): ALL_IN이어도 maxPositions 만큼 분할 추가 진입 ──
    @Test
    void pyramiding_allIn_addsUpToMaxUnits() throws Exception {
        BacktestRequest r = new BacktestRequest();
        r.setTradeDirection("LONG_SHORT_FLAT");
        r.setMaxPositions(3);
        r.setPyramidMode("SIGNAL"); // 진입신호 재충족 시 추가
        // positionSizing 미지정 → ALL_IN

        BacktestResponse res = run(closes(100, 100, 100, 100, 100), r, alwaysEnter(), neverExit());
        long buys = res.getTrades().stream().filter(t -> "BUY".equals(t.getType())).count();
        assertEquals(3, buys, "ALL_IN에서도 3유닛 분할 진입 — 실제 " + buys);
    }
}
