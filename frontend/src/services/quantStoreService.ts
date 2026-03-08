import apiClient from '../utils/api';

export interface QuantProduct {
  id: string;
  name: string;
  description: string;
  creatorId: string;
  creatorName: string;
  category: Category;
  riskLevel: RiskLevel;
  price: number;
  expectedReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  totalTrades: number;
  subscribers: number;
  tags: string[];
  targetAssets: string[];
  strategyLogic: string;
  strategyType?: 'SIMPLE' | 'TURTLE';
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type Category =
  | 'MOMENTUM'
  | 'MEAN_REVERSION'
  | 'ARBITRAGE'
  | 'TREND_FOLLOWING'
  | 'VOLATILITY'
  | 'MULTI_FACTOR';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface PurchasedAsset {
  code: string;
  quantity: number;
  purchasePrice?: number;
}

export interface AssetPerformance {
  code: string;
  name: string;
  quantity: number;
  purchasePrice: number;
  currentPrice: number;
  pnl: number;
  returnRate: number;
  // 터틀 전용
  direction?: string;
  realizedPnl?: number;
  tradeCount?: number;
  winCount?: number;
}

export interface PurchasePerformance {
  purchaseId: string;
  productName: string;
  strategyType: 'SIMPLE' | 'TURTLE';
  investmentAmount: number;
  totalCurrentValue: number;
  totalPnl: number;
  totalReturnRate: number;
  assets: AssetPerformance[];
  // 터틀 전용
  realizedPnl?: number;
  unrealizedPnl?: number;
  totalTradeCount?: number;
  totalWinCount?: number;
}

export interface ProductPurchase {
  id: string;
  userId: string;
  productId: string;
  productName: string;
  paidPrice: number;
  investmentAmount: number;
  purchasedAssets: PurchasedAsset[];
  status: 'ACTIVE' | 'EXPIRED' | 'REFUNDED';
  purchasedAt: string;
}

export const CATEGORY_LABELS: Record<Category, string> = {
  MOMENTUM: '모멘텀',
  MEAN_REVERSION: '평균회귀',
  ARBITRAGE: '차익거래',
  TREND_FOLLOWING: '추세추종',
  VOLATILITY: '변동성',
  MULTI_FACTOR: '멀티팩터',
};

export const RISK_LABELS: Record<RiskLevel, string> = {
  LOW: '안전',
  MEDIUM: '보통',
  HIGH: '공격',
};

export const RISK_COLORS: Record<RiskLevel, string> = {
  LOW: 'text-green-600 bg-green-50',
  MEDIUM: 'text-yellow-600 bg-yellow-50',
  HIGH: 'text-red-600 bg-red-50',
};

// 심볼 코드 → 한글 이름 매핑 (빗썸 상장 주요 코인)
export const CRYPTO_NAMES: Record<string, string> = {
  BTC: '비트코인', ETH: '이더리움', XRP: '리플', SOL: '솔라나',
  DOGE: '도지코인', ADA: '에이다', AVAX: '아발란체', LINK: '체인링크',
  DOT: '폴카닷', MATIC: '폴리곤', POL: '폴리곤', TRX: '트론',
  SHIB: '시바이누', ETC: '이더리움클래식', ATOM: '코스모스',
  UNI: '유니스왑', APT: '앱토스', ARB: '아비트럼', OP: '옵티미즘',
  SAND: '샌드박스', MANA: '디센트럴랜드', AXS: '엑시인피니티',
  NEAR: '니어프로토콜', ALGO: '알고랜드', FTM: '팬텀', KLAY: '클레이튼',
  XLM: '스텔라루멘', EOS: '이오스', AAVE: '에이브', BCH: '비트코인캐시',
  LTC: '라이트코인', FIL: '파일코인', ICP: '인터넷컴퓨터',
  HBAR: '헤데라', VET: '비체인', THETA: '쎄타', NEO: '네오',
  WAVES: '웨이브', ZIL: '질리카', ENJ: '엔진코인', BAT: '베이직어텐션토큰',
  QTUM: '퀀텀', ICX: '아이콘', ZRX: '제로엑스', OMG: '오엠지',
  SUI: '수이', SEI: '세이', STX: '스택스', IMX: '이뮤터블엑스',
};

/** 수량 포맷: 정수면 그대로, 소수면 유효숫자까지 표시 (최대 8자리) */
export const formatQuantity = (qty: number): string => {
  if (Number.isInteger(qty)) return qty.toLocaleString('ko-KR');
  return parseFloat(qty.toFixed(8)).toString();
};

/** 심볼 코드를 "한글명(코드)" 형태로 변환 */
export const cryptoDisplayName = (code: string): string => {
  const name = CRYPTO_NAMES[code];
  return name ? `${name}(${code})` : code;
};

export const quantStoreService = {
  async getProducts(category?: Category): Promise<QuantProduct[]> {
    const params = category ? { category } : {};
    const res = await apiClient.get('/api/store/products', { params });
    return res.data.data;
  },

  async getProduct(productId: string): Promise<QuantProduct> {
    const res = await apiClient.get(`/api/store/products/${productId}`);
    return res.data.data;
  },

  async purchaseProduct(productId: string, investmentAmount: number): Promise<ProductPurchase> {
    const res = await apiClient.post(`/api/store/products/${productId}/purchase`, { investmentAmount });
    return res.data.data;
  },

  async cancelPurchase(purchaseId: string): Promise<ProductPurchase> {
    const res = await apiClient.delete(`/api/store/my-purchases/${purchaseId}`);
    return res.data.data;
  },

  async getMyPurchases(): Promise<{ purchases: ProductPurchase[]; purchasedProductIds: string[] }> {
    const res = await apiClient.get('/api/store/my-purchases');
    return {
      purchases: res.data.data || [],
      purchasedProductIds: res.data.purchasedProductIds || [],
    };
  },

  async getMyPurchasesPerformance(): Promise<PurchasePerformance[]> {
    const res = await apiClient.get('/api/store/my-purchases/performance');
    return res.data.data || [];
  },
};
