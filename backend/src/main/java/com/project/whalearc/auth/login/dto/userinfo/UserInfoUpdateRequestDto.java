package com.project.whalearc.auth.login.dto.userinfo;

import com.project.whalearc.auth.login.domain.userinfo.UserInfo;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class UserInfoUpdateRequestDto {

    @Size(max = 200, message = "자기소개는 200자 이내로 작성해주세요")
    private String bio;

    private UserInfo.InvestmentStyle investmentStyle;

    private UserInfo.ExperienceLevel experienceLevel;

    @Size(max = 20, message = "관심 종목은 최대 20개까지 등록 가능합니다")
    // 각 종목 항목도 공백·길이를 제한해 저장 페이로드가 무제한이 되지 않도록 한다.
    private List<@NotBlank @Size(max = 20, message = "관심 종목 항목은 20자 이내여야 합니다") String> favoriteAssets;
}
