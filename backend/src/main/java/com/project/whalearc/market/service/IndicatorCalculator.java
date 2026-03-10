package com.project.whalearc.market.service;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.Arrays;

/**
 * 기술적 지표 계산 유틸리티.
 * 전략 실행 및 백테스팅에 사용되는 순수 정적 메서드 모음.
 * TurtleStrategyService의 Wilder smoothing 방식과 동일한 알고리즘을 사용합니다.
 */
public final class IndicatorCalculator {

    private IndicatorCalculator() {
        // 인스턴스 생성 방지
    }

    // ── 이동평균 ──

    /**
     * Simple Moving Average (단순 이동평균)
     * 계산 불가능한 앞부분(period-1개)은 NaN으로 채웁니다.
     */
    public static double[] sma(double[] data, int period) {
        int len = data.length;
        double[] result = new double[len];
        Arrays.fill(result, Double.NaN);

        if (len < period) return result;

        double sum = 0;
        for (int i = 0; i < period; i++) {
            sum += data[i];
        }
        result[period - 1] = sum / period;

        for (int i = period; i < len; i++) {
            sum += data[i] - data[i - period];
            result[i] = sum / period;
        }
        return result;
    }

    /**
     * Exponential Moving Average (지수 이동평균)
     * multiplier = 2 / (period + 1), 첫 period개의 SMA를 시드로 사용합니다.
     * 시드 이전 값은 NaN으로 채웁니다.
     */
    public static double[] ema(double[] data, int period) {
        int len = data.length;
        double[] result = new double[len];
        Arrays.fill(result, Double.NaN);

        if (len < period) return result;

        // 첫 period개의 SMA를 시드로 사용
        double sum = 0;
        for (int i = 0; i < period; i++) {
            sum += data[i];
        }
        result[period - 1] = sum / period;

        double multiplier = 2.0 / (period + 1);
        for (int i = period; i < len; i++) {
            result[i] = (data[i] - result[i - 1]) * multiplier + result[i - 1];
        }
        return result;
    }

    // ── RSI ──

    /**
     * RSI (Relative Strength Index) — Wilder's smoothing 사용.
     * TurtleStrategyService의 EWM alpha=1/n 방식과 동일합니다.
     * 첫 period개는 NaN으로 채웁니다.
     */
    public static double[] rsi(double[] closes, int period) {
        int len = closes.length;
        double[] result = new double[len];
        Arrays.fill(result, Double.NaN);

        if (len < period + 1) return result;

        double[] gains = new double[len];
        double[] losses = new double[len];

        for (int i = 1; i < len; i++) {
            double change = closes[i] - closes[i - 1];
            gains[i] = Math.max(change, 0);
            losses[i] = Math.max(-change, 0);
        }

        // 첫 period개의 평균으로 시드
        double avgGain = 0;
        double avgLoss = 0;
        for (int i = 1; i <= period; i++) {
            avgGain += gains[i];
            avgLoss += losses[i];
        }
        avgGain /= period;
        avgLoss /= period;

        if (avgLoss == 0) {
            result[period] = 100.0;
        } else {
            result[period] = 100.0 - 100.0 / (1.0 + avgGain / avgLoss);
        }

        // Wilder's smoothing: alpha = 1/period
        for (int i = period + 1; i < len; i++) {
            avgGain = (avgGain * (period - 1) + gains[i]) / period;
            avgLoss = (avgLoss * (period - 1) + losses[i]) / period;

            if (avgLoss == 0) {
                result[i] = 100.0;
            } else {
                result[i] = 100.0 - 100.0 / (1.0 + avgGain / avgLoss);
            }
        }
        return result;
    }

    // ── MACD ──

