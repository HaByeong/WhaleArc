import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useNotifications } from '../hooks/useNotifications';
import { useRoutePrefix } from '../hooks/useRoutePrefix';
import Toast from './Toast';
import WhaleTailLogo from './WhaleTailLogo';

interface HeaderProps {
  showNav?: boolean;
}

const Header = ({ showNav = false }: HeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { prefix, isVirt } = useRoutePrefix();
  const { session, user, profileName } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isAuthenticated = !!session;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const { unreadCount, notifications, toasts, dismissToast, markAsRead, markAllAsRead, refreshNotifications } = useNotifications(isAuthenticated && showNav);

  // 알림 패널 외부 클릭 시 닫기
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifPanel(false);
      }
    };
    if (showNotifPanel) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showNotifPanel]);

  // 백엔드 DB 닉네임 우선 → Supabase metadata → 이메일 앞부분 → 기본값
  const displayName = profileName || user?.user_metadata?.name || user?.email?.split('@')[0] || '사용자';

  const handleLogout = async () => {
    await authService.logout();
    navigate('/login');
    setIsMobileMenuOpen(false);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  // non-Virt + 네비 = 다크 헤더
  const isDarkNav = showNav && !isVirt;

  return (
    <>
    <Toast toasts={toasts} onDismiss={dismissToast} />
    <header className={isDarkNav ? "bg-[#060d18] border-b border-white/[0.06]" : showNav ? "bg-white shadow-sm" : "bg-whale-dark"}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link
            to="/"
            className="flex items-center shrink-0 h-full focus:outline-none focus:ring-2 focus:ring-whale-light focus:ring-offset-2 rounded-lg"
            aria-label="홈으로 이동"
          >
            <div className="flex items-center gap-1.5">
              <WhaleTailLogo size={40} showNav={showNav} darkNav={isDarkNav} />
              <span className={`text-xl ${isDarkNav ? 'whalearc-text' : showNav ? 'whalearc-text-nav' : 'whalearc-text'}`}>
                WHALEARC{isVirt && <span className="text-cyan-400">-VIRT</span>}
              </span>
              <span className={`wt-beta-badge text-[10px] font-bold px-2 py-0.5 rounded-full ${isDarkNav ? 'bg-cyan-500/15 text-cyan-400/80 border border-cyan-500/25' : showNav ? 'bg-gradient-to-r from-whale-light to-whale-accent text-white shadow-sm' : 'bg-gradient-to-r from-blue-400 to-blue-500 text-white shadow-sm shadow-blue-400/30'}`}>
                BETA
              </span>
            </div>
          </Link>
          
          {showNav ? (
            <>
              {/* 데스크톱 네비게이션 (중앙) */}
              <nav className="hidden lg:flex items-center space-x-1 flex-1 justify-center h-full" aria-label="주요 네비게이션">
                {[
                  { to: `${prefix}/dashboard`, label: '내 투자' },
                  { to: `${prefix}/my-portfolio`, label: '포트폴리오' },
                  { to: `${prefix}/market`, label: '시세' },
                  { to: `${prefix}/trade`, label: '거래' },
                  { to: `${prefix}/strategy`, label: '전략' },
                  { to: `${prefix}/store`, label: '전략 학습' },
                  { to: `${prefix}/ranking`, label: '투자 현황' },
                ].map(({ to, label }) => (
                  <Link
                    key={to}
                    to={to}
                    className={`text-sm transition-colors font-medium px-2.5 flex items-center ${
                      isActive(to)
                        ? isDarkNav ? 'text-cyan-400' : 'text-whale-light'
                        : isDarkNav ? 'text-slate-400 hover:text-white' : 'text-gray-600 hover:text-whale-light'
                    }`}
                    aria-label={label}
                  >
                    {label}
                  </Link>
                ))}
              </nav>
              {/* 오른쪽 아이콘 영역 */}
              {isAuthenticated && (
                <div className="hidden lg:flex items-center space-x-2 shrink-0 h-full">
                    <button
                      onClick={toggleTheme}
                      title={theme === 'light' ? '라이트 모드' : theme === 'dark' ? '다크 모드' : '시스템 설정'}
                      className={`p-2 transition-colors rounded-lg ${isDarkNav ? 'text-slate-400 hover:text-white' : 'text-gray-400 hover:text-whale-light'}`}
                      aria-label="테마 변경"
                    >
                      {theme === 'light' && (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                      )}
                      {theme === 'dark' && (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                      )}
                      {theme === 'system' && (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      )}
                    </button>

                    {/* 알림 벨 */}
                    <div className="relative" ref={notifRef}>
                      <button
                        onClick={() => { setShowNotifPanel(!showNotifPanel); if (!showNotifPanel) refreshNotifications(); }}
                        className={`relative p-2 transition-colors rounded-lg focus:outline-none focus:ring-2 focus:ring-whale-light focus:ring-offset-2 ${isDarkNav ? 'text-slate-400 hover:text-white' : 'text-gray-500 hover:text-whale-light'}`}
                        aria-label="알림"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                        {unreadCount > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center min-w-[18px] h-[18px] px-1">
                            {unreadCount > 9 ? '9+' : unreadCount}
                          </span>
                        )}
                      </button>

                      {/* 알림 드롭다운 */}
                      {showNotifPanel && (
                        <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
                            <span className="text-sm font-bold text-gray-800">알림</span>
                            {unreadCount > 0 && (
                              <button onClick={markAllAsRead} className="text-xs text-whale-light hover:underline">
                                모두 읽음
                              </button>
                            )}
                          </div>
                          <div className="max-h-72 overflow-y-auto">
                            {notifications.length === 0 ? (
                              <div className="py-8 text-center text-sm text-gray-400">
                                <svg className="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                </svg>
                                아직 알림이 없어요
                              </div>
                            ) : (
                              notifications.slice(0, 20).map(n => (
                                <div
                                  key={n.id}
                                  className={`px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors ${!n.read ? 'bg-blue-50/50' : ''}`}
                                  onClick={() => { markAsRead(n.id); if (n.metadata?.stockCode) navigate(`${prefix}/trade?code=${n.metadata.stockCode}&type=${n.metadata.assetType || 'CRYPTO'}`); setShowNotifPanel(false); }}
                                >
                                  <div className="flex items-start gap-2.5">
                                    <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${!n.read ? 'bg-whale-light' : 'bg-transparent'}`} />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold text-gray-800">{n.title}</p>
                                      <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                                      <p className="text-[10px] text-gray-300 mt-1">
                                        {new Date(n.createdAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>


                    <Link
                      to={`${prefix}/user`}
                      className={`flex items-center space-x-2 transition-colors rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-whale-light focus:ring-offset-2 ${isDarkNav ? 'text-slate-300 hover:text-white' : 'text-gray-700 hover:text-whale-light'}`}
                      aria-label="내 프로필"
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${isDarkNav ? 'bg-cyan-500/20 text-cyan-400' : 'bg-whale-light text-white'}`}>
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium">{displayName}</span>
                    </Link>
                    <button
                      onClick={handleLogout}
                      className={`px-3 py-1.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded-lg min-h-[44px] min-w-[44px] ${isDarkNav ? 'text-slate-500 hover:text-red-400' : 'text-gray-400 hover:text-red-500'}`}
                      aria-label="로그아웃"
                    >
                      로그아웃
                    </button>
                </div>
              )}

              {/* 모바일 메뉴 버튼 */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className={`lg:hidden p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-whale-light focus:ring-offset-2 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${isDarkNav ? 'text-slate-300 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'}`}
                aria-label="메뉴 열기"
                aria-expanded={isMobileMenuOpen}
              >
                <svg 
                  className="w-6 h-6" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  {isMobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </>
          ) : (
            <Link 
              to="/login" 
              className="px-6 py-2 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-whale-light focus:ring-offset-2 min-h-[44px] flex items-center justify-center"
              aria-label="시작하기"
            >
              시작하기
            </Link>
          )}
        </div>

        {/* 모바일 메뉴 */}
        {showNav && isMobileMenuOpen && (
          <nav
            className={`lg:hidden py-4 space-y-2 animate-fade-in ${isDarkNav ? 'border-t border-white/[0.06]' : 'border-t border-gray-200'}`}
            aria-label="모바일 네비게이션"
          >
            {[
              { to: `${prefix}/dashboard`, label: '내 투자', ariaLabel: '내 투자' },
              { to: `${prefix}/my-portfolio`, label: '포트폴리오', ariaLabel: '내 포트폴리오' },
              { to: `${prefix}/market`, label: '시세', ariaLabel: '시장' },
              { to: `${prefix}/trade`, label: '거래', ariaLabel: '거래' },
              { to: `${prefix}/strategy`, label: '전략', ariaLabel: '전략' },
              { to: `${prefix}/store`, label: '항로', ariaLabel: '항로' },
              { to: `${prefix}/ranking`, label: '투자 현황', ariaLabel: '투자 현황' },
            ].map(({ to, label, ariaLabel }) => (
              <Link
                key={to}
                to={to}
                onClick={closeMobileMenu}
                className={`block px-4 py-3 rounded-lg transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-whale-light focus:ring-offset-2 min-h-[44px] flex items-center ${
                  isActive(to)
                    ? isDarkNav ? 'bg-cyan-500/10 text-cyan-400' : 'bg-whale-light/10 text-whale-light'
                    : isDarkNav ? 'text-slate-400 hover:bg-white/5 hover:text-white' : 'text-gray-700 hover:bg-gray-50 hover:text-whale-light'
                }`}
                aria-label={ariaLabel}
              >
                {label}
              </Link>
            ))}
            {isAuthenticated && (
              <>
                <div className="px-4 py-3 border-t border-gray-200 mt-2">
                  {/* 모바일 테마 토글 */}
                  <button
                    onClick={toggleTheme}
                    className={`flex items-center w-full px-2 py-2 mb-2 rounded-lg transition-colors ${
                      isDarkNav ? 'text-slate-400 hover:bg-white/5 hover:text-white' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {theme === 'light' && (
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    )}
                    {theme === 'dark' && (
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                      </svg>
                    )}
                    {theme === 'system' && (
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    )}
                    <span className="text-sm">
                      테마 ({theme === 'light' ? '라이트' : theme === 'dark' ? '다크' : '시스템'})
                    </span>
                    <span className="ml-auto text-[10px] text-gray-400">클릭하여 변경</span>
                  </button>
                  {/* 모바일 알림 */}
                  <button
                    onClick={() => { setShowNotifPanel(!showNotifPanel); if (!showNotifPanel) refreshNotifications(); closeMobileMenu(); }}
                    className="flex items-center w-full px-2 py-2 mb-2 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    <span className="text-sm">알림</span>
                    {unreadCount > 0 && (
                      <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>
                  <Link
                    to={`${prefix}/user`}
                    onClick={closeMobileMenu}
                    className="flex items-center space-x-2 text-gray-700 mb-3 focus:outline-none focus:ring-2 focus:ring-whale-light focus:ring-offset-2 rounded-lg px-2 py-2"
                    aria-label="내 프로필"
                  >
                    <div className="w-8 h-8 bg-whale-light rounded-full flex items-center justify-center text-white font-semibold">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm">{displayName}</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-3 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 min-h-[44px] text-left"
                    aria-label="로그아웃"
                  >
                    로그아웃
                  </button>
                </div>
              </>
            )}
          </nav>
        )}
      </div>
    </header>
    </>
  );
};

export default Header;

