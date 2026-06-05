package com.project.whalearc.exchange.service.client;

import com.project.whalearc.exchange.dto.ExchangeHoldingDto;
import com.project.whalearc.exchange.dto.ExchangePortfolioDto;
import com.project.whalearc.exchange.dto.ExchangeTransactionDto;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 한국투자증권(KIS) Open API 클라이언트
 * API 문서: https://apiportal.koreainvestment.com
 */
@Component("exchangeKisApiClient")
@RequiredArgsConstructor
public class KisApiClient {

    private static final String BASE_URL = "https://openapi.koreainvestment.com:9443";
    private static final String TOKEN_PATH = "/oauth2/tokenP";
    private static final String BALANCE_PATH = "/uapi/domestic-stock/v1/trading/inquire-balance";
    private static final String CCLD_PATH = "/uapi/domestic-stock/v1/trading/inquire-daily-ccld";

    private final RestTemplate restTemplate = new RestTemplate();

    // KIS 접근토큰은 발급이 1분당 1회로 제한(초과 시 EGW00133)되고 유효기간이 24h다.
    // appkey별로 캐싱해 재사용한다(매 조회마다 새로 발급하던 EGW00133 버그 수정).
    private final Map<String, CachedToken> tokenCache = new ConcurrentHashMap<>();

    private record CachedToken(String token, long expiresAtMillis) {}

    public ExchangePortfolioDto getPortfolio(String appKey, String appSecret,
                                              String secretKey, String accountNumber) {
        try {
            // 1. OAuth 토큰 발급
            String accessToken = getAccessToken(appKey, appSecret);
            if (accessToken == null) {
                return new ExchangePortfolioDto("KIS", true, 0, 0, 0, 0, new ArrayList<>());
            }

            // 2. 주식잔고 조회
            return fetchBalance(accessToken, appKey, appSecret, accountNumber);
        } catch (Exception e) {
            System.err.println("KIS API 호출 실패: " + e.getMessage());
            return new ExchangePortfolioDto("KIS", true, 0, 0, 0, 0, new ArrayList<>());
        }
    }

    private String getAccessToken(String appKey, String appSecret) {
        CachedToken cached = tokenCache.get(appKey);
        if (cached != null && System.currentTimeMillis() < cached.expiresAtMillis()) {
            return cached.token();
        }
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            Map<String, String> body = new HashMap<>();
            body.put("grant_type", "client_credentials");
            body.put("appkey", appKey);
            body.put("appsecret", appSecret);

            HttpEntity<Map<String, String>> request = new HttpEntity<>(body, headers);
            ResponseEntity<Map> response = restTemplate.exchange(
                    BASE_URL + TOKEN_PATH, HttpMethod.POST, request, Map.class);

            if (response.getBody() != null) {
                Object tok = response.getBody().get("access_token");
                if (tok == null) {
                    System.err.println("[KIS 토큰] access_token 없음 — 응답: " + response.getBody());
                    return null;
                }
                String token = (String) tok;
                long ttl = 23L * 3600 * 1000;   // 기본 23h (유효 24h - 여유)
                Object exp = response.getBody().get("expires_in");
                if (exp != null) {
                    try { ttl = (long) (Double.parseDouble(String.valueOf(exp)) * 1000) - 60_000; }
                    catch (NumberFormatException ignore) { /* 기본 사용 */ }
                }
                tokenCache.put(appKey, new CachedToken(token, System.currentTimeMillis() + ttl));
                return token;
            }
        } catch (Exception e) {
            System.err.println("KIS 토큰 발급 실패: " + e.getMessage());
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    private ExchangePortfolioDto fetchBalance(String accessToken, String appKey,
                                               String appSecret, String accountNumber) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("authorization", "Bearer " + accessToken);
        headers.set("appkey", appKey);
        headers.set("appsecret", appSecret);
        headers.set("tr_id", "TTTC8434R"); // 주식잔고조회

        // 계좌번호 분리 (예: "50123456-01" → CANO=50123456, ACNT_PRDT_CD=01)
        String cano = accountNumber;
        String acntPrdtCd = "01";
        if (accountNumber != null && accountNumber.contains("-")) {
            String[] parts = accountNumber.split("-");
            cano = parts[0];
            acntPrdtCd = parts[1];
        }

        String url = BASE_URL + BALANCE_PATH
                + "?CANO=" + cano
                + "&ACNT_PRDT_CD=" + acntPrdtCd
                + "&AFHR_FLPR_YN=N"
                + "&OFL_YN="
                + "&INQR_DVSN=02"
                + "&UNPR_DVSN=01"
                + "&FUND_STTL_ICLD_YN=N"
                + "&FNCG_AMT_AUTO_RDPT_YN=N"
                + "&PRCS_DVSN=01"
                + "&CTX_AREA_FK100="
                + "&CTX_AREA_NK100=";

        HttpEntity<Void> request = new HttpEntity<>(headers);
        ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, request, Map.class);

        // 진단: KIS가 rt_cd!=0(에러)을 줘도 아래에서 조용히 0원 처리되므로, 비정상 응답을 로그로 남긴다.
        if (response.getBody() != null && !"0".equals(String.valueOf(response.getBody().get("rt_cd")))) {
            System.err.println("[KIS 잔고조회] 비정상 rt_cd=" + response.getBody().get("rt_cd")
                    + " msg=" + response.getBody().get("msg1") + " (CANO=" + cano + "-" + acntPrdtCd + ")");
        }

