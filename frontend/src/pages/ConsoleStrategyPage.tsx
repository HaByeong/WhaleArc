import type { ReactNode } from 'react';
import { useMemo, useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRoutePrefix } from '../hooks/useRoutePrefix';
import HelmShell from '../components/HelmShell';
import {
  strategyService, exportBacktestCsv,
  type BacktestRequest, type BacktestResult, type Indicator, type Condition, type BacktestHistoryItem, type Strategy,
} from '../services/strategyService';
import { marketService } from '../services/marketService';
import { PRESET_STRATEGIES, type PresetStrategy, TURTLE_PRESET_ID, TURTLE_DEFAULTS, buildTurtleConditions, type TurtleParams } from '../data/presetStrategies';
import { tradeService } from '../services/tradeService';
import { Term } from '../components/GlossaryTerm';
import GuideTour, { type TourStep } from '../components/GuideTour';
import FunnelSteps from '../components/FunnelSteps';

const STRAT_TOUR: TourStep[] = [
  { target: 'library', title: '① 전략 고르기', description: '기본 전략(골든크로스·RSI 등)을 고르거나 "새 항로 만들기"로 직접 만들 수 있어요.\n\n내 전략 카드 아래의 버튼으로 ⚓ 모의 적용·⚡ 자동매매도 켤 수 있습니다.', position: 'right' },
  { target: 'runner', title: '② 백테스트 설정 & 실행', description: '테스트할 종목·기간·투자금과 리스크 옵션(손절·익절)을 정하고 "백테스트 실행"을 누르면, "과거에 이 전략을 썼다면 얼마 벌었을까?"를 계산해줘요.', position: 'left' },
  { target: 'result', title: '③ 결과 확인', description: '수익률·최대낙폭(MDD)·승률과 매매 내역이 차트로 표시됩니다.\n\n전략을 고르면 이 자리에 먼저 "이 전략이 뭔지" 쉬운 설명과 시각화가 나타나요.', position: 'top' },
];

/* ────────────────────────────────────────────────────────────
   ConsoleStrategyPage — 전략(백테스트) 실데이터 배선
   프리셋 → indicators/conditions 매핑 + strategyService.runBacktest +
   실 결과 렌더(KPI·가격차트·자산추이·상세지표·거래내역) + CSV + 히스토리.
   ──────────────────────────────────────────────────────────── */

const UP = '#ef4d4d', DOWN = '#4d8aff', GLOW = 'var(--ci-sonar)', ACCENT = '#2c6fe6', COMPASS = '#f5d061';
const INK1 = 'var(--ci-ink1)', INK2 = 'var(--ci-ink2)', INK3 = 'var(--ci-ink3)';
const LINE = 'var(--ci-line)', LINE_S = 'var(--ci-line-strong)';
const BT_GRAD = 'linear-gradient(105deg, #142647 0%, #1d3c7a 52%, #2c6fe6 100%)';
const fmtNum = (n: number) => Math.round(Number.isFinite(n) ? n : 0).toLocaleString('ko-KR');
const mkCard: React.CSSProperties = { borderRadius: 16, background: 'var(--ci-panel)', border: `1px solid ${LINE}`, boxShadow: 'var(--ci-panel-shadow)', position: 'relative', overflow: 'hidden' };

const StationBar = ({ title, sub, badge }: { title: string; sub: string; badge?: ReactNode }) => (
  <div className="wa-force-dark flex items-center gap-3.5 rounded-[14px] px-[22px] py-4 text-white" style={{ background: BT_GRAD, border: '1px solid rgba(255,255,255,.14)', boxShadow: '0 10px 26px -12px rgba(20,130,170,.6), inset 0 1px 0 rgba(255,255,255,.22)' }}>
    <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px]" style={{ background: 'rgba(255,255,255,.16)' }}>
      <svg width="18" height="18" viewBox="0 0 22 22" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="17" r="2.2" /><circle cx="17" cy="5" r="2.2" /><path strokeDasharray="2 2" d="M6.5 15C12 10 9 8 15.5 6.5" /></svg>
    </span>
    <div className="min-w-0 flex-1"><div className="text-[16px] font-bold">{title}</div><div className="truncate text-[12.5px] text-white/70">{sub}</div></div>
    {badge}
  </div>
);
const Label = ({ children }: { children: ReactNode }) => <span className="text-[11.5px] font-semibold tracking-[.06em]" style={{ color: INK2 }}>{children}</span>;

type Strat = { id: string; name: string; cat: string; level: 'beginner' | 'intermediate' | 'advanced'; short: string; n: number; isUser?: boolean; applied?: boolean; assetCount?: number };
const DIFF_LEVEL: Record<string, 'beginner' | 'intermediate' | 'advanced'> = { '초급': 'beginner', '중급': 'intermediate', '고급': 'advanced' };
// 사용자 생성 전략 → 라이브러리 표시용 매핑
const toStrat = (s: Strategy): Strat => ({
  id: s.id, name: s.name, cat: 'custom', level: DIFF_LEVEL[s.difficulty || '초급'] || 'beginner',
  short: s.description || s.strategyLogic || '직접 만든 전략', n: (s.entryConditions?.length || 0) + (s.exitConditions?.length || 0), isUser: true,
  applied: s.applied, assetCount: s.targetAssets?.length || 0,
});
// 프리셋 Strategy → 라이브러리 표시용 Strat 매핑 (단일 출처: presetStrategies.ts)
const presetToStrat = (s: PresetStrategy): Strat => ({
  id: s.id, name: s.name, cat: s.category, level: DIFF_LEVEL[s.difficulty || '초급'] || 'beginner',
  short: s.description, n: (s.entryConditions?.length || 0) + (s.exitConditions?.length || 0),
});
const STRATEGIES: Strat[] = PRESET_STRATEGIES.map(presetToStrat);

/* 프리셋 전략별 초보 교육(beginnerTip/whyUse/strategyLogic) — presetStrategies.ts에서 파생 */
const PRESET_EDU: Record<string, { tip?: string; why?: string; logic?: string }> = Object.fromEntries(
  PRESET_STRATEGIES.map(s => [s.id, { tip: s.beginnerTip, why: s.whyUse, logic: s.strategyLogic }]),
);
/* 프리셋별 시각화 차트(캔버스 애니메이션) — 지연 로딩으로 번들 분리.
   import 실패 시 에러바운더리로 번지지 않도록 폴백 컴포넌트로 강등(graceful). */
const ChartFallback = () => <div className="flex flex-col items-center justify-center gap-1 text-center text-[13px]" style={{ color: INK3, height: 200 }}><span>차트를 불러올 수 없습니다.</span><span className="text-[12px]">오른쪽 패널에서 백테스트를 바로 실행해보세요.</span></div>;
const lazyChart = (imp: () => Promise<{ default: React.ComponentType }>) =>
  lazy(() => imp().catch(() => ({ default: ChartFallback as React.ComponentType })));
const PRESET_CHART: Record<string, React.LazyExoticComponent<React.ComponentType>> = {
  'preset-golden-cross': lazyChart(() => import('../components/GoldenCrossCanvasChart')),
  'preset-rsi-reversal': lazyChart(() => import('../components/RSIChart')),
  'preset-bollinger-squeeze': lazyChart(() => import('../components/BollingerChart')),
  'preset-macd-divergence': lazyChart(() => import('../components/MACDChart')),
  'preset-stochastic': lazyChart(() => import('../components/StochasticChart')),
  'preset-connors-rsi2': lazyChart(() => import('../components/ConnorsRSI2Chart')),
  'preset-volatility-breakout': lazyChart(() => import('../components/VolatilityBreakoutChart')),
};

// 프리셋 → 백테스트 요청용 지표/조건 — presetStrategies.ts에서 파생
const PRESET_DEFS: Record<string, {
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

const PERIODS: [string, string][] = [['6M', '6개월'], ['1Y', '1년'], ['2Y', '2년'], ['3Y', '3년'], ['5Y', '5년']];
const CAPS: [number, string][] = [[1_000_000, '100만'], [5_000_000, '500만'], [10_000_000, '1000만'], [50_000_000, '5000만']];

function periodDates(period: string): { startDate: string; endDate: string } {
  const end = new Date(); const start = new Date();
  if (period === '6M') start.setMonth(start.getMonth() - 6);
  else if (period === '2Y') start.setFullYear(start.getFullYear() - 2);
  else if (period === '3Y') start.setFullYear(start.getFullYear() - 3);
  else if (period === '5Y') start.setFullYear(start.getFullYear() - 5);
  else start.setFullYear(start.getFullYear() - 1);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { startDate: fmt(start), endDate: fmt(end) };
}

const LEVEL_META: Record<string, { label: string; color: string; bg: string }> = {
  beginner: { label: '초급', color: UP, bg: 'rgba(239,77,77,.12)' },
  intermediate: { label: '중급', color: COMPASS, bg: 'rgba(255,205,120,.12)' },
  advanced: { label: '고급', color: DOWN, bg: 'rgba(77,138,255,.12)' },
};
const FILTERS = [['all', '전체'], ['trend', '추세추종'], ['reversal', '역추세'], ['volatility', '변동성']];

/* ── 전략 빌더 카탈로그 (옛 StrategyPage 이식 + 한글 라벨 보강) ── */
const fieldStyle: React.CSSProperties = { border: `1px solid ${LINE}`, background: 'var(--ci-card)', color: 'var(--ci-ink0)' };
const INDICATOR_CATALOG: { type: Indicator['type']; label: string; params: Record<string, number> }[] = [
  { type: 'RSI', label: 'RSI', params: { period: 14 } },
  { type: 'MACD', label: 'MACD', params: { fast: 12, slow: 26, signal: 9 } },
  { type: 'MA', label: '이동평균 (MA)', params: { period: 20 } },
  { type: 'EMA', label: '지수이동평균 (EMA)', params: { period: 20 } },
  { type: 'BOLLINGER_BANDS', label: '볼린저밴드', params: { period: 20, stdDev: 2 } },
  { type: 'STOCHASTIC', label: '스토캐스틱', params: { kPeriod: 14, dPeriod: 3 } },
  { type: 'ATR', label: 'ATR', params: { period: 14 } },
  { type: 'CCI', label: 'CCI', params: { period: 20 } },
  { type: 'WILLIAMS_R', label: 'Williams %R', params: { period: 14 } },
  { type: 'OBV', label: 'OBV', params: {} },
  { type: 'DONCHIAN', label: '돈치안 채널', params: { period: 20 } },
  { type: 'ADX', label: 'ADX (추세강도)', params: { period: 14 } },
];
const PARAM_LABEL: Record<string, string> = { period: '기간', fast: '단기 EMA', slow: '장기 EMA', signal: '시그널', stdDev: '표준편차', kPeriod: '%K 기간', dPeriod: '%D 기간' };
const COND_INDICATORS: [string, string][] = [
  ['PRICE', '현재가'], ['RSI', 'RSI'], ['MACD', 'MACD'], ['MACD_SIGNAL', 'MACD 시그널'], ['MACD_HISTOGRAM', 'MACD 히스토그램'],
  ['MA', '이동평균 (MA)'], ['EMA', '지수이동평균 (EMA)'], ['BOLLINGER_UPPER', '볼린저 상단'], ['BOLLINGER_MIDDLE', '볼린저 중간'],
  ['BOLLINGER_LOWER', '볼린저 하단'], ['BOLLINGER_PCT_B', '볼린저 %B'], ['STOCH_K', '스토캐스틱 %K'], ['STOCH_D', '스토캐스틱 %D'],
  ['ATR', 'ATR'], ['CCI', 'CCI'], ['WILLIAMS_R', 'Williams %R'], ['OBV', 'OBV'],
  ['ADX', 'ADX (추세강도)'], ['DONCHIAN_HIGH_100', '돈치안 상단(100)'], ['DONCHIAN_LOW_30', '돈치안 하단(30)'],
  ['MACD_CROSS_MACD_SIGNAL', 'MACD 골든크로스'], ['MACD_CROSSUNDER_MACD_SIGNAL', 'MACD 데드크로스'],
  ['STOCH_K_CROSS_STOCH_D', '스토캐스틱 골든크로스'], ['STOCH_K_CROSSUNDER_STOCH_D', '스토캐스틱 데드크로스'],
  ['EMA_CROSS_MA', 'EMA ↑ SMA 크로스'], ['EMA_CROSSUNDER_MA', 'EMA ↓ SMA 크로스'],
];
const OPERATORS: [Condition['operator'], string][] = [['GT', '>'], ['GTE', '≥'], ['LT', '<'], ['LTE', '≤'], ['EQ', '=']];
const ASSET_TYPES: [Strategy['assetType'], string][] = [['CRYPTO', '가상화폐'], ['STOCK', '주식'], ['US_STOCK', '미국주식'], ['MIXED', '혼합']];
const isCrossInd = (ind: string) => ind.includes('_CROSS_') || ind.includes('_CROSSUNDER_');

const Glyph = ({ kind }: { kind: string }) => {
  const c = { width: 18, height: 18, viewBox: '0 0 22 22', fill: 'none', stroke: GLOW, strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (kind === 'trend') return <svg {...c}><path d="M3 14l5-5 4 3 7-8" /><circle cx="8" cy="9" r="1" fill={GLOW} stroke="none" /></svg>;
  if (kind === 'reversal') return <svg {...c}><path d="M3 11c3-5 6 5 9 0s6-5 9 0" /></svg>;
  if (kind === 'volatility') return <svg {...c}><path d="M3 16l4-2 4 3 4-9 4 5" /></svg>;
  return <svg {...c}><path d="M3 11h16" /></svg>;
};
const catGlyph = (cat: string) => cat === 'trend' ? 'trend' : cat === 'reversal' ? 'reversal' : cat === 'volatility' ? 'volatility' : 'flat';

const StrategyLibrary = ({ strats, activeId, onPick, onCreate, onEditUser, onDeleteUser, onApply }: { strats: Strat[]; activeId: string | null; onPick: (id: string) => void; onCreate: () => void; onEditUser: (id: string) => void; onDeleteUser: (id: string) => void; onApply: (id: string) => void }) => {
  const [filter, setFilter] = useState('all');
  const hasUser = strats.some(s => s.isUser);
  const filters = hasUser ? [...FILTERS, ['custom', '내 전략']] : FILTERS;
  const list = strats.filter(s => filter === 'all' || s.cat === filter);
  return (
    <aside style={{ ...mkCard, padding: 0, display: 'flex', flexDirection: 'column' }}>
      <div className="wa-force-dark px-[18px] py-4 text-white" style={{ background: BT_GRAD, borderBottom: '1px solid rgba(255,255,255,.14)' }}>
        <h3 className="text-[16px] font-bold">전략 라이브러리</h3>
        <p className="mt-0.5 text-[12.5px] text-white/70">전략을 선택하고 백테스트로 검증하세요.</p>
      </div>
      <div className="flex flex-wrap gap-1.5 p-3" style={{ borderBottom: `1px solid ${LINE}` }}>
        {filters.map(([k, l]) => <button key={k} onClick={() => setFilter(k)} className="rounded-md px-2.5 py-1.5 text-[12px] font-semibold" style={{ background: filter === k ? 'rgba(91,157,255,.18)' : 'transparent', color: filter === k ? GLOW : INK1 }}>{l}</button>)}
      </div>
      <div className="no-scrollbar flex flex-col gap-2 overflow-y-auto p-3" style={{ maxHeight: 620 }}>
        {list.map(s => {
          const on = s.id === activeId, lv = LEVEL_META[s.level];
          return (
            <div key={s.id} role="button" tabIndex={0} onClick={() => onPick(s.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(s.id); } }} className="shrink-0 cursor-pointer rounded-xl p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-[rgba(91,157,255,.5)]" style={{ background: on ? 'rgba(91,157,255,.10)' : 'transparent', border: on ? '1px solid rgba(91,157,255,.32)' : '1px solid transparent' }}>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: 'rgba(91,157,255,.10)', border: '1px solid rgba(91,157,255,.22)' }}><Glyph kind={catGlyph(s.cat)} /></span>
                <span className="flex-1 text-[13.5px] font-bold leading-tight">{s.name}</span>
                {s.isUser && (
                  <span className="flex shrink-0 items-center gap-0.5">
                    <button type="button" title="수정" aria-label="전략 수정" onClick={(e) => { e.stopPropagation(); onEditUser(s.id); }} className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-white/10" style={{ color: INK2 }}>
                      <svg aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                    </button>
                    <button type="button" title="삭제" aria-label="전략 삭제" onClick={(e) => { e.stopPropagation(); onDeleteUser(s.id); }} className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-white/10" style={{ color: INK2 }}>
                      <svg aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
                    </button>
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={s.isUser ? { background: 'rgba(91,157,255,.16)', color: GLOW } : { background: 'var(--ci-card)', color: INK2 }}>{s.isUser ? '내 전략' : '기본'}</span>
                <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: lv.bg, color: lv.color }}>{lv.label}</span>
                {s.applied && <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: 'rgba(63,214,160,.14)', color: '#3fd6a0', border: '1px solid rgba(63,214,160,.3)' }}>● 적용중</span>}
              </div>
              <p className="mt-2 line-clamp-2 text-[12px] leading-snug text-white/55">{s.short}</p>
              <div className="mt-2 text-[10.5px]" style={{ color: INK3 }}>조건 {s.n}개{s.isUser && s.assetCount ? ` · 대상 ${s.assetCount}종목` : ''}</div>
              {s.isUser && (
                <button type="button" onClick={(e) => { e.stopPropagation(); onApply(s.id); }} className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-[12px] font-bold transition-colors"
                  style={s.applied ? { background: 'rgba(63,214,160,.12)', color: '#3fd6a0', border: '1px solid rgba(63,214,160,.3)' } : { background: 'rgba(91,157,255,.14)', color: GLOW, border: '1px solid rgba(91,157,255,.28)' }}>
                  {s.applied ? '⚙ 적용 관리 · 자동매매 →' : '⚓ 적용 · 자동매매 →'}
                </button>
              )}
            </div>
          );
        })}
        <button onClick={onCreate} className="shrink-0 rounded-xl p-3.5 text-center transition-colors hover:bg-white/5" style={{ border: `1px dashed ${LINE_S}` }}>
          <div className="flex items-center justify-center gap-1.5 text-[13.5px] font-bold" style={{ color: GLOW }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            새 항로 만들기
          </div>
          <p className="mt-1 text-[11.5px] leading-snug text-white/45">나만의 매매 조건으로 직접 항로를 설계하고 백테스트로 검증해보세요.</p>
          <div className="mt-2 text-[10.5px]" style={{ color: INK3 }}>지표·조건 직접 작성</div>
        </button>
      </div>
    </aside>
  );
};

