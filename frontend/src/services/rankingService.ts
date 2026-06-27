import apiClient from '../utils/api';

export type RankingType = 'all' | 'daily' | 'weekly' | 'monthly';

export interface RankingResponse {
  rankingType: RankingType;
  snapshotDate: string;
  totalCount: number;
  page: number;
  size: number;
  totalPages: number;
  avgReturn: number;
  positiveCount: number;
  negativeCount: number;
  rankings: RankingEntry[];
  myRanking?: RankingEntry | null;
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
  totalReturn: number;        // 절대 금액(원금·총자산·수익금액)은 프라이버시상 서버에서 비공개
  stockCount: number;
  cryptoCount: number;
  routeName: string | null;
  routeStrategyType: string | null;
  routeReturnRate: number | null;
  routeDescription: string | null;
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

// NOTE: 백엔드(RankingService)는 전체 포트폴리오로 글로벌 rankMap을 먼저 만든 뒤 페이지를 잘라
//       각 entry.rank 에 "전체 기준 순위"를 채운다. 따라서 page=1·size=20 이면 rank 는 21~40 이다.
//       (페이지별 1~20 지역순위가 아님) — UI 의 순위 표시는 이 글로벌 rank 를 그대로 사용한다.
export const getRankings = async (
  rankingType: RankingType = 'all',
  page = 0,
  size = 20,
): Promise<RankingResponse> => {
  const response = await apiClient.get('/api/rankings', { params: { type: rankingType, page, size } });
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

