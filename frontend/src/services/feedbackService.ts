import apiClient from '../utils/api';

/* 의견 보내기(피드백) — 제출 채널.
   목록 조회는 관리자 전용이므로 일반 사용자는 제출만 가능하다. */

export type FeedbackCategory = 'bug' | 'feature' | 'ui' | 'other';

export const FEEDBACK_CATEGORIES: { key: FeedbackCategory; label: string }[] = [
  { key: 'feature', label: '기능 제안' },
  { key: 'bug', label: '버그 신고' },
  { key: 'ui', label: 'UI/UX 개선' },
  { key: 'other', label: '기타' },
];

export interface CreateFeedbackPayload {
  category: FeedbackCategory;
  title: string;
  content: string;
  authorName?: string;
}

export const feedbackService = {
  createFeedback: async (payload: CreateFeedbackPayload): Promise<void> => {
    await apiClient.post('/api/feedback', {
      category: payload.category,
      title: payload.title.trim(),
      content: payload.content.trim(),
      authorName: payload.authorName || '익명 항해사',
    });
  },
};
