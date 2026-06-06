import type { ReactNode } from 'react';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRoutePrefix } from '../hooks/useRoutePrefix';
import HelmShell from '../components/HelmShell';
import { tradeService, portfolioService, type Portfolio, type Holding, type Trade, type PortfolioSnapshot } from '../services/tradeService';
import { quantStoreService, type PurchasePerformance } from '../services/quantStoreService';
import { exchangeService, type ExchangeType, type ExchangeAccount, type ExchangePortfolio } from '../services/exchangeService';
import ExchangeConnectModal from '../components/ExchangeConnectModal';
import apiClient from '../utils/api';

/* ────────────────────────────────────────────────────────────
   ConsolePortfolioPage — 포트폴리오(페이퍼/모의투자) 실데이터 배선
   tradeService.getPortfolio/getTrades + portfolioService.getHistory(추이)
   + quantStoreService.getMyPurchasesPerformance(항로) + 실 KOSPI 벤치마크.
   ※ 멀티거래소 실계좌는 대시보드(ConsoleDashboardPage) 책임 — 여기선 페이퍼만.
   ──────────────────────────────────────────────────────────── */

const SONAR = 'var(--ci-sonar)';
const UP = '#ef4d4d';     // 상승 = 빨강 (양쪽 테마 공통)
const DOWN = '#4d8aff';   // 하락 = 파랑 (양쪽 테마 공통)
const won = (n: number) => '₩' + Math.round(n).toLocaleString('ko-KR');
const CHART_COLORS = ['#5b9dff', '#f7931a', '#627eea', '#9945ff', '#23c4a0', '#f5d061', '#ef6f6f', '#7c8cff'];
const ASSET_ICON: Record<string, { c: string; t: string }> = {
  BTC: { c: '#f7931a', t: '₿' }, ETH: { c: '#627eea', t: 'Ξ' }, SOL: { c: '#9945ff', t: '◎' },
  XRP: { c: '#2f6fe6', t: '✕' }, USDT: { c: '#26a17b', t: '₮' }, DOGE: { c: '#c2a633', t: 'Ð' },
};
const isUsd = (at?: string) => at === 'US_STOCK' || at === 'ETF';
const stockLikeOf = (at?: string) => at === 'STOCK' || isUsd(at);
const stripZeros = (s: string) => s.replace(/\.?0+$/, '') || '0';
const fmtQty = (n: number, stockLike: boolean) => (stockLike ? `${Math.floor(n).toLocaleString('ko-KR')}주` : `${stripZeros(n.toFixed(8))}개`);
const holdingName = (h: { stockName?: string; stockCode: string }) => h.stockName || h.stockCode;
const fmtHoldingValue = (h: Holding) => (isUsd(h.assetType) ? '$' + h.marketValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : won(h.marketValue));
// 실계좌(ExchangeHolding) 단가/평가 표시: 해외주식 USD는 $, 그 외 ₩. (합계·도넛은 항상 KRW 환산)
const exMoney = (n: number, cur?: string) => cur === 'USD' ? '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : won(n);

const panel: React.CSSProperties = { background: 'var(--ci-panel)', border: '1px solid var(--ci-line)', borderRadius: 16, boxShadow: 'var(--ci-panel-shadow)' };
const Panel = ({ children, style }: { children: ReactNode; style?: React.CSSProperties }) => <div style={{ ...panel, ...style }}>{children}</div>;
const PanelHead = ({ kicker, title, right }: { kicker?: string; title: string; right?: ReactNode }) => (
  <div className="wa-force-dark flex items-center justify-between px-[22px] py-[15px] text-white" style={{ background: 'linear-gradient(105deg,#142647 0%,#1d3c7a 52%,#2c6fe6 100%)', borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
    <div>{kicker && <div className="text-[10.5px] font-bold tracking-[.22em] text-white/70">{kicker}</div>}<div className="text-[16px] font-bold">{title}</div></div>
    {right}
  </div>
);
const Tri = ({ up }: { up: boolean }) => (
  <svg width="9" height="9" viewBox="0 0 10 10" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 2 }}><path d={up ? 'M5 1l4 7H1z' : 'M5 9L1 2h8z'} fill={up ? UP : DOWN} /></svg>
);

const TrendChart = ({ port, kospi, mode }: { port: number[]; kospi: number[] | null; mode: 'value' | 'pct' }) => {
  if (port.length < 2) return <div className="flex h-full items-center justify-center text-[13px]" style={{ color: 'var(--ci-ink3)' }}>자산 추이 데이터 수집 중 — 하루 1회 스냅샷, 최소 2일 필요</div>;
  const W = 880, H = 250, padL = 8, padR = 52, padT = 12, padB = 28;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const all = [...port, ...(kospi ?? [])]; const max = Math.max(...all), min = Math.min(...all); const range = (max - min) || 1;
  const yP = (v: number) => padT + ((max - v) / range) * innerH;
  const xP = (i: number) => padL + (i / (port.length - 1)) * innerW;
  const pp = 'M ' + port.map((p, i) => `${xP(i)} ${yP(p)}`).join(' L ');
  const fp = pp + ` L ${xP(port.length - 1)} ${padT + innerH} L ${padL} ${padT + innerH} Z`;
  const bp = kospi ? 'M ' + kospi.map((p, i) => `${xP(i)} ${yP(p)}`).join(' L ') : '';
  const ticks = [0, .25, .5, .75, 1].map(t => min + (1 - t) * range);
  const fmtY = (v: number) => mode === 'pct' ? `${v >= 0 ? '+' : ''}${v.toFixed(1)}%` : v >= 1e8 ? `${(v / 1e8).toFixed(1)}억` : `${Math.round(v / 10000)}만`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ display: 'block' }}>
      <defs><linearGradient id="pf" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={SONAR} stopOpacity=".2" /><stop offset="100%" stopColor={SONAR} stopOpacity="0" /></linearGradient></defs>
      {ticks.map((t, i) => (<g key={i}><line x1={padL} x2={W - padR} y1={yP(t)} y2={yP(t)} stroke="var(--ci-line)" /><text x={W - padR + 6} y={yP(t) + 4} fill="var(--ci-ink2)" fontSize="10" fontFamily="JetBrains Mono, monospace">{fmtY(t)}</text></g>))}
      <path d={fp} fill="url(#pf)" />
      {kospi && <path d={bp} stroke="var(--ci-ink3)" strokeWidth="1.4" strokeDasharray="4 3" fill="none" vectorEffect="non-scaling-stroke" />}
      <path d={pp} stroke={SONAR} strokeWidth="1.8" fill="none" vectorEffect="non-scaling-stroke" />
      <circle cx={xP(port.length - 1)} cy={yP(port[port.length - 1])} r="3.5" fill={SONAR} stroke="var(--ci-card)" strokeWidth="1.5" />
    </svg>
  );
};

