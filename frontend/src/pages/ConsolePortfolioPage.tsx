import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRoutePrefix } from '../hooks/useRoutePrefix';
import HelmShell from '../components/HelmShell';
import EmptyState from '../components/EmptyState';
import { tradeService, portfolioService, type Portfolio, type Holding, type Trade, type PortfolioSnapshot } from '../services/tradeService';
import { quantStoreService, type PurchasePerformance } from '../services/quantStoreService';
import { exchangeService, type ExchangeType, type ExchangeAccount, type ExchangePortfolio, type ExchangeSnapshot, type ExchangeTransaction } from '../services/exchangeService';
import ExchangeConnectModal from '../components/ExchangeConnectModal';
import apiClient from '../utils/api';
import { FALLBACK_USD_KRW } from '../utils/currency';
import { SONAR, UP, DOWN, won, CHART_COLORS, ASSET_ICON, isUsd, stockLikeOf, fmtQty, holdingName, panel, EXCHANGES, REAL_SRC_KEY } from '../components/console/format';
import { Panel, PanelHead, Tri, Toast, ConsoleFooter } from '../components/console/ui';

/* ────────────────────────────────────────────────────────────
   ConsolePortfolioPage — 포트폴리오(페이퍼/모의투자) 실데이터 배선
   tradeService.getPortfolio/getTrades + portfolioService.getHistory(추이)
   + quantStoreService.getMyPurchasesPerformance(항로) + 실 KOSPI 벤치마크.
   ※ 멀티거래소 실계좌는 대시보드(ConsoleDashboardPage) 책임 — 여기선 페이퍼만.
   ──────────────────────────────────────────────────────────── */

/* 색·포맷터·CHART_COLORS·ASSET_ICON·Panel/PanelHead/Tri/Toast·EXCHANGES는 components/console/ui.tsx 공용 모듈 사용 */
const fmtHoldingValue = (h: Holding) => (isUsd(h.assetType) ? '$' + h.marketValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : won(h.marketValue));
// 실계좌(ExchangeHolding) 단가/평가 표시: 해외주식 USD는 $, 그 외 ₩. (합계·도넛은 항상 KRW 환산)
const exMoney = (n: number, cur?: string) => cur === 'USD' ? '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : won(n);

// 자산 추이 기간 선택 (일/월/년) — 일=일별, 월·년=월별 다운샘플(조회 범위만 다름)
const RANGE_DAYS = { D: 30, M: 365, Y: 1825 } as const;
type TrendRange = keyof typeof RANGE_DAYS;
const RANGE_LABEL: Record<TrendRange, string> = { D: '일', M: '월', Y: '년' };
const RANGE_CAPTION: Record<TrendRange, string> = { D: '최근 30일 · 일별', M: '최근 1년 · 월별', Y: '전체 · 월별' };
// 월말(=각 YYYY-MM의 마지막) 스냅샷만 추림. date 오름차순 입력 전제(백엔드 OrderByDateAsc).
const downsampleByMonth = <T extends { date: string }>(snaps: T[]): T[] => {
  const m = new Map<string, T>();
  for (const s of snaps) m.set(s.date.slice(0, 7), s);
  return [...m.values()];
};
// 기간별 표시 시계열. 월/년은 월별 다운샘플하되, 아직 달이 부족하면(2개월 미만) 일별로 폴백해
// '데이터 모으는 중' 빈 상태가 과하게 뜨지 않게 — 가용 데이터는 항상 보여준다.
const trendSeries = <T extends { date: string }>(snaps: T[], range: TrendRange): T[] => {
  if (range === 'D') return snaps;
  const monthly = downsampleByMonth(snaps);
  return monthly.length >= 2 ? monthly : snaps;
};
// 실제 표시 시계열에 맞춘 캡션 — 월/년 선택이라도 월별 점이 2개 미만이면 일별로 폴백되므로
// 캡션도 '일별(데이터 모으는 중)'로 바꿔 표기와 실제 그래프를 일치시킨다.
const rangeCaption = <T extends { date: string }>(snaps: T[], range: TrendRange): string =>
  range !== 'D' && downsampleByMonth(snaps).length < 2 ? '일별 · 데이터 모으는 중' : RANGE_CAPTION[range];
// 자산 추이 시계열 + KOSPI 리베이스(시작값 기준) — 페이퍼·실계좌 공용.
// KOSPI는 포트폴리오 시작일 이전 마지막 종가를 기준점으로 잡고, 휴장일은 직전 종가로 채운다.
const buildTrendData = (points: { date: string; value: number }[], kospiHistory: { date: string; close: number }[]) => {
  if (points.length < 2) return null;
  const startValue = points[0].value || 1;
  const startDate = points[0].date;
  const portValue = points.map(p => p.value);
  const portPct = points.map(p => ((p.value - startValue) / startValue) * 100);
  let kospiValue: number[] | null = null, kospiPct: number[] | null = null;
  if (kospiHistory.length) {
    const sorted = [...kospiHistory].sort((a, b) => a.date.localeCompare(b.date));
    const kmap = new Map(sorted.map(k => [k.date, k.close]));
    let startClose = 0;
    for (const k of sorted) { if (k.date <= startDate) startClose = k.close; }
    if (!startClose) startClose = sorted[0].close;
    if (startClose) {
      kospiPct = points.map(p => {
        let c = kmap.get(p.date);
        if (c == null) { for (const k of sorted) { if (k.date <= p.date) c = k.close; } }
        if (c == null) c = startClose;
        return ((c - startClose) / startClose) * 100;
      });
      kospiValue = kospiPct.map(pc => startValue * (1 + pc / 100));
    }
  }
  return { dates: points.map(p => p.date), portValue, portPct, kospiValue, kospiPct };
};

// 스냅샷 시계열 기반 성과 지표(MDD·샤프·KOSPI 알파) — 페이퍼·실계좌 공용.
// 승률·보유기간 등 거래 기반 지표는 전체 체결 이력이 있는 페이퍼에서만 별도 계산.
const snapshotMetrics = (values: { date: string; value: number }[], kospiHistory: { date: string; close: number }[]) => {
  if (values.length < 2) return null;
  // MDD
  let peak = values[0].value, mdd = 0;
  for (const s of values) {
    if (s.value > peak) peak = s.value;
    const dd = peak > 0 ? (peak - s.value) / peak : 0;
    if (dd > mdd) mdd = dd;
  }
  // 일간 수익률 & Sharpe (무위험 수익률 3.5%/년, 연환산)
  const dailyRets: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const prev = values[i - 1].value;
    if (prev > 0) dailyRets.push((values[i].value - prev) / prev);
  }
  let sharpe: number | null = null;
  if (dailyRets.length >= 5) {
    const mean = dailyRets.reduce((a, b) => a + b, 0) / dailyRets.length;
    const variance = dailyRets.reduce((a, b) => a + (b - mean) ** 2, 0) / dailyRets.length;
    const stdev = Math.sqrt(variance);
    const dailyRf = 0.035 / 252;
    if (stdev > 0) sharpe = ((mean - dailyRf) / stdev) * Math.sqrt(252);
  }
  // Alpha vs KOSPI — 기간 수익률 차 (시작일 이전 마지막 종가 기준)
  let alpha: number | null = null;
  if (kospiHistory.length) {
    const startVal = values[0].value, endVal = values[values.length - 1].value;
    const portPct = startVal > 0 ? ((endVal - startVal) / startVal) * 100 : 0;
    const sorted = [...kospiHistory].sort((a, b) => a.date.localeCompare(b.date));
    let startClose = 0;
    for (const k of sorted) { if (k.date <= values[0].date) startClose = k.close; }
    if (!startClose) startClose = sorted[0].close;
    let endClose = startClose;
    for (const k of sorted) { if (k.date <= values[values.length - 1].date) endClose = k.close; }
    const kospiPct = startClose > 0 ? ((endClose - startClose) / startClose) * 100 : 0;
    alpha = portPct - kospiPct;
  }
  return { mdd: mdd * 100, sharpe, alpha };
};

// 지표 카드 설명문 — 페이퍼·실계좌 동일 기준으로 표기
const sharpeExplain = (v: number | null) =>
  v == null ? '데이터 5일 이상 필요' :
  v >= 1.5 ? '위험 대비 수익이 매우 우수해요' :
  v >= 1.0 ? '위험 대비 수익이 양호해요' :
  v >= 0 ? '수익은 내고 있지만 변동이 큰 편' :
  '수익보다 변동이 더 큰 상태예요';
const mddExplain = (v: number) =>
  v < 5 ? '낙폭이 매우 작아 안정적이에요' :
  v < 10 ? '낙폭이 10% 미만 — 안정적인 편' :
  v < 20 ? '한 번쯤 큰 하락이 있었어요. 분산을 고려하세요' :
  '낙폭이 큰 편이에요. 손절 설정을 권장합니다';
const alphaExplain = (v: number | null) =>
  v == null ? 'KOSPI 비교 데이터 없음' :
  v >= 5 ? `KOSPI보다 ${v.toFixed(1)}%p 더 벌었어요` :
  v >= 0 ? `KOSPI와 비슷하거나 약간 앞서요` :
  `KOSPI보다 ${Math.abs(v).toFixed(1)}%p 덜 벌었어요`;

