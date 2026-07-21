import { useMemo, useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRoutePrefix, useVirtNavigate } from '../hooks/useRoutePrefix';
import { effectiveTier, tierMeetsMin, tierLabel, type UserTier } from '../services/userService';
import HelmShell from '../components/HelmShell';
import {
  strategyService, exportBacktestCsv,
  type BacktestRequest, type BacktestResult, type Indicator, type Condition, type BacktestHistoryItem, type Strategy,
} from '../services/strategyService';
import { formatAmountInput, parseAmountInput } from '../utils/currency';
import { PRESET_STRATEGIES, type PresetStrategy, TURTLE_PRESET_ID, TURTLE_DEFAULTS, buildTurtleConditions, type TurtleParams, MOMENTUM_PRESET_ID, MOMENTUM_DEFAULTS, type MomentumParams } from '../data/presetStrategies';
import { tradeService } from '../services/tradeService';
import { Term } from '../components/GlossaryTerm';
import GuideTour, { type TourStep } from '../components/GuideTour';
import FunnelSteps from '../components/FunnelSteps';
import StrategyLearnDrawer from '../components/strategy/StrategyLearnDrawer';
import { getErrorMessage } from '../utils/api';
import { UP, DOWN, COMPASS, SONAR as GLOW, INK1, INK2, INK3, LINE, LINE_STRONG as LINE_S, mkCard } from '../components/console/format';
import { Toast, ConsoleFooter } from '../components/console/ui';
import { useModalChrome } from '../hooks/useModalChrome';
import { ACCENT, BT_GRAD, fmtNum, periodDates, PRESET_DEFS, ADV_DEFAULTS, type Strat, type Target, type AdvOpts, type RebalFreq, type RebalAsset } from '../components/strategy/shared';
import { StationBar, Label } from '../components/strategy/ui';
import ResultView from '../components/strategy/ResultView';
import BacktestRunner from '../components/strategy/BacktestRunner';
import BuilderModal from '../components/strategy/BuilderModal';

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
  minTier: s.minTier,
});
// 난이도순으로 정렬해 라이브러리에서 초급→중급→고급으로 묶여 보이게 한다(같은 레벨 내 기존 순서 유지=안정 정렬).
const LEVEL_ORDER: Record<Strat['level'], number> = { beginner: 0, intermediate: 1, advanced: 2 };
const STRATEGIES: Strat[] = PRESET_STRATEGIES.map(presetToStrat).sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);

/* 프리셋 전략별 초보 교육(beginnerTip/whyUse/strategyLogic) — presetStrategies.ts에서 파생 */
const PRESET_EDU: Record<string, { tip?: string; why?: string; logic?: string }> = Object.fromEntries(
  PRESET_STRATEGIES.map(s => [s.id, { tip: s.beginnerTip, why: s.whyUse, logic: s.strategyLogic }]),
);
/* 프리셋별 시각화 차트(캔버스 애니메이션) — 지연 로딩으로 번들 분리.
   import 실패 시 에러바운더리로 번지지 않도록 폴백 컴포넌트로 강등(graceful). */
const ChartFallback = () => <div className="flex flex-col items-center justify-center gap-1 text-center text-[14px]" style={{ color: INK3, height: 200 }}><span>차트를 불러올 수 없습니다.</span><span className="text-[13px]">오른쪽 패널에서 백테스트를 바로 실행해보세요.</span></div>;
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
  // 공용 엔진(StrategyDemoChart) 기반 데모 — 기존에 시각화가 없던 8종
  'preset-buy-hold': lazyChart(() => import('../components/strategyDemos').then(m => ({ default: m.BuyHoldChart }))),
  'preset-triple-ema': lazyChart(() => import('../components/strategyDemos').then(m => ({ default: m.TripleEmaChart }))),
  'preset-keltner-breakout': lazyChart(() => import('../components/strategyDemos').then(m => ({ default: m.KeltnerChart }))),
  'preset-bollinger-reversion': lazyChart(() => import('../components/strategyDemos').then(m => ({ default: m.BollingerPctBChart }))),
  'preset-oscillator-confluence': lazyChart(() => import('../components/strategyDemos').then(m => ({ default: m.OscillatorConfluenceChart }))),
  'preset-macd-rsi-gate': lazyChart(() => import('../components/strategyDemos').then(m => ({ default: m.MacdRsiGateChart }))),
  'preset-turtle': lazyChart(() => import('../components/strategyDemos').then(m => ({ default: m.TurtleChart }))),
  'preset-momentum-top5': lazyChart(() => import('../components/strategyDemos').then(m => ({ default: m.MomentumRotationChart }))),
};


const LEVEL_META: Record<string, { label: string; color: string; bg: string }> = {
  beginner: { label: '초급', color: UP, bg: 'rgba(239,77,77,.12)' },
  intermediate: { label: '중급', color: COMPASS, bg: 'rgba(255,205,120,.12)' },
  advanced: { label: '고급', color: DOWN, bg: 'rgba(77,138,255,.12)' },
};
const FILTERS = [['all', '전체'], ['trend', '추세추종'], ['reversal', '역추세'], ['volatility', '변동성']];


