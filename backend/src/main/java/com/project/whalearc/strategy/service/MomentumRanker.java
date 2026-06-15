package com.project.whalearc.strategy.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

/**
 * 상대모멘텀 랭킹 — 백테스트(월별 결정)와 라이브(월간 로테이션)가 공유하는 순수 계산 유틸.
 *
 * <p>동일한 랭킹 로직을 양쪽이 쓰게 해 백테스트 결과와 라이브 동작의 일치를 보장한다.
 * 명세 §2.2: 12개월(기본 252거래일) 모멘텀 = close[t]/close[t-lookback] - 1, 양수만 후보,
 * 내림차순 정렬 후 상위 N개 선택. 양수 종목이 N개 미만이면 그 수만큼만(빈 슬롯은 호출자가 현금 처리).
 */
public final class MomentumRanker {

    private MomentumRanker() {}

    public record Ranked(String symbol, double momentum) {}

    /**
     * @param closesBySymbol 심볼 → 마스터 거래일축에 정렬된 (수정)종가 배열. 결측일은 NaN.
     * @param t              현재(결정) 인덱스 (마스터 거래일축 기준)
     * @param lookback       모멘텀 거래일 수 (기본 252)
     * @param topN           선택 상위 종목 수 (기본 5)
     * @return 양수 모멘텀 상위 topN (모멘텀 내림차순). 후보가 적으면 그만큼만.
     */
    public static List<Ranked> rank(Map<String, double[]> closesBySymbol, int t, int lookback, int topN) {
        List<Ranked> candidates = new ArrayList<>();
        for (Map.Entry<String, double[]> e : closesBySymbol.entrySet()) {
            double[] p = e.getValue();
            if (p == null || t >= p.length || t - lookback < 0) continue;   // 252일 미만(상장 초기) 제외
            double now = p[t];
            double past = p[t - lookback];
            if (Double.isNaN(now) || Double.isNaN(past) || past <= 0) continue;
            double mom = now / past - 1.0;
            if (mom > 0) candidates.add(new Ranked(e.getKey(), mom));   // 절대 모멘텀 필터
        }
        candidates.sort(Comparator.comparingDouble(Ranked::momentum).reversed());
        return candidates.size() > topN ? new ArrayList<>(candidates.subList(0, topN)) : candidates;
    }
}
