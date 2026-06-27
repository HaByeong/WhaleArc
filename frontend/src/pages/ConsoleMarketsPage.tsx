import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRoutePrefix } from '../hooks/useRoutePrefix';
import HelmShell from '../components/HelmShell';
import TradingChart from '../components/TradingChart';
import { marketService, type MarketPrice, type AssetType } from '../services/marketService';
import { useRealtimePrice } from '../hooks/useRealtimePrice';
import { userService } from '../services/userService';
import apiClient from '../utils/api';

/* ────────────────────────────────────────────────────────────
   ConsoleMarketsPage — 시세 (실데이터 배선)
   marketService.getPrices(자산클래스) + getCandlesticks(캔들) + searchStocks(검색)
   + useRealtimePrice(크립토 실시간) + 관심종목 watchlist(userService).
   ──────────────────────────────────────────────────────────── */

const UP = '#ef4d4d';   // 상승 = 빨강 (양쪽 테마 공통)
const DOWN = '#4d8aff'; // 하락 = 파랑 (양쪽 테마 공통)
const GLOW = 'var(--ci-sonar)';
const INK1 = 'var(--ci-ink1)', INK2 = 'var(--ci-ink2)', INK3 = 'var(--ci-ink3)';
const LINE = 'var(--ci-line)', LINE_STRONG = 'var(--ci-line-strong)';

const mkCard: React.CSSProperties = { borderRadius: 16, background: 'var(--ci-panel)', border: `1px solid ${LINE}`, boxShadow: 'var(--ci-panel-shadow)', position: 'relative', overflow: 'hidden' };

// klass(탭) → AssetType + 검색함수 + 메타
const ASSET_CLASSES: { key: string; type: AssetType; label: string; meta: string }[] = [
  { key: 'stock', type: 'STOCK', label: '주식', meta: 'KOSPI · KOSDAQ' },
  { key: 'us', type: 'US_STOCK', label: '미국주식', meta: 'NYSE · NASDAQ' },
  { key: 'etf', type: 'ETF', label: 'ETF', meta: '국내 · 해외' },
  { key: 'crypto', type: 'CRYPTO', label: '가상화폐', meta: '빗썸' },
];

const curOf = (a?: MarketPrice | null) => (a?.currency === 'USD' ? '$' : '₩');
// 미국주식/ETF(USD)는 환율로 원화 환산해서 표시 (옛 MarketPage 동작)
const fmtPrice = (a: MarketPrice, usdKrw = 0) => {
  if (a.currency === 'USD' && usdKrw > 0) return '₩' + Math.round(a.price * usdKrw).toLocaleString('ko-KR');
  return curOf(a) + a.price.toLocaleString('ko-KR', { maximumFractionDigits: a.currency === 'USD' ? 2 : 0 });
};
const fmtVol = (n: number) => (n >= 1e8 ? (n / 1e8).toFixed(1) + '억' : n >= 1e4 ? (n / 1e4).toFixed(1) + '만' : n.toLocaleString('ko-KR'));

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

type DetailProps = { stock: MarketPrice; isFav: boolean; onToggleFav: () => void; usdKrw: number; isCrypto: boolean; live: boolean };
const StockDetail = ({ stock, isFav, onToggleFav, usdKrw, isCrypto, live }: DetailProps) => {
  const navigate = useNavigate();
  const { prefix } = useRoutePrefix();
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
            <button onClick={() => navigate(`${prefix}/trade?code=${stock.symbol}&type=${stock.assetType}`)} style={pill('primary')}>매수</button>
            <button onClick={() => navigate(`${prefix}/trade?code=${stock.symbol}&type=${stock.assetType}`)} style={pill('danger')}>매도</button>
            <button onClick={() => navigate(`/virt/trade?code=${stock.symbol}&type=${stock.assetType}`)} style={pill('ghost')}><span className="mr-1.5 rounded px-1.5 py-0.5 text-[11px] font-bold tracking-[.06em]" style={{ background: 'rgba(180,210,255,.18)', color: '#cfe1ff' }}>VIRT</span>모의 거래</button>
            <button onClick={() => navigate(`${prefix}/strategy`)} style={pill('ghost')}>전략 백테스트 →</button>
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
    </section>
  );
};

