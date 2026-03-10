/**
 * 기술적 지표 계산 유틸리티
 * - 캔들스틱 데이터(close, high, low)를 입력으로 받아 지표 값 배열 반환
 * - 모든 함수는 입력과 동일한 길이의 배열을 반환 (부족한 앞부분은 NaN)
 */

export interface Candlestick {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ─── 기본 이동평균 ───────────────────────────────────────

/** 단순 이동평균 (SMA) */
export function sma(data: number[], period: number): number[] {
  const result = new Array(data.length).fill(NaN);
  if (data.length < period) return result;

  let sum = 0;
  for (let i = 0; i < period; i++) sum += data[i];
  result[period - 1] = sum / period;

  for (let i = period; i < data.length; i++) {
    sum += data[i] - data[i - period];
    result[i] = sum / period;
  }
  return result;
}

/** 지수 이동평균 (EMA) */
export function ema(data: number[], period: number): number[] {
  const result = new Array(data.length).fill(NaN);
  if (data.length < period) return result;

  // 첫 EMA = SMA
  let sum = 0;
  for (let i = 0; i < period; i++) sum += data[i];
  result[period - 1] = sum / period;

  const k = 2 / (period + 1);
  for (let i = period; i < data.length; i++) {
    result[i] = data[i] * k + result[i - 1] * (1 - k);
  }
  return result;
}

// ─── RSI (Relative Strength Index) ──────────────────────

export interface RSIResult {
  values: number[];
}

export function rsi(closes: number[], period = 14): RSIResult {
  const values = new Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return { values };

  // 가격 변동
  const deltas: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    deltas.push(closes[i] - closes[i - 1]);
  }

  // 초기 평균 gain/loss (SMA)
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    if (deltas[i] > 0) avgGain += deltas[i];
    else avgLoss += Math.abs(deltas[i]);
  }
  avgGain /= period;
  avgLoss /= period;

  // 첫 RSI
  const rs0 = avgLoss === 0 ? 100 : avgGain / avgLoss;
  values[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs0);

  // Wilder's smoothing
  for (let i = period; i < deltas.length; i++) {
    const gain = deltas[i] > 0 ? deltas[i] : 0;
    const loss = deltas[i] < 0 ? Math.abs(deltas[i]) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    values[i + 1] = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);
  }

  return { values };
}

// ─── MACD (Moving Average Convergence Divergence) ───────

export interface MACDResult {
  macd: number[];      // MACD 라인
  signal: number[];    // 시그널 라인
  histogram: number[]; // 히스토그램
}

export function macd(
  closes: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): MACDResult {
  const len = closes.length;
  const result: MACDResult = {
    macd: new Array(len).fill(NaN),
    signal: new Array(len).fill(NaN),
    histogram: new Array(len).fill(NaN),
  };

  const fastEma = ema(closes, fastPeriod);
  const slowEma = ema(closes, slowPeriod);

  // MACD 라인 = fastEMA - slowEMA
  const macdLine: number[] = new Array(len).fill(NaN);
  for (let i = 0; i < len; i++) {
    if (!isNaN(fastEma[i]) && !isNaN(slowEma[i])) {
      macdLine[i] = fastEma[i] - slowEma[i];
    }
  }

  // 유효한 MACD 값만 추출해서 시그널 EMA 계산
  const validStart = macdLine.findIndex(v => !isNaN(v));
  if (validStart === -1) return result;

  const validMacd = macdLine.slice(validStart);
  const signalEma = ema(validMacd, signalPeriod);

  for (let i = 0; i < validMacd.length; i++) {
    const idx = i + validStart;
    result.macd[idx] = macdLine[idx];
    if (!isNaN(signalEma[i])) {
      result.signal[idx] = signalEma[i];
      result.histogram[idx] = macdLine[idx] - signalEma[i];
    }
  }

  return result;
}

// ─── 볼린저 밴드 ────────────────────────────────────────

export interface BollingerResult {
  upper: number[];   // 상단 밴드
  middle: number[];  // 중간선 (SMA)
  lower: number[];   // 하단 밴드
}

