import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRoutePrefix, useVirtNavigate } from '../hooks/useRoutePrefix';
import HelmShell from '../components/HelmShell';
import EmptyState from '../components/EmptyState';
import { tradeService, type Trade } from '../services/tradeService';
import { marketService } from '../services/marketService';
import { liveTradeService } from '../services/liveTradeService';
import { reviewService, type TradeReviewNote } from '../services/reviewService';
import { GLOSSARY } from '../components/TermTooltip';

/* ────────────────────────────────────────────────────────────
   ConsoleEducationPage — 학습 노트 (/virt/learn, VIRT 전용) · 5탭
   디자인: 바다 테마 목업(note-app.jsx) 포팅 + 기존 실데이터/로직 전부 보존
   ① 거래 복기(FIFO 청산손익+체크리스트/메모 영속) ② 매매 원칙(localStorage)
   ③ 용어집(GLOSSARY+카테고리) ④ 흔한 실수(+유리병 편지) ⑤ 투자 계산기 7종
   ──────────────────────────────────────────────────────────── */

const UP = '#ef4d4d', DOWN = '#4d8aff', COMPASS = '#f5d061', GREEN = '#35e0c8', ACCENT = '#2c6fe6';
const SONAR = 'var(--ci-sonar)', SONAR_DIM = 'var(--ci-sonar-dim)';
const INK0 = 'var(--ci-ink0)', INK1 = 'var(--ci-ink1)', INK2 = 'var(--ci-ink2)', INK3 = 'var(--ci-ink3)';
const HAIR = 'var(--ci-line)', HAIR_S = 'var(--ci-line-strong)';
const CARD = 'var(--ci-card)', ABYSS = 'var(--ci-inset)';
const panel: React.CSSProperties = { background: 'var(--ci-panel)', border: `1px solid ${HAIR}`, borderRadius: 16, boxShadow: 'var(--ci-panel-shadow)' };

// 유리병 편지 모티프 아이콘 — defs 내장 자체완결형(마음거울 Bottle 축약판)
const BottleIcon = ({ size = 26 }: { size?: number }) => (
  <svg width={size} height={size * 1.5} viewBox="0 0 64 96" fill="none" style={{ overflow: 'visible' }} aria-hidden>
    <defs>
      <linearGradient id="note-glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#cfe8ff" stopOpacity=".6" /><stop offset=".45" stopColor="#5b9dff" stopOpacity=".26" /><stop offset="1" stopColor="#2c6fe6" stopOpacity=".42" /></linearGradient>
      <linearGradient id="note-paper" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fbf3da" /><stop offset="1" stopColor="#e9d9ad" /></linearGradient>
      <linearGradient id="note-cork" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c79a64" /><stop offset="1" stopColor="#9a6f3f" /></linearGradient>
    </defs>
    <rect x="25" y="2.5" width="14" height="11.5" rx="3.2" fill="url(#note-cork)" />
    <rect x="25" y="2.5" width="14" height="3.4" rx="1.7" fill="#ddb784" opacity=".8" />
    <path d="M27 13 L27 25 Q15 29.5 15 50 L15 73 Q15 88 32 88 Q49 88 49 73 L49 50 Q49 29.5 37 25 L37 13 Z" fill="url(#note-glass)" stroke="rgba(180,215,255,.85)" strokeWidth="1.4" />
    <g transform="rotate(-9 32 64)">
      <rect x="21" y="50" width="22" height="26" rx="4" fill="url(#note-paper)" />
      <rect x="21" y="50" width="22" height="26" rx="4" fill="none" stroke="rgba(154,111,63,.35)" strokeWidth="1" />
      <path d="M25 57h14M25 61h14M25 65h10" stroke="rgba(120,86,48,.5)" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M28 70.5q4 2.4 8 0" stroke="#2c6fe6" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity=".7" />
    </g>
    <path d="M21 33 Q18 50 20 70" stroke="rgba(255,255,255,.7)" strokeWidth="2" strokeLinecap="round" fill="none" opacity=".6" />
    <circle cx="40" cy="40" r="2.4" fill="rgba(255,255,255,.55)" />
  </svg>
);

const fmtKRW = (n: number) => (n < 0 ? '-₩' : '₩') + Math.abs(Math.round(n || 0)).toLocaleString('ko-KR');
const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
const FEE = 0.001;
const isUsd = (at?: string) => at === 'US_STOCK' || at === 'ETF';
const isAutoMemo = (m?: string) => !!m && m.startsWith('라이브 자동매매');
const deployIdFromMemo = (m?: string) => (isAutoMemo(m) ? m!.split(':')[1] : undefined);
const fmtCur = (n: number, usd: boolean) =>
  usd ? (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : fmtKRW(n);
const fmtKRWCompact = (n: number) =>
  n >= 1e12 ? '₩' + (n / 1e12).toFixed(1) + '조' : n >= 1e8 ? '₩' + (n / 1e8).toFixed(1) + '억' : n >= 1e4 ? '₩' + Math.round(n / 1e4).toLocaleString('ko-KR') + '만' : '₩' + Math.round(n).toLocaleString('ko-KR');
const pctNice = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(1));

// ── 용어집 카테고리 (키는 GLOSSARY 키와 동일) + 카테고리별 컬러 ─────────────────
const TERM_CATEGORIES: { id: string; label: string; keys: string[] }[] = [
  { id: 'indicator', label: '보조지표', keys: ['이동평균선', 'EMA', 'RSI', 'MACD', '볼린저밴드', '스토캐스틱', 'ATR', '%B', '모멘텀', '다이버전스'] },
  { id: 'signal', label: '매매 신호', keys: ['골든크로스', '데드크로스', '과매수', '과매도', '변동성돌파'] },
  { id: 'strategy', label: '전략 유형', keys: ['추세추종', '역추세', '평균회귀', '차익거래', '김프', '리밸런싱', '듀얼모멘텀', '적립식', '배당재투자', 'BuyHold'] },
  { id: 'order', label: '주문·체결', keys: ['시장가', '지정가', '호가', '유동성', '롱', '숏', '손절', '익절', '트레일링스탑', '슬리피지', '수수료', '피라미딩', '포지션사이징', '분할매수'] },
  { id: 'metric', label: '성과 지표', keys: ['승률', '샤프비율', 'MDD', 'CAGR', 'ProfitFactor', '소르티노', '평균보유', '변동성'] },
  { id: 'price', label: '가격 데이터', keys: ['종가', '시가', '고가', '저가', '거래량', '전일종가', '전일고가', '전일저가', '수식조건'] },
  { id: 'basic', label: '기본 개념', keys: ['백테스트', '모의투자', '자동매매', 'ETF', '환율'] },
];
const CAT_COLOR: Record<string, string> = {
  indicator: '#5b9dff', signal: '#35e0c8', strategy: '#f5d061', order: '#b48cff',
  metric: '#5be0a0', price: '#ff9d5b', basic: '#9aa7c7', etc: '#9aa7c7',
};

