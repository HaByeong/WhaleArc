package com.project.whalearc.strategy.service;

import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 상대모멘텀 랭킹 핵심 로직 검증 (백테스트·라이브 공유 유틸).
 * 명세 §2.2: close[t]/close[t-lookback]-1, 양수만, 내림차순 topN.
 */
class MomentumRankerTest {

    /** lookback=2, t=2 기준 종목별 모멘텀 = p[2]/p[0]-1. */
    private Map<String, double[]> sample() {
        Map<String, double[]> m = new LinkedHashMap<>();
        m.put("A", new double[]{100, 110, 130});  // +30%
        m.put("B", new double[]{100, 100, 110});  // +10%
        m.put("C", new double[]{100, 90, 95});     // -5% (양수필터 탈락)
        m.put("D", new double[]{100, 120, 150});  // +50%
        return m;
    }

    @Test
    void ranks_byMomentumDesc_positiveOnly_topN() {
        List<MomentumRanker.Ranked> r = MomentumRanker.rank(sample(), 2, 2, 5);
        // 양수 3종목(D+50, A+30, B+10), C 제외, 내림차순
        assertEquals(List.of("D", "A", "B"), r.stream().map(MomentumRanker.Ranked::symbol).toList());
        assertEquals(0.50, r.get(0).momentum(), 1e-9);
        assertEquals(0.30, r.get(1).momentum(), 1e-9);
    }

    @Test
    void truncatesToTopN() {
        List<MomentumRanker.Ranked> r = MomentumRanker.rank(sample(), 2, 2, 2);
        assertEquals(2, r.size());
        assertEquals(List.of("D", "A"), r.stream().map(MomentumRanker.Ranked::symbol).toList());
    }

    @Test
    void fewerPositivesThanTopN_returnsOnlyPositives() {
        Map<String, double[]> m = new LinkedHashMap<>();
        m.put("A", new double[]{100, 110, 130});   // +30%
        m.put("B", new double[]{100, 90, 80});      // -20%
        m.put("C", new double[]{100, 90, 70});      // -30%
        List<MomentumRanker.Ranked> r = MomentumRanker.rank(m, 2, 2, 5);
        assertEquals(1, r.size(), "양수는 A 하나뿐 → 나머지 슬롯은 현금(호출자 처리)");
        assertEquals("A", r.get(0).symbol());
    }

    @Test
    void excludesInsufficientHistory_andNaN() {
        Map<String, double[]> m = new LinkedHashMap<>();
        m.put("OK", new double[]{100, 110, 130});
        m.put("SHORT", new double[]{Double.NaN, Double.NaN, 130}); // t-lookback=NaN → 제외
        // t-lookback < 0 케이스: lookback=5, t=2 → 전부 제외
        assertTrue(MomentumRanker.rank(m, 2, 5, 5).isEmpty(), "lookback 미만이면 후보 없음");
        List<MomentumRanker.Ranked> r = MomentumRanker.rank(m, 2, 2, 5);
        assertEquals(List.of("OK"), r.stream().map(MomentumRanker.Ranked::symbol).toList(), "NaN 과거가 종목 제외");
    }

    @Test
    void allNegative_returnsEmpty() {
        Map<String, double[]> m = new LinkedHashMap<>();
        m.put("A", new double[]{100, 90, 80});
        m.put("B", new double[]{100, 95, 90});
        assertTrue(MomentumRanker.rank(m, 2, 2, 5).isEmpty(), "전부 음수면 전액 현금");
    }
}
