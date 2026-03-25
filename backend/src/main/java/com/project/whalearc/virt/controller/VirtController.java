package com.project.whalearc.virt.controller;

import com.project.whalearc.user.service.UserSyncService;
import com.project.whalearc.virt.dto.VirtCredentialRequest;
import com.project.whalearc.virt.dto.VirtPortfolioResponse;
import com.project.whalearc.virt.dto.VirtTradeResponse;
import com.project.whalearc.virt.dto.VirtBitgetCredentialRequest;
import com.project.whalearc.virt.dto.VirtUpbitCredentialRequest;
import com.project.whalearc.virt.service.VirtService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/virt")
@RequiredArgsConstructor
public class VirtController {

    private final VirtService virtService;
    private final UserSyncService userSyncService;

    /* ───── 자격증명 관리 ───── */

    /** API 키 등록/수정 */
    @PostMapping("/credentials")
    public ResponseEntity<?> saveCredential(@AuthenticationPrincipal Jwt jwt,
                                            @Valid @RequestBody VirtCredentialRequest request) {
        String userId = userSyncService.getOrCreateUser(jwt).getId();
        virtService.saveCredential(userId, request);
        return ResponseEntity.ok(Map.of("message", "API 키가 등록되었습니다."));
    }

    /** 연결 상태 확인 (마스킹된 키 정보) */
    @GetMapping("/credentials")
    public ResponseEntity<?> getCredentialInfo(@AuthenticationPrincipal Jwt jwt) {
        String userId = userSyncService.getOrCreateUser(jwt).getId();
        if (!virtService.hasCredential(userId)) {
            return ResponseEntity.ok(Map.of("connected", false));
        }
        return ResponseEntity.ok(virtService.getCredentialInfo(userId));
    }

    /** API 키 삭제 (연결 해제) */
    @DeleteMapping("/credentials")
    public ResponseEntity<?> deleteCredential(@AuthenticationPrincipal Jwt jwt) {
        String userId = userSyncService.getOrCreateUser(jwt).getId();
        virtService.deleteCredential(userId);
        return ResponseEntity.ok(Map.of("message", "연결이 해제되었습니다."));
    }

    /* ───── 실계좌 데이터 ───── */

