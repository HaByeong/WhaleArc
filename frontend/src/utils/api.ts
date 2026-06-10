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

  // getSession()을 시작하고, 그 결과가 오면(아래 3초 타임아웃 이후라도) 캐시를 갱신한다.
  // → 세션 조회가 느려 일단 토큰 없이 진행하더라도, 곧이어 캐시가 채워져 다음 요청부터 인증이 붙는다(토큰 유실 방지).
  const sessionPromise = supabase.auth.getSession()
    .then(({ data: { session } }) => {
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
    })
    .catch(() => null);

  // navigator.locks 교착 등으로 getSession()이 무한 대기하면 요청 인터셉터가 멈춰
  // 모든 API가 전송조차 안 되므로(타임아웃도 안 걸림) 3초 타임아웃으로 방어 — 만료 시 토큰 없이 진행.
  _tokenFetchPromise = Promise.race([
    sessionPromise,
    new Promise<string | null>(resolve => setTimeout(() => resolve(null), 3000)),
  ]).finally(() => { _tokenFetchPromise = null; });

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

// 공개 시장데이터(GET /api/market/**)는 백엔드 permitAll → 인증 불필요.
// 이런 요청까지 getSession()을 기다리면 세션 락 교착 시 시세/캔들이 통째로 멈춘다.
// → 공개 GET은 토큰 조회를 건너뛰고 즉시 전송(익명). 인증 엔드포인트만 토큰 부착.
function isPublicMarketGet(config: { method?: string; url?: string }): boolean {
  const method = (config.method ?? 'get').toLowerCase();
  return method === 'get' && typeof config.url === 'string' && config.url.includes('/api/market/');
}

// Request interceptor - 캐싱된 Supabase 세션 토큰 추가 (공개 시세 GET 제외)
apiClient.interceptors.request.use(
  async (config) => {
    if (isPublicMarketGet(config)) return config;
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
    // 단, 공개 시세 GET은 애초에 토큰을 안 보내므로 401이 나도 전역 로그아웃/리다이렉트를 발동하지 않는다.
    if (error.response?.status === 401 && !originalRequest._retry && !isPublicMarketGet(originalRequest)) {
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
