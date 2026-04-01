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

// 세션 토큰 캐시 (매 요청마다 getSession() 호출 방지)
let _cachedToken: string | null = null;
let _tokenExpiresAt = 0;
let _tokenFetchPromise: Promise<string | null> | null = null;

async function getCachedToken(): Promise<string | null> {
  if (_cachedToken && Date.now() < _tokenExpiresAt) {
    return _cachedToken;
  }
  // 동시 요청 시 getSession() 중복 호출 방지
  if (_tokenFetchPromise) return _tokenFetchPromise;
  _tokenFetchPromise = (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        _cachedToken = session.access_token;
        const sessionExpiry = session.expires_at ? session.expires_at * 1000 - 60_000 : 0;
        _tokenExpiresAt = sessionExpiry > Date.now()
          ? Math.min(sessionExpiry, Date.now() + 4 * 60_000)
          : Date.now() + 4 * 60_000;
        return _cachedToken;
      }
      _cachedToken = null;
      _tokenExpiresAt = 0;
      return null;
    } finally {
      _tokenFetchPromise = null;
    }
  })();
  return _tokenFetchPromise;
}

// 동시 다발 401 시 refreshSession() 중복 호출 방지
let _refreshPromise: ReturnType<typeof supabase.auth.refreshSession> | null = null;

/** 외부에서 토큰 캐시 무효화 (로그아웃, 401 등) */
export function invalidateTokenCache() {
  _cachedToken = null;
  _tokenExpiresAt = 0;
  _tokenFetchPromise = null;
}

// Request interceptor - 캐싱된 Supabase 세션 토큰 추가
apiClient.interceptors.request.use(
  async (config) => {
    const token = await getCachedToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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

    // 401: 토큰 만료 시 캐시 무효화 + 자동 갱신 (1회만 재시도)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      invalidateTokenCache();
      // 동시 다발 401에 대해 refresh를 한 번만 수행
      if (!_refreshPromise) {
        _refreshPromise = supabase.auth.refreshSession().finally(() => {
          _refreshPromise = null;
        });
      }
      const { data, error: refreshError } = await _refreshPromise;
      if (data?.session && !refreshError) {
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
