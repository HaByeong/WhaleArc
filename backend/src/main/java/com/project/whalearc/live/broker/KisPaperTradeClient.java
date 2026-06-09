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

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 한국투자증권 시장가 현금주문 클라이언트 (모의투자/실전 전환 지원).
 *
 * <p>실제 KIS 주문 API 파이프라인(OAuth 토큰 → hashkey 서명 → 현금주문)을 호출한다. 자격증명 출처에
 * 독립적이다(KisPaperCredential을 인자로 받음). live.broker.kis.real 플래그로 모드 전환:
 * <ul>
 *   <li>모의투자(기본): openapivts:29443, TR 매수 VTTC0802U / 매도 VTTC0801U (실돈 0)</li>
 *   <li>실전(real=true): openapi:9443, TR 매수 TTTC0802U / 매도 TTTC0801U (실제 자금!)</li>
 * </ul>
 * ORD_DVSN=01(시장가).
 *
 * <p>주의: 현재 주문 "접수"까지만 처리한다. 실제 체결가/부분체결 확정(주문조회 폴링)은 체결 확인 단계에서
 * 보강해야 한다 — 실전에서 금액을 키우기 전 반드시 필요.
 */
@Slf4j
@Component
public class KisPaperTradeClient {

    // 실전(true) / 모의투자(false) 전환. 실전이면 도메인·TR ID가 달라진다.
    @Value("${live.broker.kis.real:false}")
    private boolean realTrading;
    @Value("${live.broker.kis.paper-base-url:https://openapivts.koreainvestment.com:29443}")
    private String paperBaseUrl = "https://openapivts.koreainvestment.com:29443";
    @Value("${live.broker.kis.live-base-url:https://openapi.koreainvestment.com:9443}")
    private String liveBaseUrl = "https://openapi.koreainvestment.com:9443";

    private RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    private final Map<String, CachedToken> tokenCache = new ConcurrentHashMap<>();

    private record CachedToken(String token, long expiresAtMillis) {}

    /** 실전이면 실전 도메인(openapi:9443), 아니면 모의투자(openapivts:29443). */
    private String baseUrl() {
        return realTrading ? liveBaseUrl : paperBaseUrl;
    }

    /**
     * JSON 본문 POST — 본문을 byte[]로 직렬화하고 Content-Length를 명시한다.
     *
     * <p>KIS 게이트웨이는 {@code Transfer-Encoding: chunked} POST를 라우팅 단계에서 거부한다(EGW00202
     * "GW라우팅 중 오류"). RestTemplate 기본 경로가 본문을 스트리밍(chunked)하면 주문이 통째로 실패하므로,
     * 본문을 미리 byte[]로 직렬화해 Content-Length를 박는다. 추가로 hashkey 계산 본문과 주문 본문을
     * 동일한 objectMapper 직렬화로 맞춰 HASH 불일치(서명 오류)도 방지한다.
     */
    @SuppressWarnings("rawtypes")
    private ResponseEntity<Map> postJson(String url, Map<String, String> body, HttpHeaders headers) {
        byte[] json;
        try {
            json = objectMapper.writeValueAsBytes(body);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("KIS 요청 본문 직렬화 실패", e);
        }
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setContentLength(json.length);
        return restTemplate.exchange(url, HttpMethod.POST, new HttpEntity<>(json, headers), Map.class);
    }

