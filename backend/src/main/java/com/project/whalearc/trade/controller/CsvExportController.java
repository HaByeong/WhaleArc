package com.project.whalearc.trade.controller;

import com.project.whalearc.trade.service.CsvExportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

@RestController
@RequestMapping("/api/export")
@RequiredArgsConstructor
public class CsvExportController {

    private final CsvExportService csvExportService;

    @GetMapping("/trades.csv")
    public ResponseEntity<byte[]> exportTrades(@AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();
        String csv = csvExportService.generateTradesCsv(userId);
        String filename = "WhaleArc_trades_" + LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE) + ".csv";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .body(csv.getBytes(StandardCharsets.UTF_8));
    }

    @GetMapping("/portfolio.csv")
    public ResponseEntity<byte[]> exportPortfolio(@AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();
        String csv = csvExportService.generatePortfolioReportCsv(userId);
        String filename = "WhaleArc_portfolio_" + LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE) + ".csv";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .body(csv.getBytes(StandardCharsets.UTF_8));
    }
}
