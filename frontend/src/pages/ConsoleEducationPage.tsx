import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRoutePrefix } from '../hooks/useRoutePrefix';
import HelmShell from '../components/HelmShell';
import { tradeService, type Trade } from '../services/tradeService';
import { marketService } from '../services/marketService';
import { liveTradeService } from '../services/liveTradeService';
import { reviewService, type TradeReviewNote } from '../services/reviewService';
import { GLOSSARY } from '../components/TermTooltip';

/* ────────────────────────────────────────────────────────────
   ConsoleEducationPage — 학습 노트 (/virt/learn, VIRT 전용)
   ① 거래 복기(매매일지): 내 모의 체결을 FIFO로 매칭해 청산 손익·보유기간 산출 + 복기 체크리스트/메모(localStorage)
   ② 용어집: GLOSSARY 54개 용어를 카테고리·검색으로
   ③ 흔한 실수: 초보가 자주 빠지는 함정과 피하는 법
   ──────────────────────────────────────────────────────────── */

const UP = '#ef4d4d', DOWN = '#4d8aff';
const SONAR = 'var(--ci-sonar)';
const INK0 = 'var(--ci-ink0)', INK1 = 'var(--ci-ink1)', INK2 = 'var(--ci-ink2)', INK3 = 'var(--ci-ink3)';
const HAIR = 'var(--ci-line)', HAIR_S = 'var(--ci-line-strong)';
const CARD = 'var(--ci-card)';
const panel: React.CSSProperties = { background: 'var(--ci-panel)', border: `1px solid ${HAIR}`, borderRadius: 16, boxShadow: 'var(--ci-panel-shadow)' };
const fmtKRW = (n: number) => (n < 0 ? '-₩' : '₩') + Math.abs(Math.round(n || 0)).toLocaleString('ko-KR');
const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
const FEE = 0.001; // 체결 수수료율 — 백엔드 TradeRecord.COMMISSION_RATE와 동일(순손익 계산)
const isUsd = (at?: string) => at === 'US_STOCK' || at === 'ETF'; // USD 표기 자산
const isAutoMemo = (m?: string) => !!m && m.startsWith('라이브 자동매매'); // 자동매매 체결 식별(MockOrderGateway memo)
// memo = "라이브 자동매매:<deploymentId>:<symbol>:<side>:<barTime>" → 배포 ID 추출(전략명 매핑용)
const deployIdFromMemo = (m?: string) => (isAutoMemo(m) ? m!.split(':')[1] : undefined);
// 통화별 가격/금액 포맷(USD는 $, 그 외 ₩)
const fmtCur = (n: number, usd: boolean) =>
  usd ? (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : fmtKRW(n);
const fmtKRWCompact = (n: number) => // 큰 금액 축약(조/억/만)
  n >= 1e12 ? '₩' + (n / 1e12).toFixed(1) + '조' : n >= 1e8 ? '₩' + (n / 1e8).toFixed(1) + '억' : n >= 1e4 ? '₩' + Math.round(n / 1e4).toLocaleString('ko-KR') + '만' : '₩' + Math.round(n).toLocaleString('ko-KR');
const pctNice = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(1)); // 정수면 소수점 생략(반올림 일관)

// ── 용어집 카테고리 (키는 GLOSSARY 키와 동일) ───────────────────────────────
const TERM_CATEGORIES: { id: string; label: string; keys: string[] }[] = [
  { id: 'indicator', label: '보조지표', keys: ['이동평균선', 'EMA', 'RSI', 'MACD', '볼린저밴드', '스토캐스틱', 'ATR', '%B', '모멘텀', '다이버전스'] },
  { id: 'signal', label: '매매 신호', keys: ['골든크로스', '데드크로스', '과매수', '과매도', '변동성돌파'] },
  { id: 'strategy', label: '전략 유형', keys: ['추세추종', '역추세', '평균회귀', '차익거래', '김프', '리밸런싱', '듀얼모멘텀', '적립식', '배당재투자', 'BuyHold'] },
  { id: 'order', label: '주문·체결', keys: ['롱', '숏', '손절', '익절', '트레일링스탑', '슬리피지', '수수료', '피라미딩', '포지션사이징', '분할매수'] },
  { id: 'metric', label: '성과 지표', keys: ['승률', '샤프비율', 'MDD', 'CAGR', 'ProfitFactor', '소르티노', '평균보유', '변동성'] },
  { id: 'price', label: '가격 데이터', keys: ['종가', '시가', '고가', '저가', '전일종가', '전일고가', '전일저가', '수식조건'] },
  { id: 'basic', label: '기본 개념', keys: ['백테스트', '모의투자', '자동매매'] },
];

