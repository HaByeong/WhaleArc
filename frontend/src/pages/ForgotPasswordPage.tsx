import { useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import { authService } from '../services/authService';

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
    <div className="min-h-screen bg-gray-50">
      <Header showNav={false} />

      <div className="max-w-md mx-auto px-4 sm:px-6 py-12">
        <div className="card">
          {sent ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-whale-dark mb-2">이메일을 확인해주세요</h2>
              <p className="text-gray-500 text-sm mb-6">
                <span className="font-semibold text-whale-dark">{email}</span>로
                비밀번호 재설정 링크를 보냈습니다.
                <br />메일함을 확인해주세요.
              </p>
              <Link to="/login" className="btn-primary inline-block">
                로그인으로 돌아가기
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-whale-dark">비밀번호 찾기</h2>
                <p className="text-gray-400 text-sm mt-1">
                  가입한 이메일을 입력하면 비밀번호 재설정 링크를 보내드립니다
                </p>
              </div>

              <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                WhaleArc은 이메일이 곧 아이디입니다.
                가입한 이메일이 기억나지 않으시면 Google/카카오 소셜 로그인을 시도해보세요.
              </div>

              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm" role="alert">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
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
                    placeholder="가입한 이메일을 입력하세요"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isLoading}
                >
                  {isLoading ? '전송 중...' : '비밀번호 재설정 링크 보내기'}
                </button>
              </form>

              <p className="mt-4 text-center text-gray-600 text-sm">
                <Link to="/login" className="text-whale-light hover:underline font-semibold">
                  로그인으로 돌아가기
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
