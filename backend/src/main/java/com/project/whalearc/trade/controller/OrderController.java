package com.project.whalearc.trade.controller;

import com.project.whalearc.common.dto.ApiResponse;
import com.project.whalearc.trade.domain.Order;
import com.project.whalearc.trade.dto.OrderRequest;
import com.project.whalearc.trade.service.OrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;

    @PostMapping
    public ResponseEntity<ApiResponse<Order>> createOrder(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody OrderRequest request) {
        String userId = jwt.getSubject();

        // 지정가 주문 시 가격 필수 검증
        if ("LIMIT".equals(request.getOrderMethod())) {
            if (request.getPrice() == null || request.getPrice() <= 0) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.error("지정가 주문은 가격을 입력해야 합니다."));
            }
        }

        String assetType = request.getAssetType() != null ? request.getAssetType() : "CRYPTO";
        Order order = orderService.createOrder(
                userId,
                request.getStockCode(),
                request.getStockName(),
                Order.OrderType.valueOf(request.getOrderType()),
                Order.OrderMethod.valueOf(request.getOrderMethod()),
                request.getQuantity(),
                request.getPrice(),
                assetType
        );
        log.info("주문 생성: userId={}, stock={}, type={}, qty={}",
                userId, request.getStockCode(), request.getOrderType(), request.getQuantity());
        return ResponseEntity.ok(ApiResponse.ok(order));
    }

    @GetMapping
    public ApiResponse<List<Order>> getOrders(@AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();
        return ApiResponse.ok(orderService.getOrders(userId));
    }

    @DeleteMapping("/{orderId}")
    public ResponseEntity<ApiResponse<Void>> cancelOrder(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String orderId) {
        String userId = jwt.getSubject();
        orderService.cancelOrder(userId, orderId);
        log.info("주문 취소: userId={}, orderId={}", userId, orderId);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }
}
