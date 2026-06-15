package com.project.whalearc.strategy.service;

import com.project.whalearc.market.dto.CandlestickResponse;
import com.project.whalearc.market.service.BacktestDataProvider;
import com.project.whalearc.market.service.ExchangeRateService;
import com.project.whalearc.strategy.dto.BacktestRequest;
import com.project.whalearc.strategy.dto.BacktestResponse;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 모멘텀 로테이션 백테스트 엔진 통합 검증 — 합성 데이터로 전체 파이프라인(마스터축 정렬·월별 랭킹·
 * shift(1)·리밸런싱·지표 산출)을 오프라인 확인한다. (실데이터 골든 수치는 배포 후 UI에서 검증)
 */
class MomentumRotationBacktestServiceTest {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final LocalDate DATA_START = LocalDate.of(2022, 6, 1);
    private static final int DAYS = 600;

    /** start로부터 DAYS개 연속일, 선형 가격 시계열. */
    private List<CandlestickResponse> series(double startPrice, double endPrice) {
        List<CandlestickResponse> out = new ArrayList<>();
        for (int i = 0; i < DAYS; i++) {
            double p = startPrice + (endPrice - startPrice) * i / (DAYS - 1);
            long t = DATA_START.plusDays(i).atStartOfDay(KST).toEpochSecond();
            out.add(new CandlestickResponse(t, p, p, p, p, 1000));
        }
        return out;
    }

    private List<CandlestickResponse> synth(String symbol) {
        return switch (symbol) {
            case "SPY" -> series(400, 520);   // 상승 → 강세 레짐(풀 노출)
            case "AAPL" -> series(100, 300);  // 최강 모멘텀 → 항상 top1
            case "XOM" -> series(50, 60);      // 약한 양수
            case "F" -> series(20, 10);        // 음수 → 후보 제외
            default -> List.of();              // 나머지 유니버스 종목은 데이터 없음(스킵)
        };
    }

    @Test
    void momentumRotation_picksStrongestRiser_andProfits() {
        BacktestDataProvider provider = mock(BacktestDataProvider.class);
        when(provider.getBacktestCandles(anyString(), anyString(), anyString(), anyString(), anyBoolean()))
                .thenAnswer(inv -> synth(inv.getArgument(0)));
        ExchangeRateService fx = mock(ExchangeRateService.class);
        when(fx.getUsdKrwRate()).thenReturn(1400.0);

        MomentumRotationBacktestService svc = new MomentumRotationBacktestService(provider, fx);

        BacktestRequest req = new BacktestRequest();
        req.setStrategyType("MOMENTUM_ROTATION");
        req.setStartDate("2023-01-02");   // 충분한 선행 데이터(2022-06~) 확보
        req.setEndDate("2024-01-01");
        req.setInitialCapital(10_000_000);
        req.setTopN(1);
        req.setLookbackDays(60);
        req.setRegimeFilter(true);

        BacktestResponse r = svc.run(req, "u1");

        assertNotNull(r.getRotationHistory());
        assertFalse(r.getRotationHistory().isEmpty(), "월별 보유 이력이 있어야 함");
        // top1은 항상 최강 모멘텀 AAPL (F는 음수라 제외, XOM보다 AAPL이 강함)
        for (var snap : r.getRotationHistory()) {
            assertEquals(1, snap.getHoldings().size(), "topN=1");
            assertEquals("AAPL", snap.getHoldings().get(0).getSymbol(), "최강 모멘텀 종목 선택");
            assertFalse(snap.isRegimeBear(), "상승 SPY → 강세 레짐");
        }
        // AAPL(상승) 보유 → 수익 + SPY 벤치 존재 + USD 통화
        assertTrue(r.getTotalReturnRate() > 0, "상승 종목 보유 → 양의 수익률, 실제 " + r.getTotalReturnRate());
        assertTrue(r.getFinalValue() > r.getInitialCapital());
        assertEquals("USD", r.getCurrency());
        assertTrue(r.getBuyHoldReturnRate() > 0, "SPY 벤치마크(상승)");
    }

    @Test
    void allNegativeMomentum_goesToCash() {
        BacktestDataProvider provider = mock(BacktestDataProvider.class);
        when(provider.getBacktestCandles(anyString(), anyString(), anyString(), anyString(), anyBoolean()))
                .thenAnswer(inv -> {
                    String s = inv.getArgument(0);
                    if (s.equals("SPY")) return series(400, 520);
                    if (s.equals("AAPL")) return series(300, 150);   // 하락 → 음수
                    return List.of();
                });
        ExchangeRateService fx = mock(ExchangeRateService.class);
        when(fx.getUsdKrwRate()).thenReturn(1400.0);

        MomentumRotationBacktestService svc = new MomentumRotationBacktestService(provider, fx);
        BacktestRequest req = new BacktestRequest();
        req.setStrategyType("MOMENTUM_ROTATION");
        req.setStartDate("2023-01-02"); req.setEndDate("2024-01-01");
        req.setInitialCapital(10_000_000); req.setTopN(1); req.setLookbackDays(60);

        BacktestResponse r = svc.run(req, "u1");
        // 양수 모멘텀 종목이 없으면 전액 현금 → 수익률 ~0
        assertEquals(0.0, r.getTotalReturnRate(), 0.5, "양수 모멘텀 없음 → 현금 보유, 실제 " + r.getTotalReturnRate());
        assertTrue(r.getRotationHistory().stream().allMatch(s -> s.getHoldings().isEmpty()), "모두 현금");
    }
}
