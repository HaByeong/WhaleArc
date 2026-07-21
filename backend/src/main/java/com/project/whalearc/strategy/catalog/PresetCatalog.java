package com.project.whalearc.strategy.catalog;

import com.project.whalearc.strategy.domain.Condition;
import com.project.whalearc.strategy.domain.Indicator;
import com.project.whalearc.strategy.dto.PresetStrategyResponse;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static com.project.whalearc.strategy.domain.Condition.Logic.AND;
import static com.project.whalearc.strategy.domain.Condition.Logic.OR;
import static com.project.whalearc.strategy.domain.Condition.Operator.GT;
import static com.project.whalearc.strategy.domain.Condition.Operator.GTE;
import static com.project.whalearc.strategy.domain.Condition.Operator.LT;
import static com.project.whalearc.strategy.domain.Indicator.IndicatorType.ADX;
import static com.project.whalearc.strategy.domain.Indicator.IndicatorType.ATR;
import static com.project.whalearc.strategy.domain.Indicator.IndicatorType.BOLLINGER_BANDS;
import static com.project.whalearc.strategy.domain.Indicator.IndicatorType.CCI;
import static com.project.whalearc.strategy.domain.Indicator.IndicatorType.DONCHIAN;
import static com.project.whalearc.strategy.domain.Indicator.IndicatorType.EMA;
import static com.project.whalearc.strategy.domain.Indicator.IndicatorType.MA;
import static com.project.whalearc.strategy.domain.Indicator.IndicatorType.MACD;
import static com.project.whalearc.strategy.domain.Indicator.IndicatorType.RSI;
import static com.project.whalearc.strategy.domain.Indicator.IndicatorType.STOCHASTIC;
import static com.project.whalearc.strategy.domain.Indicator.IndicatorType.WILLIAMS_R;

/**
 * 프리셋 전략 카탈로그 (SSOT) — 프론트 presetStrategies.ts를 백엔드로 1:1 이식한 단일 출처.
 *
 * App(기기 실행형)·web·백테스트가 모두 이 정의를 받는다. 15종 = 순수 제네릭 13 + 터틀(양방향) + 모멘텀(로테이션).
 * 제네릭 13종은 indicators+conditions만으로 App SignalEvaluator가 그대로 평가한다.
 * 터틀은 임의기간 DONCHIAN_HIGH_&lt;n&gt;/DONCHIAN_LOW_&lt;n&gt; + ADX 조건으로 표현되며 App은 롱 방향만 평가(숏/피라미딩 후속).
 * 모멘텀은 strategyType=MOMENTUM_ROTATION 플래그로, App이 전용 모멘텀 배포 화면으로 분기한다.
 */
public final class PresetCatalog {
    private PresetCatalog() {}

    public static final String MOMENTUM_PRESET_ID = "preset-momentum-top5";
    public static final String TURTLE_PRESET_ID = "preset-turtle";

    private static final List<String> MIXED = List.of("BTC", "005930", "NVDA");
    private static final Map<String, String> MIXED_NAMES =
            Map.of("BTC", "비트코인", "005930", "삼성전자", "NVDA", "엔비디아");

    public static List<PresetStrategyResponse> all() {
        return List.of(
                buyHold(), goldenCross(), rsiReversal(), bollingerSqueeze(), macdDivergence(),
                stochastic(), connorsRsi2(), volatilityBreakout(), tripleEma(), keltnerBreakout(),
                bollingerReversion(), oscillatorConfluence(), macdRsiGate(), turtle(), momentum());
    }

    // ── 헬퍼 ──
    private static Indicator ind(Indicator.IndicatorType t, Map<String, Number> params) {
        return new Indicator(t, params);
    }

    private static Map<String, Number> p(String k, Number v) {
        return Map.of(k, v);
    }

    private static Map<String, Number> p(String k1, Number v1, String k2, Number v2) {
        return Map.of(k1, v1, k2, v2);
    }

    private static Map<String, Number> p(String k1, Number v1, String k2, Number v2, String k3, Number v3) {
        return Map.of(k1, v1, k2, v2, k3, v3);
    }

    private static Condition c(String indicator, Condition.Operator op, double value, Condition.Logic logic) {
        return new Condition(indicator, op, BigDecimal.valueOf(value), logic, null);
    }

    private static Condition cx(String indicator, Condition.Operator op, double value, Condition.Logic logic, String expr) {
        return new Condition(indicator, op, BigDecimal.valueOf(value), logic, expr);
    }

