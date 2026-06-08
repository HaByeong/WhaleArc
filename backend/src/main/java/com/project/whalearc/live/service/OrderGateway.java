package com.project.whalearc.live.service;

import com.project.whalearc.live.domain.LiveStrategyDeployment;
import com.project.whalearc.trade.domain.Order;

import java.math.BigDecimal;

/**
 * 라이브 엔진이 주문을 내는 단일 통로 추상화.
 *
 * <p>라이브 엔진(LiveStrategyService)은 이 인터페이스에만 의존하므로, 모의(PAPER)↔실계좌(LIVE)
 * 전환이 구현체 교체로 끝난다. 1단계에서는 MockOrderGateway(기존 OrderService 가상 체결 위임)만
 * 존재하고, 이후 KisOrderGateway/UpbitOrderGateway/BitgetOrderGateway가 같은 계약을 구현한다.
 */
public interface OrderGateway {

    /** 이 게이트웨이가 처리하는 브로커 타입인지. */
    boolean supports(LiveStrategyDeployment.BrokerType brokerType);

    /**
     * 시장가 주문 발주. 동기 체결 시 status=FILLED인 Order를 반환한다.
     * @param price 평가 시점 네이티브 현재가(미국주식=USD, 그 외 KRW). 미국처럼 시장가가 없는 시장에서
     *              지정가 산출에 쓴다. 국내·코인 시장가 게이트웨이는 무시 가능.
     * @param clientOrderId 멱등키 — 실거래 게이트웨이는 거래소에 이 값을 전달해 중복 발주를 막는다.
     * @return 발주 결과 Order (체결 여부는 status로 판단). 실패 시 예외를 던질 수 있음.
     */
    Order placeMarketOrder(String userId, String stockCode, String stockName,
                           Order.OrderType side, BigDecimal quantity, BigDecimal price,
                           String assetType, String clientOrderId);
}
