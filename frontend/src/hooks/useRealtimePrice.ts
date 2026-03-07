import { useEffect, useRef, useState, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import type { MarketPrice } from '../services/marketService';

const WS_URL = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/ws`;

interface UseRealtimePriceOptions {
  // 구독할 특정 코인 심볼 (null이면 전체 구독)
  symbol?: string | null;
  enabled?: boolean;
}

export function useRealtimePrice({ symbol = null, enabled = true }: UseRealtimePriceOptions = {}) {
  const [prices, setPrices] = useState<Map<string, MarketPrice>>(new Map());
  const [connected, setConnected] = useState(false);
  const clientRef = useRef<Client | null>(null);
  const pricesRef = useRef<Map<string, MarketPrice>>(new Map());

  // 배치 업데이트를 위한 타이머
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingUpdates = useRef<Map<string, MarketPrice>>(new Map());

  const flushUpdates = useCallback(() => {
    if (pendingUpdates.current.size === 0) return;

    const newMap = new Map(pricesRef.current);
    pendingUpdates.current.forEach((price, key) => {
      newMap.set(key, price);
    });
    pendingUpdates.current.clear();
    pricesRef.current = newMap;
    setPrices(newMap);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        setConnected(true);

        if (symbol) {
          // 특정 코인만 구독
          client.subscribe(`/topic/ticker/${symbol}`, (message) => {
            const data: MarketPrice = JSON.parse(message.body);
            pendingUpdates.current.set(data.symbol, data);
            scheduleBatchUpdate();
          });
        } else {
          // 전체 틱 구독
          client.subscribe('/topic/ticker', (message) => {
            const data: MarketPrice = JSON.parse(message.body);
            pendingUpdates.current.set(data.symbol, data);
            scheduleBatchUpdate();
          });
        }
      },
      onDisconnect: () => {
        setConnected(false);
      },
      onStompError: (frame) => {
        console.error('STOMP error:', frame.headers['message']);
        setConnected(false);
      },
    });

    clientRef.current = client;
    client.activate();

    return () => {
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
      }
      client.deactivate();
      clientRef.current = null;
      setConnected(false);
    };
  }, [symbol, enabled]);

  // 100ms마다 배치 업데이트 (너무 빠른 렌더링 방지)
  const scheduleBatchUpdate = useCallback(() => {
    if (batchTimerRef.current) return;
    batchTimerRef.current = setTimeout(() => {
      batchTimerRef.current = null;
      flushUpdates();
    }, 100);
  }, [flushUpdates]);

  const getPrice = useCallback((sym: string): MarketPrice | undefined => {
    return prices.get(sym);
  }, [prices]);

  const getAllPrices = useCallback((): MarketPrice[] => {
    return Array.from(prices.values());
  }, [prices]);

  return {
    prices,
    connected,
    getPrice,
    getAllPrices,
  };
}
