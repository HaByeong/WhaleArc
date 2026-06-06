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

    /** 청산 거래(reviewKey)별 체크/메모 업서트 */
    @PutMapping("/{reviewKey}")
    public ApiResponse<TradeReview> upsert(@AuthenticationPrincipal Jwt jwt,
                                           @PathVariable String reviewKey,
                                           @RequestBody ReviewBody body) {
        String userId = jwt.getSubject();
        TradeReview r = repository.findByUserIdAndReviewKey(userId, reviewKey).orElseGet(() -> {
            TradeReview n = new TradeReview();
            n.setUserId(userId);
            n.setReviewKey(reviewKey);
            return n;
        });
        r.setChecks(body.checks() != null ? body.checks() : new HashMap<>());
        r.setMemo(body.memo());
        r.setUpdatedAt(Instant.now());
        return ApiResponse.ok(repository.save(r));
    }

    public record ReviewBody(Map<String, Boolean> checks, String memo) {}
}
