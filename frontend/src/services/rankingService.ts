import apiClient from '../utils/api';

export type RankingType = 'all' | 'daily' | 'weekly' | 'monthly';

export interface RankingResponse {
  rankingType: RankingType;
  snapshotDate: string;
  totalCount: number;
  rankings: RankingEntry[];
}

export interface RankingEntry {
  portfolioId: string;
  rank: number;
  nickname: string;
  portfolioName: string;
  totalReturn: number;
  totalValue: number;
  rankChange: number;
  isMyRanking?: boolean;
  // 대표 항로
  routeName?: string | null;
  routeStrategyType?: string | null;
  routeReturnRate?: number | null;
  routeDescription?: string | null;
}

export interface PortfolioDetail {
  portfolioId: string;
  portfolioName: string;
  nickname: string;
  currentRank: number;
  totalReturn: number;
  totalReturnAmount: number;
  initialCapital: number;
  totalValue: number;
  currentCash: number;
  holdings: Holding[];
  recentTrades: Trade[];
}

export interface Holding {
  stockCode: string;
  stockName: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  profit: number;
  profitRate: number;
  assetType?: string;
}

export interface Trade {
  date: string;
  type: '매수' | '매도';
  stockName: string;
  quantity: number;
  price: number;
  amount: number;
}

export const getRankings = async (
  _rankingType: RankingType = 'all',
): Promise<RankingResponse> => {
  const response = await apiClient.get('/api/rankings');
  return response.data.data;
};

export const getPortfolioDetail = async (
  portfolioId: string
): Promise<PortfolioDetail> => {
  const response = await apiClient.get(`/api/rankings/portfolios/${portfolioId}`);
  return response.data.data;
};

export const getMyRanking = async (): Promise<{
  currentRank: number;
  previousRank: number;
  totalReturn: number;
  totalValue: number;
}> => {
  const response = await apiClient.get('/api/rankings/me');
  return response.data.data;
};

export const rankingService = {
  getRankings,
  getPortfolioDetail,
  getMyRanking,
};

