package com.project.whalearc.auth.login.service.signup;

import com.project.whalearc.auth.login.domain.user.User;
import com.project.whalearc.auth.login.dto.signup.UserSignUpRequestDto;
import com.project.whalearc.auth.login.repository.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

// 회원가입 서비스: 클라이언트 요청을 받아 User 객체 생성, 비밀번호는 BCrypt로 해싱
    @Service
    @RequiredArgsConstructor
    public class UserSignUpService implements UserSignUpServiceInterface {
        private final BCryptPasswordEncoder encoder;
        private final UserRepository userRepository;

        @Override
        public void newUser(UserSignUpRequestDto userSignUpRequestDto) {
            // 중복 ID 체크
            if (userRepository.existsByUserId(userSignUpRequestDto.getUserId())) {
                throw new IllegalArgumentException("이미 존재하는 아이디입니다.");
            }

            User newUser = new User(
                userSignUpRequestDto.getUserId(),
                encoder.encode(userSignUpRequestDto.getPassword()),
                userSignUpRequestDto.getName()
            );

            userRepository.save(newUser);
            System.out.println("회원가입이 완료되었습니다.");
        }
    }




// @Service
// @RequiredArgsConstructor
// public class UserSignUpService implements UserSignUpServiceInterface {

    // private final BCryptPasswordEncoder encoder;
    // private final UserRepository userRepository;

    // public void newUser(UserSignUpRequestDto userSignUpRequestDto) {
    //
    //     // ======== [보안 개선] 중복 ID 체크 ========
    //     // 저장하기 전에 같은 userId가 이미 있는지 확인
    //     // existsByUserId()는 UserRepository에 선언한 메서드 (Spring Data 자동 쿼리)
    //     //
    //     // 이게 없으면:
    //     //   1. "hanyang"으로 가입 → DB에 저장됨
    //     //   2. 다른 사람이 "hanyang"으로 또 가입 → DB가 덮어씌워짐 (비번, 이름 전부 바뀜)
    //     //   → 사실상 계정 탈취
    //     //
    //     // if (userRepository.existsByUserId(userSignUpRequestDto.getUserId())) {
    //     //     throw new IllegalArgumentException("이미 존재하는 아이디입니다.");
    //     // }
    //     // ==========================================
    //
    //     User newUser = new User(
    //             userSignUpRequestDto.getUserId(),
    //             encoder.encode(userSignUpRequestDto.getPassword()),
    //             userSignUpRequestDto.getName()
    //     );
    //     userRepository.save(newUser);
    //     System.out.println("완료!");
    // }
// }

