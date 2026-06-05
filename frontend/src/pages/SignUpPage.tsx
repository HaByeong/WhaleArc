import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { validateNickname } from '../utils/nicknameFilter';
import {
  AuthShell, AuthHero, AuthPanel, AuthCard, PrimaryButton, GoogleButton,
  AuthDivider, AuthAlert, AUTH_INPUT, AUTH_LABEL,
} from '../components/auth/AuthShell';

/* 회원가입 — 로그인과 동일한 콘솔 디자인(다크 + 글로우). 폼 로직은 보존. */

const FEATURES = [
  { title: '1,000만원 가상자금', desc: '리스크 없이 실전처럼 투자 연습', color: 'bg-[#5b9dff]/10 text-[#5b9dff] border border-[#5b9dff]/20',
    icon: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
  { title: '주식 + 가상화폐 통합', desc: 'KRX 전종목과 빗썸 가상화폐를 한 포트폴리오에서', color: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    icon: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg> },
  { title: '퀀트 전략 상점', desc: '터틀 트레이딩 등 검증된 알고리즘 자동매매', color: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
    icon: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg> },
  { title: '포트폴리오 분석', desc: '자산 추이, 수익률, CSV 리포트까지', color: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    icon: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
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
    <AuthShell>
      <AuthHero
        title="WHALEARC"
        subtitle="새로운 항해를 시작하세요"
        note="가상자금 1,000만원으로 리스크 없이 — 주식·코인 매매와 퀀트 전략을 경험해보세요"
        connectors={['한국투자증권', '업비트', '비트겟']}
      />

      <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* 회원가입 폼 */}
          <AuthPanel>
            <div className="mb-7">
              <h2 className="text-2xl font-bold text-white">새로운 항해를 시작하세요</h2>
              <p className="mt-1 text-sm text-white/50">WhaleArc과 함께 투자의 바다로</p>
            </div>

            <div className="mb-2">
              <GoogleButton onClick={() => handleOAuthLogin('google')} label="Google로 시작하기" />
            </div>

            <AuthDivider>또는 이메일로 가입</AuthDivider>

            {error && <AuthAlert tone="error" className="mb-6">{error}</AuthAlert>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className={AUTH_LABEL}>이메일 *</label>
                <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} className={AUTH_INPUT} placeholder="email@example.com" required />
              </div>
              <div>
                <label htmlFor="name" className={AUTH_LABEL}>닉네임 *</label>
                <input type="text" id="name" value={name} onChange={(e) => setName(e.target.value)} className={AUTH_INPUT} placeholder="랭킹에 표시될 닉네임을 입력하세요" required />
              </div>
              <div>
                <label htmlFor="password" className={AUTH_LABEL}>비밀번호 *</label>
                <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} className={AUTH_INPUT} placeholder="비밀번호를 입력하세요 (6자 이상)" required />
              </div>
              <div>
                <label htmlFor="confirmPassword" className={AUTH_LABEL}>비밀번호 확인 *</label>
                <input type="password" id="confirmPassword" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={AUTH_INPUT} placeholder="비밀번호를 다시 입력하세요" required />
              </div>

              <label className="mt-2 flex cursor-pointer items-start gap-2">
                <input type="checkbox" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} className="mt-1 h-4 w-4 rounded border-white/20 bg-white/[0.04] text-[#2c6fe6] focus:ring-[#5b9dff]/40" />
                <span className="text-sm text-white/55">
                  <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-medium text-[#5b9dff] hover:underline">이용약관</a>
                  {' '}및{' '}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-medium text-[#5b9dff] hover:underline">개인정보처리방침</a>
                  에 동의합니다.
                </span>
              </label>

              <PrimaryButton disabled={isLoading || !agreedToTerms}>
                {isLoading ? '회원가입 중...' : '회원가입'}
              </PrimaryButton>
            </form>

            <p className="mt-5 text-center text-sm text-white/55">
              이미 계정이 있으신가요?{' '}
              <Link to="/login" className="font-semibold text-[#5b9dff] hover:underline">로그인</Link>
            </p>
          </AuthPanel>

          {/* 우측 — Why + 기능 */}
          <div className="space-y-6">
            <AuthCard className="border-l-4 border-l-[#2c6fe6]">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#9cc1ff]">Why WhaleArc</p>
              <h3 className="mb-4 text-lg font-bold text-white">투자, 누구에게나 열려 있어야 하니까.</h3>
              <div className="space-y-2.5 text-sm leading-relaxed text-white/55">
                <p>높은 진입장벽과 실패에 대한 두려움이 첫 걸음을 망설이게 만듭니다.</p>
                <p>WhaleArc는 복잡한 설치 없이, <span className="font-semibold text-white">웹 접속만으로 실시간 시세와 함께 나만의 포트폴리오를 구성</span>하고 리스크 없이 투자를 경험할 수 있는 공간입니다.</p>
              </div>
              <p className="mt-4 text-xs text-white/35">당신의 첫 항해, WhaleArc가 함께합니다.</p>
            </AuthCard>

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

export default SignUpPage;
