package com.project.whalearc.auth.login.dto.user;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UserUpdateRequestDto {
    @Size(max = 50, message = "이름은 50자 이내로 입력해주세요")
    private String name;
}
