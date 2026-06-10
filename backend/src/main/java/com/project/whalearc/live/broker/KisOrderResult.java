package com.project.whalearc.live.broker;

/** KIS 주문 접수 결과. accepted=거래소가 주문을 받았는지, brokerOrderNo=주문번호(ODNO). */
public record KisOrderResult(boolean accepted, String brokerOrderNo, String message) {}
