package com.project.whalearc.auth.login.domain.user;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

// 모든 필드의 getter/setter 자동 생성
// @Getter
// @Setter
// MongoDB의 "users" 컬렉션과 매핑되는 엔티티
// @Document(collection = "users")
@Getter
@Setter
@Document(collection = "users")
public class User {

    // MongoDB의 _id 필드와 매핑 (유저 로그인 ID를 _id로 사용)
    @Id
    private String userId;
    // 비밀번호는 외부에서 getter/setter로 접근 못하게 차단 (보안)
    @Getter(AccessLevel.NONE)
    @Setter(AccessLevel.NONE)
    private String password;

    // 닉네임 (랭킹 등에 표시용)
    private String name;

    // Refresh Token을 DB에 저장 (로그아웃 시 null로 설정하여 무효화)
    private String jwtRefreshToken;


    // 회원가입 시 사용하는 생성자 (userId, password, name)
    public User(String userId, String password, String name){
        this.userId = userId;
        this.password = password;
        this.name = name;
    }
}
