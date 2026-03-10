package com.project.whalearc.market.service;

import com.project.whalearc.market.domain.AssetType;
import com.project.whalearc.market.dto.MarketPriceResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.*;

import java.util.concurrent.atomic.AtomicLong;

/**
 * 국내 주식 시세 제공 — 한국투자증권 KIS API 연동.
 * - 주요 종목 리스트를 KIS API로 현재가 조회
 * - 캐시 적용 (기본 30초)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StockPriceProvider {

    private final KisApiClient kisApiClient;

    @Value("${kis.api.cache-ttl-ms:15000}")
    private long cacheTtlMs;

    // 캐시
    private volatile List<MarketPriceResponse> cachedPrices = List.of();
    private final AtomicLong lastFetchTime = new AtomicLong(0);

    // 주요 종목 (코드 → 이름)
    private static final LinkedHashMap<String, String> POPULAR_STOCKS = new LinkedHashMap<>();
    static {
        POPULAR_STOCKS.put("005930", "삼성전자");
        POPULAR_STOCKS.put("000660", "SK하이닉스");
        POPULAR_STOCKS.put("373220", "LG에너지솔루션");
        POPULAR_STOCKS.put("207940", "삼성바이오로직스");
        POPULAR_STOCKS.put("005380", "현대차");
        POPULAR_STOCKS.put("000270", "기아");
        POPULAR_STOCKS.put("006400", "삼성SDI");
        POPULAR_STOCKS.put("051910", "LG화학");
        POPULAR_STOCKS.put("035420", "NAVER");
        POPULAR_STOCKS.put("035720", "카카오");
        POPULAR_STOCKS.put("068270", "셀트리온");
        POPULAR_STOCKS.put("105560", "KB금융");
        POPULAR_STOCKS.put("055550", "신한지주");
        POPULAR_STOCKS.put("012330", "현대모비스");
        POPULAR_STOCKS.put("028260", "삼성물산");
        POPULAR_STOCKS.put("003670", "포스코퓨처엠");
        POPULAR_STOCKS.put("247540", "에코프로비엠");
        POPULAR_STOCKS.put("086790", "하나금융지주");
        POPULAR_STOCKS.put("066570", "LG전자");
        POPULAR_STOCKS.put("096770", "SK이노베이션");
        POPULAR_STOCKS.put("034730", "SK");
        POPULAR_STOCKS.put("003550", "LG");
        POPULAR_STOCKS.put("032830", "삼성생명");
        POPULAR_STOCKS.put("030200", "KT");
        POPULAR_STOCKS.put("017670", "SK텔레콤");
        POPULAR_STOCKS.put("009150", "삼성전기");
        POPULAR_STOCKS.put("010130", "고려아연");
        POPULAR_STOCKS.put("033780", "KT&G");
        POPULAR_STOCKS.put("329180", "현대중공업");
        POPULAR_STOCKS.put("352820", "하이브");
    }

    /** 캐시된 시세만 즉시 반환 (블로킹 없음) — 캐시 없으면 빈 리스트 */
    public List<MarketPriceResponse> getCachedStockPrices() {
        return cachedPrices.isEmpty() ? getMockKrxTickers() : cachedPrices;
    }

    /** 캐시 우선 시세 조회 (캐시 만료 시 KIS API 호출 — 느릴 수 있음) */
    public List<MarketPriceResponse> getAllStockPrices() {
        if (!kisApiClient.isConfigured()) {
            log.warn("KIS API 키 미설정 — mock 데이터 반환");
            return getMockKrxTickers();
        }

        long now = System.currentTimeMillis();
        if (!cachedPrices.isEmpty() && (now - lastFetchTime.get()) < cacheTtlMs) {
            return cachedPrices;
        }

        // 캐시 만료 → 동기 갱신 (최대 5초 대기, 초과 시 stale 반환)
        return refreshCacheSync();
    }

    private synchronized List<MarketPriceResponse> refreshCacheSync() {
        // 더블 체크: 다른 스레드가 이미 갱신했을 수 있음
        if (!cachedPrices.isEmpty() && (System.currentTimeMillis() - lastFetchTime.get()) < cacheTtlMs) {
            return cachedPrices;
        }

        try {
            List<MarketPriceResponse> freshData = fetchAllStockPrices();
            if (!freshData.isEmpty()) {
                cachedPrices = freshData;
                lastFetchTime.set(System.currentTimeMillis());
                return cachedPrices;
            }
        } catch (Exception e) {
            log.warn("주식 시세 갱신 실패: {}", e.getMessage());
        }

        // 갱신 실패 시 이전 캐시 또는 mock 반환
        return cachedPrices.isEmpty() ? getMockKrxTickers() : cachedPrices;
    }

    private List<MarketPriceResponse> fetchAllStockPrices() {
        List<MarketPriceResponse> result = new ArrayList<>();

        for (Map.Entry<String, String> entry : POPULAR_STOCKS.entrySet()) {
            String code = entry.getKey();
            String name = entry.getValue();

            try {
                Map<String, String> output = kisApiClient.getStockPrice(code);
                if (output == null) continue;

                MarketPriceResponse dto = new MarketPriceResponse();
                dto.setAssetType(AssetType.STOCK);
                dto.setSymbol(code);
                dto.setName(name);
                dto.setPrice(parseLong(output.get("stck_prpr")));           // 현재가
                dto.setChange(parseLong(output.get("prdy_vrss")));          // 전일 대비
                dto.setChangeRate(parseDouble(output.get("prdy_ctrt")));    // 전일 대비율
                dto.setVolume(parseLong(output.get("acml_vol")));           // 누적 거래량
                dto.setMarket("KRX");

                result.add(dto);

                // KIS API 초당 호출 제한 (모의투자: 초당 1건) → 간격 조절
                Thread.sleep(100);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                break;
            } catch (Exception e) {
                log.warn("종목 [{}] {} 조회 실패: {}", code, name, e.getMessage());
            }
        }

        log.info("KIS 주식 시세 {}개 종목 조회 완료", result.size());
        return result;
    }

    /**
     * 개별 종목 현재가 조회 (인기 30종목 외 종목용)
     * @param code 종목 코드 (6자리)
     * @param name 종목명
     * @return MarketPriceResponse, 실패 시 null
     */
    public MarketPriceResponse getStockPriceByCode(String code, String name) {
        if (!kisApiClient.isConfigured()) {
            return null;
        }
        try {
            Map<String, String> output = kisApiClient.getStockPrice(code);
            if (output == null) return null;

            MarketPriceResponse dto = new MarketPriceResponse();
            dto.setAssetType(AssetType.STOCK);
            dto.setSymbol(code);
            dto.setName(name);
            dto.setPrice(parseLong(output.get("stck_prpr")));
            dto.setChange(parseLong(output.get("prdy_vrss")));
            dto.setChangeRate(parseDouble(output.get("prdy_ctrt")));
            dto.setVolume(parseLong(output.get("acml_vol")));
            dto.setMarket("KRX");
            return dto;
        } catch (Exception e) {
            log.warn("개별 종목 [{}] {} 조회 실패: {}", code, name, e.getMessage());
            return null;
        }
    }

    /** KIS API 미설정 시 폴백 mock 데이터 */
    public List<MarketPriceResponse> getMockKrxTickers() {
        List<MarketPriceResponse> list = new ArrayList<>();

        MarketPriceResponse samsung = new MarketPriceResponse();
        samsung.setAssetType(AssetType.STOCK);
        samsung.setSymbol("005930");
        samsung.setName("삼성전자");
        samsung.setPrice(75_000);
        samsung.setChange(1_500);
        samsung.setChangeRate(2.04);
        samsung.setVolume(12_500_000L);
        samsung.setMarket("KRX");
        list.add(samsung);

        MarketPriceResponse hynix = new MarketPriceResponse();
        hynix.setAssetType(AssetType.STOCK);
        hynix.setSymbol("000660");
        hynix.setName("SK하이닉스");
        hynix.setPrice(145_000);
        hynix.setChange(-2_000);
        hynix.setChangeRate(-1.36);
        hynix.setVolume(3_500_000L);
        hynix.setMarket("KRX");
        list.add(hynix);

        return list;
    }

    private long parseLong(String value) {
        try {
            return Long.parseLong(value);
        } catch (Exception e) {
            return 0L;
        }
    }

    private double parseDouble(String value) {
        try {
            return Double.parseDouble(value);
        } catch (Exception e) {
            return 0.0;
        }
    }
}
