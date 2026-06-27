package com.project.whalearc.user.policy;

import com.project.whalearc.user.domain.User;
import com.project.whalearc.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * supabaseId → 유효 등급(Tier) 변환 진입점.
 *
 * <p>각 enforcement 지점(백테스트·전략·라이브·알림)은 JWT subject(supabaseId)만 가지므로,
 * {@link com.project.whalearc.live.config.AutoTradeAccessChecker}와 동일하게 여기서 {@link User}를
 * 로드해 등급을 돌려준다. <b>ADMIN 역할은 등급 무관 PRO로 매핑</b>되며(이 매핑이 이 클래스 한 곳에만
 * 존재), 이후 {@link TierPolicy} 함수들은 순수하게 {@link User.Tier}만 다룬다.
 */
@Component
@RequiredArgsConstructor
public class TierResolver {

    private final UserRepository userRepository;

    /** supabaseId 유저의 유효 등급. ADMIN→PRO, tier 미설정·유저 미존재→FREE(가장 보수적). */
    public User.Tier effectiveTier(String supabaseId) {
        return userRepository.findBySupabaseId(supabaseId)
                .map(TierResolver::effectiveTier)
                .orElse(User.Tier.FREE);
    }

    /** 이미 로드된 User의 유효 등급(추가 조회 없이). ADMIN→PRO, tier/유저 null→FREE. */
    public static User.Tier effectiveTier(User user) {
        if (user == null) return User.Tier.FREE;
        if (user.getRole() == User.Role.ADMIN) return User.Tier.PRO;
        return user.getTier() != null ? user.getTier() : User.Tier.FREE;
    }
}