// 클라이언트 CSV 생성 — 실계좌는 백엔드 export 엔드포인트가 없어 화면 데이터로 직접 만든다(BOM: 엑셀 한글 호환)
const csvEscape = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const downloadCsv = (rows: (string | number)[][], filename: string) => {
  const csv = '\uFEFF' + rows.map(r => r.map(csvEscape).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
const todayStamp = () => { const d = new Date(); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`; };

const RangeToggle = ({ range, onChange }: { range: TrendRange; onChange: (r: TrendRange) => void }) => (
  <div className="flex gap-[3px] rounded-lg p-[3px]" style={{ background: 'var(--ci-card)', border: '1px solid var(--ci-line)' }}>
    {(Object.keys(RANGE_DAYS) as TrendRange[]).map(r => (
      <button key={r} onClick={() => onChange(r)} className="rounded-md px-2.5 py-[5px] text-[12.5px] font-semibold"
        style={{ background: range === r ? 'rgba(91,157,255,.10)' : 'transparent', color: range === r ? SONAR : 'var(--ci-ink2)' }}>{RANGE_LABEL[r]}</button>
    ))}
  </div>
);

const TrendChart = ({ port, kospi, dates, mode, days = 0, real = false }: { port: number[]; kospi: number[] | null; dates?: string[]; mode: 'value' | 'pct'; days?: number; real?: boolean }) => {
  const [hover, setHover] = useState<number | null>(null); // 호버 중인 데이터 인덱스 (조기 return 전에 선언 — 훅 규칙)
  if (port.length < 2) return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--ci-ink3)', opacity: .65 }}><path d="M3 3v16a2 2 0 0 0 2 2h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><path d="M7 14l3.5-3.5 3 3L21 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2.5 2.5" /></svg>
      <div className="text-[14.5px] font-semibold" style={{ color: 'var(--ci-ink2)' }}>{days >= 1 ? '자산 추이를 기록하고 있어요' : '아직 자산 추이 기록이 없어요'}</div>
      <div className="max-w-[360px] text-[13px] leading-relaxed" style={{ color: 'var(--ci-ink3)' }}>
        {days >= 1
          ? <>현재 <b style={{ color: SONAR }}>{days}일치</b> 기록됐어요. 자산은 <b>하루 한 번(자정)</b> 저장되며, <b>이틀치</b>가 모이면 추이 그래프가 자동으로 그려집니다.</>
          : real
            ? <>연결된 거래소 자산이 <b>매일 자정에 한 번</b> 기록돼요. <b>이틀치</b>가 모이는 내일 이후부터 추이 그래프가 표시됩니다.</>
            : <>거래를 시작하면 자산이 <b>매일 자정에 한 번</b> 기록돼요. <b>이틀치</b>가 모이는 내일 이후부터 추이 그래프가 표시됩니다.</>}
      </div>
    </div>
  );
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
  // ── 호버 툴팁 + x축 날짜 라벨 ──
  const hi = hover != null ? Math.min(hover, port.length - 1) : null; // 폴링으로 시리즈 길이가 줄어도 안전
  const fmtV = (v: number) => (mode === 'pct' ? `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` : won(v));
  const fmtD = (d?: string) => (d ? d.slice(2).replace(/-/g, '.') : '');
  const xTicks = dates?.length ? [...new Set([0, Math.round((port.length - 1) / 3), Math.round(((port.length - 1) * 2) / 3), port.length - 1])] : [];
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (!r.width) return;
    const x = ((e.clientX - r.left) / r.width) * W;
    setHover(Math.max(0, Math.min(port.length - 1, Math.round(((x - padL) / innerW) * (port.length - 1)))));
  };
  // 툴팁 행: 날짜 / ●내 자산 / ●KOSPI — mono 값만 표기해 폭 예측 가능(한글 라벨 대신 컬러 불릿)
  const tip = hi == null ? null : (() => {
    const rows: { c?: string; t: string }[] = [];
    if (dates?.[hi]) rows.push({ t: fmtD(dates[hi]) });
    rows.push({ c: SONAR, t: fmtV(port[hi]) });
    if (kospi) rows.push({ c: 'var(--ci-ink3)', t: fmtV(kospi[hi]) });
    const w = Math.max(...rows.map(r => r.t.length)) * 6.6 + 30;
    const h = rows.length * 15 + 11;
    const hx = xP(hi);
    const bx = hx + 12 + w > W - padR ? hx - 12 - w : hx + 12; // 오른쪽 공간 부족 시 왼쪽에 표시
    const by = Math.max(padT, Math.min(yP(port[hi]) - h / 2, padT + innerH - h));
    return { rows, w, h, hx, bx, by };
  })();
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ display: 'block' }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <defs><linearGradient id="pf" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={SONAR} stopOpacity=".2" /><stop offset="100%" stopColor={SONAR} stopOpacity="0" /></linearGradient></defs>
      {ticks.map((t, i) => (<g key={i}><line x1={padL} x2={W - padR} y1={yP(t)} y2={yP(t)} stroke="var(--ci-line)" /><text x={W - padR + 6} y={yP(t) + 4} fill="var(--ci-ink2)" fontSize="10" fontFamily="JetBrains Mono, monospace">{fmtY(t)}</text></g>))}
      {xTicks.map(i => (
        <text key={i} x={xP(i)} y={H - 9} textAnchor={i === 0 ? 'start' : i === port.length - 1 ? 'end' : 'middle'} fontSize="10" fill="var(--ci-ink3)" fontFamily="JetBrains Mono, monospace">{fmtD(dates?.[i])}</text>
      ))}
      <path d={fp} fill="url(#pf)" />
      {kospi && <path d={bp} stroke="var(--ci-ink3)" strokeWidth="1.4" strokeDasharray="4 3" fill="none" vectorEffect="non-scaling-stroke" />}
      <path d={pp} stroke={SONAR} strokeWidth="1.8" fill="none" vectorEffect="non-scaling-stroke" />
      <circle cx={xP(port.length - 1)} cy={yP(port[port.length - 1])} r="3.5" fill={SONAR} stroke="var(--ci-card)" strokeWidth="1.5" />
      {tip && hi != null && (
        <g pointerEvents="none">
          <line x1={tip.hx} x2={tip.hx} y1={padT} y2={padT + innerH} stroke="var(--ci-ink3)" strokeWidth="1" strokeDasharray="3 3" />
          <circle cx={tip.hx} cy={yP(port[hi])} r="4" fill={SONAR} stroke="var(--ci-card)" strokeWidth="1.5" />
          {kospi && <circle cx={tip.hx} cy={yP(kospi[hi])} r="3" fill="var(--ci-ink3)" stroke="var(--ci-card)" strokeWidth="1.5" />}
          <rect x={tip.bx} y={tip.by} width={tip.w} height={tip.h} rx="7" fill="var(--ci-raised)" stroke="var(--ci-line-strong)" opacity="0.97" />
          {tip.rows.map((r, i) => (
            <g key={i}>
              {r.c && <rect x={tip.bx + 9} y={tip.by + 9 + i * 15 - 5} width="7" height="7" rx="2" fill={r.c} />}
              <text x={tip.bx + (r.c ? 21 : 9)} y={tip.by + 9 + i * 15 + 3} fontSize="10.5" fontWeight="600" fill="var(--ci-ink0)" fontFamily="JetBrains Mono, monospace">{r.t}</text>
            </g>
          ))}
        </g>
      )}
    </svg>
  );
};

const MetricCard = ({ label, value, sub, color, explain }: { label: string; value: string; sub: string; color: string; explain?: string }) => (
  <div className="flex flex-col rounded-[11px] px-3.5 py-4 text-center" style={{ background: 'var(--ci-card)', border: '1px solid var(--ci-line)' }}>
    <div className="text-[11.5px] font-semibold" style={{ color: 'var(--ci-ink3)' }}>{label}</div>
    <div className="mt-2 font-mono text-[21.5px] font-bold leading-none" style={{ color }}>{value}</div>
    <div className="mt-1.5 text-[11.5px]" style={{ color: 'var(--ci-ink3)' }}>{sub}</div>
    {explain && (
      <div className="mt-2.5 rounded-[7px] px-2.5 py-2 text-[11.5px] leading-snug" style={{ background: 'var(--ci-panel)', color: 'var(--ci-ink2)', border: '1px solid var(--ci-line)' }}>{explain}</div>
    )}
  </div>
);

// 자산 배분 항목 중 같은 라벨(자산명) 병합 — 거래소가 동일 자산을 중복으로 주거나
// 현금 라벨과 겹칠 때 도넛 조각·범례 중복 및 React key 충돌 방지(값은 합산, 색은 첫 항목 유지).
const mergeAllocByLabel = (items: { c: string; label: string; value: number }[]) => {
  const m = new Map<string, { c: string; label: string; value: number }>();
  for (const it of items) {
    const prev = m.get(it.label);
    if (prev) prev.value += it.value;
    else m.set(it.label, { ...it });
  }
  return [...m.values()];
};

// 도넛 색 안정화 — 자산 코드(없으면 라벨) 해시로 결정: 보유 종목이 늘거나 순서가 바뀌어도
// 같은 자산은 같은 색을 유지하고, 주요 코인은 ASSET_ICON 고유색(BTC 주황 등)과 일치시킨다.
// (이전엔 배열 index 기반이라 종목 하나만 추가돼도 전체 색이 밀렸다)
const stableColor = (code: string | undefined, label: string) => {
  if (code && ASSET_ICON[code]) return ASSET_ICON[code].c;
  const key = code || label;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return CHART_COLORS[h % CHART_COLORS.length];
};

// 자산 배분 마무리 — 색 결정(현금·터틀 등 명시색 존중) → 라벨 병합 → 값 내림차순 → 상위 max개 + '기타' 묶음.
// 도넛 조각과 범례가 항상 같은 목록을 쓰므로 어긋나지 않는다(이전 실계좌는 범례만 6개로 잘랐음).
const finalizeAlloc = (items: { label: string; value: number; code?: string; c?: string }[], max = 7) => {
  const colored = items.map(it => ({ c: it.c ?? stableColor(it.code, it.label), label: it.label, value: it.value }));
  const merged = mergeAllocByLabel(colored).sort((a, b) => b.value - a.value);
  if (merged.length <= max + 1) return merged; // '기타'가 1종뿐이면 묶는 의미가 없어 그대로
  const rest = merged.slice(max);
  return [...merged.slice(0, max), { c: '#5a6a88', label: `기타 ${rest.length}종`, value: rest.reduce((s, a) => s + a.value, 0) }];
};

// 실계좌 보유목록 정리 — 거래소가 같은 자산(assetCode)을 중복 entry로 주거나 수량 0 유령을
// 포함시키면 보유 개수·목록·도넛이 부풀려짐. 자산당 1줄(첫 항목 유지) + 수량>0만.
// ※ 보유목록은 자산당 1줄이 정상이므로 합산이 아닌 keep-first (합산 시 수량·평가가 2배가 됨).
const dedupeHoldings = <T extends { assetCode: string; quantity: number }>(hs: T[]): T[] => {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const h of hs) {
    if (h.quantity <= 0) continue;
    if (seen.has(h.assetCode)) continue;
    seen.add(h.assetCode);
    out.push(h);
  }
  return out;
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
  const [tradeLimit, setTradeLimit] = useState(20); // 처음 20건 + '더 보기'로 20건씩 (이전엔 20건 고정·CSV로만 전체 확인 가능)
  return (
    <Panel style={{ padding: 0, overflow: 'hidden' }}>
      <div className="grid grid-cols-2" style={{ borderBottom: '1px solid var(--ci-line)' }}>
        {([['holdings', '보유 종목', holdings.length], ['trades', '거래 내역', trades.length]] as const).map(([k, l, n], idx) => (
          <button key={k} onClick={() => setTab(k)} className="relative px-4 py-[15px] text-[15px]" style={{ color: tab === k ? 'var(--ci-ink0)' : 'var(--ci-ink2)', fontWeight: tab === k ? 700 : 500, borderRight: idx === 0 ? '1px solid var(--ci-line)' : undefined }}>
            {l} <span className="font-semibold text-white/48">({n})</span>
            {tab === k && <span className="absolute -bottom-px left-3.5 right-3.5 h-0.5 rounded" style={{ background: SONAR }} />}
          </button>
        ))}
      </div>
      {tab === 'holdings' ? (
        holdings.length === 0 ? (
          <div className="px-[22px] py-12 text-center">
            <div className="text-[14px]" style={{ color: 'var(--ci-ink3)' }}>보유 종목이 없습니다.</div>
            <div className="mt-3 flex justify-center gap-2">
              <button onClick={navStore} className="rounded-lg px-3.5 py-2 text-[13.5px] font-semibold" style={{ border: '1px solid var(--ci-line)', color: 'var(--ci-ink1)' }}>전략 학습</button>
              <button onClick={navTrade} className="rounded-lg px-3.5 py-2 text-[13.5px] font-semibold text-white" style={{ background: `linear-gradient(180deg, ${SONAR}, #2c6fe6)` }}>직접 거래 →</button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2 px-[22px] py-3.5" style={{ borderBottom: '1px solid var(--ci-line)', background: 'var(--ci-card)' }}>
              <span className="text-[13px] text-white/48">총 평가금액 <span className="ml-2.5 font-mono text-[17.5px] font-bold text-white">{won(holdingsValue)}</span></span>
              <span className="font-mono text-[14px] font-semibold" style={{ color: holdingsPnl >= 0 ? UP : DOWN }}><Tri up={holdingsPnl >= 0} />{holdingsPnl >= 0 ? '+' : ''}{Math.round(holdingsPnl).toLocaleString('ko-KR')}</span>
            </div>
            {holdings.map((h, i) => {
              const up = h.returnRate >= 0, g = ASSET_ICON[h.stockCode], sl = stockLikeOf(h.assetType), rts = routeMap[h.stockCode];
              return (
                <button key={h.stockCode} onClick={() => onPick(h.stockCode, h.assetType)} className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3.5 px-[22px] py-3.5 text-left transition-colors hover:bg-white/[0.03]" style={{ borderTop: i ? '1px solid var(--ci-line)' : undefined }}>
                  <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] text-[16px] font-bold text-white" style={{ background: g?.c || '#3a4a6a' }}>{g?.t || holdingName(h).slice(0, 1)}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5"><span className="truncate text-[15px] font-semibold">{holdingName(h)}</span><span className="shrink-0 rounded px-1.5 py-0.5 text-[10.5px] font-bold" style={{ background: 'var(--ci-card)', color: 'var(--ci-ink2)' }}>{typeLabel(h.assetType)}</span></div>
                    <div className="mt-0.5 font-mono text-[12px] text-white/48">{h.stockCode} · {fmtQty(h.quantity, sl)}</div>
                    {rts && rts.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{rts.map((r, j) => <span key={j} className="rounded px-1.5 py-0.5 text-[10.5px] font-semibold" style={{ background: 'rgba(91,157,255,.12)', color: SONAR }}>⚓ {r}</span>)}</div>}
                  </div>
                  <div className="text-right"><div className="font-mono text-[15px] font-bold">{fmtHoldingValue(h)}</div><div className="mt-0.5 font-mono text-[13px] font-semibold" style={{ color: up ? UP : DOWN }}><Tri up={up} />{up ? '+' : ''}{h.returnRate.toFixed(2)}%{!isUsd(h.assetType) && <span className="ml-1 text-white/40">({h.profitLoss >= 0 ? '+' : ''}{won(h.profitLoss)})</span>}</div></div>
                </button>
              );
            })}
          </>
        )
      ) : (
        trades.length === 0 ? (
          <div className="px-[22px] py-12 text-center">
            <div className="text-[14px]" style={{ color: 'var(--ci-ink3)' }}>거래 내역이 없습니다.</div>
            <button onClick={navTrade} className="mt-3 rounded-lg px-3.5 py-2 text-[13.5px] font-semibold text-white" style={{ background: `linear-gradient(180deg, ${SONAR}, #2c6fe6)` }}>거래하기 →</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: 520 }}>
              <thead><tr>{['시간', '구분', '종목', '수량', '가격'].map(h => <th key={h} className="px-[18px] py-3 text-left text-[12px] font-semibold uppercase tracking-[.1em] text-white/48" style={{ borderBottom: '1px solid var(--ci-line)' }}>{h}</th>)}</tr></thead>
              <tbody>{trades.slice(0, tradeLimit).map(t => { const buy = t.orderType === 'BUY', sl = stockLikeOf(t.assetType); return (
                <tr key={t.id}>
                  <td className="font-mono text-[14px]" style={td}>{(() => { try { return new Date(t.executedAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { return t.executedAt; } })()}</td>
                  <td style={td}><span className="rounded px-2 py-0.5 text-[12px] font-bold" style={{ color: buy ? UP : DOWN, background: buy ? 'rgba(239,77,77,.12)' : 'rgba(77,138,255,.12)' }}>{buy ? '매수' : '매도'}</span></td>
                  <td className="text-[14px]" style={td}><span className="inline-flex items-center gap-1.5">{holdingName({ stockName: t.stockName, stockCode: t.stockCode })}<span className="rounded px-1 py-0.5 text-[10.5px] font-bold" style={{ background: 'var(--ci-card)', color: 'var(--ci-ink3)' }}>{typeLabel(t.assetType)}</span></span></td>
                  <td className="font-mono text-[14px]" style={td}>{fmtQty(t.quantity, sl)}</td>
                  <td className="font-mono text-[14px]" style={td}>{isUsd(t.assetType) ? '$' + t.price.toLocaleString('en-US', { maximumFractionDigits: 2 }) : won(t.price)}</td>
                </tr>); })}</tbody>
            </table>
            {trades.length > tradeLimit && (
              <button onClick={() => setTradeLimit(l => l + 20)} className="w-full py-3 text-[13.5px] font-semibold transition-colors hover:bg-white/[0.03]" style={{ color: SONAR, borderTop: '1px solid var(--ci-line)' }}>
                더 보기 ↓ ({trades.length - tradeLimit}건 남음)
              </button>
            )}
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
        <button onClick={navTo} className="text-left text-[16px] font-bold hover:underline">{perf.productName}</button>
        {isTurtle && <span className="rounded px-1.5 py-0.5 text-[11px] font-bold" style={{ background: 'rgba(245,208,97,.14)', color: '#f5d061' }}>WhaleArc 독점</span>}
        <button onClick={onStar} disabled={busy} title="대표 항로" className="ml-auto flex h-7 w-7 items-center justify-center rounded-md disabled:opacity-50" style={{ color: isRep ? '#f5d061' : 'var(--ci-ink3)' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill={isRep ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8"><path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.8 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" strokeLinejoin="round" /></svg>
        </button>
      </div>
      <div className="flex items-center gap-2 text-[13.5px] text-white/48">투자 <span className="font-mono font-semibold text-white">{won(perf.investmentAmount)}</span>{isRep && <span className="rounded px-1.5 py-0.5 text-[11px] font-bold" style={{ background: 'rgba(245,208,97,.12)', color: '#f5d061' }}>대표 항로</span>}</div>
      <div className="mt-4 rounded-xl px-[18px] py-4" style={{ background: up ? 'rgba(239,77,77,.07)' : 'rgba(77,138,255,.07)', border: `1px solid ${up ? 'rgba(239,77,77,.22)' : 'rgba(77,138,255,.22)'}` }}>
        <div className="font-mono text-[28px] font-bold" style={{ color: up ? UP : DOWN }}><Tri up={up} />{up ? '+' : ''}{perf.totalReturnRate.toFixed(2)}%</div>
        <div className="mt-1 font-mono text-[13px] text-white/48">({up ? '+' : ''}{won(perf.totalPnl)})</div>
      </div>
      {perf.assets?.length > 0 && <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1.5 text-[13.5px]">
        {perf.assets.map((a, i) => { const au = a.returnRate >= 0; return (
          <span key={a.code} className="flex items-center gap-2 text-white/70">{i > 0 && <span className="text-white/30">·</span>}{a.code} <span className="font-mono font-semibold" style={{ color: au ? UP : DOWN }}>{au ? '+' : ''}{a.returnRate.toFixed(1)}%</span></span>
        ); })}
      </div>}
      {isTurtle && (trades > 0 ? (
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          {[['거래', `${trades}회`], ['승률', `${((wins / trades) * 100).toFixed(1)}%`], ['실현 손익', won(perf.realizedPnl || 0)]].map(([l, v]) => (
            <div key={l} className="rounded-lg px-3 py-2.5 text-center" style={{ background: 'var(--ci-card)', border: '1px solid var(--ci-line)' }}><div className="text-[11.5px] text-white/48">{l}</div><div className="mt-1 font-mono text-[14px] font-semibold">{v}</div></div>
          ))}
        </div>
      ) : <div className="mt-4 rounded-lg px-3 py-2.5 text-center text-[13px]" style={{ background: 'var(--ci-card)', border: '1px solid var(--ci-line)', color: 'var(--ci-ink3)' }}>진입 시그널 대기 중</div>)}
    </div>
  );
};

/* ── 페이퍼(모의투자) 포트폴리오 — virt 라우트 ── */
const PaperPortfolio = () => {
  const navigate = useNavigate();
  const { profileName } = useAuth();
  const { isVirt } = useRoutePrefix();
  // 표시명은 DB 닉네임(profileName) 단일 소스 — 대시보드와 동일(이메일 ID 노출·깜빡임 방지)
  const userName = profileName || '항해사';
  const [mode, setMode] = useState<'value' | 'pct'>('value');
  const [range, setRange] = useState<TrendRange>('D');

  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [history, setHistory] = useState<PortfolioSnapshot[]>([]);
  const [metricsHistory, setMetricsHistory] = useState<PortfolioSnapshot[]>([]);  // 성과 지표용 전체 기간(차트 range 토글과 무관)
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
      quantStoreService.getMyPurchasesPerformance().catch(() => [] as PurchasePerformance[]),
    ]).then(([p, t, r]) => {
      setPortfolio(p);
      setTrades([...t].sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime()));
      setRoutes(r);
      setError(null);
    }).catch(() => setError('포트폴리오를 불러오지 못했습니다. 네트워크 상태를 확인해주세요.'))
      .finally(() => setLoading(false));
  }, [isPreview]);

  // 자산 추이는 메인 로딩과 분리(무음) — 기간 토글 시 페이지 깜빡임 없이 차트만 갱신.
  // 30초 폴링으로 오늘 점만 라이브 유지(총자산 숫자는 load()가 10초로 갱신; 이력 전체 재조회는
  // 년 범위에서 5년치라 10초는 과했다), range 변경 시엔 즉시 재조회.
  const loadHistory = useCallback(() => {
    if (isPreview) return;
    portfolioService.getHistory(RANGE_DAYS[range]).then(setHistory).catch(() => {});
  }, [isPreview, range]);
  useEffect(() => {
    loadHistory();
    if (isPreview) return;
    const t = setInterval(loadHistory, 30_000);
    return () => clearInterval(t);
  }, [loadHistory, isPreview]);

  // 성과 지표(MDD·Sharpe·Alpha)는 전체 기간 기준으로 일정해야 하므로 차트 range와 분리해
  // 전체 기간(RANGE_DAYS.Y)을 한 번만 조회한다. 폴링 불필요(장기 통계, 리셋 시에만 재조회).
  const loadMetricsHistory = useCallback(() => {
    if (isPreview) return;
    portfolioService.getHistory(RANGE_DAYS.Y).then(setMetricsHistory).catch(() => {});
  }, [isPreview]);
  useEffect(() => { loadMetricsHistory(); }, [loadMetricsHistory]);

  useEffect(() => {
    load();
    if (isPreview) return;
    const t = setInterval(() => load(true), 10_000);
    return () => clearInterval(t);
  }, [load, isPreview]);

  // KOSPI 벤치마크 (공개 API, 인증 데이터와 분리 — 401에 묶이지 않게).
  // 전체 기간(RANGE_DAYS.Y)을 1회 조회해 차트 리베이스와 성과 지표(알파)가 같은 데이터를 쓴다.
  // 이전엔 차트 range에 맞춰 재조회(365/1825일)해서, 1년 넘게 기록된 계정에서 일/월 범위일 때
  // 알파의 KOSPI 시작점이 잘리고 range 토글에 따라 알파 값이 바뀌는 불일치가 있었다.
  // 고정 days = 전 유저 동일 요청 → 백엔드 지수 캐시도 공유된다.
  useEffect(() => {
    apiClient.get('/api/market/indices/history', { params: { code: '0001', days: RANGE_DAYS.Y } })
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
    // 보유 종목 클릭 = 포지션 관리 의지 → 시세·거래 통합 페이지에서 주문 패널을 바로 연다.
    // 이미 보유 중이므로 매도 탭으로 여는 게 문맥에 맞다(매수 전환은 패널 안 탭 1클릭).
    navigate(`${isVirt ? '/virt' : ''}/market?code=${code}&type=${at || 'CRYPTO'}&panel=order&side=sell`);
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
    try { await tradeService.resetPortfolio(); showToast('새 항해가 시작되었습니다!'); load(); loadHistory(); loadMetricsHistory(); }
    catch { showToast('초기화에 실패했습니다.', 'error'); }
  }, [showToast, load, loadHistory, loadMetricsHistory]);

  // 보유 종목은 평가액(KRW 환산) 내림차순 — API 응답 순서 그대로 두면 종목이 많을 때 훑기 어렵다
  const holdings = useMemo(() => {
    const fx = portfolio?.usdKrwRate || FALLBACK_USD_KRW;
    const v = (h: Holding) => (isUsd(h.assetType) && fx > 0 ? h.marketValue * fx : h.marketValue);
    return [...(portfolio?.holdings ?? [])].sort((a, b) => v(b) - v(a));
  }, [portfolio]);
  const cash = portfolio?.cashBalance ?? 0;
  const initialCash = portfolio?.initialCash || 10_000_000;
  const totalValue = portfolio?.totalValue ?? 0;
  const usdKrw = portfolio?.usdKrwRate || FALLBACK_USD_KRW;  // 환율 누락 시 1:1(원화 취급)로 USD가 ~1380배 축소되던 버그 → 폴백 환율
  // 미국주식·ETF(USD)는 환율로 KRW 환산 후 합산(통화 혼합 방지) — 백엔드 totalValue와 정합
  const krwVal = (h: { marketValue: number; assetType?: string }) => (isUsd(h.assetType) && usdKrw > 0 ? h.marketValue * usdKrw : h.marketValue);
  const krwPnl = (h: { profitLoss: number; assetType?: string }) => (isUsd(h.assetType) && usdKrw > 0 ? h.profitLoss * usdKrw : h.profitLoss);
  const holdingsValue = holdings.reduce((s, h) => s + krwVal(h), 0);
  const totalPnl = totalValue - initialCash;
  const returnRate = portfolio?.returnRate ?? 0;
  const turtle = portfolio?.turtleAllocated ?? 0;
  const holdingsPnl = holdings.reduce((s, h) => s + krwPnl(h), 0);

  // 보유 종목에 적용 항로 배지 (assets[].code → 항로 이름)
  const assetRouteMap = useMemo(() => {
    const m: Record<string, string[]> = {};
    routes.forEach(p => p.assets?.forEach(a => { (m[a.code] ||= []).push(p.productName); }));
    return m;
  }, [routes]);

  const alloc = useMemo(() => {
    const arr: { label: string; value: number; code?: string; c?: string }[] = [];
    if (cash > 0) arr.push({ c: '#7a8aa8', label: '현금', value: cash });
    holdings.forEach(h => { const v = krwVal(h); if (v > 0) arr.push({ code: h.stockCode, label: holdingName(h), value: v }); });
    if (turtle > 0) arr.push({ c: '#f5d061', label: '터틀 전략', value: turtle });
    return finalizeAlloc(arr);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- krwVal은 usdKrw만 읽는 렌더 로컬 헬퍼(usdKrw는 이미 dep); deps에 넣으면 memo가 매 렌더 무효화됨
  }, [holdings, cash, turtle, usdKrw]);
  const allocTotal = alloc.reduce((s, a) => s + a.value, 0);

  // 자산추이 시계열 + KOSPI 리베이스(포트폴리오 시작값 기준). 월·년은 월별 다운샘플.
  const chart = useMemo(
    () => buildTrendData(trendSeries(history, range).map(s => ({ date: s.date, value: s.totalValue })), kospiHistory),
    [history, kospiHistory, range]);
  const port = chart ? (mode === 'pct' ? chart.portPct : chart.portValue) : [];
  const kospi = chart ? (mode === 'pct' ? chart.kospiPct : chart.kospiValue) : null;

  // ── 성과 지표 계산 (전체 기간 metricsHistory 기준 — 차트 일/월/년 토글과 무관하게 일정) ──
  const metrics = useMemo(() => {
    // MDD·샤프·알파는 공용 헬퍼(snapshotMetrics), 승률·보유기간은 페이퍼 전용(전체 체결 이력 기반)
    const base = snapshotMetrics(metricsHistory.map(s => ({ date: s.date, value: s.totalValue })), kospiHistory);
    if (!base) return null;
    // 청산 거래 FIFO 매칭 → 승률 + 평균 보유기간
    const sortedT = [...trades].sort((a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime());
    const buyQ: Record<string, Trade[]> = {};
    const matched: { win: boolean; holdDays: number }[] = [];
    for (const t of sortedT) {
      if (t.orderType === 'BUY') {
        (buyQ[t.stockCode] ||= []).push(t);
      } else {
        const q = buyQ[t.stockCode];
        if (q?.length) {
          const buy = q.shift()!;
          matched.push({
            win: t.price > buy.price,
            holdDays: (new Date(t.executedAt).getTime() - new Date(buy.executedAt).getTime()) / 86400000,
          });
        }
      }
    }
    const winRate = matched.length > 0 ? (matched.filter(m => m.win).length / matched.length) * 100 : null;
    const avgHoldDays = matched.length > 0 ? matched.reduce((a, m) => a + m.holdDays, 0) / matched.length : null;
    return { ...base, winRate, avgHoldDays, closedTrades: matched.length };
  }, [metricsHistory, trades, kospiHistory]);

  const navTo = (p: string) => navigate(`${isVirt ? '/virt' : ''}${p}`);
  const isEmpty = !loading && !error && holdings.length === 0 && trades.length === 0;
  return (
    <HelmShell active="portfolio" virt={isVirt} userName={userName} session="모의투자 · 10초 갱신">
      <div className="mx-auto flex max-w-[1560px] flex-col gap-[18px]">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">내 포트폴리오</h1>
          <p className="mt-2 text-[14.5px] text-white/70">{userName} 항해사님의 항해 일지</p>
        </div>
        {error && <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3 text-[14px]" style={{ background: 'rgba(239,77,77,.1)', border: '1px solid rgba(239,77,77,.25)', color: '#fca5a5' }}><span>{error}</span><button onClick={() => load()} className="rounded-md px-3 py-1 text-[13px] font-semibold" style={{ border: '1px solid rgba(239,77,77,.35)', color: '#fca5a5' }}>다시 시도</button></div>}

        {isEmpty ? (
          <EmptyState
            kicker="FIRST VOYAGE"
            title="아직 항해를 시작하지 않았어요"
            desc="첫 거래를 하면 보유 종목·자산 추이·항해 중인 항로가 이곳에 채워져요. VIRT 가상 자금 1,000만 원으로 위험 없이 시작할 수 있어요."
            ctaLabel="첫 거래 시작하기" onCta={() => navTo('/market')}
            secondaryLabel="시세 둘러보기" onSecondary={() => navTo('/market')}
            preview={[
              { icon: 'pie', label: '자산 배분', sub: '현금·종목 비중이 도넛으로 표시돼요' },
              { icon: 'swap', label: '보유 종목 · 거래 내역', sub: '매수·매도한 종목과 평가손익' },
              { icon: 'route', label: '항해 중인 항로', sub: '적용한 전략의 실시간 수익률' },
            ]}
            note="모든 거래는 가상이에요. 실계좌 연동 전, VIRT에서 충분히 연습하세요."
          />
        ) : (<>
        {/* 총자산 + 도넛 */}
        <Panel style={{ padding: 0, overflow: 'hidden' }}>
          <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr]">
            <div className="px-8 py-[30px]" style={{ borderRight: '1px solid var(--ci-line)' }}>
              <div className="mb-2.5 text-[11.5px] font-semibold tracking-[.2em]" style={{ color: SONAR }}>총 자산</div>
              <div className="text-[clamp(40px,6vw,58px)] font-bold leading-none tracking-tight">{loading && !portfolio ? '—' : won(totalValue)}</div>
              <div className="mt-3.5 font-mono text-[17.5px] font-semibold" style={{ color: totalPnl < 0 ? DOWN : totalPnl > 0 ? UP : 'var(--ci-ink1)' }}>{totalPnl !== 0 && <Tri up={totalPnl > 0} />}{totalPnl > 0 ? '+' : totalPnl < 0 ? '-' : ''}{won(Math.abs(totalPnl))} ({returnRate >= 0 ? '+' : ''}{returnRate.toFixed(2)}%)</div>
              <div className="mt-6 grid grid-cols-3 gap-3">
                {([['현금', won(cash)], ['보유 평가', won(holdingsValue)], ['초기 자본', won(initialCash)]] as const).map(([l, v]) => (
                  <div key={l} className="rounded-[11px] px-3.5 py-3" style={{ background: 'var(--ci-card)', border: '1px solid var(--ci-line)' }}>
                    <div className="text-[11.5px] text-white/48">{l}</div><div className="mt-1.5 font-mono text-[16px] font-semibold">{v}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-6 py-6">
              <div className="mb-3.5 text-[11.5px] font-semibold tracking-[.2em] text-white/48">자산 배분</div>
              {alloc.length === 0 ? <div className="flex h-[120px] items-center justify-center text-[13.5px]" style={{ color: 'var(--ci-ink3)' }}>{loading ? '불러오는 중…' : '자산이 없습니다'}</div> : (
                <div className="grid grid-cols-[152px_1fr] items-center gap-4">
                  <div style={{ width: 152, height: 152 }}><Donut items={alloc} total={allocTotal} /></div>
                  <ul className="m-0 flex list-none flex-col gap-3 p-0">
                    {alloc.map((a, i) => (
                      <li key={i} className="flex items-center gap-2 text-[13.5px]">
                        <span className="h-[9px] w-[9px] shrink-0 rounded-full" style={{ background: a.c }} />
                        <span className="truncate">{a.label}</span>
                        <span className="ml-1.5 shrink-0 font-mono font-semibold" style={{ color: 'var(--ci-ink1)' }}>{((a.value / (allocTotal || 1)) * 100).toFixed(1)}%</span>
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
            <div className="flex items-center gap-2">
              <div className="flex gap-[3px] rounded-lg p-[3px]" style={{ background: 'var(--ci-card)', border: '1px solid var(--ci-line)' }}>
                {([['value', '총 자산'], ['pct', '수익률 %']] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setMode(k)} className="rounded-md px-2.5 py-[5px] text-[12.5px] font-semibold" style={{ background: mode === k ? 'rgba(91,157,255,.10)' : 'transparent', color: mode === k ? SONAR : 'var(--ci-ink2)' }}>{l}</button>
                ))}
              </div>
              <RangeToggle range={range} onChange={setRange} />
              <span className="hidden text-[12.5px] text-white/48 lg:inline">{rangeCaption(history, range)}</span>
            </div>} />
          <div className="flex justify-end gap-4 px-3.5 pb-2 pt-2.5 text-[12px] text-white/70">
            <span className="inline-flex items-center gap-1.5"><span style={{ width: 14, height: 2, background: SONAR }} />내 포트폴리오</span>
            {kospi && <span className="inline-flex items-center gap-1.5"><span style={{ width: 14, borderTop: '2px dashed var(--ci-ink3)' }} />KOSPI</span>}
          </div>
          <div className="px-3 pb-[18px]" style={{ height: 250 }}><TrendChart port={port} kospi={kospi} dates={chart?.dates} mode={mode} days={history.length} /></div>
          {kospi && <div className="px-[22px] pb-3 text-[11.5px]" style={{ color: 'var(--ci-ink3)' }}>* KOSPI 수익률은 실제 지수 일봉 데이터 기반입니다.</div>}
        </Panel>

        {/* 성과 지표 */}
        {metrics && (
          <Panel>
            <PanelHead kicker="PERFORMANCE" title="성과 지표" right={
              <button onClick={() => navigate('/virt/learn?tab=glossary')} className="rounded-md px-2.5 py-1 text-[12px] font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white" style={{ border: '1px solid rgba(255,255,255,.22)' }}>
                용어가 궁금하면 → 학습 노트
              </button>
            } />
            <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 lg:grid-cols-5">
              <MetricCard
                label="샤프 비율"
                value={metrics.sharpe != null ? metrics.sharpe.toFixed(2) : '—'}
                sub="≥1.0이면 양호"
                color={metrics.sharpe != null ? (metrics.sharpe >= 1 ? UP : metrics.sharpe >= 0 ? 'var(--ci-ink0)' : DOWN) : 'var(--ci-ink3)'}
                explain={sharpeExplain(metrics.sharpe)}
              />
              <MetricCard
                label="최대낙폭 (MDD)"
                value={`-${metrics.mdd.toFixed(1)}%`}
                sub="낮을수록 안전"
                color={metrics.mdd < 10 ? '#4ade80' : metrics.mdd < 20 ? 'var(--ci-ink0)' : DOWN}
                explain={mddExplain(metrics.mdd)}
              />
              <MetricCard
                label="청산 승률"
                value={metrics.winRate != null ? `${metrics.winRate.toFixed(1)}%` : '—'}
                sub={metrics.closedTrades > 0 ? `${metrics.closedTrades}회 청산` : '청산 거래 없음'}
                color={metrics.winRate != null ? (metrics.winRate >= 50 ? UP : DOWN) : 'var(--ci-ink3)'}
                explain={
                  metrics.winRate == null ? '청산 거래가 없어요' :
                  metrics.winRate >= 60 ? `10회 중 ${Math.round(metrics.winRate / 10)}회 수익 마감` :
                  metrics.winRate >= 50 ? '손익 균형 수준 (50% 이상)' :
                  '손실 마감이 더 많아요. 전략 점검을'
                }
              />
              <MetricCard
                label="평균 보유기간"
                value={metrics.avgHoldDays != null ? `${metrics.avgHoldDays.toFixed(1)}일` : '—'}
                sub="청산 기준 FIFO"
                color="var(--ci-ink0)"
                explain={
                  metrics.avgHoldDays == null ? '청산 거래가 없어요' :
                  metrics.avgHoldDays < 1 ? '하루 안에 사고파는 단타예요' :
                  metrics.avgHoldDays < 7 ? '며칠 안에 청산하는 단기 매매예요' :
                  metrics.avgHoldDays < 30 ? '몇 주 보유하는 중기 매매예요' :
                  '한 달 이상 보유하는 장기 투자예요'
                }
              />
              <MetricCard
                label="KOSPI 대비 Alpha"
                value={metrics.alpha != null ? `${metrics.alpha >= 0 ? '+' : ''}${metrics.alpha.toFixed(1)}%p` : '—'}
                sub={metrics.alpha != null ? (metrics.alpha >= 0 ? 'KOSPI 초과' : 'KOSPI 하회') : 'KOSPI 데이터 없음'}
                color={metrics.alpha != null ? (metrics.alpha >= 0 ? UP : DOWN) : 'var(--ci-ink3)'}
                explain={alphaExplain(metrics.alpha)}
              />
            </div>
            <div className="px-5 pb-4 text-[11.5px]" style={{ color: 'var(--ci-ink3)' }}>
              * 샤프 비율 무위험수익률 3.5%/년 기준 연환산. 승률은 FIFO 방식 청산 거래만 집계. Alpha는 보유 기간 대비 KOSPI 초과수익률입니다.
            </div>
          </Panel>
        )}

        {/* 보유종목 + 항로 */}
        <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1.5fr_1fr]">
          <HoldingsTrades holdings={holdings} trades={trades} holdingsValue={holdingsValue} holdingsPnl={holdingsPnl} routeMap={assetRouteMap} onPick={goTrade} navTrade={() => navigate(`${isVirt ? '/virt' : ''}/market`)} navStore={() => navigate(`${isVirt ? '/virt' : ''}/strategy`)} />
          <Panel style={{ overflow: 'hidden' }}>
            <PanelHead kicker="ACTIVE ROUTE" title="항해 중인 항로" right={<button onClick={() => navigate(`${isVirt ? '/virt' : ''}/strategy`)} className="text-[13px] text-white/80 hover:text-white">전략 학습 →</button>} />
            {routes.length === 0 ? (
              <div className="px-[22px] py-12 text-center">
                <div className="text-[14px]" style={{ color: 'var(--ci-ink3)' }}>적용 중인 항로가 없습니다.</div>
                <button onClick={() => navigate(`${isVirt ? '/virt' : ''}/strategy`)} className="mt-3 rounded-lg px-4 py-2 text-[13.5px] font-semibold text-white" style={{ background: `linear-gradient(180deg, ${SONAR}, #2c6fe6)` }}>항로 둘러보기 →</button>
              </div>
            ) : routes.map(perf => (
              <RouteCard key={perf.purchaseId} perf={perf} isRep={portfolio?.representativePurchaseId === perf.purchaseId} onStar={() => handleStar(perf.purchaseId)} busy={settingRoute === perf.purchaseId} navTo={() => navigate(`${isVirt ? '/virt' : ''}/strategy`)} />
            ))}
          </Panel>
        </div>

        {/* 빠른 액션 */}
        <Panel style={{ padding: '16px 22px' }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[13px] font-semibold tracking-[.08em]" style={{ color: 'var(--ci-ink2)' }}>빠른 액션</span>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => handleExport('trades')} disabled={exporting !== null} className="rounded-lg px-3.5 py-2 text-[13.5px] font-semibold disabled:opacity-50" style={{ border: '1px solid var(--ci-line)', background: 'var(--ci-card)', color: 'var(--ci-ink1)' }}>{exporting === 'trades' ? '다운로드 중…' : '거래 내역 CSV'}</button>
              <button onClick={() => handleExport('portfolio')} disabled={exporting !== null} className="rounded-lg px-3.5 py-2 text-[13.5px] font-semibold disabled:opacity-50" style={{ border: '1px solid var(--ci-line)', background: 'var(--ci-card)', color: 'var(--ci-ink1)' }}>{exporting === 'portfolio' ? '다운로드 중…' : '포트폴리오 CSV'}</button>
              <button onClick={handleReset} className="rounded-lg px-3.5 py-2 text-[13.5px] font-semibold" style={{ border: '1px solid rgba(239,77,77,.3)', color: UP }}>새 항해 시작</button>
            </div>
          </div>
        </Panel>

        <ConsoleFooter />
        </>)}
      </div>
      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </HelmShell>
  );
};

/* ── 실계좌(KIS/업비트/비트겟) 포트폴리오 — non-virt 라우트, exchangeService ── */
// 체결 내역 백엔드 지원 여부 — 현재 KIS(국내주식)만. 미지원 거래소는 호출 없이 '준비 중' 표기.
const TXN_SUPPORTED: Partial<Record<ExchangeType, true>> = { KIS: true };
// KIS 체결시각 "20260604 153012" → "06/04 15:30" (시간 누락 시 날짜만)
const fmtTxnTime = (s: string) => {
  const m = /^(\d{4})(\d{2})(\d{2})(?:\s+(\d{2})(\d{2})(\d{2})?)?/.exec((s || '').trim());
  return m ? (m[4] ? `${m[2]}/${m[3]} ${m[4]}:${m[5]}` : `${m[2]}/${m[3]}`) : (s || '—');
};
const RealAccountPortfolio = () => {
  const navigate = useNavigate();
  const { profileName } = useAuth();
  const { isVirt } = useRoutePrefix();
  // 표시명은 DB 닉네임(profileName) 단일 소스 — 대시보드와 동일(이메일 ID 노출·깜빡임 방지)
  const userName = profileName || '항해사';
  const [accounts, setAccounts] = useState<ExchangeAccount[]>([]);
  const [portfolios, setPortfolios] = useState<Partial<Record<ExchangeType, ExchangePortfolio | null>>>({});
  const [history, setHistory] = useState<ExchangeSnapshot[]>([]);  // 자산 추이(일별 스냅샷)
  const [range, setRange] = useState<TrendRange>('D');             // 일/월/년 기간 선택
  const [activeTab, setActiveTab] = useState<ExchangeType>('KIS');
  const [holdTab, setHoldTab] = useState<'holdings' | 'txns'>('holdings');  // 보유 종목 / 체결 내역 탭
  const [txns, setTxns] = useState<Partial<Record<ExchangeType, ExchangeTransaction[] | null>>>({});  // undefined=미조회, null=조회 실패
  const [txnLoading, setTxnLoading] = useState(false);
  const [txnExporting, setTxnExporting] = useState(false);
  const [mode, setMode] = useState<'value' | 'pct'>('value');  // 자산 추이 총자산/수익률% 토글
  const [metricsHistory, setMetricsHistory] = useState<ExchangeSnapshot[]>([]);  // 성과 지표용 전체 기간(차트 range와 무관)
  const [kospiHistory, setKospiHistory] = useState<{ date: string; close: number }[]>([]);
  const [splitCcy, setSplitCcy] = useState(false);   // 원화/해외 통화 분리 표시 토글
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
      // 최초 로드: 대시보드와 공유하는 저장 선택(whalearc_real_src)이 연결돼 있으면 우선, 아니면 첫 연결 거래소.
      // ('ALL'은 대시보드 전용 값 — 여기선 전체 합산 패널이 항상 위에 있으므로 무시하고 첫 연결로)
      if (!autoPickRef.current) {
        let saved: string | null = null;
        try { saved = localStorage.getItem(REAL_SRC_KEY); } catch { /* ignore */ }
        const target = accs.find(a => a.exchangeType === saved && a.connected) ?? accs.find(a => a.connected);
        if (target) { setActiveTab(target.exchangeType); autoPickRef.current = true; }
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
    const t = setInterval(() => load(true), 10_000);
    return () => clearInterval(t);
  }, [load, isPreview]);

  // 자산 추이 — 일별 스냅샷(매일 자정 기록)은 폴링 불필요. 기간 선택 시 범위 맞춰 재조회.
  useEffect(() => {
    if (isPreview) return;
    exchangeService.getHistory(RANGE_DAYS[range]).then(setHistory).catch(() => {});
  }, [isPreview, range]);

  // 성과 지표(MDD·샤프·알파)는 전체 기간 기준으로 일정해야 하므로 차트 range와 분리해 1회만 조회.
  useEffect(() => {
    if (isPreview) return;
    exchangeService.getHistory(RANGE_DAYS.Y).then(setMetricsHistory).catch(() => {});
  }, [isPreview]);

  // KOSPI 벤치마크 (공개 API, 인증과 분리). 전체 기간을 1회 조회해 차트 리베이스·알파에 함께 사용 —
  // 페이퍼처럼 range에 묶어 재조회하면 지표 시작점이 잘리는 불일치가 생기므로 처음부터 고정 범위.
  useEffect(() => {
    apiClient.get('/api/market/indices/history', { params: { code: '0001', days: RANGE_DAYS.Y } })
      .then(res => { if (Array.isArray(res.data)) setKospiHistory(res.data); }).catch(() => {});
  }, []);

  const isConn = (t: ExchangeType) => accounts.some(a => a.exchangeType === t && a.connected);
  const connectedList = EXCHANGES.filter(e => isConn(e.key));
  const totalAll = connectedList.reduce((s, e) => s + (portfolios[e.key]?.totalValue || 0), 0);
  const pnlAll = connectedList.reduce((s, e) => s + (portfolios[e.key]?.totalProfitLoss || 0), 0);
  const cashAll = connectedList.reduce((s, e) => s + (portfolios[e.key]?.cashBalance || 0), 0);
  // 합산 수익률 = 보유 자산 매입원금 대비(예수금 제외) — 거래소별 totalReturnRate(매입금 대비)와 같은 기준.
  // 이전엔 분모에 현금이 포함돼(총자산-손익) 예수금이 많을수록 수익률이 희석돼 보였다.
  const investedAll = totalAll - cashAll - pnlAll;
  const returnAll = investedAll > 0 ? (pnlAll / investedAll) * 100 : 0;
  const hasAny = connectedList.length > 0;
  const port = portfolios[activeTab] || null;
  const connected = isConn(activeTab);
  const isStock = activeTab === 'KIS';
  // 거래소 중복 entry/수량0 유령 제거 → 보유 개수·목록·도넛·통화분리 모두 정확. 평가액(KRW 환산) 내림차순 정렬.
  const holdings = useMemo(() => {
    const fx = port?.usdtKrwRate || FALLBACK_USD_KRW;
    const v = (h: { marketValue: number; currency?: string }) => (h.currency === 'USD' && fx > 0 ? h.marketValue * fx : h.marketValue);
    return dedupeHoldings(port?.holdings ?? []).sort((a, b) => v(b) - v(a));
  }, [port]);
  const cashLabel = isStock ? '예수금' : activeTab === 'UPBIT' ? 'KRW 잔고' : 'USDT';

  // 체결 내역 — 지원 거래소(KIS) 선택 시 1회 조회 후 캐시. 10초 잔고 폴링과 분리해 KIS 호출을 아끼고,
  // ↻ 새로고침 버튼이 캐시를 비워 재조회한다. txns[t]: undefined=미조회, null=실패, []=내역 없음.
  useEffect(() => {
    if (isPreview || !connected || !TXN_SUPPORTED[activeTab] || txns[activeTab] !== undefined) return;
    let alive = true;
    setTxnLoading(true);
    exchangeService.getTransactions(activeTab)
      .then(list => { if (alive) setTxns(prev => ({ ...prev, [activeTab]: list || [] })); })
      .catch(() => { if (alive) setTxns(prev => ({ ...prev, [activeTab]: null })); })
      .finally(() => { if (alive) setTxnLoading(false); });
    return () => { alive = false; };
  }, [isPreview, connected, activeTab, txns]);
  const txnList = txns[activeTab];

  // 도넛/합계는 항상 KRW 기준 — KIS 해외주식(currency=USD)은 서버가 준 환율로 환산(통화 혼합 방지)
  const usdKrw = port?.usdtKrwRate || FALLBACK_USD_KRW;  // 환율 누락 시 폴백(원화 1:1 취급 방지)
  // 원화/해외 통화 분리 (KIS 실계좌): 해외 = 외화예수금 + 미국주식 보유, 원화 = 총자산 - 해외(KRW환산)
  const foreignCashUsd = port?.foreignCashUsd ?? 0;
  const foreignCashKrw = port?.foreignCashKrw ?? 0;
  const usHoldUsd = holdings.filter(h => h.currency === 'USD').reduce((s, h) => s + (h.marketValue || 0), 0);
  const foreignValueUsd = foreignCashUsd + usHoldUsd;
  const foreignValueKrw = foreignCashKrw + usHoldUsd * usdKrw;
  const domesticValueKrw = (port?.totalValue ?? 0) - foreignValueKrw;
  const hasForeign = isStock && foreignValueUsd > 0;
  const krwVal = (h: { marketValue: number; currency?: string }) => (h.currency === 'USD' && usdKrw > 0 ? h.marketValue * usdKrw : h.marketValue);
  const alloc = useMemo(() => {
    if (!port) return [] as { c: string; label: string; value: number }[];
    const arr: { label: string; value: number; code?: string; c?: string }[] = [];
    if (port.cashBalance > 0) arr.push({ c: '#7a8aa8', label: isStock ? '예수금' : 'KRW', value: port.cashBalance });
    holdings.forEach(h => { const v = krwVal(h); if (v > 0) arr.push({ code: h.assetCode, label: h.assetName, value: v }); });
    return finalizeAlloc(arr);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- krwVal은 usdKrw만 읽는 렌더 로컬 헬퍼(usdKrw는 이미 dep); deps에 넣으면 memo가 매 렌더 무효화됨
  }, [port, holdings, isStock, usdKrw]);
  const allocTotal = alloc.reduce((s, a) => s + a.value, 0);

  // 자산추이 시계열 + KOSPI 리베이스 / 성과 지표 — 페이퍼와 동일한 공용 헬퍼 사용
  const chart = useMemo(
    () => buildTrendData(trendSeries(history, range).map(s => ({ date: s.date, value: s.totalValueKrw })), kospiHistory),
    [history, kospiHistory, range]);
  const chartPort = chart ? (mode === 'pct' ? chart.portPct : chart.portValue) : [];
  const chartKospi = chart ? (mode === 'pct' ? chart.kospiPct : chart.kospiValue) : null;
  const metrics = useMemo(
    () => snapshotMetrics(metricsHistory.map(s => ({ date: s.date, value: s.totalValueKrw })), kospiHistory),
    [metricsHistory, kospiHistory]);

  // CSV 내보내기 — 실계좌는 백엔드 export 엔드포인트가 없어 화면 데이터로 클라이언트 생성
  const exportHoldingsCsv = () => {
    const rows: (string | number)[][] = [['거래소', '자산코드', '자산명', '수량', '평균단가', '평가금액', '평가손익', '수익률(%)', '통화']];
    connectedList.forEach(e => {
      dedupeHoldings(portfolios[e.key]?.holdings ?? []).forEach(h =>
        rows.push([e.shortName, h.assetCode, h.assetName, h.quantity, h.averagePrice, h.marketValue, h.profitLoss, h.returnRate, h.currency || 'KRW']));
    });
    if (rows.length === 1) { showToast('내보낼 보유 자산이 없습니다.', 'error'); return; }
    downloadCsv(rows, `WhaleArc_real_holdings_${todayStamp()}.csv`);
    showToast('보유 자산 CSV를 내려받았어요.');
  };
  const exportTxnsCsv = async () => {
    if (txnExporting) return;
    setTxnExporting(true);
    try {
      const list = Array.isArray(txns.KIS) ? txns.KIS : await exchangeService.getTransactions('KIS');
      if (!list.length) { showToast('최근 30일 체결 내역이 없습니다.', 'error'); return; }
      const rows: (string | number)[][] = [['시간', '구분', '종목코드', '종목명', '수량', '체결가', '체결금액', '상태'],
        ...list.map(t => [t.executedAt, t.side === 'BUY' ? '매수' : '매도', t.stockCode, t.stockName, t.quantity, t.price, t.totalAmount, t.status === 'FILLED' ? '체결' : '미체결'] as (string | number)[])];
      downloadCsv(rows, `WhaleArc_real_transactions_${todayStamp()}.csv`);
      showToast('체결 내역 CSV를 내려받았어요.');
    } catch { showToast('체결 내역 CSV 생성에 실패했습니다.', 'error'); }
    finally { setTxnExporting(false); }
  };

  const openSetup = (t: ExchangeType) => setShowSetup(t);
  const handleDisconnect = async (t: ExchangeType) => {
    if (!window.confirm(`${EXCHANGES.find(e => e.key === t)?.shortName} 연결을 해제하시겠습니까?`)) return;
    try { await exchangeService.deleteAccount(t); setShowSetup(null); showToast('연결이 해제되었습니다.'); load(); }
    catch { showToast('연결 해제에 실패했습니다.', 'error'); }
  };

  return (
    <HelmShell active="portfolio" virt={isVirt} userName={userName} session="실계좌 · 거래소 연동">
      <div className="mx-auto flex max-w-[1560px] flex-col gap-[18px]">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">내 실계좌</h1>
          <p className="mt-2 text-[14.5px] text-white/70">{userName} 항해사님의 실제 거래소 자산 (KIS · 업비트 · 비트겟)</p>
        </div>
        {error && <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3 text-[14px]" style={{ background: 'rgba(239,77,77,.1)', border: '1px solid rgba(239,77,77,.25)', color: '#fca5a5' }}><span>{error}</span><button onClick={() => load()} className="rounded-md px-3 py-1 text-[13px] font-semibold" style={{ border: '1px solid rgba(239,77,77,.35)', color: '#fca5a5' }}>다시 시도</button></div>}

        {/* 전체 실계좌 자산 */}
        {hasAny && (
          <Panel style={{ padding: '26px 28px' }}>
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-[11.5px] font-semibold tracking-[.2em]" style={{ color: SONAR }}>전체 실계좌 자산</span>
              <button onClick={() => { setTxns({}); load(); }} className="text-[12.5px]" style={{ color: 'var(--ci-ink2)' }}>↻ 새로고침</button>
            </div>
            <div className="text-[clamp(34px,5vw,50px)] font-bold leading-none tracking-tight">{won(totalAll)}</div>
            <div className="mt-3 font-mono text-[16px] font-semibold" style={{ color: pnlAll >= 0 ? UP : DOWN }}><Tri up={pnlAll >= 0} />{pnlAll >= 0 ? '+' : '-'}{won(Math.abs(pnlAll))} ({returnAll >= 0 ? '+' : ''}{returnAll.toFixed(2)}%)</div>
            <div className="mt-1 text-[11.5px]" style={{ color: 'var(--ci-ink3)' }}>수익률은 보유 자산 매입금 대비예요 (예수금 제외)</div>
            <div className="mt-5 grid grid-cols-3 divide-x" style={{ borderTop: '1px solid var(--ci-line)' }}>
              {EXCHANGES.map(e => { const c = isConn(e.key); return (
                <div key={e.key} className="px-4 pt-4" style={{ borderColor: 'var(--ci-line)' }}>
                  <div className="flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--ci-ink2)' }}>{c && <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#4ade80' }} />}{e.shortName} {e.asset}</div>
                  <div className="mt-1 font-mono text-[16px] font-semibold">{c ? won(portfolios[e.key]?.totalValue || 0) : <span style={{ color: 'var(--ci-ink3)' }}>미연결</span>}</div>
                </div>
              ); })}
            </div>
          </Panel>
        )}

        {/* 자산 추이 (일별 스냅샷 — ExchangeSnapshotScheduler가 매일 자정 KRW 합계 기록) */}
        {hasAny && (
          <Panel style={{ overflow: 'hidden' }}>
            <PanelHead kicker="VOYAGE LOG" title="자산 추이" right={
              <div className="flex items-center gap-2">
                <div className="flex gap-[3px] rounded-lg p-[3px]" style={{ background: 'var(--ci-card)', border: '1px solid var(--ci-line)' }}>
                  {([['value', '총 자산'], ['pct', '수익률 %']] as const).map(([k, l]) => (
                    <button key={k} onClick={() => setMode(k)} className="rounded-md px-2.5 py-[5px] text-[12.5px] font-semibold" style={{ background: mode === k ? 'rgba(91,157,255,.10)' : 'transparent', color: mode === k ? SONAR : 'var(--ci-ink2)' }}>{l}</button>
                  ))}
                </div>
                <RangeToggle range={range} onChange={setRange} />
                <span className="hidden text-[12px] text-white/50 lg:inline">{rangeCaption(history, range)} · 전체 거래소 합산(KRW)</span>
              </div>} />
            <div className="flex justify-end gap-4 px-3.5 pb-2 pt-2.5 text-[12px] text-white/70">
              <span className="inline-flex items-center gap-1.5"><span style={{ width: 14, height: 2, background: SONAR }} />내 실계좌</span>
              {chartKospi && <span className="inline-flex items-center gap-1.5"><span style={{ width: 14, borderTop: '2px dashed var(--ci-ink3)' }} />KOSPI</span>}
            </div>
            <div className="px-3 pb-[18px]" style={{ height: 250 }}>
              <TrendChart port={chartPort} kospi={chartKospi} dates={chart?.dates} mode={mode} days={history.length} real />
            </div>
            {chartKospi && <div className="px-[22px] pb-3 text-[11.5px]" style={{ color: 'var(--ci-ink3)' }}>* KOSPI 수익률은 실제 지수 일봉 데이터 기반입니다.</div>}
          </Panel>
        )}

        {/* 성과 지표 (스냅샷 기반 — MDD·샤프·알파. 승률 등 거래 기반 지표는 전체 체결 이력 연동 후) */}
        {hasAny && metrics && (
          <Panel>
            <PanelHead kicker="PERFORMANCE" title="성과 지표" right={
              /* 학습 노트는 VIRT 전용 라우트만 존재 — non-virt /learn은 404라 /virt/learn으로 보낸다 */
              <button onClick={() => navigate('/virt/learn?tab=glossary')} className="rounded-md px-2.5 py-1 text-[12px] font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white" style={{ border: '1px solid rgba(255,255,255,.22)' }}>
                용어가 궁금하면 → 학습 노트
              </button>
            } />
            <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-3">
              <MetricCard
                label="샤프 비율"
                value={metrics.sharpe != null ? metrics.sharpe.toFixed(2) : '—'}
                sub="≥1.0이면 양호"
                color={metrics.sharpe != null ? (metrics.sharpe >= 1 ? UP : metrics.sharpe >= 0 ? 'var(--ci-ink0)' : DOWN) : 'var(--ci-ink3)'}
                explain={sharpeExplain(metrics.sharpe)}
              />
              <MetricCard
                label="최대낙폭 (MDD)"
                value={`-${metrics.mdd.toFixed(1)}%`}
                sub="낮을수록 안전"
                color={metrics.mdd < 10 ? '#4ade80' : metrics.mdd < 20 ? 'var(--ci-ink0)' : DOWN}
                explain={mddExplain(metrics.mdd)}
              />
              <MetricCard
                label="KOSPI 대비 Alpha"
                value={metrics.alpha != null ? `${metrics.alpha >= 0 ? '+' : ''}${metrics.alpha.toFixed(1)}%p` : '—'}
                sub={metrics.alpha != null ? (metrics.alpha >= 0 ? 'KOSPI 초과' : 'KOSPI 하회') : 'KOSPI 데이터 없음'}
                color={metrics.alpha != null ? (metrics.alpha >= 0 ? UP : DOWN) : 'var(--ci-ink3)'}
                explain={alphaExplain(metrics.alpha)}
              />
            </div>
            <div className="px-5 pb-4 text-[11.5px]" style={{ color: 'var(--ci-ink3)' }}>
              * 매일 00:30 저장되는 총자산 스냅샷(전체 거래소 합산) 기준. 입출금이 있으면 수익률·지표가 왜곡될 수 있어요. 샤프 비율은 무위험수익률 3.5%/년 기준 연환산입니다.
            </div>
          </Panel>
        )}

        {/* 거래소 탭 */}
        <div className="flex flex-wrap gap-2">
          {EXCHANGES.map(e => { const on = activeTab === e.key, c = isConn(e.key); return (
            <button key={e.key} onClick={() => { autoPickRef.current = true; setActiveTab(e.key); try { localStorage.setItem(REAL_SRC_KEY, e.key); } catch { /* ignore */ } }} className="inline-flex items-center gap-2 rounded-[10px] px-[18px] py-2.5 text-[15px] font-semibold" style={{ border: on ? '1px solid rgba(91,157,255,.35)' : '1px solid var(--ci-line)', background: on ? 'rgba(91,157,255,.12)' : 'var(--ci-card)', color: 'var(--ci-ink0)' }}>
              {c && <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#4ade80' }} />}{e.shortName}<span className="text-[12px] font-medium" style={{ color: on ? '#cfe1ff' : 'var(--ci-ink2)' }}>{e.asset}</span>
            </button>
          ); })}
        </div>

        {!connected ? (
          <Panel style={{ padding: '48px 32px' }}>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'rgba(91,157,255,.1)', border: '1px solid rgba(91,157,255,.22)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={SONAR} strokeWidth="1.6" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></svg>
              </div>
              <h3 className="text-[18.5px] font-bold">{EXCHANGES.find(e => e.key === activeTab)?.shortName} 계좌가 연결되지 않았습니다</h3>
              <p className="mx-auto mt-2 max-w-[420px] text-[14px]" style={{ color: 'var(--ci-ink1)' }}>거래소 API 키를 등록하면 실제 보유 자산·잔고를 한 곳에서 확인할 수 있습니다. 키는 AES로 암호화되어 안전하게 저장됩니다.</p>
              <button onClick={() => openSetup(activeTab)} className="mt-5 rounded-[10px] px-5 py-3 text-[14.5px] font-semibold text-white" style={{ background: `linear-gradient(180deg, ${SONAR}, #2c6fe6)`, boxShadow: '0 10px 24px -10px rgba(60,120,255,.6)' }}>API 키 등록하기</button>
            </div>
          </Panel>
        ) : !port ? (
          <Panel style={{ padding: '48px 32px' }}><div className="text-center text-[14px]" style={{ color: 'var(--ci-ink3)' }}>{loading ? '실계좌 자산을 불러오는 중…' : '보유 자산 정보를 불러오지 못했습니다.'}</div></Panel>
        ) : (
          <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1.5fr_1fr]">
            <div className="flex flex-col gap-[18px]">
              {/* 통화 분리 토글 (해외 자산 보유 시) */}
              {hasForeign && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3" style={{ ...panel }}>
                  <div className="flex items-center gap-2.5">
                    <span className="text-[13.5px] font-semibold" style={{ color: 'var(--ci-ink1)' }}>통화 표시</span>
                    <div className="inline-flex rounded-lg p-0.5" style={{ background: 'var(--ci-card)', border: '1px solid var(--ci-line)' }}>
                      {([['통합', false], ['원화/해외 분리', true]] as const).map(([l, v]) => (
                        <button key={l} onClick={() => setSplitCcy(v)} className="rounded-md px-2.5 py-1 text-[12.5px] font-semibold" style={{ background: splitCcy === v ? 'rgba(91,157,255,.16)' : 'transparent', color: splitCcy === v ? SONAR : 'var(--ci-ink2)' }}>{l}</button>
                      ))}
                    </div>
                  </div>
                  {splitCcy && (
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[14px]">
                      <span>원화 <b className="font-semibold">{won(domesticValueKrw)}</b></span>
                      <span style={{ color: SONAR }}>해외 <b className="font-semibold">${foreignValueUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b> <span className="text-white/40">({won(foreignValueKrw)})</span></span>
                    </div>
                  )}
                </div>
              )}
              {/* 지표 카드 */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[['총 자산', won(port.totalValue), 'var(--ci-ink0)'], ['총 손익', `${port.totalProfitLoss >= 0 ? '+' : ''}${won(port.totalProfitLoss)}`, port.totalProfitLoss >= 0 ? UP : DOWN], ['수익률', `${port.totalReturnRate >= 0 ? '+' : ''}${port.totalReturnRate.toFixed(2)}%`, port.totalReturnRate >= 0 ? UP : DOWN], [cashLabel, won(port.cashBalance), 'var(--ci-ink0)']].map(([l, v, c]) => (
                  <div key={l} style={{ ...panel, padding: '16px 18px' }}><div className="text-[11.5px]" style={{ color: 'var(--ci-ink2)' }}>{l}</div><div className="mt-1.5 font-mono text-[17.5px] font-semibold" style={{ color: c }}>{v}</div></div>
                ))}
              </div>
              {/* 보유 종목 / 체결 내역 (페이퍼 포트폴리오의 HoldingsTrades와 동일한 탭 패턴) */}
              <Panel style={{ padding: 0, overflow: 'hidden' }}>
                <div className="grid grid-cols-2" style={{ borderBottom: '1px solid var(--ci-line)' }}>
                  {([['holdings', `보유 ${isStock ? '종목' : '코인'}`, holdings.length], ['txns', '체결 내역', Array.isArray(txnList) ? txnList.length : null]] as [typeof holdTab, string, number | null][]).map(([k, l, n], idx) => (
                    <button key={k} onClick={() => setHoldTab(k)} className="relative px-4 py-[15px] text-[15px]" style={{ color: holdTab === k ? 'var(--ci-ink0)' : 'var(--ci-ink2)', fontWeight: holdTab === k ? 700 : 500, borderRight: idx === 0 ? '1px solid var(--ci-line)' : undefined }}>
                      {l} {n != null && <span className="font-semibold text-white/48">({n})</span>}
                      {holdTab === k && <span className="absolute -bottom-px left-3.5 right-3.5 h-0.5 rounded" style={{ background: SONAR }} />}
                    </button>
                  ))}
                </div>
                {holdTab === 'holdings' ? (
                  holdings.length === 0 ? <div className="px-[22px] py-12 text-center text-[14px]" style={{ color: 'var(--ci-ink3)' }}>보유 자산이 없습니다.</div> : holdings.map((h, i) => {
                  const up = h.returnRate >= 0;
                  return (
                    <div key={h.assetCode} className="grid grid-cols-[1fr_auto] items-center gap-3.5 px-[22px] py-3.5" style={{ borderTop: i ? '1px solid var(--ci-line)' : undefined }}>
                      <div className="min-w-0"><div className="truncate text-[15px] font-semibold">{h.assetName}{h.currency === 'USD' && <span className="ml-1.5 rounded px-1 py-0.5 text-[10px] font-bold align-middle" style={{ background: 'rgba(91,157,255,.16)', color: SONAR }}>USD</span>}</div><div className="mt-0.5 font-mono text-[12px] text-white/48">{h.assetCode} · {fmtQty(h.quantity, isStock)} · 평단 {exMoney(h.averagePrice, h.currency)}</div></div>
                      <div className="text-right"><div className="font-mono text-[15px] font-bold">{exMoney(h.marketValue, h.currency)}</div><div className="mt-0.5 font-mono text-[13px] font-semibold" style={{ color: up ? UP : DOWN }}><Tri up={up} />{up ? '+' : ''}{h.returnRate.toFixed(2)}% <span className="text-white/40">({h.profitLoss >= 0 ? '+' : ''}{exMoney(h.profitLoss, h.currency)})</span></div></div>
                    </div>
                  );
                })
                ) : !TXN_SUPPORTED[activeTab] ? (
                  <div className="px-[22px] py-12 text-center">
                    <div className="text-[14px]" style={{ color: 'var(--ci-ink3)' }}>{EXCHANGES.find(e => e.key === activeTab)?.shortName} 체결 내역은 준비 중이에요.</div>
                    <div className="mt-1.5 text-[12.5px]" style={{ color: 'var(--ci-ink3)' }}>현재는 KIS(국내주식) 체결 내역만 확인할 수 있어요.</div>
                  </div>
                ) : txnList === undefined ? (
                  <div className="px-[22px] py-12 text-center text-[14px]" style={{ color: 'var(--ci-ink3)' }}>{txnLoading ? '체결 내역을 불러오는 중…' : '체결 내역을 준비하고 있어요…'}</div>
                ) : txnList === null ? (
                  <div className="px-[22px] py-12 text-center">
                    <div className="text-[14px]" style={{ color: 'var(--ci-ink3)' }}>체결 내역을 불러오지 못했어요.</div>
                    <button onClick={() => setTxns(prev => ({ ...prev, [activeTab]: undefined }))} className="mt-3 rounded-lg px-4 py-2 text-[13.5px] font-semibold" style={{ border: '1px solid rgba(91,157,255,.32)', background: 'rgba(91,157,255,.10)', color: SONAR }}>다시 시도 ↻</button>
                  </div>
                ) : txnList.length === 0 ? (
                  <div className="px-[22px] py-12 text-center text-[14px]" style={{ color: 'var(--ci-ink3)' }}>최근 30일 체결 내역이 없습니다.</div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse" style={{ minWidth: 560 }}>
                        <thead><tr>{['시간', '구분', '종목', '수량', '체결가', '체결금액'].map(h => <th key={h} className="px-[18px] py-3 text-left text-[12px] font-semibold uppercase tracking-[.1em] text-white/48" style={{ borderBottom: '1px solid var(--ci-line)' }}>{h}</th>)}</tr></thead>
                        <tbody>{txnList.map((t, i) => { const buy = t.side === 'BUY', filled = t.status === 'FILLED'; return (
                          <tr key={`${t.orderId}-${i}`}>
                            <td className="font-mono text-[14px]" style={td}>{fmtTxnTime(t.executedAt)}</td>
                            <td style={td}><span className="rounded px-2 py-0.5 text-[12px] font-bold" style={{ color: buy ? UP : DOWN, background: buy ? 'rgba(239,77,77,.12)' : 'rgba(77,138,255,.12)' }}>{buy ? '매수' : '매도'}</span>{!filled && <span className="ml-1.5 rounded px-1.5 py-0.5 text-[11px] font-bold" style={{ background: 'rgba(245,208,97,.14)', color: '#f5d061' }}>미체결</span>}</td>
                            <td className="text-[14px]" style={td}><span className="font-semibold">{t.stockName || t.stockCode}</span> <span className="font-mono text-[12px] text-white/40">{t.stockCode}</span></td>
                            <td className="font-mono text-[14px]" style={td}>{filled ? `${Math.floor(t.quantity).toLocaleString('ko-KR')}주` : '—'}</td>
                            <td className="font-mono text-[14px]" style={td}>{filled ? won(t.price) : '—'}</td>
                            <td className="font-mono text-[14px]" style={td}>{filled ? won(t.totalAmount) : '—'}</td>
                          </tr>); })}</tbody>
                      </table>
                    </div>
                    <div className="px-[18px] py-3 text-[11.5px]" style={{ color: 'var(--ci-ink3)' }}>* KIS 국내주식 주문·체결 기준, 최근 30일. 해외주식 체결 내역은 추후 지원돼요.</div>
                  </>
                )}
              </Panel>
            </div>
            <div className="flex flex-col gap-[18px]">
              {/* 자산 배분 */}
              {alloc.length > 0 && (
                <Panel style={{ padding: '22px' }}>
                  <div className="mb-3.5 text-[11.5px] font-semibold tracking-[.2em] text-white/48">자산 배분</div>
                  <div className="grid grid-cols-[130px_1fr] items-center gap-4">
                    <div style={{ width: 130, height: 130 }}><Donut items={alloc} total={allocTotal} /></div>
                    <ul className="m-0 flex list-none flex-col gap-2.5 p-0">{alloc.map((a, i) => (
                      <li key={i} className="flex items-center gap-2 text-[13px]">
                        <span className="h-[9px] w-[9px] shrink-0 rounded-full" style={{ background: a.c }} />
                        <span className="truncate">{a.label}</span>
                        <span className="ml-1.5 shrink-0 font-mono font-semibold" style={{ color: 'var(--ci-ink1)' }}>{((a.value / (allocTotal || 1)) * 100).toFixed(1)}%</span>
                      </li>
                    ))}</ul>
                  </div>
                </Panel>
              )}
              {/* 연결 정보 */}
              <Panel style={{ padding: '20px 22px' }}>
                <div className="mb-3 text-[11.5px] font-semibold tracking-[.2em] text-white/48">연결 정보</div>
                <div className="flex items-center justify-between text-[13.5px]"><span style={{ color: 'var(--ci-ink2)' }}>API Key</span><span className="font-mono">{(accounts.find(a => a.exchangeType === activeTab)?.apiKey) || '****'}</span></div>
                {isStock && <div className="mt-2 flex items-center justify-between text-[13.5px]"><span style={{ color: 'var(--ci-ink2)' }}>계좌번호</span><span className="font-mono">{accounts.find(a => a.exchangeType === activeTab)?.accountNumber || '—'}</span></div>}
                <div className="mt-4 flex gap-2">
                  <button onClick={() => openSetup(activeTab)} className="flex-1 rounded-lg py-2 text-[13.5px] font-semibold" style={{ border: '1px solid var(--ci-line)', background: 'var(--ci-card)', color: 'var(--ci-ink1)' }}>키 수정</button>
                  <button onClick={() => handleDisconnect(activeTab)} className="flex-1 rounded-lg py-2 text-[13.5px] font-semibold" style={{ border: '1px solid rgba(239,77,77,.3)', color: UP }}>연결 해제</button>
                </div>
                <p className="mt-3 text-[11.5px]" style={{ color: 'var(--ci-ink3)' }}>* 키는 읽기 전용 권한만 사용합니다. 체결 내역은 보유 종목 패널의 '체결 내역' 탭에서 볼 수 있어요.</p>
              </Panel>
            </div>
          </div>
        )}

        {/* 빠른 액션 — 페이퍼와 동일한 CSV 내보내기 (클라이언트 생성) */}
        {hasAny && (
          <Panel style={{ padding: '16px 22px' }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-[13px] font-semibold tracking-[.08em]" style={{ color: 'var(--ci-ink2)' }}>빠른 액션</span>
              <div className="flex flex-wrap gap-2">
                <button onClick={exportHoldingsCsv} className="rounded-lg px-3.5 py-2 text-[13.5px] font-semibold" style={{ border: '1px solid var(--ci-line)', background: 'var(--ci-card)', color: 'var(--ci-ink1)' }}>보유 자산 CSV</button>
                {isConn('KIS') && <button onClick={exportTxnsCsv} disabled={txnExporting} className="rounded-lg px-3.5 py-2 text-[13.5px] font-semibold disabled:opacity-50" style={{ border: '1px solid var(--ci-line)', background: 'var(--ci-card)', color: 'var(--ci-ink1)' }}>{txnExporting ? '다운로드 중…' : '체결 내역 CSV (KIS)'}</button>}
              </div>
            </div>
          </Panel>
        )}

        {!hasAny && !loading && !error && (
          <Panel style={{ padding: '16px 22px' }}><div className="text-center text-[13.5px]" style={{ color: 'var(--ci-ink3)' }}>연결된 실계좌가 없습니다. 위 거래소 탭에서 API 키를 등록해보세요.</div></Panel>
        )}

        <ConsoleFooter note="실계좌 데이터는 거래소 API 기준입니다." />
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
