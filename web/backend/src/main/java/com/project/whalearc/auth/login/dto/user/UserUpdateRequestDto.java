package com.project.whalearc.auth.login.dto.user;

import lombok.Data;

@Data
public class UserUpdateRequestDto {
    private String name;
    private int age;
    private String email;
    private String phoneNum;
    private int userHeight;
}
