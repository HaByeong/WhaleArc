package com.project.whalearc.trade.service;

import com.project.whalearc.market.dto.MarketPriceResponse;
import com.project.whalearc.market.service.CryptoPriceProvider;
import com.project.whalearc.trade.domain.Order;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Component
@RequiredArgsConstructor
public class LimitOrderScheduler {

    private final OrderService orderService;
    private final CryptoPriceProvider cryptoPriceProvider;

    /**
     * 5초마다 대기 중인 지정가 주문을 시장가와 비교하여 자동 체결
     */
    @Scheduled(fixedRate = 5000)
    public void matchLimitOrders() {
        List<Order> pendingOrders = orderService.getPendingLimitOrders();
        if (pendingOrders.isEmpty()) return;

        List<MarketPriceResponse> prices = cryptoPriceProvider.getAllKrwTickers();
        if (prices.isEmpty()) return;

        Map<String, Double> priceMap = prices.stream()
                .collect(Collectors.toMap(MarketPriceResponse::getSymbol, MarketPriceResponse::getPrice));

        int executed = 0;
        for (Order order : pendingOrders) {
            Double marketPrice = priceMap.get(order.getStockCode());
            if (marketPrice == null) continue;

            try {
                if (orderService.tryExecuteLimitOrder(order, marketPrice)) {
                    executed++;
                }
            } catch (Exception e) {
                log.error("지정가 주문 자동 체결 오류 [{}]: {}", order.getId(), e.getMessage());
            }
        }

        if (executed > 0) {
            log.info("지정가 주문 자동 체결 완료: {}건 / 대기 {}건", executed, pendingOrders.size());
        }
    }
}
