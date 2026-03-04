package com.project.whalearc.auth.login.controller.user;

import com.project.whalearc.auth.login.dto.user.UserProfileResponseDto;
import com.project.whalearc.auth.login.dto.user.UserUpdateRequestDto;
import com.project.whalearc.auth.login.service.user.UserUpdateServiceInterface;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * REST 컨벤션: /users 는 "현재 로그인한 나" 기준.
 * GET /users/me = 내 프로필 조회 (현업에서 흔히 쓰는 패턴)
 * PUT /users = 내 정보 수정
 */
@RequiredArgsConstructor
@RestController
@RequestMapping("/users")
public class UserUpdateController {

    private final UserUpdateServiceInterface userUpdateService;

    /** 내 프로필 조회 - JWT 인증된 사용자만 호출 가능 */
    @GetMapping("/me")
    public ResponseEntity<UserProfileResponseDto> getMyProfile() {
        UserProfileResponseDto profile = userUpdateService.getCurrentUserProfile();
        return ResponseEntity.ok(profile);
    }

    @PutMapping
    public ResponseEntity changeUser(@RequestBody UserUpdateRequestDto userUpdateDto) {
        userUpdateService.updateUser(userUpdateDto);
        return ResponseEntity.ok("사용자 개인정보 변경이 완료되었습니다.");
    }
}
