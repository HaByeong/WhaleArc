import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { userService } from '../services/userService';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** 백엔드 DB에 저장된 닉네임 */
  profileName: string | null;
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
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      const profile = await userService.getProfile();
      setProfileName(profile?.name ?? null);
      setOnboardingDone(profile ? !!profile.investmentStyle : false);
    } catch {
      // 프로필 조회 실패 시 온보딩 완료로 간주 (로딩 무한루프 방지)
      setOnboardingDone(true);
    }
  }, []);

  const markOnboardingDone = useCallback(() => {
    setOnboardingDone(true);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session) fetchProfile();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session) {
        fetchProfile();
      } else {
        setProfileName(null);
        setOnboardingDone(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  return (
    <AuthContext.Provider value={{ session, user, loading, profileName, onboardingDone, refreshProfile: fetchProfile, markOnboardingDone }}>
      {children}
    </AuthContext.Provider>
  );
};
