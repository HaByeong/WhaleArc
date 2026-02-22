package com.project.whalearc.auth.login.security;

import io.jsonwebtoken.*;
import lombok.RequiredArgsConstructor;

import javax.crypto.SecretKey;
import java.util.Date;
import static com.project.whalearc.auth.login.constant.Constant.ACCESS_TOKEN_TIME;
import static com.project.whalearc.auth.login.constant.Constant.REFRESH_TOKEN_TIME;

// final 필드(secretKey)를 받는 생성자를 Lombok이 자동 생성
// @RequiredArgsConstructor
// public class JwtTokenProvider {
    @RequiredArgsConstructor
    public class JwtTokenProvider {
        //JWT 서명에 사용할 비밀키(SecurityConfig에서 Bean으로 주입된다)
        private final SecretKey secretKey;

        //Access Token 생성 (만료: 1시간)
        public String generateAccessToken(String userId) {
            return Jwts.builder()
                    .setSubject(userId)
                    .claim("role", "user")
                    .setIssuedAt(new Date())
                    .setExpiration(new Date(System.currentTimeMillis() + ACCESS_TOKEN_TIME))
                    .signWith(secretKey, SignatureAlgorithm.HS256)
                    .compact();
        }

        //Refresh Token 생성 (만료: 7일)
        public String generateRefreshToken(String userId) {
            return Jwts.builder()
                    .setSubject(userId)
                    .setIssuedAt(new Date())
                    .setExpiration(new Date(System.currentTimeMillis() + REFRESH_TOKEN_TIME))
                    .signWith(secretKey, SignatureAlgorithm.HS256)
                    .compact();
        }

        //토큰에서 userId(subject)를 추출
        public String getUserIdFromToken(String token) {
            Claims claims = Jwts.parserBuilder()
                    .setSigningKey(secretKey)
                    .build()
                    .parseClaimsJws(token)
                    .getBody();

            return claims.getSubject();
        }

        //토큰 유효성 검증 (서명 + 만료 + 형식)
        public boolean validateToken(String token) {
            try { 
                Jwts.parserBuilder()
                    .setSigningKey(secretKey)
                    .build()
                    .parseClaimsJws(token);

                    return true;
            } catch (SecurityException | MalformedJwtException e) {
                System.out.println("잘못된 토큰 서명입니다.");
            } catch (ExpiredJwtException e) {
                System.out.println("기간이 만료된 토큰입니다.");
            } catch (UnsupportedJwtException e) {
                System.out.println("지원하지 않는 토큰입니다.");
            } catch (IllegalArgumentException e) {
                System.out.println("잘못된 토큰입니다.");
            }

            return false;
        }
    }

