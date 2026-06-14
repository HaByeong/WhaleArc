import { useEffect, useMemo, useRef, useState, forwardRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRoutePrefix, useVirtNavigate } from '../hooks/useRoutePrefix';
import HelmShell from '../components/HelmShell';
import { mirrorService, type MirrorCapture } from '../services/mirrorService';

/* 유리병 편지 (Message in a Bottle) — 흔들린 순간을 봉인했다가, 며칠 뒤 "참아서 지킨 길"을 축하한다.
   리프레임: 수치심이 아니라 규율을 칭찬. 단 정직함은 유지(운 좋은 날·충동 따른 날도 솔직히). */

const UP = '#ef4d4d', DOWN = '#4d8aff', COMPASS = '#f5d061', ACCENT = '#2c6fe6';
const SONAR = 'var(--ci-sonar)', SONAR_DIM = 'var(--ci-sonar-dim)', SONAR_GLOW = 'rgba(91,157,255,.22)';
const INK0 = 'var(--ci-ink0)', INK1 = 'var(--ci-ink1)', INK2 = 'var(--ci-ink2)', INK3 = 'var(--ci-ink3)';
const HAIR = 'var(--ci-line)', HAIRS = 'var(--ci-line-strong)';
const ABYSS = 'var(--ci-inset)', CARD = 'rgba(255,255,255,.03)';

/* 인내심 상위 N% 노출 여부 — 단일 소스(히어로·개봉 카드·규율 패널 공유).
   출시 초기엔 비교할 코호트가 없어 상위%가 허수이므로 false → 스트릭으로 대체(정직성 원칙).
   유저풀이 쌓이면 true로 켜면 3곳이 한꺼번에 상위% 표기로 전환된다. */
const SHOW_RANK = false;

/* ── 공유 SVG defs (gradients) — 한 번만 렌더 ── */
const BottleDefs = () => (
  <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
    <defs>
      <linearGradient id="wa-glass" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#cfe8ff" stopOpacity=".6" /><stop offset=".45" stopColor="#5b9dff" stopOpacity=".26" /><stop offset="1" stopColor="#2c6fe6" stopOpacity=".42" />
      </linearGradient>
      <linearGradient id="wa-paper" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fbf3da" /><stop offset="1" stopColor="#e9d9ad" /></linearGradient>
      <linearGradient id="wa-cork" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c79a64" /><stop offset="1" stopColor="#9a6f3f" /></linearGradient>
      <radialGradient id="wa-halo" cx="50%" cy="42%" r="55%"><stop offset="0" stopColor="#5b9dff" stopOpacity=".5" /><stop offset="1" stopColor="#5b9dff" stopOpacity="0" /></radialGradient>
      <linearGradient id="wa-wave" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#2c6fe6" stopOpacity="0" /><stop offset=".5" stopColor="#5b9dff" stopOpacity=".55" /><stop offset="1" stopColor="#2c6fe6" stopOpacity="0" /></linearGradient>
    </defs>
  </svg>
);

const Bottle = ({ size = 64, halo = true, tilt = 0 }: { size?: number; halo?: boolean; tilt?: number }) => (
  <svg width={size} height={size * 1.5} viewBox="0 0 64 96" fill="none" style={{ transform: `rotate(${tilt}deg)`, overflow: 'visible' }}>
    {halo && <ellipse cx="32" cy="50" rx="34" ry="40" fill="url(#wa-halo)" />}
    <rect x="25" y="2.5" width="14" height="11.5" rx="3.2" fill="url(#wa-cork)" />
    <rect x="25" y="2.5" width="14" height="3.4" rx="1.7" fill="#ddb784" opacity=".8" />
    <path d="M27 13 L27 25 Q15 29.5 15 50 L15 73 Q15 88 32 88 Q49 88 49 73 L49 50 Q49 29.5 37 25 L37 13 Z" fill="url(#wa-glass)" stroke="rgba(180,215,255,.85)" strokeWidth="1.4" />
    <g transform="rotate(-9 32 64)">
      <rect x="21" y="50" width="22" height="26" rx="4" fill="url(#wa-paper)" />
      <rect x="21" y="50" width="22" height="26" rx="4" fill="none" stroke="rgba(154,111,63,.35)" strokeWidth="1" />
      <path d="M25 57h14M25 61h14M25 65h10" stroke="rgba(120,86,48,.5)" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M28 70.5q4 2.4 8 0" stroke="#2c6fe6" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity=".7" />
    </g>
    <path d="M21 33 Q18 50 20 70" stroke="rgba(255,255,255,.7)" strokeWidth="2" strokeLinecap="round" fill="none" opacity=".6" />
    <circle cx="40" cy="40" r="2.4" fill="rgba(255,255,255,.55)" />
  </svg>
);

const WaveLine = ({ height = 22, opacity = 1 }: { height?: number; opacity?: number }) => (
  <svg viewBox="0 0 240 24" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height, opacity }}>
    <path d="M0 12 Q15 2 30 12 T60 12 T90 12 T120 12 T150 12 T180 12 T210 12 T240 12" fill="none" stroke="url(#wa-wave)" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

type GlyphKind = 'compass' | 'fear' | 'greed' | 'info' | 'lock' | 'shield' | 'flame' | 'medal' | 'sparkle' | 'share' | 'anchor' | 'heart' | 'bottle';
const MiniGlyph = ({ kind, c = 'currentColor', s = 16 }: { kind: GlyphKind; c?: string; s?: number }) => {
  const p: Record<GlyphKind, React.ReactNode> = {
    compass: <><circle cx="11" cy="11" r="8" stroke={c} strokeWidth="1.5" /><path d="M14.5 7.5 11.8 11.8 7.5 14.5 10.2 10.2Z" fill={c} /></>,
    fear: <><circle cx="11" cy="11" r="8" stroke={c} strokeWidth="1.5" /><circle cx="8" cy="9.5" r="1.1" fill={c} /><circle cx="14" cy="9.5" r="1.1" fill={c} /><path d="M7.5 15q3.5-3 7 0" stroke={c} strokeWidth="1.5" fill="none" strokeLinecap="round" /></>,
    greed: <><circle cx="11" cy="11" r="8" stroke={c} strokeWidth="1.5" /><path d="M7.5 8.5 9.5 10M14.5 8.5 12.5 10" stroke={c} strokeWidth="1.5" strokeLinecap="round" /><path d="M7.5 13q3.5 3 7 0" stroke={c} strokeWidth="1.5" fill="none" strokeLinecap="round" /></>,
    info: <><circle cx="11" cy="11" r="8" stroke={c} strokeWidth="1.5" /><path d="M11 10v4.5" stroke={c} strokeWidth="1.6" strokeLinecap="round" /><circle cx="11" cy="7.3" r="1" fill={c} /></>,
    lock: <><rect x="5.5" y="9.5" width="11" height="8" rx="2" stroke={c} strokeWidth="1.5" /><path d="M8 9.5V7.5a3 3 0 0 1 6 0v2" stroke={c} strokeWidth="1.5" /></>,
    shield: <><path d="M11 2.5 17.5 5v5.2c0 4.2-2.8 7.2-6.5 9-3.7-1.8-6.5-4.8-6.5-9V5z" stroke={c} strokeWidth="1.5" fill="none" strokeLinejoin="round" /><path d="M8 11l2 2 4-4.2" stroke={c} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></>,
    flame: <path d="M11 2.5s4.5 3.6 4.5 8.2A4.5 4.5 0 0 1 11 19a4.5 4.5 0 0 1-4.5-4.5c0-1.6.8-2.7 1.6-3.6.2 1 .9 1.7 1.7 1.9-.5-2.3.9-4.6 1.7-6.3z" stroke={c} strokeWidth="1.5" fill="none" strokeLinejoin="round" />,
    medal: <><circle cx="11" cy="13" r="5" stroke={c} strokeWidth="1.5" /><path d="M8 8.5 6 3h3l1.5 3M14 8.5 16 3h-3l-1.5 3" stroke={c} strokeWidth="1.4" fill="none" strokeLinejoin="round" /><path d="M9.4 13l1.1 1.1 2.2-2.3" stroke={c} strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></>,
    sparkle: <path d="M11 3l1.6 4.8L17.4 9.4 12.6 11 11 15.8 9.4 11 4.6 9.4 9.4 7.8z" stroke={c} strokeWidth="1.4" fill="none" strokeLinejoin="round" />,
    share: <><circle cx="6" cy="11" r="2.2" stroke={c} strokeWidth="1.5" /><circle cx="15.5" cy="5.5" r="2.2" stroke={c} strokeWidth="1.5" /><circle cx="15.5" cy="16.5" r="2.2" stroke={c} strokeWidth="1.5" /><path d="M7.9 9.9 13.6 6.6M7.9 12.1 13.6 15.4" stroke={c} strokeWidth="1.5" strokeLinecap="round" /></>,
    anchor: <><circle cx="11" cy="5" r="2" stroke={c} strokeWidth="1.5" /><path d="M11 7v11M6 11.5C6 15 8 17.5 11 18c3-.5 5-3 5-6.5M7.5 11H4.5M14.5 11h3" stroke={c} strokeWidth="1.5" fill="none" strokeLinecap="round" /></>,
    heart: <path d="M11 17.5C6 14 3.5 11 3.5 8.2A3.5 3.5 0 0 1 11 6a3.5 3.5 0 0 1 7.5 2.2c0 2.8-2.5 5.8-7.5 9.3z" stroke={c} strokeWidth="1.5" fill="none" strokeLinejoin="round" />,
    bottle: <><rect x="9" y="2.5" width="4" height="3.2" rx="1" stroke={c} strokeWidth="1.4" /><path d="M9 5.7V8Q5.7 9.2 5.7 13.3V16.4Q5.7 19.3 11 19.3Q16.3 19.3 16.3 16.4V13.3Q16.3 9.2 13 8V5.7" stroke={c} strokeWidth="1.4" fill="none" strokeLinejoin="round" /><path d="M8.6 12.8h4.8M8.6 15h3.2" stroke={c} strokeWidth="1.2" strokeLinecap="round" /></>,
  };
  return <svg width={s} height={s} viewBox="0 0 22 22" fill="none">{p[kind]}</svg>;
};

