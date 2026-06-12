import apiClient from '../utils/api';

/* 감정 거울(Emotion Mirror) — 흔들린 순간의 봉인·개봉.
   반사실: 충동(현금화/매수) vs 항로(보유/관망)를 자산 변동분으로 대조. 가정은 화면에 명시. */

export type UserChoice = 'FOLLOW_RULE' | 'FOLLOW_IMPULSE';

export interface MirrorCapture {
  id: string;
  triggerType: string;          // PANIC_DROP / FOMO_SPIKE / ...
  impulseSide: string;          // SELL / BUY
  assetSymbol: string;
  assetName: string;
  assetType: string;
  priceAtEvent: number;
  changeRateAtEvent: number;
  amountKrwAtEvent: number;     // 그 결정에 걸린 금액(원)
  userChoice: UserChoice;
  emotionNote?: string;
  emotionIntensity: number;
  capturedAt: string;
  revealAt: string;
  revealed: boolean;
  revealedAt?: string;
  priceAtReveal?: number;
  impulseOutcomePct?: number;   // 충동대로 했을 때 %
  ruleOutcomePct?: number;      // 항로대로 했을 때 %
  emotionCostPct?: number;      // 항로 − 충동 (양수=항로 옳음, 음수=충동 옳음)
  impulseWasRight?: boolean;
  pathPct?: number[];           // 이벤트→개봉 경로(%)
}

export interface CapturePayload {
  assetSymbol: string;
  assetName?: string;
  assetType?: string;
  triggerType?: string;         // 기본 PANIC_DROP
  userChoice: UserChoice;
  emotionNote?: string;
  emotionIntensity: number;     // 1~5
  priceAtEvent?: number;        // 클라이언트 fallback(서버가 시세 못 구할 때)
  changeRate?: number;
  amountKrw?: number;           // 이 결정에 걸린 금액(원)
}

export const mirrorService = {
  capture: async (p: CapturePayload): Promise<MirrorCapture> => {
    const res = await apiClient.post('/api/mirror/captures', p);
    return res.data.data;
  },
  list: async (): Promise<MirrorCapture[]> => {
    const res = await apiClient.get('/api/mirror/captures');
    return res.data.data;
  },
};
