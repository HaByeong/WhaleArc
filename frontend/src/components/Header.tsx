import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';
import WhaleTailLogo from './WhaleTailLogo';

interface HeaderProps {
  showNav?: boolean;
}

const Header = ({ showNav = false }: HeaderProps) => {
  const navigate = useNavigate();
  const { session, user } = useAuth();
  const isAuthenticated = !!session;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || '사용자';

  const handleLogout = async () => {
    await authService.logout();
    navigate('/login');
    setIsMobileMenuOpen(false);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <header className={showNav ? "bg-white shadow-sm" : "bg-whale-dark"}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link 
            to="/" 
            className="flex items-center focus:outline-none focus:ring-2 focus:ring-whale-light focus:ring-offset-2 rounded-lg"
            aria-label="홈으로 이동"
          >
            <div className="flex items-center space-x-2">
              <WhaleTailLogo
                size={40}
                showNav={showNav}
              />
              <span
                className={`text-xl ml-1 ${showNav ? 'whalearc-text-nav' : 'whalearc-text'}`}
              >
                WHALEARC
              </span>
            </div>
          </Link>
          
          {showNav ? (
            <>
              {/* 데스크톱 네비게이션 */}
              <nav className="hidden lg:flex items-center space-x-6" aria-label="주요 네비게이션">
                <Link
                  to="/dashboard"
                  className="text-gray-700 hover:text-whale-light transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-whale-light focus:ring-offset-2 rounded px-3 py-1.5"
                  aria-label="내 투자"
                >
                  내 투자
                </Link>
                <Link
                  to="/my-portfolio"
                  className="text-gray-700 hover:text-whale-light transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-whale-light focus:ring-offset-2 rounded px-3 py-1.5"
                  aria-label="내 포트폴리오"
                >
                  포트폴리오
                </Link>
                <Link
                  to="/market"
                  className="text-gray-700 hover:text-whale-light transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-whale-light focus:ring-offset-2 rounded px-3 py-1.5"
                  aria-label="시장"
                >
                  시세
                </Link>
                <Link
                  to="/trade"
                  className="text-gray-700 hover:text-whale-light transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-whale-light focus:ring-offset-2 rounded px-3 py-1.5"
                  aria-label="거래"
                >
                  거래
                </Link>
                <Link
                  to="/strategy"
                  className="text-gray-700 hover:text-whale-light transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-whale-light focus:ring-offset-2 rounded px-3 py-1.5"
                  aria-label="전략"
                >
                  전략
                </Link>
                <Link
                  to="/store"
                  className="text-gray-700 hover:text-whale-light transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-whale-light focus:ring-offset-2 rounded px-3 py-1.5"
                  aria-label="항로"
                >
                  항로
                </Link>
                <Link
                  to="/ranking"
                  className="text-gray-700 hover:text-whale-light transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-whale-light focus:ring-offset-2 rounded px-3 py-1.5"
                  aria-label="투자 현황"
                >
                  투자 현황
                </Link>
                {isAuthenticated && (
                  <div className="flex items-center space-x-3 ml-4 pl-4 border-l border-gray-200">
                    <Link
                      to="/user"
                      className="flex items-center space-x-2 text-gray-700 hover:text-whale-light transition-colors rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-whale-light focus:ring-offset-2"
                      aria-label="내 프로필"
                    >
                      <div className="w-7 h-7 bg-whale-light rounded-full flex items-center justify-center text-white text-xs font-semibold">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium">{displayName}</span>
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="px-3 py-1.5 text-sm text-gray-400 hover:text-red-500 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded-lg min-h-[44px] min-w-[44px]"
                      aria-label="로그아웃"
                    >
                      로그아웃
                    </button>
                  </div>
                )}
              </nav>

              {/* 모바일 메뉴 버튼 */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden p-2 rounded-lg text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-whale-light focus:ring-offset-2 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
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
              aria-label="회원가입"
            >
              시작하기
            </Link>
          )}
        </div>

        {/* 모바일 메뉴 */}
        {showNav && isMobileMenuOpen && (
          <nav 
            className="lg:hidden border-t border-gray-200 py-4 space-y-2 animate-fade-in"
            aria-label="모바일 네비게이션"
          >
            <Link
              to="/dashboard"
              onClick={closeMobileMenu}
              className="block px-4 py-3 text-gray-700 hover:bg-gray-50 hover:text-whale-light rounded-lg transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-whale-light focus:ring-offset-2 min-h-[44px] flex items-center"
              aria-label="대시보드"
            >
              대시보드
            </Link>
            <Link
              to="/my-portfolio"
              onClick={closeMobileMenu}
              className="block px-4 py-3 text-gray-700 hover:bg-gray-50 hover:text-whale-light rounded-lg transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-whale-light focus:ring-offset-2 min-h-[44px] flex items-center"
              aria-label="내 포트폴리오"
            >
              포트폴리오
            </Link>
            <Link
              to="/market"
              onClick={closeMobileMenu}
              className="block px-4 py-3 text-gray-700 hover:bg-gray-50 hover:text-whale-light rounded-lg transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-whale-light focus:ring-offset-2 min-h-[44px] flex items-center"
              aria-label="시장"
            >
              시세
            </Link>
            <Link
              to="/trade"
              onClick={closeMobileMenu}
              className="block px-4 py-3 text-gray-700 hover:bg-gray-50 hover:text-whale-light rounded-lg transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-whale-light focus:ring-offset-2 min-h-[44px] flex items-center"
              aria-label="거래"
            >
              거래
            </Link>
            <Link
              to="/strategy"
              onClick={closeMobileMenu}
              className="block px-4 py-3 text-gray-700 hover:bg-gray-50 hover:text-whale-light rounded-lg transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-whale-light focus:ring-offset-2 min-h-[44px] flex items-center"
              aria-label="전략"
            >
              전략
            </Link>
            <Link
              to="/store"
              onClick={closeMobileMenu}
              className="block px-4 py-3 text-gray-700 hover:bg-gray-50 hover:text-whale-light rounded-lg transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-whale-light focus:ring-offset-2 min-h-[44px] flex items-center"
              aria-label="항로"
            >
              항로
            </Link>
            <Link
              to="/ranking"
              onClick={closeMobileMenu}
              className="block px-4 py-3 text-gray-700 hover:bg-gray-50 hover:text-whale-light rounded-lg transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-whale-light focus:ring-offset-2 min-h-[44px] flex items-center"
              aria-label="투자 현황"
            >
              투자 현황
            </Link>
            {isAuthenticated && (
              <>
                <div className="px-4 py-3 border-t border-gray-200 mt-2">
                  <Link
                    to="/user"
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
  );
};

export default Header;

