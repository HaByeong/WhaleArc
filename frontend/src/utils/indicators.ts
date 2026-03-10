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
  | { type: 'BOLLINGER'; period: number; stdDev: number };

export const DEFAULT_INDICATORS: Record<string, IndicatorConfig> = {
  'MA5': { type: 'MA', period: 5, maType: 'SMA' },
  'MA20': { type: 'MA', period: 20, maType: 'SMA' },
  'MA60': { type: 'MA', period: 60, maType: 'SMA' },
  'RSI': { type: 'RSI', period: 14 },
  'MACD': { type: 'MACD', fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
  'BOLLINGER': { type: 'BOLLINGER', period: 20, stdDev: 2 },
};

// ─── 지표 색상 ──────────────────────────────────────────

export const INDICATOR_COLORS: Record<string, string> = {
  'MA5': '#f59e0b',     // amber
  'MA20': '#3b82f6',    // blue
  'MA60': '#a855f7',    // purple
  'RSI': '#8b5cf6',     // violet
  'MACD': '#3b82f6',    // blue (MACD line)
  'MACD_SIGNAL': '#ef4444', // red (signal line)
  'BOLLINGER_UPPER': '#6366f1', // indigo
  'BOLLINGER_MIDDLE': '#6366f1',
  'BOLLINGER_LOWER': '#6366f1',
};
