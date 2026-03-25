import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Header from '../components/Header';
import { authService } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';
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

  // 이미 로그인된 경우 대시보드로 이동
  useEffect(() => {
    if (session) {
      navigate('/dashboard', { replace: true });
    }
  }, [session, navigate]);

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

    try {
      await authService.login(email, password);
      const state = location.state as { from?: string } | null;
      const redirectTo = state?.from || '/dashboard';
      navigate(redirectTo, { replace: true });
    } catch (err: any) {
      setError(err.message || '항해를 시작할 수 없습니다. 이메일과 비밀번호를 확인해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthLogin = async (provider: 'google' | 'kakao') => {
    setOauthLoading(provider);
    setError(null);
    try {
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
      color: 'bg-blue-50 text-blue-600',
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
      title: '주식 + 가상화폐 통합',
      desc: 'KRX 전종목과 빗썸 가상화폐를 한 포트폴리오에서',
      color: 'bg-emerald-50 text-emerald-600',
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      title: '퀀트 전략 상점',
      desc: '터틀 트레이딩 등 검증된 알고리즘 자동매매',
      color: 'bg-purple-50 text-purple-600',
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      title: '포트폴리오 분석',
      desc: '자산 추이, 수익률, CSV 리포트까지',
      color: 'bg-amber-50 text-amber-600',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header showNav={true} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Login Form */}
          <div className="card">
            {/* Virt 경유 로그인 표시 */}
            {(location.state as any)?.from === '/virt' && (
              <div className="flex items-center gap-3 mb-6 px-4 py-3 rounded-xl bg-[#060d18] border border-cyan-500/20">
                <img src="/tail-sample-2.png" alt="" className="w-8 h-8 object-contain" />
                <div>
                  <div className="text-sm font-bold text-white tracking-tighter">
                    <span className="text-slate-400">WHALEARC</span><span className="text-slate-600">/</span><span className="text-white">VIRT</span>
                  </div>
                  <p className="text-[11px] text-cyan-400/70">로그인하면 Virt로 바로 이동합니다</p>
                </div>
              </div>
            )}

            <div className="mb-8">
              <h2 className="text-2xl font-bold text-whale-dark">
                {(location.state as any)?.from === '/virt' ? 'Virt에 오신 것을 환영해요' : '다시 만나서 반가워요'}
              </h2>
              <p className="text-gray-400 text-sm mt-1">
                {(location.state as any)?.from === '/virt' ? '로그인하고 내 실제 자산을 확인하세요' : '계정에 로그인하고 항해를 이어가세요'}
              </p>
            </div>

            {/* 인앱 브라우저 경고 */}
            {isInApp && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 text-sm text-amber-800">
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
                className="w-full flex items-center justify-center space-x-3 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span className="font-medium text-gray-700">
                  {oauthLoading === 'google' ? '연결 중...' : 'Google로 로그인'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleOAuthLogin('kakao')}
                disabled={!!oauthLoading}
                className="w-full flex items-center justify-center space-x-3 px-4 py-3 rounded-lg hover:opacity-90 transition-colors disabled:opacity-50"
                style={{ backgroundColor: '#FEE500' }}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M12 3C6.48 3 2 6.36 2 10.5c0 2.67 1.76 5.02 4.4 6.36-.15.56-.97 3.6-.99 3.82 0 0-.02.16.08.22.1.06.23.01.23.01.3-.04 3.52-2.3 4.08-2.7.7.1 1.43.15 2.2.15 5.52 0 10-3.36 10-7.5S17.52 3 12 3z" fill="#3C1E1E"/>
                </svg>
                <span className="font-medium" style={{ color: '#3C1E1E' }}>
                  {oauthLoading === 'kakao' ? '연결 중...' : '카카오로 로그인'}
                </span>
              </button>
            </div>

            {/* 구분선 */}
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-4 text-gray-500">또는 이메일로 로그인</span>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4" aria-label="로그인 폼">
              {/* 안내 메시지 (리다이렉트로 인한 경우) */}
              {infoMessage && (
                <div
                  className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-blue-800 text-sm flex items-start space-x-2"
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
                    className="text-blue-600 hover:text-blue-800 flex-shrink-0"
                    aria-label="메시지 닫기"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  이메일
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  placeholder="email@example.com"
                  required
                  aria-required="true"
                  aria-describedby={error ? "login-error" : undefined}
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  비밀번호
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field"
                  placeholder="6자 이상"
                  required
                  aria-required="true"
                  aria-describedby={error ? "login-error" : undefined}
                />
              </div>
              {error && (
                <div
                  id="login-error"
                  className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm"
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
              <p className="text-gray-600">
                계정이 없으신가요?{' '}
                <Link to="/signup" className="text-whale-light hover:underline font-semibold">
                  회원가입
                </Link>
              </p>
              <p>
                <Link to="/forgot-password" className="text-sm text-gray-500 hover:text-whale-light hover:underline">
                  비밀번호를 잊으셨나요?
                </Link>
              </p>
            </div>
          </div>

          {/* Right Side - Market + Features */}
          <div className="space-y-6">
            {/* KOSPI / KOSDAQ 실시간 지수 */}
            {indices.length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                {indices.map((idx) => {
                  const isUp = idx.change >= 0;
                  return (
                    <div key={idx.code} className={`rounded-2xl p-4 sm:p-5 ${isUp ? 'bg-red-50' : 'bg-blue-50'}`}>
                      <div className="flex items-center space-x-1.5 sm:space-x-2 mb-2 sm:mb-3">
                        <span className={`text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded ${isUp ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                          {idx.code}
                        </span>
                        <span className="text-xs sm:text-sm text-gray-500 font-medium">{idx.name}</span>
                      </div>
                      <div className="text-xl sm:text-2xl font-bold text-whale-dark">
                        {idx.price.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className={`flex items-center space-x-1 mt-1 text-xs sm:text-sm font-semibold ${isUp ? 'text-red-600' : 'text-blue-600'}`}>
                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {isUp
                            ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                            : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                          }
                        </svg>
                        <span>{Math.abs(idx.changeRate).toFixed(2)}%</span>
                        <span className="text-[10px] sm:text-xs font-normal text-gray-400">
                          ({isUp ? '+' : ''}{idx.change.toFixed(2)})
                        </span>
                      </div>
                    </div>
                  );
                })}
              <p className="text-[10px] text-gray-400 text-right mt-1.5">
                * KIS 모의투자 API 기준, 약 15~20초 지연 시세
              </p>
              </div>
            )}

            {/* WhaleArc를 만든 이유 */}
            <div className="card border-l-4 border-l-whale-dark">
              <p className="text-xs font-semibold text-whale-light tracking-widest uppercase mb-3">Why WhaleArc</p>
              <h3 className="text-lg font-bold text-whale-dark mb-4">
                투자, 누구에게나 열려 있어야 하니까.
              </h3>
              <div className="space-y-2.5 text-sm text-gray-600 leading-relaxed">
                <p>
                  높은 진입장벽과 실패에 대한 두려움이
                  첫 걸음을 망설이게 만듭니다.
                </p>
                <p>
                  WhaleArc는 복잡한 설치 없이,
                  <span className="text-whale-dark font-semibold"> 웹 접속만으로 실시간 시세와
                  함께 나만의 포트폴리오를 구성</span>하고
                  리스크 없이 투자를 경험할 수 있는 공간입니다.
                </p>
              </div>
              <p className="mt-4 text-xs text-gray-400">
                당신의 첫 항해, WhaleArc가 함께합니다.
              </p>
            </div>

            {/* WhaleArc 기능 소개 카드 */}
            <div className="card">
              <h3 className="text-lg font-semibold text-whale-dark mb-5">
                WhaleArc에서 할 수 있는 것들
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {features.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-start space-x-3 p-3 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <div className={`p-2.5 rounded-xl flex-shrink-0 ${f.color}`}>
                      {f.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-whale-dark text-sm">{f.title}</div>
                      <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">{f.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* ═══ Virt — 하단 전체폭 ═══ */}
        <div
          onClick={() => { navigate('/login', { state: { from: '/virt', message: '로그인하면 바로 Virt로 이동합니다.' } }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          className="mt-10 relative overflow-hidden rounded-2xl cursor-pointer group"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/virt'); }}
        >
          {/* 배경 */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#060d18] via-[#040b1d] to-[#060d18]" />
          <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[500px] h-[400px] bg-cyan-500/[0.04] rounded-full blur-[120px]" />
          <div className="absolute top-[5%] left-1/2 -translate-x-1/2 w-[250px] h-[300px] bg-blue-400/[0.03] rounded-full blur-[80px]" />
          <div className="absolute inset-0 rounded-2xl border border-white/[0.06] group-hover:border-cyan-500/20 transition-colors duration-500" />
          {/* 파티클 */}
          <div className="absolute top-[12%] left-[8%] w-1 h-1 bg-cyan-400/25 rounded-full animate-pulse" />
          <div className="absolute top-[25%] right-[10%] w-1 h-1 bg-cyan-300/15 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />

          <div className="relative z-10 px-8 md:px-12 py-10 md:py-14 text-center">
            {/* 로고 — 중앙 대형 */}
            <div className="relative w-[360px] h-[360px] md:w-[480px] md:h-[480px] mx-auto -mb-10">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-3/4 h-3/4 bg-cyan-500/[0.06] rounded-full blur-[50px] animate-pulse" style={{ animationDuration: '4s' }} />
              </div>
              <img
                src="/tail-sample-2.png"
                alt="Virt"
                className="relative w-full h-full object-contain"
                style={{ filter: 'drop-shadow(0 0 30px rgba(56, 189, 248, 0.18)) drop-shadow(0 0 60px rgba(56, 189, 248, 0.08))' }}
              />
            </div>

            {/* 타이틀 */}
            <h3 className="text-3xl md:text-4xl font-bold tracking-tighter mb-2">
              <span className="text-slate-500">WHALEARC</span>
              <span className="text-slate-700 mx-0.5">/</span>
              <span className="text-white">VIRT</span>
            </h3>
            <p className="text-slate-400 text-base mb-2">내 실제 자산을, 한 곳에서</p>
            <p className="text-sm text-slate-600 mb-6 max-w-md mx-auto">
              증권사와 거래소 API를 연동하면 흩어진 내 자산을 하나의 화면에서 확인할 수 있습니다
            </p>

            {/* 지원 거래소 */}
            <div className="flex items-center gap-2 justify-center mb-6">
              {['한국투자증권', '업비트', '비트겟'].map((name) => (
                <span key={name} className="text-[11px] text-slate-500 bg-white/[0.04] border border-white/[0.06] rounded-md px-3 py-1">{name}</span>
              ))}
            </div>

            <div className="inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-cyan-500/10 text-cyan-400 font-semibold text-sm border border-cyan-500/25 group-hover:bg-cyan-500/20 group-hover:border-cyan-400/40 transition-all duration-500">
              로그인하고 시작하기
              <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
