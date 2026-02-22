import apiClient from '../utils/api';

// 타입 정의
export interface Strategy {
  id: string;
  name: string;
  description: string;
  indicators: Indicator[];
  entryConditions: Condition[];
  exitConditions: Condition[];
  createdAt: string;
  updatedAt: string;
}

export interface Indicator {
  type: 'RSI' | 'MACD' | 'MA' | 'BOLLINGER_BANDS';
  parameters: Record<string, number>;
}

export interface Condition {
  indicator: string;
  operator: 'GT' | 'LT' | 'EQ' | 'GTE' | 'LTE'; // Greater Than, Less Than, Equal, etc.
  value: number;
  logic: 'AND' | 'OR';
}

export interface BacktestRequest {
  strategyId: string;
  stockCode: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
}

export interface BacktestResult {
  id: string;
  strategyId: string;
  strategyName: string;
  stockCode: string;
  stockName: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  finalValue: number;
  totalReturn: number;
  totalReturnRate: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  totalTrades: number;
  profitableTrades: number;
  losingTrades: number;
  dailyReturns: DailyReturn[];
  equityCurve: EquityPoint[];
}

export interface DailyReturn {
  date: string;
  return: number;
  cumulativeReturn: number;
  portfolioValue: number;
}

export interface EquityPoint {
  date: string;
  value: number;
}

export interface IndicatorData {
  date: string;
  price: number;
  value: number;
}

// API 서비스
export const strategyService = {
  // 전략 목록 조회
  getStrategies: async (): Promise<Strategy[]> => {
    const response = await apiClient.get('/api/strategies');
    return response.data.data;
  },

  // 전략 생성
  createStrategy: async (strategy: Omit<Strategy, 'id' | 'createdAt' | 'updatedAt'>): Promise<Strategy> => {
    const response = await apiClient.post('/api/strategies', strategy);
    return response.data.data;
  },

  // 전략 수정
  updateStrategy: async (strategyId: string, strategy: Partial<Strategy>): Promise<Strategy> => {
    const response = await apiClient.put(`/api/strategies/${strategyId}`, strategy);
    return response.data.data;
  },

  // 전략 삭제
  deleteStrategy: async (strategyId: string): Promise<void> => {
    await apiClient.delete(`/api/strategies/${strategyId}`);
  },

  // 백테스팅 실행
  runBacktest: async (request: BacktestRequest): Promise<BacktestResult> => {
    const response = await apiClient.post('/api/strategies/backtest', request);
    return response.data.data;
  },

  // 백테스팅 결과 조회
  getBacktestResult: async (resultId: string): Promise<BacktestResult> => {
    const response = await apiClient.get(`/api/strategies/backtest/${resultId}`);
    return response.data.data;
  },

  // 기술적 지표 데이터 조회
  getIndicatorData: async (
    stockCode: string,
    indicatorType: string,
    startDate: string,
    endDate: string
  ): Promise<IndicatorData[]> => {
    const response = await apiClient.get(`/api/indicators/${stockCode}`, {
      params: {
        type: indicatorType,
        startDate,
        endDate,
      },
    });
    return response.data.data;
  },
};


