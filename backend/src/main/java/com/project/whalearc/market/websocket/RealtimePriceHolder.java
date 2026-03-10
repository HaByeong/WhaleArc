package com.project.whalearc.market.websocket;

import com.project.whalearc.market.domain.AssetType;
import com.project.whalearc.market.dto.MarketPriceResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
@RequiredArgsConstructor
public class RealtimePriceHolder {

    private final SimpMessagingTemplate messagingTemplate;

    // 가상화폐별 최신 실시간 가격 보관
    private final ConcurrentHashMap<String, RealtimeTick> latestTicks = new ConcurrentHashMap<>();

    private static final Map<String, String> COIN_NAMES = Map.ofEntries(
            Map.entry("BTC", "비트코인"), Map.entry("ETH", "이더리움"),
            Map.entry("XRP", "리플"), Map.entry("SOL", "솔라나"),
            Map.entry("DOGE", "도지코인"), Map.entry("ADA", "에이다"),
            Map.entry("DOT", "폴카닷"), Map.entry("MATIC", "폴리곤"), Map.entry("POL", "폴리곤"),
            Map.entry("AVAX", "아발란체"), Map.entry("LINK", "체인링크"),
            Map.entry("TRX", "트론"), Map.entry("ATOM", "코스모스"),
            Map.entry("UNI", "유니스왑"), Map.entry("APT", "앱토스"),
            Map.entry("ARB", "아비트럼"), Map.entry("OP", "옵티미즘"),
            Map.entry("NEAR", "니어프로토콜"), Map.entry("AAVE", "에이브"),
            Map.entry("EOS", "이오스"), Map.entry("BCH", "비트코인캐시"),
            Map.entry("LTC", "라이트코인"), Map.entry("ETC", "이더리움클래식"),
            Map.entry("XLM", "스텔라루멘"), Map.entry("SAND", "샌드박스"),
            Map.entry("MANA", "디센트럴랜드"), Map.entry("AXS", "엑시인피니티"),
            Map.entry("SHIB", "시바이누"), Map.entry("FIL", "파일코인"),
            Map.entry("ALGO", "알고랜드"), Map.entry("HBAR", "헤데라"),
            Map.entry("ICP", "인터넷컴퓨터"), Map.entry("VET", "비체인"),
            Map.entry("THETA", "쎄타토큰"), Map.entry("SUI", "수이"),
            Map.entry("SEI", "세이"), Map.entry("STX", "스택스"),
            Map.entry("IMX", "이뮤터블X"), Map.entry("PEPE", "페페"),
            Map.entry("WLD", "월드코인"), Map.entry("BLUR", "블러")
    );

    public void update(String coin, String closePrice, String prevClosePrice, String volume, String chgRate) {
        try {
            double price = parseDoubleSafe(closePrice);
            double prevPrice = parseDoubleSafe(prevClosePrice);
            double change = price - prevPrice;
            double changeRate = parseDoubleSafe(chgRate);
            // volume은 가상화폐 단위 → KRW 환산 거래대금으로 변환
            double coinVolume = parseDoubleSafe(volume);
            long vol = (long) (coinVolume * price);

            RealtimeTick tick = new RealtimeTick(
                    coin, price, prevPrice, change, changeRate, vol, System.currentTimeMillis()
            );
            latestTicks.put(coin, tick);

            // 개별 가상화폐 틱을 STOMP로 브로드캐스트
            MarketPriceResponse dto = toDto(coin, tick);
            messagingTemplate.convertAndSend("/topic/ticker/" + coin, dto);
            messagingTemplate.convertAndSend("/topic/ticker", dto);
        } catch (Exception e) {
            log.debug("실시간 가격 업데이트 실패 [{}]: {}", coin, e.getMessage());
        }
    }

    public List<MarketPriceResponse> getAllLatestPrices() {
        return latestTicks.entrySet().stream()
                .map(e -> toDto(e.getKey(), e.getValue()))
                .sorted((a, b) -> Long.compare(b.getVolume(), a.getVolume()))
                .toList();
    }

    public MarketPriceResponse getPrice(String coin) {
        RealtimeTick tick = latestTicks.get(coin);
        if (tick == null) return null;
        return toDto(coin, tick);
    }

    public boolean hasData() {
        return !latestTicks.isEmpty();
    }

    private MarketPriceResponse toDto(String coin, RealtimeTick tick) {
        MarketPriceResponse dto = new MarketPriceResponse();
        dto.setAssetType(AssetType.CRYPTO);
        dto.setSymbol(coin);
        dto.setName(COIN_NAMES.getOrDefault(coin, coin));
        dto.setPrice(tick.price());
        dto.setChange(tick.change());
        dto.setChangeRate(tick.changeRate());
        dto.setVolume(tick.volume());
        dto.setMarket("BITHUMB_KRW");
        return dto;
    }

    private double parseDoubleSafe(String value) {
        try {
            return Double.parseDouble(value);
        } catch (Exception e) {
            return 0.0;
        }
    }

    private long parseLongSafe(String value) {
        try {
            return value.contains(".") ? (long) Double.parseDouble(value) : Long.parseLong(value);
        } catch (Exception e) {
            return 0L;
        }
    }

    public record RealtimeTick(
            String coin,
            double price,
            double prevPrice,
            double change,
            double changeRate,
            long volume,
            long timestamp
    ) {}
}
