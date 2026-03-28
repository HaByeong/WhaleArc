package com.project.whalearc.trade.controller;

import com.project.whalearc.common.dto.ApiResponse;
import com.project.whalearc.trade.domain.TradeRecord;
import com.project.whalearc.trade.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/trades")
@RequiredArgsConstructor
public class TradeController {

    private final OrderService orderService;

    @GetMapping
    public ApiResponse<List<TradeRecord>> getTrades(@AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();
        return ApiResponse.ok(orderService.getTrades(userId));
    }

    @PutMapping("/{tradeId}/memo")
    public ApiResponse<TradeRecord> updateMemo(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String tradeId,
            @RequestBody Map<String, String> body) {
        String userId = jwt.getSubject();
        String memo = body.get("memo");
        return ApiResponse.ok(orderService.updateTradeMemo(userId, tradeId, memo));
    }
}
