import type { ReactNode } from 'react';
import { useEffect, useState, useCallback } from 'react';
import { commaNumber, formatAmountLive } from '../../utils/currency';
import { useAuth } from '../../contexts/AuthContext';
import type { MarketPrice } from '../../services/marketService';
import { tradeService, type Portfolio, type Order, type PriceAlert } from '../../services/tradeService';
import { Term } from '../GlossaryTerm';
import EmotionMirrorModal from '../EmotionMirrorModal';
import { mirrorService, type UserChoice } from '../../services/mirrorService';
import { getErrorMessage } from '../../utils/api';
import { isUnlimited } from '../../services/userService';
import {
  UP, DOWN, GLOW, INK1, INK2, INK3, LINE, COMMISSION_RATE, mkCard,
  fmtKRW, fmtPrice, fmtQty, fmtNative, stripZeros,
} from '../../lib/marketUi';

/* ────────────────────────────────────────────────────────────
   OrderPanel — '거래 의지가 있을 때' 여는 우측 슬라이드오버(모바일 전체화면).
   시세 상세의 매수/매도 버튼으로 열리며 주문 실행에만 집중한다.
   ※ 계좌 데이터(포트폴리오/미체결/알림)는 패널이 열렸을 때만 폴링 —
     탐색만 하는 비로그인/구경 사용자에게는 인증 호출이 0회.
   기존 ConsoleTradePage의 OrderTicket·Orderbook·PendingOrders·AlertsPanel을
   로직 무변경으로 이관.
   ──────────────────────────────────────────────────────────── */

// 유리병 인터셉트 임계값 — 자산군별 변동성 차이로 코인/주식 분리.
const MIRROR_THRESHOLDS = {
  crypto: { panic: -8, fomo: 25 },   // 코인: −8% 급락 매도 / +25% 급등 매수
  stock: { panic: -4, fomo: 10 },    // 주식·ETF: −4% 급락 매도 / +10% 급등 매수
} as const;
const mirrorThreshold = (at?: string) =>
  (at === 'STOCK' || at === 'US_STOCK' || at === 'ETF') ? MIRROR_THRESHOLDS.stock : MIRROR_THRESHOLDS.crypto;

const NumberField = ({ value, onChange, step = 1, suffix, disabled, comma }: { value: number; onChange: (n: number) => void; step?: number; suffix?: string; disabled?: boolean; comma?: boolean }) => {
  // comma=true면 천 단위 콤마 표시(소수부 보존). 편집 중에는 text 버퍼로 '150.'·'0.0012' 입력 중 소수점 유지,
  // 블러/스테퍼 시 null로 비워 숫자값(value)에서 다시 포맷.
  const [text, setText] = useState<string | null>(null);
  const display = comma ? (text ?? commaNumber(value)) : value;
  const handleChange = (raw: string) => {
    if (!comma) { onChange(Number(raw) || 0); return; }
    const formatted = formatAmountLive(raw);
    setText(formatted);
    const num = Number(formatted.replace(/,/g, ''));
    onChange(Number.isFinite(num) ? num : 0);
  };
  const stepTo = (n: number) => { setText(null); onChange(n); };
  return (
    <div className="mt-1.5 grid overflow-hidden rounded-lg" style={{ gridTemplateColumns: '36px 1fr 36px', border: `1px solid ${LINE}`, background: 'var(--ci-card)' }}>
      <button onClick={() => !disabled && stepTo(Math.max(0, value - step))} disabled={disabled} className="text-[17.5px] font-semibold" style={{ background: 'var(--ci-card)', borderInline: `1px solid ${LINE}`, color: INK1 }}>−</button>
      <div className="relative flex items-center">
        <input type={comma ? 'text' : 'number'} inputMode={comma ? 'decimal' : undefined} value={display} onChange={e => handleChange(e.target.value)} onBlur={() => setText(null)} disabled={disabled} className="w-full bg-transparent py-2.5 pl-3 pr-9 text-right text-[16px] font-semibold outline-none" style={{ color: disabled ? INK3 : 'var(--ci-ink0)', fontFamily: 'JetBrains Mono, monospace' }} />
        {suffix && <span className="pointer-events-none absolute right-3 text-[13px]" style={{ color: INK3 }}>{suffix}</span>}
      </div>
      <button onClick={() => !disabled && stepTo(value + step)} disabled={disabled} className="text-[17.5px] font-semibold" style={{ background: 'var(--ci-card)', borderInline: `1px solid ${LINE}`, color: INK1 }}>+</button>
    </div>
  );
};
const FieldLabel = ({ children }: { children: ReactNode }) => <span className="text-[12.5px] font-semibold tracking-[.06em]" style={{ color: INK2 }}>{children}</span>;

