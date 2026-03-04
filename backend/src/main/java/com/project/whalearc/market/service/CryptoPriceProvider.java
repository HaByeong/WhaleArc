package com.project.whalearc.market.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.project.whalearc.market.domain.AssetType;
import com.project.whalearc.market.dto.MarketPriceResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 빗썸 공개 API에서 코인 시세를 조회하는 프로바이더.
 * - /public/ticker/ALL_KRW 호출
 * - AssetType.CRYPTO 로 매핑
 */
@Service
@RequiredArgsConstructor
public class CryptoPriceProvider {

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public List<MarketPriceResponse> getAllKrwTickers() {
        String url = "https://api.bithumb.com/public/ticker/ALL_KRW";

        // 응답을 Map 형태로 받아서 data 필드만 파싱
        Map<String, Object> response =
                restTemplate.getForObject(url, Map.class);

        if (response == null || response.get("data") == null) {
            return List.of();
        }

        // data: { "BTC": {..}, "ETH": {..}, "date": "..." }
        Map<String, Object> rawData = objectMapper.convertValue(
                response.get("data"),
                new TypeReference<Map<String, Object>>() {}
        );

        List<MarketPriceResponse> result = new ArrayList<>();

        for (Map.Entry<String, Object> entry : rawData.entrySet()) {
            String symbol = entry.getKey();
            if ("date".equalsIgnoreCase(symbol)) {
                continue;
            }

            Map<String, String> ticker = objectMapper.convertValue(
                    entry.getValue(),
                    new TypeReference<Map<String, String>>() {}
            );

            try {
                long closingPrice = Long.parseLong(ticker.get("closing_price"));
                long prevClosing = Long.parseLong(ticker.get("prev_closing_price"));
                long change = closingPrice - prevClosing;
                double changeRate = prevClosing == 0
                        ? 0
                        : (change * 100.0 / prevClosing);

                MarketPriceResponse dto = new MarketPriceResponse();
                dto.setAssetType(AssetType.CRYPTO);
                dto.setSymbol(symbol);
                dto.setName(symbol); // 필요 시 심볼→코인명 매핑 추가
                dto.setPrice(closingPrice);
                dto.setChange(change);
                dto.setChangeRate(changeRate);
                dto.setVolume(Long.parseLong(ticker.getOrDefault("units_traded_24H", "0").split("\\.")[0]));
                dto.setMarket("BITHUMB_KRW");

                result.add(dto);
            } catch (Exception ignored) {
                // 개별 심볼 파싱 실패 시 건너뛴다.
            }
        }

        return result;
    }
}