type IndexData = { code: string; name: string; price: number; change: number; changeRate: number };
// 실데이터 로드 전/실패 시 표시할 빈 슬롯 (가짜 숫자 대신 '—')
const FALLBACK_INDICES: IndexData[] = [
  { code: 'KOSPI', name: 'KOSPI', price: 0, change: 0, changeRate: 0 },
  { code: 'KOSDAQ', name: 'KOSDAQ', price: 0, change: 0, changeRate: 0 },
];

const ConsoleMarketsPage = () => {
  const { session } = useAuth();
  const { isVirt } = useRoutePrefix();
  const userName = session?.user?.email ? session.user.email.split('@')[0] : '항해사';

  const [klass, setKlass] = useState('stock');
  const assetType = (ASSET_CLASSES.find(c => c.key === klass) || ASSET_CLASSES[0]).type;
  const canSearch = assetType !== 'CRYPTO';

  const [assetList, setAssetList] = useState<MarketPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSym, setActiveSym] = useState<string>('');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ code: string; name: string; market: string }[]>([]);
  const [favoriteAssets, setFavoriteAssets] = useState<string[]>([]);
  const [listFilter, setListFilter] = useState('all');
  const [sortBy, setSortBy] = useState('volume');
  const [indices, setIndices] = useState<IndexData[]>(FALLBACK_INDICES);
  const [usdKrw, setUsdKrw] = useState(0);
  const extraRef = useRef<MarketPrice[]>([]);
  const assetCacheRef = useRef<Record<AssetType, MarketPrice[]>>({ STOCK: [], CRYPTO: [], US_STOCK: [], ETF: [] });
  const selectionCacheRef = useRef<Record<AssetType, string>>({ STOCK: '', CRYPTO: '', US_STOCK: '', ETF: '' });
  const failRef = useRef(0);

  const recordRecent = useCallback((a: MarketPrice) => {
    try {
      const saved = localStorage.getItem('whalearc_recent_stocks');
      const prev: { stockCode: string; stockName: string; assetType: string }[] = saved ? JSON.parse(saved) : [];
      const next = [{ stockCode: a.symbol, stockName: a.name, assetType: a.assetType }, ...prev.filter(r => r.stockCode !== a.symbol)].slice(0, 8);
      localStorage.setItem('whalearc_recent_stocks', JSON.stringify(next));
    } catch { /* ignore */ }
  }, []);

  // 실시간(크립토)
  const { prices: realtimePrices, connected: wsConnected } = useRealtimePrice({ enabled: assetType === 'CRYPTO' });

  // 자산클래스 시세 로드 + 폴링. 캐시 즉시표시(stale-while-revalidate) + 탭별 선택 복원 + 3회연속 실패 누적
  useEffect(() => {
    let alive = true;
    extraRef.current = [];
    failRef.current = 0;
    const cached = assetCacheRef.current[assetType];
    if (cached.length > 0) { setAssetList(cached); setActiveSym(selectionCacheRef.current[assetType] || cached[0].symbol); }
    else { setAssetList([]); setActiveSym(''); setLoading(true); }
    const fetchPrices = async (isPoll: boolean) => {
      try {
        const prices = await marketService.getPrices(assetType);
        if (!alive) return;
        assetCacheRef.current[assetType] = prices;
        const server = new Set(prices.map(p => p.symbol));
        setAssetList([...extraRef.current.filter(a => !server.has(a.symbol)), ...prices]);
        setActiveSym(prev => prev || selectionCacheRef.current[assetType] || prices[0]?.symbol || '');
        failRef.current = 0; setError(null);
      } catch {
        if (!alive) return;
        failRef.current += 1;
        if (assetCacheRef.current[assetType].length === 0) setError('시세 데이터를 불러오지 못했습니다.');
        else if (failRef.current >= 3) setError('시세 갱신에 실패하고 있습니다. 네트워크 상태를 확인해주세요.');
      } finally {
        if (alive && !isPoll) setLoading(false);
      }
    };
    fetchPrices(false);
    let timer: ReturnType<typeof setInterval> | undefined;
    if (assetType !== 'CRYPTO') timer = setInterval(() => fetchPrices(true), 10_000);
    return () => { alive = false; if (timer) clearInterval(timer); };
     
  }, [assetType]);

  // 탭별 선택 기억
  useEffect(() => { if (activeSym) selectionCacheRef.current[assetType] = activeSym; }, [activeSym, assetType]);

  // 환율(미국주식 원화 환산용) 주기 갱신
  useEffect(() => {
    const fetchRate = async () => { try { const { usdKrw } = await marketService.getExchangeRate(); setUsdKrw(usdKrw); } catch { /* fallback */ } };
    fetchRate();
    const t = setInterval(fetchRate, 30_000);
    return () => clearInterval(t);
  }, []);

  // 관심종목 로드
  useEffect(() => {
    if (import.meta.env.DEV && window.location.pathname.startsWith('/preview')) return; // 프리뷰(비로그인) 401 리다이렉트 방지
    userService.getProfile().then(p => { if (p?.favoriteAssets) setFavoriteAssets(p.favoriteAssets); }).catch(() => {});
  }, []);

  // 인덱스 스트립 (공개 API)
  useEffect(() => {
    apiClient.get<IndexData[]>('/api/market/indices').then(r => { if (r.data?.length) setIndices(r.data); }).catch(() => {});
  }, []);

  // 검색 (디바운스, 주식/미국/ETF)
  useEffect(() => {
    if (!canSearch || query.trim().length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const fn = assetType === 'US_STOCK' ? marketService.searchUsStocks : assetType === 'ETF' ? marketService.searchEtfs : marketService.searchStocks;
        const r = await fn(query.trim());
        setSearchResults(r.slice(0, 12));
      } catch { setSearchResults([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [query, assetType, canSearch]);

  // 실시간 병합(크립토)
  const mergedList = useMemo(() => {
    if (assetType !== 'CRYPTO' || realtimePrices.size === 0) return assetList;
    return assetList.map(a => realtimePrices.get(a.symbol) ?? a);
  }, [assetList, realtimePrices, assetType]);

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

  // 표시 목록: 필터 + 정렬 + 로컬 검색(크립토)
  const displayList = useMemo(() => {
    let list = mergedList;
    if (listFilter === 'fav') list = list.filter(isFav);
    else if (listFilter === 'gain') list = list.filter(a => a.changeRate > 0);
    else if (listFilter === 'loss') list = list.filter(a => a.changeRate < 0);
    if (!canSearch && query.trim()) { const q = query.trim().toLowerCase(); list = list.filter(a => a.name.toLowerCase().includes(q) || a.symbol.toLowerCase().includes(q)); }
    const arr = [...list];
    // USD 종목(미국주식/ETF)은 원화 환산가로 비교해 통화가 섞여도 가격순 정렬이 일관되게
    const krwPrice = (a: MarketPrice) => (a.currency === 'USD' ? a.price * (usdKrw || 1) : a.price);
    if (sortBy === 'volume') arr.sort((a, b) => b.volume - a.volume);
    else if (sortBy === 'mcap') arr.sort((a, b) => krwPrice(b) - krwPrice(a));
    else if (sortBy === 'gain') arr.sort((a, b) => b.changeRate - a.changeRate);
    else if (sortBy === 'loss') arr.sort((a, b) => a.changeRate - b.changeRate);
    return arr;
  }, [mergedList, listFilter, sortBy, query, canSearch, isFav, usdKrw]);

  const selected = useMemo(() => mergedList.find(a => a.symbol === activeSym) || mergedList[0], [mergedList, activeSym]);

  // 선택 크립토 종목의 실시간 현재가 (차트 실시간 배지용). 캔들 로딩·표시는 TradingChart가 자체 처리.
  const rtPrice = useMemo(() => (assetType === 'CRYPTO' && selected ? realtimePrices.get(selected.symbol)?.price ?? null : null), [assetType, selected, realtimePrices]);

  const onSearchPick = useCallback(async (r: { code: string; name: string; market: string }) => {
    try {
      const fn = assetType === 'US_STOCK' ? marketService.getUsStockPrice : assetType === 'ETF' ? marketService.getEtfPrice : marketService.getStockPrice;
      const price = await fn(r.code);
      extraRef.current = [price, ...extraRef.current.filter(a => a.symbol !== price.symbol)];
      setAssetList(prev => [price, ...prev.filter(a => a.symbol !== price.symbol)]);
      setActiveSym(price.symbol);
      recordRecent(price);
      setQuery(''); setSearchResults([]);
    } catch { setError('종목 시세 조회에 실패했습니다.'); }
  }, [assetType, recordRecent]);

  return (
    <HelmShell active="markets" virt={isVirt} userName={userName} session={assetType === 'CRYPTO' ? '실시간 시세 · WebSocket' : '시세 10초 갱신'}>
      <div className="flex flex-col gap-6">
        {/* 헤더 */}
        <div>
          <div className="mb-3 flex items-center gap-2.5">{(() => { const live = assetType === 'CRYPTO'; const dot = !live ? 'var(--ci-sonar)' : wsConnected ? UP : '#f5d061'; const label = !live ? '자동 갱신 · 10초' : wsConnected ? 'LIVE · 실시간 연결됨' : '실시간 연결 중…'; return <><span className="h-1.5 w-1.5 rounded-full animate-pulse-dot" style={{ background: dot, boxShadow: `0 0 8px ${dot}` }} /><span className="text-[12.5px] font-semibold tracking-[.18em]" style={{ color: live && !wsConnected ? '#f5d061' : 'var(--ci-sonar)' }}>{label}</span></>; })()}</div>
          <h1 className="text-[39px] font-bold tracking-tight">시장 현황</h1>
          <p className="mt-2 text-[15.5px]" style={{ color: INK1 }}>주식 · 미국주식 · ETF · 가상화폐 시세를 한 곳에서 살펴보세요.</p>
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
              <button key={c.key} onClick={() => { setKlass(c.key); setListFilter('all'); setQuery(''); }} className="inline-flex items-center gap-2 rounded-[10px] px-[18px] py-2.5 text-[15px] font-semibold" style={{ border: on ? '1px solid rgba(91,157,255,.35)' : `1px solid ${LINE}`, background: on ? 'rgba(91,157,255,.12)' : 'var(--ci-card)', color: 'var(--ci-ink0)' }}>
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
          <StockList assets={displayList} activeSym={activeSym} onPick={sym => { setActiveSym(sym); const a = displayList.find(x => x.symbol === sym); if (a) recordRecent(a); }} isFav={isFav} onToggleFav={toggleFav}
            filter={listFilter} setFilter={setListFilter} query={query} setQuery={setQuery} searchResults={searchResults} onSearchPick={onSearchPick} loading={loading} canSearch={canSearch} usdKrw={usdKrw} />
          {selected ? <StockDetail stock={selected} isFav={isFav(selected)} onToggleFav={() => toggleFav(selected)} usdKrw={usdKrw} isCrypto={assetType === 'CRYPTO'} live={rtPrice != null && wsConnected} />
            : <div style={{ ...mkCard, padding: '60px', textAlign: 'center', color: INK3 }} className="text-[15px]">{loading ? '불러오는 중…' : '종목을 선택하세요'}</div>}
        </div>
        {/* 푸터 */}
        <footer className="flex flex-wrap items-center justify-between gap-3.5 pt-6" style={{ borderTop: `1px solid ${LINE}` }}>
          <span className="font-mono text-[13px]" style={{ color: INK3 }}>© 2026 WhaleArc · 모든 항해는 사용자의 책임 아래 진행됩니다.</span>
          <div className="flex gap-[18px] text-[13.5px]" style={{ color: INK2 }}><a>도움말</a><a>상태</a><a>API</a><a>의견 보내기</a></div>
        </footer>
      </div>
    </HelmShell>
  );
};

export default ConsoleMarketsPage;
