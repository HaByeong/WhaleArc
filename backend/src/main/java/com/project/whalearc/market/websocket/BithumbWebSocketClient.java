package com.project.whalearc.market.websocket;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.nio.ByteBuffer;
import java.util.Map;
import java.util.concurrent.*;

@Slf4j
@Component
@RequiredArgsConstructor
public class BithumbWebSocketClient {

    private static final String BITHUMB_WS_URL = "wss://pubwss.bithumb.com/pub/ws";
    private static final int RECONNECT_DELAY_SEC = 5;
    private static final int MAX_RECONNECT_ATTEMPTS = 10;

    private final RealtimePriceHolder priceHolder;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private volatile WebSocket webSocket;
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
    private int reconnectAttempts = 0;
    private volatile boolean running = true;

    @PostConstruct
    public void connect() {
        scheduler.submit(this::doConnect);
    }

    @PreDestroy
    public void shutdown() {
        running = false;
        scheduler.shutdownNow();
        if (webSocket != null) {
            webSocket.sendClose(WebSocket.NORMAL_CLOSURE, "shutdown");
        }
    }

    private void doConnect() {
        if (!running) return;

        try {
            HttpClient client = HttpClient.newHttpClient();
            client.newWebSocketBuilder()
                    .buildAsync(URI.create(BITHUMB_WS_URL), new WebSocket.Listener() {

                        private final StringBuilder buffer = new StringBuilder();

                        @Override
                        public void onOpen(WebSocket ws) {
                            log.info("빗썸 WebSocket 연결 성공");
                            reconnectAttempts = 0;
                            webSocket = ws;
                            subscribe(ws);
                            ws.request(1);
                        }

                        @Override
                        public CompletionStage<?> onText(WebSocket ws, CharSequence data, boolean last) {
                            buffer.append(data);
                            if (last) {
                                processMessage(buffer.toString());
                                buffer.setLength(0);
                            }
                            ws.request(1);
                            return null;
                        }

                        @Override
                        public CompletionStage<?> onPing(WebSocket ws, ByteBuffer message) {
                            ws.sendPong(message);
                            ws.request(1);
                            return null;
                        }

                        @Override
                        public CompletionStage<?> onClose(WebSocket ws, int statusCode, String reason) {
                            log.warn("빗썸 WebSocket 종료: {} - {}", statusCode, reason);
                            scheduleReconnect();
                            return null;
                        }

                        @Override
                        public void onError(WebSocket ws, Throwable error) {
                            log.error("빗썸 WebSocket 에러: {}", error.getMessage());
                            scheduleReconnect();
                        }
                    })
                    .join();
        } catch (Exception e) {
            log.error("빗썸 WebSocket 연결 실패: {}", e.getMessage());
            scheduleReconnect();
        }
    }

    private void subscribe(WebSocket ws) {
        // 빗썸 WebSocket ticker 구독 (주요 코인)
        String subscribeMsg = """
                {"type":"ticker","symbols":[
                "BTC_KRW","ETH_KRW","XRP_KRW","SOL_KRW","DOGE_KRW",
                "ADA_KRW","DOT_KRW","AVAX_KRW","LINK_KRW","TRX_KRW",
                "ATOM_KRW","UNI_KRW","APT_KRW","ARB_KRW","OP_KRW",
                "NEAR_KRW","EOS_KRW","BCH_KRW","LTC_KRW","ETC_KRW",
                "SHIB_KRW","SUI_KRW","SEI_KRW","STX_KRW","PEPE_KRW",
                "WLD_KRW","MATIC_KRW","POL_KRW","AAVE_KRW","SAND_KRW","MANA_KRW"
                ],"tickTypes":["MID"]}
                """;
        ws.sendText(subscribeMsg, true);
        log.info("빗썸 WebSocket ticker 구독 요청 완료");
    }

    @SuppressWarnings("unchecked")
    private void processMessage(String message) {
        try {
            Map<String, Object> data = objectMapper.readValue(
                    message, new TypeReference<Map<String, Object>>() {}
            );

            // 구독 응답("status")은 무시
            if (data.containsKey("status")) {
                log.debug("빗썸 WebSocket 구독 응답: {}", data.get("status"));
                return;
            }

            // ticker 데이터 처리
            Map<String, Object> content = (Map<String, Object>) data.get("content");
            if (content == null) return;

            String symbol = (String) content.get("symbol");
            if (symbol == null || !symbol.endsWith("_KRW")) return;

            String coin = symbol.replace("_KRW", "");
            String closePrice = String.valueOf(content.get("closePrice"));
            String prevClosePrice = String.valueOf(content.get("prevClosePrice"));
            String volume = String.valueOf(content.get("volume"));
            String chgRate = String.valueOf(content.get("chgRate"));

            priceHolder.update(coin, closePrice, prevClosePrice, volume, chgRate);
        } catch (Exception e) {
            log.debug("빗썸 WebSocket 메시지 파싱 실패: {}", e.getMessage());
        }
    }

    private void scheduleReconnect() {
        if (!running) return;
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            log.error("빗썸 WebSocket 재연결 최대 횟수 초과 ({}회)", MAX_RECONNECT_ATTEMPTS);
            // 잠시 후 카운터 리셋하고 재시도
            scheduler.schedule(() -> {
                reconnectAttempts = 0;
                doConnect();
            }, 60, TimeUnit.SECONDS);
            return;
        }

        reconnectAttempts++;
        long delay = (long) RECONNECT_DELAY_SEC * reconnectAttempts;
        log.info("빗썸 WebSocket 재연결 예정: {}초 후 (시도 {}/{})", delay, reconnectAttempts, MAX_RECONNECT_ATTEMPTS);
        scheduler.schedule(this::doConnect, delay, TimeUnit.SECONDS);
    }
}
