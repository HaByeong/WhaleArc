package com.project.whalearc.live.broker;

import com.project.whalearc.live.domain.LiveStrategyDeployment;
import com.project.whalearc.live.service.OrderGateway;
import com.project.whalearc.trade.domain.Order;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

/**
 * KIS(한국투자증권) 실거래/모의투자 OrderGateway.
 *
 * <p><b>기본 비활성</b> — {@code live.broker.kis.enabled=true}일 때만 빈으로 등록된다. 비활성 상태에선
 * OrderGateway 목록에 포함되지 않으므로 LIVE+KIS 배포는 여전히 LiveStrategyService.resolveGateway에서
 * 거부된다(안전 차단 유지). 자격증명 SSOT(virt/exchange)가 정해지고 KisCredentialResolver 구현체가
 * 붙은 뒤에만 플래그를 켠다.
 *
 * <p>현재는 주문 "접수"까지 처리한다. 접수 성공 시 엔진엔 FILLED로 보고하되 체결가(filledPrice)는 비워
 * 둔다 → LiveStrategyService가 평가 시점 현재가로 평단을 근사한다. 실제 체결가/부분체결 확정은
 * 체결 확인(주문조회 폴링) 단계에서 보강 예정.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "live.broker.kis.enabled", havingValue = "true")
public class KisOrderGateway implements OrderGateway {

    private final KisPaperTradeClient kisPaperTradeClient;
    private final KisCredentialResolver credentialResolver;

    @Override
    public boolean supports(LiveStrategyDeployment.BrokerType brokerType) {
        return brokerType == LiveStrategyDeployment.BrokerType.KIS;
    }

    @Override
    public Order placeMarketOrder(String userId, String stockCode, String stockName,
                                  Order.OrderType side, BigDecimal quantity, String assetType, String clientOrderId) {
        KisPaperCredential cred = credentialResolver.resolve(userId);
        KisOrderResult result = kisPaperTradeClient.placeMarketOrder(cred, side, stockCode, quantity);
        if (!result.accepted()) {
            throw new IllegalStateException("KIS 주문 거부: " + result.message());
        }
        // 접수 성공 → 엔진엔 체결로 보고(체결가는 추후 주문조회로 확정). brokerOrderNo를 원장 식별자로.
        Order order = new Order();
        order.setUserId(userId);
        order.setStockCode(stockCode);
        order.setStockName(stockName);
        order.setOrderType(side);
        order.setQuantity(quantity);
        order.setAssetType(assetType);
        order.setStatus(Order.OrderStatus.FILLED);
        order.setFilledQuantity(quantity);
        order.setId(result.brokerOrderNo());
        return order;
    }
}
