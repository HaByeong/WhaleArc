package com.project.whalearc.live.broker;

import com.project.whalearc.exchange.service.client.BitgetApiClient;
import com.project.whalearc.exchange.service.client.BitgetApiClient.BitgetFill;
import com.project.whalearc.exchange.service.client.BitgetApiClient.BitgetSymbolInfo;
import com.project.whalearc.live.domain.LiveStrategyDeployment;
import com.project.whalearc.live.service.OrderGateway;
import com.project.whalearc.trade.domain.Order;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * 비트겟(Bitget) 실거래 OrderGateway — 현물(Spot)과 USDT 무기한 선물(Futures, 레버리지)을 모두 처리한다.
 *
 * <p><b>기본 비활성</b> — {@code live.broker.bitget.enabled=true}일 때만 빈으로 등록된다. 비활성이면
 * OrderGateway 목록에 없어 LIVE+BITGET 배포는 LiveStrategyService.resolveGateway에서 거부된다(안전 차단).
 *
 * <p>시장 종류는 배포(deployment.marketType)로 분기한다. 단방향 롱 엔진이라 side=BUY는 진입(open long),
 * side=SELL은 청산(close long)으로 해석한다. 가격은 USDT 기준(엔진이 Bitget 캔들로 평가).
 * <ul>
 *   <li>현물 매수: size=USDT 금액(quote) / 매도: size=코인 수량(base)</li>
 *   <li>선물 개시: 레버리지 설정 후 size=코인 수량(base, 이미 레버리지 반영됨) / 청산: close-positions(holdSide=long)</li>
 * </ul>
 * 주문 접수 후 orderInfo/detail을 폴링해 실제 평균체결가/체결수량을 확정한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "live.broker.bitget.enabled", havingValue = "true")
public class BitgetOrderGateway implements OrderGateway {

    private final BitgetApiClient bitgetApiClient;
    private final BitgetCredentialResolver credentialResolver;

    private static final int FILL_POLL_ATTEMPTS = 5;
    private static final long FILL_POLL_INTERVAL_MS = 400L;

    @Override
    public boolean supports(LiveStrategyDeployment.BrokerType brokerType) {
        return brokerType == LiveStrategyDeployment.BrokerType.BITGET;
    }

    @Override
    public Order placeMarketOrder(LiveStrategyDeployment deployment, String userId, String stockCode, String stockName,
                                  Order.OrderType side, BigDecimal quantity, BigDecimal price,
                                  String assetType, String clientOrderId) {
        BitgetCredential cred = credentialResolver.resolve(userId);
        String symbol = BitgetApiClient.toSpotSymbol(stockCode);   // BTCUSDT (현물·선물 공통)
        if ((side == Order.OrderType.SHORT || side == Order.OrderType.COVER) && !deployment.isFutures()) {
            throw new IllegalStateException("공매도(숏)는 Bitget 선물(FUTURES)에서만 가능합니다. 현물은 롱만 지원합니다.");
        }
        return deployment.isFutures()
                ? futuresOrder(deployment, cred, userId, stockCode, stockName, symbol, side, quantity, price, assetType, clientOrderId)
                : spotOrder(cred, userId, stockCode, stockName, symbol, side, quantity, price, assetType, clientOrderId);
    }

