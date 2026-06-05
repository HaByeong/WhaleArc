package com.project.whalearc.live.broker;

import com.project.whalearc.exchange.domain.ExchangeAccount;
import com.project.whalearc.exchange.repository.ExchangeAccountRepository;
import com.project.whalearc.exchange.util.AESCryptoUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * KIS 자격증명을 동업자의 exchange 저장소(exchange_accounts)에서 읽어오는 resolver.
 *
 * <p>자격증명 SSOT를 exchange로 통일(2026-06-05 결정). virt_credentials가 아니라 ExchangeAccount를
 * 단일 출처로 삼는다. ExchangeAccountService.getAccount()는 응답용으로 키를 마스킹('****')하므로,
 * 여기서는 리포지토리에서 raw(암호문)를 직접 읽어 AESCryptoUtil로 복호화한다.
 *
 * <p>KIS 필드 매핑(ExchangeAccountService와 동일): apiKey=appkey, secretKey=appsecret(쌍),
 * accountNumber=계좌번호(평문). 계좌가 "CANO-상품코드" 형태면 분해, 아니면 상품코드 01 기본.
 */
@Component
@RequiredArgsConstructor
public class ExchangeKisCredentialResolver implements KisCredentialResolver {

    private static final String KIS = "KIS";

    private final ExchangeAccountRepository exchangeAccountRepository;
    private final AESCryptoUtil aesCryptoUtil;

    @Override
    public KisPaperCredential resolve(String userId) {
        ExchangeAccount account = exchangeAccountRepository
                .findByUserIdAndExchangeType(userId, KIS)
                .filter(ExchangeAccount::isConnected)
                .orElseThrow(() -> new IllegalStateException(
                        "KIS 계좌가 연결되어 있지 않습니다. 거래소 연동에서 KIS 키를 먼저 등록하세요."));

        String appkey = aesCryptoUtil.decrypt(account.getApiKey());
        String appsecret = aesCryptoUtil.decrypt(account.getSecretKey());

        // 계좌번호: "12345678-01"이면 CANO/상품코드 분해, 아니면 상품코드 01 기본
        String acct = account.getAccountNumber() != null ? account.getAccountNumber().trim() : "";
        String cano = acct;
        String productCode = "01";
        int dash = acct.indexOf('-');
        if (dash > 0) {
            cano = acct.substring(0, dash);
            String tail = acct.substring(dash + 1).trim();
            if (!tail.isEmpty()) productCode = tail;
        }

        return new KisPaperCredential(appkey, appsecret, cano, productCode);
    }
}
