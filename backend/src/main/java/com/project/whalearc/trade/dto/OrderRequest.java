package com.project.whalearc.trade.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class OrderRequest {

    @NotBlank(message = "종목 코드는 필수입니다.")
    private String stockCode;

    @NotBlank(message = "종목 이름은 필수입니다.")
    private String stockName;

    @NotBlank(message = "주문 유형은 필수입니다.")
    @Pattern(regexp = "BUY|SELL", message = "주문 유형은 BUY 또는 SELL이어야 합니다.")
    private String orderType;

    @NotBlank(message = "주문 방식은 필수입니다.")
    @Pattern(regexp = "MARKET|LIMIT", message = "주문 방식은 MARKET 또는 LIMIT이어야 합니다.")
    private String orderMethod;

    @NotNull(message = "수량은 필수입니다.")
    @DecimalMin(value = "0.00000001", message = "수량은 0보다 커야 합니다.")
    private BigDecimal quantity;

    private BigDecimal price; // 지정가일 때만

    // 허용 자산유형만 받는다(@Pattern은 null을 통과시켜 미지정 시 CRYPTO 기본 처리 호환 유지).
    @Pattern(regexp = "STOCK|CRYPTO|US_STOCK|ETF", message = "지원하지 않는 자산 유형입니다.")
    private String assetType; // "STOCK" or "CRYPTO" (기본: CRYPTO)

    @Size(max = 500, message = "메모는 500자 이하로 입력해주세요.")
    private String memo;

    // 멱등성 키 — 클라이언트가 제출 1회당 UUID 1개 생성. 동일 키 재요청은 이중 체결되지 않고 기존 주문 반환.
    @Size(max = 64, message = "주문 키가 올바르지 않습니다.")
    private String clientOrderId;
}
