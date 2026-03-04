package com.project.whalearc.auth.login.service.user;

import com.project.whalearc.user.domain.User;
import com.project.whalearc.auth.login.dto.user.UserProfileResponseDto;
import com.project.whalearc.auth.login.dto.user.UserUpdateRequestDto;
import com.project.whalearc.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

/**
 * 로그인한 사용자 기준으로 동작한다.
 * userId는 SecurityContext에 JWT 검증 후 넣어둔 principal에서 가져온다.
 */
@Service
@RequiredArgsConstructor
public class UserUpdateService implements UserUpdateServiceInterface {

    private final UserRepository userRepository;

    @Override
    public UserProfileResponseDto getCurrentUserProfile() {
        String userId = (String) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        User user = userRepository.findByUserId(userId);
        if (user == null) {
            throw new IllegalArgumentException("사용자를 찾을 수 없습니다.");
        }
        return UserProfileResponseDto.builder()
                .userId(user.getUserId())
                .name(user.getName())
                .build();
    }

    @Override
    public void updateUser(UserUpdateRequestDto userUpdateRequestDto) {
        String userId = (String) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        User updateUser = userRepository.findByUserId(userId);
        updateUser.setName(userUpdateRequestDto.getName());
        userRepository.save(updateUser);
    }
}
