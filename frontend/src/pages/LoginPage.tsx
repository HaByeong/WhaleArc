import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Header from '../components/Header';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { authService } from '../services/authService';

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
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // 리다이렉트로 인한 메시지 표시
  useEffect(() => {
    const state = location.state as { message?: string; from?: string } | null;
    if (state?.message) {
      setInfoMessage(state.message);
      // 5초 후 메시지 자동 제거
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
      await authService.login({ userId, password });
      // 리다이렉트된 경우 원래 페이지로, 아니면 대시보드로
      const state = location.state as { from?: string } | null;
      const redirectTo = state?.from || '/dashboard';
      navigate(redirectTo, { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.message || '로그인에 실패했습니다. 아이디와 비밀번호를 확인해주세요.');
      console.error('Login failed:', err);
    } finally {
      setIsLoading(false);
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
            
            {/* 데모 계정 안내 */}
            <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-whale-light/10 border border-whale-light/20 rounded-lg">
              <div className="flex items-start space-x-3">
                <div className="text-2xl">💡</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-whale-dark mb-2">데모 계정으로 체험하기</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-700">아이디:</span>
                      <code className="px-2 py-1 bg-white rounded border border-gray-200 text-whale-dark font-mono">demo</code>
                      <button
                        type="button"
                        onClick={() => {
                          setUserId('demo');
                          setPassword('demo123');
                        }}
                        className="text-whale-light hover:text-whale-dark text-xs underline"
                        aria-label="데모 계정 정보 입력"
                      >
                        입력
                      </button>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-700">비밀번호:</span>
                      <code className="px-2 py-1 bg-white rounded border border-gray-200 text-whale-dark font-mono">demo123</code>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    백엔드 구현 전까지 데모 데이터로 체험할 수 있습니다
                  </p>
                </div>
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
                <label htmlFor="userId" className="block text-sm font-medium text-gray-700 mb-2">
                  아이디
                </label>
                <input
                  type="text"
                  id="userId"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="input-field"
                  placeholder="아이디를 입력하세요"
                  required
                  aria-required="true"
                  aria-describedby={error ? "login-error" : undefined}
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field"
                  placeholder="••••••••"
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

