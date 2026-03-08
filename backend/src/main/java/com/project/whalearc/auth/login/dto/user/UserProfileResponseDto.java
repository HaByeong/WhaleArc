package com.project.whalearc.auth.login.dto.user;

import com.project.whalearc.auth.login.domain.userinfo.UserInfo;
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

    // UserInfo 필드
    private String bio;
    private UserInfo.InvestmentStyle investmentStyle;
    private UserInfo.ExperienceLevel experienceLevel;
    private List<String> favoriteAssets;
    private LocalDateTime createdAt;
}