    // ── 현물 ──────────────────────────────────────────────────────────
    private Order spotOrder(BitgetCredential cred, String userId, String stockCode, String stockName, String symbol,
                            Order.OrderType side, BigDecimal quantity, BigDecimal price, String assetType, String clientOrderId) {
        BitgetSymbolInfo info = bitgetApiClient.getSymbolInfo(symbol);
        boolean isBuy = side == Order.OrderType.BUY;

        // 매수: size=USDT 금액(quote) = 수량 × 현재가(USDT). 매도: size=코인 수량(base).
        BigDecimal size;
        if (isBuy) {
            BigDecimal usdt = quantity.multiply(price).setScale(2, RoundingMode.DOWN);
            if (usdt.compareTo(info.minTradeUsdt()) < 0) {
                throw new IllegalStateException("Bitget 최소 주문금액(" + info.minTradeUsdt()
                        + " USDT) 미만입니다. 할당 금액을 늘리세요. 산출=" + usdt + " USDT");
            }
            size = usdt;
        } else {
            size = quantity.setScale(info.quantityPrecision(), RoundingMode.DOWN);
            if (size.compareTo(BigDecimal.ZERO) <= 0) {
                throw new IllegalStateException("Bitget 매도 수량이 최소 단위 미만입니다: " + quantity);
            }
        }

        String clientOid = sanitizeClientOid(clientOrderId);
        log.info("Bitget 현물 주문 시도: userId={}, symbol={}, side={}, size={}({}), clientOid={}",
                userId, symbol, isBuy ? "buy" : "sell", size, isBuy ? "USDT" : "코인", clientOid);
        String orderId = bitgetApiClient.placeSpotMarketOrder(
                cred.apiKey(), cred.secretKey(), cred.passphrase(), symbol, isBuy ? "buy" : "sell", size, clientOid);

        BitgetFill fill = pollSpotFill(cred, orderId);
        BigDecimal avgPrice = fill.avgPrice().signum() > 0 ? fill.avgPrice() : price;
        BigDecimal filledBase = fill.filledBase().signum() > 0 ? fill.filledBase() : (isBuy ? quantity : size);
        return buildOrder(userId, stockCode, stockName, side, quantity, assetType, clientOrderId, orderId, avgPrice, filledBase);
    }

