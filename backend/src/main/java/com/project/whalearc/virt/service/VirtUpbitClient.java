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
 * - 계좌 잔고 조회
 */
@Slf4j
@Service
public class VirtUpbitClient {

    private static final String BASE_URL = "https://api.upbit.com/v1";

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
     * @return 코인별 잔고 리스트
     */
    public List<Map<String, Object>> getAccounts(String accessKey, String secretKey) {
        String token = generateToken(accessKey, secretKey);

        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Bearer " + token);

        HttpEntity<Void> request = new HttpEntity<>(headers);

        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    BASE_URL + "/accounts", HttpMethod.GET, request, String.class);

            return objectMapper.readValue(response.getBody(),
                    new TypeReference<List<Map<String, Object>>>() {});
        } catch (Exception e) {
            log.error("[Virt/Upbit] 잔고 조회 실패: {}", e.getMessage());
            throw new RuntimeException("업비트 잔고 조회 실패: " + e.getMessage(), e);
        }
    }

    /**
     * 현재 시세 조회 (여러 마켓)
     * @param markets "KRW-BTC,KRW-ETH,..." 형태
     */
    public List<Map<String, Object>> getTicker(String markets) {
        try {
            ResponseEntity<String> response = restTemplate.getForEntity(
                    BASE_URL + "/ticker?markets=" + markets, String.class);

            return objectMapper.readValue(response.getBody(),
                    new TypeReference<List<Map<String, Object>>>() {});
        } catch (Exception e) {
            log.error("[Virt/Upbit] 시세 조회 실패: {}", e.getMessage());
            return List.of();
        }
    }

    /** 업비트 JWT 토큰 생성 */
    private String generateToken(String accessKey, String secretKey) {
        return Jwts.builder()
                .claim("access_key", accessKey)
                .claim("nonce", UUID.randomUUID().toString())
                .signWith(Keys.hmacShaKeyFor(secretKey.getBytes(StandardCharsets.UTF_8)))
                .compact();
    }
}
