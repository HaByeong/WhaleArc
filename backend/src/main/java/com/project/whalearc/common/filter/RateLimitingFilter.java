package com.project.whalearc.common.filter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * IP 기반 Rate Limiting 필터.
 * - 기본: 분당 120회
 * - 거래/주문 API: 분당 30회
 * - 시세 갱신: 분당 10회
 */
@Slf4j
@Component
public class RateLimitingFilter extends OncePerRequestFilter {

    private final Map<String, RequestCounter> requestCounters = new ConcurrentHashMap<>();

    private static final int DEFAULT_LIMIT = 120;
    private static final int TRADE_LIMIT = 30;
    private static final int REFRESH_LIMIT = 10;
    private static final int BACKTEST_LIMIT = 5;   // 백테스트: 분당 5회 (무거운 연산)
    private static final long WINDOW_MS = 60_000;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String path = request.getRequestURI();

        // WebSocket은 제한 없음
        if (path.startsWith("/ws")) {
            filterChain.doFilter(request, response);
            return;
        }

        String clientIp = getClientIp(request);
        String method = request.getMethod();
        int limit = DEFAULT_LIMIT;
        String key = clientIp;

        if (path.startsWith("/api/orders") && "POST".equals(method)) {
            limit = TRADE_LIMIT;
            key = clientIp + ":trade";
        } else if (path.startsWith("/api/store") && "POST".equals(method)) {
            limit = TRADE_LIMIT;
            key = clientIp + ":store";
        } else if (path.startsWith("/api/market/prices/refresh")) {
            limit = REFRESH_LIMIT;
            key = clientIp + ":refresh";
        } else if (path.startsWith("/api/strategies/backtest") && "POST".equals(method)) {
            limit = BACKTEST_LIMIT;
            key = clientIp + ":backtest";
        } else if (path.startsWith("/api/virt/credentials") && "POST".equals(method)) {
            limit = REFRESH_LIMIT; // 자격증명 등록: 분당 10회
            key = clientIp + ":virt-cred";
        } else if (path.startsWith("/api/virt/test-connection") || path.contains("/test-connection")) {
            limit = REFRESH_LIMIT; // 연결 테스트: 분당 10회
            key = clientIp + ":virt-test";
        } else if (path.startsWith("/api/rankings")) {
            limit = TRADE_LIMIT; // 랭킹 조회: 분당 30회
            key = clientIp + ":rankings";
        }

        RequestCounter counter = requestCounters.computeIfAbsent(key, k -> new RequestCounter());

        if (!counter.tryAcquire(limit)) {
            log.warn("Rate limit 초과: {} from {}", path, clientIp);
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"success\":false,\"message\":\"요청이 너무 많습니다. 잠시 후 다시 시도해주세요.\"}");
            return;
        }

        filterChain.doFilter(request, response);
    }

    private String getClientIp(HttpServletRequest request) {
        // 인증된 사용자는 userId 기반 제한 (IP 우회 불가)
        var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && auth.getPrincipal() instanceof org.springframework.security.oauth2.jwt.Jwt jwt) {
            return "user:" + jwt.getSubject();
        }
        // 비인증 요청은 RemoteAddr 사용 (X-Forwarded-For는 프록시 환경에서만 신뢰)
        return request.getRemoteAddr();
    }

    private static class RequestCounter {
        private final AtomicInteger count = new AtomicInteger(0);
        private volatile long windowStart = System.currentTimeMillis();

        boolean tryAcquire(int limit) {
            long now = System.currentTimeMillis();
            if (now - windowStart > WINDOW_MS) {
                synchronized (this) {
                    if (now - windowStart > WINDOW_MS) {
                        count.set(0);
                        windowStart = now;
                    }
                }
            }
            return count.incrementAndGet() <= limit;
        }
    }
}
