import { useEffect, useState, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import type { MarketPrice } from '../services/marketService';

const WS_URL = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/ws`;

interface UseRealtimePriceOptions {
  symbol?: string | null;
  enabled?: boolean;
}

export function useRealtimePrice({ symbol = null, enabled = true }: UseRealtimePriceOptions = {}) {
  const [prices, setPrices] = useState<Map<string, MarketPrice>>(new Map());
  const [connected, setConnected] = useState(false);
  const [tickCount, setTickCount] = useState(0); // 틱마다 증가해서 리렌더 보장

  useEffect(() => {
    if (!enabled) return;

    const pricesMap = new Map<string, MarketPrice>();
    let rafId: number | null = null;
    let dirty = false;

    const flush = () => {
      rafId = null;
      if (!dirty) return;
      dirty = false;
      setPrices(new Map(pricesMap));
      setTickCount((c) => c + 1);
    };

    const onMessage = (message: { body: string }) => {
      const data: MarketPrice = JSON.parse(message.body);
      pricesMap.set(data.symbol, data);
      dirty = true;
      // requestAnimationFrame으로 브라우저 프레임마다 한 번만 업데이트
      if (rafId === null) {
        rafId = requestAnimationFrame(flush);
      }
    };

    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        setConnected(true);
        const topic = symbol ? `/topic/ticker/${symbol}` : '/topic/ticker';
        client.subscribe(topic, onMessage);
      },
      onDisconnect: () => setConnected(false),
      onStompError: () => setConnected(false),
    });

    client.activate();

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      client.deactivate();
      setConnected(false);
    };
  }, [symbol, enabled]);

  const getPrice = useCallback((sym: string): MarketPrice | undefined => {
    return prices.get(sym);
  }, [prices]);

  const getAllPrices = useCallback((): MarketPrice[] => {
    return Array.from(prices.values());
  }, [prices]);

  return { prices, connected, getPrice, getAllPrices, tickCount };
}
