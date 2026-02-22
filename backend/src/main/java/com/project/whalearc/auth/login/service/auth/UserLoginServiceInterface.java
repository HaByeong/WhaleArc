package com.project.whalearc.auth.login.service.auth;

import com.project.whalearc.auth.login.dto.auth.UserLoginRequestDto;
import org.springframework.http.ResponseEntity;

// 로그인 서비스 인터페이스 (Controller가 구체 클래스가 아닌, 인터페이스에 의존 -> 느슨한 결합)
    public interface UserLoginServiceInterface {
        ResponseEntity login(UserLoginRequestDto userLoginRequestDto);
    }

