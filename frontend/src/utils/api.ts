import axios from 'axios';
import { supabase } from '../lib/supabase';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000, // 15초 타임아웃 (주식 캔들 조회 시 시간 소요)
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Supabase 세션 토큰 추가
apiClient.interceptors.request.use(
  async (config) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - 토큰 만료 시 자동 갱신 + GET 요청 자동 재시도
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // 401: 토큰 만료 시 자동 갱신 (1회만 재시도)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const { data, error: refreshError } = await supabase.auth.refreshSession();
      if (data.session && !refreshError) {
        originalRequest.headers.Authorization = `Bearer ${data.session.access_token}`;
        return apiClient.request(originalRequest);
      }
      if (!window.location.pathname.startsWith('/auth/')) {
        await supabase.auth.signOut().catch(() => {});
        window.location.href = '/login';
      }
    }

    // GET 요청: 네트워크 에러 또는 타임아웃 시 최대 2회 재시도
    if (originalRequest.method === 'get' && !originalRequest._retryCount) {
      originalRequest._retryCount = 0;
    }
    if (
      originalRequest.method === 'get' &&
      originalRequest._retryCount < 2 &&
      (!error.response || error.response.status >= 500 || error.code === 'ECONNABORTED')
    ) {
      originalRequest._retryCount++;
      const delay = 1000 * originalRequest._retryCount;
      await new Promise(resolve => setTimeout(resolve, delay));
      return apiClient.request(originalRequest);
    }

    return Promise.reject(error);
  }
);

export default apiClient;
