package com.project.whalearc.market.service;

import com.project.whalearc.market.domain.AssetType;
import com.project.whalearc.market.dto.MarketPriceResponse;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * 국내 주식 시세 제공용 프로바이더.
 * - 현재는 목업 데이터로 동작하고, 나중에 KRX/증권사 Open API 연동 시 이 레이어를 교체한다.
 */
@Service
public class StockPriceProvider {

    public List<MarketPriceResponse> getMockKrxTickers() {
        List<MarketPriceResponse> list = new ArrayList<>();

        // 삼성전자
        MarketPriceResponse samsung = new MarketPriceResponse();
        samsung.setAssetType(AssetType.STOCK);
        samsung.setSymbol("005930");
        samsung.setName("삼성전자");
        samsung.setPrice(75_000);
        samsung.setChange(1_500);
        samsung.setChangeRate(2.04);
        samsung.setVolume(12_500_000L);
        samsung.setMarket("KRX");
        list.add(samsung);

        // SK하이닉스
        MarketPriceResponse hynix = new MarketPriceResponse();
        hynix.setAssetType(AssetType.STOCK);
        hynix.setSymbol("000660");
        hynix.setName("SK하이닉스");
        hynix.setPrice(145_000);
        hynix.setChange(-2_000);
        hynix.setChangeRate(-1.36);
        hynix.setVolume(3_500_000L);
        hynix.setMarket("KRX");
        list.add(hynix);

        return list;
    }
}

