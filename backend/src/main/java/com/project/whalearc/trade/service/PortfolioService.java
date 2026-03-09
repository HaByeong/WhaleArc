package com.project.whalearc.trade.service;

import com.project.whalearc.market.dto.MarketPriceResponse;
import com.project.whalearc.market.service.CryptoPriceProvider;
import com.project.whalearc.market.service.KisApiClient;
import com.project.whalearc.market.service.StockPriceProvider;
import com.project.whalearc.trade.domain.Holding;
import com.project.whalearc.trade.domain.Portfolio;
import com.project.whalearc.trade.domain.PortfolioSnapshot;
import com.project.whalearc.trade.repository.PortfolioRepository;
import com.project.whalearc.trade.repository.PortfolioSnapshotRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class PortfolioService {

    private static final double INITIAL_CASH = 10_000_000; // 1000만원

    private final PortfolioRepository portfolioRepository;
    private final CryptoPriceProvider cryptoPriceProvider;
    private final StockPriceProvider stockPriceProvider;
    private final KisApiClient kisApiClient;
    private final PortfolioSnapshotRepository snapshotRepository;

    /**
     * 유저의 포트폴리오를 조회 (없으면 초기 자산 1000만원으로 생성)
     * 보유 종목의 currentPrice를 빗썸 실시간 가격으로 갱신
     */
    public Portfolio getOrCreatePortfolio(String userId) {
        Portfolio portfolio = portfolioRepository.findByUserId(userId)
                .orElseGet(() -> portfolioRepository.save(new Portfolio(userId, INITIAL_CASH)));

        updateHoldingPrices(portfolio);
        ensureTodaySnapshot(portfolio);
        return portfolio;
    }

    /**
     * 보유 종목의 현재가를 갱신 (코인: 빗썸, 주식: KIS API)
     */
    private void updateHoldingPrices(Portfolio portfolio) {
        if (portfolio.getHoldings().isEmpty()) return;

        try {
            // 코인 시세 맵
            Map<String, Double> cryptoPriceMap = Map.of();
            boolean hasCrypto = portfolio.getHoldings().stream().anyMatch(h -> !h.isStock());
            if (hasCrypto) {
                List<MarketPriceResponse> cryptoPrices = cryptoPriceProvider.getAllKrwTickers();
                if (!cryptoPrices.isEmpty()) {
                    cryptoPriceMap = cryptoPrices.stream()
                            .collect(Collectors.toMap(MarketPriceResponse::getSymbol, MarketPriceResponse::getPrice, (a, b) -> a));
                }
            }

            // 주식 시세 맵 (캐시된 인기종목)
            Map<String, Double> stockPriceMap = Map.of();
            boolean hasStock = portfolio.getHoldings().stream().anyMatch(Holding::isStock);
            if (hasStock) {
                List<MarketPriceResponse> stockPrices = stockPriceProvider.getAllStockPrices();
                if (!stockPrices.isEmpty()) {
                    stockPriceMap = stockPrices.stream()
                            .collect(Collectors.toMap(MarketPriceResponse::getSymbol, MarketPriceResponse::getPrice, (a, b) -> a));
                }
            }

            for (Holding holding : portfolio.getHoldings()) {
                if (holding.isStock()) {
                    Double price = stockPriceMap.get(holding.getStockCode());
                    if (price != null) {
                        holding.setCurrentPrice(price);
                    } else {
                        // 캐시에 없는 주식은 개별 조회
                        try {
                            Map<String, String> output = kisApiClient.getStockPrice(holding.getStockCode());
                            if (output != null) {
                                long p = Long.parseLong(output.get("stck_prpr"));
                                if (p > 0) holding.setCurrentPrice(p);
                            }
                        } catch (Exception e) {
                            log.debug("주식 시세 개별 조회 실패 [{}]: {}", holding.getStockCode(), e.getMessage());
                        }
                    }
                } else {
                    Double price = cryptoPriceMap.get(holding.getStockCode());
                    if (price != null) {
                        holding.setCurrentPrice(price);
                    }
                }
            }
        } catch (Exception e) {
            log.error("보유 종목 시세 갱신 실패: {}", e.getMessage());
        }
    }

    /**
     * 오늘 스냅샷이 없으면 생성
     */
    public void ensureTodaySnapshot(Portfolio portfolio) {
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));
        if (snapshotRepository.findByUserIdAndDate(portfolio.getUserId(), today).isEmpty()) {
            try {
                snapshotRepository.save(new PortfolioSnapshot(portfolio.getUserId(), today, portfolio));
            } catch (Exception e) {
                log.debug("스냅샷 저장 스킵 [{}]: {}", portfolio.getUserId(), e.getMessage());
            }
        }
    }

    public Portfolio save(Portfolio portfolio) {
        return portfolioRepository.save(portfolio);
    }
}
