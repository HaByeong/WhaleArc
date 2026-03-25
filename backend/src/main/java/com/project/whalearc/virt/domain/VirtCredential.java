package com.project.whalearc.virt.domain;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@Document(collection = "virt_credentials")
public class VirtCredential {

    @Id
    private String id;

    @Indexed(unique = true)
    private String userId;

    /** AES 암호화된 KIS appkey */
    private String encryptedAppkey;

    /** AES 암호화된 KIS appsecret */
    private String encryptedAppsecret;

    /** 계좌번호 앞 8자리 (CANO) */
    private String accountNumber;

    /** 계좌번호 뒤 2자리 (ACNT_PRDT_CD) */
    private String accountProductCode;

    /* ── 업비트 자격증명 ── */

    /** AES 암호화된 Upbit access key */
    private String encryptedUpbitAccessKey;

    /** AES 암호화된 Upbit secret key */
    private String encryptedUpbitSecretKey;

    /* ── 비트겟 자격증명 ── */

    private String encryptedBitgetApiKey;
    private String encryptedBitgetSecretKey;
    private String encryptedBitgetPassphrase;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public VirtCredential(String userId) {
        this.userId = userId;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }
}
