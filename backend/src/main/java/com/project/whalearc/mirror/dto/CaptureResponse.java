package com.project.whalearc.mirror.dto;

import com.project.whalearc.mirror.domain.EmotionCapture;
import lombok.Getter;

import java.time.Instant;
import java.util.List;

/** 봉인/개봉 응답. 개봉 전이면 결과 필드는 null, 개봉 후 채워진다. */
@Getter
public class CaptureResponse {
    private final String id;
    private final String triggerType;
    private final String impulseSide;
    private final String assetSymbol;
    private final String assetName;
    private final String assetType;
    private final double priceAtEvent;
    private final double changeRateAtEvent;
    private final String userChoice;
    private final String emotionNote;
    private final int emotionIntensity;
    private final Instant capturedAt;
    private final Instant revealAt;

    private final boolean revealed;
    private final Instant revealedAt;
    private final Double priceAtReveal;
    private final Double impulseOutcomePct;
    private final Double ruleOutcomePct;
    private final Double emotionCostPct;   // 항로 − 충동 (양수=항로가 옳음, 음수=충동이 옳음)
    private final Boolean impulseWasRight;  // 개봉 후에만 의미. 충동 결과가 항로보다 나았는가
    private final List<Double> pathPct;

    public CaptureResponse(EmotionCapture c) {
        this.id = c.getId();
        this.triggerType = c.getTriggerType();
        this.impulseSide = c.getImpulseSide();
        this.assetSymbol = c.getAssetSymbol();
        this.assetName = c.getAssetName();
        this.assetType = c.getAssetType();
        this.priceAtEvent = c.getPriceAtEvent();
        this.changeRateAtEvent = c.getChangeRateAtEvent();
        this.userChoice = c.getUserChoice();
        this.emotionNote = c.getEmotionNote();
        this.emotionIntensity = c.getEmotionIntensity();
        this.capturedAt = c.getCapturedAt();
        this.revealAt = c.getRevealAt();
        this.revealed = c.isRevealed();
        this.revealedAt = c.getRevealedAt();
        this.priceAtReveal = c.getPriceAtReveal();
        this.impulseOutcomePct = c.getImpulseOutcomePct();
        this.ruleOutcomePct = c.getRuleOutcomePct();
        if (c.isRevealed() && c.getRuleOutcomePct() != null && c.getImpulseOutcomePct() != null) {
            double cost = c.getRuleOutcomePct() - c.getImpulseOutcomePct();
            this.emotionCostPct = cost;
            this.impulseWasRight = cost < 0;   // 충동 결과 > 항로 결과
        } else {
            this.emotionCostPct = null;
            this.impulseWasRight = null;
        }
        this.pathPct = c.getPathPct();
    }
}
