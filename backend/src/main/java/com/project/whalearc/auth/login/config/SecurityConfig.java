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
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
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
                        .requestMatchers(HttpMethod.GET, "/api/market/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/store/products/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/store/products").permitAll()
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
        return decoder;
    }

    @Bean
    public JwtAuthenticationConverter supabaseJwtConverter() {
        return new JwtAuthenticationConverter();
    }
}
