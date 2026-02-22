package com.project.whalearc.auth.login.controller.user;

import com.project.whalearc.auth.login.dto.user.UserUpdateRequestDto;
import com.project.whalearc.auth.login.service.user.UserUpdateServiceInterface;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RequiredArgsConstructor
@RestController
@RequestMapping("/users")
public class UserUpdateController {

    private final UserUpdateServiceInterface userUpdateService;

    @PutMapping
    public ResponseEntity changeUser(@RequestBody UserUpdateRequestDto userUpdateDto) {
        //일단 검증하고나서, 이후 로직
        userUpdateService.updateUser(userUpdateDto);
        return ResponseEntity.ok("사용자 개인정보 변경이 완료되었습니다.");
    }

}