const BigStat = ({ n, l, muted }: { n: string; l: string; muted?: boolean }) => (
  <div style={{ ...mkCard, padding: '18px 20px', textAlign: 'center' }}>
    <div className="font-mono text-[36px] font-bold" style={{ color: muted ? INK3 : GLOW }}>{n}</div>
    <div className="text-[12px] tracking-[.08em]" style={{ color: INK2 }}>{l}</div>
  </div>
);
const GuideStep = ({ n, t, d }: { n: string; t: string; d: string }) => (
  <div className="flex gap-3.5">
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-[12px] font-bold" style={{ background: 'rgba(91,157,255,.10)', color: GLOW, border: '1px solid rgba(91,157,255,.22)' }}>{n}</span>
    <div><p className="text-[14px] font-semibold">{t}</p><p className="mt-1 text-[12.5px] leading-snug text-white/55">{d}</p></div>
  </div>
);
/* 초보자용 핵심 개념 — "백테스트가 뭔지" 등 */
const CONCEPTS: { icon: string; t: string; tk?: string; d: string }[] = [
  { icon: '📊', t: '백테스트', tk: '백테스트', d: '과거 데이터로 "이 전략을 그때 썼다면 얼마 벌었을까?"를 시뮬레이션해요. 실제 돈을 쓰기 전, 전략이 통했는지 수익률·최대낙폭·승률로 검증하는 단계입니다.' },
  { icon: '🎯', t: '진입 · 청산 조건', d: '언제 살지(진입)·언제 팔지(청산)를 정하는 규칙이에요. 예: "RSI가 30 아래로 내려가면 매수, 70 위로 올라가면 매도". 감이 아니라 규칙으로 매매하는 게 핵심이에요.' },
  { icon: '⚓', t: '포트폴리오 적용', d: '검증을 마친 전략의 대상 종목을 모의 계좌에 한 번에 매수해 실제처럼 굴려봐요. 백테스트가 "과거 시뮬레이션"이라면, 적용은 "지금부터 모의 실전"입니다.' },
  { icon: '⚡', t: '자동매매', d: '전략을 켜두면 신호가 뜰 때마다 모의 계좌에서 알아서 사고팔아요. 직접 24시간 보지 않아도 규칙대로 매매됩니다. (안전을 위해 모의투자 전용)' },
  { icon: '🐳', t: '모의투자(VIRT)', tk: '모의투자', d: '가상돈 ₩1,000만으로 연습해요. 실제 돈은 한 푼도 들어가지 않으니 마음껏 실험해보세요. 잃어도 괜찮습니다!' },
  { icon: '📉', t: '최대 낙폭(MDD)', tk: 'MDD', d: '전략이 가장 많이 깨졌을 때 얼마나 떨어졌는지를 나타내요. 수익률만 보지 말고, "최악의 순간에 얼마나 버텨야 하나"를 함께 봐야 합니다.' },
];

const EmptyHero = ({ onGuide, running, total = PRESET_STRATEGIES.length, userCount = 0 }: { onGuide: () => void; running: boolean; total?: number; userCount?: number }) => (
  <section className="flex flex-col gap-[18px]">
    <StationBar title="항로 분석 스테이션" sub="전략을 선택하고 과거 데이터로 검증하세요" />
    <div style={{ ...mkCard, padding: '40px 32px', textAlign: 'center' }}>
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke={GLOW} strokeWidth="1.4" className="mx-auto" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-6-5.5-6-10a6 6 0 1 1 12 0c0 4.5-6 10-6 10Z" /><circle cx="12" cy="11" r="2" /></svg>
      <h2 className="mt-4 text-[24px] font-bold">항로를 설정하여 항해를 시작하세요</h2>
      <p className="mx-auto mt-2 max-w-[460px] text-[14px]" style={{ color: INK1 }}>왼쪽에서 전략을 선택하고 오른쪽에서 종목·기간을 정한 뒤 백테스트를 실행하면 결과가 여기에 표시됩니다.</p>
    </div>

    {/* 초보자용 핵심 개념 */}
    <div style={{ ...mkCard, padding: '24px 26px' }}>
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-[11px]" style={{ background: 'rgba(91,157,255,.12)', border: '1px solid rgba(91,157,255,.24)' }}><img src="/whales/beluga.png" alt="" width={22} style={{ height: 'auto' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /></span>
        <div><h3 className="text-[16px] font-bold">처음이신가요? 핵심 개념부터</h3><p className="mt-0.5 text-[12.5px]" style={{ color: INK2 }}>퀀트 투자가 처음이어도 괜찮아요. 아래 6가지만 알면 시작할 수 있어요.</p></div>
      </div>
      <div className="mt-4 grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(248px, 1fr))' }}>
        {CONCEPTS.map(c => (
          <div key={c.t} className="rounded-xl p-4" style={{ background: 'var(--ci-card)', border: `1px solid ${LINE}` }}>
            <div className="mb-1.5 flex items-center gap-2"><span className="text-[18px]">{c.icon}</span><span className="text-[14px] font-bold">{c.tk ? <Term k={c.tk} compact>{c.t}</Term> : c.t}</span></div>
            <p className="m-0 text-[12.5px] leading-relaxed" style={{ color: INK1 }}>{c.d}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-xl px-4 py-3.5 text-[13px] leading-relaxed" style={{ background: 'rgba(245,208,97,.07)', border: '1px solid rgba(245,208,97,.24)', color: INK1 }}>
        <span className="font-bold" style={{ color: COMPASS }}>💡 왜 백테스트부터?</span> 좋아 보이는 전략도 과거에 검증해보면 의외로 약한 경우가 많아요. <b>백테스트 → 모의 적용 → (선택) 자동매매</b> 순서로 단계를 밟으면, 실제 돈을 넣기 전에 안전하게 감을 잡을 수 있습니다.
      </div>
    </div>

    <div className="grid grid-cols-3 gap-3.5"><BigStat n={String(total)} l="전체 전략" /><BigStat n="8" l="기본 제공" /><BigStat n={String(userCount)} l="내 전략" muted={userCount === 0} /></div>
    <div style={{ ...mkCard, padding: '24px 26px' }}>
      <h3 className="mb-4 text-[15px] font-bold">빠른 시작 가이드</h3>
      <div className="flex flex-col gap-4">
        <GuideStep n="01" t="전략 선택" d="왼쪽 목록에서 기본 전략(골든크로스, RSI 등)을 선택하세요. 클릭하면 그 전략이 뭔지 쉬운 설명이 가운데 나타나요." />
        <GuideStep n="02" t="종목 & 기간 설정" d="오른쪽 패널에서 테스트할 종목(예: 비트코인)과 기간(예: 1년)을 설정하세요." />
        <GuideStep n="03" t="백테스트 실행" d={'실행 버튼을 누르면 "이 전략으로 과거에 투자했다면?" 결과(수익률·차트·매매내역)가 표시됩니다.'} />
        <GuideStep n="04" t="적용 · 자동매매 (선택)" d="마음에 들면 '내 전략'으로 저장 후, 모의 계좌에 적용하거나 ⚡자동매매를 켜서 신호 발생 시 자동으로 매매할 수 있어요." />
      </div>
      <button onClick={onGuide} disabled={running} className="wa-force-dark mt-5 flex w-full items-center justify-center gap-2.5 rounded-2xl px-5 py-4 text-[16px] font-bold text-white disabled:opacity-60" style={{ border: '1px solid rgba(165,200,255,.6)', background: 'linear-gradient(180deg, #5690f2 0%, #3673e2 100%)', boxShadow: '0 18px 32px -14px rgba(43,110,230,.65), inset 0 1px 0 rgba(255,255,255,.45)' }}>
        {running ? '백테스트 실행 중…' : '가이드 체험 — 골든크로스 × BTC 백테스트 →'}
      </button>
    </div>
  </section>
);

/* 전략 선택 시 — 이 전략 이해하기(초보 교육 + 시각화 차트) */
const StrategyGuidePanel = ({ strat, userStrat, onApply, onCreate }: { strat: Strat; userStrat?: Strategy; onApply?: () => void; onCreate?: () => void }) => {
  const navigate = useNavigate();
  const edu = PRESET_EDU[strat.id];
  const tip = edu?.tip || userStrat?.beginnerTip;
  const why = edu?.why || userStrat?.whyUse;
  const logic = edu?.logic || userStrat?.strategyLogic;
  const desc = userStrat?.description || strat.short;
  const Chart = PRESET_CHART[strat.id];
  return (
    <section className="flex flex-col gap-[18px]">
      <StationBar title="이 전략 이해하기" sub={strat.name} badge={<span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: 'rgba(255,255,255,.16)' }}>{LEVEL_META[strat.level].label}</span>} />
      <div style={{ ...mkCard, padding: '24px 26px' }}>
        <h2 className="text-[20px] font-bold">{strat.name}</h2>
        <p className="mt-2 text-[14px] leading-relaxed" style={{ color: INK1 }}>{desc}</p>
        {logic && <div className="mt-3.5 rounded-lg px-3.5 py-2.5 font-mono text-[12.5px]" style={{ background: 'var(--ci-card)', border: `1px solid ${LINE}`, color: 'var(--ci-ink0)' }}>매매 규칙 · {logic}</div>}
        {tip && (
          <div className="mt-3.5 rounded-lg px-3.5 py-3" style={{ background: 'rgba(245,208,97,.08)', border: '1px solid rgba(245,208,97,.28)' }}>
            <div className="mb-1 text-[12px] font-bold" style={{ color: COMPASS }}>💡 초보자 한 줄 설명</div>
            <p className="m-0 text-[13px] leading-relaxed" style={{ color: INK1 }}>{tip}</p>
          </div>
        )}
        {why && (
          <div className="mt-3 rounded-lg px-3.5 py-3" style={{ background: 'rgba(91,157,255,.07)', border: '1px solid rgba(91,157,255,.22)' }}>
            <div className="mb-1 text-[12px] font-bold" style={{ color: GLOW }}>⚓ 왜 쓰나요?</div>
            <p className="m-0 text-[13px] leading-relaxed" style={{ color: INK1 }}>{why}</p>
          </div>
        )}
      </div>
      {Chart ? (
        <div style={{ ...mkCard, padding: '20px 24px' }}>
          <h3 className="mb-1 text-[15px] font-bold">전략 시각화</h3>
          <p className="mb-3 text-[12.5px]" style={{ color: INK2 }}>이 전략이 차트에서 어떻게 매수·매도 신호를 잡는지 애니메이션으로 살펴보세요.</p>
          <Suspense fallback={<div className="flex items-center justify-center" style={{ height: 280 }}><span className="h-6 w-6 animate-spin rounded-full" style={{ border: '2px solid rgba(91,157,255,.3)', borderTopColor: GLOW }} /></div>}>
            <Chart />
          </Suspense>
        </div>
      ) : (
        <div className="rounded-xl px-4 py-3 text-[12.5px]" style={{ background: 'var(--ci-card)', border: `1px solid ${LINE}`, color: INK2 }}>📊 시각화 애니메이션은 기본 제공 전략(골든크로스·RSI·볼린저 등)에서만 지원됩니다. 이 전략은 오른쪽에서 바로 백테스트로 확인해보세요.</div>
      )}
      <div className="rounded-xl px-4 py-3 text-[13px] font-semibold" style={{ background: 'var(--ci-card)', border: `1px solid ${LINE}`, color: INK1 }}>오른쪽 패널에서 종목·기간·투자금을 설정한 뒤 <span style={{ color: GLOW }}>백테스트 실행</span>을 누르면 결과가 여기에 표시됩니다 →</div>
      {/* 실행: 모의 적용 · 자동매매 */}
      {userStrat ? (
        <div style={{ ...mkCard, padding: '18px 22px', border: '1px solid rgba(91,157,255,.28)', background: 'linear-gradient(135deg, rgba(91,157,255,.10), transparent 60%)' }}>
          <div className="text-[14px] font-bold">⚓ 모의 적용 · ⚡ 자동매매</div>
          <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: INK2 }}>이 전략의 대상 종목을 모의 계좌에 한 번에 매수(적용)하거나, 신호가 뜰 때마다 자동으로 매매(자동매매)하도록 켤 수 있어요. <b style={{ color: 'var(--ci-ink0)' }}>모의투자 전용</b>입니다.</p>
          <button onClick={() => onApply?.()} className="mt-3 w-full rounded-[10px] py-2.5 text-[13.5px] font-bold text-white" style={{ background: `linear-gradient(180deg, ${GLOW}, ${ACCENT})` }}>적용 · 자동매매 →</button>
        </div>
      ) : (
        <div style={{ ...mkCard, padding: '18px 22px', border: '1px solid rgba(91,157,255,.28)', background: 'linear-gradient(135deg, rgba(91,157,255,.10), transparent 60%)' }}>
          <div className="text-[14px] font-bold">⚡ 이 전략으로 자동매매</div>
          <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: INK2 }}>백테스트로 검증한 이 전략을 <b style={{ color: 'var(--ci-ink0)' }}>모의 자동매매</b>로 바로 시작할 수 있어요. 신호가 뜰 때마다 자동으로 매매합니다. (모의투자 전용)</p>
          <button onClick={() => navigate(`/virt/auto-trade?deploy=${strat.id}`)} className="mt-3 w-full rounded-[10px] py-2.5 text-[13.5px] font-bold text-white" style={{ background: `linear-gradient(180deg, ${GLOW}, ${ACCENT})` }}>이 전략으로 자동매매 시작 →</button>
          <button onClick={() => onCreate?.()} className="mt-2 w-full rounded-[10px] py-2 text-[12px] font-semibold" style={{ border: `1px solid ${LINE}`, background: 'var(--ci-card)', color: INK1 }}>조건을 수정해서 쓰려면 — 새 항로(내 전략)로 저장</button>
        </div>
      )}
    </section>
  );
};

const RunningView = ({ onCancel }: { onCancel?: () => void }) => (
  <section className="flex flex-col gap-[18px]">
    <StationBar title="백테스트 실행 중" sub="과거 데이터로 전략을 검증하고 있어요" />
    <div style={{ ...mkCard, padding: '64px 32px', textAlign: 'center' }}>
      <span className="mx-auto mb-4 block h-10 w-10 animate-spin rounded-full" style={{ border: '3px solid rgba(91,157,255,.25)', borderTopColor: GLOW }} />
      <p className="text-[14px]" style={{ color: INK1 }}>시뮬레이션 계산 중…</p>
      <p className="mt-1 text-[12px]" style={{ color: INK3 }}>보통 몇 초 내에 끝나요. 오래 걸리면 종목·기간을 확인해보세요.</p>
      {onCancel && <button onClick={onCancel} className="mt-5 rounded-lg px-4 py-2 text-[12.5px] font-semibold" style={{ border: `1px solid ${LINE_S}`, background: 'var(--ci-card)', color: INK1 }}>취소</button>}
    </div>
  </section>
);