    /** 실계좌 포트폴리오 (잔고 + 보유종목) */
    @GetMapping("/portfolio")
    public ResponseEntity<?> getPortfolio(@AuthenticationPrincipal Jwt jwt) {
        String userId = userSyncService.getOrCreateUser(jwt).getId();
        try {
            return ResponseEntity.ok(virtService.getPortfolio(userId));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("message", e.getMessage() != null ? e.getMessage() : "알 수 없는 오류"));
        }
    }

    /** 체결내역 (최근 N일, 기본 30일) */
    @GetMapping("/trades")
    public ResponseEntity<List<VirtTradeResponse>> getTrades(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "30") int days) {
        String userId = userSyncService.getOrCreateUser(jwt).getId();
        return ResponseEntity.ok(virtService.getTradeHistory(userId, days));
    }

    /** API 키 연결 테스트 (잔고 조회 시도) */
    @PostMapping("/test-connection")
    public ResponseEntity<?> testConnection(@AuthenticationPrincipal Jwt jwt) {
        String userId = userSyncService.getOrCreateUser(jwt).getId();
        try {
            VirtPortfolioResponse portfolio = virtService.getPortfolio(userId);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "연결 성공! 총 자산: " + portfolio.getTotalValue() + "원",
                    "totalValue", portfolio.getTotalValue(),
                    "holdingsCount", portfolio.getHoldings().size()
            ));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of(
                    "success", false,
                    "message", "연결 실패: " + e.getMessage()
            ));
        }
    }

    /* ═══════ 업비트 (코인) ═══════ */

    /** 업비트 API 키 등록 */
    @PostMapping("/upbit/credentials")
    public ResponseEntity<?> saveUpbitCredential(@AuthenticationPrincipal Jwt jwt,
                                                  @Valid @RequestBody VirtUpbitCredentialRequest request) {
        String userId = userSyncService.getOrCreateUser(jwt).getId();
        virtService.saveUpbitCredential(userId, request.getAccessKey(), request.getSecretKey());
        return ResponseEntity.ok(Map.of("message", "업비트 API 키가 등록되었습니다."));
    }

    /** 업비트 연결 상태 확인 */
    @GetMapping("/upbit/credentials")
    public ResponseEntity<?> getUpbitCredentialInfo(@AuthenticationPrincipal Jwt jwt) {
        String userId = userSyncService.getOrCreateUser(jwt).getId();
        return ResponseEntity.ok(virtService.getUpbitCredentialInfo(userId));
    }

    /** 업비트 연결 해제 */
    @DeleteMapping("/upbit/credentials")
    public ResponseEntity<?> deleteUpbitCredential(@AuthenticationPrincipal Jwt jwt) {
        String userId = userSyncService.getOrCreateUser(jwt).getId();
        virtService.deleteUpbitCredential(userId);
        return ResponseEntity.ok(Map.of("message", "업비트 연결이 해제되었습니다."));
    }

    /** 업비트 코인 포트폴리오 */
    @GetMapping("/upbit/portfolio")
    public ResponseEntity<VirtPortfolioResponse> getUpbitPortfolio(@AuthenticationPrincipal Jwt jwt) {
        String userId = userSyncService.getOrCreateUser(jwt).getId();
        return ResponseEntity.ok(virtService.getUpbitPortfolio(userId));
    }

    /** 업비트 연결 테스트 */
    @PostMapping("/upbit/test-connection")
    public ResponseEntity<?> testUpbitConnection(@AuthenticationPrincipal Jwt jwt) {
        String userId = userSyncService.getOrCreateUser(jwt).getId();
        try {
            VirtPortfolioResponse portfolio = virtService.getUpbitPortfolio(userId);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "연결 성공! 총 자산: " + portfolio.getTotalValue() + "원",
                    "totalValue", portfolio.getTotalValue(),
                    "holdingsCount", portfolio.getHoldings().size()
            ));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of(
                    "success", false,
                    "message", "연결 실패: " + e.getMessage()
            ));
        }
    }

    /* ═══════ 비트겟 (코인) ═══════ */

    @PostMapping("/bitget/credentials")
    public ResponseEntity<?> saveBitgetCredential(@AuthenticationPrincipal Jwt jwt,
                                                   @Valid @RequestBody VirtBitgetCredentialRequest request) {
        String userId = userSyncService.getOrCreateUser(jwt).getId();
        virtService.saveBitgetCredential(userId, request.getApiKey(), request.getSecretKey(), request.getPassphrase());
        return ResponseEntity.ok(Map.of("message", "비트겟 API 키가 등록되었습니다."));
    }

    @GetMapping("/bitget/credentials")
    public ResponseEntity<?> getBitgetCredentialInfo(@AuthenticationPrincipal Jwt jwt) {
        String userId = userSyncService.getOrCreateUser(jwt).getId();
        return ResponseEntity.ok(virtService.getBitgetCredentialInfo(userId));
    }

    @DeleteMapping("/bitget/credentials")
    public ResponseEntity<?> deleteBitgetCredential(@AuthenticationPrincipal Jwt jwt) {
        String userId = userSyncService.getOrCreateUser(jwt).getId();
        virtService.deleteBitgetCredential(userId);
        return ResponseEntity.ok(Map.of("message", "비트겟 연결이 해제되었습니다."));
    }

    @GetMapping("/bitget/portfolio")
    public ResponseEntity<VirtPortfolioResponse> getBitgetPortfolio(@AuthenticationPrincipal Jwt jwt) {
        String userId = userSyncService.getOrCreateUser(jwt).getId();
        return ResponseEntity.ok(virtService.getBitgetPortfolio(userId));
    }

    @PostMapping("/bitget/test-connection")
    public ResponseEntity<?> testBitgetConnection(@AuthenticationPrincipal Jwt jwt) {
        String userId = userSyncService.getOrCreateUser(jwt).getId();
        try {
            VirtPortfolioResponse portfolio = virtService.getBitgetPortfolio(userId);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "연결 성공! 총 자산: " + portfolio.getTotalValue() + "원",
                    "totalValue", portfolio.getTotalValue(),
                    "holdingsCount", portfolio.getHoldings().size()
            ));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of(
                    "success", false,
                    "message", "연결 실패: " + e.getMessage()
            ));
        }
    }
}
