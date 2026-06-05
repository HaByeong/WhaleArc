package com.project.whalearc.live.broker;

/**
 * KIS(한국투자증권) 모의투자 주문에 필요한 자격증명.
 *
 * <p>자격증명 출처(virt / exchange 중 SSOT)에 독립적인 값 객체. KisCredentialResolver 구현체가
 * 어느 저장소에서든 이 형태로 만들어 KisPaperTradeClient에 넘긴다.
 */
public record KisPaperCredential(
        String appkey,
        String appsecret,
        String accountNumber,   // CANO (계좌 8자리)
        String productCode      // ACNT_PRDT_CD (상품코드 2자리, 기본 01)
) {}
