package com.project.whalearc.trade.domain;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * 거래 복기 노트 — 청산 거래(reviewKey)별 체크리스트/메모.
 * 기기 간 동기화를 위해 localStorage 대신 서버에 보관한다.
 */
@Getter
@Setter
@NoArgsConstructor
@Document(collection = "trade_reviews")
@CompoundIndex(name = "idx_user_reviewkey", def = "{'userId': 1, 'reviewKey': 1}", unique = true)
public class TradeReview {

    @Id
    private String id;

    @Indexed
    private String userId;

    private String reviewKey;                 // 프론트 ClosedTrade.id = "<매수체결ID>_<매도체결ID>"
    private Map<String, Boolean> checks = new HashMap<>(); // 원칙 텍스트 → 체크 여부
    private String memo;
    private Instant updatedAt;
}