const Sparkles = ({ spots }: { spots: [number, number, number, number][] }) => (
  <>
    {spots.map(([x, y, s, delay], i) => (
      <span key={i} aria-hidden style={{ position: 'absolute', left: x, top: y, color: '#9cc1ff', pointerEvents: 'none', animation: `twinkle 2.8s ease-in-out ${delay}s infinite` }}>
        <MiniGlyph kind="sparkle" c="#9cc1ff" s={s} />
      </span>
    ))}
  </>
);

const Tri = ({ up }: { up: boolean }) => (
  <span style={{ display: 'inline-block', width: 0, height: 0, marginRight: 3, verticalAlign: 'middle', borderLeft: '3.5px solid transparent', borderRight: '3.5px solid transparent', ...(up ? { borderBottom: '5px solid currentColor' } : { borderTop: '5px solid currentColor' }) }} />
);

const Intensity = ({ n, tone }: { n: number; tone: string }) => (
  <span style={{ display: 'inline-flex', gap: 3, verticalAlign: 'middle' }}>
    {[1, 2, 3, 4, 5].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i <= n ? tone : HAIRS }} />)}
  </span>
);

const Sparkline = ({ data, color, idKey }: { data: number[]; color: string; idKey?: string }) => {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data, 0), max = Math.max(...data, 0), span = (max - min) || 1;
  const X = (i: number) => (i / (data.length - 1)) * 100;
  const Y = (v: number) => 38 - ((v - min) / span) * 34 - 2;
  const line = data.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  const zeroY = Y(0).toFixed(1);
  const gid = 'spk-' + (idKey || color).replace(/[^a-z0-9]/gi, '');
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" style={{ width: '100%', height: 82, display: 'block' }}>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".22" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <line x1="0" y1={zeroY} x2="100" y2={zeroY} stroke={INK3} strokeWidth=".5" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
      <polygon points={`0,40 ${line} 100,40`} fill={`url(#${gid})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx="100" cy={Y(data[data.length - 1])} r="2.6" fill={color} vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

const SEA_PANEL = 'linear-gradient(180deg, rgba(91,157,255,.055), transparent 55%), var(--ci-panel)';
const Panel = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <section style={{ background: SEA_PANEL, border: `1px solid ${HAIR}`, borderRadius: 16, boxShadow: 'var(--ci-panel-shadow)', overflow: 'hidden', ...style }}>{children}</section>
);

/* ── helpers ── */
const fmtMan = (krw: number) => {
  const man = krw / 10000;
  const s = Math.abs(man) >= 100 ? Math.round(man).toLocaleString('ko-KR') : man.toFixed(1);
  return `${man > 0 ? '+' : man < 0 ? '−' : ''}${s.replace('-', '')}만원`;
};
const wonSigned = (krw: number) => (Math.abs(krw) < 1 ? '0원' : fmtMan(krw));
const fmtWon = (krw: number) => '₩' + Math.round(krw).toLocaleString('ko-KR');
const fmtPct = (p: number) => `${p > 0 ? '+' : ''}${p.toFixed(1)}%`;
const fmtDate = (iso: string) => { const d = new Date(iso); return `${d.getMonth() + 1}.${d.getDate()}`; };
const daysLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
const triMeta = (t: string) => t === 'FOMO_SPIKE'
  ? { wave: '탐욕의 파도', glyph: 'greed' as GlyphKind, tone: COMPASS, dim: 'rgba(245,208,97,.14)', face: '🤤' }
  : { wave: '공포의 파도', glyph: 'fear' as GlyphKind, tone: DOWN, dim: 'rgba(77,138,255,.14)', face: '😨' };

/* ── view model ── */
type BottleVM = {
  id: string; trigger: string; side: 'SELL' | 'BUY'; asset: string; symbol: string;
  changeRate: number; sealPrice: number; amountKrw: number; note: string; intensity: number;
  choice: 'FOLLOW_RULE' | 'FOLLOW_IMPULSE'; impulsePct: number; rulePct: number;
  strategy: string | null; path: number[]; capturedAt: string; revealAt: string; isSample?: boolean;
};
const toVM = (c: MirrorCapture): BottleVM => ({
  id: c.id, trigger: c.triggerType, side: c.impulseSide === 'BUY' ? 'BUY' : 'SELL',
  asset: c.assetName || c.assetSymbol, symbol: c.assetSymbol, changeRate: c.changeRateAtEvent ?? 0,
  sealPrice: c.priceAtEvent ?? 0, amountKrw: c.amountKrwAtEvent || 0, note: c.emotionNote || '',
  intensity: c.emotionIntensity ?? 0, choice: c.userChoice, impulsePct: c.impulseOutcomePct ?? 0,
  rulePct: c.ruleOutcomePct ?? 0, strategy: c.strategyName || null, path: c.pathPct || [],
  capturedAt: c.capturedAt, revealAt: c.revealAt,
});

/* 개봉 상태 — 규율(참은 길)의 우위로 분기. FOLLOW_IMPULSE(충동 따름)는 별도 처리. */
type RevealState = 'WIN' | 'LUCKY' | 'NEUTRAL' | 'GAVE_IN';
const revealStateOf = (b: BottleVM): RevealState => {
  if (b.choice === 'FOLLOW_IMPULSE') return 'GAVE_IN';
  const diff = b.rulePct - b.impulsePct;
  if (diff >= 1.0) return 'WIN';
  if (diff <= -1.0) return 'LUCKY';
  return 'NEUTRAL';
};

/* 빈 상태 미리보기 — '이렇게 채워진다'를 보여주는 예시 */
const _iso = (dayOffset: number) => new Date(Date.now() + dayOffset * 86400000).toISOString();
const SAMPLE_DRIFT: BottleVM = {
  id: 'sample-drift', trigger: 'FOMO_SPIKE', side: 'BUY', asset: '에코프로', symbol: '086520',
  changeRate: 17.2, sealPrice: 128500, amountKrw: 1500000, note: '지금 안 사면 영영 놓칠 것 같았다', intensity: 5,
  choice: 'FOLLOW_RULE', impulsePct: 0, rulePct: 0, strategy: null, path: [],
  capturedAt: _iso(-3), revealAt: _iso(4), isSample: true,
};
const SAMPLE_VM: BottleVM = {
  id: 'sample', trigger: 'PANIC_DROP', side: 'SELL', asset: '비트코인', symbol: 'BTC',
  changeRate: -6.2, sealPrice: 86000000, amountKrw: 1500000, note: '더 떨어질 것 같아 무서웠다', intensity: 4,
  choice: 'FOLLOW_RULE', impulsePct: 0, rulePct: 8.5, strategy: '골든크로스 추종 전략',
  path: [0, -1.4, -2.1, -0.6, 1.8, 4.2, 6.1, 8.5], capturedAt: '2026-05-21', revealAt: '2026-05-28', isSample: true,
};

/* ── 규율 데이터 (실 캡처에서 계산) ── */
type DiscData = {
  score: number; resistRate: number; streak: number; bestStreak: number;
  resisted: number; totalTriggers: number; defendedKrw: number; rankPct: number;
  monthDefendedKrw: number; monthResisted: number;
};
type Badge = { id: string; icon: GlyphKind; label: string; desc: string; earned: boolean };
type Resil = { label: string; sub: string; total: number; resisted: number };
const savedOf = (c: MirrorCapture) => Math.max(0, ((c.ruleOutcomePct ?? 0) - (c.impulseOutcomePct ?? 0)) * (c.amountKrwAtEvent || 0) / 100);

const computeDiscipline = (list: MirrorCapture[]): { d: DiscData; badges: Badge[]; resil: { fear: Resil; greed: Resil } } => {
  const caps = [...list].sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime());
  const total = caps.length;
  const ruleFlags = caps.map(c => c.userChoice === 'FOLLOW_RULE');
  const resisted = ruleFlags.filter(Boolean).length;
  const resistRate = total ? Math.round((resisted / total) * 100) : 0;

  let defendedKrw = 0;
  caps.forEach(c => { if (c.revealed && c.userChoice === 'FOLLOW_RULE') defendedKrw += savedOf(c); });

  let streak = 0;
  for (let i = ruleFlags.length - 1; i >= 0; i--) { if (ruleFlags[i]) streak++; else break; }
  let bestStreak = 0, run = 0;
  ruleFlags.forEach(r => { if (r) { run++; bestStreak = Math.max(bestStreak, run); } else run = 0; });

  const now = new Date(); const ym = now.getFullYear() * 100 + now.getMonth();
  const monthCaps = caps.filter(c => { const d = new Date(c.capturedAt); return d.getFullYear() * 100 + d.getMonth() === ym; });
  const monthResisted = monthCaps.filter(c => c.userChoice === 'FOLLOW_RULE').length;
  let monthDefendedKrw = 0;
  monthCaps.forEach(c => { if (c.revealed && c.userChoice === 'FOLLOW_RULE') monthDefendedKrw += savedOf(c); });

  // 인내 점수 = 참은 비율 70% + 최고 연속기록 30% (10회 만점) — 정직·고정 공식
  const streakScore = Math.min(100, (bestStreak / 10) * 100);
  const score = total ? Math.min(100, Math.round(resistRate * 0.7 + streakScore * 0.3)) : 0;
  const rankPct = 0; // SHOW_RANK=false 동안 미사용 (코호트 데이터 생기면 서버에서 주입)

  const panicResisted = caps.filter(c => c.triggerType === 'PANIC_DROP' && c.userChoice === 'FOLLOW_RULE').length;
  const weekAgo = Date.now() - 7 * 86400000;
  const recentCaps = caps.filter(c => new Date(c.capturedAt).getTime() >= weekAgo);
  const recentImpulse = recentCaps.filter(c => c.userChoice === 'FOLLOW_IMPULSE').length;
  const badges: Badge[] = [
    { id: 'calm', icon: 'shield', label: '폭풍 속 평정', desc: '급락에 4번 버팀', earned: panicResisted >= 4 },
    { id: 'streak', icon: 'flame', label: '꾸준한 항해', desc: '연속 7회 규칙 준수', earned: bestStreak >= 7 },
    { id: 'defender', icon: 'medal', label: '백만 방어', desc: '누적 ₩100만 지켜냄', earned: defendedKrw >= 1_000_000 },
    { id: 'zen', icon: 'sparkle', label: '무념무상', desc: '한 주간 충동 0회', earned: recentCaps.length > 0 && recentImpulse === 0 },
  ];

  const mk = (key: string, label: string, sub: string): Resil => {
    const items = caps.filter(c => c.triggerType === key);
    return { label, sub, total: items.length, resisted: items.filter(c => c.userChoice === 'FOLLOW_RULE').length };
  };
  const resil = { fear: mk('PANIC_DROP', '공포의 파도', '급락에 팔고 싶어진 순간'), greed: mk('FOMO_SPIKE', '탐욕의 파도', '급등에 사고 싶어진 순간') };

  return { d: { score, resistRate, streak, bestStreak, resisted, totalTriggers: total, defendedKrw, rankPct, monthDefendedKrw, monthResisted }, badges, resil };
};

const whaleTagFull = (d: DiscData) => `🐋 인내심 상위 ${d.rankPct}%`;
const whaleTagAlt = (d: DiscData) => `🐋 ${d.streak}회 연속 항해 중`;
const heroSubFull = (d: DiscData) => `인내심 상위 ${d.rankPct}%의 고래`;
const heroSubAlt = (d: DiscData) => `${d.streak}회 연속 규칙을 지킨 고래`;

/* ── HERO — 방어 톤 (지켜낸 가치 · 인내 점수 · 공유) ── */
const Hero = ({ d, onShare, showRank, canShare }: { d: DiscData; onShare: () => void; showRank: boolean; canShare: boolean }) => (
  <Panel style={{ position: 'relative' }}>
    <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(120% 130% at 88% 0%, ${SONAR_GLOW}, transparent 55%)` }} />
    <svg aria-hidden viewBox="0 0 200 200" style={{ position: 'absolute', right: 64, top: '52%', transform: 'translateY(-50%)', width: 300, height: 300, opacity: .12, pointerEvents: 'none' }}>
      {[40, 68, 96].map(r => <circle key={r} cx="100" cy="100" r={r} fill="none" stroke={SONAR} strokeWidth="1" />)}
    </svg>
    <Sparkles spots={[[300, 40, 15, 0], [340, 120, 12, 1.1], [270, 150, 16, .6]]} />
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 24, padding: '32px 32px 28px', flexWrap: 'wrap' }}>
      <div style={{ flexShrink: 0, animation: 'float-y 5.5s ease-in-out infinite' }}><Bottle size={84} tilt={-12} /></div>
      <div style={{ flex: 1, minWidth: 280 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
          <span style={{ fontSize: 10.5, letterSpacing: '.24em', fontWeight: 700, color: SONAR, whiteSpace: 'nowrap' }}>MESSAGE IN A BOTTLE</span>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: SONAR, boxShadow: `0 0 8px ${SONAR}`, animation: 'bottle-dot 2.4s ease-in-out infinite' }} />
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.02em', lineHeight: 1.15, color: INK0 }}>유리병 편지</h1>
        <p style={{ margin: '12px 0 0', fontSize: 14, lineHeight: 1.7, color: INK1, maxWidth: 560 }}>
          흔들렸지만 <strong style={{ color: INK0 }}>다시 잡은 순간</strong>을 유리병에 담아 띄워두면, 며칠 뒤 파도가 <strong style={{ color: INK0 }}>참아서 지켜낸 가치</strong>를 실어다 줍니다.
        </p>
        <p style={{ margin: '8px 0 0', fontSize: 12.5, color: INK2, fontStyle: 'italic' }}>🐋 칭찬하는 건 수익이 아니라 당신의 <b style={{ fontStyle: 'normal', color: INK1 }}>인내</b>예요.</p>
        {canShare && (
          <button onClick={onShare} style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 11, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: SONAR, background: SONAR_DIM, border: '1px solid rgba(91,157,255,.3)' }}>
            <MiniGlyph kind="share" c={SONAR} s={15} /> 내 고래 카드 자랑하기
          </button>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 200 }}>
        <HeroStat label="지켜낸 가치 · 이번 달" value={fmtWon(d.monthDefendedKrw)} tone={DOWN} sub={`충동을 ${d.monthResisted}번 다시 잡았어요`} hero />
        <HeroStat label="인내 점수" value={`${d.score}점`} tone={SONAR} sub={showRank ? heroSubFull(d) : heroSubAlt(d)} />
      </div>
    </div>
    <WaveLine height={20} />
  </Panel>
);
const HeroStat = ({ label, value, tone, sub, hero }: { label: string; value: string; tone: string; sub: string; hero?: boolean }) => (
  <div style={{ position: 'relative', overflow: 'hidden', padding: '13px 16px', borderRadius: 13, background: hero ? 'linear-gradient(120deg, rgba(91,157,255,.14), rgba(91,157,255,.04))' : CARD, border: hero ? '1px solid rgba(91,157,255,.32)' : `1px solid ${HAIR}` }}>
    <div style={{ fontSize: 11, color: INK2 }}>{label}</div>
    <div className="font-mono" style={{ fontSize: 21, fontWeight: 800, color: tone, marginTop: 3, letterSpacing: '-.01em' }}>{value}</div>
    <div style={{ fontSize: 10.5, color: INK3, marginTop: 3 }}>{sub}</div>
  </div>
);