const Glyph = ({ kind }: { kind: string }) => {
  const c = { width: 18, height: 18, viewBox: '0 0 22 22', fill: 'none', stroke: GLOW, strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (kind === 'trend') return <svg {...c}><path d="M3 14l5-5 4 3 7-8" /><circle cx="8" cy="9" r="1" fill={GLOW} stroke="none" /></svg>;
  if (kind === 'reversal') return <svg {...c}><path d="M3 11c3-5 6 5 9 0s6-5 9 0" /></svg>;
  if (kind === 'volatility') return <svg {...c}><path d="M3 16l4-2 4 3 4-9 4 5" /></svg>;
  return <svg {...c}><path d="M3 11h16" /></svg>;
};
const catGlyph = (cat: string) => cat === 'trend' ? 'trend' : cat === 'reversal' ? 'reversal' : cat === 'volatility' ? 'volatility' : 'flat';

const StrategyLibrary = ({ strats, activeId, onPick, onCreate, onEditUser, onDeleteUser, onApply, effTier, canUseCustomBuilder, onLocked }: { strats: Strat[]; activeId: string | null; onPick: (id: string) => void; onCreate: () => void; onEditUser: (id: string) => void; onDeleteUser: (id: string) => void; onApply: (id: string) => void; effTier: UserTier; canUseCustomBuilder: boolean; onLocked: (minTier: UserTier) => void }) => {
  const [filter, setFilter] = useState('all');
  const hasUser = strats.some(s => s.isUser);
  const filters = hasUser ? [...FILTERS, ['custom', '내 전략']] : FILTERS;
  const list = strats.filter(s => filter === 'all' || s.cat === filter);
  return (
    <aside style={{ ...mkCard, padding: 0, display: 'flex', flexDirection: 'column' }}>
      <div className="wa-force-dark px-[18px] py-4 text-white" style={{ background: BT_GRAD, borderBottom: '1px solid rgba(255,255,255,.14)' }}>
        <h3 className="text-[17.5px] font-bold">전략 라이브러리</h3>
        <p className="mt-0.5 text-[13.5px] text-white/70">전략을 선택하고 백테스트로 검증하세요.</p>
      </div>
      <div className="flex flex-wrap gap-1.5 p-3" style={{ borderBottom: `1px solid ${LINE}` }}>
        {filters.map(([k, l]) => <button key={k} onClick={() => setFilter(k)} className="rounded-md px-2.5 py-1.5 text-[13px] font-semibold" style={{ background: filter === k ? 'rgba(91,157,255,.18)' : 'transparent', color: filter === k ? GLOW : INK1 }}>{l}</button>)}
      </div>
      <div className="no-scrollbar flex flex-col gap-2 overflow-y-auto p-3" style={{ maxHeight: 620 }}>
        {list.map(s => {
          const on = s.id === activeId, lv = LEVEL_META[s.level];
          const locked = !s.isUser && !tierMeetsMin(effTier, s.minTier);
          const pick = () => locked ? onLocked(s.minTier ?? 'BASIC') : onPick(s.id);
          return (
            <div key={s.id} role="button" tabIndex={0} onClick={pick} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } }} className="shrink-0 cursor-pointer rounded-xl p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-[rgba(91,157,255,.5)]" style={{ background: on ? 'rgba(91,157,255,.10)' : 'transparent', border: on ? '1px solid rgba(91,157,255,.32)' : '1px solid transparent', opacity: locked ? 0.62 : 1 }}>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: 'rgba(91,157,255,.10)', border: '1px solid rgba(91,157,255,.22)' }}><Glyph kind={catGlyph(s.cat)} /></span>
                <span className="flex-1 text-[14.5px] font-bold leading-tight">{s.name}</span>
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
                <span className="rounded px-1.5 py-0.5 text-[11px] font-bold" style={s.isUser ? { background: 'rgba(91,157,255,.16)', color: GLOW } : { background: 'var(--ci-card)', color: INK2 }}>{s.isUser ? '내 전략' : '기본'}</span>
                <span className="rounded px-1.5 py-0.5 text-[11px] font-bold" style={{ background: lv.bg, color: lv.color }}>{lv.label}</span>
                {locked && <span className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-bold" style={{ background: 'rgba(245,208,97,.14)', color: COMPASS, border: '1px solid rgba(245,208,97,.3)' }}><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>{tierLabel(s.minTier ?? 'BASIC')}</span>}
                {s.applied && <span className="rounded px-1.5 py-0.5 text-[11px] font-bold" style={{ background: 'rgba(63,214,160,.14)', color: '#3fd6a0', border: '1px solid rgba(63,214,160,.3)' }}>● 적용중</span>}
              </div>
              <p className="mt-2 line-clamp-2 text-[13px] leading-snug text-white/55">{s.short}</p>
              <div className="mt-2 text-[11.5px]" style={{ color: INK3 }}>조건 {s.n}개{s.isUser && s.assetCount ? ` · 대상 ${s.assetCount}종목` : ''}</div>
              {s.isUser && (
                <button type="button" onClick={(e) => { e.stopPropagation(); onApply(s.id); }} className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-[13px] font-bold transition-colors"
                  style={s.applied ? { background: 'rgba(63,214,160,.12)', color: '#3fd6a0', border: '1px solid rgba(63,214,160,.3)' } : { background: 'rgba(91,157,255,.14)', color: GLOW, border: '1px solid rgba(91,157,255,.28)' }}>
                  {s.applied ? '⚙ 적용 관리 · 자동매매 →' : '⚓ 적용 · 자동매매 →'}
                </button>
              )}
            </div>
          );
        })}
        <button onClick={() => canUseCustomBuilder ? onCreate() : onLocked('BASIC')} className="shrink-0 rounded-xl p-3.5 text-center transition-colors hover:bg-white/5" style={{ border: `1px dashed ${LINE_S}` }}>
          <div className="flex items-center justify-center gap-1.5 text-[14.5px] font-bold" style={{ color: canUseCustomBuilder ? GLOW : COMPASS }}>
            {canUseCustomBuilder
              ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>}
            새 항로 만들기
          </div>
          <p className="mt-1 text-[12.5px] leading-snug text-white/45">나만의 매매 조건으로 직접 항로를 설계하고 백테스트로 검증해보세요.</p>
          <div className="mt-2 text-[11.5px]" style={{ color: INK3 }}>{canUseCustomBuilder ? '지표·조건 직접 작성' : 'Basic 이상 전용 · 클릭하면 안내'}</div>
        </button>
      </div>
    </aside>
  );
};

