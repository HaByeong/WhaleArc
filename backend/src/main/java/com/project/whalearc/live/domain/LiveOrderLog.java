package com.project.whalearc.live.domain;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * 라이브 자동매매 주문 원장(감사 추적) + 멱등성 키 저장소.
 *
 * <p>clientOrderId에 unique 인덱스를 걸어, 같은 봉(bar)에 대해 동일 (배포·심볼·방향)
 * 주문이 중복 발주되지 않도록 보장한다. 스케줄러가 같은 봉을 여러 번 평가해도(예: 1일봉을
 * 매시간 평가) 멱등키가 같으므로 1회만 체결된다. 실거래(실돈)에서 타임아웃 재시도로 인한
 * 중복 집행을 막는 핵심 안전장치이기도 하다.
 */
@Getter
@Setter
@NoArgsConstructor
@Document(collection = "live_order_logs")
public class LiveOrderLog {

    @Id
    private String id;

    @Indexed
    private String deploymentId;

    @Indexed
    private String userId;

    private String symbol;
    private String assetType;
    private String side;          // BUY / SELL
    private BigDecimal quantity;
    private BigDecimal price;     // 체결가(네이티브 통화)

    /** 멱등키: deploymentId:symbol:side:barTimestamp. unique 인덱스로 중복 발주 차단. */
    @Indexed(unique = true)
    private String clientOrderId;

    /** 체결 주문 식별자(모의=내부 orderId, 실거래=거래소 주문번호). */
    private String brokerOrderId;

    private String status;        // FILLED / REJECTED / SUBMITTED
    private String reason;        // ENTRY / STOP / TAKE_PROFIT / EXIT_SIGNAL
    private Instant createdAt;

    public LiveOrderLog(String deploymentId, String userId, String symbol, String assetType,
                        String side, BigDecimal quantity, BigDecimal price,
                        String clientOrderId, String brokerOrderId, String status, String reason) {
        this.deploymentId = deploymentId;
        this.userId = userId;
        this.symbol = symbol;
        this.assetType = assetType;
        this.side = side;
        this.quantity = quantity;
        this.price = price;
        this.clientOrderId = clientOrderId;
        this.brokerOrderId = brokerOrderId;
        this.status = status;
        this.reason = reason;
        this.createdAt = Instant.now();
    }
}
