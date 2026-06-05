package com.project.whalearc.auth.login.config;

import com.project.whalearc.auth.filter.UserSyncFilter;
import com.project.whalearc.common.filter.RateLimitingFilter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimNames;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

import java.util.ArrayList;
import java.util.List;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.www.BasicAuthenticationFilter;

@Slf4j
@Configuration
@RequiredArgsConstructor
public class SecurityConfig {

    private final RateLimitingFilter rateLimitingFilter;
    private final UserSyncFilter userSyncFilter;

    @Value("${spring.security.oauth2.resourceserver.jwt.jwk-set-uri}")
    private String jwkSetUri;

    // 발급자(iss) 검증용. Supabase iss = https://<project>.supabase.co/auth/v1.
    // 비워두면(SUPABASE_JWT_ISSUER=) 발급자 검증을 생략(문제 시 긴급 비활성화 escape hatch).
    @Value("${supabase.jwt.issuer:https://tkkbawoknwumqdqxypwd.supabase.co/auth/v1}")
    private String issuer;

    // Supabase 액세스 토큰의 aud 클레임(기본 'authenticated') 검증. 비우면 검증 생략(escape hatch).
    @Value("${supabase.jwt.audience:authenticated}")
    private String audience;

    @Bean
    public SecurityFilterChain filterChain(
            HttpSecurity http,
            org.springframework.web.cors.CorsConfigurationSource corsConfigurationSource
    ) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource))
                .csrf(csrf -> csrf.disable())
                .headers(headers -> headers
                        .frameOptions(frame -> frame.deny())
                        .contentTypeOptions(content -> {})
                        .httpStrictTransportSecurity(hsts -> hsts
                                .includeSubDomains(true)
                                .maxAgeInSeconds(31536000)
                        )
                )
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/ws/**").permitAll()
                        // 헬스체크는 무인증 프로브 허용(로드밸런서/모니터링). show-details=when-authorized 이므로
                        // 익명에는 status(UP/DOWN)만 노출되고 상세는 가려진다. /actuator/metrics 등은 인증 필요.
                        .requestMatchers("/actuator/health", "/actuator/health/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/market/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/store/products/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/store/products").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/feedback/images/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/community/images/**").permitAll()
                        .anyRequest().authenticated()
                )
                .oauth2ResourceServer(oauth2 -> oauth2
                        .jwt(jwt -> jwt
                                .decoder(supabaseJwtDecoder())
                                .jwtAuthenticationConverter(supabaseJwtConverter())
                        )
                )
                // RateLimitingFilter → JWT 인증 → UserSyncFilter 순서
                .addFilterBefore(rateLimitingFilter, BasicAuthenticationFilter.class)
                .addFilterAfter(userSyncFilter, BasicAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public JwtDecoder supabaseJwtDecoder() {
        log.info("Supabase JwtDecoder 초기화: jwkSetUri={}, algorithm=ES256", jwkSetUri);
        // Supabase는 ES256 알고리즘으로 JWT를 서명함 (기본값 RS256이 아님)
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(jwkSetUri)
                .jwsAlgorithm(SignatureAlgorithm.ES256)
                .build();
        // 서명·만료(기본) + 발급자(iss) + 대상(aud) 검증을 합성 — 다른 발급자/프로젝트/대상의 토큰을 거부(defense-in-depth).
        // issuer·audience 가 비어 있으면 각각 검증 생략(긴급 비활성화 escape hatch).
        List<OAuth2TokenValidator<Jwt>> validators = new ArrayList<>();
        validators.add(issuer != null && !issuer.isBlank()
                ? JwtValidators.createDefaultWithIssuer(issuer) // 만료/nbf + 발급자
                : JwtValidators.createDefault());                // 만료/nbf 만
        if (audience != null && !audience.isBlank()) {
            validators.add(new JwtClaimValidator<List<String>>(JwtClaimNames.AUD,
                    aud -> aud != null && aud.contains(audience)));
            log.info("JWT audience 검증 활성화: aud={}", audience);
        }
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(validators));
        log.info("JWT 검증 구성: issuer={}, audience={}", issuer, audience);
        return decoder;
    }

    @Bean
    public JwtAuthenticationConverter supabaseJwtConverter() {
        return new JwtAuthenticationConverter();
    }
}
