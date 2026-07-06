import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRoutePrefix } from '../hooks/useRoutePrefix';
import HelmShell from '../components/HelmShell';
import TradingChart from '../components/TradingChart';
import OrderPanel from '../components/trade/OrderPanel';
import type { MarketPrice } from '../services/marketService';
import { useMarketFeed } from '../hooks/useMarketFeed';
import { useExchangeRate } from '../hooks/useExchangeRate';
import { userService } from '../services/userService';
import apiClient from '../utils/api';
import {
  UP, DOWN, GLOW, INK1, INK2, INK3, LINE, LINE_STRONG, mkCard,
  ASSET_CLASSES, POPULAR_COINS, curOf, fmtPrice, fmtVol,
} from '../lib/marketUi';

/* ────────────────────────────────────────────────────────────
   ConsoleMarketsPage — 시세·거래 통합 페이지.
   왼쪽 네비의 '시세'와 '거래'를 하나로 합치고, 거래(주문)는 시세 상세의
   매수/매도 버튼(또는 우측 '거래' 손잡이)으로 여는 슬라이드오버 OrderPanel로 처리.
   시세 상태 머신은 useMarketFeed 훅으로 단일 소스화(폴링/캐시/검색/실시간/딥링크).
   ──────────────────────────────────────────────────────────── */

