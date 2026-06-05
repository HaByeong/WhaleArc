package com.project.whalearc.exchange.util;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;

/**
 * 거래소 자격증명 AES 암호화 유틸 — 버전드 마이그레이션.
 *  - v1(레거시): 패스프레이즈를 16바이트로 절단/제로패딩한 AES-128 키. 기존 저장 데이터 복호화 호환용으로만 유지.
 *  - v2(신규):   SHA-256 으로 파생한 32바이트 AES-256 키. 새로 저장되는 모든 자격증명에 사용.
 *  암호문 앞에 "v2:" 접두를 붙여 구분한다(Base64에는 ':'가 없으므로 v1 암호문과 절대 충돌하지 않음).
 *  기존 v1 데이터는 그대로 복호화되고, 자격증명을 다시 저장하면 자연히 v2로 이관된다.
 */
@Component
public class AESCryptoUtil {

    private static final String ALGORITHM = "AES/GCM/NoPadding";
    private static final int GCM_TAG_LENGTH = 128;
    private static final int IV_LENGTH = 12;
    private static final String V2_PREFIX = "v2:";

    private final SecretKeySpec keySpecV1; // 레거시 복호화 전용 (AES-128, 16바이트 절단)
    private final SecretKeySpec keySpecV2; // 신규 암복호화 (AES-256, SHA-256 파생)

    public AESCryptoUtil(@Value("${exchange.encryption-key}") String encryptionKey) {
        byte[] raw = encryptionKey.getBytes(StandardCharsets.UTF_8);
        this.keySpecV1 = new SecretKeySpec(Arrays.copyOf(raw, 16), "AES");
        try {
            byte[] derived = MessageDigest.getInstance("SHA-256").digest(raw); // 32바이트
            this.keySpecV2 = new SecretKeySpec(derived, "AES");
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 알고리즘을 사용할 수 없습니다.", e);
        }
    }

    public String encrypt(String plainText) {
        if (plainText == null || plainText.isEmpty()) return plainText;
        try {
            byte[] iv = new byte[IV_LENGTH];
            new SecureRandom().nextBytes(iv);

            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.ENCRYPT_MODE, keySpecV2, new GCMParameterSpec(GCM_TAG_LENGTH, iv));
            byte[] encrypted = cipher.doFinal(plainText.getBytes(StandardCharsets.UTF_8));

            byte[] combined = new byte[IV_LENGTH + encrypted.length];
            System.arraycopy(iv, 0, combined, 0, IV_LENGTH);
            System.arraycopy(encrypted, 0, combined, IV_LENGTH, encrypted.length);

            return V2_PREFIX + Base64.getEncoder().encodeToString(combined);
        } catch (Exception e) {
            throw new RuntimeException("암호화 실패", e);
        }
    }

    public String decrypt(String encryptedText) {
        if (encryptedText == null || encryptedText.isEmpty()) return encryptedText;
        try {
            boolean v2 = encryptedText.startsWith(V2_PREFIX);
            String b64 = v2 ? encryptedText.substring(V2_PREFIX.length()) : encryptedText;

            byte[] combined = Base64.getDecoder().decode(b64);
            byte[] iv = Arrays.copyOfRange(combined, 0, IV_LENGTH);
            byte[] encrypted = Arrays.copyOfRange(combined, IV_LENGTH, combined.length);

            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.DECRYPT_MODE, v2 ? keySpecV2 : keySpecV1, new GCMParameterSpec(GCM_TAG_LENGTH, iv));
            byte[] decrypted = cipher.doFinal(encrypted);

            return new String(decrypted, StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new RuntimeException("복호화 실패", e);
        }
    }
}
