package com.project.whalearc.user.domain;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Getter
@Setter
@NoArgsConstructor
@Document(collection = "users")
public class User {

    @Id
    private String id;

    @Indexed(unique = true)
    private String supabaseId;

    private String email;

    private String name;

    private String authProvider; // "email", "google", "kakao"

    /** 구독 등급 — 기능 접근 범위(예: 자동매매=PRO). 결제 연동 전 기본 FREE. */
    private Tier tier = Tier.FREE;

    /** 권한 역할 — tier와 별개 축. ADMIN은 등급 무관 전 기능 접근(자동매매 포함). */
    private Role role = Role.USER;

    public User(String supabaseId, String email, String name, String authProvider) {
        this.supabaseId = supabaseId;
        this.email = email;
        this.name = name;
        this.authProvider = authProvider;
    }

    /** 구독 등급. 순서가 곧 권한 크기(FREE < BASIC < PRO). */
    public enum Tier { FREE, BASIC, PRO }

    /** 권한 역할. ADMIN = 운영자(소유자). */
    public enum Role { USER, ADMIN }
}
