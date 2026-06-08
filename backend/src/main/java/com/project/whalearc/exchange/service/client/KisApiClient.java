package com.project.whalearc.exchange.service.client;

import com.project.whalearc.exchange.dto.ExchangeHoldingDto;
import com.project.whalearc.exchange.dto.ExchangePortfolioDto;
import com.project.whalearc.exchange.dto.ExchangeTransactionDto;
import com.project.whalearc.market.service.ExchangeRateService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 한국투자증권(KIS) Open API 클라이언트 (실계좌 잔고/체결 조회)
 * API 문서: https://apiportal.koreainvestment.com
 *
 * <p>국내주식(원화) + 해외주식(미국, 달러)을 모두 조회한다. 해외분은 USD 네이티브로 보유종목에 담고
 * (currency="USD"), 포트폴리오 합계(총평가/손익/수익률)는 USD→KRW 환산해 원화로 통일한다.
 * 해외 조회는 best-effort: 실패해도 국내분은 그대로 반환(graceful). ⚠ 해외 잔고 응답 필드/거래소코드는
 * 실계좌(미국주식 보유)로 라이브 검증 필요 — 실패 시 rt_cd/msg 로그로 진단.
 */
@Slf4j
@Component("exchangeKisApiClient")
@RequiredArgsConstructor
public class KisApiClient {

    private static final String BASE_URL = "https://openapi.koreainvestment.com:9443";
    private static final String TOKEN_PATH = "/oauth2/tokenP";
    private static final String BALANCE_PATH = "/uapi/domestic-stock/v1/trading/inquire-balance";
    private static final String OVRS_BALANCE_PATH = "/uapi/overseas-stock/v1/trading/inquire-balance";
    private static final String CCLD_PATH = "/uapi/domestic-stock/v1/trading/inquire-daily-ccld";

    // 미국 거래소코드(해외잔고는 거래소별 조회) — 나스닥/뉴욕/아멕스
    private static final String[] US_EXCHANGES = {"NASD", "NYSE", "AMEX"};
    private static final int MAX_PAGES = 10;   // 페이지네이션 상한(무한루프 방지)

    private final ExchangeRateService exchangeRateService;
    private final RestTemplate restTemplate = buildRestTemplate();

    private static RestTemplate buildRestTemplate() {
        // KIS 지연 시 무한 블로킹 방지 — 연결 5s / 응답 10s 타임아웃
        SimpleClientHttpRequestFactory f = new SimpleClientHttpRequestFactory();
        f.setConnectTimeout(5000);
        f.setReadTimeout(10000);
        return new RestTemplate(f);
    }

    // KIS 접근토큰은 발급이 1분당 1회로 제한(초과 시 EGW00133)되고 유효기간이 24h다.
    // appkey별로 캐싱해 재사용한다(매 조회마다 새로 발급하던 EGW00133 버그 수정).
    private final Map<String, CachedToken> tokenCache = new ConcurrentHashMap<>();

    private record CachedToken(String token, long expiresAtMillis) {}

    // 잔고 짧은 캐시(폴링/동시요청 디듀프)는 ExchangeAccountService 계층에서 (userId,exchangeType)로
    // 일원화(KIS/Upbit/Bitget 공통). 여기서는 토큰만 캐시한다.
    public ExchangePortfolioDto getPortfolio(String appKey, String appSecret,
                                              String secretKey, String accountNumber) {
        try {
            String accessToken = getAccessToken(appKey, appSecret);
            if (accessToken == null) {
                return new ExchangePortfolioDto("KIS", true, 0, 0, 0, 0, new ArrayList<>());
            }
            return fetchBalance(accessToken, appKey, appSecret, accountNumber);
        } catch (Exception e) {
            log.warn("KIS API 호출 실패: {}", e.getMessage());
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
                    log.warn("[KIS 토큰] access_token 없음 — 응답: {}", response.getBody());
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
            log.warn("KIS 토큰 발급 실패: {}", e.getMessage());
        }
        return null;
    }

