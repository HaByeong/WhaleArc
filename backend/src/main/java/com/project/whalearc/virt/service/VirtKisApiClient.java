package com.project.whalearc.virt.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 유저별 KIS API 키를 사용하여 실전투자 API를 호출하는 클라이언트.
 * - 리트라이 + 지수 백오프
 * - 유저별 토큰 캐시
 */
@Slf4j
@Service
public class VirtKisApiClient {

    private static final String REAL_BASE_URL = "https://openapi.koreainvestment.com:9443";
    private static final int MAX_RETRIES = 3;
    private static final long RETRY_DELAY_MS = 500;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /** 유저별 토큰 캐시: userId → {token, expiresAt} */
    private final ConcurrentHashMap<String, TokenEntry> tokenCache = new ConcurrentHashMap<>();

    public VirtKisApiClient() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5_000);
        factory.setReadTimeout(10_000);
        this.restTemplate = new RestTemplate(factory);
    }

    /* ───── 토큰 관리 ───── */

    private String getToken(String userId, String appkey, String appsecret) {
        TokenEntry entry = tokenCache.get(userId);
        if (entry != null && System.currentTimeMillis() < entry.expiresAt - 60_000) {
            return entry.token;
        }
        return refreshToken(userId, appkey, appsecret);
    }

    @SuppressWarnings("unchecked")
    private synchronized String refreshToken(String userId, String appkey, String appsecret) {
        TokenEntry entry = tokenCache.get(userId);
        if (entry != null && System.currentTimeMillis() < entry.expiresAt - 60_000) {
            return entry.token;
        }

        String url = REAL_BASE_URL + "/oauth2/tokenP";
        Map<String, String> body = Map.of(
                "grant_type", "client_credentials",
                "appkey", appkey,
                "appsecret", appsecret
        );

        for (int attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                HttpEntity<Map<String, String>> request = new HttpEntity<>(body, headers);

                ResponseEntity<String> response = restTemplate.postForEntity(url, request, String.class);
                Map<String, Object> result = objectMapper.readValue(response.getBody(),
                        new TypeReference<>() {});

                String token = (String) result.get("access_token");
                long expiresAt = System.currentTimeMillis() + 23 * 60 * 60 * 1000L;
                tokenCache.put(userId, new TokenEntry(token, expiresAt));
                log.info("[Virt] KIS 토큰 발급 성공: userId={}", userId);
                return token;
            } catch (Exception e) {
                log.warn("[Virt] KIS 토큰 발급 실패 (시도 {}/{}): userId={}, error={}",
                        attempt, MAX_RETRIES, userId, e.getMessage());
                if (attempt < MAX_RETRIES) {
                    sleep(RETRY_DELAY_MS * attempt);
                }
            }
        }

        // 이전 토큰 재사용 시도
        TokenEntry existing = tokenCache.get(userId);
        if (existing != null && System.currentTimeMillis() < existing.expiresAt) {
            log.warn("[Virt] KIS 이전 토큰 재사용: userId={}", userId);
            return existing.token;
        }
        throw new RuntimeException("KIS API 인증 실패. API 키를 확인해주세요.");
    }

    public void evictToken(String userId) {
        tokenCache.remove(userId);
    }

    /* ───── 실계좌 잔고 조회 ───── */

    @SuppressWarnings("unchecked")
    public Map<String, Object> getAccountBalance(String userId, String appkey, String appsecret,
                                                  String accountNo, String productCode) {
        String url = REAL_BASE_URL + "/uapi/domestic-stock/v1/trading/inquire-balance"
                + "?CANO=" + accountNo
                + "&ACNT_PRDT_CD=" + productCode
                + "&AFHR_FLPR_YN=N"
                + "&OFL_YN="
                + "&INQR_DVSN=02"
                + "&UNPR_DVSN=01"
                + "&FUND_STTL_ICLD_YN=N"
                + "&FNCG_AMT_AUTO_RDPT_YN=N"
                + "&PRCS_DVSN=00"
                + "&CTX_AREA_FK100="
                + "&CTX_AREA_NK100=";

        return executeWithRetry(userId, appkey, appsecret, url, "TTTC8434R", "잔고조회");
    }

    /* ───── 체결내역 조회 ───── */

    @SuppressWarnings("unchecked")
    public Map<String, Object> getTradeHistory(String userId, String appkey, String appsecret,
                                                String accountNo, String productCode,
                                                String startDate, String endDate) {
        String url = REAL_BASE_URL + "/uapi/domestic-stock/v1/trading/inquire-daily-ccld"
                + "?CANO=" + accountNo
                + "&ACNT_PRDT_CD=" + productCode
                + "&INQR_STRT_DT=" + startDate
                + "&INQR_END_DT=" + endDate
                + "&SLL_BUY_DVSN_CD=00"
                + "&INQR_DVSN=00"
                + "&PDNO="
                + "&CCLD_DVSN=00"
                + "&ORD_GNO_BRNO="
                + "&ODNO="
                + "&INQR_DVSN_3=00"
                + "&INQR_DVSN_1="
                + "&CTX_AREA_FK100="
                + "&CTX_AREA_NK100=";

        return executeWithRetry(userId, appkey, appsecret, url, "TTTC8001R", "체결내역");
    }

    /* ───── 공통 리트라이 실행 ───── */

    @SuppressWarnings("unchecked")
    private Map<String, Object> executeWithRetry(String userId, String appkey, String appsecret,
                                                   String url, String trId, String apiName) {
        Exception lastException = null;

        for (int attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                HttpHeaders headers = buildHeaders(userId, appkey, appsecret, trId);
                HttpEntity<Void> request = new HttpEntity<>(headers);

                ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, request, String.class);
                Map<String, Object> result = objectMapper.readValue(response.getBody(),
                        new TypeReference<>() {});

                if (!"0".equals(String.valueOf(result.get("rt_cd")))) {
                    log.warn("[Virt] {} 실패: {}", apiName, result.get("msg1"));
                    throw new RuntimeException(apiName + " 실패: " + result.get("msg1"));
                }

                if (attempt > 1) {
                    log.info("[Virt] {} 성공 ({}번째 시도)", apiName, attempt);
                }
                return result;
            } catch (RuntimeException e) {
                if (e.getMessage() != null && e.getMessage().contains("실패:")) {
                    throw e; // API 비즈니스 에러는 리트라이하지 않음
                }
                lastException = e;
                log.warn("[Virt] {} 오류 (시도 {}/{}): {}", apiName, attempt, MAX_RETRIES, e.getMessage());
                if (attempt < MAX_RETRIES) {
                    sleep(RETRY_DELAY_MS * attempt);
                }
            } catch (Exception e) {
                lastException = e;
                log.warn("[Virt] {} 오류 (시도 {}/{}): {}", apiName, attempt, MAX_RETRIES, e.getMessage());
                if (attempt < MAX_RETRIES) {
                    sleep(RETRY_DELAY_MS * attempt);
                }
            }
        }

        throw new RuntimeException(apiName + " 중 오류가 발생했습니다. (" + MAX_RETRIES + "회 재시도 실패)", lastException);
    }

    /* ───── 유틸 ───── */

    private HttpHeaders buildHeaders(String userId, String appkey, String appsecret, String trId) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("authorization", "Bearer " + getToken(userId, appkey, appsecret));
        headers.set("appkey", appkey);
        headers.set("appsecret", appsecret);
        headers.set("tr_id", trId);
        return headers;
    }

    private void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private static class TokenEntry {
        final String token;
        final long expiresAt;

        TokenEntry(String token, long expiresAt) {
            this.token = token;
            this.expiresAt = expiresAt;
        }
    }
}
