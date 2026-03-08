package com.project.whalearc.store.controller;

import com.project.whalearc.store.domain.ProductPurchase;
import com.project.whalearc.store.domain.QuantProduct;
import com.project.whalearc.store.dto.PurchasePerformanceDto;
import com.project.whalearc.store.service.QuantStoreService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/store")
@RequiredArgsConstructor
public class QuantStoreController {

    private final QuantStoreService storeService;

    @GetMapping("/products")
    public ResponseEntity<Map<String, Object>> getProducts(
            @RequestParam(required = false) QuantProduct.Category category) {
        List<QuantProduct> products = (category != null)
                ? storeService.getProductsByCategory(category)
                : storeService.getAllProducts();
        return ResponseEntity.ok(Map.of("data", products));
    }

    @GetMapping("/products/{productId}")
    public ResponseEntity<Map<String, Object>> getProduct(@PathVariable String productId) {
        return ResponseEntity.ok(Map.of("data", storeService.getProduct(productId)));
    }

    @PostMapping("/products/{productId}/purchase")
    public ResponseEntity<Map<String, Object>> purchaseProduct(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String productId,
            @RequestBody Map<String, Object> body) {
        String userId = jwt.getSubject();
        Object rawAmount = body.get("investmentAmount");
        if (rawAmount == null || !(rawAmount instanceof Number)) {
            return ResponseEntity.badRequest().body(Map.of("message", "투자 금액을 입력해주세요."));
        }
        double investmentAmount = ((Number) rawAmount).doubleValue();
        if (investmentAmount <= 0) {
            return ResponseEntity.badRequest().body(Map.of("message", "투자 금액은 0보다 커야 합니다."));
        }
        ProductPurchase purchase = storeService.purchaseProduct(userId, productId, investmentAmount);
        return ResponseEntity.ok(Map.of("data", purchase, "message", "항로 구매 및 자산 매수가 완료되었습니다."));
    }

    @GetMapping("/my-purchases")
    public ResponseEntity<Map<String, Object>> getMyPurchases(@AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();
        List<ProductPurchase> purchases = storeService.getMyPurchases(userId);
        Set<String> purchasedIds = storeService.getMyPurchasedProductIds(userId);
        return ResponseEntity.ok(Map.of("data", purchases, "purchasedProductIds", purchasedIds));
    }

    @GetMapping("/my-purchases/performance")
    public ResponseEntity<Map<String, Object>> getMyPurchasesPerformance(@AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();
        List<PurchasePerformanceDto> performance = storeService.getMyPurchasesPerformance(userId);
        return ResponseEntity.ok(Map.of("data", performance));
    }

    @DeleteMapping("/my-purchases/{purchaseId}")
    public ResponseEntity<Map<String, Object>> cancelPurchase(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String purchaseId) {
        String userId = jwt.getSubject();
        ProductPurchase cancelled = storeService.cancelPurchase(userId, purchaseId);
        return ResponseEntity.ok(Map.of("data", cancelled, "message", "구매가 취소되었습니다."));
    }

}
