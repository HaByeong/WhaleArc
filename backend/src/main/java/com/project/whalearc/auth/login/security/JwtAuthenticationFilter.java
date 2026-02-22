package com.project.whalearc.auth.login.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

    @RequiredArgsConstructor
    public class JwtAuthenticationFilter extends OncePerRequestFilter {
        private final JwtTokenProvider jwtTokenProvider;

        @Override
        protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain) throws ServletException, IOException {
            String header = request.getHeader("Authorization");
            if (header != null && header.startsWith("Bearer ")) {
                String token = header.replace("Bearer ", "");

                // ======== [보안 개선] 토큰 검증 추가 ========
                // 기존 문제: validateToken() 없이 바로 getUserIdFromToken()을 호출하면
                //   - 만료된 토큰 → ExpiredJwtException이 터져서 500 에러가 클라이언트에 노출
                //   - 위변조된 토큰 → SecurityException이 터져서 역시 500 에러
                //   - 즉, 에러 처리가 안 되고 서버 내부 정보(스택 트레이스)가 노출됨
                //
                // 수정 후: validateToken()이 false를 반환하면 if문을 건너뛰고
                //   → SecurityContext에 인증 정보가 안 들어감
                //   → authenticated() 경로면 Spring Security가 자동으로 401/403 반환
                //   → 깔끔하게 처리됨
                //
                if (jwtTokenProvider.validateToken(token)) {
                    String userId = jwtTokenProvider.getUserIdFromToken(token);

                    UsernamePasswordAuthenticationToken auth =
                            new UsernamePasswordAuthenticationToken(userId, null, List.of());

                    SecurityContextHolder.getContext().setAuthentication(auth);
                }
            }

            filterChain.doFilter(request, response);
        }
    }
