import type { ReactNode } from 'react';

/* 신규 유저(데이터 0) 빈 상태 — 유리병 편지 EmptyDiscipline과 같은 결.
   글로우·소나 물결·반짝임 + 고래마크 + CTA + "여기에 채워질 항목" 미리보기 + 노트. */

const SONAR = 'var(--ci-sonar)', ACCENT = '#2c6fe6';
const INK0 = 'var(--ci-ink0)', INK1 = 'var(--ci-ink1)', INK3 = 'var(--ci-ink3)';
const HAIR = 'var(--ci-line)', HAIRS = 'var(--ci-line-strong)';
const PANEL = 'linear-gradient(180deg, rgba(91,157,255,.055), transparent 55%), var(--ci-panel)';

export type PrevKind = 'pie' | 'swap' | 'route' | 'chat' | 'sonar' | 'card' | 'note' | 'book';
export type PrevItem = { icon?: PrevKind; label: string; sub: string };
export type EmptyStateProps = {
  kicker?: string;
  title: string;
  desc: string;
  ctaLabel?: string;
  onCta?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  preview?: PrevItem[];
  note?: string;
};

const PrevIcon = ({ kind, c = INK3 }: { kind?: PrevKind; c?: string }) => {
  const common = { width: 18, height: 18, viewBox: '0 0 22 22', fill: 'none', stroke: c, strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (kind) {
    case 'pie': return <svg {...common}><path d="M11 3a8 8 0 1 0 8 8h-8z" /><path d="M11 3v8h8a8 8 0 0 0-8-8z" /></svg>;
    case 'sonar': return <svg {...common}><circle cx="11" cy="11" r="2.5" /><path d="M5.5 11a5.5 5.5 0 0 1 11 0M2 11a9 9 0 0 1 18 0" /></svg>;
    case 'swap': return <svg {...common}><path d="M7 4v14M7 4L4 7M7 4l3 3M15 18V4M15 18l3-3M15 18l-3-3" /></svg>;
    case 'route': return <svg {...common}><circle cx="5" cy="17" r="2.5" /><circle cx="17" cy="5" r="2.5" /><path strokeDasharray="2 2" d="M6.5 15C12 10 9 8 15.5 6.5" /></svg>;
    case 'chat': return <svg {...common}><path d="M4 5h14v9H9l-4 3.5V14H4z" /></svg>;
    case 'card': return <svg {...common}><rect x="2" y="5" width="18" height="13" rx="2" /><path d="M2 9.5h18M5.5 14h4" /></svg>;
    case 'book': return <svg {...common}><path d="M11 5C9 3.5 5.5 3.5 3.5 4.5v12C5.5 15.5 9 15.5 11 17M11 5c2-1.5 5.5-1.5 7.5-.5v12c-2-1-5.5-1-7.5.5M11 5v12" /></svg>;
    case 'note': return <svg {...common}><rect x="5" y="3.5" width="13" height="16" rx="1.5" /><path d="M8.5 8h6M8.5 11.5h6M8.5 15h3.5" /></svg>;
    default: return <Lock c={c} />;
  }
};
const Lock = ({ c = INK3, s = 15 }: { c?: string; s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 18 18" fill="none">
    <rect x="3.5" y="7.8" width="11" height="7.2" rx="2" stroke={c} strokeWidth="1.5" />
    <path d="M5.8 7.8V6a3.2 3.2 0 0 1 6.4 0v1.8" stroke={c} strokeWidth="1.5" />
  </svg>
);

const ctaPrimary: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '12px 22px', borderRadius: 12, border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, color: '#fff', background: `linear-gradient(180deg, ${SONAR}, ${ACCENT})`, boxShadow: '0 12px 26px -12px rgba(60,120,255,.7)' };
const ctaGhost: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '12px 20px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, color: INK1, background: 'var(--ci-inset)', border: `1px solid ${HAIRS}` };

const SPARKLES: [number, number, number, number][] = [[58, 54, 13, 0], [300, 70, 11, 1.1], [150, 38, 15, .6], [330, 150, 11, 1.6]];

const EmptyState = ({ kicker, title, desc, ctaLabel, onCta, secondaryLabel, onSecondary, preview, note }: EmptyStateProps) => (
  <section style={{ position: 'relative', overflow: 'hidden', background: PANEL, border: `1px solid ${HAIR}`, borderRadius: 16, boxShadow: 'var(--ci-panel-shadow)' }}>
    <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(120% 85% at 50% -8%, rgba(91,157,255,.14), transparent 60%)' }} />
    <svg aria-hidden viewBox="0 0 200 200" style={{ position: 'absolute', left: '50%', top: -34, transform: 'translateX(-50%)', width: 360, height: 360, opacity: .1, pointerEvents: 'none' }}>
      {[50, 84, 118].map(r => <circle key={r} cx="100" cy="100" r={r} fill="none" stroke={SONAR} strokeWidth="1" />)}
    </svg>
    {SPARKLES.map(([x, y, s, d], i) => (
      <span key={i} aria-hidden style={{ position: 'absolute', left: x, top: y, pointerEvents: 'none', animation: `twinkle 2.8s ease-in-out ${d}s infinite` }}>
        <svg width={s} height={s} viewBox="0 0 22 22" fill="none"><path d="M11 3l1.6 4.8L17.4 9.4 12.6 11 11 15.8 9.4 11 4.6 9.4 9.4 7.8z" stroke="#9cc1ff" strokeWidth="1.4" fill="none" strokeLinejoin="round" /></svg>
      </span>
    ))}

    <div style={{ position: 'relative', padding: '48px 32px 40px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <span style={{ animation: 'float-y 5.5s ease-in-out infinite', marginBottom: 18, display: 'inline-flex' }}>
        <img src="/whale-hero-logo.png" alt="WhaleArc" width={58} style={{ height: 'auto', display: 'block', filter: 'drop-shadow(0 0 6px rgba(91,157,255,.35))' }} />
      </span>
      {kicker && <div style={{ fontSize: 10.5, letterSpacing: '.2em', fontWeight: 700, color: SONAR, marginBottom: 11 }}>{kicker}</div>}
      <h3 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.01em', color: INK0 }}>{title}</h3>
      <p style={{ margin: '11px auto 0', fontSize: 13.5, color: INK1, lineHeight: 1.7, maxWidth: 450 }}>{desc}</p>

      {(ctaLabel || secondaryLabel) && (
        <div style={{ marginTop: 22, display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          {ctaLabel && <button onClick={onCta} style={ctaPrimary}>{ctaLabel}</button>}
          {secondaryLabel && <button onClick={onSecondary} style={ctaGhost}>{secondaryLabel}</button>}
        </div>
      )}

      {preview && preview.length > 0 && (
        <div style={{ width: '100%', maxWidth: 540, marginTop: 34 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: INK3, letterSpacing: '.06em', marginBottom: 12, textAlign: 'left' }}>여기에 채워질 항목</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {preview.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 16px', borderRadius: 12, background: 'rgba(255,255,255,.015)', border: `1px dashed ${HAIRS}`, opacity: .72 }}>
                <span style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: INK3, background: 'rgba(255,255,255,.03)', border: `1px solid ${HAIR}` }}>
                  <PrevIcon kind={p.icon} />
                </span>
                <div style={{ textAlign: 'left', minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: INK1 }}>{p.label}</div>
                  <div style={{ fontSize: 11, color: INK3 }}>{p.sub}</div>
                </div>
                <span style={{ marginLeft: 'auto', flexShrink: 0 }}><Lock s={13} /></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {note && <p style={{ margin: '24px auto 0', fontSize: 11.5, color: INK3, lineHeight: 1.6, maxWidth: 450 }}>{note as ReactNode}</p>}
    </div>
  </section>
);

export default EmptyState;