const BigStat = ({ n, l, muted }: { n: string; l: string; muted?: boolean }) => (
  <div style={{ ...mkCard, padding: '18px 20px', textAlign: 'center' }}>
    <div className="font-mono text-[39px] font-bold" style={{ color: muted ? INK3 : GLOW }}>{n}</div>
    <div className="text-[13px] tracking-[.08em]" style={{ color: INK2 }}>{l}</div>
  </div>
);
const GuideStep = ({ n, t, d }: { n: string; t: string; d: string }) => (
  <div className="flex gap-3.5">
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-[13px] font-bold" style={{ background: 'rgba(91,157,255,.10)', color: GLOW, border: '1px solid rgba(91,157,255,.22)' }}>{n}</span>
    <div><p className="text-[15px] font-semibold">{t}</p><p className="mt-1 text-[13.5px] leading-snug text-white/55">{d}</p></div>
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
      <h2 className="mt-4 text-[26px] font-bold">항로를 설정하여 항해를 시작하세요</h2>
      <p className="mx-auto mt-2 max-w-[460px] text-[15px]" style={{ color: INK1 }}>왼쪽에서 전략을 선택하고 오른쪽에서 종목·기간을 정한 뒤 백테스트를 실행하면 결과가 여기에 표시됩니다.</p>
    </div>

    {/* 초보자용 핵심 개념 */}
    <div style={{ ...mkCard, padding: '24px 26px' }}>
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-[11px]" style={{ background: 'rgba(91,157,255,.12)', border: '1px solid rgba(91,157,255,.24)' }}><img src="/whales/beluga.png" alt="" width={22} style={{ height: 'auto' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /></span>
        <div><h3 className="text-[17.5px] font-bold">처음이신가요? 핵심 개념부터</h3><p className="mt-0.5 text-[13.5px]" style={{ color: INK2 }}>퀀트 투자가 처음이어도 괜찮아요. 아래 6가지만 알면 시작할 수 있어요.</p></div>
      </div>
      <div className="mt-4 grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(248px, 1fr))' }}>
        {CONCEPTS.map(c => (
          <div key={c.t} className="rounded-xl p-4" style={{ background: 'var(--ci-card)', border: `1px solid ${LINE}` }}>
            <div className="mb-1.5 flex items-center gap-2"><span className="text-[19.5px]">{c.icon}</span><span className="text-[15px] font-bold">{c.tk ? <Term k={c.tk} compact>{c.t}</Term> : c.t}</span></div>
            <p className="m-0 text-[13.5px] leading-relaxed" style={{ color: INK1 }}>{c.d}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-xl px-4 py-3.5 text-[14px] leading-relaxed" style={{ background: 'rgba(245,208,97,.07)', border: '1px solid rgba(245,208,97,.24)', color: INK1 }}>
        <span className="font-bold" style={{ color: COMPASS }}>💡 왜 백테스트부터?</span> 좋아 보이는 전략도 과거에 검증해보면 의외로 약한 경우가 많아요. <b>백테스트 → 모의 적용 → (선택) 자동매매</b> 순서로 단계를 밟으면, 실제 돈을 넣기 전에 안전하게 감을 잡을 수 있습니다.
      </div>
    </div>

    {/* '기본 제공'은 프리셋 수에서 파생 — 프리셋 개편 때 하드코딩 숫자(8)가 실제(15종)와 어긋나던 문제 방지 */}
    <div className="grid grid-cols-3 gap-3.5"><BigStat n={String(total)} l="전체 전략" /><BigStat n={String(PRESET_STRATEGIES.length)} l="기본 제공" /><BigStat n={String(userCount)} l="내 전략" muted={userCount === 0} /></div>
    <div style={{ ...mkCard, padding: '24px 26px' }}>
      <h3 className="mb-4 text-[16px] font-bold">빠른 시작 가이드</h3>
      <div className="flex flex-col gap-4">
        <GuideStep n="01" t="전략 선택" d="왼쪽 목록에서 기본 전략(골든크로스, RSI 등)을 선택하세요. 클릭하면 그 전략이 뭔지 쉬운 설명이 가운데 나타나요." />
        <GuideStep n="02" t="종목 & 기간 설정" d="오른쪽 패널에서 테스트할 종목(예: 비트코인)과 기간(예: 1년)을 설정하세요." />
        <GuideStep n="03" t="백테스트 실행" d={'실행 버튼을 누르면 "이 전략으로 과거에 투자했다면?" 결과(수익률·차트·매매내역)가 표시됩니다.'} />
        <GuideStep n="04" t="적용 · 자동매매 (선택)" d="마음에 들면 '내 전략'으로 저장 후, 모의 계좌에 적용하거나 ⚡자동매매를 켜서 신호 발생 시 자동으로 매매할 수 있어요." />
      </div>
      <button onClick={onGuide} disabled={running} className="wa-force-dark mt-5 flex w-full items-center justify-center gap-2.5 rounded-2xl px-5 py-4 text-[17.5px] font-bold text-white disabled:opacity-60" style={{ border: '1px solid rgba(165,200,255,.6)', background: 'linear-gradient(180deg, #5690f2 0%, #3673e2 100%)', boxShadow: '0 18px 32px -14px rgba(43,110,230,.65), inset 0 1px 0 rgba(255,255,255,.45)' }}>
        {running ? '백테스트 실행 중…' : '가이드 체험 — 골든크로스 × BTC 백테스트 →'}
      </button>
    </div>
  </section>
);

/* 전략 선택 시 — 이 전략 이해하기(초보 교육 + 시각화 차트) */
const StrategyGuidePanel = ({ strat, userStrat, onApply, onCreate, onLearn }: { strat: Strat; userStrat?: Strategy; onApply?: () => void; onCreate?: () => void; onLearn?: () => void }) => {
  const navigate = useNavigate();
  const edu = PRESET_EDU[strat.id];
  const tip = edu?.tip || userStrat?.beginnerTip;
  const why = edu?.why || userStrat?.whyUse;
  const logic = edu?.logic || userStrat?.strategyLogic;
  const desc = userStrat?.description || strat.short;
  const Chart = PRESET_CHART[strat.id];
  return (
    <section className="flex flex-col gap-[18px]">
      <StationBar title="이 전략 이해하기" sub={strat.name} badge={<span className="rounded-full px-2.5 py-1 text-[12px] font-bold" style={{ background: 'rgba(255,255,255,.16)' }}>{LEVEL_META[strat.level].label}</span>} />
      <div style={{ ...mkCard, padding: '24px 26px' }}>
        <h2 className="text-[21.5px] font-bold">{strat.name}</h2>
        <p className="mt-2 text-[15px] leading-relaxed" style={{ color: INK1 }}>{desc}</p>
        {logic && <div className="mt-3.5 rounded-lg px-3.5 py-2.5 font-mono text-[13.5px]" style={{ background: 'var(--ci-card)', border: `1px solid ${LINE}`, color: 'var(--ci-ink0)' }}>매매 규칙 · {logic}</div>}
        {tip && (
          <div className="mt-3.5 rounded-lg px-3.5 py-3" style={{ background: 'rgba(245,208,97,.08)', border: '1px solid rgba(245,208,97,.28)' }}>
            <div className="mb-1 text-[13px] font-bold" style={{ color: COMPASS }}>💡 초보자 한 줄 설명</div>
            <p className="m-0 text-[14px] leading-relaxed" style={{ color: INK1 }}>{tip}</p>
          </div>
        )}
        {why && (
          <div className="mt-3 rounded-lg px-3.5 py-3" style={{ background: 'rgba(91,157,255,.07)', border: '1px solid rgba(91,157,255,.22)' }}>
            <div className="mb-1 text-[13px] font-bold" style={{ color: GLOW }}>⚓ 왜 쓰나요?</div>
            <p className="m-0 text-[14px] leading-relaxed" style={{ color: INK1 }}>{why}</p>
          </div>
        )}
        {onLearn && (
          <button onClick={onLearn} className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-[10px] py-2.5 text-[14px] font-bold" style={{ border: '1px solid rgba(91,157,255,.32)', background: 'rgba(91,157,255,.10)', color: GLOW }}>
            <span className="text-[16px]">🐋</span>고래 튜터에게 이 전략 자세히 배우기
          </button>
        )}
      </div>
      {Chart ? (
        <div style={{ ...mkCard, padding: '20px 24px' }}>
          <h3 className="mb-1 text-[16px] font-bold">전략 시각화</h3>
          <p className="mb-3 text-[13.5px]" style={{ color: INK2 }}>이 전략이 차트에서 어떻게 매수·매도 신호를 잡는지 애니메이션으로 살펴보세요.</p>
          <Suspense fallback={<div className="flex items-center justify-center" style={{ height: 280 }}><span className="h-6 w-6 animate-spin rounded-full" style={{ border: '2px solid rgba(91,157,255,.3)', borderTopColor: GLOW }} /></div>}>
            <Chart />
          </Suspense>
        </div>
      ) : (
        <div className="rounded-xl px-4 py-3 text-[13.5px]" style={{ background: 'var(--ci-card)', border: `1px solid ${LINE}`, color: INK2 }}>📊 시각화 애니메이션은 기본 제공 전략(골든크로스·RSI·볼린저 등)에서만 지원됩니다. 이 전략은 오른쪽에서 바로 백테스트로 확인해보세요.</div>
      )}
      <div className="rounded-xl px-4 py-3 text-[14px] font-semibold" style={{ background: 'var(--ci-card)', border: `1px solid ${LINE}`, color: INK1 }}>오른쪽 패널에서 종목·기간·투자금을 설정한 뒤 <span style={{ color: GLOW }}>백테스트 실행</span>을 누르면 결과가 여기에 표시됩니다 →</div>
      {/* 실행: 모의 적용 · 자동매매 */}
      {userStrat ? (
        <div style={{ ...mkCard, padding: '18px 22px', border: '1px solid rgba(91,157,255,.28)', background: 'linear-gradient(135deg, rgba(91,157,255,.10), transparent 60%)' }}>
          <div className="text-[15px] font-bold">⚓ 모의 적용 · ⚡ 자동매매</div>
          <p className="mt-1 text-[13.5px] leading-relaxed" style={{ color: INK2 }}>이 전략의 대상 종목을 모의 계좌에 한 번에 매수(적용)하거나, 신호가 뜰 때마다 자동으로 매매(자동매매)하도록 켤 수 있어요. <b style={{ color: 'var(--ci-ink0)' }}>모의투자 전용</b>입니다.</p>
          <button onClick={() => onApply?.()} className="mt-3 w-full rounded-[10px] py-2.5 text-[14.5px] font-bold text-white" style={{ background: `linear-gradient(180deg, ${GLOW}, ${ACCENT})` }}>적용 · 자동매매 →</button>
        </div>
      ) : (
        <div style={{ ...mkCard, padding: '18px 22px', border: '1px solid rgba(91,157,255,.28)', background: 'linear-gradient(135deg, rgba(91,157,255,.10), transparent 60%)' }}>
          <div className="text-[15px] font-bold">⚡ 이 전략으로 자동매매</div>
          <p className="mt-1 text-[13.5px] leading-relaxed" style={{ color: INK2 }}>백테스트로 검증한 이 전략을 <b style={{ color: 'var(--ci-ink0)' }}>모의 자동매매</b>로 바로 시작할 수 있어요. 신호가 뜰 때마다 자동으로 매매합니다. (모의투자 전용)</p>
          <button onClick={() => navigate(`/virt/auto-trade?deploy=${strat.id}`)} className="mt-3 w-full rounded-[10px] py-2.5 text-[14.5px] font-bold text-white" style={{ background: `linear-gradient(180deg, ${GLOW}, ${ACCENT})` }}>이 전략으로 자동매매 시작 →</button>
          <button onClick={() => onCreate?.()} className="mt-2 w-full rounded-[10px] py-2 text-[13px] font-semibold" style={{ border: `1px solid ${LINE}`, background: 'var(--ci-card)', color: INK1 }}>조건을 수정해서 쓰려면 — 새 항로(내 전략)로 저장</button>
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
      <p className="text-[15px]" style={{ color: INK1 }}>시뮬레이션 계산 중…</p>
      <p className="mt-1 text-[13px]" style={{ color: INK3 }}>보통 몇 초 내에 끝나요. 오래 걸리면 종목·기간을 확인해보세요.</p>
      {onCancel && <button onClick={onCancel} className="mt-5 rounded-lg px-4 py-2 text-[13.5px] font-semibold" style={{ border: `1px solid ${LINE_S}`, background: 'var(--ci-card)', color: INK1 }}>취소</button>}
    </div>
  </section>
);


/* 포트폴리오 적용 모달 — 사용자 전략의 대상 종목을 모의투자 계좌에 균등 시장가 매수 */
const QUICK_AMOUNTS = [1_000_000, 5_000_000, 10_000_000, 30_000_000, 50_000_000];
const ApplyModal = ({ strategy, cash, onClose, onDone }: { strategy: Strategy; cash: number | null; onClose: () => void; onDone: (msg: string, type: 'success' | 'error') => void }) => {
  useModalChrome(onClose);
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
    } catch (e) {
      onDone(getErrorMessage(e, '항로 적용에 실패했습니다.'), 'error');
    } finally { setBusy(false); }
  };
  const unapply = async () => {
    if (busy) return;
    setBusy(true);
    try { await strategyService.unapplyStrategy(strategy.id); onDone(`"${strategy.name}" 적용을 해제했습니다. (이미 매수된 자산은 유지됩니다)`, 'success'); }
    catch (e) { onDone(getErrorMessage(e, '적용 해제에 실패했습니다.'), 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div onClick={onClose} className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto px-6 py-12" style={{ background: 'rgba(6,11,31,.72)', backdropFilter: 'blur(6px)', animation: 'backdrop-in .2s ease' }}>
      <div onClick={e => e.stopPropagation()} className="relative w-full max-w-[460px] rounded-[18px] p-6" style={{ background: 'var(--ci-overlay)', border: `1px solid ${LINE_S}`, boxShadow: 'var(--ci-panel-shadow)', animation: 'modal-in .25s cubic-bezier(.2,.8,.2,1)' }}>
        <h3 className="text-[19.5px] font-bold">⚓ 항로 포트폴리오 적용</h3>
        <p className="mt-1.5 text-[14px] leading-relaxed" style={{ color: INK1 }}>"<span style={{ color: 'var(--ci-ink0)' }}>{strategy.name}</span>" 항로의 대상 종목을 모의투자(₩) 계좌에 균등 시장가로 매수합니다.</p>
        {strategy.applied && <div className="mt-3 rounded-lg px-3 py-2 text-[13px]" style={{ background: 'rgba(63,214,160,.1)', border: '1px solid rgba(63,214,160,.28)', color: '#3fd6a0' }}>● 이미 적용된 항로입니다. 금액을 바꿔 다시 적용하거나 아래에서 해제할 수 있습니다.</div>}
        {noAssets ? (
          <div className="mt-4 rounded-lg px-3.5 py-3 text-[14px]" style={{ background: 'rgba(245,208,97,.1)', border: '1px solid rgba(245,208,97,.3)', color: COMPASS }}>이 항로에는 대상 종목이 설정되어 있지 않습니다. 전략 수정에서 대상 종목을 추가한 뒤 적용해주세요.</div>
        ) : (
          <>
            <div className="mt-4">
              <Label>투자 금액 (모의투자)</Label>
              <div className="relative mt-1.5">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[16px]" style={{ color: INK2 }}>₩</span>
                <input type="text" inputMode="numeric" value={formatAmountInput(amount)} onChange={e => setAmount(parseAmountInput(e.target.value))} className="w-full rounded-lg py-2.5 pl-8 pr-3 text-right font-mono text-[16px] font-semibold outline-none" style={{ border: `1px solid ${overCash ? 'rgba(239,77,77,.5)' : LINE}`, background: 'var(--ci-raised)', color: 'var(--ci-ink0)' }} />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {QUICK_AMOUNTS.map(q => <button key={q} onClick={() => setAmount(String(q))} className="rounded-md px-2.5 py-1 text-[12.5px] font-semibold" style={{ border: `1px solid ${LINE}`, background: amt === q ? 'rgba(91,157,255,.16)' : 'var(--ci-card)', color: amt === q ? GLOW : INK1 }}>{q >= 1e8 ? `${q / 1e8}억` : `${q / 1e4}만`}</button>)}
              </div>
            </div>
            <dl className="mt-4 grid gap-2 rounded-lg p-3.5 text-[14px]" style={{ background: 'var(--ci-card)', border: `1px solid ${LINE}` }}>
              <div className="flex justify-between"><dt style={{ color: INK2 }}>대상 종목</dt><dd className="m-0 font-mono font-semibold">{assets.length}종목</dd></div>
              <div className="flex justify-between"><dt style={{ color: INK2 }}>종목당 투자금</dt><dd className="m-0 font-mono font-semibold">₩{fmtNum(perAsset)}</dd></div>
              {cash != null && <div className="flex justify-between"><dt style={{ color: INK2 }}>모의 잔고</dt><dd className="m-0 font-mono font-semibold" style={{ color: overCash ? UP : 'var(--ci-ink0)' }}>₩{fmtNum(cash)}</dd></div>}
            </dl>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {assets.slice(0, 8).map(code => <span key={code} className="rounded-md px-2 py-1 font-mono text-[12px]" style={{ background: 'var(--ci-card)', border: `1px solid ${LINE}`, color: INK1 }}>{strategy.targetAssetNames?.[code] || code}</span>)}
              {assets.length > 8 && <span className="px-2 py-1 text-[12px]" style={{ color: INK3 }}>+{assets.length - 8}</span>}
            </div>
            {/* 자동매매 — ②(자동매매 페이지)로 통일. 여기선 안내·이동만 */}
            <div className="mt-4 rounded-xl p-3.5" style={{ background: 'var(--ci-card)', border: `1px solid ${LINE}` }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[14px] font-bold">⚡ 자동매매</div>
                  <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: INK2 }}>신호가 뜰 때마다 자동으로 사고파는 <b style={{ color: 'var(--ci-ink0)' }}>모의 자동매매</b>는 전용 화면에서 시작해요. 손절·익절·실행로그까지 한곳에서 관리합니다.</p>
                </div>
                <button onClick={() => navigate(`/virt/auto-trade?deploy=${strategy.id}`)} className="shrink-0 rounded-lg px-3.5 py-2 text-[13.5px] font-bold text-white" style={{ border: '1px solid rgba(140,190,255,.5)', background: 'linear-gradient(180deg,#4d8aff,#2c6fe6)' }}>자동매매 시작 →</button>
              </div>
            </div>
          </>
        )}
        <div className="mt-5 flex gap-2">
          <button onClick={onClose} disabled={busy} className="flex-1 rounded-lg py-2.5 text-[14.5px] font-semibold" style={{ border: `1px solid ${LINE_S}`, background: 'transparent', color: 'var(--ci-ink0)' }}>닫기</button>
          {strategy.applied && <button onClick={unapply} disabled={busy} className="rounded-lg px-4 py-2.5 text-[14.5px] font-semibold" style={{ border: '1px solid rgba(239,77,77,.4)', background: 'rgba(239,77,77,.1)', color: '#fca5a5' }}>적용 해제</button>}
          {!noAssets && <button onClick={apply} disabled={busy || overCash} className="flex-1 rounded-lg py-2.5 text-[14.5px] font-bold disabled:opacity-50" style={{ background: `linear-gradient(180deg, ${GLOW}, ${ACCENT})`, color: '#fff' }}>{busy ? '적용 중…' : strategy.applied ? '재적용' : '적용하기'}</button>}
        </div>
        <p className="mt-3 text-[12px] leading-relaxed" style={{ color: INK3 }}>* 모의투자(₩) 계좌에 시장가로 매수됩니다. 실제 자금이 아닌 시뮬레이션입니다.</p>
      </div>
    </div>
  );
};

/* 이전 백테스트 결과 목록 (서버 저장) — 선택 시 전체 결과를 조회해 재표시, 삭제 지원 */
const HistoryModal = ({ history, onPick, onDelete, onClose }: { history: BacktestHistoryItem[]; onPick: (id: string) => void; onDelete: (id: string) => void; onClose: () => void }) => {
  useModalChrome(onClose);
  return (
  <div onClick={onClose} className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto px-6 py-12" style={{ background: 'rgba(6,11,31,.72)', backdropFilter: 'blur(6px)', animation: 'backdrop-in .2s ease' }}>
    <div onClick={e => e.stopPropagation()} className="relative w-full max-w-[560px] rounded-[18px]" style={{ background: 'var(--ci-overlay)', border: `1px solid ${LINE_S}`, boxShadow: 'var(--ci-panel-shadow)', animation: 'modal-in .25s cubic-bezier(.2,.8,.2,1)' }}>
      <div className="wa-force-dark flex items-center justify-between rounded-t-[18px] px-6 py-4 text-white" style={{ background: BT_GRAD }}>
        <h3 className="text-[16px] font-bold">이전 백테스트 결과 <span className="text-white/60">({history.length})</span></h3>
        <button onClick={onClose} aria-label="닫기" className="flex h-8 w-8 items-center justify-center rounded-lg text-[16px]" style={{ border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.08)' }}><span aria-hidden>✕</span></button>
      </div>
      <div className="max-h-[60vh] overflow-y-auto p-2">
        {history.length === 0 ? <div className="px-4 py-10 text-center text-[14px]" style={{ color: INK3 }}>저장된 결과가 없습니다. 백테스트를 실행하면 자동 저장됩니다.</div> :
          history.map(e => { const up = e.totalReturnRate >= 0; return (
            <div key={e.id} className="flex items-center gap-1 rounded-lg pr-2 hover:bg-white/5" style={{ borderBottom: `1px solid ${LINE}` }}>
              <button onClick={() => onPick(e.id)} className="flex min-w-0 flex-1 items-center justify-between px-4 py-3 text-left">
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold">{e.strategyName} <span className="font-mono text-[12px]" style={{ color: INK3 }}>{e.stockName || e.stockCode}</span></div>
                  <div className="text-[12px]" style={{ color: INK3 }}>{e.startDate}~{e.endDate} · {new Date(e.createdAt).toLocaleString('ko-KR')}</div>
                </div>
                <span className="ml-3 shrink-0 font-mono text-[14px] font-bold" style={{ color: up ? UP : DOWN }}>{up ? '+' : ''}{e.totalReturnRate.toFixed(2)}%</span>
              </button>
              <button onClick={() => onDelete(e.id)} aria-label="삭제" title="삭제" className="shrink-0 rounded px-2 py-1 text-[15px]" style={{ color: INK3 }}><span aria-hidden>×</span></button>
            </div>
          ); })}
      </div>
    </div>
  </div>
  );
};


const ConsoleStrategyPage = () => {
  const { profileName, tier, role, limits } = useAuth();
  const { isVirt } = useRoutePrefix();
  const virtNavigate = useVirtNavigate();
  const effTier = effectiveTier(tier, role);
  const canUseCustomBuilder = limits?.canUseCustomBuilder ?? false;
  // 표시명은 DB 닉네임(profileName) 단일 소스 — 다른 콘솔 페이지와 동일(이메일 ID 노출·깜빡임 방지)
  const userName = profileName || '항해사';
  const [activeId, setActiveId] = useState<string | null>(null);
  // 종목 미선택으로 시작 — 페이지 진입 시 특정 종목(코인)을 기본 선택하지 않는다. 사용자가 직접 고른다.
  const [target, setTarget] = useState<{ symbol: string; name: string; assetType: string }>({ symbol: '', name: '', assetType: '' });
  const [period, setPeriod] = useState('1Y');
  const [capital, setCapital] = useState(10_000_000);
  const [monthly, setMonthly] = useState(0);
  // 고급 백테스트 옵션 (리스크·비용·방향·배당·커스텀 기간) + 2자산 리밸런싱
  const [adv, setAdv] = useState<AdvOpts>(ADV_DEFAULTS);
  const [turtle, setTurtle] = useState<TurtleParams>(TURTLE_DEFAULTS); // 터틀 전용 설정(채널 기간·ADX·유닛·레버리지)
  const [momentum, setMomentum] = useState<MomentumParams>(MOMENTUM_DEFAULTS); // 모멘텀 로테이션 설정(top-N·lookback·레짐)
  const [extras, setExtras] = useState<RebalAsset[]>([]); // 다중 자산 리밸런싱 추가 자산(최대 4)
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
  const [learnOpen, setLearnOpen] = useState(false); // 고래 튜터 교육 드로어(구 /store 흡수)
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

  const run = async (id: string | null = activeId, targetOverride?: Target) => {
    const s = allStrats.find(x => x.id === id);
    if (!s) { setError('전략을 선택해주세요.'); return; }

    // 미국주식 모멘텀 로테이션 — 종목·조건 무시, 유니버스 랭킹 엔진으로 위임(전용 요청)
    if (s.id === MOMENTUM_PRESET_ID) {
      if (!(capital > 0)) { setError('초기 투자금은 0보다 커야 합니다.'); return; }
      if (adv.dateMode === 'custom' && (!adv.customStart || !adv.customEnd || adv.customStart >= adv.customEnd)) {
        setError('직접지정 기간을 올바르게 선택해주세요.'); return;
      }
      const { startDate, endDate } = adv.dateMode === 'custom'
        ? { startDate: adv.customStart, endDate: adv.customEnd } : periodDates(period);
      const mreq: BacktestRequest = {
        stockCode: 'US_MOMENTUM', stockName: s.name, startDate, endDate, initialCapital: capital, assetType: 'US_STOCK',
        strategyName: s.name, strategyType: 'MOMENTUM_ROTATION', momentumAssetType: momentum.assetType,
        topN: momentum.topN, lookbackDays: momentum.lookbackDays, regimeFilter: momentum.regimeFilter,
        regimeFloor: momentum.regimeFloor, rebalanceBandPct: momentum.rebalanceBandPct,
      };
      // 거래 비용은 모멘텀 엔진도 반영 — 사용자가 입력했을 때만 전송(빈 칸이면 서버 기본값)
      const mpct = (v: string) => { const n = parseFloat(v); return Number.isFinite(n) ? n : undefined; };
      if (mpct(adv.slippage) != null) mreq.slippagePercent = mpct(adv.slippage);
      if (mpct(adv.commission) != null) mreq.commissionRate = mpct(adv.commission);
      const myRun = ++runIdRef.current;
      setRunning(true); setError(null); setResult(null);
      try {
        const r = await strategyService.runBacktest(mreq);
        if (runIdRef.current !== myRun) return;
        r.strategyName = s.name; setResult(r); refreshHistory();
      } catch (e) {
        if (runIdRef.current !== myRun) return;
        const status = (e as { response?: { status?: number } })?.response?.status;
        const raw = getErrorMessage(e, '');
        setError(status === 429 ? '요청이 너무 많습니다. 잠시 후 다시 시도해주세요. (분당 5회 제한)'
          : (raw || '백테스트 실행에 실패했습니다. 132종목 데이터 로드에 시간이 걸릴 수 있어요(잠시 후 재시도).'));
      } finally { if (runIdRef.current === myRun) setRunning(false); }
      return;
    }

    // 모멘텀 외 전략은 백테스트할 종목이 필요 — 미선택이면 안내(기본 종목을 자동 선택하지 않으므로)
    // targetOverride: 가이드 체험처럼 setTarget 직후 즉시 실행할 때(비동기 state 반영 전) 명시 종목 전달용
    const tgt = targetOverride ?? target;
    if (!tgt.symbol) { setError('백테스트할 종목을 먼저 선택해주세요.'); return; }

    const isTurtle = s.id === TURTLE_PRESET_ID;
    // 터틀은 설정 패널 파라미터로 지표·조건을 즉석 생성(채널 기간·ADX·유닛·레버리지·트레일링 반영)
    const preset = isTurtle
      ? { ...PRESET_DEFS[s.id], ...buildTurtleConditions(turtle), maxPositions: turtle.maxUnits, leverage: turtle.leverage,
          trailingStopPercent: turtle.trailingStopPercent, tradeDirection: 'LONG_SHORT_FLAT' as const, pyramidMode: 'ATR' as const }
      : PRESET_DEFS[s.id];
    const us = userStrats.find(x => x.id === s.id);
    const useEdit = !isTurtle && s.id === editForId; // 터틀은 동적 생성 조건을 쓰므로 수동 편집값 무시
    // 초기 투자금 0원은 적립식(매월 납입)과 함께면 허용 — 0원 시작 + DCA
    if (capital < 0 || (capital === 0 && monthly <= 0)) { setError('초기 투자금이 0이면 적립식 투자를 켜고 월 납입금을 설정해주세요.'); return; }
    if (adv.dateMode === 'custom') {
      if (!adv.customStart || !adv.customEnd) { setError('직접지정 기간의 시작일과 종료일을 모두 선택해주세요.'); return; }
      if (adv.customStart >= adv.customEnd) { setError('시작일은 종료일보다 앞서야 합니다.'); return; }
    }
    const { startDate, endDate } = adv.dateMode === 'custom'
      ? { startDate: adv.customStart, endDate: adv.customEnd } : periodDates(period);
    const rebalExtras = extras.filter(e => e.symbol !== tgt.symbol); // 실행 종목과 겹치는 추가 자산은 제외
    const rebalActive = rebalExtras.length > 0; // 다중 자산 리밸런싱 모드: 매매방향(숏)·분할·사이징·레버리지 미지원
    if (rebalActive) {
      const sum = firstWeight + rebalExtras.reduce((s, e) => s + e.weight, 0);
      if (Math.abs(sum - 100) > 0.01) { setError('리밸런싱 자산 비중의 합이 100%가 되어야 합니다.'); return; }
    }
    const req: BacktestRequest = {
      stockCode: tgt.symbol, stockName: tgt.name, startDate, endDate, initialCapital: capital, assetType: tgt.assetType,
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
    // 배당 재투자: 리밸런싱 자산 중 미국주식·ETF가 있고 OFF로 끈 경우에만 false 전송 (기본 ON)
    // 판정은 실제 실행 종목(tgt = override 반영) 기준 — target 상태를 쓰면 가이드 체험 등 즉시 실행 경로에서 이전 선택 기준이 됨
    const hasUsEtf = [tgt, ...rebalExtras].some(a => a.assetType === 'US_STOCK' || a.assetType === 'ETF');
    if (hasUsEtf && !adv.dividendReinvest) req.dividendReinvest = false;
    // 다중 자산 리밸런싱: 추가 자산(1~4개)이 있을 때만 활성
    if (rebalActive) {
      req.additionalAssets = rebalExtras.map(e => ({ stockCode: e.symbol, stockName: e.name, assetType: e.assetType, weight: e.weight }));
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
    } catch (e) {
      if (runIdRef.current !== myRun) return; // 취소됨 → 에러 무시
      const status = (e as { response?: { status?: number } })?.response?.status;
      const raw = getErrorMessage(e, '');
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
      setResult(r);
      // id가 있으면 id로 우선 매칭(이름 중복·개명 시 엉뚱한 전략 활성화 방지), 없을 때만 이름 폴백
      const s = r.strategyId ? allStrats.find(x => x.id === r.strategyId) : allStrats.find(x => x.name === r.strategyName);
      setActiveId(s ? s.id : null); setError(null); setHistOpen(false);
    } catch { setError('저장된 결과를 불러오지 못했습니다.'); }
  };
  const deleteHistory = async (id: string) => {
    if (!window.confirm('이 백테스트 결과를 삭제하시겠습니까? 되돌릴 수 없습니다.')) return; // 다른 파괴적 동작(전략 삭제 등)과 동일하게 확인
    try { await strategyService.deleteSavedBacktest(id); refreshHistory(); } catch { /* ignore */ }
  };

  return (
    <HelmShell active="strategy" virt={isVirt} userName={userName} session="전략 백테스트">
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {isVirt ? <FunnelSteps current={1} /> : <span />}
          <button onClick={() => setTour(true)} className="inline-flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-[14px] font-bold" style={{ border: '1px solid rgba(91,157,255,.4)', background: 'rgba(91,157,255,.14)', color: GLOW }} title="사용법 가이드 투어 다시 보기"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10" /><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .8-1 1.7" strokeLinecap="round" /><circle cx="12" cy="17" r=".6" fill="currentColor" /></svg>가이드 투어 다시 보기</button>
        </div>
        {error && <div className="rounded-xl px-4 py-3 text-[14px]" style={{ background: 'rgba(239,77,77,.1)', border: '1px solid rgba(239,77,77,.25)', color: '#fca5a5' }}>{error}</div>}
        <div className="grid items-start gap-5 grid-cols-1 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)_minmax(0,320px)]">
          <div data-tour="library" className="min-w-0">
          <StrategyLibrary strats={allStrats} activeId={activeId} onPick={(id) => { setActiveId(id); setResult(null); setError(null); }}
            onCreate={() => setBuilder({ mode: 'create' })}
            onEditUser={(id) => { const st = userStrats.find(s => s.id === id); if (st) setBuilder({ mode: 'edit', strategy: st }); }}
            onDeleteUser={handleDeleteUser}
            onApply={(id) => { const st = userStrats.find(s => s.id === id); if (st) setApplyFor(st); }}
            effTier={effTier} canUseCustomBuilder={canUseCustomBuilder}
            onLocked={(minTier) => { showToast(`${tierLabel(minTier)} 이상 등급에서 이용할 수 있어요. 요금제를 확인해보세요.`, 'error'); virtNavigate('/billing'); }} />
          </div>
          <div className="min-w-0" data-tour="result">
            {running ? <RunningView onCancel={() => { runIdRef.current++; setRunning(false); }} />
              : result ? <ResultView result={result} strat={strat} onExport={onExport} />
                : strat ? <StrategyGuidePanel strat={strat} userStrat={userStrats.find(s => s.id === strat.id)} onApply={() => { const st = userStrats.find(s => s.id === strat.id); if (st) setApplyFor(st); }} onCreate={() => setBuilder({ mode: 'create' })} onLearn={() => setLearnOpen(true)} />
                  : <EmptyHero running={running} total={allStrats.length} userCount={userStrats.length} onGuide={() => { setActiveId('preset-golden-cross'); setTarget({ symbol: 'BTC', name: '비트코인', assetType: 'CRYPTO' }); run('preset-golden-cross', { symbol: 'BTC', name: '비트코인', assetType: 'CRYPTO' }); }} />}
          </div>
          <div data-tour="runner" className="min-w-0">
          <BacktestRunner strat={strat} target={target} setTarget={setTarget} period={period} setPeriod={setPeriod} capital={capital} setCapital={setCapital} monthly={monthly} setMonthly={setMonthly} editInd={editInd} setEditInd={setEditInd} editEntry={editEntry} setEditEntry={setEditEntry} editExit={editExit} setEditExit={setEditExit} adv={adv} setAdv={setAdv} turtle={turtle} setTurtle={setTurtle} momentum={momentum} setMomentum={setMomentum} extras={extras} setExtras={setExtras} firstWeight={firstWeight} setFirstWeight={setFirstWeight} rebalanceFreq={rebalanceFreq} setRebalanceFreq={setRebalanceFreq} stratAssets={stratAssets} onRun={() => run()} running={running} historyCount={history.length} onShowHistory={() => setHistOpen(true)} limits={limits} />
          </div>
        </div>
        {/* 푸터 — 공용 푸터 (기존 href 없는 죽은 링크 4개 제거) */}
        <ConsoleFooter />
      </div>
      {builder && <BuilderModal key={`${builder.mode}:${builder.strategy?.id ?? 'new'}`} mode={builder.mode} initial={builder.strategy} onClose={() => setBuilder(null)} onSaved={(msg) => { setBuilder(null); refreshUserStrats(); showToast(msg); }} />}
      {applyFor && <ApplyModal strategy={applyFor} cash={cash} onClose={() => setApplyFor(null)} onDone={(msg, type) => { showToast(msg, type); if (type === 'success') { setApplyFor(null); refreshUserStrats(); refreshCash(); } }} />}
      <StrategyLearnDrawer strat={learnOpen && strat ? { id: strat.id, name: strat.name, cat: strat.cat } : null} logic={strat ? (PRESET_EDU[strat.id]?.logic || userStrats.find(s => s.id === strat.id)?.strategyLogic) : undefined} onClose={() => setLearnOpen(false)} />
      <GuideTour steps={STRAT_TOUR} isActive={tour} onFinish={() => { setTour(false); try { localStorage.setItem('whalearc_strategy_tour', 'done'); } catch { /* ignore */ } }} />
      {histOpen && <HistoryModal history={history} onPick={pickHistory} onDelete={deleteHistory} onClose={() => setHistOpen(false)} />}
      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </HelmShell>
  );
};

export default ConsoleStrategyPage;