const OrderTicket = ({ sel, side, setSide, portfolio, usdKrw, rtPrice, notify, onPlaced, isVirt }: {
  sel: MarketPrice; side: string; setSide: (s: string) => void; portfolio: Portfolio | null; usdKrw: number;
  rtPrice: number | null; notify: (m: string, t?: 'success' | 'error') => void; onPlaced: () => void; isVirt: boolean;
}) => {
  const [orderMethod, setOrderMethod] = useState<'LIMIT' | 'MARKET'>('MARKET'); // 시장가 기본
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
  // 매수/매도 전환 시 수량 초기화
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
  // 지정가 가격 단계 — 크립토는 저가 알트코인까지 고려해 가격대별로 세분화.
  const tick = needsFx ? 0.5
    : !stockLike ? (sel.price >= 1000000 ? 1000 : sel.price >= 100000 ? 100 : sel.price >= 1000 ? 10 : sel.price >= 10 ? 1 : 0.1)
      : sel.price >= 1000000 ? 1000 : sel.price >= 100000 ? 100 : 50;
  // 수량 스텝 — 주식/ETF는 1주, 크립토는 0.0001개 단위 미세 조정.
  const qtyStep = stockLike ? 1 : 0.0001;

  const setPct = (pct: number) => {
    if (isBuy) {
      const eff = calcPrice * (1 + COMMISSION_RATE) * fx;
      if (eff <= 0) return;
      const max = (cash * pct) / eff;
      // 크립토는 8자리 '내림' — toFixed(8) 반올림이 한도 미세 초과해 '최대' 매수가 잔고부족으로 거부되던 버그 방지
      setQty(stockLike ? Math.floor(max) : Number(stripZeros((Math.floor(max * 1e8) / 1e8).toFixed(8))));
    } else {
      const q = heldQty * pct;
      setQty(stockLike ? Math.floor(q) : Number(stripZeros((Math.floor(q * 1e8) / 1e8).toFixed(8))));
    }
  };

  const submit = async () => {
    if (mirror) return;   // 인터셉트 모달 열려 있으면 중복 진입 금지
    if (!qty || qty <= 0) { notify('수량은 0보다 커야 합니다.', 'error'); return; }
    if (stockLike && qty !== Math.floor(qty)) { notify('주식은 1주 단위로만 거래할 수 있습니다.', 'error'); return; }
    if (!stockLike) { const dec = String(qty).split('.')[1]; if (dec && dec.length > 8) { notify('수량의 소수점은 최대 8자리까지 입력할 수 있습니다.', 'error'); return; } }
    if (orderMethod === 'LIMIT' && (!price || price <= 0)) { notify('지정가는 0보다 큰 값을 입력해주세요.', 'error'); return; }
    if (isBuy && portfolio && totalKRW > cash) { notify('잔고가 부족합니다.', 'error'); return; }
    if (!isBuy && qty > heldQty) { notify('보유 수량이 부족합니다.', 'error'); return; }
    // 유리병 인터셉트 — 막지 않고, 묻고 띄운다. '지금 당장' 충동이라 시장가에서만. 임계값은 자산군별.
    const mt = mirrorThreshold(at);
    if (orderMethod === 'MARKET' && !isBuy && heldQty > 0 && sel.changeRate <= mt.panic) { setMirrorKind('PANIC'); setMirror(true); return; }   // 급락 공포 매도
    if (orderMethod === 'MARKET' && isBuy && heldQty <= 0 && sel.changeRate >= mt.fomo) { setMirrorKind('FOMO'); setMirror(true); return; }     // 급등 탐욕(FOMO) 매수
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
    } catch (e) {
      notify(getErrorMessage(e, '주문 실패. 다시 시도해주세요.'), 'error');
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
    <div>
      <div className="grid grid-cols-2 rounded-[10px] p-[3px]" style={{ background: 'var(--ci-card)', border: `1px solid ${LINE}` }}>
        {[['buy', '매수', UP], ['sell', '매도', DOWN]].map(([k, l, c]) => (
          <button key={k} onClick={() => { setSide(k); setQty(0); }} className="rounded-lg py-2.5 text-[15px] font-bold" style={{ background: side === k ? c : 'transparent', color: side === k ? '#0a1230' : INK1 }}>{l}</button>
        ))}
      </div>
      <div className="mt-[18px]"><FieldLabel>주문 종류</FieldLabel>
        <div className="mt-1.5 flex gap-1.5">{(['LIMIT', 'MARKET'] as const).map(k => (
          <button key={k} onClick={() => setOrderMethod(k)} className="flex-1 rounded-lg py-2.5 text-[13.5px] font-semibold" style={{ border: orderMethod === k ? '1px solid rgba(91,157,255,.32)' : `1px solid ${LINE}`, background: orderMethod === k ? 'rgba(91,157,255,.12)' : 'transparent', color: orderMethod === k ? 'var(--ci-ink0)' : INK1 }}>{k === 'LIMIT' ? '지정가' : '시장가'}</button>
        ))}</div>
        <div className="mt-2 rounded-[8px] px-3 py-2 text-[12.5px] leading-snug" style={{ background: 'var(--ci-card)', border: `1px solid ${LINE}`, color: INK2 }}>
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
      <div className="mt-[18px]"><div className="flex items-baseline justify-between"><FieldLabel>주문 가격</FieldLabel>{orderMethod === 'MARKET' && <span className="font-mono text-[12px]" style={{ color: INK3 }}>현재가 체결</span>}</div>
        <NumberField value={orderMethod === 'MARKET' ? Math.round(cur * 100) / 100 : price} onChange={setPrice} step={tick} disabled={orderMethod === 'MARKET'} suffix={needsFx ? '$' : '원'} comma /></div>
      <div className="mt-3.5"><FieldLabel>수량</FieldLabel>
        <NumberField value={qty} onChange={setQty} step={qtyStep} suffix={stockLike ? '주' : '개'} comma />
        <div className="mt-2 grid grid-cols-4 gap-1.5">{[['10%', 0.1], ['25%', 0.25], ['50%', 0.5], ['최대', 1]].map(([l, p]) => (
          <button key={l as string} onClick={() => setPct(p as number)} className="rounded-md py-1.5 text-[12.5px] font-semibold" style={{ border: `1px solid ${LINE}`, background: 'var(--ci-card)', color: INK1 }}>{l}</button>
        ))}</div>
      </div>
      <div className="mt-[18px] rounded-[10px] px-4 py-3.5" style={{ background: 'var(--ci-card)', border: `1px solid ${LINE}` }}>
        <div className="flex items-center justify-between"><span className="text-[13.5px]" style={{ color: INK2 }}>예상 금액</span><span className="font-mono text-[19.5px] font-semibold">{fmtKRW(totalKRW)}</span></div>
        <div className="mt-2.5 flex items-center justify-between text-[13px]" style={{ color: INK2 }}><span>{isBuy ? '주문 가능' : '보유 수량'}</span><span className="font-mono">{isBuy ? fmtKRW(cash) : fmtQty(heldQty, stockLike)}</span></div>
        <div className="mt-1 text-right text-[11.5px]" style={{ color: INK3 }}>수수료 0.1% 포함</div>
      </div>
      <details className="mt-3 rounded-lg px-3 py-2" style={{ border: `1px solid ${LINE}`, background: 'var(--ci-card)' }}>
        <summary className="cursor-pointer list-none text-[13px] font-semibold" style={{ color: INK2 }}>메모 추가 (선택)</summary>
        <textarea value={memo} onChange={e => setMemo(e.target.value.slice(0, 500))} rows={2} placeholder="거래 일지 메모 (체결 내역에 표시)" className="mt-2 w-full resize-none rounded-md px-2.5 py-2 text-[13.5px] outline-none" style={{ border: `1px solid ${LINE}`, background: 'var(--ci-raised)', color: 'var(--ci-ink0)' }} />
        <div className="text-right font-mono text-[11.5px]" style={{ color: INK3 }}>{memo.length}/500</div>
      </details>
      <div className="mt-3.5 flex items-center gap-2.5 rounded-lg px-3 py-2.5" style={{ background: 'rgba(255,205,120,.08)', border: '1px solid rgba(255,205,120,.18)' }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: '#ffcd78', flexShrink: 0 }}><path d="M7 2L13 12H1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /><path d="M7 6v3 M7 10.5v.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
        <span className="text-[12.5px] leading-snug" style={{ color: '#ffcd78' }}>실계좌가 연결되지 않았습니다. <strong>VIRT 모의 거래</strong>로 진행됩니다.</span>
      </div>
      <button onClick={submit} disabled={submitting || !qty || qty <= 0} className="mt-3.5 w-full rounded-[10px] py-3.5 text-[16px] font-bold disabled:opacity-50" style={{ background: isBuy ? `linear-gradient(180deg, ${UP}, #c73a3a)` : `linear-gradient(180deg, ${DOWN}, #2f6fe0)`, color: '#0a1230', boxShadow: isBuy ? '0 10px 28px -12px rgba(239,77,77,.5)' : '0 10px 28px -12px rgba(77,138,255,.5)' }}>
        <span className="mr-2 rounded px-1.5 py-0.5 text-[11px] font-bold tracking-[.06em]" style={{ background: 'rgba(10,18,48,.18)', color: '#0a1230' }}>VIRT</span>{submitting ? '주문 처리 중…' : `${fmtQty(qty, stockLike)} ${isBuy ? '매수' : '매도'} 주문`}
      </button>
      {mirror && (
        <EmotionMirrorModal kind={mirrorKind} name={sel.name} changeRate={sel.changeRate} busy={mirrorBusy}
          onClose={() => setMirror(false)} onChoice={onMirrorChoice} />
      )}
    </div>
  );
};

