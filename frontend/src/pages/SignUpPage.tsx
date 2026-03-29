import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { authService } from '../services/authService';
import { validateNickname } from '../utils/nicknameFilter';

const SignUpPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const nicknameCheck = validateNickname(name);
    if (!nicknameCheck.valid) {
      setError(nicknameCheck.message);
      return;
    }

    // 이메일 형식 검증 강화
    const trimmedEmail = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      setError('올바른 이메일 형식을 입력해주세요.');
      return;
    }

    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.');
      return;
    }

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
      if (msg.toLowerCase().includes('rate limit')) {
        setError('이메일 발송 한도를 초과했습니다. 잠시 후 다시 시도해주세요.');
      } else {
        setError(msg || '합류에 실패했습니다. 다시 시도해주세요.');
      }
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
    <div className="min-h-screen bg-gray-50">
      <Header showNav={false} />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="card">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold text-whale-dark">새로운 항해를 시작하세요</h2>
            <p className="text-gray-400 text-sm mt-1">WhaleArc과 함께 투자의 바다로</p>
          </div>

          {/* OAuth 버튼 */}
          <div className="space-y-3 mb-6">
            <button
              type="button"
              onClick={() => handleOAuthLogin('google')}
              className="w-full flex items-center justify-center space-x-3 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span className="font-medium text-gray-700">Google로 시작하기</span>
            </button>

          </div>

          {/* 구분선 */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-4 text-gray-500">또는 이메일로 가입</span>
            </div>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  이메일 *
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  placeholder="email@example.com"
                  required
                />
              </div>

              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  닉네임 *
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field"
                  placeholder="랭킹에 표시될 닉네임을 입력하세요"
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  비밀번호 *
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field"
                  placeholder="비밀번호를 입력하세요 (6자 이상)"
                  required
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  비밀번호 확인 *
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input-field"
                  placeholder="비밀번호를 다시 입력하세요"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed mt-6"
              disabled={isLoading}
            >
              {isLoading ? '회원가입 중...' : '회원가입'}
            </button>
          </form>

          <p className="mt-6 text-center text-gray-600">
            이미 계정이 있으신가요?{' '}
            <Link to="/login" className="text-whale-light hover:underline font-semibold">
              로그인
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignUpPage;
