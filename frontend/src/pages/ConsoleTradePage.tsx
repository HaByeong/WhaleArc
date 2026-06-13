import type { ReactNode } from 'react';
import { useEffect, useMemo, useState, useRef, useCallback, Fragment } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRoutePrefix } from '../hooks/useRoutePrefix';
import HelmShell from '../components/HelmShell';
import { marketService, type MarketPrice, type AssetType } from '../services/marketService';
import { tradeService, type Portfolio, type Trade, type Holding, type Order } from '../services/tradeService';
import { useRealtimePrice } from '../hooks/useRealtimePrice';
import TradingChart from '../components/TradingChart';
import { Term } from '../components/GlossaryTerm';
import EmotionMirrorModal from '../components/EmotionMirrorModal';
import { mirrorService, type UserChoice } from '../services/mirrorService';

const PANIC_THRESHOLD = -5;   // 당일 등락률 ≤ −5%면 급락 공포 매도 인터셉트(마음 거울)
const FOMO_THRESHOLD = 15;    // 미보유 자산 당일 +15%↑ 매수면 급등 탐욕(FOMO) 인터셉트

/* ────────────────────────────────────────────────────────────
   ConsoleTradePage — 거래(trade) 실데이터 배선
   시장데이터(공개): marketService.getPrices/getCandlesticks/search + 크립토 실시간.
   인증데이터: tradeService.getPortfolio/getTrades + createOrder(주문).
   ※ 페이퍼(VIRT) 트레이딩. 호가는 백엔드 미존재 → 현재가 기반 시뮬레이션.
   ──────────────────────────────────────────────────────────── */

const UP = '#ef4d4d', DOWN = '#4d8aff', GLOW = 'var(--ci-sonar)', ACCENT = 'var(--ci-sonar)';
const INK1 = 'var(--ci-ink1)', INK2 = 'var(--ci-ink2)', INK3 = 'var(--ci-ink3)';
const LINE = 'var(--ci-line)';
const COMMISSION_RATE = 0.001;
const mkCard: React.CSSProperties = { borderRadius: 16, background: 'var(--ci-panel)', border: `1px solid ${LINE}`, boxShadow: 'var(--ci-panel-shadow)', position: 'relative', overflow: 'hidden' };

const ASSET_CLASSES: { key: string; type: AssetType; label: string }[] = [
  { key: 'stock', type: 'STOCK', label: '주식' },
  { key: 'us', type: 'US_STOCK', label: '미국주식' },
  { key: 'etf', type: 'ETF', label: 'ETF' },
  { key: 'crypto', type: 'CRYPTO', label: '가상화폐' },
];
const fmtKRW = (n: number) => '₩' + Math.round(n).toLocaleString('ko-KR');
const curOf = (a?: MarketPrice | null) => (a?.currency === 'USD' ? '$' : '₩');
// 미국주식/ETF(USD)는 환율로 원화 환산 표시
const fmtPrice = (a: MarketPrice, usdKrw = 0) => {
  if (a.currency === 'USD' && usdKrw > 0) return '₩' + Math.round(a.price * usdKrw).toLocaleString('ko-KR');
  return curOf(a) + a.price.toLocaleString('ko-KR', { maximumFractionDigits: a.currency === 'USD' ? 2 : 0 });
};
const fmtVol = (n: number) => (n >= 1e8 ? (n / 1e8).toFixed(1) + '억' : n >= 1e4 ? (n / 1e4).toFixed(1) + '만' : n.toLocaleString('ko-KR'));
const stripZeros = (s: string) => s.replace(/\.?0+$/, '') || '0';
const fmtQty = (n: number, stockLike: boolean) => (stockLike ? `${Math.floor(n).toLocaleString('ko-KR')}주` : `${stripZeros(n.toFixed(8))}개`);
const isUsdAsset = (at?: string) => at === 'US_STOCK' || at === 'ETF';
// 크립토 목록 상단 고정용 인기 코인
const POPULAR_COINS = new Set(['BTC', 'ETH', 'XRP', 'SOL', 'DOGE', 'USDT']);
// 단가(네이티브 통화: 미국주식/ETF는 USD, 그 외 KRW)
const fmtNative = (price: number, at?: string) => (isUsdAsset(at) ? '$' + price.toLocaleString('ko-KR', { maximumFractionDigits: 2 }) : fmtKRW(price));
// 금액 원화 환산(미국주식/ETF는 USD→KRW)
const fmtAmtKRW = (amount: number, at: string | undefined, usdKrw: number) => fmtKRW(isUsdAsset(at) && usdKrw > 0 ? amount * usdKrw : amount);

// 차트 지표 범례 색 = TradingChart(utils/indicators)와 동일 (MA5·20·60)
const MA_DEFS: [number, string][] = [[5, '#f59e0b'], [20, '#3b82f6'], [60, '#a855f7']];
type Indicators = { ma: boolean; bb: boolean };
// 지표 토글(Indicators) → TradingChart activeIndicators 키 배열
const indToKeys = (ind: Indicators): string[] => {
  const out: string[] = [];
  if (ind.ma) out.push('MA5', 'MA20', 'MA60');
  if (ind.bb) out.push('BOLLINGER');
  return out;
};


/* 좌측 종목 목록 (자산클래스 탭 + 검색) */
const StockList = ({ assets, activeSym, onPick, klass, setKlass, query, setQuery, canSearch, searchResults, onSearchPick, usdKrw, loading }: {
  assets: MarketPrice[]; activeSym: string; onPick: (s: string) => void; klass: string; setKlass: (k: string) => void;
  query: string; setQuery: (q: string) => void; canSearch: boolean; searchResults: { code: string; name: string; market: string }[];
  onSearchPick: (r: { code: string; name: string; market: string }) => void; usdKrw: number; loading: boolean;
}) => (
  <aside style={{ ...mkCard, padding: 0, display: 'flex', flexDirection: 'column', minHeight: 820 }}>
    <div className="flex gap-1 p-3 pb-0">
      {ASSET_CLASSES.map(({ key, label }) => (
        <button key={key} onClick={() => setKlass(key)} className="flex-1 whitespace-nowrap rounded-lg px-1.5 py-2 text-[12.5px] font-semibold" style={{ border: klass === key ? '1px solid rgba(91,157,255,.32)' : `1px solid ${LINE}`, background: klass === key ? 'rgba(91,157,255,.12)' : 'transparent', color: klass === key ? 'var(--ci-ink0)' : INK1 }}>{label}</button>
      ))}
    </div>
    <div className="relative px-3.5 pb-3 pt-3" style={{ borderBottom: `1px solid ${LINE}` }}>
      <div className="relative">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: INK3 }}><circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.4" /><path d="M9 9l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
        <input value={query} onChange={e => setQuery(e.target.value)} aria-label="종목 검색" placeholder={canSearch ? '종목 검색 (예: 삼성, AAPL)' : '코인 검색…'} className="w-full rounded-lg py-2.5 pl-[34px] pr-3 text-[13px] outline-none" style={{ border: `1px solid ${LINE}`, background: 'var(--ci-card)', color: 'var(--ci-ink0)' }} />
      </div>
      {canSearch && searchResults.length > 0 && (
        <div className="no-scrollbar absolute left-3.5 right-3.5 top-[60px] z-10 max-h-[260px] overflow-y-auto rounded-lg p-1" style={{ border: `1px solid ${LINE}`, background: 'var(--ci-raised)', boxShadow: '0 12px 30px -10px rgba(0,0,0,.5)' }}>
          {searchResults.map(r => <button key={r.code} onClick={() => onSearchPick(r)} className="flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-[12.5px] hover:bg-white/5"><span className="font-semibold">{r.name}</span><span className="font-mono" style={{ color: INK3 }}>{r.code}</span></button>)}
        </div>
      )}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[11.5px] tracking-[.06em]" style={{ color: INK2 }}>{(ASSET_CLASSES.find(c => c.key === klass) || ASSET_CLASSES[0]).label} <span className="font-mono font-semibold" style={{ color: 'var(--ci-ink0)' }}>{assets.length}개</span></span>
      </div>
    </div>
    <ul className="no-scrollbar m-0 flex-1 list-none overflow-y-auto p-0" style={{ maxHeight: 720 }}>
      {loading && assets.length === 0 && <li className="px-3.5 py-6 text-center text-[12.5px]" style={{ color: INK3 }}>불러오는 중…</li>}
      {!loading && assets.length === 0 && <li className="px-3.5 py-6 text-center text-[12.5px]" style={{ color: INK3 }}>표시할 종목이 없습니다</li>}
      {assets.map((s, i) => {
        const isActive = s.symbol === activeSym, up = s.changeRate >= 0;
        return (
          <li key={s.symbol}>
            <button onClick={() => onPick(s.symbol)} className="grid w-full grid-cols-[1fr_auto] items-center gap-2.5 px-3.5 py-3 text-left" style={{ background: isActive ? 'rgba(91,157,255,.10)' : 'transparent', borderLeft: isActive ? `2px solid ${GLOW}` : '2px solid transparent', borderBottom: i === assets.length - 1 ? 'none' : `1px solid ${LINE}`, color: 'var(--ci-ink0)' }}>
              <div className="flex min-w-0 flex-col gap-0.5"><span className="truncate text-[13.5px]" style={{ fontWeight: isActive ? 700 : 600 }}>{s.name}</span><span className="font-mono text-[11px]" style={{ color: INK3 }}>{s.symbol}</span></div>
              <div className="flex flex-col gap-0.5 text-right"><span className="font-mono text-[13px] font-semibold">{fmtPrice(s, usdKrw)}</span><span className="font-mono text-[11.5px] font-semibold" style={{ color: up ? UP : DOWN }}>{up ? '+' : ''}{s.changeRate.toFixed(2)}%</span></div>
            </button>
          </li>
        );
      })}
    </ul>
  </aside>
);

