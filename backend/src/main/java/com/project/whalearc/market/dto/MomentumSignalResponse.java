package com.project.whalearc.market.dto;

import java.util.List;

/**
 * 모멘텀 로테이션 "범용 시그널" — 이번 시점의 자산군별 상대모멘텀 Top-N + 레짐.
 *
 * <p>기기 실행형(App)에 제공하는 <b>범용 시장정보</b>다(특정 사용자 계좌·포지션·투자금 무관 = INV-4 도구중립,
 * INV-2 미침해). 목표비중·주수·매도/매수 목록 같은 "내 계좌 판단"은 절대 포함하지 않는다 — 그건 App이
 * lastClose로 직접 사이징한다.
 */
public record MomentumSignalResponse(
        String assetType,        // 정규화된 자산군 (US_STOCK/ETF/STOCK/CRYPTO)
        String asOf,             // 랭킹 기준일 (yyyy-MM-dd, KST)
        String currency,         // 종가 통화 (USD/KRW)
        boolean regimeBear,      // 약세 레짐 여부 (벤치마크 200SMA 아래)
        String regimeBenchmark,  // 레짐 벤치마크 심볼 (SPY/069500/BTC)
        int topN,
        int lookback,
        List<RankedHolding> ranked   // 양수 모멘텀 내림차순, 최대 topN (없으면 빈 리스트=현금)
) {
    public record RankedHolding(
            String symbol,
            String name,
            double momentum,     // close[t]/close[t-lookback] - 1
            double lastClose,    // 최근 종가 (네이티브 통화) — App 사이징용
            String exchange      // KIS EXCD(NAS/NYS/AMS) — App 해외주문 거래소 코드용(미국주식/ETF만, 그 외 "")
    ) {}
}