const Donut = ({ items, total }: { items: { c: string; value: number }[]; total: number }) => {
  const R = 72, inner = 48, C = 2 * Math.PI * R; let acc = 0;
  const safe = total || 1;
  const arcs = items.map(it => { const len = C * (it.value / safe); const off = acc; acc += len; return { len, off, c: it.c }; });
  return (
    <svg viewBox="0 0 180 180" width="100%" height="100%">
      <circle cx="90" cy="90" r={R} fill="none" stroke="var(--ci-card)" strokeWidth={R - inner} />
      <g transform="rotate(-90 90 90)">{arcs.map((a, i) => <circle key={i} cx="90" cy="90" r={R} fill="none" stroke={a.c} strokeWidth={R - inner} strokeDasharray={`${a.len} ${C - a.len}`} strokeDashoffset={-a.off} />)}</g>
      <text x="90" y="86" textAnchor="middle" fontSize="9" fill="var(--ci-ink2)" fontFamily="JetBrains Mono, monospace" letterSpacing="1.5">TOTAL</text>
      <text x="90" y="103" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--ci-ink0)" fontFamily="JetBrains Mono, monospace">{won(total)}</text>
    </svg>
  );
};

const td: React.CSSProperties = { padding: '13px 18px', borderBottom: '1px solid var(--ci-line)' };
const TYPE_LABEL: Record<string, string> = { STOCK: '주식', US_STOCK: '미국주식', ETF: 'ETF', CRYPTO: '코인' };
const typeLabel = (at?: string) => TYPE_LABEL[at || 'CRYPTO'] || '코인';
const HoldingsTrades = ({ holdings, trades, holdingsValue, holdingsPnl, routeMap, onPick, navTrade, navStore }: {
  holdings: Holding[]; trades: Trade[]; holdingsValue: number; holdingsPnl: number; routeMap: Record<string, string[]>;
  onPick: (code: string, at?: string) => void; navTrade: () => void; navStore: () => void;
}) => {
  const [tab, setTab] = useState<'holdings' | 'trades'>('holdings');
  return (
    <Panel style={{ padding: 0, overflow: 'hidden' }}>
      <div className="grid grid-cols-2" style={{ borderBottom: '1px solid var(--ci-line)' }}>
        {([['holdings', '보유 종목', holdings.length], ['trades', '거래 내역', trades.length]] as const).map(([k, l, n], idx) => (
          <button key={k} onClick={() => setTab(k)} className="relative px-4 py-[15px] text-[14px]" style={{ color: tab === k ? 'var(--ci-ink0)' : 'var(--ci-ink2)', fontWeight: tab === k ? 700 : 500, borderRight: idx === 0 ? '1px solid var(--ci-line)' : undefined }}>
            {l} <span className="font-semibold text-white/48">({n})</span>
            {tab === k && <span className="absolute -bottom-px left-3.5 right-3.5 h-0.5 rounded" style={{ background: SONAR }} />}
          </button>
        ))}
      </div>
      {tab === 'holdings' ? (
        holdings.length === 0 ? (
          <div className="px-[22px] py-12 text-center">
            <div className="text-[13px]" style={{ color: 'var(--ci-ink3)' }}>보유 종목이 없습니다.</div>
            <div className="mt-3 flex justify-center gap-2">
              <button onClick={navStore} className="rounded-lg px-3.5 py-2 text-[12.5px] font-semibold" style={{ border: '1px solid var(--ci-line)', color: 'var(--ci-ink1)' }}>전략 학습</button>
              <button onClick={navTrade} className="rounded-lg px-3.5 py-2 text-[12.5px] font-semibold text-white" style={{ background: `linear-gradient(180deg, ${SONAR}, #2c6fe6)` }}>직접 거래 →</button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2 px-[22px] py-3.5" style={{ borderBottom: '1px solid var(--ci-line)', background: 'var(--ci-card)' }}>
              <span className="text-[12px] text-white/48">총 평가금액 <span className="ml-2.5 font-mono text-[16px] font-bold text-white">{won(holdingsValue)}</span></span>
              <span className="font-mono text-[13px] font-semibold" style={{ color: holdingsPnl >= 0 ? UP : DOWN }}><Tri up={holdingsPnl >= 0} />{holdingsPnl >= 0 ? '+' : ''}{Math.round(holdingsPnl).toLocaleString('ko-KR')}</span>
            </div>
            {holdings.map((h, i) => {
              const up = h.returnRate >= 0, g = ASSET_ICON[h.stockCode], sl = stockLikeOf(h.assetType), rts = routeMap[h.stockCode];
              return (
                <button key={h.stockCode} onClick={() => onPick(h.stockCode, h.assetType)} className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3.5 px-[22px] py-3.5 text-left transition-colors hover:bg-white/[0.03]" style={{ borderTop: i ? '1px solid var(--ci-line)' : undefined }}>
                  <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] text-[15px] font-bold text-white" style={{ background: g?.c || '#3a4a6a' }}>{g?.t || holdingName(h).slice(0, 1)}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5"><span className="truncate text-[14px] font-semibold">{holdingName(h)}</span><span className="shrink-0 rounded px-1.5 py-0.5 text-[9.5px] font-bold" style={{ background: 'var(--ci-card)', color: 'var(--ci-ink2)' }}>{typeLabel(h.assetType)}</span></div>
                    <div className="mt-0.5 font-mono text-[11px] text-white/48">{h.stockCode} · {fmtQty(h.quantity, sl)}</div>
                    {rts && rts.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{rts.map((r, j) => <span key={j} className="rounded px-1.5 py-0.5 text-[9.5px] font-semibold" style={{ background: 'rgba(91,157,255,.12)', color: SONAR }}>⚓ {r}</span>)}</div>}
                  </div>
                  <div className="text-right"><div className="font-mono text-[14px] font-bold">{fmtHoldingValue(h)}</div><div className="mt-0.5 font-mono text-[12px] font-semibold" style={{ color: up ? UP : DOWN }}><Tri up={up} />{up ? '+' : ''}{h.returnRate.toFixed(2)}%{!isUsd(h.assetType) && <span className="ml-1 text-white/40">({h.profitLoss >= 0 ? '+' : ''}{won(h.profitLoss)})</span>}</div></div>
                </button>
              );
            })}
          </>
        )
      ) : (
        trades.length === 0 ? (
          <div className="px-[22px] py-12 text-center">
            <div className="text-[13px]" style={{ color: 'var(--ci-ink3)' }}>거래 내역이 없습니다.</div>
            <button onClick={navTrade} className="mt-3 rounded-lg px-3.5 py-2 text-[12.5px] font-semibold text-white" style={{ background: `linear-gradient(180deg, ${SONAR}, #2c6fe6)` }}>거래하기 →</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: 520 }}>
              <thead><tr>{['시간', '구분', '종목', '수량', '가격'].map(h => <th key={h} className="px-[18px] py-3 text-left text-[11px] font-semibold uppercase tracking-[.1em] text-white/48" style={{ borderBottom: '1px solid var(--ci-line)' }}>{h}</th>)}</tr></thead>
              <tbody>{trades.slice(0, 20).map(t => { const buy = t.orderType === 'BUY', sl = stockLikeOf(t.assetType); return (
                <tr key={t.id}>
                  <td className="font-mono text-[13px]" style={td}>{(() => { try { return new Date(t.executedAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { return t.executedAt; } })()}</td>
                  <td style={td}><span className="rounded px-2 py-0.5 text-[11px] font-bold" style={{ color: buy ? UP : DOWN, background: buy ? 'rgba(239,77,77,.12)' : 'rgba(77,138,255,.12)' }}>{buy ? '매수' : '매도'}</span></td>
                  <td className="text-[13px]" style={td}><span className="inline-flex items-center gap-1.5">{holdingName({ stockName: t.stockName, stockCode: t.stockCode })}<span className="rounded px-1 py-0.5 text-[9.5px] font-bold" style={{ background: 'var(--ci-card)', color: 'var(--ci-ink3)' }}>{typeLabel(t.assetType)}</span></span></td>
                  <td className="font-mono text-[13px]" style={td}>{fmtQty(t.quantity, sl)}</td>
                  <td className="font-mono text-[13px]" style={td}>{isUsd(t.assetType) ? '$' + t.price.toLocaleString('en-US', { maximumFractionDigits: 2 }) : won(t.price)}</td>
                </tr>); })}</tbody>
            </table>
          </div>
        )
      )}
    </Panel>
  );
};