    /** 테스트 주입용(네트워크 없이 검증). */
    void setRestTemplate(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    /** 테스트/설정용 — 실전 모드 토글. */
    void setRealTrading(boolean realTrading) {
        this.realTrading = realTrading;
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
        // 실전 TTTC / 모의투자 VTTC, 매수 0802U / 매도 0801U
        String trId = (realTrading ? "TTTC" : "VTTC") + (side == Order.OrderType.BUY ? "0802U" : "0801U");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("authorization", "Bearer " + token);
        headers.set("appkey", cred.appkey());
        headers.set("appsecret", cred.appsecret());
        headers.set("tr_id", trId);
        headers.set("custtype", "P");
        headers.set("hashkey", hash);

        ResponseEntity<Map> resp = postJson(baseUrl() + "/uapi/domestic-stock/v1/trading/order-cash", body, headers);

        Map<?, ?> b = resp.getBody();
        String rtCd = b != null ? String.valueOf(b.get("rt_cd")) : null;
        String msg = b != null ? String.valueOf(b.get("msg1")) : "응답 없음";
        if (!"0".equals(rtCd)) {
            log.warn("KIS 주문 거부: real={}, rt_cd={}, msg={}", realTrading, rtCd, msg);
            return new KisOrderResult(false, null, msg);
        }
        String odno = null;
        if (b.get("output") instanceof Map<?, ?> o) {
            odno = String.valueOf(o.get("ODNO"));
        }
        return new KisOrderResult(true, odno, msg);
    }

    /**
     * 해외(미국) 지정가 주문 접수. 미국은 시장가가 없어 지정가(limitPrice)로 발주한다.
     * @param ovrsExcgCd 주문 거래소코드(NASD/NYSE/AMEX), ticker 미국 종목코드, quantity 주(정수), limitPrice 주문단가(USD)
     */
    public KisOrderResult placeOverseasOrder(KisPaperCredential cred, Order.OrderType side,
                                             String ovrsExcgCd, String ticker, BigDecimal quantity, BigDecimal limitPrice) {
        String token = getToken(cred);

        Map<String, String> body = new HashMap<>();
        body.put("CANO", cred.accountNumber());
        body.put("ACNT_PRDT_CD", cred.productCode() != null ? cred.productCode() : "01");
        body.put("OVRS_EXCG_CD", ovrsExcgCd);                          // NASD/NYSE/AMEX
        body.put("PDNO", ticker);
        body.put("ORD_QTY", quantity.toBigInteger().toString());      // 미국주식 정수 수량
        body.put("OVRS_ORD_UNPR", limitPrice.setScale(2, RoundingMode.HALF_UP).toPlainString());
        body.put("ORD_SVR_DVSN_CD", "0");
        body.put("ORD_DVSN", "00");                                    // 00 = 지정가 (미국은 시장가 미지원)

        String hash = getHashkey(cred, body);
        // 실전 미국: 매수 TTTT1002U / 매도 TTTT1006U, 모의: 매수 VTTT1002U / 매도 VTTT1001U
        String trId = realTrading
                ? (side == Order.OrderType.BUY ? "TTTT1002U" : "TTTT1006U")
                : (side == Order.OrderType.BUY ? "VTTT1002U" : "VTTT1001U");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("authorization", "Bearer " + token);
        headers.set("appkey", cred.appkey());
        headers.set("appsecret", cred.appsecret());
        headers.set("tr_id", trId);
        headers.set("custtype", "P");
        headers.set("hashkey", hash);

        ResponseEntity<Map> resp = postJson(baseUrl() + "/uapi/overseas-stock/v1/trading/order", body, headers);

        Map<?, ?> b = resp.getBody();
        String rtCd = b != null ? String.valueOf(b.get("rt_cd")) : null;
        String msg = b != null ? String.valueOf(b.get("msg1")) : "응답 없음";
        if (!"0".equals(rtCd)) {
            log.warn("KIS 해외주문 거부: real={}, excg={}, ticker={}, qty={}, unpr={}, rt_cd={}, msg={}",
                    realTrading, ovrsExcgCd, ticker, quantity, limitPrice, rtCd, msg);
            return new KisOrderResult(false, null, msg);
        }
        String odno = null;
        if (b.get("output") instanceof Map<?, ?> o) {
            odno = String.valueOf(o.get("ODNO"));
        }
        log.info("KIS 해외주문 접수: excg={}, ticker={}, side={}, qty={}, unpr={}, odno={}",
                ovrsExcgCd, ticker, side, quantity, limitPrice, odno);
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

        ResponseEntity<Map> resp = postJson(baseUrl() + "/oauth2/tokenP", body, headers);
        Map<?, ?> b = resp.getBody();
        if (b == null || b.get("access_token") == null) {
            throw new IllegalStateException("KIS 토큰 발급 실패");
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

        ResponseEntity<Map> resp = postJson(baseUrl() + "/uapi/hashkey", body, headers);
        Map<?, ?> b = resp.getBody();
        if (b == null || b.get("HASH") == null) {
            throw new IllegalStateException("KIS hashkey 발급 실패");
        }
        return String.valueOf(b.get("HASH"));
    }
}
