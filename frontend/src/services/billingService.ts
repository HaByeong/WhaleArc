import apiClient from '../utils/api';

export type PaymentPlan = 'BASIC_MONTHLY' | 'PRO_MONTHLY';
export type SubscriptionStatus = 'ACTIVE' | 'PAST_DUE' | 'CANCELED';

export interface SubscriptionInfo {
  plan: PaymentPlan | null;
  status: SubscriptionStatus | null;
  cardCompany: string | null;
  cardNumberMasked: string | null;
  nextBillingDate: string | null;
}

export const billingService = {
  getSubscription: async (): Promise<SubscriptionInfo | null> => {
    const res = await apiClient.get('/api/billing/subscription');
    return res.data.data ?? null;
  },

  /** 토스 빌링 인증 성공 리다이렉트로 받은 authKey/customerKey로 카드 등록 + 구독을 시작한다. */
  register: async (authKey: string, customerKey: string, plan: PaymentPlan): Promise<SubscriptionInfo> => {
    const res = await apiClient.post('/api/billing/register', { authKey, customerKey, plan });
    return res.data.data ?? res.data;
  },

  cancel: async (): Promise<void> => {
    await apiClient.post('/api/billing/cancel');
  },
};
