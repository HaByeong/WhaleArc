import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Header from '../components/Header';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { authService } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';

// 코스피 지수 차트 데이터
const kospiData = [
  { name: '09:00', value: 2650 },
  { name: '10:00', value: 2655 },
  { name: '11:00', value: 2660 },
  { name: '12:00', value: 2665 },
  { name: '13:00', value: 2670 },
];

// 코스닥 지수 차트 데이터
const kosdaqData = [
  { name: '09:00', value: 850 },
  { name: '10:00', value: 852 },
  { name: '11:00', value: 855 },
  { name: '12:00', value: 858 },
  { name: '13:00', value: 860 },
];

// 인기 종목 (한국 주식)
const popularStocks = [
  { symbol: '삼성전자', code: '005930', value: '75,000', change: '+1.20%', isPositive: true },
  { symbol: 'SK하이닉스', code: '000660', value: '145,000', change: '+2.50%', isPositive: true },
  { symbol: 'NAVER', code: '035420', value: '185,000', change: '-0.80%', isPositive: false },
  { symbol: '카카오', code: '035720', value: '52,000', change: '+0.50%', isPositive: true },
];

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
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
      setError(err.message || '로그인에 실패했습니다. 이메일과 비밀번호를 확인해주세요.');
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Header showNav={true} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Login Form */}
          <div className="card">
            <h2 className="text-3xl font-bold text-whale-dark mb-6">Log In</h2>

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
            <p className="mt-4 text-center text-gray-600">
              계정이 없으신가요?{' '}
              <Link to="/signup" className="text-whale-light hover:underline font-semibold">
                회원가입
              </Link>
            </p>
          </div>

          {/* Market Data */}
          <div className="space-y-6">
            {/* 코스피 지수 */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-whale-dark">코스피</h3>
                <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">KOSPI</span>
              </div>
              <div className="mb-4">
                <div className="text-3xl font-bold text-whale-dark mb-1">2,670.25</div>
                <div className="text-red-600 font-semibold">+0.75% (+19.80)</div>
              </div>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={kospiData}>
                    <XAxis dataKey="name" hide />
                    <YAxis hide />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#e53e3e"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 코스닥 지수 */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-whale-dark">코스닥</h3>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">KOSDAQ</span>
              </div>
              <div className="mb-4">
                <div className="text-3xl font-bold text-whale-dark mb-1">860.45</div>
                <div className="text-blue-600 font-semibold">+1.20% (+10.20)</div>
              </div>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={kosdaqData}>
                    <XAxis dataKey="name" hide />
                    <YAxis hide />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#3182ce"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 인기 종목 */}
            <div className="card">
              <h3 className="text-lg font-semibold text-whale-dark mb-4">인기 종목</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 text-sm font-medium text-gray-600">종목명</th>
                      <th className="text-left py-2 text-sm font-medium text-gray-600">코드</th>
                      <th className="text-right py-2 text-sm font-medium text-gray-600">현재가</th>
                      <th className="text-right py-2 text-sm font-medium text-gray-600">등락률</th>
                    </tr>
                  </thead>
                  <tbody>
                    {popularStocks.map((stock) => (
                      <tr key={stock.code} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 font-semibold text-whale-dark">{stock.symbol}</td>
                        <td className="py-3 text-gray-500 text-sm">{stock.code}</td>
                        <td className="py-3 text-right text-gray-700">{stock.value}원</td>
                        <td className={`py-3 text-right font-semibold ${stock.isPositive ? 'price-up' : 'price-down'}`}>
                          {stock.change}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
