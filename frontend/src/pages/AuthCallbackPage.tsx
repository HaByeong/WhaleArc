import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthCallbackPage = () => {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');

        if (code) {
          // PKCE 플로우: authorization code를 세션으로 교환
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error('코드 교환 에러:', error.message);
            setError(error.message);
            setTimeout(() => window.location.replace('/login'), 2000);
            return;
          }
          // 전체 페이지 리로드로 AuthProvider가 새 세션을 인식하도록 함
          window.location.replace('/dashboard');
          return;
        }

        // implicit 플로우 폴백 (해시 프래그먼트)
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error('세션 복구 에러:', sessionError.message);
          setError(sessionError.message);
          setTimeout(() => window.location.replace('/login'), 2000);
          return;
        }

        if (data.session) {
          window.location.replace('/dashboard');
        } else {
          // 세션이 아직 없으면 onAuthStateChange로 대기
          const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
              subscription.unsubscribe();
              window.location.replace('/dashboard');
            }
          });

          // 5초 타임아웃
          setTimeout(() => {
            subscription.unsubscribe();
            window.location.replace('/login');
          }, 5000);
        }
      } catch (err) {
        console.error('OAuth 콜백 처리 실패:', err);
        window.location.replace('/login');
      }
    };

    handleCallback();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-whale-light border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-600">{error ? error : '바다로 입수 중...'}</p>
      </div>
    </div>
  );
};

export default AuthCallbackPage;
