package com.project.whalearc.strategy.service;

import com.project.whalearc.market.dto.CandlestickResponse;
import com.project.whalearc.market.dto.MarketPriceResponse;
import com.project.whalearc.market.service.CandlestickService;
import com.project.whalearc.market.service.CryptoPriceProvider;
import com.project.whalearc.notification.domain.Notification;
import com.project.whalearc.notification.service.NotificationService;
import com.project.whalearc.strategy.domain.TurtlePosition;
import com.project.whalearc.strategy.repository.TurtlePositionRepository;
import com.project.whalearc.trade.domain.Holding;
import com.project.whalearc.trade.domain.Order;
import com.project.whalearc.trade.domain.Portfolio;
import com.project.whalearc.trade.service.OrderService;
import com.project.whalearc.trade.service.PortfolioService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * 터틀 트레이딩 전략 엔진
 *
 * Python backtest_turtle.py 로직을 완전히 동일하게 포팅한 구현체입니다.
 * Donchian Channel Breakout + ADX 필터를 핵심으로 하며,
 * ATR 기반 포지션 사이징 / 피라미딩 / 트레일링 스탑을 구현합니다.
 *
 * 파라미터는 서버 사이드에만 존재하며 프론트엔드에 노출되지 않습니다.
 *
 * ── 원본(Python) 대비 의도적 차이점 ──
 * 1. Long-Only: 현물 시뮬레이션 플랫폼이므로 공매도(Short) 불가.
 *    하락장에서는 포지션을 잡지 않고 관망합니다.
 * 2. Leverage 미적용: 현물 거래는 1배 고정이므로 leverage 변수를 제거.
 *    유닛 사이징 공식에서 ÷leverage 생략 (÷1과 동일).
 *    수익률은 선물(7x) 대비 낮지만 리스크도 1/7이며,
 *    unitWeight 상한(0.9/MAX_UNITS)으로 과집중 방지.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TurtleStrategyService {

    private final CandlestickService candlestickService;
    private final CryptoPriceProvider cryptoPriceProvider;
    private final TurtlePositionRepository positionRepository;
    private final OrderService orderService;
    private final PortfolioService portfolioService;
    private final NotificationService notificationService;

    // ── 전략 파라미터 (최적화된 A3 기준) ──
    private static final int ENTRY_PERIOD = 100;   // 100시간 진입 채널
    private static final int EXIT_PERIOD = 30;     // 30시간 청산 채널
    private static final int ADX_PERIOD = 14;      // ADX 기간
    private static final double ADX_THRESHOLD = 15; // ADX 임계값
    private static final double RISK_PER_TRADE = 0.04; // 4% 리스크
    private static final int MAX_UNITS = 5;        // 최대 피라미딩 유닛
    private static final double SL_MUL = 1.75;     // 손절 배수 (1.75 ATR)
    private static final double TRAIL_PCT = 0.04;  // 트레일링 스탑 4%
    private static final double FEE_RATE = 0.0008; // 수수료 0.08% (진입 0.04% + 청산 0.04%)
    private static final double SLIPPAGE = 0.0001; // 슬리피지 0.01%

    /**
     * 특정 심볼에 대한 터틀 시그널을 체크하고 포지션을 관리합니다.
     * 1시간봉 캔들 데이터를 기반으로 동작합니다.
     */
    public void checkAndExecute(TurtlePosition pos) {
        List<CandlestickResponse> candles = candlestickService.getCandlesticks(pos.getSymbol(), "1h");
        if (candles.size() < ENTRY_PERIOD + ADX_PERIOD + 11) {
            log.debug("터틀: 캔들 데이터 부족 symbol={}, size={}", pos.getSymbol(), candles.size());
            return;
        }

        // 기술 지표 계산
        double[] highs = candles.stream().mapToDouble(CandlestickResponse::getHigh).toArray();
        double[] lows = candles.stream().mapToDouble(CandlestickResponse::getLow).toArray();
        double[] closes = candles.stream().mapToDouble(CandlestickResponse::getClose).toArray();

        double[] atr = calculateATR(highs, lows, closes, ADX_PERIOD);
        double[] adx = calculateADX(highs, lows, closes, ADX_PERIOD);

        int last = candles.size() - 2; // 마지막 '종가 확정' 캔들 — 진행 중(미확정) 캔들로 신호를 평가하지 않음(백테스트·자동매매와 동일)
        int prev = last - 1;

        double currPrice = closes[last];
        double currHigh = highs[last];
        double currATR = atr[last];
        double prevATR = atr[prev];  // 진입 시 이전 봉 ATR 사용 (Python 동일)
        double prevADX = adx[prev];

        // Donchian Channel
        double entryHigh = rollingMax(highs, last, ENTRY_PERIOD);
        double exitLow = rollingMin(lows, last, EXIT_PERIOD);

        if (currATR <= 0 || Double.isNaN(currATR) || Double.isNaN(prevADX)) return;

        // ── self-heal: 포지션 상태를 실제 보유 수량과 화해 (주문↔포지션 부분 실패로 인한 발산 방지) ──
        BigDecimal heldQty;
        try {
            heldQty = portfolioService.getHoldingQuantity(pos.getUserId(), pos.getSymbol());
        } catch (Exception e) {
            log.warn("터틀 보유 조회 실패, 이번 틱 스킵: symbol={}, {}", pos.getSymbol(), e.getMessage());
            return; // 보유 상태 불확실 → 아무 행동도 하지 않음
        }
        boolean hasHolding = heldQty.compareTo(new BigDecimal("0.0000001")) > 0;
        if (pos.getDirection() == TurtlePosition.Direction.LONG && !hasHolding) {
            // LONG인데 실제 보유가 없음 → 이미 청산됐으나 포지션 미반영. NONE 복구 후 이번 틱 관리 스킵.
            log.warn("터틀 self-heal: LONG인데 보유 없음 → NONE 복구. userId={}, symbol={}", pos.getUserId(), pos.getSymbol());
            flatten(pos);
            return;
        }
        if (pos.getDirection() == TurtlePosition.Direction.NONE && hasHolding) {
            // NONE인데 보유가 있음 → 진입은 됐으나 포지션 미반영(또는 청산 실패 잔여). 중복 매수 방지로 이번 틱 진입 스킵.
            log.warn("터틀 self-heal: NONE인데 보유 있음 → 중복 매수 방지로 이번 틱 스킵. userId={}, symbol={}", pos.getUserId(), pos.getSymbol());
            return;
        }

        if (pos.getDirection() == TurtlePosition.Direction.NONE) {
            // ── 신규 진입 ──
            boolean longSignal = currHigh >= entryHigh && prevADX > ADX_THRESHOLD;

            if (longSignal && entryHigh > 0) {
                // 라이브 정확성: 진입가 기준을 브레이크아웃 레벨(entryHigh)이 아니라 실제 체결가(시장가=현재가)로 둔다.
                // 백테스트 포팅은 high_break를 쓰지만, 라이브는 갭 상승 시 평단·손절·사이징이 왜곡되므로 분리한다.
                // (브레이크아웃 트리거 longSignal=currHigh>=entryHigh 는 그대로 — 트리거 레벨과 체결가는 별개)
                double entryPriceCandidate = currPrice;

                // volatility 분모도 체결가 기준 → 사이징이 의도한 거래당 리스크(SL거리×수량)를 정확히 달성.
                double volatility = prevATR / entryPriceCandidate;
                if (volatility <= 0) return;

                double unitWeight = (RISK_PER_TRADE / MAX_UNITS) / (SL_MUL * volatility);
                unitWeight = Math.min(unitWeight, 0.9 / MAX_UNITS);

                double buyAmount = pos.getAllocatedCash().doubleValue() * unitWeight;
                if (buyAmount < 1000) return; // 최소 1000원

                double quantity = buyAmount / (currPrice * (1 + FEE_RATE));
                quantity = Math.floor(quantity * 100000000.0) / 100000000.0;
                if (quantity <= 0) return;

                try {
                    orderService.createOrder(pos.getUserId(), pos.getSymbol(),
                            getSymbolName(pos.getSymbol()),
                            Order.OrderType.BUY, Order.OrderMethod.MARKET, BigDecimal.valueOf(quantity), null);

                    // 진입가/평단가/손절/트레일기준 모두 실제 체결가(currPrice) 기준 — 라이브 장부 정확성.
                    BigDecimal entryPriceBd = BigDecimal.valueOf(entryPriceCandidate);
                    pos.setDirection(TurtlePosition.Direction.LONG);
                    pos.setEntryPrice(entryPriceBd);
                    pos.setLastEntryPrice(entryPriceBd);
                    pos.setAvgPrice(entryPriceBd);
                    pos.setUnits(1);
                    pos.setUnitWeight(BigDecimal.valueOf(unitWeight));
                    pos.setStopLoss(BigDecimal.valueOf(entryPriceCandidate - SL_MUL * prevATR));
                    pos.setTrailRef(entryPriceBd);
                    pos.setTradeCount(pos.getTradeCount() + 1);
                    pos.setUpdatedAt(Instant.now());
                    positionRepository.save(pos);

                    log.info("터틀 진입: userId={}, symbol={}, entryPrice={}, qty={}, ADX={}",
                            pos.getUserId(), pos.getSymbol(), entryPriceCandidate, quantity, prevADX);

                    notificationService.createNotificationWithMeta(
                            pos.getUserId(),
                            Notification.NotificationType.TURTLE_TRADE,
                            "터틀 매수 진입",
                            pos.getSymbol() + " " + String.format("%,.0f", entryPriceCandidate) + "원에 진입했습니다.",
                            Map.of("symbol", pos.getSymbol(), "action", "ENTRY", "price", String.valueOf(entryPriceCandidate))
                    );
                } catch (Exception e) {
                    log.warn("터틀 진입 실패: symbol={}, reason={}", pos.getSymbol(), e.getMessage());
                }
            }

        } else if (pos.getDirection() == TurtlePosition.Direction.LONG) {
            // ── 포지션 관리 ──

            // A. 피라미딩
            if (pos.getUnits() < MAX_UNITS && currPrice > pos.getLastEntryPrice().doubleValue() + currATR) {
                double buyAmount = pos.getAllocatedCash().doubleValue() * pos.getUnitWeight().doubleValue();
                double quantity = buyAmount / (currPrice * (1 + FEE_RATE));
                quantity = Math.floor(quantity * 100000000.0) / 100000000.0;

                if (quantity > 0 && buyAmount >= 1000) {
                    try {
                        orderService.createOrder(pos.getUserId(), pos.getSymbol(),
                                getSymbolName(pos.getSymbol()),
                                Order.OrderType.BUY, Order.OrderMethod.MARKET, BigDecimal.valueOf(quantity), null);

                        double oldCost = pos.getAvgPrice().doubleValue() * pos.getUnits();
                        pos.setUnits(pos.getUnits() + 1);
                        pos.setLastEntryPrice(BigDecimal.valueOf(currPrice));
                        pos.setAvgPrice(BigDecimal.valueOf((oldCost + currPrice) / pos.getUnits()));
                        pos.setStopLoss(BigDecimal.valueOf(currPrice - SL_MUL * currATR));
                        pos.setUpdatedAt(Instant.now());
                        positionRepository.save(pos);

                        log.info("터틀 피라미딩: symbol={}, unit={}, price={}", pos.getSymbol(), pos.getUnits(), currPrice);
                    } catch (Exception e) {
                        log.warn("터틀 피라미딩 실패: {}", e.getMessage());
                    }
                }
            }

            // 트레일링 스탑 업데이트
            if (pos.getTrailRef() != null) {
                pos.setTrailRef(pos.getTrailRef().max(BigDecimal.valueOf(currPrice)));
                double trailStop = pos.getTrailRef().doubleValue() * (1 - TRAIL_PCT);
                pos.setStopLoss(pos.getStopLoss().max(BigDecimal.valueOf(trailStop)));
            }

            // B. 손절 체크
            boolean stopHit = currPrice < pos.getStopLoss().doubleValue();
            // C. Exit Channel 이탈
            boolean exitHit = currPrice < exitLow;

            if (stopHit || exitHit) {
                sellAll(pos, currPrice, stopHit ? "STOP" : "EXIT_CHANNEL");
            } else {
                pos.setUpdatedAt(Instant.now());
                positionRepository.save(pos);
            }
        }
    }

    /** 포지션을 보유 없음(NONE) 상태로 초기화 — 실제 보유가 없는데 LONG으로 남은 경우의 self-heal. */
    private void flatten(TurtlePosition pos) {
        pos.setDirection(TurtlePosition.Direction.NONE);
        pos.setUnits(0);
        pos.setEntryPrice(BigDecimal.ZERO);
        pos.setLastEntryPrice(BigDecimal.ZERO);
        pos.setAvgPrice(BigDecimal.ZERO);
        pos.setStopLoss(BigDecimal.ZERO);
        pos.setTrailRef(null);
        pos.setUnitWeight(BigDecimal.ZERO);
        pos.setUpdatedAt(Instant.now());
        positionRepository.save(pos);
    }

    /**
     * 포지션 전량 청산
     */
    private void sellAll(TurtlePosition pos, double price, String reason) {
        Portfolio portfolio = portfolioService.getOrCreatePortfolio(pos.getUserId());
        Holding holding = portfolio.getHoldings().stream()
                .filter(h -> h.getStockCode().equals(pos.getSymbol()))
                .findFirst().orElse(null);

        if (holding != null && holding.getQuantity().compareTo(new BigDecimal("0.0000001")) > 0) {
            try {
                // Python 동일: 손절 시 슬리피지 적용
                double exitPrice = "STOP".equals(reason)
                        ? price * (1 - SLIPPAGE)
                        : price;

                orderService.createOrder(pos.getUserId(), pos.getSymbol(),
                        getSymbolName(pos.getSymbol()),
                        Order.OrderType.SELL, Order.OrderMethod.MARKET,
                        holding.getQuantity(), null);

                double avgPriceD = pos.getAvgPrice().doubleValue();
                double pnl = (exitPrice - avgPriceD) / avgPriceD;
                // Python 동일: Exit Channel 청산에서만 승수 카운트 (손절 시 미카운트)
                if (!"STOP".equals(reason) && pnl > 0) {
                    pos.setWinCount(pos.getWinCount() + 1);
                }
                pos.setRealizedPnl(pos.getRealizedPnl().add(
                        BigDecimal.valueOf(pnl * pos.getUnitWeight().doubleValue() * pos.getUnits())));

                log.info("터틀 청산 [{}]: symbol={}, price={}, avgPrice={}, pnl={}%, units={}",
                        reason, pos.getSymbol(), exitPrice, pos.getAvgPrice(),
                        String.format("%.2f", pnl * 100), pos.getUnits());

                String reasonLabel = "STOP".equals(reason) ? "손절" : "채널 이탈";
                String pnlStr = String.format("%+.2f%%", pnl * 100);
                notificationService.createNotificationWithMeta(
                        pos.getUserId(),
                        Notification.NotificationType.TURTLE_TRADE,
                        "터틀 청산 (" + reasonLabel + ")",
                        pos.getSymbol() + " 전량 청산 완료. 수익률 " + pnlStr,
                        Map.of("symbol", pos.getSymbol(), "action", "EXIT", "reason", reason,
                               "pnl", String.format("%.2f", pnl * 100))
                );
            } catch (Exception e) {
                log.warn("터틀 청산 실패: symbol={}, reason={}", pos.getSymbol(), e.getMessage());
            }
        }

        pos.setDirection(TurtlePosition.Direction.NONE);
        pos.setUnits(0);
        pos.setEntryPrice(BigDecimal.ZERO);
        pos.setLastEntryPrice(BigDecimal.ZERO);
        pos.setAvgPrice(BigDecimal.ZERO);
        pos.setStopLoss(BigDecimal.ZERO);
        pos.setTrailRef(null);
        pos.setUnitWeight(BigDecimal.ZERO);
        pos.setUpdatedAt(Instant.now());
        positionRepository.save(pos);
    }

    /**
     * 항로 취소 시 모든 터틀 포지션 청산
     */
    public void closeAllPositions(String purchaseId) {
        List<TurtlePosition> positions = positionRepository.findByPurchaseId(purchaseId);
        // 시세는 루프 밖에서 1회만 조회해 symbol→price 맵 구성(N+1 외부 호출 제거)
        Map<String, Double> priceMap = cryptoPriceProvider.getAllKrwTickers().stream()
                .collect(java.util.stream.Collectors.toMap(
                        MarketPriceResponse::getSymbol, MarketPriceResponse::getPrice, (a, b) -> a));
        for (TurtlePosition pos : positions) {
            if (pos.getDirection() == TurtlePosition.Direction.LONG) {
                double currentPrice = priceMap.getOrDefault(pos.getSymbol(), 0.0);
                if (currentPrice > 0) {
                    sellAll(pos, currentPrice, "CANCEL");
                }
            }
        }
        positionRepository.deleteByPurchaseId(purchaseId);
    }

    /**
     * 항로 구매 시 터틀 포지션 초기화 (매수는 하지 않음 — 스케줄러가 시그널에 따라 진입)
     */
    public void initializePositions(String userId, String purchaseId,
                                     List<String> targetAssets, BigDecimal investmentAmount) {
        BigDecimal perAsset = investmentAmount.divide(
                BigDecimal.valueOf(targetAssets.size()), 10, java.math.RoundingMode.HALF_UP);
        for (String symbol : targetAssets) {
            TurtlePosition pos = new TurtlePosition(userId, purchaseId, symbol, perAsset);
            positionRepository.save(pos);
        }
        log.info("터틀 포지션 초기화: userId={}, assets={}, perAsset={}", userId, targetAssets, perAsset);
    }

    /**
     * 모든 활성 터틀 포지션을 조회합니다 (스케줄러용)
     */
    public List<TurtlePosition> getAllActivePositions() {
        return positionRepository.findAll();
    }

    // ── 기술 지표 계산 (Python backtest_turtle.py 동일 로직) ──

    /**
     * ATR (Average True Range) — EWM alpha=1/n
     */
    private double[] calculateATR(double[] highs, double[] lows, double[] closes, int n) {
        int len = highs.length;
        double[] tr = new double[len];
        double[] atr = new double[len];

        tr[0] = highs[0] - lows[0];
        for (int i = 1; i < len; i++) {
            double hl = highs[i] - lows[i];
            double hc = Math.abs(highs[i] - closes[i - 1]);
            double lc = Math.abs(lows[i] - closes[i - 1]);
            tr[i] = Math.max(hl, Math.max(hc, lc));
        }

        double alpha = 1.0 / n;
        atr[0] = tr[0];
        for (int i = 1; i < len; i++) {
            atr[i] = alpha * tr[i] + (1 - alpha) * atr[i - 1];
        }
        return atr;
    }

    /**
     * ADX (Average Directional Index) — EWM alpha=1/n
     */
    private double[] calculateADX(double[] highs, double[] lows, double[] closes, int n) {
        int len = highs.length;
        double alpha = 1.0 / n;

        double[] plusDM = new double[len];
        double[] minusDM = new double[len];
        double[] tr = new double[len];

        tr[0] = highs[0] - lows[0];
        for (int i = 1; i < len; i++) {
            double upMove = highs[i] - highs[i - 1];
            double downMove = lows[i - 1] - lows[i];
            plusDM[i] = (upMove > downMove && upMove > 0) ? upMove : 0;
            minusDM[i] = (downMove > upMove && downMove > 0) ? downMove : 0;
            double hl = highs[i] - lows[i];
            double hc = Math.abs(highs[i] - closes[i - 1]);
            double lc = Math.abs(lows[i] - closes[i - 1]);
            tr[i] = Math.max(hl, Math.max(hc, lc));
        }

        // EWM smoothing
        double[] atrSmooth = ewm(tr, alpha);
        double[] plusSmooth = ewm(plusDM, alpha);
        double[] minusSmooth = ewm(minusDM, alpha);

        double[] dx = new double[len];
        for (int i = 0; i < len; i++) {
            if (atrSmooth[i] == 0) { dx[i] = 0; continue; }
            double plusDI = 100 * plusSmooth[i] / atrSmooth[i];
            double minusDI = 100 * minusSmooth[i] / atrSmooth[i];
            double sum = plusDI + minusDI;
            dx[i] = sum == 0 ? 0 : 100 * Math.abs(plusDI - minusDI) / sum;
        }

        return ewm(dx, alpha);
    }

    private double[] ewm(double[] data, double alpha) {
        double[] result = new double[data.length];
        result[0] = data[0];
        for (int i = 1; i < data.length; i++) {
            result[i] = alpha * data[i] + (1 - alpha) * result[i - 1];
        }
        return result;
    }

    /** shift(1) 적용 — 직전까지의 rolling max */
    private double rollingMax(double[] data, int idx, int period) {
        double max = -Double.MAX_VALUE; // 음수/0 값도 올바른 최대값으로 갱신되도록 가장 작은 실수로 초기화(Double.MIN_VALUE는 가장 작은 '양수')

        int start = Math.max(0, idx - period);
        for (int i = start; i < idx; i++) { // idx 미포함 (shift 1)
            max = Math.max(max, data[i]);
        }
        return max;
    }

    /** shift(1) 적용 — 직전까지의 rolling min */
    private 
    double rollingMin(double[] data, int idx, int period) {
        double min = Double.MAX_VALUE;
        int start = Math.max(0, idx - period);
        for (int i = start; i < idx; i++) {
            min = Math.min(min, data[i]);
        }
        return min;
    }

    private String getSymbolName(String symbol) {
        Map<String, String> names = Map.of(
                "BTC", "비트코인", "ETH", "이더리움", "SOL", "솔라나",
                "AVAX", "아발란체", "LINK", "체인링크", "XRP", "리플",
                "DOGE", "도지코인", "ADA", "에이다"
        );
        return names.getOrDefault(symbol, symbol);
    }
}

