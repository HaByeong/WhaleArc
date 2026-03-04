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

export const marketService = {
  getPrices: async (type: AssetType): Promise<MarketPrice[]> => {
    const res = await apiClient.get<MarketPrice[]>('/api/market/prices', {
      params: { type },
    });
    return res.data;
  },
};

