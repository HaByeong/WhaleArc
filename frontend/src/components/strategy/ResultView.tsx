import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import type { BacktestResult } from '../../services/strategyService';
import BacktestChart, { type BtMarker } from '../BacktestChart';
import { Term } from '../GlossaryTerm';
import { UP, DOWN, COMPASS, SONAR as GLOW, INK1, INK2, INK3, LINE, LINE_STRONG as LINE_S, mkCard } from '../console/format';
import { fmtNum, type Strat } from './shared';
import { StationBar } from './ui';

/* 백테스트 결과 뷰 — KPI·자동 해석·가격/자산 차트·상세 지표·거래 내역 */

const KPI = ({ label, value, sub, color }: { label: ReactNode; value: string; sub: string; color: string }) => (
  <div style={{ ...mkCard, padding: '20px 22px' }}>
    <div className="text-[12.5px] font-semibold tracking-[.12em]" style={{ color: INK2 }}>{label}</div>
    <div className="mt-2 font-mono text-[32.5px] font-bold tracking-tight" style={{ color }}>{value}</div>
    <div className="mt-1 text-[13px]" style={{ color: INK3 }}>{sub}</div>
  </div>
);

const TRADE_LABEL: Record<string, string> = { BUY: '매수', SELL: '매도', SHORT: '공매도', COVER: '커버' };
const REBAL_LABEL: Record<string, string> = { MONTHLY: '매월', QUARTERLY: '분기', YEARLY: '매년' };
// 리밸런싱 모드 접미사 유형(BUY_A·SELL_B·REBALANCE_SELL_A 등)까지 한국어 라벨로 (기존 2자산도 원문 그대로 노출되던 것 수정)
const tradeLabel = (t: string) => {
  if (TRADE_LABEL[t]) return TRADE_LABEL[t];
  if (t.startsWith('REBALANCE_SELL')) return `리밸런싱 매도 (${t.slice(-1)})`;
  if (t.startsWith('BUY_')) return `매수 (${t.slice(-1)})`;
  if (t.startsWith('SELL_')) return `매도 (${t.slice(-1)})`;
  return t;
};
const isBuyType = (t: string) => t.startsWith('BUY') || t === 'COVER';
const isSellCloseType = (t: string) => t === 'COVER' || t.startsWith('SELL') || t.startsWith('REBALANCE_SELL');
// 차트 마커용 유형 정규화 — BUY_A 등이 BtMarker 유니언 밖이라 매도색으로 찍히던 버그 수정
const markerType = (t: string): BtMarker['type'] =>
  t === 'SHORT' || t === 'COVER' ? t : t.startsWith('BUY') ? 'BUY' : 'SELL';
// 자산별 분해 카드 비중 색 (leg 순서 고정 팔레트)
const LEG_COLORS = ['#5b9dff', '#f5d061', '#3fd6a0', '#e0457b', '#9d7bff'];

