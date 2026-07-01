import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { effectiveTier } from '../services/userService';
import { useRoutePrefix } from '../hooks/useRoutePrefix';
import HelmShell from '../components/HelmShell';
import { billingService, type SubscriptionInfo } from '../services/billingService';
import { requestBillingAuth } from '../lib/toss';
import { getErrorMessage } from '../utils/api';

/* ────────────────────────────────────────────────────────────
   ConsoleBillingPage — 결제·구독
   토스페이먼츠 자동결제(빌링) 연동. 카드 등록은 토스 결제창(requestBillingAuth)에서 진행되고,
   성공/실패는 /billing/success, /billing/fail 로 리다이렉트되어 등록·에러 처리를 마무리한다.
   ──────────────────────────────────────────────────────────── */

const SONAR = 'var(--ci-sonar)', ACCENT = '#2c6fe6';
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

const PlanCard = ({ plan, currentPlanId, isAdmin, busyPlanId, onSubscribe, onCancel }: {
  plan: Plan; currentPlanId: string; isAdmin: boolean; busyPlanId: string | null;
  onSubscribe: (planId: string) => void; onCancel: () => void;
}) => {
  const isCurrent = plan.id === currentPlanId, featured = plan.featured, isFree = plan.id === 'free';
  const busy = busyPlanId === plan.id;
  // 관리자는 실효 등급이 PRO로 표시되지만 실제 결제 구독이 아니므로 해지 버튼을 노출하지 않는다.
  const canCancel = isCurrent && !isFree && !isAdmin;
  const canSubscribe = !isCurrent && !isFree && !isAdmin;
  const ctaLabel = isFree ? (isCurrent ? '현재 이용 중' : '무료 플랜')
    : busy ? '처리 중...'
    : canCancel ? '구독 해지하기'
    : canSubscribe ? '구독하기'
    : '현재 이용 중';
  const disabled = isFree || isAdmin || busy;
  const handleClick = () => {
    if (disabled) return;
    if (canCancel) onCancel(); else if (canSubscribe) onSubscribe(plan.id);
  };
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
      <button
        disabled={disabled}
        onClick={handleClick}
        className="mt-4 w-full rounded-[11px] px-4 py-3 text-[14.5px] font-semibold"
        style={canSubscribe
          ? { border: `1px solid ${SONAR}`, background: SONAR, color: '#fff', cursor: 'pointer' }
          : canCancel
          ? { border: `1px solid ${HAIR_S}`, background: 'transparent', color: INK1, cursor: 'pointer' }
          : { border: `1px solid ${HAIR}`, background: 'transparent', color: INK3, cursor: 'default' }}
      >{ctaLabel}</button>
      <ul className="mt-[22px] flex list-none flex-col gap-3 p-0">{plan.features.map(f => <li key={f} className="flex items-center gap-2.5 text-[14px]" style={{ color: INK1 }}><Check />{f}</li>)}</ul>
    </article>
  );
};

const PLAN_KEY: Record<string, 'BASIC_MONTHLY' | 'PRO_MONTHLY'> = { basic: 'BASIC_MONTHLY', pro: 'PRO_MONTHLY' };

