package com.project.whalearc.live.service;

import com.project.whalearc.live.domain.LiveStrategyDeployment;
import com.project.whalearc.trade.domain.Order;
import com.project.whalearc.trade.service.OrderService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

/**
 * 모의(PAPER) 주문 게이트웨이 — 기존 OrderService에 위임해 가상 자금(모의 포트폴리오)으로 체결한다.
 *
 * <p>OrderService.createOrder(MARKET)는 유저별 락 + 잔고 검증 후 즉시 체결(status=FILLED)하고
 * 모의 Portfolio의 cashBalance/holdings를 갱신한다. 터틀이 이미 같은 경로를 쓰므로, 라이브 엔진의
 * 모의 매매도 사용자의 기존 모의 포트폴리오에 그대로 반영된다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MockOrderGateway implements OrderGateway {

    private final OrderService orderService;

    @Override
    public boolean supports(LiveStrategyDeployment.BrokerType brokerType) {
        return brokerType == LiveStrategyDeployment.BrokerType.MOCK;
    }

    @Override
    public Order placeMarketOrder(LiveStrategyDeployment deployment, String userId, String stockCode, String stockName,
                                  Order.OrderType side, BigDecimal quantity, BigDecimal price,
                                  String assetType, String clientOrderId) {
        // 숏(SHORT/COVER)은 모의 현물 포트폴리오(OrderService)로 표현할 수 없으므로, 거래소 호출 없이
        // 요청가에 즉시 체결된 것으로 합성 응답한다. 숏 손익은 배포(LivePosition)가 자체 추적한다.
        if (side == Order.OrderType.SHORT || side == Order.OrderType.COVER) {
            Order o = new Order();
            o.setUserId(userId);
            o.setStockCode(stockCode);
            o.setStockName(stockName);
            o.setOrderType(side);
            o.setQuantity(quantity);
            o.setAssetType(assetType);
            o.setStatus(Order.OrderStatus.FILLED);
            o.setFilledQuantity(quantity);
            o.setFilledPrice(price);
            return o;
        }
        // 롱(BUY/SELL)은 OrderService 가상 체결(시장가)로 모의 포트폴리오에 반영. limitPrice=null(시장가), memo에 멱등키 기록.
        return orderService.createOrder(userId, stockCode, stockName,
                side, Order.OrderMethod.MARKET, quantity, null, assetType, "라이브 자동매매:" + clientOrderId);
    }
}
