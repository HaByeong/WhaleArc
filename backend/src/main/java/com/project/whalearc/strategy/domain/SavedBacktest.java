package com.project.whalearc.strategy.domain;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * 저장된 백테스트 결과 — 사용자가 실행한 백테스트를 서버에 보관(기기 간 공유·회고·A/B 비교).
 * 요약 필드(리스트용)는 컬럼으로, 전체 결과(상세 재표시용)는 JSON 문자열로 저장한다
 * (BacktestResponse 가 @Builder 전용이라 Mongo 역직렬화가 어려워 JSON 직렬화로 우회).
 */
@Getter
@Setter
@NoArgsConstructor
@Document(collection = "backtest_results")
public class SavedBacktest {

    @Id
    private String id;

    @Indexed
    private String userId;

    // ── 요약 (히스토리 리스트용 — JSON 파싱 없이 표시) ──
    private String strategyName;
    private String stockCode;
    private String stockName;
    private String startDate;
    private String endDate;
    private double totalReturnRate;
    private double sharpeRatio;
    private double maxDrawdown;
    private int totalTrades;

    // 전체 결과 JSON (상세 재표시용)
    private String resultJson;

    private Instant createdAt;
}