/* 차트 (실 시리즈 + 매매 마커 + 기준선) */
const Chart = ({ pts, lines, markers, h = 220, baseline, baselineLabel }: { pts: number[]; lines: { data: number[]; color: string; dash?: boolean }[]; markers?: { i: number; buy: boolean }[]; h?: number; baseline?: number; baselineLabel?: string }) => {
  const W = 860, padR = 48, all = [...pts, ...lines.flatMap(l => l.data), ...(baseline != null ? [baseline] : [])];
  if (all.length === 0) return <div className="flex h-full items-center justify-center text-[13px]" style={{ color: INK3 }}>데이터 없음</div>;
  const max = Math.max(...all), min = Math.min(...all), rng = (max - min) || 1;
  const x = (i: number, n: number) => (i / Math.max(1, n - 1)) * (W - padR), y = (v: number) => 8 + ((max - v) / rng) * (h - 24);
  const path = (d: number[]) => 'M ' + d.map((v, i) => `${x(i, d.length).toFixed(1)} ${y(v).toFixed(1)}`).join(' L ');
  return (
    <svg viewBox={`0 0 ${W} ${h}`} width="100%" height="100%" style={{ display: 'block' }}>
      <defs><linearGradient id="bt-f" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={GLOW} stopOpacity=".18" /><stop offset="100%" stopColor={GLOW} stopOpacity="0" /></linearGradient></defs>
      {[0, .5, 1].map((t, i) => <line key={i} x1={0} x2={W - padR} y1={y(min + t * rng)} y2={y(min + t * rng)} stroke="var(--ci-line)" />)}
      {baseline != null && <><line x1={0} x2={W - padR} y1={y(baseline)} y2={y(baseline)} stroke={INK3} strokeWidth="1" strokeDasharray="3 3" />{baselineLabel && <text x={4} y={y(baseline) - 4} fill={INK3} fontSize="11">{baselineLabel}</text>}</>}
      {pts.length > 0 && <><path d={path(pts) + ` L ${(W - padR).toFixed(1)} ${h} L 0 ${h} Z`} fill="url(#bt-f)" /><path d={path(pts)} fill="none" stroke={GLOW} strokeWidth="1.6" vectorEffect="non-scaling-stroke" /></>}
      {lines.map((l, k) => <path key={k} d={path(l.data)} fill="none" stroke={l.color} strokeWidth="1.5" strokeDasharray={l.dash ? '4 3' : undefined} vectorEffect="non-scaling-stroke" />)}
      {pts.length > 0 && markers?.map((m, k) => m.i >= 0 && m.i < pts.length ? <circle key={k} cx={x(m.i, pts.length)} cy={y(pts[m.i])} r="3.5" fill={m.buy ? UP : DOWN} stroke="var(--ci-card)" strokeWidth="1.2" /> : null)}
    </svg>
  );
};

const KPI = ({ label, value, sub, color }: { label: ReactNode; value: string; sub: string; color: string }) => (
  <div style={{ ...mkCard, padding: '20px 22px' }}>
    <div className="text-[11.5px] font-semibold tracking-[.12em]" style={{ color: INK2 }}>{label}</div>
    <div className="mt-2 font-mono text-[30px] font-bold tracking-tight" style={{ color }}>{value}</div>
    <div className="mt-1 text-[12px]" style={{ color: INK3 }}>{sub}</div>
  </div>
);

const TRADE_LABEL: Record<string, string> = { BUY: '매수', SELL: '매도', SHORT: '공매도', COVER: '커버' };

const ResultView = ({ result, strat, onExport }: { result: BacktestResult; strat: Strat | null; onExport: () => void }) => {
  const isUsd = result.currency === 'USD';
  const cur = isUsd ? '$' : '₩';
  const num = (v: number | undefined | null) => (Number.isFinite(v as number) ? (v as number) : 0); // 필수 숫자 필드 방어
  const rate = isUsd ? (result.exchangeRate || 1400) : 1; // USD 결과는 원화 환산 병기 (옛 페이지 동작 복원)
  const money = (v: number | undefined | null) => isUsd ? `$${fmtNum(num(v))} (₩${fmtNum(Math.round(num(v) * rate))})` : `₩${fmtNum(num(v))}`;
  const up = num(result.totalReturnRate) >= 0;
  const trades = result.trades ?? [];
  // 가격차트 + 매매 마커 (거래 날짜 → priceData 인덱스)
  const price = (result.priceData ?? []).map(p => p.close);
  const dateIdx = useMemo(() => { const m = new Map<string, number>(); (result.priceData ?? []).forEach((p, i) => m.set(p.date, i)); return m; }, [result.priceData]);
  const markers = trades.map(t => ({ i: dateIdx.get(t.date) ?? -1, buy: t.type === 'BUY' || t.type === 'COVER' }));
  const equity = (result.equityCurve ?? []).map(p => p.value);
  const bh = (result.buyHoldCurve ?? []).map(p => p.value);

  const sub = (v?: number, suffix = '%') => (v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}${suffix}`);

  // 백테스트 결과 자동 해석 (초보자용) — 숫자를 "좋은지/나쁜지" 직관으로 번역
  type Tone = 'good' | 'warn' | 'bad' | 'neutral';
  // 해석 톤 색은 시세 색(상승=#ef4d4d 빨강 / 하락=#4d8aff 파랑)과 분리 — 같은 화면에서 색 의미 충돌 방지
  const TONE_C: Record<Tone, string> = { good: '#3fd6a0', warn: '#f5d061', bad: '#e0457b', neutral: '#7d8aa0' };
  const interp: { tone: Tone; text: string }[] = (() => {
    const out: { tone: Tone; text: string }[] = [];
    const ret = num(result.totalReturnRate), sharpe = num(result.sharpeRatio), mdd = Math.abs(num(result.maxDrawdown)), win = num(result.winRate), tt = num(result.totalTrades);
    const bhR = result.buyHoldReturnRate;
    const goodPayoff = (result.profitFactor != null && result.profitFactor > 1.1) || (result.payoffRatio != null && result.payoffRatio > 1.2);
    if (bhR != null) out.push(ret > bhR
      ? { tone: 'good', text: `수익률 ${sub(ret)} — 단순히 사서 묻어두기(${sub(bhR)})보다 전략이 더 나았어요. 👍` }
      : { tone: 'warn', text: `수익률 ${sub(ret)} — 단순 보유(${sub(bhR)})가 더 나았어요. 이 종목·기간에선 전략 효과가 약했어요.` });
    else out.push(ret > 0
      ? { tone: 'good', text: `수익률 ${sub(ret)} — 플러스 수익이에요.` }
      : ret < 0
        ? { tone: 'bad', text: `수익률 ${sub(ret)} — 손실이 났어요.` }
        : { tone: 'neutral', text: `수익률 ${sub(ret)} — 수익도 손실도 없었어요.` });
    out.push(sharpe >= 2 ? { tone: 'good', text: `샤프 ${sharpe.toFixed(2)} — 매우 우수. 감수한 위험 대비 효율이 뛰어나요. 🌟` }
      : sharpe >= 1 ? { tone: 'good', text: `샤프 ${sharpe.toFixed(2)} — 양호. 위험 대비 수익이 괜찮아요. 👍` }
        : sharpe >= 0 ? { tone: 'neutral', text: `샤프 ${sharpe.toFixed(2)} — 보통. 위험 대비 수익이 평범한 수준이에요.` }
          : { tone: 'bad', text: `샤프 ${sharpe.toFixed(2)} — 위험 대비 손실. 변동성만 큰 비효율적 결과예요. ⚠️` });
    out.push(mdd < 10 ? { tone: 'good', text: `최대 낙폭 -${mdd.toFixed(1)}% — 낮은 편. 비교적 견디기 쉬워요.` }
      : mdd < 20 ? { tone: 'neutral', text: `최대 낙폭 -${mdd.toFixed(1)}% — 보통 수준이에요.` }
        : mdd < 35 ? { tone: 'warn', text: `최대 낙폭 -${mdd.toFixed(1)}% — 다소 높아요. 한때 ${mdd.toFixed(0)}%까지 깨졌으니 마음의 준비가 필요해요. ⚠️` }
          : { tone: 'bad', text: `최대 낙폭 -${mdd.toFixed(1)}% — 매우 높아요. 실제라면 중간에 못 버티고 손절했을 수 있어요. 🚨` });
    // 손익비(payoffRatio)가 좋아도 순손실일 수 있으므로 "수익을 냈어요"는 실제 순익(ret>0)일 때만 단정
    if (tt > 0) out.push(win >= 50 ? { tone: 'good', text: `승률 ${win.toFixed(0)}% — 이기는 거래가 더 많았어요.` }
      : (goodPayoff && ret > 0) ? { tone: 'good', text: `승률 ${win.toFixed(0)}%로 낮지만, 이길 때 크게 벌어 수익을 냈어요. 손익비가 좋은 전략이에요. 👍` }
        : goodPayoff ? { tone: 'neutral', text: `승률 ${win.toFixed(0)}%로 낮지만 손익비(이길 때 크게 버는 정도)는 좋은 편이에요. 다만 전체로는 수익을 내지 못했어요.` }
          : { tone: 'warn', text: `승률 ${win.toFixed(0)}% — 이기는 횟수도 손익비도 약했어요. 진입 조건을 다듬어보세요.` });
    if (tt > 0 && tt < 5) out.push({ tone: 'warn', text: `총 ${tt}회 거래 — 표본이 적어 통계적으로 신뢰하기 어려워요. 기간을 늘려보세요.` });
    return out;
  })();
  const headline: { tone: Tone; text: string } = (() => {
    const ret = num(result.totalReturnRate), sharpe = num(result.sharpeRatio), mdd = Math.abs(num(result.maxDrawdown));
    const bhR = result.buyHoldReturnRate;
    const beatBH = bhR == null || ret > bhR; // 단순보유를 못 이겼으면 "괜찮은 전략" 총평을 주지 않음(항목별 해석과 일관)
    if (ret > 0 && sharpe >= 1 && mdd < 25 && beatBH) return { tone: 'good', text: '전반적으로 괜찮은 전략이에요 — 위험 대비 수익이 양호합니다.' };
    if (ret <= 0 || sharpe < 0) return { tone: 'bad', text: '이 종목·기간엔 잘 맞지 않았어요. 다른 종목/기간이나 조건 조정을 시도해보세요.' };
    if (!beatBH) return { tone: 'neutral', text: '수익은 났지만 단순 보유(Buy & Hold)보다 못했어요 — 전략의 효용을 더 점검해보세요.' };
    return { tone: 'neutral', text: '무난한 결과예요 — 강점과 약점이 섞여 있어요.' };
  })();

  const metrics: { l: string; v: string; t?: string }[] = [
    { l: '총 수익률', v: sub(result.totalReturnRate) },
    { l: '최종 자산', v: money(result.finalValue) },
    { l: 'CAGR', v: result.cagr != null ? sub(result.cagr) : '—', t: 'CAGR' },
    { l: 'Profit Factor', v: result.profitFactor != null ? result.profitFactor.toFixed(2) : '—', t: 'ProfitFactor' },
    { l: 'Sortino', v: result.sortinoRatio != null ? result.sortinoRatio.toFixed(2) : '—', t: '소르티노' },
    { l: '평균 보유 기간', v: result.avgHoldingDays != null ? `${Math.round(result.avgHoldingDays)}일` : '—', t: '평균보유' },
    { l: '평균 수익 거래', v: result.avgWinRate != null ? sub(result.avgWinRate) : '—' },
    { l: '평균 손실 거래', v: result.avgLossRate != null ? sub(result.avgLossRate) : '—' },
  ];

  return (
    <section className="flex flex-col gap-[18px]">
      <StationBar title={result.strategyName || strat?.name || '백테스트 결과'} sub={`${result.stockName} · ${result.startDate} ~ ${result.endDate}`}
        badge={<span className="rounded-full px-2.5 py-1 text-[12px] font-bold" style={{ background: up ? 'rgba(239,77,77,.16)' : 'rgba(77,138,255,.16)', color: up ? '#ffd9d9' : '#cfe1ff' }}>{up ? '수익' : '손실'} {sub(result.totalReturnRate)}</span>} />
      {/* 테스트 요약 */}
      <div style={{ ...mkCard, padding: '22px 24px' }}>
        <div className="mb-3.5 flex items-center justify-between"><h3 className="text-[14px] font-bold">테스트 요약</h3>
          <button onClick={onExport} className="rounded-lg px-3 py-1.5 text-[12px] font-semibold" style={{ border: `1px solid ${LINE_S}`, color: GLOW }}>⤓ CSV 내보내기</button>
        </div>
        <div className="grid gap-x-6 gap-y-2.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {[['전략', result.strategyName || strat?.name || '—'], ['종목', `${result.stockName} (${result.stockCode})`], ['기간', `${result.startDate} ~ ${result.endDate}`], ['초기 투자금', money(result.initialCapital)],
            ['총 거래', `${num(result.totalTrades)}회`], ['배당 재투자', result.dividendReinvest === false ? 'OFF' : (isUsd ? 'ON' : '—')],
            ...(isUsd ? [['환율 (USD/KRW)', `₩${fmtNum(rate)}`] as [string, string]] : [])].map(([l, v]) => (
            <div key={l} className="flex items-baseline justify-between border-b border-dotted py-1.5 text-[13px]" style={{ borderColor: LINE }}><span style={{ color: INK2 }}>{l}</span><span className="font-mono font-semibold">{v}</span></div>
          ))}
          {result.monthlyContribution ? <div className="flex items-baseline justify-between border-b border-dotted py-1.5 text-[13px]" style={{ borderColor: LINE }}><span style={{ color: INK2 }}><Term k="적립식" compact>적립식</Term></span><span className="font-mono font-semibold">월 {money(result.monthlyContribution)} × {result.contributionCount ?? 0}회</span></div> : null}
          {result.totalContribution ? <div className="flex items-baseline justify-between border-b border-dotted py-1.5 text-[13px]" style={{ borderColor: LINE }}><span style={{ color: INK2 }}>총 납입액</span><span className="font-mono font-semibold">{money(result.totalContribution)}</span></div> : null}
          {result.totalDividendsReceived ? <div className="flex items-baseline justify-between border-b border-dotted py-1.5 text-[13px]" style={{ borderColor: LINE }}><span style={{ color: INK2 }}>받은 배당 합계</span><span className="font-mono font-semibold">{money(result.totalDividendsReceived)}</span></div> : null}
        </div>
      </div>
      {/* 2자산 리밸런싱 분해 */}
      {result.secondStockCode && (
        <div style={{ ...mkCard, padding: '20px 24px' }}>
          <h3 className="mb-3.5 text-[14px] font-bold">2자산 리밸런싱</h3>
          <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
            <div className="rounded-[10px] px-4 py-3.5" style={{ background: 'var(--ci-card)', border: `1px solid ${LINE}` }}>
              <div className="text-[11px]" style={{ color: INK2 }}>{result.stockName} <span className="font-mono" style={{ color: GLOW }}>{result.firstAssetWeight ?? '—'}%</span></div>
              <div className="mt-1 font-mono text-[16px] font-bold">{cur}{fmtNum(result.firstAssetFinalValue ?? 0)}</div>
              {isUsd && <div className="font-mono text-[11px]" style={{ color: INK3 }}>₩{fmtNum(Math.round(num(result.firstAssetFinalValue) * rate))}</div>}
              <div className="mt-0.5 text-[11px]" style={{ color: INK3 }}>{num(result.firstAssetTradeCount)}회 거래</div>
            </div>
            <div className="rounded-[10px] px-4 py-3.5" style={{ background: 'var(--ci-card)', border: `1px solid ${LINE}` }}>
              <div className="text-[11px]" style={{ color: INK2 }}>{result.secondStockName} <span className="font-mono" style={{ color: COMPASS }}>{result.secondAssetWeight ?? '—'}%</span></div>
              <div className="mt-1 font-mono text-[16px] font-bold">{cur}{fmtNum(result.secondAssetFinalValue ?? 0)}</div>
              {isUsd && <div className="font-mono text-[11px]" style={{ color: INK3 }}>₩{fmtNum(Math.round(num(result.secondAssetFinalValue) * rate))}</div>}
              <div className="mt-0.5 text-[11px]" style={{ color: INK3 }}>{num(result.secondAssetTradeCount)}회 거래</div>
            </div>
            <div className="rounded-[10px] px-4 py-3.5" style={{ background: 'var(--ci-card)', border: `1px solid ${LINE}` }}>
              <div className="text-[11px]" style={{ color: INK2 }}>리밸런싱</div>
              <div className="mt-1 font-mono text-[16px] font-bold">{num(result.rebalanceCount)}회</div>
              <div className="mt-0.5 text-[11px]" style={{ color: INK3 }}>{REBAL_LABEL[result.rebalanceFrequency || 'MONTHLY']} 주기</div>
            </div>
          </div>
        </div>
      )}
      {/* KPI */}
      <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <KPI label="기대 수익률" value={sub(result.totalReturnRate)} sub={result.cagr != null ? `CAGR ${sub(result.cagr)}` : `최종 ${money(result.finalValue)}`} color={up ? UP : DOWN} />
        <KPI label={<>최대 낙폭 (<Term k="MDD">MDD</Term>)</>} value={sub(-Math.abs(num(result.maxDrawdown)))} sub={result.maxDrawdownDuration != null ? `기간 ${result.maxDrawdownDuration}일` : '최대 손실폭'} color={DOWN} />
        <KPI label={<Term k="승률">승률</Term>} value={`${num(result.winRate).toFixed(1)}%`} sub={`${num(result.totalTrades)}회 중 ${num(result.profitableTrades)}승`} color={num(result.winRate) >= 50 ? UP : 'var(--ci-ink0)'} />
        <KPI label={<Term k="샤프비율">샤프 비율</Term>} value={num(result.sharpeRatio).toFixed(2)} sub={num(result.sharpeRatio) >= 1 ? '양호' : num(result.sharpeRatio) >= 0 ? '보통' : '위험'} color={num(result.sharpeRatio) >= 1 ? UP : num(result.sharpeRatio) < 0 ? DOWN : 'var(--ci-ink0)'} />
      </div>
      {/* 결과 자동 해석 (초보자용) */}
      <div style={{ ...mkCard, padding: '20px 24px' }}>
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[15px] font-bold">📋 결과 해석</span>
          <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: 'rgba(91,157,255,.14)', color: GLOW }}>초보자용</span>
        </div>
        <div className="mb-3.5 rounded-lg px-3.5 py-3 text-[13.5px] font-semibold" style={{ background: `${TONE_C[headline.tone]}1f`, border: `1px solid ${TONE_C[headline.tone]}66`, color: 'var(--ci-ink0)' }}>{headline.text}</div>
        <ul className="m-0 flex flex-col gap-2 p-0" style={{ listStyle: 'none' }}>
          {interp.map((it, i) => (
            <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed">
              <span className="mt-[6px] h-2 w-2 shrink-0 rounded-full" style={{ background: TONE_C[it.tone] }} />
              <span style={{ color: INK1 }}>{it.text}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3.5 text-[11px]" style={{ color: INK3 }}>※ 과거 성과가 미래 수익을 보장하지 않습니다. 백테스트는 전략 검증을 돕는 참고 자료예요.</p>
      </div>
      {/* 가격 차트 */}
      <div style={{ ...mkCard, padding: '20px 24px' }}>
        <div className="mb-3 flex items-center justify-between"><h3 className="text-[14px] font-bold">가격 차트 & 매매 포인트</h3>
          <div className="flex flex-wrap gap-3.5 text-[11px]" style={{ color: INK1 }}><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: UP }} />매수 {trades.filter(t => t.type === 'BUY').length}</span><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: DOWN }} />매도 {trades.filter(t => t.type === 'SELL').length}</span>{trades.some(t => t.type === 'SHORT' || t.type === 'COVER') && <><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: DOWN }} />공매도 {trades.filter(t => t.type === 'SHORT').length}</span><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: UP }} />커버 {trades.filter(t => t.type === 'COVER').length}</span></>}</div>
        </div>
        <div style={{ height: 260 }}><Chart pts={price} lines={[]} markers={markers} h={260} /></div>
      </div>
      {/* 자산 추이 */}
      <div style={{ ...mkCard, padding: '20px 24px' }}>
        <div className="mb-3 flex items-center justify-between"><h3 className="text-[14px] font-bold">자산 변동 추이</h3>
          <div className="flex gap-3.5 text-[11px]" style={{ color: INK1 }}><span className="inline-flex items-center gap-1.5"><span style={{ width: 14, height: 2, background: GLOW }} />전략</span>{bh.length > 0 && <span className="inline-flex items-center gap-1.5"><span style={{ width: 14, borderTop: `2px dashed ${COMPASS}` }} /><Term k="BuyHold" compact>Buy &amp; Hold</Term> {sub(result.buyHoldReturnRate)}</span>}</div>
        </div>
        <div style={{ height: 220 }}><Chart pts={equity} lines={bh.length > 0 ? [{ data: bh, color: COMPASS, dash: true }] : []} h={220} baseline={result.totalContribution ?? result.initialCapital} baselineLabel={result.totalContribution ? '총 납입액' : '초기 자본'} /></div>
      </div>
      {/* 상세 지표 */}
      <div style={{ ...mkCard, padding: '22px 24px' }}>
        <h3 className="mb-3.5 text-[14px] font-bold">상세 성과 지표</h3>
        <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          {metrics.map(m => <div key={m.l} className="rounded-[10px] px-4 py-3.5" style={{ background: 'var(--ci-card)', border: `1px solid ${LINE}` }}><div className="text-[11px] tracking-[.08em]" style={{ color: INK2 }}>{m.t ? <Term k={m.t} compact>{m.l}</Term> : m.l}</div><div className="mt-1 font-mono text-[18px] font-bold">{m.v}</div></div>)}
        </div>
      </div>
      {/* 거래 내역 */}
      <div style={{ ...mkCard, padding: 0, overflow: 'hidden' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${LINE}` }}><h3 className="text-[14px] font-bold">거래 내역</h3><span className="text-[12px]" style={{ color: INK3 }}>{isUsd ? `USD 기준 · $1=₩${fmtNum(rate)} · ` : ''}{trades.length}건</span></div>
        {trades.length === 0 ? <div className="px-6 py-10 text-center text-[13px]" style={{ color: INK3 }}>이 기간/전략에서 발생한 거래가 없습니다</div> : (
          <div className="overflow-x-auto"><table className="w-full border-collapse" style={{ minWidth: 720 }}>
            <thead><tr>{['#', '날짜', '유형', '가격', '수량', '손익', '수익률', '보유일', '사유'].map(h => <th key={h} className="px-[18px] py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-[.12em]" style={{ color: INK3, borderBottom: `1px solid ${LINE}` }}>{h}</th>)}</tr></thead>
            <tbody>{trades.map((t, i) => { const pos = (t.pnl ?? 0) >= 0; const sell = t.type === 'SELL' || t.type === 'COVER'; return (
              <tr key={i}>
                <td className="px-[18px] py-3 font-mono text-[13px]" style={{ borderBottom: `1px solid ${LINE}`, color: INK2 }}>{String(i + 1).padStart(2, '0')}</td>
                <td className="px-[18px] py-3 font-mono text-[13px]" style={{ borderBottom: `1px solid ${LINE}` }}>{t.date}</td>
                <td className="px-[18px] py-3 text-[12px] font-bold" style={{ borderBottom: `1px solid ${LINE}`, color: t.type === 'BUY' || t.type === 'COVER' ? UP : DOWN }}>{TRADE_LABEL[t.type] || t.type}</td>
                <td className="px-[18px] py-3 font-mono text-[13px]" style={{ borderBottom: `1px solid ${LINE}` }}>{cur}{fmtNum(t.price)}</td>
                <td className="px-[18px] py-3 font-mono text-[13px]" style={{ borderBottom: `1px solid ${LINE}`, color: INK2 }}>{t.quantity.toLocaleString('ko-KR', { maximumFractionDigits: 6 })}</td>
                <td className="px-[18px] py-3 font-mono text-[13px] font-bold" style={{ borderBottom: `1px solid ${LINE}`, color: sell ? (pos ? UP : DOWN) : INK3 }}>{sell ? `${pos ? '+' : ''}${cur}${fmtNum(t.pnl)}` : '—'}</td>
                <td className="px-[18px] py-3 font-mono text-[13px] font-bold" style={{ borderBottom: `1px solid ${LINE}`, color: sell && t.pnlPercent != null ? (t.pnlPercent >= 0 ? UP : DOWN) : INK3 }}>{sell && t.pnlPercent != null ? `${t.pnlPercent >= 0 ? '+' : ''}${t.pnlPercent.toFixed(2)}%` : '—'}</td>
                <td className="px-[18px] py-3 font-mono text-[13px]" style={{ borderBottom: `1px solid ${LINE}`, color: INK2 }}>{t.holdingDays != null ? `${t.holdingDays}일` : '—'}</td>
                <td className="px-[18px] py-3 text-[12px]" style={{ borderBottom: `1px solid ${LINE}`, color: INK3 }}>{t.reason || '—'}</td>
              </tr>); })}</tbody>
          </table></div>
        )}
      </div>
    </section>
  );
};

