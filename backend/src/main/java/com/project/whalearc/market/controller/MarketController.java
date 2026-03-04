package com.project.whalearc.market.controller;

import com.project.whalearc.market.domain.AssetType;
import com.project.whalearc.market.dto.MarketPriceResponse;
import com.project.whalearc.market.service.CryptoPriceProvider;
import com.project.whalearc.market.service.StockPriceProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 시장 시세 조회 API
 * - /api/market/prices?type=STOCK
 * - /api/market/prices?type=CRYPTO
 */
@RestController
@RequestMapping("/api/market")
@RequiredArgsConstructor
public class MarketController {

    private final StockPriceProvider stockPriceProvider;
    private final CryptoPriceProvider cryptoPriceProvider;

    @GetMapping("/prices")
    public List<MarketPriceResponse> getPrices(@RequestParam AssetType type) {
        return switch (type) {
            case STOCK -> stockPriceProvider.getMockKrxTickers();
            case CRYPTO -> cryptoPriceProvider.getAllKrwTickers();
        };
    }
}

