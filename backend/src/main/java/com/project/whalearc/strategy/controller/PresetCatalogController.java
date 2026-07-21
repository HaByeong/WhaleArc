package com.project.whalearc.strategy.controller;

import com.project.whalearc.common.dto.ApiResponse;
import com.project.whalearc.strategy.catalog.PresetCatalog;
import com.project.whalearc.strategy.dto.PresetStrategyResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 프리셋 전략 카탈로그 — 사용자 무관 범용 템플릿 제공(INV-4 도구 중립). 무인증 공개(GET permitAll).
 *
 * App(기기 실행형)이 이 정의를 받아 SignalEvaluator로 평가·배포한다. 개인화 신호·주문은 일절 없다.
 */
@RestController
@RequestMapping("/api/strategies")
public class PresetCatalogController {

    @GetMapping("/catalog")
    public ResponseEntity<ApiResponse<List<PresetStrategyResponse>>> getCatalog() {
        return ResponseEntity.ok(ApiResponse.ok(PresetCatalog.all()));
    }
}
