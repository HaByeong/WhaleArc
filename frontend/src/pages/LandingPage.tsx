import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { marketService } from '../services/marketService';

// 티커 KRW 가격 컴팩트 포맷(억/만/원) — 빗썸 실시세는 원화라 자릿수가 커서 축약
const fmtTickerKrw = (n: number): string => {
  if (n >= 1e8) return (n / 1e8).toFixed(2) + '억';
  if (n >= 1e4) return Math.round(n / 1e4).toLocaleString('ko-KR') + '만';
  return '₩' + Math.round(n).toLocaleString('ko-KR');
};

/* ────────────────────────────────────────────────────────────
   WhaleArc 랜딩 — 「디자인 개편」 mockup 기반 (2026-06)
   토큰: bg #060b1f / panel #0a1230 / accent #2c6fe6 / glow #5b9dff
        상승 #ef4d4d(빨강) · 하락 #4d8aff(파랑) · ink white/70·50·30
   ※ 라이트모드에서도 다크 유지 위해 색/배경은 인라인 스타일 + wa-force-dark
   ※ 문구 1차 다듬음(2026-06): 과한 메타포(갑판·바다·유영) 정리 · "AI 기반" 과장 제거 · 8개 전략/₩1,000만 수치 검증
   ──────────────────────────────────────────────────────────── */

const GLOW = '#5b9dff';
const UP = '#ef4d4d';   // 상승 = 빨강 (한국식)
const DOWN = '#4d8aff'; // 하락 = 파랑 (한국식)

const cardStyle: React.CSSProperties = {
  background: 'linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.015))',
  border: '1px solid rgba(255,255,255,.10)',
};
const panelStyle: React.CSSProperties = {
  background: 'linear-gradient(180deg,#0d1736,#080e25)',
  border: '1px solid rgba(255,255,255,.18)',
  boxShadow: '0 60px 120px -40px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.04)',
};

const Eyebrow = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
    style={{ border: '1px solid rgba(120,170,255,.32)', background: 'rgba(80,130,220,.08)', color: '#9cc1ff', letterSpacing: '.04em' }}>
    <span className="h-1.5 w-1.5 rounded-full animate-pulse-dot" style={{ background: GLOW, boxShadow: `0 0 8px ${GLOW}` }} />
    {children}
  </span>
);

const SectionHeader = ({ kicker, title, lede, center }: { kicker: string; title: string; lede?: string; center?: boolean }) => (
  <div className={center ? 'mx-auto text-center' : ''} style={{ maxWidth: center ? 760 : undefined }}>
    <p className="mb-3 text-xs font-semibold uppercase" style={{ color: '#9cc1ff', letterSpacing: '.16em' }}>{kicker}</p>
    <h2 className="font-bold" style={{ fontSize: 'clamp(28px,4vw,40px)', lineHeight: 1.1, letterSpacing: '-.02em' }}>{title}</h2>
    {lede && <p className="mt-4 text-white/60" style={{ fontSize: 16, lineHeight: 1.6 }}>{lede}</p>}
  </div>
);

const PrimaryBtn = ({ children, onClick, lg }: { children: ReactNode; onClick?: () => void; lg?: boolean }) => (
  <button onClick={onClick} className="inline-flex items-center justify-center gap-2 rounded-xl font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5"
    style={{
      padding: lg ? '16px 28px' : '14px 22px', fontSize: lg ? 16 : 15,
      background: 'linear-gradient(180deg,#4d8aff,#2c6fe6 62%,#2257c8)',
      border: '1px solid rgba(140,190,255,.5)',
      boxShadow: '0 14px 30px -12px rgba(44,111,230,.7), inset 0 1px 0 rgba(255,255,255,.4), inset 0 -2px 6px rgba(8,20,50,.3)',
    }}>
    {children}
  </button>
);

const GhostBtn = ({ children, onClick, lg }: { children: ReactNode; onClick?: () => void; lg?: boolean }) => (
  <button onClick={onClick} className="inline-flex items-center justify-center gap-2 rounded-xl font-semibold text-white/90 transition-colors duration-200 hover:bg-white/[0.07]"
    style={{ padding: lg ? '15px 22px' : '13px 20px', fontSize: lg ? 16 : 15, border: '1px solid rgba(255,255,255,.18)', background: 'rgba(255,255,255,.03)' }}>
    {children}
  </button>
);

const VirtBadge = () => (
  <span className="rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide"
    style={{ background: 'rgba(180,210,255,.18)', color: '#cfe1ff', border: '1px solid rgba(91,157,255,.24)' }}>VIRT</span>
);

