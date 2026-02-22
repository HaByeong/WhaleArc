import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';

interface HeaderProps {
  showNav?: boolean;
}

const Header = ({ showNav = false }: HeaderProps) => {
  const navigate = useNavigate();
  const isAuthenticated = authService.isAuthenticated();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    authService.logout();
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
              <div className="relative">
                <div className="absolute inset-0 bg-whale-light opacity-10 rounded-full blur-md scale-125"></div>
                <img 
                  src="/whale-tail-logo.png" 
                  alt="WhaleArc Logo" 
                  className="relative w-10 h-10 object-contain"
                  style={{
                    filter: showNav 
                      ? 'brightness(1.6) contrast(1.3) drop-shadow(0 0 4px rgba(74, 144, 226, 0.4))'
                      : 'brightness(1.8) contrast(1.4) drop-shadow(0 0 8px rgba(74, 144, 226, 0.6))',
                  }}
                />
              </div>
              <span 
                className={`font-bold text-xl ${showNav ? 'text-whale-dark' : 'text-white'}`}
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
                  className="text-gray-700 hover:text-whale-light transition-colors focus:outline-none focus:ring-2 focus:ring-whale-light focus:ring-offset-2 rounded px-2 py-1"
                  aria-label="대시보드"
                >
                  Dashboard
                </Link>
                <Link 
                  to="/my-portfolio"
                  className="text-gray-700 hover:text-whale-light transition-colors focus:outline-none focus:ring-2 focus:ring-whale-light focus:ring-offset-2 rounded px-2 py-1"
                  aria-label="내 포트폴리오"
                >
                  💼 내 포트폴리오
                </Link>
                <Link 
                  to="/market" 
                  className="text-gray-700 hover:text-whale-light transition-colors focus:outline-none focus:ring-2 focus:ring-whale-light focus:ring-offset-2 rounded px-2 py-1"
                  aria-label="시장"
                >
                  Market
                </Link>
                <Link 
                  to="/trade" 
                  className="text-gray-700 hover:text-whale-light transition-colors focus:outline-none focus:ring-2 focus:ring-whale-light focus:ring-offset-2 rounded px-2 py-1"
                  aria-label="거래"
                >
                  Trade
                </Link>
                <Link 
                  to="/strategy" 
                  className="text-gray-700 hover:text-whale-light transition-colors focus:outline-none focus:ring-2 focus:ring-whale-light focus:ring-offset-2 rounded px-2 py-1"
                  aria-label="전략"
                >
                  Strategy
                </Link>
                <Link 
                  to="/ranking" 
                  className="text-gray-700 hover:text-whale-light transition-colors font-semibold focus:outline-none focus:ring-2 focus:ring-whale-light focus:ring-offset-2 rounded px-2 py-1"
                  aria-label="랭킹"
                >
                  🏆 Ranking
                </Link>
                {isAuthenticated && (
                  <div className="flex items-center space-x-4 ml-4">
                    <div className="flex items-center space-x-2 text-gray-700" aria-label="사용자 정보">
                      <div className="w-8 h-8 bg-whale-light rounded-full flex items-center justify-center text-white font-semibold">
                        {localStorage.getItem('userId')?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <span className="text-sm">{localStorage.getItem('userId') || '사용자'}</span>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="px-4 py-2 text-sm text-gray-700 hover:text-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded-lg min-h-[44px] min-w-[44px]"
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
              Sign Up
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
              className="block px-4 py-3 text-gray-700 hover:bg-gray-50 hover:text-whale-light rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-whale-light focus:ring-offset-2 min-h-[44px] flex items-center"
              aria-label="대시보드"
            >
              Dashboard
            </Link>
            <Link
              to="/my-portfolio"
              onClick={closeMobileMenu}
              className="block px-4 py-3 text-gray-700 hover:bg-gray-50 hover:text-whale-light rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-whale-light focus:ring-offset-2 min-h-[44px] flex items-center"
              aria-label="내 포트폴리오"
            >
              💼 내 포트폴리오
            </Link>
            <Link
              to="/market"
              onClick={closeMobileMenu}
              className="block px-4 py-3 text-gray-700 hover:bg-gray-50 hover:text-whale-light rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-whale-light focus:ring-offset-2 min-h-[44px] flex items-center"
              aria-label="시장"
            >
              Market
            </Link>
            <Link
              to="/trade"
              onClick={closeMobileMenu}
              className="block px-4 py-3 text-gray-700 hover:bg-gray-50 hover:text-whale-light rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-whale-light focus:ring-offset-2 min-h-[44px] flex items-center"
              aria-label="거래"
            >
              Trade
            </Link>
            <Link
              to="/strategy"
              onClick={closeMobileMenu}
              className="block px-4 py-3 text-gray-700 hover:bg-gray-50 hover:text-whale-light rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-whale-light focus:ring-offset-2 min-h-[44px] flex items-center"
              aria-label="전략"
            >
              Strategy
            </Link>
            <Link
              to="/ranking"
              onClick={closeMobileMenu}
              className="block px-4 py-3 text-gray-700 hover:bg-gray-50 hover:text-whale-light rounded-lg transition-colors font-semibold focus:outline-none focus:ring-2 focus:ring-whale-light focus:ring-offset-2 min-h-[44px] flex items-center"
              aria-label="랭킹"
            >
              🏆 Ranking
            </Link>
            {isAuthenticated && (
              <>
                <div className="px-4 py-3 border-t border-gray-200 mt-2">
                  <div className="flex items-center space-x-2 text-gray-700 mb-3" aria-label="사용자 정보">
                    <div className="w-8 h-8 bg-whale-light rounded-full flex items-center justify-center text-white font-semibold">
                      {localStorage.getItem('userId')?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <span className="text-sm">{localStorage.getItem('userId') || '사용자'}</span>
                  </div>
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

