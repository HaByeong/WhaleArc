package com.project.whalearc.virt.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class VirtUpbitCredentialRequest {

    @NotBlank(message = "Access Key는 필수입니다.")
    @Size(max = 100, message = "Access Key가 너무 깁니다.")
    private String accessKey;

    @NotBlank(message = "Secret Key는 필수입니다.")
    @Size(max = 100, message = "Secret Key가 너무 깁니다.")
    private String secretKey;
}
