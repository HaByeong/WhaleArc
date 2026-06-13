import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRoutePrefix, useVirtNavigate } from '../hooks/useRoutePrefix';
import HelmShell from '../components/HelmShell';
import { mirrorService, type MirrorCapture } from '../services/mirrorService';

/* 유리병 편지 (Message in a Bottle) — 흔들린 순간을 봉인했다가, 며칠 뒤 충동 vs 항로를 대조한다.
   디자인: 바다·파도·유리병 모티프. 판단은 사용자가, 시스템은 사실만 비춘다. */

const UP = '#ef4d4d', DOWN = '#4d8aff', COMPASS = '#f5d061', ACCENT = '#2c6fe6';
const SONAR = 'var(--ci-sonar)', SONAR_DIM = 'var(--ci-sonar-dim)', SONAR_GLOW = 'rgba(91,157,255,.22)';
const INK0 = 'var(--ci-ink0)', INK1 = 'var(--ci-ink1)', INK2 = 'var(--ci-ink2)', INK3 = 'var(--ci-ink3)';
const HAIR = 'var(--ci-line)', HAIRS = 'var(--ci-line-strong)';
const ABYSS = 'var(--ci-inset)', CARD = 'rgba(255,255,255,.03)';

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

const WaveLine = ({ height = 22 }: { height?: number }) => (
  <svg viewBox="0 0 240 24" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height }}>
    <path d="M0 12 Q15 2 30 12 T60 12 T90 12 T120 12 T150 12 T180 12 T210 12 T240 12" fill="none" stroke="url(#wa-wave)" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

