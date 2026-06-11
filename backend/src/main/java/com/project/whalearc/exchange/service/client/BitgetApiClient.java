package com.project.whalearc.exchange.service.client;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.project.whalearc.exchange.dto.ExchangeHoldingDto;
import com.project.whalearc.exchange.dto.ExchangePortfolioDto;
import com.project.whalearc.market.dto.CandlestickResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 비트겟(Bitget) Open API 클라이언트
 * API 문서: https://www.bitget.com/api-doc
 */
@Component
@RequiredArgsConstructor
public class BitgetApiClient {

    private static final String BASE_URL = "https://api.bitget.com";
    private static final String SPOT_ASSETS_PATH = "/api/v2/spot/account/assets";
    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    // 심볼 거래 규격(수량/금액 정밀도) 캐시 — 매 주문마다 public 조회하지 않도록 1회 캐싱
    private final Map<String, BitgetSymbolInfo> symbolInfoCache = new ConcurrentHashMap<>();

    /** 비트겟 현물 심볼 거래 규격. quantityPrecision=base 수량 소수자리, minTradeUSDT=시장가 매수 최소 USDT. */
    public record BitgetSymbolInfo(int quantityPrecision, int pricePrecision, BigDecimal minTradeUsdt) {}

    /** 주문 체결 결과. status=filled/partially_filled/... avgPrice/filledBase는 미체결 시 0일 수 있음. */
    public record BitgetFill(String status, BigDecimal avgPrice, BigDecimal filledBase, BigDecimal quoteVolume) {}

    @SuppressWarnings("unchecked")
    public ExchangePortfolioDto getPortfolio(String apiKey, String secretKey, String passphrase) {
        try {
            String timestamp = String.valueOf(Instant.now().toEpochMilli());
            String method = "GET";
            String requestPath = SPOT_ASSETS_PATH;

            // HMAC 서명 생성 (passphrase는 서명에 포함하지 않고 별도 헤더로 전달)
            String preSign = timestamp + method + requestPath;
            String signature = hmacSha256(secretKey, preSign);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("ACCESS-KEY", apiKey);
            headers.set("ACCESS-SIGN", signature);
            headers.set("ACCESS-TIMESTAMP", timestamp);
            headers.set("ACCESS-PASSPHRASE", passphrase); // Bitget 인증 필수 헤더 (누락 시 항상 인증 실패)
            headers.set("locale", "ko-KR");

            HttpEntity<Void> request = new HttpEntity<>(headers);
            ResponseEntity<Map> response = restTemplate.exchange(
                    BASE_URL + requestPath, HttpMethod.GET, request, Map.class);

            List<ExchangeHoldingDto> holdings = new ArrayList<>();
            double totalValue = 0;
            double totalProfitLoss = 0;
            double cashBalance = 0;
            // USDT 기준 코인 시세를 KRW 환산하는 데 쓰는 환율 (응답에 무관하게 한 번 조회)
            double usdtToKrw = getUsdtToKrw();

            if (response.getBody() != null && response.getBody().get("data") != null) {
                List<Map<String, Object>> assets = (List<Map<String, Object>>) response.getBody().get("data");

                for (Map<String, Object> asset : assets) {
                    String coin = (String) asset.get("coin");
                    double available = parseDouble(asset.get("available"));
                    double frozen = parseDouble(asset.get("frozen"));
                    double qty = available + frozen;

                    if (qty <= 0) continue;

                    if ("USDT".equals(coin) || "USDC".equals(coin)) {
                        cashBalance += qty * usdtToKrw;
                        continue;
                    }

                    // 코인별 현재가 조회
                    double priceUsdt = getCoinPriceUsdt(coin);
                    double currentPriceKrw = priceUsdt * usdtToKrw;
                    double marketValue = qty * currentPriceKrw;

                    // 한계: Bitget spot assets 엔드포인트는 평단가(avg cost)를 제공하지 않아
                    // 손익(profitLoss/Rate)을 산출할 수 없다. 정확한 손익은 체결내역 재구성이 필요(추후 과제).
                    // 평가액·현재가는 정상 산출되며, 손익은 0이 아니라 '미산출'임에 유의.
                    holdings.add(new ExchangeHoldingDto(
                            coin, getCoinName(coin), qty,
                            0, currentPriceKrw, marketValue, 0, 0));
                    totalValue += marketValue;
                }
            }

            totalValue += cashBalance;
            ExchangePortfolioDto dto = new ExchangePortfolioDto("BITGET", true, totalValue, totalProfitLoss,
                    0, cashBalance, holdings);
            dto.setUsdtKrwRate(usdtToKrw);
            return dto;

        } catch (Exception e) {
            System.err.println("비트겟 API 호출 실패: " + e.getMessage());
            ExchangePortfolioDto failed = new ExchangePortfolioDto("BITGET", true, 0, 0, 0, 0, new ArrayList<>());
            failed.setFetchOk(false);   // 조회 실패 → 빈 계좌와 구분(에러 UI·자산추이 스냅샷 스킵)
            return failed;
        }
    }

