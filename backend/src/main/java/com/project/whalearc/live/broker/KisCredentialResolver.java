package com.project.whalearc.live.broker;

/**
 * 라이브 자동매매가 사용할 KIS 모의투자 자격증명의 출처 추상화.
 *
 * <p>현재 자격증명 저장소가 둘(기존 virt_credentials, 신규 exchange_accounts)로 중복돼 있어 SSOT가
 * 미정이다. 이 인터페이스를 두어 KisOrderGateway가 출처에 의존하지 않게 하고, SSOT가 정해지면
 * virt 또는 exchange를 읽는 구현체 하나만 추가해 연결한다. (구현체 없으면 KisOrderGateway는
 * 비활성이라 컨텍스트에 영향 없음)
 */
public interface KisCredentialResolver {

    /** 유저의 KIS 모의투자 자격증명을 해석. 미연결/미등록이면 IllegalStateException 등으로 알린다. */
    KisPaperCredential resolve(String userId);
}
