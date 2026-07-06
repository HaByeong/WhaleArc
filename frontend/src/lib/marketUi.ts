import type { CSSProperties } from 'react';
import type { MarketPrice, AssetType } from '../services/marketService';

/* ────────────────────────────────────────────────────────────
   marketUi — 시세·거래 공용 UI 토큰 + 포매터 + 자산군 메타.
   기존에 ConsoleMarketsPage / ConsoleTradePage 양쪽에 복제돼 있던
   상수·포매터를 단일 소스로 통합. (동작 무변경, 값 그대로 이전)
   ──────────────────────────────────────────────────────────── */

// 상승 = 빨강 / 하락 = 파랑 (양쪽 테마 공통)
export const UP = '#ef4d4d';
export const DOWN = '#4d8aff';
export const GLOW = 'var(--ci-sonar)';
export const ACCENT = 'var(--ci-sonar)';
export const INK1 = 'var(--ci-ink1)';
export const INK2 = 'var(--ci-ink2)';
export const INK3 = 'var(--ci-ink3)';
export const LINE = 'var(--ci-line)';
export const LINE_STRONG = 'var(--ci-line-strong)';
export const COMMISSION_RATE = 0.001;

export const mkCard: CSSProperties = { borderRadius: 16, background: 'var(--ci-panel)', border: `1px solid ${LINE}`, boxShadow: 'var(--ci-panel-shadow)', position: 'relative', overflow: 'hidden' };

// klass(탭) → AssetType + 라벨 + 메타(시세 탭에서만 표시)
export const ASSET_CLASSES: { key: string; type: AssetType; label: string; meta: string }[] = [
  { key: 'stock', type: 'STOCK', label: '주식', meta: 'KOSPI · KOSDAQ' },
  { key: 'us', type: 'US_STOCK', label: '미국주식', meta: 'NYSE · NASDAQ' },
  { key: 'etf', type: 'ETF', label: 'ETF', meta: '국내 · 해외' },
  { key: 'crypto', type: 'CRYPTO', label: '가상화폐', meta: '빗썸' },
];

// 크립토 목록 상단 고정용 인기 코인
export const POPULAR_COINS = new Set(['BTC', 'ETH', 'XRP', 'SOL', 'DOGE', 'USDT']);

export const isUsdAsset = (at?: string) => at === 'US_STOCK' || at === 'ETF';
export const curOf = (a?: MarketPrice | null) => (a?.currency === 'USD' ? '$' : '₩');
export const fmtKRW = (n: number) => '₩' + Math.round(n).toLocaleString('ko-KR');
export const stripZeros = (s: string) => s.replace(/\.?0+$/, '') || '0';

// 미국주식/ETF(USD)는 환율로 원화 환산해서 표시 (usdKrw=0이면 원통화 표시)
export const fmtPrice = (a: MarketPrice, usdKrw = 0) => {
  if (a.currency === 'USD' && usdKrw > 0) return '₩' + Math.round(a.price * usdKrw).toLocaleString('ko-KR');
  return curOf(a) + a.price.toLocaleString('ko-KR', { maximumFractionDigits: a.currency === 'USD' ? 2 : 0 });
};
export const fmtVol = (n: number) => (n >= 1e8 ? (n / 1e8).toFixed(1) + '억' : n >= 1e4 ? (n / 1e4).toFixed(1) + '만' : n.toLocaleString('ko-KR'));
export const fmtQty = (n: number, stockLike: boolean) => (stockLike ? `${Math.floor(n).toLocaleString('ko-KR')}주` : `${stripZeros(n.toFixed(8))}개`);
// 단가(네이티브 통화: 미국주식/ETF는 USD, 그 외 KRW)
export const fmtNative = (price: number, at?: string) => (isUsdAsset(at) ? '$' + price.toLocaleString('ko-KR', { maximumFractionDigits: 2 }) : fmtKRW(price));
// 금액 원화 환산(미국주식/ETF는 USD→KRW)
export const fmtAmtKRW = (amount: number, at: string | undefined, usdKrw: number) => fmtKRW(isUsdAsset(at) && usdKrw > 0 ? amount * usdKrw : amount);
