import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { userService, type UserTier, type UserRole, type TierLimits } from '../services/userService';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** 백엔드 DB에 저장된 닉네임 */
  profileName: string | null;
  /** 구독 등급 (null=아직 미확인) */
  tier: UserTier | null;
  /** 권한 (ADMIN=운영자) */
  role: UserRole | null;
  /** 유효 등급 기준 기능 한도 (null=아직 미확인). 무제한 값은 -1. */
  limits: TierLimits | null;
  /** 자동매매 접근 가능 여부 — BASIC 이상 또는 ADMIN */
  canAutoTrade: boolean;
  /** 온보딩(프로필 설정) 완료 여부 — null이면 아직 확인 전 */
  onboardingDone: boolean | null;
  /** 프로필 정보 새로고침 (저장 후 호출) */
  refreshProfile: () => Promise<void>;
  /** 온보딩 완료 처리 (저장 성공 후 즉시 호출) */
  markOnboardingDone: () => void;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  profileName: null,
  tier: null,
  role: null,
  limits: null,
  canAutoTrade: false,
  onboardingDone: null,
  refreshProfile: async () => {},
  markOnboardingDone: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [tier, setTier] = useState<UserTier | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [limits, setLimits] = useState<TierLimits | null>(null);
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  // 이미 프로필을 받은 유저 id — getSession/onAuthStateChange 진입 순서와 무관하게 정확히 1회만 조회.
  const lastFetchedUidRef = useRef<string | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      const profile = await userService.getProfile();
      setProfileName(profile?.name ?? null);
      setTier(profile?.tier ?? null);
      setRole(profile?.role ?? null);
      setLimits(profile?.limits ?? null);
      // 투자성향 저장 완료 OR 사용자가 명시적으로 '건너뛰기'한 경우(localStorage) 온보딩 완료로 간주.
      // (건너뛰기 후 새로고침 시 다시 온보딩으로 끌려가던 막다른 길 방지)
      let skipped = false;
      try { skipped = localStorage.getItem('whalearc_onboarding_skipped') === '1'; } catch { /* ignore */ }
      setOnboardingDone((profile ? !!profile.investmentStyle : false) || skipped);
    } catch {
      // 프로필 조회 실패 시 온보딩 완료로 간주 (로딩 무한루프 방지)
      setOnboardingDone(true);
    }
  }, []);

  const markOnboardingDone = useCallback(() => {
    setOnboardingDone(true);
  }, []);

  useEffect(() => {
    // 세션을 반영하고, '직전과 다른 유저' 또는 강제 조건일 때만 fetchProfile.
    // getSession()과 onAuthStateChange(INITIAL_SESSION 포함)가 같은 가드를 공유하므로
    // 어느 쪽이 먼저 풀리든 초기 세션의 프로필은 정확히 1회만 조회된다.
    const applySession = (session: Session | null, forceProfile = false) => {
      setSession(session);
      setUser(session?.user ?? null);
      const uid = session?.user?.id ?? null;
      if (!uid) {
        lastFetchedUidRef.current = null;
        setProfileName(null);
        setTier(null);
        setRole(null);
        setLimits(null);
        setOnboardingDone(null);
        return;
      }
      if (forceProfile || lastFetchedUidRef.current !== uid) {
        lastFetchedUidRef.current = uid;
        fetchProfile();
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoading(false);
      // 토큰 갱신은 같은 uid라도 tier/limits 최신화를 위해 강제 조회(기존 동작 유지).
      applySession(session, _event === 'TOKEN_REFRESHED');
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  // 자동매매 접근: BASIC 이상 또는 ADMIN. (결제 미연동 상태=전원 FREE라 사실상 ADMIN만 통과)
  const canAutoTrade = role === 'ADMIN' || tier === 'BASIC' || tier === 'PRO';

  return (
    <AuthContext.Provider value={{ session, user, loading, profileName, tier, role, limits, canAutoTrade, onboardingDone, refreshProfile: fetchProfile, markOnboardingDone }}>
      {children}
    </AuthContext.Provider>
  );
};
