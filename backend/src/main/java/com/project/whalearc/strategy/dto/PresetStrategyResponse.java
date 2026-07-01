package com.project.whalearc.strategy.dto;

import com.project.whalearc.strategy.domain.Condition;
import com.project.whalearc.strategy.domain.Indicator;
import lombok.Builder;
import lombok.Getter;

import java.util.List;
import java.util.Map;

/**
 * 프리셋 전략 카탈로그 응답 1건 — 프론트 presetStrategies.ts의 단일 출처(SSOT)를 백엔드로 이식한 형태.
 *
 * App(기기 실행형)·web·백테스트가 모두 이 정의를 받아 쓴다. indicators+conditions는 App SignalEvaluator가
 * 그대로 평가하며, 카탈로그 제공은 사용자 무관 범용 템플릿이라 규제상 도구 중립(INV-4)에 해당한다.
 */
@Getter
@Builder
public class PresetStrategyResponse {
    private String id;
    private String name;
    private String description;
    private String difficulty;      // 초급/중급/고급
    private String category;        // basic/trend/reversal/volatility
    private String minTier;         // FREE/BASIC/PRO (미지정 시 FREE로 내려보냄)
    private String assetType;       // MIXED/CRYPTO/US_STOCK ...
    private List<String> targetAssets;
    private Map<String, String> targetAssetNames;
    private List<Indicator> indicators;
    private List<Condition> entryConditions;
    private List<Condition> exitConditions;
    private String strategyLogic;
    private String beginnerTip;
    private String whyUse;

    // 특수 전략 메타 (모멘텀/터틀). App은 strategyType으로 분기한다.
    private String strategyType;    // "MOMENTUM_ROTATION"이면 모멘텀 로테이션 (전용 화면)
    private String tradeDirection;  // LONG_ONLY/SHORT_ONLY/LONG_SHORT/LONG_SHORT_FLAT
    private String pyramidMode;     // ATR/SIGNAL
    private Integer leverage;
    private Integer maxPositions;
    private Double trailingStopPercent;
    private List<Condition> shortEntryConditions;
    private List<Condition> shortExitConditions;
}