type GlyphKind = 'compass' | 'fear' | 'greed' | 'info' | 'lock';
const MiniGlyph = ({ kind, c = 'currentColor', s = 16 }: { kind: GlyphKind; c?: string; s?: number }) => {
  const p: Record<GlyphKind, React.ReactNode> = {
    compass: <><circle cx="11" cy="11" r="8" stroke={c} strokeWidth="1.5" /><path d="M14.5 7.5 11.8 11.8 7.5 14.5 10.2 10.2Z" fill={c} /></>,
    fear: <><circle cx="11" cy="11" r="8" stroke={c} strokeWidth="1.5" /><circle cx="8" cy="9.5" r="1.1" fill={c} /><circle cx="14" cy="9.5" r="1.1" fill={c} /><path d="M7.5 15q3.5-3 7 0" stroke={c} strokeWidth="1.5" fill="none" strokeLinecap="round" /></>,
    greed: <><circle cx="11" cy="11" r="8" stroke={c} strokeWidth="1.5" /><path d="M7.5 8.5 9.5 10M14.5 8.5 12.5 10" stroke={c} strokeWidth="1.5" strokeLinecap="round" /><path d="M7.5 13q3.5 3 7 0" stroke={c} strokeWidth="1.5" fill="none" strokeLinecap="round" /></>,
    info: <><circle cx="11" cy="11" r="8" stroke={c} strokeWidth="1.5" /><path d="M11 10v4.5" stroke={c} strokeWidth="1.6" strokeLinecap="round" /><circle cx="11" cy="7.3" r="1" fill={c} /></>,
    lock: <><rect x="5.5" y="9.5" width="11" height="8" rx="2" stroke={c} strokeWidth="1.5" /><path d="M8 9.5V7.5a3 3 0 0 1 6 0v2" stroke={c} strokeWidth="1.5" /></>,
  };
  return <svg width={s} height={s} viewBox="0 0 22 22" fill="none">{p[kind]}</svg>;
};

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
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" style={{ width: '100%', height: 90, display: 'block' }}>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".22" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <line x1="0" y1={zeroY} x2="100" y2={zeroY} stroke={INK3} strokeWidth=".5" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
      <polygon points={`0,40 ${line} 100,40`} fill={`url(#${gid})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx="100" cy={Y(data[data.length - 1])} r="2.6" fill={color} vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

// 바다 깊이감 — 상단 은은한 블루 글로우를 --ci-panel 위에 레이어(라이트모드에선 거의 안 보임).
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

const SAMPLE_VM: BottleVM = {
  id: 'sample', trigger: 'PANIC_DROP', side: 'SELL', asset: '비트코인', symbol: 'BTC',
  changeRate: -6.2, sealPrice: 86000000, amountKrw: 1500000, note: '더 떨어질 것 같아 무서웠다', intensity: 4,
  choice: 'FOLLOW_IMPULSE', impulsePct: 0, rulePct: 8.5, strategy: '골든크로스 추종 전략',
  path: [0, -1.4, -2.1, -0.6, 1.8, 4.2, 6.1, 8.5], capturedAt: '2026-05-21', revealAt: '2026-05-28', isSample: true,
};
const _iso = (dayOffset: number) => new Date(Date.now() + dayOffset * 86400000).toISOString();
// 빈 상태 미리보기 — '이렇게 채워진다'를 보여주는 예시(표류 1 + 패턴)
const SAMPLE_DRIFT: BottleVM = {
  id: 'sample-drift', trigger: 'FOMO_SPIKE', side: 'BUY', asset: '에코프로', symbol: '086520',
  changeRate: 17.2, sealPrice: 128500, amountKrw: 1500000, note: '지금 안 사면 영영 놓칠 것 같았다', intensity: 5,
  choice: 'FOLLOW_IMPULSE', impulsePct: 0, rulePct: 0, strategy: null, path: [],
  capturedAt: _iso(-3), revealAt: _iso(4), isSample: true,
};
const SAMPLE_PATTERN = {
  fear: { label: '공포의 파도', sub: '급락에 팔고 싶어진 순간', total: 5, impulse: 2 },
  greed: { label: '탐욕의 파도', sub: '급등에 사고 싶어진 순간', total: 6, impulse: 5 },
};

/* ── HERO ── */
const Hero = ({ savedKrw, lostKrw }: { savedKrw: number; lostKrw: number }) => (
  <Panel style={{ position: 'relative' }}>
    <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(120% 130% at 88% 0%, ${SONAR_GLOW}, transparent 55%)` }} />
    <svg aria-hidden viewBox="0 0 200 200" style={{ position: 'absolute', right: 60, top: '52%', transform: 'translateY(-50%)', width: 300, height: 300, opacity: .14, pointerEvents: 'none' }}>
      {[40, 68, 96].map(r => <circle key={r} cx="100" cy="100" r={r} fill="none" stroke={SONAR} strokeWidth="1" />)}
    </svg>
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 24, padding: '34px 34px 30px', flexWrap: 'wrap' }}>
      <div style={{ flexShrink: 0, animation: 'float-y 5.5s ease-in-out infinite' }}><Bottle size={86} tilt={-12} /></div>
      <div style={{ flex: 1, minWidth: 280 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
          <span style={{ fontSize: 10.5, letterSpacing: '.24em', fontWeight: 700, color: SONAR, whiteSpace: 'nowrap' }}>MESSAGE IN A BOTTLE</span>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: SONAR, boxShadow: `0 0 8px ${SONAR}`, animation: 'bottle-dot 2.4s ease-in-out infinite' }} />
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.02em', lineHeight: 1.15, color: INK0 }}>유리병 편지 🌊</h1>
        <p style={{ margin: '12px 0 0', fontSize: 14, lineHeight: 1.7, color: INK1, maxWidth: 560 }}>
          공포·탐욕의 파도에 항로를 벗어날 뻔한 순간을 <strong style={{ color: INK0 }}>유리병에 담아 띄워두면</strong>, 며칠 뒤 파도가 <strong style={{ color: INK0 }}>충동대로 했다면 vs 항로를 지켰다면</strong>을 실제 숫자로 실어다 줍니다.
        </p>
        <p style={{ margin: '8px 0 0', fontSize: 12.5, color: INK2, fontStyle: 'italic' }}>🐋 막지 않아요. 마음만 비추는 거울이에요 — 투기를 투자로, 감정을 데이터로.</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 190 }}>
        <HeroStat label="흔들려 잃은 비용" value={wonSigned(-lostKrw)} tone={UP} sub="지금까지 · 충동을 따른 순간" />
        <HeroStat label="항로로 아낀 금액" value={savedKrw > 0 ? fmtMan(savedKrw) : '0원'} tone={DOWN} sub="규칙을 지켜낸 순간" />
      </div>
    </div>
    <WaveLine height={20} />
  </Panel>
);
const HeroStat = ({ label, value, tone, sub }: { label: string; value: string; tone: string; sub: string }) => (
  <div style={{ padding: '13px 16px', borderRadius: 13, background: CARD, border: `1px solid ${HAIR}` }}>
    <div style={{ fontSize: 11, color: INK2 }}>{label}</div>
    <div className="font-mono" style={{ fontSize: 20, fontWeight: 700, color: tone, marginTop: 3, letterSpacing: '-.01em' }}>{value}</div>
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
            <span style={{ position: 'absolute', top: '50%', left: `${prog}%`, transform: 'translate(-50%,-50%)', fontSize: 11 }}>🌊</span>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── 도착 (revealed) — 반사실 센터피스 ── */
const RevealCard = ({ b }: { b: BottleVM }) => {
  const go = useVirtNavigate();
  const m = triMeta(b.trigger);
  const followedRule = b.choice === 'FOLLOW_RULE';
  const ruleBetter = b.rulePct >= b.impulsePct;
  const costPct = b.rulePct - b.impulsePct;
  const costKrw = Math.abs(costPct) * b.amountKrw / 100;
  const pathColor = (b.path[b.path.length - 1] ?? 0) >= 0 ? UP : DOWN;
  const [open, setOpen] = useState(false);

  const impulseLabel = b.side === 'SELL' ? '팔았다면' : '샀다면';
  const ruleLabel = b.side === 'SELL' ? '안 팔고 버텼다면' : '관망했다면';
  const choiceLabel = followedRule ? (b.side === 'SELL' ? '안 팔았다' : '관망했다') : (b.side === 'SELL' ? '팔았다' : '샀다');
  const msg = followedRule
    ? (ruleBetter ? { t: '참길 잘했어요. 항로가 옳았습니다 🐋', c: DOWN } : { t: '이번엔 충동이 맞았네요. 그래도 같은 선택 10번이면 몇 번 맞을까요?', c: INK1 })
    : (ruleBetter ? { t: '그때 흔들렸죠. 다음엔 한 박자 쉬어볼까요?', c: UP } : { t: '운이 좋았어요. 같은 선택 10번이면 몇 번 맞을까요?', c: INK1 });

  const Outcome = ({ label, pct, amount, win }: { label: string; pct: number; amount: number; win: boolean }) => {
    const tone = pct > 0 ? UP : pct < 0 ? DOWN : INK2;
    return (
      <div style={{ position: 'relative', flex: 1, padding: '18px 18px 16px', borderRadius: 14, textAlign: 'center', background: win ? 'rgba(91,157,255,.08)' : CARD, border: win ? '1px solid rgba(91,157,255,.4)' : `1px solid ${HAIR}`, boxShadow: win ? '0 0 0 3px rgba(91,157,255,.10)' : 'none' }}>
        {win && <span style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', padding: '3px 11px', borderRadius: 999, fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap', background: `linear-gradient(180deg, ${SONAR}, ${ACCENT})`, color: '#fff' }}>실제로 더 나았던 길</span>}
        <div style={{ fontSize: 12.5, color: INK2 }}>{label}</div>
        <div className="font-mono" style={{ fontSize: 30, fontWeight: 800, color: tone, margin: '6px 0 2px', letterSpacing: '-.02em' }}>{fmtPct(pct)}</div>
        <div className="font-mono" style={{ fontSize: 12.5, color: pct === 0 ? INK3 : tone }}>약 {wonSigned(amount)}</div>
      </div>
    );
  };

  return (
    <Panel style={{ animation: 'bottle-arrive .55s cubic-bezier(.2,.8,.2,1) both' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '16px 22px', borderBottom: `1px solid ${HAIR}`, flexWrap: 'wrap', background: `linear-gradient(105deg, ${SONAR_DIM}, transparent 70%)` }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, color: SONAR, background: SONAR_DIM, border: '1px solid rgba(91,157,255,.3)', whiteSpace: 'nowrap' }}>🌊 유리병이 돌아왔어요</span>
        <span style={{ fontSize: 12, color: INK2, whiteSpace: 'nowrap' }}>{fmtDate(b.revealAt)} 개봉</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 'auto', padding: '5px 11px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, color: m.tone, background: m.dim, border: `1px solid ${m.tone}33`, whiteSpace: 'nowrap' }}><MiniGlyph kind={m.glyph} c={m.tone} s={14} />{m.wave}</span>
      </div>
      <div style={{ padding: '22px 24px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0 }}>
            {b.note && <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.45, color: INK0 }}>“{b.note}”</div>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 9 }}><span style={{ fontSize: 12, color: INK2, whiteSpace: 'nowrap' }}>감정 강도</span><Intensity n={b.intensity} tone={m.tone} /></div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 11.5, color: INK2 }}>당신의 선택</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 3, color: INK0 }}>{m.face} {choiceLabel}</div>
            <div style={{ fontSize: 11, color: INK3, marginTop: 2 }}>{b.asset} · 봉인가 <span className="font-mono">{Math.round(b.sealPrice).toLocaleString('ko-KR')}</span></div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 14, marginTop: 22 }}>
          <Outcome label={impulseLabel} pct={b.impulsePct} amount={b.amountKrw * b.impulsePct / 100} win={b.impulsePct > b.rulePct} />
          <Outcome label={ruleLabel} pct={b.rulePct} amount={b.amountKrw * b.rulePct / 100} win={b.rulePct >= b.impulsePct} />
        </div>

        <div style={{ marginTop: 14, padding: '12px 16px', borderRadius: 12, textAlign: 'center', background: followedRule ? 'rgba(77,138,255,.08)' : 'rgba(239,77,77,.08)', border: `1px solid ${followedRule ? 'rgba(77,138,255,.24)' : 'rgba(239,77,77,.24)'}` }}>
          <span style={{ fontSize: 13, color: INK1 }}>
            감정의 비용 ·{' '}
            {Math.abs(costPct) < 0.1
              ? <>두 선택의 결과가 <strong style={{ color: INK1 }}>거의 같았어요</strong></>
              : followedRule
              ? (costPct >= 0 ? <>항로를 지켜 <strong style={{ color: DOWN }}>약 {fmtMan(costKrw).replace('+', '')}</strong> 아꼈어요</> : <>이번엔 충동이 <strong style={{ color: UP }}>약 {fmtMan(costKrw).replace('+', '')}</strong> 나았어요</>)
              : (costPct >= 0 ? <>충동을 따라 <strong style={{ color: UP }}>약 {fmtMan(costKrw).replace('+', '')}</strong> 손해였어요</> : <>충동이 <strong style={{ color: DOWN }}>약 {fmtMan(costKrw).replace('+', '')}</strong> 이득이었어요</>)}
          </span>
          <span style={{ fontSize: 11.5, color: INK3, marginLeft: 8 }}>(두 선택의 차이 {Math.abs(costPct).toFixed(1)}%P)</span>
        </div>

        {b.path.length >= 2 && (
          <div style={{ marginTop: 16, padding: '14px 16px 8px', borderRadius: 12, background: CARD, border: `1px solid ${HAIR}` }}>
            <div style={{ fontSize: 11.5, color: INK2, marginBottom: 4 }}>봉인 이후 가격 경로 <span style={{ color: INK3 }}>· 유리한 날만 고른 게 아니에요</span></div>
            <Sparkline data={b.path} color={pathColor} idKey={b.id} />
          </div>
        )}

        <div style={{ marginTop: 18, textAlign: 'center' }}><div style={{ fontSize: 15.5, fontWeight: 700, color: msg.c }}>{msg.t}</div></div>

        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 13, background: 'rgba(245,208,97,.06)', border: '1px solid rgba(245,208,97,.22)', flexWrap: 'wrap' }}>
          <span style={{ flexShrink: 0, color: COMPASS }}><MiniGlyph kind="compass" c={COMPASS} s={20} /></span>
          <span style={{ flex: 1, minWidth: 200, fontSize: 13, color: INK1, lineHeight: 1.5 }}>
            {b.strategy
              ? <>그때 당신의 항로 <strong style={{ color: COMPASS }}>『{b.strategy}』</strong>가 운용 중이었어요 — 규칙에 맡기면 이런 순간에 흔들리지 않아요.</>
              : <>이런 흔들림을 막고 싶다면 — 나만의 <strong style={{ color: COMPASS }}>항로(전략)</strong>를 정해 자동매매에 맡겨보세요.</>}
          </span>
          {!b.isSample && (
            <button onClick={() => go(b.strategy ? '/auto-trade' : '/strategy')} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, fontSize: 12.5, fontWeight: 700, color: COMPASS, background: 'rgba(245,208,97,.1)', border: '1px solid rgba(245,208,97,.3)', cursor: 'pointer' }}>{b.strategy ? '내 항로 보기' : '항로 정하기'} →</button>
          )}
        </div>

        <button onClick={() => setOpen(o => !o)} style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 7, background: 'none', border: 0, cursor: 'pointer', fontFamily: 'inherit', color: INK2, fontSize: 12, padding: 0 }}>
          <MiniGlyph kind="info" s={14} /> 어떻게 계산했나요? <span style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▾</span>
        </button>
        {open && (
          <p style={{ margin: '10px 0 0', fontSize: 12, color: INK2, lineHeight: 1.7, padding: '12px 14px', borderRadius: 10, background: ABYSS, border: `1px solid ${HAIR}` }}>
            봉인 시점의 가격·등락률·걸린 금액을 서버가 기록합니다. <b>{impulseLabel}</b>는 {b.side === 'SELL' ? '전량 현금화(이후 변동 0%)' : '그때 매수(이후 자산 변동분)'}, <b> {ruleLabel}</b>는 {b.side === 'SELL' ? '그대로 보유(자산 변동분)' : '관망(0%)'}으로 단일·보수 가정해 비교합니다. 수수료·세금은 제외(모의 기준)이며, 고정 시점의 체리피킹을 막기 위해 봉인 이후 경로를 함께 보여줍니다. 한 번의 결과일 뿐, 같은 선택의 기대값이 진짜 교훈이에요.
          </p>
        )}
      </div>
    </Panel>
  );
};

