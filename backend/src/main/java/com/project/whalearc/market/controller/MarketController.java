package com.project.whalearc.market.controller;

import com.project.whalearc.market.domain.AssetType;
import com.project.whalearc.market.dto.MarketPriceResponse;
import com.project.whalearc.market.service.CryptoPriceProvider;
import com.project.whalearc.market.service.StockPriceProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/market")
@RequiredArgsConstructor
public class MarketController {

    private final StockPriceProvider stockPriceProvider;
    private final CryptoPriceProvider cryptoPriceProvider;

    @GetMapping("/prices")
    public ResponseEntity<List<MarketPriceResponse>> getPrices(@RequestParam AssetType type) {
        try {
            List<MarketPriceResponse> prices = switch (type) {
                case STOCK -> stockPriceProvider.getMockKrxTickers();
                case CRYPTO -> cryptoPriceProvider.getAllKrwTickers();
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

    /** 캐시 상태 확인 (디버그/모니터링용) */
    @GetMapping("/cache-status")
    public ResponseEntity<Map<String, Object>> getCacheStatus() {
        return ResponseEntity.ok(cryptoPriceProvider.getCacheStatus());
    }
}
