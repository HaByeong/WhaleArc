package com.project.whalearc.market.service;

import com.project.whalearc.market.domain.AssetType;
import com.project.whalearc.market.dto.MarketPriceResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 미국 주식 시세 제공 — 한국투자증권 KIS API 해외주식 연동.
 * - 인기 30종목을 KIS 해외주식 API로 현재가 조회
 * - 국내주식(StockPriceProvider)과 7.5초 오프셋으로 rate limit 분산
 * - 가격은 USD 단위로 저장
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UsStockPriceProvider {

    private final KisApiClient kisApiClient;

    private volatile List<MarketPriceResponse> cachedPrices = List.of();
    private final AtomicLong lastFetchTime = new AtomicLong(0);

    // 인기 미국주식: symbol → {한글명, 거래소코드(NAS/NYS/AMS)}
    private static final LinkedHashMap<String, String[]> POPULAR_US_STOCKS = new LinkedHashMap<>();
    static {
        POPULAR_US_STOCKS.put("AAPL",  new String[]{"애플", "NAS"});
        POPULAR_US_STOCKS.put("MSFT",  new String[]{"마이크로소프트", "NAS"});
        POPULAR_US_STOCKS.put("GOOGL", new String[]{"알파벳(구글)", "NAS"});
        POPULAR_US_STOCKS.put("AMZN",  new String[]{"아마존", "NAS"});
        POPULAR_US_STOCKS.put("NVDA",  new String[]{"엔비디아", "NAS"});
        POPULAR_US_STOCKS.put("TSLA",  new String[]{"테슬라", "NAS"});
        POPULAR_US_STOCKS.put("META",  new String[]{"메타", "NAS"});
        POPULAR_US_STOCKS.put("AVGO",  new String[]{"브로드컴", "NAS"});
        POPULAR_US_STOCKS.put("JPM",   new String[]{"JP모건", "NYS"});
        POPULAR_US_STOCKS.put("V",     new String[]{"비자", "NYS"});
        POPULAR_US_STOCKS.put("JNJ",   new String[]{"존슨앤존슨", "NYS"});
        POPULAR_US_STOCKS.put("WMT",   new String[]{"월마트", "NYS"});
        POPULAR_US_STOCKS.put("MA",    new String[]{"마스터카드", "NYS"});
        POPULAR_US_STOCKS.put("PG",    new String[]{"P&G", "NYS"});
        POPULAR_US_STOCKS.put("HD",    new String[]{"홈디포", "NYS"});
        POPULAR_US_STOCKS.put("DIS",   new String[]{"디즈니", "NYS"});
        POPULAR_US_STOCKS.put("NFLX",  new String[]{"넷플릭스", "NAS"});
        POPULAR_US_STOCKS.put("AMD",   new String[]{"AMD", "NAS"});
        POPULAR_US_STOCKS.put("INTC",  new String[]{"인텔", "NAS"});
        POPULAR_US_STOCKS.put("CRM",   new String[]{"세일즈포스", "NYS"});
        POPULAR_US_STOCKS.put("ADBE",  new String[]{"어도비", "NAS"});
        POPULAR_US_STOCKS.put("PYPL",  new String[]{"페이팔", "NAS"});
        POPULAR_US_STOCKS.put("COST",  new String[]{"코스트코", "NAS"});
        POPULAR_US_STOCKS.put("NKE",   new String[]{"나이키", "NYS"});
        POPULAR_US_STOCKS.put("KO",    new String[]{"코카콜라", "NYS"});
        POPULAR_US_STOCKS.put("PEP",   new String[]{"펩시코", "NAS"});
        POPULAR_US_STOCKS.put("BAC",   new String[]{"뱅크오브아메리카", "NYS"});
        POPULAR_US_STOCKS.put("XOM",   new String[]{"엑슨모빌", "NYS"});
        POPULAR_US_STOCKS.put("COIN",  new String[]{"코인베이스", "NAS"});
        POPULAR_US_STOCKS.put("PLTR",  new String[]{"팔란티어", "NAS"});
    }

    @PostConstruct
    public void init() {
        CompletableFuture.runAsync(() -> {
            if (!kisApiClient.isConfigured()) return;
            try {
                List<MarketPriceResponse> freshData = fetchAllUsStockPrices();
                if (!freshData.isEmpty()) {
                    cachedPrices = freshData;
                    lastFetchTime.set(System.currentTimeMillis());
                    log.info("미국주식 시세 초기 로드 완료: {}개 종목", freshData.size());
                }
            } catch (Exception e) {
                log.warn("미국주식 시세 초기 로드 실패: {}", e.getMessage());
            }
        });
    }

    /** 15초마다 백그라운드 갱신 — 국내주식(20s)과 7.5초 오프셋 */
    @Scheduled(fixedDelay = 15000, initialDelay = 27500)
    public void scheduledRefresh() {
        if (!kisApiClient.isConfigured()) return;
        try {
            List<MarketPriceResponse> freshData = fetchAllUsStockPrices();
            if (!freshData.isEmpty()) {
                cachedPrices = freshData;
                lastFetchTime.set(System.currentTimeMillis());
            }
        } catch (Exception e) {
            log.warn("미국주식 시세 백그라운드 갱신 실패: {}", e.getMessage());
        }
    }

    public List<MarketPriceResponse> getAllUsStockPrices() {
        if (!kisApiClient.isConfigured()) {
            return getMockUsStockTickers();
        }
        return cachedPrices.isEmpty() ? getMockUsStockTickers() : cachedPrices;
    }

    /** 개별 종목 조회 (캐시 우선, 없으면 API 호출) */
    public MarketPriceResponse getUsStockPriceBySymbol(String symbol) {
        // 캐시에서 먼저 찾기
        for (MarketPriceResponse p : cachedPrices) {
            if (p.getSymbol().equals(symbol)) return p;
        }
        // 인기종목 목록에서 거래소 정보 조회
        String[] info = POPULAR_US_STOCKS.get(symbol);
        if (info == null) return null;

        if (!kisApiClient.isConfigured()) return null;
        try {
            Map<String, String> output = kisApiClient.getUsStockPrice(info[1], symbol);
            if (output == null) return null;
            return buildResponse(symbol, info[0], info[1], output);
        } catch (Exception e) {
            log.warn("미국주식 개별 조회 실패 [{}]: {}", symbol, e.getMessage());
            return null;
        }
    }

    /** 종목 심볼 → 거래소 코드 반환 (NAS/NYS) */
    public String getExchange(String symbol) {
        String[] info = POPULAR_US_STOCKS.get(symbol);
        return info != null ? info[1] : "NAS";
    }

    /** 인기종목 내 검색 (심볼/이름 매칭) */
    public List<Map<String, String>> search(String keyword) {
        if (keyword == null || keyword.trim().length() < 1) return List.of();
        String upper = keyword.trim().toUpperCase();
        List<Map<String, String>> results = new ArrayList<>();

        for (Map.Entry<String, String[]> entry : POPULAR_US_STOCKS.entrySet()) {
            String symbol = entry.getKey();
            String name = entry.getValue()[0];
            String exchange = entry.getValue()[1];

            if (symbol.contains(upper) || name.toUpperCase().contains(upper)) {
                results.add(Map.of("code", symbol, "name", name, "market", "NAS".equals(exchange) ? "NASDAQ" : "NYSE"));
            }
            if (results.size() >= 20) break;
        }
        return results;
    }

    /** 종목 존재 여부 */
    public boolean exists(String symbol) {
        return POPULAR_US_STOCKS.containsKey(symbol);
    }

    private List<MarketPriceResponse> fetchAllUsStockPrices() {
        List<MarketPriceResponse> result = new ArrayList<>();

        for (Map.Entry<String, String[]> entry : POPULAR_US_STOCKS.entrySet()) {
            String symbol = entry.getKey();
            String name = entry.getValue()[0];
            String exchange = entry.getValue()[1];

            try {
                Map<String, String> output = kisApiClient.getUsStockPrice(exchange, symbol);
                if (output == null) continue;

                MarketPriceResponse dto = buildResponse(symbol, name, exchange, output);
                if (dto.getPrice() > 0) {
                    result.add(dto);
                }

                Thread.sleep(100);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                break;
            } catch (Exception e) {
                log.warn("미국주식 [{}] {} 조회 실패: {}", symbol, name, e.getMessage());
            }
        }

        log.info("KIS 미국주식 시세 {}개 종목 조회 완료", result.size());
        return result;
    }

    private MarketPriceResponse buildResponse(String symbol, String name, String exchange, Map<String, String> output) {
        MarketPriceResponse dto = new MarketPriceResponse();
        dto.setAssetType(AssetType.US_STOCK);
        dto.setSymbol(symbol);
        dto.setName(name);
        dto.setPrice(parseDouble(output.get("last")));
        dto.setChange(parseDouble(output.get("diff")));
        dto.setChangeRate(parseDouble(output.get("rate")));
        dto.setVolume(parseLong(output.get("tvol")));
        dto.setMarket("NAS".equals(exchange) ? "NASDAQ" : "NYSE");
        dto.setCurrency("USD");
        return dto;
    }

    private List<MarketPriceResponse> getMockUsStockTickers() {
        List<MarketPriceResponse> list = new ArrayList<>();

        MarketPriceResponse apple = new MarketPriceResponse();
        apple.setAssetType(AssetType.US_STOCK);
        apple.setSymbol("AAPL");
        apple.setName("애플");
        apple.setPrice(195.50);
        apple.setChange(2.30);
        apple.setChangeRate(1.19);
        apple.setVolume(52_000_000L);
        apple.setMarket("NASDAQ");
        apple.setCurrency("USD");
        list.add(apple);

        MarketPriceResponse nvda = new MarketPriceResponse();
        nvda.setAssetType(AssetType.US_STOCK);
        nvda.setSymbol("NVDA");
        nvda.setName("엔비디아");
        nvda.setPrice(875.30);
        nvda.setChange(-12.50);
        nvda.setChangeRate(-1.41);
        nvda.setVolume(45_000_000L);
        nvda.setMarket("NASDAQ");
        nvda.setCurrency("USD");
        list.add(nvda);

        return list;
    }

    private long parseLong(String value) {
        try { return Long.parseLong(value); } catch (Exception e) { return 0L; }
    }

    private double parseDouble(String value) {
        try { return Double.parseDouble(value); } catch (Exception e) { return 0.0; }
    }
}
