package com.project.whalearc.market.controller;

import com.project.whalearc.market.domain.AssetType;
import com.project.whalearc.market.dto.CandlestickResponse;
import com.project.whalearc.market.dto.IndicatorResponse;
import com.project.whalearc.market.dto.IndexPriceResponse;
import com.project.whalearc.market.dto.MarketPriceResponse;
import com.project.whalearc.market.service.*;
import com.project.whalearc.market.websocket.RealtimePriceHolder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@Slf4j
@RestController
@RequestMapping("/api/market")
@RequiredArgsConstructor
public class MarketController {

    private final StockPriceProvider stockPriceProvider;
    private final CryptoPriceProvider cryptoPriceProvider;
    private final RealtimePriceHolder realtimePriceHolder;
    private final CandlestickService candlestickService;
    private final StockMasterService stockMasterService;
    private final KisApiClient kisApiClient;

    // 지수 캐시 (30초)
    private volatile List<IndexPriceResponse> cachedIndices = List.of();
    private volatile long indicesCacheTime = 0;
    private static final long INDICES_CACHE_TTL = 30_000; // 30초

    @GetMapping("/prices")
    public ResponseEntity<List<MarketPriceResponse>> getPrices(@RequestParam AssetType type) {
        try {
            List<MarketPriceResponse> prices = switch (type) {
                case STOCK -> stockPriceProvider.getAllStockPrices();
                case CRYPTO -> {
                    // REST 데이터를 기본으로, 실시간 WebSocket 데이터로 덮어쓰기
                    List<MarketPriceResponse> restData = cryptoPriceProvider.getAllKrwTickers();
                    if (realtimePriceHolder.hasData()) {
                        Map<String, MarketPriceResponse> merged = new LinkedHashMap<>();
                        for (MarketPriceResponse r : restData) {
                            merged.put(r.getSymbol(), r);
                        }
                        for (MarketPriceResponse rt : realtimePriceHolder.getAllLatestPrices()) {
                            merged.put(rt.getSymbol(), rt); // 실시간 데이터로 덮어쓰기
                        }
                        yield new ArrayList<>(merged.values());
                    }
                    yield restData;
                }
            };
            return ResponseEntity.ok(prices);
        } catch (Exception e) {
            log.error("시세 조회 실패 [{}]: {}", type, e.getMessage());
            return ResponseEntity.internalServerError().body(List.of());
        }
    }

    /** 캐시 무시 강제 새로고침 */
    @PostMapping("/prices/refresh")
    public ResponseEntity<List<MarketPriceResponse>> refreshPrices() {
        try {
            return ResponseEntity.ok(cryptoPriceProvider.forceRefresh());
        } catch (Exception e) {
            log.error("강제 새로고침 실패: {}", e.getMessage());
            return ResponseEntity.internalServerError().body(List.of());
        }
    }

    /** 캔들스틱 (과거 시세 차트 데이터) */
    @GetMapping("/candlestick/{symbol}")
    public ResponseEntity<List<CandlestickResponse>> getCandlestick(
            @PathVariable String symbol,
            @RequestParam(defaultValue = "10m") String interval,
            @RequestParam(required = false) String assetType
    ) {
        try {
            return ResponseEntity.ok(candlestickService.getCandlesticks(symbol, interval, assetType));
        } catch (Exception e) {
            log.error("캔들스틱 조회 실패 [{}/{}]: {}", symbol, interval, e.getMessage());
            return ResponseEntity.internalServerError().body(List.of());
        }
    }

    /** 주식 종목 검색 (이름/코드 부분 매칭) */
    @GetMapping("/stock/search")
    public ResponseEntity<List<Map<String, String>>> searchStocks(@RequestParam String keyword) {
        return ResponseEntity.ok(stockMasterService.search(keyword));
    }

