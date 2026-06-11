package com.project.whalearc.live.broker;

import com.project.whalearc.live.domain.LiveStrategyDeployment;
import com.project.whalearc.live.service.OrderGateway;
import com.project.whalearc.market.service.UsEtfCatalog;
import com.project.whalearc.market.service.UsStockPriceProvider;
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
    private final UsStockPriceProvider usStockPriceProvider;
    private final UsEtfCatalog usEtfCatalog;

    // 미국 지정가 체결 버퍼 — 매수는 +1%, 매도는 -1%. (시장가 미지원 시장에서 체결 가능성↑, 1주 단위라 비용 무시)
    private static final BigDecimal BUY_BUFFER = new BigDecimal("1.01");
    private static final BigDecimal SELL_BUFFER = new BigDecimal("0.99");

    @Override
    public boolean supports(LiveStrategyDeployment.BrokerType brokerType) {
        return brokerType == LiveStrategyDeployment.BrokerType.KIS;
    }

    @Override
    public Order placeMarketOrder(LiveStrategyDeployment deployment, String userId, String stockCode, String stockName,
                                  Order.OrderType side, BigDecimal quantity, BigDecimal price,
                                  String assetType, String clientOrderId) {
        if (side == Order.OrderType.SHORT || side == Order.OrderType.COVER) {
            throw new IllegalStateException("KIS(주식)는 공매도(숏)를 지원하지 않습니다. 롱 전용 전략만 가동하세요.");
        }
        KisPaperCredential cred = credentialResolver.resolve(userId);
        KisOrderResult result;
        if (isUsd(assetType)) {
            // 미국주식/ETF: 해외 지정가 주문(시장가 미지원). 현재가 ± 버퍼를 지정가로.
            String ticker = stockCode.toUpperCase();
            String excg = orderExchangeCode(
                    "ETF".equalsIgnoreCase(assetType) ? usEtfCatalog.getExchange(ticker)
                                                       : usStockPriceProvider.getExchange(ticker));
            BigDecimal limit = price.multiply(side == Order.OrderType.BUY ? BUY_BUFFER : SELL_BUFFER);
            result = kisPaperTradeClient.placeOverseasOrder(cred, side, excg, ticker, quantity, limit);
        } else {
            // 국내주식: 시장가 현금주문
            result = kisPaperTradeClient.placeMarketOrder(cred, side, stockCode, quantity);
        }
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

    /** USD 표시 자산(미국주식/ETF) — 해외주문 경로로 보낸다. */
    private static boolean isUsd(String assetType) {
        return "US_STOCK".equalsIgnoreCase(assetType) || "ETF".equalsIgnoreCase(assetType);
    }

    /** 시세 EXCD(NAS/NYS/AMS) → 해외주문 OVRS_EXCG_CD(NASD/NYSE/AMEX). */
    private static String orderExchangeCode(String excd) {
        if (excd == null) return "NASD";
        return switch (excd.toUpperCase()) {
            case "NYS" -> "NYSE";
            case "AMS" -> "AMEX";
            default -> "NASD";   // NAS 및 기타
        };
    }
}
