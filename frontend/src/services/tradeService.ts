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
  assetType?: 'STOCK' | 'CRYPTO' | 'US_STOCK' | 'ETF';
}

export interface OrderRequest {
  stockCode: string;
  stockName: string;
  orderType: 'BUY' | 'SELL';
  orderMethod: 'MARKET' | 'LIMIT';
  quantity: number;
  price?: number; // 지정가 주문일 때만 필요
  assetType?: 'STOCK' | 'CRYPTO' | 'US_STOCK' | 'ETF';
  memo?: string;
  clientOrderId?: string; // 멱등성 키 — 동일 키 재전송 시 이중 체결 방지
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
  status: 'PENDING' | 'FILLED' | 'CANCELLED'; // 백엔드가 실제 내보내는 3개 상태(부분체결 미지원)
  filledQuantity: number;
  filledPrice: number | null;
  assetType?: string;
  memo?: string;
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
  memo?: string;
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
  usdKrwRate?: number; // USD→KRW 환율 (응답 전용, 통화 분리/환산 표시에 사용)
}

export interface PortfolioSnapshot {
  date: string;         // "2026-03-09"
  totalValue: number;
  cashBalance: number;
  holdingsValue: number;
  turtleAllocated: number;
  returnRate: number;
}

export interface PriceAlert {
  id: string;
  stockCode: string;
  stockName: string;
  assetType?: string;
  condition: string;          // ABOVE | BELOW | CHANGE_UP | CHANGE_DOWN
  targetPrice?: number;
  changePercent?: number;
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
// 주의: change 는 '전일 대비 절대값'(원/달러)이다(changeRate 가 % 율).
//   따라서 previousClose = price - change 는 정확하나,
//   high/low/open 은 prices 엔드포인트가 일중 고저·시가를 주지 않아 현재가로 합성한 placeholder다.
//   캔들/일중 고저 표시 용도로는 신뢰하지 말 것(별도 candlestick 호출 필요).
const mapMarketToStockPrice = (item: {
  symbol: string;
  name: string;
  price: number;
  change: number;     // 전일 대비 절대값(원/달러)
  changeRate: number; // 전일 대비율(%)
  volume: number;
}, assetType: 'STOCK' | 'CRYPTO' | 'US_STOCK' | 'ETF' = 'CRYPTO'): StockPrice => ({
  stockCode: item.symbol,
  stockName: item.name,
  currentPrice: item.price,
  change: item.change,
  changeRate: item.changeRate,
  volume: item.volume,
  high: item.price,           // placeholder(일중 고가 미제공)
  low: item.price,            // placeholder(일중 저가 미제공)
  open: item.price - item.change,           // placeholder(시가 미제공 → 전일종가로 근사)
  previousClose: item.price - item.change,  // 전일종가 = 현재가 - 전일대비
  timestamp: new Date().toISOString(),
  assetType,
});

// /api/market/prices 응답 항목 타입 (mapMarketToStockPrice 입력과 동일)
type MarketPriceItem = Parameters<typeof mapMarketToStockPrice>[0];

// API 서비스
export const tradeService = {
  // 실시간 가격 조회 (빗썸 가상화폐)
  getStockPrice: async (stockCode: string): Promise<StockPrice> => {
    const response = await apiClient.get('/api/market/prices', {
      params: { type: 'CRYPTO' },
    });
    const list: MarketPriceItem[] = response.data;
    const found = list.find((p) => p.symbol === stockCode);
    if (!found) throw new Error('종목을 찾을 수 없습니다: ' + stockCode);
    return mapMarketToStockPrice(found);
  },

  // 종목 목록 조회 (빗썸 가상화폐)
  getStockList: async (): Promise<StockPrice[]> => {
    const response = await apiClient.get('/api/market/prices', {
      params: { type: 'CRYPTO' },
    });
    const list: MarketPriceItem[] = response.data;
    return list.map((item) => mapMarketToStockPrice(item, 'CRYPTO'));
  },

  // 주식 종목 목록 조회 (KIS 인기 30종목)
  getKrxStockList: async (): Promise<StockPrice[]> => {
    const response = await apiClient.get('/api/market/prices', {
      params: { type: 'STOCK' },
    });
    const list: MarketPriceItem[] = response.data;
    return list.map((item) => mapMarketToStockPrice(item, 'STOCK'));
  },

  // 미국주식 종목 목록 조회 (인기 30종목)
  getUsStockList: async (): Promise<StockPrice[]> => {
    const response = await apiClient.get('/api/market/prices', {
      params: { type: 'US_STOCK' },
    });
    const list: MarketPriceItem[] = response.data;
    return list.map((item) => mapMarketToStockPrice(item, 'US_STOCK'));
  },

  // 미국 ETF 종목 목록 조회
  getEtfList: async (): Promise<StockPrice[]> => {
    const response = await apiClient.get('/api/market/prices', {
      params: { type: 'ETF' },
    });
    const list: MarketPriceItem[] = response.data;
    return list.map((item) => mapMarketToStockPrice(item, 'ETF'));
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

  // 거래 메모 수정
  updateTradeMemo: async (tradeId: string, memo: string) => {
    return apiClient.put(`/api/trades/${tradeId}/memo`, { memo });
  },

  // 가격 알림 생성
  createPriceAlert: async (data: { stockCode: string; stockName: string; assetType: string; condition: string; targetPrice?: number; changePercent?: number }) => {
    const response = await apiClient.post('/api/notifications/price-alerts', data);
    return response.data.data;
  },

  // 가격 알림 조회
  getPriceAlerts: async (): Promise<PriceAlert[]> => {
    const response = await apiClient.get('/api/notifications/price-alerts');
    return response.data.data;
  },

  // 가격 알림 삭제
  deletePriceAlert: async (alertId: string) => {
    await apiClient.delete(`/api/notifications/price-alerts/${alertId}`);
  },

  // 모의투자 초기화
  resetPortfolio: async (): Promise<Portfolio> => {
    const response = await apiClient.post('/api/portfolio/reset');
    return response.data.data;
  },

  // CSV 내보내기 - 거래 내역
  exportTradesCsv: async (): Promise<void> => {
    const response = await apiClient.get('/api/export/trades.csv', { responseType: 'blob' });
    downloadBlob(response.data, `WhaleArc_trades_${todayStr()}.csv`);
  },

  // CSV 내보내기 - 포트폴리오 리포트
  exportPortfolioCsv: async (): Promise<void> => {
    const response = await apiClient.get('/api/export/portfolio.csv', { responseType: 'blob' });
    downloadBlob(response.data, `WhaleArc_portfolio_${todayStr()}.csv`);
  },
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}
