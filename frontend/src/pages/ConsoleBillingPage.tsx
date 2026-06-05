import type { ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
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
    <div><div className="text-[10.5px] font-bold tracking-[.22em] text-white/70">{kicker}</div><div className="text-[16px] font-bold">{title}</div></div>
    {right}
  </div>
);
const Check = () => <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="shrink-0"><circle cx="8" cy="8" r="8" fill={SONAR_DIM} /><path d="M5 8.2 L7 10.2 L11 5.8" stroke={SONAR} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const AddonGlyph = ({ kind }: { kind: string }) => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor">
    {kind === 'star' && <path d="M11 3L13.2 7.6L18.3 8.3L14.6 11.9L15.5 17L11 14.6L6.5 17L7.4 11.9L3.7 8.3L8.8 7.6Z" strokeWidth="1.5" strokeLinejoin="round" />}
    {kind === 'link' && <><path d="M8 11a3 3 0 0 0 4.2 0l2.3-2.3a3 3 0 0 0-4.2-4.2L9 5.8" strokeWidth="1.5" strokeLinecap="round" /><path d="M14 11a3 3 0 0 1-4.2 0L7.5 8.7a3 3 0 0 1 4.2-4.2" strokeWidth="1.5" strokeLinecap="round" opacity=".5" /></>}
    {kind === 'cart' && <><circle cx="8" cy="18" r="1.4" fill="currentColor" stroke="none" /><circle cx="16" cy="18" r="1.4" fill="currentColor" stroke="none" /><path d="M3 4h2l2 10h10l2-7H6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></>}
  </svg>
);

// 현재 플랜은 (결제 시스템 부재) 항상 Free. 아래 플랜·가격은 출시 예정 미리보기.
const CURRENT = 'free';
type Plan = { id: string; name: string; tagline: string; monthly: number; yearly: number; featured?: boolean; features: string[] };
const PLANS: Plan[] = [
  { id: 'free', name: 'Free', tagline: '무료로 시작하기', monthly: 0, yearly: 0, features: ['시세 조회 · VIRT 가상매매', '백테스트 단일 전략 · 1년', '랭킹 · 피드백 · 알림 3개'] },
  { id: 'basic', name: 'Basic', tagline: '본격적인 백테스트', monthly: 9900, yearly: 99000, features: ['Free의 모든 기능', '백테스트 5년 · 멀티 종목 5', '실거래 전략 1 · 종목 3', '알림 20개'] },
  { id: 'pro', name: 'Pro', tagline: '무제한 · 자동화', featured: true, monthly: 29900, yearly: 299000, features: ['Basic의 모든 기능', '백테스트 10년+ · 무제한', '실거래 무제한 · 리밸런싱 자동화', '퀀트스토어 · 알림 무제한'] },
];
const ADDONS = [
  { id: 'premium', name: '프리미엄 전략', price: '전략당 월 5,000원~', desc: '검증된 고급 전략을 구독으로 추가', icon: 'star' },
  { id: 'link', name: '실계좌 연동 (VIRT)', price: '월 4,900원', desc: '가상에서 실계좌로 전략을 그대로 이관', icon: 'link' },
  { id: 'cart', name: '항로 상품 구매', price: '상품별 개별 가격', desc: '전문가가 설계한 포트폴리오 항로', icon: 'cart' },
];

