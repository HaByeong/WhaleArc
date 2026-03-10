package com.project.whalearc.trade.service;

import com.project.whalearc.market.dto.MarketPriceResponse;
import com.project.whalearc.market.service.CryptoPriceProvider;
import com.project.whalearc.market.service.KisApiClient;
import com.project.whalearc.market.service.StockPriceProvider;
import com.project.whalearc.trade.domain.Order;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Component
@RequiredArgsConstructor
public class LimitOrderScheduler {

    private final OrderService orderService;
    private final CryptoPriceProvider cryptoPriceProvider;
    private final StockPriceProvider stockPriceProvider;
    private final KisApiClient kisApiClient;

    /**
     * 5초마다 대기 중인 지정가 주문을 시장가와 비교하여 자동 체결
     */
    @Scheduled(fixedRate = 5000)
    public void matchLimitOrders() {
        List<Order> pendingOrders = orderService.getPendingLimitOrders();
        if (pendingOrders.isEmpty()) return;

        // 코인 시세
        Map<String, Double> cryptoPriceMap = Map.of();
        boolean hasCrypto = pendingOrders.stream().anyMatch(o -> !o.isStock());
        if (hasCrypto) {
            List<MarketPriceResponse> prices = cryptoPriceProvider.getAllKrwTickers();
            if (!prices.isEmpty()) {
                cryptoPriceMap = prices.stream()
                        .collect(Collectors.toMap(MarketPriceResponse::getSymbol, MarketPriceResponse::getPrice, (a, b) -> a));
            }
        }

        // 주식 시세 (캐시된 인기종목)
        Map<String, Double> stockPriceMap = Map.of();
        boolean hasStock = pendingOrders.stream().anyMatch(Order::isStock);
        if (hasStock) {
            List<MarketPriceResponse> stockPrices = stockPriceProvider.getAllStockPrices();
            if (!stockPrices.isEmpty()) {
                stockPriceMap = stockPrices.stream()
                        .collect(Collectors.toMap(MarketPriceResponse::getSymbol, MarketPriceResponse::getPrice, (a, b) -> a));
            }
        }

        int executed = 0;
        for (Order order : pendingOrders) {
            Double marketPrice;
            if (order.isStock()) {
                marketPrice = stockPriceMap.get(order.getStockCode());
                // 캐시에 없으면 개별 조회
                if (marketPrice == null) {
                    try {
                        Map<String, String> output = kisApiClient.getStockPrice(order.getStockCode());
                        if (output != null) {
                            marketPrice = (double) Long.parseLong(output.get("stck_prpr"));
                        }
                    } catch (Exception e) {
                        log.debug("지정가 주식 시세 조회 실패 [{}]: {}", order.getStockCode(), e.getMessage());
                    }
                }
            } else {
                marketPrice = cryptoPriceMap.get(order.getStockCode());
            }

            if (marketPrice == null) continue;

            try {
                if (orderService.tryExecuteLimitOrder(order, BigDecimal.valueOf(marketPrice))) {
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
