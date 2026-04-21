package com.project.whalearc.trade.service;

import com.project.whalearc.trade.domain.Holding;
import com.project.whalearc.trade.domain.Portfolio;
import com.project.whalearc.trade.domain.TradeRecord;
import com.project.whalearc.trade.repository.TradeRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.NumberFormat;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class CsvExportService {

    private final TradeRecordRepository tradeRecordRepository;
    private final PortfolioService portfolioService;

    private static final String BOM = "\uFEFF";
    private static final DateTimeFormatter KST_FMT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss").withZone(ZoneId.of("Asia/Seoul"));

    private NumberFormat numFmt() {
        return NumberFormat.getInstance(Locale.KOREA);
    }

    /**
     * 거래 내역 CSV
     */
    public String generateTradesCsv(String userId) {
        List<TradeRecord> trades = tradeRecordRepository.findByUserIdOrderByExecutedAtDesc(userId);

        StringBuilder sb = new StringBuilder(BOM);
        sb.append("체결일시,종목코드,종목명,자산유형,매매구분,수량,체결가,체결금액,수수료,정산금액\n");

        for (TradeRecord t : trades) {
            sb.append(KST_FMT.format(t.getExecutedAt())).append(',');
            sb.append(t.getStockCode()).append(',');
            sb.append(csvEscape(t.getStockName())).append(',');
            sb.append(assetTypeLabel(t.getAssetType())).append(',');
            sb.append(t.getOrderType().name().equals("BUY") ? "매수" : "매도").append(',');
            sb.append(formatQty(t.getQuantity(), t.getAssetType())).append(',');
            sb.append(csvEscape(numFmt().format(roundBd(t.getPrice())))).append(',');
            sb.append(csvEscape(numFmt().format(roundBd(t.getTotalAmount())))).append(',');
            sb.append(csvEscape(numFmt().format(roundBd(t.getCommission())))).append(',');
            sb.append(csvEscape(numFmt().format(roundBd(t.getNetAmount())))).append('\n');
        }

        return sb.toString();
    }

    /**
     * 포트폴리오 리포트 CSV
     */
    public String generatePortfolioReportCsv(String userId) {
        Portfolio portfolio = portfolioService.getOrCreatePortfolio(userId);

        BigDecimal initialCash = portfolio.getInitialCash().compareTo(BigDecimal.ZERO) > 0
                ? portfolio.getInitialCash() : BigDecimal.valueOf(10_000_000);
        double totalValue = portfolio.getTotalValue().doubleValue();
        double totalPnl = totalValue - initialCash.doubleValue();
        double returnRate = portfolio.getReturnRate().doubleValue();
        double turtleAllocated = portfolio.getTurtleAllocated().doubleValue();
        double holdingsValue = portfolio.getHoldings().stream()
                .mapToDouble(h -> h.getMarketValue().doubleValue()).sum();

        StringBuilder sb = new StringBuilder(BOM);

        // 섹션 1: 포트폴리오 요약
        sb.append("[포트폴리오 요약]\n");
        sb.append("항목,금액\n");
        sb.append("총 자산,").append(csvEscape(numFmt().format(Math.round(totalValue)))).append('\n');
        sb.append("현금,").append(csvEscape(numFmt().format(roundBd(portfolio.getCashBalance())))).append('\n');
        sb.append("보유종목 평가,").append(csvEscape(numFmt().format(Math.round(holdingsValue)))).append('\n');
        if (turtleAllocated > 0) {
            sb.append("터틀 전략 배정,").append(csvEscape(numFmt().format(Math.round(turtleAllocated)))).append('\n');
        }
        sb.append("초기 자본,").append(csvEscape(numFmt().format(roundBd(initialCash)))).append('\n');
        sb.append("총 손익,").append(csvEscape(signedNum(totalPnl))).append('\n');
        sb.append("수익률(%),").append(signedPct(returnRate)).append('\n');

        sb.append('\n');

        // 섹션 2: 보유 종목
        sb.append("[보유 종목]\n");
        sb.append("종목코드,종목명,자산유형,수량,평균매수가,현재가,평가금액,평가손익,수익률(%)\n");

        for (Holding h : portfolio.getHoldings()) {
            String assetType = h.getAssetType();
            sb.append(h.getStockCode()).append(',');
            sb.append(csvEscape(h.getStockName())).append(',');
            sb.append(assetTypeLabel(assetType)).append(',');
            sb.append(formatQty(h.getQuantity(), assetType)).append(',');
            sb.append(csvEscape(numFmt().format(roundBd(h.getAveragePrice())))).append(',');
            sb.append(csvEscape(numFmt().format(roundBd(h.getCurrentPrice())))).append(',');
            sb.append(csvEscape(numFmt().format(roundBd(h.getMarketValue())))).append(',');
            sb.append(csvEscape(signedNum(h.getProfitLoss().doubleValue()))).append(',');
            sb.append(signedPct(h.getReturnRate().doubleValue())).append('\n');
        }

        return sb.toString();
    }

    private String csvEscape(String value) {
        if (value == null) return "";
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }

    private String formatQty(BigDecimal qty, String assetType) {
        if ("STOCK".equals(assetType) || "US_STOCK".equals(assetType) || "ETF".equals(assetType)) {
            return String.valueOf(qty.intValue());
        }
        // 가상화폐(및 null): 소수점 이하 불필요한 0 제거
        return qty.stripTrailingZeros().toPlainString();
    }

    private String assetTypeLabel(String assetType) {
        if ("STOCK".equals(assetType)) return "주식";
        if ("US_STOCK".equals(assetType)) return "미국주식";
        if ("ETF".equals(assetType)) return "ETF";
        return "가상화폐";
    }

    private long roundBd(BigDecimal value) {
        return value.setScale(0, RoundingMode.HALF_UP).longValue();
    }

    private String signedNum(double value) {
        String formatted = numFmt().format(Math.round(value));
        return value > 0 ? "+" + formatted : formatted;
    }

    private String signedPct(double value) {
        String formatted = String.format("%.2f", value);
        return value > 0 ? "+" + formatted : formatted;
    }
}
