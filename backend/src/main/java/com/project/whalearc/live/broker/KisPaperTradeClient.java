package com.project.whalearc.live.broker;

import com.project.whalearc.trade.domain.Order;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 한국투자증권 모의투자(VTS) 시장가 주문 클라이언트.
 *
 * <p>실돈 없이 실제 KIS 주문 API 파이프라인(OAuth 토큰 → hashkey 서명 → 현금주문)을 검증하기 위한 것.
 * 자격증명 출처에 독립적이다(KisPaperCredential을 인자로 받음). 모의투자 도메인(openapivts:29443)과
 * 모의 TR ID(매수 VTTC0802U / 매도 VTTC0801U)를 사용한다. ORD_DVSN=01(시장가).
 *
 * <p>주의: 주문 "접수"까지만 처리한다. 실제 체결가/부분체결 확정(주문조회 폴링)은 체결 확인 단계에서
 * 보강해야 한다. 실전 전환 시 base-url을 openapi:9443, TR ID를 TTTC080xU로 바꾸는 분기가 추가로 필요.
 */
@Slf4j
@Component
public class KisPaperTradeClient {

    @Value("${kis.paper.base-url:https://openapivts.koreainvestment.com:29443}")
    private String baseUrl;

    private RestTemplate restTemplate = new RestTemplate();

    private final Map<String, CachedToken> tokenCache = new ConcurrentHashMap<>();

    private record CachedToken(String token, long expiresAtMillis) {}

    /** 테스트 주입용(네트워크 없이 검증). */
    void setRestTemplate(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    /**
     * 시장가 주문 접수.
     * @param side BUY/SELL, stockCode 국내 6자리 종목코드, quantity 주(정수)
     */
    public KisOrderResult placeMarketOrder(KisPaperCredential cred, Order.OrderType side, String stockCode, BigDecimal quantity) {
        String token = getToken(cred);

        Map<String, String> body = new HashMap<>();
        body.put("CANO", cred.accountNumber());
        body.put("ACNT_PRDT_CD", cred.productCode() != null ? cred.productCode() : "01");
        body.put("PDNO", stockCode);
        body.put("ORD_DVSN", "01");                           // 01 = 시장가
        body.put("ORD_QTY", quantity.toBigInteger().toString());  // 국내주식 정수 수량
        body.put("ORD_UNPR", "0");                            // 시장가는 단가 0

        String hash = getHashkey(cred, body);
        String trId = side == Order.OrderType.BUY ? "VTTC0802U" : "VTTC0801U";  // 모의투자 매수/매도

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("authorization", "Bearer " + token);
        headers.set("appkey", cred.appkey());
        headers.set("appsecret", cred.appsecret());
        headers.set("tr_id", trId);
        headers.set("custtype", "P");
        headers.set("hashkey", hash);

        ResponseEntity<Map> resp = restTemplate.exchange(
                baseUrl + "/uapi/domestic-stock/v1/trading/order-cash",
                HttpMethod.POST, new HttpEntity<>(body, headers), Map.class);

        Map<?, ?> b = resp.getBody();
        String rtCd = b != null ? String.valueOf(b.get("rt_cd")) : null;
        String msg = b != null ? String.valueOf(b.get("msg1")) : "응답 없음";
        if (!"0".equals(rtCd)) {
            log.warn("KIS 모의투자 주문 거부: rt_cd={}, msg={}", rtCd, msg);
            return new KisOrderResult(false, null, msg);
        }
        String odno = null;
        if (b.get("output") instanceof Map<?, ?> o) {
            odno = String.valueOf(o.get("ODNO"));
        }
        return new KisOrderResult(true, odno, msg);
    }

    private String getToken(KisPaperCredential cred) {
        CachedToken cached = tokenCache.get(cred.appkey());
        if (cached != null && System.currentTimeMillis() < cached.expiresAtMillis()) {
            return cached.token();
        }
        Map<String, String> body = new HashMap<>();
        body.put("grant_type", "client_credentials");
        body.put("appkey", cred.appkey());
        body.put("appsecret", cred.appsecret());
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        ResponseEntity<Map> resp = restTemplate.exchange(
                baseUrl + "/oauth2/tokenP", HttpMethod.POST, new HttpEntity<>(body, headers), Map.class);
        Map<?, ?> b = resp.getBody();
        if (b == null || b.get("access_token") == null) {
            throw new IllegalStateException("KIS 모의투자 토큰 발급 실패");
        }
        String token = String.valueOf(b.get("access_token"));
        long ttl = 23L * 3600 * 1000;
        if (b.get("expires_in") != null) {
            try {
                ttl = (long) (Double.parseDouble(String.valueOf(b.get("expires_in"))) * 1000) - 60_000;
            } catch (NumberFormatException ignore) { /* 기본 23h 사용 */ }
        }
        tokenCache.put(cred.appkey(), new CachedToken(token, System.currentTimeMillis() + ttl));
        return token;
    }

    private String getHashkey(KisPaperCredential cred, Map<String, String> body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("appkey", cred.appkey());
        headers.set("appsecret", cred.appsecret());

        ResponseEntity<Map> resp = restTemplate.exchange(
                baseUrl + "/uapi/hashkey", HttpMethod.POST, new HttpEntity<>(body, headers), Map.class);
        Map<?, ?> b = resp.getBody();
        if (b == null || b.get("HASH") == null) {
            throw new IllegalStateException("KIS hashkey 발급 실패");
        }
        return String.valueOf(b.get("HASH"));
    }
}
