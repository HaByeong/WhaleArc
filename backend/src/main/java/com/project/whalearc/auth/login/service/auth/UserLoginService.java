package com.project.whalearc.auth.login.service.auth;

import com.project.whalearc.auth.login.domain.user.User;
import com.project.whalearc.auth.login.dto.auth.UserLoginRequestDto;
import com.project.whalearc.auth.login.dto.auth.UserLoginResponseDto;
import com.project.whalearc.auth.login.dto.auth.RepositoryPasswordReturnDto;
import com.project.whalearc.auth.login.repository.user.UserRepository;
import com.project.whalearc.auth.login.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UserLoginService implements UserLoginServiceInterface {
    private final UserRepository userRepository;
    private final BCryptPasswordEncoder bcryptPasswordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    @Override
    public ResponseEntity login(UserLoginRequestDto userLoginRequestDto){
        String requestId = userLoginRequestDto.getUserId();
        String requestPassword = userLoginRequestDto.getPassword();

        // 아이디로 DB에서 암호화된 비밀번호만 조회
        RepositoryPasswordReturnDto repositoryPasswordReturnDto = userRepository.findOnlyPasswordById(requestId);

        if(repositoryPasswordReturnDto.getPassword() == null || !bcryptPasswordEncoder.matches(requestPassword, repositoryPasswordReturnDto.getPassword())) {
            throw new IllegalArgumentException("아이디 혹은 비밀번호가 일치하지 않습니다");
        } else {
            // 로그인 승인된거니까, Access Token을 생성해서 클라이언트에게 할당해준다.
            String refreshToken = jwtTokenProvider.generateRefreshToken(requestId);
            User user = userRepository.findByUserId(requestId);
            user.setJwtRefreshToken(refreshToken);
            userRepository.save(user);

            // HttpOnly 쿠키에 Refresh Token 담기 
            ResponseCookie responseCookie = makeRefreshCookie(refreshToken);
            
            // 응답: Body에 userId + accessToken, 헤더에 Set-Cookie(refreshToken)
            return ResponseEntity.ok()
                    .header(HttpHeaders.SET_COOKIE, responseCookie.toString())
                    .body(new UserLoginResponseDto(requestId, jwtTokenProvider.generateAccessToken(requestId)));
        }
    }


    // Refresh Tkoen을 담을 HttpOnly 쿠키 생성
    public ResponseCookie makeRefreshCookie(String refreshToken) {
        return ResponseCookie.from("refreshToken", refreshToken)
                .httpOnly(true) // JavaScript 접근 차단 (XSS 방어)
                .secure(true) // HTTPS에서만 전송
                .path("/") // 모든 경로에서 쿠키 전송
                .maxAge(7*24*60*60) // 7일 수명
                .sameSite("Strict") // 같은 사이트에서만 전송 (CSRF 방어)
                .build();
    }
}