/* ── 표류 중 (sealed) ── */
const DriftCard = ({ b }: { b: BottleVM }) => {
  const m = triMeta(b.trigger);
  const total = Math.max(1, Math.round((new Date(b.revealAt).getTime() - new Date(b.capturedAt).getTime()) / 86400000));
  const passed = Math.round((Date.now() - new Date(b.capturedAt).getTime()) / 86400000);
  const rawProg = (passed / total) * 100;
  const prog = Number.isFinite(rawProg) ? Math.min(100, Math.max(4, rawProg)) : 4;
  const dleft = daysLeft(b.revealAt);
  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 16, padding: '18px 20px', background: SEA_PANEL, border: `1px solid ${HAIR}`, display: 'flex', gap: 16, alignItems: 'stretch' }}>
      <span aria-hidden style={{ flexShrink: 0, display: 'flex', width: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', background: `linear-gradient(180deg, ${m.dim}, transparent)`, border: `1px solid ${m.tone}26` }}>
        <span style={{ animation: 'float-y 6s ease-in-out infinite' }}><Bottle size={30} halo={false} tilt={6} /></span>
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 13 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, color: m.tone, background: m.dim, border: `1px solid ${m.tone}33`, whiteSpace: 'nowrap' }}>
            <MiniGlyph kind={m.glyph} c={m.tone} s={14} />{m.wave}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: INK2, whiteSpace: 'nowrap' }}><MiniGlyph kind="lock" s={13} /> 봉인됨</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap', color: INK0 }}>{b.asset}</span>
          <span className="font-mono" style={{ fontSize: 11.5, color: INK2 }}>{b.symbol}</span>
          <span className="font-mono" style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 600, color: b.changeRate > 0 ? UP : DOWN }}><Tri up={b.changeRate > 0} />{fmtPct(b.changeRate)}</span>
        </div>
        {b.note && <p style={{ margin: '12px 0 0', fontSize: 13.5, color: INK0, lineHeight: 1.5 }}>“{b.note}”</p>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <span style={{ fontSize: 11.5, color: INK2, whiteSpace: 'nowrap' }}>감정 강도</span>
          <Intensity n={b.intensity} tone={m.tone} />
          <span style={{ marginLeft: 'auto', fontSize: 11.5, color: INK2, whiteSpace: 'nowrap' }}>{b.side === 'SELL' ? '매도' : '매수'} {wonSigned(b.amountKrw).replace(/[+−]/, '')} 봉인</span>
        </div>
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: INK2, marginBottom: 6 }}>
            <span>띄운 날 {fmtDate(b.capturedAt)}</span>
            <span style={{ color: SONAR, fontWeight: 600, whiteSpace: 'nowrap' }}>D-{dleft} · {fmtDate(b.revealAt)} 개봉</span>
          </div>
          <div style={{ position: 'relative', height: 6, borderRadius: 99, background: ABYSS, border: `1px solid ${HAIR}`, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${prog}%`, background: `linear-gradient(90deg, ${ACCENT}, ${SONAR})` }} />
            <span style={{ position: 'absolute', top: '50%', left: `${prog}%`, transform: 'translate(-50%,-50%)', display: 'flex', color: SONAR }}><MiniGlyph kind="bottle" c={SONAR} s={13} /></span>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── 도착 (revealed) — 규율을 축하하는 3+1 상태 ── */
const STATE_META: Record<RevealState, { kicker: string; msg: string; msgTone: string; bannerBg: string; bannerBorder: string; celebrate: boolean }> = {
  WIN: { kicker: '참아서 지켜냈어요', msg: '잘 참았어요. 인내가 이겼습니다 🐋', msgTone: DOWN, bannerBg: 'rgba(77,138,255,.08)', bannerBorder: 'rgba(77,138,255,.24)', celebrate: true },
  LUCKY: { kicker: '이번엔 충동이 맞았을 거예요', msg: '운이 좋았던 날이에요. 그래도 길게 보면 규칙이 이겨요 — 참은 건 여전히 잘한 일이에요.', msgTone: INK1, bannerBg: 'rgba(245,208,97,.07)', bannerBorder: 'rgba(245,208,97,.24)', celebrate: false },
  NEUTRAL: { kicker: '이번엔 큰 차이가 없었어요', msg: '결과는 비슷했지만, 원칙대로 한 건 잘한 거예요. 그 습관이 쌓여요.', msgTone: INK1, bannerBg: CARD, bannerBorder: HAIR, celebrate: false },
  GAVE_IN: { kicker: '이번엔 충동을 따랐어요', msg: '괜찮아요. 이렇게 마주 보는 것부터가 시작이에요 — 다음엔 한 박자 쉬어볼까요?', msgTone: INK1, bannerBg: 'rgba(239,77,77,.06)', bannerBorder: 'rgba(239,77,77,.22)', celebrate: false },
};

const CompactOutcome = ({ label, pct, win, muted }: { label: string; pct: number; win: boolean; muted: boolean }) => {
  const tone = pct > 0 ? UP : pct < 0 ? DOWN : INK2;
  return (
    <div style={{ position: 'relative', flex: '1 1 150px', padding: '11px 14px', borderRadius: 12, background: win ? 'rgba(91,157,255,.08)' : CARD, border: win ? '1px solid rgba(91,157,255,.4)' : `1px solid ${HAIR}`, opacity: muted ? .62 : 1 }}>
      {win && <span style={{ position: 'absolute', top: -9, left: 12, padding: '2px 9px', borderRadius: 999, fontSize: 9.5, fontWeight: 700, whiteSpace: 'nowrap', color: '#fff', background: `linear-gradient(180deg, ${SONAR}, ${ACCENT})` }}>더 나았던 길</span>}
      <div style={{ fontSize: 11.5, color: INK2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div className="font-mono" style={{ fontSize: 20, fontWeight: 800, color: tone, marginTop: 3, letterSpacing: '-.01em' }}>{fmtPct(pct)}</div>
    </div>
  );
};

const RevealCard = ({ b, showRank, disc }: { b: BottleVM; showRank: boolean; disc: DiscData }) => {
  const go = useVirtNavigate();
  const m = triMeta(b.trigger);
  const state = revealStateOf(b);
  const meta = STATE_META[state];
  const diffPct = b.rulePct - b.impulsePct;
  const defendedKrw = Math.abs(diffPct) * b.amountKrw / 100;
  const pathColor = (b.path[b.path.length - 1] ?? 0) >= 0 ? UP : DOWN;
  const [open, setOpen] = useState(false);
  const gaveIn = state === 'GAVE_IN';

  const impulseLabel = b.side === 'SELL' ? '충동대로 팔았다면' : '충동대로 샀다면';
  const ruleText = gaveIn
    ? (b.side === 'SELL' ? '결국 팔았어요' : '결국 샀어요')
    : (b.side === 'SELL' ? '안 팔고 버텼어요' : '사지 않고 관망했어요');
  // 충동 카드 강조: GAVE_IN이면 충동이 곧 사용자의 선택 / 그 외엔 규율 우위일 때 규율 강조
  const ruleWin = !gaveIn && state !== 'LUCKY';
  const impulseWin = gaveIn ? diffPct < 0 : state === 'LUCKY';

  return (
    <Panel style={{ position: 'relative', overflow: 'hidden', border: meta.celebrate ? '1px solid rgba(91,157,255,.4)' : `1px solid ${HAIR}`, boxShadow: meta.celebrate ? '0 0 0 3px rgba(91,157,255,.08), 0 18px 44px -26px rgba(40,110,230,.5)' : 'none', animation: 'bottle-arrive .55s cubic-bezier(.2,.8,.2,1) both' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 22px', borderBottom: `1px solid ${HAIR}`, flexWrap: 'wrap', background: `linear-gradient(105deg, ${SONAR_DIM}, transparent 70%)` }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, color: SONAR, background: SONAR_DIM, border: '1px solid rgba(91,157,255,.3)', whiteSpace: 'nowrap' }}>
          <MiniGlyph kind="bottle" c={SONAR} s={15} /> {gaveIn ? '유리병이 돌아왔어요' : '좋은 소식이 도착했어요'}
        </span>
        <span style={{ fontSize: 12, color: INK2, whiteSpace: 'nowrap' }}>{fmtDate(b.revealAt)} 개봉</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 'auto', padding: '5px 11px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, color: m.tone, background: m.dim, border: `1px solid ${m.tone}33`, whiteSpace: 'nowrap' }}><MiniGlyph kind={m.glyph} c={m.tone} s={14} />{m.wave}</span>
      </div>

      <div style={{ position: 'relative', overflow: 'hidden', background: meta.celebrate ? `radial-gradient(120% 120% at 82% 0%, ${SONAR_GLOW}, transparent 60%)` : 'transparent' }}>
        {meta.celebrate && <Sparkles spots={[[44, 30, 16, 0], [120, 24, 12, .8], [210, 40, 14, 1.4]]} />}
        <div style={{ position: 'relative', padding: '22px 24px 18px', display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
          <div style={{ flexShrink: 0, animation: meta.celebrate ? 'float-y 4.5s ease-in-out infinite' : 'none' }}><Bottle size={meta.celebrate ? 70 : 56} tilt={-10} /></div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontSize: 12.5, color: INK2, fontWeight: 600 }}>{meta.kicker}</div>
            {state === 'WIN' ? (
              <>
                <div className="font-mono" style={{ fontSize: 42, fontWeight: 800, color: DOWN, letterSpacing: '-.03em', lineHeight: 1.05, marginTop: 4, animation: 'count-pop .6s ease both' }}>+{fmtWon(defendedKrw)}</div>
                <div style={{ marginTop: 9, display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, color: SONAR, background: SONAR_DIM, border: '1px solid rgba(91,157,255,.3)' }}>
                  {showRank ? whaleTagFull(disc) + '의 고래' : whaleTagAlt(disc)}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 21, fontWeight: 800, color: INK0, marginTop: 6, lineHeight: 1.3 }}>
                {b.asset} <span style={{ color: INK2, fontWeight: 600, fontSize: 15 }}>· {ruleText}</span>
              </div>
            )}
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'stretch', gap: 10, flexWrap: 'wrap' }}>
              <CompactOutcome label={impulseLabel} pct={b.impulsePct} win={impulseWin} muted={!impulseWin && !gaveIn && state !== 'LUCKY' ? true : false} />
              <CompactOutcome label="참아서 지킨 길" pct={b.rulePct} win={ruleWin} muted={gaveIn || state === 'LUCKY'} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '4px 24px 22px' }}>
        {b.note && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '13px 16px', borderRadius: 12, background: CARD, border: `1px solid ${HAIR}` }}>
            <span style={{ flexShrink: 0, color: m.tone, marginTop: 1 }}><MiniGlyph kind="heart" c={m.tone} s={16} /></span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13.5, color: INK0, lineHeight: 1.5 }}>“{b.note}”</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7 }}>
                <span style={{ fontSize: 11.5, color: INK2 }}>그때의 감정 강도</span>
                <Intensity n={b.intensity} tone={m.tone} />
                <span style={{ marginLeft: 'auto', fontSize: 11, color: INK3 }}>봉인가 <span className="font-mono">{Math.round(b.sealPrice).toLocaleString('ko-KR')}</span></span>
              </div>
            </div>
          </div>
        )}

        {b.path.length >= 2 && (
          <div style={{ marginTop: 14, padding: '14px 16px 6px', borderRadius: 12, background: CARD, border: `1px solid ${HAIR}` }}>
            <div style={{ fontSize: 11.5, color: INK2, marginBottom: 2 }}>봉인 이후 가격 경로 <span style={{ color: INK3 }}>· 유리한 날만 고른 게 아니에요</span></div>
            <Sparkline data={b.path} color={pathColor} idKey={b.id} />
          </div>
        )}

        <div style={{ marginTop: 14, padding: '14px 18px', borderRadius: 13, display: 'flex', alignItems: 'center', gap: 11, background: meta.bannerBg, border: `1px solid ${meta.bannerBorder}` }}>
          <span style={{ flexShrink: 0, fontSize: 18 }}>🐋</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: meta.msgTone, lineHeight: 1.5 }}>{meta.msg}</span>
        </div>

        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 13, background: 'rgba(245,208,97,.06)', border: '1px solid rgba(245,208,97,.22)', flexWrap: 'wrap' }}>
          <span style={{ flexShrink: 0, color: COMPASS }}><MiniGlyph kind="compass" c={COMPASS} s={20} /></span>
          <span style={{ flex: 1, minWidth: 200, fontSize: 13, color: INK1, lineHeight: 1.5 }}>
            {b.strategy
              ? <>그때 당신의 항로 <strong style={{ color: COMPASS }}>『{b.strategy}』</strong>가 운용 중이었어요 — 규칙에 맡기면 이런 순간이 더 쉬워져요.</>
              : <>이런 인내를 자동으로 — 나만의 <strong style={{ color: COMPASS }}>항로(전략)</strong>를 정해 자동매매에 맡겨보세요.</>}
          </span>
          {!b.isSample && (
            <button onClick={() => go(b.strategy ? '/auto-trade' : '/strategy')} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, fontSize: 12.5, fontWeight: 700, color: COMPASS, background: 'rgba(245,208,97,.1)', border: '1px solid rgba(245,208,97,.3)', cursor: 'pointer' }}>{b.strategy ? '내 항로 보기' : '항로 정하기'} →</button>
          )}
        </div>

        <button onClick={() => setOpen(o => !o)} style={{ marginTop: 13, display: 'flex', alignItems: 'center', gap: 7, background: 'none', border: 0, cursor: 'pointer', fontFamily: 'inherit', color: INK2, fontSize: 12, padding: 0 }}>
          <MiniGlyph kind="info" s={14} /> 어떻게 계산했나요? <span style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▾</span>
        </button>
        {open && (
          <p style={{ margin: '10px 0 0', fontSize: 12, color: INK2, lineHeight: 1.7, padding: '12px 14px', borderRadius: 10, background: ABYSS, border: `1px solid ${HAIR}` }}>
            봉인 시점의 가격·등락률·걸린 금액을 서버가 기록합니다. <b>{impulseLabel}</b>는 {b.side === 'SELL' ? '전량 현금화(이후 변동 0%)' : '그때 매수(이후 자산 변동분)'}, <b> 참아서 지킨 길</b>은 {b.side === 'SELL' ? '그대로 보유(자산 변동분)' : '관망(0%)'}으로 단일·보수 가정해 비교합니다. 수수료·세금은 제외(모의 기준)이며, 고정 시점의 체리피킹을 막기 위해 봉인 이후 경로를 함께 보여줍니다. <b style={{ color: INK1 }}>충동이 옳았던 날도 정직하게 그대로 보여줘요.</b> 한 번의 결과가 아니라 같은 선택의 기대값이 진짜 교훈이에요.
          </p>
        )}
      </div>
    </Panel>
  );
};

/* ── 규율 점수 패널 ── */
const ScoreGauge = ({ score, size = 132 }: { score: number; size?: number }) => {
  const r = (size - 18) / 2, cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, score / 100));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs><linearGradient id="gauge-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#5b9dff" /><stop offset="1" stopColor="#2c6fe6" /></linearGradient></defs>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={HAIRS} strokeWidth="9" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="url(#gauge-grad)" strokeWidth="9" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - frac)} transform={`rotate(-90 ${cx} ${cy})`} style={{ filter: 'drop-shadow(0 0 6px rgba(91,157,255,.5))' }} />
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize="34" fontWeight="800" fill={INK0}>{score}</text>
      <text x={cx} y={cy + 18} textAnchor="middle" fontSize="11.5" fill={INK2}>인내 점수</text>
    </svg>
  );
};

const StreakRow = ({ days, best }: { days: number; best: number }) => {
  const show = Math.min(days, 14);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
        <span style={{ color: COMPASS }}><MiniGlyph kind="flame" c={COMPASS} s={18} /></span>
        <span className="font-mono" style={{ fontSize: 22, fontWeight: 800, color: INK0 }}>{days}회</span>
        <span style={{ fontSize: 12.5, color: INK2 }}>연속 규칙 준수</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: INK3 }}>최고 {best}회</span>
      </div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {Array.from({ length: 14 }).map((_, i) => (
          <span key={i} style={{ flex: '1 1 16px', height: 9, borderRadius: 3, minWidth: 12, background: i < show ? `linear-gradient(180deg, ${SONAR}, ${ACCENT})` : ABYSS, border: i < show ? '0' : `1px solid ${HAIR}`, boxShadow: i < show ? '0 0 6px rgba(91,157,255,.35)' : 'none' }} />
        ))}
      </div>
    </div>
  );
};

const ResilienceBar = ({ data }: { data: Resil }) => {
  const pct = data.total ? Math.round((data.resisted / data.total) * 100) : 0;
  const m = data.label.includes('공포') ? triMeta('PANIC_DROP') : triMeta('FOMO_SPIKE');
  const strong = pct >= 60;
  return (
    <div style={{ padding: '16px 18px', borderRadius: 14, background: CARD, border: `1px solid ${HAIR}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{ color: m.tone }}><MiniGlyph kind={m.glyph} c={m.tone} s={17} /></span>
        <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', color: INK0 }}>{data.label}</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: strong ? SONAR : COMPASS, padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap', background: strong ? SONAR_DIM : 'rgba(245,208,97,.12)' }}>{data.total === 0 ? '기록 없음' : strong ? '잘 버텨요' : '연습 중'}</span>
      </div>
      <div style={{ fontSize: 11.5, color: INK2, margin: '5px 0 13px' }}>{data.sub}</div>
      <div style={{ position: 'relative', height: 9, borderRadius: 99, background: ABYSS, border: `1px solid ${HAIR}`, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: `linear-gradient(90deg, ${ACCENT}, ${SONAR})` }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12 }}>
        <span style={{ color: INK2, whiteSpace: 'nowrap' }}>참은 비율</span>
        <span className="font-mono" style={{ fontWeight: 700, color: SONAR }}>{data.total}번 중 {data.resisted}번 · {pct}%</span>
      </div>
    </div>
  );
};

