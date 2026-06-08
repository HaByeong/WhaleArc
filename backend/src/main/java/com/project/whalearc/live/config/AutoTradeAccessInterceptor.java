package com.project.whalearc.live.config;

import com.project.whalearc.user.domain.User;
import com.project.whalearc.user.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.cors.CorsUtils;
import org.springframework.web.servlet.HandlerInterceptor;

import java.io.IOException;

/**
 * 자동매매(/api/live/**) 접근 가드 — 등급 미달이면 403.
 *
 * <p>자동매매는 실거래(실제 자금)와 연결되므로 프론트 게이팅만으론 부족하다(직접 API 호출 우회 가능).
 * 프론트 canAutoTrade와 동일 기준({@link User#canAutoTrade()} = BASIC 이상 또는 ADMIN)을 서버에서도 강제한다.
 *
 * <p>Spring Security 필터 체인이 SecurityContext를 채운 뒤(인터셉터는 DispatcherServlet 내부 실행) 동작한다.
 * UserSyncFilter가 먼저 유저 생성/ADMIN 승격을 마치므로 여기선 조회만 한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AutoTradeAccessInterceptor implements HandlerInterceptor {

    private final UserRepository userRepository;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws IOException {
        // CORS preflight(OPTIONS)는 인증 정보가 없으므로 통과
        if (CorsUtils.isPreFlightRequest(request)) return true;

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof Jwt jwt)) {
            return deny(response, HttpServletResponse.SC_UNAUTHORIZED, "인증이 필요합니다.");
        }

        User user = userRepository.findBySupabaseId(jwt.getSubject()).orElse(null);
        if (user == null || !user.canAutoTrade()) {
            log.info("자동매매 접근 거부(등급 미달): supabaseId={}, tier={}, role={}",
                    jwt.getSubject(), user != null ? user.getTier() : null, user != null ? user.getRole() : null);
            return deny(response, HttpServletResponse.SC_FORBIDDEN, "자동매매는 Basic 이상 등급에서 이용할 수 있습니다.");
        }
        return true;
    }

    private boolean deny(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"success\":false,\"message\":\"" + message + "\"}");
        return false;
    }
}
