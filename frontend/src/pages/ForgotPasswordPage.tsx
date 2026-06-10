import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../services/authService';
import { AuthShell, AuthBrand, AuthPanel, PrimaryButton, AuthAlert, AUTH_INPUT, AUTH_LABEL } from '../components/auth/AuthShell';

/* 비밀번호 찾기 — 로그인/회원가입과 동일한 콘솔 디자인. 로직 보존. */

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await authService.resetPassword(email);
      setSent(true);
    } catch (err: any) {
      setError(err.message || '비밀번호 재설정 이메일 전송에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell>
      <AuthBrand />
      <div className="mx-auto max-w-md px-4 pb-16 sm:px-6">
        <AuthPanel>
          {sent ? (
            <div className="py-4 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10">
                <svg className="h-8 w-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="mb-2 text-xl font-bold text-white">이메일을 확인해주세요</h2>
              <p className="mb-6 text-sm text-white/55">
                <span className="font-semibold text-white">{email}</span>로 비밀번호 재설정 링크를 보냈습니다.
                <br />메일함을 확인해주세요.
              </p>
              <Link to="/login">
                <PrimaryButton type="button">로그인으로 돌아가기</PrimaryButton>
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-white">비밀번호 찾기</h2>
                <p className="mt-1 text-sm text-white/50">
                  가입한 이메일을 입력하면 비밀번호 재설정 링크를 보내드립니다
                </p>
              </div>

              <AuthAlert tone="info" className="mb-6">
                WhaleArc은 이메일이 곧 아이디입니다. 가입한 이메일이 기억나지 않으시면 Google 소셜 로그인을 시도해보세요.
              </AuthAlert>

              {error && <AuthAlert tone="error" className="mb-4">{error}</AuthAlert>}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className={AUTH_LABEL}>이메일</label>
                  <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    className={AUTH_INPUT} placeholder="가입한 이메일을 입력하세요" required />
                </div>
                <PrimaryButton disabled={isLoading}>
                  {isLoading ? '전송 중...' : '비밀번호 재설정 링크 보내기'}
                </PrimaryButton>
              </form>

              <p className="mt-5 text-center text-sm">
                <Link to="/login" className="font-semibold text-[#5b9dff] hover:underline">로그인으로 돌아가기</Link>
              </p>
            </>
          )}
        </AuthPanel>
      </div>
    </AuthShell>
  );
};

export default ForgotPasswordPage;