    @SuppressWarnings("unchecked")
    private double getCoinPriceUsdt(String coin) {
        try {
            ResponseEntity<Map> response = restTemplate.getForEntity(
                    BASE_URL + "/api/v2/spot/market/tickers?symbol=" + coin + "USDT", Map.class);
            if (response.getBody() != null && response.getBody().get("data") != null) {
                List<Map<String, Object>> data = (List<Map<String, Object>>) response.getBody().get("data");
                if (!data.isEmpty()) {
                    return parseDouble(data.get(0).get("lastPr"));
                }
            }
        } catch (Exception e) {
            System.err.println("비트겟 시세 조회 실패 (" + coin + "): " + e.getMessage());
        }
        return 0;
    }

    @SuppressWarnings("unchecked")
    private double getUsdtToKrw() {
        try {
            // 업비트 USDT/KRW 시세 활용
            ResponseEntity<List> response = restTemplate.getForEntity(
                    "https://api.upbit.com/v1/ticker?markets=KRW-USDT", List.class);
            if (response.getBody() != null && !response.getBody().isEmpty()) {
                Map<String, Object> ticker = (Map<String, Object>) response.getBody().get(0);
                return parseDouble(ticker.get("trade_price"));
            }
        } catch (Exception e) {
            System.err.println("USDT/KRW 환율 조회 실패: " + e.getMessage());
        }
        return 1350; // 기본 환율
    }

