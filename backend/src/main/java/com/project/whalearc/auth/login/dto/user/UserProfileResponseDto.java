package com.project.whalearc.auth.login.dto.user;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * API 응답용 DTO - 클라이언트에 노출할 사용자 프로필만 담는다.
 * 비밀번호, Refresh Token 등 민감 정보는 절대 포함하지 않는다.
 * (현업: Response DTO는 필요한 필드만 명시적으로 정의)
 */
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserProfileResponseDto {

    private String userId;
    private String name;
}
