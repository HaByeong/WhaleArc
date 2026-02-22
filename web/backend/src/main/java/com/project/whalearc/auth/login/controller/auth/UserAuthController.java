package com.project.whalearc.auth.login.controller.auth;

import com.project.whalearc.auth.login.dto.auth.ReissuedTokenDto;
import com.project.whalearc.auth.login.dto.auth.UserLoginRequestDto;
import com.project.whalearc.auth.login.dto.auth.UserLoginResponseDto;
import com.project.whalearc.auth.login.service.auth.AccessTokenReissueService;
import com.project.whalearc.auth.login.service.auth.UserLogOutServiceInterface;
import com.project.whalearc.auth.login.service.auth.UserLoginServiceInterface;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class UserAuthController {

    // 의존성 주입: 인터페이스 타입으로 선언
    private final UserLoginServiceInterface userLoginService;
    private final UserLogOutServiceInterface userLogOutService;
    private final AccessTokenReissueService accessTokenReissueService;

    // POST /auth/login
    @PostMapping("/login")
    public ResponseEntity userLogIn(@RequestBody UserLoginRequestDto userLoginRequestDto) {
        return userLoginService.login(userLoginRequestDto);
    }

    // POST /auth/logout
    @PostMapping("/logout")
    public ResponseEntity userLogOut(){
        userLogOutService.logout();

        // 브라우저에서 refreshToken 쿠키를 삭제한다. => maxAge=0(즉석 만료)
        ResponseCookie deleteCookie = ResponseCookie.from("refreshToken", "")
                .httpOnly(true)
                .secure(true)
                .path("/")
                .maxAge(0)
                .build();

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, deleteCookie.toString())
                .body("로그아웃 완료");
    }

    // POST /auth/reissue - Access Token 재발급
    @PostMapping("/reissue")
    public ReissuedTokenDto reissueAccessToken(HttpServletRequest request) {
        // 쿠키에서 refreshToken 추출
        String refreshToken = Arrays.stream(request.getCookies()) // 쿠키 배열을 스트림으로
                .filter(c -> c.getName().equals("refreshToken")) // 이름이 "refreshToken" 인 쿠키를 필터링
                .findFirst() // 첫 번째 결과 반환
                .map(Cookie::getValue) // 값을 추출
                .orElseThrow(() -> new IllegalArgumentException("쿠키에 Refresh Token이 없습니다.")); //없으면 예외
                
        return new ReissuedTokenDto(accessTokenReissueService.reissueAccessToken(refreshToken));
    }
}

