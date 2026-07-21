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
 * 적립식(DCA) 모드에서 일별 수익률이 적립금 유입분만큼 부풀려지는지 검증.
 *
 * 시나리오: 가격이 100 으로 완전히 평평 + 거래 신호 없음(빈 조건).
 *  - 진짜 수익률은 매일 0% 여야 한다 (가격 불변, 포지션 없음 → equity = cash).
 *  - 매월 첫 거래일 적립금이 '수익'으로 잡히면 그날 dailyReturn 이 0 이 아니게 된다.
 *  - 그 결과 Sharpe 도 0 이 아니게 된다 (가격이 안 변하므로 원래 0 이어야 함).
 */
public class BacktestDcaDailyReturnTest {

    private static final ZoneOffset KST = ZoneOffset.of("+09:00");

    @Test
    void dcaContributionShouldNotInflateDailyReturn() throws Exception {
        // 6개월치 일봉, 가격 고정 100
        List<CandlestickResponse> candles = new ArrayList<>();
        LocalDate d = LocalDate.of(2024, 1, 1);
        for (int i = 0; i < 180; i++) {
            long t = d.atStartOfDay().toEpochSecond(KST);
            candles.add(new CandlestickResponse(t, 100, 100, 100, 100, 1000));
            d = d.plusDays(1);
        }

        BacktestRequest req = new BacktestRequest();
        req.setStockCode("TEST");
        req.setStartDate("2024-01-01");
        req.setEndDate("2024-06-30");
        req.setInitialCapital(10_000_000);
        req.setMonthlyContribution(1_000_000.0); // 적립식 ON
        req.setAssetType("CRYPTO");
        req.setEntryConditions(Collections.emptyList());
        req.setExitConditions(Collections.emptyList());

        // deps 는 CRYPTO/거래없음 경로에서 호출되지 않으므로 전부 null
        BacktestService svc = new BacktestService(null, null, null, null, null, null, null, null, null);

        Method m = BacktestService.class.getDeclaredMethod(
                "simulate", String.class, String.class, List.class, List.class,
                List.class, Map.class, int.class, BacktestRequest.class, String.class,
                Map.class, boolean.class);
        m.setAccessible(true);

        BacktestResponse res = (BacktestResponse) m.invoke(svc,
                "direct", "테스트", Collections.emptyList(), Collections.emptyList(),
                candles, Map.of(), 0, req, "CRYPTO", Map.of(), false);

        // 0 이 아닌 일별 수익률 수집 (반올림 오차 무시)
        List<BacktestResponse.DailyReturnDto> spikes = new ArrayList<>();
        for (BacktestResponse.DailyReturnDto dr : res.getDailyReturns()) {
            if (Math.abs(dr.getDailyReturn()) > 1e-6) spikes.add(dr);
        }

        System.out.println("==== 가격 고정 + 거래 없음 + 월 100만원 적립 ====");
        System.out.println("총 일수: " + res.getDailyReturns().size());
        System.out.println("0 이 아닌 일별수익률 개수: " + spikes.size() + " (정상이면 0)");
        for (BacktestResponse.DailyReturnDto s : spikes) {
            System.out.printf("  %s  dailyReturn=%.4f%%  equity=%.0f%n",
                    s.getDate(), s.getDailyReturn(), s.getPortfolioValue());
        }
        System.out.printf("Sharpe=%.4f  Sortino=%.4f  (가격 불변이므로 정상이면 둘 다 0)%n",
                res.getSharpeRatio(), res.getSortinoRatio());
        System.out.printf("최종가치=%.0f  총수익률=%.4f%%  (적립 분모 반영 → 정상이면 0)%n",
                res.getFinalValue(), res.getTotalReturnRate());

        // 진짜 수익률은 매일 0% 여야 한다.
        assertTrue(spikes.isEmpty(),
                "가격이 불변인데 적립일에 일별수익률 스파이크가 발생함 → DCA 수익률 버그");
        assertEquals(0.0, res.getSharpeRatio(), 1e-6,
                "가격이 불변인데 Sharpe 가 0 이 아님 → 일별수익률 오염");
    }

    @Test
    void rebalanceDcaContributionShouldNotInflateDailyReturn() throws Exception {
        // 두 자산 모두 가격 고정 100, 거래 신호 없음 → 일별수익률 매일 0% 가 정답
        List<CandlestickResponse> candlesA = new ArrayList<>();
        List<CandlestickResponse> candlesB = new ArrayList<>();
        LocalDate d = LocalDate.of(2024, 1, 1);
        for (int i = 0; i < 180; i++) {
            long t = d.atStartOfDay().toEpochSecond(KST);
            candlesA.add(new CandlestickResponse(t, 100, 100, 100, 100, 1000));
            candlesB.add(new CandlestickResponse(t, 100, 100, 100, 100, 1000));
            d = d.plusDays(1);
        }

        BacktestRequest req = new BacktestRequest();
        req.setStockCode("TESTA");
        req.setSecondStockCode("TESTB");
        req.setStartDate("2024-01-01");
        req.setEndDate("2024-06-30");
        req.setInitialCapital(10_000_000);
        req.setMonthlyContribution(1_000_000.0);
        req.setAssetType("CRYPTO");
        req.setSecondAssetType("CRYPTO");
        req.setFirstAssetWeight(60.0);
        req.setRebalanceFrequency("MONTHLY");
        req.setEntryConditions(Collections.emptyList());
        req.setExitConditions(Collections.emptyList());

        BacktestService svc = new BacktestService(null, null, null, null, null, null, null, null, null);

        // N자산 일반화(2026-07-13) 후 leg 리스트 시그니처 — 테스트 접근용 package-private 직접 호출
        List<BacktestService.RebalanceLeg> legs = List.of(
                new BacktestService.RebalanceLeg("TESTA", "TESTA", "CRYPTO", candlesA, Map.of(), 0, Map.of(), 0.6),
                new BacktestService.RebalanceLeg("TESTB", "TESTB", "CRYPTO", candlesB, Map.of(), 0, Map.of(), 0.4));
        BacktestResponse res = svc.simulateRebalance(
                "direct", "테스트", Collections.emptyList(), Collections.emptyList(),
                legs, req, false);

        List<BacktestResponse.DailyReturnDto> spikes = new ArrayList<>();
        for (BacktestResponse.DailyReturnDto dr : res.getDailyReturns()) {
            if (Math.abs(dr.getDailyReturn()) > 1e-6) spikes.add(dr);
        }

        System.out.println("==== [2자산] 가격 고정 + 거래 없음 + 월 100만원 적립 ====");
        System.out.println("0 이 아닌 일별수익률 개수: " + spikes.size() + " (정상이면 0)");
        System.out.printf("Sharpe=%.4f  Sortino=%.4f%n", res.getSharpeRatio(), res.getSortinoRatio());

        assertTrue(spikes.isEmpty(),
                "[2자산] 가격 불변인데 적립일 스파이크 발생 → DCA 수익률 버그");
        assertEquals(0.0, res.getSharpeRatio(), 1e-6,
                "[2자산] 가격 불변인데 Sharpe 가 0 이 아님 → 일별수익률 오염");
    }
}