// ── 흔한 실수 ───────────────────────────────────────────────────────────
const MISTAKES: { icon: string; title: string; body: string; fix: string }[] = [
  { icon: '🎯', title: '과최적화 (오버피팅)', body: '백테스트 수익률만 보고 과거에 딱 맞는 파라미터를 찾는 함정. 과거엔 완벽해도 미래엔 무너지기 쉽습니다.', fix: '규칙은 단순하게, 검증은 기간을 나눠서(in/out-of-sample). 샤프·MDD도 함께 보고 수익률 하나만 좇지 않기.' },
  { icon: '🏃', title: 'FOMO 추격매수', body: '"지금 안 사면 놓친다"는 조급함에 급등 꼭대기에서 뇌동매매. 대부분 고점에 물립니다.', fix: '진입 가격·조건을 미리 정하고, 그 조건이 아니면 안 삽니다. 놓친 기회보다 잃지 않는 게 우선.' },
  { icon: '⏳', title: '손절 미루기', body: '손실을 확정하기 싫어 "회복하겠지" 하며 버티다 손실을 키우는 가장 흔한 실수.', fix: '매수와 동시에 손절가를 정해두기. 규칙(예: -7%)에 닿으면 감정 없이 실행 — 자동매매가 이걸 도와줍니다.' },
  { icon: '🥚', title: '몰빵 (집중투자)', body: '한 종목·한 방향에 자산을 전부 거는 것. 한 번의 실수로 회복 불능이 됩니다.', fix: '분산투자 + 포지션 사이징. 한 거래에 전체 자산의 일정 비율(예: 5~10%)만 거는 규칙.' },
  { icon: '💧', title: '물타기 함정', body: '떨어지는 종목을 "평단 낮추려" 계속 추가매수. 계획된 분할매수와 달리, 손실에 끌려 더 깊이 빠집니다.', fix: '추가매수는 사전 계획(분할매수 시나리오)이 있을 때만. 손실이 무서워서 사는 건 물타기 — 멈추기.' },
  { icon: '🔁', title: '잦은 매매 (오버트레이딩)', body: '신호도 없는데 손이 근질거려 사고팔기. 수수료·세금·감정만 소모되고 수익률은 깎입니다.', fix: '"신호가 있을 때만 거래한다"는 규칙. 거래 횟수가 아니라 규칙 준수율로 자신을 평가.' },
  { icon: '🪞', title: '확증편향', body: '이미 산 종목에 유리한 뉴스·차트만 보고, 반대 신호는 무시. 손실 위에 손실을 쌓습니다.', fix: '진입 전 "내가 틀렸다면?" 반대 시나리오를 먼저 적어보기. 손절 조건이 곧 그 답입니다.' },
  { icon: '✂️', title: '이익 짧게 손실 길게', body: '조금 오르면 못 참고 팔고(익절), 손실은 질질 끄는 처분효과. 손익비가 무너집니다.', fix: '손익비(예: 손절 -5% / 익절 +15%, 1:3)를 정하고 지키기. 이긴 거래를 끝까지 끌고 가는 연습.' },
];

const REVIEW_CHECKS = [
  '진입 이유가 명확했나요? (전략 규칙 기반)',
  '계획한 가격/조건에 청산했나요?',
  '손절·익절 규칙을 지켰나요?',
  '감정(FOMO·공포)에 휘둘리지 않았나요?',
];

// ── 나만의 매매 원칙(localStorage) — 복기 체크리스트와 연동 ───────────────────
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
// 복기 체크리스트 = 사용자가 정한 원칙(있으면) → 없으면 기본 4문항
const reviewChecklist = (): string[] => { const r = getUserRules(); return r.length ? r : REVIEW_CHECKS; };
// 복기 노트 로컬 미러(서버 저장 실패/오프라인 폴백) — 서버가 source of truth, 로컬은 안전망
const readReviewCache = (key: string): TradeReviewNote => {
  try { const r = JSON.parse(localStorage.getItem(key) || '{}'); return { checks: r.checks && !Array.isArray(r.checks) ? r.checks : {}, memo: typeof r.memo === 'string' ? r.memo : '' }; }
  catch { return { checks: {}, memo: '' }; }
};

