import { useEffect, useState } from 'react';
import type { UserChoice } from '../services/mirrorService';

/* 마음 거울 — 흔들린 순간 인터셉트(급락 공포 매도 / 급등 탐욕 매수).
   막지 않는다. 묻고, 선택을 잠가둔다. 판단은 사용자가, 시스템은 사실만 비춘다. */

const UP = '#ef4d4d', DOWN = '#4d8aff', AMBER = '#f5d061';
const INK0 = 'var(--ci-ink0)', INK1 = 'var(--ci-ink1)', INK2 = 'var(--ci-ink2)', INK3 = 'var(--ci-ink3)';
const LINE = 'var(--ci-line)';

export type MirrorKind = 'PANIC' | 'FOMO';

interface Props {
  kind: MirrorKind;
  name: string;
  changeRate: number;     // 당일 등락률(%) — PANIC=음수, FOMO=양수
  busy?: boolean;
  onClose: () => void;
  onChoice: (choice: UserChoice, note: string, intensity: number) => void;
}

const CFG = {
  PANIC: {
    badge: '급락 공포 감지', badgeColor: '#ff8a8a', badgeBg: 'rgba(239,77,77,.12)', badgeBd: 'rgba(239,77,77,.32)', dot: UP,
    title: '지금 팔고 싶으신가요?',
    move: '빠지고 있어요', moveColor: DOWN,
    ask: '공포의 파도에 휩쓸려 파는 건지, 원래 계획이었는지',
    reassure: '며칠 뒤 "팔았다면 vs 안 팔았다면"',
    placeholder: '더 떨어질 것 같아 무섭다…',
    impulse: '😰 그래도 판다', rule: '🧭 항로를 지킨다',
  },
  FOMO: {
    badge: '급등 탐욕 감지', badgeColor: '#ffd97a', badgeBg: 'rgba(245,208,97,.14)', badgeBd: 'rgba(245,208,97,.34)', dot: AMBER,
    title: '지금 올라타고 싶으신가요?',
    move: '급등하고 있어요', moveColor: UP,
    ask: '탐욕의 파도에 올라타는 건지, 원래 계획이었는지',
    reassure: '며칠 뒤 "샀다면 vs 안 샀다면"',
    placeholder: '나만 못 사는 것 같아 조급하다…',
    impulse: '🤩 그래도 산다', rule: '🧭 관망한다',
  },
} as const;

const EmotionMirrorModal = ({ kind, name, changeRate, busy, onClose, onChoice }: Props) => {
  const c = CFG[kind];
  const [note, setNote] = useState('');
  const [intensity, setIntensity] = useState(3);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  const fire = (choice: UserChoice) => onChoice(choice, note.trim(), intensity);

  return (
    <div onClick={() => !busy && onClose()} className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto px-6 py-12"
      style={{ background: 'rgba(6,11,31,.72)', backdropFilter: 'blur(6px)', animation: 'backdrop-in .2s ease' }}>
      <div onClick={e => e.stopPropagation()} className="relative w-full max-w-[440px] rounded-[18px] overflow-hidden"
        style={{ background: 'var(--ci-overlay)', border: `1px solid var(--ci-line-strong)`, boxShadow: 'var(--ci-panel-shadow)', animation: 'modal-in .25s cubic-bezier(.2,.8,.2,1)' }}>

        {/* 헤더 */}
        <div style={{ padding: '20px 22px 16px', borderBottom: `1px solid ${LINE}` }}>
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
            style={{ background: c.badgeBg, color: c.badgeColor, border: `1px solid ${c.badgeBd}` }}>
            <span className="h-1.5 w-1.5 rounded-full animate-pulse-dot" style={{ background: c.dot }} />{c.badge}
          </span>
          <h2 className="mt-3 text-[20px] font-bold tracking-tight" style={{ color: INK0 }}>{c.title}</h2>
          <p className="mt-2 text-[12.5px] leading-relaxed" style={{ color: INK2 }}>
            {kind === 'PANIC' ? '보유하신' : ''} <b style={{ color: INK1 }}>{name}</b>이(가) 오늘 <b style={{ color: c.moveColor }}>{changeRate >= 0 ? '+' : ''}{changeRate.toFixed(1)}%</b> {c.move}.
            {c.ask} <b style={{ color: INK1 }}>잠깐만 짚어볼까요?</b>
          </p>
          <p className="mt-2 rounded-lg px-2.5 py-1.5 text-[11.5px] leading-snug" style={{ background: 'var(--ci-card)', border: `1px solid ${LINE}`, color: INK2 }}>
            🐋 막지 않아요. 마음만 살짝 기록하고, <b style={{ color: INK1 }}>{c.reassure}</b> 결과를 같이 봐요.
          </p>
        </div>

        {/* 감정 기록 */}
        <div style={{ padding: '16px 22px' }}>
          <label className="text-[11.5px] font-semibold tracking-[.04em]" style={{ color: INK2 }}>지금 마음은 어떤가요? <span style={{ color: INK3 }}>(선택)</span></label>
          <textarea value={note} onChange={e => setNote(e.target.value.slice(0, 200))} rows={2}
            placeholder={c.placeholder}
            className="mt-1.5 w-full resize-none rounded-[10px] px-3 py-2.5 text-[13px] outline-none"
            style={{ border: `1px solid ${LINE}`, background: 'var(--ci-raised)', color: INK0 }} />

          <div className="mt-3 flex items-center justify-between">
            <span className="text-[11.5px] font-semibold" style={{ color: INK2 }}>감정 강도</span>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setIntensity(n)} aria-label={`강도 ${n}`}
                  className="h-4 w-4 rounded-full transition-colors"
                  style={{ background: n <= intensity ? c.dot : 'var(--ci-chip)', border: `1px solid ${n <= intensity ? c.badgeBd : LINE}` }} />
              ))}
            </div>
          </div>
        </div>

        {/* 선택 — 막지 않는다 */}
        <div style={{ padding: '4px 22px 18px' }}>
          <div className="grid grid-cols-2 gap-2.5">
            <button onClick={() => fire('FOLLOW_IMPULSE')} disabled={busy}
              className="rounded-[11px] py-3 text-[13.5px] font-bold disabled:opacity-50"
              style={{ background: 'rgba(239,77,77,.10)', color: '#ff8a8a', border: '1px solid rgba(239,77,77,.4)' }}>
              {c.impulse}
            </button>
            <button onClick={() => fire('FOLLOW_RULE')} disabled={busy}
              className="rounded-[11px] py-3 text-[13.5px] font-bold text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(180deg, var(--ci-sonar), #2f6fe0)', border: '1px solid rgba(140,190,255,.4)' }}>
              {c.rule}
            </button>
          </div>
          <p className="mt-3 text-center text-[11px]" style={{ color: INK3 }}>
            🌊 이 마음을 유리병에 담아 띄워요 · <b style={{ color: INK2 }}>며칠 뒤</b> 파도가 답을 실어다 줘요 · 충동이 옳았던 날도 정직하게
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmotionMirrorModal;
