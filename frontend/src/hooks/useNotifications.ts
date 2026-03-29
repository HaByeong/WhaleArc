import { useState, useEffect, useCallback, useRef } from 'react';
import { notificationService, type Notification } from '../services/notificationService';
import type { ToastItem } from '../components/Toast';

type NotificationPermissionState = 'granted' | 'denied' | 'default';

/**
 * 알림 폴링 훅
 * - 30초마다 읽지 않은 알림 수를 체크
 * - 새 알림 감지 시 토스트로 표시
 * - 브라우저 알림 권한 관리 및 로컬 푸시 알림 표시
 */
export function useNotifications(enabled = true) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermissionState>(
    typeof window !== 'undefined' && 'Notification' in window
      ? (window.Notification.permission as NotificationPermissionState)
      : 'default'
  );
  const prevUnreadRef = useRef(0);
  const initialLoadRef = useRef(true);

  // 브라우저 알림 권한 요청
  const requestNotificationPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const permission = await window.Notification.requestPermission();
      setNotificationPermission(permission as NotificationPermissionState);

      // 권한 승인 시 서비스워커에 push 구독 등록 시도
      if (permission === 'granted' && 'serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        if (!existing) {
          // VAPID 서버가 없으므로 구독은 시도만 하고 실패해도 무시
          try {
            await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: undefined,
            });
          } catch {
            // VAPID 키 없이는 구독 불가 — 로컬 알림으로 폴백
          }
        }
      }
    } catch {
      // 권한 요청 실패 시 무시
    }
  }, []);

  // 로컬 브라우저 알림 표시
  const showBrowserNotification = useCallback((title: string, body: string) => {
    if (
      typeof window === 'undefined' ||
      !('Notification' in window) ||
      window.Notification.permission !== 'granted'
    ) {
      return;
    }
    try {
      const notif = new window.Notification(title, {
        body,
        icon: '/favicon.svg',
        badge: '/favicon.svg',
      });
      notif.onclick = () => {
        window.focus();
        notif.close();
      };
    } catch {
      // 알림 표시 실패 시 무시
    }
  }, []);

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
            case 'TURTLE_TRADE': return 'info';
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

        // 브라우저 알림도 표시
        for (const n of newNotifs) {
          showBrowserNotification(n.title, n.message);
        }
      }

      prevUnreadRef.current = count;
      initialLoadRef.current = false;
    } catch {
      // 조용히 무시
    }
  }, [enabled, showBrowserNotification]);

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

  // 알림 권한 상태 동기화 (다른 탭에서 변경될 수 있음)
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const sync = () => {
      setNotificationPermission(window.Notification.permission as NotificationPermissionState);
    };
    // visibilitychange로 탭 전환 시 권한 상태 재확인
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  return {
    unreadCount,
    notifications,
    toasts,
    dismissToast,
    markAsRead,
    markAllAsRead,
    refreshNotifications,
    notificationPermission,
    requestNotificationPermission,
  };
}
