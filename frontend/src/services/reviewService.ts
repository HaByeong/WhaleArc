import apiClient from '../utils/api';

// 거래 복기 노트 — 청산 거래(reviewKey)별 체크리스트/메모. 서버 보관(기기 간 동기화).
export interface TradeReviewNote {
  checks: Record<string, boolean>; // 원칙 텍스트 → 체크 여부
  memo: string;
}

export const reviewService = {
  // 내 복기 노트 전체 → reviewKey로 매핑
  getReviews: async (): Promise<Record<string, TradeReviewNote>> => {
    const res = await apiClient.get('/api/trade-reviews');
    const list: { reviewKey: string; checks?: Record<string, boolean>; memo?: string }[] = res.data?.data || [];
    const map: Record<string, TradeReviewNote> = {};
    for (const r of list) map[r.reviewKey] = { checks: r.checks || {}, memo: r.memo || '' };
    return map;
  },

  // 청산 거래별 체크/메모 업서트
  saveReview: async (reviewKey: string, note: TradeReviewNote): Promise<void> => {
    await apiClient.put(`/api/trade-reviews/${encodeURIComponent(reviewKey)}`, note);
  },
};