// ── FIFO 청산 손익 ──────────────────────────────────────────────────────
interface ClosedTrade {
  id: string; stockCode: string; stockName: string; usd: boolean;
  qty: number; buyPrice: number; sellPrice: number;
  pnl: number;     // 순손익(수수료 차감), 네이티브 통화
  pnlKrw: number;  // 원화 환산(합산용) — USD 자산은 환율 적용
  pnlRate: number; // %, 순매수원가 기준(통화 무관)
  auto: boolean;   // 자동매매(전략)가 진입/청산한 거래인지
  strategy?: string; // 자동매매면 전략명(배포 매핑 해소 시)
  buyAt: string; sellAt: string; holdDays: number | null;
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
  [...trades].sort((a, b) => ts(a.executedAt) - ts(b.executedAt)).forEach((t) => {
    (byStock[t.stockCode] ||= []).push(t);
  });
  const closed: ClosedTrade[] = [];
  let droppedSells = 0; // 기간 밖 매수 등으로 짝짓지 못한 매도 수량
  for (const code of Object.keys(byStock)) {
    const lots: { qty: number; price: number; at: string; id: string; memo?: string }[] = []; // FIFO 매수 잔량
    for (const t of byStock[code]) {
      if (t.orderType === 'BUY') {
        lots.push({ qty: t.quantity, price: t.price, at: t.executedAt, id: t.id, memo: t.memo });
      } else {
        let remaining = t.quantity;
        const usd = isUsd(t.assetType);
        while (remaining > 0 && lots.length > 0) {
          const lot = lots[0];
          const matched = Math.min(remaining, lot.qty);
          // 순손익: 매수·매도 양다리 수수료(0.1%) 차감. 매수원가=가격*(1+FEE), 매도수취=가격*(1-FEE)
          const cost = lot.price * matched * (1 + FEE);
          const pnl = matched * (t.price * (1 - FEE) - lot.price * (1 + FEE));
          const bd = parseDate(lot.at), sd = parseDate(t.executedAt);
          const holdDays = bd && sd ? Math.max(0, Math.round((sd.getTime() - bd.getTime()) / 86400000)) : null;
          closed.push({
            id: `${lot.id}_${t.id}`, // 매수·매도 체결 ID 기반 — 거래가 추가돼도 안정(메모 보존)
            stockCode: code, stockName: t.stockName, usd,
            qty: matched, buyPrice: lot.price, sellPrice: t.price, pnl,
            pnlKrw: usd && usdKrw > 0 ? pnl * usdKrw : pnl,
            pnlRate: cost > 0 ? (pnl / cost) * 100 : 0,
            auto: isAutoMemo(lot.memo) || isAutoMemo(t.memo), // 진입/청산 중 하나라도 자동매매면 '자동'
            // 전략 귀속은 '진입(매수) 레그' 우선 — 진입을 결정한 전략이 그 거래의 주인
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

// ── 복기 카드 ───────────────────────────────────────────────────────────
const ReviewCard = ({ t, checklist, note }: { t: ClosedTrade; checklist: string[]; note?: TradeReviewNote }) => {
  const cacheKey = `wa_review_${t.id}`;
  const [open, setOpen] = useState(false);
  // 체크는 '원칙 텍스트'로 키잉 — 원칙을 추가/삭제/재정렬해도 체크가 엉뚱한 항목으로 옮겨가지 않음.
  // 초기값은 서버값(note) 우선, 없으면 로컬 미러 폴백.
  const [checks, setChecks] = useState<Record<string, boolean>>(() => (note ?? readReviewCache(cacheKey)).checks);
  const [memo, setMemo] = useState<string>(() => (note ?? readReviewCache(cacheKey)).memo);
  // 서버 저장(기기 간 동기화): 0.7s 디바운스 + 저장 직렬화(순서 보장) + 로컬 미러 + 언마운트 플러시
  const latest = useRef({ checks, memo });
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const saving = useRef<Promise<unknown>>(Promise.resolve());
  const flush = () => {
    if (!dirty.current) return;
    dirty.current = false;
    const snap = latest.current;
    // 직렬화 — 이전 저장 완료 후 다음 저장(네트워크 reorder로 옛값이 새값을 덮어쓰는 것 방지). 실패 시 dirty 복구→재시도
    saving.current = saving.current.then(() => reviewService.saveReview(t.id, snap)).catch(() => { dirty.current = true; });
  };
  const persist = (c: Record<string, boolean>, m: string) => {
    latest.current = { checks: c, memo: m };
    try { localStorage.setItem(cacheKey, JSON.stringify({ checks: c, memo: m })); } catch { /* ignore */ } // 로컬 미러(저장 실패해도 유실 안 됨)
    dirty.current = true;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 700);
  };
  useEffect(() => () => { clearTimeout(timer.current); flush(); }, []); // 언마운트: 타이머 정리 + 마지막 저장
  const dir = t.pnl > 0 ? 1 : t.pnl < 0 ? -1 : 0;
  const col = dir > 0 ? UP : dir < 0 ? DOWN : INK1;
  const badge = dir > 0 ? '수익' : dir < 0 ? '손실' : '본전';
  const price = (n: number) => (t.usd ? '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '₩' + Math.round(n).toLocaleString('ko-KR'));

  return (
    <div style={{ ...panel, borderRadius: 14 }} className="overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[14px] font-bold" style={{ color: INK0 }}>{t.stockName}</span>
            <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: dir > 0 ? 'rgba(239,77,77,.14)' : dir < 0 ? 'rgba(77,138,255,.14)' : 'rgba(255,255,255,.08)', color: col }}>{badge}</span>
            <span className="max-w-[120px] truncate rounded px-1.5 py-0.5 text-[10px] font-bold" style={t.auto ? { background: 'rgba(91,157,255,.14)', color: SONAR } : { background: 'rgba(255,255,255,.06)', color: INK2 }}>{t.auto ? (t.strategy || '자동') : '수동'}</span>
          </div>
          <div className="mt-1 font-mono text-[11.5px]" style={{ color: INK2 }}>
            {price(t.buyPrice)} → {price(t.sellPrice)} · {t.qty}주 · 보유 {t.holdDays == null ? '-' : t.holdDays === 0 ? '당일' : `${t.holdDays}일`} · {fmtDate(t.buyAt)}~{fmtDate(t.sellAt)}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[15px] font-bold" style={{ color: col }}>{fmtPct(t.pnlRate)}</div>
          <div className="font-mono text-[11.5px]" style={{ color: INK2 }}>{fmtCur(t.pnl, t.usd)}</div>
        </div>
        <button onClick={() => setOpen((o) => !o)} className="rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold" style={{ border: `1px solid ${HAIR_S}`, color: INK1 }}>
          {open ? '접기' : '복기'}
        </button>
      </div>
      {open && (
        <div className="border-t px-4 py-3.5" style={{ borderColor: HAIR, background: CARD }}>
          <div className="mb-2 text-[11px] font-semibold tracking-wide" style={{ color: INK2 }}>복기 체크리스트</div>
          <div className="flex flex-col gap-1.5">
            {checklist.map((c) => (
              <label key={c} className="flex cursor-pointer items-start gap-2 text-[12.5px]" style={{ color: INK1 }}>
                <input type="checkbox" checked={!!checks[c]} onChange={(e) => { const next = { ...checks, [c]: e.target.checked }; setChecks(next); persist(next, memo); }}
                  className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ accentColor: '#2c6fe6' }} />
                <span>{c}</span>
              </label>
            ))}
          </div>
          <textarea value={memo} onChange={(e) => { setMemo(e.target.value); persist(checks, e.target.value); }} rows={2} placeholder="이 거래에서 배운 점 / 다음에 고칠 점을 적어보세요"
            className="mt-3 w-full resize-none rounded-lg px-3 py-2 text-[12.5px] outline-none" style={{ border: `1px solid ${HAIR}`, background: 'var(--ci-panel)', color: INK0 }} />
        </div>
      )}
    </div>
  );
};

// ── 탭: 거래 복기 ───────────────────────────────────────────────────────
const ReviewTab = () => {
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
  const [filter, setFilter] = useState<string>('all'); // 'all' | '__manual' | <전략명>
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
  const [checklist, setChecklist] = useState(reviewChecklist); // 사용자 매매 원칙(있으면) → 복기 체크리스트로
  useEffect(() => { // 원칙 변경(다른 탭/같은 탭) 시 즉시 동기화 — 스테일 방지
    const refresh = () => setChecklist(reviewChecklist());
    window.addEventListener('storage', refresh);
    window.addEventListener('wa-rules-changed', refresh);
    return () => { window.removeEventListener('storage', refresh); window.removeEventListener('wa-rules-changed', refresh); };
  }, []);
  const stats = useMemo(() => {
    if (!view.length) return null;
    const wins = view.filter((c) => c.pnl > 0).length;
    const totalPnl = view.reduce((s, c) => s + c.pnlKrw, 0); // 원화 환산 합산(통화 혼합 방지)
    const avgRate = view.reduce((s, c) => s + c.pnlRate, 0) / view.length;
    const best = view.reduce((a, b) => (b.pnlRate > a.pnlRate ? b : a));
    const worst = view.reduce((a, b) => (b.pnlRate < a.pnlRate ? b : a));
    return { n: view.length, winRate: (wins / view.length) * 100, totalPnl, avgRate, best, worst };
  }, [view]);

  if (error) return (
    <div style={panel} className="px-6 py-16 text-center">
      <div className="text-[34px]">⚠️</div>
      <div className="mt-3 text-[15px] font-bold" style={{ color: INK0 }}>거래 내역을 불러오지 못했어요</div>
      <p className="mt-2 text-[13px]" style={{ color: INK2 }}>잠시 후 다시 시도해주세요.</p>
      <button onClick={load} className="mt-4 rounded-lg px-4 py-2 text-[13px] font-semibold" style={{ border: `1px solid ${HAIR_S}`, color: INK1 }}>다시 시도</button>
    </div>
  );
  if (trades === null) return <div className="py-20 text-center text-[13px]" style={{ color: INK2 }}>불러오는 중…</div>;
  if (!closed.length) return (
    <div style={panel} className="px-6 py-16 text-center">
      <div className="text-[34px]">📓</div>
      <div className="mt-3 text-[15px] font-bold" style={{ color: INK0 }}>아직 복기할 거래가 없어요</div>
      <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed" style={{ color: INK2 }}>거래 페이지에서 모의 매매를 하고 <b>매도로 청산</b>하면, 그 거래의 손익·보유기간이 여기 자동으로 정리됩니다. 종목별 FIFO로 매수–매도를 짝지어 계산해요.</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        <Chip on={filter === 'all'} onClick={() => setFilter('all')}>전체 {closed.length}</Chip>
        {groups.manual > 0 && <Chip on={filter === '__manual'} onClick={() => setFilter('__manual')}>수동 {groups.manual}</Chip>}
        {groups.strategies.map(([name, n]) => <Chip key={name} on={filter === name} onClick={() => setFilter(name)}>{name} {n}</Chip>)}
      </div>
      {!view.length ? (
        <div className="px-6 py-12 text-center text-[13px]" style={{ ...panel, color: INK2 }}>이 분류에 해당하는 거래가 없어요.</div>
      ) : (<>
        {stats && (
          <div style={panel} className="grid grid-cols-2 gap-px overflow-hidden md:grid-cols-4" >
            <Stat label="청산 거래" value={`${stats.n}건`} />
            <Stat label="승률" value={`${stats.winRate.toFixed(0)}%`} color={stats.winRate >= 50 ? UP : INK0} />
            <Stat label="평균 수익률" value={fmtPct(stats.avgRate)} color={stats.avgRate >= 0 ? UP : DOWN} />
            <Stat label="실현 손익 합계" value={fmtKRW(stats.totalPnl)} color={stats.totalPnl >= 0 ? UP : DOWN} />
          </div>
        )}
        {stats && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <MiniNote tone="up" label="최고의 거래" t={stats.best} />
            <MiniNote tone="down" label="최악의 거래" t={stats.worst} />
          </div>
        )}
        <div className="flex flex-col gap-1 text-[11.5px]" style={{ color: INK3 }}>
          <span>* 손익은 체결 수수료(0.1%)를 양방향 차감한 순손익입니다.</span>
          {hasUsd && <span>* 미국주식·ETF는 현재 환율로 원화 환산해 합산했어요(수익률·개별 손익은 해당 통화 기준).</span>}
          {droppedSells > 0 && <span>* 매수 기록이 조회 범위 밖이라 짝짓지 못한 매도 {droppedSells.toLocaleString()}주는 복기에서 제외됐어요.</span>}
        </div>
        <div className="rounded-xl px-4 py-3 text-[12px] leading-relaxed" style={{ background: 'rgba(91,157,255,.07)', border: `1px solid ${HAIR}`, color: INK1 }}>
          💡 <b>복기</b>는 결과(손익)보다 <b>과정(규칙을 지켰는가)</b>을 점검하는 거예요. 자동매매도 규칙대로 됐는지, 수동매매는 감정이 끼지 않았는지 함께 봐요.
        </div>
        <div className="flex flex-col gap-2.5">
          {view.map((t) => <ReviewCard key={t.id} t={t} checklist={checklist} note={reviewMap[t.id]} />)}
        </div>
      </>)}
    </div>
  );
};

const Stat = ({ label, value, color }: { label: string; value: string; color?: string }) => (
  <div className="px-4 py-3.5" style={{ background: 'var(--ci-panel)' }}>
    <div className="text-[11px]" style={{ color: INK2 }}>{label}</div>
    <div className="mt-1 font-mono text-[18px] font-bold" style={{ color: color || INK0 }}>{value}</div>
  </div>
);

const MiniNote = ({ tone, label, t }: { tone: 'up' | 'down'; label: string; t: ClosedTrade }) => {
  const col = tone === 'up' ? UP : DOWN;
  return (
    <div style={{ ...panel, borderRadius: 12 }} className="px-4 py-3">
      <div className="text-[11px] font-semibold" style={{ color: col }}>{label}</div>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <span className="truncate text-[13.5px] font-bold" style={{ color: INK0 }}>{t.stockName}</span>
        <span className="font-mono text-[15px] font-bold" style={{ color: col }}>{fmtPct(t.pnlRate)}</span>
      </div>
    </div>
  );
};

// ── 탭: 용어집 ──────────────────────────────────────────────────────────
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
      ...c,
      items: c.keys.filter((k) => GLOSSARY[k] && (!query || k.toLowerCase().includes(query) || GLOSSARY[k].title.toLowerCase().includes(query) || GLOSSARY[k].desc.toLowerCase().includes(query))),
    })).filter((c) => c.items.length);
  }, [cats, cat, query]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="용어 검색" placeholder="용어 검색 (예: 샤프, 손절, RSI)"
          className="flex-1 rounded-lg px-3.5 py-2.5 text-[13px] outline-none" style={{ border: `1px solid ${HAIR}`, background: CARD, color: INK0 }} />
        <div className="flex flex-wrap gap-1.5">
          <Chip on={cat === 'all'} onClick={() => setCat('all')}>전체</Chip>
          {cats.map((c) => <Chip key={c.id} on={cat === c.id} onClick={() => setCat(c.id)}>{c.label}</Chip>)}
        </div>
      </div>
      {list.length === 0 && <div className="py-16 text-center text-[13px]" style={{ color: INK2 }}>"{q}"에 해당하는 용어가 없어요.</div>}
      {list.map((c) => (
        <div key={c.id}>
          <div className="mb-2 flex items-center gap-2 px-0.5">
            <span className="text-[12px] font-bold tracking-wide" style={{ color: SONAR }}>{c.label}</span>
            <span className="text-[11px]" style={{ color: INK3 }}>{c.items.length}</span>
          </div>
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {c.items.map((k) => (
              <div key={k} style={{ ...panel, borderRadius: 12 }} className="px-4 py-3">
                <div className="text-[13.5px] font-bold" style={{ color: INK0 }}>{GLOSSARY[k].title}</div>
                <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: INK1 }}>{GLOSSARY[k].desc}</p>
                {GLOSSARY[k].example && <p className="mt-2 rounded-lg px-2.5 py-1.5 text-[11.5px] leading-relaxed" style={{ background: CARD, color: INK2 }}>{GLOSSARY[k].example}</p>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const Chip = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) => (
  <button onClick={onClick} className="rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors"
    style={on ? { background: 'rgba(91,157,255,.16)', color: SONAR, border: '1px solid rgba(91,157,255,.32)' } : { background: CARD, color: INK2, border: `1px solid ${HAIR}` }}>{children}</button>
);

// ── 탭: 흔한 실수 ───────────────────────────────────────────────────────
const MistakesTab = () => (
  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
    {MISTAKES.map((m) => (
      <div key={m.title} style={panel} className="p-4">
        <div className="flex items-center gap-2.5">
          <span className="text-[20px]">{m.icon}</span>
          <span className="text-[14.5px] font-bold" style={{ color: INK0 }}>{m.title}</span>
        </div>
        <p className="mt-2.5 text-[12.5px] leading-relaxed" style={{ color: INK1 }}>{m.body}</p>
        <div className="mt-3 rounded-lg px-3 py-2.5" style={{ background: 'rgba(91,157,255,.07)', border: `1px solid ${HAIR}` }}>
          <span className="text-[11px] font-bold" style={{ color: SONAR }}>✓ 피하는 법</span>
          <p className="mt-1 text-[12px] leading-relaxed" style={{ color: INK1 }}>{m.fix}</p>
        </div>
      </div>
    ))}
  </div>
);

// ── 탭: 투자 계산기 ───────────────────────────────────────────────────────
const Slider = ({ label, value, min, max, step, onChange, fmt }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt: (v: number) => string }) => (
  <div>
    <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
      <span style={{ color: INK1 }}>{label}</span>
      <span className="font-mono font-bold" style={{ color: INK0 }}>{fmt(value)}</span>
    </div>
    <input type="range" aria-label={label} aria-valuetext={fmt(value)} min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} className="w-full" style={{ accentColor: '#2c6fe6' }} />
  </div>
);
const MathCard = ({ title, desc, children }: { title: string; desc: string; children: ReactNode }) => (
  <div style={panel} className="p-5">
    <div className="text-[15px] font-bold" style={{ color: INK0 }}>{title}</div>
    <p className="mt-1 text-[12px] leading-relaxed" style={{ color: INK2 }}>{desc}</p>
    <div className="mt-4 flex flex-col gap-3.5">{children}</div>
  </div>
);
const MathTab = () => {
  const [seed, setSeed] = useState(1000);   // 만원
  const [monthly, setMonthly] = useState(2); // %/월
  const grow = (yrs: number) => seed * 10000 * Math.pow(1 + monthly / 100, yrs * 12);
  const [loss, setLoss] = useState(30);      // %
  const recover = loss < 100 ? (loss / (100 - loss)) * 100 : Infinity;
  const [winRate, setWinRate] = useState(40);
  const [stop, setStop] = useState(5);
  const [take, setTake] = useState(15);
  const ev = (winRate / 100) * take - (1 - winRate / 100) * stop;
  const rr = stop > 0 ? take / stop : 0;
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl px-4 py-3 text-[12.5px] leading-relaxed" style={{ background: 'rgba(91,157,255,.07)', border: `1px solid ${HAIR}`, color: INK1 }}>
        💡 숫자를 직접 움직여 보세요. 투자에서 가장 중요한 <b>복리·손실의 비대칭·손익비</b>를 몸으로 느낄 수 있어요.
      </div>
      <MathCard title="① 복리의 힘" desc="작은 수익도 꾸준히 쌓이면 눈덩이처럼 커집니다.">
        <Slider label="원금" value={seed} min={100} max={10000} step={100} onChange={setSeed} fmt={(v) => `${v.toLocaleString()}만원`} />
        <Slider label="월 수익률" value={monthly} min={0} max={5} step={0.5} onChange={setMonthly} fmt={(v) => `${v}%/월`} />
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg sm:grid-cols-4" style={{ background: HAIR }}>
          {[1, 3, 5, 10].map((y) => (
            <div key={y} className="px-3 py-2.5" style={{ background: 'var(--ci-panel)' }}>
              <div className="text-[11px]" style={{ color: INK2 }}>{y}년 후</div>
              <div className="font-mono text-[14px] font-bold" style={{ color: SONAR }}>{fmtKRWCompact(grow(y))}</div>
            </div>
          ))}
        </div>
      </MathCard>
      <MathCard title="② 손실의 비대칭" desc="잃으면 그만큼만 벌어선 본전이 안 됩니다 — '잃지 않는 것'이 먼저인 이유.">
        <Slider label="손실률" value={loss} min={5} max={90} step={5} onChange={setLoss} fmt={(v) => `-${v}%`} />
        <div className="rounded-lg px-4 py-3 text-center" style={{ background: CARD, border: `1px solid ${HAIR}` }}>
          <span className="text-[13px]" style={{ color: INK1 }}>-{loss}% 손실 → 본전까지 </span>
          <span className="font-mono text-[19px] font-bold" style={{ color: UP }}>+{recover === Infinity ? '∞' : pctNice(recover)}%</span>
          <span className="text-[13px]" style={{ color: INK1 }}> 필요</span>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[11px]" style={{ color: INK2 }}>
          {[10, 20, 30, 50, 70].map((l) => <span key={l} className="rounded px-2 py-1" style={{ background: CARD }}>-{l}% → +{pctNice((l / (100 - l)) * 100)}%</span>)}
        </div>
      </MathCard>
      <MathCard title="③ 승률보다 손익비" desc="승률이 낮아도 손익비가 좋으면 장기적으로 이깁니다.">
        <Slider label="승률" value={winRate} min={10} max={90} step={5} onChange={setWinRate} fmt={(v) => `${v}%`} />
        <Slider label="손절 폭" value={stop} min={1} max={30} step={1} onChange={setStop} fmt={(v) => `-${v}%`} />
        <Slider label="익절 폭" value={take} min={1} max={50} step={1} onChange={setTake} fmt={(v) => `+${v}%`} />
        <div className="rounded-lg px-4 py-3 text-center" style={{ background: CARD, border: `1px solid ${HAIR}` }}>
          <div className="text-[12px]" style={{ color: INK2 }}>손익비 1 : {rr.toFixed(1)} · 거래당 기대값</div>
          <div className="font-mono text-[20px] font-bold" style={{ color: ev >= 0 ? UP : DOWN }}>{ev >= 0 ? '+' : ''}{ev.toFixed(2)}%</div>
          <div className="mt-1 text-[12px]" style={{ color: ev >= 0 ? UP : DOWN }}>{ev >= 0 ? '장기적으로 이득이 기대돼요 👍' : '장기적으로 손실 — 손익비나 승률을 높이세요'}</div>
        </div>
      </MathCard>
    </div>
  );
};

// ── 탭: 나만의 매매 원칙 ─────────────────────────────────────────────────
const RulesTab = () => {
  const [rules, setRules] = useState<string[]>(getUserRules);
  const [draft, setDraft] = useState('');
  const save = (next: string[]) => { setRules(next); try { localStorage.setItem(RULES_KEY, JSON.stringify(next)); window.dispatchEvent(new Event('wa-rules-changed')); } catch { /* ignore */ } };
  const add = (text: string) => { const t = text.trim(); if (!t || rules.includes(t)) return; save([...rules, t]); setDraft(''); };
  const remove = (i: number) => save(rules.filter((_, j) => j !== i));
  const move = (i: number, dir: -1 | 1) => { const j = i + dir; if (j < 0 || j >= rules.length) return; const next = [...rules]; [next[i], next[j]] = [next[j], next[i]]; save(next); };
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl px-4 py-3 text-[12.5px] leading-relaxed" style={{ background: 'rgba(91,157,255,.07)', border: `1px solid ${HAIR}`, color: INK1 }}>
        💡 나만의 매매 원칙을 정해두면 <b>거래 복기 체크리스트가 이 원칙으로 바뀝니다</b>. 매매할 때마다 "내 원칙을 지켰나?"를 점검하세요.
      </div>
      <div className="flex gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(draft); }}
          aria-label="매매 원칙 입력" placeholder="원칙 입력 후 Enter (예: 손절가는 진입 시 미리 정한다)" className="flex-1 rounded-lg px-3.5 py-2.5 text-[13px] outline-none" style={{ border: `1px solid ${HAIR}`, background: CARD, color: INK0 }} />
        <button onClick={() => add(draft)} className="rounded-lg px-4 text-[13px] font-bold text-white" style={{ background: 'linear-gradient(180deg,#4d8aff,#2c6fe6)' }}>추가</button>
      </div>
      {rules.length === 0 ? (
        <div className="px-6 py-10 text-center text-[13px]" style={{ ...panel, color: INK2 }}>아직 등록한 원칙이 없어요. 아래 추천에서 골라 담거나 직접 적어보세요.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {rules.map((r, i) => (
            <div key={i} style={{ ...panel, borderRadius: 12 }} className="flex items-center gap-3 px-4 py-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-mono text-[12px] font-bold" style={{ background: 'rgba(91,157,255,.12)', color: SONAR }}>{i + 1}</span>
              <span className="flex-1 text-[13px]" style={{ color: INK0 }}>{r}</span>
              <div className="flex shrink-0 flex-col">
                <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="위로 이동" className="text-[9px] leading-none transition-opacity disabled:opacity-25 hover:opacity-70" style={{ color: INK2 }}>▲</button>
                <button onClick={() => move(i, 1)} disabled={i === rules.length - 1} aria-label="아래로 이동" className="text-[9px] leading-none transition-opacity disabled:opacity-25 hover:opacity-70" style={{ color: INK2 }}>▼</button>
              </div>
              <button onClick={() => remove(i)} className="shrink-0 text-[12px] transition-colors hover:opacity-70" style={{ color: INK3 }}>삭제</button>
            </div>
          ))}
        </div>
      )}
      <div>
        <div className="mb-2 text-[12px] font-bold" style={{ color: SONAR }}>추천 원칙 — 눌러서 담기</div>
        <div className="flex flex-col gap-1.5">
          {STARTER_RULES.filter((s) => !rules.includes(s)).map((s) => (
            <button key={s} onClick={() => add(s)} className="rounded-lg px-3.5 py-2.5 text-left text-[12.5px] transition-colors hover:opacity-80" style={{ background: CARD, border: `1px solid ${HAIR}`, color: INK1 }}>+ {s}</button>
          ))}
          {STARTER_RULES.every((s) => rules.includes(s)) && <span className="text-[12px]" style={{ color: INK3 }}>추천 원칙을 모두 담았어요 👍</span>}
        </div>
      </div>
    </div>
  );
};