const Stat = ({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: string }) => (
  <div style={{ padding: '13px 15px', borderRadius: 13, background: CARD, border: `1px solid ${HAIR}` }}>
    <div style={{ fontSize: 11, color: INK2 }}>{label}</div>
    <div className="font-mono" style={{ fontSize: 19, fontWeight: 800, color: tone || INK0, marginTop: 4, letterSpacing: '-.01em' }}>{value}</div>
    <div style={{ fontSize: 10.5, color: INK3, marginTop: 3 }}>{sub}</div>
  </div>
);

const BadgeGrid = ({ badges, allLocked }: { badges: Badge[]; allLocked?: boolean }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
    {badges.map(b => {
      const earned = !allLocked && b.earned;
      return (
        <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px', borderRadius: 13, background: earned ? 'rgba(91,157,255,.06)' : 'rgba(255,255,255,.015)', border: earned ? '1px solid rgba(91,157,255,.26)' : `1px solid ${HAIR}`, opacity: earned ? 1 : .45 }}>
          <span style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: earned ? SONAR : INK3, background: earned ? SONAR_DIM : 'rgba(255,255,255,.03)', border: `1px solid ${earned ? 'rgba(91,157,255,.3)' : HAIR}` }}>
            <MiniGlyph kind={earned ? b.icon : 'lock'} c="currentColor" s={earned ? 18 : 16} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: INK0 }}>{b.label}</div>
            <div style={{ fontSize: 10.5, color: INK3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.desc}</div>
          </div>
        </div>
      );
    })}
  </div>
);

