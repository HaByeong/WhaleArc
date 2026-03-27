package com.project.whalearc.virt.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * 업비트 Open API 클라이언트.
 * - JWT 인증 (access_key + secret_key)
 * - 리트라이 + 지수 백오프
 */
@Slf4j
@Service
public class VirtUpbitClient {

    private static final String BASE_URL = "https://api.upbit.com/v1";
    private static final int MAX_RETRIES = 3;
    private static final long RETRY_DELAY_MS = 500;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public VirtUpbitClient() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10_000);
        factory.setReadTimeout(10_000);
        this.restTemplate = new RestTemplate(factory);
    }

    /**
     * 전체 계좌 잔고 조회
     */
    public List<Map<String, Object>> getAccounts(String accessKey, String secretKey) {
        Exception lastException = null;

        for (int attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                String token = generateToken(accessKey, secretKey);

                HttpHeaders headers = new HttpHeaders();
                headers.set("Authorization", "Bearer " + token);
                HttpEntity<Void> request = new HttpEntity<>(headers);

                ResponseEntity<String> response = restTemplate.exchange(
                        BASE_URL + "/accounts", HttpMethod.GET, request, String.class);

                List<Map<String, Object>> result = objectMapper.readValue(response.getBody(),
                        new TypeReference<List<Map<String, Object>>>() {});

                if (attempt > 1) {
                    log.info("[Virt/Upbit] 잔고 조회 성공 ({}번째 시도)", attempt);
                }
                return result;
            } catch (Exception e) {
                lastException = e;
                log.warn("[Virt/Upbit] 잔고 조회 실패 (시도 {}/{}): {}", attempt, MAX_RETRIES, e.getMessage());
                if (attempt < MAX_RETRIES) {
                    sleep(RETRY_DELAY_MS * attempt);
                }
            }
        }

        throw new RuntimeException("업비트 잔고 조회 실패 (" + MAX_RETRIES + "회 재시도 실패)", lastException);
    }

    /**
     * 현재 시세 조회 (여러 마켓)
     */
    public List<Map<String, Object>> getTicker(String markets) {
        for (int attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                ResponseEntity<String> response = restTemplate.getForEntity(
                        BASE_URL + "/ticker?markets=" + markets, String.class);

                List<Map<String, Object>> result = objectMapper.readValue(response.getBody(),
                        new TypeReference<List<Map<String, Object>>>() {});

                if (attempt > 1) {
                    log.info("[Virt/Upbit] 시세 조회 성공 ({}번째 시도)", attempt);
                }
                return result;
            } catch (Exception e) {
                log.warn("[Virt/Upbit] 시세 조회 실패 (시도 {}/{}): {}", attempt, MAX_RETRIES, e.getMessage());
                if (attempt < MAX_RETRIES) {
                    sleep(RETRY_DELAY_MS * attempt);
                }
            }
        }

        log.error("[Virt/Upbit] 시세 조회 최종 실패");
        return List.of();
    }

    /** 업비트 JWT 토큰 생성 */
    private String generateToken(String accessKey, String secretKey) {
        return Jwts.builder()
                .claim("access_key", accessKey)
                .claim("nonce", UUID.randomUUID().toString())
                .signWith(Keys.hmacShaKeyFor(secretKey.getBytes(StandardCharsets.UTF_8)))
                .compact();
    }

    private void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
