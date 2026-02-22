package com.project.whalearc.auth.login.service.user;

import com.project.whalearc.auth.login.dto.user.UserUpdateRequestDto;

public interface UserUpdateServiceInterface {
    void updateUser(UserUpdateRequestDto userUpdateRequestDto);
}
