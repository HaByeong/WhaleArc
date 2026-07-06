import { Fragment } from 'react';
import { useNavigate } from 'react-router-dom';

/* 전략·백테스트 → 자동매매 퍼널의 현재 단계를 표시(여정감). 클릭 시 해당 단계로 이동.
   모의(VIRT) 흐름 기준 — 두 페이지(전략·백테스트/자동매매)가 한 여정으로 읽히게 한다.
   (구 '전략 학습'(/store)은 '전략·백테스트'(/strategy)로 통합돼 1단계에 흡수됨) */
const FUNNEL = [
  { n: 1, label: '전략·백테스트', path: '/virt/strategy' },
  { n: 2, label: '자동매매', path: '/virt/auto-trade' },
] as const;

const FunnelSteps = ({ current }: { current: 1 | 2 }) => {
  const navigate = useNavigate();
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto" style={{ fontSize: 12.5 }}>
      {FUNNEL.map((s, i) => {
        const active = current === s.n;
        const done = current > s.n;
        return (
          <Fragment key={s.n}>
            <button
              onClick={() => navigate(s.path)}
              title={`${s.label}로 이동`}
              aria-current={active ? 'step' : undefined}
              aria-label={`${s.label}${done ? ' (완료)' : active ? ' (현재 단계)' : ''}로 이동`}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold transition-colors"
              style={active
                ? { background: 'var(--ci-sonar-dim)', color: 'var(--ci-sonar)', border: '1px solid rgba(91,157,255,.4)' }
                : { background: 'var(--ci-card)', color: done ? 'var(--ci-ink1)' : 'var(--ci-ink3)', border: '1px solid var(--ci-line)' }}
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full text-[11px] font-bold"
                style={active
                  ? { background: 'var(--ci-sonar)', color: '#fff' }
                  : { background: done ? 'rgba(63,214,160,.2)' : 'var(--ci-chip)', color: done ? '#3fd6a0' : 'var(--ci-ink3)' }}>
                {done ? '✓' : s.n}
              </span>
              {s.label}
            </button>
            {i < FUNNEL.length - 1 && <span aria-hidden className="shrink-0" style={{ color: 'var(--ci-ink3)' }}>→</span>}
          </Fragment>
        );
      })}
    </div>
  );
};

export default FunnelSteps;