    private static PresetStrategyResponse.PresetStrategyResponseBuilder base(
            String id, String name, String difficulty, String category, String minTier) {
        return PresetStrategyResponse.builder()
                .id(id).name(name).difficulty(difficulty).category(category).minTier(minTier);
    }

    // ── 초급 (FREE) ──
    private static PresetStrategyResponse buyHold() {
        return base("preset-buy-hold", "Buy & Hold (장기 보유)", "초급", "basic", "FREE")
                .description("시작 시점에 매수 후 종료 시점까지 그대로 보유하는 가장 단순한 전략입니다. 매매 타이밍을 잡지 않고 시간의 힘에 맡기는 방식이며, 적립식 투자와 결합하면 직장인의 표준 투자법이 됩니다.")
                .strategyLogic("시작일 매수 → 종료일까지 보유 (청산 없음)")
                .assetType("MIXED").targetAssets(MIXED).targetAssetNames(MIXED_NAMES)
                .indicators(List.of())
                .entryConditions(List.of(c("PRICE", GT, 0, AND)))
                .exitConditions(List.of(c("PRICE", LT, 0, AND)))
                .build();
    }

    private static PresetStrategyResponse goldenCross() {
        return base("preset-golden-cross", "골든크로스 추종 전략", "초급", "trend", "FREE")
                .description("20일/60일 이동평균선 골든크로스 발생 시 매수, 데드크로스 시 매도하는 추세추종 전략입니다. 중장기 상승 추세에서 안정적인 수익을 추구합니다.")
                .strategyLogic("MA(20) > MA(60) → 매수 / MA(20) < MA(60) → 매도")
                .assetType("MIXED").targetAssets(MIXED).targetAssetNames(MIXED_NAMES)
                .indicators(List.of(ind(MA, p("period", 20)), ind(MA, p("period", 60))))
                .entryConditions(List.of(c("MA_20_CROSS_MA_60", GT, 0, AND)))
                .exitConditions(List.of(c("MA_20_CROSSUNDER_MA_60", GT, 0, AND)))
                .build();
    }

    private static PresetStrategyResponse rsiReversal() {
        return base("preset-rsi-reversal", "RSI 반전 매매", "초급", "reversal", "FREE")
                .description("RSI 과매도 구간(30 이하) 진입 후 반등 시 매수, 과매수 구간(70 이상) 도달 시 매도하는 평균회귀 전략입니다.")
                .strategyLogic("RSI < 30 → 매수 / RSI > 70 → 매도")
                .assetType("MIXED").targetAssets(MIXED).targetAssetNames(MIXED_NAMES)
                .indicators(List.of(ind(RSI, p("period", 14))))
                .entryConditions(List.of(c("RSI", LT, 30, AND)))
                .exitConditions(List.of(c("RSI", GT, 70, AND)))
                .build();
    }

    private static PresetStrategyResponse volatilityBreakout() {
        return base("preset-volatility-breakout", "변동성 돌파 전략", "초급", "volatility", "FREE")
                .description("래리 윌리엄스의 변동성 돌파 전략입니다. 전일 변동폭(고가-저가)의 일정 비율만큼 당일 시가에서 상승하면 매수하고, 다음 날 청산합니다.")
                .strategyLogic("CLOSE > OPEN + (전일고가 - 전일저가) × 0.5 → 매수 / 다음날 시가 매도")
                .assetType("MIXED").targetAssets(MIXED).targetAssetNames(MIXED_NAMES)
                .indicators(List.of(ind(ATR, p("period", 1))))
                .entryConditions(List.of(cx("CLOSE", GT, 0, AND, "OPEN + (PREV_HIGH - PREV_LOW) * 0.5")))
                .exitConditions(List.of(cx("CLOSE", LT, 0, AND, "OPEN + (PREV_HIGH - PREV_LOW) * 0.3")))
                .build();
    }

