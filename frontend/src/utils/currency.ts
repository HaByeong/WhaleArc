// 포트폴리오 통화(원화/달러) 표시 모드 유틸
// - 'convert' : 달러(USD) 자산을 현재 환율로 원화 환산하여 단일 원화 합계로 표시
// - 'separate': 원화 자산 / 달러 자산을 환산 없이 통화별로 분리 표시

export type CurrencyMode = 'convert' | 'separate';

const STORAGE_KEY = 'wa_currency_mode';
/** 환율을 못 받았을 때의 보수적 폴백 (백엔드 default-usd-krw 와 동일선상) */
export const FALLBACK_USD_KRW = 1380;

export const getCurrencyMode = (): CurrencyMode => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'separate' ? 'separate' : 'convert';
  } catch {
    return 'convert';
  }
};

export const storeCurrencyMode = (m: CurrencyMode): void => {
  try {
    localStorage.setItem(STORAGE_KEY, m);
  } catch {
    /* ignore */
  }
};

/** USD 단위로 거래·평가되는 자산인지 (미국주식·미국ETF) */
export const isUsdAsset = (assetType?: string): boolean =>
  assetType === 'US_STOCK' || assetType === 'ETF';

export const fmtKRW = (v: number): string =>
  new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(Math.round(v));

export const fmtUSD = (v: number): string =>
  `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * 정수 금액 입력용 표시 포맷 — 자릿수만 남기고 천 단위 콤마를 넣는다(빈 값은 빈 문자열).
 * 예: '10000000' 또는 10000000 → '10,000,000'. type="text" inputMode="numeric" 입력과 함께 사용.
 */
export const formatAmountInput = (v: string | number): string => {
  const digits = String(v).replace(/[^\d]/g, '');
  return digits === '' ? '' : Number(digits).toLocaleString('en-US');
};

/** 금액 입력 onChange용 — 콤마·공백 등 비숫자를 제거해 순수 자릿수 문자열을 돌려준다. */
export const parseAmountInput = (s: string): string => s.replace(/[^\d]/g, '');

/**
 * 숫자를 천 단위 콤마로 표시하되 소수부는 보존한다(수량·USD 가격 등 소수 허용 필드용).
 * 예: 145000000 → '145,000,000', 1234.56 → '1,234.56', 0.0012 → '0.0012'.
 */
export const commaNumber = (n: number): string => {
  if (!Number.isFinite(n)) return '';
  const [intp, frac] = String(n).split('.');
  const ci = Number(intp).toLocaleString('en-US');
  return frac !== undefined ? `${ci}.${frac}` : ci;
};

/**
 * 편집 중 입력 텍스트를 라이브로 콤마 포맷 — 소수점/입력 중인 소수부('150.', '0.0012')를 보존한다.
 * 정수부에만 콤마를 넣고 소수점 이하는 그대로 둔다(천 단위 콤마 입력 필드의 onChange 표시용).
 */
export const formatAmountLive = (raw: string): string => {
  const cleaned = raw.replace(/[^\d.]/g, '');
  const dot = cleaned.indexOf('.');
  if (dot === -1) return cleaned === '' ? '' : Number(cleaned).toLocaleString('en-US');
  const intp = cleaned.slice(0, dot).replace(/\./g, '');
  const frac = cleaned.slice(dot + 1).replace(/\./g, '');   // 두 번째 이후 소수점은 제거
  const ci = intp === '' ? '0' : Number(intp).toLocaleString('en-US');
  return `${ci}.${frac}`;
};

/** 통화 정규화 결과: 모든 화면이 동일하게 합산/표시할 수 있는 공통 형태 */
export interface NormalizedHolding {
  isUsd: boolean;
  krwValue: number; // 평가금액(원화 환산)
  usdValue: number; // 평가금액(달러), 원화 자산이면 0
  krwPnl: number; // 평가손익(원화 환산)
}

/**
 * 가상투자(모의) 보유종목 정규화.
 * 이 데이터는 marketValue/profitLoss 가 자산의 "원래 통화"로 저장됨 (미국주식=USD, 그 외=KRW).
 */
export const normalizeSimHolding = (
  h: { marketValue: number; profitLoss: number; assetType?: string },
  usdKrwRate: number
): NormalizedHolding => {
  const isUsd = isUsdAsset(h.assetType);
  return {
    isUsd,
    krwValue: isUsd ? h.marketValue * usdKrwRate : h.marketValue,
    usdValue: isUsd ? h.marketValue : 0,
    krwPnl: isUsd ? h.profitLoss * usdKrwRate : h.profitLoss,
  };
};

/**
 * 실계좌(virt) 보유종목 정규화.
 * 이 데이터는 marketValue/profitLoss 가 이미 KRW 환산됨. 달러 원금은 originalMarketValue 에 별도 보관.
 */
export const normalizeVirtHolding = (h: {
  marketValue: number;
  profitLoss: number;
  currency?: string;
  originalMarketValue?: number;
}): NormalizedHolding => {
  // 통화 판정은 currency 만으로 한다(표시값 originalMarketValue 유무에 묶지 않는다).
  // 달러 원금이 0/누락이어도 USD 자산이면 통화 분리 합계에서 USD로 잡혀야 한다.
  const isUsd = !!h.currency && h.currency !== 'KRW';
  return {
    isUsd,
    krwValue: h.marketValue,
    usdValue: isUsd ? h.originalMarketValue || 0 : 0,
    krwPnl: h.profitLoss,
  };
};

export interface CurrencyTotals {
  /** 전체를 원화로 환산한 합계 (convert 모드 표시값) */
  allKrw: number;
  /** 원화 자산만의 합계 (separate 모드) */
  krwOnly: number;
  /** 달러 자산만의 USD 합계 (separate 모드) */
  usdOnly: number;
  /** 달러 자산이 하나라도 있는지 */
  hasUsd: boolean;
}

/** 정규화된 보유종목 목록 + 현금(KRW)으로 통화별 합계를 계산 */
export const computeCurrencyTotals = (
  items: NormalizedHolding[],
  krwCash = 0
): CurrencyTotals => {
  let allKrw = krwCash;
  let krwOnly = krwCash;
  let usdOnly = 0;
  let hasUsd = false;
  for (const it of items) {
    allKrw += it.krwValue;
    if (it.isUsd) {
      usdOnly += it.usdValue;
      hasUsd = true;
    } else {
      krwOnly += it.krwValue;
    }
  }
  return { allKrw, krwOnly, usdOnly, hasUsd };
};
