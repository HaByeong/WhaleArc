package com.project.whalearc.user.service;

import com.project.whalearc.user.domain.User;
import com.project.whalearc.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class UserSyncService {

    private final UserRepository userRepository;

    public User getOrCreateUser(Jwt jwt) {
        String supabaseId = jwt.getSubject();
        return userRepository.findBySupabaseId(supabaseId)
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

                    if (name == null && email != null) {
                        name = email.split("@")[0];
                    }

                    return userRepository.save(new User(supabaseId, email, name, provider));
                });
    }
}
