import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../services/authService';

/* 비밀번호 찾기 — 로그인/회원가입과 동일한 다크 톤. 로직 보존. */

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
    <div className="wa-force-dark min-h-screen bg-[#060d18] text-white">
      <AuthBrand />
      <div className="max-w-md mx-auto px-4 sm:px-6 pb-16">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
          {sent ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">이메일을 확인해주세요</h2>
              <p className="text-slate-400 text-sm mb-6">
                <span className="font-semibold text-white">{email}</span>로
                비밀번호 재설정 링크를 보냈습니다.
                <br />메일함을 확인해주세요.
              </p>
              <Link to="/login" className="btn-primary inline-block">로그인으로 돌아가기</Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-white">비밀번호 찾기</h2>
                <p className="text-slate-400 text-sm mt-1">
                  가입한 이메일을 입력하면 비밀번호 재설정 링크를 보내드립니다
                </p>
              </div>

              <div className="mb-6 bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 rounded-lg p-3 text-sm">
                WhaleArc은 이메일이 곧 아이디입니다.
                가입한 이메일이 기억나지 않으시면 Google 소셜 로그인을 시도해보세요.
              </div>

              {error && (
                <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm" role="alert">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">이메일</label>
                  <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    className={DARK_INPUT} placeholder="가입한 이메일을 입력하세요" required />
                </div>
                <button type="submit" className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed" disabled={isLoading}>
                  {isLoading ? '전송 중...' : '비밀번호 재설정 링크 보내기'}
                </button>
              </form>

              <p className="mt-4 text-center text-slate-400 text-sm">
                <Link to="/login" className="text-cyan-400 hover:underline font-semibold">로그인으로 돌아가기</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