const RouteCard = ({ perf, isRep, onStar, busy, navTo }: { perf: PurchasePerformance; isRep: boolean; onStar: () => void; busy: boolean; navTo: () => void }) => {
  const up = perf.totalReturnRate >= 0;
  const isTurtle = perf.strategyType === 'TURTLE';
  const trades = perf.totalTradeCount || 0, wins = perf.totalWinCount || 0;
  return (
    <div className="px-[22px] py-5" style={{ borderTop: '1px solid var(--ci-line)' }}>
      <div className="mb-1.5 flex items-center gap-2">
        <button onClick={navTo} className="text-left text-[15px] font-bold hover:underline">{perf.productName}</button>
        {isTurtle && <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: 'rgba(245,208,97,.14)', color: '#f5d061' }}>WhaleArc 독점</span>}
        <button onClick={onStar} disabled={busy} title="대표 항로" className="ml-auto flex h-7 w-7 items-center justify-center rounded-md disabled:opacity-50" style={{ color: isRep ? '#f5d061' : 'var(--ci-ink3)' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill={isRep ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8"><path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.8 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" strokeLinejoin="round" /></svg>
        </button>
      </div>
      <div className="flex items-center gap-2 text-[12.5px] text-white/48">투자 <span className="font-mono font-semibold text-white">{won(perf.investmentAmount)}</span>{isRep && <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: 'rgba(245,208,97,.12)', color: '#f5d061' }}>대표 항로</span>}</div>
      <div className="mt-4 rounded-xl px-[18px] py-4" style={{ background: up ? 'rgba(239,77,77,.07)' : 'rgba(77,138,255,.07)', border: `1px solid ${up ? 'rgba(239,77,77,.22)' : 'rgba(77,138,255,.22)'}` }}>
        <div className="font-mono text-[26px] font-bold" style={{ color: up ? UP : DOWN }}><Tri up={up} />{up ? '+' : ''}{perf.totalReturnRate.toFixed(2)}%</div>
        <div className="mt-1 font-mono text-[12px] text-white/48">({up ? '+' : ''}{won(perf.totalPnl)})</div>
      </div>
      {perf.assets?.length > 0 && <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1.5 text-[12.5px]">
        {perf.assets.map((a, i) => { const au = a.returnRate >= 0; return (
          <span key={a.code} className="flex items-center gap-2 text-white/70">{i > 0 && <span className="text-white/30">·</span>}{a.code} <span className="font-mono font-semibold" style={{ color: au ? UP : DOWN }}>{au ? '+' : ''}{a.returnRate.toFixed(1)}%</span></span>
        ); })}
      </div>}
      {isTurtle && (trades > 0 ? (
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          {[['거래', `${trades}회`], ['승률', `${((wins / trades) * 100).toFixed(1)}%`], ['실현 손익', won(perf.realizedPnl || 0)]].map(([l, v]) => (
            <div key={l} className="rounded-lg px-3 py-2.5 text-center" style={{ background: 'var(--ci-card)', border: '1px solid var(--ci-line)' }}><div className="text-[10.5px] text-white/48">{l}</div><div className="mt-1 font-mono text-[13px] font-semibold">{v}</div></div>
          ))}
        </div>
      ) : <div className="mt-4 rounded-lg px-3 py-2.5 text-center text-[12px]" style={{ background: 'var(--ci-card)', border: '1px solid var(--ci-line)', color: 'var(--ci-ink3)' }}>진입 시그널 대기 중</div>)}
    </div>
  );
};

const Toast = ({ msg, type }: { msg: string; type: 'success' | 'error' }) => (
  <div className="fixed bottom-6 left-1/2 z-[120] -translate-x-1/2 rounded-xl px-5 py-3 text-[13px] font-semibold text-white" style={{ background: type === 'error' ? 'linear-gradient(180deg,#e0524f,#c23b38)' : 'linear-gradient(180deg,#2f9e6e,#1f7d57)', boxShadow: '0 14px 32px -10px rgba(0,0,0,.55)', animation: 'message-in .25s ease' }}>{msg}</div>
);

