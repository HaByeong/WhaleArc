package com.project.whalearc.exchange.controller;

import com.project.whalearc.exchange.domain.ExchangeAccount;
import com.project.whalearc.exchange.domain.ExchangePortfolioSnapshot;
import com.project.whalearc.exchange.dto.ExchangeAccountRequestDto;
import com.project.whalearc.exchange.dto.ExchangePortfolioDto;
import com.project.whalearc.exchange.dto.ExchangeTransactionDto;
import com.project.whalearc.exchange.repository.ExchangePortfolioSnapshotRepository;
import com.project.whalearc.exchange.service.ExchangeAccountService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/exchange")
@RequiredArgsConstructor
public class ExchangeAccountController {

    private final ExchangeAccountService exchangeAccountService;
    private final ExchangePortfolioSnapshotRepository snapshotRepository;

    /**
     * API 키 등록/수정
     */
    @PostMapping("/accounts")
    public ResponseEntity<Map<String, Object>> saveAccount(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody ExchangeAccountRequestDto request) {

        String userId = jwt.getSubject();
        ExchangeAccount account = exchangeAccountService.saveAccount(userId, request);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", account);
        return ResponseEntity.ok(response);
    }

    /**
     * 사용자의 모든 거래소 계정 조회
     */
    @GetMapping("/accounts")
    public ResponseEntity<Map<String, Object>> getAccounts(
            @AuthenticationPrincipal Jwt jwt) {

        String userId = jwt.getSubject();
        List<ExchangeAccount> accounts = exchangeAccountService.getAccounts(userId);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", accounts);
        return ResponseEntity.ok(response);
    }

    /**
     * 특정 거래소 계정 조회
     */
    @GetMapping("/accounts/{exchangeType}")
    public ResponseEntity<Map<String, Object>> getAccount(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String exchangeType) {

        String userId = jwt.getSubject();
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", exchangeAccountService.getAccount(userId, exchangeType).orElse(null));
        return ResponseEntity.ok(response);
    }

    /**
     * 거래소 계정 삭제
     */
    @DeleteMapping("/accounts/{exchangeType}")
    public ResponseEntity<Map<String, Object>> deleteAccount(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String exchangeType) {

        String userId = jwt.getSubject();
        exchangeAccountService.deleteAccount(userId, exchangeType);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        return ResponseEntity.ok(response);
    }

    /**
     * 특정 거래소 포트폴리오(보유 자산) 조회
     */
    @GetMapping("/portfolio/{exchangeType}")
    public ResponseEntity<Map<String, Object>> getPortfolio(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String exchangeType) {

        String userId = jwt.getSubject();
        ExchangePortfolioDto portfolio = exchangeAccountService.getPortfolio(userId, exchangeType);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", portfolio);
        return ResponseEntity.ok(response);
    }

    /**
     * 특정 거래소 체결 내역 조회 (KIS 주식, 기본 30일)
     */
    @GetMapping("/transactions/{exchangeType}")
    public ResponseEntity<Map<String, Object>> getTransactions(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String exchangeType,
            @RequestParam(defaultValue = "30") int days) {

        String userId = jwt.getSubject();
        List<ExchangeTransactionDto> transactions = exchangeAccountService.getTransactions(userId, exchangeType, days);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", transactions);
        return ResponseEntity.ok(response);
    }

    /**
     * 실계좌 자산 추이 — 일별 스냅샷 이력 (기본 30일).
     * ExchangeSnapshotScheduler 가 매일 저장한 KRW 합계 스냅샷을 반환.
     */
    @GetMapping("/history")
    public ResponseEntity<Map<String, Object>> getHistory(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "30") int days) {

        String userId = jwt.getSubject();
        LocalDate to = LocalDate.now(ZoneId.of("Asia/Seoul"));
        LocalDate from = to.minusDays(days);
        List<ExchangePortfolioSnapshot> snapshots =
                snapshotRepository.findByUserIdAndDateBetweenOrderByDateAsc(userId, from, to);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", snapshots);
        return ResponseEntity.ok(response);
    }
}
