import type { CSSProperties } from 'react';
import type { ExchangeType } from '../../services/exchangeService';

/* ────────────────────────────────────────────────────────────
   콘솔 공용 상수·포맷터 (컴포넌트는 ./ui.tsx — Vite fast-refresh 때문에 파일 분리).
   ConsoleDashboardPage·ConsolePortfolioPage에 복붙돼 있던 정의를 추출한 것 —
   다른 콘솔 페이지(Billing·Community·Status 등)에도 같은 복붙이 남아 있으니 점진 전환 대상.
   ※ 순수 이동(동작 불변)이 원칙: 값을 바꾸려면 사용처 전체를 확인할 것.
   ──────────────────────────────────────────────────────────── */

/* ── 색 토큰 ── */
export const SONAR = 'var(--ci-sonar)';
export const UP = '#ef4d4d';    // 상승 = 빨강 (한국 관례, 양쪽 테마 공통)
export const DOWN = '#4d8aff';  // 하락 = 파랑
export const COMPASS = '#f5d061';
export const INK1 = 'var(--ci-ink1)';
export const INK2 = 'var(--ci-ink2)';
export const INK3 = 'var(--ci-ink3)';
export const LINE = 'var(--ci-line)';
export const LINE_STRONG = 'var(--ci-line-strong)';

/* ── 카드 베이스 (mkCard: 시세·전략 계열 카드, panel: 대시보드·포트폴리오 계열 패널 — 시각 동일, radius/overflow만 다름) ── */
export const mkCard: CSSProperties = { borderRadius: 16, background: 'var(--ci-panel)', border: `1px solid ${LINE}`, boxShadow: 'var(--ci-panel-shadow)', position: 'relative', overflow: 'hidden' };

/* ── 포맷터 ── */
export const won = (n: number) => '₩' + Math.round(n).toLocaleString('ko-KR');
export const stripZeros = (s: string) => s.replace(/\.?0+$/, '') || '0';
export const fmtQty = (n: number, stockLike: boolean) => (stockLike ? `${Math.floor(n).toLocaleString('ko-KR')}주` : `${stripZeros(n.toFixed(8))}개`);
export const isUsd = (at?: string) => at === 'US_STOCK' || at === 'ETF';
export const stockLikeOf = (at?: string) => at === 'STOCK' || isUsd(at);
export const holdingName = (h: { stockName?: string; stockCode: string }) => h.stockName || h.stockCode;

/* ── 차트/자산 색 ── */
export const CHART_COLORS = ['#5b9dff', '#f7931a', '#627eea', '#9945ff', '#23c4a0', '#f5d061', '#ef6f6f', '#7c8cff'];
export const ASSET_ICON: Record<string, { c: string; t: string }> = {
  BTC: { c: '#f7931a', t: '₿' }, ETH: { c: '#627eea', t: 'Ξ' }, SOL: { c: '#9945ff', t: '◎' },
  XRP: { c: '#2f6fe6', t: '✕' }, USDT: { c: '#26a17b', t: '₮' }, DOGE: { c: '#c2a633', t: 'Ð' },
};

/* ── 패널 베이스 스타일 (Panel 컴포넌트와 인라인 { ...panel } 사용처 공용) ── */
export const panel: CSSProperties = { background: 'var(--ci-panel)', border: '1px solid var(--ci-line)', borderRadius: 16, boxShadow: 'var(--ci-panel-shadow)' };

/* ── 거래소 메타 (대시보드·포트폴리오 공용 통합형) ──
   name=정식 명칭, shortName=짧은 표기(탭·버튼), badge=영문 배지, asset=자산군 라벨, devel=키 발급처 */
export type ExchangeMeta = { key: ExchangeType; name: string; shortName: string; badge: string; asset: string; devel: string };
export const EXCHANGES: ExchangeMeta[] = [
  { key: 'KIS', name: 'KIS (한국투자증권)', shortName: 'KIS', badge: 'KIS', asset: '주식', devel: 'KIS Developers' },
  { key: 'UPBIT', name: '업비트', shortName: '업비트', badge: 'Upbit', asset: '코인', devel: '업비트 Open API' },
  { key: 'BITGET', name: '비트겟', shortName: '비트겟', badge: 'Bitget', asset: '코인', devel: 'Bitget API' },
];

/* 대시보드↔포트폴리오가 공유하는 '마지막 선택 거래소' localStorage 키 */
export const REAL_SRC_KEY = 'whalearc_real_src';
