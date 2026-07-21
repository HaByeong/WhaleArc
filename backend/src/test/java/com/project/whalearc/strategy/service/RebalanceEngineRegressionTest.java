package com.project.whalearc.strategy.service;

import com.project.whalearc.market.dto.CandlestickResponse;
import com.project.whalearc.strategy.domain.Condition;
import com.project.whalearc.strategy.dto.BacktestRequest;
import com.project.whalearc.strategy.dto.BacktestResponse;
import com.project.whalearc.user.domain.User;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * N자산 리밸런싱 엔진 테스트.
 *
 * [회귀] twoAssets_matchesLegacyBaseline — 리팩터 전 2자산 엔진(A/B 스칼라 쌍)의 출력을
 * 동일 시나리오로 캡처한 기준값과 비교한다. 시나리오: 상승 A(100→160) 60% + 하락 B(200→150) 40%,
 * 월 50만 적립, 매월 리밸런싱, 진입=항상(PRICE>0)·청산 없음, 익절 5%·트레일링 3%
 * (초기 진입·리밸런싱 트림·적립 추가매수·익절·트레일링·강제청산 경로를 모두 관통).
 *
 * [신규] 3~5자산 일반화 동작 + 검증/등급 한도.
 */
class RebalanceEngineRegressionTest {

    private static final ZoneOffset KST = ZoneOffset.of("+09:00");

    static List<CandlestickResponse> linearCandles(double start, double end, int days) {
        List<CandlestickResponse> out = new ArrayList<>();
        LocalDate d = LocalDate.of(2024, 1, 1);
        for (int i = 0; i < days; i++) {
            double p = start + (end - start) * i / (days - 1);
            long t = d.atStartOfDay().toEpochSecond(KST);
            out.add(new CandlestickResponse(t, p, p, p, p, 1000));
            d = d.plusDays(1);
        }
        return out;
    }

    static BacktestRequest baseRequest() {
        BacktestRequest req = new BacktestRequest();
        req.setStockCode("AAA");
        req.setStockName("자산에이");
        req.setAssetType("CRYPTO");
        req.setStartDate("2024-01-01");
        req.setEndDate("2024-06-28");
        req.setInitialCapital(10_000_000);
        return req;
    }

    static List<Condition> alwaysEntry() {
        return List.of(new Condition("PRICE", Condition.Operator.GT, BigDecimal.ZERO, Condition.Logic.AND, null));
    }

    static BacktestService service() {
        return new BacktestService(null, null, null, null, null, null, null, null, null);
    }

    static BacktestService.RebalanceLeg leg(String code, String name, List<CandlestickResponse> candles, double weight) {
        return new BacktestService.RebalanceLeg(code, name, "CRYPTO", candles, Map.of(), 0, Map.of(), weight);
    }

    // ── 회귀: 2자산 결과가 리팩터 전 엔진과 동일 ────────────────────────────

    @Test
    void twoAssets_matchesLegacyBaseline() {
        BacktestRequest req = baseRequest();
        req.setSecondStockCode("BBB");
        req.setSecondStockName("자산비");
        req.setSecondAssetType("CRYPTO");
        req.setFirstAssetWeight(60.0);
        req.setRebalanceFrequency("MONTHLY");
        req.setMonthlyContribution(500_000.0);
        req.setSlippagePercent(0.1);
        req.setCommissionRate(0.1);
        req.setTakeProfitPercent(5.0);
        req.setTrailingStopPercent(3.0);

        List<BacktestService.RebalanceLeg> legs = List.of(
                leg("AAA", "자산에이", linearCandles(100, 160, 180), 60.0 / 100.0),
                leg("BBB", "자산비", linearCandles(200, 150, 180), (100.0 - 60.0) / 100.0));

        BacktestResponse r = service().simulateRebalance(
                "direct", "회귀", alwaysEntry(), Collections.emptyList(), legs, req, true);

        // 리팩터 전(2026-07-13, A/B 스칼라 쌍 엔진) 캡처 기준값
        assertEquals(11.98, r.getTotalReturnRate(), 1e-9);
        assertEquals(13_997_533.0, r.getFinalValue(), 1.0);
        assertEquals(18, r.getTotalTrades());
        assertEquals(9, r.getProfitableTrades());
        assertEquals(9, r.getLosingTrades());
        assertEquals(50.0, r.getWinRate(), 1e-9);
        assertEquals(-0.37, r.getMaxDrawdown(), 1e-9);
        assertEquals(8, r.getMaxDrawdownDuration(), 1e-9);
        assertEquals(18.3, r.getSharpeRatio(), 1e-9);
        assertEquals(29.51, r.getSortinoRatio(), 1e-9);
        assertEquals(25.95, r.getCagr(), 1e-9);
        assertEquals(22.48, r.getBuyHoldReturnRate(), 1e-9);
        assertEquals(46, r.getTrades().size());
        assertEquals(5, r.getRebalanceCount());
        assertEquals(8_731_172.0, r.getFirstAssetFinalValue(), 1.0);
        assertEquals(5_266_360.0, r.getSecondAssetFinalValue(), 1.0);
        assertEquals(23, r.getFirstAssetTradeCount());
        assertEquals(23, r.getSecondAssetTradeCount());
        assertEquals(5, r.getContributionCount());
        assertEquals(12_500_000.0, r.getTotalContribution(), 1e-6);
        assertEquals(180, r.getEquityCurve().size());
        assertEquals(14_025_569.669257823, r.getEquityCurve().get(r.getEquityCurve().size() - 1).getValue(), 1e-3);
        assertEquals(2.04, r.getProfitFactor(), 1e-9);
        assertEquals(2.04, r.getPayoffRatio(), 1e-9);
        assertEquals(19.0, r.getAvgHoldingDays(), 1e-9);
        assertEquals("BUY_A", r.getTrades().get(0).getType());
        assertEquals("SELL_B", r.getTrades().get(r.getTrades().size() - 1).getType());
        // 신설 필드: 2자산도 assetBreakdown 제공 (first/second 필드와 일치)
        assertEquals(2, r.getAssetBreakdown().size());
        assertEquals(r.getFirstAssetFinalValue(), r.getAssetBreakdown().get(0).getFinalValue(), 1e-9);
        assertEquals(r.getSecondAssetFinalValue(), r.getAssetBreakdown().get(1).getFinalValue(), 1e-9);
        assertEquals(60.0, r.getAssetBreakdown().get(0).getWeight(), 1e-9);
        assertEquals(40.0, r.getAssetBreakdown().get(1).getWeight(), 1e-9);
    }

