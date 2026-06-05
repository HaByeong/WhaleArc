import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { validateNickname } from '../utils/nicknameFilter';

/* 회원가입 — 로그인 페이지와 동일한 레이아웃(다크 + 히어로 + 2열). 폼 로직은 보존. */

const DARK_INPUT = 'w-full px-4 py-3 rounded-lg bg-white/[0.04] border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40';
const DARK_CARD = 'rounded-xl border border-white/[0.06] bg-white/[0.02] p-6';

const FEATURES = [
  { title: '1,000만원 가상자금', desc: '리스크 없이 실전처럼 투자 연습', color: 'bg-blue-500/10 text-blue-400',
    icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
  { title: '주식 + 가상화폐 통합', desc: 'KRX 전종목과 빗썸 가상화폐를 한 포트폴리오에서', color: 'bg-emerald-500/10 text-emerald-400',
    icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg> },
  { title: '퀀트 전략 상점', desc: '터틀 트레이딩 등 검증된 알고리즘 자동매매', color: 'bg-purple-500/10 text-purple-400',
    icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg> },
  { title: '포트폴리오 분석', desc: '자산 추이, 수익률, CSV 리포트까지', color: 'bg-amber-500/10 text-amber-400',
    icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
];

const SignUpPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const nicknameCheck = validateNickname(name);
    if (!nicknameCheck.valid) { setError(nicknameCheck.message); return; }

    const trimmedEmail = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) { setError('올바른 이메일 형식을 입력해주세요.'); return; }
    if (password !== confirmPassword) { setError('비밀번호가 일치하지 않습니다.'); return; }
    if (password.length < 6) { setError('비밀번호는 6자 이상이어야 합니다.'); return; }

    setIsLoading(true);
    try {
      const { user } = await authService.signUp(email, password, name);
      if (user?.identities?.length === 0) {
        setError('이미 가입된 이메일입니다.');
      } else {
        navigate('/login', { state: { message: '새로운 고래가 바다에 합류했습니다! 이메일을 확인해주세요.' } });
      }
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('rate limit')) setError('이메일 발송 한도를 초과했습니다. 잠시 후 다시 시도해주세요.');
      else setError(msg || '합류에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthLogin = async (provider: 'google') => {
    try {
      await authService.loginWithOAuth(provider);
    } catch (err: any) {
      setError(err.message || `${provider} 로그인에 실패했습니다.`);
    }
  };

  return (
    <div className="wa-force-dark min-h-screen bg-[#060d18] text-white">
      {/* 상단 히어로 배너 (로그인과 동일) */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#060d18] via-[#040b1d] to-[#060d18]" />
        <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[500px] h-[400px] bg-cyan-500/[0.04] rounded-full blur-[120px]" />
        <div className="absolute top-[5%] left-1/2 -translate-x-1/2 w-[250px] h-[300px] bg-blue-400/[0.03] rounded-full blur-[80px]" />
        <div className="relative z-10 px-8 md:px-12 py-10 md:py-14 text-center max-w-4xl mx-auto">
          <div className="relative w-[280px] h-[280px] md:w-[380px] md:h-[380px] mx-auto -mb-8">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-3/4 h-3/4 bg-cyan-500/[0.06] rounded-full blur-[50px] animate-pulse" style={{ animationDuration: '4s' }} />
            </div>
            <img src="/tail-sample-2.png" alt="" className="relative w-full h-full object-contain"
              style={{ filter: 'drop-shadow(0 0 30px rgba(91, 157, 255, 0.18)) drop-shadow(0 0 60px rgba(91, 157, 255, 0.08))' }} />
          </div>
          <h3 className="whalearc-text text-3xl md:text-4xl font-bold tracking-tighter mb-2">WHALEARC</h3>
          <p className="text-slate-300 text-base mb-2">새로운 항해를 시작하세요</p>
          <p className="text-sm text-slate-400 mb-5 max-w-md mx-auto">
            가상자금 1,000만원으로 리스크 없이 — 주식·코인 매매와 퀀트 전략을 경험해보세요
          </p>
          <div className="flex items-center gap-2 justify-center">
            {['한국투자증권', '업비트', '비트겟'].map((n) => (
              <span key={n} className="text-[11px] text-slate-500 bg-white/[0.04] border border-white/[0.06] rounded-md px-3 py-1">{n}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 회원가입 폼 */}
          <div className={DARK_CARD}>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white">새로운 항해를 시작하세요</h2>
              <p className="text-sm mt-1 text-slate-400">WhaleArc과 함께 투자의 바다로</p>
            </div>

            {/* OAuth */}
            <div className="space-y-3 mb-6">
              <button type="button" onClick={() => handleOAuthLogin('google')}
                className="w-full flex items-center justify-center space-x-3 px-4 py-3 rounded-lg transition-colors border border-white/10 bg-white/[0.04] hover:bg-white/[0.06]">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                <span className="font-medium text-slate-300">Google로 시작하기</span>
              </button>
            </div>

            {/* 구분선 */}
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/[0.06]" /></div>
              <div className="relative flex justify-center text-sm"><span className="px-4 bg-[#060d18] text-slate-500">또는 이메일로 가입</span></div>
            </div>

            {error && <div className="mb-6 rounded-lg p-4 text-sm bg-red-500/10 border border-red-500/20 text-red-400" role="alert" aria-live="polite">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-2 text-slate-300">이메일 *</label>
                <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} className={DARK_INPUT} placeholder="email@example.com" required />
              </div>
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-2 text-slate-300">닉네임 *</label>
                <input type="text" id="name" value={name} onChange={(e) => setName(e.target.value)} className={DARK_INPUT} placeholder="랭킹에 표시될 닉네임을 입력하세요" required />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-2 text-slate-300">비밀번호 *</label>
                <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} className={DARK_INPUT} placeholder="비밀번호를 입력하세요 (6자 이상)" required />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2 text-slate-300">비밀번호 확인 *</label>
                <input type="password" id="confirmPassword" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={DARK_INPUT} placeholder="비밀번호를 다시 입력하세요" required />
              </div>

              <label className="flex items-start space-x-2 mt-2 cursor-pointer">
                <input type="checkbox" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} className="mt-1 h-4 w-4 rounded border-white/20 bg-white/[0.04] text-cyan-500 focus:ring-cyan-500/40" />
                <span className="text-sm text-slate-400">
                  <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline font-medium">이용약관</a>
                  {' '}및{' '}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline font-medium">개인정보처리방침</a>
                  에 동의합니다.
                </span>
              </label>

              <button type="submit" className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed" disabled={isLoading || !agreedToTerms}>
                {isLoading ? '회원가입 중...' : '회원가입'}
              </button>
            </form>

            <p className="mt-4 text-center text-slate-400">
              이미 계정이 있으신가요?{' '}
              <Link to="/login" className="font-semibold hover:underline text-cyan-400">로그인</Link>
            </p>
          </div>

          {/* 우측 — Why WhaleArc + 기능 */}
          <div className="space-y-6">
            <div className={`${DARK_CARD} border-l-4 border-l-cyan-500/40`}>
              <p className="text-xs font-semibold tracking-widest uppercase mb-3 text-cyan-400">Why WhaleArc</p>
              <h3 className="text-lg font-bold mb-4 text-white">투자, 누구에게나 열려 있어야 하니까.</h3>
              <div className="space-y-2.5 text-sm leading-relaxed text-slate-400">
                <p>높은 진입장벽과 실패에 대한 두려움이 첫 걸음을 망설이게 만듭니다.</p>
                <p>WhaleArc는 복잡한 설치 없이, <span className="font-semibold text-white">웹 접속만으로 실시간 시세와 함께 나만의 포트폴리오를 구성</span>하고 리스크 없이 투자를 경험할 수 있는 공간입니다.</p>
              </div>
              <p className="mt-4 text-xs text-slate-600">당신의 첫 항해, WhaleArc가 함께합니다.</p>
            </div>

            <div className={DARK_CARD}>
              <h3 className="text-lg font-semibold mb-5 text-white">WhaleArc에서 할 수 있는 것들</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {FEATURES.map((f, i) => (
                  <div key={i} className="flex items-start space-x-3 p-3 rounded-xl transition-colors hover:bg-white/[0.03]">
                    <div className={`p-2.5 rounded-xl flex-shrink-0 ${f.color}`}>{f.icon}</div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-white">{f.title}</div>
                      <div className="text-xs mt-0.5 leading-relaxed text-slate-500">{f.desc}</div>
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

export default SignUpPage;
