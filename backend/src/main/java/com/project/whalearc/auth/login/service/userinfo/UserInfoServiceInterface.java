package com.project.whalearc.auth.login.service.userinfo;

import com.project.whalearc.auth.login.domain.userinfo.UserInfo;
import com.project.whalearc.auth.login.dto.userinfo.UserInfoRequestDto;
import com.project.whalearc.auth.login.dto.userinfo.UserInfoUpdateRequestDto;

public interface UserInfoServiceInterface {
    UserInfo getUserInfo(String userId);
    void saveUserInfo(UserInfoRequestDto userInfoRequestDto);
    void updateUserInfo(UserInfoUpdateRequestDto userInfoUpdateRequestDto);
}