const Stat = ({ label, value, color }: { label: string; value: string; color?: string }) => (
  <div style={{ ...mkCard, padding: '18px 20px', minWidth: 0 }}>
    <div style={{ fontSize: 11, color: INK2, letterSpacing: '.14em', fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</div>
    <div className="font-mono" style={{ marginTop: 10, fontSize: 'clamp(16px,2.1vw,22px)', fontWeight: 600, color: color || 'var(--ci-ink0)', whiteSpace: 'nowrap' }}>{value}</div>
  </div>
);

// 범례 색 = TradingChart(utils/indicators INDICATOR_COLORS)와 동일하게 맞춤 — 차트선과 범례 색 불일치 방지
const MA_DEFS: [number, string][] = [[5, '#f59e0b'], [20, '#3b82f6'], [60, '#a855f7']];
const EMA_COLOR = '#10b981', VWAP_COLOR = '#ec4899';
type Inds = { ma: boolean; ema: boolean; vwap: boolean; bb: boolean; sar: boolean; ichimoku: boolean; vol: boolean; rsi: boolean; macd: boolean; stoch: boolean; cci: boolean; wr: boolean; atr: boolean; obv: boolean };
// 가격 오버레이(MA·EMA·VWAP·볼린저·SAR·일목) + 보조패널 오실레이터(거래량·RSI·MACD·스토캐스틱·CCI·W%R·ATR·OBV)
const IND_LABELS: { k: keyof Inds; label: string }[] = [
  { k: 'ma', label: '이동평균' }, { k: 'ema', label: 'EMA' }, { k: 'vwap', label: 'VWAP' }, { k: 'bb', label: '볼린저' }, { k: 'sar', label: 'SAR' }, { k: 'ichimoku', label: '일목균형표' },
  { k: 'vol', label: '거래량' }, { k: 'rsi', label: 'RSI' }, { k: 'macd', label: 'MACD' }, { k: 'stoch', label: '스토캐스틱' }, { k: 'cci', label: 'CCI' }, { k: 'wr', label: 'Williams %R' }, { k: 'atr', label: 'ATR' }, { k: 'obv', label: 'OBV' },
];
// 초보자용 지표 한 줄 설명 (토글 hover 툴팁 + 설명 패널)
const INDICATOR_HELP: Record<keyof Inds, string> = {
  ma: '이동평균선 — 최근 N일 평균가를 이은 선. 추세 방향을 봅니다. (5·20·60일)',
  ema: '지수이동평균 — 최근 가격에 가중치를 더 준 이동평균. MA보다 빠르게 반응해요.',
  vwap: 'VWAP — 거래량까지 반영한 평균가격. 기관이 매매 기준으로 많이 봅니다.',
  bb: '볼린저 밴드 — 평균선 ±표준편차 띠. 띠가 좁아지면 큰 움직임 임박, 상단 돌파는 강세 신호.',
  sar: 'Parabolic SAR — 점이 가격 아래면 상승추세, 위면 하락추세. 추세 전환·손절 기준으로 써요.',
  ichimoku: '일목균형표 — 구름(선행스팬)으로 지지/저항을, 전환·기준선으로 추세를 한눈에 봅니다.',
  vol: '거래량 — 그 봉에서 얼마나 거래됐는지. 가격 움직임의 "힘"을 확인해요.',
  rsi: 'RSI — 0~100. 30 이하 과매도(반등 기대), 70 이상 과매수(조정 주의).',
  macd: 'MACD — 단기·장기 이동평균의 차이. 시그널선을 상향 돌파하면 매수 신호.',
  stoch: '스토캐스틱 — 최근 범위에서 현재가의 위치(0~100). %K가 %D를 상향 돌파하면 매수.',
  cci: 'CCI — 평균에서 얼마나 벗어났나. +100 위는 과매수, -100 아래는 과매도.',
  wr: 'Williams %R — 스토캐스틱과 비슷(-100~0). -20 위 과매수, -80 아래 과매도.',
  atr: 'ATR — 평균 변동폭. 클수록 변동성이 큽니다. 손절 폭·포지션 크기 정할 때 참고.',
  obv: 'OBV — 거래량 누적선. 가격보다 OBV가 먼저 움직이면 추세 전환 신호일 수 있어요.',
};
// 지표 토글(Inds) → TradingChart 의 activeIndicators(키 배열) 매핑. (거래량은 TradingChart에 항상 표시)
const indToKeys = (ind: Inds): string[] => {
  const out: string[] = [];
  if (ind.ma) out.push('MA5', 'MA20', 'MA60');
  if (ind.ema) out.push('EMA');
  if (ind.vwap) out.push('VWAP');
  if (ind.bb) out.push('BOLLINGER');
  if (ind.sar) out.push('PARABOLIC_SAR');
  if (ind.ichimoku) out.push('ICHIMOKU');
  if (ind.rsi) out.push('RSI');
  if (ind.macd) out.push('MACD');
  if (ind.stoch) out.push('STOCHASTIC');
  if (ind.cci) out.push('CCI');
  if (ind.wr) out.push('WILLIAMS_R');
  if (ind.atr) out.push('ATR');
  if (ind.obv) out.push('OBV');
  return out;
};

const FavStar = ({ on, onClick }: { on: boolean; onClick: (e: React.MouseEvent) => void }) => (
  <button onClick={onClick} aria-label={on ? '관심 해제' : '관심 추가'} className="flex h-6 w-6 shrink-0 items-center justify-center" style={{ color: on ? '#f5d061' : INK3 }}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6"><path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.8 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" strokeLinejoin="round" /></svg>
  </button>
);

type StockListProps = {
  assets: MarketPrice[]; activeSym: string; onPick: (s: string) => void;
  isFav: (a: MarketPrice) => boolean; onToggleFav: (a: MarketPrice) => void;
  filter: string; setFilter: (f: string) => void;
  query: string; setQuery: (q: string) => void;
  searchResults: { code: string; name: string; market: string }[]; onSearchPick: (r: { code: string; name: string; market: string }) => void;
  loading: boolean; canSearch: boolean; usdKrw: number;
};
const StockList = ({ assets, activeSym, onPick, isFav, onToggleFav, filter, setFilter, query, setQuery, searchResults, onSearchPick, loading, canSearch, usdKrw }: StockListProps) => (
  <aside style={{ ...mkCard, padding: 0, display: 'flex', flexDirection: 'column', minHeight: 760 }}>
    <div style={{ padding: '20px 22px 16px', borderBottom: `1px solid ${LINE}` }}>
      <div className="mb-3.5 flex items-center justify-between"><h3 className="text-[17.5px] font-bold">종목 목록</h3><span className="font-mono text-[12px]" style={{ color: INK3 }}>{assets.length}개</span></div>
      <div className="relative">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: INK3 }}><circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.4" /><path d="M9 9l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
        <input value={query} onChange={e => setQuery(e.target.value)} aria-label="종목 검색" placeholder={canSearch ? '종목명 · 코드 검색 (2자 이상)' : '종목 필터'} className="w-full rounded-lg py-2.5 pl-[34px] pr-3 text-[14px] outline-none" style={{ border: `1px solid ${LINE}`, background: 'var(--ci-card)', color: 'var(--ci-ink0)' }} />
        {canSearch && searchResults.length > 0 && (
          <div className="absolute left-0 right-0 top-[44px] z-20 max-h-[280px] overflow-y-auto rounded-lg" style={{ background: 'var(--ci-raised)', border: `1px solid ${LINE_STRONG}`, boxShadow: '0 12px 28px -12px rgba(0,0,0,.5)' }}>
            {searchResults.map(r => (
              <button key={r.code} onClick={() => onSearchPick(r)} className="flex w-full items-center justify-between px-3.5 py-2.5 text-left" style={{ borderBottom: `1px solid ${LINE}` }}>
                <span className="text-[14px] font-semibold">{r.name}</span><span className="font-mono text-[12px]" style={{ color: INK3 }}>{r.code} · {r.market}</span>
              </button>
            ))}
          </div>
        )}
        {canSearch && query.trim().length >= 2 && searchResults.length === 0 && (
          <div className="absolute left-0 right-0 top-[44px] z-20 rounded-lg px-3.5 py-3 text-[13.5px]" style={{ background: 'var(--ci-raised)', border: `1px solid ${LINE_STRONG}`, color: INK3, boxShadow: '0 12px 28px -12px rgba(0,0,0,.5)' }}>'{query.trim()}' 검색 결과가 없습니다.</div>
        )}
      </div>
      <div className="mt-3.5 flex w-fit gap-1.5 rounded-lg p-[3px]" style={{ background: 'var(--ci-card)', border: `1px solid ${LINE}` }}>
        {[['all', '전체'], ['fav', '★ 관심'], ['gain', '급등'], ['loss', '급락']].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className="rounded-md px-3 py-1.5 text-[13.5px] font-semibold" style={{ background: filter === k ? 'rgba(91,157,255,.18)' : 'transparent', color: filter === k ? 'var(--ci-ink0)' : INK1 }}>{l}</button>
        ))}
      </div>
    </div>
    <ul className="no-scrollbar m-0 flex-1 list-none overflow-y-auto p-0" style={{ maxHeight: 640 }}>
      {loading && assets.length === 0 ? (
        <li className="flex h-40 items-center justify-center text-[14px]" style={{ color: INK3 }}><span className="mr-2 h-4 w-4 animate-spin rounded-full" style={{ border: '2px solid rgba(91,157,255,.3)', borderTopColor: GLOW }} />불러오는 중…</li>
      ) : assets.length === 0 ? (
        <li className="flex h-40 items-center justify-center text-[14px]" style={{ color: INK3 }}>{filter === 'fav' ? '관심 종목이 없습니다' : '종목이 없습니다'}</li>
      ) : assets.map((s, i) => {
        const isActive = s.symbol === activeSym, up = s.changeRate >= 0;
        return (
          <li key={s.symbol}>
            <button onClick={() => onPick(s.symbol)} className="grid w-full items-center gap-2.5 px-[18px] py-3.5 text-left" style={{ gridTemplateColumns: 'auto 1fr auto', background: isActive ? 'rgba(91,157,255,.10)' : 'transparent', borderLeft: isActive ? `2px solid ${GLOW}` : '2px solid transparent', borderBottom: i === assets.length - 1 ? 'none' : `1px solid ${LINE}` }}>
              <FavStar on={isFav(s)} onClick={e => { e.stopPropagation(); onToggleFav(s); }} />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-[14.5px]" style={{ fontWeight: isActive ? 700 : 600 }}>{s.name}</span>
                <span className="font-mono text-[12px]" style={{ color: INK3 }}>{s.symbol} · Vol {fmtVol(s.volume)}</span>
              </div>
              <div className="flex flex-col gap-0.5 text-right">
                <span className="font-mono text-[14px] font-semibold">{fmtPrice(s, usdKrw)}</span>
                <span className="font-mono text-[12.5px] font-semibold" style={{ color: up ? UP : DOWN }}>{up ? '+' : ''}{s.changeRate.toFixed(2)}%</span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
    <div className="px-[18px] py-3" style={{ borderTop: `1px solid ${LINE}`, background: 'var(--ci-card)' }}><span className="text-[12px]" style={{ color: INK3 }}>* 주식 시세는 KIS 모의투자 API 기준 약 15~20초 시차</span></div>
  </aside>
);

const pill = (kind: 'primary' | 'danger' | 'ghost'): React.CSSProperties => ({
  padding: '10px 18px', borderRadius: 10, fontSize: 13.5, fontWeight: 600, display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap', cursor: 'pointer',
  ...(kind === 'primary' ? { border: 0, background: `linear-gradient(180deg, ${UP}, #c73a3a)`, color: '#fff' }
    : kind === 'danger' ? { border: 0, background: `linear-gradient(180deg, ${DOWN}, #2f6fe0)`, color: '#fff' }
      : { border: `1px solid ${LINE_STRONG}`, background: 'transparent', color: 'var(--ci-ink0)' }),
});

type DetailProps = { stock: MarketPrice; isFav: boolean; onToggleFav: () => void; usdKrw: number; isCrypto: boolean; live: boolean; onBuy: () => void; onSell: () => void; onBacktest: () => void };
const StockDetail = ({ stock, isFav, onToggleFav, usdKrw, isCrypto, live, onBuy, onSell, onBacktest }: DetailProps) => {
  const [ind, setInd] = useState<Inds>({ ma: true, ema: false, vwap: false, bb: false, sar: false, ichimoku: false, vol: true, rsi: false, macd: false, stoch: false, cci: false, wr: false, atr: false, obv: false });
  const [helpOpen, setHelpOpen] = useState(false);
  const toggleInd = (k: keyof Inds) => setInd(s => ({ ...s, [k]: !s[k] }));
  const up = stock.changeRate >= 0;
  const krw = stock.currency === 'USD' && usdKrw > 0;   // USD → 원화 환산
  const cur = krw ? '₩' : curOf(stock);
  const nfmt = (v: number) => (krw ? Math.round(v * usdKrw) : v).toLocaleString('ko-KR', { maximumFractionDigits: krw ? 0 : (stock.currency === 'USD' ? 2 : 0) });
  const prevClose = stock.price - stock.change;
  return (
    <section className="flex flex-col gap-[18px]">
      {/* 종목 헤더 */}
      <div style={{ ...mkCard, padding: '24px 28px' }}>
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="mb-2 flex items-center gap-2.5">
              <span className="rounded-[5px] px-2 py-[3px] text-[11.5px] font-bold tracking-[.08em]" style={{ background: 'rgba(91,157,255,.14)', color: '#cfe1ff', border: '1px solid rgba(91,157,255,.24)' }}>{stock.market}</span>
              <span className="font-mono text-[13px]" style={{ color: INK3 }}>{stock.symbol}</span>
              <button onClick={onToggleFav} aria-label="관심 종목" className="flex h-6 w-6 items-center justify-center" style={{ color: isFav ? '#f5d061' : INK3 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill={isFav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6"><path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.8 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" strokeLinejoin="round" /></svg>
              </button>
            </div>
            <h2 className="text-[32.5px] font-bold tracking-tight">{stock.name}</h2>
            <div className="mt-3.5 flex flex-wrap items-baseline gap-3.5">
              <span className="font-mono text-[41px] font-semibold tracking-tight">{fmtPrice(stock, usdKrw)}</span>
              {krw && <span className="font-mono text-[14px]" style={{ color: INK3 }}>(${stock.price.toLocaleString('ko-KR', { maximumFractionDigits: 2 })})</span>}
              <span className="font-mono text-[17.5px] font-semibold" style={{ color: up ? UP : DOWN }}>{up ? '+' : ''}{nfmt(stock.change)} ({up ? '+' : ''}{stock.changeRate.toFixed(2)}%)</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={onBuy} style={pill('primary')}>매수</button>
            <button onClick={onSell} style={pill('danger')}>매도</button>
            <button onClick={onBacktest} style={pill('ghost')}>전략 백테스트 →</button>
          </div>
        </div>
      </div>
      {/* 차트 */}
      <div style={{ ...mkCard, padding: '20px 24px' }}>
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13.5px] font-semibold" style={{ color: INK2 }}>차트</span>
            {isCrypto && live && <span className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-semibold" style={{ background: 'rgba(239,77,77,.12)', color: UP, border: '1px solid rgba(239,77,77,.25)' }}><span className="h-1.5 w-1.5 rounded-full animate-pulse-dot" style={{ background: UP }} />실시간</span>}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {IND_LABELS.map(({ k, label }) => { const on = ind[k]; return (
              <button key={k} onClick={() => toggleInd(k)} title={INDICATOR_HELP[k]} className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px]" style={{ border: on ? '1px solid rgba(91,157,255,.32)' : `1px solid ${LINE}`, background: on ? 'rgba(91,157,255,.10)' : 'transparent', color: on ? 'var(--ci-ink0)' : INK2 }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: on ? GLOW : INK3 }} />{label}
              </button>); })}
            <button onClick={() => setHelpOpen(o => !o)} className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[13px] font-semibold" style={{ color: 'var(--ci-sonar)' }} title="각 지표가 뭔지 설명 보기">{helpOpen ? '설명 닫기 ▴' : '지표가 뭔가요? ▾'}</button>
          </div>
        </div>
        {helpOpen && (
          <div className="mb-2 grid gap-1.5 rounded-lg p-3" style={{ background: 'var(--ci-card)', border: `1px solid ${LINE}`, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            {IND_LABELS.map(({ k, label }) => (
              <div key={k} className="text-[12.5px] leading-relaxed"><span className="font-bold" style={{ color: ind[k] ? GLOW : 'var(--ci-ink0)' }}>{label}</span> <span style={{ color: INK2 }}>— {INDICATOR_HELP[k].split('—')[1]?.trim() || INDICATOR_HELP[k]}</span></div>
            ))}
          </div>
        )}
        {(ind.ma || ind.ema || ind.vwap) && <div className="mb-2 flex flex-wrap gap-3 text-[11.5px]" style={{ color: INK2 }}>{ind.ma && MA_DEFS.map(([p, c]) => <span key={p} className="inline-flex items-center gap-1.5"><span style={{ width: 12, height: 2, background: c, display: 'inline-block' }} />MA{p}</span>)}{ind.ema && <span className="inline-flex items-center gap-1.5"><span style={{ width: 12, height: 2, background: EMA_COLOR, display: 'inline-block' }} />EMA20</span>}{ind.vwap && <span className="inline-flex items-center gap-1.5"><span style={{ width: 12, height: 2, background: VWAP_COLOR, display: 'inline-block' }} />VWAP</span>}</div>}
        <div>
          <TradingChart symbol={stock.symbol} price={stock.price} changeRate={stock.changeRate}
            assetType={stock.assetType} activeIndicators={indToKeys(ind)} isDark />
        </div>
      </div>
      {/* 통계 4 */}
      <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
        <Stat label="전일 종가" value={cur + nfmt(prevClose)} />
        <Stat label="등락률" value={`${up ? '+' : ''}${stock.changeRate.toFixed(2)}%`} color={up ? UP : DOWN} />
        <Stat label="등락액" value={`${up ? '+' : ''}${nfmt(stock.change)}`} color={up ? UP : DOWN} />
        <Stat label="거래량" value={fmtVol(stock.volume)} />
      </div>
      {/* 기본 정보 */}
      <div style={{ ...mkCard, padding: '22px 24px' }}>
        <h3 className="mb-3.5 text-[15px] font-bold tracking-[.02em]">기본 정보</h3>
        <dl className="m-0 grid text-[14px]" style={{ gridTemplateColumns: 'auto 1fr auto 1fr', rowGap: 10, columnGap: 14 }}>
          <dt style={{ color: INK2 }}>시장</dt><dd className="m-0 truncate text-right">{stock.market}</dd>
          <dt style={{ color: INK2 }}>통화</dt><dd className="m-0 truncate text-right font-mono">{stock.currency || 'KRW'}</dd>
          <dt style={{ color: INK2 }}>현재가</dt><dd className="m-0 truncate text-right font-mono">{fmtPrice(stock, usdKrw)}</dd>
          <dt style={{ color: INK2 }}>거래량</dt><dd className="m-0 truncate text-right font-mono">{stock.volume.toLocaleString('ko-KR')}</dd>
        </dl>
      </div>
      {/* 종목 메모 */}
      <NoteCard sym={stock.symbol} name={stock.name} />
    </section>
  );
};

const NoteCard = ({ sym, name }: { sym: string; name: string }) => {
  const [note, setNote] = useState('');
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    try { const all = JSON.parse(localStorage.getItem('whalearc_stock_memos') || '{}'); setNote(all[sym] || ''); } catch { setNote(''); }
  }, [sym]);
  // 언마운트 시 대기 중인 저장 타이머 정리
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);
  const onChange = (v: string) => {
    const t = v.slice(0, 200); setNote(t);
    // 매 키 입력마다 동기 직렬화하지 않도록 400ms 디바운스 후 한 번만 저장
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try { const all = JSON.parse(localStorage.getItem('whalearc_stock_memos') || '{}'); all[sym] = t; localStorage.setItem('whalearc_stock_memos', JSON.stringify(all)); } catch { /* ignore */ }
    }, 400);
  };
  return (
    <div style={{ ...mkCard, padding: '18px 22px' }}>
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-[15px] font-bold"><svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ color: INK2 }}><path d="M9 2L12 5L5 12L1.5 12.5L2 9L9 2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>종목 메모</h3>
        <span className="font-mono text-[12px]" style={{ color: INK3 }}>{note.length}/200</span>
      </div>
      <textarea value={note} onChange={e => onChange(e.target.value)} placeholder={`${name}에 대한 메모를 남겨보세요 (자동 저장)`} className="w-full resize-y rounded-lg px-3.5 py-3 text-[14.5px] leading-normal outline-none" style={{ minHeight: 80, border: `1px solid ${LINE}`, background: 'var(--ci-card)', color: 'var(--ci-ink0)' }} />
    </div>
  );
};

