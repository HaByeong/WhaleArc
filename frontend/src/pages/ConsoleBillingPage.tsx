import type { ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { effectiveTier } from '../services/userService';
import { useRoutePrefix } from '../hooks/useRoutePrefix';
import HelmShell from '../components/HelmShell';

/* ────────────────────────────────────────────────────────────
   ConsoleBillingPage — 결제·구독 (준비 중)
   결제 백엔드가 아직 없으므로 "현재 구독/결제수단/결제내역"을 실제처럼 보여주지 않는다.
   아래는 출시 예정 플랜·가격 "미리보기"이며, 현재 모든 기능은 무료로 제공된다.
   ──────────────────────────────────────────────────────────── */

const SONAR = 'var(--ci-sonar)', ACCENT = '#2c6fe6', COMPASS = '#f5d061';
const INK1 = 'var(--ci-ink1)', INK2 = 'var(--ci-ink2)', INK3 = 'var(--ci-ink3)';
const HAIR = 'var(--ci-line)', HAIR_S = 'var(--ci-line-strong)';
const ABYSS0 = 'var(--ci-card)', SONAR_DIM = 'rgba(91,157,255,.10)';
const won = (n: number) => '₩' + n.toLocaleString('ko-KR');
const panel: React.CSSProperties = { background: 'var(--ci-panel)', border: `1px solid ${HAIR}`, borderRadius: 16, boxShadow: 'var(--ci-panel-shadow)', overflow: 'hidden' };
const Panel = ({ children, style }: { children: ReactNode; style?: React.CSSProperties }) => <div style={{ ...panel, ...style }}>{children}</div>;
const PanelHead = ({ kicker, title, right }: { kicker: string; title: string; right?: ReactNode }) => (
  <div className="wa-force-dark flex items-center justify-between gap-3 px-[22px] py-[15px] text-white" style={{ background: 'linear-gradient(105deg,#142647 0%,#1d3c7a 52%,#2c6fe6 100%)' }}>
    <div><div className="text-[11.5px] font-bold tracking-[.22em] text-white/70">{kicker}</div><div className="text-[17.5px] font-bold">{title}</div></div>
    {right}
  </div>
);
const Check = () => <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="shrink-0"><circle cx="8" cy="8" r="8" fill={SONAR_DIM} /><path d="M5 8.2 L7 10.2 L11 5.8" stroke={SONAR} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
// '현재 플랜'은 유저의 실효 등급(ADMIN→PRO)으로 표시. 결제 미연동이라 과금은 없음(아래 가격은 출시 예정 미리보기).
type Plan = { id: string; name: string; tagline: string; monthly: number; yearly: number; featured?: boolean; features: string[] };
const PLANS: Plan[] = [
  { id: 'free', name: 'Free', tagline: '무료로 시작하기', monthly: 0, yearly: 0, features: ['시세 조회 · VIRT 가상매매', '프리셋 백테스트 단일 종목 · 1년', '랭킹 · 피드백 · 알림 3개'] },
  { id: 'basic', name: 'Basic', tagline: '본격적인 백테스트', monthly: 19900, yearly: 199000, features: ['Free의 모든 기능', '백테스트 5년 · 멀티 종목 5', '커스텀 전략 빌더', '실거래 전략 1 · 종목 3', '알림 20개'] },
  { id: 'pro', name: 'Pro', tagline: '무제한 · 자동화', featured: true, monthly: 49900, yearly: 499000, features: ['Basic의 모든 기능', '백테스트 10년+ · 무제한', '고급 전략 · 실거래 무제한 · 리밸런싱', '퀀트스토어 · 알림 무제한'] },
];

const PlanCard = ({ plan, currentPlanId }: { plan: Plan; currentPlanId: string }) => {
  const isCurrent = plan.id === currentPlanId, featured = plan.featured;
  const ctaLabel = isCurrent ? '현재 이용 중' : '출시 예정';
  return (
    <article className="relative flex flex-col rounded-2xl px-6 py-7" style={{ background: featured ? 'linear-gradient(180deg, rgba(91,157,255,.14), rgba(91,157,255,.03) 60%, transparent)' : 'var(--ci-card)', border: isCurrent ? `1px solid ${SONAR}` : featured ? '1px solid rgba(91,157,255,.4)' : `1px solid ${HAIR}`, boxShadow: isCurrent ? `0 0 0 3px ${SONAR_DIM}` : undefined }}>
      <span className="absolute left-[22px] flex gap-1.5" style={{ top: -11 }}>
        {isCurrent && <span className="rounded-full px-2.5 py-1 text-[12px] font-bold text-white" style={{ background: SONAR, boxShadow: '0 6px 14px -6px rgba(60,120,255,.7)' }}>현재 플랜</span>}
        {featured && !isCurrent && <span className="rounded-full px-2.5 py-1 text-[12px] font-bold text-white" style={{ background: `linear-gradient(180deg, ${SONAR}, ${ACCENT})` }}>가장 인기</span>}
      </span>
      <div className="text-[18.5px] font-bold">{plan.name}</div>
      <div className="mt-0.5 text-[13px]" style={{ color: INK2 }}>{plan.tagline}</div>
      <div className="mb-1 mt-[18px] flex items-baseline gap-1.5">
        {plan.monthly === 0 ? <span className="font-mono text-[32.5px] font-bold">무료</span> : <><span className="font-mono text-[32.5px] font-bold tracking-tight">{won(plan.monthly)}</span><span className="text-[14px]" style={{ color: INK2 }}>/ 월</span></>}
      </div>
      <div className="text-[12.5px] font-semibold" style={{ height: 16, color: SONAR }}>{plan.yearly > 0 ? `연간 결제 시 월 ${won(Math.round(plan.yearly / 12))} 상당` : ''}</div>
      <button disabled className="mt-4 w-full rounded-[11px] px-4 py-3 text-[14.5px] font-semibold" style={isCurrent ? { border: `1px solid ${HAIR}`, background: 'transparent', color: INK2, cursor: 'default' } : { border: `1px solid ${HAIR}`, background: 'transparent', color: INK3, cursor: 'default' }}>{ctaLabel}</button>
      <ul className="mt-[22px] flex list-none flex-col gap-3 p-0">{plan.features.map(f => <li key={f} className="flex items-center gap-2.5 text-[14px]" style={{ color: INK1 }}><Check />{f}</li>)}</ul>
    </article>
  );
};

const ConsoleBillingPage = () => {
  const { session, tier, role } = useAuth();
  const { isVirt } = useRoutePrefix();
  const userName = session?.user?.email ? session.user.email.split('@')[0] : '항해사';
  // 실효 등급(ADMIN→PRO)으로 '현재 플랜' 표시. 결제 미연동이라 tier는 DB상 FREE일 수 있으나 권한은 role/effectiveTier 기준.
  const isAdmin = role === 'ADMIN';
  const effTier = effectiveTier(tier, role);           // 'FREE' | 'BASIC' | 'PRO'
  const currentPlanId = effTier.toLowerCase();
  const currentPlan = PLANS.find(p => p.id === currentPlanId) ?? PLANS[0];

  return (
    <HelmShell active="billing" virt={isVirt} userName={userName} session={isAdmin ? '운영자 · Pro 전 기능' : `${currentPlan.name} 플랜 이용 중`}>
      <div className="mx-auto flex max-w-[1560px] flex-col gap-[18px]">
        <div><h1 className="text-[28px] font-bold tracking-tight">결제 · 구독</h1><p className="mt-2 text-[14.5px]" style={{ color: INK1 }}>{userName} 항해사님의 플랜을 확인하세요.</p></div>

        {/* 준비 중 안내 배너 */}
        <div className="flex items-start gap-3 rounded-2xl px-[22px] py-4" style={{ background: 'rgba(245,208,97,.10)', border: '1px solid rgba(245,208,97,.34)' }}>
          <span className="mt-0.5 shrink-0 text-[19.5px]">🛠️</span>
          <div>
            <div className="text-[15px] font-bold" style={{ color: COMPASS }}>결제 기능은 준비 중입니다</div>
            <div className="mt-1 text-[14px] leading-relaxed" style={{ color: INK1 }}>아래 플랜과 가격은 <b>출시 예정 미리보기</b>예요. 지금은 <b>모든 기능을 무료로</b> 이용하실 수 있고, 등록된 결제 수단이나 청구 내역은 없습니다.</div>
          </div>
        </div>

        {/* 현재 플랜 */}
        <Panel style={{ padding: 0 }}>
          <PanelHead kicker="MY PLAN" title="현재 플랜" right={<span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12.5px] font-bold text-white" style={{ background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.3)' }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: '#7af5c8', boxShadow: '0 0 8px #7af5c8' }} />{isAdmin ? '운영자' : '이용 중'}</span>} />
          <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr]">
            <div className="px-[30px] py-[26px]" style={{ borderRight: `1px solid ${HAIR}` }}>
              <div className="flex flex-wrap items-baseline gap-2.5"><span className="text-[36.5px] font-bold tracking-tight">{currentPlan.name}</span><span className="font-mono text-[19.5px] font-semibold" style={{ color: INK1 }}>{isAdmin ? '운영자 · 전 기능' : currentPlan.monthly === 0 ? '무료' : `${won(currentPlan.monthly)}/월`}</span></div>
              <p className="mt-2 text-[14px]" style={{ color: INK2 }}>{isAdmin ? '운영자(ADMIN) 계정으로 모든 기능을 제한 없이 이용 중입니다.' : currentPlan.id === 'free' ? '현재 모든 기능을 무료로 제공하고 있어요. 유료 플랜은 출시되면 안내드릴게요.' : `${currentPlan.name} 플랜 기능을 이용 중입니다. 결제 연동 전까지 과금은 없습니다.`}</p>
              <ul className="mt-[22px] flex list-none flex-col gap-2.5 p-0">{currentPlan.features.map(f => <li key={f} className="flex items-center gap-2.5 text-[14px]" style={{ color: INK1 }}><Check />{f}</li>)}</ul>
            </div>
            <div className="flex flex-col justify-center px-[26px] py-6">
              <div className="mb-3.5 text-[11.5px] font-semibold tracking-[.2em]" style={{ color: INK2 }}>결제 수단</div>
              <div className="flex flex-col items-center justify-center gap-2 rounded-[14px] px-5 py-8 text-center" style={{ background: ABYSS0, border: `1px dashed ${HAIR_S}` }}>
                <span className="text-[24px] opacity-60">💳</span>
                <div className="text-[14px] font-semibold" style={{ color: INK1 }}>등록된 결제 수단 없음</div>
                <div className="text-[12.5px]" style={{ color: INK3 }}>결제 기능 출시 후 등록할 수 있어요</div>
              </div>
            </div>
          </div>
        </Panel>

        {/* 플랜 미리보기 */}
        <Panel style={{ padding: 0 }}>
          <PanelHead kicker="PLANS · 출시 예정" title="플랜 미리보기" right={<span className="rounded-full px-2.5 py-1 text-[12px] font-bold text-white" style={{ background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.28)' }}>준비 중</span>} />
          <div className="grid items-start gap-[18px] px-[26px] pb-[26px] pt-[30px]" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            {PLANS.map(p => <PlanCard key={p.id} plan={p} currentPlanId={currentPlanId} />)}
          </div>
        </Panel>

        <p className="mt-1 text-center text-[13px]" style={{ color: INK3 }}>유료 플랜·결제는 준비 중입니다 · 실거래 연동은 VIRT 검증 후 활성화됩니다.</p>
        <footer className="mt-2 flex flex-wrap justify-between gap-3 pt-5" style={{ borderTop: `1px solid ${HAIR}` }}>
          <span className="font-mono text-[12.5px]" style={{ color: INK3 }}>© 2026 WHALEARC</span>
          <span className="text-[12.5px]" style={{ color: INK3 }}>Built quietly, beneath the surface.</span>
        </footer>
      </div>
    </HelmShell>
  );
};

export default ConsoleBillingPage;
