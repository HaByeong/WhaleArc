package com.project.whalearc.market.service;

import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 지원 미국 ETF 메타데이터(심볼 → 한글명/거래소/카테고리) 단일 소스.
 * UsEtfPriceProvider, BacktestDataProvider, CandlestickService, MarketController 가
 * 모두 이 카탈로그를 참조해 거래소·카테고리를 일관되게 해석한다.
 *
 * KIS 해외주식 API 의 EXCD 코드:
 *   NAS = Nasdaq, NYS = NYSE 본장, AMS = NYSE American + NYSE Arca
 * 대부분의 ETF 는 NYSE Arca 상장이므로 `AMS` 로 지정해야 정상 조회된다.
 */
@Component
public class UsEtfCatalog {

    public record EtfInfo(String symbol, String koreanName, String exchange, String category) {}

    private static final LinkedHashMap<String, EtfInfo> CATALOG = new LinkedHashMap<>();
    static {
        // Nasdaq 상장
        put("QQQ",  "Invesco QQQ (나스닥100)",          "NAS", "Index");
        put("SOXX", "iShares 반도체 ETF",               "NAS", "Sector");
        put("SMH",  "VanEck 반도체 ETF",                "NAS", "Sector");
        put("NVDL", "GraniteShares 2x 엔비디아",        "NAS", "Leveraged");
        put("TQQQ", "ProShares 3x 나스닥100",           "NAS", "Leveraged");
        put("TSLL", "Direxion 2x 테슬라",               "NAS", "Leveraged");
        put("SQQQ", "ProShares -3x 나스닥100",          "NAS", "Inverse");
        put("TLT",  "iShares 20년+ 미국채",             "NAS", "Bond");
        put("JEPQ", "JPMorgan 나스닥 인컴",             "NAS", "Income");
        put("IBIT", "iShares 비트코인 신탁",            "NAS", "Crypto");
        // NYSE Arca 상장 → KIS 에서는 EXCD=AMS
        put("SPY",  "SPDR S&P 500",                      "AMS", "Index");
        put("VOO",  "Vanguard S&P 500",                  "AMS", "Index");
        put("VTI",  "Vanguard 전체 미국시장",            "AMS", "Index");
        put("DIA",  "SPDR 다우존스 산업평균",            "AMS", "Index");
        put("IWM",  "iShares 러셀 2000",                 "AMS", "Index");
        put("SCHD", "Schwab 미국 배당주 ETF",           "AMS", "Dividend");
        put("GLD",  "SPDR 골드 쉐어",                   "AMS", "Commodity");
        put("SLV",  "iShares 실버 트러스트",            "AMS", "Commodity");
        put("USO",  "United States 원유 펀드",          "AMS", "Commodity");
        put("XLK",  "Technology Select Sector",          "AMS", "Sector");
        put("XLF",  "Financial Select Sector",           "AMS", "Sector");
        put("XLE",  "Energy Select Sector",              "AMS", "Sector");
        put("XLV",  "Health Care Select Sector",         "AMS", "Sector");
        put("QLD",  "ProShares 2x 나스닥100",            "AMS", "Leveraged");
        put("SOXL", "Direxion 3x 반도체 불",             "AMS", "Leveraged");
        put("SPXL", "Direxion 3x S&P 500",               "AMS", "Leveraged");
        put("AGG",  "iShares 미국 종합채권",             "AMS", "Bond");
        put("JEPI", "JPMorgan S&P 인컴",                 "AMS", "Income");
        put("ARKK", "ARK 이노베이션",                    "AMS", "Innovation");
        put("EEM",  "iShares 신흥국 MSCI",              "AMS", "International");
        put("EWY",  "iShares 한국 MSCI",                 "AMS", "International");
        put("VNQ",  "Vanguard 미국 부동산",              "AMS", "RealEstate");
    }

    private static void put(String symbol, String name, String exchange, String category) {
        CATALOG.put(symbol, new EtfInfo(symbol, name, exchange, category));
    }

    /** 심볼이 카탈로그에 존재하면 true (대문자 기준) */
    public boolean isEtfSymbol(String symbol) {
        if (symbol == null) return false;
        return CATALOG.containsKey(symbol.toUpperCase());
    }

    public EtfInfo getMeta(String symbol) {
        if (symbol == null) return null;
        return CATALOG.get(symbol.toUpperCase());
    }

    /** KIS 해외주식 API 거래소 코드(NAS/NYS). 미등록 심볼은 기본 NAS. */
    public String getExchange(String symbol) {
        EtfInfo info = getMeta(symbol);
        return info != null ? info.exchange() : "NAS";
    }

    /** 카탈로그 전체를 순서대로 반환 (읽기 전용) */
    public Map<String, EtfInfo> getAll() {
        return Collections.unmodifiableMap(CATALOG);
    }
}