/* ── 감정 패턴 ── */
type PatStat = { label: string; sub: string; total: number; impulse: number };
const PatternBar = ({ data, weak }: { data: PatStat; weak: boolean }) => {
  const pct = data.total ? Math.round((data.impulse / data.total) * 100) : 0;
  const m = data.label.includes('공포') ? triMeta('PANIC_DROP') : triMeta('FOMO_SPIKE');
  return (
    <div style={{ padding: '18px 20px', borderRadius: 14, background: CARD, border: `1px solid ${weak ? m.tone + '55' : HAIR}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{ color: m.tone }}><MiniGlyph kind={m.glyph} c={m.tone} s={18} /></span>
        <span style={{ fontSize: 14.5, fontWeight: 700, whiteSpace: 'nowrap', color: INK0 }}>{data.label}</span>
        {weak
          ? <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: m.tone, padding: '3px 9px', borderRadius: 999, background: m.dim, whiteSpace: 'nowrap' }}>약한 파도</span>
          : <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: DOWN, padding: '3px 9px', borderRadius: 999, background: 'rgba(77,138,255,.12)', whiteSpace: 'nowrap' }}>잘 버팀</span>}
      </div>
      <div style={{ fontSize: 12, color: INK2, margin: '4px 0 14px' }}>{data.sub}</div>
      <div style={{ position: 'relative', height: 10, borderRadius: 99, background: ABYSS, border: `1px solid ${HAIR}`, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: `linear-gradient(90deg, ${m.tone}88, ${m.tone})` }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12 }}>
        <span style={{ color: INK2, whiteSpace: 'nowrap' }}>충동에 휩쓸림</span>
        <span className="font-mono" style={{ fontWeight: 700, color: m.tone }}>{data.total}번 중 {data.impulse}번 · {pct}%</span>
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

/* ── PAGE ── */
const ConsoleMirrorPage = () => {
  const { session } = useAuth();
  const { isVirt } = useRoutePrefix();
  const userName = session?.user?.email ? session.user.email.split('@')[0] : '항해사';
  const [list, setList] = useState<MirrorCapture[]>([]);
  const [loading, setLoading] = useState(true);

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

  const go = useVirtNavigate();
  const drifting = useMemo(() => list.filter(c => !c.revealed).map(toVM), [list]);
  const arrived = useMemo(() => list.filter(c => c.revealed).map(toVM), [list]);
  const empty = list.length === 0;          // 캡처가 하나도 없음 → 미리보기 모드
  const showSample = arrived.length === 0;

  const { savedKrw, lostKrw } = useMemo(() => {
    let s = 0, l = 0;
    arrived.forEach(b => { const cost = (b.rulePct - b.impulsePct) * b.amountKrw / 100; if (b.choice === 'FOLLOW_RULE') s += Math.max(0, cost); else l += Math.max(0, cost); });
    return { savedKrw: s, lostKrw: l };
  }, [arrived]);

  const pattern = useMemo(() => {
    const mk = (key: string, label: string, sub: string): PatStat => {
      const items = list.filter(c => c.triggerType === key);
      return { label, sub, total: items.length, impulse: items.filter(c => c.userChoice === 'FOLLOW_IMPULSE').length };
    };
    return { fear: mk('PANIC_DROP', '공포의 파도', '급락에 팔고 싶어진 순간'), greed: mk('FOMO_SPIKE', '탐욕의 파도', '급등에 사고 싶어진 순간') };
  }, [list]);
  const fearWeak = pattern.fear.total >= 3 && pattern.fear.impulse / pattern.fear.total >= 0.5;
  const greedWeak = pattern.greed.total >= 3 && pattern.greed.impulse / pattern.greed.total >= 0.5;
  const hasPattern = pattern.fear.total + pattern.greed.total >= 2;
  const weakestGreed = greedWeak && pattern.greed.impulse / pattern.greed.total >= (fearWeak ? pattern.fear.impulse / pattern.fear.total : 0);

  return (
    <HelmShell active="mirror" virt={isVirt} userName={userName} session={list.length > 0 ? `유리병 편지 · 표류 중 ${drifting.length} · 도착 ${arrived.length}` : '유리병 편지'}>
      <BottleDefs />
      <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 26, padding: '4px 0 40px' }}>
        {loading ? (
          <Panel style={{ padding: 56, textAlign: 'center' }}><span style={{ color: INK3, fontSize: 13 }}>불러오는 중…</span></Panel>
        ) : (
          <>
            <Hero savedKrw={savedKrw} lostKrw={lostKrw} />

            {empty && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', borderRadius: 14, background: 'linear-gradient(105deg, rgba(91,157,255,.10), transparent 70%)', border: '1px solid rgba(91,157,255,.24)', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 26 }}>🌊</span>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: INK0 }}>아직 띄운 유리병이 없어요</div>
                  <p style={{ margin: '3px 0 0', fontSize: 12.5, color: INK2, lineHeight: 1.6 }}>거래에서 <b style={{ color: INK1 }}>급락에 팔거나 급등에 사려 할 때</b> 그 순간이 여기 담겨요. 아래는 <b style={{ color: INK1 }}>이렇게 채워진다</b>는 예시예요.</p>
                </div>
                <button onClick={() => go('/trade')} className="shrink-0 rounded-[10px] px-4 py-2.5 text-[12.5px] font-bold text-white" style={{ background: `linear-gradient(180deg, ${SONAR}, ${ACCENT})`, boxShadow: '0 8px 18px -10px rgba(60,120,255,.6)' }}>거래하러 가기 →</button>
              </div>
            )}

            {(drifting.length > 0 || empty) && (
              <section>
                <SectionHead icon="lock" title="표류 중인 유리병" desc="봉인된 마음이 파도를 타고 흘러가는 중 — 개봉일이 되면 결과를 실어다 줘요." count={empty ? undefined : drifting.length} />
                {empty && <div style={{ marginBottom: 10, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: INK2 }}>👀 <span style={{ background: 'var(--ci-chip)', color: INK3, padding: '2px 7px', borderRadius: 6, fontWeight: 700, fontSize: 10.5 }}>예시 · 실제 내 기록 아님</span></div>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
                  {(empty ? [SAMPLE_DRIFT] : drifting).map(b => <DriftCard key={b.id} b={b} />)}
                </div>
              </section>
            )}

            <section>
              <SectionHead icon="info" title={showSample ? '이렇게 열려요' : '도착한 유리병'} desc="파도가 답을 실어왔어요. 충동대로 했다면 vs 항로를 지켰다면 — 실제 숫자로." count={showSample ? undefined : arrived.length} />
              {showSample && <div style={{ marginBottom: 10, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: INK2 }}>👀 <span style={{ background: 'var(--ci-chip)', color: INK3, padding: '2px 7px', borderRadius: 6, fontWeight: 700, fontSize: 10.5 }}>예시 · 실제 내 기록 아님</span></div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {(showSample ? [SAMPLE_VM] : arrived).map(b => <RevealCard key={b.id} b={b} />)}
              </div>
            </section>

            {(hasPattern || empty) && (
              <section>
                <SectionHead icon="greed" title="감정 패턴 · 당신이 약한 파도" desc="트리거별 충동 실행률 — 3건 이상 쌓이면 약점을 단정해요." />
                {empty && <div style={{ marginBottom: 10, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: INK2 }}>👀 <span style={{ background: 'var(--ci-chip)', color: INK3, padding: '2px 7px', borderRadius: 6, fontWeight: 700, fontSize: 10.5 }}>예시 · 실제 내 기록 아님</span></div>}
                <Panel style={{ padding: '20px 22px' }}>
                  {(empty || fearWeak || greedWeak) && (
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, color: INK0 }}>
                      🐋 <span>당신은 <span style={{ color: COMPASS }}>{(empty ? true : weakestGreed) ? '탐욕' : '공포'}의 파도</span>에 더 약해요</span>
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                    <PatternBar data={empty ? SAMPLE_PATTERN.fear : pattern.fear} weak={empty ? false : fearWeak} />
                    <PatternBar data={empty ? SAMPLE_PATTERN.greed : pattern.greed} weak={empty ? true : greedWeak} />
                  </div>
                </Panel>
              </section>
            )}

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
                <b style={{ color: INK1 }}>정직성 원칙</b> · 반사실은 "팔았다면 그 돈은 현금이 돼 더는 오르내리지 않는다"는 보수적 가정입니다. 수수료·세금 제외(모의 기준), 고정 시점의 체리피킹은 경로 그래프로 보완해요. 충동이 옳았던 날도 정직하게 비용을 음수로 적습니다. 한 번의 결과가 아니라, <b style={{ color: INK1 }}>같은 선택의 기대값</b>이 진짜 교훈이에요.
              </p>
            </div>

            <footer style={{ marginTop: 6, paddingTop: 18, borderTop: `1px solid ${HAIR}`, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <span className="font-mono" style={{ fontSize: 11.5, color: INK3 }}>© 2026 WHALEARC · 유리병 편지</span>
              <span style={{ fontSize: 11.5, color: INK3 }}>Built quietly, beneath the surface.</span>
            </footer>
          </>
        )}
      </div>
    </HelmShell>
  );
};

export default ConsoleMirrorPage;