    private ExchangePortfolioDto fetchBalance(String accessToken, String appKey,
                                               String appSecret, String accountNumber) {
        String cano = cano(accountNumber);
        String acntPrdtCd = acntPrdtCd(accountNumber);

        // 1) 국내주식(원화)
        List<ExchangeHoldingDto> holdings = new ArrayList<>();
        double evalKrw = 0;          // 보유 평가금 합(KRW)
        double plKrw = 0;            // 손익 합(KRW)
        double cashKrw = fetchDomestic(accessToken, appKey, appSecret, cano, acntPrdtCd, holdings);
        for (ExchangeHoldingDto h : holdings) { evalKrw += h.getMarketValue(); plKrw += h.getProfitLoss(); }

        // 2) 해외주식(미국, USD) — best-effort. 실패해도 국내분은 유지.
        double usdKrw = exchangeRateService.getUsdKrwRate();
        if (usdKrw <= 0) usdKrw = 1400;
        List<ExchangeHoldingDto> overseas = new ArrayList<>();
        try {
            fetchOverseas(accessToken, appKey, appSecret, cano, acntPrdtCd, overseas);
        } catch (Exception e) {
            log.warn("[KIS 해외잔고] 조회 실패(국내분만 반환): {}", e.getMessage());
        }
        for (ExchangeHoldingDto h : overseas) {
            holdings.add(h);                          // USD 네이티브 값 그대로(표시용)
            evalKrw += h.getMarketValue() * usdKrw;   // 합계는 원화 환산
            plKrw += h.getProfitLoss() * usdKrw;
        }

        // 해외 외화예수금(달러 현금)도 KRW로 환산해 예수금에 포함 (fetchOverseas는 보유종목만 읽음)
        double[] foreignCash = fetchOverseasCash(accessToken, appKey, appSecret, cano, acntPrdtCd);
        cashKrw += foreignCash[0];

        double totalValue = evalKrw + cashKrw;
        double costBasis = evalKrw - plKrw;
        double totalReturnRate = costBasis > 0 ? (plKrw / costBasis) * 100 : 0;
        ExchangePortfolioDto dto = new ExchangePortfolioDto("KIS", true, totalValue, plKrw, totalReturnRate, cashKrw, holdings);
        dto.setUsdtKrwRate(usdKrw);              // 해외 환산에 쓴 USD/KRW (프론트 참고용)
        dto.setForeignCashKrw(foreignCash[0]);   // 외화예수금 분리 표시용
        dto.setForeignCashUsd(foreignCash[1]);
        return dto;
    }

