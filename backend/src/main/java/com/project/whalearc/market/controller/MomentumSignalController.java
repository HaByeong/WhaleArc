package com.project.whalearc.market.controller;

import com.project.whalearc.market.dto.MomentumSignalResponse;
import com.project.whalearc.market.service.MomentumSignalService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 모멘텀 로테이션 범용 시그널 API — 기기 실행형(App)이 "이번 달 Top-N + 레짐"을 받는 공개 엔드포인트.
 *
 * <p>{@code /api/market/**} 는 SecurityConfig에서 permitAll(공개 시장정보 = INV-4) → App 백그라운드
 * isolate에서 인증 없이 호출 가능. 응답은 범용 랭킹·종가까지만 — 사용자별 매매 판단은 App에서(INV-2).
 */
@Slf4j
@RestController
@RequestMapping("/api/market/momentum")
@RequiredArgsConstructor
public class MomentumSignalController {

    private final MomentumSignalService momentumSignalService;

    @GetMapping("/signal")
    public ResponseEntity<MomentumSignalResponse> getSignal(
            @RequestParam(defaultValue = "US_STOCK") String assetType,
            @RequestParam(defaultValue = "5") int topN,
            @RequestParam(defaultValue = "252") int lookback,
            @RequestParam(defaultValue = "true") boolean regime) {
        try {
            return ResponseEntity.ok(momentumSignalService.calculate(assetType, topN, lookback, regime));
        } catch (Exception e) {
            log.warn("모멘텀 시그널 계산 실패: assetType={}, error={}", assetType, e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }
}
