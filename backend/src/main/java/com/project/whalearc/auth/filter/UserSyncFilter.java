package com.project.whalearc.auth.filter;

import com.project.whalearc.user.service.UserSyncService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Slf4j
@Component
@RequiredArgsConstructor
public class UserSyncFilter extends OncePerRequestFilter {

    private final UserSyncService userSyncService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication instanceof JwtAuthenticationToken jwtAuth) {
            Jwt jwt = jwtAuth.getToken();
            try {
                userSyncService.getOrCreateUser(jwt);
            } catch (Exception e) {
                // 인증은 JWT로 이미 성립한다. 사용자 동기화(MongoDB 조회/생성) 실패가
                // 단순 조회 API까지 전부 500으로 막지 않도록 흡수하고 요청은 계속 진행한다.
                log.warn("사용자 동기화 실패(요청은 계속 진행): sub={}, error={}", jwt.getSubject(), e.getMessage());
            }
        }

        filterChain.doFilter(request, response);
    }
}