    // ── 신규: 3자산 평탄가 — 가치 보존(창조·증발 없음) ──────────────────────

    @Test
    void threeAssets_flatPrices_conserveValue() {
        BacktestRequest req = baseRequest();
        req.setCommissionRate(0.0); // 기본 0.1% 대신 0 — 보존 검증을 정확하게
        List<BacktestService.RebalanceLeg> legs = List.of(
                leg("AAA", "A", linearCandles(100, 100, 120), 0.4),
                leg("BBB", "B", linearCandles(100, 100, 120), 0.3),
                leg("CCC", "C", linearCandles(100, 100, 120), 0.3));

        BacktestResponse r = service().simulateRebalance(
                "direct", "3자산", alwaysEntry(), Collections.emptyList(), legs, req, true);

        assertEquals(10_000_000.0, r.getFinalValue(), 1.0, "평탄가·수수료 0 → 가치 보존");
        assertEquals(0.0, r.getTotalReturnRate(), 0.01);
        assertEquals(3, r.getAssetBreakdown().size());
        assertEquals(40.0, r.getAssetBreakdown().get(0).getWeight(), 1e-9);
        assertEquals(30.0, r.getAssetBreakdown().get(1).getWeight(), 1e-9);
        assertEquals(30.0, r.getAssetBreakdown().get(2).getWeight(), 1e-9);
        // 각 자산: 첫날 진입 + 종료 강제청산 = 2건
        assertEquals(6, r.getTrades().size());
        for (BacktestResponse.AssetBreakdownDto b : r.getAssetBreakdown()) assertEquals(2, b.getTradeCount());
        // 자산별 분해 합 = 전체 최종가치
        double sum = r.getAssetBreakdown().stream().mapToDouble(BacktestResponse.AssetBreakdownDto::getFinalValue).sum();
        assertEquals(r.getFinalValue(), sum, 3.0); // leg별 반올림 오차 허용
    }

    // ── 신규: 5자산 — 과대 leg 트림·과소 leg 수혈, 접미사 A~E ─────────────────

    @Test
    void fiveAssets_rebalanceTrimsOverweightIntoUnderweight() {
        BacktestRequest req = baseRequest();
        req.setRebalanceFrequency("MONTHLY");
        req.setCommissionRate(0.1);
        req.setSlippagePercent(0.1);
        List<BacktestService.RebalanceLeg> legs = List.of(
                leg("AAA", "A", linearCandles(100, 300, 180), 0.2), // 급등 → 매월 초과분 트림
                leg("BBB", "B", linearCandles(100, 100, 180), 0.2),
                leg("CCC", "C", linearCandles(100, 100, 180), 0.2),
                leg("DDD", "D", linearCandles(100, 100, 180), 0.2),
                leg("EEE", "E", linearCandles(100, 100, 180), 0.2));

        BacktestResponse r = service().simulateRebalance(
                "direct", "5자산", alwaysEntry(), Collections.emptyList(), legs, req, true);

        assertEquals(5, r.getAssetBreakdown().size());
        assertTrue(r.getRebalanceCount() >= 4, "매월 리밸런싱 발생 — 실제 " + r.getRebalanceCount());
        assertTrue(r.getTrades().stream().anyMatch(t -> "REBALANCE_SELL_A".equals(t.getType())),
                "급등 자산 A 의 초과분 트림 발생");
        assertTrue(r.getTrades().stream().anyMatch(t -> t.getType().endsWith("_E")), "5번째 leg 접미사 E 사용");
        // 트림 수혈로 평탄 자산들도 추가 매수(적립 재투자) 발생 → 최종가치가 초기 배분(200만)보다 커짐
        assertTrue(r.getAssetBreakdown().get(1).getFinalValue() > 2_000_000,
                "과소 leg 수혈 — 실제 " + r.getAssetBreakdown().get(1).getFinalValue());
        double sum = r.getAssetBreakdown().stream().mapToDouble(BacktestResponse.AssetBreakdownDto::getFinalValue).sum();
        assertEquals(r.getFinalValue(), sum, 5.0);
    }

