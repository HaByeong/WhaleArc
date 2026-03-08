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

  getCandlesticks: async (symbol: string, interval: string = '10m'): Promise<Candlestick[]> => {
    const res = await apiClient.get<Candlestick[]>(`/api/market/candlestick/${symbol}`, {
      params: { interval },
    });
    return res.data;
  },
};

