package com.project.whalearc.auth.login.service.userinfo;

import com.project.whalearc.auth.login.domain.userinfo.UserInfo;
import com.project.whalearc.auth.login.dto.userinfo.UserInfoRequestDto;
import com.project.whalearc.auth.login.dto.userinfo.UserInfoUpdateRequestDto;
import com.project.whalearc.auth.login.repository.userinfo.UserInfoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
@RequiredArgsConstructor
@Service
public class UserInfoService implements UserInfoServiceInterface {

    private final UserInfoRepository userInfoRepository;

    private String getSupabaseId() {
        Jwt jwt = (Jwt) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return jwt.getSubject();
    }

    @Override
    public UserInfo getUserInfo(String userId) {
        return userInfoRepository.findByUserId(userId);
    }

    @Override
    public void saveUserInfo(UserInfoRequestDto dto) {
        String userId = getSupabaseId();

        UserInfo userInfo = userInfoRepository.findByUserId(userId);
        if (userInfo != null) {
            // 이미 존재하면 업데이트
            applyFields(userInfo, dto.getBio(), dto.getInvestmentStyle(),
                    dto.getExperienceLevel(), dto.getFavoriteAssets());
            userInfo.setUpdatedAt(LocalDateTime.now());
            userInfoRepository.save(userInfo);
            return;
        }

        userInfo = new UserInfo(userId);
        applyFields(userInfo, dto.getBio(), dto.getInvestmentStyle(),
                dto.getExperienceLevel(), dto.getFavoriteAssets());
        userInfoRepository.save(userInfo);
    }

    @Override
    public void updateUserInfo(UserInfoUpdateRequestDto dto) {
        String userId = getSupabaseId();

        UserInfo userInfo = userInfoRepository.findByUserId(userId);
        if (userInfo == null) {
            userInfo = new UserInfo(userId);
        }

        applyFields(userInfo, dto.getBio(), dto.getInvestmentStyle(),
                dto.getExperienceLevel(), dto.getFavoriteAssets());
        userInfo.setUpdatedAt(LocalDateTime.now());
        userInfoRepository.save(userInfo);
    }

    private void applyFields(UserInfo userInfo, String bio,
                             UserInfo.InvestmentStyle style,
                             UserInfo.ExperienceLevel level,
                             java.util.List<String> assets) {
        if (bio != null) userInfo.setBio(bio);
        if (style != null) userInfo.setInvestmentStyle(style);
        if (level != null) userInfo.setExperienceLevel(level);
        if (assets != null) userInfo.setFavoriteAssets(assets);
    }
}
