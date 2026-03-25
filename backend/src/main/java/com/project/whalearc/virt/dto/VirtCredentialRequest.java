package com.project.whalearc.virt.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class VirtCredentialRequest {

    @NotBlank(message = "App Key는 필수입니다.")
    @Size(max = 50, message = "App Key가 너무 깁니다.")
    private String appkey;

    @NotBlank(message = "App Secret은 필수입니다.")
    @Size(max = 200, message = "App Secret이 너무 깁니다.")
    private String appsecret;

    @NotBlank(message = "계좌번호는 필수입니다.")
    @Pattern(regexp = "\\d{8}", message = "계좌번호는 숫자 8자리여야 합니다.")
    private String accountNumber;

    @Pattern(regexp = "\\d{2}", message = "상품코드는 숫자 2자리여야 합니다.")
    private String accountProductCode;
}
