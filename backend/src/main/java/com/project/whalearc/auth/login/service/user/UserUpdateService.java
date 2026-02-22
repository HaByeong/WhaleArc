package com.project.whalearc.auth.login.service.user;

import com.project.whalearc.auth.login.domain.user.User;
import com.project.whalearc.auth.login.dto.user.UserUpdateRequestDto;
import com.project.whalearc.auth.login.repository.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UserUpdateService implements UserUpdateServiceInterface {

    private final UserRepository userRepository;

    @Override
    public void updateUser(UserUpdateRequestDto userUpdateRequestDto) {
        //userId 꺼내서 이제 전체 수정을 하면 될 것 같다
        String userId = (String) SecurityContextHolder.getContext().getAuthentication().getPrincipal();

        //회원 정보 수정 로직 (User 엔티티 기준: name만 수정 가능)
        User updateUser = userRepository.findByUserId(userId);
        updateUser.setName(userUpdateRequestDto.getName());

        userRepository.save(updateUser);
    }
}
