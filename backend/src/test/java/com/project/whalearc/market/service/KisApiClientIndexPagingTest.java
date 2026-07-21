package com.project.whalearc.market.service;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 지수 일봉 페이지네이션 헬퍼 단위 테스트.
 * KIS FHKUP03500100은 호출당 반환 행수가 잘리므로(실측 ~750건 ≈ 3년) '페이지의 가장 오래된
 * 거래일 하루 전'으로 윈도우를 옮겨가며 수집한다 — 그 날짜 계산(oldestDateOf/prevDay)을 고정한다.
 */
class KisApiClientIndexPagingTest {

    private static Map<String, String> row(String date) {
        return Map.of("stck_bsop_date", date, "bstp_nmix_prpr", "2500.00");
    }

    // ── oldestDateOf ──
    @Test
    void oldestDateOf_newestFirstOrder_returnsLast() {
        // KIS 기본 응답 순서(최신→과거)
        String oldest = KisApiClient.oldestDateOf(List.of(row("20260708"), row("20260707"), row("20260704")));
        assertEquals("20260704", oldest);
    }

    @Test
    void oldestDateOf_unorderedRows_stillFindsMin() {
        // 순서 보장이 깨져도 최솟값을 찾는다
        String oldest = KisApiClient.oldestDateOf(List.of(row("20260704"), row("20260708"), row("20260707")));
        assertEquals("20260704", oldest);
    }

    @Test
    void oldestDateOf_ignoresBlankAndMissingDates() {
        String oldest = KisApiClient.oldestDateOf(List.of(
                Map.of("stck_bsop_date", "", "bstp_nmix_prpr", "1.0"),
                Map.of("bstp_nmix_prpr", "1.0"),
                row("20260102")));
        assertEquals("20260102", oldest);
    }

    @Test
    void oldestDateOf_emptyOrDateless_returnsNull() {
        assertNull(KisApiClient.oldestDateOf(List.of()));
        assertNull(KisApiClient.oldestDateOf(List.of(Map.of("bstp_nmix_prpr", "1.0"))));
    }

    // ── prevDay ──
    @Test
    void prevDay_midMonth() {
        assertEquals("20260707", KisApiClient.prevDay("20260708"));
    }

    @Test
    void prevDay_monthBoundary() {
        assertEquals("20260630", KisApiClient.prevDay("20260701"));
    }

    @Test
    void prevDay_yearBoundary() {
        assertEquals("20251231", KisApiClient.prevDay("20260101"));
    }

    @Test
    void prevDay_leapDay() {
        assertEquals("20240229", KisApiClient.prevDay("20240301")); // 2024는 윤년
    }
}