const seg = (on: boolean): React.CSSProperties => ({ border: on ? '1px solid rgba(91,157,255,.32)' : `1px solid ${LINE}`, background: on ? 'rgba(91,157,255,.14)' : 'var(--ci-card)', color: on ? GLOW : INK1 });

type Target = { symbol: string; name: string; assetType: string };
type RebalFreq = 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
type Sizing = 'ALL_IN' | 'PERCENT' | 'FIXED_AMOUNT';
type AdvOpts = {
  stopLoss: string; takeProfit: string; trailingStop: string; slippage: string; commission: string; leverage: string;
  tradeDirection: 'LONG_ONLY' | 'SHORT_ONLY' | 'LONG_SHORT' | 'LONG_SHORT_FLAT'; dividendReinvest: boolean;
  positionSizing: Sizing; positionValue: string; maxPositions: string; // maxPositions: 'auto' = 프리셋/기본
  dateMode: 'preset' | 'custom'; customStart: string; customEnd: string;
};
const ADV_DEFAULTS: AdvOpts = { stopLoss: '', takeProfit: '', trailingStop: '', slippage: '', commission: '', leverage: '', tradeDirection: 'LONG_ONLY', dividendReinvest: true, positionSizing: 'ALL_IN', positionValue: '', maxPositions: 'auto', dateMode: 'preset', customStart: '', customEnd: '' };
const REBAL: [RebalFreq, string][] = [['MONTHLY', '매월'], ['QUARTERLY', '분기'], ['YEARLY', '매년']];
const REBAL_LABEL: Record<string, string> = { MONTHLY: '매월', QUARTERLY: '분기', YEARLY: '매년' };
const TDIR: [AdvOpts['tradeDirection'], string][] = [['LONG_ONLY', '매수만'], ['SHORT_ONLY', '공매도만'], ['LONG_SHORT', '롱·숏'], ['LONG_SHORT_FLAT', '롱·숏(독립)']];
const POS_OPTS: [string, string][] = [['auto', '자동'], ['2', '2회'], ['3', '3회'], ['5', '5회']];
const SIZING: [Sizing, string][] = [['ALL_IN', '전량'], ['PERCENT', '자본 비율'], ['FIXED_AMOUNT', '고정 금액']];
type RunnerProps = {
  strat: Strat | null; target: Target; setTarget: (t: Target) => void; period: string; setPeriod: (p: string) => void;
  capital: number; setCapital: (n: number) => void; monthly: number; setMonthly: (n: number) => void;
  editInd: Indicator[]; setEditInd: (v: Indicator[]) => void; editEntry: Condition[]; setEditEntry: (v: Condition[]) => void; editExit: Condition[]; setEditExit: (v: Condition[]) => void;
  adv: AdvOpts; setAdv: (v: AdvOpts) => void; turtle: TurtleParams; setTurtle: (v: TurtleParams) => void;
  second: Target | null; setSecond: (v: Target | null) => void; firstWeight: number; setFirstWeight: (n: number) => void; rebalanceFreq: RebalFreq; setRebalanceFreq: (v: RebalFreq) => void;
  stratAssets: Target[]; onRun: () => void; running: boolean; historyCount: number; onShowHistory: () => void;
};
const BT_CLASSES: [string, string][] = [['CRYPTO', '코인'], ['STOCK', '주식'], ['US_STOCK', '미국'], ['ETF', 'ETF']];
const condLabel = (ind: string, side: '매수' | '매도') => ind === 'RSI' ? `RSI ${side} 기준` : ind === 'BOLLINGER_PCT_B' ? `%B ${side} 기준` : ind === 'STOCH_K' ? `%K ${side} 기준` : `${side === '매수' ? '진입' : '청산'} ${ind}`;
const THRESH_INDS = ['RSI', 'BOLLINGER_PCT_B', 'STOCH_K']; // 기준값 편집 대상(임계 지표). 크로스 지표는 value 0 고정이라 제외