const ResultView = ({ result, strat, onExport }: { result: BacktestResult; strat: Strat | null; onExport: () => void }) => {
  const [tradeLimit, setTradeLimit] = useState(50); // 장기+단타 조합이면 수백 행이라 50건씩 증분 렌더(전체는 CSV)
  useEffect(() => setTradeLimit(50), [result]);     // 새 결과가 오면 펼침 초기화
  const isUsd = result.currency === 'USD';
  const cur = isUsd ? '$' : '₩';
  const num = (v: number | undefined | null) => (Number.isFinite(v as number) ? (v as number) : 0); // 필수 숫자 필드 방어
  // USD 결과는 서버 환율이 있을 때만 원화 환산 병기 — 환율 누락 시 임의 환율로 환산하지 않는다
  const rate = isUsd && Number.isFinite(result.exchangeRate as number) && (result.exchangeRate as number) > 0 ? (result.exchangeRate as number) : null;
  const money = (v: number | undefined | null) => isUsd ? `$${fmtNum(num(v))}${rate ? ` (₩${fmtNum(Math.round(num(v) * rate))})` : ''}` : `₩${fmtNum(num(v))}`;
  const up = num(result.totalReturnRate) >= 0;
  const trades = result.trades ?? [];
  // 가격차트 + 매매 마커 (거래 날짜 → 인덱스). 마커에 사유·손익을 실어 차트 hover에서 보여준다.
  const price = (result.priceData ?? []).map(p => p.close);
  const priceDates = (result.priceData ?? []).map(p => p.date);
  const dateIdx = useMemo(() => { const m = new Map<string, number>(); (result.priceData ?? []).forEach((p, i) => m.set(p.date, i)); return m; }, [result.priceData]);
  const equity = (result.equityCurve ?? []).map(p => p.value);
  const equityDates = (result.equityCurve ?? []).map(p => p.date);
  const equityIdx = useMemo(() => { const m = new Map<string, number>(); (result.equityCurve ?? []).forEach((p, i) => m.set(p.date, i)); return m; }, [result.equityCurve]);
  const bh = (result.buyHoldCurve ?? []).map(p => p.value);
  const fmtV = (v: number) => `${cur}${fmtNum(v)}`;
  const priceMarkers: BtMarker[] = trades.map(t => ({ i: dateIdx.get(t.date) ?? -1, type: markerType(t.type), reason: t.reason, pnl: t.pnl, pnlPercent: t.pnlPercent, price: t.price })).filter(m => m.i >= 0);
  const equityMarkers: BtMarker[] = trades.map(t => ({ i: equityIdx.get(t.date) ?? -1, type: markerType(t.type), reason: t.reason, pnl: t.pnl, pnlPercent: t.pnlPercent })).filter(m => m.i >= 0);
  // 자산별 분해 — 신엔진의 assetBreakdown 우선, 과거 저장 결과(2자산 first/second 필드만)는 합성 폴백
  const breakdown = (result.assetBreakdown && result.assetBreakdown.length > 0)
    ? result.assetBreakdown
    : result.secondStockCode ? [
        { stockCode: result.stockCode, stockName: result.stockName, weight: result.firstAssetWeight ?? 0, finalValue: result.firstAssetFinalValue ?? 0, tradeCount: result.firstAssetTradeCount ?? 0 },
        { stockCode: result.secondStockCode, stockName: result.secondStockName || result.secondStockCode, weight: result.secondAssetWeight ?? 0, finalValue: result.secondAssetFinalValue ?? 0, tradeCount: result.secondAssetTradeCount ?? 0 },
      ] : [];

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
        badge={<span className="rounded-full px-2.5 py-1 text-[13px] font-bold" style={{ background: up ? 'rgba(239,77,77,.16)' : 'rgba(77,138,255,.16)', color: up ? '#ffd9d9' : '#cfe1ff' }}>{up ? '수익' : '손실'} {sub(result.totalReturnRate)}</span>} />
      {/* 테스트 요약 */}
      <div style={{ ...mkCard, padding: '22px 24px' }}>
        <div className="mb-3.5 flex items-center justify-between"><h3 className="text-[15px] font-bold">테스트 요약</h3>
          <button onClick={onExport} className="rounded-lg px-3 py-1.5 text-[13px] font-semibold" style={{ border: `1px solid ${LINE_S}`, color: GLOW }}>⤓ CSV 내보내기</button>
        </div>
        <div className="grid gap-x-6 gap-y-2.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {[['전략', result.strategyName || strat?.name || '—'], ['종목', `${result.stockName} (${result.stockCode})`], ['기간', `${result.startDate} ~ ${result.endDate}`], ['초기 투자금', money(result.initialCapital)],
            ['총 거래', `${num(result.totalTrades)}회`], ['배당 재투자', result.dividendReinvest === false ? 'OFF' : (isUsd ? 'ON' : '—')],
            ...(isUsd && rate ? [['환율 (USD/KRW)', `₩${fmtNum(rate)}`] as [string, string]] : [])].map(([l, v]) => (
            <div key={l} className="flex items-baseline justify-between border-b border-dotted py-1.5 text-[14px]" style={{ borderColor: LINE }}><span style={{ color: INK2 }}>{l}</span><span className="font-mono font-semibold">{v}</span></div>
          ))}
          {result.monthlyContribution ? <div className="flex items-baseline justify-between border-b border-dotted py-1.5 text-[14px]" style={{ borderColor: LINE }}><span style={{ color: INK2 }}><Term k="적립식" compact>적립식</Term></span><span className="font-mono font-semibold">월 {money(result.monthlyContribution)} × {result.contributionCount ?? 0}회</span></div> : null}
          {result.totalContribution ? <div className="flex items-baseline justify-between border-b border-dotted py-1.5 text-[14px]" style={{ borderColor: LINE }}><span style={{ color: INK2 }}>총 납입액</span><span className="font-mono font-semibold">{money(result.totalContribution)}</span></div> : null}
          {result.totalDividendsReceived ? <div className="flex items-baseline justify-between border-b border-dotted py-1.5 text-[14px]" style={{ borderColor: LINE }}><span style={{ color: INK2 }}>받은 배당 합계</span><span className="font-mono font-semibold">{money(result.totalDividendsReceived)}</span></div> : null}
        </div>
      </div>
      {/* 모멘텀 로테이션 — 월별 보유 top-N 이력 */}
      {result.rotationHistory && result.rotationHistory.length > 0 && (
        <div style={{ ...mkCard, padding: '20px 22px' }}>
          <h3 className="mb-1 text-[15px] font-bold">월별 보유 이력 (모멘텀 Top{result.rotationHistory[0]?.holdings.length || ''})</h3>
          <p className="mb-3 text-[13px]" style={{ color: INK2 }}>매월 첫 거래일에 모멘텀 랭킹으로 교체된 보유 종목입니다. 약세장(SPY&lt;200일선)엔 노출을 줄입니다.</p>
          <div className="no-scrollbar flex flex-col gap-1.5 overflow-y-auto" style={{ maxHeight: 360 }}>
            {result.rotationHistory.slice().reverse().map((snap) => (
              <div key={snap.date} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: 'var(--ci-card)', border: `1px solid ${LINE}` }}>
                <span className="shrink-0 font-mono text-[13px] font-semibold" style={{ color: INK1, width: 78 }}>{snap.date.slice(0, 7)}</span>
                {snap.regimeBear && <span className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-bold" style={{ background: 'rgba(77,138,255,.16)', color: '#cfe1ff' }}>약세 ½</span>}
                <div className="flex flex-wrap gap-1">
                  {snap.holdings.length === 0
                    ? <span className="text-[13px]" style={{ color: INK3 }}>현금 (양수 모멘텀 없음)</span>
                    : snap.holdings.map(h => (
                      <span key={h.symbol} className="rounded px-1.5 py-0.5 font-mono text-[12px]" style={{ background: 'rgba(91,157,255,.12)', color: 'var(--ci-ink0)', border: '1px solid rgba(91,157,255,.2)' }}>
                        {h.symbol} <span style={{ color: h.momentum >= 0 ? UP : DOWN }}>{h.momentum >= 0 ? '+' : ''}{(h.momentum * 100).toFixed(0)}%</span>
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* 다중 자산 리밸런싱 분해 (2~5자산) */}
      {breakdown.length > 0 && (
        <div style={{ ...mkCard, padding: '20px 24px' }}>
          <h3 className="mb-3.5 text-[15px] font-bold">자산별 분해 ({breakdown.length}자산 리밸런싱)</h3>
          <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
            {breakdown.map((b, i) => (
              <div key={b.stockCode} className="rounded-[10px] px-4 py-3.5" style={{ background: 'var(--ci-card)', border: `1px solid ${LINE}` }}>
                <div className="truncate text-[12px]" style={{ color: INK2 }}>{b.stockName} <span className="font-mono" style={{ color: LEG_COLORS[i % LEG_COLORS.length] }}>{b.weight}%</span></div>
                <div className="mt-1 font-mono text-[17.5px] font-bold">{cur}{fmtNum(b.finalValue)}</div>
                {isUsd && rate && <div className="font-mono text-[12px]" style={{ color: INK3 }}>₩{fmtNum(Math.round(b.finalValue * rate))}</div>}
                <div className="mt-0.5 text-[12px]" style={{ color: INK3 }}>{b.tradeCount}회 거래</div>
              </div>
            ))}
            <div className="rounded-[10px] px-4 py-3.5" style={{ background: 'var(--ci-card)', border: `1px solid ${LINE}` }}>
              <div className="text-[12px]" style={{ color: INK2 }}>리밸런싱</div>
              <div className="mt-1 font-mono text-[17.5px] font-bold">{num(result.rebalanceCount)}회</div>
              <div className="mt-0.5 text-[12px]" style={{ color: INK3 }}>{REBAL_LABEL[result.rebalanceFrequency || 'MONTHLY']} 주기</div>
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
          <span className="text-[16px] font-bold">📋 결과 해석</span>
          <span className="rounded px-1.5 py-0.5 text-[11px] font-bold" style={{ background: 'rgba(91,157,255,.14)', color: GLOW }}>초보자용</span>
        </div>
        <div className="mb-3.5 rounded-lg px-3.5 py-3 text-[14.5px] font-semibold" style={{ background: `${TONE_C[headline.tone]}1f`, border: `1px solid ${TONE_C[headline.tone]}66`, color: 'var(--ci-ink0)' }}>{headline.text}</div>
        <ul className="m-0 flex flex-col gap-2 p-0" style={{ listStyle: 'none' }}>
          {interp.map((it, i) => (
            <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed">
              <span className="mt-[6px] h-2 w-2 shrink-0 rounded-full" style={{ background: TONE_C[it.tone] }} />
              <span style={{ color: INK1 }}>{it.text}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3.5 text-[12px]" style={{ color: INK3 }}>※ 과거 성과가 미래 수익을 보장하지 않습니다. 백테스트는 전략 검증을 돕는 참고 자료예요.</p>
      </div>
      {/* 가격 차트 */}
      <div style={{ ...mkCard, padding: '20px 24px' }}>
        <div className="mb-3 flex items-center justify-between"><h3 className="text-[15px] font-bold">가격 차트 & 매매 포인트</h3>
          <div className="flex flex-wrap gap-3.5 text-[12px]" style={{ color: INK1 }}><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: UP }} />매수 {trades.filter(t => t.type.startsWith('BUY')).length}</span><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: DOWN }} />매도 {trades.filter(t => t.type.startsWith('SELL') || t.type.startsWith('REBALANCE_SELL')).length}</span>{trades.some(t => t.type === 'SHORT' || t.type === 'COVER') && <><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: DOWN }} />공매도 {trades.filter(t => t.type === 'SHORT').length}</span><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: UP }} />커버 {trades.filter(t => t.type === 'COVER').length}</span></>}</div>
        </div>
        <div style={{ height: 268 }}><BacktestChart pts={price} dates={priceDates} markers={priceMarkers} height={268} valueFmt={fmtV} glow={GLOW} upColor={UP} downColor={DOWN} /></div>
      </div>
      {/* 자산 추이 */}
      <div style={{ ...mkCard, padding: '20px 24px' }}>
        <div className="mb-3 flex items-center justify-between"><h3 className="text-[15px] font-bold">자산 변동 추이</h3>
          <div className="flex gap-3.5 text-[12px]" style={{ color: INK1 }}><span className="inline-flex items-center gap-1.5"><span style={{ width: 14, height: 2, background: GLOW }} />전략</span>{bh.length > 0 && <span className="inline-flex items-center gap-1.5"><span style={{ width: 14, borderTop: `2px dashed ${COMPASS}` }} /><Term k="BuyHold" compact>Buy &amp; Hold</Term> {sub(result.buyHoldReturnRate)}</span>}</div>
        </div>
        <div style={{ height: 228 }}><BacktestChart pts={equity} dates={equityDates} markers={equityMarkers} lines={bh.length > 0 ? [{ data: bh, color: COMPASS, dash: true, label: 'B&H' }] : []} baseline={result.totalContribution ?? result.initialCapital} baselineLabel={result.totalContribution ? '총 납입액' : '초기 자본'} height={228} valueFmt={fmtV} glow={GLOW} upColor={UP} downColor={DOWN} /></div>
      </div>
      {/* 상세 지표 */}
      <div style={{ ...mkCard, padding: '22px 24px' }}>
        <h3 className="mb-3.5 text-[15px] font-bold">상세 성과 지표</h3>
        <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          {metrics.map(m => <div key={m.l} className="rounded-[10px] px-4 py-3.5" style={{ background: 'var(--ci-card)', border: `1px solid ${LINE}` }}><div className="text-[12px] tracking-[.08em]" style={{ color: INK2 }}>{m.t ? <Term k={m.t} compact>{m.l}</Term> : m.l}</div><div className="mt-1 font-mono text-[19.5px] font-bold">{m.v}</div></div>)}
        </div>
      </div>
      {/* 거래 내역 */}
      <div style={{ ...mkCard, padding: 0, overflow: 'hidden' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${LINE}` }}><h3 className="text-[15px] font-bold">거래 내역</h3><span className="text-[13px]" style={{ color: INK3 }}>{isUsd ? (rate ? `USD 기준 · $1=₩${fmtNum(rate)} · ` : 'USD 기준 · ') : ''}{trades.length}건</span></div>
        {trades.length === 0 ? <div className="px-6 py-10 text-center text-[14px]" style={{ color: INK3 }}>이 기간/전략에서 발생한 거래가 없습니다</div> : (
          <div className="overflow-x-auto"><table className="w-full border-collapse" style={{ minWidth: 720 }}>
            <thead><tr>{['#', '날짜', '유형', '가격', '수량', '손익', '수익률', '보유일', '사유'].map(h => <th key={h} className="px-[18px] py-2.5 text-left text-[11.5px] font-semibold uppercase tracking-[.12em]" style={{ color: INK3, borderBottom: `1px solid ${LINE}` }}>{h}</th>)}</tr></thead>
            <tbody>{trades.slice(0, tradeLimit).map((t, i) => { const pos = (t.pnl ?? 0) >= 0; const sell = isSellCloseType(t.type); return (
              <tr key={i}>
                <td className="px-[18px] py-3 font-mono text-[14px]" style={{ borderBottom: `1px solid ${LINE}`, color: INK2 }}>{String(i + 1).padStart(2, '0')}</td>
                <td className="px-[18px] py-3 font-mono text-[14px]" style={{ borderBottom: `1px solid ${LINE}` }}>{t.date}</td>
                <td className="px-[18px] py-3 text-[13px] font-bold" style={{ borderBottom: `1px solid ${LINE}`, color: isBuyType(t.type) ? UP : DOWN }}>{tradeLabel(t.type)}</td>
                <td className="px-[18px] py-3 font-mono text-[14px]" style={{ borderBottom: `1px solid ${LINE}` }}>{cur}{fmtNum(t.price)}</td>
                <td className="px-[18px] py-3 font-mono text-[14px]" style={{ borderBottom: `1px solid ${LINE}`, color: INK2 }}>{t.quantity.toLocaleString('ko-KR', { maximumFractionDigits: 6 })}</td>
                <td className="px-[18px] py-3 font-mono text-[14px] font-bold" style={{ borderBottom: `1px solid ${LINE}`, color: sell ? (pos ? UP : DOWN) : INK3 }}>{sell ? `${pos ? '+' : ''}${cur}${fmtNum(t.pnl)}` : '—'}</td>
                <td className="px-[18px] py-3 font-mono text-[14px] font-bold" style={{ borderBottom: `1px solid ${LINE}`, color: sell && t.pnlPercent != null ? (t.pnlPercent >= 0 ? UP : DOWN) : INK3 }}>{sell && t.pnlPercent != null ? `${t.pnlPercent >= 0 ? '+' : ''}${t.pnlPercent.toFixed(2)}%` : '—'}</td>
                <td className="px-[18px] py-3 font-mono text-[14px]" style={{ borderBottom: `1px solid ${LINE}`, color: INK2 }}>{t.holdingDays != null ? `${t.holdingDays}일` : '—'}</td>
                <td className="px-[18px] py-3 text-[13px]" style={{ borderBottom: `1px solid ${LINE}`, color: INK3 }}>{t.reason || '—'}</td>
              </tr>); })}</tbody>
          </table>
          {trades.length > tradeLimit && (
            <button onClick={() => setTradeLimit(l => l + 50)} className="w-full py-3 text-[13.5px] font-semibold transition-colors hover:bg-white/[0.03]" style={{ color: GLOW, borderTop: `1px solid ${LINE}` }}>
              더 보기 ↓ ({trades.length - tradeLimit}건 남음)
            </button>
          )}
          </div>
        )}
      </div>
    </section>
  );
};

export default ResultView;
