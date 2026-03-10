import apiClient from '../utils/api';

// 타입 정의
export interface Strategy {
  id: string;
  name: string;
  description: string;
  indicators: Indicator[];
  entryConditions: Condition[];
  exitConditions: Condition[];
  targetAssets: string[];
  targetAssetNames?: Record<string, string>;
  assetType: 'CRYPTO' | 'STOCK' | 'MIXED';
  strategyLogic: string;
  applied: boolean;
  appliedSuccessCount?: number;
  appliedTotalCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Indicator {
  type: 'RSI' | 'MACD' | 'MA' | 'EMA' | 'BOLLINGER_BANDS' | 'STOCHASTIC' | 'ATR' | 'CCI' | 'WILLIAMS_R' | 'OBV';
  parameters: Record<string, number>;
}

export interface Condition {
  indicator: string;
  operator: 'GT' | 'LT' | 'EQ' | 'GTE' | 'LTE'; // Greater Than, Less Than, Equal, etc.
  value: number;
  logic: 'AND' | 'OR';
}

export interface BacktestRequest {
  strategyId?: string;
  stockCode: string;
  stockName?: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  stopLossPercent?: number;
  takeProfitPercent?: number;
  trailingStopPercent?: number;
  slippagePercent?: number;
  positionSizing?: string;
  positionValue?: number;
  commissionRate?: number;
  assetType?: string;
  // 매매 방향 & 다중 포지션
  tradeDirection?: 'LONG_ONLY' | 'SHORT_ONLY' | 'LONG_SHORT';
  maxPositions?: number;
  // 종목 분석 모드: 직접 조건 입력
  indicators?: Indicator[];
  entryConditions?: Condition[];
  exitConditions?: Condition[];
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
  trades?: BacktestTrade[];
  buyHoldReturnRate?: number;
  buyHoldCurve?: EquityPoint[];
  // 고급 지표
  profitFactor?: number;
  sortinoRatio?: number;
  cagr?: number;
  avgWin?: number;
  avgLoss?: number;
  avgWinRate?: number;
  avgLossRate?: number;
  maxConsecutiveWins?: number;
  maxConsecutiveLosses?: number;
  avgHoldingDays?: number;
  maxDrawdownDuration?: number;
  recoveryFactor?: number;
  payoffRatio?: number;
  // 차트 데이터
  drawdownCurve?: EquityPoint[];
  priceData?: PricePoint[];
  // 지표 요약 (0-trade 디버깅용)
  indicatorSummary?: Record<string, { min: number; max: number; avg: number; last: number }>;
}

export interface BacktestTrade {
  date: string;
  type: 'BUY' | 'SELL' | 'SHORT' | 'COVER';
  price: number;
  quantity: number;
  pnl: number;
  pnlPercent?: number;
  reason: string;
  holdingDays?: number;
  balance?: number;
}

export interface PricePoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface DailyReturn {
  date: string;
  dailyReturn: number;
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
  // 복합 지표 추가 필드
  value2?: number;  // MACD signal, Bollinger upper, Stochastic D, Ichimoku kijun
  value3?: number;  // MACD histogram, Bollinger lower, Ichimoku senkouA
  value4?: number;  // Ichimoku senkouB
  value5?: number;  // Ichimoku chikou
}

// 백엔드 지표 응답 원본
interface IndicatorRawResponse {
  type: string;
  data: Record<string, number[]>;
  parameters: Record<string, number>;
}

// API 서비스
export const strategyService = {
  // 전략 목록 조회
  getStrategies: async (): Promise<Strategy[]> => {
    const response = await apiClient.get('/api/strategies');
    return response.data.data;
  },

  // 전략 생성
  createStrategy: async (strategy: Omit<Strategy, 'id' | 'createdAt' | 'updatedAt' | 'applied'>): Promise<Strategy> => {
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

  // 전략을 포트폴리오에 적용
  applyStrategy: async (strategyId: string, investmentAmount: number): Promise<Strategy> => {
    const response = await apiClient.post(`/api/strategies/${strategyId}/apply`, { investmentAmount });
    return response.data.data;
  },

  // 전략 적용 해제
  unapplyStrategy: async (strategyId: string): Promise<Strategy> => {
    const response = await apiClient.post(`/api/strategies/${strategyId}/unapply`);
    return response.data.data;
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

  // 기술적 지표 데이터 조회 (캔들스틱 + 지표 API 병렬 호출)
  getIndicatorData: async (
    stockCode: string,
    indicatorType: string,
    assetType?: string,
  ): Promise<IndicatorData[]> => {
    const interval = assetType === 'STOCK' ? '1d' : '24h';
    const params: Record<string, string> = { interval, indicators: indicatorType };
    if (assetType) params.assetType = assetType;

    const [candleRes, indicatorRes] = await Promise.all([
      apiClient.get(`/api/market/candlestick/${stockCode}`, { params: { interval, assetType } }),
      apiClient.get(`/api/market/indicators/${stockCode}`, { params }),
    ]);

    const candles: { time: number; close: number }[] = candleRes.data;
    const indicators: IndicatorRawResponse[] = indicatorRes.data;
    const ind = indicators[0];
    if (!ind || candles.length === 0) return [];

    return candles.map((c, i) => {
      const date = new Date(c.time * 1000).toISOString().split('T')[0];
      const price = c.close;
      const entry: IndicatorData = { date, price, value: 0 };

      // 지표 타입별 데이터 매핑
      const d = ind.data;
      if (ind.type === 'MACD') {
        entry.value = d.macd?.[i] ?? NaN;
        entry.value2 = d.signal?.[i] ?? NaN;
        entry.value3 = d.histogram?.[i] ?? NaN;
      } else if (ind.type === 'BOLLINGER') {
        entry.value = d.middle?.[i] ?? NaN;
        entry.value2 = d.upper?.[i] ?? NaN;
        entry.value3 = d.lower?.[i] ?? NaN;
      } else if (ind.type === 'STOCHASTIC') {
        entry.value = d.k?.[i] ?? NaN;
        entry.value2 = d.d?.[i] ?? NaN;
      } else if (ind.type === 'ICHIMOKU') {
        entry.value = d.tenkan?.[i] ?? NaN;
        entry.value2 = d.kijun?.[i] ?? NaN;
        entry.value3 = d.senkouA?.[i] ?? NaN;
        entry.value4 = d.senkouB?.[i] ?? NaN;
        entry.value5 = d.chikou?.[i] ?? NaN;
      } else {
        entry.value = d.values?.[i] ?? NaN;
      }

      return entry;
    }).filter(e => !isNaN(e.value));
  },
};


