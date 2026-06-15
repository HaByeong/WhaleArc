package com.project.whalearc.market.service;

import java.util.List;

/**
 * 미국주식 상대모멘텀 로테이션 전략의 기본 유니버스.
 *
 * <p>명세(STRATEGY_TOP5_MOMENTUM.md §2.1)의 11섹터 대형주 전체 목록(139종목, 그 중 상폐 7종목 포함).
 * 상폐/티커변경 종목(K, PARA, HBI, CMA, GPS, WBA, IPG 등)도 목록에 유지한다 — 데이터 소스(Yahoo) 404는
 * 백테스트/라이브 런타임에서 조용히 스킵되므로, 명세의 "연 1회 점검·갱신" 정책과 일치시켜 코드에서 제거하지 않는다.
 * 생존편향 완화를 위해 승자+장기부진주를 섞은 넓은(132+) 섹터중립 유니버스가 전략의 핵심 전제.
 */
public final class MomentumUniverse {

    private MomentumUniverse() {}

    /** 시장 레짐(강세/약세) 판정 기준 지수 — S&P500 ETF. */
    public static final String SPY_SYMBOL = "SPY";

    private static final List<String> SYMBOLS = List.of(
            // IT
            "AAPL", "MSFT", "NVDA", "AVGO", "ORCL", "CRM", "ADBE", "CSCO", "ACN", "IBM",
            "INTC", "QCOM", "TXN", "AMD", "MU", "AMAT", "INTU", "HPQ", "DELL", "WDC",
            "STX", "HPE", "NOK", "ERIC", "GLW", "TXT",
            // 커뮤니케이션
            "GOOGL", "META", "NFLX", "DIS", "CMCSA", "T", "VZ", "TMUS", "CHTR", "PARA",
            "WBD", "IPG", "OMC", "EA",
            // 경기소비재
            "AMZN", "TSLA", "HD", "MCD", "NKE", "SBUX", "LOW", "TJX", "BKNG", "F",
            "GM", "GPS", "M", "KSS", "HBI", "YUM", "MAR",
            // 필수소비재
            "PG", "KO", "PEP", "WMT", "COST", "MO", "PM", "CL", "KMB", "K",
            "KHC", "CAG", "CPB", "WBA", "KR",
            // 금융
            "JPM", "BAC", "WFC", "C", "GS", "MS", "AXP", "SCHW", "BLK", "KEY",
            "CMA", "MET", "PRU", "USB", "PNC",
            // 헬스케어
            "UNH", "JNJ", "LLY", "PFE", "MRK", "ABBV", "TMO", "ABT", "BMY", "CVS",
            "VTRS", "GILD", "MDT", "CI",
            // 산업재
            "BA", "CAT", "GE", "HON", "UPS", "RTX", "LMT", "DE", "MMM", "EMR",
            "FDX", "CSX", "ETN",
            // 에너지
            "XOM", "CVX", "COP", "SLB", "EOG", "OXY", "APA", "HAL", "DVN", "MPC",
            // 소재/유틸/리츠
            "LIN", "APD", "SHW", "FCX", "NEM", "NUE", "MOS", "NEE", "DUK", "SO",
            "AMT", "PLD", "SPG", "O", "VNO"
    );

    /** 기본 유니버스 심볼 목록(139종목, 상폐 포함). */
    public static List<String> symbols() {
        return SYMBOLS;
    }
}
