import { useEffect, useState } from 'react';
import { marketService } from '../../services/marketService';
import { formatAmountInput, parseAmountInput } from '../../utils/currency';
import { tierLabel, isUnlimited, type TierLimits } from '../../services/userService';
import type { Indicator, Condition } from '../../services/strategyService';
import { TURTLE_PRESET_ID, type TurtleParams, MOMENTUM_PRESET_ID, MOMENTUM_ASSET_META, type MomentumParams, type MomentumAssetType } from '../../data/presetStrategies';
import { Term } from '../GlossaryTerm';
import { UP, COMPASS, SONAR as GLOW, INK1, INK2, INK3, LINE, mkCard } from '../console/format';
import { ACCENT, BT_GRAD, fmtNum, seg, fieldStyle, periodDates, PRESET_DEFS, PARAM_LABEL, MAX_REBAL_EXTRAS, type Strat, type Target, type AdvOpts, type RebalFreq, type Sizing, type RebalAsset } from './shared';
import { Label } from './ui';

/* 백테스트 실행 패널 — 종목·기간·자본·고급설정(리스크/비용/방향/지표)·2자산 리밸런싱 */

const PERIODS: [string, string][] = [['6M', '6개월'], ['1Y', '1년'], ['2Y', '2년'], ['3Y', '3년'], ['5Y', '5년'], ['10Y', '10년']];
const CAPS: [number, string][] = [[1_000_000, '100만'], [5_000_000, '500만'], [10_000_000, '1000만'], [50_000_000, '5000만']];
const REBAL: [RebalFreq, string][] = [['MONTHLY', '매월'], ['QUARTERLY', '분기'], ['YEARLY', '매년']];
const TDIR: [AdvOpts['tradeDirection'], string][] = [['LONG_ONLY', '매수만'], ['SHORT_ONLY', '공매도만'], ['LONG_SHORT', '롱·숏'], ['LONG_SHORT_FLAT', '롱·숏(독립)']];
const POS_OPTS: [string, string][] = [['auto', '자동'], ['2', '2회'], ['3', '3회'], ['5', '5회']];
const SIZING: [Sizing, string][] = [['ALL_IN', '전량'], ['PERCENT', '자본 비율'], ['FIXED_AMOUNT', '고정 금액']];
// 기간 키 → 햇수(등급 한도 비교용). 6M=0.5는 1년 한도 안이라 1로 본다.
const PERIOD_YEARS: Record<string, number> = { '6M': 1, '1Y': 1, '2Y': 2, '3Y': 3, '5Y': 5, '10Y': 10 };
const POS_VALUE: Record<string, number> = { auto: 1, '2': 2, '3': 3, '5': 5 };
const BT_CLASSES: [string, string][] = [['CRYPTO', '코인'], ['STOCK', '주식'], ['US_STOCK', '미국'], ['ETF', 'ETF']];
const condLabel = (ind: string, side: '매수' | '매도') => ind === 'RSI' ? `RSI ${side} 기준` : ind === 'BOLLINGER_PCT_B' ? `%B ${side} 기준` : ind === 'STOCH_K' ? `%K ${side} 기준` : `${side === '매수' ? '진입' : '청산'} ${ind}`;
const THRESH_INDS = ['RSI', 'BOLLINGER_PCT_B', 'STOCH_K']; // 기준값 편집 대상(임계 지표). 크로스 지표는 value 0 고정이라 제외

/* 자산 전체 검색 박스 (코인/주식/미국/ETF) — 기본 종목 + 2자산 리밸런싱 종목 공용 */
const AssetSearchBox = ({ cryptoList, onPick }: { cryptoList: { code: string; name: string }[]; onPick: (code: string, name: string, assetType: string) => void }) => {
  const [klass, setKlass] = useState('');   // 기본 탭 강조 없음 — 사용자가 자산유형을 직접 선택
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ code: string; name: string }[]>([]);
  useEffect(() => {
    const q = query.trim();
    if (!klass) { setResults([]); return; }
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
      <div className="flex gap-1">{BT_CLASSES.map(([k, l]) => <button key={k} onClick={() => { setKlass(k); setQuery(''); setResults([]); }} className="flex-1 rounded-md py-1.5 text-[12px] font-semibold" style={seg(klass === k)}>{l}</button>)}</div>
      <input value={query} onChange={e => setQuery(e.target.value)} disabled={!klass} aria-label="종목 검색" placeholder={!klass ? '자산유형(코인/주식/미국/ETF)을 먼저 선택하세요' : klass === 'CRYPTO' ? '코인 검색 (BTC, 이더리움…)' : '종목 검색 (삼성, AAPL…)'} className="mt-1.5 w-full rounded-lg px-3 py-2 text-[13.5px] outline-none disabled:opacity-50" style={fieldStyle} />
      {results.length > 0 && <div className="no-scrollbar mt-1 flex max-h-[176px] flex-col gap-0.5 overflow-y-auto rounded-lg p-1" style={{ border: `1px solid ${LINE}`, background: 'var(--ci-raised)', boxShadow: '0 10px 26px -12px rgba(0,0,0,.5)' }}>
        {results.map(r => <button key={r.code} onClick={() => pick(r.code, r.name)} className="flex items-center justify-between rounded px-2.5 py-1.5 text-left text-[13px] hover:bg-white/5"><span className="truncate font-semibold">{r.name}</span><span className="ml-2 shrink-0 font-mono" style={{ color: INK3 }}>{r.code}</span></button>)}
      </div>}
    </>
  );
};

