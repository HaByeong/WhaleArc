package com.project.whalearc.mirror.service;

import com.project.whalearc.market.dto.CandlestickResponse;
import com.project.whalearc.market.dto.MarketPriceResponse;
import com.project.whalearc.market.service.CandlestickService;
import com.project.whalearc.market.service.CryptoPriceProvider;
import com.project.whalearc.market.service.StockPriceProvider;
import com.project.whalearc.market.service.UsEtfPriceProvider;
import com.project.whalearc.market.service.UsStockPriceProvider;
import com.project.whalearc.mirror.domain.EmotionCapture;
import com.project.whalearc.mirror.dto.CaptureRequest;
import com.project.whalearc.mirror.dto.CaptureResponse;
import com.project.whalearc.mirror.repository.EmotionCaptureRepository;
import com.project.whalearc.live.domain.LiveStrategyDeployment;
import com.project.whalearc.live.repository.LiveStrategyDeploymentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;

/**
 * 감정 거울 서비스 — 포착(봉인)·개봉(반사실 계산).
 * 반사실은 평행우주를 지어내지 않는 단일 보수 가정(현금화 0% 기준)으로만 계산한다. {@link EmotionCapture} 참고.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EmotionMirrorService {

    private final EmotionCaptureRepository repository;
    private final CryptoPriceProvider cryptoPriceProvider;
    private final StockPriceProvider stockPriceProvider;
    private final UsStockPriceProvider usStockPriceProvider;
    private final UsEtfPriceProvider usEtfPriceProvider;
    private final CandlestickService candlestickService;
    private final LiveStrategyDeploymentRepository deploymentRepository;

    /** 개봉까지의 시간(분). 기본 7일(10080분) — test/데모는 application.yml 에서 짧게 줄일 수 있다. */
    @Value("${mirror.reveal-minutes:10080}")
    private long revealMinutes;

    // ── 포착(봉인) ──
    public CaptureResponse capture(String userId, CaptureRequest req) {
        String assetType = normalizeAssetType(req.getAssetType());
        String trigger = (req.getTriggerType() == null || req.getTriggerType().isBlank())
                ? "PANIC_DROP" : req.getTriggerType();
        String impulseSide = "FOMO_SPIKE".equals(trigger) ? "BUY" : "SELL";

        // 가격·등락률은 서버가 권위있게 stamp. 못 구하면 사용자가 본 값으로 fallback(죽은 봉인 방지).
        MarketPriceResponse m = currentMarket(req.getAssetSymbol(), assetType);
        double priceAtEvent = (m != null && m.getPrice() > 0) ? m.getPrice() : nz(req.getPriceAtEvent());
        double changeRate = (m != null && m.getPrice() > 0) ? m.getChangeRate() : nz(req.getChangeRate());
        double amountKrw = nz(req.getAmountKrw());

        // 시세를 전혀 못 구하면 '죽은 유리병'(영원히 안 열리고 매번 재시도)이 되니 봉인하지 않는다.
        if (priceAtEvent <= 0) {
            throw new IllegalArgumentException("현재 시세를 확인할 수 없어 띄울 수 없어요. 잠시 후 다시 시도해 주세요.");
        }

        Instant now = Instant.now();
        Instant revealAt = now.plus(Math.max(0, revealMinutes), ChronoUnit.MINUTES);

        EmotionCapture c = new EmotionCapture(userId, trigger, impulseSide,
                req.getAssetSymbol(), req.getAssetName(), assetType,
                priceAtEvent, changeRate, amountKrw, req.getUserChoice(),
                req.getEmotionNote(), req.getEmotionIntensity(), now, revealAt);
        c.setStrategyName(activeStrategyFor(userId, req.getAssetSymbol()));   // '항로'를 literal로

        // 개봉일이 0이면 즉시 개봉(데모) — 가격이 이미 stamp 됐으니 같은 가격 기준이라도 정직하게 0%로 열림
        if (!revealAt.isAfter(now)) reveal(c);

        c = repository.save(c);
        log.info("감정 거울 봉인: userId={}, {} {} {} 강도{} → 개봉 {}",
                userId, trigger, req.getAssetSymbol(), req.getUserChoice(), req.getEmotionIntensity(), revealAt);
        return new CaptureResponse(c);
    }

    // ── 목록(읽을 때 만기 봉인은 즉시 개봉 — 배치 안 기다리게) ──
    public List<CaptureResponse> getUserCaptures(String userId) {
        Instant now = Instant.now();
        List<EmotionCapture> list = repository.findByUserIdOrderByCapturedAtDesc(userId);
        for (EmotionCapture c : list) {
            if (!c.isRevealed() && !c.getRevealAt().isAfter(now) && reveal(c)) {
                try {
                    repository.save(c);
                } catch (Exception e) {
                    // 동시 개봉 충돌(배치가 먼저 열었음) — 이미 열린 데이터라 무시. 응답엔 방금 계산한 c 그대로 사용.
                    log.debug("감정 거울 lazy 개봉 저장 충돌(무시) [{}]: {}", c.getId(), e.getMessage());
                }
            }
        }
        return list.stream().map(CaptureResponse::new).toList();
    }

    // ── 개봉(반사실 계산). 가격을 못 구하면 false(다음 기회에 재시도) ──
    public boolean reveal(EmotionCapture c) {
        if (c.isRevealed()) return false;        // 재진입 가드(이미 열린 유리병)
        if (c.getPriceAtEvent() <= 0) return false;
        MarketPriceResponse m = currentMarket(c.getAssetSymbol(), c.getAssetType());
        if (m == null || m.getPrice() <= 0) return false;

        double now = m.getPrice();
        double movePct = (now - c.getPriceAtEvent()) / c.getPriceAtEvent() * 100.0;

        double impulse, rule;
        if ("BUY".equals(c.getImpulseSide())) {
            impulse = movePct;  // 충동=매수 → 자산 변동분
            rule = 0.0;         // 항로=관망 → 현금(0%)
        } else {
            impulse = 0.0;      // 충동=현금화 → 0%
            rule = movePct;     // 항로=보유 → 자산 변동분
        }

        c.setPriceAtReveal(now);
        c.setImpulseOutcomePct(round2(impulse));
        c.setRuleOutcomePct(round2(rule));
        c.setPathPct(buildPath(c));
        c.setRevealed(true);
        c.setRevealedAt(Instant.now());
        return true;
    }

    /** 이벤트→개봉 사이 자산 변동 경로(%) — 고정 horizon 체리피킹 방지용. best-effort, 실패 시 null. */
    private List<Double> buildPath(EmotionCapture c) {
        try {
            List<CandlestickResponse> candles = candlestickService.getCandlesticks(
                    c.getAssetSymbol(), "1d", c.getAssetType());
            if (candles == null || candles.isEmpty()) return null;
            long fromSec = c.getCapturedAt().getEpochSecond() - 86_400; // 이벤트 당일 포함
            double base = c.getPriceAtEvent();
            List<Double> path = candles.stream()
                    .filter(k -> k.getTime() >= fromSec && k.getClose() > 0)
                    .sorted(Comparator.comparingLong(CandlestickResponse::getTime))
                    .map(k -> round2((k.getClose() - base) / base * 100.0))
                    .toList();
            return path.size() >= 2 ? path : null;
        } catch (Exception e) {
            log.debug("감정 거울 경로 생성 실패 [{}]: {}", c.getAssetSymbol(), e.getMessage());
            return null;
        }
    }

    /** (symbol, assetType) → 현재 시세(등락률 포함). 못 구하면 null. */
    private MarketPriceResponse currentMarket(String symbol, String assetType) {
        try {
            return switch (normalizeAssetType(assetType)) {
                case "STOCK" -> stockPriceProvider.getStockPriceByCode(symbol, symbol);
                case "US_STOCK" -> usStockPriceProvider.getUsStockPriceBySymbol(symbol);
                case "ETF" -> usEtfPriceProvider.getEtfPriceBySymbol(symbol);
                default -> cryptoPriceProvider.getAllKrwTickers().stream()
                        .filter(p -> symbol.equals(p.getSymbol()))
                        .findFirst().orElse(null);
            };
        } catch (Exception e) {
            log.debug("감정 거울 시세 조회 실패 [{} {}]: {}", symbol, assetType, e.getMessage());
            return null;
        }
    }

    /** 그 종목에 운용 중(RUNNING)인 사용자의 전략(항로) 이름 — 없으면 null. */
    private String activeStrategyFor(String userId, String symbol) {
        try {
            return deploymentRepository
                    .findByUserIdAndStatusIn(userId, java.util.List.of(LiveStrategyDeployment.Status.RUNNING)).stream()
                    .filter(d -> d.getTargetAssets() != null && d.getTargetAssets().contains(symbol))
                    .map(LiveStrategyDeployment::getStrategyName)
                    .filter(n -> n != null && !n.isBlank())
                    .findFirst().orElse(null);
        } catch (Exception e) {
            log.debug("감정 거울 항로 조회 실패 [{}]: {}", symbol, e.getMessage());
            return null;
        }
    }

    private static String normalizeAssetType(String t) {
        return (t == null || t.isBlank()) ? "CRYPTO" : t.toUpperCase();
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    private static double nz(Double v) {
        return v != null ? v : 0.0;
    }
}
