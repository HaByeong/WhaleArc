import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { userService } from '../services/userService';

const AuthCallbackPage = () => {
  const [error, setError] = useState<string | null>(null);
  const [needsConsent, setNeedsConsent] = useState(false); // 약관 미동의 OAuth 유저 게이트
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);

  const redirectWithOnboardingCheck = async () => {
    const savedRedirect = localStorage.getItem('whalearc_redirect') || '/dashboard';
    localStorage.removeItem('whalearc_redirect');
    try {
      // 온보딩 체크는 비핵심 — 백엔드가 느려도 로그인 진입을 막지 않도록 4초 레이스.
      // (타임아웃 시 null → 그냥 목적지로 진입, "바다로 입수 중..." 장시간 멈춤 방지)
      const profile = await Promise.race([
        userService.getProfile(),
        new Promise<null>(resolve => setTimeout(() => resolve(null), 4000)),
      ]);
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

  // OAuth 로그인/가입은 자동가입되므로, 약관 동의 기록이 없으면 진입 전 동의 게이트를 띄운다(근본책).
  const gateThenRedirect = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && !user.user_metadata?.terms_agreed) {
        setNeedsConsent(true); // 스피너 멈추고 동의 게이트 노출
        return;
      }
    } catch {
      // 조회 실패 시에도 동의 게이트로(안전측)
      setNeedsConsent(true);
      return;
    }
    await redirectWithOnboardingCheck();
  };

  const agreeAndContinue = async () => {
    if (!agreed || saving) return;
    setSaving(true);
    try {
      await supabase.auth.updateUser({ data: { terms_agreed: true, terms_agreed_at: new Date().toISOString() } });
    } catch {
      // 메타데이터 저장 실패해도 진행은 막지 않음(다음 로그인에 재요청)
    }
    await redirectWithOnboardingCheck();
  };

  const declineAndLogout = async () => {
    try { await supabase.auth.signOut(); } catch { /* ignore */ }
    window.location.replace('/login');
  };

  useEffect(() => {
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
          await gateThenRedirect();
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
          await gateThenRedirect();
        } else {
          // 세션이 아직 없으면 onAuthStateChange로 대기
          const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) {
              subscription.unsubscribe();
              try {
                await gateThenRedirect();
              } catch {
                setError('로그인 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
                setTimeout(() => window.location.replace('/login'), 3000);
              }
            }
          });

          // 30초 타임아웃 (모바일 네트워크 고려)
          setTimeout(() => {
            subscription.unsubscribe();
            setError('로그인 응답이 지연되고 있습니다. 다시 시도해주세요.');
            setTimeout(() => window.location.replace('/login'), 2000);
          }, 30000);
        }
      } catch {
        setError('로그인 처리 중 예기치 않은 오류가 발생했습니다.');
        setTimeout(() => window.location.replace('/login'), 3000);
      }
    };

    handleCallback();
  }, []);

  return (
    <div className="wa-force-dark min-h-screen flex items-center justify-center bg-[#060d18] text-white relative overflow-hidden px-6">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] bg-cyan-500/[0.05] rounded-full blur-[120px]" />
      <div className="relative text-center">
        {needsConsent ? (
          <div className="w-[min(420px,90vw)] rounded-2xl border border-white/10 bg-white/[0.03] p-7 text-left">
            <h2 className="text-lg font-bold text-white">약관 동의가 필요해요</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-400">WhaleArc를 이용하려면 이용약관과 개인정보 처리방침에 동의해야 합니다.</p>
            <label className="mt-5 flex cursor-pointer items-start gap-2.5">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-white/20 bg-white/[0.04] text-[#2c6fe6] focus:ring-[#5b9dff]/40" />
              <span className="text-[13px] text-slate-300">
                <a href="/terms" target="_blank" rel="noreferrer" className="text-cyan-400 underline">이용약관</a> 및 <a href="/privacy" target="_blank" rel="noreferrer" className="text-cyan-400 underline">개인정보 처리방침</a>에 동의합니다.
              </span>
            </label>
            <button onClick={agreeAndContinue} disabled={!agreed || saving} className="mt-5 w-full rounded-xl py-2.5 text-sm font-bold text-white transition-opacity disabled:opacity-50" style={{ background: 'linear-gradient(180deg,#4d8aff,#2c6fe6)' }}>
              {saving ? '처리 중...' : '동의하고 시작'}
            </button>
            <button onClick={declineAndLogout} className="mt-2 w-full text-[12px] text-slate-500 transition-colors hover:text-slate-300">동의하지 않고 나가기</button>
          </div>
        ) : error ? (
          <>
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-red-400 font-medium mb-1">{error}</p>
            <p className="text-slate-500 text-sm">잠시 후 로그인 페이지로 이동합니다...</p>
          </>
        ) : (
          <>
            <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-400">바다로 입수 중...</p>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallbackPage;