    private static PresetStrategyResponse tripleEma() {
        return base("preset-triple-ema", "트리플 EMA 추세 정렬", "초급", "trend", "FREE")
                .description("단기·중기·장기 EMA(20·50·200)가 완전히 정렬된 상태에서만 골든크로스로 진입하는 다중 시간프레임 추세 정렬 전략입니다. 단일 골든크로스의 잦은 속임수 신호를 구조적으로 걸러냅니다.")
                .strategyLogic("EMA50 > EMA200(상승 체제) + EMA20 ↑ EMA50 골든크로스 → 매수 / EMA20 ↓ EMA50 또는 종가 < EMA200 → 매도")
                .assetType("MIXED").targetAssets(MIXED).targetAssetNames(MIXED_NAMES)
                .indicators(List.of(ind(EMA, p("period", 20)), ind(EMA, p("period", 50)), ind(EMA, p("period", 200))))
                .entryConditions(List.of(
                        cx("EMA_50", GT, 0, AND, "EMA_200"),
                        c("EMA_20_CROSS_EMA_50", GT, 0, AND)))
                .exitConditions(List.of(
                        c("EMA_20_CROSSUNDER_EMA_50", GT, 0, OR),
                        cx("CLOSE", LT, 0, OR, "EMA_200")))
                .build();
    }

    // ── 중급 (BASIC) ──
    private static PresetStrategyResponse bollingerSqueeze() {
        return base("preset-bollinger-squeeze", "볼린저 밴드 수축 돌파", "중급", "volatility", "BASIC")
                .description("볼린저 밴드 수축 구간에서 상단 돌파 시 매수, 중심선 하락 시 손절. 변동성 확대 구간을 노리는 전략입니다.")
                .strategyLogic("%B > 1 → 매수 (상단 돌파) / %B < 0 → 매도 (하단 이탈)")
                .assetType("MIXED").targetAssets(MIXED).targetAssetNames(MIXED_NAMES)
                .indicators(List.of(ind(BOLLINGER_BANDS, p("period", 20, "stdDev", 2))))
                .entryConditions(List.of(c("BOLLINGER_PCT_B", GT, 1, AND)))
                .exitConditions(List.of(c("BOLLINGER_PCT_B", LT, 0, AND)))
                .build();
    }

    private static PresetStrategyResponse macdDivergence() {
        return base("preset-macd-divergence", "MACD 크로스오버", "중급", "trend", "BASIC")
                .description("MACD 시그널 크로스와 히스토그램 전환을 활용한 추세 전환 포착 전략입니다.")
                .strategyLogic("MACD 골든크로스 → 매수 / MACD 데드크로스 → 매도")
                .assetType("MIXED").targetAssets(MIXED).targetAssetNames(MIXED_NAMES)
                .indicators(List.of(ind(MACD, p("fast", 12, "slow", 26, "signal", 9))))
                .entryConditions(List.of(c("MACD_CROSS_MACD_SIGNAL", GT, 0, AND)))
                .exitConditions(List.of(c("MACD_CROSSUNDER_MACD_SIGNAL", GT, 0, AND)))
                .build();
    }

    private static PresetStrategyResponse stochastic() {
        return base("preset-stochastic", "스토캐스틱 크로스", "중급", "reversal", "BASIC")
                .description("스토캐스틱 %K가 %D를 상향 돌파할 때 매수, 하향 돌파할 때 매도하는 모멘텀 전략입니다.")
                .strategyLogic("%K ↑ %D 크로스 → 매수 / %K ↓ %D 크로스 → 매도")
                .assetType("MIXED").targetAssets(MIXED).targetAssetNames(MIXED_NAMES)
                .indicators(List.of(ind(STOCHASTIC, p("kPeriod", 14, "dPeriod", 3))))
                .entryConditions(List.of(c("STOCH_K_CROSS_STOCH_D", GT, 0, AND)))
                .exitConditions(List.of(c("STOCH_K_CROSSUNDER_STOCH_D", GT, 0, AND)))
                .build();
    }

    private static PresetStrategyResponse connorsRsi2() {
        return base("preset-connors-rsi2", "래리 코너스 RSI(2)", "중급", "reversal", "BASIC")
                .description("초단기 RSI(2일)를 사용하여 급락 후 반등을 포착하는 단기 매매 전략입니다. 래리 코너스가 개발한 전략으로, 상승 추세 종목에서 일시적 과매도 구간을 노립니다.")
                .strategyLogic("RSI(2) < 5 → 매수 (초단기 과매도) / RSI(2) > 60 → 매도 (반등 확인)")
                .assetType("MIXED").targetAssets(MIXED).targetAssetNames(MIXED_NAMES)
                .indicators(List.of(ind(RSI, p("period", 2))))
                .entryConditions(List.of(c("RSI", LT, 5, AND)))
                .exitConditions(List.of(c("RSI", GT, 60, AND)))
                .build();
    }