/* ── 섹션 데이터 ── */
const FEATURES = [
  { n: '01', title: '실시간 시세 스트림', body: 'KIS 모의투자 API로 국내 주식·코인 시세를 추적합니다. 대시보드에서 보유 종목과 함께.', meta: 'KOSPI · KOSDAQ · 빗썸', route: '/market',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l5-6 4 4 6-8" /> },
  { n: '02', title: '고래 튜터와 전략 학습', body: '골든크로스·RSI·볼린저 등 8가지 검증된 전략을 챗으로 쉽게 알려드려요. 용어 설명과 예시까지.', meta: '8개 기본 전략 · 초급~고급', route: '/store',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3 12c3-4 6-4 9 0s6 4 9 0M3 17c3-4 6-4 9 0s6 4 9 0" /> },
  { n: '03', title: 'VIRT 가상 항해', body: '실제 시세로 움직이는 모의 계좌. 전략을 실험하고, 실수해도 자산은 안전하게 지킵니다.', meta: '가상돈 ₩1,000만 · 무제한 리셋', route: '/virt/dashboard',
    icon: <><rect x="3" y="4" width="18" height="16" rx="2" /><path strokeLinecap="round" d="M3 9h18M7 14l2 2 3-4" /></> },
  { n: '04', title: '전략 라이브러리', body: '검증된 전략을 선택해 투자금·종목·기간을 설정하면, 수익률 · MDD · 승률 · 샤프 비율까지 한 화면에서.', meta: '8개 전략 · 백테스트 내장', route: '/strategy',
    icon: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" fill="currentColor" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></> },
];

const TICKER = [
  { s: 'BTC', p: '94,210.4', c: '+1.24%', up: true }, { s: 'ETH', p: '3,482.10', c: '+0.81%', up: true },
  { s: 'SOL', p: '182.40', c: '-0.42%', up: false }, { s: 'ARB', p: '1.18', c: '+2.07%', up: true },
  { s: 'LINK', p: '18.62', c: '+0.34%', up: true }, { s: 'DOGE', p: '0.182', c: '-1.12%', up: false },
  { s: 'AVAX', p: '42.30', c: '+0.96%', up: true }, { s: 'MATIC', p: '0.78', c: '-0.21%', up: false },
  { s: 'DOT', p: '7.18', c: '+1.45%', up: true }, { s: 'ATOM', p: '9.32', c: '+0.18%', up: true },
  { s: 'NEAR', p: '5.84', c: '-0.62%', up: false }, { s: 'XRP', p: '0.62', c: '+0.84%', up: true },
];

type PriceItem = [string, boolean];
const PRICING: { name: string; tagline: string; price: string; period?: string; cta: string; featured: boolean; groups: { h: string; items: PriceItem[] }[] }[] = [
  { name: 'Free', tagline: '무료로 시작하기', price: '무료', cta: '무료로 시작', featured: false, groups: [
    { h: '기본', items: [['시세 조회', true], ['가상매매 (VIRT)', true], ['랭킹', true], ['피드백', true], ['알림 3개', true]] },
    { h: '백테스팅', items: [['단일 전략 · 단일 종목', true], ['최근 1년 데이터', true], ['멀티 종목 / 전략', false]] },
    { h: '실거래', items: [['실거래', false], ['퀀트스토어', false]] },
  ] },
  { name: 'Basic', tagline: '본격적인 백테스트', price: '₩9,900', period: '/월', cta: 'Basic 시작하기', featured: false, groups: [
    { h: '기본', items: [['Free의 모든 기능', true], ['알림 20개', true]] },
    { h: '백테스팅', items: [['최근 5년 데이터', true], ['멀티 종목 (5개)', true], ['멀티 전략 (3개)', true], ['기본 리포트', true]] },
    { h: '실거래 (기본)', items: [['전략 1개 · 종목 3개', true], ['리밸런싱 자동화', false]] },
  ] },
  { name: 'Pro', tagline: '무제한 · 자동화', price: '₩29,900', period: '/월', cta: 'Pro 시작하기', featured: true, groups: [
    { h: '기본', items: [['Basic의 모든 기능', true], ['알림 무제한', true]] },
    { h: '백테스팅', items: [['최근 10년+ 데이터', true], ['멀티 종목 무제한', true], ['멀티 전략 무제한', true], ['상세 리포트 · 파라미터 최적화', true]] },
    { h: '실거래 (고급)', items: [['전략 · 종목 무제한', true], ['리밸런싱 자동화 · 우선 체결', true], ['퀀트스토어 열람', true]] },
  ] },
];

const ADDONS = [
  { name: '프리미엄 전략', price: '전략당 월 5,000원~', desc: '검증된 고급 전략을 구독으로 추가' },
  { name: '실계좌 연동 (VIRT)', price: '월 4,900원', desc: '가상에서 실계좌로 전략을 그대로 이관' },
  { name: '항로 상품 구매', price: '상품별 개별 가격', desc: '전문가가 설계한 포트폴리오 항로' },
];

const HOLDINGS = [
  { sym: 'BTC', name: '비트코인', price: '900,368', chg: '-9.87%', w: '9.3%' },
  { sym: 'ETH', name: '이더리움', price: '869,407', chg: '-12.97%', w: '9.0%' },
  { sym: 'SOL', name: '솔라나', price: '874,769', chg: '-12.44%', w: '9.1%' },
];

const Check = ({ ok }: { ok: boolean }) => ok
  ? <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="none" style={{ color: GLOW }}><path d="M5 10.5l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
  : <svg className="h-4 w-4 shrink-0 text-white/25" viewBox="0 0 20 20" fill="none"><path d="M5 10h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;

const LandingPage = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  // 티커: 코인 시세(빗썸). 공개 랜딩이라 자원 절약 위해 '하루 1회'만 갱신(브라우저 일일 캐시) —
  // 같은 날 재방문은 재요청 안 함. 미상장 심볼은 정적값 폴백. 갱신 기준 시각을 함께 표시.
  const [ticker, setTicker] = useState(TICKER);
  const [tickerTime, setTickerTime] = useState('');
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    try {
      const raw = localStorage.getItem('whalearc_landing_ticker_v2');
      if (raw) {
        const cached = JSON.parse(raw);
        if (cached?.date === today && Array.isArray(cached.rows)) {
          setTicker(cached.rows); setTickerTime(cached.time || ''); return;
        }
      }
    } catch { /* ignore */ }
    marketService.getPrices('CRYPTO').then((coins) => {
      if (!Array.isArray(coins) || coins.length === 0) return;
      const bySym = new Map(coins.map((c) => [c.symbol, c]));
      const rows = TICKER.map((t) => {
        const c = bySym.get(t.s);
        if (!c || !c.price) return t;
        return { s: t.s, p: fmtTickerKrw(c.price), c: `${c.changeRate >= 0 ? '+' : ''}${c.changeRate.toFixed(2)}%`, up: c.changeRate >= 0 };
      });
      const d = new Date();
      const p2 = (n: number) => String(n).padStart(2, '0');
      const time = `${p2(d.getMonth() + 1)}.${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
      setTicker(rows); setTickerTime(time);
      try { localStorage.setItem('whalearc_landing_ticker_v2', JSON.stringify({ date: today, rows, time })); } catch { /* ignore */ }
    }).catch(() => { /* 실패 시 정적값 유지 */ });
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // 비로그인 시 로그인으로 유도, 로그인 상태면 해당 경로로
  const go = (path: string) => {
    if (!session) {
      navigate('/login', { state: { from: path, message: '항해를 시작하려면 먼저 로그인해주세요.' } });
      return;
    }
    navigate(path);
  };

  const navItems: [string, () => void][] = [
    ['전략 라이브러리', () => go('/strategy')],
    ['실시간 시세', () => go('/market')],
    ['요금제', () => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })],
    ['커뮤니티', () => go('/ranking')],
  ];

  return (
    <div className="wa-force-dark min-h-screen text-white" style={{ background: '#060b1f', fontFamily: "'Pretendard','Noto Sans KR',system-ui,sans-serif" }}>
      {/* ════ NAV ════ */}
      <header className="fixed inset-x-0 top-0 z-50 transition-all duration-300"
        style={{
          background: scrolled ? 'rgba(6,11,31,.72)' : 'transparent',
          backdropFilter: scrolled ? 'blur(14px)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(255,255,255,.10)' : '1px solid transparent',
        }}>
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-4 md:px-14 md:py-5">
          <button onClick={() => navigate('/')} className="flex items-center gap-2.5">
            <img src="/brand-whale.png" alt="" className="h-9 w-9 object-contain" />
            <span className="whalearc-text text-lg">WHALEARC</span>
          </button>
          <nav className="hidden items-center gap-7 md:flex">
            {navItems.map(([label, fn]) => (
              <button key={label} onClick={fn} className="text-sm text-white/70 transition-colors hover:text-white">{label}</button>
            ))}
          </nav>
          <button onClick={() => (session ? navigate('/dashboard') : navigate('/login'))}
            className="rounded-full px-4 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/[0.06]"
            style={{ border: '1px solid rgba(255,255,255,.18)', background: 'rgba(255,255,255,.03)', backdropFilter: 'blur(8px)' }}>
            {session ? '항해 이어가기 →' : '시작하기 →'}
          </button>
        </div>
      </header>

      {/* ════ HERO ════ */}
      <section className="relative overflow-hidden" style={{
        background: 'radial-gradient(120% 80% at 80% 20%, #1d3a7a 0%, #0a1230 45%, #060b1f 100%)',
      }}>
        <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(60% 60% at 20% 90%, rgba(80,140,255,.18), transparent 70%)' }} />
        <div className="relative mx-auto grid max-w-[1280px] items-center gap-10 px-6 pb-24 pt-28 md:grid-cols-[1.05fr_.95fr] md:px-14 md:pt-36">
          {/* 왼쪽 텍스트 */}
          <div>
            <Eyebrow>실전 데이터로, 잃을 걱정 없이</Eyebrow>
            <h1 className="mt-6 font-extrabold" style={{ fontSize: 'clamp(40px,7vw,72px)', lineHeight: 1.06, letterSpacing: '-.025em' }}>
              고래처럼,<br />
              <span style={{ fontWeight: 700, color: 'rgba(255,255,255,.55)' }}>시장을 유영하듯</span>
            </h1>
            <p className="mt-6 text-white/70" style={{ fontSize: 18, lineHeight: 1.6, maxWidth: 480 }}>
              실시간 시세와 포트폴리오 분석으로<br />
              나만의 투자 전략을 잃을 걱정 없이 검증해보세요.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3.5">
              <PrimaryBtn onClick={() => go('/dashboard')}>대시보드로 이동 →</PrimaryBtn>
              <GhostBtn onClick={() => go('/virt/dashboard')}>처음이라면 모의투자부터 <VirtBadge /></GhostBtn>
            </div>
            <div className="mt-12 flex flex-wrap gap-6 text-white/50" style={{ fontSize: 12.5, letterSpacing: '.02em' }}>
              <span>· 실시간 시세 분석</span>
              <span>· VIRT 모의투자</span>
              <span>· 퀀트 전략 백테스트</span>
            </div>
          </div>
          {/* 오른쪽 고래 */}
          <div className="relative flex items-center justify-center" style={{ minHeight: 360 }}>
            <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(45% 45% at 50% 45%, rgba(91,157,255,.22), transparent 70%)' }} />
            <img src="/whale-hero-logo.png" alt="WhaleArc" className="relative whale-hero-swim"
              style={{ width: 'min(440px,90%)', height: 'auto', filter: 'drop-shadow(0 0 40px rgba(91,157,255,.35))' }} />
          </div>
        </div>
      </section>

      {/* ════ FEATURES ════ */}
      <section className="px-6 py-24 md:px-14 md:py-28" style={{ background: '#060b1f' }}>
        <div className="mx-auto max-w-[1240px]">
          <SectionHeader kicker="핵심 기능" title="시장을 읽는 네 가지 도구."
            lede="시세 · 전략 학습 · 백테스트 · 모의투자를 한곳에 모았어요." />
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <button key={f.n} onClick={() => go(f.route)} className="group relative overflow-hidden rounded-[18px] p-7 text-left transition-transform duration-300 hover:-translate-y-1"
                style={cardStyle}>
                <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full"
                  style={{ background: 'radial-gradient(circle, rgba(91,157,255,.12), transparent 70%)' }} />
                <div className="relative flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: 'rgba(91,157,255,.10)', border: '1px solid rgba(91,157,255,.22)' }}>
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke={GLOW} strokeWidth={1.8}>{f.icon}</svg>
                </div>
                <h3 className="relative mt-5 text-[17px] font-bold">{f.title}</h3>
                <p className="relative mt-2 text-[13.5px] leading-relaxed text-white/55">{f.body}</p>
                <p className="relative mt-4 text-[11.5px] font-medium" style={{ color: '#9cc1ff', letterSpacing: '.04em' }}>{f.meta}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ════ DASHBOARD PREVIEW ════ */}
      <section className="px-6 pb-28 pt-4 md:px-14" style={{ background: '#060b1f' }}>
        <div className="mx-auto max-w-[1240px]">
          <SectionHeader kicker="PRODUCT TOUR" title="한 화면에서, 흐름을 놓치지 않게."
            lede="시세, 보유 자산, 전략, 시그널을 한곳에. 작업 흐름을 끊지 않는 정보 밀도로." />
          <div className="mt-12 overflow-hidden rounded-[18px]" style={panelStyle}>
            {/* 타이틀바 */}
            <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,.10)' }}>
              <span className="h-3 w-3 rounded-full" style={{ background: '#ff5f57' }} />
              <span className="h-3 w-3 rounded-full" style={{ background: '#febc2e' }} />
              <span className="h-3 w-3 rounded-full" style={{ background: '#28c840' }} />
              <span className="ml-3 font-mono text-[11px] text-white/40">app.whalearc.io / dashboard</span>
            </div>
            {/* 본문 */}
            <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] lg:grid-cols-[180px_1fr_260px]">
              {/* 사이드바 */}
              <div className="hidden flex-col gap-1 p-3 md:flex" style={{ borderRight: '1px solid rgba(255,255,255,.08)' }}>
                {[['내 투자', true], ['포트폴리오'], ['시세'], ['거래'], ['전략'], ['전략 학습'], ['투자 현황'], ['VIRT 대시보드']].map(([label, active], i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg px-3 py-2 text-[13px]"
                    style={active ? { background: 'rgba(91,157,255,.12)', color: '#fff', border: '1px solid rgba(91,157,255,.25)' } : { color: 'rgba(255,255,255,.55)' }}>
                    {label}{label === 'VIRT 대시보드' && <VirtBadge />}
                  </div>
                ))}
              </div>
              {/* 메인 */}
              <div className="p-5 md:p-6">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-white/55">내 포트폴리오</span>
                  <span className="font-mono text-[11px] text-white/35">데모 미리보기</span>
                </div>
                <div className="mt-2 flex items-end gap-3">
                  <span className="font-mono font-bold" style={{ fontSize: 34 }}>₩ 9,644,546</span>
                  <VirtBadge />
                </div>
                <div className="mt-1 font-mono text-[14px]" style={{ color: DOWN }}>-3.55% (-₩ 356,852)</div>
                {/* 차트 */}
                <div className="mt-5 rounded-xl p-4" style={cardStyle}>
                  <div className="mb-3 flex items-center gap-1.5">
                    {['1D', '1W', '1M', '3M', '1Y', 'ALL'].map((t) => (
                      <span key={t} className="rounded px-2 py-1 text-[11px]"
                        style={t === '1M' ? { background: 'rgba(91,157,255,.15)', color: '#fff' } : { color: 'rgba(255,255,255,.4)' }}>{t}</span>
                    ))}
                    <span className="ml-auto font-mono text-[11px] text-white/35">KRW · Spot</span>
                  </div>
                  <svg viewBox="0 0 600 120" className="h-24 w-full" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="dpfill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={GLOW} stopOpacity="0.25" />
                        <stop offset="100%" stopColor={GLOW} stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d="M0,80 C80,40 140,95 220,70 C300,45 360,90 440,55 C520,25 560,60 600,45 L600,120 L0,120 Z" fill="url(#dpfill)" />
                    <path d="M0,80 C80,40 140,95 220,70 C300,45 360,90 440,55 C520,25 560,60 600,45" fill="none" stroke={GLOW} strokeWidth="2" />
                  </svg>
                </div>
                {/* 보유 종목 */}
                <div className="mt-4">
                  <div className="grid grid-cols-[1fr_70px_60px] gap-2 px-1 pb-2 text-[10.5px] uppercase text-white/30" style={{ letterSpacing: '.08em', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                    <span>자산</span><span className="text-right">24h</span><span className="text-right">비중</span>
                  </div>
                  {HOLDINGS.map((h) => (
                    <div key={h.sym} className="grid grid-cols-[1fr_70px_60px] items-center gap-2 px-1 py-2.5 text-[13px]" style={{ borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                      <span className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full font-mono text-[10px]" style={{ background: 'rgba(255,255,255,.06)' }}>{h.sym}</span>
                        <span className="text-white/80">{h.name}</span>
                        <span className="font-mono text-[11px] text-white/35">{h.price}</span>
                      </span>
                      <span className="text-right font-mono" style={{ color: DOWN }}>{h.chg}</span>
                      <span className="text-right font-mono text-white/60">{h.w}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* 레일 */}
              <div className="hidden flex-col gap-4 p-5 lg:flex" style={{ borderLeft: '1px solid rgba(255,255,255,.08)' }}>
                <div>
                  <p className="mb-2 text-[11px] uppercase text-white/35" style={{ letterSpacing: '.1em' }}>항해 중인 항로</p>
                  <div className="rounded-xl p-4" style={cardStyle}>
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-semibold">골든크로스 추종 전략</span>
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ color: UP, background: 'rgba(239,77,77,.14)' }}>운항중</span>
                    </div>
                    <p className="mt-2 font-mono text-[11px] text-white/45">투자 ₩2,997,002 · BTC·ETH·SOL</p>
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[11px] uppercase text-white/35" style={{ letterSpacing: '.1em' }}>빠른 액션</p>
                  <div className="flex flex-col gap-2">
                    {['거래하기', '전략 백테스트', 'VIRT로 먼저 연습'].map((a) => (
                      <div key={a} className="rounded-lg px-3 py-2.5 text-[12.5px] text-white/70" style={cardStyle}>{a}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════ VIRT ════ */}
      <section className="px-6 py-28 md:px-14" style={{ background: 'linear-gradient(180deg,#060b1f,#0a1230 60%,#060b1f)' }}>
        <div className="mx-auto grid max-w-[1240px] items-center gap-14 lg:grid-cols-2">
          <div>
            <p className="text-[11.5px] font-semibold uppercase" style={{ color: '#9cc1ff', letterSpacing: '.24em' }}>VIRT · 가상 항해</p>
            <h2 className="mt-4 font-bold" style={{ fontSize: 'clamp(30px,5vw,52px)', lineHeight: 1.08, letterSpacing: '-.025em' }}>
              실수해도 좋아요.<br />
              <span style={{ color: 'rgba(255,255,255,.55)' }}>자산은 안전한 채로.</span>
            </h2>
            <p className="mt-5 text-white/70" style={{ fontSize: 17, lineHeight: 1.65, maxWidth: 440 }}>
              실제 시세로 움직이는 모의 계좌에서 전략을 먼저 실험해보세요.
              몇 번이고 다시 시작할 수 있고, 결과는 그대로 백테스트로 남습니다.
            </p>
            <ol className="mt-10 flex flex-col gap-5">
              {[['01', 'VIRT 계좌 개설', '버튼 한 번으로 ₩10,000,000 가상 자금이 지급됩니다.'],
                ['02', '전략 실행', '실시간 시세로 거래하고, 손익은 즉시 갱신됩니다.'],
                ['03', '복기와 이관', '결과가 만족스러우면 같은 전략을 실계좌로 한 번에 이관.']].map(([n, t, d]) => (
                <li key={n} className="flex gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-mono text-[13px]" style={{ background: 'rgba(91,157,255,.10)', color: GLOW, border: '1px solid rgba(91,157,255,.22)' }}>{n}</span>
                  <div>
                    <p className="text-[15px] font-semibold">{t}</p>
                    <p className="mt-1 text-[13.5px] text-white/55">{d}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-10 flex flex-wrap items-center gap-5">
              <PrimaryBtn onClick={() => go('/virt/dashboard')}>VIRT 모드로 시작 →</PrimaryBtn>
              <button onClick={() => go('/virt/dashboard')} className="text-[14px] font-medium" style={{ color: GLOW }}>가이드 보기 ↗</button>
            </div>
          </div>
          {/* VIRT 목업 */}
          <div className="relative">
            <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(50% 50% at 50% 50%, rgba(91,157,255,.22), transparent 70%)' }} />
            <div className="relative rounded-[20px] p-5" style={panelStyle}>
              <div className="flex items-center justify-between text-[12px]">
                <span className="flex items-center gap-2"><VirtBadge /><span className="font-mono text-white/50">가상 계좌 #VIRT-0042</span></span>
                <span className="font-mono text-white/70">잔고 ₩ 10,482,310</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3.5">
                <div className="rounded-xl p-4" style={{ background: 'rgba(239,77,77,.08)', border: '1px solid rgba(239,77,77,.24)' }}>
                  <p className="text-[11px] font-semibold" style={{ color: UP }}>BUY · 매수</p>
                  <p className="mt-2 font-mono text-[22px]">0.024 BTC</p>
                  <p className="mt-1 font-mono text-[12px] text-white/45">@ ₩ 94,210,000</p>
                </div>
                <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.10)' }}>
                  <p className="font-mono text-[11px] text-white/55">LIMIT</p>
                  <p className="mt-2 font-mono text-[22px]">₩ 93,000,000</p>
                  <p className="mt-1 font-mono text-[12px] text-white/45">대기 시간 4h 22m</p>
                </div>
              </div>
              <div className="mt-4 rounded-xl p-4" style={cardStyle}>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-white/55">VIRT 누적 수익률</span>
                  <span className="font-mono text-[18px]" style={{ color: UP }}>+4.82%</span>
                </div>
                <svg viewBox="0 0 400 80" className="mt-2 h-20 w-full" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="vfill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={UP} stopOpacity="0.22" /><stop offset="100%" stopColor={UP} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M0,65 C60,60 100,50 160,45 C220,40 260,25 320,20 C360,16 380,12 400,8 L400,80 L0,80 Z" fill="url(#vfill)" />
                  <path d="M0,65 C60,60 100,50 160,45 C220,40 260,25 320,20 C360,16 380,12 400,8" fill="none" stroke={UP} strokeWidth="2" />
                </svg>
              </div>
              <div className="mt-4 flex items-center justify-between text-[12px]">
                <span className="flex items-center gap-2 text-white/55">
                  <span className="h-2 w-2 rounded-full animate-pulse-dot" style={{ background: UP, boxShadow: `0 0 6px ${UP}` }} />
                  시뮬레이션 진행 중 · 14일째
                </span>
                <span className="font-medium" style={{ color: GLOW }}>실계좌로 이관 →</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════ LIVE TICKER ════ */}
      <section className="py-24" style={{ background: '#060b1f' }}>
        <div className="mx-auto max-w-[1240px] px-6 md:px-14">
          <SectionHeader center kicker="MARKETS" title="지금, 시장은 어떻게 움직이고 있을까요."
            lede="주요 코인 시세를 미리 둘러보세요. 로그인하면 실시간 시세·포트폴리오까지 한 곳에서." />
        </div>
        <div className="relative mt-12 overflow-hidden" style={{ borderTop: '1px solid rgba(255,255,255,.10)', borderBottom: '1px solid rgba(255,255,255,.10)', background: 'linear-gradient(180deg,rgba(91,157,255,.04),transparent)' }}>
          <div className="flex w-max animate-ticker-scroll">
            {[...ticker, ...ticker].map((t, i) => (
              <div key={i} className="flex items-center gap-3 px-7 py-5" style={{ minWidth: 220, borderRight: '1px solid rgba(255,255,255,.06)' }}>
                <span className="font-mono text-[13px] font-semibold text-white/80">{t.s}</span>
                <span className="font-mono text-[13px] text-white/55">{t.p}</span>
                <span className="ml-auto font-mono text-[12px]" style={{ color: t.up ? UP : DOWN }}>{t.c}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="mx-auto mt-6 flex max-w-[1240px] items-center justify-between px-6 md:px-14">
          <span className="flex items-center gap-2 text-[12.5px] text-white/50">
            모의투자 · 백테스트 · 전략 학습
            {tickerTime && <span className="text-white/30">· {tickerTime} 기준 (빗썸 · 하루 1회 갱신)</span>}
          </span>
          <button onClick={() => go('/market')} className="text-[13px] font-medium" style={{ color: GLOW }}>전체 마켓 보기 →</button>
        </div>
      </section>

      {/* ════ PRICING ════ */}
      <section id="pricing" className="px-6 py-28 md:px-14" style={{ background: '#060b1f' }}>
        <div className="mx-auto max-w-[1080px]">
          <SectionHeader center kicker="요금제" title="투자 방식에 맞는 요금제."
            lede="모든 플랜에서 시세 조회와 VIRT 가상매매는 무료입니다. 백테스트 범위와 실거래 자동화 수준에 따라 선택하세요." />
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {PRICING.map((tier) => (
              <div key={tier.name} className="relative flex flex-col rounded-[18px] p-7"
                style={tier.featured
                  ? { background: 'linear-gradient(180deg,rgba(91,157,255,.10),rgba(91,157,255,.02))', border: '1px solid rgba(91,157,255,.45)', boxShadow: '0 30px 60px -30px rgba(44,111,230,.5)' }
                  : cardStyle}>
                {tier.featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[11px] font-bold text-white"
                    style={{ background: 'linear-gradient(90deg,#4d8aff,#2c6fe6)' }}>가장 인기</span>
                )}
                <p className="text-[13px] text-white/55">{tier.tagline}</p>
                <p className="mt-1 text-[20px] font-bold">{tier.name}</p>
                <div className="mt-3 flex items-end gap-1">
                  <span className="font-mono text-[30px] font-bold">{tier.price}</span>
                  {tier.period && <span className="mb-1 text-[13px] text-white/45">{tier.period}</span>}
                </div>
                <div className="mt-5">
                  {tier.featured
                    ? <PrimaryBtn onClick={() => navigate('/login')}>{tier.cta}</PrimaryBtn>
                    : <GhostBtn onClick={() => navigate('/login')}>{tier.cta}</GhostBtn>}
                </div>
                <div className="mt-6 flex flex-col gap-5">
                  {tier.groups.map((g) => (
                    <div key={g.h}>
                      <p className="mb-2 text-[11px] uppercase text-white/35" style={{ letterSpacing: '.1em' }}>{g.h}</p>
                      <ul className="flex flex-col gap-2">
                        {g.items.map(([label, ok]) => (
                          <li key={label} className="flex items-center gap-2 text-[13px]" style={{ color: ok ? 'rgba(255,255,255,.8)' : 'rgba(255,255,255,.35)' }}>
                            <Check ok={ok} />{label}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Add-ons */}
          <div className="mt-16">
            <p className="text-[11px] font-semibold uppercase" style={{ color: '#9cc1ff', letterSpacing: '.16em' }}>ADD-ON · 개별 과금</p>
            <p className="mt-2 text-[14px] text-white/55">필요한 만큼만 추가하세요. 플랜과 별개로 개별 구매할 수 있어요.</p>
            <div className="mt-6 grid gap-5 md:grid-cols-3">
              {ADDONS.map((a) => (
                <div key={a.name} className="rounded-[16px] p-6" style={cardStyle}>
                  <p className="text-[15px] font-semibold">{a.name}</p>
                  <p className="mt-1 font-mono text-[13px]" style={{ color: GLOW }}>{a.price}</p>
                  <p className="mt-3 text-[13px] text-white/55">{a.desc}</p>
                </div>
              ))}
            </div>
            <p className="mt-8 text-[12px] text-white/35">모든 가격은 부가세 포함 · 언제든 해지 가능 · 실거래 연동은 VIRT 검증 후 활성화됩니다.</p>
          </div>
        </div>
      </section>

      {/* ════ CTA ════ */}
      <section className="px-6 py-28 text-center md:px-14" style={{ background: 'radial-gradient(100% 100% at 50% 0%, #1d3a7a, #0a1230 45%, #060b1f 100%)' }}>
        <img src="/brand-whale.png" alt="" className="mx-auto h-[120px] w-[120px] object-contain" style={{ filter: 'drop-shadow(0 0 24px rgba(91,157,255,.45))' }} />
        <h2 className="mx-auto mt-6 font-bold" style={{ fontSize: 'clamp(34px,6vw,60px)', lineHeight: 1.06, letterSpacing: '-.03em', maxWidth: 880 }}>
          이제, 당신의 항해를<br />
          <span style={{ color: 'rgba(255,255,255,.55)' }}>시작할 시간입니다.</span>
        </h2>
        <p className="mx-auto mt-5 text-white/70" style={{ fontSize: 17, lineHeight: 1.65, maxWidth: 520 }}>
          가입은 30초. 첫 항해는 VIRT 모드로 부담 없이.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3.5">
          <PrimaryBtn lg onClick={() => go('/dashboard')}>항해 시작하기 →</PrimaryBtn>
          <GhostBtn lg onClick={() => go('/virt/dashboard')}>먼저 VIRT로 둘러보기 <VirtBadge /></GhostBtn>
        </div>
      </section>

      {/* ════ FOOTER ════ */}
      <footer className="px-6 pb-10 pt-20 md:px-14" style={{ background: '#060b1f', borderTop: '1px solid rgba(255,255,255,.10)' }}>
        <div className="mx-auto max-w-[1240px]">
          <div className="grid gap-12 md:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
            <div>
              <div className="flex items-center gap-2.5">
                <img src="/brand-whale.png" alt="" className="h-9 w-9 object-contain" />
                <span className="whalearc-text text-lg">WHALEARC</span>
              </div>
              <p className="mt-4 text-[13.5px] leading-relaxed text-white/45" style={{ maxWidth: 300 }}>
                조용히, 깊이 있게 투자하는 사람들을 위한 포트폴리오 플랫폼.
              </p>
              <div className="mt-5">
                <p className="mb-2 text-[12px] text-white/30" style={{ letterSpacing: '.08em' }}>FOLLOW</p>
                <div className="flex gap-2">
                  {['X', 'LinkedIn', 'GitHub', 'Brunch'].map((s) => (
                    <span key={s} className="rounded-lg px-3 py-1.5 text-[12.5px] text-white/60" style={{ border: '1px solid rgba(255,255,255,.12)' }}>{s}</span>
                  ))}
                </div>
              </div>
            </div>
            {([
              ['제품', [['대시보드', () => go('/dashboard')], ['전략 라이브러리', () => go('/strategy')], ['VIRT 모드', () => go('/virt/dashboard')], ['실시간 시세', () => go('/market')], ['요금제', () => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })]]],
              ['리소스', [['가이드'], ['API'], ['상태 페이지'], ['체인지로그']]],
              ['회사', [['소개'], ['채용'], ['블로그'], ['연락처']]],
              ['약관', [['개인정보 처리방침', () => navigate('/privacy')], ['이용약관', () => navigate('/terms')], ['보안'], ['면책 조항', () => navigate('/disclaimer')]]],
            ] as [string, [string, (() => void)?][]][]).map(([head, links]) => (
              <div key={head}>
                <p className="mb-4 text-[12px] font-semibold uppercase text-white/30" style={{ letterSpacing: '.16em' }}>{head}</p>
                <ul className="flex flex-col gap-3">
                  {links.map(([label, fn]) => (
                    <li key={label}>
                      <button onClick={fn} className="text-[13.5px] text-white/70 transition-colors hover:text-white">{label}</button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* 법적 고지 (유지) */}
          <p className="mt-14 text-[11px] leading-relaxed text-white/35">
            WhaleArc에서 제공하는 모든 정보는 투자 권유가 아니며, 교육 및 참고 목적으로만 제공됩니다.
            투자에 대한 최종 판단과 책임은 본인에게 있으며, WhaleArc는 투자 손실에 대해 어떠한 법적 책임도 지지 않습니다.
            과거 수익률은 미래 수익을 보장하지 않습니다.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,.10)' }}>
            <p className="font-mono text-[12px] text-white/30">
              © 2026 WhaleArc · 모든 항해는 사용자의 책임 아래 진행됩니다.
              <a href="mailto:khyun1109@gmail.com,jhschris8080@naver.com" className="ml-2 text-white/50 underline underline-offset-4 hover:text-white/80">문의하기</a>
            </p>
            <p className="text-[12px] text-white/30">Built quietly, beneath the surface.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