export function bollingerBands(
  closes: number[],
  period = 20,
  stdDevMultiplier = 2
): BollingerResult {
  const len = closes.length;
  const result: BollingerResult = {
    upper: new Array(len).fill(NaN),
    middle: new Array(len).fill(NaN),
    lower: new Array(len).fill(NaN),
  };

  const mid = sma(closes, period);

  for (let i = period - 1; i < len; i++) {
    // 표준편차 계산
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = closes[j] - mid[i];
      sumSq += diff * diff;
    }
    const stdDev = Math.sqrt(sumSq / period);

    result.middle[i] = mid[i];
    result.upper[i] = mid[i] + stdDevMultiplier * stdDev;
    result.lower[i] = mid[i] - stdDevMultiplier * stdDev;
  }

  return result;
}

// ─── 스토캐스틱 오실레이터 ─────────────────────────────

export interface StochasticResult {
  k: number[];  // %K (Fast)
  d: number[];  // %D (Slow, SMA of %K)
}

export function stochastic(
  highs: number[], lows: number[], closes: number[],
  kPeriod = 14, dPeriod = 3
): StochasticResult {
  const len = closes.length;
  const k = new Array(len).fill(NaN);
  const d = new Array(len).fill(NaN);

  for (let i = kPeriod - 1; i < len; i++) {
    let hh = -Infinity, ll = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      hh = Math.max(hh, highs[j]);
      ll = Math.min(ll, lows[j]);
    }
    k[i] = hh === ll ? 50 : ((closes[i] - ll) / (hh - ll)) * 100;
  }

  // %D = SMA of %K
  for (let i = kPeriod - 1 + dPeriod - 1; i < len; i++) {
    let sum = 0, cnt = 0;
    for (let j = i - dPeriod + 1; j <= i; j++) {
      if (!isNaN(k[j])) { sum += k[j]; cnt++; }
    }
    if (cnt === dPeriod) d[i] = sum / dPeriod;
  }

  return { k, d };
}

// ─── ATR (Average True Range) ─────────────────────────

export interface ATRResult { values: number[]; }

export function atr(
  highs: number[], lows: number[], closes: number[], period = 14
): ATRResult {
  const len = closes.length;
  const values = new Array(len).fill(NaN);
  if (len < 2) return { values };

  const tr = new Array(len).fill(0);
  tr[0] = highs[0] - lows[0];
  for (let i = 1; i < len; i++) {
    tr[i] = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
  }

  if (len < period) return { values };

  let sum = 0;
  for (let i = 0; i < period; i++) sum += tr[i];
  values[period - 1] = sum / period;

  // Wilder's smoothing
  for (let i = period; i < len; i++) {
    values[i] = (values[i - 1] * (period - 1) + tr[i]) / period;
  }
  return { values };
}

// ─── OBV (On Balance Volume) ──────────────────────────

export interface OBVResult { values: number[]; }

export function obv(closes: number[], volumes: number[]): OBVResult {
  const len = closes.length;
  const values = new Array(len).fill(NaN);
  if (len === 0) return { values };

  values[0] = volumes[0];
  for (let i = 1; i < len; i++) {
    if (closes[i] > closes[i - 1]) values[i] = values[i - 1] + volumes[i];
    else if (closes[i] < closes[i - 1]) values[i] = values[i - 1] - volumes[i];
    else values[i] = values[i - 1];
  }
  return { values };
}

// ─── VWAP (Volume Weighted Average Price) ─────────────

export interface VWAPResult { values: number[]; }

export function vwap(
  highs: number[], lows: number[], closes: number[], volumes: number[]
): VWAPResult {
  const len = closes.length;
  const values = new Array(len).fill(NaN);
  if (len === 0) return { values };

  let cumTPV = 0, cumVol = 0;
  for (let i = 0; i < len; i++) {
    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    cumTPV += tp * volumes[i];
    cumVol += volumes[i];
    values[i] = cumVol === 0 ? tp : cumTPV / cumVol;
  }
  return { values };
}

// ─── Williams %R ──────────────────────────────────────

export interface WilliamsRResult { values: number[]; }

export function williamsR(
  highs: number[], lows: number[], closes: number[], period = 14
): WilliamsRResult {
  const len = closes.length;
  const values = new Array(len).fill(NaN);

  for (let i = period - 1; i < len; i++) {
    let hh = -Infinity, ll = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      hh = Math.max(hh, highs[j]);
      ll = Math.min(ll, lows[j]);
    }
    values[i] = hh === ll ? -50 : ((hh - closes[i]) / (hh - ll)) * -100;
  }
  return { values };
}

