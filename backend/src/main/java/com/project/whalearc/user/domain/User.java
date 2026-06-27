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

    /** 구독 등급 — 기능 접근 범위(예: 자동매매=BASIC 이상). 결제 연동 전 기본 FREE. */
    private Tier tier = Tier.FREE;

    /** 권한 역할 — tier와 별개 축. ADMIN은 등급 무관 전 기능 접근(자동매매 포함). */
    private Role role = Role.USER;

    public User(String supabaseId, String email, String name, String authProvider) {
        this.supabaseId = supabaseId;
        this.email = email;
        this.name = name;
        this.authProvider = authProvider;
    }

    /** 자동매매 접근 가능 여부 — BASIC 이상 또는 ADMIN(등급 무관). 프론트 canAutoTrade와 동일 기준. */
    public boolean canAutoTrade() {
        if (role == Role.ADMIN) return true;
        return tier != null && tier.ordinal() >= Tier.BASIC.ordinal();
    }

    /** 구독 등급. 순서가 곧 권한 크기(FREE < BASIC < PRO). */
    public enum Tier { FREE, BASIC, PRO }

    /** 권한 역할. ADMIN = 운영자(소유자). */
    public enum Role { USER, ADMIN }
}