// 실시간 호가 잔량(Level-2)이 아직 없으므로 잔량을 지어내지 않는다. 현재가 기준 가격 단계(±tick)만 참고용 표시.
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
    <li className="grid grid-cols-1 items-center px-[18px] py-1.5 text-[13px]">
      <span className="text-right font-mono font-semibold" style={{ color: s === 'ask' ? DOWN : UP }}>{fmt(price)}</span>
    </li>
  );
  return (
    <div style={{ ...mkCard, padding: '14px 0 0', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div className="flex items-center justify-between px-[18px] pb-3" style={{ borderBottom: `1px solid ${LINE}` }}><h3 className="text-[14.5px] font-bold">호가 단계</h3><span className="text-[11.5px] tracking-[.08em]" style={{ color: INK3 }}>현재가 ±{tickLabel} · 참고용</span></div>
      <ul className="m-0 list-none p-0">{asks.map((a, i) => <Row key={'a' + i} s="ask" price={a} />)}</ul>
      <div className="flex items-center justify-between px-[18px] py-2.5" style={{ background: 'rgba(91,157,255,.06)', borderTop: '1px solid rgba(91,157,255,.2)', borderBottom: '1px solid rgba(91,157,255,.2)' }}><span className="text-[12px] font-semibold tracking-[.1em]" style={{ color: GLOW }}>현재가</span><span className="font-mono text-[16px] font-bold">{fmt(p)}</span></div>
      <ul className="m-0 list-none p-0">{bids.map((b, i) => <Row key={'b' + i} s="bid" price={b} />)}</ul>
      <div className="px-[18px] py-3 text-[12px] leading-relaxed" style={{ borderTop: `1px solid ${LINE}`, color: INK3 }}>실시간 호가 잔량은 준비 중이에요. 위 값은 현재가 기준 가격 단계입니다.</div>
    </div>
  );
};

/* 가격 알림(벨) — createPriceAlert/getPriceAlerts/deletePriceAlert */
const ALERT_CONDS: [string, string][] = [['ABOVE', '이상'], ['BELOW', '이하'], ['CHANGE_UP', '급등'], ['CHANGE_DOWN', '급락']];
const AMBER = '#f5d061';
const AlertsPanel = ({ sel, alerts, usdKrw, onChanged, notify }: { sel: MarketPrice; alerts: PriceAlert[]; usdKrw: number; onChanged: () => void; notify: (m: string, t?: 'success' | 'error') => void }) => {
  const { limits } = useAuth();
  const [cond, setCond] = useState('ABOVE');
  const [target, setTarget] = useState('');
  const [pct, setPct] = useState('');
  const isChange = cond === 'CHANGE_UP' || cond === 'CHANGE_DOWN';
  const maxAlerts = limits?.maxAlerts ?? 3;                 // 등급 알림 한도(무제한=-1)
  const atLimit = !isUnlimited(maxAlerts) && alerts.length >= maxAlerts; // 전체 활성 알림 기준(백엔드와 동일)
  const valid = (isChange ? parseFloat(pct) > 0 : parseFloat(target) > 0) && !atLimit;
  const mine = alerts.filter(a => a.stockCode === sel.symbol);
  const create = async () => {
    if (!valid) return;
    try {
      await tradeService.createPriceAlert({
        stockCode: sel.symbol, stockName: sel.name, assetType: sel.assetType || 'CRYPTO', condition: cond,
        ...(isChange ? { changePercent: parseFloat(pct) } : { targetPrice: parseFloat(target) }),
      });
      notify('가격 알림이 설정되었습니다.'); setTarget(''); setPct(''); onChanged();
    } catch (e) { notify(getErrorMessage(e, '알림 설정에 실패했습니다.'), 'error'); }
  };
  const del = async (id: string) => { try { await tradeService.deletePriceAlert(id); notify('알림이 삭제되었습니다.'); onChanged(); } catch { notify('삭제에 실패했습니다.', 'error'); } };
  const segStyle = (on: boolean): React.CSSProperties => ({ padding: '8px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, border: `1px solid ${on ? 'rgba(245,208,97,.4)' : LINE}`, background: on ? 'rgba(245,208,97,.14)' : 'var(--ci-card)', color: on ? AMBER : INK1 });
  const fieldSx: React.CSSProperties = { border: `1px solid ${LINE}`, background: 'var(--ci-raised)', color: 'var(--ci-ink0)' };
  const labelOf = (a: PriceAlert) => a.condition === 'CHANGE_UP' ? `${a.changePercent}% 이상 급등` : a.condition === 'CHANGE_DOWN' ? `${a.changePercent}% 이상 급락` : `${fmtNative(a.targetPrice ?? 0, a.assetType)} ${a.condition === 'ABOVE' ? '이상' : '이하'}`;
  return (
    <div>
      <div className="mb-3.5 flex flex-wrap items-center gap-2 text-[13.5px]" style={{ color: INK2 }}><span className="text-[16px]">🔔</span>현재가 <span className="font-mono font-semibold" style={{ color: 'var(--ci-ink0)' }}>{fmtPrice(sel, usdKrw)}</span> 도달/변동 시 알림을 받습니다.</div>
      <div className="mb-3 flex flex-wrap gap-1.5">{ALERT_CONDS.map(([k, l]) => <button key={k} onClick={() => { setCond(k); setTarget(''); setPct(''); }} style={segStyle(cond === k)}>{l}</button>)}</div>
      <div className="flex gap-2">
        {isChange
          ? <input type="number" min={0} placeholder="변동률 (%)" value={pct} onChange={e => setPct(e.target.value)} className="flex-1 rounded-lg px-3 py-2.5 text-[14.5px] outline-none" style={fieldSx} />
          : <input inputMode="decimal" placeholder={`목표 가격 (${sel.currency === 'USD' ? 'USD' : 'KRW'})`} value={formatAmountLive(target)} onChange={e => setTarget(e.target.value.replace(/[^\d.]/g, ''))} className="flex-1 rounded-lg px-3 py-2.5 text-right font-mono text-[15px] outline-none" style={fieldSx} />}
        <button onClick={create} disabled={!valid} className="rounded-lg px-5 py-2.5 text-[14.5px] font-bold disabled:opacity-40" style={{ background: 'rgba(245,208,97,.18)', color: AMBER, border: '1px solid rgba(245,208,97,.3)' }}>알림 설정</button>
      </div>
      {atLimit && <div className="mt-2 text-[12.5px]" style={{ color: AMBER }}>가격 알림을 최대 {maxAlerts}개까지 설정할 수 있어요. 기존 알림을 삭제하거나 등급을 올려보세요.</div>}
      {mine.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-[12px] font-semibold tracking-[.1em]" style={{ color: INK3 }}>설정된 알림 <span className="font-mono" style={{ color: AMBER }}>{mine.length}</span>{!isUnlimited(maxAlerts) && <span className="font-mono" style={{ color: INK3 }}> · 전체 {alerts.length}/{maxAlerts}</span>}</div>
          <div className="flex flex-col gap-1.5">
            {mine.map(a => (
              <div key={a.id} className="flex items-center justify-between rounded-lg px-3.5 py-2.5" style={{ border: `1px solid ${LINE}`, background: 'var(--ci-card)' }}>
                <span className="text-[13.5px]" style={{ color: INK1 }}>{labelOf(a)}</span>
                <button onClick={() => del(a.id)} className="text-[12.5px] font-semibold" style={{ color: UP }}>삭제</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const ORDER_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  FILLED: { label: '체결', color: '#4ade80', bg: 'rgba(74,222,128,.12)' },
  PENDING: { label: '대기', color: '#ffcd78', bg: 'rgba(255,205,120,.12)' },
  CANCELLED: { label: '취소', color: INK3, bg: 'var(--ci-card)' },
};
// 미체결(대기) 주문 목록 + 취소
const PendingOrders = ({ orders, onCancel }: { orders: Order[]; onCancel: (id: string) => void }) => {
  const open = orders.filter(o => o.status === 'PENDING');
  if (open.length === 0) return <div className="py-10 text-center text-[14px]" style={{ color: INK3 }}>미체결 주문이 없습니다.</div>;
  return (
    <div className="flex flex-col gap-2">
      {open.map(o => { const buy = o.orderType === 'BUY', st = ORDER_STATUS[o.status] || ORDER_STATUS.PENDING, stockLike = o.assetType === 'STOCK' || o.assetType === 'US_STOCK' || o.assetType === 'ETF'; return (
        <div key={o.id} className="flex items-center justify-between rounded-lg px-3.5 py-2.5" style={{ border: `1px solid ${LINE}`, background: 'var(--ci-card)' }}>
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="rounded-[5px] px-2 py-0.5 text-[12px] font-bold" style={{ color: buy ? UP : DOWN, background: buy ? 'rgba(239,77,77,.12)' : 'rgba(77,138,255,.12)' }}>{buy ? '매수' : '매도'}</span>
            <div className="min-w-0"><div className="truncate text-[14px] font-semibold">{o.stockName}</div><div className="font-mono text-[12px]" style={{ color: INK3 }}>{o.orderMethod === 'MARKET' ? '시장가' : '지정가'} · {fmtQty(o.quantity, stockLike)}{o.orderMethod === 'LIMIT' && o.price != null ? ` · ${fmtNative(o.price, o.assetType)}` : ''}</div></div>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <span className="rounded px-1.5 py-0.5 text-[11.5px] font-bold" style={{ color: st.color, background: st.bg }}>{st.label}</span>
            {o.status === 'PENDING' && <button onClick={() => onCancel(o.id)} className="rounded-md px-2.5 py-1 text-[12.5px] font-semibold" style={{ border: `1px solid ${LINE}`, color: INK1 }}>취소</button>}
          </div>
        </div>
      ); })}
    </div>
  );
};

type OrderPanelProps = {
  open: boolean;
  onClose: () => void;
  sel: MarketPrice | null;
  usdKrw: number;
  rtPrice: number | null;
  isVirt: boolean;
  side: string;
  setSide: (s: string) => void;
  notify: (m: string, t?: 'success' | 'error') => void;
};

const OrderPanel = ({ open, onClose, sel, usdKrw, rtPrice, isVirt, side, setSide, notify }: OrderPanelProps) => {
  const [tab, setTab] = useState<'order' | 'pending' | 'alerts'>('order');
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>([]);
  const isPreview = import.meta.env.DEV && window.location.pathname.startsWith('/preview');

  // 계좌 데이터 로드 (인증) — 패널이 열렸을 때만
  const loadAccount = useCallback(() => {
    if (isPreview) return;
    tradeService.getPortfolio().then(setPortfolio).catch(() => {});
    tradeService.getOrders().then(setOrders).catch(() => {});
    tradeService.getPriceAlerts().then(a => setPriceAlerts(a || [])).catch(() => {});
  }, [isPreview]);

  // 열릴 때 탭 초기화 + 즉시 로드, 열려 있는 동안만 10초 폴링
  useEffect(() => {
    if (!open) return;
    setTab('order');
    loadAccount();
    if (isPreview) return;
    const t = setInterval(loadAccount, 10_000);
    return () => clearInterval(t);
  }, [open, loadAccount, isPreview]);

  // Esc로 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleCancel = useCallback(async (id: string) => {
    if (!window.confirm('주문을 취소하시겠습니까?')) return;
    try { await tradeService.cancelOrder(id); notify('주문이 취소되었습니다.'); loadAccount(); }
    catch { notify('주문 취소 실패', 'error'); }
  }, [notify, loadAccount]);

  const pendingCount = orders.filter(o => o.status === 'PENDING').length;
  const alertCount = sel ? priceAlerts.filter(a => a.stockCode === sel.symbol).length : 0;
  const up = sel ? sel.changeRate >= 0 : false;
  const rate = portfolio?.returnRate ?? 0;
  const tabs: [typeof tab, string, number | undefined][] = [['order', '주문', undefined], ['pending', '미체결', pendingCount || undefined], ['alerts', '알림', alertCount || undefined]];

  return (
    <>
      {/* 배경 딤 */}
      <div onClick={onClose} aria-hidden className="fixed inset-0 z-[95] transition-opacity duration-200" style={{ background: 'rgba(4,8,20,.5)', opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none', backdropFilter: open ? 'blur(2px)' : 'none' }} />
      {/* 우측 슬라이드오버 (모바일=전체폭) */}
      <aside role="dialog" aria-label="주문 패널" aria-hidden={!open} className="fixed right-0 top-0 z-[96] flex h-full w-full flex-col sm:w-[440px]" style={{ background: 'var(--ci-bg, #0a1024)', borderLeft: `1px solid ${LINE}`, boxShadow: '-20px 0 48px -24px rgba(0,0,0,.6)', transform: open ? 'translateX(0)' : 'translateX(100%)', transition: 'transform .26s cubic-bezier(.4,0,.2,1)' }}>
        {sel ? <>
          {/* 헤더 */}
          <div className="flex items-start justify-between gap-3 px-5 py-4" style={{ borderBottom: `1px solid ${LINE}` }}>
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded-[5px] px-2 py-[3px] text-[11px] font-bold tracking-[.08em]" style={{ background: 'rgba(91,157,255,.14)', color: '#cfe1ff', border: '1px solid rgba(91,157,255,.24)' }}>{sel.market || '—'}</span>
                <span className="font-mono text-[12px]" style={{ color: INK3 }}>{sel.symbol}</span>
              </div>
              <h2 className="truncate text-[19px] font-bold tracking-tight">{sel.name}</h2>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-[18px] font-semibold">{fmtPrice(sel, usdKrw)}</span>
                <span className="font-mono text-[13px] font-semibold" style={{ color: up ? UP : DOWN }}>{up ? '+' : ''}{sel.changeRate.toFixed(2)}%</span>
              </div>
            </div>
            <button onClick={onClose} aria-label="닫기" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ border: `1px solid ${LINE}`, color: INK2 }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            </button>
          </div>
          {/* 탭 */}
          <div className="flex items-center px-2" style={{ borderBottom: `1px solid ${LINE}` }}>
            {tabs.map(([k, l, badge]) => { const on = tab === k; return (
              <button key={k} onClick={() => setTab(k)} className="relative inline-flex items-center gap-1.5 px-4 py-3 text-[14px]" style={{ color: on ? 'var(--ci-ink0)' : INK2, fontWeight: on ? 700 : 500 }}>
                {l}{badge != null && badge > 0 && <span className="rounded-full px-[7px] py-0.5 text-[11px] font-bold" style={{ background: on ? 'rgba(91,157,255,.22)' : 'var(--ci-line)', color: on ? '#cfe1ff' : INK2 }}>{badge}</span>}
                {on && <span className="absolute bottom-[-1px] left-3 right-3 h-0.5 rounded" style={{ background: GLOW }} />}
              </button>); })}
          </div>
          {/* 본문 (스크롤) */}
          <div className="no-scrollbar flex-1 overflow-y-auto px-5 py-5">
            {tab === 'order' && <>
              <OrderTicket sel={sel} side={side} setSide={setSide} portfolio={portfolio} usdKrw={usdKrw} rtPrice={rtPrice} notify={notify} onPlaced={loadAccount} isVirt={isVirt} />
              <div className="mt-4"><Orderbook sel={sel} /></div>
            </>}
            {tab === 'pending' && <PendingOrders orders={orders} onCancel={handleCancel} />}
            {tab === 'alerts' && <AlertsPanel sel={sel} alerts={priceAlerts} usdKrw={usdKrw} onChanged={loadAccount} notify={notify} />}
          </div>
          {/* 하단 계좌 요약 */}
          <div className="flex items-center justify-between gap-3 px-5 py-3" style={{ borderTop: `1px solid ${LINE}`, background: 'var(--ci-card)' }}>
            <div className="flex items-baseline gap-1.5"><span className="text-[12px]" style={{ color: INK3 }}>현금</span><span className="font-mono text-[14px] font-semibold">{portfolio ? fmtKRW(portfolio.cashBalance) : '—'}</span></div>
            <div className="flex items-baseline gap-1.5"><span className="text-[12px]" style={{ color: INK3 }}>총자산</span><span className="font-mono text-[14px] font-semibold">{portfolio ? fmtKRW(portfolio.totalValue) : '—'}</span>{portfolio && <span className="font-mono text-[12.5px] font-semibold" style={{ color: rate >= 0 ? UP : DOWN }}>{rate >= 0 ? '+' : ''}{rate.toFixed(2)}%</span>}</div>
          </div>
        </> : (
          <div className="flex flex-1 items-center justify-center px-6 text-center text-[14px]" style={{ color: INK3 }}>종목을 선택해주세요.</div>
        )}
      </aside>
    </>
  );
};

export default OrderPanel;