const PlanCard = ({ plan }: { plan: Plan }) => {
  const isCurrent = plan.id === CURRENT, featured = plan.featured;
  const ctaLabel = isCurrent ? '현재 이용 중' : '출시 예정';
  return (
    <article className="relative flex flex-col rounded-2xl px-6 py-7" style={{ background: featured ? 'linear-gradient(180deg, rgba(91,157,255,.14), rgba(91,157,255,.03) 60%, transparent)' : 'var(--ci-card)', border: isCurrent ? `1px solid ${SONAR}` : featured ? '1px solid rgba(91,157,255,.4)' : `1px solid ${HAIR}`, boxShadow: isCurrent ? `0 0 0 3px ${SONAR_DIM}` : undefined }}>
      <span className="absolute left-[22px] flex gap-1.5" style={{ top: -11 }}>
        {isCurrent && <span className="rounded-full px-2.5 py-1 text-[11px] font-bold text-white" style={{ background: SONAR, boxShadow: '0 6px 14px -6px rgba(60,120,255,.7)' }}>현재 플랜</span>}
        {featured && !isCurrent && <span className="rounded-full px-2.5 py-1 text-[11px] font-bold text-white" style={{ background: `linear-gradient(180deg, ${SONAR}, ${ACCENT})` }}>가장 인기</span>}
      </span>
      <div className="text-[17px] font-bold">{plan.name}</div>
      <div className="mt-0.5 text-[12px]" style={{ color: INK2 }}>{plan.tagline}</div>
      <div className="mb-1 mt-[18px] flex items-baseline gap-1.5">
        {plan.monthly === 0 ? <span className="font-mono text-[30px] font-bold">무료</span> : <><span className="font-mono text-[30px] font-bold tracking-tight">{won(plan.monthly)}</span><span className="text-[13px]" style={{ color: INK2 }}>/ 월</span></>}
      </div>
      <div className="text-[11.5px] font-semibold" style={{ height: 16, color: SONAR }}>{plan.yearly > 0 ? `연간 결제 시 월 ${won(Math.round(plan.yearly / 12))} 상당` : ''}</div>
      <button disabled className="mt-4 w-full rounded-[11px] px-4 py-3 text-[13.5px] font-semibold" style={isCurrent ? { border: `1px solid ${HAIR}`, background: 'transparent', color: INK2, cursor: 'default' } : { border: `1px solid ${HAIR}`, background: 'transparent', color: INK3, cursor: 'default' }}>{ctaLabel}</button>
      <ul className="mt-[22px] flex list-none flex-col gap-3 p-0">{plan.features.map(f => <li key={f} className="flex items-center gap-2.5 text-[13px]" style={{ color: INK1 }}><Check />{f}</li>)}</ul>
    </article>
  );
};

