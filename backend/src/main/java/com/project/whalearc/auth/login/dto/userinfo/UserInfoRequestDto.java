package com.project.whalearc.auth.login.dto.userinfo;

import com.project.whalearc.auth.login.domain.userinfo.UserInfo;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class UserInfoRequestDto {

    @Size(max = 200, message = "자기소개는 200자 이내로 작성해주세요")
    private String bio;

    private UserInfo.InvestmentStyle investmentStyle;

    private UserInfo.ExperienceLevel experienceLevel;

    @Size(max = 20, message = "관심 종목은 최대 20개까지 등록 가능합니다")
    private List<String> favoriteAssets;
}
