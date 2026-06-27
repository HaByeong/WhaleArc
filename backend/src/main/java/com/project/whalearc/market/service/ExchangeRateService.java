package com.project.whalearc.market.service;

import com.project.whalearc.virt.service.VirtUpbitClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;

/**
 * USD/KRW 환율 서비스.
 * 1순위: 실제 FX(open.er-api.com, 1시간 캐시) · 2순위: Upbit KRW-USDT 프록시(김프 포함, 30초) · 3순위: 고정 기본값.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ExchangeRateService {

    private final VirtUpbitClient upbitClient;

    @Value("${exchange.default-usd-krw:1400.0}")
    private double defaultUsdKrw;

    private volatile double cachedUsdKrw = 0;
    private volatile long usdKrwExpireAt = 0;
    private volatile boolean usdKrwStale = true; // 권위 FX 조회 성공 전까지 true (프록시/기본값 사용 중)
    private final Object fxRefreshLock = new Object(); // 만료 후 첫 갱신만 단일 스레드가 수행하도록 보호

    // 외부 FX API 호출용 (4초 타임아웃 — 느린 응답이 시세/스냅샷을 막지 않도록)
    private final RestTemplate fxClient = buildFxClient();
    private static RestTemplate buildFxClient() {
        SimpleClientHttpRequestFactory f = new SimpleClientHttpRequestFactory();
        f.setConnectTimeout(4000);
        f.setReadTimeout(4000);
        return new RestTemplate(f);
    }

    /** 마지막 반환 환율이 권위 FX(open.er-api)가 아닌(프록시/만료캐시/기본값) 값인지 여부. */
    public boolean isUsdKrwStale() {
        return usdKrwStale;
    }

    @SuppressWarnings("unchecked")
    private Double fetchRealFx() {
        Map<String, Object> resp = fxClient.getForObject("https://open.er-api.com/v6/latest/USD", Map.class);
        if (resp != null && "success".equals(resp.get("result")) && resp.get("rates") instanceof Map<?, ?> rates) {
            Object krw = rates.get("KRW");
            if (krw instanceof Number n && n.doubleValue() > 0) return n.doubleValue();
        }
        return null;
    }

    public double getUsdKrwRate() {
        long now = System.currentTimeMillis();
        if (cachedUsdKrw > 0 && now < usdKrwExpireAt) {
            return cachedUsdKrw;
        }
        // 만료 직후 동시 다발 요청이 외부 FX/프록시를 중복 호출하지 않도록 갱신 구간을 직렬화한다.
        // 락 안에서 캐시를 재확인(double-check)해, 먼저 갱신한 스레드의 결과를 나머지는 그대로 반환한다.
        synchronized (fxRefreshLock) {
            now = System.currentTimeMillis();
            if (cachedUsdKrw > 0 && now < usdKrwExpireAt) {
                return cachedUsdKrw;
            }
            return refreshUsdKrwRate(now);
        }
    }

    private double refreshUsdKrwRate(long now) {
        // 1) 권위 있는 실제 USD/KRW FX (open.er-api.com). FX는 느리게 변하므로 1시간 캐시.
        try {
            Double fx = fetchRealFx();
            if (fx != null && fx > 0) {
                cachedUsdKrw = fx;
                usdKrwExpireAt = now + 3_600_000;
                usdKrwStale = false;
                return fx;
            }
        } catch (Exception e) {
            log.warn("실 FX 환율 조회 실패, Upbit 프록시로 폴백: {}", e.getMessage());
        }
        // 2) Upbit KRW-USDT 프록시 (김프 포함 → 권위 FX 아님). 30초 캐시 + stale 표시.
        try {
            List<Map<String, Object>> ticker = upbitClient.getTicker("KRW-USDT");
            if (!ticker.isEmpty()) {
                double rate = Double.parseDouble(String.valueOf(ticker.get(0).get("trade_price")));
                cachedUsdKrw = rate;
                usdKrwExpireAt = now + 30_000;
                usdKrwStale = true;
                return rate;
            }
        } catch (Exception e) {
            log.warn("USD/KRW 프록시 조회 실패, 기본값 사용: {}", e.getMessage());
        }
        // 3) 직전 캐시(만료) 또는 고정 기본값
        usdKrwStale = true;
        if (cachedUsdKrw > 0) return cachedUsdKrw;
        return defaultUsdKrw;
    }

    public BigDecimal usdToKrw(BigDecimal usdAmount) {
        return usdAmount.multiply(BigDecimal.valueOf(getUsdKrwRate())).setScale(0, RoundingMode.HALF_UP);
    }

    public BigDecimal krwToUsd(BigDecimal krwAmount) {
        double rate = getUsdKrwRate();
        if (rate <= 0) rate = defaultUsdKrw;
        return krwAmount.divide(BigDecimal.valueOf(rate), 4, RoundingMode.HALF_UP);
    }
}
