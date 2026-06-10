package com.project.whalearc.live.broker;

import com.project.whalearc.exchange.domain.ExchangeAccount;
import com.project.whalearc.exchange.repository.ExchangeAccountRepository;
import com.project.whalearc.exchange.util.AESCryptoUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * SSOT=exchange 연결 검증 — exchange_accounts의 raw 암호문을 복호화해 KIS 자격증명으로 매핑하고,
 * 계좌번호 "CANO-상품코드"를 분해하며, 미연결 시 거부하는지 확인.
 */
class ExchangeKisCredentialResolverTest {

    private ExchangeAccountRepository repo;
    private AESCryptoUtil aes;
    private ExchangeKisCredentialResolver resolver;

    @BeforeEach
    void setUp() {
        repo = mock(ExchangeAccountRepository.class);
        aes = mock(AESCryptoUtil.class);
        resolver = new ExchangeKisCredentialResolver(repo, aes);
        when(aes.decrypt("encAppkey")).thenReturn("APPKEY");
        when(aes.decrypt("encAppsecret")).thenReturn("APPSECRET");
    }

    private ExchangeAccount kisAccount(String accountNumber) {
        ExchangeAccount a = new ExchangeAccount("u1", "KIS", "encAppkey", "encAppsecret");
        a.setAccountNumber(accountNumber);
        a.setConnected(true);
        return a;
    }

    @Test
    void resolvesAndSplitsAccountNumber() {
        when(repo.findByUserIdAndExchangeType("u1", "KIS")).thenReturn(Optional.of(kisAccount("12345678-01")));

        KisPaperCredential cred = resolver.resolve("u1");

        assertEquals("APPKEY", cred.appkey());
        assertEquals("APPSECRET", cred.appsecret());
        assertEquals("12345678", cred.accountNumber(), "CANO 분해");
        assertEquals("01", cred.productCode());
    }

    @Test
    void defaultsProductCodeWhenNoDash() {
        when(repo.findByUserIdAndExchangeType("u1", "KIS")).thenReturn(Optional.of(kisAccount("87654321")));

        KisPaperCredential cred = resolver.resolve("u1");

        assertEquals("87654321", cred.accountNumber());
        assertEquals("01", cred.productCode(), "상품코드 기본 01");
    }

    @Test
    void rejectsWhenNotConnected() {
        ExchangeAccount notConnected = kisAccount("12345678-01");
        notConnected.setConnected(false);
        when(repo.findByUserIdAndExchangeType("u1", "KIS")).thenReturn(Optional.of(notConnected));

        assertThrows(IllegalStateException.class, () -> resolver.resolve("u1"));
    }

    @Test
    void rejectsWhenMissing() {
        when(repo.findByUserIdAndExchangeType("u1", "KIS")).thenReturn(Optional.empty());

        assertThrows(IllegalStateException.class, () -> resolver.resolve("u1"));
    }
}
