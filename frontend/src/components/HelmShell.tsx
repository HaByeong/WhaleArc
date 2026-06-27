import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import { mirrorService } from '../services/mirrorService';
import { useNotifications } from '../hooks/useNotifications';
import Toast from '../components/Toast';
import type { Notification } from '../services/notificationService';

/** 알림 종류별 아이콘 + 상대시간 — 벨 드롭다운용. */
const NOTIF_ICON: Record<string, string> = {
  EMOTION_MIRROR_REVEALED: '🌊', LIMIT_ORDER_FILLED: '✅', MARKET_ORDER_FILLED: '✅',
  AUTO_TRADE_EXECUTED: '⚡', TURTLE_TRADE: '🐢', STRATEGY_EXECUTED: '🧭', PRICE_ALERT: '🔔',
};
const relTime = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return '방금';
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return `${Math.floor(s / 86400)}일 전`;
};

/** '흔들린 순간' 도착 배지 — 마지막 방문 이후 새로 돌아온 유리병 수(되돌아오는 넛지). */
const MIRROR_SEEN_KEY = 'mirror_seen_revealed_count';   // localStorage: 마지막으로 본 revealed 개수
const MIRROR_BADGE_KEY = 'mirror_badge';               // sessionStorage: 캐시된 배지 수
const MIRROR_BADGE_AT_KEY = 'mirror_badge_at';         // sessionStorage: 마지막 fetch 시각(쓰로틀)
const MIRROR_VISITED_KEY = 'mirror_visited';           // localStorage: 한 번이라도 방문했는가(NEW 안내용)

/* ────────────────────────────────────────────────────────────
   HelmShell — 「디자인 개편」 mockup의 다크 사이드바 콘솔 셸 (공용)
   console.html / helm.jsx 기반. virt·novirt 공용 (virt 는 prop 으로 로고/라벨만 분기).
   항상 다크 고정 (인라인 스타일 + wa-force-dark).
   ──────────────────────────────────────────────────────────── */

const SONAR = '#5b9dff';
const UP = '#ef4d4d';