    // ── 선물 ──────────────────────────────────────────────────────────
    private Order futuresOrder(LiveStrategyDeployment d, BitgetCredential cred, String userId, String stockCode, String stockName,
                               String symbol, Order.OrderType side, BigDecimal quantity, BigDecimal price,
                               String assetType, String clientOrderId) {
        // BUY=롱개시, SELL=롱청산, SHORT=숏개시, COVER=숏청산
        boolean isOpen = side == Order.OrderType.BUY || side == Order.OrderType.SHORT;
        boolean isLong = side == Order.OrderType.BUY || side == Order.OrderType.SELL;
        BitgetSymbolInfo info = bitgetApiClient.getFuturesSymbolInfo(symbol);

        if (!isOpen) {
            // 청산: 이 배포의 보유분(quantity)만 reduceOnly로 부분청산. 같은 심볼 다른 배포에 영향 없음.
            BigDecimal held = isLong ? safeLongSize(cred, symbol) : safeShortSize(cred, symbol);
            if (held.signum() <= 0) {
                // 거래소엔 보유 없음(외부/합산 청산됨) — 주문 없이 앱 상태만 동기화(현재가로 근사 정산).
                log.info("Bitget 선물 청산 스킵(거래소 보유 없음, 앱 동기화): symbol={}, dir={}", symbol, isLong ? "long" : "short");
                return buildOrder(userId, stockCode, stockName, side, quantity, assetType, clientOrderId, null, price, quantity);
            }
            BigDecimal closeSize = quantity.min(held).setScale(info.quantityPrecision(), RoundingMode.DOWN);
            if (closeSize.signum() <= 0) {
                log.info("Bitget 선물 청산 스킵(청산 수량 0): symbol={}, quantity={}, held={}", symbol, quantity, held);
                return buildOrder(userId, stockCode, stockName, side, quantity, assetType, clientOrderId, null, price, quantity);
            }
            String closeOid = sanitizeClientOid(clientOrderId);
            log.info("Bitget 선물 부분청산 시도: userId={}, symbol={}, dir={}, closeSize={}코인(held={}), clientOid={}",
                    userId, symbol, isLong ? "long" : "short", closeSize, held, closeOid);
            String orderId = isLong
                    ? bitgetApiClient.closeFuturesLongSize(cred.apiKey(), cred.secretKey(), cred.passphrase(), symbol, closeSize, closeOid)
                    : bitgetApiClient.closeFuturesShortSize(cred.apiKey(), cred.secretKey(), cred.passphrase(), symbol, closeSize, closeOid);
            BitgetFill fill = pollFuturesFill(cred, symbol, orderId);
            BigDecimal avgPrice = fill.avgPrice().signum() > 0 ? fill.avgPrice() : price;
            BigDecimal closedQty = fill.filledBase().signum() > 0 ? fill.filledBase() : closeSize;
            return buildOrder(userId, stockCode, stockName, side, quantity, assetType, clientOrderId, orderId, avgPrice, closedQty);
        }

        // 개시: 레버리지 설정 → 시장가 개시(롱/숏). size=코인 수량(base, 이미 레버리지 반영됨).
        BigDecimal size = quantity.setScale(info.quantityPrecision(), RoundingMode.DOWN);
        if (size.compareTo(BigDecimal.ZERO) <= 0
                || (info.minTradeUsdt().signum() > 0 && size.compareTo(info.minTradeUsdt()) < 0)) {
            throw new IllegalStateException("Bitget 선물 주문 수량이 최소 단위 미만입니다: " + size
                    + " (최소 " + info.minTradeUsdt() + ")");
        }
        // 레버리지를 확실히 적용하기 위해 개시 전 두 가지를 맞춘다(둘 다 5배→10배로 잡히던 원인):
        //  ① 마진모드를 주문과 동일한 isolated로 — 레버리지는 (심볼,마진모드)별로 따로 보관돼, 심볼이 crossed면
        //     set-leverage가 crossed에 적용되고 주문(isolated)은 isolated의 기존 레버리지로 체결된다.
        //  ② 롱·숏 양쪽 레버리지를 모두 목표값으로 — 크로스 마진은 양 사이드가 같아야 하고, 한 면만 바꾸면
        //     반대 면(기존 10배)과 불일치로 set-leverage가 거부되고 기존 레버리지로 체결된다(터틀은 롱·숏 모두 사용).
        bitgetApiClient.setFuturesIsolatedMode(cred.apiKey(), cred.secretKey(), cred.passphrase(), symbol);
        int targetLev = d.effectiveLeverage();
        boolean okLong = bitgetApiClient.setFuturesLeverage(cred.apiKey(), cred.secretKey(), cred.passphrase(), symbol, targetLev, "long");
        boolean okShort = bitgetApiClient.setFuturesLeverage(cred.apiKey(), cred.secretKey(), cred.passphrase(), symbol, targetLev, "short");
        // 여는 방향의 레버리지 설정이 실패하면 거래소의 기존 레버리지로 체결될 수 있어 명확히 경고한다(이전엔 stderr로만 묻혔음).
        if (isLong ? !okLong : !okShort) {
            log.warn("Bitget 레버리지 {}x 설정 실패: symbol={}, dir={}, long={}, short={} — 거래소 기존 레버리지로 체결될 수 있음(포지션 보유 중이거나 마진모드 확인)",
                    targetLev, symbol, isLong ? "long" : "short", okLong, okShort);
        }
        // set-leverage가 거래소에 전파될 때까지 짧게 확인한 뒤 개시한다.
        // (set-leverage 응답은 성공인데, 직후 즉시 나간 개시 주문이 '옛 레버리지'로 체결되는 전파 지연 방지 —
        //  거래소 페이지엔 5배로 보이는데 실제 포지션은 10배로 잡히던 현상.) 확인되면 즉시, 미확인이어도 최대 ~1.5s 후 진행.
        for (int i = 0; i < 6; i++) {
            if (bitgetApiClient.getConfiguredFuturesLeverage(cred.apiKey(), cred.secretKey(), cred.passphrase(), symbol, isLong) == targetLev) break;
            try { Thread.sleep(250); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); break; }
        }

        String clientOid = sanitizeClientOid(clientOrderId);
        log.info("Bitget 선물 개시 시도: userId={}, symbol={}, dir={}, size={}코인, leverage={}x, clientOid={}",
                userId, symbol, isLong ? "long" : "short", size, d.effectiveLeverage(), clientOid);
        String orderId = isLong
                ? bitgetApiClient.openFuturesLong(cred.apiKey(), cred.secretKey(), cred.passphrase(), symbol, size, clientOid)
                : bitgetApiClient.openFuturesShort(cred.apiKey(), cred.secretKey(), cred.passphrase(), symbol, size, clientOid);

