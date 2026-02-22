package com.project.whalearc.auth.login.dto.auth;

import lombok.AllArgsConstructor;
import lombok.Getter;
// Access Token 재발급 응답 DTO
@Getter
@AllArgsConstructor
public class ReissuedTokenDto {
    private String accessToken;
}
