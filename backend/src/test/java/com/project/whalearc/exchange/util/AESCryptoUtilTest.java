package com.project.whalearc.exchange.util;

import org.junit.jupiter.api.Test;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;

/**
 * AES 버전드 마이그레이션 검증:
 *  - v2(신규, AES-256/SHA-256) 암복호화 라운드트립
 *  - v1(레거시, AES-128/16바이트 절단) 암호문이 그대로 복호화되는 하위호환
 */
class AESCryptoUtilTest {

    private static final String KEY = "dev-local-exchange-encryption-key-32";

    @Test
    void v2RoundTrip() {
        AESCryptoUtil util = new AESCryptoUtil(KEY);
        String plain = "PSrF6zybjYoGhcnDN3UFk4hsRgOI4aGOHAiS-비밀값";
        String enc = util.encrypt(plain);

        assertTrue(enc.startsWith("v2:"), "신규 암호문은 v2 접두를 가져야 함");
        assertEquals(plain, util.decrypt(enc), "v2 암복호화 라운드트립이 일치해야 함");
        // 동일 평문이라도 IV 랜덤이라 암호문은 매번 달라야 함
        assertNotEquals(enc, util.encrypt(plain), "IV 랜덤으로 매번 다른 암호문이어야 함");
    }

    @Test
    void decryptsLegacyV1Ciphertext() throws Exception {
        // 과거 v1 포맷(16바이트 절단 AES-128, 접두 없음)으로 직접 암호화한 데이터
        String plain = "legacy-secret-value-12345";
        byte[] keyBytes = Arrays.copyOf(KEY.getBytes(StandardCharsets.UTF_8), 16);
        SecretKeySpec ks = new SecretKeySpec(keyBytes, "AES");
        byte[] iv = new byte[12];
        new SecureRandom().nextBytes(iv);
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.ENCRYPT_MODE, ks, new GCMParameterSpec(128, iv));
        byte[] enc = c.doFinal(plain.getBytes(StandardCharsets.UTF_8));
        byte[] combined = new byte[12 + enc.length];
        System.arraycopy(iv, 0, combined, 0, 12);
        System.arraycopy(enc, 0, combined, 12, enc.length);
        String v1Ciphertext = Base64.getEncoder().encodeToString(combined); // 접두 없음

        AESCryptoUtil util = new AESCryptoUtil(KEY);
        assertEquals(plain, util.decrypt(v1Ciphertext), "v1 레거시 암호문이 그대로 복호화돼야 함(자격증명 보존)");
    }

    @Test
    void nullAndEmptyPassthrough() {
        AESCryptoUtil util = new AESCryptoUtil(KEY);
        assertNull(util.encrypt(null));
        assertEquals("", util.encrypt(""));
        assertNull(util.decrypt(null));
    }
}