        List<ExchangeHoldingDto> holdings = new ArrayList<>();
        double totalValue = 0;
        double totalProfitLoss = 0;
        double cashBalance = 0;

        if (response.getBody() != null) {
            // 보유종목 파싱
            List<Map<String, Object>> output1 = (List<Map<String, Object>>) response.getBody().get("output1");
            if (output1 != null) {
                for (Map<String, Object> item : output1) {
                    String stockCode = (String) item.get("pdno");
                    String stockName = (String) item.get("prdt_name");
                    double qty = parseDouble(item.get("hldg_qty"));
                    double avgPrice = parseDouble(item.get("pchs_avg_pric"));
                    double curPrice = parseDouble(item.get("prpr"));
                    double evalAmt = parseDouble(item.get("evlu_amt"));
                    double pl = parseDouble(item.get("evlu_pfls_amt"));
                    double plRate = parseDouble(item.get("evlu_pfls_rt"));

                    if (qty > 0) {
                        holdings.add(new ExchangeHoldingDto(
                                stockCode, stockName, qty, avgPrice, curPrice, evalAmt, pl, plRate));
                        totalValue += evalAmt;
                        totalProfitLoss += pl;
                    }
                }
            }

            // 예수금 파싱
            List<Map<String, Object>> output2 = (List<Map<String, Object>>) response.getBody().get("output2");
            if (output2 != null && !output2.isEmpty()) {
                cashBalance = parseDouble(output2.get(0).get("dnca_tot_amt"));
                totalValue += cashBalance;
            }
        }

        double totalReturnRate = (totalValue - cashBalance) > 0 && totalProfitLoss != 0
                ? (totalProfitLoss / (totalValue - cashBalance - totalProfitLoss)) * 100 : 0;

        return new ExchangePortfolioDto("KIS", true, totalValue, totalProfitLoss, totalReturnRate, cashBalance, holdings);
    }

    /* ───── 체결 내역 조회 (주식일별주문체결, TTTC8001R) ───── */
    @SuppressWarnings("unchecked")
    public List<ExchangeTransactionDto> getTransactions(String appKey, String appSecret,
                                                        String accountNumber, int days) {
        List<ExchangeTransactionDto> txns = new ArrayList<>();
        try {
            String accessToken = getAccessToken(appKey, appSecret);
            if (accessToken == null) return txns;

            // 계좌번호 분리 (예: "50123456-01" → CANO=50123456, ACNT_PRDT_CD=01)
            String cano = accountNumber;
            String acntPrdtCd = "01";
            if (accountNumber != null && accountNumber.contains("-")) {
                String[] parts = accountNumber.split("-");
                cano = parts[0];
                acntPrdtCd = parts[1];
            }

            DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyyMMdd");
            String endDate = LocalDate.now().format(fmt);
            String startDate = LocalDate.now().minusDays(Math.max(1, days)).format(fmt);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("authorization", "Bearer " + accessToken);
            headers.set("appkey", appKey);
            headers.set("appsecret", appSecret);
            headers.set("tr_id", "TTTC8001R"); // 주식일별주문체결조회

            String url = BASE_URL + CCLD_PATH
                    + "?CANO=" + cano
                    + "&ACNT_PRDT_CD=" + acntPrdtCd
                    + "&INQR_STRT_DT=" + startDate
                    + "&INQR_END_DT=" + endDate
                    + "&SLL_BUY_DVSN_CD=00"
                    + "&INQR_DVSN=00"
                    + "&PDNO="
                    + "&CCLD_DVSN=00"
                    + "&ORD_GNO_BRNO="
                    + "&ODNO="
                    + "&INQR_DVSN_3=00"
                    + "&INQR_DVSN_1="
                    + "&CTX_AREA_FK100="
                    + "&CTX_AREA_NK100=";

            HttpEntity<Void> request = new HttpEntity<>(headers);
            ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, request, Map.class);

            if (response.getBody() != null) {
                List<Map<String, Object>> output1 = (List<Map<String, Object>>) response.getBody().get("output1");
                if (output1 != null) {
                    for (Map<String, Object> item : output1) {
                        double qty = parseDouble(item.get("tot_ccld_qty"));
                        txns.add(ExchangeTransactionDto.builder()
                                .orderId(str(item.get("odno")))
                                .stockCode(str(item.get("pdno")))
                                .stockName(str(item.get("prdt_name")))
                                .side("02".equals(String.valueOf(item.get("sll_buy_dvsn_cd"))) ? "BUY" : "SELL")
                                .quantity(qty)
                                .price(parseDouble(item.get("avg_prvs")))
                                .totalAmount(parseDouble(item.get("tot_ccld_amt")))
                                .executedAt((str(item.get("ord_dt")) + " " + str(item.get("ord_tmd"))).trim())
                                .status(qty > 0 ? "FILLED" : "PENDING")
                                .build());
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("KIS 체결내역 조회 실패: " + e.getMessage());
        }
        return txns;
    }

    private String str(Object value) {
        return value == null ? "" : value.toString();
    }

    private double parseDouble(Object value) {
        if (value == null) return 0;
        try {
            return Double.parseDouble(value.toString());
        } catch (NumberFormatException e) {
            return 0;
        }
    }
}
