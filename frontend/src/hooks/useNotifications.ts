import { useState, useEffect, useCallback, useRef } from 'react';
import { notificationService, type Notification } from '../services/notificationService';
import type { ToastItem } from '../components/Toast';

/**
 * 알림 폴링 훅
 * - 30초마다 읽지 않은 알림 수를 체크
 * - 새 알림 감지 시 토스트로 표시
 */
export function useNotifications(enabled = true) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const prevUnreadRef = useRef(0);
  const initialLoadRef = useRef(true);

  const fetchUnreadCount = useCallback(async () => {
    if (!enabled) return;
    try {
      const count = await notificationService.getUnreadCount();
      setUnreadCount(count);

      // 새 알림이 생겼으면 전체 목록 조회 후 토스트 표시
      if (!initialLoadRef.current && count > prevUnreadRef.current) {
        const all = await notificationService.getNotifications();
        setNotifications(all);

        // 새로 추가된 알림만 토스트로 표시
        const newCount = count - prevUnreadRef.current;
        const newNotifs = all.filter(n => !n.read).slice(0, newCount);
        const toastType = (type: string): ToastItem['type'] => {
          switch (type) {
            case 'LIMIT_ORDER_FILLED':
            case 'MARKET_ORDER_FILLED': return 'success';
            case 'TURTLE_TRADE': return 'warning';
            case 'STRATEGY_EXECUTED': return 'info';
            default: return 'info';
          }
        };
        const newToasts: ToastItem[] = newNotifs.map(n => ({
          id: n.id,
          type: toastType(n.type),
          title: n.title,
          message: n.message,
          duration: 7000,
        }));
        setToasts(prev => [...prev, ...newToasts]);
      }

      prevUnreadRef.current = count;
      initialLoadRef.current = false;
    } catch {
      // 조용히 무시
    }
  }, [enabled]);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      setUnreadCount(prev => Math.max(0, prev - 1));
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch { /* ignore */ }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await notificationService.markAllAsRead();
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch { /* ignore */ }
  }, []);

  const refreshNotifications = useCallback(async () => {
    try {
      const [count, all] = await Promise.all([
        notificationService.getUnreadCount(),
        notificationService.getNotifications(),
      ]);
      setUnreadCount(count);
      setNotifications(all);
      prevUnreadRef.current = count;
    } catch { /* ignore */ }
  }, []);

  // 초기 로드 + 30초 폴링
  useEffect(() => {
    if (!enabled) return;
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30_000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount, enabled]);

  return {
    unreadCount,
    notifications,
    toasts,
    dismissToast,
    markAsRead,
    markAllAsRead,
    refreshNotifications,
  };
}