type RunnerProps = {
  strat: Strat | null; target: Target; setTarget: (t: Target) => void; period: string; setPeriod: (p: string) => void;
  capital: number; setCapital: (n: number) => void; monthly: number; setMonthly: (n: number) => void;
  editInd: Indicator[]; setEditInd: (v: Indicator[]) => void; editEntry: Condition[]; setEditEntry: (v: Condition[]) => void; editExit: Condition[]; setEditExit: (v: Condition[]) => void;
  adv: AdvOpts; setAdv: (v: AdvOpts) => void; turtle: TurtleParams; setTurtle: (v: TurtleParams) => void; momentum: MomentumParams; setMomentum: (v: MomentumParams) => void;
  extras: RebalAsset[]; setExtras: (v: RebalAsset[]) => void; firstWeight: number; setFirstWeight: (n: number) => void; rebalanceFreq: RebalFreq; setRebalanceFreq: (v: RebalFreq) => void;
  stratAssets: Target[]; onRun: () => void; running: boolean; historyCount: number; onShowHistory: () => void;
  limits: TierLimits | null;
};

const BacktestRunner = ({ strat, target, setTarget, period, setPeriod, capital, setCapital, monthly, setMonthly, editInd, setEditInd, editEntry, setEditEntry, editExit, setEditExit, adv, setAdv, turtle, setTurtle, momentum, setMomentum, extras, setExtras, firstWeight, setFirstWeight, rebalanceFreq, setRebalanceFreq, stratAssets, onRun, running, historyCount, onShowHistory, limits }: RunnerProps) => {
  const maxYears = limits?.maxBacktestYears ?? 1;       // 등급 기간 한도(무제한=-1)
  const maxPos = limits?.maxBacktestPositions ?? 1;     // 등급 포지션 한도(무제한=-1)
  const periodLocked = (k: string) => !isUnlimited(maxYears) && PERIOD_YEARS[k] > maxYears;
  const posLocked = (k: string) => !isUnlimited(maxPos) && POS_VALUE[k] > maxPos;
  // 직접지정(custom) 기간이 등급 한도를 초과하는지 — 백엔드 enforceBacktestTierLimits와 동일 규칙(start < end−maxYears)
  let customExceeds = false;
  if (adv.dateMode === 'custom' && !isUnlimited(maxYears) && adv.customStart && adv.customEnd) {
    const limit = new Date(adv.customEnd);
    limit.setFullYear(limit.getFullYear() - maxYears);
    customExceeds = new Date(adv.customStart) < limit;
  }
  const range = adv.dateMode === 'custom' && adv.customStart && adv.customEnd ? { startDate: adv.customStart, endDate: adv.customEnd } : periodDates(period);
  const today = periodDates('1Y').endDate;
  const [cryptoList, setCryptoList] = useState<{ code: string; name: string }[]>([]);
  useEffect(() => { marketService.getPrices('CRYPTO').then(ps => setCryptoList(ps.map(p => ({ code: p.symbol, name: p.name })))).catch(() => {}); }, []);
  const isUsEtf = [target, ...extras].some(a => a.assetType === 'US_STOCK' || a.assetType === 'ETF');
  const rebalActive = extras.length > 0; // 다중 자산 리밸런싱 모드: 매매방향(숏)·분할·사이징·레버리지 미지원
  // 비중 합 검증 — 백엔드 validateRequest(±0.01%p)와 동일 규칙
  const weightSum = firstWeight + extras.reduce((s, a) => s + a.weight, 0);
  const weightsBad = rebalActive && (Math.abs(weightSum - 100) > 0.01 || firstWeight <= 0 || extras.some(a => a.weight <= 0));
  // 균등 분배: 잔여분은 기본 자산에 몰아 합계 100을 정확히 맞춘다 (예: 3자산 → 33.33/33.33/33.34)
  const equalSplit = () => {
    const per = Math.floor(10000 / (extras.length + 1)) / 100;
    setExtras(extras.map(a => ({ ...a, weight: per })));
    setFirstWeight(Math.round((100 - per * extras.length) * 100) / 100);
  };
  const addExtra = (symbol: string, name: string, assetType: string) => {
    if (symbol === target.symbol || extras.some(a => a.symbol === symbol) || extras.length >= MAX_REBAL_EXTRAS) return;
    const next = [...extras, { symbol, name, assetType, weight: 0 }];
    const per = Math.floor(10000 / (next.length + 1)) / 100;
    setExtras(next.map(a => ({ ...a, weight: per })));
    setFirstWeight(Math.round((100 - per * next.length) * 100) / 100);
  };
  const removeExtra = (i: number) => {
    // 제거된 비중은 기본 자산으로 반환 — 사용자가 손본 나머지 비중은 유지
    setFirstWeight(Math.round((firstWeight + extras[i].weight) * 100) / 100);
    setExtras(extras.filter((_, k) => k !== i));
  };
  const preset = strat ? PRESET_DEFS[strat.id] : null; // 프리셋 권장값(레버리지 등) 표시용
  // 모멘텀 로테이션: 종목·조건·리스크·적립식·2자산이 모두 무시되는 전용 엔진 — 해당 입력은 숨기고 거래 비용만 노출
  const isMomentum = strat?.id === MOMENTUM_PRESET_ID;
  // 모멘텀 로테이션은 종목 불필요(유니버스 고정). 그 외 전략은 종목 선택이 있어야 실행 가능.
  const symbolMissing = !!strat && !isMomentum && !target.symbol;
  return (
    <aside style={{ ...mkCard, padding: 0, display: 'flex', flexDirection: 'column' }}>
      <div className="wa-force-dark px-[18px] py-4 text-white" style={{ background: BT_GRAD, borderBottom: '1px solid rgba(255,255,255,.14)' }}>
        <h3 className="text-[17.5px] font-bold">백테스트 실행</h3>
        <p className="mt-0.5 truncate text-[13.5px] text-white/70">{strat ? `— ${strat.name}` : '왼쪽 라이브러리에서 전략을 선택하세요'}</p>
      </div>
      <div className="flex flex-col gap-[18px] p-[18px]">
        {/* 조건 수는 실제 로드된 편집 상태에서 파생 — 이전엔 어떤 전략이든 '진입 1개 · 청산 1개' 고정 표기였음 */}
        {strat && <div style={{ ...mkCard, padding: '14px 16px' }}><div className="text-[14.5px] font-bold">{strat.name}</div><div className="mt-0.5 text-[12.5px]" style={{ color: INK2 }}>진입 {editEntry.length}개 · 청산 {editExit.length}개 조건</div></div>}
        {/* 종목 (전체 검색) — 모멘텀 로테이션(유니버스 고정)은 종목 선택이 무시되므로 숨긴다 */}
        {!isMomentum && (
        <div><Label>종목 (전체 검색)</Label>
          <div className="mt-1.5 flex items-center justify-between rounded-lg px-3 py-2.5" style={{ border: '1px solid rgba(91,157,255,.32)', background: 'rgba(91,157,255,.08)' }}>
            <span className="truncate text-[14px] font-semibold" style={target.symbol ? undefined : { color: INK3, fontWeight: 500 }}>{target.name || '종목을 선택하세요'}</span><span className="ml-2 shrink-0 font-mono text-[12px]" style={{ color: INK2 }}>{target.symbol}</span>
          </div>
          <div className="mt-1.5"><AssetSearchBox cryptoList={cryptoList} onPick={(c, n, a) => setTarget({ symbol: c, name: n, assetType: a })} /></div>
          {stratAssets.length > 0 && <div className="mt-2">
            <div className="mb-1 text-[11.5px]" style={{ color: INK3 }}>이 전략의 종목</div>
            <div className="flex flex-wrap gap-1.5">{stratAssets.map(a => <button key={a.symbol} onClick={() => setTarget(a)} className="rounded-md px-2.5 py-1 text-[12px] font-semibold" style={{ border: `1px solid ${target.symbol === a.symbol ? 'rgba(91,157,255,.32)' : LINE}`, background: target.symbol === a.symbol ? 'rgba(91,157,255,.12)' : 'var(--ci-card)', color: target.symbol === a.symbol ? GLOW : INK1 }}>{a.name}</button>)}</div>
          </div>}
        </div>
        )}
        {/* 분석 기간 (프리셋 / 직접지정) */}
        <div><div className="flex items-center justify-between"><Label>분석 기간</Label>
          <div className="flex gap-1">{(['preset', 'custom'] as const).map(m => <button key={m} onClick={() => setAdv({ ...adv, dateMode: m })} className="rounded-md px-2 py-0.5 text-[11.5px] font-semibold" style={seg(adv.dateMode === m)}>{m === 'preset' ? '기간선택' : '직접지정'}</button>)}</div></div>
          {adv.dateMode === 'preset' ? <>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5">{PERIODS.map(([k, l]) => { const lk = periodLocked(k); return <button key={k} disabled={lk} onClick={() => setPeriod(k)} title={lk ? `${PERIOD_YEARS[k] > 5 ? tierLabel('PRO') : tierLabel('BASIC')} 이상에서 더 긴 기간을 이용할 수 있어요` : undefined} className="rounded-lg py-2 text-[12.5px] font-semibold disabled:cursor-not-allowed disabled:opacity-40" style={seg(period === k)}>{l}{lk ? ' 🔒' : ''}</button>; })}</div>
            <div className="mt-2 text-center font-mono text-[12.5px]" style={{ color: INK3 }}>{range.startDate} ~ {range.endDate}</div>
            <div className="mt-1 text-center text-[11.5px]" style={{ color: INK3 }}>{isUnlimited(maxYears) ? '현재 등급: 기간 무제한 — 더 긴 기간은 직접지정으로 설정하세요' : `현재 등급 기간 한도: ${maxYears}년`}</div>
          </> : <>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              <label className="flex flex-col gap-1"><span className="text-[11.5px]" style={{ color: INK3 }}>시작일</span><input type="date" max={today} value={adv.customStart} onChange={e => setAdv({ ...adv, customStart: e.target.value })} className="rounded px-2 py-1.5 text-[13px] outline-none" style={fieldStyle} /></label>
              <label className="flex flex-col gap-1"><span className="text-[11.5px]" style={{ color: INK3 }}>종료일</span><input type="date" max={today} value={adv.customEnd} onChange={e => setAdv({ ...adv, customEnd: e.target.value })} className="rounded px-2 py-1.5 text-[13px] outline-none" style={fieldStyle} /></label>
            </div>
            {!isUnlimited(maxYears) && <div className="mt-1.5 text-center text-[11.5px]" style={{ color: customExceeds ? COMPASS : INK3 }}>{customExceeds ? `⚠️ 등급 기간 한도(${maxYears}년)를 초과했어요 — 시작일을 조정하거나 등급을 올려주세요` : `현재 등급 기간 한도: ${maxYears}년`}</div>}
          </>}
        </div>
        {/* 초기 투자금 + 적립식 (적립식은 모멘텀 미지원 — 엔진이 월 납입을 처리하지 않음) */}
        <div><Label>초기 투자금</Label>
          <input type="text" inputMode="numeric" value={formatAmountInput(capital)} onChange={e => setCapital(Number(parseAmountInput(e.target.value)) || 0)} className="mt-1.5 w-full rounded-lg px-3 py-2.5 text-right font-mono text-[16px] font-semibold outline-none" style={{ border: `1px solid ${LINE}`, background: 'var(--ci-card)', color: 'var(--ci-ink0)' }} />
          <div className="mt-2 grid grid-cols-4 gap-1.5">{CAPS.map(([v, l]) => <button key={v} onClick={() => setCapital(v)} className="rounded-md py-1.5 text-[12.5px] font-semibold" style={{ border: `1px solid ${LINE}`, background: 'var(--ci-card)', color: INK1 }}>{l}</button>)}</div>
          {!isMomentum && <>
            <label className="mt-3 flex items-center gap-2 text-[13.5px]" style={{ color: INK1 }}><input type="checkbox" className="accent-[#5b9dff]" checked={monthly > 0} onChange={e => setMonthly(e.target.checked ? Math.max(100_000, Math.round(capital / 12)) : 0)} /><Term k="적립식" compact>적립식 투자</Term> (매월 {monthly > 0 ? `₩${fmtNum(monthly)}` : '첫 거래일'})</label>
            {monthly > 0 && <div className="mt-2"><input type="text" inputMode="numeric" value={formatAmountInput(monthly)} onChange={e => setMonthly(Math.max(0, Number(parseAmountInput(e.target.value)) || 0))} className="w-full rounded-lg px-3 py-2 text-right font-mono text-[14px] outline-none" style={fieldStyle} /><div className="mt-1.5 grid grid-cols-4 gap-1.5">{[100_000, 300_000, 500_000, 1_000_000].map(v => <button key={v} onClick={() => setMonthly(v)} className="rounded-md py-1 text-[11.5px] font-semibold" style={{ border: `1px solid ${LINE}`, background: 'var(--ci-card)', color: INK1 }}>{fmtNum(v / 10000)}만</button>)}</div></div>}
          </>}
        </div>
        {/* 모멘텀 로테이션 설정 — top-N·lookback·레짐 (유니버스 고정) */}
        {isMomentum && (
          <div className="rounded-lg p-3" style={{ border: '1px solid rgba(91,157,255,.32)', background: 'rgba(91,157,255,.06)' }}>
            <div className="mb-2 text-[13.5px] font-bold" style={{ color: GLOW }}>📈 모멘텀 로테이션 설정</div>
            <label className="mb-2 flex flex-col gap-1"><span className="text-[11.5px]" style={{ color: INK3 }}>자산군</span>
              <div className="grid grid-cols-4 gap-1.5">{(['US_STOCK', 'ETF', 'STOCK', 'CRYPTO'] as MomentumAssetType[]).map(ac => (
                <button key={ac} onClick={() => setMomentum({ ...momentum, assetType: ac, lookbackDays: MOMENTUM_ASSET_META[ac].defaultLookback })} className="rounded-md py-1.5 text-[12.5px] font-semibold" style={{ border: `1px solid ${momentum.assetType === ac ? GLOW : LINE}`, background: momentum.assetType === ac ? 'rgba(91,157,255,.16)' : 'var(--ci-card)', color: momentum.assetType === ac ? GLOW : INK1 }}>{MOMENTUM_ASSET_META[ac].label}</button>
              ))}</div>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <label className="flex flex-col gap-1"><span className="text-[11.5px]" style={{ color: INK3 }}>상위 N종목</span><input type="number" min={1} max={20} step={1} value={momentum.topN} onChange={e => setMomentum({ ...momentum, topN: Number(e.target.value) || 1 })} className="rounded px-2 py-1.5 text-[13px] outline-none" style={fieldStyle} /></label>
              <label className="flex flex-col gap-1"><span className="text-[11.5px]" style={{ color: INK3 }}>모멘텀 기간(일)</span><input type="number" min={20} step={1} value={momentum.lookbackDays} onChange={e => setMomentum({ ...momentum, lookbackDays: Number(e.target.value) || 20 })} className="rounded px-2 py-1.5 text-[13px] outline-none" style={fieldStyle} /></label>
              <label className="flex flex-col gap-1"><span className="text-[11.5px]" style={{ color: INK3 }}>약세장 노출</span><input type="number" min={0} max={1} step={0.1} value={momentum.regimeFloor} onChange={e => setMomentum({ ...momentum, regimeFloor: Number(e.target.value) || 0 })} className="rounded px-2 py-1.5 text-[13px] outline-none" style={fieldStyle} /></label>
            </div>
            <label className="mt-2 flex items-center gap-2 text-[13px]" style={{ color: INK1 }}>
              <input type="checkbox" className="accent-[#5b9dff]" checked={momentum.regimeFilter} onChange={e => setMomentum({ ...momentum, regimeFilter: e.target.checked })} />
              {MOMENTUM_ASSET_META[momentum.assetType].benchmark} 레짐 필터 (약세장 시 노출 ×{momentum.regimeFloor})
            </label>
            <div className="mt-1.5 text-[11.5px]" style={{ color: INK3 }}>{MOMENTUM_ASSET_META[momentum.assetType].label} 약 {MOMENTUM_ASSET_META[momentum.assetType].poolSize}종목 유니버스. <b style={{ color: 'var(--ci-ink0)' }}>종목 선택은 무시</b>되고 매월 모멘텀 랭킹으로 자동 교체됩니다. 일봉 로드로 첫 실행은 수십 초 걸릴 수 있어요.</div>
          </div>
        )}
        {/* 터틀 전용 설정 — 채널 기간·ADX·유닛·레버리지 (종목별로 다르게) */}
        {strat?.id === TURTLE_PRESET_ID && (
          <div className="rounded-lg p-3" style={{ border: '1px solid rgba(91,157,255,.32)', background: 'rgba(91,157,255,.06)' }}>
            <div className="mb-2 text-[13.5px] font-bold" style={{ color: GLOW }}>🐢 터틀 설정 (종목별로 조정 가능)</div>
            <div className="grid grid-cols-3 gap-2">
              <label className="flex flex-col gap-1"><span className="text-[11.5px]" style={{ color: INK3 }}>진입 채널</span><input type="number" min={5} step={1} value={turtle.entryPeriod} onChange={e => setTurtle({ ...turtle, entryPeriod: Number(e.target.value) || 0 })} className="rounded px-2 py-1.5 text-[13px] outline-none" style={fieldStyle} /></label>
              <label className="flex flex-col gap-1"><span className="text-[11.5px]" style={{ color: INK3 }}>청산 채널</span><input type="number" min={2} step={1} value={turtle.exitPeriod} onChange={e => setTurtle({ ...turtle, exitPeriod: Number(e.target.value) || 0 })} className="rounded px-2 py-1.5 text-[13px] outline-none" style={fieldStyle} /></label>
              <label className="flex flex-col gap-1"><span className="text-[11.5px]" style={{ color: INK3 }}>ADX 임계</span><input type="number" min={0} step={1} value={turtle.adxThreshold} onChange={e => setTurtle({ ...turtle, adxThreshold: Number(e.target.value) || 0 })} className="rounded px-2 py-1.5 text-[13px] outline-none" style={fieldStyle} /></label>
              <label className="flex flex-col gap-1"><span className="text-[11.5px]" style={{ color: INK3 }}>최대 유닛</span><input type="number" min={1} max={10} step={1} value={turtle.maxUnits} onChange={e => setTurtle({ ...turtle, maxUnits: Number(e.target.value) || 1 })} className="rounded px-2 py-1.5 text-[13px] outline-none" style={fieldStyle} /></label>
              <label className="flex flex-col gap-1"><span className="text-[11.5px]" style={{ color: INK3 }}>레버리지</span><input type="number" min={1} max={20} step={1} value={turtle.leverage} onChange={e => setTurtle({ ...turtle, leverage: Number(e.target.value) || 1 })} className="rounded px-2 py-1.5 text-[13px] outline-none" style={fieldStyle} /></label>
              <label className="flex flex-col gap-1"><span className="text-[11.5px]" style={{ color: INK3 }}>트레일링 %</span><input type="number" min={0} step={0.5} value={turtle.trailingStopPercent} onChange={e => setTurtle({ ...turtle, trailingStopPercent: Number(e.target.value) || 0 })} className="rounded px-2 py-1.5 text-[13px] outline-none" style={fieldStyle} /></label>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button onClick={() => setTurtle({ entryPeriod: 100, exitPeriod: 30, adxThreshold: 15, maxUnits: 5, leverage: 7, trailingStopPercent: 4 })} className="rounded-md px-2 py-1 text-[12px] font-semibold" style={{ border: `1px solid ${LINE}`, background: 'var(--ci-card)', color: INK1 }}>BTC 프리셋 (100/30·ADX15·7배·5유닛)</button>
              <button onClick={() => setTurtle({ entryPeriod: 80, exitPeriod: 40, adxThreshold: 25, maxUnits: 4, leverage: 4, trailingStopPercent: 5 })} className="rounded-md px-2 py-1 text-[12px] font-semibold" style={{ border: `1px solid ${LINE}`, background: 'var(--ci-card)', color: INK1 }}>ETH 프리셋 (80/40·ADX25·4배·4유닛)</button>
            </div>
            <div className="mt-1.5 text-[11.5px]" style={{ color: INK3 }}>롱·숏 양방향 + 피라미딩으로 자동 구성됩니다. 백테스트는 일봉, 라이브(Bitget 선물)는 선택한 봉 기준.</div>
          </div>
        )}
        {/* 고급 설정 — 리스크·비용·방향·배당·지표. 모멘텀은 엔진이 거래 비용만 반영하므로 나머지 입력은 숨긴다 */}
        {strat && <details className="rounded-lg" style={{ border: `1px solid ${LINE}`, background: 'var(--ci-card)' }}>
          <summary className="cursor-pointer list-none px-3 py-2.5 text-[13.5px] font-semibold" style={{ color: INK1 }}>{isMomentum ? '고급 설정 — 거래 비용' : '고급 설정 — 리스크·비용·지표'}</summary>
          <div className="flex flex-col gap-3.5 px-3 pb-3">
            {isMomentum && <div className="rounded-lg px-3 py-2 text-[12px] leading-relaxed" style={{ background: 'rgba(91,157,255,.07)', border: '1px solid rgba(91,157,255,.2)', color: INK2 }}>모멘텀 로테이션은 전용 엔진으로 실행돼 <b style={{ color: 'var(--ci-ink0)' }}>거래 비용(슬리피지·수수료)만 반영</b>됩니다. 리스크 관리·매매 방향·적립식·배당 설정은 이 전략에서 사용되지 않아요.</div>}
            {!isMomentum && <div>
              <div className="mb-1.5 text-[12px] font-bold" style={{ color: INK2 }}>리스크 관리 (%, 비우면 미적용)</div>
              <div className="grid grid-cols-3 gap-2">
                <label className="flex flex-col gap-1"><span className="text-[11.5px]" style={{ color: INK3 }}><Term k="손절" compact>손절</Term></span><input type="number" min={0} step="0.1" value={adv.stopLoss} onChange={e => setAdv({ ...adv, stopLoss: e.target.value })} placeholder="–" className="rounded px-2 py-1.5 text-[13px] outline-none" style={fieldStyle} /></label>
                <label className="flex flex-col gap-1"><span className="text-[11.5px]" style={{ color: INK3 }}><Term k="익절" compact>익절</Term></span><input type="number" min={0} step="0.1" value={adv.takeProfit} onChange={e => setAdv({ ...adv, takeProfit: e.target.value })} placeholder="–" className="rounded px-2 py-1.5 text-[13px] outline-none" style={fieldStyle} /></label>
                <label className="flex flex-col gap-1"><span className="text-[11.5px]" style={{ color: INK3 }}><Term k="트레일링스탑" compact>트레일링</Term></span><input type="number" min={0} step="0.1" value={adv.trailingStop} onChange={e => setAdv({ ...adv, trailingStop: e.target.value })} placeholder="–" className="rounded px-2 py-1.5 text-[13px] outline-none" style={fieldStyle} /></label>
              </div>
            </div>}
            <div>
              <div className="mb-1.5 text-[12px] font-bold" style={{ color: INK2 }}>거래 비용 (%, 기본 0.1)</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1"><span className="text-[11.5px]" style={{ color: INK3 }}><Term k="슬리피지" compact>슬리피지</Term></span><input type="number" min={0} step="0.05" value={adv.slippage} onChange={e => setAdv({ ...adv, slippage: e.target.value })} placeholder="0.1" className="rounded px-2 py-1.5 text-[13px] outline-none" style={fieldStyle} /></label>
                <label className="flex flex-col gap-1"><span className="text-[11.5px]" style={{ color: INK3 }}><Term k="수수료" compact>수수료율</Term></span><input type="number" min={0} step="0.05" value={adv.commission} onChange={e => setAdv({ ...adv, commission: e.target.value })} placeholder="0.1" className="rounded px-2 py-1.5 text-[13px] outline-none" style={fieldStyle} /></label>
              </div>
            </div>
            {!isMomentum && !rebalActive && <div>
              <div className="mb-1.5 text-[12px] font-bold" style={{ color: INK2 }}>레버리지 (배, 선물 — 비우면 1배/현물)</div>
              <input type="number" min={1} max={20} step={1} value={adv.leverage} onChange={e => setAdv({ ...adv, leverage: e.target.value })} placeholder={preset?.leverage ? `${preset.leverage} (권장)` : '1'} className="w-full rounded px-2 py-1.5 text-[13px] outline-none" style={fieldStyle} />
              <div className="mt-1 text-[11.5px]" style={{ color: COMPASS }}>⚠️ 손익이 배수만큼 증폭되고 증거금 소진 시 강제청산됩니다. 백테스트는 일봉 근사이며 실거래 결과와 다를 수 있어요.</div>
            </div>}
            {!isMomentum && <div style={rebalActive ? { opacity: .5 } : undefined}>
              <div className="mb-1.5 text-[12px] font-bold" style={{ color: INK2 }}>매매 방향</div>
              <div className="flex gap-1">{TDIR.map(([k, l]) => <button key={k} disabled={rebalActive} onClick={() => setAdv({ ...adv, tradeDirection: k })} className="flex-1 rounded-md py-1.5 text-[12px] font-semibold disabled:cursor-not-allowed" style={seg(adv.tradeDirection === k)}>{l}</button>)}</div>
              {rebalActive && <div className="mt-1 text-[11.5px]" style={{ color: COMPASS }}>2자산 리밸런싱은 매수(LONG)만 지원합니다.</div>}
              {!rebalActive && adv.tradeDirection === 'LONG_SHORT_FLAT' && <div className="mt-1 text-[11.5px]" style={{ color: INK3 }}>독립 롱+숏: 청산 시 현금으로 빠져 다음 돌파를 대기합니다(전환 아님). 숏 조건은 프리셋(터틀)에서 제공됩니다.</div>}
            </div>}
            {!isMomentum && !rebalActive && <div>
              <div className="mb-1.5 text-[12px] font-bold" style={{ color: INK2 }}><Term k="분할매수" compact>분할 매수 (최대 동시 보유)</Term></div>
              <div className="flex gap-1">{POS_OPTS.map(([k, l]) => { const lk = posLocked(k); return <button key={k} disabled={lk} onClick={() => setAdv({ ...adv, maxPositions: k })} title={lk ? `${tierLabel('BASIC')} 이상에서 다중 포지션을 이용할 수 있어요` : undefined} className="flex-1 rounded-md py-1.5 text-[12px] font-semibold disabled:cursor-not-allowed disabled:opacity-40" style={seg(adv.maxPositions === k)}>{l}{lk ? ' 🔒' : ''}</button>; })}</div>
            </div>}
            {!isMomentum && !rebalActive && <div>
              <div className="mb-1.5 text-[12px] font-bold" style={{ color: INK2 }}><Term k="포지션사이징" compact>포지션 사이징</Term></div>
              <div className="flex gap-1">{SIZING.map(([k, l]) => <button key={k} onClick={() => setAdv({ ...adv, positionSizing: k })} className="flex-1 rounded-md py-1.5 text-[12px] font-semibold" style={seg(adv.positionSizing === k)}>{l}</button>)}</div>
              {adv.positionSizing !== 'ALL_IN' && <input type="number" min={0} value={adv.positionValue} onChange={e => setAdv({ ...adv, positionValue: e.target.value })} placeholder={adv.positionSizing === 'PERCENT' ? '1회 매수 자본 비율 % (예: 50)' : '1회 매수 금액'} className="mt-1.5 w-full rounded px-2 py-1.5 text-[13px] outline-none" style={fieldStyle} />}
            </div>}
            {!isMomentum && isUsEtf && <label className="flex items-center justify-between text-[13px]" style={{ color: INK1 }}><span className="font-semibold"><Term k="배당재투자" compact>배당 자동 재투자 (DRIP)</Term></span><input type="checkbox" className="accent-[#5b9dff]" checked={adv.dividendReinvest} onChange={e => setAdv({ ...adv, dividendReinvest: e.target.checked })} /></label>}
            {!isMomentum && editInd.length > 0 && <div>
              <div className="mb-1.5 text-[12px] font-bold" style={{ color: INK2 }}>지표 파라미터</div>
              <div className="grid grid-cols-2 gap-2">
                {editInd.flatMap((ind, idx) => {
                  const sameType = editInd.filter(i => i.type === ind.type).length;
                  const sameIdx = editInd.slice(0, idx).filter(i => i.type === ind.type).length;
                  const pre = sameType > 1 ? (sameIdx === 0 ? '단기 ' : '장기 ') : '';
                  return Object.entries(ind.parameters).map(([k, v]) => (
                    <label key={`${idx}-${k}`} className="flex flex-col gap-1"><span className="text-[11.5px]" style={{ color: INK3 }}>{pre}{PARAM_LABEL[k] || `${ind.type} ${k}`}</span><input type="number" min={1} value={v} onChange={e => setEditInd(editInd.map((x, i) => i === idx ? { ...x, parameters: { ...x.parameters, [k]: e.target.value === '' ? 1 : Number(e.target.value) } } : x))} className="rounded px-2 py-1.5 text-[13px] outline-none" style={fieldStyle} /></label>
                  ));
                })}
              </div>
            </div>}
            {!isMomentum && (editEntry.some(c => THRESH_INDS.includes(c.indicator) && !c.valueExpression) || editExit.some(c => THRESH_INDS.includes(c.indicator) && !c.valueExpression)) && <div>
              <div className="mb-1.5 text-[12px] font-bold" style={{ color: INK2 }}>매매 기준값</div>
              <div className="grid grid-cols-2 gap-2">
                {editEntry.map((c, idx) => THRESH_INDS.includes(c.indicator) && !c.valueExpression ? <label key={`en-${idx}`} className="flex flex-col gap-1"><span className="text-[11.5px]" style={{ color: INK3 }}>{condLabel(c.indicator, '매수')}</span><input type="number" value={c.value} onChange={e => setEditEntry(editEntry.map((x, i) => i === idx ? { ...x, value: e.target.value === '' ? 0 : Number(e.target.value) } : x))} className="rounded px-2 py-1.5 text-[13px] outline-none" style={fieldStyle} /></label> : null)}
                {editExit.map((c, idx) => THRESH_INDS.includes(c.indicator) && !c.valueExpression ? <label key={`ex-${idx}`} className="flex flex-col gap-1"><span className="text-[11.5px]" style={{ color: INK3 }}>{condLabel(c.indicator, '매도')}</span><input type="number" value={c.value} onChange={e => setEditExit(editExit.map((x, i) => i === idx ? { ...x, value: e.target.value === '' ? 0 : Number(e.target.value) } : x))} className="rounded px-2 py-1.5 text-[13px] outline-none" style={fieldStyle} /></label> : null)}
              </div>
            </div>}
            {!isMomentum && (editEntry.some(c => c.valueExpression) || editExit.some(c => c.valueExpression)) && <div>
              <div className="mb-1.5 text-[12px] font-bold" style={{ color: INK2 }}>수식 조건 <span className="font-normal" style={{ color: INK3 }}>(OPEN·PREV_HIGH·PREV_LOW)</span></div>
              <div className="flex flex-col gap-2">
                {editEntry.map((c, idx) => c.valueExpression != null ? <label key={`enx-${idx}`} className="flex flex-col gap-1"><span className="text-[11.5px]" style={{ color: INK3 }}>진입 수식</span><input value={c.valueExpression} onChange={e => setEditEntry(editEntry.map((x, i) => i === idx ? { ...x, valueExpression: e.target.value } : x))} className="rounded px-2 py-1.5 font-mono text-[12px] outline-none" style={fieldStyle} /></label> : null)}
                {editExit.map((c, idx) => c.valueExpression != null ? <label key={`exx-${idx}`} className="flex flex-col gap-1"><span className="text-[11.5px]" style={{ color: INK3 }}>청산 수식</span><input value={c.valueExpression} onChange={e => setEditExit(editExit.map((x, i) => i === idx ? { ...x, valueExpression: e.target.value } : x))} className="rounded px-2 py-1.5 font-mono text-[12px] outline-none" style={fieldStyle} /></label> : null)}
              </div>
            </div>}
          </div>
        </details>}
        {/* 다중 자산 리밸런싱 (기본 자산 + 최대 4개 추가 = 총 5자산) — 모멘텀(전용 엔진)은 미지원이라 숨김 */}
        {strat && !isMomentum && <details className="rounded-lg" style={{ border: `1px solid ${LINE}`, background: 'var(--ci-card)' }}>
          <summary className="cursor-pointer list-none px-3 py-2.5 text-[13.5px] font-semibold" style={{ color: INK1 }}>다중 자산 <Term k="리밸런싱" compact>리밸런싱</Term> {rebalActive ? `· ${extras.length + 1}자산` : '(선택 · 최대 5자산)'}</summary>
          <div className="flex flex-col gap-2.5 px-3 pb-3">
            <p className="text-[12px]" style={{ color: INK3 }}>자산을 추가하면(최대 {MAX_REBAL_EXTRAS}개) 비중대로 주기적으로 리밸런싱합니다. 통화가 같은 자산끼리만 가능해요(전부 미국주식·ETF 또는 전부 그 외).</p>
            {rebalActive && <>
              <div className="flex flex-col gap-1.5">
                {/* 기본 자산 */}
                <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ border: '1px solid rgba(91,157,255,.32)', background: 'rgba(91,157,255,.08)' }}>
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold" style={{ color: GLOW }}>{target.name || '기본 자산'} <span className="font-mono text-[11.5px]" style={{ color: INK3 }}>{target.symbol}</span></span>
                  <input type="number" min={1} max={99} step={1} value={firstWeight} onChange={e => setFirstWeight(Number(e.target.value) || 0)} aria-label="기본 자산 비중" className="w-16 shrink-0 rounded px-2 py-1 text-right font-mono text-[13px] outline-none" style={fieldStyle} />
                  <span className="shrink-0 text-[12px]" style={{ color: INK3 }}>%</span>
                </div>
                {/* 추가 자산 */}
                {extras.map((a, i) => (
                  <div key={a.symbol} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ border: `1px solid ${LINE}`, background: 'var(--ci-card)' }}>
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{a.name} <span className="font-mono text-[11.5px]" style={{ color: INK3 }}>{a.symbol}</span></span>
                    <input type="number" min={1} max={99} step={1} value={a.weight} onChange={e => setExtras(extras.map((x, k) => k === i ? { ...x, weight: Number(e.target.value) || 0 } : x))} aria-label={`${a.name} 비중`} className="w-16 shrink-0 rounded px-2 py-1 text-right font-mono text-[13px] outline-none" style={fieldStyle} />
                    <span className="shrink-0 text-[12px]" style={{ color: INK3 }}>%</span>
                    <button onClick={() => removeExtra(i)} className="shrink-0 text-[12px] font-semibold" style={{ color: UP }}>제거</button>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <button onClick={equalSplit} className="rounded-md px-2.5 py-1 text-[12px] font-semibold" style={{ border: `1px solid ${LINE}`, background: 'var(--ci-card)', color: INK1 }}>균등 분배</button>
                <span className="font-mono text-[12.5px] font-bold" style={{ color: weightsBad ? COMPASS : INK3 }}>비중 합 {Math.round(weightSum * 100) / 100}%{weightsBad ? ' ⚠️ 100% 필요' : ''}</span>
              </div>
              <div>
                <div className="mb-1 text-[12px]" style={{ color: INK2 }}>리밸런싱 주기</div>
                <div className="flex gap-1">{REBAL.map(([k, l]) => <button key={k} onClick={() => setRebalanceFreq(k)} className="flex-1 rounded-md py-1.5 text-[12px] font-semibold" style={seg(rebalanceFreq === k)}>{l}</button>)}</div>
              </div>
            </>}
            {extras.length < MAX_REBAL_EXTRAS && <AssetSearchBox cryptoList={cryptoList} onPick={(c, n, a) => addExtra(c, n, a)} />}
          </div>
        </details>}
        <button onClick={onRun} disabled={!strat || running || symbolMissing || customExceeds || weightsBad} className="flex items-center justify-center gap-2 rounded-lg py-3.5 text-[15px] font-bold disabled:cursor-not-allowed" style={strat && !running && !symbolMissing && !customExceeds && !weightsBad ? { background: `linear-gradient(180deg, ${GLOW}, ${ACCENT})`, color: '#fff', boxShadow: '0 10px 24px -10px rgba(60,120,255,.5)' } : { background: 'var(--ci-card)', color: INK3 }}>
          {running ? '실행 중…' : `▶ ${!strat ? '전략을 선택해주세요' : symbolMissing ? '종목을 선택해주세요' : customExceeds ? '기간 한도 초과' : weightsBad ? '비중 합 100% 필요' : '백테스트 실행'}`}
        </button>
        <button onClick={onShowHistory} disabled={historyCount === 0} className="flex items-center justify-center gap-2 rounded-lg px-3.5 py-2.5 text-[14px] font-semibold disabled:opacity-50" style={{ border: `1px solid ${LINE}`, background: 'var(--ci-card)', color: INK1 }}>🕓 이전 결과 <span style={{ color: INK3 }}>({historyCount})</span></button>
      </div>
    </aside>
  );
};

export default BacktestRunner;
