package com.project.whalearc.auth.login.dto.auth;

import lombok.AllArgsConstructor;
import lombok.Getter;

// 로그인 응답 DTO
// 응답에서는 setter가 필요없음.(불변 객체)
// 생성자 자동 생성 => @AllArgsConstructor 사용
// @AllArgsConstructor: 모든 필드를 받는 생성자 생성
@Getter
@AllArgsConstructor
public class UserLoginResponseDto {
    private String userId;
    
    // 로그인 성공 시 클라이언트에게 제공하는 Access Token
    private String accessToken;

}

