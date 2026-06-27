package com.project.whalearc.user.service;

import com.project.whalearc.user.domain.User;
import com.project.whalearc.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserSyncService {

    private final UserRepository userRepository;

    // 플랫폼 관리자 이메일(쉼표 구분). 해당 이메일은 로그인/동기화 시 자동 ADMIN 승격(기존 유저 포함).
    // supabaseId는 환경(test/prod)마다 달라 이메일로 식별한다.
    @Value("${app.admin-emails:}")
    private String adminEmailsCsv;

    public User getOrCreateUser(Jwt jwt) {
        String supabaseId = jwt.getSubject();
        User user = userRepository.findBySupabaseId(supabaseId)
                .orElseGet(() -> {
                    String email = jwt.getClaimAsString("email");
                    String name = null;
                    String provider = "email";

                    Map<String, Object> metadata = jwt.getClaimAsMap("user_metadata");
                    if (metadata != null) {
                        if (metadata.containsKey("name")) {
                            name = (String) metadata.get("name");
                        }
                        if (metadata.containsKey("iss")) {
                            String iss = (String) metadata.get("iss");
                            if (iss != null && iss.contains("google")) provider = "google";
                            else if (iss != null && iss.contains("kakao")) provider = "kakao";
                        }
                    }

                    Map<String, Object> appMetadata = jwt.getClaimAsMap("app_metadata");
                    if (appMetadata != null && appMetadata.containsKey("provider")) {
                        provider = (String) appMetadata.get("provider");
                    }

                    if (name == null) {
                        name = (email != null && email.contains("@"))
                                ? email.split("@")[0]
                                : "사용자";
                    }

                    try {
                        return userRepository.save(new User(supabaseId, email, name, provider));
                    } catch (DuplicateKeyException e) {
                        // 동시 요청으로 중복 생성 시도 — 이미 생성된 레코드 반환
                        log.debug("User already created by concurrent request: {}", supabaseId);
                        return userRepository.findBySupabaseId(supabaseId)
                                .orElseThrow(() -> new IllegalStateException("동시 생성 후 사용자 조회 실패: " + supabaseId));
                    }
                });

        return promoteAdminIfNeeded(user);
    }

    /** 관리자 이메일 목록에 포함되면 ADMIN으로 승격(이미 ADMIN이면 무동작). */
    private User promoteAdminIfNeeded(User user) {
        if (user.getRole() == User.Role.ADMIN) return user;
        if (isAdminEmail(user.getEmail())) {
            user.setRole(User.Role.ADMIN);
            log.info("관리자 승격: email={}, supabaseId={}", user.getEmail(), user.getSupabaseId());
            return userRepository.save(user);
        }
        return user;
    }

    private boolean isAdminEmail(String email) {
        if (email == null || adminEmailsCsv == null || adminEmailsCsv.isBlank()) return false;
        return Arrays.stream(adminEmailsCsv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .anyMatch(e -> e.equalsIgnoreCase(email));
    }
}
