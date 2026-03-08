import apiClient from '../utils/api';

/** GET /users/me 응답 타입 */
export interface UserProfile {
  userId: string;
  name: string;
  authProvider?: string;
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
