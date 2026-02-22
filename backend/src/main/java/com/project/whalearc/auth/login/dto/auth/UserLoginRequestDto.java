package com.project.whalearc.auth.login.dto.auth;

import lombok.Data;

// 로그인 요청 DTO
@Data
public class UserLoginRequestDto {
    private String userId;
    private String password;
}