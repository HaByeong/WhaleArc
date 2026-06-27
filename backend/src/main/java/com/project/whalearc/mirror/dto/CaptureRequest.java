package com.project.whalearc.mirror.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

/** 봉인 요청 — 클라이언트는 종목·선택·감정만 보내고, 가격/등락률/시점은 서버가 권위있게 stamp 한다. */
@Getter
@Setter
public class CaptureRequest {
    @NotBlank
    private String assetSymbol;
    private String assetName;
    private String assetType;          // CRYPTO / STOCK / US_STOCK / ETF (기본 CRYPTO)
    private String triggerType;        // 기본 PANIC_DROP
    @NotBlank
    private String userChoice;         // FOLLOW_RULE / FOLLOW_IMPULSE
    private String emotionNote;
    @Min(1) @Max(5)
    private int emotionIntensity;

    // 클라이언트 fallback — 서버가 시세를 못 구할 때 사용자가 본 값으로 봉인(죽은 봉인 방지)
    private Double priceAtEvent;       // 사용자가 본 현재가
    private Double changeRate;         // 사용자가 본 당일 등락률(%)
    private Double amountKrw;          // 이 결정에 걸린 금액(원) — 결과 금액 환산용
}
