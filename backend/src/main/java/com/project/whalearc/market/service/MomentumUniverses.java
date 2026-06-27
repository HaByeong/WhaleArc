package com.project.whalearc.market.service;

import java.util.List;

/**
 * 모멘텀 TopN 로테이션의 자산군별 큐레이티드 기본 유니버스 + 레짐 벤치마크 + 통화.
 *
 * <p>자산군: US_STOCK(미국주식)·ETF(미국 ETF)·STOCK(한국주식)·CRYPTO(가상자산).
 * 사용자가 유니버스를 직접 지정하지 않으면 이 기본 풀로 돌린다(고급설정에서 커스터마이즈 가능).
 * 레짐 필터는 자산군 대표 벤치마크의 200일선으로 강세/약세를 판정한다.
 */
public final class MomentumUniverses {

    private MomentumUniverses() {}

    /** 미국주식 기본 유니버스는 기존 11섹터 132종(생존편향 완화)을 그대로 사용. */
    public static List<String> usStocks() { return MomentumUniverse.symbols(); }

    /** 미국 주요 ETF(지수·섹터·테마·자산). 레짐=SPY, 통화 USD. */
    public static final List<String> US_ETFS = List.of(
            "SPY", "QQQ", "DIA", "IWM", "VTI", "VOO", "VTV", "VUG", "MDY", "RSP",
            "XLK", "XLF", "XLE", "XLV", "XLY", "XLP", "XLI", "XLB", "XLU", "XLRE", "XLC",
            "SMH", "SOXX", "ARKK", "XBI", "IBB", "KRE", "XHB", "ITB", "XRT",
            "GLD", "SLV", "USO", "TLT", "IEF", "HYG", "LQD", "EEM", "EFA", "VNQ");

    /** 한국 KOSPI 대형주(섹터 분산). 레짐=KODEX200(069500), 통화 KRW. (Yahoo .KS 일봉) */
    public static final List<String> KR_STOCKS = List.of(
            "005930", "000660", "373220", "207940", "005380", "000270", "005490", "035420", "035720", "051910",
            "006400", "068270", "105560", "055550", "086790", "012330", "028260", "066570", "003550", "015760",
            "017670", "030200", "033780", "096770", "011200", "010130", "009150", "032830", "316140", "138040",
            "010950", "034730", "018260", "024110", "090430", "271560", "047050", "000810", "078930", "021240");

    /** 가상자산 주요 코인(빗썸 KRW 마켓). 레짐=BTC, 통화 KRW. */
    public static final List<String> CRYPTO = List.of(
            "BTC", "ETH", "XRP", "SOL", "ADA", "DOGE", "AVAX", "LINK", "DOT", "TRX",
            "MATIC", "UNI", "ATOM", "LTC", "BCH", "ETC", "NEAR", "APT", "ARB", "OP",
            "SUI", "SEI", "INJ", "AAVE", "SAND", "STX", "EOS", "AXS", "MANA", "SHIB");

    public static String normalize(String assetType) {
        if (assetType == null) return "US_STOCK";
        return switch (assetType.toUpperCase()) {
            case "ETF" -> "ETF";
            case "STOCK", "KR_STOCK", "KRX" -> "STOCK";
            case "CRYPTO", "COIN" -> "CRYPTO";
            default -> "US_STOCK";
        };
    }

    /** 자산군 기본 유니버스. */
    public static List<String> defaultUniverse(String assetType) {
        return switch (normalize(assetType)) {
            case "ETF" -> US_ETFS;
            case "STOCK" -> KR_STOCKS;
            case "CRYPTO" -> CRYPTO;
            default -> usStocks();
        };
    }

    /** 레짐 판정 벤치마크 심볼. */
    public static String regimeSymbol(String assetType) {
        return switch (normalize(assetType)) {
            case "STOCK" -> "069500";   // KODEX 200
            case "CRYPTO" -> "BTC";
            default -> "SPY";           // US_STOCK·ETF
        };
    }

    /** 레짐 벤치마크 데이터 조회용 자산군. */
    public static String regimeAssetType(String assetType) {
        return switch (normalize(assetType)) {
            case "STOCK" -> "STOCK";
            case "CRYPTO" -> "CRYPTO";
            default -> "US_STOCK";      // SPY는 US_STOCK 경로(모멘텀 캐시 워밍 대상)
        };
    }

    /** 시뮬레이션 통화가 USD인지(미국주식·ETF). 그 외(한국주식·코인)는 KRW. */
    public static boolean isUsd(String assetType) {
        String a = normalize(assetType);
        return a.equals("US_STOCK") || a.equals("ETF");
    }

    /** 결과 표시용 자산군 한글 라벨. */
    public static String label(String assetType) {
        return switch (normalize(assetType)) {
            case "ETF" -> "미국 ETF";
            case "STOCK" -> "한국주식";
            case "CRYPTO" -> "가상자산";
            default -> "미국주식";
        };
    }
}
