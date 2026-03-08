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

const buildDemoProfile = (): UserProfile => ({
  userId: 'demo',
  name: '데모 유저',
  authProvider: 'email',
  bio: '',
  investmentStyle: undefined,
  experienceLevel: undefined,
  favoriteAssets: [],
});

export const userService = {
  getProfile: async (): Promise<UserProfile> => {
    try {
      const { data } = await apiClient.get<UserProfile>('/users/me');
      return data;
    } catch {
      return buildDemoProfile();
    }
  },

  updateProfile: async (body: UserUpdateRequest): Promise<void> => {
    try {
      await apiClient.put('/users', body);
    } catch (error: any) {
      const status = error?.response?.status;
      const code = error?.code;
      if (status === 401 || status === 403 || code === 'ERR_NETWORK') {
        return;
      }
      throw error;
    }
  },

  saveUserInfo: async (body: UserInfoRequest): Promise<void> => {
    try {
      await apiClient.post('/users/info', body);
    } catch (error: any) {
      const status = error?.response?.status;
      const code = error?.code;
      if (status === 401 || status === 403 || code === 'ERR_NETWORK') {
        return;
      }
      throw error;
    }
  },

  updateUserInfo: async (body: UserInfoRequest): Promise<void> => {
    try {
      await apiClient.put('/users/info', body);
    } catch (error: any) {
      const status = error?.response?.status;
      const code = error?.code;
      if (status === 401 || status === 403 || code === 'ERR_NETWORK') {
        return;
      }
      throw error;
    }
  },
};
