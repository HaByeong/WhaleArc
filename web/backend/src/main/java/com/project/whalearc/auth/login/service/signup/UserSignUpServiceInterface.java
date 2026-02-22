package com.project.whalearc.auth.login.service.signup;

import com.project.whalearc.auth.login.dto.signup.UserSignUpRequestDto;

// 회원가입 서비스 인터페이스
    public interface UserSignUpServiceInterface {
        void newUser(UserSignUpRequestDto userSignUpRequestDto);
    }