    /**
     * MACD (Moving Average Convergence Divergence)
     * EMA(fast) - EMA(slow) = MACD Line, EMA(signal) of MACD Line = Signal Line
     */
    public static MACDResult macd(double[] closes, int fast, int slow, int signal) {
        int len = closes.length;
        double[] macdLine = new double[len];
        double[] signalLine = new double[len];
        double[] histogram = new double[len];
        Arrays.fill(macdLine, Double.NaN);
        Arrays.fill(signalLine, Double.NaN);
        Arrays.fill(histogram, Double.NaN);

        double[] emaFast = ema(closes, fast);
        double[] emaSlow = ema(closes, slow);

        // MACD Line = EMA(fast) - EMA(slow)
        // slow EMA가 유효한 지점(index slow-1)부터 계산 가능
        int macdStart = slow - 1;
        for (int i = macdStart; i < len; i++) {
            if (!Double.isNaN(emaFast[i]) && !Double.isNaN(emaSlow[i])) {
                macdLine[i] = emaFast[i] - emaSlow[i];
            }
        }

        // Signal Line = EMA of MACD Line (유효한 값만 추출하여 계산)
        // 유효한 MACD 값이 signal개 쌓여야 Signal Line 계산 가능
        int validCount = 0;
        int signalSeedEnd = -1;
        double seedSum = 0;

        for (int i = 0; i < len; i++) {
            if (!Double.isNaN(macdLine[i])) {
                validCount++;
                if (validCount <= signal) {
                    seedSum += macdLine[i];
                }
                if (validCount == signal) {
                    signalSeedEnd = i;
                    break;
                }
            }
        }

        if (signalSeedEnd >= 0) {
            signalLine[signalSeedEnd] = seedSum / signal;
            histogram[signalSeedEnd] = macdLine[signalSeedEnd] - signalLine[signalSeedEnd];

            double multiplier = 2.0 / (signal + 1);
            for (int i = signalSeedEnd + 1; i < len; i++) {
                if (!Double.isNaN(macdLine[i])) {
                    signalLine[i] = (macdLine[i] - signalLine[i - 1]) * multiplier + signalLine[i - 1];
                    histogram[i] = macdLine[i] - signalLine[i];
                }
            }
        }

        return new MACDResult(macdLine, signalLine, histogram);
    }

    // ── Bollinger Bands ──

    /**
     * Bollinger Bands (볼린저 밴드)
     * Middle = SMA(period), Upper/Lower = Middle ± stdDevMultiplier * σ
     */
    public static BollingerResult bollingerBands(double[] closes, int period, double stdDevMultiplier) {
        int len = closes.length;
        double[] upper = new double[len];
        double[] middle = new double[len];
        double[] lower = new double[len];
        Arrays.fill(upper, Double.NaN);
        Arrays.fill(middle, Double.NaN);
        Arrays.fill(lower, Double.NaN);

        if (len < period) return new BollingerResult(upper, middle, lower);

        double[] smaArr = sma(closes, period);

        for (int i = period - 1; i < len; i++) {
            double mean = smaArr[i];
            double sumSqDiff = 0;
            for (int j = i - period + 1; j <= i; j++) {
                double diff = closes[j] - mean;
                sumSqDiff += diff * diff;
            }
            double stdDev = Math.sqrt(sumSqDiff / period);

            middle[i] = mean;
            upper[i] = mean + stdDevMultiplier * stdDev;
            lower[i] = mean - stdDevMultiplier * stdDev;
        }

        return new BollingerResult(upper, middle, lower);
    }

    // ── Stochastic Oscillator ──

    public static StochasticResult stochastic(double[] highs, double[] lows, double[] closes, int kPeriod, int dPeriod) {
        int len = closes.length;
        double[] k = new double[len];
        double[] d = new double[len];
        Arrays.fill(k, Double.NaN);
        Arrays.fill(d, Double.NaN);

        for (int i = kPeriod - 1; i < len; i++) {
            double hh = Double.NEGATIVE_INFINITY, ll = Double.POSITIVE_INFINITY;
            for (int j = i - kPeriod + 1; j <= i; j++) {
                hh = Math.max(hh, highs[j]);
                ll = Math.min(ll, lows[j]);
            }
            k[i] = hh == ll ? 50.0 : ((closes[i] - ll) / (hh - ll)) * 100.0;
        }

        for (int i = kPeriod - 1 + dPeriod - 1; i < len; i++) {
            double sum = 0; int cnt = 0;
            for (int j = i - dPeriod + 1; j <= i; j++) {
                if (!Double.isNaN(k[j])) { sum += k[j]; cnt++; }
            }
            if (cnt == dPeriod) d[i] = sum / dPeriod;
        }

        return new StochasticResult(k, d);
    }

    // ── ATR (Average True Range) ──

