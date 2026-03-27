import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { userService } from '../services/userService';

const AuthCallbackPage = () => {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const redirectWithOnboardingCheck = async () => {
      const savedRedirect = localStorage.getItem('whalearc_redirect') || '/dashboard';
      localStorage.removeItem('whalearc_redirect');
      try {
        const profile = await userService.getProfile();
        if (profile && !profile.investmentStyle) {
          const onboardingUrl = savedRedirect.startsWith('/virt')
            ? `/user?onboarding=true&from=${encodeURIComponent(savedRedirect)}`
            : '/user?onboarding=true';
          window.location.replace(onboardingUrl);
          return;
        }
      } catch {
        // 프로필 조회 실패 시 폴백
      }
      window.location.replace(savedRedirect);
    };

    const handleCallback = async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');
        const errorParam = url.searchParams.get('error');
        const errorDescription = url.searchParams.get('error_description');

        // OAuth 에러 파라미터가 URL에 있는 경우 (사용자가 동의 취소 등)
        if (errorParam) {
          const msg = errorDescription === 'The user denied the authorization request'
            ? '로그인이 취소되었습니다.'
            : errorDescription || '로그인 중 문제가 발생했습니다.';
          setError(msg);
          setTimeout(() => window.location.replace('/login'), 3000);
          return;
        }

        if (code) {
          // PKCE 플로우: authorization code를 세션으로 교환
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            setError('로그인 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
            setTimeout(() => window.location.replace('/login'), 3000);
            return;
          }
          await redirectWithOnboardingCheck();
          return;
        }

        // implicit 플로우 폴백 (해시 프래그먼트)
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          setError('세션 확인 중 오류가 발생했습니다. 다시 로그인해주세요.');
          setTimeout(() => window.location.replace('/login'), 3000);
          return;
        }

        if (data.session) {
          await redirectWithOnboardingCheck();
        } else {
          // 세션이 아직 없으면 onAuthStateChange로 대기
          const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) {
              subscription.unsubscribe();
              await redirectWithOnboardingCheck();
            }
          });

          // 10초 타임아웃
          setTimeout(() => {
            subscription.unsubscribe();
            setError('로그인 응답이 지연되고 있습니다. 다시 시도해주세요.');
            setTimeout(() => window.location.replace('/login'), 2000);
          }, 10000);
        }
      } catch {
        setError('로그인 처리 중 예기치 않은 오류가 발생했습니다.');
        setTimeout(() => window.location.replace('/login'), 3000);
      }
    };

    handleCallback();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        {error ? (
          <>
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-red-600 font-medium mb-1">{error}</p>
            <p className="text-gray-400 text-sm">잠시 후 로그인 페이지로 이동합니다...</p>
          </>
        ) : (
          <>
            <div className="w-12 h-12 border-4 border-whale-light border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">바다로 입수 중...</p>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallbackPage;