const ConsoleBillingPage = () => {
  const { session } = useAuth();
  const { isVirt } = useRoutePrefix();
  const userName = session?.user?.email ? session.user.email.split('@')[0] : '항해사';

  return (
    <HelmShell active="billing" virt={isVirt} userName={userName} session="무료 플랜 이용 중">
      <div className="mx-auto flex max-w-[1560px] flex-col gap-[18px]">
        <div><h1 className="text-[26px] font-bold tracking-tight">결제 · 구독</h1><p className="mt-2 text-[13.5px]" style={{ color: INK1 }}>{userName} 항해사님의 플랜을 확인하세요.</p></div>

        {/* 준비 중 안내 배너 */}
        <div className="flex items-start gap-3 rounded-2xl px-[22px] py-4" style={{ background: 'rgba(245,208,97,.10)', border: '1px solid rgba(245,208,97,.34)' }}>
          <span className="mt-0.5 shrink-0 text-[18px]">🛠️</span>
          <div>
            <div className="text-[14px] font-bold" style={{ color: COMPASS }}>결제 기능은 준비 중입니다</div>
            <div className="mt-1 text-[13px] leading-relaxed" style={{ color: INK1 }}>아래 플랜과 가격은 <b>출시 예정 미리보기</b>예요. 지금은 <b>모든 기능을 무료로</b> 이용하실 수 있고, 등록된 결제 수단이나 청구 내역은 없습니다.</div>
          </div>
        </div>

        {/* 현재 플랜 */}
        <Panel style={{ padding: 0 }}>
          <PanelHead kicker="MY PLAN" title="현재 플랜" right={<span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11.5px] font-bold text-white" style={{ background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.3)' }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: '#7af5c8', boxShadow: '0 0 8px #7af5c8' }} />이용 중</span>} />
          <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr]">
            <div className="px-[30px] py-[26px]" style={{ borderRight: `1px solid ${HAIR}` }}>
              <div className="flex flex-wrap items-baseline gap-2.5"><span className="text-[34px] font-bold tracking-tight">Free</span><span className="font-mono text-[18px] font-semibold" style={{ color: INK1 }}>무료</span></div>
              <p className="mt-2 text-[13px]" style={{ color: INK2 }}>현재 모든 기능을 무료로 제공하고 있어요. 유료 플랜은 출시되면 안내드릴게요.</p>
              <ul className="mt-[22px] flex list-none flex-col gap-2.5 p-0">{PLANS[0].features.map(f => <li key={f} className="flex items-center gap-2.5 text-[13px]" style={{ color: INK1 }}><Check />{f}</li>)}</ul>
            </div>
            <div className="flex flex-col justify-center px-[26px] py-6">
              <div className="mb-3.5 text-[10.5px] font-semibold tracking-[.2em]" style={{ color: INK2 }}>결제 수단</div>
              <div className="flex flex-col items-center justify-center gap-2 rounded-[14px] px-5 py-8 text-center" style={{ background: ABYSS0, border: `1px dashed ${HAIR_S}` }}>
                <span className="text-[22px] opacity-60">💳</span>
                <div className="text-[13px] font-semibold" style={{ color: INK1 }}>등록된 결제 수단 없음</div>
                <div className="text-[11.5px]" style={{ color: INK3 }}>결제 기능 출시 후 등록할 수 있어요</div>
              </div>
            </div>
          </div>
        </Panel>

        {/* 플랜 미리보기 */}
        <Panel style={{ padding: 0 }}>
          <PanelHead kicker="PLANS · 출시 예정" title="플랜 미리보기" right={<span className="rounded-full px-2.5 py-1 text-[11px] font-bold text-white" style={{ background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.28)' }}>준비 중</span>} />
          <div className="grid items-start gap-[18px] px-[26px] pb-[26px] pt-[30px]" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            {PLANS.map(p => <PlanCard key={p.id} plan={p} />)}
          </div>
        </Panel>

        {/* 추가 상품 (출시 예정) */}
        <Panel style={{ padding: 0 }}>
          <PanelHead kicker="ADD-ON · 출시 예정" title="추가 상품" />
          <div className="grid gap-3.5 px-[22px] py-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            {ADDONS.map(a => (
              <div key={a.id} className="flex items-start gap-3.5 rounded-[14px] p-[18px]" style={{ background: ABYSS0, border: `1px solid ${HAIR}` }}>
                <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[11px]" style={{ background: SONAR_DIM, color: SONAR, border: '1px solid rgba(91,157,255,.22)' }}><AddonGlyph kind={a.icon} /></span>
                <div className="min-w-0 flex-1"><div className="text-[14.5px] font-bold">{a.name}</div><div className="my-1 text-[12.5px] leading-snug" style={{ color: INK2 }}>{a.desc}</div><div className="font-mono text-[12.5px] font-semibold" style={{ color: SONAR }}>{a.price}</div></div>
                <button disabled className="shrink-0 rounded-[9px] px-3.5 py-2 text-[12.5px] font-semibold" style={{ border: `1px solid ${HAIR}`, background: 'transparent', color: INK3, cursor: 'default' }}>출시 예정</button>
              </div>
            ))}
          </div>
        </Panel>

        <p className="mt-1 text-center text-[12px]" style={{ color: INK3 }}>유료 플랜·결제는 준비 중입니다 · 실거래 연동은 VIRT 검증 후 활성화됩니다.</p>
        <footer className="mt-2 flex flex-wrap justify-between gap-3 pt-5" style={{ borderTop: `1px solid ${HAIR}` }}>
          <span className="font-mono text-[11.5px]" style={{ color: INK3 }}>© 2026 WHALEARC</span>
          <span className="text-[11.5px]" style={{ color: INK3 }}>Built quietly, beneath the surface.</span>
        </footer>
      </div>
    </HelmShell>
  );
};

export default ConsoleBillingPage;
