package com.project.whalearc.market.controller;

import com.project.whalearc.market.domain.AssetType;
import com.project.whalearc.market.dto.CandlestickResponse;
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