const EmptyDiscipline = ({ badges, onStart }: { badges: Badge[]; onStart: () => void }) => (
  <Panel>
    <div style={{ position: 'relative', overflow: 'hidden', padding: '40px 28px 34px', textAlign: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(120% 90% at 50% 0%, ${SONAR_GLOW}, transparent 60%)` }} />
      <Sparkles spots={[[70, 40, 14, 0], [300, 60, 12, 1.1], [160, 30, 16, .6], [330, 160, 12, 1.6]]} />
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <svg width="132" height="132" viewBox="0 0 132 132">
            <circle cx="66" cy="66" r="57" fill="none" stroke={HAIRS} strokeWidth="9" />
            <circle cx="66" cy="66" r="57" fill="none" stroke="rgba(91,157,255,.4)" strokeWidth="9" strokeLinecap="round" strokeDasharray="6 12" transform="rotate(-90 66 66)" />
            <text x="66" y="64" textAnchor="middle" fontSize="34" fontWeight="800" fill={INK2}>0</text>
            <text x="66" y="84" textAnchor="middle" fontSize="11.5" fill={INK3}>인내 점수</text>
          </svg>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <span style={{ animation: 'float-y 5s ease-in-out infinite', display: 'flex' }}><Bottle size={30} halo={false} tilt={-8} /></span>
        </div>
        <h3 style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.01em', color: INK0 }}>아직 띄운 유리병이 없어요</h3>
        <p style={{ margin: '9px auto 0', fontSize: 13.5, color: INK1, lineHeight: 1.65, maxWidth: 420 }}>
          첫 유리병을 띄우면 <b style={{ color: INK0 }}>인내 점수</b>가 쌓이기 시작해요. 흔들린 순간을 담아둘수록, 참아서 지켜낸 가치가 차곡차곡 기록됩니다.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap', margin: '20px 0 22px' }}>
          {[['인내 점수', '0'], ['충동을 참은 비율', '—'], ['연속 규칙 준수', '0회']].map(([l, v]) => (
            <div key={l} style={{ padding: '12px 18px', borderRadius: 13, background: CARD, border: `1px dashed ${HAIRS}` }}>
              <div className="font-mono" style={{ fontSize: 18, fontWeight: 800, color: INK3 }}>{v}</div>
              <div style={{ fontSize: 10.5, color: INK3, marginTop: 3 }}>{l}</div>
            </div>
          ))}
        </div>
        <button onClick={onStart} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 22px', borderRadius: 12, border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, color: '#fff', background: `linear-gradient(180deg, ${SONAR}, ${ACCENT})`, boxShadow: '0 12px 26px -12px rgba(60,120,255,.7)' }}>
          <MiniGlyph kind="bottle" c="#fff" s={16} /> 첫 유리병 띄우기
        </button>
        <div style={{ marginTop: 26 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: INK2, letterSpacing: '.04em', marginBottom: 12 }}>잠긴 항해 뱃지</div>
          <BadgeGrid badges={badges} allLocked />
        </div>
      </div>
    </div>
  </Panel>
);

const DisciplinePanel = ({ d, badges, resil, showRank }: { d: DiscData; badges: Badge[]; resil: { fear: Resil; greed: Resil }; showRank: boolean }) => (
  <Panel>
    <div style={{ padding: '22px 24px 8px', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 26, alignItems: 'center' }} className="disc-top">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <ScoreGauge score={d.score} />
        {showRank
          ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, color: SONAR, background: SONAR_DIM, border: '1px solid rgba(91,157,255,.3)', whiteSpace: 'nowrap' }}>{whaleTagFull(d)}</span>
          : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, color: COMPASS, background: 'rgba(245,208,97,.12)', border: '1px solid rgba(245,208,97,.28)', whiteSpace: 'nowrap' }}>🐋 {d.streak}회째 항해 중</span>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Stat label="충동을 참은 비율" value={`${d.resistRate}%`} sub={`${d.totalTriggers}번 중 ${d.resisted}번`} tone={SONAR} />
          <Stat label="지켜낸 가치 (누적)" value={fmtWon(d.defendedKrw)} sub="규율로 막아낸 손실" tone={DOWN} />
        </div>
        <StreakRow days={d.streak} best={d.bestStreak} />
      </div>
    </div>
    <div style={{ padding: '4px 24px 0' }}><WaveLine height={16} opacity={.5} /></div>
    <div style={{ padding: '10px 24px 16px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: INK2, letterSpacing: '.04em', margin: '4px 0 12px' }}>항해 뱃지</div>
      <BadgeGrid badges={badges} />
    </div>
    <div style={{ padding: '4px 24px 22px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: INK2, letterSpacing: '.04em', margin: '4px 0 12px' }}>파도별 인내력</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
        <ResilienceBar data={resil.fear} />
        <ResilienceBar data={resil.greed} />
      </div>
    </div>
  </Panel>
);

/* ── 공유 카드 + 모달 ── */
const ShareCard = forwardRef<HTMLDivElement, { d: DiscData }>(({ d }, ref) => (
  <div ref={ref} style={{ position: 'relative', width: 380, height: 380, borderRadius: 22, overflow: 'hidden', background: 'linear-gradient(160deg, #0c1a3a 0%, #0a1430 46%, #102a5e 100%)', border: '1px solid rgba(91,157,255,.3)', flexShrink: 0, boxShadow: '0 30px 70px -30px rgba(10,25,70,.9)' }}>
    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 90% at 80% 8%, rgba(91,157,255,.32), transparent 55%)' }} />
    <svg aria-hidden viewBox="0 0 200 200" style={{ position: 'absolute', left: -40, bottom: -40, width: 240, height: 240, opacity: .18 }}>
      {[40, 70, 100].map(r => <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="#5b9dff" strokeWidth="1" />)}
    </svg>
    {([[40, 60, .9], [330, 90, 1.4], [300, 300, 1.1], [70, 300, 1.6]] as [number, number, number][]).map(([x, y, delay], i) => (
      <span key={i} style={{ position: 'absolute', left: x, top: y, color: '#bcd6ff', animation: `twinkle 3s ease-in-out ${delay}s infinite` }}><MiniGlyph kind="sparkle" c="#bcd6ff" s={i % 2 ? 13 : 18} /></span>
    ))}
    <div style={{ position: 'relative', height: '100%', padding: '30px 30px 26px', display: 'flex', flexDirection: 'column', color: '#eaf2ff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(91,157,255,.2)', border: '1px solid rgba(91,157,255,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MiniGlyph kind="anchor" c="#9cc1ff" s={16} /></span>
        <span style={{ fontSize: 11.5, letterSpacing: '.22em', fontWeight: 700, color: '#9cc1ff' }}>WHALEARC</span>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
        <div style={{ fontSize: 15, color: '#aebfe0', fontWeight: 600 }}>나는</div>
        <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.18, letterSpacing: '-.01em' }}>충동을 <span style={{ color: '#7fb2ff' }}>{d.resisted}번</span> 참은<br />고래 🐋</div>
        <div style={{ marginTop: 16, padding: '14px 16px', borderRadius: 14, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)' }}>
          <div style={{ fontSize: 12, color: '#aebfe0' }}>지금까지 지켜낸 가치</div>
          <div className="font-mono" style={{ fontSize: 27, fontWeight: 800, color: '#eaf2ff', marginTop: 3, letterSpacing: '-.01em' }}>{fmtWon(d.defendedKrw)}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11.5, color: '#8fa3cc' }}>WhaleArc · 유리병 편지</span>
        <span style={{ display: 'flex' }}><Bottle size={26} halo={false} tilt={-10} /></span>
      </div>
    </div>
  </div>
));
ShareCard.displayName = 'ShareCard';

const ShareModal = ({ open, onClose, d }: { open: boolean; onClose: () => void; d: DiscData }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  if (!open) return null;
  const download = () => {
    const node = cardRef.current;
    if (!node) return;
    try {
      const w = node.offsetWidth, h = node.offsetHeight;
      const html = new XMLSerializer().serializeToString(node.cloneNode(true) as Node);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml">${html}</div></foreignObject></svg>`;
      const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2;
        const ctx = c.getContext('2d'); if (!ctx) return;
        ctx.scale(2, 2); ctx.drawImage(img, 0, 0);
        c.toBlob(blob => { if (!blob) return; const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'whalearc-유리병편지.png'; a.click(); URL.revokeObjectURL(url); }, 'image/png');
      };
      img.onerror = () => { alert('카드를 길게 눌러 이미지로 저장하거나 화면을 캡처해 공유하세요 🐋'); URL.revokeObjectURL(url); };
      img.src = url;
    } catch { alert('카드를 길게 눌러 이미지로 저장하거나 화면을 캡처해 공유하세요 🐋'); }
  };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(4,9,24,.72)', backdropFilter: 'blur(6px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, animation: 'modal-pop .3s ease both' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>자랑할 시간이에요 🐋</div>
          <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.7)', marginTop: 5 }}>캡처해서 커뮤니티에 공유해보세요 — 규율은 자랑거리니까요.</div>
        </div>
        <ShareCard ref={cardRef} d={d} />
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={download} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderRadius: 12, border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, color: '#fff', background: `linear-gradient(180deg, ${SONAR}, ${ACCENT})`, boxShadow: '0 10px 24px -10px rgba(60,120,255,.7)' }}>
            <MiniGlyph kind="share" c="#fff" s={16} /> 이미지로 저장
          </button>
          <button onClick={onClose} style={{ padding: '12px 20px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, color: 'rgba(255,255,255,.85)', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.18)' }}>닫기</button>
        </div>
      </div>
    </div>
  );
};

