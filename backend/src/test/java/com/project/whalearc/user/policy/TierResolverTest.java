package com.project.whalearc.user.policy;

import com.project.whalearc.user.domain.User;
import com.project.whalearc.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

/** supabaseId→유효등급 변환 검증 — ADMIN은 PRO로, 미설정·미존재는 FREE로. */
@ExtendWith(MockitoExtension.class)
class TierResolverTest {

    @Mock UserRepository userRepository;
    private TierResolver resolver;

    @BeforeEach
    void setUp() {
        resolver = new TierResolver(userRepository);
    }

    private User user(User.Tier tier, User.Role role) {
        User u = new User("sid", "e@e.com", "n", "email");
        u.setTier(tier);
        u.setRole(role);
        return u;
    }

    @Test
    void adminMapsToProRegardlessOfTier() {
        when(userRepository.findBySupabaseId("sid")).thenReturn(Optional.of(user(User.Tier.FREE, User.Role.ADMIN)));
        assertEquals(User.Tier.PRO, resolver.effectiveTier("sid"));
    }

    @Test
    void basicUserStaysBasic() {
        when(userRepository.findBySupabaseId("sid")).thenReturn(Optional.of(user(User.Tier.BASIC, User.Role.USER)));
        assertEquals(User.Tier.BASIC, resolver.effectiveTier("sid"));
    }

    @Test
    void nullTierNonAdminBecomesFree() {
        when(userRepository.findBySupabaseId("sid")).thenReturn(Optional.of(user(null, User.Role.USER)));
        assertEquals(User.Tier.FREE, resolver.effectiveTier("sid"));
    }

    @Test
    void missingUserBecomesFree() {
        when(userRepository.findBySupabaseId("sid")).thenReturn(Optional.empty());
        assertEquals(User.Tier.FREE, resolver.effectiveTier("sid"));
    }
}
