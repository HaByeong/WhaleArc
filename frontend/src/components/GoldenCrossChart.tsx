import { useEffect, useRef, useState, useCallback } from 'react';
import Header from './Header';
import BacktestPanel from './BacktestPanel';
import { type BacktestResult } from '../services/strategyService';
import {
  quantStoreService,
  type QuantProduct,
  CATEGORY_LABELS,
  RISK_COLORS,
  RISK_LABELS,
  assetDisplayName,
} from '../services/quantStoreService';

/* ─── 상수 ─── */
const N = 120;
const SHORT_P = 10;
const LONG_P = 25;
const SEED = 7;

const TV = {
  bg: '#131722',
  grid: '#1e222d',
  gridText: '#787b86',
  bull: '#26a69a',
  bear: '#ef5350',
  ma1: '#f7a21b',
  ma2: '#2962ff',
};

/* ─── PRNG ─── */
function mulberry32(seed: number) {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ─── 데이터 타입 ─── */
interface OHLCData {
  opens: number[];
  closes: number[];
  highs: number[];
  lows: number[];
  shortMA: (number | null)[];
  longMA: (number | null)[];
}

function genData(rng: () => number): OHLCData {
  const opens: number[] = [], closes: number[] = [], highs: number[] = [], lows: number[] = [];
  const shortMA: (number | null)[] = [], longMA: (number | null)[] = [];
  let p = 100;

  for (let i = 0; i < N; i++) {
    let trend = 0;
    if (i < 20) trend = -0.25;
    else if (i < 50) trend = 0.38;
    else if (i < 65) trend = 0.05;
    else if (i < 90) trend = -0.32;
    else trend = 0.30;
    const vol = 1.8 + Math.sin(i * 0.1) * 0.5;
    const change = trend + (rng() - 0.5) * vol;
    const o = p, c = p + change;
    const h = Math.max(o, c) + rng() * 1.2;
    const l = Math.min(o, c) - rng() * 1.2;
    opens.push(o); closes.push(c); highs.push(h); lows.push(l);
    p = c;
  }
  for (let i = 0; i < N; i++) {
    if (i >= SHORT_P - 1) {
      let s = 0; for (let j = i - SHORT_P + 1; j <= i; j++) s += closes[j];
      shortMA.push(s / SHORT_P);
    } else shortMA.push(null);
    if (i >= LONG_P - 1) {
      let s = 0; for (let j = i - LONG_P + 1; j <= i; j++) s += closes[j];
      longMA.push(s / LONG_P);
    } else longMA.push(null);
  }
  return { opens, closes, highs, lows, shortMA, longMA };
}

/* ─── 골든크로스 항로 판별 ─── */
const isGoldenCrossProduct = (p: QuantProduct): boolean =>
  /골든|golden.?cross/i.test(`${p.name} ${p.description}`);

/* ─── 숫자 포맷 ─── */
const formatPercent = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

/* ─── 항로 카드 컴포넌트 ─── */
function RouteCard({ product, isSelected, onClick }: { product: QuantProduct; isSelected?: boolean; onClick?: () => void }) {
  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', minimumFractionDigits: 0 }).format(v);

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border-2 p-4 transition-all relative cursor-pointer ${
        isSelected
          ? 'border-blue-400 shadow-lg shadow-blue-500/10 ring-1 ring-blue-400/30'
          : 'border-gray-200 hover:shadow-md hover:-translate-y-0.5'
      }`}
    >
      {product.strategyType === 'TURTLE' && (
        <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-bold rounded-full shadow">
          WhaleArc 독점
        </span>
      )}
      {product.price > 0 && product.strategyType !== 'TURTLE' && (
        <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-amber-400 text-white text-[9px] font-bold rounded-full shadow">
          PREMIUM
        </span>
      )}

      {/* 뱃지 행 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1">
          <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-[#3d72d4]/10 text-[#3d72d4]">
            {CATEGORY_LABELS[product.category]}
          </span>
          {product.assetType === 'STOCK' ? (
            <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-indigo-50 text-indigo-600">주식</span>
          ) : (
            <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-50 text-emerald-600">가상화폐</span>
          )}
        </div>
        <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full ${RISK_COLORS[product.riskLevel]}`}>
          {RISK_LABELS[product.riskLevel]}
        </span>
      </div>

      {/* 상품명 & 설명 */}
      <h3 className="text-sm font-bold text-gray-800 mb-1">{product.name}</h3>
      <p className="text-xs text-gray-500 mb-3 line-clamp-2">{product.description}</p>

      {/* 지표 */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-400 mb-0.5">기대 수익률</div>
          <div className={`text-xs font-bold ${product.expectedReturn >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
            {formatPercent(product.expectedReturn)}
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-400 mb-0.5">최대 파고</div>
          <div className="text-xs font-bold text-blue-500">{formatPercent(product.maxDrawdown)}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-400 mb-0.5">승률</div>
          <div className="text-xs font-bold text-gray-700">{product.winRate.toFixed(1)}%</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-400 mb-0.5">샤프 비율</div>
          <div className="text-xs font-bold text-gray-700">{product.sharpeRatio.toFixed(2)}</div>
        </div>
      </div>

      {/* 대상 자산 */}
      <div className="flex flex-wrap gap-1 mb-3">
        {product.targetAssets.map((a) => (
          <span key={a} className="px-1.5 py-0.5 text-[10px] bg-gray-100 text-gray-600 rounded">
            {assetDisplayName(a, product.assetType)}
          </span>
        ))}
      </div>

      {/* 가격 & 구독 수 */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100 gap-2">
        <div className="min-w-0">
          {product.price === 0 ? (
            <span className="text-sm font-bold text-green-600">무료</span>
          ) : (
            <span className="text-sm font-bold text-gray-800 block truncate">{formatCurrency(product.price)}</span>
          )}
          <div className="text-[10px] text-gray-400 truncate">{product.subscribers}척 항해 중</div>
        </div>
        <button className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
          product.price === 0
            ? 'bg-green-500 hover:bg-green-600 text-white'
            : 'bg-[#3d72d4] hover:bg-[#2d62c4] text-white'
        }`}>
          {product.price === 0 ? '무료 사용' : '항로 구매'}
        </button>
      </div>
    </div>
  );
}