/* ── 페이퍼(모의투자) 포트폴리오 — virt 라우트 ── */
const PaperPortfolio = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { isVirt } = useRoutePrefix();
  const email = session?.user?.email ?? '';
  const userName = email ? email.split('@')[0] : '항해사';
  const [mode, setMode] = useState<'value' | 'pct'>('value');

  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [history, setHistory] = useState<PortfolioSnapshot[]>([]);
  const [kospiHistory, setKospiHistory] = useState<{ date: string; close: number }[]>([]);
  const [routes, setRoutes] = useState<PurchasePerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settingRoute, setSettingRoute] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'trades' | 'portfolio' | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const toastTimer = useRef<number | null>(null);
  const isPreview = import.meta.env.DEV && window.location.pathname.startsWith('/preview');

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3000);
  }, []);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const load = useCallback((silent = false) => {
    if (isPreview) { setLoading(false); return; }
    if (!silent) setLoading(true);
    Promise.all([
      tradeService.getPortfolio(),
      tradeService.getTrades().catch(() => [] as Trade[]),
      portfolioService.getHistory(30).catch(() => [] as PortfolioSnapshot[]),
      quantStoreService.getMyPurchasesPerformance().catch(() => [] as PurchasePerformance[]),
    ]).then(([p, t, h, r]) => {
      setPortfolio(p);
      setTrades([...t].sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime()));
      setHistory(h);
      setRoutes(r);
      setError(null);
    }).catch(() => setError('포트폴리오를 불러오지 못했습니다. 네트워크 상태를 확인해주세요.'))
      .finally(() => setLoading(false));
  }, [isPreview]);

  useEffect(() => {
    load();
    if (isPreview) return;
    const t = setInterval(() => load(true), 15_000);
    return () => clearInterval(t);
  }, [load, isPreview]);

  // KOSPI 벤치마크 (공개 API, 인증 데이터와 분리 — 401에 묶이지 않게)
  useEffect(() => {
    apiClient.get('/api/market/indices/history', { params: { code: '0001', days: 365 } })
      .then(res => { if (Array.isArray(res.data)) setKospiHistory(res.data); }).catch(() => {});
  }, []);

  const handleStar = useCallback(async (purchaseId: string) => {
    if (!portfolio) return;
    const next = portfolio.representativePurchaseId === purchaseId ? null : purchaseId;
    setSettingRoute(purchaseId);
    try { await portfolioService.setRepresentativeRoute(next); load(true); }
    catch { /* ignore */ }
    finally { setSettingRoute(null); }
  }, [portfolio, load]);

  const goTrade = useCallback((code: string, at?: string) => {
    navigate(`${isVirt ? '/virt' : ''}/trade?code=${code}&type=${at || 'CRYPTO'}`);
  }, [navigate, isVirt]);

  const handleExport = useCallback(async (kind: 'trades' | 'portfolio') => {
    setExporting(kind);
    try { await (kind === 'trades' ? tradeService.exportTradesCsv() : tradeService.exportPortfolioCsv()); }
    catch { showToast('CSV 다운로드에 실패했습니다.', 'error'); }
    finally { setExporting(null); }
  }, [showToast]);

  const handleReset = useCallback(async () => {
    if (!window.confirm('정말 모의투자를 초기화하시겠습니까?\n\n보유 종목·거래 내역·구매한 항로·적용 전략·자산 추이가 모두 삭제되고, 현금이 1,000만원으로 리셋됩니다.')) return;
    if (!window.confirm('이 작업은 되돌릴 수 없습니다. 최종 확인하시겠습니까?')) return;
    if (window.prompt('초기화하려면 "초기화"를 입력하세요.') !== '초기화') { showToast('초기화가 취소되었습니다.', 'error'); return; }
    try { await tradeService.resetPortfolio(); showToast('새 항해가 시작되었습니다!'); load(); }
    catch { showToast('초기화에 실패했습니다.', 'error'); }
  }, [showToast, load]);

  const holdings = portfolio?.holdings ?? [];
  const cash = portfolio?.cashBalance ?? 0;
  const initialCash = portfolio?.initialCash || 10_000_000;
  const totalValue = portfolio?.totalValue ?? 0;
  const holdingsValue = holdings.reduce((s, h) => s + h.marketValue, 0);
  const totalPnl = totalValue - initialCash;
  const returnRate = portfolio?.returnRate ?? 0;
  const turtle = portfolio?.turtleAllocated ?? 0;
  const holdingsPnl = holdings.reduce((s, h) => s + h.profitLoss, 0);

  // 보유 종목에 적용 항로 배지 (assets[].code → 항로 이름)
  const assetRouteMap = useMemo(() => {
    const m: Record<string, string[]> = {};
    routes.forEach(p => p.assets?.forEach(a => { (m[a.code] ||= []).push(p.productName); }));
    return m;
  }, [routes]);

  const alloc = useMemo(() => {
    const arr: { c: string; label: string; value: number }[] = [];
    if (cash > 0) arr.push({ c: '#7a8aa8', label: '현금', value: cash });
    holdings.forEach((h, i) => { if (h.marketValue > 0) arr.push({ c: CHART_COLORS[i % CHART_COLORS.length], label: holdingName(h), value: h.marketValue }); });
    if (turtle > 0) arr.push({ c: '#f5d061', label: '터틀 전략', value: turtle });
    return arr;
  }, [holdings, cash, turtle]);
  const allocTotal = alloc.reduce((s, a) => s + a.value, 0);

  // 자산추이 시계열 + KOSPI 리베이스(포트폴리오 시작값 기준)
  const chart = useMemo(() => {
    if (history.length < 2) return null;
    const startValue = history[0].totalValue || 1;
    const startDate = history[0].date;
    const portValue = history.map(s => s.totalValue);
    const portPct = history.map(s => ((s.totalValue - startValue) / startValue) * 100);
    let kospiValue: number[] | null = null, kospiPct: number[] | null = null;
    if (kospiHistory.length) {
      const sorted = [...kospiHistory].sort((a, b) => a.date.localeCompare(b.date));
      const kmap = new Map(sorted.map(k => [k.date, k.close]));
      let startClose = 0;
      for (const k of sorted) { if (k.date <= startDate) startClose = k.close; }
      if (!startClose) startClose = sorted[0].close;
      if (startClose) {
        kospiPct = history.map(s => {
          let c = kmap.get(s.date);
          if (c == null) { for (const k of sorted) { if (k.date <= s.date) c = k.close; } }
          if (c == null) c = startClose;
          return ((c - startClose) / startClose) * 100;
        });
        kospiValue = kospiPct.map(p => startValue * (1 + p / 100));
      }
    }
    return { portValue, portPct, kospiValue, kospiPct };
  }, [history, kospiHistory]);
  const port = chart ? (mode === 'pct' ? chart.portPct : chart.portValue) : [];
  const kospi = chart ? (mode === 'pct' ? chart.kospiPct : chart.kospiValue) : null;

  return (
    <HelmShell active="portfolio" virt={isVirt} userName={userName} session="모의투자 · 15초 갱신">
      <div className="mx-auto flex max-w-[1560px] flex-col gap-[18px]">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">내 포트폴리오</h1>
          <p className="mt-2 text-[13.5px] text-white/70">{userName} 항해사님의 항해 일지</p>
        </div>
        {error && <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3 text-[13px]" style={{ background: 'rgba(239,77,77,.1)', border: '1px solid rgba(239,77,77,.25)', color: '#fca5a5' }}><span>{error}</span><button onClick={() => load()} className="rounded-md px-3 py-1 text-[12px] font-semibold" style={{ border: '1px solid rgba(239,77,77,.35)', color: '#fca5a5' }}>다시 시도</button></div>}

        {/* 총자산 + 도넛 */}
        <Panel style={{ padding: 0, overflow: 'hidden' }}>
          <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr]">
            <div className="px-8 py-[30px]" style={{ borderRight: '1px solid var(--ci-line)' }}>
              <div className="mb-2.5 text-[10.5px] font-semibold tracking-[.2em]" style={{ color: SONAR }}>총 자산</div>
              <div className="text-[clamp(40px,6vw,58px)] font-bold leading-none tracking-tight">{loading && !portfolio ? '—' : won(totalValue)}</div>
              <div className="mt-3.5 font-mono text-[16px] font-semibold" style={{ color: totalPnl < 0 ? DOWN : UP }}><Tri up={totalPnl >= 0} />{totalPnl >= 0 ? '+' : '-'}{won(Math.abs(totalPnl))} ({returnRate >= 0 ? '+' : ''}{returnRate.toFixed(2)}%)</div>
              <div className="mt-6 grid grid-cols-3 gap-3">
                {([['현금', won(cash)], ['보유 평가', won(holdingsValue)], ['초기 자본', won(initialCash)]] as const).map(([l, v]) => (
                  <div key={l} className="rounded-[11px] px-3.5 py-3" style={{ background: 'var(--ci-card)', border: '1px solid var(--ci-line)' }}>
                    <div className="text-[10.5px] text-white/48">{l}</div><div className="mt-1.5 font-mono text-[15px] font-semibold">{v}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-6 py-6">
              <div className="mb-3.5 text-[10.5px] font-semibold tracking-[.2em] text-white/48">자산 배분</div>
              {alloc.length === 0 ? <div className="flex h-[120px] items-center justify-center text-[12.5px]" style={{ color: 'var(--ci-ink3)' }}>{loading ? '불러오는 중…' : '자산이 없습니다'}</div> : (
                <div className="grid grid-cols-[120px_1fr] items-center gap-5">
                  <div style={{ width: 120, height: 120 }}><Donut items={alloc} total={allocTotal} /></div>
                  <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                    {alloc.map(a => (
                      <li key={a.label} className="flex items-center justify-between text-[12.5px]">
                        <span className="inline-flex min-w-0 items-center gap-2"><span className="h-[9px] w-[9px] shrink-0 rounded-full" style={{ background: a.c }} /><span className="truncate">{a.label}</span></span>
                        <span className="ml-2 shrink-0 font-mono text-white/70">{((a.value / (allocTotal || 1)) * 100).toFixed(1)}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </Panel>

        {/* 자산 추이 */}
        <Panel>
          <PanelHead kicker="VOYAGE LOG" title="자산 추이" right={
            <div className="flex items-center gap-3">
              <div className="flex gap-[3px] rounded-lg p-[3px]" style={{ background: 'var(--ci-card)', border: '1px solid var(--ci-line)' }}>
                {([['value', '총 자산'], ['pct', '수익률 %']] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setMode(k)} className="rounded-md px-2.5 py-[5px] text-[11.5px] font-semibold" style={{ background: mode === k ? 'rgba(91,157,255,.10)' : 'transparent', color: mode === k ? SONAR : 'var(--ci-ink2)' }}>{l}</button>
                ))}
              </div>
              <span className="hidden text-[11.5px] text-white/48 sm:inline">최근 30일</span>
            </div>} />
          <div className="flex justify-end gap-4 px-3.5 pb-2 pt-2.5 text-[11px] text-white/70">
            <span className="inline-flex items-center gap-1.5"><span style={{ width: 14, height: 2, background: SONAR }} />내 포트폴리오</span>
            {kospi && <span className="inline-flex items-center gap-1.5"><span style={{ width: 14, borderTop: '2px dashed var(--ci-ink3)' }} />KOSPI</span>}
          </div>
          <div className="px-3 pb-[18px]" style={{ height: 250 }}><TrendChart port={port} kospi={kospi} mode={mode} /></div>
          {kospi && <div className="px-[22px] pb-3 text-[10.5px]" style={{ color: 'var(--ci-ink3)' }}>* KOSPI 수익률은 실제 지수 일봉 데이터 기반입니다.</div>}
        </Panel>

        {/* 보유종목 + 항로 */}
        <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1.5fr_1fr]">
          <HoldingsTrades holdings={holdings} trades={trades} holdingsValue={holdingsValue} holdingsPnl={holdingsPnl} routeMap={assetRouteMap} onPick={goTrade} navTrade={() => navigate(`${isVirt ? '/virt' : ''}/trade`)} navStore={() => navigate(`${isVirt ? '/virt' : ''}/store`)} />
          <Panel style={{ overflow: 'hidden' }}>
            <PanelHead kicker="ACTIVE ROUTE" title="항해 중인 항로" right={<button onClick={() => navigate(`${isVirt ? '/virt' : ''}/store`)} className="text-[12px] text-white/80 hover:text-white">전략 학습 →</button>} />
            {routes.length === 0 ? (
              <div className="px-[22px] py-12 text-center">
                <div className="text-[13px]" style={{ color: 'var(--ci-ink3)' }}>적용 중인 항로가 없습니다.</div>
                <button onClick={() => navigate(`${isVirt ? '/virt' : ''}/store`)} className="mt-3 rounded-lg px-4 py-2 text-[12.5px] font-semibold text-white" style={{ background: `linear-gradient(180deg, ${SONAR}, #2c6fe6)` }}>항로 둘러보기 →</button>
              </div>
            ) : routes.map(perf => (
              <RouteCard key={perf.purchaseId} perf={perf} isRep={portfolio?.representativePurchaseId === perf.purchaseId} onStar={() => handleStar(perf.purchaseId)} busy={settingRoute === perf.purchaseId} navTo={() => navigate(`${isVirt ? '/virt' : ''}/store`)} />
            ))}
          </Panel>
        </div>

        {/* 빠른 액션 */}
        <Panel style={{ padding: '16px 22px' }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[12px] font-semibold tracking-[.08em]" style={{ color: 'var(--ci-ink2)' }}>빠른 액션</span>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => handleExport('trades')} disabled={exporting !== null} className="rounded-lg px-3.5 py-2 text-[12.5px] font-semibold disabled:opacity-50" style={{ border: '1px solid var(--ci-line)', background: 'var(--ci-card)', color: 'var(--ci-ink1)' }}>{exporting === 'trades' ? '다운로드 중…' : '거래 내역 CSV'}</button>
              <button onClick={() => handleExport('portfolio')} disabled={exporting !== null} className="rounded-lg px-3.5 py-2 text-[12.5px] font-semibold disabled:opacity-50" style={{ border: '1px solid var(--ci-line)', background: 'var(--ci-card)', color: 'var(--ci-ink1)' }}>{exporting === 'portfolio' ? '다운로드 중…' : '포트폴리오 CSV'}</button>
              <button onClick={handleReset} className="rounded-lg px-3.5 py-2 text-[12.5px] font-semibold" style={{ border: '1px solid rgba(239,77,77,.3)', color: UP }}>새 항해 시작</button>
            </div>
          </div>
        </Panel>

        <footer className="mt-2 flex flex-wrap justify-between gap-3 border-t border-white/10 pt-5">
          <span className="font-mono text-[11.5px] text-white/30">© 2026 WHALEARC · 모든 항해는 사용자의 책임 아래 진행됩니다.</span>
          <span className="text-[11.5px] text-white/30">Built quietly, beneath the surface.</span>
        </footer>
      </div>
      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </HelmShell>
  );
};

/* ── 실계좌(KIS/업비트/비트겟) 포트폴리오 — non-virt 라우트, exchangeService ── */
const EXCHANGES: { key: ExchangeType; label: string; sub: string }[] = [
  { key: 'KIS', label: 'KIS', sub: '주식' },
  { key: 'UPBIT', label: '업비트', sub: '코인' },
  { key: 'BITGET', label: '비트겟', sub: '코인' },
];
const RealAccountPortfolio = () => {
  const { session } = useAuth();
  const { isVirt } = useRoutePrefix();
  const email = session?.user?.email ?? '';
  const userName = email ? email.split('@')[0] : '항해사';
  const [accounts, setAccounts] = useState<ExchangeAccount[]>([]);
  const [portfolios, setPortfolios] = useState<Partial<Record<ExchangeType, ExchangePortfolio | null>>>({});
  const [activeTab, setActiveTab] = useState<ExchangeType>('KIS');
  const autoPickRef = useRef(false); // 최초 로드 시 첫 연결 거래소 자동 선택(이후 사용자 선택 우선)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState<ExchangeType | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const toastTimer = useRef<number | null>(null);
  const isPreview = import.meta.env.DEV && window.location.pathname.startsWith('/preview');

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3000);
  }, []);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const load = useCallback((silent = false) => {
    if (isPreview) { setLoading(false); return; }
    if (!silent) setLoading(true);
    exchangeService.getAccounts().then(async accs => {
      setAccounts(accs);
      // 최초 로드: 현재 탭이 미연결이면 첫 연결 거래소로 자동 전환 (사용자가 직접 고르기 전까지)
      if (!autoPickRef.current) {
        const firstConn = accs.find(a => a.connected);
        if (firstConn) { setActiveTab(firstConn.exchangeType); autoPickRef.current = true; }
      }
      const ports: Partial<Record<ExchangeType, ExchangePortfolio | null>> = {};
      await Promise.all(accs.filter(a => a.connected).map(a =>
        exchangeService.getPortfolio(a.exchangeType).then(p => { ports[a.exchangeType] = p; }).catch(() => { ports[a.exchangeType] = null; })));
      setPortfolios(ports);
      setError(null);
    }).catch(() => setError('실계좌 정보를 불러오지 못했습니다. 네트워크 상태를 확인해주세요.'))
      .finally(() => setLoading(false));
  }, [isPreview]);
  useEffect(() => {
    load();
    if (isPreview) return;
    const t = setInterval(() => load(true), 30_000);
    return () => clearInterval(t);
  }, [load, isPreview]);

  const isConn = (t: ExchangeType) => accounts.some(a => a.exchangeType === t && a.connected);
  const connectedList = EXCHANGES.filter(e => isConn(e.key));
  const totalAll = connectedList.reduce((s, e) => s + (portfolios[e.key]?.totalValue || 0), 0);
  const pnlAll = connectedList.reduce((s, e) => s + (portfolios[e.key]?.totalProfitLoss || 0), 0);
  const investedAll = totalAll - pnlAll;
  const returnAll = investedAll !== 0 ? (pnlAll / investedAll) * 100 : 0;
  const hasAny = connectedList.length > 0;
  const port = portfolios[activeTab] || null;
  const connected = isConn(activeTab);
  const isStock = activeTab === 'KIS';
  const holdings = port?.holdings ?? [];
  const cashLabel = isStock ? '예수금' : activeTab === 'UPBIT' ? 'KRW 잔고' : 'USDT';

  // 도넛/합계는 항상 KRW 기준 — KIS 해외주식(currency=USD)은 서버가 준 환율로 환산(통화 혼합 방지)
  const usdKrw = port?.usdtKrwRate || 0;
  const krwVal = (h: { marketValue: number; currency?: string }) => (h.currency === 'USD' && usdKrw > 0 ? h.marketValue * usdKrw : h.marketValue);
  const alloc = useMemo(() => {
    if (!port) return [] as { c: string; label: string; value: number }[];
    const arr: { c: string; label: string; value: number }[] = [];
    if (port.cashBalance > 0) arr.push({ c: '#7a8aa8', label: isStock ? '예수금' : 'KRW', value: port.cashBalance });
    port.holdings.forEach((h, i) => { const v = krwVal(h); if (v > 0) arr.push({ c: CHART_COLORS[i % CHART_COLORS.length], label: h.assetName, value: v }); });
    return arr;
  }, [port, isStock, usdKrw]);
  const allocTotal = alloc.reduce((s, a) => s + a.value, 0);

  const openSetup = (t: ExchangeType) => setShowSetup(t);
  const handleDisconnect = async (t: ExchangeType) => {
    if (!window.confirm(`${EXCHANGES.find(e => e.key === t)?.label} 연결을 해제하시겠습니까?`)) return;
    try { await exchangeService.deleteAccount(t); setShowSetup(null); showToast('연결이 해제되었습니다.'); load(); }
    catch { showToast('연결 해제에 실패했습니다.', 'error'); }
  };

  return (
    <HelmShell active="portfolio" virt={isVirt} userName={userName} session="실계좌 · 거래소 연동">
      <div className="mx-auto flex max-w-[1560px] flex-col gap-[18px]">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">내 실계좌</h1>
          <p className="mt-2 text-[13.5px] text-white/70">{userName} 항해사님의 실제 거래소 자산 (KIS · 업비트 · 비트겟)</p>
        </div>
        {error && <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3 text-[13px]" style={{ background: 'rgba(239,77,77,.1)', border: '1px solid rgba(239,77,77,.25)', color: '#fca5a5' }}><span>{error}</span><button onClick={() => load()} className="rounded-md px-3 py-1 text-[12px] font-semibold" style={{ border: '1px solid rgba(239,77,77,.35)', color: '#fca5a5' }}>다시 시도</button></div>}

        {/* 전체 실계좌 자산 */}
        {hasAny && (
          <Panel style={{ padding: '26px 28px' }}>
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-[10.5px] font-semibold tracking-[.2em]" style={{ color: SONAR }}>전체 실계좌 자산</span>
              <button onClick={() => load()} className="text-[11.5px]" style={{ color: 'var(--ci-ink2)' }}>↻ 새로고침</button>
            </div>
            <div className="text-[clamp(34px,5vw,50px)] font-bold leading-none tracking-tight">{won(totalAll)}</div>
            <div className="mt-3 font-mono text-[15px] font-semibold" style={{ color: pnlAll >= 0 ? UP : DOWN }}><Tri up={pnlAll >= 0} />{pnlAll >= 0 ? '+' : '-'}{won(Math.abs(pnlAll))} ({returnAll >= 0 ? '+' : ''}{returnAll.toFixed(2)}%)</div>
            <div className="mt-5 grid grid-cols-3 divide-x" style={{ borderTop: '1px solid var(--ci-line)' }}>
              {EXCHANGES.map(e => { const c = isConn(e.key); return (
                <div key={e.key} className="px-4 pt-4" style={{ borderColor: 'var(--ci-line)' }}>
                  <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--ci-ink2)' }}>{c && <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#4ade80' }} />}{e.label} {e.sub}</div>
                  <div className="mt-1 font-mono text-[15px] font-semibold">{c ? won(portfolios[e.key]?.totalValue || 0) : <span style={{ color: 'var(--ci-ink3)' }}>미연결</span>}</div>
                </div>
              ); })}
            </div>
          </Panel>
        )}

        {/* 거래소 탭 */}
        <div className="flex flex-wrap gap-2">
          {EXCHANGES.map(e => { const on = activeTab === e.key, c = isConn(e.key); return (
            <button key={e.key} onClick={() => { autoPickRef.current = true; setActiveTab(e.key); }} className="inline-flex items-center gap-2 rounded-[10px] px-[18px] py-2.5 text-[14px] font-semibold" style={{ border: on ? '1px solid rgba(91,157,255,.35)' : '1px solid var(--ci-line)', background: on ? 'rgba(91,157,255,.12)' : 'var(--ci-card)', color: 'var(--ci-ink0)' }}>
              {c && <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#4ade80' }} />}{e.label}<span className="text-[11px] font-medium" style={{ color: on ? '#cfe1ff' : 'var(--ci-ink2)' }}>{e.sub}</span>
            </button>
          ); })}
        </div>

        {!connected ? (
          <Panel style={{ padding: '48px 32px' }}>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'rgba(91,157,255,.1)', border: '1px solid rgba(91,157,255,.22)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={SONAR} strokeWidth="1.6" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></svg>
              </div>
              <h3 className="text-[17px] font-bold">{EXCHANGES.find(e => e.key === activeTab)?.label} 계좌가 연결되지 않았습니다</h3>
              <p className="mx-auto mt-2 max-w-[420px] text-[13px]" style={{ color: 'var(--ci-ink1)' }}>거래소 API 키를 등록하면 실제 보유 자산·잔고를 한 곳에서 확인할 수 있습니다. 키는 AES로 암호화되어 안전하게 저장됩니다.</p>
              <button onClick={() => openSetup(activeTab)} className="mt-5 rounded-[10px] px-5 py-3 text-[13.5px] font-semibold text-white" style={{ background: `linear-gradient(180deg, ${SONAR}, #2c6fe6)`, boxShadow: '0 10px 24px -10px rgba(60,120,255,.6)' }}>API 키 등록하기</button>
            </div>
          </Panel>
        ) : !port ? (
          <Panel style={{ padding: '48px 32px' }}><div className="text-center text-[13px]" style={{ color: 'var(--ci-ink3)' }}>{loading ? '실계좌 자산을 불러오는 중…' : '보유 자산 정보를 불러오지 못했습니다.'}</div></Panel>
        ) : (
          <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1.5fr_1fr]">
            <div className="flex flex-col gap-[18px]">
              {/* 지표 카드 */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[['총 자산', won(port.totalValue), 'var(--ci-ink0)'], ['총 손익', `${port.totalProfitLoss >= 0 ? '+' : ''}${won(port.totalProfitLoss)}`, port.totalProfitLoss >= 0 ? UP : DOWN], ['수익률', `${port.totalReturnRate >= 0 ? '+' : ''}${port.totalReturnRate.toFixed(2)}%`, port.totalReturnRate >= 0 ? UP : DOWN], [cashLabel, won(port.cashBalance), 'var(--ci-ink0)']].map(([l, v, c]) => (
                  <div key={l} style={{ ...panel, padding: '16px 18px' }}><div className="text-[10.5px]" style={{ color: 'var(--ci-ink2)' }}>{l}</div><div className="mt-1.5 font-mono text-[16px] font-semibold" style={{ color: c }}>{v}</div></div>
                ))}
              </div>
              {/* 보유 종목 */}
              <Panel style={{ padding: 0, overflow: 'hidden' }}>
                <PanelHead kicker="HOLDINGS" title={`보유 ${isStock ? '종목' : '코인'}`} right={<span className="text-[12px] text-white/70">{holdings.length}개</span>} />
                {holdings.length === 0 ? <div className="px-[22px] py-12 text-center text-[13px]" style={{ color: 'var(--ci-ink3)' }}>보유 자산이 없습니다.</div> : holdings.map((h, i) => {
                  const up = h.returnRate >= 0;
                  return (
                    <div key={h.assetCode} className="grid grid-cols-[1fr_auto] items-center gap-3.5 px-[22px] py-3.5" style={{ borderTop: i ? '1px solid var(--ci-line)' : undefined }}>
                      <div className="min-w-0"><div className="truncate text-[14px] font-semibold">{h.assetName}{h.currency === 'USD' && <span className="ml-1.5 rounded px-1 py-0.5 text-[9px] font-bold align-middle" style={{ background: 'rgba(91,157,255,.16)', color: SONAR }}>USD</span>}</div><div className="mt-0.5 font-mono text-[11px] text-white/48">{h.assetCode} · {fmtQty(h.quantity, isStock)} · 평단 {exMoney(h.averagePrice, h.currency)}</div></div>
                      <div className="text-right"><div className="font-mono text-[14px] font-bold">{exMoney(h.marketValue, h.currency)}</div><div className="mt-0.5 font-mono text-[12px] font-semibold" style={{ color: up ? UP : DOWN }}><Tri up={up} />{up ? '+' : ''}{h.returnRate.toFixed(2)}% <span className="text-white/40">({h.profitLoss >= 0 ? '+' : ''}{exMoney(h.profitLoss, h.currency)})</span></div></div>
                    </div>
                  );
                })}
              </Panel>
            </div>
            <div className="flex flex-col gap-[18px]">
              {/* 자산 배분 */}
              {alloc.length > 0 && (
                <Panel style={{ padding: '22px' }}>
                  <div className="mb-3.5 text-[10.5px] font-semibold tracking-[.2em] text-white/48">자산 배분</div>
                  <div className="grid grid-cols-[110px_1fr] items-center gap-4">
                    <div style={{ width: 110, height: 110 }}><Donut items={alloc} total={allocTotal} /></div>
                    <ul className="m-0 flex list-none flex-col gap-2 p-0">{alloc.slice(0, 6).map(a => (
                      <li key={a.label} className="flex items-center justify-between text-[12px]"><span className="inline-flex min-w-0 items-center gap-2"><span className="h-[9px] w-[9px] shrink-0 rounded-full" style={{ background: a.c }} /><span className="truncate">{a.label}</span></span><span className="ml-2 shrink-0 font-mono text-white/70">{((a.value / (allocTotal || 1)) * 100).toFixed(1)}%</span></li>
                    ))}</ul>
                  </div>
                </Panel>
              )}
              {/* 연결 정보 */}
              <Panel style={{ padding: '20px 22px' }}>
                <div className="mb-3 text-[10.5px] font-semibold tracking-[.2em] text-white/48">연결 정보</div>
                <div className="flex items-center justify-between text-[12.5px]"><span style={{ color: 'var(--ci-ink2)' }}>API Key</span><span className="font-mono">{(accounts.find(a => a.exchangeType === activeTab)?.apiKey) || '****'}</span></div>
                {isStock && <div className="mt-2 flex items-center justify-between text-[12.5px]"><span style={{ color: 'var(--ci-ink2)' }}>계좌번호</span><span className="font-mono">{accounts.find(a => a.exchangeType === activeTab)?.accountNumber || '—'}</span></div>}
                <div className="mt-4 flex gap-2">
                  <button onClick={() => openSetup(activeTab)} className="flex-1 rounded-lg py-2 text-[12.5px] font-semibold" style={{ border: '1px solid var(--ci-line)', background: 'var(--ci-card)', color: 'var(--ci-ink1)' }}>키 수정</button>
                  <button onClick={() => handleDisconnect(activeTab)} className="flex-1 rounded-lg py-2 text-[12.5px] font-semibold" style={{ border: '1px solid rgba(239,77,77,.3)', color: UP }}>연결 해제</button>
                </div>
                <p className="mt-3 text-[10.5px]" style={{ color: 'var(--ci-ink3)' }}>* 체결 내역은 거래 페이지에서 확인하세요. 키는 읽기 전용 권한만 사용합니다.</p>
              </Panel>
            </div>
          </div>
        )}

        {!hasAny && !loading && !error && (
          <Panel style={{ padding: '16px 22px' }}><div className="text-center text-[12.5px]" style={{ color: 'var(--ci-ink3)' }}>연결된 실계좌가 없습니다. 위 거래소 탭에서 API 키를 등록해보세요.</div></Panel>
        )}

        <footer className="mt-2 flex flex-wrap justify-between gap-3 border-t border-white/10 pt-5">
          <span className="font-mono text-[11.5px] text-white/30">© 2026 WHALEARC · 실계좌 데이터는 거래소 API 기준입니다.</span>
          <span className="text-[11.5px] text-white/30">Built quietly, beneath the surface.</span>
        </footer>
      </div>

      {showSetup && <ExchangeConnectModal exchangeType={showSetup} account={accounts.find(a => a.exchangeType === showSetup)} onClose={() => setShowSetup(null)} onSaved={(m, t) => { showToast(m, t); load(); }} />}
      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </HelmShell>
  );
};

/* virt = 페이퍼(모의투자), non-virt = 실계좌(거래소 연동) */
const ConsolePortfolioPage = () => {
  const { isVirt } = useRoutePrefix();
  return isVirt ? <PaperPortfolio /> : <RealAccountPortfolio />;
};

export default ConsolePortfolioPage;
