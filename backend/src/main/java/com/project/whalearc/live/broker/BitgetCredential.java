package com.project.whalearc.live.broker;

/**
 * 비트겟(Bitget) 주문에 필요한 자격증명 값 객체.
 *
 * <p>Bitget은 3요소 인증(apiKey + secretKey + passphrase)을 쓴다. passphrase는 서명에 포함되지 않고
 * ACCESS-PASSPHRASE 헤더로 별도 전달된다(누락 시 항상 인증 실패). BitgetCredentialResolver가
 * exchange_accounts에서 복호화해 이 형태로 만들어 BitgetOrderGateway에 넘긴다.
 */
public record BitgetCredential(
        String apiKey,
        String secretKey,
        String passphrase
) {}
