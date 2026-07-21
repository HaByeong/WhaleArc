import type { ReactNode } from 'react';
import { INK2 } from '../console/format';
import { BT_GRAD } from './shared';

/* 전략·백테스트 공용 소형 컴포넌트 — 상수/타입은 shared.ts (fast-refresh 경고 방지 분리) */

export const StationBar = ({ title, sub, badge }: { title: string; sub: string; badge?: ReactNode }) => (
  <div className="wa-force-dark flex items-center gap-3.5 rounded-[14px] px-[22px] py-4 text-white" style={{ background: BT_GRAD, border: '1px solid rgba(255,255,255,.14)', boxShadow: '0 10px 26px -12px rgba(20,130,170,.6), inset 0 1px 0 rgba(255,255,255,.22)' }}>
    <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px]" style={{ background: 'rgba(255,255,255,.16)' }}>
      <svg width="18" height="18" viewBox="0 0 22 22" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="17" r="2.2" /><circle cx="17" cy="5" r="2.2" /><path strokeDasharray="2 2" d="M6.5 15C12 10 9 8 15.5 6.5" /></svg>
    </span>
    <div className="min-w-0 flex-1"><div className="text-[17.5px] font-bold">{title}</div><div className="truncate text-[13.5px] text-white/70">{sub}</div></div>
    {badge}
  </div>
);

export const Label = ({ children }: { children: ReactNode }) => <span className="text-[12.5px] font-semibold tracking-[.06em]" style={{ color: INK2 }}>{children}</span>;
