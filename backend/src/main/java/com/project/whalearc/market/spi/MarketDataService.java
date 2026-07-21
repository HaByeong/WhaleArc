package com.project.whalearc.market.spi;

import com.project.whalearc.market.domain.AssetType;
import com.project.whalearc.market.dto.CandlestickResponse;
import com.project.whalearc.market.dto.MarketPriceResponse;
import com.project.whalearc.market.service.ExchangeRateService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 공용 시장데이터 파사드 — 소비자는 자산군만 넘기고, 소스 선택은 프로바이더 라우팅이 담당.
 *
 * <p>LiveStrategyService.resolveGateway와 동일한 supports() 라우팅 관례.
 * FX(USD/KRW)는 자산군 축과 무관한 단일 서비스라 ExchangeRateService에 직접 위임.
 */
@Service
@RequiredArgsConstructor
public class MarketDataService {

    private final List<MarketDataProvider> providers;
    private final ExchangeRateService exchangeRateService;

    private MarketDataProvider route(AssetType assetType) {
        return providers.stream()
                .filter(p -> p.supports(assetType))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("지원하지 않는 자산군: " + assetType));
    }

    /**
     * 문자열 assetType → enum. null/빈문자열은 CRYPTO로 해석
     * (CandlestickService의 "STOCK 아니면 전부 크립토" 기존 규약과 동일).
     */
    private AssetType parse(String assetType) {
        if (assetType == null || assetType.isBlank()) return AssetType.CRYPTO;
        try {
            return AssetType.valueOf(assetType.toUpperCase());
        } catch (IllegalArgumentException e) {
            return AssetType.CRYPTO;
        }
    }

    public List<MarketPriceResponse> getAllPrices(AssetType assetType) {
        return route(assetType).getAllPrices();
    }

    public MarketPriceResponse getPrice(String symbol, AssetType assetType) {
        return route(assetType).getPrice(symbol);
    }

    public List<CandlestickResponse> getCandles(String symbol, String interval, AssetType assetType) {
        return route(assetType).getCandles(symbol, interval);
    }

    public String getExchange(String symbol, AssetType assetType) {
        return route(assetType).getExchange(symbol);
    }

    public boolean exists(String symbol, AssetType assetType) {
        return route(assetType).exists(symbol);
    }

    // ─── 문자열 오버로드 (기존 문자열 assetType 소비자 호환) ───

    public List<MarketPriceResponse> getAllPrices(String assetType) {
        return getAllPrices(parse(assetType));
    }

    public MarketPriceResponse getPrice(String symbol, String assetType) {
        return getPrice(symbol, parse(assetType));
    }

    public List<CandlestickResponse> getCandles(String symbol, String interval, String assetType) {
        return getCandles(symbol, interval, parse(assetType));
    }

    // ─── FX ───

    public double getUsdKrwRate() {
        return exchangeRateService.getUsdKrwRate();
    }
}