// ─── CCI (Commodity Channel Index) ───────────────────

export interface CCIResult { values: number[]; }

export function cci(
  highs: number[], lows: number[], closes: number[], period = 20
): CCIResult {
  const len = closes.length;
  const values = new Array(len).fill(NaN);

  const tp = new Array(len);
  for (let i = 0; i < len; i++) tp[i] = (highs[i] + lows[i] + closes[i]) / 3;

  for (let i = period - 1; i < len; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += tp[j];
    const mean = sum / period;

    let mdSum = 0;
    for (let j = i - period + 1; j <= i; j++) mdSum += Math.abs(tp[j] - mean);
    const md = mdSum / period;

    values[i] = md === 0 ? 0 : (tp[i] - mean) / (0.015 * md);
  }
  return { values };
}

// ─── Parabolic SAR ────────────────────────────────────

export interface ParabolicSARResult { values: number[]; }

export function parabolicSAR(
  highs: number[], lows: number[], af = 0.02, maxAf = 0.2
): ParabolicSARResult {
  const len = highs.length;
  const values = new Array(len).fill(NaN);
  if (len < 2) return { values };

  let isUp = highs[1] > highs[0];
  let sar = isUp ? lows[0] : highs[0];
  let ep = isUp ? highs[1] : lows[1];
  let curAf = af;

  values[0] = sar;

  for (let i = 1; i < len; i++) {
    sar = sar + curAf * (ep - sar);

    if (isUp) {
      sar = Math.min(sar, lows[Math.max(0, i - 1)]);
      if (i >= 2) sar = Math.min(sar, lows[i - 2]);

      if (sar > lows[i]) {
        isUp = false;
        sar = ep;
        ep = lows[i];
        curAf = af;
      } else if (highs[i] > ep) {
        ep = highs[i];
        curAf = Math.min(curAf + af, maxAf);
      }
    } else {
      sar = Math.max(sar, highs[Math.max(0, i - 1)]);
      if (i >= 2) sar = Math.max(sar, highs[i - 2]);

      if (sar < highs[i]) {
        isUp = true;
        sar = ep;
        ep = highs[i];
        curAf = af;
      } else if (lows[i] < ep) {
        ep = lows[i];
        curAf = Math.min(curAf + af, maxAf);
      }
    }

    values[i] = sar;
  }
  return { values };
}

// ─── 일목균형표 (Ichimoku Cloud) ─────────────────────

export interface IchimokuResult {
  tenkan: number[];   // 전환선 (9)
  kijun: number[];    // 기준선 (26)
  senkouA: number[];  // 선행스팬A
  senkouB: number[];  // 선행스팬B
  chikou: number[];   // 후행스팬
}

export function ichimoku(
  highs: number[], lows: number[], closes: number[],
  tenkanP = 9, kijunP = 26, senkouBP = 52
): IchimokuResult {
  const len = highs.length;
  const tenkan = new Array(len).fill(NaN);
  const kijun = new Array(len).fill(NaN);
  const senkouA = new Array(len).fill(NaN);
  const senkouB = new Array(len).fill(NaN);
  const chikou = new Array(len).fill(NaN);

  const midpoint = (start: number, period: number) => {
    let hi = -Infinity, lo = Infinity;
    for (let i = start; i < start + period && i < len; i++) {
      hi = Math.max(hi, highs[i]);
      lo = Math.min(lo, lows[i]);
    }
    return (hi + lo) / 2;
  };

  for (let i = tenkanP - 1; i < len; i++)
    tenkan[i] = midpoint(i - tenkanP + 1, tenkanP);

  for (let i = kijunP - 1; i < len; i++)
    kijun[i] = midpoint(i - kijunP + 1, kijunP);

  // 선행스팬A = (전환선 + 기준선) / 2
  for (let i = kijunP - 1; i < len; i++) {
    if (!isNaN(tenkan[i]) && !isNaN(kijun[i]))
      senkouA[i] = (tenkan[i] + kijun[i]) / 2;
  }

  // 선행스팬B = 52기간 중간값
  for (let i = senkouBP - 1; i < len; i++)
    senkouB[i] = midpoint(i - senkouBP + 1, senkouBP);

  // 후행스팬 = 현재 종가를 26봉 뒤로 이동
  for (let i = kijunP; i < len; i++)
    chikou[i - kijunP] = closes[i];

  return { tenkan, kijun, senkouA, senkouB, chikou };
}

