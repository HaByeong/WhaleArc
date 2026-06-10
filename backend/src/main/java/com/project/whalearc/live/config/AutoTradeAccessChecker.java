package com.project.whalearc.live.config;

import com.project.whalearc.user.domain.User;
import com.project.whalearc.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 실거래(LIVE) 자동매매 접근 판정 — BASIC 이상 또는 ADMIN.
 *
 * <p>모의(PAPER)는 누구나 가능하므로 게이팅하지 않는다. 실제 돈이 나가는 LIVE 배포 생성 시점에만
 * {@link User#canAutoTrade()} 기준으로 막는다(프론트 canAutoTrade와 동일). 프론트 게이팅 우회(직접 API 호출) 차단.
 */
@Component
@RequiredArgsConstructor
public class AutoTradeAccessChecker {

    private final UserRepository userRepository;

    /** supabaseId 유저가 실거래 자동매매(LIVE)를 할 수 있는지. */
    public boolean canTradeLive(String supabaseId) {
        return userRepository.findBySupabaseId(supabaseId)
                .map(User::canAutoTrade)
                .orElse(false);
    }
}
