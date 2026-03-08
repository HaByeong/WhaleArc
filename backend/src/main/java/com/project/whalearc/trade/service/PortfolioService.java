package com.project.whalearc.trade.service;

import com.project.whalearc.market.dto.MarketPriceResponse;
import com.project.whalearc.market.service.CryptoPriceProvider;
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
     * 보유 종목의 현재가를 빗썸 API 기준으로 갱신
     */
    private void updateHoldingPrices(Portfolio portfolio) {
        if (portfolio.getHoldings().isEmpty()) return;

        try {
            List<MarketPriceResponse> prices = cryptoPriceProvider.getAllKrwTickers();
            if (prices.isEmpty()) {
                log.warn("빗썸 시세 데이터가 비어있습니다. 기존 가격을 유지합니다.");
                return;
            }
            Map<String, Double> priceMap = prices.stream()
                    .collect(Collectors.toMap(MarketPriceResponse::getSymbol, MarketPriceResponse::getPrice, (a, b) -> a));

            for (Holding holding : portfolio.getHoldings()) {
                Double currentPrice = priceMap.get(holding.getStockCode());
                if (currentPrice != null) {
                    holding.setCurrentPrice(currentPrice);
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
