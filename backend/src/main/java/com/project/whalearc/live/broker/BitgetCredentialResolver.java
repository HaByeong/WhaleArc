package com.project.whalearc.live.broker;

import com.project.whalearc.exchange.domain.ExchangeAccount;
import com.project.whalearc.exchange.repository.ExchangeAccountRepository;
import com.project.whalearc.exchange.util.AESCryptoUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 비트겟 자격증명을 exchange 저장소(exchange_accounts)에서 읽어오는 resolver.
 *
 * <p>자격증명 SSOT는 exchange로 통일(KIS와 동일 규칙, [[project_whalearc_bitget_live]]).
 * ExchangeAccountService.getAccount()는 응답용으로 키를 마스킹('****')하므로, 여기서는 리포지토리에서
 * raw(암호문)를 직접 읽어 AESCryptoUtil로 복호화한다.
 *
 * <p>Bitget 필드 매핑(ExchangeAccountService와 동일): apiKey=ACCESS-KEY, secretKey=서명용 비밀키,
 * appSecret=ACCESS-PASSPHRASE. Bitget은 passphrase가 필수라 미등록이면 항상 인증 실패한다.
 */
@Component
@RequiredArgsConstructor
public class BitgetCredentialResolver {

    private static final String BITGET = "BITGET";

    private final ExchangeAccountRepository exchangeAccountRepository;
    private final AESCryptoUtil aesCryptoUtil;

    public BitgetCredential resolve(String userId) {
        ExchangeAccount account = exchangeAccountRepository
                .findByUserIdAndExchangeType(userId, BITGET)
                .filter(ExchangeAccount::isConnected)
                .orElseThrow(() -> new IllegalStateException(
                        "Bitget 계좌가 연결되어 있지 않습니다. 거래소 연동에서 Bitget 키(+passphrase)를 먼저 등록하세요."));

        String apiKey = aesCryptoUtil.decrypt(account.getApiKey());
        String secretKey = aesCryptoUtil.decrypt(account.getSecretKey());
        String passphrase = account.getAppSecret() != null ? aesCryptoUtil.decrypt(account.getAppSecret()) : "";
        if (passphrase == null || passphrase.isBlank()) {
            throw new IllegalStateException("Bitget passphrase가 등록되어 있지 않습니다. 거래소 연동에서 passphrase를 추가하세요.");
        }
        return new BitgetCredential(apiKey, secretKey, passphrase);
    }
}
