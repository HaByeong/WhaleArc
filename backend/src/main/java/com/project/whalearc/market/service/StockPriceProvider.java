package com.project.whalearc.market.service;

import com.project.whalearc.market.domain.AssetType;
import com.project.whalearc.market.dto.MarketPriceResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicLong;

import jakarta.annotation.PostConstruct;
import org.springframework.scheduling.annotation.Scheduled;

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

    /** 서버 시작 시 비동기로 초기 데이터 로드 */
    @PostConstruct
    public void init() {
        CompletableFuture.runAsync(() -> {
            if (!kisApiClient.isConfigured()) return;
            try {
                List<MarketPriceResponse> freshData = fetchAllStockPrices();
                if (!freshData.isEmpty()) {
                    cachedPrices = freshData;
                    lastFetchTime.set(System.currentTimeMillis());
                    log.info("주식 시세 초기 로드 완료: {}개 종목", freshData.size());
                }
            } catch (Exception e) {
                log.warn("주식 시세 초기 로드 실패: {}", e.getMessage());
            }
        });
    }

    /** 10초마다 백그라운드 갱신 — 요청 스레드를 차단하지 않음 (KIS 시세 자체는 15~20초 지연이라 그 이상은 무의미) */
    @Scheduled(fixedDelay = 10000, initialDelay = 20000)
    public void scheduledRefresh() {
        if (!kisApiClient.isConfigured()) return;
        try {
            List<MarketPriceResponse> freshData = fetchAllStockPrices();
            if (!freshData.isEmpty()) {
                cachedPrices = freshData;
                lastFetchTime.set(System.currentTimeMillis());
            }
        } catch (Exception e) {
            log.warn("주식 시세 백그라운드 갱신 실패: {}", e.getMessage());
        }
    }

    /** 캐시된 시세만 즉시 반환 (블로킹 없음) — 캐시 없으면 빈 리스트 */
    public List<MarketPriceResponse> getCachedStockPrices() {
        return cachedPrices;
    }

    /** 시세 조회 — 항상 캐시에서 즉시 반환 (백그라운드에서 자동 갱신).
     *  KIS 미설정/캐시없음이면 가짜 가격이 아닌 빈 리스트를 반환(지어낸 값으로 주문·평가가 일어나지 않도록). indices 엔드포인트와 동일 정책. */
    public List<MarketPriceResponse> getAllStockPrices() {
        return cachedPrices;
    }

    private List<MarketPriceResponse> fetchAllStockPrices() {
        List<MarketPriceResponse> result = new ArrayList<>();

        for (Map.Entry<String, String> entry : POPULAR_STOCKS.entrySet()) {
            String code = entry.getKey();
            String name = entry.getValue();

            try {
                Map<String, String> output = kisApiClient.getStockPrice(code);
                if (output == null) continue;

                long price = parseLong(output.get("stck_prpr"));            // 현재가
                if (price <= 0) continue;   // 시세 0(레이트리밋/부분응답)은 캐시에 넣지 않음 — 직전 정상 캐시 유지

                MarketPriceResponse dto = new MarketPriceResponse();
                dto.setAssetType(AssetType.STOCK);
                dto.setSymbol(code);
                dto.setName(name);
                dto.setPrice(price);
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
