package com.project.whalearc.auth.login.service.auth;

import com.project.whalearc.auth.login.domain.user.User;
import com.project.whalearc.auth.login.repository.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

    @Service
    @RequiredArgsConstructor
    public class UserLogOutService implements UserLogOutServiceInterface {

        private final UserRepository userRepository;

        @Override
        public void logout() {
            // SecurityContext에서 userId 추출 (필터에서 이미 저장해둔 값)
            // DTO로 userId를 받으면, 다른 사람 ID를 보내서 조작 가능 -> 보안상 이 방식이 안전하다
            String userId = (String) SecurityContextHolder.getContext().getAuthentication().getPrincipal();

            // DB에서 Refresh Token 삭제
            User user = userRepository.findByUserId(userId);
            user.setJwtRefreshToken(null);
            userRepository.save(user);
        }
    }