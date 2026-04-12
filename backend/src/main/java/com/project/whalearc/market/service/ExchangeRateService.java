package com.project.whalearc.market.service;

import com.project.whalearc.virt.service.VirtUpbitClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;

/**
 * USD/KRW 환율 서비스.
 * Upbit의 KRW-USDT 티커를 프록시로 사용 (30초 캐시).
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

    public double getUsdKrwRate() {
        long now = System.currentTimeMillis();
        if (cachedUsdKrw > 0 && now < usdKrwExpireAt) {
            return cachedUsdKrw;
        }
        try {
            List<Map<String, Object>> ticker = upbitClient.getTicker("KRW-USDT");
            if (!ticker.isEmpty()) {
                double rate = Double.parseDouble(String.valueOf(ticker.get(0).get("trade_price")));
                cachedUsdKrw = rate;
                usdKrwExpireAt = now + 30_000;
                return rate;
            }
        } catch (Exception e) {
            log.warn("USD/KRW 환율 조회 실패, fallback 사용: {}", e.getMessage());
        }
        return cachedUsdKrw > 0 ? cachedUsdKrw : defaultUsdKrw;
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
