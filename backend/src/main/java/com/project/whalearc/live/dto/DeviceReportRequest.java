package com.project.whalearc.live.dto;

import com.project.whalearc.live.domain.LiveStrategyDeployment;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Model A(기기 실행형): 사용자 기기가 로컬 키로 실행한 결과(포지션·손익·체결수·마지막 평가시각)를
 * 서버에 <b>사후 보고</b>하는 페이로드. 서버는 이 값을 대시보드 표시용으로만 저장한다.
 *
 * <p><b>불변식</b>: 이 보고로 서버는 어떤 주문·실행도 하지 않는다(read-only). 방향은 반드시
 * 기기→서버 사후 보고이며, 서버가 기기에 주문을 지시하는 역방향은 금지된다(역방향은 투자일임 소지).
 */
@Data
public class DeviceReportRequest {
    private List<LiveStrategyDeployment.LivePosition> positions;
    private BigDecimal realizedPnl;
    private BigDecimal todayRealizedPnl;
    private Integer tradeCount;
    private Integer winCount;
    private Instant lastEvaluatedAt;
}
