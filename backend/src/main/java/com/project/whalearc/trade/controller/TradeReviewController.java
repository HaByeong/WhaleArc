package com.project.whalearc.trade.controller;

import com.project.whalearc.common.dto.ApiResponse;
import com.project.whalearc.trade.domain.TradeReview;
import com.project.whalearc.trade.repository.TradeReviewRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 거래 복기 노트 — 청산 거래별 체크리스트/메모의 서버 보관(기기 간 동기화).
 */
@RestController
@RequestMapping("/api/trade-reviews")
@RequiredArgsConstructor
public class TradeReviewController {

    private final TradeReviewRepository repository;

    /** 내 복기 노트 전체 (프론트에서 reviewKey로 매핑) */
    @GetMapping
    public ApiResponse<List<TradeReview>> list(@AuthenticationPrincipal Jwt jwt) {
        return ApiResponse.ok(repository.findByUserId(jwt.getSubject()));
    }

    private static final int MEMO_MAX = 4000;

    /** 청산 거래(reviewKey)별 체크/메모 업서트 */
    @PutMapping("/{reviewKey}")
    public ApiResponse<TradeReview> upsert(@AuthenticationPrincipal Jwt jwt,
                                           @PathVariable String reviewKey,
                                           @RequestBody ReviewBody body) {
        String userId = jwt.getSubject();
        if (reviewKey == null || !reviewKey.matches("^[0-9A-Za-z_-]{1,128}$")) {
            throw new IllegalArgumentException("잘못된 reviewKey 형식");
        }
        // 결정적 _id(userId:reviewKey) → save()가 _id 기준 멱등 업서트.
        // find-then-save의 동시-첫저장 race(중복 문서/유실; 유니크 인덱스 있으면 DuplicateKey/500)를 제거한다.
        TradeReview r = new TradeReview();
        r.setId(userId + ":" + reviewKey);
        r.setUserId(userId);
        r.setReviewKey(reviewKey);
        r.setChecks(body.checks() != null ? body.checks() : new HashMap<>());
        String memo = body.memo();
        r.setMemo(memo != null && memo.length() > MEMO_MAX ? memo.substring(0, MEMO_MAX) : memo); // 메모 상한(스토리지 남용 방지)
        r.setUpdatedAt(Instant.now());
        return ApiResponse.ok(repository.save(r));
    }

    public record ReviewBody(Map<String, Boolean> checks, String memo) {}
}