    private static PresetStrategyResponse keltnerBreakout() {
        return base("preset-keltner-breakout", "켈트너 채널 변동성 돌파", "중급", "volatility", "BASIC")
                .description("EMA20 중심선에 ATR(실제 변동폭) 밴드를 두른 켈트너 채널의 상단을 종가가 돌파할 때 진입하고, 중심선으로 회귀하면 청산하는 변동성 정규화 추세 돌파 전략입니다.")
                .strategyLogic("종가 > EMA20 + 2×ATR(상단 돌파) + 종가 > EMA200 → 매수 / 종가 < EMA20(중심선 회귀) → 매도")
                .assetType("MIXED").targetAssets(MIXED).targetAssetNames(MIXED_NAMES)
                .indicators(List.of(ind(EMA, p("period", 20)), ind(EMA, p("period", 200)), ind(ATR, p("period", 10))))
                .entryConditions(List.of(
                        cx("CLOSE", GT, 0, AND, "EMA_20 + 2.0 * ATR"),
                        cx("CLOSE", GT, 0, AND, "EMA_200")))
                .exitConditions(List.of(cx("CLOSE", LT, 0, OR, "EMA_20")))
                .build();
    }

    // ── 고급 (PRO) ──
    private static PresetStrategyResponse bollingerReversion() {
        return base("preset-bollinger-reversion", "볼린저 %b 레짐 평균회귀", "고급", "reversal", "PRO")
                .description("200일선 위(상승 체제)에서만 볼린저 밴드 하단 이탈(%b < 0.05)을 과매도로 보고 매수, 중심선 회귀(%b ≥ 0.5) 시 청산하는 추세 필터형 평균회귀 전략입니다.")
                .strategyLogic("종가 > 200일선 + %b < 0.05(밴드 하단 이탈) → 매수 / %b ≥ 0.5(중심 회귀) 또는 종가 < 200일선 → 매도")
                .assetType("MIXED").targetAssets(MIXED).targetAssetNames(MIXED_NAMES)
                .indicators(List.of(ind(BOLLINGER_BANDS, p("period", 20, "stdDev", 2)), ind(MA, p("period", 200))))
                .entryConditions(List.of(
                        cx("CLOSE", GT, 0, AND, "MA_200"),
                        c("BOLLINGER_PCT_B", LT, 0.05, AND)))
                .exitConditions(List.of(
                        c("BOLLINGER_PCT_B", GTE, 0.5, OR),
                        cx("CLOSE", LT, 0, OR, "MA_200")))
                .build();
    }

    private static PresetStrategyResponse oscillatorConfluence() {
        return base("preset-oscillator-confluence", "멀티 오실레이터 컨플루언스 반전", "고급", "reversal", "PRO")
                .description("RSI·스토캐스틱·윌리엄스%R·CCI 네 개의 오실레이터가 모두 과매도이고 200일선 위일 때만 매수하는 고확신 평균회귀 전략입니다. 단일 지표의 거짓 신호를 만장일치로 걸러냅니다.")
                .strategyLogic("종가 > 200일선 + RSI<35 + 스토캐스틱K<25 + 윌리엄스%R<-80 + CCI<-100 → 매수 / RSI>55 또는 스토캐스틱K>75 또는 종가<200일선 → 매도")
                .assetType("MIXED").targetAssets(MIXED).targetAssetNames(MIXED_NAMES)
                .indicators(List.of(
                        ind(RSI, p("period", 14)),
                        ind(STOCHASTIC, p("kPeriod", 14, "dPeriod", 3)),
                        ind(WILLIAMS_R, p("period", 14)),
                        ind(CCI, p("period", 20)),
                        ind(MA, p("period", 200))))
                .entryConditions(List.of(
                        cx("CLOSE", GT, 0, AND, "MA_200"),
                        c("RSI", LT, 35, AND),
                        c("STOCH_K", LT, 25, AND),
                        c("WILLIAMS_R", LT, -80, AND),
                        c("CCI", LT, -100, AND)))
                .exitConditions(List.of(
                        c("RSI", GT, 55, OR),
                        c("STOCH_K", GT, 75, OR),
                        cx("CLOSE", LT, 0, OR, "MA_200")))
                .build();
    }

