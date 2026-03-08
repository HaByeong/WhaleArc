package com.project.whalearc.auth.login.service.user;

import com.project.whalearc.auth.login.domain.userinfo.UserInfo;
import com.project.whalearc.auth.login.dto.user.UserProfileResponseDto;
import com.project.whalearc.auth.login.dto.user.UserUpdateRequestDto;
import com.project.whalearc.auth.login.repository.userinfo.UserInfoRepository;
import com.project.whalearc.user.domain.User;
import com.project.whalearc.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UserUpdateService implements UserUpdateServiceInterface {

    private final UserRepository userRepository;
    private final UserInfoRepository userInfoRepository;

    private String getSupabaseId() {
        Jwt jwt = (Jwt) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return jwt.getSubject();
    }

    @Override
    public UserProfileResponseDto getCurrentUserProfile() {
        String supabaseId = getSupabaseId();
        User user = userRepository.findBySupabaseId(supabaseId)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

        UserInfo userInfo = userInfoRepository.findByUserId(supabaseId);

        UserProfileResponseDto.UserProfileResponseDtoBuilder builder = UserProfileResponseDto.builder()
                .userId(user.getEmail())
                .name(user.getName())
                .authProvider(user.getAuthProvider());

        if (userInfo != null) {
            builder.bio(userInfo.getBio())
                    .investmentStyle(userInfo.getInvestmentStyle())
                    .experienceLevel(userInfo.getExperienceLevel())
                    .favoriteAssets(userInfo.getFavoriteAssets())
                    .createdAt(userInfo.getCreatedAt());
        }

        return builder.build();
    }

    @Override
    public void updateUser(UserUpdateRequestDto userUpdateRequestDto) {
        String supabaseId = getSupabaseId();
        User user = userRepository.findBySupabaseId(supabaseId)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
        user.setName(userUpdateRequestDto.getName());
        userRepository.save(user);
    }
}
