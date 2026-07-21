import type { CSSProperties, ReactNode } from 'react';
import { panel, UP, DOWN } from './format';

/* ────────────────────────────────────────────────────────────
   콘솔 공용 UI 컴포넌트 (상수·포맷터는 ./format.ts — Vite fast-refresh 때문에 파일 분리).
   ConsoleDashboardPage·ConsolePortfolioPage에 복붙돼 있던 정의를 추출한 것 —
   다른 콘솔 페이지에도 같은 복붙이 남아 있으니 점진 전환 대상.
   ※ 순수 이동(동작 불변)이 원칙: 마크업을 바꾸려면 사용처 전체를 확인할 것.
   ──────────────────────────────────────────────────────────── */

export const Panel = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => <div style={{ ...panel, ...style }}>{children}</div>;

export const PanelHead = ({ kicker, title, right }: { kicker?: string; title: string; right?: ReactNode }) => (
  <div className="wa-force-dark flex items-center justify-between px-[22px] py-[15px] text-white" style={{ background: 'linear-gradient(105deg,#142647 0%,#1d3c7a 52%,#2c6fe6 100%)', borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
    <div>{kicker && <div className="text-[11.5px] font-bold tracking-[.22em] text-white/70">{kicker}</div>}<div className="text-[17.5px] font-bold">{title}</div></div>
    {right}
  </div>
);

export const Tri = ({ up }: { up: boolean }) => (
  <svg width="9" height="9" viewBox="0 0 10 10" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 2 }}><path d={up ? 'M5 1l4 7H1z' : 'M5 9L1 2h8z'} fill={up ? UP : DOWN} /></svg>
);

export const Toast = ({ msg, type }: { msg: string; type: 'success' | 'error' }) => (
  <div className="fixed bottom-6 left-1/2 z-[120] -translate-x-1/2 rounded-xl px-5 py-3 text-[14px] font-semibold text-white" style={{ background: type === 'error' ? 'linear-gradient(180deg,#e0524f,#c23b38)' : 'linear-gradient(180deg,#2f9e6e,#1f7d57)', boxShadow: '0 14px 32px -10px rgba(0,0,0,.55)', animation: 'message-in .25s ease' }}>{msg}</div>
);

export const ConsoleFooter = ({ note = '모든 항해는 사용자의 책임 아래 진행됩니다.' }: { note?: string }) => (
  <footer className="mt-2 flex flex-wrap justify-between gap-3 border-t border-white/10 pt-5">
    <span className="font-mono text-[12.5px] text-white/30">© 2026 WHALEARC · {note}</span>
    <span className="text-[12.5px] text-white/30">Built quietly, beneath the surface.</span>
  </footer>
);
