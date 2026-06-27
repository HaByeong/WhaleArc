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
  // 이미 토스트/표시한 알림 id 집합 — 개수 차분 대신 id diff로 신규를 가려내, 정렬·외부 읽음 변동에도 정확하게.
  const seenIdsRef = useRef<Set<string>>(new Set());

  // 브라우저 알림 권한 요청
  const requestNotificationPermission = useCallback(async (): Promise<string> => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    try {
      const permission = await window.Notification.requestPermission();
      setNotificationPermission(permission as NotificationPermissionState);

      // VAPID 서버 키가 아직 없어 Web Push 구독은 항상 거부되므로 시도하지 않는다.
      // VAPID 공개키가 준비되면 그때 pushManager.subscribe로 등록하고, 그 전까지는 로컬 알림으로 폴백한다.
      return permission;
    } catch {
      return 'denied';
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

      // 미읽음 수가 늘었거나 최초 로드면 전체 목록을 조회한다.
      if (count > prevUnreadRef.current || initialLoadRef.current) {
        const all = await notificationService.getNotifications();
        setNotifications(all);

        const unread = all.filter(n => !n.read);
        if (initialLoadRef.current) {
          // 최초 로드: 기존 미읽음은 토스트하지 않고 seen에 시드(앱 진입 때 과거 알림이 쏟아지지 않게).
          unread.forEach(n => seenIdsRef.current.add(n.id));
        } else {
          // 개수 차분이 아니라 id diff — 정렬 변동/다른 기기 읽음에도 정확히 '새로 본 적 없는' 것만 토스트.
          const newNotifs = unread.filter(n => !seenIdsRef.current.has(n.id));
          const toastType = (type: string): ToastItem['type'] => {
            switch (type) {
              case 'LIMIT_ORDER_FILLED':
              case 'MARKET_ORDER_FILLED':
              case 'AUTO_TRADE_EXECUTED': return 'success';
              case 'TURTLE_TRADE': return 'info';
              case 'STRATEGY_EXECUTED': return 'info';
              case 'PRICE_ALERT': return 'info';
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
          // 알림 폭주 시 화면을 가리지 않도록 동시 표시 토스트를 최신 3개로 제한.
          if (newToasts.length) setToasts(prev => [...prev, ...newToasts].slice(-3));

          // 브라우저 알림도 표시하고, 처리한 id를 seen에 적립
          for (const n of newNotifs) {
            showBrowserNotification(n.title, n.message);
            seenIdsRef.current.add(n.id);
          }
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