    private static PresetStrategyResponse macdRsiGate() {
        return base("preset-macd-rsi-gate", "MACD·RSI·EMA200 삼중 추세 게이트", "고급", "trend", "PRO")
                .description("200일선 위(상승 체제)이고 RSI가 50을 넘은(모멘텀 확인) 상태에서 MACD 골든크로스가 나올 때만 진입하는 다중 지표 컨플루언스 추세 전략입니다. 세 신호가 동시에 같은 방향일 때만 매수합니다.")
                .strategyLogic("종가 > EMA200 + RSI > 50 + MACD 골든크로스 → 매수 / MACD 데드크로스 또는 종가 < EMA200 → 매도")
                .assetType("MIXED").targetAssets(MIXED).targetAssetNames(MIXED_NAMES)
                .indicators(List.of(
                        ind(MACD, p("fast", 12, "slow", 26, "signal", 9)),
                        ind(RSI, p("period", 14)),
                        ind(EMA, p("period", 200))))
                .entryConditions(List.of(
                        cx("CLOSE", GT, 0, AND, "EMA_200"),
                        c("RSI", GT, 50, AND),
                        c("MACD_CROSS_MACD_SIGNAL", GT, 0, AND)))
                .exitConditions(List.of(
                        c("MACD_CROSSUNDER_MACD_SIGNAL", GT, 0, OR),
                        cx("CLOSE", LT, 0, OR, "EMA_200")))
                .build();
    }

    private static PresetStrategyResponse turtle() {
        final int e = 100;   // 진입 채널
        final int x = 30;    // 청산 채널
        final double adx = 15;
        return base("preset-turtle", "터틀 트레이딩 (돈치안 돌파)", "고급", "trend", "PRO")
                .description("전설적인 터틀 트레이더들의 추세추종 시스템입니다. 직전 100봉 신고가(돈치안 채널 상단)를 돌파하면 롱, 직전 100봉 신저가를 하향 돌파하면 숏으로 진입하고, ADX(추세 강도) 필터를 통과한 추세에만 올라탑니다. 청산 채널(30봉)에 닿으면 현금으로 빠져 다음 돌파를 기다립니다.")
                .strategyLogic("롱: 종가 > 진입채널 신고가 + ADX>임계 / 숏: 종가 < 진입채널 신저가 + ADX>임계 / 청산: 청산채널 반대 또는 트레일링 / 피라미딩: +ATR마다 유닛 추가")
                .assetType("CRYPTO").targetAssets(List.of("BTC", "ETH"))
                .targetAssetNames(Map.of("BTC", "비트코인", "ETH", "이더리움"))
                .tradeDirection("LONG_SHORT_FLAT").leverage(2).maxPositions(4)
                .pyramidMode("ATR").trailingStopPercent(4.0)
                .indicators(List.of(
                        ind(DONCHIAN, p("period", e)),
                        ind(DONCHIAN, p("period", x)),
                        ind(ADX, p("period", 14)),
                        ind(ATR, p("period", 14))))
                .entryConditions(List.of(
                        cx("CLOSE", GT, 0, AND, "DONCHIAN_HIGH_" + e),
                        c("ADX", GT, adx, AND)))
                .exitConditions(List.of(
                        cx("CLOSE", LT, 0, AND, "DONCHIAN_LOW_" + x)))
                .shortEntryConditions(List.of(
                        cx("CLOSE", LT, 0, AND, "DONCHIAN_LOW_" + e),
                        c("ADX", GT, adx, AND)))
                .shortExitConditions(List.of(
                        cx("CLOSE", GT, 0, AND, "DONCHIAN_HIGH_" + x)))
                .build();
    }

    private static PresetStrategyResponse momentum() {
        return base(MOMENTUM_PRESET_ID, "모멘텀 TopN 로테이션", "고급", "trend", "PRO")
                .description("자산군(미국주식·미국ETF·한국주식·가상자산)을 골라, 그 유니버스를 매월 모멘텀(기본 12개월 수익률)으로 줄 세워 상위 N종목에 균등 분산하고 매달 다시 줄 세워 교체하는 추세추종 로테이션입니다. 양수 모멘텀만 담고(없으면 현금), 대표지수가 200일선 아래(약세장)면 노출을 줄입니다.")
                .strategyLogic("매월 첫 거래일: 선택 자산군 유니버스의 모멘텀 랭킹 → 양수 상위 N(균등) → 대표지수<200일선이면 ×레짐floor → 월간 리밸런싱")
                .strategyType("MOMENTUM_ROTATION")
                .assetType("US_STOCK").targetAssets(List.of()).targetAssetNames(Map.of())
                .indicators(List.of()).entryConditions(List.of()).exitConditions(List.of())
                .build();
    }
}
