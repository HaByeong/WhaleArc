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

  logout: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
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
