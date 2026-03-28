import apiClient from '../utils/api';

// ── 타입 ──

export interface VirtCredentialRequest {
  appkey: string;
  appsecret: string;
  accountNumber: string;
  accountProductCode: string;
}

export interface VirtCredentialInfo {
  connected: boolean;
  appkey?: string;
  accountNumber?: string;
  accountProductCode?: string;
}

export interface VirtHolding {
  stockCode: string;
  stockName: string;
  quantity: number;  // 주식: 정수, 코인: 소수점
  averagePrice: number;
  currentPrice: number;
  marketValue: number;
  profitLoss: number;
  returnRate: number;
}

export interface VirtPortfolio {
  totalValue: number;
  cashBalance: number;
  holdingsValue: number;
  totalPnl: number;
  returnRate: number;
  usdtKrwRate?: number;
  holdings: VirtHolding[];
}

export interface VirtTrade {
  orderId: string;
  stockCode: string;
  stockName: string;
  orderType: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  totalAmount: number;
  executedAt: string;
  status: string;
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  totalValue?: number;
  holdingsCount?: number;
}

// ── API ──

export const virtService = {
  // 자격증명 저장
  saveCredential: async (data: VirtCredentialRequest): Promise<void> => {
    await apiClient.post('/api/virt/credentials', data);
  },

  // 연결 상태 확인
  getCredentialInfo: async (): Promise<VirtCredentialInfo> => {
    const res = await apiClient.get('/api/virt/credentials');
    return res.data;
  },

  // 연결 해제
  deleteCredential: async (): Promise<void> => {
    await apiClient.delete('/api/virt/credentials');
  },

  // 연결 테스트
  testConnection: async (): Promise<TestConnectionResult> => {
    const res = await apiClient.post('/api/virt/test-connection');
    return res.data;
  },

  // 실계좌 포트폴리오
  getPortfolio: async (): Promise<VirtPortfolio> => {
    const res = await apiClient.get('/api/virt/portfolio');
    return res.data;
  },

  // 체결내역
  getTrades: async (days: number = 30): Promise<VirtTrade[]> => {
    const res = await apiClient.get('/api/virt/trades', { params: { days } });
    return res.data;
  },

  // ── 업비트 (코인) ──

  saveUpbitCredential: async (data: { accessKey: string; secretKey: string }): Promise<void> => {
    await apiClient.post('/api/virt/upbit/credentials', data);
  },

  getUpbitCredentialInfo: async (): Promise<VirtCredentialInfo> => {
    const res = await apiClient.get('/api/virt/upbit/credentials');
    return res.data;
  },

  deleteUpbitCredential: async (): Promise<void> => {
    await apiClient.delete('/api/virt/upbit/credentials');
  },

  testUpbitConnection: async (): Promise<TestConnectionResult> => {
    const res = await apiClient.post('/api/virt/upbit/test-connection');
    return res.data;
  },

  getUpbitPortfolio: async (): Promise<VirtPortfolio> => {
    const res = await apiClient.get('/api/virt/upbit/portfolio');
    return res.data;
  },

  // ── 비트겟 (코인) ──

  saveBitgetCredential: async (data: { apiKey: string; secretKey: string; passphrase: string }): Promise<void> => {
    await apiClient.post('/api/virt/bitget/credentials', data);
  },

  getBitgetCredentialInfo: async (): Promise<VirtCredentialInfo> => {
    const res = await apiClient.get('/api/virt/bitget/credentials');
    return res.data;
  },

  deleteBitgetCredential: async (): Promise<void> => {
    await apiClient.delete('/api/virt/bitget/credentials');
  },

  testBitgetConnection: async (): Promise<TestConnectionResult> => {
    const res = await apiClient.post('/api/virt/bitget/test-connection');
    return res.data;
  },

  getBitgetPortfolio: async (): Promise<VirtPortfolio> => {
    const res = await apiClient.get('/api/virt/bitget/portfolio');
    return res.data;
  },
};