    private String hmacSha256(String secret, String message) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] hash = mac.doFinal(message.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(hash);
        } catch (Exception e) {
            throw new RuntimeException("HMAC 서명 생성 실패", e);
        }
    }

    private String getCoinName(String currency) {
        Map<String, String> names = Map.ofEntries(
                Map.entry("BTC", "비트코인"), Map.entry("ETH", "이더리움"),
                Map.entry("XRP", "리플"), Map.entry("SOL", "솔라나"),
                Map.entry("DOGE", "도지코인"), Map.entry("ADA", "에이다"),
                Map.entry("DOT", "폴카닷"), Map.entry("MATIC", "폴리곤"),
                Map.entry("AVAX", "아발란체"), Map.entry("LINK", "체인링크")
        );
        return names.getOrDefault(currency, currency);
    }

    private double parseDouble(Object value) {
        if (value == null) return 0;
        try {
            return Double.parseDouble(value.toString());
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    // ── 라이브 자동매매: 인증 요청 + 현물 주문/체결/캔들/규격 ──────────────

    /** USDT→KRW 환율(공개). 사이징·손익 환산에 재사용. */
    public double getUsdtKrwRate() {
        return getUsdtToKrw();
    }

    /** 코인 코드(BTC) → 비트겟 현물 심볼(BTCUSDT). 이미 USDT로 끝나면 그대로. */
    public static String toSpotSymbol(String code) {
        if (code == null) return null;
        String u = code.toUpperCase().replace("/", "").replace("-", "");
        return u.endsWith("USDT") ? u : u + "USDT";
    }

    /**
     * 현물 시장가 주문 발주. 매수는 size=USDT 금액(quote), 매도는 size=코인 수량(base).
     * @return 거래소 orderId. 거부 시 IllegalStateException.
     */
    public String placeSpotMarketOrder(String apiKey, String secretKey, String passphrase,
                                       String symbol, String side, BigDecimal size, String clientOid) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("symbol", symbol);
        body.put("side", side);            // buy | sell
        body.put("orderType", "market");
        body.put("force", "gtc");
        body.put("size", size.toPlainString());
        if (clientOid != null) body.put("clientOid", clientOid);
        Map<String, Object> resp = signedRequest(apiKey, secretKey, passphrase, HttpMethod.POST,
                "/api/v2/spot/trade/place-order", null, body);
        String code = String.valueOf(resp.get("code"));
        if (!"00000".equals(code)) {
            throw new IllegalStateException("Bitget 주문 거부: code=" + code + ", msg=" + resp.get("msg"));
        }
        Object data = resp.get("data");
        if (data instanceof Map<?, ?> m && m.get("orderId") != null) return String.valueOf(m.get("orderId"));
        throw new IllegalStateException("Bitget 주문 응답에 orderId 없음: " + resp);
    }

    /** 주문 체결 상태/평균가/체결수량 조회(orderInfo). */
    public BitgetFill getSpotOrderInfo(String apiKey, String secretKey, String passphrase, String orderId) {
        Map<String, Object> resp = signedRequest(apiKey, secretKey, passphrase, HttpMethod.GET,
                "/api/v2/spot/trade/orderInfo", Map.of("orderId", orderId), null);
        Object data = resp.get("data");
        if (!(data instanceof List<?> list) || list.isEmpty()) {
            return new BitgetFill("unknown", BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);
        }
        Map<?, ?> o = (Map<?, ?>) list.get(0);
        return new BitgetFill(String.valueOf(o.get("status")),
                bd(o.get("priceAvg")), bd(o.get("baseVolume")), bd(o.get("quoteVolume")));
    }

    /** 현물 심볼 거래 규격 조회(캐시). */
    @SuppressWarnings("unchecked")
    public BitgetSymbolInfo getSymbolInfo(String symbol) {
        return symbolInfoCache.computeIfAbsent(symbol, sym -> {
            try {
                ResponseEntity<Map> resp = restTemplate.getForEntity(
                        BASE_URL + "/api/v2/spot/public/symbols?symbol=" + sym, Map.class);
                List<Map<String, Object>> data = resp.getBody() != null
                        ? (List<Map<String, Object>>) resp.getBody().get("data") : null;
                if (data != null && !data.isEmpty()) {
                    Map<String, Object> s = data.get(0);
                    int qp = (int) parseDouble(s.get("quantityPrecision"));
                    int pp = (int) parseDouble(s.get("pricePrecision"));
                    BigDecimal minUsdt = bd(s.get("minTradeUSDT"));
                    return new BitgetSymbolInfo(qp, pp, minUsdt.signum() > 0 ? minUsdt : BigDecimal.valueOf(5));
                }
            } catch (Exception e) {
                System.err.println("비트겟 심볼규격 조회 실패 (" + sym + "): " + e.getMessage());
            }
            // 조회 실패 시 보수적 기본값(수량 6자리, 최소 5 USDT)
            return new BitgetSymbolInfo(6, 4, BigDecimal.valueOf(5));
        });
    }

    /** 선물 계약 거래 규격 조회(캐시). volumePlace=수량 소수자리, minTradeNum=최소 주문 수량(base). */
    @SuppressWarnings("unchecked")
    public BitgetSymbolInfo getFuturesSymbolInfo(String symbol) {
        return symbolInfoCache.computeIfAbsent("FUT:" + symbol, key -> {
            try {
                ResponseEntity<Map> resp = restTemplate.getForEntity(
                        BASE_URL + "/api/v2/mix/market/contracts?productType=" + FUTURES_PRODUCT_TYPE + "&symbol=" + symbol, Map.class);
                List<Map<String, Object>> data = resp.getBody() != null
                        ? (List<Map<String, Object>>) resp.getBody().get("data") : null;
                if (data != null && !data.isEmpty()) {
                    Map<String, Object> s = data.get(0);
                    int vp = (int) parseDouble(s.get("volumePlace"));
                    int pp = (int) parseDouble(s.get("pricePlace"));
                    BigDecimal minNum = bd(s.get("minTradeNum"));
                    // minTradeUsdt 칸을 최소 주문 수량(base)으로 재활용 — 선물은 수량 기준 최소가 더 의미있음
                    return new BitgetSymbolInfo(vp, pp, minNum);
                }
            } catch (Exception e) {
                System.err.println("비트겟 선물규격 조회 실패 (" + symbol + "): " + e.getMessage());
            }
            return new BitgetSymbolInfo(4, 2, BigDecimal.ZERO);
        });
    }

    /** 현물 캔들 조회 → 엔진 CandlestickResponse(시간 오름차순). */
    public List<CandlestickResponse> getSpotCandles(String symbol, String interval, int limit) {
        return fetchCandles(BASE_URL + "/api/v2/spot/market/candles?symbol=" + symbol
                + "&granularity=" + toGranularity(interval) + "&limit=" + limit);
    }

    /** 선물(USDT 무기한) 캔들 조회. granularity 표기가 현물과 다르다(1H/4H/1D). */
    public List<CandlestickResponse> getFuturesCandles(String symbol, String interval, int limit) {
        return fetchCandles(BASE_URL + "/api/v2/mix/market/candles?symbol=" + symbol
                + "&productType=" + FUTURES_PRODUCT_TYPE
                + "&granularity=" + toMixGranularity(interval) + "&limit=" + limit);
    }

    /** 캔들 응답(배열의 배열: [ts(ms), o, h, l, c, vol, ...]) → CandlestickResponse(시간 오름차순). */
    @SuppressWarnings("unchecked")
    private List<CandlestickResponse> fetchCandles(String url) {
        List<CandlestickResponse> out = new ArrayList<>();
        try {
            ResponseEntity<Map> resp = restTemplate.getForEntity(url, Map.class);
            Object data = resp.getBody() != null ? resp.getBody().get("data") : null;
            if (data instanceof List<?> rows) {
                for (Object row : rows) {
                    if (!(row instanceof List<?> c) || c.size() < 5) continue;
                    long ts = (long) parseDouble(c.get(0)) / 1000L;   // ms → s
                    out.add(new CandlestickResponse(ts,
                            parseDouble(c.get(1)), parseDouble(c.get(2)),
                            parseDouble(c.get(3)), parseDouble(c.get(4)),
                            c.size() > 5 ? parseDouble(c.get(5)) : 0));
                }
            }
            out.sort(Comparator.comparingLong(CandlestickResponse::getTime));
        } catch (Exception e) {
            System.err.println("비트겟 캔들 조회 실패: " + url + " - " + e.getMessage());
        }
        return out;
    }

    // ── 선물(USDT-FUTURES) 주문/레버리지/청산 ──

    private static final String FUTURES_PRODUCT_TYPE = "USDT-FUTURES";
    private static final String FUTURES_MARGIN_COIN = "USDT";
    private static final String FUTURES_MARGIN_MODE = "isolated";

    /** 선물 레버리지 설정(개시 전 호출). 롱 기본. */
    public void setFuturesLeverage(String apiKey, String secretKey, String passphrase,
                                   String symbol, int leverage) {
        setFuturesLeverage(apiKey, secretKey, passphrase, symbol, leverage, "long");
    }

    /** 선물 레버리지 설정(holdSide 지정: long/short). */
    public void setFuturesLeverage(String apiKey, String secretKey, String passphrase,
                                   String symbol, int leverage, String holdSide) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("symbol", symbol);
        body.put("productType", FUTURES_PRODUCT_TYPE);
        body.put("marginCoin", FUTURES_MARGIN_COIN);
        body.put("leverage", String.valueOf(leverage));
        body.put("holdSide", holdSide);
        Map<String, Object> resp = signedRequest(apiKey, secretKey, passphrase, HttpMethod.POST,
                "/api/v2/mix/account/set-leverage", null, body);
        String code = String.valueOf(resp.get("code"));
        if (!"00000".equals(code)) {
            // 레버리지 변경 실패는 기존 설정으로 진행 가능하므로 예외 대신 경고만(포지션 보유 중엔 변경 불가 등)
            System.err.println("비트겟 레버리지 설정 경고: symbol=" + symbol + ", code=" + code + ", msg=" + resp.get("msg"));
        }
    }

    /**
     * 선물 시장가 롱 개시(open) 주문. size=코인 수량(base).
     *
     * <p>계정 포지션 모드를 모르므로 hedge(tradeSide=open) → one-way(tradeSide 생략) 순으로 시도한다.
     * 같은 clientOid를 재사용하므로 첫 시도가 거래소엔 성사됐는데 응답만 실패한 경우 멱등 처리되어 중복 개시되지 않는다.
     * @return 거래소 orderId. 두 모드 모두 실패 시 IllegalStateException.
     */
    public String openFuturesLong(String apiKey, String secretKey, String passphrase,
                                  String symbol, BigDecimal size, String clientOid) {
        return openFutures(apiKey, secretKey, passphrase, symbol, size, clientOid, "buy");
    }

    /** 선물 시장가 숏 개시(open) 주문. size=코인 수량(base). */
    public String openFuturesShort(String apiKey, String secretKey, String passphrase,
                                   String symbol, BigDecimal size, String clientOid) {
        return openFutures(apiKey, secretKey, passphrase, symbol, size, clientOid, "sell");
    }

    private String openFutures(String apiKey, String secretKey, String passphrase,
                               String symbol, BigDecimal size, String clientOid, String side) {
        try {
            return placeFuturesOpen(apiKey, secretKey, passphrase, symbol, size, clientOid, true, side);   // hedge
        } catch (Exception hedgeErr) {
            try {
                return placeFuturesOpen(apiKey, secretKey, passphrase, symbol, size, clientOid, false, side);  // one-way
            } catch (Exception oneWayErr) {
                throw new IllegalStateException("Bitget 선물 개시 실패 (hedge: " + hedgeErr.getMessage()
                        + " | one-way: " + oneWayErr.getMessage() + ")");
            }
        }
    }

    /** 선물 개시 1회 시도. side=buy(롱)/sell(숏). hedge=true면 tradeSide=open(헤지), false면 생략(단방향). */
    private String placeFuturesOpen(String apiKey, String secretKey, String passphrase,
                                    String symbol, BigDecimal size, String clientOid, boolean hedge, String side) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("symbol", symbol);
        body.put("productType", FUTURES_PRODUCT_TYPE);
        body.put("marginMode", FUTURES_MARGIN_MODE);
        body.put("marginCoin", FUTURES_MARGIN_COIN);
        body.put("side", side);
        if (hedge) body.put("tradeSide", "open");
        body.put("orderType", "market");
        body.put("size", size.toPlainString());
        // 두 시도에 같은 clientOid 사용 — hedge가 거래소엔 성사됐는데 응답만 실패한 경우 one-way 재시도가
        // 멱등 처리되어 이중 개시를 막는다(중복키 거부 < 이중 개시 위험).
        if (clientOid != null) body.put("clientOid", clientOid);
        Map<String, Object> resp = signedRequest(apiKey, secretKey, passphrase, HttpMethod.POST,
                "/api/v2/mix/order/place-order", null, body);
        String code = String.valueOf(resp.get("code"));
        if (!"00000".equals(code)) {
            throw new IllegalStateException("code=" + code + ", msg=" + resp.get("msg"));
        }
        Object data = resp.get("data");
        if (data instanceof Map<?, ?> m && m.get("orderId") != null) return String.valueOf(m.get("orderId"));
        throw new IllegalStateException("orderId 없음: " + resp);
    }

    /**
     * 선물 롱 포지션을 <b>지정 수량만큼</b> 시장가 청산(reduceOnly). 심볼 전체를 닫는 close-positions와 달리
     * 배포별 보유분만 닫아, 같은 심볼을 여러 배포가 들고 있어도 서로 영향을 주지 않는다.
     *
     * <p>포지션 모드를 모르므로 hedge(tradeSide=close) → one-way(reduceOnly=YES) 순으로 시도한다.
     * @return 거래소 orderId. 두 모드 모두 실패 시 IllegalStateException.
     */
    public String closeFuturesLongSize(String apiKey, String secretKey, String passphrase,
                                       String symbol, BigDecimal size, String clientOid) {
        return closeFuturesSize(apiKey, secretKey, passphrase, symbol, size, clientOid, true);
    }

    /** 선물 숏 포지션을 지정 수량만큼 시장가 청산(reduceOnly). */
    public String closeFuturesShortSize(String apiKey, String secretKey, String passphrase,
                                        String symbol, BigDecimal size, String clientOid) {
        return closeFuturesSize(apiKey, secretKey, passphrase, symbol, size, clientOid, false);
    }

    private String closeFuturesSize(String apiKey, String secretKey, String passphrase,
                                    String symbol, BigDecimal size, String clientOid, boolean isLong) {
        try {
            return placeFuturesClose(apiKey, secretKey, passphrase, symbol, size, clientOid, true, isLong);   // hedge
        } catch (Exception hedgeErr) {
            try {
                return placeFuturesClose(apiKey, secretKey, passphrase, symbol, size, clientOid, false, isLong);  // one-way
            } catch (Exception oneWayErr) {
                throw new IllegalStateException("Bitget 선물 부분청산 실패 (hedge: " + hedgeErr.getMessage()
                        + " | one-way: " + oneWayErr.getMessage() + ")");
            }
        }
    }

    /** 선물 사이즈 청산 1회 시도. hedge=true면 tradeSide=close, false면 reduceOnly=YES(반대매매). isLong=청산 대상 방향. */
    private String placeFuturesClose(String apiKey, String secretKey, String passphrase,
                                     String symbol, BigDecimal size, String clientOid, boolean hedge, boolean isLong) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("symbol", symbol);
        body.put("productType", FUTURES_PRODUCT_TYPE);
        body.put("marginMode", FUTURES_MARGIN_MODE);
        body.put("marginCoin", FUTURES_MARGIN_COIN);
        if (hedge) {
            // 헤지(양방향) 모드: side는 '포지션 방향'을 뜻한다. 롱 청산=(side=buy,tradeSide=close), 숏 청산=(side=sell,tradeSide=close).
            body.put("side", isLong ? "buy" : "sell");
            body.put("tradeSide", "close");
        } else {
            // 단방향(one-way) 모드: 반대매매로 닫는다. 롱 청산=(side=sell), 숏 청산=(side=buy) + reduceOnly.
            body.put("side", isLong ? "sell" : "buy");
            body.put("reduceOnly", "YES");
        }
        body.put("orderType", "market");
        body.put("size", size.toPlainString());
        // 개시와 동일하게 두 시도에 같은 clientOid 사용 — 멱등 처리로 이중 청산 방지.
        if (clientOid != null) body.put("clientOid", clientOid);
        Map<String, Object> resp = signedRequest(apiKey, secretKey, passphrase, HttpMethod.POST,
                "/api/v2/mix/order/place-order", null, body);
        String code = String.valueOf(resp.get("code"));
        if (!"00000".equals(code)) {
            throw new IllegalStateException("code=" + code + ", msg=" + resp.get("msg"));
        }
        Object data = resp.get("data");
        if (data instanceof Map<?, ?> m && m.get("orderId") != null) return String.valueOf(m.get("orderId"));
        throw new IllegalStateException("orderId 없음: " + resp);
    }

    /** 선물 주문 체결 상태/평균가/체결수량 조회(mix order detail). */
    @SuppressWarnings("unchecked")
    public BitgetFill getFuturesOrderInfo(String apiKey, String secretKey, String passphrase,
                                          String symbol, String orderId) {
        Map<String, Object> q = new LinkedHashMap<>();
        q.put("symbol", symbol);
        q.put("productType", FUTURES_PRODUCT_TYPE);
        q.put("orderId", orderId);
        Map<String, Object> resp = signedRequest(apiKey, secretKey, passphrase, HttpMethod.GET,
                "/api/v2/mix/order/detail", q, null);
        Object data = resp.get("data");
        if (!(data instanceof Map<?, ?> o)) {
            return new BitgetFill("unknown", BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);
        }
        // mix detail: priceAvg(평균체결가), baseVolume(체결 수량), state(filled/partially_filled)
        return new BitgetFill(String.valueOf(o.get("state")),
                bd(o.get("priceAvg")), bd(o.get("baseVolume")), bd(o.get("quoteVolume")));
    }

    /** 선물 롱 포지션의 현재 보유 수량 조회(청산 검증용). 미보유면 0. */
    @SuppressWarnings("unchecked")
    public BigDecimal getFuturesLongSize(String apiKey, String secretKey, String passphrase, String symbol) {
        Map<String, Object> q = new LinkedHashMap<>();
        q.put("symbol", symbol);
        q.put("productType", FUTURES_PRODUCT_TYPE);
        q.put("marginCoin", FUTURES_MARGIN_COIN);
        Map<String, Object> resp = signedRequest(apiKey, secretKey, passphrase, HttpMethod.GET,
                "/api/v2/mix/position/single-position", q, null);
        Object data = resp.get("data");
        if (data instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Map<?, ?> p && "long".equalsIgnoreCase(String.valueOf(p.get("holdSide")))) {
                    return bd(p.get("total"));
                }
            }
        }
        return BigDecimal.ZERO;
    }

    /** 선물 숏 포지션의 현재 보유 수량 조회(청산 검증용). 미보유면 0. */
    @SuppressWarnings("unchecked")
    public BigDecimal getFuturesShortSize(String apiKey, String secretKey, String passphrase, String symbol) {
        Map<String, Object> q = new LinkedHashMap<>();
        q.put("symbol", symbol);
        q.put("productType", FUTURES_PRODUCT_TYPE);
        q.put("marginCoin", FUTURES_MARGIN_COIN);
        Map<String, Object> resp = signedRequest(apiKey, secretKey, passphrase, HttpMethod.GET,
                "/api/v2/mix/position/single-position", q, null);
        Object data = resp.get("data");
        if (data instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Map<?, ?> p && "short".equalsIgnoreCase(String.valueOf(p.get("holdSide")))) {
                    return bd(p.get("total"));
                }
            }
        }
        return BigDecimal.ZERO;
    }

    // ── 인증 요청 공통 ──
    @SuppressWarnings("unchecked")
    private Map<String, Object> signedRequest(String apiKey, String secretKey, String passphrase,
                                              HttpMethod method, String requestPath,
                                              Map<String, Object> query, Map<String, Object> body) {
        String timestamp = String.valueOf(Instant.now().toEpochMilli());
        String fullPath = requestPath + toSortedQuery(query);   // GET 쿼리는 서명 대상 경로에 포함
        String bodyJson = "";
        if (body != null) {
            try {
                bodyJson = objectMapper.writeValueAsString(body);
            } catch (Exception e) {
                throw new RuntimeException("Bitget 요청 본문 직렬화 실패", e);
            }
        }
        // preSign = timestamp + METHOD + requestPath(+query) + body. 서명한 body 문자열을 그대로 전송해야 함.
        String preSign = timestamp + method.name() + fullPath + bodyJson;
        String sign = hmacSha256(secretKey, preSign);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("ACCESS-KEY", apiKey);
        headers.set("ACCESS-SIGN", sign);
        headers.set("ACCESS-TIMESTAMP", timestamp);
        headers.set("ACCESS-PASSPHRASE", passphrase);
        headers.set("locale", "ko-KR");

        HttpEntity<String> entity = new HttpEntity<>(method == HttpMethod.POST ? bodyJson : null, headers);
        ResponseEntity<Map> resp = restTemplate.exchange(BASE_URL + fullPath, method, entity, Map.class);
        return resp.getBody() != null ? resp.getBody() : Map.of();
    }

    /** 쿼리 파라미터를 키 사전순으로 직렬화(서명 규칙과 일치해야 함). 비어있으면 "". */
    private static String toSortedQuery(Map<String, Object> query) {
        if (query == null || query.isEmpty()) return "";
        StringBuilder sb = new StringBuilder("?");
        query.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .forEach(e -> sb.append(e.getKey()).append('=').append(e.getValue()).append('&'));
        sb.setLength(sb.length() - 1);
        return sb.toString();
    }

    /** 앱 interval → 비트겟 현물 granularity. */
    private static String toGranularity(String interval) {
        if (interval == null) return "1h";
        return switch (interval.toLowerCase()) {
            case "1m" -> "1min";
            case "5m" -> "5min";
            case "15m" -> "15min";
            case "30m" -> "30min";
            case "4h" -> "4h";
            case "1d" -> "1day";
            default -> "1h";
        };
    }

    /** 앱 interval → 비트겟 선물(mix) granularity (시/일은 대문자 H/D 표기). */
    private static String toMixGranularity(String interval) {
        if (interval == null) return "1H";
        return switch (interval.toLowerCase()) {
            case "1m" -> "1m";
            case "5m" -> "5m";
            case "15m" -> "15m";
            case "30m" -> "30m";
            case "4h" -> "4H";
            case "1d" -> "1D";
            default -> "1H";
        };
    }

    private static BigDecimal bd(Object v) {
        if (v == null) return BigDecimal.ZERO;
        try {
            return new BigDecimal(v.toString());
        } catch (NumberFormatException e) {
            return BigDecimal.ZERO;
        }
    }
}