    /** 국내주식 잔고(원화). 보유종목을 holdings에 누적하고 예수금(KRW)을 반환. 페이지네이션 처리. */
    @SuppressWarnings("unchecked")
    private double fetchDomestic(String accessToken, String appKey, String appSecret,
                                 String cano, String acntPrdtCd, List<ExchangeHoldingDto> holdings) {
        double cash = 0;
        String fk = "", nk = "", trCont = "";
        for (int page = 0; page < MAX_PAGES; page++) {
            HttpHeaders headers = baseHeaders(accessToken, appKey, appSecret, "TTTC8434R");
            if (!trCont.isEmpty()) headers.set("tr_cont", trCont);

            String url = BASE_URL + BALANCE_PATH
                    + "?CANO=" + cano + "&ACNT_PRDT_CD=" + acntPrdtCd
                    + "&AFHR_FLPR_YN=N&OFL_YN=&INQR_DVSN=02&UNPR_DVSN=01"
                    + "&FUND_STTL_ICLD_YN=N&FNCG_AMT_AUTO_RDPT_YN=N&PRCS_DVSN=01"
                    + "&CTX_AREA_FK100=" + fk + "&CTX_AREA_NK100=" + nk;

            ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, new HttpEntity<>(headers), Map.class);
            Map<String, Object> b = response.getBody();
            if (b == null) break;
            if (!"0".equals(String.valueOf(b.get("rt_cd")))) {
                log.warn("[KIS 국내잔고] 비정상 rt_cd={} msg={} (CANO={}-{})", b.get("rt_cd"), b.get("msg1"), cano, acntPrdtCd);
                break;
            }

            List<Map<String, Object>> output1 = (List<Map<String, Object>>) b.get("output1");
            if (output1 != null) {
                for (Map<String, Object> item : output1) {
                    double qty = parseDouble(item.get("hldg_qty"));
                    if (qty <= 0) continue;
                    holdings.add(new ExchangeHoldingDto(
                            (String) item.get("pdno"), (String) item.get("prdt_name"), qty,
                            parseDouble(item.get("pchs_avg_pric")), parseDouble(item.get("prpr")),
                            parseDouble(item.get("evlu_amt")), parseDouble(item.get("evlu_pfls_amt")),
                            parseDouble(item.get("evlu_pfls_rt")), "KRW"));
                }
            }
            // 예수금은 계좌 단위라 첫 페이지 값만 취함
            if (page == 0) {
                List<Map<String, Object>> output2 = (List<Map<String, Object>>) b.get("output2");
                if (output2 != null && !output2.isEmpty()) cash = parseDouble(output2.get(0).get("dnca_tot_amt"));
            }

            // 다음 페이지 여부(tr_cont F/M = 연속) + 연속조회 키
            String respTrCont = response.getHeaders().getFirst("tr_cont");
            if (!"F".equals(respTrCont) && !"M".equals(respTrCont)) break;
            fk = str(b.get("ctx_area_fk100")).trim();
            nk = str(b.get("ctx_area_nk100")).trim();
            trCont = "N";
        }
        return cash;
    }

    /** 해외주식 잔고(미국, USD). best-effort — 거래소별(NASD/NYSE/AMEX) 조회해 holdings에 USD 네이티브로 누적. */
    @SuppressWarnings("unchecked")
    private void fetchOverseas(String accessToken, String appKey, String appSecret,
                               String cano, String acntPrdtCd, List<ExchangeHoldingDto> holdings) {
        for (String excg : US_EXCHANGES) {
            try {
                HttpHeaders headers = baseHeaders(accessToken, appKey, appSecret, "TTTS3012R");
                String url = BASE_URL + OVRS_BALANCE_PATH
                        + "?CANO=" + cano + "&ACNT_PRDT_CD=" + acntPrdtCd
                        + "&OVRS_EXCG_CD=" + excg + "&TR_CRCY_CD=USD"
                        + "&CTX_AREA_FK200=&CTX_AREA_NK200=";
                ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, new HttpEntity<>(headers), Map.class);
                Map<String, Object> b = response.getBody();
                if (b == null) continue;
                if (!"0".equals(String.valueOf(b.get("rt_cd")))) {
                    log.warn("[KIS 해외잔고:{}] 비정상 rt_cd={} msg={}", excg, b.get("rt_cd"), b.get("msg1"));
                    continue;
                }
                List<Map<String, Object>> output1 = (List<Map<String, Object>>) b.get("output1");
                if (output1 == null) continue;
                for (Map<String, Object> item : output1) {
                    double qty = parseDouble(item.get("ovrs_cblc_qty"));
                    if (qty <= 0) continue;
                    holdings.add(new ExchangeHoldingDto(
                            str(item.get("ovrs_pdno")), str(item.get("ovrs_item_name")), qty,
                            parseDouble(item.get("pchs_avg_pric")), parseDouble(item.get("now_pric2")),
                            parseDouble(item.get("ovrs_stck_evlu_amt")), parseDouble(item.get("frcr_evlu_pfls_amt")),
                            parseDouble(item.get("evlu_pfls_rt")), "USD"));
                }
            } catch (Exception e) {
                log.warn("[KIS 해외잔고:{}] 조회 예외: {}", excg, e.getMessage());
            }
        }
    }

    /**
     * 해외 외화예수금(달러 현금)을 KRW로 환산해 반환. 해외주식 체결기준현재잔고(CTRP6504R)의 output2를 사용한다.
     * (fetchOverseas는 보유종목 output1만 읽어 외화 현금이 누락되므로 별도 조회.) best-effort — 실패 시 0.
     */
    /** @return double[]{ KRW환산합계, USD원금합계 } */
    @SuppressWarnings("unchecked")
    private double[] fetchOverseasCash(String accessToken, String appKey, String appSecret,
                                       String cano, String acntPrdtCd) {
        try {
            HttpHeaders headers = baseHeaders(accessToken, appKey, appSecret, "CTRP6504R");
            String url = BASE_URL + "/uapi/overseas-stock/v1/trading/inquire-present-balance"
                    + "?CANO=" + cano + "&ACNT_PRDT_CD=" + acntPrdtCd
                    + "&WCRC_FRCR_DVSN_CD=02&NATN_CD=000&TR_MKET_CD=00&INQR_DVSN_CD=00";
            ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, new HttpEntity<>(headers), Map.class);
            Map<String, Object> b = response.getBody();
            if (b == null) return new double[]{0, 0};
            if (!"0".equals(String.valueOf(b.get("rt_cd")))) {
                log.warn("[KIS 외화예수금] 비정상 rt_cd={} msg={}", b.get("rt_cd"), b.get("msg1"));
                return new double[]{0, 0};
            }
            List<Map<String, Object>> output2 = (List<Map<String, Object>>) b.get("output2");
            if (output2 == null) return new double[]{0, 0};
            double krw = 0, usd = 0;
            for (Map<String, Object> item : output2) {
                double frcrCash = parseDouble(item.get("frcr_dncl_amt_2"));   // 외화예수금
                if (frcrCash == 0) continue;
                double rate = parseDouble(item.get("frst_bltn_exrt"));        // 최초고시환율
                if (rate <= 0) rate = 1.0;
                krw += frcrCash * rate;
                // 통화코드 미제공 시 해외 주력 통화 USD로 간주
                String ccy = str(item.get("crcy_cd"));
                if (ccy == null || ccy.isBlank() || "USD".equalsIgnoreCase(ccy)) usd += frcrCash;
            }
            return new double[]{krw, usd};
        } catch (Exception e) {
            log.warn("[KIS 외화예수금] 조회 예외: {}", e.getMessage());
            return new double[]{0, 0};
        }
    }

    /* ───── 체결 내역 조회 (주식일별주문체결, TTTC8001R) ───── */
    @SuppressWarnings("unchecked")
    public List<ExchangeTransactionDto> getTransactions(String appKey, String appSecret,
                                                        String accountNumber, int days) {
        List<ExchangeTransactionDto> txns = new ArrayList<>();
        try {
            String accessToken = getAccessToken(appKey, appSecret);
            if (accessToken == null) return txns;

            String cano = cano(accountNumber);
            String acntPrdtCd = acntPrdtCd(accountNumber);

            DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyyMMdd");
            String endDate = LocalDate.now().format(fmt);
            String startDate = LocalDate.now().minusDays(Math.max(1, days)).format(fmt);

            HttpHeaders headers = baseHeaders(accessToken, appKey, appSecret, "TTTC8001R");
            String url = BASE_URL + CCLD_PATH
                    + "?CANO=" + cano + "&ACNT_PRDT_CD=" + acntPrdtCd
                    + "&INQR_STRT_DT=" + startDate + "&INQR_END_DT=" + endDate
                    + "&SLL_BUY_DVSN_CD=00&INQR_DVSN=00&PDNO=&CCLD_DVSN=00&ORD_GNO_BRNO=&ODNO="
                    + "&INQR_DVSN_3=00&INQR_DVSN_1=&CTX_AREA_FK100=&CTX_AREA_NK100=";

            ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, new HttpEntity<>(headers), Map.class);
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
            log.warn("KIS 체결내역 조회 실패: {}", e.getMessage());
        }
        return txns;
    }

    // ───── 헬퍼 ─────

    private HttpHeaders baseHeaders(String accessToken, String appKey, String appSecret, String trId) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("authorization", "Bearer " + accessToken);
        headers.set("appkey", appKey);
        headers.set("appsecret", appSecret);
        headers.set("tr_id", trId);
        return headers;
    }

    /** 계좌번호 "50123456-01" → CANO=50123456 (하이픈 없으면 그대로). */
    private String cano(String accountNumber) {
        if (accountNumber != null && accountNumber.contains("-")) return accountNumber.split("-")[0];
        return accountNumber;
    }

    /** 계좌번호 "50123456-01" → ACNT_PRDT_CD=01 (없으면 기본 01). 하이픈 뒤 누락도 안전 처리. */
    private String acntPrdtCd(String accountNumber) {
        if (accountNumber != null && accountNumber.contains("-")) {
            String[] parts = accountNumber.split("-");
            if (parts.length > 1 && !parts[1].isBlank()) return parts[1];
        }
        return "01";
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
