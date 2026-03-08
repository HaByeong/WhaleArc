package com.project.whalearc.auth.login.controller.userinfo;

import com.project.whalearc.auth.login.domain.userinfo.UserInfo;
import com.project.whalearc.auth.login.dto.userinfo.UserInfoRequestDto;
import com.project.whalearc.auth.login.dto.userinfo.UserInfoUpdateRequestDto;
import com.project.whalearc.auth.login.service.userinfo.UserInfoServiceInterface;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RequiredArgsConstructor
@RestController
@RequestMapping("users")
public class UserProfileController {

    private final UserInfoServiceInterface userInfoService;

    @GetMapping("/info")
    public ResponseEntity<UserInfo> getUserInfo() {
        Jwt jwt = (Jwt) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        String userId = jwt.getSubject();
        UserInfo userInfo = userInfoService.getUserInfo(userId);
        if (userInfo == null) {
            return ResponseEntity.ok(new UserInfo(userId));
        }
        return ResponseEntity.ok(userInfo);
    }

    @PostMapping("/info")
    public ResponseEntity<String> registerUserInfo(@Valid @RequestBody UserInfoRequestDto userInfoRequestDto) {
        userInfoService.saveUserInfo(userInfoRequestDto);
        return ResponseEntity.ok("사용자 프로필 등록 완료");
    }

    @PutMapping("/info")
    public ResponseEntity<String> changeUserInfo(@Valid @RequestBody UserInfoUpdateRequestDto userInfoUpdateRequestDto) {
        userInfoService.updateUserInfo(userInfoUpdateRequestDto);
        return ResponseEntity.ok("사용자 프로필 수정 완료");
    }
}
