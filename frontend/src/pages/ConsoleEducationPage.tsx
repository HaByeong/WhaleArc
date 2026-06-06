import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRoutePrefix } from '../hooks/useRoutePrefix';
import HelmShell from '../components/HelmShell';
import { tradeService, type Trade } from '../services/tradeService';
import { marketService } from '../services/marketService';
import { GLOSSARY } from '../components/TermTooltip';

/* ────────────────────────────────────────────────────────────
   ConsoleEducationPage — 학습 노트 (/virt/learn, VIRT 전용)
   ① 거래 복기(매매일지): 내 모의 체결을 FIFO로 매칭해 청산 손익·보유기간 산출 + 복기 체크리스트/메모(localStorage)
   ② 용어집: GLOSSARY 54개 용어를 카테고리·검색으로
   ③ 실수 도감: 초보가 자주 빠지는 함정과 피하는 법
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
// 통화별 가격/금액 포맷(USD는 $, 그 외 ₩)
const fmtCur = (n: number, usd: boolean) =>
  usd ? (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : fmtKRW(n);

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

// ── 실수 도감 ───────────────────────────────────────────────────────────
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

// ── FIFO 청산 손익 ──────────────────────────────────────────────────────
interface ClosedTrade {
  id: string; stockCode: string; stockName: string; usd: boolean;
  qty: number; buyPrice: number; sellPrice: number;
  pnl: number;     // 순손익(수수료 차감), 네이티브 통화
  pnlKrw: number;  // 원화 환산(합산용) — USD 자산은 환율 적용
  pnlRate: number; // %, 순매수원가 기준(통화 무관)
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

function buildClosedTrades(trades: Trade[], usdKrw: number): { closed: ClosedTrade[]; droppedSells: number } {
  const byStock: Record<string, Trade[]> = {};
  [...trades].sort((a, b) => ts(a.executedAt) - ts(b.executedAt)).forEach((t) => {
    (byStock[t.stockCode] ||= []).push(t);
  });
  const closed: ClosedTrade[] = [];
  let droppedSells = 0; // 기간 밖 매수 등으로 짝짓지 못한 매도 수량
  for (const code of Object.keys(byStock)) {
    const lots: { qty: number; price: number; at: string; id: string }[] = []; // FIFO 매수 잔량
    for (const t of byStock[code]) {
      if (t.orderType === 'BUY') {
        lots.push({ qty: t.quantity, price: t.price, at: t.executedAt, id: t.id });
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
const ReviewCard = ({ t }: { t: ClosedTrade }) => {
  const storeKey = `wa_review_${t.id}`;
  const [open, setOpen] = useState(false);
  const [checks, setChecks] = useState<boolean[]>(() => {
    try { const r = JSON.parse(localStorage.getItem(storeKey) || '{}'); return Array.isArray(r.checks) ? r.checks : Array(REVIEW_CHECKS.length).fill(false); }
    catch { return Array(REVIEW_CHECKS.length).fill(false); }
  });
  const [memo, setMemo] = useState<string>(() => {
    try { return JSON.parse(localStorage.getItem(storeKey) || '{}').memo || ''; } catch { return ''; }
  });
  const persist = (c: boolean[], m: string) => { try { localStorage.setItem(storeKey, JSON.stringify({ checks: c, memo: m })); } catch { /* ignore */ } };
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
            {REVIEW_CHECKS.map((c, i) => (
              <label key={i} className="flex cursor-pointer items-start gap-2 text-[12.5px]" style={{ color: INK1 }}>
                <input type="checkbox" checked={checks[i]} onChange={(e) => { const next = checks.map((v, j) => (j === i ? e.target.checked : v)); setChecks(next); persist(next, memo); }}
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
  const [error, setError] = useState(false);
  const load = () => {
    setError(false); setTrades(null);
    Promise.all([tradeService.getTrades(), marketService.getExchangeRate().catch(() => null)])
      .then(([t, fx]) => { if (fx?.usdKrw) setUsdKrw(fx.usdKrw); setTrades(Array.isArray(t) ? t : []); })
      .catch(() => setError(true));
  };
  useEffect(load, []);
  const { closed, droppedSells } = useMemo(() => (trades ? buildClosedTrades(trades, usdKrw) : { closed: [], droppedSells: 0 }), [trades, usdKrw]);
  const hasUsd = useMemo(() => closed.some((c) => c.usd), [closed]);
  const stats = useMemo(() => {
    if (!closed.length) return null;
    const wins = closed.filter((c) => c.pnl > 0).length;
    const totalPnl = closed.reduce((s, c) => s + c.pnlKrw, 0); // 원화 환산 합산(통화 혼합 방지)
    const avgRate = closed.reduce((s, c) => s + c.pnlRate, 0) / closed.length;
    const best = closed.reduce((a, b) => (b.pnlRate > a.pnlRate ? b : a));
    const worst = closed.reduce((a, b) => (b.pnlRate < a.pnlRate ? b : a));
    return { n: closed.length, winRate: (wins / closed.length) * 100, totalPnl, avgRate, best, worst };
  }, [closed]);

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
        💡 <b>복기</b>는 결과(손익)보다 <b>과정(규칙을 지켰는가)</b>을 점검하는 거예요. 이긴 거래도 운이었는지, 진 거래도 규칙대로였는지 체크해보세요.
      </div>
      <div className="flex flex-col gap-2.5">
        {closed.map((t) => <ReviewCard key={t.id} t={t} />)}
      </div>
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
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="용어 검색 (예: 샤프, 손절, RSI)"
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

// ── 탭: 실수 도감 ───────────────────────────────────────────────────────
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

// ── 페이지 ──────────────────────────────────────────────────────────────
const TABS = [
  { id: 'review', label: '거래 복기', desc: '내 모의 매매를 청산 손익으로 복기' },
  { id: 'glossary', label: '용어집', desc: '투자 용어 54개를 한눈에' },
  { id: 'mistakes', label: '실수 도감', desc: '자주 빠지는 함정과 피하는 법' },
] as const;

const ConsoleEducationPage = () => {
  const { session } = useAuth();
  const { isVirt } = useRoutePrefix();
  const userName = session?.user?.email ? session.user.email.split('@')[0] : '항해사';
  const [tab, setTab] = useState<'review' | 'glossary' | 'mistakes'>('review');

  return (
    <HelmShell active="edu" virt={isVirt} userName={userName} session="학습 노트">
      <div className="mx-auto w-full max-w-[1080px] px-5 py-6 md:px-8">
        <div className="mb-5">
          <h1 className="text-[26px] font-bold tracking-tight" style={{ color: INK0 }}>학습 노트</h1>
          <p className="mt-1.5 text-[13.5px]" style={{ color: INK1 }}>모의 매매를 <b>복기</b>하고, 용어와 흔한 실수를 익히며 실력을 다져보세요.</p>
        </div>

        <div className="mb-5 flex gap-1.5 overflow-x-auto rounded-xl p-1" style={{ background: CARD, border: `1px solid ${HAIR}` }}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className="flex-1 whitespace-nowrap rounded-lg px-4 py-2.5 text-[13.5px] font-semibold transition-colors"
              style={tab === t.id ? { background: 'var(--ci-panel)', color: INK0, boxShadow: 'var(--ci-panel-shadow)' } : { color: INK2 }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'review' && <ReviewTab />}
        {tab === 'glossary' && <GlossaryTab />}
        {tab === 'mistakes' && <MistakesTab />}
      </div>
    </HelmShell>
  );
};

export default ConsoleEducationPage;
