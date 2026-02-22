package com.project.whalearc.auth.login.controller.signup;

import com.project.whalearc.auth.login.dto.signup.UserSignUpRequestDto;
import com.project.whalearc.auth.login.service.signup.UserSignUpServiceInterface;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;


@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
public class UserSignUpController {
    private final UserSignUpServiceInterface userSignUpService;

    // POST /users - 회원가입
    @PostMapping
    public ResponseEntity userSignUp(@RequestBody UserSignUpRequestDto userSignUpRequestDto) {
        userSignUpService.newUser(userSignUpRequestDto);
        return ResponseEntity.ok("회원 가입이 완료되었습니다.");
    }

}

