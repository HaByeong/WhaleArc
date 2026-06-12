package com.project.whalearc.mirror.domain;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

/**
 * 감정 거울(Emotion Mirror) — 사용자가 규칙을 어기고 싶었던 "흔들린 순간"의 포착·봉인 기록.
 * 봉인 시점의 사실(가격·등락률·선택·감정)을 잠그고, revealAt 이후 "충동대로 vs 항로대로" 결과를 계산해 개봉한다.
 *
 * 반사실(counterfactual) 모델 — 평행우주를 지어내지 않는 단일·보수적 가정:
 *   · 매도 충동(보유 중): 충동=전량 현금화(0%, 이후 변동 없음) / 항로=계속 보유(자산 변동분)
 *   · 매수 충동(미보유):  충동=매수(자산 변동분)        / 항로=관망(0%)
 *   · 감정의 비용 = 항로 − 충동  (충동이 옳았던 날은 음수 → 자동으로 정직)
 *   · 수수료·세금·슬리피지는 제외(모의 기준) — 화면에 가정 문장으로 명시한다.
 */
@Getter
@Setter
@NoArgsConstructor
@Document(collection = "emotion_captures")
public class EmotionCapture {

    @Id
    private String id;

    @Indexed
    private String userId;

    // ── 봉인된 사실 ──
    private String triggerType;        // PANIC_DROP / FOMO_SPIKE / RULE_BREACH / OVER_CHECK
    private String impulseSide;        // SELL(매도 충동) / BUY(매수 충동) — 반사실 계산 방향
    private String assetSymbol;
    private String assetName;
    private String assetType;          // CRYPTO / STOCK / US_STOCK / ETF
    private double priceAtEvent;       // 봉인 시점 가격
    private double changeRateAtEvent;  // 봉인 시점 당일 등락률(%)
    private String userChoice;         // FOLLOW_RULE(항로 지킴) / FOLLOW_IMPULSE(충동 실행)
    private String emotionNote;        // 감정 메모
    private int emotionIntensity;      // 강도 1~5
    private Instant capturedAt;
    private Instant revealAt;          // 개봉 예정 시점

    // ── 개봉 후 채워지는 결과 ──
    private boolean revealed;
    private Instant revealedAt;
    private Double priceAtReveal;
    private Double impulseOutcomePct;  // 충동대로 했을 때 수익률(%)
    private Double ruleOutcomePct;     // 항로대로 했을 때 수익률(%)
    private List<Double> pathPct;      // 이벤트→개봉 사이 자산 변동 경로(%) — 체리피킹 방지용, best-effort

    public EmotionCapture(String userId, String triggerType, String impulseSide,
                          String assetSymbol, String assetName, String assetType,
                          double priceAtEvent, double changeRateAtEvent, String userChoice,
                          String emotionNote, int emotionIntensity, Instant capturedAt, Instant revealAt) {
        this.userId = userId;
        this.triggerType = triggerType;
        this.impulseSide = impulseSide;
        this.assetSymbol = assetSymbol;
        this.assetName = assetName;
        this.assetType = assetType;
        this.priceAtEvent = priceAtEvent;
        this.changeRateAtEvent = changeRateAtEvent;
        this.userChoice = userChoice;
        this.emotionNote = emotionNote;
        this.emotionIntensity = emotionIntensity;
        this.capturedAt = capturedAt;
        this.revealAt = revealAt;
        this.revealed = false;
    }
}
