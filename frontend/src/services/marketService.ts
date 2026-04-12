import apiClient from '../utils/api';

export type AssetType = 'STOCK' | 'CRYPTO' | 'US_STOCK';

export interface MarketPrice {
  assetType: AssetType;
  symbol: string;
  name: string;
  price: number;
  change: number;
  changeRate: number;
  volume: number;
  market: string;
  currency?: string;
}

export interface Candlestick {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// 캔들스틱 메모리 캐시 (주식 5분, 암호화폐 30초)
const candleCache = new Map<string, { data: Candlestick[]; expireAt: number }>();
const STOCK_CACHE_TTL = 5 * 60 * 1000;
const CRYPTO_CACHE_TTL = 30 * 1000;

export const marketService = {
  getPrices: async (type: AssetType): Promise<MarketPrice[]> => {
    const res = await apiClient.get<MarketPrice[]>('/api/market/prices', {
      params: { type },
    });
    return res.data;
  },

  getCandlesticks: async (symbol: string, interval: string = '10m', assetType?: AssetType): Promise<Candlestick[]> => {
    const cacheKey = `${symbol}:${interval}:${assetType ?? 'CRYPTO'}`;
    const cached = candleCache.get(cacheKey);
    if (cached && Date.now() < cached.expireAt) {
      return cached.data;
    }

    const res = await apiClient.get<Candlestick[]>(`/api/market/candlestick/${symbol}`, {
      params: { interval, ...(assetType ? { assetType } : {}) },
    });

    // 빈 응답은 캐시하지 않음 (재시도 시 다시 요청하도록)
    if (res.data.length > 0) {
      const ttl = (assetType === 'STOCK' || assetType === 'US_STOCK') ? STOCK_CACHE_TTL : CRYPTO_CACHE_TTL;
      candleCache.set(cacheKey, { data: res.data, expireAt: Date.now() + ttl });
    }

    // 캐시 크기 제한 (최대 50개)
    if (candleCache.size > 50) {
      const oldest = candleCache.keys().next().value;
      if (oldest) candleCache.delete(oldest);
    }

    return res.data;
  },

  /** 주식 종목 검색 (이름/코드 부분 매칭) */
  searchStocks: async (keyword: string): Promise<{ code: string; name: string; market: string }[]> => {
    const res = await apiClient.get<{ code: string; name: string; market: string }[]>('/api/market/stock/search', {
      params: { keyword },
    });
    return res.data;
  },

  /** 개별 종목 현재가 조회 */
  getStockPrice: async (code: string): Promise<MarketPrice> => {
    const res = await apiClient.get<MarketPrice>(`/api/market/stock/price/${code}`);
    return res.data;
  },

  /** 미국주식 종목 검색 */
  searchUsStocks: async (keyword: string): Promise<{ code: string; name: string; market: string }[]> => {
    const res = await apiClient.get<{ code: string; name: string; market: string }[]>('/api/market/us-stock/search', {
      params: { keyword },
    });
    return res.data;
  },

  /** 미국주식 개별 종목 현재가 조회 */
  getUsStockPrice: async (symbol: string): Promise<MarketPrice> => {
    const res = await apiClient.get<MarketPrice>(`/api/market/us-stock/price/${symbol}`);
    return res.data;
  },

  /** USD/KRW 환율 조회 */
  getExchangeRate: async (): Promise<{ usdKrw: number; timestamp: number }> => {
    const res = await apiClient.get<{ usdKrw: number; timestamp: number }>('/api/market/exchange-rate');
    return res.data;
  },
};

