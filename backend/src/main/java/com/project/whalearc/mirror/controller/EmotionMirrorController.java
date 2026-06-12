package com.project.whalearc.mirror.controller;

import com.project.whalearc.common.dto.ApiResponse;
import com.project.whalearc.mirror.dto.CaptureRequest;
import com.project.whalearc.mirror.dto.CaptureResponse;
import com.project.whalearc.mirror.service.EmotionMirrorService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** 감정 거울 — 봉인(포착)·목록(개봉 포함). */
@Slf4j
@RestController
@RequestMapping("/api/mirror")
@RequiredArgsConstructor
public class EmotionMirrorController {

    private final EmotionMirrorService mirrorService;

    /** 흔들린 순간을 봉인한다. */
    @PostMapping("/captures")
    public ResponseEntity<ApiResponse<CaptureResponse>> capture(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody CaptureRequest request) {
        String userId = jwt.getSubject();
        try {
            return ResponseEntity.ok(ApiResponse.ok(mirrorService.capture(userId, request)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        } catch (Exception e) {
            log.warn("감정 거울 봉인 실패: userId={}, {}", userId, e.getMessage());
            return ResponseEntity.internalServerError().body(ApiResponse.error("봉인 중 오류가 발생했습니다."));
        }
    }

    /** 내 봉인 목록(만기된 건 즉시 개봉되어 반환). */
    @GetMapping("/captures")
    public ResponseEntity<ApiResponse<List<CaptureResponse>>> myCaptures(@AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(ApiResponse.ok(mirrorService.getUserCaptures(jwt.getSubject())));
    }
}
