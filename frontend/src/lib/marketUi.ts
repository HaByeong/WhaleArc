import type { MarketPrice, AssetType } from '../services/marketService';
import { won, isUsd } from '../components/console/format';

/* ────────────────────────────────────────────────────────────
   marketUi — 시세·거래 특화 UI 토큰 + 포매터 + 자산군 메타.
   콘솔 전역 공용 값(UP/DOWN/won/stripZeros/fmtQty/SONAR)은
   components/console/format.ts가 단일 소스이고 여기서는 별칭 재노출만 한다
   (기존 사용처 import 무변경). 시세·거래에서만 쓰는 mkCard·ASSET_CLASSES·
   fmtPrice류만 이 파일에 정의한다.
   ──────────────────────────────────────────────────────────── */

// 콘솔 공용 재노출 — 값을 바꾸려면 format.ts에서. (GLOW=SONAR, fmtKRW=won: 이 도메인의 기존 이름 유지)
export { UP, DOWN, stripZeros, fmtQty, SONAR as GLOW, won as fmtKRW, INK1, INK2, INK3, LINE, LINE_STRONG, mkCard } from '../components/console/format';

export const COMMISSION_RATE = 0.001;

// klass(탭) → AssetType + 라벨 + 메타(시세 탭에서만 표시)
export const ASSET_CLASSES: { key: string; type: AssetType; label: string; meta: string }[] = [
  { key: 'stock', type: 'STOCK', label: '주식', meta: 'KOSPI · KOSDAQ' },
  { key: 'us', type: 'US_STOCK', label: '미국주식', meta: 'NYSE · NASDAQ' },
  { key: 'etf', type: 'ETF', label: 'ETF', meta: '국내 · 해외' },
  { key: 'crypto', type: 'CRYPTO', label: '가상화폐', meta: '빗썸' },
];

// 크립토 목록 상단 고정용 인기 코인
export const POPULAR_COINS = new Set(['BTC', 'ETH', 'XRP', 'SOL', 'DOGE', 'USDT']);

export const curOf = (a?: MarketPrice | null) => (a?.currency === 'USD' ? '$' : '₩');

// 미국주식/ETF(USD)는 환율로 원화 환산해서 표시 (usdKrw=0이면 원통화 표시)
export const fmtPrice = (a: MarketPrice, usdKrw = 0) => {
  if (a.currency === 'USD' && usdKrw > 0) return '₩' + Math.round(a.price * usdKrw).toLocaleString('ko-KR');
  return curOf(a) + a.price.toLocaleString('ko-KR', { maximumFractionDigits: a.currency === 'USD' ? 2 : 0 });
};
export const fmtVol = (n: number) => (n >= 1e8 ? (n / 1e8).toFixed(1) + '억' : n >= 1e4 ? (n / 1e4).toFixed(1) + '만' : n.toLocaleString('ko-KR'));
// 단가(네이티브 통화: 미국주식/ETF는 USD, 그 외 KRW)
export const fmtNative = (price: number, at?: string) => (isUsd(at) ? '$' + price.toLocaleString('ko-KR', { maximumFractionDigits: 2 }) : won(price));
