package com.project.whalearc.market.service;

import com.project.whalearc.market.service.IndicatorCalculator.BollingerResult;
import com.project.whalearc.market.service.IndicatorCalculator.MACDResult;
import com.project.whalearc.market.service.IndicatorCalculator.StochasticResult;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 기술적 지표 계산기 단위 테스트 — 백테스트·차트의 핵심 수식을 알려진 입력/기대값으로 고정한다.
 * (시드 관례: SMA = 첫 period개 평균 NaN워밍업, EMA = SMA시드, RSI/ATR = Wilder smoothing)
 */
class IndicatorCalculatorTest {

    private static final double EPS = 1e-9;

    // ── SMA ──
    @Test
    void sma_warmupNaN_thenSlidingAverage() {
        double[] r = IndicatorCalculator.sma(new double[]{1, 2, 3, 4, 5}, 3);
        assertTrue(Double.isNaN(r[0]) && Double.isNaN(r[1]), "앞 period-1개는 NaN");
        assertEquals(2.0, r[2], EPS); // (1+2+3)/3
        assertEquals(3.0, r[3], EPS); // (2+3+4)/3
        assertEquals(4.0, r[4], EPS); // (3+4+5)/3
    }

    @Test
    void sma_shorterThanPeriod_allNaN() {
        double[] r = IndicatorCalculator.sma(new double[]{1, 2}, 5);
        for (double v : r) assertTrue(Double.isNaN(v));
    }

    // ── EMA ──
    @Test
    void ema_seedsWithSma_thenRecurrence() {
        double[] r = IndicatorCalculator.ema(new double[]{2, 4, 6, 8, 10}, 3);
        assertTrue(Double.isNaN(r[0]) && Double.isNaN(r[1]));
        assertEquals(4.0, r[2], EPS);  // SMA(2,4,6)
        assertEquals(6.0, r[3], EPS);  // (8-4)*0.5+4
        assertEquals(8.0, r[4], EPS);  // (10-6)*0.5+6
    }

    @Test
    void ema_constantSeries_staysConstant() {
        double[] r = IndicatorCalculator.ema(new double[]{5, 5, 5, 5, 5}, 2);
        for (int i = 1; i < r.length; i++) assertEquals(5.0, r[i], EPS);
    }

    // ── RSI ──
    @Test
    void rsi_warmupNaN_andBounds() {
        double[] closes = {10, 11, 10.5, 11.5, 12, 11, 11.8, 12.5, 12.2, 13, 12.8, 13.5, 14, 13.7, 14.2, 15};
        double[] r = IndicatorCalculator.rsi(closes, 14);
        for (int i = 0; i < 14; i++) assertTrue(Double.isNaN(r[i]), "첫 period개는 NaN (idx " + i + ")");
        assertFalse(Double.isNaN(r[14]), "index period부터 값 존재");
        for (int i = 14; i < r.length; i++) {
            assertTrue(r[i] >= 0 && r[i] <= 100, "RSI는 0~100 (idx " + i + " = " + r[i] + ")");
        }
    }

    @Test
    void rsi_monotonicUp_is100_monotonicDown_is0() {
        double[] up = {1, 2, 3, 4, 5};   // 모든 변화 양수
        assertEquals(100.0, IndicatorCalculator.rsi(up, 3)[3], EPS);
        double[] down = {5, 4, 3, 2, 1}; // 모든 변화 음수
        assertEquals(0.0, IndicatorCalculator.rsi(down, 3)[3], EPS);
    }

