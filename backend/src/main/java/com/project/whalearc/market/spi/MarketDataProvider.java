package com.project.whalearc.market.spi;

import com.project.whalearc.market.domain.AssetType;
import com.project.whalearc.market.dto.CandlestickResponse;
import com.project.whalearc.market.dto.MarketPriceResponse;

import java.util.List;

/**
 * 자산군별 공용 시장데이터(시세·캔들) 소스의 단일 통로 추상화.
 *
 * <p>OrderGateway와 동일한 관례(supports 셀렉터 + List 주입 라우팅)를 따른다.
 * 현재 구현체는 기존 프로바이더(KIS 서버키·빗썸)에 위임만 하며, 라이선스 소스
 * (국내=코스콤, 미국·ETF=EOD 벤더, 코인=Bitget) 도입 시 새 구현체 추가 +
 * 설정 토글({@code market.source.<asset>.enabled})로 무중단 교체한다.
 *
 * <p>범위: 공용(서버) 시세만. 유저키 기반 실계좌 조회(exchange 패키지)와
 * 백테스트 히스토리(BacktestDataProvider — 소스·캐시 모델이 다름)는 대상이 아니다.
 */
public interface MarketDataProvider {

    /** 이 프로바이더가 담당하는 자산군인지. */
    boolean supports(AssetType assetType);

    /** 자산군 전체 종목의 현재가 스냅샷. */
    List<MarketPriceResponse> getAllPrices();

    /** 단건 현재가. 조회 불가 시 null (기존 프로바이더 규약). */
    MarketPriceResponse getPrice(String symbol);

    /** 캔들(차트) 조회. 소스 분기는 CandlestickService가 소스 오브 트루스. */
    List<CandlestickResponse> getCandles(String symbol, String interval);

    /** 종목의 거래소 코드 (해외주식용. 국내·코인은 상수). */
    String getExchange(String symbol);

    /** 종목 존재 여부 (자산군 판별용). */
    boolean exists(String symbol);
}