const InlineStat = ({ label, value }: { label: string; value: string }) => (
  <div className="flex min-w-0 flex-col gap-1"><span className="text-[10.5px] font-semibold tracking-[.12em]" style={{ color: INK2 }}>{label}</span><span className="truncate font-mono text-[15px] font-semibold">{value}</span></div>
);
const StockHeaderCard = ({ sel, usdKrw }: { sel: MarketPrice; usdKrw: number }) => {
  const up = sel.changeRate >= 0; const prevClose = sel.price - sel.change;
  const fx = sel.currency === 'USD' && usdKrw > 0;
  return (
    <div style={{ ...mkCard, padding: '22px 26px' }}>
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2.5">
            <span className="rounded-[5px] px-2 py-[3px] text-[10.5px] font-bold tracking-[.08em]" style={{ background: 'rgba(91,157,255,.14)', color: '#cfe1ff', border: '1px solid rgba(91,157,255,.24)' }}>{sel.market || '—'}</span>
            <span className="font-mono text-[12px]" style={{ color: INK3 }}>{sel.symbol}</span>
          </div>
          <h2 className="text-[26px] font-bold tracking-tight">{sel.name}</h2>
        </div>
        <div className="flex flex-col gap-1.5 text-right">
          <span className="font-mono text-[32px] font-semibold tracking-tight">{fmtPrice(sel, usdKrw)}</span>
          <span className="font-mono text-[14px] font-semibold" style={{ color: up ? UP : DOWN }}>{up ? '+' : ''}{(fx ? sel.change * usdKrw : sel.change).toLocaleString('ko-KR', { maximumFractionDigits: 0 })} ({up ? '+' : ''}{sel.changeRate.toFixed(2)}%)</span>
        </div>
      </div>
      <div className="mt-[18px] grid gap-[18px] pt-[18px]" style={{ borderTop: `1px solid ${LINE}`, gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
        <InlineStat label="거래량" value={fmtVol(sel.volume)} /><InlineStat label="전일 종가" value={fmtPrice({ ...sel, price: prevClose }, usdKrw)} />
        <InlineStat label="통화" value={sel.currency === 'USD' ? 'USD' : 'KRW'} /><InlineStat label="등락률" value={`${sel.changeRate >= 0 ? '+' : ''}${sel.changeRate.toFixed(2)}%`} />
      </div>
    </div>
  );
};

const NumberField = ({ value, onChange, step = 1, suffix, disabled }: { value: number; onChange: (n: number) => void; step?: number; suffix?: string; disabled?: boolean }) => (
  <div className="mt-1.5 grid overflow-hidden rounded-lg" style={{ gridTemplateColumns: '36px 1fr 36px', border: `1px solid ${LINE}`, background: 'var(--ci-card)' }}>
    <button onClick={() => !disabled && onChange(Math.max(0, value - step))} disabled={disabled} className="text-[16px] font-semibold" style={{ background: 'var(--ci-card)', borderInline: `1px solid ${LINE}`, color: INK1 }}>−</button>
    <div className="relative flex items-center">
      <input type="number" value={value} onChange={e => onChange(Number(e.target.value) || 0)} disabled={disabled} className="w-full bg-transparent py-2.5 pl-3 pr-9 text-right text-[15px] font-semibold outline-none" style={{ color: disabled ? INK3 : 'var(--ci-ink0)', fontFamily: 'JetBrains Mono, monospace' }} />
      {suffix && <span className="pointer-events-none absolute right-3 text-[12px]" style={{ color: INK3 }}>{suffix}</span>}
    </div>
    <button onClick={() => !disabled && onChange(value + step)} disabled={disabled} className="text-[16px] font-semibold" style={{ background: 'var(--ci-card)', borderInline: `1px solid ${LINE}`, color: INK1 }}>+</button>
  </div>
);
const FieldLabel = ({ children }: { children: ReactNode }) => <span className="text-[11.5px] font-semibold tracking-[.06em]" style={{ color: INK2 }}>{children}</span>;

const OrderTicket = ({ sel, side, setSide, portfolio, usdKrw, rtPrice, notify, onPlaced, isVirt }: {
  sel: MarketPrice; side: string; setSide: (s: string) => void; portfolio: Portfolio | null; usdKrw: number;
  rtPrice: number | null; notify: (m: string, t?: 'success' | 'error') => void; onPlaced: () => void; isVirt: boolean;
}) => {
  const [orderMethod, setOrderMethod] = useState<'LIMIT' | 'MARKET'>('MARKET'); // 시장가 기본(옛 동작 복원)
  const [price, setPrice] = useState(sel.price);
  const [qty, setQty] = useState(0);
  const [memo, setMemo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mirror, setMirror] = useState(false);          // 마음 거울 인터셉트 모달
  const [mirrorKind, setMirrorKind] = useState<'PANIC' | 'FOMO'>('PANIC');
  const [mirrorBusy, setMirrorBusy] = useState(false);
  // 종목 변경 시에만 초기화 (가격 틱마다 리셋 금지 — 입력 중 수량/지정가 보존)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setPrice(sel.price); setQty(0); setMemo(''); }, [sel.symbol]);
  // 매수/매도 전환 시 수량 초기화 (단축키 B/S 전환도 click-toggle와 동일하게 동작)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setQty(0); }, [side]);
  const isBuy = side === 'buy';
  const at = sel.assetType;
  const stockLike = at === 'STOCK' || at === 'US_STOCK' || at === 'ETF';
  const needsFx = sel.currency === 'USD';
  const fx = needsFx && usdKrw > 0 ? usdKrw : (needsFx ? 1400 : 1);
  const cur = rtPrice ?? sel.price;
  const calcPrice = orderMethod === 'MARKET' ? cur : (price || 0);
  const cash = portfolio?.cashBalance ?? 0;
  const heldQty = portfolio?.holdings.find(h => h.stockCode === sel.symbol)?.quantity ?? 0;
  const totalKRW = calcPrice * qty * (isBuy ? 1 + COMMISSION_RATE : 1 - COMMISSION_RATE) * fx;
  const tick = needsFx ? 0.5 : sel.price >= 1000000 ? 1000 : sel.price >= 100000 ? 100 : 50;

  const setPct = (pct: number) => {
    if (isBuy) {
      const eff = calcPrice * (1 + COMMISSION_RATE) * fx;
      if (eff <= 0) return;
      const max = (cash * pct) / eff;
      // 크립토는 8자리 '내림' — toFixed(8)의 반올림이 한도를 미세 초과해 '최대' 매수가 잔고부족으로 거부되던 버그 방지
      setQty(stockLike ? Math.floor(max) : Number(stripZeros((Math.floor(max * 1e8) / 1e8).toFixed(8))));
    } else {
      const q = heldQty * pct;
      setQty(stockLike ? Math.floor(q) : Number(stripZeros((Math.floor(q * 1e8) / 1e8).toFixed(8))));
    }
  };

  const submit = async () => {
    if (!qty || qty <= 0) { notify('수량은 0보다 커야 합니다.', 'error'); return; }
    if (stockLike && qty !== Math.floor(qty)) { notify('주식은 1주 단위로만 거래할 수 있습니다.', 'error'); return; }
    if (!stockLike) { const dec = String(qty).split('.')[1]; if (dec && dec.length > 8) { notify('수량의 소수점은 최대 8자리까지 입력할 수 있습니다.', 'error'); return; } }
    if (orderMethod === 'LIMIT' && (!price || price <= 0)) { notify('지정가는 0보다 큰 값을 입력해주세요.', 'error'); return; }
    if (isBuy && portfolio && totalKRW > cash) { notify('잔고가 부족합니다.', 'error'); return; }
    if (!isBuy && qty > heldQty) { notify('보유 수량이 부족합니다.', 'error'); return; }
    // 마음 거울 인터셉트 — 막지 않고, 묻고 봉인한다
    if (!isBuy && heldQty > 0 && sel.changeRate <= PANIC_THRESHOLD) { setMirrorKind('PANIC'); setMirror(true); return; }   // 급락 공포 매도
    if (isBuy && heldQty <= 0 && sel.changeRate >= FOMO_THRESHOLD) { setMirrorKind('FOMO'); setMirror(true); return; }     // 급등 탐욕(FOMO) 매수
    placeOrder();
  };

  const placeOrder = async () => {
    setSubmitting(true);
    // 제출 1회당 멱등성 키 1개 — 네트워크 재전송/중복 제출 시 백엔드가 이중 체결을 막는다
    const clientOrderId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      await tradeService.createOrder({
        stockCode: sel.symbol, stockName: sel.name, orderType: isBuy ? 'BUY' : 'SELL', orderMethod,
        quantity: qty, price: orderMethod === 'LIMIT' ? price : undefined, assetType: at, memo: memo.trim() || undefined,
        clientOrderId,
      });
      setQty(0); setMemo('');
      const action = isBuy ? '매수' : '매도';
      notify(orderMethod === 'MARKET' ? `시장가 ${action}가 체결되었습니다` : `지정가 ${action} 주문이 접수되었습니다`, 'success');
      onPlaced();
    } catch (e: any) {
      notify(e?.response?.data?.message || '주문 실패. 다시 시도해주세요.', 'error');
    } finally { setSubmitting(false); }
  };

  // 마음 거울 — 봉인 후, 충동(판다/산다)이면 주문 진행 / 항로(지킨다/관망)면 주문 중단
  const onMirrorChoice = async (choice: UserChoice, note: string, intensity: number) => {
    setMirrorBusy(true);
    try {
      await mirrorService.capture({
        assetSymbol: sel.symbol, assetName: sel.name, assetType: at,
        triggerType: mirrorKind === 'FOMO' ? 'FOMO_SPIKE' : 'PANIC_DROP',
        userChoice: choice, emotionNote: note || undefined, emotionIntensity: intensity,
        priceAtEvent: cur, changeRate: sel.changeRate, amountKrw: Math.round(calcPrice * qty * fx),
      });
    } catch { /* 봉인 실패해도 주문 흐름은 막지 않는다 */ }
    setMirror(false); setMirrorBusy(false);
    if (choice === 'FOLLOW_IMPULSE') {
      placeOrder();
    } else {
      setQty(0);
      notify(mirrorKind === 'FOMO' ? '잘 참았어요 — 유리병을 띄웠어요. 며칠 뒤 파도가 답을 실어와요 🌊' : '항로를 지켰어요 — 유리병을 띄웠어요. 며칠 뒤 파도가 답을 실어와요 🌊', 'success');
    }
  };

  return (
    <div style={{ ...mkCard, padding: '20px 22px' }}>
      <div className="grid grid-cols-2 rounded-[10px] p-[3px]" style={{ background: 'var(--ci-card)', border: `1px solid ${LINE}` }}>
        {[['buy', '매수', UP], ['sell', '매도', DOWN]].map(([k, l, c]) => (
          <button key={k} onClick={() => { setSide(k); setQty(0); }} className="rounded-lg py-2.5 text-[14px] font-bold" style={{ background: side === k ? c : 'transparent', color: side === k ? '#0a1230' : INK1 }}>{l}</button>
        ))}
      </div>
      <div className="mt-[18px]"><FieldLabel>주문 종류</FieldLabel>
        <div className="mt-1.5 flex gap-1.5">{(['LIMIT', 'MARKET'] as const).map(k => (
          <button key={k} onClick={() => setOrderMethod(k)} className="flex-1 rounded-lg py-2.5 text-[12.5px] font-semibold" style={{ border: orderMethod === k ? '1px solid rgba(91,157,255,.32)' : `1px solid ${LINE}`, background: orderMethod === k ? 'rgba(91,157,255,.12)' : 'transparent', color: orderMethod === k ? 'var(--ci-ink0)' : INK1 }}>{k === 'LIMIT' ? '지정가' : '시장가'}</button>
        ))}</div>
        <div className="mt-2 rounded-[8px] px-3 py-2 text-[11.5px] leading-snug" style={{ background: 'var(--ci-card)', border: `1px solid ${LINE}`, color: INK2 }}>
          {(() => {
            const word = orderMethod === 'MARKET' ? '시장가' : '지정가';
            // VIRT(모의)에서만 용어집 툴팁 연결 — 초보 학습 동선
            const label = isVirt
              ? <Term k={word}>{word}</Term>
              : <span style={{ color: GLOW, fontWeight: 600 }}>{word}</span>;
            return orderMethod === 'MARKET'
              ? <>{label} — 지금 바로 현재 시세에 즉시 체결됩니다. 빠른 매수/매도에 적합해요.</>
              : <>{label} — 아래에서 원하는 가격을 입력합니다. 해당 가격에 도달해야 체결돼요. 가격이 안 오면 미체결 상태로 대기합니다.</>;
          })()}
        </div>
      </div>
      <div className="mt-[18px]"><div className="flex items-baseline justify-between"><FieldLabel>주문 가격</FieldLabel>{orderMethod === 'MARKET' && <span className="font-mono text-[11px]" style={{ color: INK3 }}>현재가 체결</span>}</div>
        <NumberField value={orderMethod === 'MARKET' ? Math.round(cur * 100) / 100 : price} onChange={setPrice} step={tick} disabled={orderMethod === 'MARKET'} suffix={needsFx ? '$' : '원'} /></div>
      <div className="mt-3.5"><FieldLabel>수량</FieldLabel>
        <NumberField value={qty} onChange={setQty} step={1} suffix={stockLike ? '주' : '개'} />
        <div className="mt-2 grid grid-cols-4 gap-1.5">{[['10%', 0.1], ['25%', 0.25], ['50%', 0.5], ['최대', 1]].map(([l, p]) => (
          <button key={l as string} onClick={() => setPct(p as number)} className="rounded-md py-1.5 text-[11.5px] font-semibold" style={{ border: `1px solid ${LINE}`, background: 'var(--ci-card)', color: INK1 }}>{l}</button>
        ))}</div>
      </div>
      <div className="mt-[18px] rounded-[10px] px-4 py-3.5" style={{ background: 'var(--ci-card)', border: `1px solid ${LINE}` }}>
        <div className="flex items-center justify-between"><span className="text-[12.5px]" style={{ color: INK2 }}>예상 금액</span><span className="font-mono text-[18px] font-semibold">{fmtKRW(totalKRW)}</span></div>
        <div className="mt-2.5 flex items-center justify-between text-[12px]" style={{ color: INK2 }}><span>{isBuy ? '주문 가능' : '보유 수량'}</span><span className="font-mono">{isBuy ? fmtKRW(cash) : fmtQty(heldQty, stockLike)}</span></div>
        <div className="mt-1 text-right text-[10.5px]" style={{ color: INK3 }}>수수료 0.1% 포함</div>
      </div>
      <details className="mt-3 rounded-lg px-3 py-2" style={{ border: `1px solid ${LINE}`, background: 'var(--ci-card)' }}>
        <summary className="cursor-pointer list-none text-[12px] font-semibold" style={{ color: INK2 }}>메모 추가 (선택)</summary>
        <textarea value={memo} onChange={e => setMemo(e.target.value.slice(0, 500))} rows={2} placeholder="거래 일지 메모 (체결 내역에 표시)" className="mt-2 w-full resize-none rounded-md px-2.5 py-2 text-[12.5px] outline-none" style={{ border: `1px solid ${LINE}`, background: 'var(--ci-raised)', color: 'var(--ci-ink0)' }} />
        <div className="text-right font-mono text-[10.5px]" style={{ color: INK3 }}>{memo.length}/500</div>
      </details>
      <div className="mt-3.5 flex items-center gap-2.5 rounded-lg px-3 py-2.5" style={{ background: 'rgba(255,205,120,.08)', border: '1px solid rgba(255,205,120,.18)' }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: '#ffcd78', flexShrink: 0 }}><path d="M7 2L13 12H1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /><path d="M7 6v3 M7 10.5v.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
        <span className="text-[11.5px] leading-snug" style={{ color: '#ffcd78' }}>실계좌가 연결되지 않았습니다. <strong>VIRT 모의 거래</strong>로 진행됩니다.</span>
      </div>
      <button onClick={submit} disabled={submitting || !qty || qty <= 0} className="mt-3.5 w-full rounded-[10px] py-3.5 text-[15px] font-bold disabled:opacity-50" style={{ background: isBuy ? `linear-gradient(180deg, ${UP}, #c73a3a)` : `linear-gradient(180deg, ${DOWN}, #2f6fe0)`, color: '#0a1230', boxShadow: isBuy ? '0 10px 28px -12px rgba(239,77,77,.5)' : '0 10px 28px -12px rgba(77,138,255,.5)' }}>
        <span className="mr-2 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-[.06em]" style={{ background: 'rgba(10,18,48,.18)', color: '#0a1230' }}>VIRT</span>{submitting ? '주문 처리 중…' : `${fmtQty(qty, stockLike)} ${isBuy ? '매수' : '매도'} 주문`}
      </button>
      {mirror && (
        <EmotionMirrorModal kind={mirrorKind} name={sel.name} changeRate={sel.changeRate} busy={mirrorBusy}
          onClose={() => setMirror(false)} onChoice={onMirrorChoice} />
      )}
    </div>
  );
};

