package com.project.whalearc.virt.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;

/**
 * 비트겟 Open API 클라이언트.
 * - HMAC-SHA256 인증
 * - 현물 계좌 잔고 조회
 * - 현재가 조회
 */
@Slf4j
@Service
public class VirtBitgetClient {

    private static final String BASE_URL = "https://api.bitget.com";

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public VirtBitgetClient() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10_000);
        factory.setReadTimeout(10_000);
        this.restTemplate = new RestTemplate(factory);
    }

    /**
     * 현물 계좌 자산 조회
     */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getSpotAssets(String apiKey, String secretKey, String passphrase) {
        String path = "/api/v2/spot/account/assets";
        String timestamp = String.valueOf(Instant.now().toEpochMilli());

        HttpHeaders headers = buildHeaders(apiKey, secretKey, passphrase, timestamp, "GET", path, "");
        HttpEntity<Void> request = new HttpEntity<>(headers);

        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    BASE_URL + path, HttpMethod.GET, request, String.class);

            Map<String, Object> result = objectMapper.readValue(response.getBody(),
                    new TypeReference<>() {});

            if (!"00000".equals(String.valueOf(result.get("code")))) {
                log.warn("[Virt/Bitget] 자산 조회 실패: {}", result.get("msg"));
                throw new RuntimeException("비트겟 자산 조회 실패: " + result.get("msg"));
            }

            return (List<Map<String, Object>>) result.get("data");
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            log.error("[Virt/Bitget] 자산 조회 오류: {}", e.getMessage());
            throw new RuntimeException("비트겟 자산 조회 실패: " + e.getMessage(), e);
        }
    }

    /**
     * 현물 시세 일괄 조회
     */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getSpotTickers() {
        try {
            ResponseEntity<String> response = restTemplate.getForEntity(
                    BASE_URL + "/api/v2/spot/market/tickers", String.class);

            Map<String, Object> result = objectMapper.readValue(response.getBody(),
                    new TypeReference<>() {});

            if (!"00000".equals(String.valueOf(result.get("code")))) {
                return List.of();
            }

            return (List<Map<String, Object>>) result.get("data");
        } catch (Exception e) {
            log.error("[Virt/Bitget] 시세 조회 오류: {}", e.getMessage());
            return List.of();
        }
    }

    /* ───── HMAC-SHA256 서명 ───── */

    private HttpHeaders buildHeaders(String apiKey, String secretKey, String passphrase,
                                      String timestamp, String method, String path, String body) {
        String preSign = timestamp + method + path + body;
        String sign = hmacSha256(preSign, secretKey);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("ACCESS-KEY", apiKey);
        headers.set("ACCESS-SIGN", sign);
        headers.set("ACCESS-TIMESTAMP", timestamp);
        headers.set("ACCESS-PASSPHRASE", passphrase);
        headers.set("locale", "en-US");
        return headers;
    }

    private String hmacSha256(String data, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] hash = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(hash);
        } catch (Exception e) {
            throw new RuntimeException("HMAC-SHA256 서명 실패", e);
        }
    }
}
