import { useEffect, useRef, useCallback } from 'react';

/**
 * 스마트 폴링 훅
 * - 페이지 비활성(탭 전환) 시 자동 중지
 * - 중복 요청 방지
 * - 컴포넌트 언마운트 시 자동 정리
 */
export function usePolling(callback: () => Promise<void> | void, intervalMs: number) {
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const isRunningRef = useRef(false);

  const safeFetch = useCallback(async () => {
    if (isRunningRef.current) return; // 이전 요청 진행 중이면 스킵
    isRunningRef.current = true;
    try {
      await callback();
    } finally {
      isRunningRef.current = false;
    }
  }, [callback]);

  useEffect(() => {
    const start = () => {
      if (timerRef.current) return;
      timerRef.current = setInterval(safeFetch, intervalMs);
    };

    const stop = () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = undefined;
      }
    };

    const handleVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        safeFetch(); // 탭 복귀 시 즉시 1회 호출
        start();
      }
    };

    // 시작
    start();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [safeFetch, intervalMs]);
}
