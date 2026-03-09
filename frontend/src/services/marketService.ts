import apiClient from '../utils/api';

export type AssetType = 'STOCK' | 'CRYPTO';

export interface MarketPrice {
  assetType: AssetType;
  symbol: string;
  name: string;
  price: number;
  change: number;
  changeRate: number;
  volume: number;
  market: string;
}

export interface Candlestick {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export const marketService = {
  getPrices: async (type: AssetType): Promise<MarketPrice[]> => {
    const res = await apiClient.get<MarketPrice[]>('/api/market/prices', {
      params: { type },
    });
    return res.data;
  },

  getCandlesticks: async (symbol: string, interval: string = '10m', assetType?: AssetType): Promise<Candlestick[]> => {
    const res = await apiClient.get<Candlestick[]>(`/api/market/candlestick/${symbol}`, {
      params: { interval, ...(assetType ? { assetType } : {}) },
    });
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
};

