import { useEffect } from 'react';

/**
 * 모달 공통 크롬 — Esc로 닫기 + 열림 동안 배경 스크롤 잠금.
 * 모달 컴포넌트 최상위에서 useModalChrome(onClose)로 쓰거나,
 * 인라인 조건부 모달({open && <div…>})이면 페이지 최상위에서 useModalChrome(onClose, open)으로 쓴다
 * (훅은 조건부 호출이 불가하므로 enabled 파라미터로 우회).
 */
export function useModalChrome(onClose: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = prev; };
  }, [onClose, enabled]);
}
