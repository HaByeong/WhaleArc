package com.project.whalearc.auth.login.service.auth;

import com.project.whalearc.auth.login.domain.user.User;
import com.project.whalearc.auth.login.repository.user.UserRepository;
import com.project.whalearc.auth.login.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AccessTokenReissueService {
    private final UserRepository userRepository;
    private final JwtTokenProvider jwtTokenProvider;
    
    public String reissueAccessToken(String refreshToken) {
        // Refresh Token의 유효성을 검증한다.
        if (!jwtTokenProvider.validateToken(refreshToken)) {
            throw new IllegalArgumentException("유효하지 않은 Refresh Token입니다.");
        }

        // 토큰에서 userId 추출
        String userId = jwtTokenProvider.getUserIdFromToken(refreshToken);
        User user = userRepository.findByUserId(userId);

        // 클라이언트의 Refresh Token과 DB에 저장된 Refresh Token 비교
        if (!refreshToken.equals(user.getJwtRefreshToken())) {
            throw new IllegalArgumentException("RefreshToken이 일치하지 않습니다.");
        }

        // 새로운 Access Token 생성 후 반환
        return jwtTokenProvider.generateAccessToken(userId);
    }    
}

