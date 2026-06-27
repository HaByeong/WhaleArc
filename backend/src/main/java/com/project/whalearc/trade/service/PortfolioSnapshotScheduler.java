package com.project.whalearc.trade.service;

import com.project.whalearc.market.dto.MarketPriceResponse;
import com.project.whalearc.market.service.*;
import com.project.whalearc.trade.domain.Holding;
import com.project.whalearc.trade.domain.Portfolio;
import com.project.whalearc.trade.domain.PortfolioSnapshot;
import com.project.whalearc.trade.repository.PortfolioRepository;
import com.project.whalearc.trade.repository.PortfolioSnapshotRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Component
@RequiredArgsConstructor
public class PortfolioSnapshotScheduler {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final PortfolioRepository portfolioRepository;
    private final PortfolioSnapshotRepository snapshotRepository;
    private final UserLockRegistry userLockRegistry;
    private final CryptoPriceProvider cryptoPriceProvider;
    private final StockPriceProvider stockPriceProvider;
    private final UsStockPriceProvider usStockPriceProvider;
    private final UsEtfPriceProvider usEtfPriceProvider;
    private final ExchangeRateService exchangeRateService;

    /**
     * 매일 자정(KST)에 모든 포트폴리오의 스냅샷 저장
     * 가격은 1회만 조회하여 모든 포트폴리오에 적용
     */
    @Scheduled(cron = "0 0 0 * * *", zone = "Asia/Seoul")
    public void captureDaily() {
        LocalDate today = LocalDate.now(KST);
        List<Portfolio> all = portfolioRepository.findAll();

        // 시세 1회 조회 (가상화폐 + 주식 + 미국주식 + 미국 ETF)
        Map<String, Double> cryptoPriceMap = Map.of();
        Map<String, Double> stockPriceMap = Map.of();
        Map<String, Double> usStockPriceMap = Map.of();
        Map<String, Double> etfPriceMap = Map.of();
        double usdKrwRate = exchangeRateService.getUsdKrwRate();
        try {
            List<MarketPriceResponse> cryptoPrices = cryptoPriceProvider.getAllKrwTickers();
            cryptoPriceMap = cryptoPrices.stream()
                    .collect(Collectors.toMap(
                            MarketPriceResponse::getSymbol,
                            MarketPriceResponse::getPrice,
                            (a, b) -> a));
        } catch (Exception e) {
            log.warn("스냅샷용 가상화폐 시세 조회 실패: {}", e.getMessage());
        }
        try {
            List<MarketPriceResponse> stockPrices = stockPriceProvider.getAllStockPrices();
            stockPriceMap = stockPrices.stream()
                    .collect(Collectors.toMap(
                            MarketPriceResponse::getSymbol,
                            MarketPriceResponse::getPrice,
                            (a, b) -> a));
        } catch (Exception e) {
            log.warn("스냅샷용 주식 시세 조회 실패: {}", e.getMessage());
        }
        try {
            List<MarketPriceResponse> usPrices = usStockPriceProvider.getAllUsStockPrices();
            usStockPriceMap = usPrices.stream()
                    .collect(Collectors.toMap(
                            MarketPriceResponse::getSymbol,
                            MarketPriceResponse::getPrice,
                            (a, b) -> a));
        } catch (Exception e) {
            log.warn("스냅샷용 미국주식 시세 조회 실패: {}", e.getMessage());
        }
        try {
            List<MarketPriceResponse> etfPrices = usEtfPriceProvider.getAllEtfPrices();
            etfPriceMap = etfPrices.stream()
                    .collect(Collectors.toMap(
                            MarketPriceResponse::getSymbol,
                            MarketPriceResponse::getPrice,
                            (a, b) -> a));
        } catch (Exception e) {
            log.warn("스냅샷용 미국 ETF 시세 조회 실패: {}", e.getMessage());
        }

        // 람다 캡처용 final 사본 (위 맵들은 try 안에서 재할당되므로 effectively-final 아님)
        final Map<String, Double> cryptoMap = cryptoPriceMap;
        final Map<String, Double> stockMap = stockPriceMap;
        final Map<String, Double> usMap = usStockPriceMap;
        final Map<String, Double> etfMap = etfPriceMap;

        int saved = 0;
        for (Portfolio portfolio : all) {
            try {
                // 요청 경로(ensureTodaySnapshot, getOrCreatePortfolio 락 안)와 같은 유저 락으로 직렬화해
                // "조회→없으면 저장" 경합으로 인한 중복 스냅샷을 방지(먼저 저장한 쪽만 1건 생성).
                boolean didSave = userLockRegistry.withLock(portfolio.getUserId(), () -> {
                    if (snapshotRepository.findByUserIdAndDate(portfolio.getUserId(), today).isPresent()) {
                        return false;
                    }
                    for (Holding holding : portfolio.getHoldings()) {
                        Map<String, Double> priceMap = holding.isUsStock() ? usMap
                                : holding.isEtf() ? etfMap
                                : holding.isStock() ? stockMap : cryptoMap;
                        Double price = priceMap.get(holding.getStockCode());
                        if (price != null) {
                            holding.setCurrentPrice(BigDecimal.valueOf(price));
                        }
                    }
                    snapshotRepository.save(new PortfolioSnapshot(portfolio.getUserId(), today, portfolio, usdKrwRate));
                    return true;
                });
                if (didSave) saved++;
            } catch (Exception e) {
                log.debug("스냅샷 저장 스킵 [{}]: {}", portfolio.getUserId(), e.getMessage());
            }
        }

        log.info("일별 포트폴리오 스냅샷 완료: {}건 / 전체 {}건", saved, all.size());
    }
}
