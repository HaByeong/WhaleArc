package com.project.whalearc.auth.login.domain.userinfo;

import lombok.Getter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

//유저 개인정보 디비
@Getter
@Document(collection = "user_info")
public class UserInfo {

    @Id
    private final String userId;

    //정보 추가해야함

    public UserInfo(String userId){
        this.userId = userId;
    }
}
