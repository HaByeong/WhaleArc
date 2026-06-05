import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { AuthShell, AuthBrand, AuthPanel, PrimaryButton, AuthAlert, AUTH_INPUT, AUTH_LABEL } from '../components/auth/AuthShell';

/* 새 비밀번호 설정 — 로그인/회원가입과 동일한 콘솔 디자인. 로직 보존. */

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setIsLoading(true);
    try {
      await authService.updatePassword(password);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: any) {
      setError(err.message || '비밀번호 변경에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell>
      <AuthBrand />
      <div className="mx-auto max-w-md px-4 pb-16 sm:px-6">
        <AuthPanel>
          {success ? (
            <div className="py-4 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10">
                <svg className="h-8 w-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="mb-2 text-xl font-bold text-white">비밀번호가 변경되었습니다</h2>
              <p className="text-sm text-white/55">잠시 후 로그인 페이지로 이동합니다...</p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-white">새 비밀번호 설정</h2>
                <p className="mt-1 text-sm text-white/50">새로운 비밀번호를 입력해주세요</p>
              </div>

              {error && <AuthAlert tone="error" className="mb-4">{error}</AuthAlert>}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="password" className={AUTH_LABEL}>새 비밀번호</label>
                  <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    className={AUTH_INPUT} placeholder="6자 이상" required />
                </div>
                <div>
                  <label htmlFor="confirmPassword" className={AUTH_LABEL}>새 비밀번호 확인</label>
                  <input type="password" id="confirmPassword" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    className={AUTH_INPUT} placeholder="비밀번호를 다시 입력하세요" required />
                </div>
                <PrimaryButton disabled={isLoading}>
                  {isLoading ? '변경 중...' : '비밀번호 변경'}
                </PrimaryButton>
              </form>
            </>
          )}
        </AuthPanel>
      </div>
    </AuthShell>
  );
};

export default ResetPasswordPage;
