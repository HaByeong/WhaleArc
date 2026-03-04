package com.project.whalearc.auth.login.service.user;

import com.project.whalearc.auth.login.dto.user.UserProfileResponseDto;
import com.project.whalearc.auth.login.dto.user.UserUpdateRequestDto;

public interface UserUpdateServiceInterface {

    /** 로그인한 사용자의 프로필 조회 (현업: 읽기/쓰기 역할 분리 시 조회 전용 서비스를 두기도 함) */
    UserProfileResponseDto getCurrentUserProfile();

    void updateUser(UserUpdateRequestDto userUpdateRequestDto);
}
