import apiClient from '../utils/api';

export type UserTier = 'FREE' | 'BASIC' | 'PRO';
export type UserRole = 'USER' | 'ADMIN';

/** 유효 등급 기준 기능 한도. 무제한은 -1(백엔드 TierLimits.UNLIMITED). FREE의 0(없음)과 구분. */
export interface TierLimits {
  maxBacktestYears: number;
  maxBacktestPositions: number;
  dailyBacktestQuota: number;
  maxSavedStrategies: number;
  maxAlerts: number;
  maxLiveStrategies: number;
  maxLiveSymbols: number;
  canUseCustomBuilder: boolean;
  canUseAdvancedStrategy: boolean;
}

/** 한도값이 무제한(-1)인지. 표시·비교 시 사용. */
export const isUnlimited = (v: number | undefined | null): boolean => v != null && v < 0;

const TIER_ORDER: Record<UserTier, number> = { FREE: 0, BASIC: 1, PRO: 2 };

/** 유효 등급 — ADMIN은 등급 무관 PRO로 취급(백엔드 TierResolver와 동일). */
export const effectiveTier = (tier?: UserTier | null, role?: UserRole | null): UserTier =>
  role === 'ADMIN' ? 'PRO' : (tier ?? 'FREE');

/** 유효 등급이 최소 요구 등급(minTier) 이상인지. 프리셋 잠금 판정 등. */
export const tierMeetsMin = (effTier: UserTier, minTier?: UserTier): boolean =>
  TIER_ORDER[effTier] >= TIER_ORDER[minTier ?? 'FREE'];

/** 등급 표시명. */
export const tierLabel = (t: UserTier): string => ({ FREE: 'Free', BASIC: 'Basic', PRO: 'Pro' }[t]);

/** GET /users/me 응답 타입 */
export interface UserProfile {
  userId: string;
  name: string;
  authProvider?: string;
  tier?: UserTier;   // 구독 등급 (기능 게이팅용)
  role?: UserRole;   // 권한 (ADMIN=운영자, 등급 무관 전기능)
  limits?: TierLimits; // 유효 등급 기준 기능 한도(ADMIN→PRO 반영)
  // UserInfo 필드
  bio?: string;
  investmentStyle?: InvestmentStyle;
  experienceLevel?: ExperienceLevel;
  favoriteAssets?: string[];
  createdAt?: string;
}

export type InvestmentStyle = 'AGGRESSIVE' | 'BALANCED' | 'CONSERVATIVE';
export type ExperienceLevel = 'BEGINNER' | 'INTERMEDIATE' | 'EXPERT';

/** PUT /users 요청 */
export interface UserUpdateRequest {
  name: string;
}

/** POST/PUT /users/info 요청 */
export interface UserInfoRequest {
  bio?: string;
  investmentStyle?: InvestmentStyle;
  experienceLevel?: ExperienceLevel;
  favoriteAssets?: string[];
}

export const userService = {
  /** 프로필 조회 — API 실패 시 null 반환 */
  getProfile: async (): Promise<UserProfile | null> => {
    try {
      const { data } = await apiClient.get<UserProfile>('/users/me');
      return data;
    } catch {
      return null;
    }
  },

  updateProfile: async (body: UserUpdateRequest): Promise<void> => {
    await apiClient.put('/users', body);
  },

  saveUserInfo: async (body: UserInfoRequest): Promise<void> => {
    await apiClient.post('/users/info', body);
  },

  updateUserInfo: async (body: UserInfoRequest): Promise<void> => {
    await apiClient.put('/users/info', body);
  },
};
