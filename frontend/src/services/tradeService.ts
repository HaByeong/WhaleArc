import apiClient from '../utils/api';

// 타입 정의
export interface StockPrice {
  stockCode: string;
  stockName: string;
  currentPrice: number;
  change: number;
  changeRate: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  timestamp: string;
  assetType?: 'STOCK' | 'CRYPTO';
}

export interface OrderRequest {
  stockCode: string;
  stockName: string;
  orderType: 'BUY' | 'SELL';
  orderMethod: 'MARKET' | 'LIMIT';
  quantity: number;
  price?: number; // 지정가 주문일 때만 필요
  assetType?: 'STOCK' | 'CRYPTO';
}

export interface Order {
  id: string;
  userId: string;
  stockCode: string;
  stockName: string;
  orderType: 'BUY' | 'SELL';
  orderMethod: 'MARKET' | 'LIMIT';
  quantity: number;
  price: number;
  status: 'PENDING' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELLED';
  filledQuantity: number;
  filledPrice: number | null;
  assetType?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Trade {
  id: string;
  orderId: string;
  stockCode: string;
  stockName: string;
  orderType: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  totalAmount: number;
  commission: number;
  netAmount: number;
  assetType?: string;
  executedAt: string;
}

export interface Holding {
  stockCode: string;
  stockName: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  marketValue: number;
  profitLoss: number;
  returnRate: number;
  assetType?: string;
}

export interface Portfolio {
  id: string;
  userId: string;
  cashBalance: number;
  initialCash: number;
  turtleAllocated: number;
  totalValue: number;
  returnRate: number;
  holdings: Holding[];
  representativePurchaseId?: string | null;
}

export interface PortfolioSnapshot {
  date: string;         // "2026-03-09"
  totalValue: number;
  cashBalance: number;
  holdingsValue: number;
  turtleAllocated: number;
  returnRate: number;
}

export const portfolioService = {
  setRepresentativeRoute: async (purchaseId: string | null): Promise<void> => {
    await apiClient.put('/api/portfolio/representative-route', { purchaseId });
  },
  getHistory: async (days: number = 30): Promise<PortfolioSnapshot[]> => {
    const response = await apiClient.get('/api/portfolio/history', { params: { days } });
    return response.data.data;
  },
};

// 빗썸 마켓 데이터 → StockPrice 변환
const mapMarketToStockPrice = (item: {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changeRate: number;
  volume: number;
}, assetType: 'STOCK' | 'CRYPTO' = 'CRYPTO'): StockPrice => ({
  stockCode: item.symbol,
  stockName: item.name,
  currentPrice: item.price,
  change: item.change,
  changeRate: item.changeRate,
  volume: item.volume,
  high: item.price,
  low: item.price,
  open: item.price - item.change,
  previousClose: item.price - item.change,
  timestamp: new Date().toISOString(),
  assetType,
});

// API 서비스
export const tradeService = {
  // 실시간 가격 조회 (빗썸 코인)
  getStockPrice: async (stockCode: string): Promise<StockPrice> => {
    const response = await apiClient.get('/api/market/prices', {
      params: { type: 'CRYPTO' },
    });
    const list: any[] = response.data;
    const found = list.find((p) => p.symbol === stockCode);
    if (!found) throw new Error('종목을 찾을 수 없습니다: ' + stockCode);
    return mapMarketToStockPrice(found);
  },

  // 종목 목록 조회 (빗썸 코인)
  getStockList: async (): Promise<StockPrice[]> => {
    const response = await apiClient.get('/api/market/prices', {
      params: { type: 'CRYPTO' },
    });
    const list: any[] = response.data;
    return list.map((item) => mapMarketToStockPrice(item, 'CRYPTO'));
  },

  // 주식 종목 목록 조회 (KIS 인기 30종목)
  getKrxStockList: async (): Promise<StockPrice[]> => {
    const response = await apiClient.get('/api/market/prices', {
      params: { type: 'STOCK' },
    });
    const list: any[] = response.data;
    return list.map((item) => mapMarketToStockPrice(item, 'STOCK'));
  },

  // 주식 종목 검색 (전체 KRX)
  searchKrxStocks: async (keyword: string): Promise<{ code: string; name: string; market: string }[]> => {
    const response = await apiClient.get('/api/market/stock/search', {
      params: { keyword },
    });
    return response.data;
  },

  // 주식 개별 현재가 조회
  getKrxStockPrice: async (code: string): Promise<StockPrice> => {
    const response = await apiClient.get(`/api/market/stock/price/${code}`);
    const data = response.data;
    return mapMarketToStockPrice(data, 'STOCK');
  },

  // 주문 생성
  createOrder: async (order: OrderRequest): Promise<Order> => {
    const response = await apiClient.post('/api/orders', order);
    return response.data.data;
  },

  // 주문 내역 조회
  getOrders: async (): Promise<Order[]> => {
    const response = await apiClient.get('/api/orders');
    return response.data.data;
  },

  // 체결 내역 조회
  getTrades: async (): Promise<Trade[]> => {
    const response = await apiClient.get('/api/trades');
    return response.data.data;
  },

  // 포트폴리오 조회
  getPortfolio: async (): Promise<Portfolio> => {
    const response = await apiClient.get('/api/portfolio');
    return response.data.data;
  },

  // 주문 취소
  cancelOrder: async (orderId: string): Promise<void> => {
    await apiClient.delete(`/api/orders/${orderId}`);
  },

  // 모의투자 초기화
  resetPortfolio: async (): Promise<Portfolio> => {
    const response = await apiClient.post('/api/portfolio/reset');
    return response.data.data;
  },
};