    // ── MACD ──
    @Test
    void macd_lineEqualsEmaFastMinusEmaSlow() {
        double[] closes = new double[40];
        for (int i = 0; i < closes.length; i++) closes[i] = 100 + Math.sin(i * 0.3) * 10 + i * 0.5;
        MACDResult m = IndicatorCalculator.macd(closes, 12, 26, 9);
        double[] emaFast = IndicatorCalculator.ema(closes, 12);
        double[] emaSlow = IndicatorCalculator.ema(closes, 26);
        for (int i = 25; i < closes.length; i++) {
            if (!Double.isNaN(emaFast[i]) && !Double.isNaN(emaSlow[i])) {
                assertEquals(emaFast[i] - emaSlow[i], m.getMacdLine()[i], EPS, "MACD = EMA(12)-EMA(26) (idx " + i + ")");
            }
        }
        // 히스토그램 = MACD - Signal (유효 구간)
        for (int i = 0; i < closes.length; i++) {
            if (!Double.isNaN(m.getHistogram()[i])) {
                assertEquals(m.getMacdLine()[i] - m.getSignalLine()[i], m.getHistogram()[i], EPS);
            }
        }
    }

    // ── Bollinger ──
    @Test
    void bollinger_middleIsSma_andOrdering() {
        double[] closes = {10, 12, 11, 13, 14, 12, 15, 16, 14, 17};
        BollingerResult b = IndicatorCalculator.bollingerBands(closes, 5, 2.0);
        double[] sma = IndicatorCalculator.sma(closes, 5);
        for (int i = 4; i < closes.length; i++) {
            assertEquals(sma[i], b.getMiddle()[i], EPS, "중심선 = SMA");
            assertTrue(b.getUpper()[i] >= b.getMiddle()[i], "상단 >= 중심");
            assertTrue(b.getMiddle()[i] >= b.getLower()[i], "중심 >= 하단");
        }
    }

    @Test
    void bollinger_constantPrices_zeroWidth() {
        double[] closes = {100, 100, 100, 100, 100, 100};
        BollingerResult b = IndicatorCalculator.bollingerBands(closes, 3, 2.0);
        for (int i = 2; i < closes.length; i++) {
            assertEquals(100.0, b.getUpper()[i], EPS);
            assertEquals(100.0, b.getLower()[i], EPS); // 표준편차 0 → 밴드폭 0
        }
    }

    // ── Stochastic ──
    @Test
    void stochastic_closeAtHigh_is100_atLow_is0() {
        double[] highs = {10, 11, 12};
        double[] lows = {8, 9, 8};
        StochasticResult atHigh = IndicatorCalculator.stochastic(highs, lows, new double[]{9, 10, 12}, 3, 1);
        assertEquals(100.0, atHigh.getK()[2], EPS); // 종가=최고가 → %K=100
        StochasticResult atLow = IndicatorCalculator.stochastic(highs, lows, new double[]{9, 10, 8}, 3, 1);
        assertEquals(0.0, atLow.getK()[2], EPS);    // 종가=최저가 → %K=0
    }

    @Test
    void stochastic_kAlwaysInRange() {
        double[] highs = new double[30], lows = new double[30], closes = new double[30];
        for (int i = 0; i < 30; i++) {
            double base = 100 + Math.sin(i * 0.4) * 5;
            highs[i] = base + 2; lows[i] = base - 2; closes[i] = base + Math.cos(i) * 1.5;
        }
        StochasticResult s = IndicatorCalculator.stochastic(highs, lows, closes, 14, 3);
        for (int i = 13; i < 30; i++) {
            assertTrue(s.getK()[i] >= 0 && s.getK()[i] <= 100, "%K 0~100");
        }
    }

    // ── ATR ──
    @Test
    void atr_wilderSeedIsAvgOfFirstTrs_andPositive() {
        double[] highs = {10, 11, 12, 13};
        double[] lows = {9, 10, 11, 12};
        double[] closes = {9.5, 10.5, 11.5, 12.5};
        double[] atr = IndicatorCalculator.atr(highs, lows, closes, 2);
        // tr[0]=1, tr[1]=max(1,1.5,0.5)=1.5 → seed result[1]=(1+1.5)/2
        assertEquals(1.25, atr[1], EPS);
        for (int i = 1; i < atr.length; i++) assertTrue(atr[i] > 0, "ATR은 양수");
    }
}
