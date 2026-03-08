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
}

export interface OrderRequest {
  stockCode: string;
  stockName: string;
  orderType: 'BUY' | 'SELL';
  orderMethod: 'MARKET' | 'LIMIT';
  quantity: number;
  price?: number; // 지정가 주문일 때만 필요
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
}): StockPrice => ({
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
    return list.map(mapMarketToStockPrice);
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
};


