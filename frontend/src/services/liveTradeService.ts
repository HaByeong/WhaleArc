import apiClient from '../utils/api';
import type { Indicator, Condition } from './strategyService';

// ── 타입 정의 ──

export type AccountMode = 'PAPER' | 'LIVE';
export type BrokerType = 'MOCK' | 'KIS' | 'UPBIT' | 'BITGET';
export type MarketType = 'SPOT' | 'FUTURES';
export type DeploymentStatus = 'RUNNING' | 'PAUSED' | 'STOPPED' | 'ERROR';
export type PositionDirection = 'NONE' | 'LONG' | 'SHORT';

/** 카드 '최근 신호' 표시용 최근 주문 요약. */
export interface LastOrderSummary {
  side: 'BUY' | 'SELL' | 'SHORT' | 'COVER';
  status: 'FILLED' | 'REJECTED' | 'SUBMITTED';
  reason: string;
  createdAt: string;
}

export interface LivePosition {
  symbol: string;
  assetType?: string;
  direction: PositionDirection;
  avgPrice?: number;
  quantity?: number;
  allocatedCash?: number;
  stopLoss?: number;
  realizedPnl?: number;
  tradeCount: number;
  winCount: number;
}

export interface Deployment {
  id: string;
  strategyId?: string;
  strategyName: string;
  targetAssets: string[];
  assetType?: string;
  interval: string;
  accountMode: AccountMode;
  brokerType: BrokerType;
  marketType?: MarketType;
  leverage?: number;
  status: DeploymentStatus;
  allocatedCash: number;
  stopLossPct?: number;
  takeProfitPct?: number;
  trailingStopPct?: number;
  dailyLossLimit?: number;
  todayRealizedPnl?: number;
  realizedPnl: number;
  tradeCount: number;
  winCount: number;
  positions: LivePosition[];
  lastEvaluatedAt?: string;
  createdAt?: string;
  // ── 카드 표시용 확장 필드 ──
  todayFilledCount?: number;        // 오늘(KST) 체결 수
  lastOrder?: LastOrderSummary | null;  // 가장 최근 주문(최근 신호)
  equitySpark?: number[];           // 일별 평가손익률(%) 시계열 — 스파크라인
}

export interface CreateDeploymentRequest {
  strategyId?: string;
  strategyName?: string;
  // 프리셋/직접 입력 모드 (strategyId 없을 때)
  indicators?: Indicator[];
  entryConditions?: Condition[];
  exitConditions?: Condition[];
  // 독립 양방향(LONG_SHORT_FLAT) + 피라미딩
  shortEntryConditions?: Condition[];
  shortExitConditions?: Condition[];
  tradeDirection?: string;
  maxUnits?: number;
  pyramidMode?: string;
  targetAssets?: string[];
  assetType?: string;
  interval?: string;
  allocatedCash: number;
  accountMode?: AccountMode;
  brokerType?: BrokerType;
  marketType?: MarketType;
  leverage?: number;
  stopLossPct?: number;
  takeProfitPct?: number;
  trailingStopPct?: number;
  dailyLossLimit?: number;
}

// ── 실행 로그 타입 ──

export interface LiveOrderLog {
  id: string;
  deploymentId: string;
  symbol: string;
  assetType?: string;
  side: 'BUY' | 'SELL' | 'SHORT' | 'COVER';
  quantity: number;
  price: number;
  clientOrderId: string;
  brokerOrderId?: string;
  status: 'FILLED' | 'REJECTED' | 'SUBMITTED';
  reason: string;
  createdAt: string;
}

// ── API 서비스 ──

export const liveTradeService = {
  // 내 배포 목록
  getDeployments: async (): Promise<Deployment[]> => {
    const response = await apiClient.get('/api/live/deployments');
    return response.data.data;
  },

  // 배포 생성 (자동매매 시작)
  createDeployment: async (request: CreateDeploymentRequest): Promise<Deployment> => {
    const response = await apiClient.post('/api/live/deployments', request);
    return response.data.data;
  },

  start: async (deploymentId: string): Promise<Deployment> => {
    const response = await apiClient.post(`/api/live/deployments/${deploymentId}/start`);
    return response.data.data;
  },

  pause: async (deploymentId: string): Promise<Deployment> => {
    const response = await apiClient.post(`/api/live/deployments/${deploymentId}/pause`);
    return response.data.data;
  },

  stop: async (deploymentId: string): Promise<Deployment> => {
    const response = await apiClient.post(`/api/live/deployments/${deploymentId}/stop`);
    return response.data.data;
  },

  // 배포 삭제 (가동 중이면 백엔드가 거부 — 먼저 정지 필요)
  deleteDeployment: async (deploymentId: string): Promise<void> => {
    await apiClient.delete(`/api/live/deployments/${deploymentId}`);
  },

  // 수동 즉시 평가 (정시 cron 대기 없이 1회 평가)
  evaluateNow: async (deploymentId: string): Promise<Deployment> => {
    const response = await apiClient.post(`/api/live/deployments/${deploymentId}/evaluate`);
    return response.data.data;
  },

  // 수동 즉시 청산 (보유 포지션 전부 시장가 청산)
  closeNow: async (deploymentId: string): Promise<Deployment> => {
    const response = await apiClient.post(`/api/live/deployments/${deploymentId}/close`);
    return response.data.data;
  },

  // 전역 킬스위치
  getKillSwitch: async (): Promise<boolean> => {
    const response = await apiClient.get('/api/live/kill-switch');
    return !!response.data.data?.killSwitch;
  },

  setKillSwitch: async (engaged: boolean): Promise<boolean> => {
    const response = await apiClient.post(`/api/live/kill-switch?engaged=${engaged}`);
    return !!response.data.data?.killSwitch;
  },

  // 배포별 실행 로그 (최근 50건, 역순 정렬은 프론트에서)
  getOrders: async (deploymentId: string): Promise<LiveOrderLog[]> => {
    const response = await apiClient.get(`/api/live/deployments/${deploymentId}/orders`);
    return response.data.data || [];
  },
};
