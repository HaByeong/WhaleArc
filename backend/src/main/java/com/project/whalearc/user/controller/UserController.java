package com.project.whalearc.user.controller;

import com.project.whalearc.auth.login.dto.user.UserProfileResponseDto;
import com.project.whalearc.auth.login.dto.user.UserUpdateRequestDto;
import com.project.whalearc.auth.login.service.user.UserUpdateService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
public class UserController {

    private final UserUpdateService userUpdateService;

    @GetMapping("/me")
    public UserProfileResponseDto getProfile() {
        return userUpdateService.getCurrentUserProfile();
    }

    @PutMapping
    public void updateProfile(@RequestBody UserUpdateRequestDto request) {
        userUpdateService.updateUser(request);
    }
}