    /** 개별 종목 현재가 조회 (검색 결과에서 선택 시) */
    @GetMapping("/stock/price/{code}")
    public ResponseEntity<MarketPriceResponse> getStockPrice(@PathVariable String code) {
        try {
            if (!stockMasterService.exists(code)) {
                return ResponseEntity.notFound().build();
            }

            Map<String, String> output = kisApiClient.getStockPrice(code);
            if (output == null) {
                return ResponseEntity.internalServerError().build();
            }

            MarketPriceResponse dto = new MarketPriceResponse();
            dto.setAssetType(AssetType.STOCK);
            dto.setSymbol(code);
            dto.setName(stockMasterService.getStockName(code));
            dto.setPrice(parseLong(output.get("stck_prpr")));
            dto.setChange(parseLong(output.get("prdy_vrss")));
            dto.setChangeRate(parseDouble(output.get("prdy_ctrt")));
            dto.setVolume(parseLong(output.get("acml_vol")));
            dto.setMarket("KRX");

            return ResponseEntity.ok(dto);
        } catch (Exception e) {
            log.error("개별 종목 조회 실패 [{}]: {}", code, e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }

    /** KOSPI / KOSDAQ 지수 조회 (인증 불필요, 30초 캐싱) */
    @GetMapping("/indices")
    public ResponseEntity<List<IndexPriceResponse>> getIndices() {
        // 캐시 유효하면 즉시 반환
        if (System.currentTimeMillis() - indicesCacheTime < INDICES_CACHE_TTL && !cachedIndices.isEmpty()) {
            return ResponseEntity.ok(cachedIndices);
        }

        if (!kisApiClient.isConfigured()) {
            return ResponseEntity.ok(List.of());
        }

        List<IndexPriceResponse> indices = new ArrayList<>();

        Map<String, String> kospi = kisApiClient.getIndexPrice("0001");
        if (kospi != null) {
            indices.add(new IndexPriceResponse(
                    "KOSPI", "코스피",
                    parseDouble(kospi.get("bstp_nmix_prpr")),
                    parseDouble(kospi.get("bstp_nmix_prdy_vrss")),
                    parseDouble(kospi.get("bstp_nmix_prdy_ctrt"))
            ));
        }

        Map<String, String> kosdaq = kisApiClient.getIndexPrice("1001");
        if (kosdaq != null) {
            indices.add(new IndexPriceResponse(
                    "KOSDAQ", "코스닥",
                    parseDouble(kosdaq.get("bstp_nmix_prpr")),
                    parseDouble(kosdaq.get("bstp_nmix_prdy_vrss")),
                    parseDouble(kosdaq.get("bstp_nmix_prdy_ctrt"))
            ));
        }

        if (!indices.isEmpty()) {
            cachedIndices = indices;
            indicesCacheTime = System.currentTimeMillis();
        }

        return ResponseEntity.ok(indices);
    }

    /**
     * 기술적 지표 조회
     * indicators 파라미터 형식: "RSI:14,MACD:12:26:9,MA:20,MA:60,BOLLINGER:20:2"
     * 콜론 뒤 숫자를 생략하면 기본값 적용 (RSI:14, MACD:12:26:9, MA:20, BOLLINGER:20:2)
     */
    @GetMapping("/indicators/{symbol}")
    public ResponseEntity<?> getIndicators(
            @PathVariable String symbol,
            @RequestParam(defaultValue = "10m") String interval,
            @RequestParam(required = false) String assetType,
            @RequestParam String indicators
    ) {
        try {
            List<CandlestickResponse> candles = candlestickService.getCandlesticks(symbol, interval, assetType);
            if (candles.isEmpty()) {
                return ResponseEntity.ok(List.of());
            }

            double[] closes = candles.stream().mapToDouble(CandlestickResponse::getClose).toArray();
            double[] highs = candles.stream().mapToDouble(CandlestickResponse::getHigh).toArray();
            double[] lows = candles.stream().mapToDouble(CandlestickResponse::getLow).toArray();
            double[] volumes = candles.stream().mapToDouble(CandlestickResponse::getVolume).toArray();

            List<IndicatorResponse> results = new ArrayList<>();

            for (String token : indicators.split(",")) {
                String[] parts = token.trim().split(":");
                String type = parts[0].toUpperCase();

                switch (type) {
                    case "RSI" -> {
                        int period = parts.length > 1 ? Integer.parseInt(parts[1]) : 14;
                        double[] values = IndicatorCalculator.rsi(closes, period);
                        results.add(new IndicatorResponse("RSI",
                                Map.of("values", values),
                                Map.of("period", period)));
                    }
                    case "MACD" -> {
                        int fast = parts.length > 1 ? Integer.parseInt(parts[1]) : 12;
                        int slow = parts.length > 2 ? Integer.parseInt(parts[2]) : 26;
                        int sig = parts.length > 3 ? Integer.parseInt(parts[3]) : 9;
                        IndicatorCalculator.MACDResult macd = IndicatorCalculator.macd(closes, fast, slow, sig);
                        results.add(new IndicatorResponse("MACD",
                                Map.of("macd", macd.getMacdLine(),
                                        "signal", macd.getSignalLine(),
                                        "histogram", macd.getHistogram()),
                                Map.of("fast", fast, "slow", slow, "signal", sig)));
                    }
                    case "MA" -> {
                        int period = parts.length > 1 ? Integer.parseInt(parts[1]) : 20;
                        double[] values = IndicatorCalculator.sma(closes, period);
                        results.add(new IndicatorResponse("MA",
                                Map.of("values", values),
                                Map.of("period", period)));
                    }
                    case "EMA" -> {
                        int period = parts.length > 1 ? Integer.parseInt(parts[1]) : 20;
                        double[] values = IndicatorCalculator.ema(closes, period);
                        results.add(new IndicatorResponse("EMA",
                                Map.of("values", values),
                                Map.of("period", period)));
                    }
                    case "BOLLINGER", "BOLLINGER_BANDS" -> {
                        int period = parts.length > 1 ? Integer.parseInt(parts[1]) : 20;
                        double stdDev = parts.length > 2 ? Double.parseDouble(parts[2]) : 2.0;
                        IndicatorCalculator.BollingerResult bb = IndicatorCalculator.bollingerBands(closes, period, stdDev);
                        results.add(new IndicatorResponse("BOLLINGER",
                                Map.of("upper", bb.getUpper(),
                                        "middle", bb.getMiddle(),
                                        "lower", bb.getLower()),
                                Map.of("period", period, "stdDev", stdDev)));
                    }
                    case "STOCHASTIC" -> {
                        int kPeriod = parts.length > 1 ? Integer.parseInt(parts[1]) : 14;
                        int dPeriod = parts.length > 2 ? Integer.parseInt(parts[2]) : 3;
                        IndicatorCalculator.StochasticResult stoch = IndicatorCalculator.stochastic(highs, lows, closes, kPeriod, dPeriod);
                        results.add(new IndicatorResponse("STOCHASTIC",
                                Map.of("k", stoch.getK(), "d", stoch.getD()),
                                Map.of("kPeriod", kPeriod, "dPeriod", dPeriod)));
                    }
                    case "ATR" -> {
                        int period = parts.length > 1 ? Integer.parseInt(parts[1]) : 14;
                        double[] values = IndicatorCalculator.atr(highs, lows, closes, period);
                        results.add(new IndicatorResponse("ATR",
                                Map.of("values", values),
                                Map.of("period", period)));
                    }
                    case "OBV" -> {
                        double[] values = IndicatorCalculator.obv(closes, volumes);
                        results.add(new IndicatorResponse("OBV",
                                Map.of("values", values),
                                Map.of()));
                    }
                    case "VWAP" -> {
                        double[] values = IndicatorCalculator.vwap(highs, lows, closes, volumes);
                        results.add(new IndicatorResponse("VWAP",
                                Map.of("values", values),
                                Map.of()));
                    }
                    case "WILLIAMS_R", "WILLIAMS" -> {
                        int period = parts.length > 1 ? Integer.parseInt(parts[1]) : 14;
                        double[] values = IndicatorCalculator.williamsR(highs, lows, closes, period);
                        results.add(new IndicatorResponse("WILLIAMS_R",
                                Map.of("values", values),
                                Map.of("period", period)));
                    }
                    case "CCI" -> {
                        int period = parts.length > 1 ? Integer.parseInt(parts[1]) : 20;
                        double[] values = IndicatorCalculator.cci(highs, lows, closes, period);
                        results.add(new IndicatorResponse("CCI",
                                Map.of("values", values),
                                Map.of("period", period)));
                    }
                    case "PARABOLIC_SAR", "PSAR" -> {
                        double af = parts.length > 1 ? Double.parseDouble(parts[1]) : 0.02;
                        double maxAf = parts.length > 2 ? Double.parseDouble(parts[2]) : 0.2;
                        double[] values = IndicatorCalculator.parabolicSAR(highs, lows, af, maxAf);
                        results.add(new IndicatorResponse("PARABOLIC_SAR",
                                Map.of("values", values),
                                Map.of("af", af, "maxAf", maxAf)));
                    }
                    case "ICHIMOKU" -> {
                        int tenkan = parts.length > 1 ? Integer.parseInt(parts[1]) : 9;
                        int kijun = parts.length > 2 ? Integer.parseInt(parts[2]) : 26;
                        int senkouB = parts.length > 3 ? Integer.parseInt(parts[3]) : 52;
                        IndicatorCalculator.IchimokuResult ich = IndicatorCalculator.ichimoku(highs, lows, closes, tenkan, kijun, senkouB);
                        results.add(new IndicatorResponse("ICHIMOKU",
                                Map.of("tenkan", ich.getTenkan(),
                                        "kijun", ich.getKijun(),
                                        "senkouA", ich.getSenkouA(),
                                        "senkouB", ich.getSenkouB(),
                                        "chikou", ich.getChikou()),
                                Map.of("tenkan", tenkan, "kijun", kijun, "senkouB", senkouB)));
                    }
                    default -> log.warn("지원하지 않는 지표 타입: {}", type);
                }
            }

            // NaN → null 변환 (JSON 직렬화 호환)
            List<Map<String, Object>> sanitized = new ArrayList<>();
            for (IndicatorResponse ir : results) {
                Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("type", ir.getType());
                Map<String, List<Double>> cleanData = new LinkedHashMap<>();
                for (var e : ir.getData().entrySet()) {
                    List<Double> vals = new ArrayList<>();
                    for (double v : e.getValue()) {
                        vals.add(Double.isNaN(v) ? null : v);
                    }
                    cleanData.put(e.getKey(), vals);
                }
                entry.put("data", cleanData);
                entry.put("parameters", ir.getParameters());
                sanitized.add(entry);
            }

            return ResponseEntity.ok(sanitized);
        } catch (NumberFormatException e) {
            log.warn("지표 파라미터 파싱 오류: {}", e.getMessage());
            return ResponseEntity.badRequest().body(List.of());
        } catch (Exception e) {
            log.error("지표 조회 실패 [{}/{}]: {}", symbol, interval, e.getMessage());
            return ResponseEntity.internalServerError().body(List.of());
        }
    }

    /** 캐시 상태 확인 (디버그/모니터링용) */
    @GetMapping("/cache-status")
    public ResponseEntity<Map<String, Object>> getCacheStatus() {
        return ResponseEntity.ok(cryptoPriceProvider.getCacheStatus());
    }

    private long parseLong(String value) {
        try { return Long.parseLong(value); } catch (Exception e) { return 0L; }
    }

    private double parseDouble(String value) {
        try { return Double.parseDouble(value); } catch (Exception e) { return 0.0; }
    }
}