const MISTAKES: { icon: string; title: string; body: string; fix: string }[] = [
  { icon: '🎯', title: '과최적화 (오버피팅)', body: '백테스트 수익률만 보고 과거에 딱 맞는 파라미터를 찾는 함정. 과거엔 완벽해도 미래엔 무너지기 쉽습니다.', fix: '규칙은 단순하게, 검증은 기간을 나눠서(in/out-of-sample). 샤프·MDD도 함께 보고 수익률 하나만 좇지 않기.' },
  { icon: '🏃', title: 'FOMO 추격매수', body: '"지금 안 사면 놓친다"는 조급함에 급등 꼭대기에서 뇌동매매. 대부분 고점에 물립니다.', fix: '진입 가격·조건을 미리 정하고, 그 조건이 아니면 안 삽니다. 놓친 기회보다 잃지 않는 게 우선.' },
  { icon: '⏳', title: '손절 미루기', body: '손실을 확정하기 싫어 "회복하겠지" 하며 버티다 손실을 키우는 가장 흔한 실수.', fix: '매수와 동시에 손절가를 정해두기. 규칙(예: -7%)에 닿으면 감정 없이 실행 — 자동매매가 이걸 도와줍니다.' },
  { icon: '🥚', title: '몰빵 (집중투자)', body: '한 종목·한 방향에 자산을 전부 거는 것. 한 번의 실수로 회복 불능이 됩니다.', fix: '분산투자 + 포지션 사이징. 한 거래에 전체 자산의 일정 비율(예: 5~10%)만 거는 규칙.' },
  { icon: '💧', title: '물타기 함정', body: '떨어지는 종목을 "평단 낮추려" 계속 추가매수. 계획된 분할매수와 달리, 손실에 끌려 더 깊이 빠집니다.', fix: '추가매수는 사전 계획(분할매수 시나리오)이 있을 때만. 손실이 무서워서 사는 건 물타기 — 멈추기.' },
  { icon: '🔁', title: '잦은 매매 (오버트레이딩)', body: '신호도 없는데 손이 근질거려 사고팔기. 수수료·세금·감정만 소모되고 수익률은 깎입니다.', fix: '"신호가 있을 때만 거래한다"는 규칙. 거래 횟수가 아니라 규칙 준수율로 자신을 평가.' },
  { icon: '🧭', title: '확증편향', body: '이미 산 종목에 유리한 뉴스·차트만 보고, 반대 신호는 무시. 손실 위에 손실을 쌓습니다.', fix: '진입 전 "내가 틀렸다면?" 반대 시나리오를 먼저 적어보기. 손절 조건이 곧 그 답입니다.' },
  { icon: '✂️', title: '이익 짧게 손실 길게', body: '조금 오르면 못 참고 팔고(익절), 손실은 질질 끄는 처분효과. 손익비가 무너집니다.', fix: '손익비(예: 손절 -5% / 익절 +15%, 1:3)를 정하고 지키기. 이긴 거래를 끝까지 끌고 가는 연습.' },
];

const REVIEW_CHECKS = [
  '진입 이유가 명확했나요? (전략 규칙 기반)',
  '계획한 가격/조건에 청산했나요?',
  '손절·익절 규칙을 지켰나요?',
  '감정(FOMO·공포)에 휘둘리지 않았나요?',
];

const RULES_KEY = 'wa_trading_rules';
const STARTER_RULES = [
  '진입은 전략 신호가 명확할 때만 — 감(感)으로 사지 않는다',
  '한 거래의 위험은 전체 자산의 2% 이내로 제한한다',
  '매수와 동시에 손절가를 정하고, 닿으면 무조건 실행한다',
  '급등 추격매수(FOMO)는 하지 않는다',
  '한 종목·한 방향에 몰빵하지 않고 분산한다',
  '계획에 없는 물타기(평단 낮추기)는 하지 않는다',
  '이익은 길게, 손실은 짧게 — 손익비를 지킨다',
];
const getUserRules = (): string[] => {
  try { const r = JSON.parse(localStorage.getItem(RULES_KEY) || 'null'); return Array.isArray(r) ? r.filter((x) => typeof x === 'string' && x.trim()) : []; }
  catch { return []; }
};
const reviewChecklist = (): string[] => { const r = getUserRules(); return r.length ? r : REVIEW_CHECKS; };
const readReviewCache = (key: string): TradeReviewNote => {
  try { const r = JSON.parse(localStorage.getItem(key) || '{}'); return { checks: r.checks && !Array.isArray(r.checks) ? r.checks : {}, memo: typeof r.memo === 'string' ? r.memo : '' }; }
  catch { return { checks: {}, memo: '' }; }
};

// ── FIFO 청산 손익 ──────────────────────────────────────────────────────
interface ClosedTrade {
  id: string; stockCode: string; stockName: string; usd: boolean;
  qty: number; buyPrice: number; sellPrice: number;
  pnl: number; pnlKrw: number; pnlRate: number;
  auto: boolean; strategy?: string; buyAt: string; sellAt: string; holdDays: number | null;
}
const parseDate = (s?: string): Date | null => {
  if (!s) return null;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  const m = s.replace(/\D/g, '');
  if (m.length >= 8) return new Date(+m.slice(0, 4), +m.slice(4, 6) - 1, +m.slice(6, 8), +(m.slice(8, 10) || 0), +(m.slice(10, 12) || 0));
  return null;
};
const ts = (s?: string) => parseDate(s)?.getTime() ?? 0;
function buildClosedTrades(trades: Trade[], usdKrw: number, deployMap: Map<string, string>): { closed: ClosedTrade[]; droppedSells: number } {
  const byStock: Record<string, Trade[]> = {};
  [...trades].sort((a, b) => ts(a.executedAt) - ts(b.executedAt)).forEach((t) => { (byStock[t.stockCode] ||= []).push(t); });
  const closed: ClosedTrade[] = [];
  let droppedSells = 0;
  for (const code of Object.keys(byStock)) {
    const lots: { qty: number; price: number; at: string; id: string; memo?: string }[] = [];
    for (const t of byStock[code]) {
      if (t.orderType === 'BUY') {
        lots.push({ qty: t.quantity, price: t.price, at: t.executedAt, id: t.id, memo: t.memo });
      } else {
        let remaining = t.quantity;
        const usd = isUsd(t.assetType);
        while (remaining > 0 && lots.length > 0) {
          const lot = lots[0];
          const matched = Math.min(remaining, lot.qty);
          const cost = lot.price * matched * (1 + FEE);
          const pnl = matched * (t.price * (1 - FEE) - lot.price * (1 + FEE));
          const bd = parseDate(lot.at), sd = parseDate(t.executedAt);
          const holdDays = bd && sd ? Math.max(0, Math.round((sd.getTime() - bd.getTime()) / 86400000)) : null;
          closed.push({
            id: `${lot.id}_${t.id}`, stockCode: code, stockName: t.stockName, usd,
            qty: matched, buyPrice: lot.price, sellPrice: t.price, pnl,
            pnlKrw: usd && usdKrw > 0 ? pnl * usdKrw : pnl,
            pnlRate: cost > 0 ? (pnl / cost) * 100 : 0,
            auto: isAutoMemo(lot.memo) || isAutoMemo(t.memo),
            strategy: deployMap.get(deployIdFromMemo(lot.memo) || '') || deployMap.get(deployIdFromMemo(t.memo) || ''),
            buyAt: lot.at, sellAt: t.executedAt, holdDays,
          });
          lot.qty -= matched; remaining -= matched;
          if (lot.qty <= 0) lots.shift();
        }
        droppedSells += remaining;
      }
    }
  }
  return { closed: closed.sort((a, b) => ts(b.sellAt) - ts(a.sellAt)), droppedSells };
}
const fmtDate = (s?: string) => { const d = parseDate(s); return d ? `${d.getMonth() + 1}.${d.getDate()}` : '-'; };

