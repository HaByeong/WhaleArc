package com.project.whalearc.user.domain;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 자동매매 접근 규칙(BASIC 이상 또는 ADMIN) 검증. */
class UserTest {

    private User user(User.Tier tier, User.Role role) {
        User u = new User("sid", "e@e.com", "n", "email");
        u.setTier(tier);
        u.setRole(role);
        return u;
    }

    @Test
    void freeUserCannotAutoTrade() {
        assertFalse(user(User.Tier.FREE, User.Role.USER).canAutoTrade());
    }

    @Test
    void basicAndProUsersCanAutoTrade() {
        assertTrue(user(User.Tier.BASIC, User.Role.USER).canAutoTrade());
        assertTrue(user(User.Tier.PRO, User.Role.USER).canAutoTrade());
    }

    @Test
    void adminCanAutoTradeRegardlessOfTier() {
        assertTrue(user(User.Tier.FREE, User.Role.ADMIN).canAutoTrade());
    }

    @Test
    void nullTierNonAdminCannot() {
        assertFalse(user(null, User.Role.USER).canAutoTrade());
    }
}
