import apiClient from '../utils/api';
import type { Indicator, Condition } from './strategyService';

// ── 타입 정의 ──

export type AccountMode = 'PAPER' | 'LIVE';
export type BrokerType = 'MOCK' | 'KIS' | 'UPBIT' | 'BITGET';
export type DeploymentStatus = 'RUNNING' | 'PAUSED' | 'STOPPED' | 'ERROR';
export type PositionDirection = 'NONE' | 'LONG';

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
}

export interface CreateDeploymentRequest {
  strategyId?: string;
  strategyName?: string;
  // 프리셋/직접 입력 모드 (strategyId 없을 때)
  indicators?: Indicator[];
  entryConditions?: Condition[];
  exitConditions?: Condition[];
  targetAssets?: string[];
  assetType?: string;
  interval?: string;
  allocatedCash: number;
  accountMode?: AccountMode;
  brokerType?: BrokerType;
  stopLossPct?: number;
  takeProfitPct?: number;
  trailingStopPct?: number;
  dailyLossLimit?: number;
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

  // 수동 즉시 평가 (정시 cron 대기 없이 1회 평가)
  evaluateNow: async (deploymentId: string): Promise<Deployment> => {
    const response = await apiClient.post(`/api/live/deployments/${deploymentId}/evaluate`);
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
};