const ConsoleBillingPage = () => {
  const { session, tier, role, refreshProfile } = useAuth();
  const { isVirt } = useRoutePrefix();
  const userName = session?.user?.email ? session.user.email.split('@')[0] : '항해사';
  // 실효 등급(ADMIN→PRO)으로 '현재 플랜' 표시. tier는 결제 성공/해지 시 refreshProfile()로 갱신된다.
  const isAdmin = role === 'ADMIN';
  const effTier = effectiveTier(tier, role);           // 'FREE' | 'BASIC' | 'PRO'
  const currentPlanId = effTier.toLowerCase();
  const currentPlan = PLANS.find(p => p.id === currentPlanId) ?? PLANS[0];

  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    billingService.getSubscription().then(setSubscription).catch(() => {});
  }, []);

  const handleSubscribe = async (planId: string) => {
    if (!session?.user) return;
    setError('');
    setBusyPlanId(planId);
    try {
      await requestBillingAuth({
        customerKey: session.user.id,
        plan: PLAN_KEY[planId] ?? 'BASIC_MONTHLY',
        customerEmail: session.user.email,
        customerName: userName,
      });
      // 성공 시 토스 결제창이 /billing/success 로 리다이렉트하므로 이 페이지에서 더 할 일은 없음(창이 닫히지 않으면 실패 처리)
    } catch (e) {
      setError(getErrorMessage(e, '결제창을 여는 데 실패했습니다.'));
      setBusyPlanId(null);
    }
  };

  const handleCancel = async () => {
    setError('');
    setBusyPlanId(currentPlanId);
    try {
      await billingService.cancel();
      await refreshProfile();
      setSubscription(null);
    } catch (e) {
      setError(getErrorMessage(e, '구독 해지에 실패했습니다.'));
    } finally {
      setBusyPlanId(null);
    }
  };

  return (
    <HelmShell active="billing" virt={isVirt} userName={userName} session={isAdmin ? '운영자 · Pro 전 기능' : `${currentPlan.name} 플랜 이용 중`}>
      <div className="mx-auto flex max-w-[1560px] flex-col gap-[18px]">
        <div><h1 className="text-[28px] font-bold tracking-tight">결제 · 구독</h1><p className="mt-2 text-[14.5px]" style={{ color: INK1 }}>{userName} 항해사님의 플랜을 확인하세요.</p></div>

        {/* 오류 배너 — 결제창 호출/등록/해지 실패 시에만 노출 */}
        {error && (
          <div className="flex items-start gap-3 rounded-2xl px-[22px] py-4" style={{ background: 'rgba(245,208,97,.10)', border: '1px solid rgba(245,208,97,.34)' }}>
            <span className="mt-0.5 shrink-0 text-[19.5px]">⚠️</span>
            <div className="text-[14px] leading-relaxed" style={{ color: INK1 }}>{error}</div>
          </div>
        )}

        {/* 현재 플랜 */}
        <Panel style={{ padding: 0 }}>
          <PanelHead kicker="MY PLAN" title="현재 플랜" right={<span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12.5px] font-bold text-white" style={{ background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.3)' }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: '#7af5c8', boxShadow: '0 0 8px #7af5c8' }} />{isAdmin ? '운영자' : '이용 중'}</span>} />
          <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr]">
            <div className="px-[30px] py-[26px]" style={{ borderRight: `1px solid ${HAIR}` }}>
              <div className="flex flex-wrap items-baseline gap-2.5"><span className="text-[36.5px] font-bold tracking-tight">{currentPlan.name}</span><span className="font-mono text-[19.5px] font-semibold" style={{ color: INK1 }}>{isAdmin ? '운영자 · 전 기능' : currentPlan.monthly === 0 ? '무료' : `${won(currentPlan.monthly)}/월`}</span></div>
              <p className="mt-2 text-[14px]" style={{ color: INK2 }}>{isAdmin ? '운영자(ADMIN) 계정으로 모든 기능을 제한 없이 이용 중입니다.' : currentPlan.id === 'free' ? '아래 플랜에서 구독하면 더 많은 기능을 이용할 수 있어요.' : `${currentPlan.name} 플랜 기능을 이용 중입니다.`}</p>
              <ul className="mt-[22px] flex list-none flex-col gap-2.5 p-0">{currentPlan.features.map(f => <li key={f} className="flex items-center gap-2.5 text-[14px]" style={{ color: INK1 }}><Check />{f}</li>)}</ul>
            </div>
            <div className="flex flex-col justify-center px-[26px] py-6">
              <div className="mb-3.5 text-[11.5px] font-semibold tracking-[.2em]" style={{ color: INK2 }}>결제 수단</div>
              {subscription?.cardCompany ? (
                <div className="flex flex-col items-center justify-center gap-1.5 rounded-[14px] px-5 py-8 text-center" style={{ background: ABYSS0, border: `1px solid ${HAIR_S}` }}>
                  <span className="text-[24px]">💳</span>
                  <div className="text-[14px] font-semibold" style={{ color: INK1 }}>{subscription.cardCompany} {subscription.cardNumberMasked}</div>
                  {subscription.nextBillingDate && subscription.status === 'ACTIVE' && (
                    <div className="text-[12.5px]" style={{ color: INK3 }}>다음 결제일 {subscription.nextBillingDate}</div>
                  )}
                  {subscription.status === 'PAST_DUE' && <div className="text-[12.5px]" style={{ color: '#f5a25d' }}>결제 실패 · 재시도 예정</div>}
                  {subscription.status === 'CANCELED' && <div className="text-[12.5px]" style={{ color: INK3 }}>해지됨</div>}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 rounded-[14px] px-5 py-8 text-center" style={{ background: ABYSS0, border: `1px dashed ${HAIR_S}` }}>
                  <span className="text-[24px] opacity-60">💳</span>
                  <div className="text-[14px] font-semibold" style={{ color: INK1 }}>등록된 결제 수단 없음</div>
                  <div className="text-[12.5px]" style={{ color: INK3 }}>아래 플랜에서 구독하면 카드가 등록돼요</div>
                </div>
              )}
            </div>
          </div>
        </Panel>

        {/* 플랜 */}
        <Panel style={{ padding: 0 }}>
          <PanelHead kicker="PLANS" title="플랜 선택" />
          <div className="grid items-start gap-[18px] px-[26px] pb-[26px] pt-[30px]" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            {PLANS.map(p => (
              <PlanCard key={p.id} plan={p} currentPlanId={currentPlanId} isAdmin={isAdmin}
                busyPlanId={busyPlanId} onSubscribe={handleSubscribe} onCancel={handleCancel} />
            ))}
          </div>
        </Panel>

        <p className="mt-1 text-center text-[13px]" style={{ color: INK3 }}>실거래 연동은 VIRT 검증 후 활성화됩니다.</p>
        <footer className="mt-2 flex flex-wrap justify-between gap-3 pt-5" style={{ borderTop: `1px solid ${HAIR}` }}>
          <span className="font-mono text-[12.5px]" style={{ color: INK3 }}>© 2026 WHALEARC</span>
          <span className="text-[12.5px]" style={{ color: INK3 }}>Built quietly, beneath the surface.</span>
        </footer>
      </div>
    </HelmShell>
  );
};

export default ConsoleBillingPage;