// ─── 이동평균 (여러 기간) ───────────────────────────────

export interface MAResult {
  values: number[];
  period: number;
  type: 'SMA' | 'EMA';
}

export function movingAverage(
  closes: number[],
  period: number,
  type: 'SMA' | 'EMA' = 'SMA'
): MAResult {
  return {
    values: type === 'SMA' ? sma(closes, period) : ema(closes, period),
    period,
    type,
  };
}

// ─── 지표 설정 타입 ─────────────────────────────────────

export type IndicatorConfig =
  | { type: 'MA'; period: number; maType: 'SMA' | 'EMA' }
  | { type: 'RSI'; period: number }
  | { type: 'MACD'; fastPeriod: number; slowPeriod: number; signalPeriod: number }
  | { type: 'BOLLINGER'; period: number; stdDev: number }
  | { type: 'STOCHASTIC'; kPeriod: number; dPeriod: number }
  | { type: 'ATR'; period: number }
  | { type: 'OBV' }
  | { type: 'VWAP' }
  | { type: 'WILLIAMS_R'; period: number }
  | { type: 'CCI'; period: number }
  | { type: 'PARABOLIC_SAR'; af: number; maxAf: number }
  | { type: 'ICHIMOKU'; tenkan: number; kijun: number; senkouB: number };

export const DEFAULT_INDICATORS: Record<string, IndicatorConfig> = {
  'MA5': { type: 'MA', period: 5, maType: 'SMA' },
  'MA20': { type: 'MA', period: 20, maType: 'SMA' },
  'MA60': { type: 'MA', period: 60, maType: 'SMA' },
  'EMA': { type: 'MA', period: 20, maType: 'EMA' },
  'RSI': { type: 'RSI', period: 14 },
  'MACD': { type: 'MACD', fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
  'BOLLINGER': { type: 'BOLLINGER', period: 20, stdDev: 2 },
  'STOCHASTIC': { type: 'STOCHASTIC', kPeriod: 14, dPeriod: 3 },
  'ATR': { type: 'ATR', period: 14 },
  'OBV': { type: 'OBV' },
  'VWAP': { type: 'VWAP' },
  'WILLIAMS_R': { type: 'WILLIAMS_R', period: 14 },
  'CCI': { type: 'CCI', period: 20 },
  'PARABOLIC_SAR': { type: 'PARABOLIC_SAR', af: 0.02, maxAf: 0.2 },
  'ICHIMOKU': { type: 'ICHIMOKU', tenkan: 9, kijun: 26, senkouB: 52 },
};

// ─── 지표 색상 ──────────────────────────────────────────

export const INDICATOR_COLORS: Record<string, string> = {
  'MA5': '#f59e0b',       // amber
  'MA20': '#3b82f6',      // blue
  'MA60': '#a855f7',      // purple
  'EMA': '#10b981',       // emerald
  'RSI': '#8b5cf6',       // violet
  'MACD': '#3b82f6',      // blue (MACD line)
  'MACD_SIGNAL': '#ef4444', // red (signal line)
  'BOLLINGER_UPPER': '#6366f1',
  'BOLLINGER_MIDDLE': '#6366f1',
  'BOLLINGER_LOWER': '#6366f1',
  'STOCHASTIC_K': '#3b82f6',
  'STOCHASTIC_D': '#ef4444',
  'ATR': '#f97316',       // orange
  'OBV': '#06b6d4',       // cyan
  'VWAP': '#ec4899',      // pink
  'WILLIAMS_R': '#14b8a6', // teal
  'CCI': '#f59e0b',       // amber
  'PARABOLIC_SAR': '#8b5cf6', // violet
  'ICHIMOKU_TENKAN': '#ef4444',
  'ICHIMOKU_KIJUN': '#3b82f6',
  'ICHIMOKU_SENKOU_A': '#10b981',
  'ICHIMOKU_SENKOU_B': '#f97316',
  'ICHIMOKU_CHIKOU': '#a855f7',
};
