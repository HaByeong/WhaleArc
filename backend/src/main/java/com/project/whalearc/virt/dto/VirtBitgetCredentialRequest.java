package com.project.whalearc.virt.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class VirtBitgetCredentialRequest {

    @NotBlank(message = "API Key는 필수입니다.")
    @Size(max = 100)
    private String apiKey;

    @NotBlank(message = "Secret Key는 필수입니다.")
    @Size(max = 100)
    private String secretKey;

    @NotBlank(message = "Passphrase는 필수입니다.")
    @Size(max = 50)
    private String passphrase;
}
