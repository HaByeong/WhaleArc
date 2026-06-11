package com.project.whalearc.live.domain;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.time.LocalDate;

/**
 * 라이브 배포(자동매매)의 일별 손익 스냅샷.
 * 매일 자정(KST) 배포별 평가손익률(%) = (실현 + 미실현) / 할당금 × 100 을 1건 저장 →
 * 자동매매 카드의 손익 스파크라인 데이터로 사용.
 * (실계좌 {@code ExchangePortfolioSnapshot} 와 동일 패턴, 배포 단위로 보관)
 */
@Getter
@Setter
@NoArgsConstructor
@Document(collection = "live_deployment_equity_snapshots")
@CompoundIndex(name = "deploymentId_date", def = "{'deploymentId': 1, 'date': 1}", unique = true)
public class LiveDeploymentEquitySnapshot {

    @Id
    private String id;

    @Indexed
    private String deploymentId;
    private String userId;
    private LocalDate date;
    private double pnlPct;        // (실현 + 미실현) / 할당금 × 100. 스파크라인 y값.
    private Instant createdAt;

    public LiveDeploymentEquitySnapshot(String deploymentId, String userId, LocalDate date, double pnlPct) {
        this.deploymentId = deploymentId;
        this.userId = userId;
        this.date = date;
        this.pnlPct = pnlPct;
        this.createdAt = Instant.now();
    }
}
