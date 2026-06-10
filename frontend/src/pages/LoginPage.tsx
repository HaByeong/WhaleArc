import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../utils/api';
import {
  AuthShell, AuthHero, AuthPanel, AuthCard, PrimaryButton, GoogleButton,
  AuthDivider, AuthAlert, AUTH_INPUT, AUTH_LABEL,
} from '../components/auth/AuthShell';

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

const FEATURES = [
  {
    title: '1,000만원 가상자금',
    desc: '리스크 없이 실전처럼 투자 연습',
    color: 'bg-[#5b9dff]/10 text-[#5b9dff] border border-[#5b9dff]/20',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: '주식 + 가상화폐 통합',
    desc: 'KRX 전종목과 빗썸 가상화폐를 한 포트폴리오에서',
    color: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
  {
    title: '퀀트 전략 상점',
    desc: '터틀 트레이딩 등 검증된 알고리즘 자동매매',
    color: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    title: '포트폴리오 분석',
    desc: '자산 추이, 수익률, CSV 리포트까지',
    color: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
];

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

  return (
    <AuthShell>
      <AuthHero
        badge={isVirtLogin ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#5b9dff]/30 bg-[#5b9dff]/10 px-3 py-1 text-[11px] font-bold tracking-wide text-[#bcd6ff]">
            VIRT · 가상 모의투자
          </span>
        ) : undefined}
        title="WHALEARC"
        subtitle={isVirtLogin ? '가상 모의투자로 주식·코인 매매를 체험해보세요' : '내 실제 자산을, 한 곳에서'}
        note={isVirtLogin
          ? '가상자금 1,000만원으로 리스크 없이 — 전략을 자유롭게 실험하세요'
          : '증권사와 거래소 API를 연동하면 흩어진 내 자산을 하나의 화면에서 확인할 수 있습니다'}
        connectors={isVirtLogin ? undefined : ['한국투자증권', '업비트', '비트겟']}
      />

      <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* 로그인 폼 */}
          <AuthPanel>
            <div className="mb-7">
              <h2 className="text-2xl font-bold text-white">
                {isVirtLogin ? 'Virt에 오신 것을 환영해요' : '다시 만나서 반가워요'}
              </h2>
              <p className="mt-1 text-sm text-white/50">
                {isVirtLogin ? '로그인하고 모의투자를 시작하세요' : '계정에 로그인하고 항해를 이어가세요'}
              </p>
            </div>

            {/* 인앱 브라우저 경고 */}
            {isInApp && (
              <AuthAlert tone="info" className="mb-4">
                <div className="mb-1 font-semibold">외부 브라우저에서 열어주세요</div>
                <p>현재 인앱 브라우저(네이버, 카카오톡 등)에서는 Google 로그인이 제한됩니다.</p>
                <p className="mt-1">우측 상단 <strong>⋮</strong> 메뉴 → <strong>"기본 브라우저로 열기"</strong>를 눌러주세요.</p>
              </AuthAlert>
            )}

            {/* OAuth 로그인 */}
            <div className="mb-2">
              <GoogleButton
                onClick={() => handleOAuthLogin('google')}
                disabled={!!oauthLoading}
                label={oauthLoading === 'google' ? '연결 중...' : 'Google로 로그인'}
              />
            </div>

            <AuthDivider>또는 이메일로 로그인</AuthDivider>

            <form onSubmit={handleLogin} className="space-y-4" aria-label="로그인 폼">
              {infoMessage && (
                <AuthAlert tone="info">
                  <div className="flex items-start gap-2">
                    <svg className="mt-0.5 h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1">
                      <div className="mb-1 font-semibold">알림</div>
                      <div>{infoMessage}</div>
                    </div>
                    <button type="button" onClick={() => setInfoMessage(null)} className="flex-shrink-0 text-[#bcd6ff] hover:text-white" aria-label="메시지 닫기">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </AuthAlert>
              )}

              <div>
                <label htmlFor="email" className={AUTH_LABEL}>이메일</label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={AUTH_INPUT}
                  placeholder="email@example.com"
                  required
                  aria-required="true"
                  aria-describedby={error ? 'login-error' : undefined}
                />
              </div>
              <div>
                <label htmlFor="password" className={AUTH_LABEL}>비밀번호</label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={AUTH_INPUT}
                  placeholder="6자 이상"
                  required
                  aria-required="true"
                  aria-describedby={error ? 'login-error' : undefined}
                />
              </div>
              {error && <AuthAlert tone="error"><span id="login-error">{error}</span></AuthAlert>}
              <PrimaryButton disabled={isLoading}>
                {isLoading ? '로그인 중...' : '로그인'}
              </PrimaryButton>
            </form>

            <div className="mt-5 space-y-2 text-center">
              <p className="text-sm text-white/55">
                계정이 없으신가요?{' '}
                <Link to="/signup" className="font-semibold text-[#5b9dff] hover:underline">회원가입</Link>
              </p>
              <p>
                <Link to="/forgot-password" className="text-sm text-white/45 transition-colors hover:text-[#5b9dff]">
                  비밀번호를 잊으셨나요?
                </Link>
              </p>
            </div>
          </AuthPanel>

          {/* 우측 — 실시간 지수 + Why + 기능 */}
          <div className="space-y-6">
            {indices.length > 0 && (() => {
              const marketIndices = indices.filter(i => i.code !== 'USDT/KRW');
              const usdtIndex = indices.find(i => i.code === 'USDT/KRW');
              return (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    {marketIndices.map((idx) => {
                      const isUp = idx.change >= 0;
                      return (
                        <div key={idx.code} className={`rounded-2xl p-4 sm:p-5 border ${isUp ? 'bg-[#ef4d4d]/10 border-[#ef4d4d]/15' : 'bg-[#4d8aff]/10 border-[#4d8aff]/15'}`}>
                          <div className="mb-2 flex items-center gap-1.5 sm:mb-3 sm:gap-2">
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold sm:px-2 sm:text-xs ${isUp ? 'bg-[#ef4d4d]/20 text-[#ff7a7a]' : 'bg-[#4d8aff]/20 text-[#8fb6ff]'}`}>
                              {idx.code}
                            </span>
                            <span className="text-xs font-medium text-white/45 sm:text-sm">{idx.name}</span>
                          </div>
                          <div className="text-xl font-bold text-white sm:text-2xl">
                            {idx.price.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className={`mt-1 flex items-center gap-1 text-xs font-semibold sm:text-sm ${isUp ? 'text-[#ff7a7a]' : 'text-[#8fb6ff]'}`}>
                            <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              {isUp
                                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />}
                            </svg>
                            <span>{Math.abs(idx.changeRate).toFixed(2)}%</span>
                            <span className="text-[10px] font-normal text-white/35 sm:text-xs">
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
                      <div className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300 sm:px-2 sm:text-xs">USDT</span>
                          <span className="text-xs font-medium text-white/45 sm:text-sm">테더 환율</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-base font-bold text-white sm:text-lg">
                            ₩{usdtIndex.price.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                          </span>
                          <span className={`text-xs font-semibold ${isUp ? 'text-[#ff7a7a]' : 'text-[#8fb6ff]'}`}>
                            {isUp ? '▲' : '▼'} {Math.abs(usdtIndex.changeRate).toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                  <p className="text-right text-[10px] text-white/30">
                    * 지수: KIS API 기준 (15~20초 지연) · 환율: 업비트 실시간
                  </p>
                </div>
              );
            })()}

            {/* Why WhaleArc */}
            <AuthCard className="border-l-4 border-l-[#2c6fe6]">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#9cc1ff]">Why WhaleArc</p>
              <h3 className="mb-4 text-lg font-bold text-white">투자, 누구에게나 열려 있어야 하니까.</h3>
              <div className="space-y-2.5 text-sm leading-relaxed text-white/55">
                <p>높은 진입장벽과 실패에 대한 두려움이 첫 걸음을 망설이게 만듭니다.</p>
                <p>
                  WhaleArc는 복잡한 설치 없이,
                  <span className="font-semibold text-white"> 웹 접속만으로 실시간 시세와 함께 나만의 포트폴리오를 구성</span>하고
                  리스크 없이 투자를 경험할 수 있는 공간입니다.
                </p>
              </div>
              <p className="mt-4 text-xs text-white/35">당신의 첫 항해, WhaleArc가 함께합니다.</p>
            </AuthCard>

            {/* 기능 소개 */}
            <AuthCard>
              <h3 className="mb-5 text-lg font-semibold text-white">WhaleArc에서 할 수 있는 것들</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {FEATURES.map((f, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-white/[0.03]">
                    <div className={`flex-shrink-0 rounded-xl p-2.5 ${f.color}`}>{f.icon}</div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white">{f.title}</div>
                      <div className="mt-0.5 text-xs leading-relaxed text-white/45">{f.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </AuthCard>
          </div>
        </div>
      </div>
    </AuthShell>
  );
};

export default LoginPage;