// ── 페이지 ──────────────────────────────────────────────────────────────
const TABS = [
  { id: 'review', label: '거래 복기' },
  { id: 'rules', label: '매매 원칙' },
  { id: 'glossary', label: '용어집' },
  { id: 'mistakes', label: '흔한 실수' },
  { id: 'math', label: '투자 계산기' },
] as const;

const ConsoleEducationPage = () => {
  const { session } = useAuth();
  const { isVirt } = useRoutePrefix();
  const userName = session?.user?.email ? session.user.email.split('@')[0] : '항해사';
  const [tab, setTab] = useState<'review' | 'rules' | 'glossary' | 'mistakes' | 'math'>('review');
  // 모바일(탭바 가로 스크롤)에서 선택한 탭이 화면 밖이면 가운데로 스크롤
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  useEffect(() => { tabRefs.current[tab]?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); }, [tab]);

  return (
    <HelmShell active="edu" virt={isVirt} userName={userName} session="학습 노트">
      <div className="mx-auto w-full max-w-[1080px] px-5 py-6 md:px-8">
        <div className="mb-5">
          <h1 className="text-[26px] font-bold tracking-tight" style={{ color: INK0 }}>학습 노트</h1>
          <p className="mt-1.5 text-[13.5px]" style={{ color: INK1 }}>모의 매매를 <b>복기</b>하고, 나만의 원칙·용어·투자 계산기로 실력을 다져보세요.</p>
        </div>

        <div className="mb-5 flex gap-1 overflow-x-auto" style={{ borderBottom: `1px solid ${HAIR}` }}>
          {TABS.map((t) => (
            <button key={t.id} ref={(el) => { tabRefs.current[t.id] = el; }} onClick={() => setTab(t.id)} className="relative whitespace-nowrap px-4 py-3 text-[14px] transition-colors"
              style={{ color: tab === t.id ? INK0 : INK2, fontWeight: tab === t.id ? 700 : 500 }}>
              {t.label}
              {tab === t.id && <span className="absolute -bottom-px left-3 right-3 h-0.5 rounded" style={{ background: SONAR }} />}
            </button>
          ))}
        </div>

        {tab === 'review' && <ReviewTab />}
        {tab === 'rules' && <RulesTab />}
        {tab === 'glossary' && <GlossaryTab />}
        {tab === 'mistakes' && <MistakesTab />}
        {tab === 'math' && <MathTab />}
      </div>
    </HelmShell>
  );
};

export default ConsoleEducationPage;