type IconKind = 'helm' | 'pie' | 'sonar' | 'swap' | 'route' | 'book' | 'chat' | 'gauge' | 'card' | 'bolt' | 'note' | 'bottle';

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
    case 'note': return <svg {...common}><rect x="5" y="3.5" width="13" height="16" rx="1.5" /><path d="M8.5 8h6M8.5 11.5h6M8.5 15h3.5" /></svg>;
    case 'bottle': return <svg {...common}><rect x="9" y="2.5" width="4" height="3.4" rx="1" /><path d="M9 5.8V8Q5.5 9.2 5.5 13.5V16.5Q5.5 19.5 11 19.5Q16.5 19.5 16.5 16.5V13.5Q16.5 9.2 13 8V5.8" /><path d="M8.5 13h5M8.5 15.3h3.4" strokeWidth={1.3} /></svg>;
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
  const { profileName, canAutoTrade } = useAuth();
  // 표시명: DB 닉네임(profileName) 우선 → 없으면 페이지가 넘긴 값(이메일 ID 등) → '항해사'.
  // 페이지마다 닉네임/이메일ID를 다르게 넘겨 이름이 들쭉날쭉하던 문제를 한 곳에서 통일.
  const displayName = profileName || userName;
  const prefix = virt ? '/virt' : '';
  const goNav = (path: string) => navigate(prefix + path);
  // '학습 노트'(거래 복기·용어집·실수도감)는 VIRT 전용 — 모의 매매 복기가 핵심이라 모의 섹션에만 노출
  const navItems: NavItem[] = virt
    ? (() => {
        const c = [...NAV];
        const i = c.findIndex((n) => n.key === 'learn');
        // VIRT 전용 회고 도구: 학습 노트(거래 복기) + 감정 거울(충동 복기)
        c.splice(i + 1, 0,
          { label: '학습 노트', icon: 'note', path: '/learn', key: 'edu' },
          { label: '유리병 편지', icon: 'bottle', path: '/mirror', key: 'mirror' });
        return c;
      })()
    : NAV;
  // 모바일 하단바: 항목이 많아 가로 스크롤 → 선택된 항목을 화면 안으로
  const mobileNavRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { mobileNavRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' }); }, [active]);

  // '흔들린 순간' 개봉 넛지 — 마지막 방문 이후 새로 도착한 유리병 수를 배지로.
  // 거울 페이지에선 페이지가 직접 fetch(중복 방지) + seen 갱신하므로 여기선 0. 그 외엔 45s 쓰로틀로 매 네비 호출 방지.
  const [mirrorBadge, setMirrorBadge] = useState(() => virt ? Number(sessionStorage.getItem(MIRROR_BADGE_KEY) || 0) : 0);
  // 첫 방문 전 'NEW' 안내(발견 동선). 방문하면 사라짐. 도착 배지가 있으면 NEW는 숨김(상호배타).
  const mirrorNew = virt && mirrorBadge === 0 && localStorage.getItem(MIRROR_VISITED_KEY) !== '1';
  useEffect(() => {
    if (!virt) return;
    if (active === 'mirror') { localStorage.setItem(MIRROR_VISITED_KEY, '1'); sessionStorage.setItem(MIRROR_BADGE_KEY, '0'); setMirrorBadge(0); return; }
    const last = Number(sessionStorage.getItem(MIRROR_BADGE_AT_KEY) || 0);
    if (Date.now() - last < 45000) return;   // 쓰로틀 — 캐시된 배지 그대로 사용
    let alive = true;
    mirrorService.list()
      .then(caps => {
        if (!alive) return;
        const revealed = caps.filter(c => c.revealed).length;
        const seen = Number(localStorage.getItem(MIRROR_SEEN_KEY) || 0);
        const b = Math.max(0, revealed - seen);
        sessionStorage.setItem(MIRROR_BADGE_KEY, String(b));
        sessionStorage.setItem(MIRROR_BADGE_AT_KEY, String(Date.now()));
        setMirrorBadge(b);
      })
      .catch(() => { /* 조용히 무시 */ });
    return () => { alive = false; };
  }, [virt, active]);

  // 알림 벨 — 30초 폴링 + 새 알림 토스트/브라우저알림(훅 내장). '유리병 도착' 등 모든 알림이 여기로.
  const notif = useNotifications();
  const [notifOpen, setNotifOpen] = useState(false);
  const toggleNotif = () => setNotifOpen(o => { const next = !o; if (next) notif.refreshNotifications(); return next; });
  const onNotifClick = (n: Notification) => {
    notif.markAsRead(n.id);
    setNotifOpen(false);
    if (n.type === 'EMOTION_MIRROR_REVEALED') navigate('/virt/mirror');
  };

  const handleLogout = async () => {
    try { await authService.logout(); } catch { /* ignore */ }
    navigate('/');
  };

  // 탑바 현재 날짜(KST) — 하드코딩 대신 렌더 시점 계산. 형식 'YYYY.MM.DD (요일)'
  const topbarDate = (() => {
    const now = new Date();
    const ymd = now.toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Seoul' }).replace(/-/g, '.');
    const wd = now.toLocaleDateString('ko-KR', { weekday: 'short', timeZone: 'Asia/Seoul' });
    return `${ymd} (${wd})`;
  })();

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
          <span className="block text-[17.5px] tracking-[.12em]"><span className="whalearc-text">WHALEARC</span>{virt && <span className="font-bold" style={{ color: SONAR }}>·VIRT</span>}</span>
          <span className="mt-0.5 block text-[11px] tracking-[.22em] text-white/45">{virt ? 'VIRT CONSOLE' : 'HELM CONSOLE'}</span>
        </span>
      </button>

      {/* 네비 */}
      <nav className="helm-nav mt-4 flex flex-1 flex-col gap-0.5">
        <div className="navkick px-3 pb-2.5 text-[11px] font-semibold tracking-[.2em] text-white/30">항로</div>
        {navItems.map((it) => {
          const on = it.key === active;
          const locked = it.key === 'autotrade' && !virt && !canAutoTrade;   // 실거래(일반) 자동매매만 BASIC 이상; 모의(virt)는 공개
          return (
            <button key={it.key} onClick={() => goNav(it.path)} className={`flex items-center gap-3 rounded-[10px] px-3 py-[11px] text-[15px] transition-colors${on ? ' nav-active' : ''}`}
              style={on
                ? { color: '#cfe1ff', fontWeight: 600, background: 'linear-gradient(180deg,rgba(91,157,255,.16),rgba(44,111,230,.07))', border: '1px solid rgba(91,157,255,.28)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.08)' }
                : { color: locked ? 'rgba(255,255,255,.42)' : 'rgba(255,255,255,.72)', fontWeight: 500, border: '1px solid transparent' }}>
              <NavIcon kind={it.icon} />
              <span className="helm-label">{it.label}</span>
              {it.key === 'mirror' && mirrorBadge > 0 && (
                <span className="helm-label" style={{ marginLeft: 'auto', minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: '#ef4d4d', color: '#fff', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} aria-label={`도착 ${mirrorBadge}건`}>{mirrorBadge}</span>
              )}
              {it.key === 'mirror' && mirrorNew && (
                <span className="helm-label" style={{ marginLeft: 'auto', padding: '1px 6px', borderRadius: 999, background: 'rgba(91,157,255,.18)', color: '#9ec5ff', fontSize: 9.5, fontWeight: 800, letterSpacing: '.08em', border: '1px solid rgba(91,157,255,.4)' }}>NEW</span>
              )}
              {locked && (
                <svg className="helm-label" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ marginLeft: 'auto', opacity: .55 }} aria-label="잠김">
                  <rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
                </svg>
              )}
            </button>
          );
        })}
      </nav>

      {/* 푸터 */}
      <div className="helm-foot flex flex-col gap-3 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,.10)' }}>
        {/* 라이트/다크 토글 */}
        {canToggle && (
          <button onClick={toggleTheme} className="flex items-center gap-2.5 rounded-[10px] px-3.5 py-[11px] text-[14px] font-medium transition-colors"
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
          <button onClick={() => navigate('/virt/dashboard')} className="flex items-center justify-between rounded-[10px] px-3.5 py-[11px] text-[14px] font-semibold"
            style={{ background: 'rgba(91,157,255,.10)', border: '1px solid rgba(91,157,255,.28)', color: SONAR }}>
            <span className="inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full animate-pulse-dot" style={{ background: SONAR, boxShadow: `0 0 8px ${SONAR}` }} />
              VIRT 가상 항해
            </span>
            <span className="opacity-70">→</span>
          </button>
        )}
        {virt && (
          <button onClick={() => navigate('/dashboard')} className="flex items-center justify-between rounded-[10px] px-3.5 py-[11px] text-[14px] font-semibold"
            style={{ background: 'rgba(245,208,97,.10)', border: '1px solid rgba(245,208,97,.30)', color: '#f5d061' }}>
            <span className="inline-flex items-center gap-2">⚓ 실전 모드로</span>
            <span className="opacity-70">→</span>
          </button>
        )}
        {/* 유저 */}
        <button onClick={() => goNav('/user')} className="flex items-center gap-2.5 px-2 py-1 text-left">
          <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] text-[14px] font-bold text-white" style={{ background: 'linear-gradient(135deg,#5b9dff,#2c6fe6)' }}>
            {displayName.slice(0, 1)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold">{displayName}</span>
            <span className="block text-[12px] text-white/45">{virt ? '모의 항해사' : '항해사 · Lv.3'}</span>
          </span>
          <span className="text-white/30">⋯</span>
        </button>
        {/* 로그아웃 */}
        <button onClick={handleLogout} aria-label="로그아웃"
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[13.5px] text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white/85">
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
          <span className="hidden font-mono text-[13px] tracking-[.06em] sm:inline" style={{ color: 'var(--ci-sonar)' }}>◎ {topbarDate} · KST</span>
          <span className="hidden h-3.5 w-px sm:block" style={{ background: 'var(--ci-line-strong)' }} />
          <span className="hidden truncate text-[13.5px] text-white/70 md:inline">{session}</span>
          {virt && <span className="shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-bold" style={{ background: 'rgba(180,210,255,.18)', color: '#cfe1ff', border: '1px solid rgba(91,157,255,.24)' }}>모의투자</span>}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {/* 검색 기능 미구현 — 동작하지 않는 버튼이라는 인상을 주지 않도록 비활성 + '준비 중' 표시 */}
            <button disabled title="검색 준비 중" className="flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-[10px] opacity-60" style={{ background: 'var(--ci-card)', border: '1px solid var(--ci-line)', color: 'var(--ci-ink2)' }} aria-label="검색 (준비 중)">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="9" cy="9" r="6" /><path d="M14 14l4 4" strokeLinecap="round" /></svg>
            </button>
            <div className="relative">
              <button onClick={toggleNotif} className="relative flex h-9 w-9 items-center justify-center rounded-[10px]" style={{ background: 'var(--ci-card)', border: '1px solid var(--ci-line)', color: 'var(--ci-ink2)' }} aria-label={`알림${notif.unreadCount > 0 ? ` ${notif.unreadCount}건` : ''}`}>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 8a4 4 0 1 1 8 0c0 4 1.5 5 1.5 5h-11S6 12 6 8Z" strokeLinejoin="round" /><path d="M8.5 16a1.5 1.5 0 0 0 3 0" /></svg>
                {notif.unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full px-1 text-[11px] font-bold text-white" style={{ background: UP, boxShadow: '0 0 0 2px var(--ci-topbar, var(--ci-card))' }}>{notif.unreadCount > 9 ? '9+' : notif.unreadCount}</span>
                )}
              </button>
              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                  <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[320px] overflow-hidden rounded-xl" style={{ background: 'var(--ci-overlay)', border: '1px solid var(--ci-line-strong)', boxShadow: 'var(--ci-panel-shadow)' }}>
                    <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid var(--ci-line)' }}>
                      <span className="text-[13.5px] font-bold" style={{ color: 'var(--ci-ink0)' }}>알림</span>
                      {notif.unreadCount > 0 && <button onClick={() => notif.markAllAsRead()} className="text-[12px] font-semibold" style={{ color: 'var(--ci-sonar)' }}>모두 읽음</button>}
                    </div>
                    <div className="max-h-[360px] overflow-y-auto">
                      {notif.notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center text-[13.5px]" style={{ color: 'var(--ci-ink3)' }}>새 알림이 없어요</div>
                      ) : notif.notifications.slice(0, 20).map(n => (
                        <button key={n.id} onClick={() => onNotifClick(n)} className="flex w-full items-start gap-2.5 px-4 py-3 text-left transition-colors hover:bg-white/[0.04]" style={{ borderBottom: '1px solid var(--ci-line)', background: n.read ? 'transparent' : 'rgba(91,157,255,.07)' }}>
                          <span className="shrink-0 text-[17.5px]" aria-hidden>{NOTIF_ICON[n.type] || '🔔'}</span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: 'var(--ci-sonar)' }} />}
                              <span className="truncate text-[13.5px] font-semibold" style={{ color: 'var(--ci-ink0)' }}>{n.title}</span>
                            </span>
                            <span className="mt-0.5 block truncate text-[12.5px]" style={{ color: 'var(--ci-ink2)' }}>{n.message}</span>
                            <span className="mt-0.5 block text-[11.5px]" style={{ color: 'var(--ci-ink3)' }}>{relTime(n.createdAt)}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* 페이지 콘텐츠 */}
        <main className="wa-console-dense px-4 pb-24 pt-6 md:px-8 md:pb-12">{children}</main>
      </div>

      {/* 하단 네비 (모바일) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex overflow-x-auto md:hidden" style={{ background: 'rgba(6,11,31,.94)', backdropFilter: 'blur(12px)', borderTop: '1px solid rgba(255,255,255,.10)' }}>
        {navItems.map((it) => {
          const on = it.key === active;
          return (
            <button key={it.key} ref={on ? mobileNavRef : null} onClick={() => goNav(it.path)} className="relative flex min-w-[68px] shrink-0 flex-col items-center gap-1 py-2 text-[11px]"
              style={{ color: on ? '#cfe1ff' : 'rgba(255,255,255,.55)' }}>
              {it.key === 'mirror' && mirrorBadge > 0 && (
                <span style={{ position: 'absolute', top: 4, right: 14, minWidth: 15, height: 15, padding: '0 4px', borderRadius: 999, background: '#ef4d4d', color: '#fff', fontSize: 9, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{mirrorBadge}</span>
              )}
              {it.key === 'mirror' && mirrorNew && (
                <span style={{ position: 'absolute', top: 5, right: 18, width: 6, height: 6, borderRadius: 999, background: '#5b9dff' }} />
              )}
              <NavIcon kind={it.icon} />{it.label}
            </button>
          );
        })}
      </nav>

      {/* 전역 토스트 — 새 알림(유리병 도착·주문 체결 등)이 도착하면 팝업 */}
      <Toast toasts={notif.toasts} onDismiss={notif.dismissToast} />
    </div>
  );
};

export default HelmShell;
