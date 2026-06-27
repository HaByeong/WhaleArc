package com.project.whalearc.auth.login.service.userinfo;

import com.project.whalearc.auth.login.domain.userinfo.UserInfo;
import com.project.whalearc.auth.login.dto.userinfo.UserInfoRequestDto;
import com.project.whalearc.auth.login.dto.userinfo.UserInfoUpdateRequestDto;
import com.project.whalearc.auth.login.repository.userinfo.UserInfoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
@RequiredArgsConstructor
@Service
public class UserInfoService implements UserInfoServiceInterface {

    private final UserInfoRepository userInfoRepository;

    private String getSupabaseId() {
        // principal이 Jwt가 아닐 때(인증 누락/익명) 무조건 캐스팅하면 500으로 새므로, 가드 후 403으로 매핑한다.
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof Jwt jwt)) {
            throw new AccessDeniedException("인증 정보가 올바르지 않습니다.");
        }
        return jwt.getSubject();
    }

    @Override
    public UserInfo getUserInfo(String userId) {
        return userInfoRepository.findByUserId(userId);
    }

    @Override
    public void saveUserInfo(UserInfoRequestDto dto) {
        String userId = getSupabaseId();

        // 프론트엔드는 신규/수정 모두 POST /users/info 를 사용하므로(PUT 경로는 미사용) upsert 로 동작해야 한다.
        // 기존 프로필이 있을 때 거부하면 즐겨찾기·프로필 저장이 전부 깨진다.
        UserInfo userInfo = userInfoRepository.findByUserId(userId);
        if (userInfo == null) {
            userInfo = new UserInfo(userId);
        }
        applyFields(userInfo, dto.getBio(), dto.getInvestmentStyle(),
                dto.getExperienceLevel(), dto.getFavoriteAssets());
        userInfo.setUpdatedAt(LocalDateTime.now());
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