    // ── 검증·등급 한도 ────────────────────────────────────────────────────

    private static BacktestRequest.RebalanceAsset extra(String code, double weight) {
        return new BacktestRequest.RebalanceAsset(code, code, "CRYPTO", weight);
    }

    private void invokeValidate(BacktestRequest req) throws Exception {
        Method m = BacktestService.class.getDeclaredMethod("validateRequest", BacktestRequest.class);
        m.setAccessible(true);
        try {
            m.invoke(service(), req);
        } catch (java.lang.reflect.InvocationTargetException e) {
            throw (Exception) e.getCause();
        }
    }

    private BacktestRequest multiAssetRequest(double mainWeight, BacktestRequest.RebalanceAsset... extras) {
        BacktestRequest req = baseRequest();
        req.setEntryConditions(alwaysEntry());
        req.setExitConditions(Collections.emptyList());
        req.setFirstAssetWeight(mainWeight);
        req.setAdditionalAssets(List.of(extras));
        return req;
    }

    @Test
    void validate_weightSumMustBe100() {
        BacktestRequest req = multiAssetRequest(50.0, extra("BBB", 30.0), extra("CCC", 30.0)); // 110%
        Exception e = assertThrows(IllegalArgumentException.class, () -> invokeValidate(req));
        assertTrue(e.getMessage().contains("100%"), e.getMessage());
    }

    @Test
    void validate_duplicateCodesRejected() {
        BacktestRequest req = multiAssetRequest(50.0, extra("AAA", 50.0)); // 기본 자산과 중복
        Exception e = assertThrows(IllegalArgumentException.class, () -> invokeValidate(req));
        assertTrue(e.getMessage().contains("서로 다른 종목"), e.getMessage());
    }

    @Test
    void validate_currencyMixRejected() {
        BacktestRequest req = multiAssetRequest(50.0,
                new BacktestRequest.RebalanceAsset("SPY", "SPY", "ETF", 50.0)); // CRYPTO + ETF 혼합
        Exception e = assertThrows(IllegalArgumentException.class, () -> invokeValidate(req));
        assertTrue(e.getMessage().contains("통화"), e.getMessage());
    }

    @Test
    void validate_maxFiveAssets() {
        BacktestRequest req = multiAssetRequest(50.0,
                extra("B1", 10), extra("B2", 10), extra("B3", 10), extra("B4", 10), extra("B5", 10)); // 총 6자산
        Exception e = assertThrows(IllegalArgumentException.class, () -> invokeValidate(req));
        assertTrue(e.getMessage().contains("최대 5개"), e.getMessage());
    }

    @Test
    void validate_fiveAssetsOk() throws Exception {
        BacktestRequest req = multiAssetRequest(20.0,
                extra("B1", 20), extra("B2", 20), extra("B3", 20), extra("B4", 20)); // 총 5자산, 합 100
        invokeValidate(req); // 예외 없음
    }

    @Test
    void tier_freeBlockedForMultiAsset_basicAllowsFive() {
        BacktestService svc = service();
        BacktestRequest five = multiAssetRequest(20.0,
                extra("B1", 20), extra("B2", 20), extra("B3", 20), extra("B4", 20));
        // FREE: 다중 종목 자체가 차단
        Exception e = assertThrows(IllegalArgumentException.class,
                () -> svc.enforceBacktestTierLimits(five, User.Tier.FREE));
        assertTrue(e.getMessage().contains("Basic"), e.getMessage());
        // BASIC(포지션 한도 5): 5자산 허용
        svc.enforceBacktestTierLimits(five, User.Tier.BASIC);
        // 레거시 2자산도 여전히 BASIC 허용
        BacktestRequest legacy = baseRequest();
        legacy.setSecondStockCode("BBB");
        legacy.setSecondAssetType("CRYPTO");
        svc.enforceBacktestTierLimits(legacy, User.Tier.BASIC);
    }
}