const SectionHead = ({ icon, title, desc, count }: { icon: GlyphKind; title: string; desc?: string; count?: number }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <span style={{ color: SONAR }}><MiniGlyph kind={icon} c={SONAR} s={18} /></span>
      <h2 style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-.01em', whiteSpace: 'nowrap', color: INK0 }}>{title}</h2>
      {count != null && <span style={{ fontSize: 12, fontWeight: 700, color: SONAR, padding: '2px 9px', borderRadius: 999, background: SONAR_DIM }}>{count}</span>}
    </div>
    {desc && <p style={{ margin: '7px 0 0', fontSize: 13, color: INK2 }}>{desc}</p>}
  </div>
);

const SampleBadge = () => (
  <div style={{ marginBottom: 10, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: INK2 }}>👀 <span style={{ background: 'var(--ci-chip)', color: INK3, padding: '2px 7px', borderRadius: 6, fontWeight: 700, fontSize: 10.5 }}>예시 · 실제 내 기록 아님</span></div>
);

/* ── PAGE ── */
const ConsoleMirrorPage = () => {
  const { session } = useAuth();
  const { isVirt } = useRoutePrefix();
  const userName = session?.user?.email ? session.user.email.split('@')[0] : '항해사';
  const [list, setList] = useState<MirrorCapture[]>([]);
  const [loading, setLoading] = useState(true);
  const [share, setShare] = useState(false);
  const go = useVirtNavigate();

  useEffect(() => {
    mirrorService.list()
      .then(caps => {
        setList(caps);
        localStorage.setItem('mirror_seen_revealed_count', String(caps.filter(c => c.revealed).length));
        sessionStorage.setItem('mirror_badge', '0');
      })
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, []);

  const drifting = useMemo(() => list.filter(c => !c.revealed).map(toVM), [list]);
  const arrived = useMemo(() => list.filter(c => c.revealed).map(toVM), [list]);
  const empty = list.length === 0;
  const showSample = arrived.length === 0;
  const { d: disc, badges, resil } = useMemo(() => computeDiscipline(list), [list]);
  const canShare = !empty && disc.defendedKrw > 0;

  return (
    <HelmShell active="mirror" virt={isVirt} userName={userName} session={list.length > 0 ? `유리병 편지 · 표류 중 ${drifting.length} · 도착 ${arrived.length}` : '유리병 편지'}>
      <BottleDefs />
      <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 26, padding: '4px 0 40px' }}>
        {loading ? (
          <Panel style={{ padding: 56, textAlign: 'center' }}><span style={{ color: INK3, fontSize: 13 }}>불러오는 중…</span></Panel>
        ) : (
          <>
            <Hero d={disc} onShare={() => setShare(true)} showRank={SHOW_RANK} canShare={canShare} />

            {(drifting.length > 0 || empty) && (
              <section>
                <SectionHead icon="lock" title="표류 중인 유리병" desc="봉인된 마음이 파도를 타고 흘러가는 중 — 개봉일이 되면 결과를 실어다 줘요." count={empty ? undefined : drifting.length} />
                {empty && <SampleBadge />}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
                  {(empty ? [SAMPLE_DRIFT] : drifting).map(b => <DriftCard key={b.id} b={b} />)}
                </div>
              </section>
            )}

            <section>
              <SectionHead icon="info" title={showSample ? '이렇게 열려요' : '도착한 유리병'} desc="파도가 답을 실어왔어요. 참아서 지킨 길이 얼마를 지켜냈는지 — 실제 숫자로." count={showSample ? undefined : arrived.length} />
              {showSample && <SampleBadge />}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {(showSample ? [SAMPLE_VM] : arrived).map(b => <RevealCard key={b.id} b={b} showRank={SHOW_RANK} disc={disc} />)}
              </div>
            </section>

            <section>
              <SectionHead icon="shield" title="규율 점수 · 당신이 참아낸 기록" desc="칭찬하는 건 수익이 아니라 인내예요 — 참은 비율·연속 기록·지켜낸 가치." />
              {empty ? <EmptyDiscipline badges={badges} onStart={() => go('/trade')} /> : <DisciplinePanel d={disc} badges={badges} resil={resil} showRank={SHOW_RANK} />}
            </section>

            <div style={{ display: 'flex', gap: 11, padding: '16px 18px', borderRadius: 14, background: CARD, border: `1px solid ${HAIR}` }}>
              <span style={{ flexShrink: 0, color: INK2, marginTop: 1 }}><MiniGlyph kind="info" s={18} /></span>
              <p style={{ margin: 0, fontSize: 12.5, color: INK2, lineHeight: 1.7 }}>
                <b style={{ color: INK1 }}>언제 유리병이 생기나요?</b> · <b style={{ color: INK1 }}>시장가</b>로 ① 가진 자산을 <b style={{ color: DOWN }}>급락 중에 팔거나</b> ② 안 가진 자산을 <b style={{ color: UP }}>급등 중에 살 때</b> 그 순간만 담아요. 평소 거래는 그냥 체결됩니다. 변동성이 자산마다 달라 <b style={{ color: INK1 }}>기준도 자산군별</b>로 나눴어요 —
                {' '}코인은 하루 <b style={{ color: DOWN }}>−8%↓</b>·<b style={{ color: UP }}>+25%↑</b>, 주식·ETF는 <b style={{ color: DOWN }}>−4%↓</b>·<b style={{ color: UP }}>+10%↑</b>. 지정가 주문은 '지금 당장의 충동'이 아니라 막지 않아요.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 11, padding: '16px 18px', borderRadius: 14, background: CARD, border: `1px solid ${HAIR}` }}>
              <span style={{ flexShrink: 0, color: INK2, marginTop: 1 }}><MiniGlyph kind="info" s={18} /></span>
              <p style={{ margin: 0, fontSize: 12.5, color: INK2, lineHeight: 1.7 }}>
                <b style={{ color: INK1 }}>정직성 원칙</b> · 반사실은 "팔았다면 그 돈은 현금이 돼 더는 오르내리지 않는다"는 보수적 가정입니다. 수수료·세금 제외(모의 기준), 고정 시점의 체리피킹은 경로 그래프로 보완해요. 충동이 옳았던 날도 정직하게 보여줍니다. 인내 점수는 <b style={{ color: INK1 }}>참은 비율(70%) + 최고 연속기록(30%)</b>으로 계산하며, 비교할 데이터가 쌓이기 전엔 '상위 %'를 띄우지 않아요. 한 번의 결과가 아니라, <b style={{ color: INK1 }}>같은 선택의 기대값</b>이 진짜 교훈이에요.
              </p>
            </div>

            <footer style={{ marginTop: 6, paddingTop: 18, borderTop: `1px solid ${HAIR}`, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <span className="font-mono" style={{ fontSize: 11.5, color: INK3 }}>© 2026 WHALEARC · 유리병 편지</span>
              <span style={{ fontSize: 11.5, color: INK3 }}>Built quietly, beneath the surface.</span>
            </footer>
          </>
        )}
      </div>
      <ShareModal open={share} onClose={() => setShare(false)} d={disc} />
    </HelmShell>
  );
};

export default ConsoleMirrorPage;
