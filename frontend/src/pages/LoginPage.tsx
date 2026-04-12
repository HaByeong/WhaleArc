import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import apiClient from '../utils/api';

interface IndexData {
  code: string;
  name: string;
  price: number;
  change: number;
  changeRate: number;
}

// 인앱 브라우저 감지
const isInAppBrowser = (): boolean => {
  const ua = navigator.userAgent || navigator.vendor || '';
  return /KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line|Twitter|Snapchat|everytimeApp/i.test(ua);
};

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [indices, setIndices] = useState<IndexData[]>([]);
  const [isInApp] = useState(isInAppBrowser);
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useAuth();
  const { isDark } = useTheme();
  const isVirtLogin = (location.state as any)?.from?.startsWith('/virt');

  // 이미 로그인된 경우 목적지로 이동
  useEffect(() => {
    if (session) {
      const state = location.state as { from?: string } | null;
      const redirectTo = state?.from || '/dashboard';
      navigate(redirectTo, { replace: true });
    }
  }, [session, navigate, location.state]);

  // 리다이렉트로 인한 메시지 표시
  useEffect(() => {
    const state = location.state as { message?: string; from?: string } | null;
    if (state?.message) {
      setInfoMessage(state.message);
      const timer = setTimeout(() => {
        setInfoMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [location]);

  // KOSPI / KOSDAQ 실시간 지수 조회
  useEffect(() => {
    const fetchIndices = async () => {
      try {
        const res = await apiClient.get('/api/market/indices');
        if (res.data && res.data.length > 0) {
          setIndices(res.data);
        }
      } catch {
        // 실패 시 조용히 무시 (카드 숨김 처리)
      }
    };
    fetchIndices();
    const interval = setInterval(fetchIndices, 30_000); // 30초마다 갱신
    return () => clearInterval(interval);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setInfoMessage(null);

    // 이메일 형식 검증 강화
    const trimmedEmail = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      setError('올바른 이메일 형식을 입력해주세요.');
      setIsLoading(false);
      return;
    }

    try {
      await authService.login(trimmedEmail, password);
      const state = location.state as { from?: string } | null;
      const redirectTo = state?.from || '/dashboard';
      navigate(redirectTo, { replace: true });
    } catch (err: any) {
      if (err?.message) {
        setError(err.message);
      } else if (err?.code === 'NETWORK_ERROR' || !navigator.onLine) {
        setError('네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.');
      } else {
        setError('항해를 시작할 수 없습니다. 이메일과 비밀번호를 확인해주세요.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthLogin = async (provider: 'google') => {
    setOauthLoading(provider);
    setError(null);
    try {
      // OAuth 후 돌아올 목적지 저장 (콜백에서 state가 날아가므로)
      const state = location.state as { from?: string } | null;
      if (state?.from) {
        try { localStorage.setItem('whalearc_redirect', state.from); } catch { /* iOS Safari 개인정보 보호 모드 등 */ }
      }
      await authService.loginWithOAuth(provider);
    } catch (err: any) {
      setError(err.message || `${provider} 로그인에 실패했습니다.`);
      setOauthLoading(null);
    }
  };

  const features = [
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      title: '1,000만원 가상자금',
      desc: '리스크 없이 실전처럼 투자 연습',
      color: !isDark ? 'bg-blue-50 text-blue-600' : 'bg-blue-500/10 text-blue-400',
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
      title: '주식 + 가상화폐 통합',
      desc: 'KRX 전종목과 빗썸 가상화폐를 한 포트폴리오에서',
      color: !isDark ? 'bg-emerald-50 text-emerald-600' : 'bg-emerald-500/10 text-emerald-400',
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      title: '퀀트 전략 상점',
      desc: '터틀 트레이딩 등 검증된 알고리즘 자동매매',
      color: !isDark ? 'bg-purple-50 text-purple-600' : 'bg-purple-500/10 text-purple-400',
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      title: '포트폴리오 분석',
      desc: '자산 추이, 수익률, CSV 리포트까지',
      color: !isDark ? 'bg-amber-50 text-amber-600' : 'bg-amber-500/10 text-amber-400',
    },
  ];

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[var(--wa-page-bg)] text-white' : 'bg-[var(--wa-page-bg)]'}`}>

      {/* Non-Virt: 상단 히어로 배너 */}
      {!isVirtLogin && (
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-[#060d18] via-[#040b1d] to-[#060d18]" />
          <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[500px] h-[400px] bg-cyan-500/[0.04] rounded-full blur-[120px]" />
          <div className="absolute top-[5%] left-1/2 -translate-x-1/2 w-[250px] h-[300px] bg-blue-400/[0.03] rounded-full blur-[80px]" />
          <div className="absolute top-[12%] left-[8%] w-1 h-1 bg-cyan-400/25 rounded-full animate-pulse" />
          <div className="absolute top-[25%] right-[10%] w-1 h-1 bg-cyan-300/15 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />

          <div className="relative z-10 px-8 md:px-12 py-10 md:py-14 text-center max-w-4xl mx-auto">
            <div className="relative w-[280px] h-[280px] md:w-[380px] md:h-[380px] mx-auto -mb-8">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-3/4 h-3/4 bg-cyan-500/[0.06] rounded-full blur-[50px] animate-pulse" style={{ animationDuration: '4s' }} />
              </div>
              <img src="/tail-sample-2.png" alt="" className="relative w-full h-full object-contain"
                style={{ filter: 'drop-shadow(0 0 30px rgba(56, 189, 248, 0.18)) drop-shadow(0 0 60px rgba(56, 189, 248, 0.08))' }} />
            </div>
            <h3 className="whalearc-text text-3xl md:text-4xl font-bold tracking-tighter mb-2">
              WHALEARC
            </h3>
            <p className="text-slate-400 text-base mb-2">내 실제 자산을, 한 곳에서</p>
            <p className="text-sm text-slate-600 mb-5 max-w-md mx-auto">
              증권사와 거래소 API를 연동하면 흩어진 내 자산을 하나의 화면에서 확인할 수 있습니다
            </p>
            <div className="flex items-center gap-2 justify-center">
              {['한국투자증권', '업비트', '비트겟'].map((name) => (
                <span key={name} className="text-[11px] text-slate-500 bg-white/[0.04] border border-white/[0.06] rounded-md px-3 py-1">{name}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Virt: 상단 히어로 배너 */}
      {isVirtLogin && (
        <div className="bg-gradient-to-b from-cyan-50 via-blue-50 to-white py-10 md:py-14 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-200 opacity-20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-200 opacity-15 rounded-full blur-2xl" />
          <div className="relative z-10 max-w-2xl mx-auto px-4">
            <div className="relative w-28 h-28 mx-auto mb-4">
              <div className="wt-wave wt-wave-1" style={{ position: 'absolute', left: '5%', right: '5%', height: '30%', top: '62%' }} />
              <div className="wt-wave wt-wave-2" style={{ position: 'absolute', left: '5%', right: '5%', height: '30%', top: '62%' }} />
              <div className="wt-wave wt-wave-3" style={{ position: 'absolute', left: '5%', right: '5%', height: '30%', top: '62%' }} />
              <img src="/tail.png" alt="" className="w-full h-full object-contain whale-logo-wag"
                style={{ filter: 'brightness(1.8) saturate(1.2) hue-rotate(-5deg) drop-shadow(0 0 12px rgba(74,144,226,0.7))' }} />
            </div>
            <h3 className="text-2xl md:text-3xl font-bold tracking-tighter mb-2">
              <span className="text-whale-dark">WHALEARC</span><span className="text-cyan-500">-VIRT</span>
            </h3>
            <p className="text-gray-600 text-base">가상 모의투자로 주식·코인 매매를 체험해보세요</p>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Login Form */}
          <div className={!isDark ? 'card' : 'rounded-xl border border-white/[0.06] bg-white/[0.02] p-6'}>

            <div className="mb-8">
              <h2 className={`text-2xl font-bold ${!isDark ? 'text-whale-dark' : 'text-white'}`}>
                {!isDark ? 'Virt에 오신 것을 환영해요' : '다시 만나서 반가워요'}
              </h2>
              <p className={`text-sm mt-1 ${!isDark ? 'text-gray-400' : 'text-slate-400'}`}>
                {!isDark ? '로그인하고 내 실제 자산을 확인하세요' : '계정에 로그인하고 항해를 이어가세요'}
              </p>
            </div>

            {/* 인앱 브라우저 경고 */}
            {isInApp && (
              <div className={`rounded-lg p-4 mb-4 text-sm ${!isDark ? 'bg-amber-50 border border-amber-200 text-amber-800' : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'}`}>
                <div className="font-semibold mb-1">외부 브라우저에서 열어주세요</div>
                <p>현재 인앱 브라우저(네이버, 카카오톡 등)에서는 Google 로그인이 제한됩니다.</p>
                <p className="mt-1">우측 상단 <strong>⋮</strong> 메뉴 → <strong>"기본 브라우저로 열기"</strong>를 눌러주세요.</p>
              </div>
            )}

            {/* OAuth 로그인 버튼 */}
            <div className="space-y-3 mb-6">
              <button
                type="button"
                onClick={() => handleOAuthLogin('google')}
                disabled={!!oauthLoading}
                className={`w-full flex items-center justify-center space-x-3 px-4 py-3 rounded-lg transition-colors disabled:opacity-50 ${!isDark ? 'border border-gray-300 hover:bg-gray-50' : 'border border-white/10 bg-white/[0.04] hover:bg-white/[0.06]'}`}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span className={`font-medium ${!isDark ? 'text-gray-700' : 'text-slate-300'}`}>
                  {oauthLoading === 'google' ? '연결 중...' : 'Google로 로그인'}
                </span>
              </button>

            </div>

            <p className={`text-xs text-center ${isVirtLogin ? 'text-gray-400' : 'text-slate-500'}`}>
              로그인 시{' '}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className={`underline hover:no-underline ${isVirtLogin ? 'text-gray-500 hover:text-whale-light' : 'text-slate-400 hover:text-cyan-400'}`}>이용약관</a>
              {' '}및{' '}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className={`underline hover:no-underline ${isVirtLogin ? 'text-gray-500 hover:text-whale-light' : 'text-slate-400 hover:text-cyan-400'}`}>개인정보처리방침</a>
              에 동의하는 것으로 간주합니다.
            </p>

            {/* 구분선 */}
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className={`w-full border-t ${!isDark ? 'border-gray-300' : 'border-white/[0.06]'}`} />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className={`px-4 ${!isDark ? 'bg-white text-gray-500' : 'bg-[var(--wa-page-bg)] text-slate-500'}`}>또는 이메일로 로그인</span>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4" aria-label="로그인 폼">
              {/* 안내 메시지 (리다이렉트로 인한 경우) */}
              {infoMessage && (
                <div
                  className={`rounded-lg p-4 text-sm flex items-start space-x-2 ${!isDark ? 'bg-blue-50 border border-blue-200 text-blue-800' : 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-400'}`}
                  role="alert"
                  aria-live="polite"
                >
                  <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1">
                    <div className="font-semibold mb-1">알림</div>
                    <div>{infoMessage}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInfoMessage(null)}
                    className={`flex-shrink-0 ${!isDark ? 'text-blue-600 hover:text-blue-800' : 'text-cyan-400 hover:text-cyan-300'}`}
                    aria-label="메시지 닫기"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}

              <div>
                <label htmlFor="email" className={`block text-sm font-medium mb-2 ${!isDark ? 'text-gray-700' : 'text-slate-300'}`}>
                  이메일
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={!isDark ? 'input-field' : 'w-full px-4 py-3 rounded-lg bg-white/[0.04] border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40'}
                  placeholder="email@example.com"
                  required
                  aria-required="true"
                  aria-describedby={error ? "login-error" : undefined}
                />
              </div>
              <div>
                <label htmlFor="password" className={`block text-sm font-medium mb-2 ${!isDark ? 'text-gray-700' : 'text-slate-300'}`}>
                  비밀번호
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={!isDark ? 'input-field' : 'w-full px-4 py-3 rounded-lg bg-white/[0.04] border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40'}
                  placeholder="6자 이상"
                  required
                  aria-required="true"
                  aria-describedby={error ? "login-error" : undefined}
                />
              </div>
              {error && (
                <div
                  id="login-error"
                  className={`rounded-lg p-3 text-sm ${!isDark ? 'bg-red-50 border border-red-200 text-red-800' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}
                  role="alert"
                  aria-live="polite"
                >
                  {error}
                </div>
              )}
              <button
                type="submit"
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading}
              >
                {isLoading ? '로그인 중...' : '로그인'}
              </button>
            </form>
            <div className="mt-4 text-center space-y-2">
              <p className={!isDark ? 'text-gray-600' : 'text-slate-400'}>
                계정이 없으신가요?{' '}
                <Link to="/signup" className={`font-semibold hover:underline ${!isDark ? 'text-whale-light' : 'text-cyan-400'}`}>
                  회원가입
                </Link>
              </p>
              <p>
                <Link to="/forgot-password" className={`text-sm hover:underline ${!isDark ? 'text-gray-500 hover:text-whale-light' : 'text-slate-400 hover:text-cyan-400'}`}>
                  비밀번호를 잊으셨나요?
                </Link>
              </p>
            </div>
          </div>

          {/* Right Side - Market + Features */}
          <div className="space-y-6">
            {/* KOSPI / KOSDAQ / USDT 실시간 지수 */}
            {indices.length > 0 && (() => {
              const marketIndices = indices.filter(i => i.code !== 'USDT/KRW');
              const usdtIndex = indices.find(i => i.code === 'USDT/KRW');
              return (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    {marketIndices.map((idx) => {
                      const isUp = idx.change >= 0;
                      return (
                        <div key={idx.code} className={`rounded-2xl p-4 sm:p-5 ${!isDark ? (isUp ? 'bg-red-50' : 'bg-blue-50') : (isUp ? 'bg-red-500/10 border border-red-500/10' : 'bg-blue-500/10 border border-blue-500/10')}`}>
                          <div className="flex items-center space-x-1.5 sm:space-x-2 mb-2 sm:mb-3">
                            <span className={`text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded ${!isDark ? (isUp ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700') : (isUp ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400')}`}>
                              {idx.code}
                            </span>
                            <span className={`text-xs sm:text-sm font-medium ${!isDark ? 'text-gray-500' : 'text-slate-400'}`}>{idx.name}</span>
                          </div>
                          <div className={`text-xl sm:text-2xl font-bold ${!isDark ? 'text-whale-dark' : 'text-white'}`}>
                            {idx.price.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className={`flex items-center space-x-1 mt-1 text-xs sm:text-sm font-semibold ${!isDark ? (isUp ? 'text-red-600' : 'text-blue-600') : (isUp ? 'text-red-400' : 'text-blue-400')}`}>
                            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              {isUp
                                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                              }
                            </svg>
                            <span>{Math.abs(idx.changeRate).toFixed(2)}%</span>
                            <span className={`text-[10px] sm:text-xs font-normal ${!isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                              ({isUp ? '+' : ''}{idx.change.toFixed(2)})
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {usdtIndex && (() => {
                    const isUp = usdtIndex.change >= 0;
                    return (
                      <div className={`rounded-2xl px-4 py-3 flex items-center justify-between ${!isDark ? 'bg-gray-50 border border-gray-100' : 'bg-white/[0.02] border border-white/[0.06]'}`}>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded ${!isDark ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/20 text-emerald-400'}`}>
                            USDT
                          </span>
                          <span className={`text-xs sm:text-sm font-medium ${!isDark ? 'text-gray-500' : 'text-slate-400'}`}>테더 환율</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-base sm:text-lg font-bold ${!isDark ? 'text-whale-dark' : 'text-white'}`}>
                            ₩{usdtIndex.price.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                          </span>
                          <span className={`text-xs font-semibold ${!isDark ? (isUp ? 'text-red-600' : 'text-blue-600') : (isUp ? 'text-red-400' : 'text-blue-400')}`}>
                            {isUp ? '▲' : '▼'} {Math.abs(usdtIndex.changeRate).toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                  <p className={`text-[10px] text-right ${!isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                    * 지수: KIS API 기준 (15~20초 지연) · 환율: 업비트 실시간
                  </p>
                </div>
              );
            })()}

            {/* WhaleArc를 만든 이유 */}
            <div className={!isDark ? 'card border-l-4 border-l-whale-dark' : 'rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 border-l-4 border-l-cyan-500/40'}>
              <p className={`text-xs font-semibold tracking-widest uppercase mb-3 ${!isDark ? 'text-whale-light' : 'text-cyan-400'}`}>Why WhaleArc</p>
              <h3 className={`text-lg font-bold mb-4 ${!isDark ? 'text-whale-dark' : 'text-white'}`}>
                투자, 누구에게나 열려 있어야 하니까.
              </h3>
              <div className={`space-y-2.5 text-sm leading-relaxed ${!isDark ? 'text-gray-600' : 'text-slate-400'}`}>
                <p>
                  높은 진입장벽과 실패에 대한 두려움이
                  첫 걸음을 망설이게 만듭니다.
                </p>
                <p>
                  WhaleArc는 복잡한 설치 없이,
                  <span className={`font-semibold ${!isDark ? 'text-whale-dark' : 'text-white'}`}> 웹 접속만으로 실시간 시세와
                  함께 나만의 포트폴리오를 구성</span>하고
                  리스크 없이 투자를 경험할 수 있는 공간입니다.
                </p>
              </div>
              <p className={`mt-4 text-xs ${!isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                당신의 첫 항해, WhaleArc가 함께합니다.
              </p>
            </div>

            {/* WhaleArc 기능 소개 카드 */}
            <div className={!isDark ? 'card' : 'rounded-xl border border-white/[0.06] bg-white/[0.02] p-6'}>
              <h3 className={`text-lg font-semibold mb-5 ${!isDark ? 'text-whale-dark' : 'text-white'}`}>
                WhaleArc에서 할 수 있는 것들
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {features.map((f, i) => (
                  <div
                    key={i}
                    className={`flex items-start space-x-3 p-3 rounded-xl transition-colors ${!isDark ? 'hover:bg-gray-50' : 'hover:bg-white/[0.03]'}`}
                  >
                    <div className={`p-2.5 rounded-xl flex-shrink-0 ${f.color}`}>
                      {f.icon}
                    </div>
                    <div className="min-w-0">
                      <div className={`font-semibold text-sm ${!isDark ? 'text-whale-dark' : 'text-white'}`}>{f.title}</div>
                      <div className={`text-xs mt-0.5 leading-relaxed ${!isDark ? 'text-gray-500' : 'text-slate-500'}`}>{f.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

export default LoginPage;
