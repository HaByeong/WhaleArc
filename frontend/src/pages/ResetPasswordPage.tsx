import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';

/* 새 비밀번호 설정 — 로그인/회원가입과 동일한 다크 톤. 로직 보존. */

const DARK_INPUT = 'w-full px-4 py-3 rounded-lg bg-white/[0.04] border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40';

const AuthBrand = () => (
  <div className="relative overflow-hidden pt-12 pb-6 text-center">
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[360px] h-[200px] bg-cyan-500/[0.05] rounded-full blur-[100px]" />
    <Link to="/" className="relative inline-flex items-center gap-2">
      <img src="/tail-sample-2.png" alt="" className="w-9 h-9 object-contain"
        style={{ filter: 'drop-shadow(0 0 12px rgba(91,157,255,0.35))' }} />
      <span className="whalearc-text text-xl font-bold tracking-tighter">WHALEARC</span>
    </Link>
  </div>
);

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
    <div className="wa-force-dark min-h-screen bg-[#060d18] text-white">
      <AuthBrand />
      <div className="max-w-md mx-auto px-4 sm:px-6 pb-16">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
          {success ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">비밀번호가 변경되었습니다</h2>
              <p className="text-slate-400 text-sm">잠시 후 로그인 페이지로 이동합니다...</p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-white">새 비밀번호 설정</h2>
                <p className="text-slate-400 text-sm mt-1">새로운 비밀번호를 입력해주세요</p>
              </div>

              {error && (
                <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm" role="alert">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">새 비밀번호</label>
                  <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    className={DARK_INPUT} placeholder="6자 이상" required />
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300 mb-2">새 비밀번호 확인</label>
                  <input type="password" id="confirmPassword" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    className={DARK_INPUT} placeholder="비밀번호를 다시 입력하세요" required />
                </div>
                <button type="submit" className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed" disabled={isLoading}>
                  {isLoading ? '변경 중...' : '비밀번호 변경'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
