package com.project.whalearc.live.controller;

import com.project.whalearc.common.dto.ApiResponse;
import com.project.whalearc.live.config.AutoTradeAccessChecker;
import com.project.whalearc.live.domain.LiveOrderLog;
import com.project.whalearc.live.domain.LiveStrategyDeployment;
import com.project.whalearc.live.dto.CreateDeploymentRequest;
import com.project.whalearc.live.dto.DeploymentResponse;
import com.project.whalearc.live.service.LiveStrategyService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/live")
@RequiredArgsConstructor
public class LiveStrategyController {

    private final LiveStrategyService liveStrategyService;
    private final AutoTradeAccessChecker autoTradeAccessChecker;

    @PostMapping("/deployments")
    public ResponseEntity<ApiResponse<DeploymentResponse>> createDeployment(
            @AuthenticationPrincipal Jwt jwt, @RequestBody CreateDeploymentRequest request) {
        String userId = jwt.getSubject();
        // 실거래(LIVE)=실제 돈은 BASIC 이상(또는 ADMIN)만. 모의(PAPER)는 전체 공개.
        if (request.getAccountMode() == LiveStrategyDeployment.AccountMode.LIVE
                && !autoTradeAccessChecker.canTradeLive(userId)) {
            return ResponseEntity.status(403)
                    .body(ApiResponse.error("실거래 자동매매는 Basic 이상 등급에서 이용할 수 있습니다."));
        }
        try {
            LiveStrategyDeployment d = liveStrategyService.createDeployment(userId, request);
            return ResponseEntity.ok(ApiResponse.ok(DeploymentResponse.from(d)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        } catch (Exception e) {
            log.error("라이브 배포 생성 실패: {}", e.getMessage());
            return ResponseEntity.internalServerError().body(ApiResponse.error("배포 생성 중 오류가 발생했습니다."));
        }
    }

    @GetMapping("/deployments")
    public ResponseEntity<ApiResponse<List<DeploymentResponse>>> getDeployments(@AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();
        List<DeploymentResponse> deployments = liveStrategyService.getUserDeployments(userId).stream()
                .map(DeploymentResponse::from)
                .toList();
        return ResponseEntity.ok(ApiResponse.ok(deployments));
    }

    @GetMapping("/deployments/{deploymentId}/orders")
    public ResponseEntity<ApiResponse<List<LiveOrderLog>>> getDeploymentOrders(
            @AuthenticationPrincipal Jwt jwt, @PathVariable String deploymentId) {
        String userId = jwt.getSubject();
        try {
            return ResponseEntity.ok(ApiResponse.ok(liveStrategyService.getDeploymentOrders(userId, deploymentId)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @PostMapping("/deployments/{deploymentId}/evaluate")
    public ResponseEntity<ApiResponse<DeploymentResponse>> evaluateNow(
            @AuthenticationPrincipal Jwt jwt, @PathVariable String deploymentId) {
        String userId = jwt.getSubject();
        try {
            LiveStrategyDeployment d = liveStrategyService.evaluateNow(userId, deploymentId);
            return ResponseEntity.ok(ApiResponse.ok(DeploymentResponse.from(d)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        } catch (Exception e) {
            log.error("라이브 즉시 평가 실패: {}", e.getMessage());
            return ResponseEntity.internalServerError().body(ApiResponse.error("평가 중 오류가 발생했습니다."));
        }
    }

    @PostMapping("/deployments/{deploymentId}/close")
    public ResponseEntity<ApiResponse<DeploymentResponse>> closeNow(
            @AuthenticationPrincipal Jwt jwt, @PathVariable String deploymentId) {
        try {
            LiveStrategyDeployment d = liveStrategyService.closeNow(jwt.getSubject(), deploymentId);
            return ResponseEntity.ok(ApiResponse.ok(DeploymentResponse.from(d)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @PostMapping("/deployments/{deploymentId}/start")
    public ResponseEntity<ApiResponse<DeploymentResponse>> start(
            @AuthenticationPrincipal Jwt jwt, @PathVariable String deploymentId) {
        return changeStatus(jwt, deploymentId, "start");
    }

    @PostMapping("/deployments/{deploymentId}/pause")
    public ResponseEntity<ApiResponse<DeploymentResponse>> pause(
            @AuthenticationPrincipal Jwt jwt, @PathVariable String deploymentId) {
        return changeStatus(jwt, deploymentId, "pause");
    }

    @PostMapping("/deployments/{deploymentId}/stop")
    public ResponseEntity<ApiResponse<DeploymentResponse>> stop(
            @AuthenticationPrincipal Jwt jwt, @PathVariable String deploymentId) {
        return changeStatus(jwt, deploymentId, "stop");
    }

    @DeleteMapping("/deployments/{deploymentId}")
    public ResponseEntity<ApiResponse<Void>> deleteDeployment(
            @AuthenticationPrincipal Jwt jwt, @PathVariable String deploymentId) {
        try {
            liveStrategyService.deleteDeployment(jwt.getSubject(), deploymentId);
            return ResponseEntity.ok(ApiResponse.<Void>ok(null));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    private ResponseEntity<ApiResponse<DeploymentResponse>> changeStatus(Jwt jwt, String deploymentId, String action) {
        String userId = jwt.getSubject();
        try {
            LiveStrategyDeployment d = switch (action) {
                case "start" -> liveStrategyService.start(userId, deploymentId);
                case "pause" -> liveStrategyService.pause(userId, deploymentId);
                default -> liveStrategyService.stop(userId, deploymentId);
            };
            return ResponseEntity.ok(ApiResponse.ok(DeploymentResponse.from(d)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    /** 전역 킬스위치 토글 — 모든 라이브 자동매매 즉시 정지/재개. */
    @PostMapping("/kill-switch")
    public ResponseEntity<?> setKillSwitch(@AuthenticationPrincipal Jwt jwt, @RequestParam boolean engaged) {
        liveStrategyService.setKillSwitch(engaged);
        return ResponseEntity.ok(ApiResponse.ok(Map.of("killSwitch", engaged)));
    }

    @GetMapping("/kill-switch")
    public ResponseEntity<?> getKillSwitch(@AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(ApiResponse.ok(Map.of("killSwitch", liveStrategyService.isKillSwitchEngaged())));
    }
}
