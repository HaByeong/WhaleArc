package com.project.whalearc.auth.login.dto.auth;

import lombok.Getter;

//DB에서 비밀번호를 가져오기 위해서 사용하는 DTO
//User 엔티티의 password는 @Getter(AccessLevel.None)이 걸려있어서 getPassword() 불가능(별도 DTO로 password만 가져온다) 
@Getter
public class RepositoryPasswordReturnDto{
    private String password;
}
