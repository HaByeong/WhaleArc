import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';

/* ────────────────────────────────────────────────────────────
   HelmShell — 「디자인 개편」 mockup의 다크 사이드바 콘솔 셸 (공용)
   console.html / helm.jsx 기반. virt·novirt 공용 (virt 는 prop 으로 로고/라벨만 분기).
   항상 다크 고정 (인라인 스타일 + wa-force-dark).
   ──────────────────────────────────────────────────────────── */

const SONAR = '#5b9dff';
const UP = '#ef4d4d';

type IconKind = 'helm' | 'pie' | 'sonar' | 'swap' | 'route' | 'book' | 'chat' | 'gauge' | 'card' | 'bolt';

const NavIcon = ({ kind }: { kind: IconKind }) => {
  const common = { width: 20, height: 20, viewBox: '0 0 22 22', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (kind) {
    case 'helm': return <svg {...common}><circle cx="11" cy="11" r="3" /><circle cx="11" cy="11" r="8" /><path d="M11 1v4M11 17v4M1 11h4M17 11h4M4 4l2.5 2.5M18 4l-2.5 2.5M4 18l2.5-2.5M18 18l-2.5-2.5" /></svg>;
    case 'pie': return <svg {...common}><path d="M11 3a8 8 0 1 0 8 8h-8z" /><path d="M11 3v8h8a8 8 0 0 0-8-8z" /></svg>;
    case 'sonar': return <svg {...common}><circle cx="11" cy="11" r="2.5" /><path d="M5.5 11a5.5 5.5 0 0 1 11 0M2 11a9 9 0 0 1 18 0" /></svg>;
    case 'swap': return <svg {...common}><path d="M7 4v14M7 4L4 7M7 4l3 3M15 18V4M15 18l3-3M15 18l-3-3" /></svg>;
    case 'route': return <svg {...common}><circle cx="5" cy="17" r="2.5" /><circle cx="17" cy="5" r="2.5" /><path strokeDasharray="2 2" d="M6.5 15C12 10 9 8 15.5 6.5" /></svg>;
    case 'book': return <svg {...common}><path d="M11 5C9 3.5 5.5 3.5 3.5 4.5v12C5.5 15.5 9 15.5 11 17M11 5c2-1.5 5.5-1.5 7.5-.5v12c-2-1-5.5-1-7.5.5M11 5v12" /></svg>;
    case 'chat': return <svg {...common}><path d="M4 5h14v9H9l-4 3.5V14H4z" /></svg>;
    case 'gauge': return <svg {...common}><path d="M4 15a7 7 0 0 1 14 0" /><path d="M11 15l4-3.5" /><circle cx="11" cy="15" r="1.2" fill="currentColor" stroke="none" /></svg>;
    case 'card': return <svg {...common}><rect x="2" y="5" width="18" height="13" rx="2" /><path d="M2 9.5h18M5.5 14h4" /></svg>;
    case 'bolt': return <svg {...common}><path d="M12 2 4 13h6l-1 7 8-11h-6z" /></svg>;
  }
};

type NavItem = { label: string; icon: IconKind; path: string; key: string };
const NAV: NavItem[] = [
  { label: '내 투자', icon: 'helm', path: '/dashboard', key: 'home' },
  { label: '포트폴리오', icon: 'pie', path: '/my-portfolio', key: 'portfolio' },
  { label: '시세', icon: 'sonar', path: '/market', key: 'markets' },
  { label: '거래', icon: 'swap', path: '/trade', key: 'trade' },
  { label: '전략', icon: 'route', path: '/strategy', key: 'strategy' },
  { label: '자동매매', icon: 'bolt', path: '/auto-trade', key: 'autotrade' },
  { label: '전략 학습', icon: 'book', path: '/store', key: 'learn' },
  { label: '커뮤니티', icon: 'chat', path: '/feedback', key: 'community' },
  { label: '투자 현황', icon: 'gauge', path: '/ranking', key: 'status' },
  { label: '결제', icon: 'card', path: '/billing', key: 'billing' },
];

interface HelmShellProps {
  children: ReactNode;
  active: string;          // 활성 nav key
  virt?: boolean;          // virt 모드 (로고/라벨 분기)
  session?: string;        // 탑바 세션 텍스트
  userName?: string;
}

const HelmShell = ({ children, active, virt = false, session = '정규장 마감 · 다음 개장 09:00', userName = '항해사' }: HelmShellProps) => {
  const navigate = useNavigate();
  const { isDark, canToggle, toggleTheme } = useTheme();
  const { profileName } = useAuth();
  // 표시명: DB 닉네임(profileName) 우선 → 없으면 페이지가 넘긴 값(이메일 ID 등) → '항해사'.
  // 페이지마다 닉네임/이메일ID를 다르게 넘겨 이름이 들쭉날쭉하던 문제를 한 곳에서 통일.
  const displayName = profileName || userName;
  const prefix = virt ? '/virt' : '';
  const goNav = (path: string) => navigate(prefix + path);

  const handleLogout = async () => {
    try { await authService.logout(); } catch { /* ignore */ }
    navigate('/');
  };

  const sidebarInner = (
    <>
      {/* 브랜드 */}
      <button onClick={() => navigate('/')} className="helm-brand flex items-center gap-2.5 px-2 pb-5 text-left" style={{ borderBottom: '1px solid rgba(255,255,255,.10)' }}>
        {virt ? (
          <span className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center">
            <span className="wt-wave wt-wave-1" style={{ position: 'absolute', left: '30%', right: '30%', height: '26%', top: '62%' }} />
            <span className="wt-wave wt-wave-2" style={{ position: 'absolute', left: '30%', right: '30%', height: '26%', top: '62%' }} />
            <span className="wt-wave wt-wave-3" style={{ position: 'absolute', left: '30%', right: '30%', height: '26%', top: '62%' }} />
            <img src="/tail.png" alt="" className="relative h-9 w-9 object-contain whale-logo-wag" style={{ filter: 'drop-shadow(0 0 6px rgba(91,157,255,.35))' }} />
          </span>
        ) : (
          <img src="/brand-whale.png" alt="" className="h-9 w-9 object-contain" style={{ filter: 'brightness(1.22) saturate(1.12) drop-shadow(0 0 12px rgba(124,196,255,.4))' }} />
        )}
        <span>
          <span className="block text-[16px] tracking-[.12em]"><span className="whalearc-text">WHALEARC</span>{virt && <span className="font-bold" style={{ color: SONAR }}>·VIRT</span>}</span>
          <span className="mt-0.5 block text-[10px] tracking-[.22em] text-white/45">{virt ? 'VIRT CONSOLE' : 'HELM CONSOLE'}</span>
        </span>
      </button>

      {/* 네비 */}
      <nav className="helm-nav mt-4 flex flex-1 flex-col gap-0.5">
        <div className="navkick px-3 pb-2.5 text-[10px] font-semibold tracking-[.2em] text-white/30">항로</div>
        {NAV.map((it) => {
          const on = it.key === active;
          return (
            <button key={it.key} onClick={() => goNav(it.path)} className={`flex items-center gap-3 rounded-[10px] px-3 py-[11px] text-[14px] transition-colors${on ? ' nav-active' : ''}`}
              style={on
                ? { color: '#cfe1ff', fontWeight: 600, background: 'linear-gradient(180deg,rgba(91,157,255,.16),rgba(44,111,230,.07))', border: '1px solid rgba(91,157,255,.28)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.08)' }
                : { color: 'rgba(255,255,255,.72)', fontWeight: 500, border: '1px solid transparent' }}>
              <NavIcon kind={it.icon} />
              <span className="helm-label">{it.label}</span>
            </button>
          );
        })}
      </nav>

      {/* 푸터 */}
      <div className="helm-foot flex flex-col gap-3 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,.10)' }}>
        {/* 라이트/다크 토글 */}
        {canToggle && (
          <button onClick={toggleTheme} className="flex items-center gap-2.5 rounded-[10px] px-3.5 py-[11px] text-[13px] font-medium transition-colors"
            style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.10)', color: 'rgba(255,255,255,.72)' }}
            title={isDark ? '라이트 모드로' : '다크 모드로'}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
              {isDark
                ? <circle cx="8" cy="8" r="3.4" />
                : <path d="M12 9.5A5 5 0 0 1 6.5 4a.5.5 0 0 0-.7-.5A6 6 0 1 0 12.5 10.2a.5.5 0 0 0-.5-.7Z" strokeLinejoin="round" />}
              {isDark && <path d="M8 1v1.6M8 13.4V15M1 8h1.6M13.4 8H15M3 3l1.1 1.1M11.9 11.9 13 13M13 3l-1.1 1.1M4.1 11.9 3 13" strokeLinecap="round" />}
            </svg>
            라이트 / 다크
          </button>
        )}
        {/* VIRT 진입 (novirt 일 때만 — virt 안에선 자기 자신) */}
        {!virt && (
          <button onClick={() => navigate('/virt/dashboard')} className="flex items-center justify-between rounded-[10px] px-3.5 py-[11px] text-[13px] font-semibold"
            style={{ background: 'rgba(91,157,255,.10)', border: '1px solid rgba(91,157,255,.28)', color: SONAR }}>
            <span className="inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full animate-pulse-dot" style={{ background: SONAR, boxShadow: `0 0 8px ${SONAR}` }} />
              VIRT 가상 항해
            </span>
            <span className="opacity-70">→</span>
          </button>
        )}
        {virt && (
          <button onClick={() => navigate('/dashboard')} className="flex items-center justify-between rounded-[10px] px-3.5 py-[11px] text-[13px] font-semibold"
            style={{ background: 'rgba(245,208,97,.10)', border: '1px solid rgba(245,208,97,.30)', color: '#f5d061' }}>
            <span className="inline-flex items-center gap-2">⚓ 실전 모드로</span>
            <span className="opacity-70">→</span>
          </button>
        )}
        {/* 유저 */}
        <button onClick={() => goNav('/user')} className="flex items-center gap-2.5 px-2 py-1 text-left">
          <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] text-[13px] font-bold text-white" style={{ background: 'linear-gradient(135deg,#5b9dff,#2c6fe6)' }}>
            {displayName.slice(0, 1)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold">{displayName}</span>
            <span className="block text-[11px] text-white/45">{virt ? '모의 항해사' : '항해사 · Lv.3'}</span>
          </span>
          <span className="text-white/30">⋯</span>
        </button>
        {/* 로그아웃 */}
        <button onClick={handleLogout} aria-label="로그아웃"
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white/85">
          <span aria-hidden style={{ fontSize: 13 }}>⏏</span> 로그아웃
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen" style={{ background: isDark ? '#060b1f' : '#e3eaf6', fontFamily: "'Pretendard','Noto Sans KR',system-ui,sans-serif" }}>
      {/* 사이드바 (데스크톱) — 항상 다크 */}
      <aside className="wa-force-dark helm-aside fixed bottom-0 left-0 top-0 z-40 hidden w-[264px] flex-col p-4 text-white md:flex"
        style={{ background: 'linear-gradient(180deg,#061826,#04121d)', borderRight: '1px solid rgba(255,255,255,.10)', padding: '22px 16px' }}>
        {sidebarInner}
      </aside>

      {/* 본문 — 라이트/다크 토글 (다크일 때만 wa-force-dark) */}
      <div className={`wa-console md:ml-[264px] ${isDark ? 'wa-force-dark text-white' : ''}`} style={{ background: 'var(--ci-page-bg)', minHeight: '100vh' }}>
        {/* 탑바 — 모바일에선 날짜/세션 텍스트 숨겨 오버플로 방지 */}
        <header className="sticky top-0 z-30 flex items-center gap-2 px-4 py-4 sm:gap-4 md:px-8"
          style={{ background: 'var(--ci-topbar)', backdropFilter: 'blur(14px)', borderBottom: '1px solid var(--ci-line)' }}>
          <span className="hidden font-mono text-[12px] tracking-[.06em] sm:inline" style={{ color: 'var(--ci-sonar)' }}>◎ 2026.06.01 (월) · KST</span>
          <span className="hidden h-3.5 w-px sm:block" style={{ background: 'var(--ci-line-strong)' }} />
          <span className="hidden truncate text-[12.5px] text-white/70 md:inline">{session}</span>
          {virt && <span className="shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: 'rgba(180,210,255,.18)', color: '#cfe1ff', border: '1px solid rgba(91,157,255,.24)' }}>모의투자</span>}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button className="flex h-9 w-9 items-center justify-center rounded-[10px]" style={{ background: 'var(--ci-card)', border: '1px solid var(--ci-line)', color: 'var(--ci-ink2)' }} aria-label="검색">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="9" cy="9" r="6" /><path d="M14 14l4 4" strokeLinecap="round" /></svg>
            </button>
            <button className="relative flex h-9 w-9 items-center justify-center rounded-[10px]" style={{ background: 'var(--ci-card)', border: '1px solid var(--ci-line)', color: 'var(--ci-ink2)' }} aria-label="알림">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 8a4 4 0 1 1 8 0c0 4 1.5 5 1.5 5h-11S6 12 6 8Z" strokeLinejoin="round" /><path d="M8.5 16a1.5 1.5 0 0 0 3 0" /></svg>
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full" style={{ background: UP, boxShadow: '0 0 0 2px var(--ci-card)' }} />
            </button>
          </div>
        </header>

        {/* 페이지 콘텐츠 */}
        <main className="px-4 pb-24 pt-6 md:px-8 md:pb-12">{children}</main>
      </div>

      {/* 하단 네비 (모바일) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex md:hidden" style={{ background: 'rgba(6,11,31,.94)', backdropFilter: 'blur(12px)', borderTop: '1px solid rgba(255,255,255,.10)' }}>
        {NAV.slice(0, 5).map((it) => {
          const on = it.key === active;
          return (
            <button key={it.key} onClick={() => goNav(it.path)} className="flex flex-1 flex-col items-center gap-1 py-2 text-[10px]"
              style={{ color: on ? '#cfe1ff' : 'rgba(255,255,255,.55)' }}>
              <NavIcon kind={it.icon} />{it.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default HelmShell;
