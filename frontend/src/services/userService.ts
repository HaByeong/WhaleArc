/**
 * 사용자(프로필) API 클라이언트
 * - 단일 책임: 사용자 프로필 조회/수정만 담당 (현업: API별로 서비스 모듈 분리)
 * - 타입을 export 해두면 페이지/컴포넌트에서 재사용·자동완성에 유리
 */
import apiClient from '../utils/api';

/** GET /users/me 응답 타입 (백엔드 UserProfileResponseDto와 맞춤) */
export interface UserProfile {
  userId: string;
  name: string;
}

/** PUT /users 요청 시 보낼 수정 가능 필드 (백엔드 UserUpdateRequestDto와 맞춤) */
export interface UserUpdateRequest {
  name: string;
}

/** 
 * 백엔드가 꺼져 있거나, 데모 토큰으로 인해 401/403이 날 때 사용할 로컬 데모 프로필.
 * - userId: localStorage에 저장된 값이 있으면 그걸 쓰고, 없으면 'demo'
 * - name: 간단한 표시용 이름
 */
const buildDemoProfile = (): UserProfile => {
  const storedUserId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;
  const userId = storedUserId || 'demo';
  return {
    userId,
    name: userId === 'demo' ? '데모 유저' : `${userId}`,
  };
};

export const userService = {
  /** 
   * 현재 로그인한 사용자 프로필 조회
   * - 백엔드 호출 실패(네트워크, 401, 403 등) 시에도 데모 프로필로 폴백해서
   *   유저 페이지 UI는 항상 뜨도록 한다.
   */
  getProfile: async (): Promise<UserProfile> => {
    try {
      const { data } = await apiClient.get<UserProfile>('/users/me');
      return data;
    } catch (error: any) {
      const status = error?.response?.status;
      const code = error?.code;
      if (status === 401 || status === 403 || code === 'ERR_NETWORK') {
        return buildDemoProfile();
      }
      return buildDemoProfile();
    }
  },

  /** 
   * 프로필 수정 (이름 등)
   * - 백엔드 실패 시 데모 모드에서는 그냥 조용히 무시 (프론트 state만 갱신)
   */
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
};
