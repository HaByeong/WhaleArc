package com.project.whalearc.market.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

/**
 * 한국투자증권 Open API 클라이언트.
 * - OAuth 토큰 자동 발급/갱신
 * - 국내주식 현재가 조회
 * - 국내주식 기간별 시세 (캔들스틱) 조회
 */
@Slf4j
@Service
public class KisApiClient {

    @Value("${kis.api.base-url:https://openapivts.koreainvestment.com:29443}")
    private String baseUrl;

    @Value("${kis.api.appkey:}")
    private String appkey;

    @Value("${kis.api.appsecret:}")
    private String appsecret;

    private RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    // 토큰 캐시
    private final AtomicReference<String> accessToken = new AtomicReference<>(null);
    private volatile long tokenExpiresAt = 0;

    @PostConstruct
    public void init() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10_000);
        factory.setReadTimeout(10_000);
        this.restTemplate = new RestTemplate(factory);
        log.info("KIS API 클라이언트 초기화: baseUrl={}", baseUrl);
    }

    /** 유효한 액세스 토큰 반환 (만료 시 자동 갱신) */
    public String getAccessToken() {
        if (accessToken.get() != null && System.currentTimeMillis() < tokenExpiresAt - 60_000) {
            return accessToken.get();
        }
        return refreshToken();
    }

    @SuppressWarnings("unchecked")
    private synchronized String refreshToken() {
        // 더블 체크
        if (accessToken.get() != null && System.currentTimeMillis() < tokenExpiresAt - 60_000) {
            return accessToken.get();
        }

        String url = baseUrl + "/oauth2/tokenP";
        Map<String, String> body = Map.of(
                "grant_type", "client_credentials",
                "appkey", appkey,
                "appsecret", appsecret
        );

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, String>> request = new HttpEntity<>(body, headers);

            ResponseEntity<String> response = restTemplate.postForEntity(url, request, String.class);
            Map<String, Object> result = objectMapper.readValue(response.getBody(),
                    new TypeReference<Map<String, Object>>() {});

            String token = (String) result.get("access_token");
            // 모의투자 토큰은 약 24시간 유효
            tokenExpiresAt = System.currentTimeMillis() + 23 * 60 * 60 * 1000L;
            accessToken.set(token);
            log.info("KIS API 토큰 발급 성공");
            return token;
        } catch (Exception e) {
            log.error("KIS API 토큰 발급 실패: {}", e.getMessage());
            // 이전 토큰이 완전 만료 전이면 재사용 (갱신 마진 60초 이내)
            String existing = accessToken.get();
            if (existing != null && System.currentTimeMillis() < tokenExpiresAt) {
                log.warn("KIS API 이전 토큰 재사용 (만료까지 {}초)", (tokenExpiresAt - System.currentTimeMillis()) / 1000);
                return existing;
            }
            throw new RuntimeException("KIS 토큰 발급 실패", e);
        }
    }

    /**
     * 국내주식 현재가 조회
     * @param stockCode 종목코드 (예: 005930)
     * @return API 응답의 output 맵
     */
    @SuppressWarnings("unchecked")
    public Map<String, String> getStockPrice(String stockCode) {
        String url = baseUrl + "/uapi/domestic-stock/v1/quotations/inquire-price"
                + "?FID_COND_MRKT_DIV_CODE=J"
                + "&FID_INPUT_ISCD=" + stockCode;

        HttpHeaders headers = buildHeaders("FHKST01010100");
        HttpEntity<Void> request = new HttpEntity<>(headers);

        try {
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, request, String.class);
            Map<String, Object> result = objectMapper.readValue(response.getBody(),
                    new TypeReference<Map<String, Object>>() {});

            if (!"0".equals(String.valueOf(result.get("rt_cd")))) {
                log.warn("KIS 현재가 조회 실패 [{}]: {}", stockCode, result.get("msg1"));
                return null;
            }

            return objectMapper.convertValue(result.get("output"), new TypeReference<Map<String, String>>() {});
        } catch (Exception e) {
            log.error("KIS 현재가 조회 오류 [{}]: {}", stockCode, e.getMessage());
            return null;
        }
    }

    /**
     * 국내주식 기간별 시세 조회 (일봉)
     * @param stockCode 종목코드
     * @param startDate 시작일 (YYYYMMDD)
     * @param endDate 종료일 (YYYYMMDD)
     * @return output2 리스트 (일봉 데이터)
     */
    @SuppressWarnings("unchecked")
    public java.util.List<Map<String, String>> getStockDailyCandles(String stockCode, String startDate, String endDate) {
        String url = baseUrl + "/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice"
                + "?FID_COND_MRKT_DIV_CODE=J"
                + "&FID_INPUT_ISCD=" + stockCode
                + "&FID_INPUT_DATE_1=" + startDate
                + "&FID_INPUT_DATE_2=" + endDate
                + "&FID_PERIOD_DIV_CODE=D"
                + "&FID_ORG_ADJ_PRC=0";

        HttpHeaders headers = buildHeaders("FHKST03010100");
        HttpEntity<Void> request = new HttpEntity<>(headers);

        try {
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, request, String.class);
            Map<String, Object> result = objectMapper.readValue(response.getBody(),
                    new TypeReference<Map<String, Object>>() {});

            if (!"0".equals(String.valueOf(result.get("rt_cd")))) {
                log.warn("KIS 일봉 조회 실패 [{}]: {}", stockCode, result.get("msg1"));
                return java.util.List.of();
            }

            return objectMapper.convertValue(result.get("output2"),
                    new TypeReference<java.util.List<Map<String, String>>>() {});
        } catch (Exception e) {
            log.error("KIS 일봉 조회 오류 [{}]: {}", stockCode, e.getMessage());
            return java.util.List.of();
        }
    }

    /**
     * 업종(지수) 현재가 조회 (KOSPI: 0001, KOSDAQ: 1001)
     */
    @SuppressWarnings("unchecked")
    public Map<String, String> getIndexPrice(String indexCode) {
        String url = baseUrl + "/uapi/domestic-stock/v1/quotations/inquire-index-price"
                + "?FID_COND_MRKT_DIV_CODE=U"
                + "&FID_INPUT_ISCD=" + indexCode;

        HttpHeaders headers = buildHeaders("FHPUP02100000");
        HttpEntity<Void> request = new HttpEntity<>(headers);

        try {
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, request, String.class);
            Map<String, Object> result = objectMapper.readValue(response.getBody(),
                    new TypeReference<Map<String, Object>>() {});

            if (!"0".equals(String.valueOf(result.get("rt_cd")))) {
                log.warn("KIS 지수 조회 실패 [{}]: {}", indexCode, result.get("msg1"));
                return null;
            }

            return objectMapper.convertValue(result.get("output"), new TypeReference<Map<String, String>>() {});
        } catch (Exception e) {
            log.error("KIS 지수 조회 오류 [{}]: {}", indexCode, e.getMessage());
            return null;
        }
    }

    private HttpHeaders buildHeaders(String trId) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("authorization", "Bearer " + getAccessToken());
        headers.set("appkey", appkey);
        headers.set("appsecret", appsecret);
        headers.set("tr_id", trId);
        return headers;
    }

    public boolean isConfigured() {
        return appkey != null && !appkey.isEmpty() && appsecret != null && !appsecret.isEmpty();
    }
}
