package com.project.whalearc.auth.login.domain.userinfo;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@Document(collection = "user_info")
public class UserInfo {

    @Id
    private String userId;

    private String bio;

    private InvestmentStyle investmentStyle;

    private ExperienceLevel experienceLevel;

    private List<String> favoriteAssets = new ArrayList<>();

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    public UserInfo(String userId) {
        this.userId = userId;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    public enum InvestmentStyle {
        AGGRESSIVE,   // 공격형
        BALANCED,     // 균형형
        CONSERVATIVE  // 안정형
    }

    public enum ExperienceLevel {
        BEGINNER,     // 초보
        INTERMEDIATE, // 중급
        EXPERT        // 고급
    }
}
