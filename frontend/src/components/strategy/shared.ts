import type { CSSProperties } from 'react';
import type { UserTier } from '../../services/userService';
import type { Indicator, Condition } from '../../services/strategyService';
import { PRESET_STRATEGIES, type PresetStrategy } from '../../data/presetStrategies';
import { SONAR as GLOW, INK1, LINE } from '../console/format';

/* ────────────────────────────────────────────────────────────
   전략·백테스트 공용 토큰/타입 — ConsoleStrategyPage와
   strategy/ 하위 모듈(ResultView·BacktestRunner·BuilderModal)이 공유.
   컴포넌트(StationBar·Label)는 ui.tsx.
   ──────────────────────────────────────────────────────────── */

/* ACCENT는 전략 페이지 버튼 그라데이션 전용 색. */
export const ACCENT = '#2c6fe6';
export const BT_GRAD = 'linear-gradient(105deg, #142647 0%, #1d3c7a 52%, #2c6fe6 100%)';
export const fmtNum = (n: number) => Math.round(Number.isFinite(n) ? n : 0).toLocaleString('ko-KR');

export const seg = (on: boolean): CSSProperties => ({ border: on ? '1px solid rgba(91,157,255,.32)' : `1px solid ${LINE}`, background: on ? 'rgba(91,157,255,.14)' : 'var(--ci-card)', color: on ? GLOW : INK1 });
export const fieldStyle: CSSProperties = { border: `1px solid ${LINE}`, background: 'var(--ci-card)', color: 'var(--ci-ink0)' };
export const PARAM_LABEL: Record<string, string> = { period: '기간', fast: '단기 EMA', slow: '장기 EMA', signal: '시그널', stdDev: '표준편차', kPeriod: '%K 기간', dPeriod: '%D 기간' };

export type Strat = { id: string; name: string; cat: string; level: 'beginner' | 'intermediate' | 'advanced'; short: string; n: number; isUser?: boolean; applied?: boolean; assetCount?: number; minTier?: UserTier };
export type Target = { symbol: string; name: string; assetType: string };
// 다중 자산 리밸런싱의 추가 자산 (기본 자산 외 최대 4개)
export type RebalAsset = Target & { weight: number };
export const MAX_REBAL_EXTRAS = 4; // 기본 자산 포함 총 5자산
export type RebalFreq = 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
export type Sizing = 'ALL_IN' | 'PERCENT' | 'FIXED_AMOUNT';
export type AdvOpts = {
  stopLoss: string; takeProfit: string; trailingStop: string; slippage: string; commission: string; leverage: string;
  tradeDirection: 'LONG_ONLY' | 'SHORT_ONLY' | 'LONG_SHORT' | 'LONG_SHORT_FLAT'; dividendReinvest: boolean;
  positionSizing: Sizing; positionValue: string; maxPositions: string; // maxPositions: 'auto' = 프리셋/기본
  dateMode: 'preset' | 'custom'; customStart: string; customEnd: string;
};
export const ADV_DEFAULTS: AdvOpts = { stopLoss: '', takeProfit: '', trailingStop: '', slippage: '', commission: '', leverage: '', tradeDirection: 'LONG_ONLY', dividendReinvest: true, positionSizing: 'ALL_IN', positionValue: '', maxPositions: 'auto', dateMode: 'preset', customStart: '', customEnd: '' };

// 프리셋 → 백테스트 요청용 지표/조건 — presetStrategies.ts에서 파생
export const PRESET_DEFS: Record<string, {
  indicators: Indicator[]; entryConditions: Condition[]; exitConditions: Condition[];
  maxPositions?: number; trailingStopPercent?: number; leverage?: number;
  tradeDirection?: PresetStrategy['tradeDirection']; pyramidMode?: PresetStrategy['pyramidMode'];
  shortEntryConditions?: Condition[]; shortExitConditions?: Condition[];
}> = Object.fromEntries(
  PRESET_STRATEGIES.map(s => [s.id, {
    indicators: s.indicators, entryConditions: s.entryConditions, exitConditions: s.exitConditions,
    maxPositions: s.maxPositions, trailingStopPercent: s.trailingStopPercent, leverage: s.leverage,
    tradeDirection: s.tradeDirection, pyramidMode: s.pyramidMode,
    shortEntryConditions: s.shortEntryConditions, shortExitConditions: s.shortExitConditions,
  }]),
);

export function periodDates(period: string): { startDate: string; endDate: string } {
  const end = new Date(); const start = new Date();
  if (period === '6M') start.setMonth(start.getMonth() - 6);
  else if (period === '2Y') start.setFullYear(start.getFullYear() - 2);
  else if (period === '3Y') start.setFullYear(start.getFullYear() - 3);
  else if (period === '5Y') start.setFullYear(start.getFullYear() - 5);
  else if (period === '10Y') start.setFullYear(start.getFullYear() - 10);
  else start.setFullYear(start.getFullYear() - 1);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { startDate: fmt(start), endDate: fmt(end) };
}
