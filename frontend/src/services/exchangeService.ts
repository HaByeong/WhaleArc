import apiClient from '../utils/api';

// 타입 정의
export type ExchangeType = 'KIS' | 'UPBIT' | 'BITGET';

export interface ExchangeAccount {
  id: string;
  userId: string;
  exchangeType: ExchangeType;
  apiKey: string;
  secretKey: string;
  appSecret?: string;
  accountNumber?: string;
  connected: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExchangeAccountRequest {
  exchangeType: ExchangeType;
  apiKey: string;
  secretKey: string;
  appSecret?: string;
  accountNumber?: string;
}

export interface ExchangeHolding {
  assetCode: string;
  assetName: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  marketValue: number;
  profitLoss: number;
  returnRate: number;
  currency?: 'KRW' | 'USD';  // 단가/평가 표시 통화 (KIS 해외주식=USD, 그 외 KRW). 합계는 항상 KRW 환산
}

export interface ExchangePortfolio {
  exchangeType: ExchangeType;
  connected: boolean;
  totalValue: number;
  totalProfitLoss: number;
  totalReturnRate: number;
  cashBalance: number;
  foreignCashKrw?: number;  // 외화예수금(KRW 환산) — 통화 분리 표시용
  foreignCashUsd?: number;  // 외화예수금(USD 원금) — 통화 분리 표시용
  holdings: ExchangeHolding[];
  usdtKrwRate?: number;  // BITGET: USDT→KRW 환산 환율 / KIS: USD→KRW 환율 (0/미설정이면 미표시)
  fetchOk?: boolean;     // 거래소 API 조회 성공 여부 (false면 실패 → 빈 계좌와 구분, 에러 UI 표시)
}

export interface ExchangeTransaction {
  orderId: string;
  stockCode: string;
  stockName: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  totalAmount: number;
  executedAt: string;  // "20260604 153012"
  status: string;      // FILLED / PENDING
}

// API 서비스
export const exchangeService = {
  // API 키 등록/수정
  saveAccount: async (request: ExchangeAccountRequest): Promise<ExchangeAccount> => {
    const response = await apiClient.post('/api/exchange/accounts', request);
    return response.data.data;
  },

  // 모든 거래소 계정 조회
  getAccounts: async (): Promise<ExchangeAccount[]> => {
    const response = await apiClient.get('/api/exchange/accounts');
    return response.data.data;
  },

  // 특정 거래소 계정 조회
  getAccount: async (exchangeType: ExchangeType): Promise<ExchangeAccount | null> => {
    const response = await apiClient.get(`/api/exchange/accounts/${exchangeType}`);
    return response.data.data;
  },

  // 거래소 계정 삭제
  deleteAccount: async (exchangeType: ExchangeType): Promise<void> => {
    await apiClient.delete(`/api/exchange/accounts/${exchangeType}`);
  },

  // 거래소 포트폴리오(보유 자산) 조회
  getPortfolio: async (exchangeType: ExchangeType): Promise<ExchangePortfolio> => {
    const response = await apiClient.get(`/api/exchange/portfolio/${exchangeType}`);
    return response.data.data;
  },

  // 거래소 체결 내역 조회 (KIS 주식, 기본 30일)
  getTransactions: async (exchangeType: ExchangeType, days = 30): Promise<ExchangeTransaction[]> => {
    const response = await apiClient.get(`/api/exchange/transactions/${exchangeType}`, { params: { days } });
    return response.data.data;
  },
};
