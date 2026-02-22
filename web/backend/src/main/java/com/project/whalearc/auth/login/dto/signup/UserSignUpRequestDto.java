package com.project.whalearc.auth.login.dto.signup;

import lombok.Data;

// 회원가입 요청 DTO
// DTO는 데이터를 주고받는 객체일 뿐, 보안을 담당하지 않음 => 보안 담당이 아니라 데이터를 전달해주는 객체라서, 비밀번호를 꺼낼 수 있도록! 해야한다
// 그래서 password에도 getter가 필요 (서비스에서 꺼내야 하니까)
// @Data는 getter + setter 둘 다 포함
@Data
public class UserSignUpRequestDto {
    private String userId;
    private String password;
    private String name;
}