/* ─── 전략 상세 뷰 ─── */
function StrategyDetailView({ product, chartSlot }: { product: QuantProduct; chartSlot?: React.ReactNode }) {
  return (
    <div className="space-y-5">
      {/* 항로 로직 */}
      {product.strategyLogic && (
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">항로 로직</h3>
          <div className="bg-[#131722] rounded-xl p-4 overflow-x-auto">
            <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">{product.strategyLogic}</pre>
          </div>
        </div>
      )}

      {/* 차트 슬롯 (항로 로직과 항로 성과 사이) */}
      {chartSlot}

      {/* 항로 성과 */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">항로 성과</h3>
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <div className="text-[10px] text-gray-400 mb-1">기대 수익률</div>
            <div className={`text-lg font-bold ${product.expectedReturn >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
              {formatPercent(product.expectedReturn)}
            </div>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <div className="text-[10px] text-gray-400 mb-1">최대 파고</div>
            <div className="text-lg font-bold text-blue-500">{formatPercent(product.maxDrawdown)}</div>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <div className="text-[10px] text-gray-400 mb-1">승률</div>
            <div className="text-lg font-bold text-gray-700">{product.winRate.toFixed(1)}%</div>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <div className="text-[10px] text-gray-400 mb-1">샤프 비율</div>
            <div className="text-lg font-bold text-gray-700">{product.sharpeRatio.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* 태그 */}
      {product.tags?.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">태그</h3>
          <div className="flex flex-wrap gap-2">
            {product.tags.map(t => (
              <span key={t} className="px-3 py-1 text-xs font-medium bg-blue-50 text-blue-600 rounded-full">{t}</span>
            ))}
          </div>
        </div>
      )}

      {/* 항해 대상 */}
      {product.targetAssets?.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">항해 대상</h3>
          <div className="flex flex-wrap gap-2">
            {product.targetAssets.map(a => (
              <span key={a} className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg">
                {assetDisplayName(a, product.assetType)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── 메인 컴포넌트 ─── */
export default function GoldenCrossChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const playingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dataRef = useRef<OHLCData>(genData(mulberry32(SEED)));
  const dprRef = useRef(window.devicePixelRatio || 1);

  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(30);
  const [statusText, setStatusText] = useState('');

  const [products, setProducts] = useState<QuantProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<QuantProduct | null>(null);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);

  /* ─── 항로 로드 ─── */
  useEffect(() => {
    quantStoreService.getProducts()
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setLoadingProducts(false));
  }, []);

  /* ─── 로드 후 골든크로스 항로 자동 선택 ─── */
  useEffect(() => {
    if (products.length > 0 && !selectedProduct) {
      const gc = products.find(isGoldenCrossProduct);
      setSelectedProduct(gc || products[0]);
    }
  }, [products]);

  const showGoldenCross = !selectedProduct || isGoldenCrossProduct(selectedProduct);

  /* ─── 캔버스 드로잉 ─── */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = dprRef.current;
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;
    const pad = { t: 16, r: 58, b: 28, l: 8 };
    const frame = frameRef.current;
    const { opens, closes, highs, lows, shortMA, longMA } = dataRef.current;
    const cw = (W - pad.l - pad.r) / N;

    ctx.fillStyle = TV.bg;
    ctx.fillRect(0, 0, W, H);

    let visHi = -Infinity, visLo = Infinity;
    for (let i = 0; i <= frame && i < N; i++) {
      visHi = Math.max(visHi, highs[i]);
      visLo = Math.min(visLo, lows[i]);
      if (shortMA[i] !== null) { visHi = Math.max(visHi, shortMA[i]!); visLo = Math.min(visLo, shortMA[i]!); }
      if (longMA[i] !== null) { visHi = Math.max(visHi, longMA[i]!); visLo = Math.min(visLo, longMA[i]!); }
    }
    let range = visHi - visLo || 1;
    visHi += range * 0.06; visLo -= range * 0.06; range = visHi - visLo;
    const yPos = (v: number) => pad.t + (1 - (v - visLo) / range) * (H - pad.t - pad.b);

    const steps = 6;
    for (let i = 0; i <= steps; i++) {
      const y = yPos(visLo + (range * i / steps));
      ctx.strokeStyle = TV.grid; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
    }

    for (let i = 0; i <= frame && i < N; i++) {
      const x = pad.l + i * cw + cw / 2;
      const bw = Math.max(cw * 0.7, 2.5);
      const bull = closes[i] >= opens[i];
      const color = bull ? TV.bull : TV.bear;
      ctx.strokeStyle = color; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, yPos(highs[i])); ctx.lineTo(x, yPos(lows[i])); ctx.stroke();
      const top = yPos(Math.max(opens[i], closes[i]));
      const bot = yPos(Math.min(opens[i], closes[i]));
      ctx.fillStyle = color;
      ctx.fillRect(x - bw / 2, top, bw, Math.max(bot - top, 1));
    }

    const drawMA = (arr: (number | null)[], color: string) => {
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath();
      let started = false;
      for (let i = 0; i <= frame && i < N; i++) {
        if (arr[i] === null) continue;
        const x = pad.l + i * cw + cw / 2;
        if (!started) { ctx.moveTo(x, yPos(arr[i]!)); started = true; }
        else ctx.lineTo(x, yPos(arr[i]!));
      }
      ctx.stroke();
    };
    drawMA(shortMA, TV.ma1);
    drawMA(longMA, TV.ma2);

    const crossEvents: { i: number; type: 'golden' | 'dead'; price: number }[] = [];
    for (let i = LONG_P; i <= frame && i < N; i++) {
      if (!shortMA[i] || !longMA[i] || !shortMA[i-1] || !longMA[i-1]) continue;
      const prev = shortMA[i-1]! - longMA[i-1]!;
      const curr = shortMA[i]! - longMA[i]!;
      if (prev <= 0 && curr > 0) crossEvents.push({ i, type: 'golden', price: (shortMA[i]! + longMA[i]!) / 2 });
      else if (prev >= 0 && curr < 0) crossEvents.push({ i, type: 'dead', price: (shortMA[i]! + longMA[i]!) / 2 });
    }

    crossEvents.forEach(e => {
      const x = pad.l + e.i * cw + cw / 2;
      const y = yPos(e.price);
      const isG = e.type === 'golden';
      ctx.save();
      ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.fillStyle = isG ? 'rgba(38,166,154,0.15)' : 'rgba(239,83,80,0.15)'; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fillStyle = isG ? 'rgba(38,166,154,0.3)' : 'rgba(239,83,80,0.3)'; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = isG ? TV.bull : TV.bear; ctx.fill();
      const label = isG ? 'Golden Cross' : 'Dead Cross';
      ctx.font = '600 11px -apple-system, BlinkMacSystemFont, sans-serif';
      const tw = ctx.measureText(label).width;
      const [px, py] = [6, 3];
      const [lx, ly] = [x, y - 22];
      ctx.fillStyle = isG ? 'rgba(38,166,154,0.92)' : 'rgba(239,83,80,0.92)';
      const [rx, ry, rw, rh, rr] = [lx - tw/2 - px, ly - 7 - py, tw + px*2, 14 + py*2, 3];
      ctx.beginPath();
      ctx.moveTo(rx + rr, ry); ctx.arcTo(rx+rw, ry, rx+rw, ry+rh, rr);
      ctx.arcTo(rx+rw, ry+rh, rx, ry+rh, rr); ctx.arcTo(rx, ry+rh, rx, ry, rr);
      ctx.arcTo(rx, ry, rx+rw, ry, rr); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
      ctx.fillText(label, lx, ly + 4);

      // 매수/매도 화살표 + 라벨
      const tradeLabel = isG ? '매수/롱' : '매도/숏';
      const arrowY = y + 20;
      ctx.font = '600 13px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = isG ? TV.bull : TV.bear;
      ctx.fillText(isG ? '▲' : '▼', x, arrowY);

      ctx.font = '600 10px -apple-system, BlinkMacSystemFont, sans-serif';
      const tradeTw = ctx.measureText(tradeLabel).width;
      const tradeLy = arrowY + 14;
      const [tpx, tpy] = [5, 2];
      ctx.fillStyle = isG ? 'rgba(38,166,154,0.85)' : 'rgba(239,83,80,0.85)';
      const [trx, trY, trw, trh, trrr] = [x - tradeTw/2 - tpx, tradeLy - 8 - tpy, tradeTw + tpx*2, 16 + tpy*2, 3];
      ctx.beginPath();
      ctx.moveTo(trx + trrr, trY); ctx.arcTo(trx+trw, trY, trx+trw, trY+trh, trrr);
      ctx.arcTo(trx+trw, trY+trh, trx, trY+trh, trrr); ctx.arcTo(trx, trY+trh, trx, trY, trrr);
      ctx.arcTo(trx, trY, trx+trw, trY, trrr); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
      ctx.fillText(tradeLabel, x, tradeLy + 2);

      ctx.restore();
    });

    ctx.fillStyle = TV.bg;
    ctx.fillRect(W - pad.r, 0, pad.r, H);
    ctx.strokeStyle = TV.grid; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(W - pad.r, 0); ctx.lineTo(W - pad.r, H); ctx.stroke();
    for (let i = 0; i <= steps; i++) {
      const v = visLo + (range * i / steps);
      const y = yPos(v);
      ctx.fillStyle = TV.gridText; ctx.font = '11px -apple-system, sans-serif';
      ctx.textAlign = 'left'; ctx.fillText(v.toFixed(2), W - pad.r + 6, y + 4);
    }

    const lastIdx = Math.min(frame, N - 1);
    const lastPrice = closes[lastIdx];
    const yp = yPos(lastPrice);
    const bull = closes[lastIdx] >= opens[lastIdx];
    ctx.fillStyle = bull ? TV.bull : TV.bear;
    ctx.fillRect(W - pad.r, yp - 10, pad.r, 20);
    ctx.beginPath(); ctx.moveTo(W - pad.r, yp);
    ctx.lineTo(W - pad.r - 5, yp - 5); ctx.lineTo(W - pad.r - 5, yp + 5);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '600 11px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(lastPrice.toFixed(2), W - pad.r + 6, yp + 4);

    ctx.save();
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = bull ? 'rgba(38,166,154,0.4)' : 'rgba(239,83,80,0.4)';
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(pad.l, yp); ctx.lineTo(W - pad.r, yp); ctx.stroke();
    ctx.restore();

    if (crossEvents.length > 0) {
      const last = crossEvents[crossEvents.length - 1];
      if (last.i === frame) {
        setStatusText(last.type === 'golden'
          ? 'golden:▲ Golden Cross — Short MA(10)이 Long MA(25) 위로 돌파. 강세 신호.'
          : 'dead:▼ Dead Cross — Short MA(10)이 Long MA(25) 아래로 하향. 약세 신호.');
      }
    }
  }, []);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    dprRef.current = window.devicePixelRatio || 1;
    const dpr = dprRef.current;
    const rect = canvas.parentElement!.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, []);

  const stopPlayback = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const step = useCallback(() => {
    if (frameRef.current < N - 1) { frameRef.current++; draw(); }
    else stopPlayback();
  }, [draw, stopPlayback]);

  const startPlayback = useCallback((spd: number) => {
    if (playingRef.current) return;
    playingRef.current = true;
    setPlaying(true);
    if (frameRef.current >= N - 1) { frameRef.current = 0; setStatusText(''); }
    timerRef.current = setInterval(step, spd);
  }, [step]);

  const handlePlayPause = useCallback(() => {
    if (playingRef.current) stopPlayback();
    else startPlayback(speed);
  }, [playing, speed, startPlayback, stopPlayback]);

  const handleReset = useCallback(() => {
    stopPlayback();
    dataRef.current = genData(mulberry32(SEED));
    frameRef.current = 0;
    setStatusText('');
    draw();
  }, [stopPlayback, draw]);

  const handleSpeedChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    setSpeed(val);
    if (playingRef.current) {
      clearInterval(timerRef.current!);
      timerRef.current = setInterval(step, val);
    }
  }, [step]);

  /* ─── 캔버스 초기화 & 리사이즈 ─── */
  useEffect(() => {
    if (!canvasRef.current) return;
    resize(); draw();
    const onResize = () => { resize(); draw(); };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [resize, draw]);

  /* ─── 골든크로스 전환 시 캔버스 재초기화 ─── */
  useEffect(() => {
    if (showGoldenCross) {
      requestAnimationFrame(() => { resize(); draw(); });
    } else {
      stopPlayback();
    }
  }, [showGoldenCross, resize, draw, stopPlayback]);

  const statusColor = statusText.startsWith('golden') ? '#26a69a'
    : statusText.startsWith('dead') ? '#ef5350' : '';
  const statusLabel = statusText.startsWith('golden') ? statusText.slice(7)
    : statusText.startsWith('dead') ? statusText.slice(5) : statusText;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header showNav={true} />
      <div className="flex gap-6 items-start px-6 py-6">

        {/* ── 왼쪽: 항로 상세 + 결과 (세로 배치) ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-6">
          {/* 항로 상세 영역 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
            {selectedProduct ? (
              <>
                {/* 항로 헤더: 뱃지 + 제목 + 설명 */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-[#3d72d4]/10 text-[#3d72d4]">
                    {CATEGORY_LABELS[selectedProduct.category]}
                  </span>
                  <span className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-full ${RISK_COLORS[selectedProduct.riskLevel]}`}>
                    {RISK_LABELS[selectedProduct.riskLevel]}
                  </span>
                  {selectedProduct.assetType === 'STOCK' ? (
                    <span className="px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-indigo-50 text-indigo-600">주식</span>
                  ) : (
                    <span className="px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-50 text-emerald-600">가상화폐</span>
                  )}
                  {selectedProduct.strategyType === 'TURTLE' && (
                    <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                      WhaleArc 독점
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-bold text-gray-800 mb-1">{selectedProduct.name}</h2>
                <p className="text-sm text-gray-500 mb-4 leading-relaxed">{selectedProduct.description}</p>

                {/* StrategyDetailView — 골든크로스면 chartSlot에 차트 삽입 */}
                <StrategyDetailView
                  product={selectedProduct}
                  chartSlot={showGoldenCross ? (
                    <div>
                      {/* 컨트롤 */}
                      <div className="flex items-center gap-3 mb-3 flex-wrap">
                        <button
                          onClick={handlePlayPause}
                          className="bg-gray-800 text-white border border-gray-700 rounded px-3.5 py-1.5 text-[13px] cursor-pointer hover:bg-gray-700 active:scale-95 transition-all"
                        >
                          {playing ? '⏸ Pause' : '▶ Play'}
                        </button>
                        <button
                          onClick={handleReset}
                          className="bg-transparent text-gray-600 border border-gray-300 rounded px-3.5 py-1.5 text-[13px] cursor-pointer hover:bg-gray-100 active:scale-95 transition-all"
                        >
                          ↺ Reset
                        </button>
                        <input
                          type="range" min={1} max={100} value={speed}
                          onChange={handleSpeedChange}
                          className="flex-1 min-w-[100px] h-1 bg-gray-300 rounded appearance-none outline-none cursor-pointer accent-gray-600"
                        />
                        <span className="text-[13px] text-gray-500">Speed: {speed}ms</span>
                      </div>

                      {/* 범례 */}
                      <div className="flex gap-4 flex-wrap mb-2.5 text-[12px] text-gray-500">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#f7a21b' }} />MA 10
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#2962ff' }} />MA 25
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-[15px] h-[15px] rounded-full inline-flex items-center justify-center text-[9px] text-white font-semibold" style={{ background: '#26a69a' }}>G</span>
                          Golden cross
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-[15px] h-[15px] rounded-full inline-flex items-center justify-center text-[9px] text-white font-semibold" style={{ background: '#ef5350' }}>D</span>
                          Dead cross
                        </span>
                      </div>

                      {/* 캔버스 */}
                      <div className="relative w-full h-[420px] rounded-xl overflow-hidden">
                        <canvas ref={canvasRef} className="block" />
                      </div>

                      {/* 상태 메시지 */}
                      <div className="mt-2.5 text-[13px] min-h-[20px]">
                        {statusText && <span style={{ color: statusColor }}>{statusLabel}</span>}
                      </div>
                    </div>
                  ) : undefined}
                />
              </>
            ) : (
              /* 항로 미선택 플레이스홀더 */
              <div className="flex flex-col items-center justify-center py-24 text-gray-400">
                <svg className="w-16 h-16 mb-4 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p className="text-sm font-medium mb-1">항로를 선택해주세요</p>
                <p className="text-xs">오른쪽 항로 목록에서 원하는 항로를 클릭하세요</p>
              </div>
            )}
          </div>

          {/* ── 백테스트 결과 (큰 패널) ── */}
          {backtestResult && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              {/* 헤더 */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-800">백테스트 결과</h3>
                    <div className="text-xs text-gray-400">
                      {backtestResult.stockName || backtestResult.stockCode} · {backtestResult.startDate} ~ {backtestResult.endDate}
                    </div>
                  </div>
                </div>
                {backtestResult.buyHoldReturnRate !== undefined && (() => {
                  const diff = backtestResult.totalReturnRate - backtestResult.buyHoldReturnRate!;
                  return (
                    <span className={`text-sm font-bold px-3 py-1.5 rounded-full ${diff >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                      {diff >= 0 ? 'OUTPERFORM' : 'UNDERPERFORM'} {diff >= 0 ? '+' : ''}{diff.toFixed(1)}%p
                    </span>
                  );
                })()}
              </div>

              {/* KPI 4열 그리드 */}
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <div className="text-[11px] text-gray-400 mb-1">총 수익률</div>
                  <div className={`text-xl font-bold ${backtestResult.totalReturnRate >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                    {formatPercent(backtestResult.totalReturnRate)}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1">
                    {new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', minimumFractionDigits: 0 }).format(backtestResult.totalReturn)}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <div className="text-[11px] text-gray-400 mb-1">최종 자산</div>
                  <div className="text-xl font-bold text-gray-800">
                    {new Intl.NumberFormat('ko-KR', { minimumFractionDigits: 0 }).format(backtestResult.finalValue)}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1">
                    초기 {new Intl.NumberFormat('ko-KR', { minimumFractionDigits: 0 }).format(backtestResult.initialCapital)}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <div className="text-[11px] text-gray-400 mb-1">CAGR</div>
                  <div className={`text-xl font-bold ${(backtestResult.cagr ?? 0) >= 0 ? 'text-purple-600' : 'text-blue-600'}`}>
                    {formatPercent(backtestResult.cagr ?? 0)}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1">연평균 복리 수익률</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <div className="text-[11px] text-gray-400 mb-1">샤프 비율</div>
                  <div className="text-xl font-bold text-gray-800">{backtestResult.sharpeRatio.toFixed(2)}</div>
                  <div className="text-[11px] text-gray-400 mt-1">
                    {backtestResult.sharpeRatio >= 1 ? '양호' : backtestResult.sharpeRatio >= 0.5 ? '보통' : '주의'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4 mb-4">
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <div className="text-[11px] text-gray-400 mb-1">최대 낙폭 (MDD)</div>
                  <div className="text-xl font-bold text-orange-600">{backtestResult.maxDrawdown.toFixed(2)}%</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <div className="text-[11px] text-gray-400 mb-1">승률</div>
                  <div className="text-xl font-bold text-gray-800">{backtestResult.winRate.toFixed(1)}%</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <div className="text-[11px] text-gray-400 mb-1">수익 거래</div>
                  <div className="text-xl font-bold text-emerald-600">{backtestResult.profitableTrades}</div>
                  <div className="text-[11px] text-gray-400 mt-1">총 {backtestResult.totalTrades}건</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <div className="text-[11px] text-gray-400 mb-1">손실 거래</div>
                  <div className="text-xl font-bold text-rose-600">{backtestResult.losingTrades}</div>
                  <div className="text-[11px] text-gray-400 mt-1">
                    손익비 {backtestResult.profitFactor !== undefined ? backtestResult.profitFactor.toFixed(2) : '-'}
                  </div>
                </div>
              </div>

              {/* Buy & Hold 비교 바 */}
              {backtestResult.buyHoldReturnRate !== undefined && (
                <div className="flex items-center gap-4 bg-gray-50 rounded-xl px-5 py-3">
                  <span className="text-xs font-semibold text-gray-500">Buy & Hold 수익률</span>
                  <div className="flex-1 bg-gray-200 rounded-full h-2.5 relative overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-gray-400 rounded-full"
                      style={{ width: `${Math.min(Math.max(((backtestResult.buyHoldReturnRate + 50) / 100) * 100, 5), 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-gray-700">{formatPercent(backtestResult.buyHoldReturnRate)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── 가운데: 백테스팅 패널 ── */}
        <div className="w-72 flex-shrink-0 overflow-hidden">
          <BacktestPanel onResult={setBacktestResult} />
        </div>

        {/* ── 오른쪽: 항로 목록 ── */}
        <div className="w-72 flex-shrink-0 overflow-hidden">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-4">
              <img src="/whales/narwhal.png" alt="" className="w-6 h-6 object-contain" />
              <h2 className="text-base font-bold text-gray-800">항로 상점</h2>
              {!loadingProducts && (
                <span className="ml-auto text-xs text-gray-400">{products.length}개</span>
              )}
            </div>

            {/* 스크롤 가능한 항로 목록 */}
            <div className="scrollbar-ghost overflow-y-auto overflow-x-hidden max-h-[calc(100vh-160px)] space-y-3">
              {loadingProducts ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl p-4 animate-pulse">
                    <div className="h-3 bg-gray-200 rounded w-3/4 mb-3" />
                    <div className="h-2 bg-gray-200 rounded w-full mb-1" />
                    <div className="h-2 bg-gray-200 rounded w-2/3 mb-4" />
                    <div className="h-8 bg-gray-200 rounded" />
                  </div>
                ))
              ) : products.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">
                  <div className="text-2xl mb-2">🐳</div>
                  등록된 항로가 없습니다
                </div>
              ) : (
                products.map((p) => (
                  <RouteCard
                    key={p.id}
                    product={p}
                    isSelected={selectedProduct?.id === p.id}
                    onClick={() => setSelectedProduct(p)}
                  />
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
