package com.project.whalearc.trade.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.Setter;

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

    @Min(value = 1, message = "수량은 1 이상이어야 합니다.")
    private int quantity;

    private Double price; // 지정가일 때만
}
