import { useState, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { GLOSSARY } from './TermTooltip';
import { useTheme } from '../contexts/ThemeContext';

/* 콘솔(다크/라이트) 톤 금융용어 툴팁 — 호버 시 초보자용 설명 표시.
   용어 데이터(GLOSSARY)는 TermTooltip 재사용, 스타일만 --ci-* 토큰으로 콘솔에 맞춤.
   fixed 포지셔닝이라 패널 overflow 에 잘리지 않음. compact=좁은 라벨용(아이콘 생략·색 상속). */
export const Term = ({ k, children, compact = false, className = '' }: { k: string; children?: ReactNode; compact?: boolean; className?: string }) => {
  const [show, setShow] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const ref = useRef<HTMLSpanElement>(null);
  const { isDark } = useTheme();
  const entry = GLOSSARY[k];
  if (!entry) return <span className={className}>{children ?? k}</span>;

  // 예시/주의 라벨 정규화: 기존 "예: …"/"주의: …" 접두어는 떼고 일관된 배지로 표시 (배지 없던 신규 용어도 '예시'로 통일)
  const exMatch = entry.example?.match(/^(예시|예|주의|참고)\s*[:：]\s*([\s\S]*)$/);
  const exCaution = exMatch?.[1] === '주의';
  const exKind = exCaution ? '주의' : '예시';
  const exBody = exMatch ? exMatch[2] : entry.example;
  const exColor = exCaution ? 'var(--ci-compass, #f5d061)' : 'var(--ci-sonar, #5b9dff)';
  const exBg = exCaution ? 'rgba(245,208,97,.16)' : 'rgba(91,157,255,.16)';

  const onEnter = () => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const w = 288;
    const below = r.top < 170;
    let left = r.left + r.width / 2 - w / 2;
    if (left < 8) left = 8;
    if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8;
    setStyle({ position: 'fixed', left, top: below ? r.bottom + 8 : r.top - 8, transform: below ? 'none' : 'translateY(-100%)', width: w });
    setShow(true);
  };

  return (
    <span ref={ref} className={`relative inline-flex items-center cursor-help ${className}`} onMouseEnter={onEnter} onMouseLeave={() => setShow(false)}>
      <span style={compact
        ? { borderBottom: '1px dotted currentColor', opacity: .92 }
        : { borderBottom: '1px dashed var(--ci-sonar, #5b9dff)', color: 'var(--ci-sonar, #5b9dff)', fontWeight: 600 }}>
        {children ?? k}
      </span>
      {!compact && (
        <svg width="11" height="11" className="ml-0.5 shrink-0" style={{ color: 'var(--ci-sonar, #5b9dff)', opacity: .6 }} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
      )}
      {show && createPortal((
        // body로 포털 — 콘솔 본문(.wa-console-dense)의 zoom 밖에서 렌더해 좌표(getBoundingClientRect)가
        // position:fixed와 일치하게 한다. --ci-* 변수는 wa-console 래퍼로 다시 공급(테마 적응 유지).
        <div className={isDark ? 'wa-console wa-force-dark' : 'wa-console'} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999 }}>
          <span style={{ ...style, zIndex: 9999, padding: '12px 14px', borderRadius: 12, background: 'var(--ci-overlay, #0e1a3d)', border: '1px solid var(--ci-line-strong, rgba(255,255,255,.18))', boxShadow: '0 18px 44px -14px rgba(0,0,0,.7)', textAlign: 'left', pointerEvents: 'none' }}>
            <span className="block text-[13px] font-bold" style={{ color: 'var(--ci-ink0, #fff)' }}>{entry.title}</span>
            <span className="mt-1 block text-[12.5px] leading-relaxed" style={{ color: 'var(--ci-ink2, rgba(255,255,255,.66))', whiteSpace: 'pre-wrap' }}>{entry.desc}</span>
            {entry.example && (
              <span className="mt-1.5 flex items-start gap-1.5 border-t pt-1.5 text-[12px] leading-relaxed" style={{ borderColor: 'var(--ci-line, rgba(255,255,255,.10))' }}>
                <span style={{ flexShrink: 0, fontWeight: 700, fontSize: 9.5, lineHeight: '16px', padding: '0 5px', borderRadius: 5, background: exBg, color: exColor }}>{exKind}</span>
                <span style={{ color: exColor }}>{exBody}</span>
              </span>
            )}
          </span>
        </div>
      ), document.body)}
    </span>
  );
};