// 실시간 호가 잔량(Level-2) 데이터가 아직 없으므로 잔량을 지어내지 않는다.
// 현재가 기준 가격 단계(±tick)만 참고용으로 표시 — 가짜 잔량/총잔량/깊이바 제거.
const Orderbook = ({ sel }: { sel: MarketPrice }) => {
  const p = sel.price;
  const usd = sel.currency === 'USD';
  const tick = usd ? (p >= 100 ? 0.5 : 0.05) : (p >= 1000000 ? 1000 : p >= 100000 ? 100 : p >= 1000 ? 10 : 1);
  const fmt = (v: number) => usd
    ? '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '₩' + Math.round(v).toLocaleString();
  const tickLabel = usd ? '$' + tick.toFixed(2) : '₩' + tick.toLocaleString();
  const asks: number[] = [], bids: number[] = [];
  for (let i = 0; i < 5; i++) { asks.unshift(p + tick * (i + 1)); bids.push(p - tick * (i + 1)); }
  const Row = ({ s, price }: { s: 'ask' | 'bid'; price: number }) => (
    <li className="grid grid-cols-1 items-center px-[18px] py-1.5 text-[12px]">
      <span className="text-right font-mono font-semibold" style={{ color: s === 'ask' ? DOWN : UP }}>{fmt(price)}</span>
    </li>
  );
  return (
    <div style={{ ...mkCard, padding: '14px 0 0', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div className="flex items-center justify-between px-[18px] pb-3" style={{ borderBottom: `1px solid ${LINE}` }}><h3 className="text-[13.5px] font-bold">호가 단계</h3><span className="text-[10.5px] tracking-[.08em]" style={{ color: INK3 }}>현재가 ±{tickLabel} · 참고용</span></div>
      <ul className="m-0 list-none p-0">{asks.map((a, i) => <Row key={'a' + i} s="ask" price={a} />)}</ul>
      <div className="flex items-center justify-between px-[18px] py-2.5" style={{ background: 'rgba(91,157,255,.06)', borderTop: '1px solid rgba(91,157,255,.2)', borderBottom: '1px solid rgba(91,157,255,.2)' }}><span className="text-[11px] font-semibold tracking-[.1em]" style={{ color: GLOW }}>현재가</span><span className="font-mono text-[15px] font-bold">{fmt(p)}</span></div>
      <ul className="m-0 list-none p-0">{bids.map((b, i) => <Row key={'b' + i} s="bid" price={b} />)}</ul>
      <div className="px-[18px] py-3 text-[11px] leading-relaxed" style={{ borderTop: `1px solid ${LINE}`, color: INK3 }}>실시간 호가 잔량은 준비 중이에요. 위 값은 현재가 기준 가격 단계입니다.</div>
    </div>
  );
};

const toggleChip = (on: boolean): React.CSSProperties => ({ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1px solid ${on ? 'rgba(91,157,255,.4)' : LINE}`, background: on ? 'rgba(91,157,255,.14)' : 'var(--ci-card)', color: on ? 'var(--ci-sonar)' : INK1 });

const ChartPanel = ({ symbol, price, changeRate, assetType, indicators, setIndicators }: { symbol: string; price: number; changeRate: number; assetType: AssetType; indicators: Indicators; setIndicators: (fn: (x: Indicators) => Indicators) => void }) => (
  <div className="px-5 py-[18px]">
    <div className="mb-3 flex flex-wrap items-center gap-2.5">
      <span className="text-[12.5px] font-semibold" style={{ color: INK2 }}>차트</span>
      <div className="flex gap-1.5">
        <button onClick={() => setIndicators(x => ({ ...x, ma: !x.ma }))} style={toggleChip(indicators.ma)}>이동평균</button>
        <button onClick={() => setIndicators(x => ({ ...x, bb: !x.bb }))} style={toggleChip(indicators.bb)}>볼린저</button>
      </div>
    </div>
    {indicators.ma && <div className="mb-2 flex flex-wrap gap-3 text-[10.5px]" style={{ color: INK2 }}>{MA_DEFS.map(([p, c]) => <span key={p} className="inline-flex items-center gap-1.5"><span style={{ width: 12, height: 2, background: c, display: 'inline-block' }} />MA{p}</span>)}</div>}
    <TradingChart symbol={symbol} price={price} changeRate={changeRate} assetType={assetType} activeIndicators={indToKeys(indicators)} isDark />
  </div>
);

/* 가격 알림(벨) — createPriceAlert/getPriceAlerts/deletePriceAlert (옛 TradePage 복원) */
const ALERT_CONDS: [string, string][] = [['ABOVE', '이상'], ['BELOW', '이하'], ['CHANGE_UP', '급등'], ['CHANGE_DOWN', '급락']];
const AMBER = '#f5d061';
const AlertsPanel = ({ sel, alerts, usdKrw, onChanged, notify }: { sel: MarketPrice; alerts: any[]; usdKrw: number; onChanged: () => void; notify: (m: string, t?: 'success' | 'error') => void }) => {
  const [cond, setCond] = useState('ABOVE');
  const [target, setTarget] = useState('');
  const [pct, setPct] = useState('');
  const isChange = cond === 'CHANGE_UP' || cond === 'CHANGE_DOWN';
  const valid = isChange ? parseFloat(pct) > 0 : parseFloat(target) > 0;
  const mine = alerts.filter(a => a.stockCode === sel.symbol);
  const create = async () => {
    if (!valid) return;
    try {
      await tradeService.createPriceAlert({
        stockCode: sel.symbol, stockName: sel.name, assetType: sel.assetType || 'CRYPTO', condition: cond,
        ...(isChange ? { changePercent: parseFloat(pct) } : { targetPrice: parseFloat(target) }),
      });
      notify('가격 알림이 설정되었습니다.'); setTarget(''); setPct(''); onChanged();
    } catch (e: any) { notify(e?.response?.data?.message || '알림 설정에 실패했습니다.', 'error'); }
  };
  const del = async (id: string) => { try { await tradeService.deletePriceAlert(id); notify('알림이 삭제되었습니다.'); onChanged(); } catch { notify('삭제에 실패했습니다.', 'error'); } };
  const segStyle = (on: boolean): React.CSSProperties => ({ padding: '8px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, border: `1px solid ${on ? 'rgba(245,208,97,.4)' : LINE}`, background: on ? 'rgba(245,208,97,.14)' : 'var(--ci-card)', color: on ? AMBER : INK1 });
  const fieldSx: React.CSSProperties = { border: `1px solid ${LINE}`, background: 'var(--ci-raised)', color: 'var(--ci-ink0)' };
  const labelOf = (a: any) => a.condition === 'CHANGE_UP' ? `${a.changePercent}% 이상 급등` : a.condition === 'CHANGE_DOWN' ? `${a.changePercent}% 이상 급락` : `${fmtNative(a.targetPrice, a.assetType)} ${a.condition === 'ABOVE' ? '이상' : '이하'}`;
  return (
    <div className="px-5 py-[18px]">
      <div className="mb-3.5 flex flex-wrap items-center gap-2 text-[12.5px]" style={{ color: INK2 }}><span className="text-[15px]">🔔</span>현재가 <span className="font-mono font-semibold" style={{ color: 'var(--ci-ink0)' }}>{fmtPrice(sel, usdKrw)}</span> 도달/변동 시 알림을 받습니다.</div>
      <div className="mb-3 flex flex-wrap gap-1.5">{ALERT_CONDS.map(([k, l]) => <button key={k} onClick={() => { setCond(k); setTarget(''); setPct(''); }} style={segStyle(cond === k)}>{l}</button>)}</div>
      <div className="flex gap-2">
        {isChange
          ? <input type="number" min={0} placeholder="변동률 (%)" value={pct} onChange={e => setPct(e.target.value)} className="flex-1 rounded-lg px-3 py-2.5 text-[13.5px] outline-none" style={fieldSx} />
          : <input type="number" min={0} placeholder={`목표 가격 (${sel.currency === 'USD' ? 'USD' : 'KRW'})`} value={target} onChange={e => setTarget(e.target.value)} className="flex-1 rounded-lg px-3 py-2.5 text-right font-mono text-[14px] outline-none" style={fieldSx} />}
        <button onClick={create} disabled={!valid} className="rounded-lg px-5 py-2.5 text-[13.5px] font-bold disabled:opacity-40" style={{ background: 'rgba(245,208,97,.18)', color: AMBER, border: '1px solid rgba(245,208,97,.3)' }}>알림 설정</button>
      </div>
      {mine.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-[11px] font-semibold tracking-[.1em]" style={{ color: INK3 }}>설정된 알림 <span className="font-mono" style={{ color: AMBER }}>{mine.length}</span></div>
          <div className="flex flex-col gap-1.5">
            {mine.map(a => (
              <div key={a.id} className="flex items-center justify-between rounded-lg px-3.5 py-2.5" style={{ border: `1px solid ${LINE}`, background: 'var(--ci-card)' }}>
                <span className="text-[12.5px]" style={{ color: INK1 }}>{labelOf(a)}</span>
                <button onClick={() => del(a.id)} className="text-[11.5px] font-semibold" style={{ color: UP }}>삭제</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const tdSx: React.CSSProperties = { padding: '14px 12px', fontSize: 13.5, borderBottom: `1px solid ${LINE}` };
const thSx: React.CSSProperties = { textAlign: 'left', padding: '10px 12px', fontSize: 11, color: INK3, letterSpacing: '.12em', fontWeight: 600, borderBottom: `1px solid ${LINE}`, textTransform: 'uppercase' };
const fmtTime = (iso: string) => { try { return new Date(iso).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return iso; } };
const FillsPanel = ({ trades, usdKrw }: { trades: Trade[]; usdKrw: number }) => (
  <div className="px-5 py-[18px]">
    {trades.length === 0 ? <div className="py-10 text-center text-[13px]" style={{ color: INK3 }}>체결 내역이 없습니다.</div> : (
      <table className="w-full border-collapse"><thead><tr>{['시간', '구분', '수량', '체결가', '체결액', '모드'].map(h => <th key={h} style={thSx}>{h}</th>)}</tr></thead>
        <tbody>{trades.map(t => { const buy = t.orderType === 'BUY', stockLike = t.assetType === 'STOCK' || isUsdAsset(t.assetType); return (<Fragment key={t.id}><tr>
          <td className="font-mono" style={t.memo ? { ...tdSx, borderBottom: 'none' } : tdSx}>{fmtTime(t.executedAt)}</td>
          <td style={t.memo ? { ...tdSx, borderBottom: 'none' } : tdSx}><span className="rounded-[5px] px-2 py-0.5 text-[11px] font-bold" style={{ color: buy ? UP : DOWN, background: buy ? 'rgba(239,77,77,.12)' : 'rgba(77,138,255,.12)' }}>{buy ? '매수' : '매도'}</span></td>
          <td className="font-mono" style={t.memo ? { ...tdSx, borderBottom: 'none' } : tdSx}>{fmtQty(t.quantity, stockLike)}</td><td className="font-mono" style={t.memo ? { ...tdSx, borderBottom: 'none' } : tdSx}>{fmtNative(t.price, t.assetType)}</td><td className="font-mono" style={t.memo ? { ...tdSx, borderBottom: 'none' } : tdSx}>{fmtAmtKRW(t.totalAmount, t.assetType, usdKrw)}</td>
          <td style={t.memo ? { ...tdSx, borderBottom: 'none' } : tdSx}><span className="rounded px-1.5 py-0.5 text-[10px] font-bold tracking-[.06em]" style={{ background: 'rgba(180,210,255,.18)', color: '#cfe1ff' }}>VIRT</span></td>
        </tr>{t.memo && <tr><td colSpan={6} style={{ padding: '0 12px 12px', borderBottom: `1px solid ${LINE}` }}><span className="text-[12px] italic" style={{ color: INK3 }}>📝 {t.memo}</span></td></tr>}</Fragment>); })}</tbody></table>
    )}
  </div>
);
// 전체 주문 내역 — 모든 상태(체결/부분체결/대기/취소) (옛 주문내역 탭 복원)
const OrderHistoryPanel = ({ orders, onCancel }: { orders: Order[]; onCancel: (id: string) => void }) => {
  const sorted = [...orders].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return (
    <div className="px-5 py-[18px]">
      {sorted.length === 0 ? <div className="py-10 text-center text-[13px]" style={{ color: INK3 }}>주문 내역이 없습니다.</div> : (
        <table className="w-full border-collapse"><thead><tr>{['시간', '구분', '종목', '수량', '가격', '방식', '상태'].map(h => <th key={h} style={thSx}>{h}</th>)}</tr></thead>
          <tbody>{sorted.map(o => { const buy = o.orderType === 'BUY', st = ORDER_STATUS[o.status] || ORDER_STATUS.PENDING, stockLike = o.assetType === 'STOCK' || isUsdAsset(o.assetType); return (
            <tr key={o.id}>
              <td className="font-mono" style={tdSx}>{fmtTime(o.createdAt)}</td>
              <td style={tdSx}><span className="rounded-[5px] px-2 py-0.5 text-[11px] font-bold" style={{ color: buy ? UP : DOWN, background: buy ? 'rgba(239,77,77,.12)' : 'rgba(77,138,255,.12)' }}>{buy ? '매수' : '매도'}</span></td>
              <td style={tdSx}><div className="flex flex-col gap-0.5"><span className="font-semibold">{o.stockName}</span><span className="font-mono text-[11px]" style={{ color: INK3 }}>{o.stockCode}</span></div></td>
              <td className="font-mono" style={tdSx}>{fmtQty(o.quantity, stockLike)}</td>
              <td className="font-mono" style={tdSx}>{o.filledPrice != null ? fmtNative(o.filledPrice, o.assetType) : o.orderMethod === 'MARKET' ? <span style={{ color: INK3 }}>체결가 미정</span> : fmtNative(o.price, o.assetType)}</td>
              <td style={tdSx}><span className="text-[12px]" style={{ color: INK2 }}>{o.orderMethod === 'MARKET' ? '시장가' : '지정가'}</span></td>
              <td style={tdSx}><div className="flex items-center gap-2"><span className="rounded px-1.5 py-0.5 text-[10.5px] font-bold" style={{ color: st.color, background: st.bg }}>{st.label}</span>{o.status === 'PENDING' && <button onClick={() => onCancel(o.id)} className="rounded-md px-2 py-0.5 text-[11px] font-semibold" style={{ border: `1px solid ${LINE}`, color: INK1 }}>취소</button>}</div></td>
            </tr>
          ); })}</tbody></table>
      )}
    </div>
  );
};
const HoldingsPanel = ({ holdings, usdKrw, onPick }: { holdings: Holding[]; usdKrw: number; onPick: (sym: string, at?: string) => void }) => (
  <div className="px-5 py-[18px]">
    {holdings.length === 0 ? <div className="py-10 text-center text-[13px]" style={{ color: INK3 }}>보유 종목이 없습니다.</div> : (
      <table className="w-full border-collapse"><thead><tr>{['종목', '수량', '평균가', '현재가', '평가액', '평가 손익', '수익률'].map(h => <th key={h} style={thSx}>{h}</th>)}</tr></thead>
        <tbody>{holdings.map(h => { const up = h.profitLoss >= 0, stockLike = h.assetType === 'STOCK' || isUsdAsset(h.assetType); return (
          <tr key={h.stockCode} onClick={() => onPick(h.stockCode, h.assetType)} className="cursor-pointer transition-colors hover:bg-white/5">
            <td style={tdSx}><div className="flex flex-col gap-0.5"><span className="font-semibold">{h.stockName}</span><span className="font-mono text-[11px]" style={{ color: INK3 }}>{h.stockCode}</span></div></td>
            <td className="font-mono" style={tdSx}>{fmtQty(h.quantity, stockLike)}</td><td className="font-mono" style={tdSx}>{fmtNative(h.averagePrice, h.assetType)}</td><td className="font-mono" style={tdSx}>{fmtNative(h.currentPrice, h.assetType)}</td><td className="font-mono" style={tdSx}>{fmtAmtKRW(h.marketValue, h.assetType, usdKrw)}</td>
            <td className="font-mono font-semibold" style={{ ...tdSx, color: up ? UP : DOWN }}>{up ? '+' : ''}{fmtAmtKRW(h.profitLoss, h.assetType, usdKrw)}</td>
            <td className="font-mono font-semibold" style={{ ...tdSx, color: up ? UP : DOWN }}>{up ? '+' : ''}{h.returnRate.toFixed(2)}%</td>
          </tr>); })}</tbody></table>
    )}
  </div>
);

const NoteCard = ({ sym, name }: { sym: string; name: string }) => {
  const [note, setNote] = useState('');
  useEffect(() => {
    try { const all = JSON.parse(localStorage.getItem('whalearc_stock_memos') || '{}'); setNote(all[sym] || ''); } catch { setNote(''); }
  }, [sym]);
  const onChange = (v: string) => {
    const t = v.slice(0, 200); setNote(t);
    try { const all = JSON.parse(localStorage.getItem('whalearc_stock_memos') || '{}'); all[sym] = t; localStorage.setItem('whalearc_stock_memos', JSON.stringify(all)); } catch { /* ignore */ }
  };
  return (
    <div style={{ ...mkCard, padding: '18px 22px' }}>
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-[14px] font-bold"><svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ color: INK2 }}><path d="M9 2L12 5L5 12L1.5 12.5L2 9L9 2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>종목 메모</h3>
        <span className="font-mono text-[11px]" style={{ color: INK3 }}>{note.length}/200</span>
      </div>
      <textarea value={note} onChange={e => onChange(e.target.value)} placeholder={`${name}에 대한 메모를 남겨보세요 (자동 저장)`} className="w-full resize-y rounded-lg px-3.5 py-3 text-[13.5px] leading-normal outline-none" style={{ minHeight: 80, border: `1px solid ${LINE}`, background: 'var(--ci-card)', color: 'var(--ci-ink0)' }} />
    </div>
  );
};

const VirtPromo = ({ onGo }: { onGo: () => void }) => (
  <article className="relative overflow-hidden rounded-2xl px-[22px] py-6" style={{ background: 'linear-gradient(160deg, rgba(91,157,255,.18), rgba(91,157,255,.04) 50%, transparent)', border: '1px solid rgba(91,157,255,.30)' }}>
    <div className="mb-3.5 flex h-16 items-center justify-center" aria-hidden>
      <img src="/whale-hero.png" alt="" className="h-[60px] w-auto object-contain" style={{ animation: 'whale-float 7s ease-in-out infinite', filter: 'drop-shadow(0 8px 16px rgba(44,111,230,.35))' }} />
    </div>
    <div className="mb-2.5 flex items-center justify-center gap-2"><span className="rounded px-1.5 py-0.5 text-[10px] font-bold tracking-[.06em] text-white" style={{ background: GLOW }}>VIRT</span><span className="text-[11.5px] font-semibold tracking-[.12em]" style={{ color: '#9cc1ff' }}>가상 거래</span></div>
    <h3 className="mb-2 text-center text-[17px] font-bold tracking-tight">Virt에서 안전하게 거래하세요</h3>
    <p className="m-0 text-center text-[13px] leading-snug" style={{ color: INK1 }}>가상돈으로 매수·매도 주문을 체험하고<br />전략을 테스트해보세요.</p>
    <button onClick={onGo} className="mt-4 w-full rounded-[10px] px-4 py-3 text-[13.5px] font-semibold text-white" style={{ background: `linear-gradient(180deg, ${GLOW}, ${ACCENT})`, boxShadow: '0 10px 24px -10px rgba(60,120,255,.6)' }}>Virt에서 거래하기 →</button>
  </article>
);
const PortfolioRow = ({ label, value, emphasis }: { label: string; value: ReactNode; emphasis?: boolean }) => (
  <div className="flex items-baseline justify-between"><dt className="text-[13px]" style={{ color: INK2 }}>{label}</dt><dd className="m-0 font-mono" style={{ fontSize: emphasis ? 18 : 14, fontWeight: emphasis ? 700 : 600 }}>{value}</dd></div>
);
const PortfolioMini = ({ portfolio, onGo, onPick }: { portfolio: Portfolio | null; onGo: () => void; onPick: (sym: string, at?: string) => void }) => {
  const totalValue = portfolio?.totalValue ?? 0;
  const cash = portfolio?.cashBalance ?? 0;
  const pnl = totalValue - (portfolio?.initialCash || 10_000_000);
  const rate = portfolio?.returnRate ?? 0;
  const up = rate >= 0;
  const turtle = portfolio?.turtleAllocated ?? 0;
  const top = (portfolio?.holdings ?? []).slice(0, 5);
  return (
    <article style={{ ...mkCard, padding: '22px 22px' }}>
      <div className="mb-[18px] flex items-baseline justify-between"><h3 className="text-[14px] font-bold">내 포트폴리오</h3><button onClick={onGo} className="text-[11px]" style={{ color: INK2 }}>전체 →</button></div>
      <dl className="m-0 flex flex-col gap-3">
        <PortfolioRow label="총 자산" value={portfolio ? fmtKRW(totalValue) : '—'} emphasis /><PortfolioRow label="현금" value={portfolio ? fmtKRW(cash) : '—'} />
        <PortfolioRow label="평가 손익" value={portfolio ? <span style={{ color: up ? UP : DOWN }}>{up ? '▲ +' : '▼ '}{rate.toFixed(2)}% <span className="text-[11.5px]" style={{ color: INK2 }}>({up ? '+' : ''}{fmtKRW(pnl)})</span></span> : '—'} />
        {turtle > 0 && <PortfolioRow label="터틀 전략" value={<span style={{ color: '#f5d061' }}>{fmtKRW(turtle)}</span>} />}
      </dl>
      <div className="mt-[18px] pt-4" style={{ borderTop: `1px solid ${LINE}` }}>
        <div className="mb-2.5 text-[11px] font-semibold tracking-[.12em]" style={{ color: INK3 }}>보유 종목</div>
        {top.length === 0 ? <div className="text-[12.5px]" style={{ color: INK3 }}>보유 종목이 없습니다.</div> : (
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">{top.map(h => { const hu = h.returnRate >= 0; return <li key={h.stockCode}><button onClick={() => onPick(h.stockCode, h.assetType)} className="flex w-full items-center justify-between text-left text-[13px] transition-colors hover:opacity-80"><span className="truncate" style={{ color: INK1 }}>{h.stockName}</span><span className="font-mono font-semibold" style={{ color: hu ? UP : DOWN }}>{hu ? '+' : ''}{h.returnRate.toFixed(1)}%</span></button></li>; })}</ul>
        )}
      </div>
    </article>
  );
};

const Toast = ({ msg, type }: { msg: string; type: 'success' | 'error' }) => (
  <div className="fixed bottom-6 left-1/2 z-[120] -translate-x-1/2 rounded-xl px-5 py-3 text-[13px] font-semibold text-white" style={{ background: type === 'error' ? 'linear-gradient(180deg,#e0524f,#c23b38)' : 'linear-gradient(180deg,#2f9e6e,#1f7d57)', boxShadow: '0 14px 32px -10px rgba(0,0,0,.55)', animation: 'message-in .25s ease' }}>{msg}</div>
);

const ORDER_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  FILLED: { label: '체결', color: '#4ade80', bg: 'rgba(74,222,128,.12)' },
  PENDING: { label: '대기', color: '#ffcd78', bg: 'rgba(255,205,120,.12)' },
  CANCELLED: { label: '취소', color: INK3, bg: 'var(--ci-card)' },
};
// 미체결(대기) 주문 목록 + 취소 — 옛 주문 탭 복원
const PendingOrders = ({ orders, onCancel }: { orders: Order[]; onCancel: (id: string) => void }) => {
  const open = orders.filter(o => o.status === 'PENDING');
  if (open.length === 0) return null;
  return (
    <div className="px-5 pb-5" style={{ borderTop: `1px solid ${LINE}`, paddingTop: 18 }}>
      <div className="mb-2.5 text-[12px] font-semibold tracking-[.08em]" style={{ color: INK2 }}>미체결 주문 <span className="font-mono" style={{ color: GLOW }}>{open.length}</span></div>
      <div className="flex flex-col gap-2">
        {open.map(o => { const buy = o.orderType === 'BUY', st = ORDER_STATUS[o.status] || ORDER_STATUS.PENDING, stockLike = o.assetType === 'STOCK' || isUsdAsset(o.assetType); return (
          <div key={o.id} className="flex items-center justify-between rounded-lg px-3.5 py-2.5" style={{ border: `1px solid ${LINE}`, background: 'var(--ci-card)' }}>
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="rounded-[5px] px-2 py-0.5 text-[11px] font-bold" style={{ color: buy ? UP : DOWN, background: buy ? 'rgba(239,77,77,.12)' : 'rgba(77,138,255,.12)' }}>{buy ? '매수' : '매도'}</span>
              <div className="min-w-0"><div className="truncate text-[13px] font-semibold">{o.stockName}</div><div className="font-mono text-[11px]" style={{ color: INK3 }}>{o.orderMethod === 'MARKET' ? '시장가' : '지정가'} · {fmtQty(o.quantity, stockLike)}{o.orderMethod === 'LIMIT' && o.price != null ? ` · ${fmtNative(o.price, o.assetType)}` : ''}</div></div>
            </div>
            <div className="flex shrink-0 items-center gap-2.5">
              <span className="rounded px-1.5 py-0.5 text-[10.5px] font-bold" style={{ color: st.color, background: st.bg }}>{st.label}</span>
              {o.status === 'PENDING' && <button onClick={() => onCancel(o.id)} className="rounded-md px-2.5 py-1 text-[11.5px] font-semibold" style={{ border: `1px solid ${LINE}`, color: INK1 }}>취소</button>}
            </div>
          </div>
        ); })}
      </div>
    </div>
  );
};

const ConsoleTradePage = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { isVirt } = useRoutePrefix();
  const userName = session?.user?.email ? session.user.email.split('@')[0] : '항해사';

  const [searchParams] = useSearchParams();
  const [klass, setKlass] = useState(() => ASSET_CLASSES.find(c => c.type === new URLSearchParams(window.location.search).get('type'))?.key || 'stock');
  const assetType = (ASSET_CLASSES.find(c => c.key === klass) || ASSET_CLASSES[0]).type;
  const canSearch = assetType !== 'CRYPTO';

  const [assetList, setAssetList] = useState<MarketPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSym, setActiveSym] = useState('');
  const [indicators, setIndicators] = useState<Indicators>({ ma: true, bb: false });
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ code: string; name: string; market: string }[]>([]);
  const [usdKrw, setUsdKrw] = useState(0);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [priceAlerts, setPriceAlerts] = useState<any[]>([]);
  const [tab, setTab] = useState('chart');
  const [side, setSide] = useState('buy');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const toastTimer = useRef<number | null>(null);
  const extraRef = useRef<MarketPrice[]>([]);
  const assetCacheRef = useRef<Record<AssetType, MarketPrice[]>>({ STOCK: [], CRYPTO: [], US_STOCK: [], ETF: [] });
  const selectionCacheRef = useRef<Record<AssetType, string>>({ STOCK: '', CRYPTO: '', US_STOCK: '', ETF: '' });
  const failRef = useRef(0);
  const deepLinkRef = useRef<{ code: string; type: AssetType } | null>(null);
  const selClassRef = useRef<AssetType>('STOCK'); // activeSym이 속한 자산클래스 추적 (탭 전환 시 캐시 오염 방지)

  const notify = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3000);
  }, []);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const isPreview = import.meta.env.DEV && window.location.pathname.startsWith('/preview');

  // 실시간(크립토)
  const { prices: realtimePrices } = useRealtimePrice({ enabled: assetType === 'CRYPTO' });

  // 딥링크 ?code=&type= — 첫 로드 시 해당 종목 자동 선택 (Dashboard/MyPortfolio/알림에서 진입)
  useEffect(() => {
    const code = searchParams.get('code'); const type = searchParams.get('type');
    if (!code) return;
    const cls = ASSET_CLASSES.find(c => c.type === type) || ASSET_CLASSES[0];
    deepLinkRef.current = { code, type: cls.type };
    selectionCacheRef.current[cls.type] = code;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 키보드 단축키 (B 매수 / S 매도) — 입력 중에는 무시
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.key === 'b' || e.key === 'B') { setSide('buy'); setTab('order'); }
      else if (e.key === 's' || e.key === 'S') { setSide('sell'); setTab('order'); }
      else if (e.key === 'Escape') { setQuery(''); setSearchResults([]); setTab('chart'); } // Esc 초기화(검색·탭)
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 시장 시세 로드 + 폴링 (공개 API, stale-while-revalidate)
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
      } finally { if (alive && !isPoll) setLoading(false); }
    };
    fetchPrices(false);
    let timer: ReturnType<typeof setInterval> | undefined;
    if (assetType !== 'CRYPTO') timer = setInterval(() => fetchPrices(true), 10_000);
    return () => { alive = false; if (timer) clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetType]);

  // 탭별 선택 기억 — 클래스가 일치할 때만 기록 (탭 전환 직후 이전 클래스 심볼이 새 슬롯을 덮어쓰지 않게)
  useEffect(() => {
    if (activeSym && selClassRef.current === assetType) selectionCacheRef.current[assetType] = activeSym;
    selClassRef.current = assetType;
  }, [activeSym, assetType]);

  // 환율
  useEffect(() => {
    const fetchRate = async () => { try { const { usdKrw } = await marketService.getExchangeRate(); setUsdKrw(usdKrw); } catch { /* fallback */ } };
    fetchRate();
    const t = setInterval(fetchRate, 30_000);
    return () => clearInterval(t);
  }, []);

  // 포트폴리오 + 체결 (인증) — 시장데이터와 분리 로드 (401이 시장데이터를 막지 않도록)
  const loadAccount = useCallback(() => {
    if (isPreview) return;
    tradeService.getPortfolio().then(setPortfolio).catch(() => {});
    tradeService.getTrades().then(setTrades).catch(() => {});
    tradeService.getOrders().then(setOrders).catch(() => {});
    tradeService.getPriceAlerts().then(a => setPriceAlerts(a || [])).catch(() => {});
  }, [isPreview]);
  useEffect(() => {
    loadAccount();
    if (isPreview) return;
    const t = setInterval(loadAccount, 10_000);
    return () => clearInterval(t);
  }, [loadAccount, isPreview]);

  // 미체결 주문 취소
  const handleCancel = useCallback(async (id: string) => {
    if (!window.confirm('주문을 취소하시겠습니까?')) return;
    try { await tradeService.cancelOrder(id); notify('주문이 취소되었습니다.'); loadAccount(); }
    catch { notify('주문 취소 실패', 'error'); }
  }, [notify, loadAccount]);

  // 보유/포트폴리오 항목 클릭 → 해당 종목 선택 (자산클래스 자동 전환)
  const selectSymbol = useCallback((sym: string, at?: string) => {
    setTab('chart');
    const cls = ASSET_CLASSES.find(c => c.type === at);
    // 다른 자산클래스면 딥링크 경로 재사용(로드 후 선택 + 목록에 없으면 단건 조회 주입)
    if (cls && cls.key !== klass) { deepLinkRef.current = { code: sym, type: cls.type }; setKlass(cls.key); }
    else setActiveSym(sym);
  }, [klass]);

  // 검색 (디바운스, 주식/미국/ETF)
  useEffect(() => {
    if (!canSearch || query.trim().length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const fn = assetType === 'US_STOCK' ? marketService.searchUsStocks : assetType === 'ETF' ? marketService.searchEtfs : marketService.searchStocks;
        setSearchResults((await fn(query.trim())).slice(0, 12));
      } catch { setSearchResults([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [query, assetType, canSearch]);

  const onSearchPick = useCallback(async (r: { code: string; name: string; market: string }) => {
    try {
      const fn = assetType === 'US_STOCK' ? marketService.getUsStockPrice : assetType === 'ETF' ? marketService.getEtfPrice : marketService.getStockPrice;
      const price = await fn(r.code);
      extraRef.current = [price, ...extraRef.current.filter(a => a.symbol !== price.symbol)];
      setAssetList(prev => [price, ...prev.filter(a => a.symbol !== price.symbol)]);
      setActiveSym(price.symbol);
      setQuery(''); setSearchResults([]);
    } catch { setError('종목 시세 조회에 실패했습니다.'); }
  }, [assetType]);

  // 실시간 병합 + 검색(크립토 로컬)
  const mergedList = useMemo(() => {
    if (assetType !== 'CRYPTO' || realtimePrices.size === 0) return assetList;
    return assetList.map(a => realtimePrices.get(a.symbol) ?? a);
  }, [assetList, realtimePrices, assetType]);
  const displayList = useMemo(() => {
    let list = mergedList;
    if (!canSearch && query.trim()) { const q = query.trim().toLowerCase(); list = list.filter(a => a.name.toLowerCase().includes(q) || a.symbol.toLowerCase().includes(q)); }
    // 거래량순 + 크립토는 인기 코인을 상단 고정 (옛 동작 복원)
    return [...list].sort((a, b) => {
      if (assetType === 'CRYPTO') { const pa = POPULAR_COINS.has(a.symbol), pb = POPULAR_COINS.has(b.symbol); if (pa !== pb) return pa ? -1 : 1; }
      return b.volume - a.volume;
    });
  }, [mergedList, query, canSearch, assetType]);
  const sel = useMemo(() => mergedList.find(a => a.symbol === activeSym) || mergedList[0] || null, [mergedList, activeSym]);
  const rtPrice = useMemo(() => (assetType === 'CRYPTO' && sel ? realtimePrices.get(sel.symbol)?.price ?? null : null), [assetType, sel, realtimePrices]);
  // 최근 본 종목 (localStorage — 시세 페이지와 동일 키 공유)
  const [recent, setRecent] = useState<{ stockCode: string; stockName: string; assetType: string }[]>([]);
  useEffect(() => { try { const s = localStorage.getItem('whalearc_recent_stocks'); if (s) setRecent(JSON.parse(s)); } catch { /* ignore */ } }, []);
  useEffect(() => {
    if (!sel) return;
    try {
      const saved = localStorage.getItem('whalearc_recent_stocks');
      const prev: { stockCode: string; stockName: string; assetType: string }[] = saved ? JSON.parse(saved) : [];
      const next = [{ stockCode: sel.symbol, stockName: sel.name, assetType: sel.assetType }, ...prev.filter(r => r.stockCode !== sel.symbol)].slice(0, 8);
      localStorage.setItem('whalearc_recent_stocks', JSON.stringify(next));
      setRecent(next);
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel?.symbol]);
  // 딥링크 종목이 목록에 없으면 단건 시세 조회 후 주입
  useEffect(() => {
    const dl = deepLinkRef.current;
    if (!dl || loading || assetType !== dl.type) return;
    // 새 클래스 목록이 아직 커밋되지 않았으면(이전 클래스 목록 잔존) 소비하지 말고 대기 — 다음 커밋에서 재시도
    if (mergedList.length > 0 && mergedList[0].assetType !== assetType) return;
    if (mergedList.some(a => a.symbol === dl.code)) { setActiveSym(dl.code); deepLinkRef.current = null; return; }
    if (dl.type !== 'CRYPTO') {
      const fn = dl.type === 'US_STOCK' ? marketService.getUsStockPrice : dl.type === 'ETF' ? marketService.getEtfPrice : marketService.getStockPrice;
      fn(dl.code).then(price => {
        extraRef.current = [price, ...extraRef.current.filter(a => a.symbol !== price.symbol)];
        setAssetList(prev => [price, ...prev.filter(a => a.symbol !== price.symbol)]);
        setActiveSym(price.symbol);
      }).catch(() => {});
    }
    deepLinkRef.current = null;
  }, [loading, assetType, mergedList]);


  const pendingCount = orders.filter(o => o.status === 'PENDING').length;
  const alertCount = sel ? priceAlerts.filter(a => a.stockCode === sel.symbol).length : 0;
  const tabs = [['chart', '차트', undefined], ['order', '주문', pendingCount], ['fills', '체결', trades.length], ['orders', '주문내역', orders.length || undefined], ['holding', '보유', portfolio?.holdings.length], ['alerts', '알림', alertCount || undefined]] as [string, string, number | undefined][];

  return (
    <HelmShell active="trade" virt={isVirt} userName={userName} session={assetType === 'CRYPTO' ? '실시간 시세 · WebSocket' : '시세 10초 갱신'}>
      <div className="flex flex-col gap-6">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2.5"><span className="h-1.5 w-1.5 rounded-full animate-pulse-dot" style={{ background: UP, boxShadow: `0 0 8px ${UP}` }} /><span className="text-[11.5px] font-semibold tracking-[.18em]" style={{ color: '#9cc1ff' }}>TRADING · VIRT 모의 거래</span></div>
          <h1 className="text-[32px] font-bold tracking-tight">거래</h1>
          <p className="mt-2 text-[14px]" style={{ color: INK1 }}>종목을 선택하고 매수·매도를 실행하세요. 실계좌 미연결 상태에서는 VIRT로 안전하게.</p>
        </div>
        {error && <div className="rounded-xl px-4 py-3 text-[13px]" style={{ background: 'rgba(239,77,77,.1)', border: '1px solid rgba(239,77,77,.25)', color: '#fca5a5' }}>{error}</div>}
        <div className="grid items-start gap-5 grid-cols-1 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)_minmax(0,300px)]">
          <StockList assets={displayList} activeSym={activeSym} onPick={setActiveSym} klass={klass} setKlass={k => { setKlass(k); setQuery(''); setSearchResults([]); }} query={query} setQuery={setQuery} canSearch={canSearch} searchResults={searchResults} onSearchPick={onSearchPick} usdKrw={usdKrw} loading={loading} />
          <div className="flex min-w-0 flex-col gap-[18px]">
            {sel ? <>
              {recent.filter(r => r.stockCode !== sel.symbol).length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-semibold" style={{ color: INK3 }}>최근 본</span>
                  {recent.filter(r => r.stockCode !== sel.symbol).slice(0, 6).map(r => (
                    <button key={r.stockCode} onClick={() => selectSymbol(r.stockCode, r.assetType)} className="rounded-full px-2.5 py-1 text-[11.5px] font-semibold" style={{ border: `1px solid ${LINE}`, background: 'var(--ci-card)', color: INK1 }}>{r.stockName}</button>
                  ))}
                </div>
              )}
              <StockHeaderCard sel={sel} usdKrw={usdKrw} />
              <div style={{ ...mkCard, padding: 0 }}>
                <div className="flex items-center px-1.5" style={{ borderBottom: `1px solid ${LINE}` }}>
                  {tabs.map(([k, l, badge]) => { const on = tab === k; return (
                    <button key={k} onClick={() => setTab(k)} className="relative inline-flex items-center gap-2 px-[18px] py-3.5 text-[14px]" style={{ color: on ? 'var(--ci-ink0)' : INK2, fontWeight: on ? 700 : 500 }}>
                      {l}{badge != null && badge > 0 && <span className="rounded-full px-[7px] py-0.5 text-[11px] font-bold" style={{ background: on ? 'rgba(91,157,255,.22)' : 'var(--ci-line)', color: on ? '#cfe1ff' : INK2 }}>{badge}</span>}
                      {on && <span className="absolute bottom-[-1px] left-3 right-3 h-0.5 rounded" style={{ background: `linear-gradient(90deg, ${ACCENT}, ${GLOW})` }} />}
                    </button>); })}
                </div>
                {tab === 'chart' && <ChartPanel symbol={sel.symbol} price={sel.price} changeRate={sel.changeRate} assetType={sel.assetType} indicators={indicators} setIndicators={setIndicators} />}
                {tab === 'order' && <>
                  <div className="grid gap-[18px] p-5" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(260px, 320px)' }}><OrderTicket sel={sel} side={side} setSide={setSide} portfolio={portfolio} usdKrw={usdKrw} rtPrice={rtPrice} notify={notify} onPlaced={loadAccount} isVirt={isVirt} /><Orderbook sel={sel} /></div>
                  <PendingOrders orders={orders} onCancel={handleCancel} />
                  <div className="px-5 pb-4 text-[11px]" style={{ color: INK3 }}>단축키 · <b style={{ color: INK2 }}>B</b> 매수 · <b style={{ color: INK2 }}>S</b> 매도</div>
                </>}
                {tab === 'fills' && <FillsPanel trades={trades} usdKrw={usdKrw} />}
                {tab === 'orders' && <OrderHistoryPanel orders={orders} onCancel={handleCancel} />}
                {tab === 'holding' && <HoldingsPanel holdings={portfolio?.holdings ?? []} usdKrw={usdKrw} onPick={selectSymbol} />}
                {tab === 'alerts' && <AlertsPanel sel={sel} alerts={priceAlerts} usdKrw={usdKrw} onChanged={loadAccount} notify={notify} />}
              </div>
              <NoteCard sym={sel.symbol} name={sel.name} />
            </> : (
              <div style={{ ...mkCard, padding: '60px 32px' }} className="text-center text-[13.5px]" >{loading ? <span style={{ color: INK3 }}>종목을 불러오는 중…</span> : <span style={{ color: INK3 }}>종목을 선택해주세요.</span>}</div>
            )}
          </div>
          <div className="flex flex-col gap-[18px] lg:sticky lg:top-24">
            <VirtPromo onGo={() => navigate('/virt/trade')} />
            <PortfolioMini portfolio={portfolio} onGo={() => navigate(`${isVirt ? '/virt' : ''}/my-portfolio`)} onPick={selectSymbol} />
          </div>
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-3.5 pt-6" style={{ borderTop: `1px solid ${LINE}` }}>
          <span className="font-mono text-[12px]" style={{ color: INK3 }}>© 2026 WhaleArc · 모든 항해는 사용자의 책임 아래 진행됩니다.</span>
          <div className="flex gap-[18px] text-[12.5px]" style={{ color: INK2 }}><a>도움말</a><a>상태</a><a>API</a><a>의견 보내기</a></div>
        </footer>
      </div>
      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </HelmShell>
  );
};

export default ConsoleTradePage;