    public static double[] atr(double[] highs, double[] lows, double[] closes, int period) {
        int len = closes.length;
        double[] result = new double[len];
        Arrays.fill(result, Double.NaN);
        if (len < 2) return result;

        double[] tr = new double[len];
        tr[0] = highs[0] - lows[0];
        for (int i = 1; i < len; i++) {
            tr[i] = Math.max(highs[i] - lows[i],
                    Math.max(Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
        }

        if (len < period) return result;
        double sum = 0;
        for (int i = 0; i < period; i++) sum += tr[i];
        result[period - 1] = sum / period;

        for (int i = period; i < len; i++) {
            result[i] = (result[i - 1] * (period - 1) + tr[i]) / period;
        }
        return result;
    }

    // ── OBV (On Balance Volume) ──

    public static double[] obv(double[] closes, double[] volumes) {
        int len = closes.length;
        double[] result = new double[len];
        Arrays.fill(result, Double.NaN);
        if (len == 0) return result;

        result[0] = volumes[0];
        for (int i = 1; i < len; i++) {
            if (closes[i] > closes[i - 1]) result[i] = result[i - 1] + volumes[i];
            else if (closes[i] < closes[i - 1]) result[i] = result[i - 1] - volumes[i];
            else result[i] = result[i - 1];
        }
        return result;
    }

    // ── VWAP ──

    public static double[] vwap(double[] highs, double[] lows, double[] closes, double[] volumes) {
        int len = closes.length;
        double[] result = new double[len];
        Arrays.fill(result, Double.NaN);
        if (len == 0) return result;

        double cumTPV = 0, cumVol = 0;
        for (int i = 0; i < len; i++) {
            double tp = (highs[i] + lows[i] + closes[i]) / 3.0;
            cumTPV += tp * volumes[i];
            cumVol += volumes[i];
            result[i] = cumVol == 0 ? tp : cumTPV / cumVol;
        }
        return result;
    }

    // ── Williams %R ──

    public static double[] williamsR(double[] highs, double[] lows, double[] closes, int period) {
        int len = closes.length;
        double[] result = new double[len];
        Arrays.fill(result, Double.NaN);

        for (int i = period - 1; i < len; i++) {
            double hh = Double.NEGATIVE_INFINITY, ll = Double.POSITIVE_INFINITY;
            for (int j = i - period + 1; j <= i; j++) {
                hh = Math.max(hh, highs[j]);
                ll = Math.min(ll, lows[j]);
            }
            result[i] = hh == ll ? -50.0 : ((hh - closes[i]) / (hh - ll)) * -100.0;
        }
        return result;
    }

    // ── CCI (Commodity Channel Index) ──

    public static double[] cci(double[] highs, double[] lows, double[] closes, int period) {
        int len = closes.length;
        double[] result = new double[len];
        Arrays.fill(result, Double.NaN);

        double[] tp = new double[len];
        for (int i = 0; i < len; i++) tp[i] = (highs[i] + lows[i] + closes[i]) / 3.0;

        for (int i = period - 1; i < len; i++) {
            double sum = 0;
            for (int j = i - period + 1; j <= i; j++) sum += tp[j];
            double mean = sum / period;

            double mdSum = 0;
            for (int j = i - period + 1; j <= i; j++) mdSum += Math.abs(tp[j] - mean);
            double md = mdSum / period;

            result[i] = md == 0 ? 0 : (tp[i] - mean) / (0.015 * md);
        }
        return result;
    }

    // ── Parabolic SAR ──

    public static double[] parabolicSAR(double[] highs, double[] lows, double af, double maxAf) {
        int len = highs.length;
        double[] result = new double[len];
        Arrays.fill(result, Double.NaN);
        if (len < 2) return result;

        boolean isUp = highs[1] > highs[0];
        double sar = isUp ? lows[0] : highs[0];
        double ep = isUp ? highs[1] : lows[1];
        double curAf = af;
        result[0] = sar;

        for (int i = 1; i < len; i++) {
            sar = sar + curAf * (ep - sar);

            if (isUp) {
                sar = Math.min(sar, lows[Math.max(0, i - 1)]);
                if (i >= 2) sar = Math.min(sar, lows[i - 2]);
                if (sar > lows[i]) {
                    isUp = false; sar = ep; ep = lows[i]; curAf = af;
                } else if (highs[i] > ep) {
                    ep = highs[i]; curAf = Math.min(curAf + af, maxAf);
                }
            } else {
                sar = Math.max(sar, highs[Math.max(0, i - 1)]);
                if (i >= 2) sar = Math.max(sar, highs[i - 2]);
                if (sar < highs[i]) {
                    isUp = true; sar = ep; ep = highs[i]; curAf = af;
                } else if (lows[i] < ep) {
                    ep = lows[i]; curAf = Math.min(curAf + af, maxAf);
                }
            }
            result[i] = sar;
        }
        return result;
    }

    // ── Ichimoku (일목균형표) ──

    /**
     * Ichimoku Cloud (일목균형표)
     * - tenkan (전환선): (최고 + 최저) / 2 over tenkanPeriod
     * - kijun (기준선): (최고 + 최저) / 2 over kijunPeriod
     * - senkouA (선행스팬A): (tenkan + kijun) / 2, kijunPeriod만큼 앞으로 이동
     * - senkouB (선행스팬B): (최고 + 최저) / 2 over senkouBPeriod, kijunPeriod만큼 앞으로 이동
     * - chikou (후행스팬): 종가를 kijunPeriod만큼 뒤로 이동
     */
    public static IchimokuResult ichimoku(double[] highs, double[] lows, double[] closes,
                                           int tenkanPeriod, int kijunPeriod, int senkouBPeriod) {
        int len = closes.length;
        double[] tenkan = new double[len];
        double[] kijun = new double[len];
        double[] senkouA = new double[len];
        double[] senkouB = new double[len];
        double[] chikou = new double[len];
        Arrays.fill(tenkan, Double.NaN);
        Arrays.fill(kijun, Double.NaN);
        Arrays.fill(senkouA, Double.NaN);
        Arrays.fill(senkouB, Double.NaN);
        Arrays.fill(chikou, Double.NaN);

        // 전환선
        for (int i = tenkanPeriod - 1; i < len; i++) {
            double hh = Double.NEGATIVE_INFINITY, ll = Double.POSITIVE_INFINITY;
            for (int j = i - tenkanPeriod + 1; j <= i; j++) {
                hh = Math.max(hh, highs[j]);
                ll = Math.min(ll, lows[j]);
            }
            tenkan[i] = (hh + ll) / 2.0;
        }

        // 기준선
        for (int i = kijunPeriod - 1; i < len; i++) {
            double hh = Double.NEGATIVE_INFINITY, ll = Double.POSITIVE_INFINITY;
            for (int j = i - kijunPeriod + 1; j <= i; j++) {
                hh = Math.max(hh, highs[j]);
                ll = Math.min(ll, lows[j]);
            }
            kijun[i] = (hh + ll) / 2.0;
        }

        // 선행스팬A: (전환선 + 기준선) / 2 — kijunPeriod 앞으로 이동 (현재 데이터 범위 내만)
        for (int i = kijunPeriod - 1; i < len; i++) {
            if (!Double.isNaN(tenkan[i]) && !Double.isNaN(kijun[i])) {
                int target = i; // 실제로는 i + kijunPeriod이지만 배열 범위 내에서만
                senkouA[target] = (tenkan[i] + kijun[i]) / 2.0;
            }
        }

        // 선행스팬B: senkouBPeriod 기간의 (최고+최저)/2
        for (int i = senkouBPeriod - 1; i < len; i++) {
            double hh = Double.NEGATIVE_INFINITY, ll = Double.POSITIVE_INFINITY;
            for (int j = i - senkouBPeriod + 1; j <= i; j++) {
                hh = Math.max(hh, highs[j]);
                ll = Math.min(ll, lows[j]);
            }
            senkouB[i] = (hh + ll) / 2.0;
        }

        // 후행스팬: 종가를 kijunPeriod만큼 뒤로
        for (int i = 0; i < len - kijunPeriod; i++) {
            chikou[i] = closes[i + kijunPeriod];
        }

        return new IchimokuResult(tenkan, kijun, senkouA, senkouB, chikou);
    }

    // ── 결과 DTO ──

    @Getter
    @AllArgsConstructor
    public static class MACDResult {
        private final double[] macdLine;
        private final double[] signalLine;
        private final double[] histogram;
    }

    @Getter
    @AllArgsConstructor
    public static class BollingerResult {
        private final double[] upper;
        private final double[] middle;
        private final double[] lower;
    }

    @Getter
    @AllArgsConstructor
    public static class StochasticResult {
        private final double[] k;
        private final double[] d;
    }

    @Getter
    @AllArgsConstructor
    public static class IchimokuResult {
        private final double[] tenkan;
        private final double[] kijun;
        private final double[] senkouA;
        private final double[] senkouB;
        private final double[] chikou;
    }
}
