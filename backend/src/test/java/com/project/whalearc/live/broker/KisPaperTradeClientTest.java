package com.project.whalearc.live.broker;

import com.project.whalearc.trade.domain.Order;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * KIS 모의투자 주문 클라이언트 검증 — 네트워크 없이 RestTemplate을 모킹해, 주문 요청이 올바른
 * 모의투자 TR ID·엔드포인트·시장가 본문으로 구성되고 응답을 정확히 파싱하는지 확인.
 */
class KisPaperTradeClientTest {

    private RestTemplate rt;
    private KisPaperTradeClient client;

    @BeforeEach
    @SuppressWarnings({"unchecked", "rawtypes"})
    void setUp() {
        rt = mock(RestTemplate.class);
        client = new KisPaperTradeClient();
        client.setRestTemplate(rt);
        // 토큰 발급
        when(rt.exchange(contains("/oauth2/tokenP"), eq(HttpMethod.POST), any(), eq(Map.class)))
                .thenReturn((ResponseEntity) ResponseEntity.ok(Map.of("access_token", "tok", "expires_in", "86400")));
        // hashkey 서명
        when(rt.exchange(contains("/uapi/hashkey"), eq(HttpMethod.POST), any(), eq(Map.class)))
                .thenReturn((ResponseEntity) ResponseEntity.ok(Map.of("HASH", "HASHED")));
    }

    private KisPaperCredential cred() {
        return new KisPaperCredential("ak", "as", "12345678", "01");
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void buildsPaperMarketBuyOrder() {
        ArgumentCaptor<HttpEntity> cap = ArgumentCaptor.forClass(HttpEntity.class);
        when(rt.exchange(contains("/order-cash"), eq(HttpMethod.POST), cap.capture(), eq(Map.class)))
                .thenReturn((ResponseEntity) ResponseEntity.ok(Map.of("rt_cd", "0", "msg1", "정상", "output", Map.of("ODNO", "0000117057"))));

        KisOrderResult r = client.placeMarketOrder(cred(), Order.OrderType.BUY, "005930", new BigDecimal("10"));

        assertTrue(r.accepted());
        assertEquals("0000117057", r.brokerOrderNo());

        HttpEntity<?> sent = cap.getValue();
        assertEquals("VTTC0802U", sent.getHeaders().getFirst("tr_id"), "모의투자 매수 TR");
        assertEquals("Bearer tok", sent.getHeaders().getFirst("authorization"));
        assertEquals("HASHED", sent.getHeaders().getFirst("hashkey"));
        assertEquals("ak", sent.getHeaders().getFirst("appkey"));

        @SuppressWarnings("unchecked")
        Map<String, String> body = (Map<String, String>) sent.getBody();
        assertEquals("01", body.get("ORD_DVSN"), "시장가");
        assertEquals("10", body.get("ORD_QTY"), "정수 수량");
        assertEquals("0", body.get("ORD_UNPR"), "시장가는 단가 0");
        assertEquals("005930", body.get("PDNO"));
        assertEquals("12345678", body.get("CANO"));
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void sellUsesPaperSellTrId() {
        ArgumentCaptor<HttpEntity> cap = ArgumentCaptor.forClass(HttpEntity.class);
        when(rt.exchange(contains("/order-cash"), eq(HttpMethod.POST), cap.capture(), eq(Map.class)))
                .thenReturn((ResponseEntity) ResponseEntity.ok(Map.of("rt_cd", "0", "msg1", "정상", "output", Map.of("ODNO", "1"))));

        client.placeMarketOrder(cred(), Order.OrderType.SELL, "005930", new BigDecimal("5"));

        assertEquals("VTTC0801U", cap.getValue().getHeaders().getFirst("tr_id"), "모의투자 매도 TR");
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void rejectedOrderReturnsNotAccepted() {
        when(rt.exchange(contains("/order-cash"), eq(HttpMethod.POST), any(), eq(Map.class)))
                .thenReturn((ResponseEntity) ResponseEntity.ok(Map.of("rt_cd", "1", "msg1", "주문가능금액부족")));

        KisOrderResult r = client.placeMarketOrder(cred(), Order.OrderType.BUY, "005930", new BigDecimal("10"));

        assertFalse(r.accepted());
        assertEquals("주문가능금액부족", r.message());
        assertNull(r.brokerOrderNo());
    }
}
