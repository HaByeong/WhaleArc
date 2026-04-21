package com.project.whalearc.market.service;

import com.project.whalearc.market.domain.AssetType;
import com.project.whalearc.market.dto.MarketPriceResponse;
import com.project.whalearc.market.service.UsEtfCatalog.EtfInfo;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 미국 ETF 시세 제공 — UsStockPriceProvider 와 동일한 KIS 해외주식 API 파이프라인을 사용.
 * 메타데이터는 UsEtfCatalog 가 단일 소스로 제공한다.
 * 백그라운드 갱신은 국내(20s)/미국주식(15s)과 오프셋을 두어 rate limit 을 분산한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UsEtfPriceProvider {

    private final KisApiClient kisApiClient;
    private final UsEtfCatalog etfCatalog;

    private volatile List<MarketPriceResponse> cachedPrices = List.of();
    private final AtomicLong lastFetchTime = new AtomicLong(0);

    @PostConstruct
    public void init() {
        CompletableFuture.runAsync(() -> {
            if (!kisApiClient.isConfigured()) return;
            try {
                List<MarketPriceResponse> freshData = fetchAllEtfPrices();
                if (!freshData.isEmpty()) {
                    cachedPrices = freshData;
                    lastFetchTime.set(System.currentTimeMillis());
                    log.info("미국 ETF 시세 초기 로드 완료: {}개 종목", freshData.size());
                }
            } catch (Exception e) {
                log.warn("미국 ETF 시세 초기 로드 실패: {}", e.getMessage());
            }
        });
    }

    /** 15초마다 백그라운드 갱신 — 미국주식(27.5s)과 7.5초 추가 오프셋 */
    @Scheduled(fixedDelay = 15000, initialDelay = 35000)
    public void scheduledRefresh() {
        if (!kisApiClient.isConfigured()) return;
        try {
            List<MarketPriceResponse> freshData = fetchAllEtfPrices();
            if (!freshData.isEmpty()) {
                cachedPrices = freshData;
                lastFetchTime.set(System.currentTimeMillis());
            }
        } catch (Exception e) {
            log.warn("미국 ETF 시세 백그라운드 갱신 실패: {}", e.getMessage());
        }
    }

    public List<MarketPriceResponse> getAllEtfPrices() {
        if (!kisApiClient.isConfigured()) {
            return getMockEtfTickers();
        }
        return cachedPrices.isEmpty() ? getMockEtfTickers() : cachedPrices;
    }

    /** 개별 종목 조회 (캐시 우선, 없으면 API 호출) */
    public MarketPriceResponse getEtfPriceBySymbol(String symbol) {
        String upper = symbol == null ? "" : symbol.toUpperCase();
        for (MarketPriceResponse p : cachedPrices) {
            if (p.getSymbol().equals(upper)) return p;
        }
        EtfInfo info = etfCatalog.getMeta(upper);
        if (info == null) return null;

        if (!kisApiClient.isConfigured()) return null;
        try {
            Map<String, String> output = kisApiClient.getUsStockPrice(info.exchange(), upper);
            if (output == null) return null;
            return buildResponse(info, output);
        } catch (Exception e) {
            log.warn("미국 ETF 개별 조회 실패 [{}]: {}", upper, e.getMessage());
            return null;
        }
    }

    /** 카탈로그 거래소 코드 반환 (NAS/NYS) */
    public String getExchange(String symbol) {
        return etfCatalog.getExchange(symbol);
    }

    /** 심볼이 지원 ETF 인지 */
    public boolean exists(String symbol) {
        return etfCatalog.isEtfSymbol(symbol);
    }

    /** 카탈로그 내 검색 (심볼/한글명 부분 매칭) */
    public List<Map<String, String>> search(String keyword) {
        if (keyword == null || keyword.trim().isEmpty()) return List.of();
        String upper = keyword.trim().toUpperCase();
        List<Map<String, String>> results = new ArrayList<>();

        for (EtfInfo info : etfCatalog.getAll().values()) {
            if (info.symbol().contains(upper) || info.koreanName().toUpperCase().contains(upper)) {
                results.add(Map.of(
                        "code", info.symbol(),
                        "name", info.koreanName(),
                        "market", "NAS".equals(info.exchange()) ? "NASDAQ" : "NYSE",
                        "category", info.category(),
                        "assetType", "ETF"
                ));
            }
            if (results.size() >= 20) break;
        }
        return results;
    }

    private List<MarketPriceResponse> fetchAllEtfPrices() {
        List<MarketPriceResponse> result = new ArrayList<>();

        for (EtfInfo info : etfCatalog.getAll().values()) {
            try {
                Map<String, String> output = kisApiClient.getUsStockPrice(info.exchange(), info.symbol());
                if (output == null) continue;

                MarketPriceResponse dto = buildResponse(info, output);
                if (dto.getPrice() > 0) {
                    result.add(dto);
                }

                Thread.sleep(100);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                break;
            } catch (Exception e) {
                log.warn("미국 ETF [{}] {} 조회 실패: {}", info.symbol(), info.koreanName(), e.getMessage());
            }
        }

        log.info("KIS 미국 ETF 시세 {}개 종목 조회 완료", result.size());
        return result;
    }

    private MarketPriceResponse buildResponse(EtfInfo info, Map<String, String> output) {
        MarketPriceResponse dto = new MarketPriceResponse();
        dto.setAssetType(AssetType.ETF);
        dto.setSymbol(info.symbol());
        dto.setName(info.koreanName());
        dto.setPrice(parseDouble(output.get("last")));
        dto.setChange(parseDouble(output.get("diff")));
        dto.setChangeRate(parseDouble(output.get("rate")));
        dto.setVolume(parseLong(output.get("tvol")));
        dto.setMarket("NAS".equals(info.exchange()) ? "NASDAQ" : "NYSE");
        dto.setCurrency("USD");
        return dto;
    }

    private List<MarketPriceResponse> getMockEtfTickers() {
        List<MarketPriceResponse> list = new ArrayList<>();

        MarketPriceResponse qqq = new MarketPriceResponse();
        qqq.setAssetType(AssetType.ETF);
        qqq.setSymbol("QQQ");
        qqq.setName("Invesco QQQ (나스닥100)");
        qqq.setPrice(495.20);
        qqq.setChange(3.40);
        qqq.setChangeRate(0.69);
        qqq.setVolume(38_000_000L);
        qqq.setMarket("NASDAQ");
        qqq.setCurrency("USD");
        list.add(qqq);

        MarketPriceResponse schd = new MarketPriceResponse();
        schd.setAssetType(AssetType.ETF);
        schd.setSymbol("SCHD");
        schd.setName("Schwab 미국 배당주 ETF");
        schd.setPrice(28.15);
        schd.setChange(0.12);
        schd.setChangeRate(0.43);
        schd.setVolume(12_500_000L);
        schd.setMarket("NASDAQ");
        schd.setCurrency("USD");
        list.add(schd);

        return list;
    }

    private long parseLong(String value) {
        try { return Long.parseLong(value); } catch (Exception e) { return 0L; }
    }

    private double parseDouble(String value) {
        try { return Double.parseDouble(value); } catch (Exception e) { return 0.0; }
    }
}
