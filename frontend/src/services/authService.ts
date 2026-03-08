import { supabase } from '../lib/supabase';
import type { Provider } from '@supabase/supabase-js';

export const authService = {
  login: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  signUp: async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) throw error;
    return data;
  },

  loginWithOAuth: async (provider: Provider) => {
    const options: Record<string, any> = {
      redirectTo: `${window.location.origin}/auth/callback`,
    };
    // 카카오는 비즈니스 앱이 아니면 이메일 스코프 사용 불가
    if (provider === 'kakao') {
      options.scopes = 'profile_nickname profile_image';
    }
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options,
    });
    if (error) throw error;
    return data;
  },

  resetPassword: async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  },

  updatePassword: async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  },

  logout: async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // 세션이 이미 만료/없는 경우 — 로컬 스토리지만 직접 정리
      const keys = Object.keys(localStorage).filter((k) => k.startsWith('sb-'));
      keys.forEach((k) => localStorage.removeItem(k));
    }
  },

  getSession: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  },

  getAccessToken: async () => {
    const session = await authService.getSession();
    return session?.access_token ?? null;
  },

  getCurrentUserId: () => {
    // Supabase 세션에서 동기적으로 가져올 수 없으므로 null 반환 후 비동기로 처리
    return null;
  },

  getCurrentUserIdAsync: async () => {
    const session = await authService.getSession();
    return session?.user?.id ?? null;
  },
};