const Toast = ({ msg, type }: { msg: string; type: 'success' | 'error' }) => (
  <div className="fixed bottom-6 left-1/2 z-[120] -translate-x-1/2 rounded-xl px-5 py-3 text-[14px] font-semibold text-white" style={{ background: type === 'error' ? 'linear-gradient(180deg,#e0524f,#c23b38)' : 'linear-gradient(180deg,#2f9e6e,#1f7d57)', boxShadow: '0 14px 32px -10px rgba(0,0,0,.55)', animation: 'message-in .25s ease' }}>{msg}</div>
);

type IndexData = { code: string; name: string; price: number; change: number; changeRate: number };
// 실데이터 로드 전/실패 시 표시할 빈 슬롯 (가짜 숫자 대신 '—')
const FALLBACK_INDICES: IndexData[] = [
  { code: 'KOSPI', name: 'KOSPI', price: 0, change: 0, changeRate: 0 },
  { code: 'KOSDAQ', name: 'KOSDAQ', price: 0, change: 0, changeRate: 0 },
];

const ConsoleMarketsPage = () => {
  const { session } = useAuth();
  const { isVirt, prefix } = useRoutePrefix();
  const navigate = useNavigate();
  const userName = session?.user?.email ? session.user.email.split('@')[0] : '항해사';

  // 시세 상태 머신(단일 소스) + 환율
  const {
    klass, setKlass, assetType, canSearch,
    mergedList, sel, activeSym, setActiveSym,
    loading, error, wsConnected, rtPrice,
    query, setQuery, searchResults, onSearchPick, requestSymbol, recent,
  } = useMarketFeed();
  const usdKrw = useExchangeRate();

  // 화면-로컬 탐색 상태
  const [favoriteAssets, setFavoriteAssets] = useState<string[]>([]);
  const [listFilter, setListFilter] = useState('all');
  const [sortBy, setSortBy] = useState('volume');
  const [indices, setIndices] = useState<IndexData[]>(FALLBACK_INDICES);

  // 주문 패널
  const [panelOpen, setPanelOpen] = useState(false);
  const [orderSide, setOrderSide] = useState('buy');
  const openPanel = useCallback((side: string) => { setOrderSide(side); setPanelOpen(true); }, []);

  // 딥링크 ?panel=order(&side=buy|sell) — 거래 의지가 있는 진입(포트폴리오·알림 등)은 주문 패널을 바로 연다
  const [searchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('panel') === 'order') openPanel(searchParams.get('side') === 'sell' ? 'sell' : 'buy');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 토스트
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const toastTimer = useRef<number | null>(null);
  const notify = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3000);
  }, []);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  // 관심종목 로드
  useEffect(() => {
    if (import.meta.env.DEV && window.location.pathname.startsWith('/preview')) return; // 프리뷰(비로그인) 401 리다이렉트 방지
    userService.getProfile().then(p => { if (p?.favoriteAssets) setFavoriteAssets(p.favoriteAssets); }).catch(() => {});
  }, []);

  // 인덱스 스트립 (공개 API)
  useEffect(() => {
    apiClient.get<IndexData[]>('/api/market/indices').then(r => { if (r.data?.length) setIndices(r.data); }).catch(() => {});
  }, []);

  // 단축키 (B 매수 패널 / S 매도 패널) — 입력 중에는 무시, Esc는 검색 초기화
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.key === 'b' || e.key === 'B') { if (sel) openPanel('buy'); }
      else if (e.key === 's' || e.key === 'S') { if (sel) openPanel('sell'); }
      else if (e.key === 'Escape') { if (!panelOpen) { setQuery(''); } }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sel, panelOpen, openPanel, setQuery]);

  // 관심 판별
  const favoriteSet = useMemo(() => {
    const s = new Set<string>();
    for (const f of favoriteAssets) { s.add(f); s.add(f.toUpperCase()); s.add(f.toLowerCase()); }
    return s;
  }, [favoriteAssets]);
  const isFav = useCallback((a: MarketPrice) => favoriteSet.has(a.symbol) || favoriteSet.has(a.name) || favoriteSet.has(a.symbol?.toUpperCase()), [favoriteSet]);

  const toggleFav = useCallback((a: MarketPrice) => {
    setFavoriteAssets(prev => {
      const key = a.symbol;
      const has = prev.some(f => f === a.symbol || f === a.name || f.toUpperCase() === a.symbol.toUpperCase());
      const next = has ? prev.filter(f => f !== a.symbol && f !== a.name && f.toUpperCase() !== a.symbol.toUpperCase()) : [...prev, key];
      userService.saveUserInfo({ favoriteAssets: next }).catch(() => {});
      return next;
    });
  }, []);

  // 표시 목록: 필터 + 정렬 + 로컬 검색(크립토) + 크립토 인기코인 상단 고정
  const displayList = useMemo(() => {
    let list = mergedList;
    if (listFilter === 'fav') list = list.filter(isFav);
    else if (listFilter === 'gain') list = list.filter(a => a.changeRate > 0);
    else if (listFilter === 'loss') list = list.filter(a => a.changeRate < 0);
    if (!canSearch && query.trim()) { const q = query.trim().toLowerCase(); list = list.filter(a => a.name.toLowerCase().includes(q) || a.symbol.toLowerCase().includes(q)); }
    const arr = [...list];
    // USD 종목(미국주식/ETF)은 원화 환산가로 비교해 통화가 섞여도 가격순 정렬이 일관되게
    const krwPrice = (a: MarketPrice) => (a.currency === 'USD' ? a.price * (usdKrw || 1) : a.price);
    if (sortBy === 'volume') arr.sort((a, b) => {
      if (assetType === 'CRYPTO') { const pa = POPULAR_COINS.has(a.symbol), pb = POPULAR_COINS.has(b.symbol); if (pa !== pb) return pa ? -1 : 1; }
      return b.volume - a.volume;
    });
    else if (sortBy === 'mcap') arr.sort((a, b) => krwPrice(b) - krwPrice(a));
    else if (sortBy === 'gain') arr.sort((a, b) => b.changeRate - a.changeRate);
    else if (sortBy === 'loss') arr.sort((a, b) => a.changeRate - b.changeRate);
    return arr;
  }, [mergedList, listFilter, sortBy, query, canSearch, isFav, usdKrw, assetType]);

  const selectedIsCrypto = assetType === 'CRYPTO';

  return (
    <HelmShell active="markets" virt={isVirt} userName={userName} session={selectedIsCrypto ? '실시간 시세 · WebSocket' : '시세 10초 갱신'}>
      <div className="flex flex-col gap-6">
        {/* 헤더 */}
        <div>
          <div className="mb-3 flex items-center gap-2.5">{(() => { const live = selectedIsCrypto; const dot = !live ? 'var(--ci-sonar)' : wsConnected ? UP : '#f5d061'; const label = !live ? '자동 갱신 · 10초' : wsConnected ? 'LIVE · 실시간 연결됨' : '실시간 연결 중…'; return <><span className="h-1.5 w-1.5 rounded-full animate-pulse-dot" style={{ background: dot, boxShadow: `0 0 8px ${dot}` }} /><span className="text-[12.5px] font-semibold tracking-[.18em]" style={{ color: live && !wsConnected ? '#f5d061' : 'var(--ci-sonar)' }}>{label}</span></>; })()}</div>
          <h1 className="text-[39px] font-bold tracking-tight">시장 현황</h1>
          <p className="mt-2 text-[15.5px]" style={{ color: INK1 }}>종목을 살펴보고, 바로 매수·매도까지 한 곳에서. 관심 종목의 <b style={{ color: 'var(--ci-ink0)' }}>매수/매도</b> 버튼을 누르면 주문 패널이 열립니다.</p>
        </div>
        {/* 인덱스 스트립 */}
        <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          {indices.map(ix => {
            const u = ix.changeRate >= 0; const hasData = ix.price > 0;
            return (
              <div key={ix.code} className="rounded-[14px] p-5" style={{ ...mkCard }}>
                <div className="text-[12px] font-semibold tracking-[.14em]" style={{ color: INK2 }}>{ix.name}</div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="font-mono text-[24px] font-semibold">{hasData ? ix.price.toLocaleString('ko-KR', { maximumFractionDigits: 2 }) : '—'}</span>
                  {hasData && <span className="font-mono text-[14px] font-semibold" style={{ color: u ? UP : DOWN }}>{u ? '+' : ''}{ix.changeRate.toFixed(2)}%</span>}
                </div>
              </div>
            );
          })}
        </div>
        {/* 자산 클래스 탭 */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {ASSET_CLASSES.map(c => { const on = c.key === klass; return (
              <button key={c.key} onClick={() => { setKlass(c.key); setListFilter('all'); }} className="inline-flex items-center gap-2 rounded-[10px] px-[18px] py-2.5 text-[15px] font-semibold" style={{ border: on ? '1px solid rgba(91,157,255,.35)' : `1px solid ${LINE}`, background: on ? 'rgba(91,157,255,.12)' : 'var(--ci-card)', color: 'var(--ci-ink0)' }}>
                {c.label}<span className="text-[12px] font-medium tracking-[.04em]" style={{ color: on ? '#cfe1ff' : INK2 }}>{c.meta}</span>
              </button>); })}
          </div>
          <div className="flex items-center gap-2"><span className="text-[13px]" style={{ color: INK2 }}>정렬</span>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="rounded-lg py-2 pl-3 pr-7 text-[14px] font-medium" style={{ border: `1px solid ${LINE}`, background: 'var(--ci-card)', color: 'var(--ci-ink0)', appearance: 'none' }}>
              <option value="volume">거래량순</option><option value="mcap">가격순</option><option value="gain">등락률순 (상승)</option><option value="loss">등락률순 (하락)</option>
            </select>
          </div>
        </div>
        {error && <div className="rounded-xl px-4 py-3 text-[14px]" style={{ background: 'rgba(239,77,77,.1)', border: '1px solid rgba(239,77,77,.25)', color: '#fca5a5' }}>{error}</div>}
        {/* 본문 */}
        <div className="grid items-start gap-6 grid-cols-1 lg:grid-cols-[minmax(320px,380px)_1fr]">
          <StockList assets={displayList} activeSym={activeSym} onPick={setActiveSym} isFav={isFav} onToggleFav={toggleFav}
            filter={listFilter} setFilter={setListFilter} query={query} setQuery={setQuery} searchResults={searchResults} onSearchPick={onSearchPick} loading={loading} canSearch={canSearch} usdKrw={usdKrw} />
          <div className="flex flex-col gap-3">
            {/* 최근 본 종목 */}
            {recent.filter(r => !sel || r.stockCode !== sel.symbol).length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[12px] font-semibold" style={{ color: INK3 }}>최근 본</span>
                {recent.filter(r => !sel || r.stockCode !== sel.symbol).slice(0, 6).map(r => (
                  <button key={r.stockCode} onClick={() => requestSymbol(r.stockCode, r.assetType)} className="rounded-full px-2.5 py-1 text-[12.5px] font-semibold" style={{ border: `1px solid ${LINE}`, background: 'var(--ci-card)', color: INK1 }}>{r.stockName}</button>
                ))}
              </div>
            )}
            {sel ? <StockDetail stock={sel} isFav={isFav(sel)} onToggleFav={() => toggleFav(sel)} usdKrw={usdKrw} isCrypto={selectedIsCrypto} live={rtPrice != null && wsConnected}
              onBuy={() => openPanel('buy')} onSell={() => openPanel('sell')} onBacktest={() => navigate(`${prefix}/strategy`)} />
              : <div style={{ ...mkCard, padding: '60px', textAlign: 'center', color: INK3 }} className="text-[15px]">{loading ? '불러오는 중…' : '종목을 선택하세요'}</div>}
          </div>
        </div>
        {/* 푸터 */}
        <footer className="flex flex-wrap items-center justify-between gap-3.5 pt-6" style={{ borderTop: `1px solid ${LINE}` }}>
          <span className="font-mono text-[13px]" style={{ color: INK3 }}>© 2026 WhaleArc · 모든 항해는 사용자의 책임 아래 진행됩니다.</span>
          <div className="flex gap-[18px] text-[13.5px]" style={{ color: INK2 }}><a>도움말</a><a>상태</a><a>API</a><a>의견 보내기</a></div>
        </footer>
      </div>

      {/* 우측 '거래' 손잡이 — 종목 선택 상태에서 패널이 닫혀 있을 때 노출 */}
      {sel && !panelOpen && (
        <button onClick={() => openPanel('buy')} aria-label="거래 패널 열기" className="fixed right-0 top-1/2 z-[90] flex -translate-y-1/2 flex-col items-center gap-1 rounded-l-xl px-2 py-4 text-[13px] font-bold text-white" style={{ background: `linear-gradient(180deg, ${GLOW}, #2f6fe0)`, boxShadow: '-8px 0 24px -10px rgba(60,120,255,.6)', writingMode: 'vertical-rl' }}>
          <span style={{ letterSpacing: '.12em' }}>거래</span>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ transform: 'rotate(90deg)' }}><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      )}

      <OrderPanel open={panelOpen} onClose={() => setPanelOpen(false)} sel={sel} usdKrw={usdKrw} rtPrice={rtPrice} isVirt={isVirt} side={orderSide} setSide={setOrderSide} notify={notify} />
      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </HelmShell>
  );
};

export default ConsoleMarketsPage;