/* ── 디자인 공유 컴포넌트 ── */
const NoteWhale = ({ size = 48 }: { size?: number }) => (
  <span style={{ width: size, height: size, borderRadius: 14, flexShrink: 0, background: 'linear-gradient(150deg, rgba(91,157,255,.28), rgba(44,111,230,.1))', border: '1px solid rgba(91,157,255,.34)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.14)' }}>
    <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="none">
      <path d="M3 14 Q7 6 13 10 Q18 14 21 7" stroke="#9cc1ff" strokeWidth="1.8" strokeLinecap="round" fill="none" /><circle cx="13" cy="10" r="1.6" fill="#9cc1ff" />
    </svg>
  </span>
);
type TabIconKind = 'review' | 'rule' | 'book' | 'warn' | 'calc';
const TabIcon = ({ kind, c = 'currentColor' }: { kind: TabIconKind; c?: string }) => {
  const p: Record<TabIconKind, ReactNode> = {
    review: <><path d="M3.5 11a7.5 7.5 0 1 1 2.2 5.3" stroke={c} strokeWidth="1.5" fill="none" strokeLinecap="round" /><path d="M3.5 16v-3.4H7" stroke={c} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /><path d="M11 7.5V11l2.6 1.6" stroke={c} strokeWidth="1.5" strokeLinecap="round" /></>,
    rule: <><rect x="4" y="3.5" width="14" height="15" rx="2" stroke={c} strokeWidth="1.5" /><path d="M7.5 8l1.4 1.4 2.4-2.6M7.5 13l1.4 1.4 2.4-2.6" stroke={c} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /><path d="M13.5 8h2.2M13.5 13h2.2" stroke={c} strokeWidth="1.5" strokeLinecap="round" /></>,
    book: <path d="M4 5h5a3 3 0 0 1 2 1 3 3 0 0 1 2-1h5v11h-5a3 3 0 0 0-2 1 3 3 0 0 0-2-1H4z M11 6v11" stroke={c} strokeWidth="1.5" fill="none" strokeLinejoin="round" />,
    warn: <><path d="M11 3.5 19 17.5H3z" stroke={c} strokeWidth="1.5" fill="none" strokeLinejoin="round" /><path d="M11 8.5v4" stroke={c} strokeWidth="1.6" strokeLinecap="round" /><circle cx="11" cy="15.2" r="1" fill={c} /></>,
    calc: <><rect x="4.5" y="3" width="13" height="16" rx="2" stroke={c} strokeWidth="1.5" /><rect x="7" y="5.5" width="8" height="3" rx="1" stroke={c} strokeWidth="1.3" /><path d="M7.5 12h.01M11 12h.01M14.5 12h.01M7.5 15.5h.01M11 15.5h.01M14.5 15.5h.01" stroke={c} strokeWidth="1.8" strokeLinecap="round" /></>,
  };
  return <svg width="18" height="18" viewBox="0 0 22 22" fill="none">{p[kind]}</svg>;
};
const Tri = ({ up }: { up: boolean }) => (
  <span style={{ display: 'inline-block', width: 0, height: 0, marginRight: 3, verticalAlign: 'middle', borderLeft: '3.5px solid transparent', borderRight: '3.5px solid transparent', ...(up ? { borderBottom: '5px solid currentColor' } : { borderTop: '5px solid currentColor' }) }} />
);
const InfoNote = ({ children, tone = SONAR }: { children: ReactNode; tone?: string }) => (
  <div style={{ display: 'flex', gap: 11, padding: '14px 18px', borderRadius: 13, background: SONAR_DIM, border: `1px solid ${tone}33` }}>
    <span style={{ flexShrink: 0, color: tone, marginTop: 1 }}>
      <svg width="17" height="17" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7.2" stroke={tone} strokeWidth="1.5" /><path d="M9 8v4.5" stroke={tone} strokeWidth="1.6" strokeLinecap="round" /><circle cx="9" cy="5.6" r="1" fill={tone} /></svg>
    </span>
    <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.65, color: INK1 }}>{children}</p>
  </div>
);
const Chip = ({ on, onClick, color, children }: { on: boolean; onClick: () => void; color?: string; children: ReactNode }) => (
  <button onClick={onClick} className="rounded-full px-3.5 py-1.5 text-[13.5px] font-semibold transition-colors" style={{ whiteSpace: 'nowrap', ...(on ? { background: color ? `${color}1f` : SONAR_DIM, color: color || SONAR, border: `1px solid ${color ? color + '66' : 'rgba(91,157,255,.4)'}` } : { background: 'transparent', color: INK1, border: `1px solid ${HAIR}` }) }}>{children}</button>
);

// ── 복기 카드 (체크리스트·메모 영속 — 로직 보존) ───────────────────────────
const ReviewCard = ({ t, checklist, note }: { t: ClosedTrade; checklist: string[]; note?: TradeReviewNote }) => {
  const cacheKey = `wa_review_${t.id}`;
  const [open, setOpen] = useState(false);
  const [checks, setChecks] = useState<Record<string, boolean>>(() => (note ?? readReviewCache(cacheKey)).checks);
  const [memo, setMemo] = useState<string>(() => (note ?? readReviewCache(cacheKey)).memo);
  const latest = useRef({ checks, memo });
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const saving = useRef<Promise<unknown>>(Promise.resolve());
  const flush = () => {
    if (!dirty.current) return;
    dirty.current = false;
    const snap = latest.current;
    saving.current = saving.current.then(() => reviewService.saveReview(t.id, snap)).catch(() => {
      // 저장 실패 시 변경분을 되돌리고 일정 시간 후 자동 재시도 (네트워크 일시 장애 대비)
      dirty.current = true;
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, 4000);
    });
  };
  const persist = (c: Record<string, boolean>, m: string) => {
    latest.current = { checks: c, memo: m };
    try { localStorage.setItem(cacheKey, JSON.stringify({ checks: c, memo: m })); } catch { /* ignore */ }
    dirty.current = true;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 700);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- 언마운트 시 1회만 flush; flush를 deps에 넣으면 매 렌더마다 cleanup이 실행됨
  useEffect(() => () => { clearTimeout(timer.current); flush(); }, []);
  const dir = t.pnl > 0 ? 1 : t.pnl < 0 ? -1 : 0;
  const col = dir > 0 ? UP : dir < 0 ? DOWN : INK1;
  const badge = dir > 0 ? '수익' : dir < 0 ? '손실' : '본전';
  const price = (n: number) => (t.usd ? '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '₩' + Math.round(n).toLocaleString('ko-KR'));

  return (
    <div style={{ ...panel }} className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-4 px-5 py-4">
        <div className="min-w-0 flex-1" style={{ minWidth: 200 }}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[16px] font-bold" style={{ color: INK0 }}>{t.stockName}</span>
            <span className="rounded-[5px] px-1.5 py-0.5 text-[11.5px] font-bold" style={{ color: col, background: dir > 0 ? 'rgba(239,77,77,.12)' : dir < 0 ? 'rgba(77,138,255,.12)' : 'rgba(255,255,255,.08)', border: `1px solid ${col}33` }}>{badge}</span>
            <span className="max-w-[140px] truncate rounded-[5px] px-1.5 py-0.5 text-[11.5px] font-semibold" style={t.auto ? { background: SONAR_DIM, color: SONAR, border: '1px solid rgba(91,157,255,.28)' } : { background: 'rgba(255,255,255,.04)', color: INK2, border: `1px solid ${HAIR}` }}>{t.auto ? (t.strategy || '자동') : '수동'}</span>
          </div>
          <div className="mt-1.5 font-mono text-[12.5px]" style={{ color: INK2 }}>
            {price(t.buyPrice)} → {price(t.sellPrice)} · {t.qty}주 · 보유 {t.holdDays == null ? '-' : t.holdDays === 0 ? '당일' : `${t.holdDays}일`} · {fmtDate(t.buyAt)}~{fmtDate(t.sellAt)}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[17.5px] font-bold" style={{ color: col }}>{fmtPct(t.pnlRate)}</div>
          <div className="font-mono text-[12.5px]" style={{ color: INK2 }}>{fmtCur(t.pnl, t.usd)}</div>
        </div>
        <button onClick={() => setOpen((o) => !o)} className="shrink-0 rounded-[10px] px-4 py-2 text-[13.5px] font-semibold" style={{ color: SONAR, background: SONAR_DIM, border: '1px solid rgba(91,157,255,.3)' }}>{open ? '접기' : '복기'}</button>
      </div>
      {open && (
        <div className="border-t px-5 py-4" style={{ borderColor: HAIR, background: CARD }}>
          <div className="mb-2 text-[12px] font-semibold tracking-wide" style={{ color: INK2 }}>복기 체크리스트</div>
          <div className="flex flex-col gap-1.5">
            {checklist.map((c) => (
              <label key={c} className="flex cursor-pointer items-start gap-2 text-[13.5px]" style={{ color: INK1 }}>
                <input type="checkbox" checked={!!checks[c]} onChange={(e) => { const next = { ...checks, [c]: e.target.checked }; setChecks(next); persist(next, memo); }} className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ accentColor: ACCENT }} />
                <span>{c}</span>
              </label>
            ))}
          </div>
          <textarea value={memo} onChange={(e) => { setMemo(e.target.value); persist(checks, e.target.value); }} rows={2} placeholder="이 거래에서 배운 점 / 다음에 고칠 점을 적어보세요"
            className="mt-3 w-full resize-none rounded-lg px-3 py-2 text-[13.5px] outline-none" style={{ border: `1px solid ${HAIR}`, background: 'var(--ci-panel)', color: INK0 }} />
        </div>
      )}
    </div>
  );
};

