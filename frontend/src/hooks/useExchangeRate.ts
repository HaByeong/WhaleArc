import { useEffect, useState } from 'react';
import { marketService } from '../services/marketService';

/* ────────────────────────────────────────────────────────────
   useExchangeRate — 미국주식/ETF 원화 환산용 환율(USD→KRW).
   30초 주기 갱신. 실패 시 0 유지 → 호출부는 원화 환산을 스킵하고 원통화로 표시.
   시세/거래 두 페이지에 복제돼 있던 로직을 단일 소스로 통합.
   ──────────────────────────────────────────────────────────── */
export function useExchangeRate() {
  const [usdKrw, setUsdKrw] = useState(0);
  useEffect(() => {
    let alive = true;
    const fetchRate = async () => {
      try { const { usdKrw } = await marketService.getExchangeRate(); if (alive) setUsdKrw(usdKrw); }
      catch { /* fallback: 0 유지 */ }
    };
    fetchRate();
    const t = setInterval(fetchRate, 30_000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  return usdKrw;
}
