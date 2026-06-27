/* 전략 시뮬레이션 데모 차트 — 순수 헬퍼(지표 계산·시드 데이터·드로잉 primitive·타입).
 * 컴포넌트(StrategyDemoChart)와 분리해 react-refresh 경고를 피한다. */

export const TV = {
  bg: '#131722', grid: '#1e222d', gridText: '#787b86', bull: '#26a69a', bear: '#ef5350',
};

export function mulberry32(seed: number) {
  let s = seed;
  return () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── 시드 가격 시나리오 ── */
export interface Seg { len: number; drift: number; vol: number }
export interface OHLC { opens: number[]; closes: number[]; highs: number[]; lows: number[] }

/** 구간별 추세(drift)·변동성(vol)으로 캔들 시계열 생성. 신호가 보이도록 시나리오를 짠다. */
export function genWalk(rng: () => number, segs: Seg[], start = 100): OHLC {
  const opens: number[] = [], closes: number[] = [], highs: number[] = [], lows: number[] = [];
  let p = start;
  for (const seg of segs) {
    for (let k = 0; k < seg.len; k++) {
      const o = p;
      const c = p + seg.drift + (rng() - 0.5) * seg.vol;
      const h = Math.max(o, c) + rng() * seg.vol * 0.5;
      const l = Math.min(o, c) - rng() * seg.vol * 0.5;
      opens.push(o); closes.push(c); highs.push(h); lows.push(l);
      p = c;
    }
  }
  return { opens, closes, highs, lows };
}

/* ── 지표 (모두 (number|null)[] 정렬, 워밍업 구간은 null) ── */
export function sma(v: number[], n: number): (number | null)[] {
  return v.map((_, i) => {
    if (i < n - 1) return null;
    let s = 0; for (let j = i - n + 1; j <= i; j++) s += v[j];
    return s / n;
  });
}
export function ema(v: number[], n: number): (number | null)[] {
  const out: (number | null)[] = []; const k = 2 / (n + 1); let prev: number | null = null;
  for (let i = 0; i < v.length; i++) {
    if (i < n - 1) { out.push(null); continue; }
    if (prev === null) { let s = 0; for (let j = i - n + 1; j <= i; j++) s += v[j]; prev = s / n; }
    else prev = v[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}
export function bollinger(v: number[], n = 20, mult = 2) {
  const mid = sma(v, n); const up: (number | null)[] = [], lo: (number | null)[] = [], pctB: (number | null)[] = [];
  for (let i = 0; i < v.length; i++) {
    if (mid[i] === null) { up.push(null); lo.push(null); pctB.push(null); continue; }
    let s = 0; for (let j = i - n + 1; j <= i; j++) s += (v[j] - mid[i]!) ** 2;
    const sd = Math.sqrt(s / n);
    const u = mid[i]! + mult * sd, l = mid[i]! - mult * sd;
    up.push(u); lo.push(l); pctB.push(u === l ? 0.5 : (v[i] - l) / (u - l));
  }
  return { mid, up, lo, pctB };
}
export function atr(h: number[], l: number[], c: number[], n = 14): (number | null)[] {
  const tr: number[] = h.map((_, i) => i === 0 ? h[i] - l[i] : Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1])));
  return sma(tr, n);
}
/** 켈트너 채널 — EMA 중심선 + ATR×mult 밴드. */
export function keltner(h: number[], l: number[], c: number[], n = 20, mult = 2) {
  const mid = ema(c, n); const a = atr(h, l, c, n);
  const up = mid.map((m, i) => m === null || a[i] === null ? null : m + mult * a[i]!);
  const lo = mid.map((m, i) => m === null || a[i] === null ? null : m - mult * a[i]!);
  return { mid, up, lo };
}
export function donchian(h: number[], l: number[], n = 20) {
  const up: (number | null)[] = [], lo: (number | null)[] = [];
  for (let i = 0; i < h.length; i++) {
    if (i < n) { up.push(null); lo.push(null); continue; }   // 직전 n봉(당봉 제외)
    let hi = -Infinity, low = Infinity;
    for (let j = i - n; j < i; j++) { hi = Math.max(hi, h[j]); low = Math.min(low, l[j]); }
    up.push(hi); lo.push(low);
  }
  return { up, lo };
}
export function rsi(v: number[], n = 14): (number | null)[] {
  const out: (number | null)[] = []; let ag = 0, al = 0;
  for (let i = 0; i < v.length; i++) {
    if (i === 0) { out.push(null); continue; }
    const ch = v[i] - v[i - 1]; const g = Math.max(ch, 0), l = Math.max(-ch, 0);
    if (i <= n) { ag += g; al += l; if (i < n) { out.push(null); continue; } ag /= n; al /= n; }
    else { ag = (ag * (n - 1) + g) / n; al = (al * (n - 1) + l) / n; }
    out.push(al === 0 ? 100 : 100 - 100 / (1 + ag / al));
  }
  return out;
}
export function macd(v: number[], f = 12, s = 26, sig = 9) {
  const ef = ema(v, f), es = ema(v, s);
  const line = v.map((_, i) => ef[i] === null || es[i] === null ? null : ef[i]! - es[i]!);
  const valid = line.map(x => x ?? 0);
  const signal = ema(valid, sig).map((x, i) => line[i] === null ? null : x);
  const hist = line.map((x, i) => x === null || signal[i] === null ? null : x - signal[i]!);
  return { line, signal, hist };
}

/* ── 설정 타입 ── */
export interface DemoLine { data: (number | null)[]; color: string; width?: number; dash?: boolean }
export interface DemoSignal { i: number; price: number; kind: 'buy' | 'sell' | 'mark'; label: string; sub?: string; markColor?: string }
export interface DemoBuilt { opens: number[]; closes: number[]; highs: number[]; lows: number[]; lines: DemoLine[]; signals: DemoSignal[] }
export interface DemoLegend { color: string; label: string }
export interface DemoConfig { build: (rng: () => number) => DemoBuilt; legend: DemoLegend[]; height?: number }

/* ── 드로잉 primitive ── */
export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
export function badge(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, bg: string, fs = 10) {
  ctx.save(); ctx.font = `600 ${fs}px -apple-system, BlinkMacSystemFont, sans-serif`;
  const tw = ctx.measureText(text).width; const px = 5, py = 3;
  ctx.fillStyle = bg; roundRect(ctx, x - tw / 2 - px, y - fs / 2 - py, tw + px * 2, fs + py * 2, 3); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y + 0.5);
  ctx.restore();
}