        BitgetFill fill = pollFuturesFill(cred, symbol, orderId);
        BigDecimal avgPrice = fill.avgPrice().signum() > 0 ? fill.avgPrice() : price;
        BigDecimal filledBase = fill.filledBase().signum() > 0 ? fill.filledBase() : size;
        return buildOrder(userId, stockCode, stockName, side, quantity, assetType, clientOrderId, orderId, avgPrice, filledBase);
    }

    private BigDecimal safeLongSize(BitgetCredential cred, String symbol) {
        try {
            return bitgetApiClient.getFuturesLongSize(cred.apiKey(), cred.secretKey(), cred.passphrase(), symbol);
        } catch (Exception e) {
            log.warn("Bitget 선물 롱 보유수량 조회 실패(청산 진행): symbol={}, error={}", symbol, e.getMessage());
            return BigDecimal.ZERO;
        }
    }

    private BigDecimal safeShortSize(BitgetCredential cred, String symbol) {
        try {
            return bitgetApiClient.getFuturesShortSize(cred.apiKey(), cred.secretKey(), cred.passphrase(), symbol);
        } catch (Exception e) {
            log.warn("Bitget 선물 숏 보유수량 조회 실패(청산 진행): symbol={}, error={}", symbol, e.getMessage());
            return BigDecimal.ZERO;
        }
    }

    private Order buildOrder(String userId, String stockCode, String stockName, Order.OrderType side,
                             BigDecimal quantity, String assetType, String clientOrderId,
                             String orderId, BigDecimal avgPrice, BigDecimal filledBase) {
        Order order = new Order();
        order.setUserId(userId);
        order.setStockCode(stockCode);
        order.setStockName(stockName);
        order.setOrderType(side);
        order.setQuantity(quantity);
        order.setAssetType(assetType);
        order.setStatus(Order.OrderStatus.FILLED);
        order.setFilledQuantity(filledBase);
        order.setFilledPrice(avgPrice);
        order.setClientOrderId(clientOrderId);
        order.setId(orderId);
        return order;
    }

    private BitgetFill pollSpotFill(BitgetCredential cred, String orderId) {
        BitgetFill last = emptyFill();
        for (int i = 0; i < FILL_POLL_ATTEMPTS; i++) {
            if (!sleep()) break;
            try {
                last = bitgetApiClient.getSpotOrderInfo(cred.apiKey(), cred.secretKey(), cred.passphrase(), orderId);
                if ("filled".equalsIgnoreCase(last.status()) && last.filledBase().signum() > 0) return last;
            } catch (Exception e) {
                log.warn("Bitget 현물 체결 조회 실패(재시도): orderId={}, error={}", orderId, e.getMessage());
            }
        }
        log.warn("Bitget 현물 체결 미확정(평가가로 근사): orderId={}, lastStatus={}", orderId, last.status());
        return last;
    }

    private BitgetFill pollFuturesFill(BitgetCredential cred, String symbol, String orderId) {
        BitgetFill last = emptyFill();
        for (int i = 0; i < FILL_POLL_ATTEMPTS; i++) {
            if (!sleep()) break;
            try {
                last = bitgetApiClient.getFuturesOrderInfo(cred.apiKey(), cred.secretKey(), cred.passphrase(), symbol, orderId);
                if ("filled".equalsIgnoreCase(last.status()) && last.filledBase().signum() > 0) return last;
            } catch (Exception e) {
                log.warn("Bitget 선물 체결 조회 실패(재시도): orderId={}, error={}", orderId, e.getMessage());
            }
        }
        log.warn("Bitget 선물 체결 미확정(평가가로 근사): orderId={}, lastStatus={}", orderId, last.status());
        return last;
    }

    private static boolean sleep() {
        try {
            Thread.sleep(FILL_POLL_INTERVAL_MS);
            return true;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }

    private static BitgetFill emptyFill() {
        return new BitgetFill("unknown", BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);
    }

    /** Bitget clientOid 규격(영숫자/-/_, 길이 제한)에 맞게 멱등키를 정제. */
    private static String sanitizeClientOid(String clientOrderId) {
        if (clientOrderId == null) return null;
        String s = clientOrderId.replaceAll("[^A-Za-z0-9_-]", "");
        return s.length() > 50 ? s.substring(s.length() - 50) : s;
    }
}