/* 자산 전체 검색 박스 (코인/주식/미국/ETF) — 기본 종목 + 2자산 리밸런싱 종목 공용 */
const AssetSearchBox = ({ cryptoList, onPick }: { cryptoList: { code: string; name: string }[]; onPick: (code: string, name: string, assetType: string) => void }) => {
  const [klass, setKlass] = useState('CRYPTO');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ code: string; name: string }[]>([]);
  useEffect(() => {
    const q = query.trim();
    if (klass === 'CRYPTO') { setResults(cryptoList.filter(c => c.code.toLowerCase().includes(q.toLowerCase()) || c.name.includes(q)).slice(0, 30)); return; }
    if (q.length < 1) { setResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const fn = klass === 'US_STOCK' ? marketService.searchUsStocks : klass === 'ETF' ? marketService.searchEtfs : marketService.searchStocks;
        setResults((await fn(q)).map(r => ({ code: r.code, name: r.name })).slice(0, 30));
      } catch { setResults([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [query, klass, cryptoList]);
  const pick = (code: string, name: string) => { onPick(code, name, klass); setQuery(''); setResults([]); };
  return (
    <>
      <div className="flex gap-1">{BT_CLASSES.map(([k, l]) => <button key={k} onClick={() => { setKlass(k); setQuery(''); setResults([]); }} className="flex-1 rounded-md py-1.5 text-[11px] font-semibold" style={seg(klass === k)}>{l}</button>)}</div>
      <input value={query} onChange={e => setQuery(e.target.value)} aria-label="종목 검색" placeholder={klass === 'CRYPTO' ? '코인 검색 (BTC, 이더리움…)' : '종목 검색 (삼성, AAPL…)'} className="mt-1.5 w-full rounded-lg px-3 py-2 text-[12.5px] outline-none" style={fieldStyle} />
      {results.length > 0 && <div className="no-scrollbar mt-1 flex max-h-[176px] flex-col gap-0.5 overflow-y-auto rounded-lg p-1" style={{ border: `1px solid ${LINE}`, background: 'var(--ci-raised)', boxShadow: '0 10px 26px -12px rgba(0,0,0,.5)' }}>
        {results.map(r => <button key={r.code} onClick={() => pick(r.code, r.name)} className="flex items-center justify-between rounded px-2.5 py-1.5 text-left text-[12px] hover:bg-white/5"><span className="truncate font-semibold">{r.name}</span><span className="ml-2 shrink-0 font-mono" style={{ color: INK3 }}>{r.code}</span></button>)}
      </div>}
    </>
  );
};
const BacktestRunner = ({ strat, target, setTarget, period, setPeriod, capital, setCapital, monthly, setMonthly, editInd, setEditInd, editEntry, setEditEntry, editExit, setEditExit, adv, setAdv, turtle, setTurtle, second, setSecond, firstWeight, setFirstWeight, rebalanceFreq, setRebalanceFreq, stratAssets, onRun, running, historyCount, onShowHistory }: RunnerProps) => {
  const range = adv.dateMode === 'custom' && adv.customStart && adv.customEnd ? { startDate: adv.customStart, endDate: adv.customEnd } : periodDates(period);
  const today = periodDates('1Y').endDate;
  const [cryptoList, setCryptoList] = useState<{ code: string; name: string }[]>([]);
  useEffect(() => { marketService.getPrices('CRYPTO').then(ps => setCryptoList(ps.map(p => ({ code: p.symbol, name: p.name })))).catch(() => {}); }, []);
  const isUsEtf = [target, ...(second ? [second] : [])].some(a => a.assetType === 'US_STOCK' || a.assetType === 'ETF');
  const rebalActive = !!(second && second.symbol !== target.symbol); // 2자산 모드: 손절/익절/트레일링·매매방향 백엔드 미지원
  const preset = strat ? PRESET_DEFS[strat.id] : null; // 프리셋 권장값(레버리지 등) 표시용
  return (
    <aside style={{ ...mkCard, padding: 0, display: 'flex', flexDirection: 'column' }}>
      <div className="wa-force-dark px-[18px] py-4 text-white" style={{ background: BT_GRAD, borderBottom: '1px solid rgba(255,255,255,.14)' }}>
        <h3 className="text-[16px] font-bold">백테스트 실행</h3>
        <p className="mt-0.5 truncate text-[12.5px] text-white/70">{strat ? `— ${strat.name}` : '왼쪽 라이브러리에서 전략을 선택하세요'}</p>
      </div>
      <div className="flex flex-col gap-[18px] p-[18px]">
        {strat && <div style={{ ...mkCard, padding: '14px 16px' }}><div className="text-[13.5px] font-bold">{strat.name}</div><div className="mt-0.5 text-[11.5px]" style={{ color: INK2 }}>진입 1개 · 청산 1개 조건</div></div>}
        {/* 종목 (전체 검색) */}
        <div><Label>종목 (전체 검색)</Label>
          <div className="mt-1.5 flex items-center justify-between rounded-lg px-3 py-2.5" style={{ border: '1px solid rgba(91,157,255,.32)', background: 'rgba(91,157,255,.08)' }}>
            <span className="truncate text-[13px] font-semibold">{target.name}</span><span className="ml-2 shrink-0 font-mono text-[11px]" style={{ color: INK2 }}>{target.symbol}</span>
          </div>
          <div className="mt-1.5"><AssetSearchBox cryptoList={cryptoList} onPick={(c, n, a) => setTarget({ symbol: c, name: n, assetType: a })} /></div>
          {stratAssets.length > 0 && <div className="mt-2">
            <div className="mb-1 text-[10.5px]" style={{ color: INK3 }}>이 전략의 종목</div>
            <div className="flex flex-wrap gap-1.5">{stratAssets.map(a => <button key={a.symbol} onClick={() => setTarget(a)} className="rounded-md px-2.5 py-1 text-[11px] font-semibold" style={{ border: `1px solid ${target.symbol === a.symbol ? 'rgba(91,157,255,.32)' : LINE}`, background: target.symbol === a.symbol ? 'rgba(91,157,255,.12)' : 'var(--ci-card)', color: target.symbol === a.symbol ? GLOW : INK1 }}>{a.name}</button>)}</div>
          </div>}
        </div>
        {/* 분석 기간 (프리셋 / 직접지정) */}
        <div><div className="flex items-center justify-between"><Label>분석 기간</Label>
          <div className="flex gap-1">{(['preset', 'custom'] as const).map(m => <button key={m} onClick={() => setAdv({ ...adv, dateMode: m })} className="rounded-md px-2 py-0.5 text-[10.5px] font-semibold" style={seg(adv.dateMode === m)}>{m === 'preset' ? '기간선택' : '직접지정'}</button>)}</div></div>
          {adv.dateMode === 'preset' ? <>
            <div className="mt-1.5 grid grid-cols-5 gap-1.5">{PERIODS.map(([k, l]) => <button key={k} onClick={() => setPeriod(k)} className="rounded-lg py-2 text-[11.5px] font-semibold" style={seg(period === k)}>{l}</button>)}</div>
            <div className="mt-2 text-center font-mono text-[11.5px]" style={{ color: INK3 }}>{range.startDate} ~ {range.endDate}</div>
          </> : <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            <label className="flex flex-col gap-1"><span className="text-[10.5px]" style={{ color: INK3 }}>시작일</span><input type="date" max={today} value={adv.customStart} onChange={e => setAdv({ ...adv, customStart: e.target.value })} className="rounded px-2 py-1.5 text-[12px] outline-none" style={fieldStyle} /></label>
            <label className="flex flex-col gap-1"><span className="text-[10.5px]" style={{ color: INK3 }}>종료일</span><input type="date" max={today} value={adv.customEnd} onChange={e => setAdv({ ...adv, customEnd: e.target.value })} className="rounded px-2 py-1.5 text-[12px] outline-none" style={fieldStyle} /></label>
          </div>}
        </div>
        {/* 초기 투자금 + 적립식 */}
        <div><Label>초기 투자금</Label>
          <input type="number" value={capital} onChange={e => setCapital(Number(e.target.value) || 0)} className="mt-1.5 w-full rounded-lg px-3 py-2.5 text-right font-mono text-[15px] font-semibold outline-none" style={{ border: `1px solid ${LINE}`, background: 'var(--ci-card)', color: 'var(--ci-ink0)' }} />
          <div className="mt-2 grid grid-cols-4 gap-1.5">{CAPS.map(([v, l]) => <button key={v} onClick={() => setCapital(v)} className="rounded-md py-1.5 text-[11.5px] font-semibold" style={{ border: `1px solid ${LINE}`, background: 'var(--ci-card)', color: INK1 }}>{l}</button>)}</div>
          <label className="mt-3 flex items-center gap-2 text-[12.5px]" style={{ color: INK1 }}><input type="checkbox" className="accent-[#5b9dff]" checked={monthly > 0} onChange={e => setMonthly(e.target.checked ? Math.max(100_000, Math.round(capital / 12)) : 0)} /><Term k="적립식" compact>적립식 투자</Term> (매월 {monthly > 0 ? `₩${fmtNum(monthly)}` : '첫 거래일'})</label>
          {monthly > 0 && <div className="mt-2"><input type="number" value={monthly} onChange={e => setMonthly(Math.max(0, Number(e.target.value) || 0))} className="w-full rounded-lg px-3 py-2 text-right font-mono text-[13px] outline-none" style={fieldStyle} /><div className="mt-1.5 grid grid-cols-4 gap-1.5">{[100_000, 300_000, 500_000, 1_000_000].map(v => <button key={v} onClick={() => setMonthly(v)} className="rounded-md py-1 text-[10.5px] font-semibold" style={{ border: `1px solid ${LINE}`, background: 'var(--ci-card)', color: INK1 }}>{fmtNum(v / 10000)}만</button>)}</div></div>}
        </div>
        {/* 터틀 전용 설정 — 채널 기간·ADX·유닛·레버리지 (종목별로 다르게) */}
        {strat?.id === TURTLE_PRESET_ID && (
          <div className="rounded-lg p-3" style={{ border: '1px solid rgba(91,157,255,.32)', background: 'rgba(91,157,255,.06)' }}>
            <div className="mb-2 text-[12.5px] font-bold" style={{ color: GLOW }}>🐢 터틀 설정 (종목별로 조정 가능)</div>
            <div className="grid grid-cols-3 gap-2">
              <label className="flex flex-col gap-1"><span className="text-[10.5px]" style={{ color: INK3 }}>진입 채널</span><input type="number" min={5} step={1} value={turtle.entryPeriod} onChange={e => setTurtle({ ...turtle, entryPeriod: Number(e.target.value) || 0 })} className="rounded px-2 py-1.5 text-[12px] outline-none" style={fieldStyle} /></label>
              <label className="flex flex-col gap-1"><span className="text-[10.5px]" style={{ color: INK3 }}>청산 채널</span><input type="number" min={2} step={1} value={turtle.exitPeriod} onChange={e => setTurtle({ ...turtle, exitPeriod: Number(e.target.value) || 0 })} className="rounded px-2 py-1.5 text-[12px] outline-none" style={fieldStyle} /></label>
              <label className="flex flex-col gap-1"><span className="text-[10.5px]" style={{ color: INK3 }}>ADX 임계</span><input type="number" min={0} step={1} value={turtle.adxThreshold} onChange={e => setTurtle({ ...turtle, adxThreshold: Number(e.target.value) || 0 })} className="rounded px-2 py-1.5 text-[12px] outline-none" style={fieldStyle} /></label>
              <label className="flex flex-col gap-1"><span className="text-[10.5px]" style={{ color: INK3 }}>최대 유닛</span><input type="number" min={1} max={10} step={1} value={turtle.maxUnits} onChange={e => setTurtle({ ...turtle, maxUnits: Number(e.target.value) || 1 })} className="rounded px-2 py-1.5 text-[12px] outline-none" style={fieldStyle} /></label>
              <label className="flex flex-col gap-1"><span className="text-[10.5px]" style={{ color: INK3 }}>레버리지</span><input type="number" min={1} max={20} step={1} value={turtle.leverage} onChange={e => setTurtle({ ...turtle, leverage: Number(e.target.value) || 1 })} className="rounded px-2 py-1.5 text-[12px] outline-none" style={fieldStyle} /></label>
              <label className="flex flex-col gap-1"><span className="text-[10.5px]" style={{ color: INK3 }}>트레일링 %</span><input type="number" min={0} step={0.5} value={turtle.trailingStopPercent} onChange={e => setTurtle({ ...turtle, trailingStopPercent: Number(e.target.value) || 0 })} className="rounded px-2 py-1.5 text-[12px] outline-none" style={fieldStyle} /></label>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button onClick={() => setTurtle({ entryPeriod: 100, exitPeriod: 30, adxThreshold: 15, maxUnits: 5, leverage: 7, trailingStopPercent: 4 })} className="rounded-md px-2 py-1 text-[11px] font-semibold" style={{ border: `1px solid ${LINE}`, background: 'var(--ci-card)', color: INK1 }}>BTC 프리셋 (100/30·ADX15·7배·5유닛)</button>
              <button onClick={() => setTurtle({ entryPeriod: 80, exitPeriod: 40, adxThreshold: 25, maxUnits: 4, leverage: 4, trailingStopPercent: 5 })} className="rounded-md px-2 py-1 text-[11px] font-semibold" style={{ border: `1px solid ${LINE}`, background: 'var(--ci-card)', color: INK1 }}>ETH 프리셋 (80/40·ADX25·4배·4유닛)</button>
            </div>
            <div className="mt-1.5 text-[10.5px]" style={{ color: INK3 }}>롱·숏 양방향 + 피라미딩으로 자동 구성됩니다. 백테스트는 일봉, 라이브(Bitget 선물)는 선택한 봉 기준.</div>
          </div>
        )}
        {/* 고급 설정 — 리스크·비용·방향·배당·지표 */}
        {strat && <details className="rounded-lg" style={{ border: `1px solid ${LINE}`, background: 'var(--ci-card)' }}>
          <summary className="cursor-pointer list-none px-3 py-2.5 text-[12.5px] font-semibold" style={{ color: INK1 }}>고급 설정 — 리스크·비용·지표</summary>
          <div className="flex flex-col gap-3.5 px-3 pb-3">
            <div>
              <div className="mb-1.5 text-[11px] font-bold" style={{ color: INK2 }}>리스크 관리 (%, 비우면 미적용)</div>
              <div className="grid grid-cols-3 gap-2">
                <label className="flex flex-col gap-1"><span className="text-[10.5px]" style={{ color: INK3 }}><Term k="손절" compact>손절</Term></span><input type="number" min={0} step="0.1" value={adv.stopLoss} onChange={e => setAdv({ ...adv, stopLoss: e.target.value })} placeholder="–" className="rounded px-2 py-1.5 text-[12px] outline-none" style={fieldStyle} /></label>
                <label className="flex flex-col gap-1"><span className="text-[10.5px]" style={{ color: INK3 }}><Term k="익절" compact>익절</Term></span><input type="number" min={0} step="0.1" value={adv.takeProfit} onChange={e => setAdv({ ...adv, takeProfit: e.target.value })} placeholder="–" className="rounded px-2 py-1.5 text-[12px] outline-none" style={fieldStyle} /></label>
                <label className="flex flex-col gap-1"><span className="text-[10.5px]" style={{ color: INK3 }}><Term k="트레일링스탑" compact>트레일링</Term></span><input type="number" min={0} step="0.1" value={adv.trailingStop} onChange={e => setAdv({ ...adv, trailingStop: e.target.value })} placeholder="–" className="rounded px-2 py-1.5 text-[12px] outline-none" style={fieldStyle} /></label>
              </div>
            </div>
            <div>
              <div className="mb-1.5 text-[11px] font-bold" style={{ color: INK2 }}>거래 비용 (%, 기본 0.1)</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1"><span className="text-[10.5px]" style={{ color: INK3 }}><Term k="슬리피지" compact>슬리피지</Term></span><input type="number" min={0} step="0.05" value={adv.slippage} onChange={e => setAdv({ ...adv, slippage: e.target.value })} placeholder="0.1" className="rounded px-2 py-1.5 text-[12px] outline-none" style={fieldStyle} /></label>
                <label className="flex flex-col gap-1"><span className="text-[10.5px]" style={{ color: INK3 }}><Term k="수수료" compact>수수료율</Term></span><input type="number" min={0} step="0.05" value={adv.commission} onChange={e => setAdv({ ...adv, commission: e.target.value })} placeholder="0.1" className="rounded px-2 py-1.5 text-[12px] outline-none" style={fieldStyle} /></label>
              </div>
            </div>
            {!rebalActive && <div>
              <div className="mb-1.5 text-[11px] font-bold" style={{ color: INK2 }}>레버리지 (배, 선물 — 비우면 1배/현물)</div>
              <input type="number" min={1} max={20} step={1} value={adv.leverage} onChange={e => setAdv({ ...adv, leverage: e.target.value })} placeholder={preset?.leverage ? `${preset.leverage} (권장)` : '1'} className="w-full rounded px-2 py-1.5 text-[12px] outline-none" style={fieldStyle} />
              <div className="mt-1 text-[10.5px]" style={{ color: COMPASS }}>⚠️ 손익이 배수만큼 증폭되고 증거금 소진 시 강제청산됩니다. 백테스트는 일봉 근사이며 실거래 결과와 다를 수 있어요.</div>
            </div>}
            <div style={rebalActive ? { opacity: .5 } : undefined}>
              <div className="mb-1.5 text-[11px] font-bold" style={{ color: INK2 }}>매매 방향</div>
              <div className="flex gap-1">{TDIR.map(([k, l]) => <button key={k} disabled={rebalActive} onClick={() => setAdv({ ...adv, tradeDirection: k })} className="flex-1 rounded-md py-1.5 text-[11px] font-semibold disabled:cursor-not-allowed" style={seg(adv.tradeDirection === k)}>{l}</button>)}</div>
              {rebalActive && <div className="mt-1 text-[10.5px]" style={{ color: COMPASS }}>2자산 리밸런싱은 매수(LONG)만 지원합니다.</div>}
              {!rebalActive && adv.tradeDirection === 'LONG_SHORT_FLAT' && <div className="mt-1 text-[10.5px]" style={{ color: INK3 }}>독립 롱+숏: 청산 시 현금으로 빠져 다음 돌파를 대기합니다(전환 아님). 숏 조건은 프리셋(터틀)에서 제공됩니다.</div>}
            </div>
            {!rebalActive && <div>
              <div className="mb-1.5 text-[11px] font-bold" style={{ color: INK2 }}><Term k="분할매수" compact>분할 매수 (최대 동시 보유)</Term></div>
              <div className="flex gap-1">{POS_OPTS.map(([k, l]) => <button key={k} onClick={() => setAdv({ ...adv, maxPositions: k })} className="flex-1 rounded-md py-1.5 text-[11px] font-semibold" style={seg(adv.maxPositions === k)}>{l}</button>)}</div>
            </div>}
            {!rebalActive && <div>
              <div className="mb-1.5 text-[11px] font-bold" style={{ color: INK2 }}><Term k="포지션사이징" compact>포지션 사이징</Term></div>
              <div className="flex gap-1">{SIZING.map(([k, l]) => <button key={k} onClick={() => setAdv({ ...adv, positionSizing: k })} className="flex-1 rounded-md py-1.5 text-[11px] font-semibold" style={seg(adv.positionSizing === k)}>{l}</button>)}</div>
              {adv.positionSizing !== 'ALL_IN' && <input type="number" min={0} value={adv.positionValue} onChange={e => setAdv({ ...adv, positionValue: e.target.value })} placeholder={adv.positionSizing === 'PERCENT' ? '1회 매수 자본 비율 % (예: 50)' : '1회 매수 금액'} className="mt-1.5 w-full rounded px-2 py-1.5 text-[12px] outline-none" style={fieldStyle} />}
            </div>}
            {isUsEtf && <label className="flex items-center justify-between text-[12px]" style={{ color: INK1 }}><span className="font-semibold"><Term k="배당재투자" compact>배당 자동 재투자 (DRIP)</Term></span><input type="checkbox" className="accent-[#5b9dff]" checked={adv.dividendReinvest} onChange={e => setAdv({ ...adv, dividendReinvest: e.target.checked })} /></label>}
            {editInd.length > 0 && <div>
              <div className="mb-1.5 text-[11px] font-bold" style={{ color: INK2 }}>지표 파라미터</div>
              <div className="grid grid-cols-2 gap-2">
                {editInd.flatMap((ind, idx) => {
                  const sameType = editInd.filter(i => i.type === ind.type).length;
                  const sameIdx = editInd.slice(0, idx).filter(i => i.type === ind.type).length;
                  const pre = sameType > 1 ? (sameIdx === 0 ? '단기 ' : '장기 ') : '';
                  return Object.entries(ind.parameters).map(([k, v]) => (
                    <label key={`${idx}-${k}`} className="flex flex-col gap-1"><span className="text-[10.5px]" style={{ color: INK3 }}>{pre}{PARAM_LABEL[k] || `${ind.type} ${k}`}</span><input type="number" min={1} value={v} onChange={e => setEditInd(editInd.map((x, i) => i === idx ? { ...x, parameters: { ...x.parameters, [k]: e.target.value === '' ? 1 : Number(e.target.value) } } : x))} className="rounded px-2 py-1.5 text-[12px] outline-none" style={fieldStyle} /></label>
                  ));
                })}
              </div>
            </div>}
            {(editEntry.some(c => THRESH_INDS.includes(c.indicator) && !c.valueExpression) || editExit.some(c => THRESH_INDS.includes(c.indicator) && !c.valueExpression)) && <div>
              <div className="mb-1.5 text-[11px] font-bold" style={{ color: INK2 }}>매매 기준값</div>
              <div className="grid grid-cols-2 gap-2">
                {editEntry.map((c, idx) => THRESH_INDS.includes(c.indicator) && !c.valueExpression ? <label key={`en-${idx}`} className="flex flex-col gap-1"><span className="text-[10.5px]" style={{ color: INK3 }}>{condLabel(c.indicator, '매수')}</span><input type="number" value={c.value} onChange={e => setEditEntry(editEntry.map((x, i) => i === idx ? { ...x, value: e.target.value === '' ? 0 : Number(e.target.value) } : x))} className="rounded px-2 py-1.5 text-[12px] outline-none" style={fieldStyle} /></label> : null)}
                {editExit.map((c, idx) => THRESH_INDS.includes(c.indicator) && !c.valueExpression ? <label key={`ex-${idx}`} className="flex flex-col gap-1"><span className="text-[10.5px]" style={{ color: INK3 }}>{condLabel(c.indicator, '매도')}</span><input type="number" value={c.value} onChange={e => setEditExit(editExit.map((x, i) => i === idx ? { ...x, value: e.target.value === '' ? 0 : Number(e.target.value) } : x))} className="rounded px-2 py-1.5 text-[12px] outline-none" style={fieldStyle} /></label> : null)}
              </div>
            </div>}
            {(editEntry.some(c => c.valueExpression) || editExit.some(c => c.valueExpression)) && <div>
              <div className="mb-1.5 text-[11px] font-bold" style={{ color: INK2 }}>수식 조건 <span className="font-normal" style={{ color: INK3 }}>(OPEN·PREV_HIGH·PREV_LOW)</span></div>
              <div className="flex flex-col gap-2">
                {editEntry.map((c, idx) => c.valueExpression != null ? <label key={`enx-${idx}`} className="flex flex-col gap-1"><span className="text-[10.5px]" style={{ color: INK3 }}>진입 수식</span><input value={c.valueExpression} onChange={e => setEditEntry(editEntry.map((x, i) => i === idx ? { ...x, valueExpression: e.target.value } : x))} className="rounded px-2 py-1.5 font-mono text-[11px] outline-none" style={fieldStyle} /></label> : null)}
                {editExit.map((c, idx) => c.valueExpression != null ? <label key={`exx-${idx}`} className="flex flex-col gap-1"><span className="text-[10.5px]" style={{ color: INK3 }}>청산 수식</span><input value={c.valueExpression} onChange={e => setEditExit(editExit.map((x, i) => i === idx ? { ...x, valueExpression: e.target.value } : x))} className="rounded px-2 py-1.5 font-mono text-[11px] outline-none" style={fieldStyle} /></label> : null)}
              </div>
            </div>}
          </div>
        </details>}
        {/* 2자산 리밸런싱 */}
        {strat && <details className="rounded-lg" style={{ border: `1px solid ${LINE}`, background: 'var(--ci-card)' }}>
          <summary className="cursor-pointer list-none px-3 py-2.5 text-[12.5px] font-semibold" style={{ color: INK1 }}>2자산 <Term k="리밸런싱" compact>리밸런싱</Term> {second ? '· ON' : '(선택)'}</summary>
          <div className="flex flex-col gap-2.5 px-3 pb-3">
            <p className="text-[11px]" style={{ color: INK3 }}>두 번째 자산을 추가하면 비중대로 주기적으로 리밸런싱합니다.</p>
            {second ? <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ border: '1px solid rgba(91,157,255,.32)', background: 'rgba(91,157,255,.08)' }}>
              <span className="truncate text-[12.5px] font-semibold">{second.name} <span className="font-mono text-[10.5px]" style={{ color: INK3 }}>{second.symbol}</span></span>
              <button onClick={() => setSecond(null)} className="ml-2 shrink-0 text-[11px] font-semibold" style={{ color: UP }}>제거</button>
            </div> : <AssetSearchBox cryptoList={cryptoList} onPick={(c, n, a) => setSecond({ symbol: c, name: n, assetType: a })} />}
            {second && <>
              <div>
                <div className="mb-1 flex items-center justify-between text-[11px]"><span style={{ color: GLOW }}>{target.name}</span><span style={{ color: COMPASS }}>{second.name}</span></div>
                <input type="range" min={5} max={95} step={5} value={firstWeight} onChange={e => setFirstWeight(Number(e.target.value))} className="w-full accent-[#5b9dff]" />
                <div className="mt-0.5 flex items-center justify-between font-mono text-[12px] font-bold"><span style={{ color: GLOW }}>{firstWeight}%</span><span style={{ color: COMPASS }}>{100 - firstWeight}%</span></div>
              </div>
              <div>
                <div className="mb-1 text-[11px]" style={{ color: INK2 }}>리밸런싱 주기</div>
                <div className="flex gap-1">{REBAL.map(([k, l]) => <button key={k} onClick={() => setRebalanceFreq(k)} className="flex-1 rounded-md py-1.5 text-[11px] font-semibold" style={seg(rebalanceFreq === k)}>{l}</button>)}</div>
              </div>
            </>}
          </div>
        </details>}
        <button onClick={onRun} disabled={!strat || running} className="flex items-center justify-center gap-2 rounded-lg py-3.5 text-[14px] font-bold disabled:cursor-not-allowed" style={strat && !running ? { background: `linear-gradient(180deg, ${GLOW}, ${ACCENT})`, color: '#fff', boxShadow: '0 10px 24px -10px rgba(60,120,255,.5)' } : { background: 'var(--ci-card)', color: INK3 }}>
          {running ? '실행 중…' : `▶ ${strat ? '백테스트 실행' : '전략을 선택해주세요'}`}
        </button>
        <button onClick={onShowHistory} disabled={historyCount === 0} className="flex items-center justify-center gap-2 rounded-lg px-3.5 py-2.5 text-[13px] font-semibold disabled:opacity-50" style={{ border: `1px solid ${LINE}`, background: 'var(--ci-card)', color: INK1 }}>🕓 이전 결과 <span style={{ color: INK3 }}>({historyCount})</span></button>
      </div>
    </aside>
  );
};

/* ────────────── 전략 빌더 (새 항로 만들기 / 항로 수정) ────────────── */
const SectionNum = ({ n, title, sub, active }: { n: number; title: string; sub?: string; active?: boolean }) => (
  <div className="flex items-center gap-2.5">
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono text-[12px] font-bold" style={{ background: active ? 'rgba(91,157,255,.18)' : 'var(--ci-card)', color: active ? GLOW : INK2, border: `1px solid ${active ? 'rgba(91,157,255,.32)' : LINE}` }}>{n}</span>
    <div className="min-w-0"><div className="text-[13.5px] font-bold">{title}</div>{sub && <div className="text-[11px]" style={{ color: INK3 }}>{sub}</div>}</div>
  </div>
);

const ConditionEditor = ({ title, accent, conds, setConds, addDefault }: { title: string; accent: string; conds: Condition[]; setConds: (c: Condition[]) => void; addDefault: Condition }) => (
  <div>
    <div className="flex items-center justify-between">
      <span className="text-[12.5px] font-bold" style={{ color: accent }}>{title}</span>
      <button onClick={() => setConds([...conds, { ...addDefault }])} className="rounded-md px-2 py-1 text-[11.5px] font-semibold" style={{ border: `1px solid ${LINE}`, color: accent }}>+ 조건 추가</button>
    </div>
    <div className="mt-2 flex flex-col gap-1.5">
      {conds.length === 0 && <div className="text-[11.5px]" style={{ color: INK3 }}>조건이 없습니다. + 조건 추가를 눌러주세요.</div>}
      {conds.map((c, idx) => {
        const cross = isCrossInd(c.indicator);
        const upd = (patch: Partial<Condition>) => { const u = [...conds]; u[idx] = { ...c, ...patch }; setConds(u); };
        return (
          <div key={idx} className="flex items-center gap-1.5">
            {idx > 0 ? (
              <select value={c.logic} onChange={e => upd({ logic: e.target.value as Condition['logic'] })} className="shrink-0 rounded px-1 py-1.5 text-[11px] outline-none" style={fieldStyle}><option value="AND">AND</option><option value="OR">OR</option></select>
            ) : <span className="w-[44px] shrink-0" />}
            <select value={c.indicator} onChange={e => upd({ indicator: e.target.value })} className={`${cross ? 'flex-[2]' : 'flex-1'} min-w-0 rounded px-1.5 py-1.5 text-[12px] outline-none`} style={fieldStyle}>
              {COND_INDICATORS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {!cross && <>
              <select value={c.operator} onChange={e => upd({ operator: e.target.value as Condition['operator'] })} className="w-12 shrink-0 rounded px-1 py-1.5 text-[12px] outline-none" style={fieldStyle}>
                {OPERATORS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <input type="number" value={c.value} onChange={e => upd({ value: parseFloat(e.target.value) || 0 })} className="w-16 shrink-0 rounded px-1.5 py-1.5 text-right text-[12px] outline-none" style={fieldStyle} />
            </>}
            <button onClick={() => setConds(conds.filter((_, i) => i !== idx))} title="삭제" className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[15px] hover:bg-white/10" style={{ color: INK3 }}>×</button>
          </div>
        );
      })}
    </div>
  </div>
);

const Toast = ({ msg, type }: { msg: string; type: 'success' | 'error' }) => (
  <div className="fixed bottom-6 left-1/2 z-[120] -translate-x-1/2 rounded-xl px-5 py-3 text-[13px] font-semibold text-white" style={{ background: type === 'error' ? 'linear-gradient(180deg,#e0524f,#c23b38)' : 'linear-gradient(180deg,#2f9e6e,#1f7d57)', boxShadow: '0 14px 32px -10px rgba(0,0,0,.55)', animation: 'message-in .25s ease' }}>{msg}</div>
);

/* 포트폴리오 적용 모달 — 사용자 전략의 대상 종목을 모의투자 계좌에 균등 시장가 매수 */
const QUICK_AMOUNTS = [1_000_000, 5_000_000, 10_000_000, 30_000_000, 50_000_000];
const ApplyModal = ({ strategy, cash, onClose, onDone }: { strategy: Strategy; cash: number | null; onClose: () => void; onDone: (msg: string, type: 'success' | 'error') => void }) => {
  const navigate = useNavigate();
  const [amount, setAmount] = useState('1000000');
  const [busy, setBusy] = useState(false);
  const assets = strategy.targetAssets || [];
  const amt = Math.max(0, Math.floor(Number(amount) || 0)); // 콤마/공백 등 비정상 입력 안전 처리
  const perAsset = assets.length ? amt / assets.length : 0;
  const overCash = cash != null && amt > cash;
  const noAssets = assets.length === 0;

  const apply = async () => {
    if (busy) return; // 중복 제출 방지(상태 반영 전 연타 → 중복 매수 차단)
    if (!(amt > 0)) { onDone('투자 금액을 입력해주세요.', 'error'); return; }
    if (overCash) { onDone(`잔고가 부족합니다. 보유 잔고: ₩${fmtNum(cash || 0)}`, 'error'); return; }
    setBusy(true);
    try {
      const r = await strategyService.applyStrategy(strategy.id, amt);
      const success = r.appliedSuccessCount ?? assets.length;
      const total = r.appliedTotalCount ?? assets.length;
      onDone(success < total ? `"${strategy.name}" 적용 완료 · ${total}종목 중 ${success}종목 매수 성공` : `"${strategy.name}" 포트폴리오 적용 완료 · ${success}종목 균등 투자`, 'success');
    } catch (e: any) {
      onDone(e?.response?.data?.error || e?.response?.data?.message || '항로 적용에 실패했습니다.', 'error');
    } finally { setBusy(false); }
  };
  const unapply = async () => {
    if (busy) return;
    setBusy(true);
    try { await strategyService.unapplyStrategy(strategy.id); onDone(`"${strategy.name}" 적용을 해제했습니다. (이미 매수된 자산은 유지됩니다)`, 'success'); }
    catch (e: any) { onDone(e?.response?.data?.error || '적용 해제에 실패했습니다.', 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div onClick={onClose} className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto px-6 py-12" style={{ background: 'rgba(6,11,31,.72)', backdropFilter: 'blur(6px)', animation: 'backdrop-in .2s ease' }}>
      <div onClick={e => e.stopPropagation()} className="relative w-full max-w-[460px] rounded-[18px] p-6" style={{ background: 'var(--ci-overlay)', border: `1px solid ${LINE_S}`, boxShadow: 'var(--ci-panel-shadow)', animation: 'modal-in .25s cubic-bezier(.2,.8,.2,1)' }}>
        <h3 className="text-[18px] font-bold">⚓ 항로 포트폴리오 적용</h3>
        <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: INK1 }}>"<span style={{ color: 'var(--ci-ink0)' }}>{strategy.name}</span>" 항로의 대상 종목을 모의투자(₩) 계좌에 균등 시장가로 매수합니다.</p>
        {strategy.applied && <div className="mt-3 rounded-lg px-3 py-2 text-[12px]" style={{ background: 'rgba(63,214,160,.1)', border: '1px solid rgba(63,214,160,.28)', color: '#3fd6a0' }}>● 이미 적용된 항로입니다. 금액을 바꿔 다시 적용하거나 아래에서 해제할 수 있습니다.</div>}
        {noAssets ? (
          <div className="mt-4 rounded-lg px-3.5 py-3 text-[13px]" style={{ background: 'rgba(245,208,97,.1)', border: '1px solid rgba(245,208,97,.3)', color: COMPASS }}>이 항로에는 대상 종목이 설정되어 있지 않습니다. 전략 수정에서 대상 종목을 추가한 뒤 적용해주세요.</div>
        ) : (
          <>
            <div className="mt-4">
              <Label>투자 금액 (모의투자)</Label>
              <div className="relative mt-1.5">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px]" style={{ color: INK2 }}>₩</span>
                <input type="number" min={0} value={amount} onChange={e => setAmount(e.target.value)} className="w-full rounded-lg py-2.5 pl-8 pr-3 text-right font-mono text-[15px] font-semibold outline-none" style={{ border: `1px solid ${overCash ? 'rgba(239,77,77,.5)' : LINE}`, background: 'var(--ci-raised)', color: 'var(--ci-ink0)' }} />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {QUICK_AMOUNTS.map(q => <button key={q} onClick={() => setAmount(String(q))} className="rounded-md px-2.5 py-1 text-[11.5px] font-semibold" style={{ border: `1px solid ${LINE}`, background: amt === q ? 'rgba(91,157,255,.16)' : 'var(--ci-card)', color: amt === q ? GLOW : INK1 }}>{q >= 1e8 ? `${q / 1e8}억` : `${q / 1e4}만`}</button>)}
              </div>
            </div>
            <dl className="mt-4 grid gap-2 rounded-lg p-3.5 text-[13px]" style={{ background: 'var(--ci-card)', border: `1px solid ${LINE}` }}>
              <div className="flex justify-between"><dt style={{ color: INK2 }}>대상 종목</dt><dd className="m-0 font-mono font-semibold">{assets.length}종목</dd></div>
              <div className="flex justify-between"><dt style={{ color: INK2 }}>종목당 투자금</dt><dd className="m-0 font-mono font-semibold">₩{fmtNum(perAsset)}</dd></div>
              {cash != null && <div className="flex justify-between"><dt style={{ color: INK2 }}>모의 잔고</dt><dd className="m-0 font-mono font-semibold" style={{ color: overCash ? UP : 'var(--ci-ink0)' }}>₩{fmtNum(cash)}</dd></div>}
            </dl>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {assets.slice(0, 8).map(code => <span key={code} className="rounded-md px-2 py-1 font-mono text-[11px]" style={{ background: 'var(--ci-card)', border: `1px solid ${LINE}`, color: INK1 }}>{strategy.targetAssetNames?.[code] || code}</span>)}
              {assets.length > 8 && <span className="px-2 py-1 text-[11px]" style={{ color: INK3 }}>+{assets.length - 8}</span>}
            </div>
            {/* 자동매매 — ②(자동매매 페이지)로 통일. 여기선 안내·이동만 */}
            <div className="mt-4 rounded-xl p-3.5" style={{ background: 'var(--ci-card)', border: `1px solid ${LINE}` }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[13px] font-bold">⚡ 자동매매</div>
                  <p className="mt-1 text-[11.5px] leading-relaxed" style={{ color: INK2 }}>신호가 뜰 때마다 자동으로 사고파는 <b style={{ color: 'var(--ci-ink0)' }}>모의 자동매매</b>는 전용 화면에서 시작해요. 손절·익절·실행로그까지 한곳에서 관리합니다.</p>
                </div>
                <button onClick={() => navigate(`/virt/auto-trade?deploy=${strategy.id}`)} className="shrink-0 rounded-lg px-3.5 py-2 text-[12.5px] font-bold text-white" style={{ border: '1px solid rgba(140,190,255,.5)', background: 'linear-gradient(180deg,#4d8aff,#2c6fe6)' }}>자동매매 시작 →</button>
              </div>
            </div>
          </>
        )}
        <div className="mt-5 flex gap-2">
          <button onClick={onClose} disabled={busy} className="flex-1 rounded-lg py-2.5 text-[13.5px] font-semibold" style={{ border: `1px solid ${LINE_S}`, background: 'transparent', color: 'var(--ci-ink0)' }}>닫기</button>
          {strategy.applied && <button onClick={unapply} disabled={busy} className="rounded-lg px-4 py-2.5 text-[13.5px] font-semibold" style={{ border: '1px solid rgba(239,77,77,.4)', background: 'rgba(239,77,77,.1)', color: '#fca5a5' }}>적용 해제</button>}
          {!noAssets && <button onClick={apply} disabled={busy || overCash} className="flex-1 rounded-lg py-2.5 text-[13.5px] font-bold disabled:opacity-50" style={{ background: `linear-gradient(180deg, ${GLOW}, ${ACCENT})`, color: '#fff' }}>{busy ? '적용 중…' : strategy.applied ? '재적용' : '적용하기'}</button>}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed" style={{ color: INK3 }}>* 모의투자(₩) 계좌에 시장가로 매수됩니다. 실제 자금이 아닌 시뮬레이션입니다.</p>
      </div>
    </div>
  );
};

/* 이전 백테스트 결과 목록 (서버 저장) — 선택 시 전체 결과를 조회해 재표시, 삭제 지원 */
const HistoryModal = ({ history, onPick, onDelete, onClose }: { history: BacktestHistoryItem[]; onPick: (id: string) => void; onDelete: (id: string) => void; onClose: () => void }) => (
  <div onClick={onClose} className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto px-6 py-12" style={{ background: 'rgba(6,11,31,.72)', backdropFilter: 'blur(6px)', animation: 'backdrop-in .2s ease' }}>
    <div onClick={e => e.stopPropagation()} className="relative w-full max-w-[560px] rounded-[18px]" style={{ background: 'var(--ci-overlay)', border: `1px solid ${LINE_S}`, boxShadow: 'var(--ci-panel-shadow)', animation: 'modal-in .25s cubic-bezier(.2,.8,.2,1)' }}>
      <div className="wa-force-dark flex items-center justify-between rounded-t-[18px] px-6 py-4 text-white" style={{ background: BT_GRAD }}>
        <h3 className="text-[15px] font-bold">이전 백테스트 결과 <span className="text-white/60">({history.length})</span></h3>
        <button onClick={onClose} aria-label="닫기" className="flex h-8 w-8 items-center justify-center rounded-lg text-[15px]" style={{ border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.08)' }}><span aria-hidden>✕</span></button>
      </div>
      <div className="max-h-[60vh] overflow-y-auto p-2">
        {history.length === 0 ? <div className="px-4 py-10 text-center text-[13px]" style={{ color: INK3 }}>저장된 결과가 없습니다. 백테스트를 실행하면 자동 저장됩니다.</div> :
          history.map(e => { const up = e.totalReturnRate >= 0; return (
            <div key={e.id} className="flex items-center gap-1 rounded-lg pr-2 hover:bg-white/5" style={{ borderBottom: `1px solid ${LINE}` }}>
              <button onClick={() => onPick(e.id)} className="flex min-w-0 flex-1 items-center justify-between px-4 py-3 text-left">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold">{e.strategyName} <span className="font-mono text-[11px]" style={{ color: INK3 }}>{e.stockName || e.stockCode}</span></div>
                  <div className="text-[11px]" style={{ color: INK3 }}>{e.startDate}~{e.endDate} · {new Date(e.createdAt).toLocaleString('ko-KR')}</div>
                </div>
                <span className="ml-3 shrink-0 font-mono text-[13px] font-bold" style={{ color: up ? UP : DOWN }}>{up ? '+' : ''}{e.totalReturnRate.toFixed(2)}%</span>
              </button>
              <button onClick={() => onDelete(e.id)} aria-label="삭제" title="삭제" className="shrink-0 rounded px-2 py-1 text-[14px]" style={{ color: INK3 }}><span aria-hidden>×</span></button>
            </div>
          ); })}
      </div>
    </div>
  </div>
);

const BuilderModal = ({ mode, initial, onClose, onSaved }: { mode: 'create' | 'edit'; initial?: Strategy; onClose: () => void; onSaved: (msg: string) => void }) => {
  const [name, setName] = useState(initial?.name || '');
  const [desc, setDesc] = useState(initial?.description || '');
  const [logic, setLogic] = useState(initial?.strategyLogic || '');
  const [assetType, setAssetType] = useState<Strategy['assetType']>(initial?.assetType || 'CRYPTO');
  const [assets, setAssets] = useState<string[]>(initial?.targetAssets || []);
  const [nameCache, setNameCache] = useState<Record<string, string>>(initial?.targetAssetNames || {});
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ code: string; name: string }[]>([]);
  const [cryptoList, setCryptoList] = useState<{ code: string; name: string }[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>(initial?.indicators || []);
  const [entry, setEntry] = useState<Condition[]>(initial?.entryConditions || []);
  const [exitC, setExitC] = useState<Condition[]>(initial?.exitConditions || []);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = prev; };
  }, [onClose]);

  useEffect(() => { marketService.getPrices('CRYPTO').then(ps => setCryptoList(ps.map(p => ({ code: p.symbol, name: p.name })))).catch(() => {}); }, []);

  useEffect(() => {
    const q = query.trim();
    const cryptoMatch = () => cryptoList.filter(c => c.code.toLowerCase().includes(q.toLowerCase()) || c.name.includes(q));
    if (assetType === 'CRYPTO') { setResults(cryptoMatch().slice(0, 50)); return; }
    if (q.length < 1) { setResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const out: { code: string; name: string }[] = [];
        if (assetType === 'STOCK' || assetType === 'MIXED') (await marketService.searchStocks(q)).forEach(r => out.push({ code: r.code, name: r.name }));
        if (assetType === 'US_STOCK' || assetType === 'MIXED') (await marketService.searchUsStocks(q)).forEach(r => out.push({ code: r.code, name: r.name }));
        if (assetType === 'MIXED') cryptoMatch().forEach(c => out.push(c));
        setResults(out.slice(0, 50));
      } catch { setResults([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [query, assetType, cryptoList]);

  const assetName = (code: string) => nameCache[code] || cryptoList.find(c => c.code === code)?.name || code;
  const addAsset = (code: string, nm: string) => { if (!assets.includes(code)) { setAssets([...assets, code]); setNameCache(c => ({ ...c, [code]: nm })); } setQuery(''); setResults([]); };
  const removeAsset = (code: string) => setAssets(assets.filter(a => a !== code));

  const addIndicator = (type: string) => {
    if (!type || indicators.some(i => i.type === type)) return;
    const def = INDICATOR_CATALOG.find(i => i.type === type);
    setIndicators([...indicators, { type: type as Indicator['type'], parameters: { ...(def?.params || {}) } }]);
  };
  const updIndParam = (idx: number, key: string, val: number) => { const u = [...indicators]; u[idx] = { ...u[idx], parameters: { ...u[idx].parameters, [key]: val } }; setIndicators(u); };
  const removeIndicator = (idx: number) => setIndicators(indicators.filter((_, i) => i !== idx));

  const applyPreset = (kind: 'rsi' | 'macd') => {
    if (kind === 'rsi') { setIndicators([{ type: 'RSI', parameters: { period: 14 } }]); setEntry([{ indicator: 'RSI', operator: 'LT', value: 30, logic: 'AND' }]); setExitC([{ indicator: 'RSI', operator: 'GT', value: 70, logic: 'AND' }]); }
    else { setIndicators([{ type: 'MACD', parameters: { fast: 12, slow: 26, signal: 9 } }]); setEntry([{ indicator: 'MACD_HISTOGRAM', operator: 'GT', value: 0, logic: 'AND' }]); setExitC([{ indicator: 'MACD_HISTOGRAM', operator: 'LT', value: 0, logic: 'AND' }]); }
  };

  const canSave = name.trim().length > 0 && assets.length > 0;
  const empty = indicators.length === 0 && entry.length === 0 && exitC.length === 0;
  const seg = (on: boolean): React.CSSProperties => ({ border: on ? '1px solid rgba(91,157,255,.32)' : `1px solid ${LINE}`, background: on ? 'rgba(91,157,255,.14)' : 'var(--ci-card)', color: on ? GLOW : INK1 });

  const save = async () => {
    if (!name.trim()) { setErr('항로 이름을 입력해주세요.'); return; }
    if (assets.length === 0) { setErr('투자 대상 자산을 1개 이상 선택해주세요.'); return; }
    const targetAssetNames: Record<string, string> = {};
    assets.forEach(code => { const nm = assetName(code); if (nm !== code) targetAssetNames[code] = nm; });
    const payload = { name: name.trim(), description: desc, indicators, entryConditions: entry, exitConditions: exitC, targetAssets: assets, targetAssetNames, assetType, strategyLogic: logic };
    setSaving(true); setErr(null);
    try {
      if (mode === 'edit' && initial) await strategyService.updateStrategy(initial.id, payload);
      else await strategyService.createStrategy(payload);
      onSaved(mode === 'edit' ? '항로가 수정되었습니다.' : '항로가 생성되었습니다.');
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.response?.data?.error || '저장에 실패했습니다.');
    } finally { setSaving(false); }
  };

  return (
    <div onClick={onClose} className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto px-6 py-10" style={{ background: 'rgba(6,11,31,.72)', backdropFilter: 'blur(6px)', animation: 'backdrop-in .2s ease' }}>
      <div onClick={e => e.stopPropagation()} className="relative w-full max-w-[760px] rounded-[18px]" style={{ background: 'var(--ci-overlay)', border: `1px solid ${LINE_S}`, boxShadow: 'var(--ci-panel-shadow)', animation: 'modal-in .25s cubic-bezier(.2,.8,.2,1)' }}>
        <div className="wa-force-dark flex items-center justify-between rounded-t-[18px] px-6 py-4 text-white" style={{ background: BT_GRAD, borderBottom: '1px solid rgba(255,255,255,.14)' }}>
          <div><h3 className="text-[16px] font-bold">{mode === 'edit' ? '항로 수정' : '새 항로 만들기'}</h3><p className="text-[12px] text-white/70">나만의 매매 조건으로 항로를 설계하세요.</p></div>
          <button onClick={onClose} title="닫기" className="flex h-8 w-8 items-center justify-center rounded-lg text-[15px]" style={{ border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.08)' }}>✕</button>
        </div>
        <div className="flex flex-col gap-5 p-6">
          <section className="flex flex-col gap-2.5">
            <SectionNum n={1} title="기본 정보" active />
            <input value={name} onChange={e => setName(e.target.value)} placeholder="항로 이름 (예: BTC+ETH 균등 투자)" className="w-full rounded-lg px-3 py-2.5 text-[14px] outline-none" style={fieldStyle} />
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} placeholder="설명 (선택)" className="w-full resize-none rounded-lg px-3 py-2.5 text-[13px] outline-none" style={fieldStyle} />
            <textarea value={logic} onChange={e => setLogic(e.target.value)} rows={2} placeholder="항로 로직 (예: 균등 분배 매수 후 장기 보유, RSI 30 이하 추가매수)" className="w-full resize-none rounded-lg px-3 py-2.5 text-[13px] outline-none" style={fieldStyle} />
          </section>
          <section className="flex flex-col gap-2.5">
            <SectionNum n={2} title="자산 유형" active />
            <div className="grid grid-cols-4 gap-2">
              {ASSET_TYPES.map(([v, l]) => <button key={v} onClick={() => { setAssetType(v); setAssets([]); setResults([]); setQuery(''); }} className="rounded-lg py-2.5 text-[13px] font-semibold" style={seg(assetType === v)}>{l}</button>)}
            </div>
          </section>
          <section className="flex flex-col gap-2.5">
            <SectionNum n={3} title="투자 대상 자산" sub={`${assets.length}개 선택됨`} active={assets.length > 0} />
            {assets.length > 0 && <div className="flex flex-wrap gap-1.5">
              {assets.map(code => <span key={code} className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-semibold" style={{ background: 'rgba(91,157,255,.12)', color: GLOW }}>{assetName(code)}<button onClick={() => removeAsset(code)} aria-label={`${assetName(code)} 제거`} className="ml-0.5 text-[13px]"><span aria-hidden>×</span></button></span>)}
            </div>}
            <input value={query} onChange={e => setQuery(e.target.value)} aria-label="종목 검색" placeholder={assetType === 'CRYPTO' ? '코인 검색 (예: BTC, 이더리움)' : '종목 검색 (예: 삼성, AAPL)'} className="w-full rounded-lg px-3 py-2.5 text-[13px] outline-none" style={fieldStyle} />
            {results.length > 0 && <div className="no-scrollbar flex max-h-[170px] flex-col gap-0.5 overflow-y-auto rounded-lg p-1" style={{ border: `1px solid ${LINE}`, background: 'var(--ci-card)' }}>
              {results.filter(r => !assets.includes(r.code)).map(r => <button key={r.code} onClick={() => addAsset(r.code, r.name)} className="flex items-center justify-between rounded px-2.5 py-1.5 text-left text-[12.5px] hover:bg-white/5"><span className="font-semibold">{r.name}</span><span style={{ color: INK3 }}>{r.code}</span></button>)}
            </div>}
          </section>
          <section className="flex flex-col gap-3">
            <SectionNum n={4} title="매매 조건" sub="백테스팅에 사용" active={!empty} />
            <div>
              <div className="flex items-center justify-between">
                <Label>사용 지표</Label>
                <select value="" onChange={e => addIndicator(e.target.value)} className="rounded-md px-2 py-1 text-[12px] outline-none" style={fieldStyle}>
                  <option value="">+ 지표 추가</option>
                  {INDICATOR_CATALOG.filter(i => !indicators.some(x => x.type === i.type)).map(i => <option key={i.type} value={i.type}>{i.label}</option>)}
                </select>
              </div>
              <div className="mt-2 flex flex-col gap-1.5">
                {indicators.length === 0 && <div className="text-[11.5px]" style={{ color: INK3 }}>지표를 추가하면 매매 조건에서 활용할 수 있어요.</div>}
                {indicators.map((ind, idx) => {
                  const meta = INDICATOR_CATALOG.find(i => i.type === ind.type);
                  return (
                    <div key={idx} className="flex flex-wrap items-center gap-2 rounded-lg px-2.5 py-2" style={{ background: 'var(--ci-card)', border: `1px solid ${LINE}` }}>
                      <span className="text-[12.5px] font-bold" style={{ color: GLOW }}>{meta?.label || ind.type}</span>
                      {Object.entries(ind.parameters).map(([k, v]) => <span key={k} className="flex items-center gap-1 text-[11px]" style={{ color: INK2 }}>{PARAM_LABEL[k] || k}<input type="number" value={v} onChange={e => updIndParam(idx, k, Number(e.target.value))} className="w-14 rounded px-1.5 py-1 text-right text-[12px] outline-none" style={fieldStyle} /></span>)}
                      <button onClick={() => removeIndicator(idx)} title="제거" className="ml-auto text-[15px] hover:opacity-80" style={{ color: INK3 }}>×</button>
                    </div>
                  );
                })}
              </div>
            </div>
            <ConditionEditor title="매수 조건 (진입)" accent={UP} conds={entry} setConds={setEntry} addDefault={{ indicator: 'RSI', operator: 'LT', value: 30, logic: 'AND' }} />
            <ConditionEditor title="매도 조건 (청산)" accent={DOWN} conds={exitC} setConds={setExitC} addDefault={{ indicator: 'RSI', operator: 'GT', value: 70, logic: 'AND' }} />
            {empty && <div className="flex flex-col gap-1.5">
              <Label>빠른 설정 (프리셋)</Label>
              <div className="flex gap-2">
                <button onClick={() => applyPreset('rsi')} className="flex-1 rounded-lg py-2 text-[12px] font-semibold" style={{ border: `1px solid ${LINE}`, background: 'var(--ci-card)', color: INK1 }}>RSI 과매수/과매도</button>
                <button onClick={() => applyPreset('macd')} className="flex-1 rounded-lg py-2 text-[12px] font-semibold" style={{ border: `1px solid ${LINE}`, background: 'var(--ci-card)', color: INK1 }}>MACD 골든/데드크로스</button>
              </div>
            </div>}
          </section>
          {err && <div className="rounded-lg px-3 py-2 text-[12.5px]" style={{ background: 'rgba(239,77,77,.1)', border: '1px solid rgba(239,77,77,.25)', color: '#fca5a5' }}>{err}</div>}
        </div>
        <div className="flex items-center gap-3 px-6 py-4" style={{ borderTop: `1px solid ${LINE}` }}>
          <button onClick={onClose} className="rounded-lg px-4 py-2.5 text-[13px] font-semibold" style={{ border: `1px solid ${LINE}`, background: 'var(--ci-card)', color: INK1 }}>취소</button>
          <button onClick={save} disabled={!canSave || saving} className="flex-1 rounded-lg py-2.5 text-[14px] font-bold text-white disabled:cursor-not-allowed" style={canSave && !saving ? { background: `linear-gradient(180deg, ${GLOW}, ${ACCENT})`, boxShadow: '0 10px 24px -10px rgba(60,120,255,.5)' } : { background: 'var(--ci-card)', color: INK3 }}>
            {saving ? '저장 중…' : `${mode === 'edit' ? '항로 수정하기' : '항로 생성하기'} (${assets.length}개 자산)`}
          </button>
        </div>
      </div>
    </div>
  );
};

const ConsoleStrategyPage = () => {
  const { session } = useAuth();
  const { isVirt } = useRoutePrefix();
  const userName = session?.user?.email ? session.user.email.split('@')[0] : '항해사';
  const [activeId, setActiveId] = useState<string | null>(null);
  const [target, setTarget] = useState<{ symbol: string; name: string; assetType: string }>({ symbol: 'BTC', name: '비트코인', assetType: 'CRYPTO' });
  const [period, setPeriod] = useState('1Y');
  const [capital, setCapital] = useState(10_000_000);
  const [monthly, setMonthly] = useState(0);
  // 고급 백테스트 옵션 (리스크·비용·방향·배당·커스텀 기간) + 2자산 리밸런싱
  const [adv, setAdv] = useState<AdvOpts>(ADV_DEFAULTS);
  const [turtle, setTurtle] = useState<TurtleParams>(TURTLE_DEFAULTS); // 터틀 전용 설정(채널 기간·ADX·유닛·레버리지)
  const [second, setSecond] = useState<Target | null>(null);
  const [firstWeight, setFirstWeight] = useState(50);
  const [rebalanceFreq, setRebalanceFreq] = useState<RebalFreq>('MONTHLY');
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<BacktestHistoryItem[]>([]);
  const [userStrats, setUserStrats] = useState<Strategy[]>([]);
  const [builder, setBuilder] = useState<{ mode: 'create' | 'edit'; strategy?: Strategy } | null>(null);
  const [applyFor, setApplyFor] = useState<Strategy | null>(null);
  const [cash, setCash] = useState<number | null>(null);
  const [tour, setTour] = useState(false);
  useEffect(() => {
    if (import.meta.env.DEV && window.location.pathname.startsWith('/preview')) return;
    try { if (localStorage.getItem('whalearc_strategy_tour') !== 'done') setTour(true); } catch { /* ignore */ }
  }, []);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const toastTimer = useRef<number | null>(null);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);
  const runIdRef = useRef(0); // 백테스트 취소 가드 — 취소되면 진행 중 결과를 무시
  const allStrats = useMemo<Strat[]>(() => [...STRATEGIES, ...userStrats.map(toStrat)], [userStrats]);
  const strat = allStrats.find(s => s.id === activeId) || null;
  // 고급 설정: 선택 전략의 지표/조건 편집 상태 (프리셋 또는 사용자 전략에서 로드)
  const [editInd, setEditInd] = useState<Indicator[]>([]);
  const [editEntry, setEditEntry] = useState<Condition[]>([]);
  const [editExit, setEditExit] = useState<Condition[]>([]);
  const [editForId, setEditForId] = useState<string | null>(null);
  // 활성 전략의 '정의 시그니처' — 다른 전략 선택 또는 (이 전략의) 정의 변경 시에만 바뀜.
  // 무관한 userStrats 갱신(타 전략 삭제·생성 등)엔 시그니처가 그대로라 편집값을 보존한다.
  const activeDefSig = useMemo(() => {
    const preset = activeId ? PRESET_DEFS[activeId] : null;
    const us = activeId ? userStrats.find(s => s.id === activeId) : null;
    const d = preset || (us ? { indicators: us.indicators, entryConditions: us.entryConditions, exitConditions: us.exitConditions } : null);
    return JSON.stringify({ id: activeId, d });
  }, [activeId, userStrats]);
  useEffect(() => {
    const preset = activeId ? PRESET_DEFS[activeId] : null;
    const us = activeId ? userStrats.find(s => s.id === activeId) : null;
    const d = preset || (us ? { indicators: us.indicators, entryConditions: us.entryConditions, exitConditions: us.exitConditions } : null);
    setEditInd((d?.indicators || []).map(i => ({ ...i, parameters: { ...i.parameters } })));
    setEditEntry((d?.entryConditions || []).map(c => ({ ...c })));
    setEditExit((d?.exitConditions || []).map(c => ({ ...c })));
    setEditForId(activeId);
    // 의존성은 시그니처만 — activeId/userStrats 직접 의존하면 무관한 갱신에도 편집이 초기화됨
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDefSig]);
  // 선택 전략의 종목 바로가기 (사용자 전략의 targetAssets)
  const stratAssets = useMemo(() => {
    const us = activeId ? userStrats.find(s => s.id === activeId) : null;
    if (!us?.targetAssets?.length) return [] as { symbol: string; name: string; assetType: string }[];
    return us.targetAssets.slice(0, 6).map(code => ({ symbol: code, name: us.targetAssetNames?.[code] || code, assetType: us.assetType === 'MIXED' ? (/^\d{6}$/.test(code) ? 'STOCK' : 'CRYPTO') : us.assetType }));
  }, [activeId, userStrats]);

  const refreshHistory = () => {
    if (import.meta.env.DEV && window.location.pathname.startsWith('/preview')) return;
    strategyService.getBacktestHistory().then(setHistory).catch(() => {});
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { refreshHistory(); }, []);
  useEffect(() => {
    if (import.meta.env.DEV && window.location.pathname.startsWith('/preview')) return; // 프리뷰(비로그인) 401 방지
    strategyService.getStrategies().then(setUserStrats).catch(() => {});
    tradeService.getPortfolio().then(p => setCash(p.cashBalance)).catch(() => {});
  }, []);
  // 커뮤니티 "항로 따라가기" 딥링크(?strategy=id) — 복사된 항로가 로드되면 자동 선택
  const deepSelectRef = useRef(false);
  useEffect(() => {
    if (deepSelectRef.current) return;
    const sid = new URLSearchParams(window.location.search).get('strategy');
    if (!sid) { deepSelectRef.current = true; return; }
    if (allStrats.some(s => s.id === sid)) { setActiveId(sid); setResult(null); deepSelectRef.current = true; }
  }, [allStrats]);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3000);
  };
  const refreshUserStrats = () => { strategyService.getStrategies().then(setUserStrats).catch(() => {}); };
  const refreshCash = () => { tradeService.getPortfolio().then(p => setCash(p.cashBalance)).catch(() => {}); };
  const handleDeleteUser = async (id: string) => {
    const st = userStrats.find(s => s.id === id); if (!st) return;
    const msg = st.applied
      ? '이 항로는 이미 포트폴리오에 적용되어 매수가 완료된 상태입니다.\n항로를 삭제해도 이미 매수된 자산은 유지됩니다.\n정말 삭제하시겠습니까?'
      : '정말 이 항로를 삭제하시겠습니까?';
    if (!window.confirm(msg)) return;
    try {
      await strategyService.deleteStrategy(id);
      refreshUserStrats();
      if (activeId === id) { setActiveId(null); setResult(null); }
      showToast('항로가 삭제되었습니다.');
    } catch { showToast('항로 삭제에 실패했습니다.', 'error'); }
  };

  const run = async (id: string | null = activeId) => {
    const s = allStrats.find(x => x.id === id);
    if (!s) { setError('전략을 선택해주세요.'); return; }
    const isTurtle = s.id === TURTLE_PRESET_ID;
    // 터틀은 설정 패널 파라미터로 지표·조건을 즉석 생성(채널 기간·ADX·유닛·레버리지·트레일링 반영)
    const preset = isTurtle
      ? { ...PRESET_DEFS[s.id], ...buildTurtleConditions(turtle), maxPositions: turtle.maxUnits, leverage: turtle.leverage,
          trailingStopPercent: turtle.trailingStopPercent, tradeDirection: 'LONG_SHORT_FLAT' as const, pyramidMode: 'ATR' as const }
      : PRESET_DEFS[s.id];
    const us = userStrats.find(x => x.id === s.id);
    const useEdit = !isTurtle && s.id === editForId; // 터틀은 동적 생성 조건을 쓰므로 수동 편집값 무시
    if (!(capital > 0)) { setError('초기 투자금은 0보다 커야 합니다.'); return; }
    if (adv.dateMode === 'custom') {
      if (!adv.customStart || !adv.customEnd) { setError('직접지정 기간의 시작일과 종료일을 모두 선택해주세요.'); return; }
      if (adv.customStart >= adv.customEnd) { setError('시작일은 종료일보다 앞서야 합니다.'); return; }
    }
    const { startDate, endDate } = adv.dateMode === 'custom'
      ? { startDate: adv.customStart, endDate: adv.customEnd } : periodDates(period);
    const rebalActive = !!(second && second.symbol !== target.symbol); // 2자산 모드: 백엔드가 손절/익절/트레일링·매매방향·maxPositions 미지원
    const req: BacktestRequest = {
      stockCode: target.symbol, stockName: target.name, startDate, endDate, initialCapital: capital, assetType: target.assetType,
      strategyName: s.name, // 서버 저장 히스토리에 올바른 전략명 보관(직접조건 경로에서 "종목 분석"으로 저장되던 문제 수정)
      indicators: useEdit ? editInd : (preset?.indicators || us?.indicators || []),
      entryConditions: useEdit ? editEntry : (preset?.entryConditions || us?.entryConditions || []),
      exitConditions: useEdit ? editExit : (preset?.exitConditions || us?.exitConditions || []),
    };
    if (monthly > 0) req.monthlyContribution = monthly;
    // 리스크·비용 (빈 칸은 미적용)
    const pct = (v: string) => { const n = parseFloat(v); return Number.isFinite(n) ? n : undefined; };
    if (pct(adv.slippage) != null) req.slippagePercent = pct(adv.slippage);
    if (pct(adv.commission) != null) req.commissionRate = pct(adv.commission);
    // 손절/익절/트레일링: 단일·2자산 모두 백엔드 지원
    if (pct(adv.stopLoss) != null) req.stopLossPercent = pct(adv.stopLoss);
    if (pct(adv.takeProfit) != null) req.takeProfitPercent = pct(adv.takeProfit);
    if (pct(adv.trailingStop) != null) req.trailingStopPercent = pct(adv.trailingStop);
    else if (preset?.trailingStopPercent) req.trailingStopPercent = preset.trailingStopPercent;
    // 매매방향(숏)·분할매수·포지션 사이징·레버리지는 단일 종목 모드 전용 (2자산은 롱 배분 전략)
    if (!rebalActive) {
      // 매매 방향: 사용자가 고급설정에서 바꿨으면 우선, 아니면 프리셋 권장값(터틀=LONG_SHORT_FLAT)
      const dir = adv.tradeDirection !== 'LONG_ONLY' ? adv.tradeDirection : preset?.tradeDirection;
      if (dir && dir !== 'LONG_ONLY') req.tradeDirection = dir;
      if (adv.maxPositions !== 'auto') req.maxPositions = Number(adv.maxPositions);
      else if (preset?.maxPositions) req.maxPositions = preset.maxPositions;
      if (adv.positionSizing !== 'ALL_IN') {
        req.positionSizing = adv.positionSizing;
        const pv = parseFloat(adv.positionValue);
        if (Number.isFinite(pv) && pv > 0) req.positionValue = pv;
      }
      // 레버리지: 사용자 입력 우선, 없으면 프리셋 권장값(터틀=2)
      const advLev = parseInt(adv.leverage, 10);
      if (Number.isFinite(advLev) && advLev > 1) req.leverage = advLev;
      else if (preset?.leverage && preset.leverage > 1) req.leverage = preset.leverage;
      // 독립 양방향(LONG_SHORT_FLAT)이면 숏 조건 + 피라미딩 트리거 전달
      if (req.tradeDirection === 'LONG_SHORT_FLAT') {
        if (preset?.shortEntryConditions) req.shortEntryConditions = preset.shortEntryConditions;
        if (preset?.shortExitConditions) req.shortExitConditions = preset.shortExitConditions;
      }
      if (preset?.pyramidMode) req.pyramidMode = preset.pyramidMode;
    }
    // 배당 재투자: 기본/2번째 자산이 미국주식·ETF이고 OFF로 끈 경우에만 false 전송 (기본 ON)
    const hasUsEtf = [target, ...(second ? [second] : [])].some(a => a.assetType === 'US_STOCK' || a.assetType === 'ETF');
    if (hasUsEtf && !adv.dividendReinvest) req.dividendReinvest = false;
    // 2자산 리밸런싱: 두 번째 자산이 지정됐고 기본 종목과 다를 때만 활성
    if (rebalActive && second) {
      req.secondStockCode = second.symbol; req.secondStockName = second.name; req.secondAssetType = second.assetType;
      req.firstAssetWeight = firstWeight; req.rebalanceFrequency = rebalanceFreq;
    }
    const myRun = ++runIdRef.current;
    setRunning(true); setError(null); setResult(null);
    try {
      const r = await strategyService.runBacktest(req);
      if (runIdRef.current !== myRun) return; // 취소됨 → 결과 무시
      r.strategyName = s.name; // explicit 조건 경로에선 백엔드가 "종목 분석"으로 덮어쓰므로 선택 전략명으로 보정 (결과 표시 + 이전결과 재선택)
      setResult(r);
      refreshHistory(); // 서버가 결과를 자동 저장 → 목록 갱신
    } catch (e: any) {
      if (runIdRef.current !== myRun) return; // 취소됨 → 에러 무시
      const status = e?.response?.status;
      const raw = e?.response?.data?.message || e?.message || '';
      const msg = status === 429 ? '요청이 너무 많습니다. 잠시 후 다시 시도해주세요. (분당 5회 제한)'
        : /캔들스틱|데이터를 가져올 수 없|찾을 수 없/.test(raw) ? '해당 종목의 시세 데이터를 가져올 수 없습니다. 종목/자산유형을 확인해주세요.'
        : /충분한 데이터|데이터가 없/.test(raw) ? '선택한 기간에 데이터가 부족합니다. 기간을 늘리거나 상장 이후 구간으로 조정해주세요.'
        : raw || '백테스트 실행에 실패했습니다.';
      setError(msg);
    } finally {
      if (runIdRef.current === myRun) setRunning(false);
    }
  };

  const onExport = () => { if (result) exportBacktestCsv(result); };
  const [histOpen, setHistOpen] = useState(false);
  const pickHistory = async (id: string) => {
    try {
      const r = await strategyService.getSavedBacktest(id);
      setResult(r); const s = allStrats.find(x => x.name === r.strategyName); setActiveId(s ? s.id : null); setError(null); setHistOpen(false);
    } catch { setError('저장된 결과를 불러오지 못했습니다.'); }
  };
  const deleteHistory = async (id: string) => {
    try { await strategyService.deleteSavedBacktest(id); refreshHistory(); } catch { /* ignore */ }
  };

  return (
    <HelmShell active="strategy" virt={isVirt} userName={userName} session="전략 백테스트">
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {isVirt ? <FunnelSteps current={2} /> : <span />}
          <button onClick={() => setTour(true)} className="inline-flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-[13px] font-bold" style={{ border: '1px solid rgba(91,157,255,.4)', background: 'rgba(91,157,255,.14)', color: GLOW }} title="사용법 가이드 투어 다시 보기"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10" /><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .8-1 1.7" strokeLinecap="round" /><circle cx="12" cy="17" r=".6" fill="currentColor" /></svg>가이드 투어 다시 보기</button>
        </div>
        {error && <div className="rounded-xl px-4 py-3 text-[13px]" style={{ background: 'rgba(239,77,77,.1)', border: '1px solid rgba(239,77,77,.25)', color: '#fca5a5' }}>{error}</div>}
        <div className="grid items-start gap-5 grid-cols-1 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)_minmax(0,320px)]">
          <div data-tour="library" className="min-w-0">
          <StrategyLibrary strats={allStrats} activeId={activeId} onPick={(id) => { setActiveId(id); setResult(null); setError(null); }}
            onCreate={() => setBuilder({ mode: 'create' })}
            onEditUser={(id) => { const st = userStrats.find(s => s.id === id); if (st) setBuilder({ mode: 'edit', strategy: st }); }}
            onDeleteUser={handleDeleteUser}
            onApply={(id) => { const st = userStrats.find(s => s.id === id); if (st) setApplyFor(st); }} />
          </div>
          <div className="min-w-0" data-tour="result">
            {running ? <RunningView onCancel={() => { runIdRef.current++; setRunning(false); }} />
              : result ? <ResultView result={result} strat={strat} onExport={onExport} />
                : strat ? <StrategyGuidePanel strat={strat} userStrat={userStrats.find(s => s.id === strat.id)} onApply={() => { const st = userStrats.find(s => s.id === strat.id); if (st) setApplyFor(st); }} onCreate={() => setBuilder({ mode: 'create' })} />
                  : <EmptyHero running={running} total={allStrats.length} userCount={userStrats.length} onGuide={() => { setActiveId('preset-golden-cross'); setTarget({ symbol: 'BTC', name: '비트코인', assetType: 'CRYPTO' }); run('preset-golden-cross'); }} />}
          </div>
          <div data-tour="runner" className="min-w-0">
          <BacktestRunner strat={strat} target={target} setTarget={setTarget} period={period} setPeriod={setPeriod} capital={capital} setCapital={setCapital} monthly={monthly} setMonthly={setMonthly} editInd={editInd} setEditInd={setEditInd} editEntry={editEntry} setEditEntry={setEditEntry} editExit={editExit} setEditExit={setEditExit} adv={adv} setAdv={setAdv} turtle={turtle} setTurtle={setTurtle} second={second} setSecond={setSecond} firstWeight={firstWeight} setFirstWeight={setFirstWeight} rebalanceFreq={rebalanceFreq} setRebalanceFreq={setRebalanceFreq} stratAssets={stratAssets} onRun={() => run()} running={running} historyCount={history.length} onShowHistory={() => setHistOpen(true)} />
          </div>
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-3.5 pt-6" style={{ borderTop: `1px solid ${LINE}` }}>
          <span className="font-mono text-[12px]" style={{ color: INK3 }}>© 2026 WhaleArc · 모든 항해는 사용자의 책임 아래 진행됩니다.</span>
          <div className="flex gap-[18px] text-[12.5px]" style={{ color: INK2 }}><a>도움말</a><a>상태</a><a>API</a><a>의견 보내기</a></div>
        </footer>
      </div>
      {builder && <BuilderModal key={`${builder.mode}:${builder.strategy?.id ?? 'new'}`} mode={builder.mode} initial={builder.strategy} onClose={() => setBuilder(null)} onSaved={(msg) => { setBuilder(null); refreshUserStrats(); showToast(msg); }} />}
      {applyFor && <ApplyModal strategy={applyFor} cash={cash} onClose={() => setApplyFor(null)} onDone={(msg, type) => { showToast(msg, type); if (type === 'success') { setApplyFor(null); refreshUserStrats(); refreshCash(); } }} />}
      <GuideTour steps={STRAT_TOUR} isActive={tour} onFinish={() => { setTour(false); try { localStorage.setItem('whalearc_strategy_tour', 'done'); } catch { /* ignore */ } }} />
      {histOpen && <HistoryModal history={history} onPick={pickHistory} onDelete={deleteHistory} onClose={() => setHistOpen(false)} />}
      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </HelmShell>
  );
};

export default ConsoleStrategyPage;
