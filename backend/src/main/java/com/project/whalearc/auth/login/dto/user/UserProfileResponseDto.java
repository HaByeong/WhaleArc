package com.project.whalearc.auth.login.dto.user;

import com.project.whalearc.auth.login.domain.userinfo.UserInfo;
import com.project.whalearc.user.domain.User;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserProfileResponseDto {

    private String userId;
    private String name;
    private String authProvider;

    // 등급/권한 — 프론트 기능 게이팅·표시용
    private User.Tier tier;
    private User.Role role;

    // UserInfo 필드
    private String bio;
    private UserInfo.InvestmentStyle investmentStyle;
    private UserInfo.ExperienceLevel experienceLevel;
    private List<String> favoriteAssets;
    private LocalDateTime createdAt;
}
