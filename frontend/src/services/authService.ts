import { supabase } from '../lib/supabase';
import type { Provider } from '@supabase/supabase-js';

// Supabase 에러 메시지 한글화
const translateAuthError = (message: string): string => {
  const map: Record<string, string> = {
    'Invalid login credentials': '이메일 또는 비밀번호가 올바르지 않습니다.',
    'Email not confirmed': '이메일 인증이 완료되지 않았습니다. 가입 시 받은 이메일을 확인해주세요.',
    'User already registered': '이미 가입된 이메일입니다.',
    'Password should be at least 6 characters': '비밀번호는 6자 이상이어야 합니다.',
    'Unable to validate email address: invalid format': '올바른 이메일 형식이 아닙니다.',
    'Signup requires a valid password': '비밀번호를 입력해주세요.',
    'For security purposes, you can only request this after': '보안을 위해 잠시 후 다시 시도해주세요.',
    'Email rate limit exceeded': '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
  };
  for (const [key, value] of Object.entries(map)) {
    if (message.includes(key)) return value;
  }
  return message;
};

export const authService = {
  login: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(translateAuthError(error.message));
    return data;
  },

  signUp: async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) throw new Error(translateAuthError(error.message));
    return data;
  },

  loginWithOAuth: async (provider: Provider) => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw new Error(translateAuthError(error.message));
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