// ── 탭 ① 거래 복기 ──────────────────────────────────────────────────────
const KPI = ({ label, value, tone }: { label: string; value: string; tone?: string }) => (
  <div style={{ padding: '4px 0' }}>
    <div style={{ fontSize: 11.5, color: INK2, marginBottom: 6 }}>{label}</div>
    <div className="font-mono" style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-.01em', color: tone || INK0 }}>{value}</div>
  </div>
);
const ReviewTab = () => {
  const go = useVirtNavigate();
  const [trades, setTrades] = useState<Trade[] | null>(null);
  const [usdKrw, setUsdKrw] = useState(0);
  const [deployMap, setDeployMap] = useState<Map<string, string>>(new Map());
  const [reviewMap, setReviewMap] = useState<Record<string, TradeReviewNote>>({});
  const [error, setError] = useState(false);
  const load = () => {
    setError(false); setTrades(null);
    Promise.all([
      tradeService.getTrades(),
      marketService.getExchangeRate().catch(() => null),
      liveTradeService.getDeployments().catch(() => []),
      reviewService.getReviews().catch(() => ({})),
    ]).then(([t, fx, deps, reviews]) => {
      if (fx?.usdKrw) setUsdKrw(fx.usdKrw);
      setDeployMap(new Map((Array.isArray(deps) ? deps : []).map((d) => [d.id, d.strategyName])));
      setReviewMap(reviews || {});
      setTrades(Array.isArray(t) ? t : []);
    }).catch(() => setError(true));
  };
  useEffect(load, []);
  const { closed, droppedSells } = useMemo(() => (trades ? buildClosedTrades(trades, usdKrw, deployMap) : { closed: [], droppedSells: 0 }), [trades, usdKrw, deployMap]);
  const [filter, setFilter] = useState<string>('all');
  const groups = useMemo(() => {
    const byStrat = new Map<string, number>(); let manual = 0;
    for (const c of closed) { if (c.auto) { const k = c.strategy || '자동(기타)'; byStrat.set(k, (byStrat.get(k) || 0) + 1); } else manual++; }
    return { manual, strategies: [...byStrat.entries()].sort((a, b) => b[1] - a[1]) };
  }, [closed]);
  const view = useMemo(() => {
    if (filter === 'all') return closed;
    if (filter === '__manual') return closed.filter((c) => !c.auto);
    return closed.filter((c) => c.auto && (c.strategy || '자동(기타)') === filter);
  }, [closed, filter]);
  const hasUsd = useMemo(() => view.some((c) => c.usd), [view]);
  const [checklist, setChecklist] = useState(reviewChecklist);
  useEffect(() => {
    const refresh = () => setChecklist(reviewChecklist());
    window.addEventListener('storage', refresh);
    window.addEventListener('wa-rules-changed', refresh);
    return () => { window.removeEventListener('storage', refresh); window.removeEventListener('wa-rules-changed', refresh); };
  }, []);
  const stats = useMemo(() => {
    if (!view.length) return null;
    const wins = view.filter((c) => c.pnl > 0).length;
    const totalPnl = view.reduce((s, c) => s + c.pnlKrw, 0);
    const avgRate = view.reduce((s, c) => s + c.pnlRate, 0) / view.length;
    const best = view.reduce((a, b) => (b.pnlRate > a.pnlRate ? b : a));
    const worst = view.reduce((a, b) => (b.pnlRate < a.pnlRate ? b : a));
    return { n: view.length, winRate: (wins / view.length) * 100, totalPnl, avgRate, best, worst };
  }, [view]);

  if (error) return (
    <div style={panel} className="px-6 py-16 text-center">
      <div className="text-[36.5px]">⚠️</div>
      <div className="mt-3 text-[16px] font-bold" style={{ color: INK0 }}>거래 내역을 불러오지 못했어요</div>
      <p className="mt-2 text-[14px]" style={{ color: INK2 }}>잠시 후 다시 시도해주세요.</p>
      <button onClick={load} className="mt-4 rounded-lg px-4 py-2 text-[14px] font-semibold" style={{ border: `1px solid ${HAIR_S}`, color: INK1 }}>다시 시도</button>
    </div>
  );
  if (trades === null) return <div className="py-20 text-center text-[14px]" style={{ color: INK2 }}>불러오는 중…</div>;
  if (!closed.length) return (
    <EmptyState
      kicker="FIRST REVIEW"
      title="아직 복기할 거래가 없어요"
      desc="첫 모의 거래를 마치면 여기서 수익률·승률·평균 손익을 돌아볼 수 있어요. 결과보다 ‘규칙을 지켰는가’를 점검하는 게 복기예요."
      ctaLabel="첫 모의 거래 하기" onCta={() => go('/market')}
      secondaryLabel="전략 둘러보기" onSecondary={() => go('/strategy')}
      preview={[
        { icon: 'card', label: '청산 거래 KPI', sub: '승률·평균 수익률·실현 손익' },
        { icon: 'swap', label: '최고·최악의 거래', sub: '가장 잘된·아쉬웠던 한 판' },
        { icon: 'note', label: '거래별 복기 카드', sub: '유리병 편지로 이어져요' },
      ]}
      note="모든 거래는 가상이에요. VIRT로 부담 없이 연습하세요."
    />
  );

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap gap-2">
        <Chip on={filter === 'all'} onClick={() => setFilter('all')}>전체 {closed.length}</Chip>
        {groups.manual > 0 && <Chip on={filter === '__manual'} onClick={() => setFilter('__manual')}>수동 {groups.manual}</Chip>}
        {groups.strategies.map(([name, n]) => <Chip key={name} on={filter === name} onClick={() => setFilter(name)}>{name} {n}</Chip>)}
      </div>
      {!view.length ? (
        <div className="px-6 py-12 text-center text-[14px]" style={{ ...panel, color: INK2 }}>이 분류에 해당하는 거래가 없어요.</div>
      ) : (<>
        {stats && (
          <div style={{ ...panel, padding: '22px 26px' }}>
            <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
              <KPI label="청산 거래" value={`${stats.n}건`} />
              <KPI label="승률" value={`${stats.winRate.toFixed(0)}%`} tone={stats.winRate >= 50 ? UP : INK0} />
              <KPI label="평균 수익률" value={fmtPct(stats.avgRate)} tone={stats.avgRate >= 0 ? UP : DOWN} />
              <KPI label="실현 손익 합계" value={fmtKRW(stats.totalPnl)} tone={stats.totalPnl >= 0 ? UP : DOWN} />
            </div>
          </div>
        )}
        {stats && (
          <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            {([['최고의 거래', stats.best, UP], ['최악의 거래', stats.worst, DOWN]] as const).map(([l, tr, tone]) => (
              <div key={l} style={{ padding: '16px 20px', borderRadius: 14, background: CARD, border: `1px solid ${HAIR}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10.5, letterSpacing: '.12em', color: tone, fontWeight: 700 }}>{l}</div>
                  <div className="truncate" style={{ fontSize: 15.5, fontWeight: 700, marginTop: 5, color: INK0 }}>{tr.stockName}</div>
                </div>
                <span className="font-mono" style={{ fontSize: 18, fontWeight: 700, color: tone, whiteSpace: 'nowrap' }}><Tri up={tr.pnlRate > 0} />{fmtPct(tr.pnlRate)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-1 text-[12.5px]" style={{ color: INK3 }}>
          <span>* 손익은 체결 수수료(0.1%)를 양방향 차감한 순손익입니다.</span>
          {hasUsd && <span>* 미국주식·ETF는 현재 환율로 원화 환산해 합산했어요(수익률·개별 손익은 해당 통화 기준).</span>}
          {droppedSells > 0 && <span>* 매수 기록이 조회 범위 밖이라 짝짓지 못한 매도 {droppedSells.toLocaleString()}주는 복기에서 제외됐어요.</span>}
        </div>
        <InfoNote><b style={{ color: INK0 }}>매매 돌아보기(복기)</b>는 결과(손익)보다 <b style={{ color: INK0 }}>과정(규칙을 지켰는가)</b>을 점검하는 거예요. 자동매매도 규칙대로 됐는지, 수동매매는 감정이 끼지 않았는지 함께 봐요.</InfoNote>
        <div className="flex flex-col gap-3">
          {view.map((t) => <ReviewCard key={t.id} t={t} checklist={checklist} note={reviewMap[t.id]} />)}
        </div>
      </>)}
    </div>
  );
};

// ── 탭 ② 매매 원칙 ──────────────────────────────────────────────────────
const RulesTab = () => {
  const [rules, setRules] = useState<string[]>(getUserRules);
  const [draft, setDraft] = useState('');
  const save = (next: string[]) => { setRules(next); try { localStorage.setItem(RULES_KEY, JSON.stringify(next)); window.dispatchEvent(new Event('wa-rules-changed')); } catch { /* ignore */ } };
  const add = (text: string) => { const t = text.trim(); if (!t || rules.includes(t)) return; save([...rules, t]); setDraft(''); };
  const remove = (i: number) => save(rules.filter((_, j) => j !== i));
  const move = (i: number, dir: -1 | 1) => { const j = i + dir; if (j < 0 || j >= rules.length) return; const next = [...rules]; [next[i], next[j]] = [next[j], next[i]]; save(next); };
  return (
    <div className="flex flex-col gap-[18px]">
      <InfoNote>나만의 <b style={{ color: INK0 }}>매매 원칙</b>을 정해두면 거래 복기 체크리스트가 이 원칙으로 바뀝니다. 매매할 때마다 "내 원칙을 지켰나?"를 점검하세요.</InfoNote>
      <div className="flex gap-2.5">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(draft); }} aria-label="매매 원칙 입력"
          placeholder="원칙 입력 후 Enter (예: 손절가는 진입 시 미리 정한다)" className="flex-1 rounded-[11px] px-4 py-3 text-[14.5px] outline-none" style={{ background: ABYSS, border: `1px solid ${HAIR_S}`, color: INK0 }} />
        <button onClick={() => add(draft)} className="rounded-[11px] px-6 text-[14.5px] font-bold text-white" style={{ background: `linear-gradient(180deg, ${SONAR}, ${ACCENT})`, boxShadow: '0 8px 18px -10px rgba(60,120,255,.6)' }}>추가</button>
      </div>
      <div style={{ ...panel, padding: rules.length ? 10 : '34px 24px' }}>
        {rules.length === 0 ? (
          <div className="text-center text-[14px]" style={{ color: INK2 }}>아직 등록한 원칙이 없어요. 아래 추천에서 골라 담거나 직접 적어보세요.</div>
        ) : (
          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {rules.map((r, i) => (
              <li key={r} className="flex items-center gap-3 rounded-[11px] px-4 py-3" style={{ background: CARD, border: `1px solid ${HAIR}` }}>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-mono text-[13px] font-bold" style={{ background: SONAR_DIM, color: SONAR }}>{i + 1}</span>
                <span className="flex-1 text-[14.5px]" style={{ color: INK0 }}>{r}</span>
                <div className="flex shrink-0 flex-col">
                  <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="위로 이동" className="text-[10px] leading-none transition-opacity disabled:opacity-25 hover:opacity-70" style={{ color: INK2 }}>▲</button>
                  <button onClick={() => move(i, 1)} disabled={i === rules.length - 1} aria-label="아래로 이동" className="text-[10px] leading-none transition-opacity disabled:opacity-25 hover:opacity-70" style={{ color: INK2 }}>▼</button>
                </div>
                <button onClick={() => remove(i)} aria-label="삭제" className="shrink-0 text-[13px] transition-colors hover:opacity-70" style={{ color: INK3 }}>삭제</button>
              </li>
            ))}
          </ol>
        )}
      </div>
      {STARTER_RULES.some((s) => !rules.includes(s)) && (
        <div>
          <div className="mb-2.5 text-[13.5px] font-bold" style={{ color: SONAR }}>추천 원칙 — 눌러서 담기</div>
          <div className="flex flex-col gap-2">
            {STARTER_RULES.filter((s) => !rules.includes(s)).map((s) => (
              <button key={s} onClick={() => add(s)} className="flex items-center gap-3 rounded-[11px] px-4 py-3 text-left text-[14.5px] transition-colors hover:opacity-90" style={{ color: INK1, background: 'var(--ci-card)', border: `1px solid ${HAIR}` }}>
                <span className="shrink-0 text-[17.5px] font-bold leading-none" style={{ color: SONAR }}>+</span>{s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── 탭 ③ 용어집 ─────────────────────────────────────────────────────────
const GlossaryTab = () => {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const assigned = useMemo(() => new Set(TERM_CATEGORIES.flatMap((c) => c.keys)), []);
  const cats = useMemo(() => {
    const extra = Object.keys(GLOSSARY).filter((k) => !assigned.has(k));
    return extra.length ? [...TERM_CATEGORIES, { id: 'etc', label: '기타', keys: extra }] : TERM_CATEGORIES;
  }, [assigned]);
  const query = q.trim().toLowerCase();
  const list = useMemo(() => {
    const src = cat === 'all' ? cats : cats.filter((c) => c.id === cat);
    return src.map((c) => ({
      ...c, color: CAT_COLOR[c.id] || SONAR,
      items: c.keys.filter((k) => GLOSSARY[k] && (!query || k.toLowerCase().includes(query) || GLOSSARY[k].title.toLowerCase().includes(query) || GLOSSARY[k].desc.toLowerCase().includes(query))),
    })).filter((c) => c.items.length);
  }, [cats, cat, query]);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }}><circle cx="7" cy="7" r="4.5" stroke={INK2} strokeWidth="1.5" /><path d="M10.5 10.5 14 14" stroke={INK2} strokeWidth="1.5" strokeLinecap="round" /></svg>
        <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="용어 검색" placeholder="용어 검색 (예: 샤프, 손절, RSI)" className="w-full rounded-[11px] py-3 pl-[42px] pr-4 text-[14.5px] outline-none" style={{ background: ABYSS, border: `1px solid ${HAIR_S}`, color: INK0 }} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Chip on={cat === 'all'} onClick={() => setCat('all')}>전체</Chip>
        {cats.map((c) => <Chip key={c.id} on={cat === c.id} color={CAT_COLOR[c.id]} onClick={() => setCat(c.id)}>{c.label}</Chip>)}
      </div>
      {list.length === 0 && <div className="py-16 text-center text-[14.5px]" style={{ color: INK2 }}>"{q}"에 해당하는 용어가 없어요.</div>}
      {list.map((c) => (
        <div key={c.id}>
          <div className="mb-3 flex items-center gap-2">
            <span style={{ width: 9, height: 9, borderRadius: 3, background: c.color }} />
            <span className="text-[14.5px] font-bold" style={{ color: c.color }}>{c.label}</span>
            <span className="text-[12.5px]" style={{ color: INK3 }}>{c.items.length}</span>
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))' }}>
            {c.items.map((k) => (
              <div key={k} className="relative overflow-hidden" style={{ padding: '16px 18px 16px 20px', borderRadius: 14, background: CARD, border: `1px solid ${HAIR}` }}>
                <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: c.color, opacity: .7 }} />
                <div className="text-[15.5px] font-bold" style={{ color: INK0, wordBreak: 'keep-all' }}>{GLOSSARY[k].title}</div>
                <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: INK1 }}>{GLOSSARY[k].desc}</p>
                {GLOSSARY[k].example && (
                  <div className="mt-2.5 rounded-[9px] px-3 py-2 text-[12.5px] leading-snug" style={{ background: ABYSS, border: `1px solid ${HAIR}`, color: INK2 }}>
                    <span style={{ color: c.color, fontWeight: 700 }}>예 </span>{GLOSSARY[k].example}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// ── 탭 ④ 흔한 실수 ──────────────────────────────────────────────────────
const MistakesTab = () => {
  const go = useVirtNavigate();
  return (
    <div className="flex flex-col gap-4">
      <button onClick={() => go('/mirror')} className="flex flex-wrap items-center gap-4 rounded-[16px] p-[18px_22px] text-left" style={{ padding: '18px 22px', background: 'linear-gradient(105deg, rgba(91,157,255,.14), rgba(91,157,255,.05))', border: '1px solid rgba(91,157,255,.3)' }}>
        <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[13px]" style={{ background: SONAR_DIM, border: '1px solid rgba(91,157,255,.3)' }}><BottleIcon size={22} /></span>
        <div className="min-w-0 flex-1" style={{ minWidth: 240 }}>
          <div className="text-[11.5px] font-bold tracking-[.18em]" style={{ color: SONAR }}>도구 · 유리병 편지</div>
          <div className="my-[4px] text-[17.5px] font-bold" style={{ color: INK0 }}>흔들린 순간을 데이터로 마주하기</div>
          <p className="m-0 text-[13.5px] leading-relaxed" style={{ color: INK1 }}>급락에 팔고 싶거나 급등에 사고 싶을 때, 그 충동을 막지 않고 유리병에 담아뒀다가 — 며칠 뒤 <b style={{ color: INK0 }}>충동대로 했다면 vs 참았다면</b>을 실제 숫자로 보여줘요. 위 실수들을 '내 데이터'로 마주하는 도구예요.</p>
        </div>
        <span className="shrink-0 rounded-[10px] px-4 py-2.5 text-[13.5px] font-bold text-white" style={{ background: `linear-gradient(180deg, ${SONAR}, ${ACCENT})`, boxShadow: '0 8px 18px -10px rgba(60,120,255,.6)' }}>열어보기 →</span>
      </button>
      <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))' }}>
        {MISTAKES.map((m) => (
          <div key={m.title} style={{ ...panel, padding: '18px 20px' }} className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5"><span className="text-[24px] leading-none">{m.icon}</span><span className="text-[16.5px] font-bold" style={{ color: INK0 }}>{m.title}</span></div>
            <p className="m-0 text-[14px] leading-relaxed" style={{ color: INK1 }}>{m.body}</p>
            <div className="rounded-[11px] px-3.5 py-3" style={{ background: 'rgba(53,224,200,.07)', border: '1px solid rgba(53,224,200,.22)' }}>
              <div className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-bold" style={{ color: GREEN }}>
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2.5 7.5 5.5 10.5 11.5 4" stroke={GREEN} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>피하는 법
              </div>
              <p className="m-0 text-[13.5px] leading-relaxed" style={{ color: INK1 }}>{m.fix}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── 탭 ⑤ 투자 계산기 (7종 — 로직 보존, 디자인만 교체) ──────────────────────
const Slider = ({ label, value, min, max, step, onChange, fmt }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt: (v: number) => string }) => (
  <div>
    <div className="mb-2 flex items-baseline justify-between">
      <span className="text-[13.5px]" style={{ color: INK1 }}>{label}</span>
      <span className="font-mono text-[16px] font-bold" style={{ color: SONAR }}>{fmt(value)}</span>
    </div>
    <input type="range" aria-label={label} aria-valuetext={fmt(value)} min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} className="w-full" style={{ accentColor: SONAR, cursor: 'pointer' }} />
  </div>
);
const CalcCard = ({ title, desc, children, insight }: { title: string; desc: ReactNode; children: ReactNode; insight: ReactNode }) => (
  <div style={{ ...panel, padding: '22px 24px' }}>
    <h3 className="text-[18.5px] font-bold" style={{ color: INK0 }}>{title}</h3>
    <p className="mb-[18px] mt-1.5 text-[13.5px] leading-relaxed" style={{ color: INK2 }}>{desc}</p>
    <div className="flex flex-col gap-3.5">{children}</div>
    <div className="mt-4 flex gap-2.5 rounded-[12px] px-4 py-3" style={{ background: 'rgba(245,208,97,.07)', border: '1px solid rgba(245,208,97,.22)' }}>
      <span className="shrink-0">💡</span>
      <p className="m-0 text-[13.5px] leading-relaxed" style={{ color: INK1 }}><b style={{ color: COMPASS }}>핵심 </b>{insight}</p>
    </div>
  </div>
);
const MathTab = () => {
  const [seed, setSeed] = useState(1000);
  const [monthly, setMonthly] = useState(2);
  const grow = (yrs: number) => seed * 10000 * Math.pow(1 + monthly / 100, yrs * 12);
  const mult10 = Math.pow(1 + monthly / 100, 120);
  const [loss, setLoss] = useState(30);
  const recover = loss < 100 ? (loss / (100 - loss)) * 100 : Infinity;
  const [winRate, setWinRate] = useState(40);
  const [stop, setStop] = useState(5);
  const [take, setTake] = useState(15);
  const ev = (winRate / 100) * take - (1 - winRate / 100) * stop;
  const rr = stop > 0 ? take / stop : 0;
  const [rate72, setRate72] = useState(6);
  const y72 = 72 / rate72; const yExact = Math.log(2) / Math.log(1 + rate72 / 100);
  const [feeRate, setFeeRate] = useState(7);
  const [feeCost, setFeeCost] = useState(1);
  const [feeYears, setFeeYears] = useState(30);
  const multNo = Math.pow(1 + feeRate / 100, feeYears);
  const multFee = Math.pow((1 + feeRate / 100) * (1 - feeCost / 100), feeYears);
  const feeEaten = multNo > 0 ? (1 - multFee / multNo) * 100 : 0;
  const [divCount, setDivCount] = useState(5);
  const [divCrash, setDivCrash] = useState(50);
  const divLoss = divCrash / divCount;
  const [psCapital, setPsCapital] = useState(1000);
  const [psRisk, setPsRisk] = useState(2);
  const [psStop, setPsStop] = useState(10);
  const psRiskAmt = (psCapital * psRisk) / 100;
  const psPosition = psStop > 0 ? psRiskAmt / (psStop / 100) : 0;
  const ResultBox = ({ children }: { children: ReactNode }) => (
    <div className="rounded-[12px] px-4 py-3 text-center" style={{ background: ABYSS, border: `1px solid ${HAIR}` }}>{children}</div>
  );
  return (
    <div className="flex flex-col gap-4">
      <InfoNote>숫자를 직접 움직여 보세요. <b style={{ color: INK0 }}>복리·손실·손익비·72법칙·수수료·분산·포지션</b>까지, 투자의 핵심 원리를 머리가 아니라 손으로 익힐 수 있어요.</InfoNote>
      <CalcCard title="① 복리의 힘"
        desc="복리는 '이자에 다시 이자가 붙는' 것이에요. 번 돈을 빼지 않고 다시 굴리면 원금이 점점 커지고, 시간이 갈수록 불어나는 속도가 빨라집니다. 그래서 투자는 일찍 시작해 오래 버틸수록 유리해요."
        insight={<>수익률 자체보다 <b style={{ color: INK0 }}>'꾸준함 × 시간'</b>이 복리의 진짜 힘이에요. 같은 월 수익률이라도 1년과 10년은 결과가 하늘과 땅 차이 — 월 수익률을 조금만 올려도 10년 뒤엔 크게 벌어집니다.</>}>
        <Slider label="원금" value={seed} min={100} max={10000} step={100} onChange={setSeed} fmt={(v) => `${v.toLocaleString()}만원`} />
        <Slider label="월 수익률" value={monthly} min={0} max={5} step={0.5} onChange={setMonthly} fmt={(v) => `${v}%/월`} />
        <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
          {[1, 3, 5, 10].map((y) => (
            <div key={y} className="rounded-[11px] px-3 py-2.5" style={{ background: ABYSS, border: `1px solid ${HAIR}` }}>
              <div className="text-[12px]" style={{ color: INK2 }}>{y}년 후</div>
              <div className="font-mono text-[15px] font-bold" style={{ color: SONAR }}>{fmtKRWCompact(grow(y))}</div>
            </div>
          ))}
        </div>
        <div className="text-center text-[13px]" style={{ color: INK2 }}>→ 10년 후엔 원금의 약 <b className="font-mono" style={{ color: SONAR }}>{mult10.toFixed(1)}배</b> ({monthly}%/월로 꾸준히 굴렸을 때)</div>
        <div className="text-[12px] leading-relaxed" style={{ color: INK3 }}>※ 실제 수익은 매달 들쭉날쭉하고 평균적으로 이보다 훨씬 낮아요(주식 장기평균 ≈ 연 7~10%, 월 1%도 안 됨). 이건 '꾸준한 복리가 얼마나 강한지'의 <b>원리</b>를 보여주는 예시이지, 기대 수익이 아닙니다.</div>
      </CalcCard>
      <CalcCard title="② 손실의 비대칭"
        desc="잃은 만큼만 다시 벌면 본전일 것 같지만 아니에요. -50%면 돈이 절반이 되고, 원래대로 돌아오려면 남은 절반으로 +100%(두 배)를 벌어야 합니다. 손실이 커질수록 회복에 필요한 수익률은 훨씬 가파르게 늘어나요."
        insight={<>큰 손실 한 번이 그동안 쌓은 수익을 통째로 날립니다. 그래서 <b style={{ color: INK0 }}>'크게 벌기'보다 '크게 잃지 않기'가 먼저</b> — 손절(미리 정한 선에서 끊기)과 분산투자가 중요한 이유예요.</>}>
        <Slider label="손실률" value={loss} min={5} max={90} step={5} onChange={setLoss} fmt={(v) => `-${v}%`} />
        <ResultBox><span className="text-[14px]" style={{ color: INK1 }}>-{loss}% 손실 → 본전까지 </span><span className="font-mono text-[24px] font-extrabold" style={{ color: UP }}>+{recover === Infinity ? '∞' : pctNice(recover)}%</span><span className="text-[14px]" style={{ color: INK1 }}> 필요</span></ResultBox>
        <div className="flex flex-wrap gap-2">
          {[10, 20, 30, 50, 70].map((l) => (
            <span key={l} className="font-mono text-[12.5px]" style={{ padding: '5px 10px', borderRadius: 8, background: l === loss ? 'rgba(239,77,77,.16)' : CARD, border: `1px solid ${l === loss ? 'rgba(239,77,77,.4)' : HAIR}`, color: l === loss ? UP : INK2 }}>-{l}% → +{pctNice((l / (100 - l)) * 100)}%</span>
          ))}
        </div>
      </CalcCard>
      <CalcCard title="③ 승률보다 손익비"
        desc="손익비는 '이길 때 버는 폭'을 '질 때 잃는 폭'으로 나눈 값이에요(예: +15% 벌고 -5% 잃으면 손익비 3). 기대값은 '한 번 거래할 때 평균 얼마를 버는지'를 뜻하고요. 자주 맞히는 것(승률)만큼, 맞힐 때 크게 벌고 틀릴 때 작게 잃는 게 중요합니다."
        insight={<>승률이 낮아도 손익비가 좋으면(이길 때 크게·질 때 작게) 장기적으로 이깁니다. 반대로 승률이 높아도 한 번의 큰 손실로 무너질 수 있어요. <b style={{ color: INK0 }}>'얼마나 자주 맞히나'보다 '맞힐 때 얼마 벌고 틀릴 때 얼마 잃나'</b>가 더 중요합니다.</>}>
        <Slider label="승률" value={winRate} min={10} max={90} step={5} onChange={setWinRate} fmt={(v) => `${v}%`} />
        <Slider label="손절 폭(질 때)" value={stop} min={1} max={30} step={1} onChange={setStop} fmt={(v) => `-${v}%`} />
        <Slider label="익절 폭(이길 때)" value={take} min={1} max={50} step={1} onChange={setTake} fmt={(v) => `+${v}%`} />
        <ResultBox>
          <div className="text-[13px]" style={{ color: INK2 }}>손익비 1 : {rr.toFixed(1)} · 거래당 기대값</div>
          <div className="font-mono text-[21.5px] font-bold" style={{ color: ev >= 0 ? UP : DOWN }}>{ev >= 0 ? '+' : ''}{ev.toFixed(2)}%</div>
          <div className="mt-1.5 text-[12.5px]" style={{ color: INK2 }}>10번 거래하면 약 {Math.round(winRate / 10)}번 이기고 {10 - Math.round(winRate / 10)}번 져도 → 평균 거래당 {ev >= 0 ? '+' : ''}{ev.toFixed(1)}%</div>
          <div className="mt-1.5 text-[13px] font-semibold" style={{ color: ev >= 0 ? UP : DOWN }}>{ev >= 0 ? '장기적으로 이득이 기대돼요 👍' : '장기적으로 손실 — 손익비나 승률을 높이세요'}</div>
        </ResultBox>
        <div className="text-[12px] leading-relaxed" style={{ color: INK3 }}>※ 기대값이 +라도 한 번에 너무 크게 걸면 운 나쁜 연속 손실로 파산할 수 있어요. 그래서 자산을 한 거래에 몰지 않고 나눠 거는 <b>포지션 사이징·분산</b>이 함께 중요합니다.</div>
      </CalcCard>
      <CalcCard title="④ 72의 법칙 (2배까지 몇 년?)"
        desc="내 돈이 2배 되는 데 몇 년 걸릴지 '72 ÷ 연수익률(%)'로 암산할 수 있어요. 연 6%면 약 12년, 연 12%면 약 6년 — 수익률이 2배면 2배 빨라집니다."
        insight={<>작은 수익률 차이가 큰 시간 차이를 만들어요. 연 3%와 6%는 2배 차이지만 2배 되는 시간은 <b style={{ color: INK0 }}>24년 vs 12년</b> — 그래서 비용을 줄이고 수익률을 조금이라도 높이는 게 복리에선 큽니다.</>}>
        <Slider label="연 수익률" value={rate72} min={1} max={20} step={1} onChange={setRate72} fmt={(v) => `${v}%/년`} />
        <ResultBox><span className="text-[14px]" style={{ color: INK1 }}>약 </span><span className="font-mono text-[21.5px] font-bold" style={{ color: SONAR }}>{y72.toFixed(1)}년</span><span className="text-[14px]" style={{ color: INK1 }}> 후 2배</span><div className="mt-1 text-[12.5px]" style={{ color: INK2 }}>정확히 계산하면 {yExact.toFixed(1)}년 — 72법칙이 거의 들어맞아요</div></ResultBox>
        <div className="text-[12px] leading-relaxed" style={{ color: INK3 }}>※ 빠른 암산용 근사값이에요. 실제 수익은 매년 달라 정확한 시점은 알 수 없습니다.</div>
      </CalcCard>
      <CalcCard title="⑤ 수수료가 복리를 갉아먹는다"
        desc="수수료·세금은 매년 수익에서 조금씩 떼어가요. '1%쯤이야' 싶지만 복리로 수십 년 쌓이면 최종 자산의 상당 부분을 먹습니다."
        insight={<>수익률을 좇기 전에 <b style={{ color: INK0 }}>'비용부터 낮추는 것'</b>이 가장 확실한 수익이에요. 수익률은 내 맘대로 못 정해도, 수수료·세금은 줄일 수 있으니까요.</>}>
        <Slider label="연 수익률" value={feeRate} min={3} max={12} step={1} onChange={setFeeRate} fmt={(v) => `${v}%/년`} />
        <Slider label="연 비용(수수료+세금)" value={feeCost} min={0} max={3} step={0.1} onChange={setFeeCost} fmt={(v) => `${v.toFixed(1)}%/년`} />
        <Slider label="기간" value={feeYears} min={5} max={40} step={5} onChange={setFeeYears} fmt={(v) => `${v}년`} />
        <ResultBox><div className="text-[13px]" style={{ color: INK2 }}>{feeYears}년 후, 연 {feeCost.toFixed(1)}% 비용이 먹는 몫</div><div className="font-mono text-[21.5px] font-bold" style={{ color: DOWN }}>최종 자산의 약 {feeEaten.toFixed(0)}%</div><div className="mt-1.5 text-[12.5px]" style={{ color: INK2 }}>1,000만원 기준 — 비용 없으면 {fmtKRWCompact(10000000 * multNo)}, 비용 있으면 {fmtKRWCompact(10000000 * multFee)}</div></ResultBox>
      </CalcCard>
      <CalcCard title="⑥ 분산투자 효과"
        desc="한 종목에 전부 넣으면 그 종목이 무너질 때 나도 무너져요. 여러 종목에 나눠 담으면 한 곳이 폭락해도 전체 타격은 그만큼 작아집니다."
        insight={<>분산은 '더 벌려고'가 아니라 <b style={{ color: INK0 }}>'한 번의 실수가 치명상이 되지 않게'</b> 지켜줘요. 투자는 살아남아야 다음 기회가 있습니다.</>}>
        <Slider label="나눠 담은 종목 수" value={divCount} min={1} max={20} step={1} onChange={setDivCount} fmt={(v) => `${v}개`} />
        <Slider label="한 종목 폭락률" value={divCrash} min={10} max={90} step={10} onChange={setDivCrash} fmt={(v) => `-${v}%`} />
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-[11px] px-3 py-3 text-center" style={{ background: ABYSS, border: `1px solid ${HAIR}` }}><div className="text-[12px]" style={{ color: INK2 }}>몰빵 (1종목)</div><div className="font-mono text-[18.5px] font-bold" style={{ color: DOWN }}>-{divCrash}%</div></div>
          <div className="rounded-[11px] px-3 py-3 text-center" style={{ background: ABYSS, border: `1px solid ${HAIR}` }}><div className="text-[12px]" style={{ color: INK2 }}>분산 ({divCount}종목)</div><div className="font-mono text-[18.5px] font-bold" style={{ color: divCount > 1 ? UP : DOWN }}>-{pctNice(divLoss)}%</div></div>
        </div>
        <div className="text-[12px] leading-relaxed" style={{ color: INK3 }}>※ '한 종목만 폭락하고 나머지는 그대로'일 때예요. 진짜 분산은 <b>같이 안 움직이는</b> 자산을 섞어야 효과가 커요 — 같은 업종·시장에 몰면 폭락 때 함께 빠집니다.</div>
      </CalcCard>
      <CalcCard title="⑦ 포지션 사이징 (얼마 살까?)"
        desc="'한 번에 최대로 잃어도 괜찮은 금액'을 먼저 정하고, 손절 폭에서 거꾸로 매수 금액을 계산해요. 그래야 한 번 틀려도 정한 만큼만 잃습니다."
        insight={<>이렇게 하면 손절에 걸려도 자산의 <b style={{ color: INK0 }}>'정한 만큼'</b>만 잃어요. 승률이 낮아도 파산하지 않고 살아남아 다음 기회를 잡는 비결입니다 (③·⑥과 한 세트).</>}>
        <Slider label="총자산" value={psCapital} min={100} max={10000} step={100} onChange={setPsCapital} fmt={(v) => `${v.toLocaleString()}만원`} />
        <Slider label="한 거래 최대 손실(위험)" value={psRisk} min={0.5} max={5} step={0.5} onChange={setPsRisk} fmt={(v) => `${v}%`} />
        <Slider label="손절 폭" value={psStop} min={2} max={30} step={1} onChange={setPsStop} fmt={(v) => `-${v}%`} />
        <ResultBox><div className="text-[13px]" style={{ color: INK2 }}>최대 손실 {fmtKRWCompact(psRiskAmt * 10000)} 이내로 잡으려면 → 매수</div><div className="font-mono text-[21.5px] font-bold" style={{ color: SONAR }}>{fmtKRWCompact(psPosition * 10000)}</div><div className="mt-1.5 text-[12.5px]" style={{ color: INK2 }}>{fmtKRWCompact(psPosition * 10000)} 사서 -{psStop}%에 손절하면 딱 {fmtKRWCompact(psRiskAmt * 10000)}만 손실</div></ResultBox>
      </CalcCard>
    </div>
  );
};

// ── 페이지 ──────────────────────────────────────────────────────────────
const TABS = [
  { id: 'review', label: '매매 돌아보기', icon: 'review' as TabIconKind },
  { id: 'rules', label: '매매 원칙', icon: 'rule' as TabIconKind },
  { id: 'glossary', label: '용어집', icon: 'book' as TabIconKind },
  { id: 'mistakes', label: '흔한 실수', icon: 'warn' as TabIconKind },
  { id: 'math', label: '투자 계산기', icon: 'calc' as TabIconKind },
] as const;
type TabId = (typeof TABS)[number]['id'];

const ConsoleEducationPage = () => {
  const { session } = useAuth();
  const { isVirt } = useRoutePrefix();
  const userName = session?.user?.email ? session.user.email.split('@')[0] : '항해사';
  const [params, setParams] = useSearchParams();
  const initialTab = (TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'review') as TabId;
  const [tab, setTab] = useState<TabId>(initialTab);
  const changeTab = (id: TabId) => {
    setTab(id);
    const next = new URLSearchParams(params);
    next.set('tab', id);
    setParams(next, { replace: true });
  };
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  useEffect(() => { tabRefs.current[tab]?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); }, [tab]);

  return (
    <HelmShell active="edu" virt={isVirt} userName={userName} session="학습 노트 · 모의투자">
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22, padding: '4px 0 40px' }}>
        {/* hero */}
        <div className="flex items-center gap-[15px]">
          <NoteWhale size={48} />
          <div>
            <h1 style={{ fontSize: 27, fontWeight: 800, letterSpacing: '-.02em', color: INK0 }}>학습 노트</h1>
            <p className="mt-[7px] text-[14.5px]" style={{ color: INK1 }}>모의 매매를 돌아보고, 나만의 원칙·용어·투자 계산기로 실력을 다져보세요.</p>
          </div>
        </div>

        {/* tab bar */}
        <div className="no-scrollbar flex gap-1 overflow-x-auto" style={{ padding: 4, borderRadius: 14, background: 'rgba(255,255,255,.04)', border: `1px solid ${HAIR}`, flexWrap: 'wrap' }}>
          {TABS.map((t) => {
            const on = t.id === tab;
            return (
              <button key={t.id} ref={(el) => { tabRefs.current[t.id] = el; }} onClick={() => changeTab(t.id)}
                className="inline-flex items-center justify-center gap-2 rounded-[10px]" style={{ flex: '1 1 auto', padding: '11px 16px', cursor: 'pointer', fontSize: 13.5, fontWeight: on ? 700 : 600, whiteSpace: 'nowrap', border: 0, color: on ? '#fff' : INK1, background: on ? `linear-gradient(180deg, ${SONAR}, ${ACCENT})` : 'transparent', boxShadow: on ? '0 8px 18px -10px rgba(60,120,255,.6)' : 'none' }}>
                <TabIcon kind={t.icon} />{t.label}
              </button>
            );
          })}
        </div>

        {/* content */}
        <div key={tab} style={{ animation: 'message-in .25s ease both' }}>
          {tab === 'review' && <ReviewTab />}
          {tab === 'rules' && <RulesTab />}
          {tab === 'glossary' && <GlossaryTab />}
          {tab === 'mistakes' && <MistakesTab />}
          {tab === 'math' && <MathTab />}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3" style={{ marginTop: 8, paddingTop: 18, borderTop: `1px solid ${HAIR}` }}>
          <span className="font-mono text-[12.5px]" style={{ color: INK3 }}>© 2026 WHALEARC · 학습 노트</span>
          <span className="text-[12.5px]" style={{ color: INK3 }}>Built quietly, beneath the surface.</span>
        </footer>
      </div>
    </HelmShell>
  );
};

export default ConsoleEducationPage;
