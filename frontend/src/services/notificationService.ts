import apiClient from '../utils/api';

export interface Notification {
  id: string;
  userId: string;
  type: 'LIMIT_ORDER_FILLED' | 'MARKET_ORDER_FILLED' | 'STRATEGY_EXECUTED' | 'TURTLE_TRADE';
  title: string;
  message: string;
  read: boolean;
  metadata?: Record<string, string>;
  createdAt: string;
}

export const notificationService = {
  getNotifications: async (): Promise<Notification[]> => {
    const res = await apiClient.get('/api/notifications');
    return res.data.data ?? res.data;
  },

  getUnreadCount: async (): Promise<number> => {
    const res = await apiClient.get('/api/notifications/unread-count');
    return res.data.data ?? res.data;
  },

  markAsRead: async (id: string): Promise<void> => {
    await apiClient.put(`/api/notifications/${id}/read`);
  },

  markAllAsRead: async (): Promise<void> => {
    await apiClient.put('/api/notifications/read-all');
  },
};
