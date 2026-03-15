import { useEffect, useRef, useState, useCallback } from 'react';

const N = 120;
const RSI_P = 14;
const SEED = 42;

const TV = {
  bg: '#131722', grid: '#1e222d', gridText: '#787b86',
  bull: '#26a69a', bear: '#ef5350', rsi: '#e040fb',
};

function mulberry32(seed: number) {
  let s = seed;
  return () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface RSIData {
  opens: number[]; closes: number[]; highs: number[]; lows: number[];
  rsi: (number | null)[];
}

function genData(rng: () => number): RSIData {
  const opens: number[] = [], closes: number[] = [], highs: number[] = [], lows: number[] = [];
  let p = 100;
  for (let i = 0; i < N; i++) {
    let trend = 0;
    if (i < 18) trend = -0.6;
    else if (i < 35) trend = 0.5;
    else if (i < 55) trend = 0.45;
    else if (i < 72) trend = -0.58;
    else if (i < 88) trend = 0.5;
    else if (i < 105) trend = 0.3;
    else trend = -0.5;
    const vol = 1.5 + Math.sin(i * 0.08) * 0.4;
    const change = trend + (rng() - 0.5) * vol;
    const o = p, c = p + change;
    const h = Math.max(o, c) + rng() * 1.0;
    const l = Math.min(o, c) - rng() * 1.0;
    opens.push(o); closes.push(c); highs.push(h); lows.push(l);
    p = c;
  }
  const rsi: (number | null)[] = [null];
  let avgG = 0, avgL = 0;
  for (let i = 1; i < N; i++) {
    const ch = closes[i] - closes[i - 1];
    const g = ch > 0 ? ch : 0, l = ch < 0 ? -ch : 0;
    if (i <= RSI_P) { avgG += g; avgL += l; if (i < RSI_P) { rsi.push(null); continue; } avgG /= RSI_P; avgL /= RSI_P; }
    else { avgG = (avgG * (RSI_P - 1) + g) / RSI_P; avgL = (avgL * (RSI_P - 1) + l) / RSI_P; }
    const rs = avgL === 0 ? 100 : avgG / avgL;
    rsi.push(100 - 100 / (1 + rs));
  }
  return { opens, closes, highs, lows, rsi };
}

/* ─── 라운드 뱃지 유틸 ─── */
function drawBadge(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, bgColor: string) {
  ctx.save();
  ctx.font = '600 10px -apple-system, BlinkMacSystemFont, sans-serif';
  const tw = ctx.measureText(text).width;
  const [px, py, rr] = [5, 2, 3];
  const [rx, ry, rw, rh] = [x - tw / 2 - px, y - 8 - py, tw + px * 2, 16 + py * 2];
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.moveTo(rx + rr, ry); ctx.arcTo(rx + rw, ry, rx + rw, ry + rh, rr);
  ctx.arcTo(rx + rw, ry + rh, rx, ry + rh, rr); ctx.arcTo(rx, ry + rh, rx, ry, rr);
  ctx.arcTo(rx, ry, rx + rw, ry, rr); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
  ctx.fillText(text, x, y + 2);
  ctx.restore();
}

function drawLabelBadge(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, bgColor: string) {
  ctx.save();
  ctx.font = '600 11px -apple-system, BlinkMacSystemFont, sans-serif';
  const tw = ctx.measureText(text).width;
  const [px, py, rr] = [6, 3, 3];
  const [rx, ry, rw, rh] = [x - tw / 2 - px, y - 7 - py, tw + px * 2, 14 + py * 2];
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.moveTo(rx + rr, ry); ctx.arcTo(rx + rw, ry, rx + rw, ry + rh, rr);
  ctx.arcTo(rx + rw, ry + rh, rx, ry + rh, rr); ctx.arcTo(rx, ry + rh, rx, ry, rr);
  ctx.arcTo(rx, ry, rx + rw, ry, rr); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
  ctx.fillText(text, x, y + 4);
  ctx.restore();
}

export default function RSIChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const playingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dataRef = useRef<RSIData>(genData(mulberry32(SEED)));
  const dprRef = useRef(window.devicePixelRatio || 1);

  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(30);
  const [statusText, setStatusText] = useState('');

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = dprRef.current;
    const W = canvas.width / dpr, H = canvas.height / dpr;
    const pad = { t: 16, r: 58, b: 28, l: 8 };
    const frame = frameRef.current;
    const { opens, closes, highs, lows, rsi } = dataRef.current;
    const cw = (W - pad.l - pad.r) / N;
    const splitY = pad.t + (H - pad.t - pad.b) * 0.62;
    const rsiTop = splitY + 18;
    const rsiBot = H - pad.b;

    ctx.fillStyle = TV.bg; ctx.fillRect(0, 0, W, H);

    /* ── 캔들 영역 ── */
    let visHi = -Infinity, visLo = Infinity;
    for (let i = 0; i <= frame && i < N; i++) {
      visHi = Math.max(visHi, highs[i]); visLo = Math.min(visLo, lows[i]);
    }
    let range = visHi - visLo || 1;
    visHi += range * 0.08; visLo -= range * 0.08; range = visHi - visLo;
    const yP = (v: number) => pad.t + (1 - (v - visLo) / range) * (splitY - pad.t);

    for (let i = 0; i <= 4; i++) {
      const y = pad.t + (splitY - pad.t) * i / 4;
      ctx.strokeStyle = TV.grid; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
    }
    for (let i = 0; i <= frame && i < N; i++) {
      const x = pad.l + i * cw + cw / 2, bw = Math.max(cw * 0.7, 2.5);
      const bull = closes[i] >= opens[i], color = bull ? TV.bull : TV.bear;
      ctx.strokeStyle = color; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, yP(highs[i])); ctx.lineTo(x, yP(lows[i])); ctx.stroke();
      const top = yP(Math.max(opens[i], closes[i])), bot = yP(Math.min(opens[i], closes[i]));
      ctx.fillStyle = color; ctx.fillRect(x - bw / 2, top, bw, Math.max(bot - top, 1));
    }

    /* ── RSI 영역 ── */
    ctx.strokeStyle = TV.grid; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.l, splitY + 6); ctx.lineTo(W - pad.r, splitY + 6); ctx.stroke();
    ctx.fillStyle = TV.gridText; ctx.font = '10px -apple-system, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('RSI(14)', pad.l + 4, rsiTop - 3);

    const rsiY = (v: number) => rsiTop + (1 - v / 100) * (rsiBot - rsiTop);

    ctx.fillStyle = 'rgba(38,166,154,0.07)';
    ctx.fillRect(pad.l, rsiY(30), W - pad.l - pad.r, rsiBot - rsiY(30));
    ctx.fillStyle = 'rgba(239,83,80,0.07)';
    ctx.fillRect(pad.l, rsiTop, W - pad.l - pad.r, rsiY(70) - rsiTop);

    [30, 50, 70].forEach(v => {
      const y = rsiY(v);
      ctx.save();
      ctx.strokeStyle = v === 50 ? TV.grid : (v === 30 ? 'rgba(38,166,154,0.5)' : 'rgba(239,83,80,0.5)');
      ctx.lineWidth = v === 50 ? 0.5 : 0.8;
      if (v === 50) ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = TV.gridText; ctx.font = '10px -apple-system, sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(String(v), W - pad.r + 6, y + 4);
    });

    ctx.strokeStyle = TV.rsi; ctx.lineWidth = 1.5; ctx.beginPath();
    let started = false;
    for (let i = 0; i <= frame && i < N; i++) {
      if (rsi[i] === null) continue;
      const x = pad.l + i * cw + cw / 2, y = rsiY(rsi[i]!);
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
    ctx.stroke();

    /* ── RSI 시그널 ── */
    const signals: { i: number; type: 'buy' | 'sell'; rsiVal: number; price: number }[] = [];
    for (let i = RSI_P + 1; i <= frame && i < N; i++) {
      if (rsi[i] === null || rsi[i - 1] === null) continue;
      if (rsi[i - 1]! < 30 && rsi[i]! >= 30) signals.push({ i, type: 'buy', rsiVal: rsi[i]!, price: closes[i] });
      if (rsi[i - 1]! > 70 && rsi[i]! <= 70) signals.push({ i, type: 'sell', rsiVal: rsi[i]!, price: closes[i] });
    }

    signals.forEach(s => {
      const x = pad.l + s.i * cw + cw / 2;
      const cy = yP(s.price), ry = rsiY(s.rsiVal);
      const isBuy = s.type === 'buy';
      const clr = isBuy ? TV.bull : TV.bear;
      const alpha = isBuy ? 'rgba(38,166,154,' : 'rgba(239,83,80,';

      // RSI 라인 위 원
      ctx.beginPath(); ctx.arc(x, ry, 8, 0, Math.PI * 2);
      ctx.fillStyle = alpha + '0.2)'; ctx.fill();
      ctx.beginPath(); ctx.arc(x, ry, 5, 0, Math.PI * 2);
      ctx.fillStyle = clr; ctx.fill();

      // 캔들 영역 원
      ctx.beginPath(); ctx.arc(x, cy, 14, 0, Math.PI * 2);
      ctx.fillStyle = alpha + '0.15)'; ctx.fill();
      ctx.beginPath(); ctx.arc(x, cy, 10, 0, Math.PI * 2);
      ctx.fillStyle = alpha + '0.3)'; ctx.fill();
      ctx.beginPath(); ctx.arc(x, cy, 6, 0, Math.PI * 2);
      ctx.fillStyle = clr; ctx.fill();

      // 라벨 뱃지
      const label = isBuy ? 'RSI 과매도 반전' : 'RSI 과매수 이탈';
      drawLabelBadge(ctx, label, x, cy - 22, alpha + '0.92)');

      // 화살표 + 매수/매도
      ctx.font = '600 13px -apple-system, sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = clr;
      ctx.fillText(isBuy ? '▲' : '▼', x, cy + 20);
      drawBadge(ctx, isBuy ? '매수/롱' : '매도/숏', x, cy + 34, alpha + '0.85)');
    });

    /* ── 가격 축 ── */
    ctx.fillStyle = TV.bg; ctx.fillRect(W - pad.r, 0, pad.r, splitY);
    ctx.strokeStyle = TV.grid; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(W - pad.r, 0); ctx.lineTo(W - pad.r, H); ctx.stroke();
    for (let i = 0; i <= 4; i++) {
      const v = visLo + (range * i / 4), y = yP(v);
      ctx.fillStyle = TV.gridText; ctx.font = '11px -apple-system, sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(v.toFixed(2), W - pad.r + 6, y + 4);
    }

    // 현재 가격 태그
    const li = Math.min(frame, N - 1), lp = closes[li], yp = yP(lp);
    const bull = closes[li] >= opens[li];
    ctx.fillStyle = bull ? TV.bull : TV.bear;
    ctx.fillRect(W - pad.r, yp - 10, pad.r, 20);
    ctx.beginPath(); ctx.moveTo(W - pad.r, yp); ctx.lineTo(W - pad.r - 5, yp - 5); ctx.lineTo(W - pad.r - 5, yp + 5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '600 11px -apple-system, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(lp.toFixed(2), W - pad.r + 6, yp + 4);
    ctx.save(); ctx.setLineDash([4, 3]);
    ctx.strokeStyle = bull ? 'rgba(38,166,154,0.4)' : 'rgba(239,83,80,0.4)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(pad.l, yp); ctx.lineTo(W - pad.r, yp); ctx.stroke(); ctx.restore();

    if (signals.length > 0) {
      const last = signals[signals.length - 1];
      if (last.i === frame) {
        setStatusText(last.type === 'buy'
          ? 'buy:▲ RSI 과매도 반전 — RSI(14)가 30 이하에서 반등. 매수 신호.'
          : 'sell:▼ RSI 과매수 이탈 — RSI(14)가 70 이상에서 하락. 매도 신호.');
      }
    }
  }, []);

  const resize = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    dprRef.current = window.devicePixelRatio || 1;
    const dpr = dprRef.current, rect = canvas.parentElement!.getBoundingClientRect();
    canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px'; canvas.style.height = rect.height + 'px';
    const ctx = canvas.getContext('2d'); if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, []);

  const stopPlayback = useCallback(() => {
    playingRef.current = false; setPlaying(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);
  const step = useCallback(() => { if (frameRef.current < N - 1) { frameRef.current++; draw(); } else stopPlayback(); }, [draw, stopPlayback]);
  const startPlayback = useCallback((spd: number) => {
    if (playingRef.current) return; playingRef.current = true; setPlaying(true);
    if (frameRef.current >= N - 1) { frameRef.current = 0; setStatusText(''); }
    timerRef.current = setInterval(step, spd);
  }, [step]);
  const handlePlayPause = useCallback(() => { if (playingRef.current) stopPlayback(); else startPlayback(speed); }, [playing, speed, startPlayback, stopPlayback]);
  const handleReset = useCallback(() => { stopPlayback(); dataRef.current = genData(mulberry32(SEED)); frameRef.current = 0; setStatusText(''); draw(); }, [stopPlayback, draw]);
  const handleSpeedChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value); setSpeed(val);
    if (playingRef.current) { clearInterval(timerRef.current!); timerRef.current = setInterval(step, val); }
  }, [step]);

  useEffect(() => {
    if (!canvasRef.current) return; resize(); draw();
    const onResize = () => { resize(); draw(); };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); if (timerRef.current) clearInterval(timerRef.current); };
  }, [resize, draw]);

  const statusColor = statusText.startsWith('buy') ? '#26a69a' : statusText.startsWith('sell') ? '#ef5350' : '';
  const statusLabel = statusText.includes(':') ? statusText.slice(statusText.indexOf(':') + 1) : statusText;

  return (
    <div>
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <button onClick={handlePlayPause} className="bg-gray-800 text-white border border-gray-700 rounded px-3.5 py-1.5 text-[13px] cursor-pointer hover:bg-gray-700 active:scale-95 transition-all">
          {playing ? '⏸ Pause' : '▶ Play'}
        </button>
        <button onClick={handleReset} className="bg-transparent text-gray-600 border border-gray-300 rounded px-3.5 py-1.5 text-[13px] cursor-pointer hover:bg-gray-100 active:scale-95 transition-all">
          ↺ Reset
        </button>
        <input type="range" min={1} max={100} value={speed} onChange={handleSpeedChange} className="flex-1 min-w-[100px] h-1 bg-gray-300 rounded appearance-none outline-none cursor-pointer accent-gray-600" />
        <span className="text-[13px] text-gray-500">Speed: {speed}ms</span>
      </div>
      <div className="flex gap-4 flex-wrap mb-2.5 text-[12px] text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#e040fb' }} />RSI(14)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-[15px] h-[15px] rounded-full inline-flex items-center justify-center text-[9px] text-white font-semibold" style={{ background: '#26a69a' }}>B</span>
          과매도 반전 (RSI {'<'} 30 {'→'} {'↑'})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-[15px] h-[15px] rounded-full inline-flex items-center justify-center text-[9px] text-white font-semibold" style={{ background: '#ef5350' }}>S</span>
          과매수 이탈 (RSI {'>'} 70 {'→'} {'↓'})
        </span>
      </div>
      <div className="relative w-full h-[420px] rounded-xl overflow-hidden">
        <canvas ref={canvasRef} className="block" />
      </div>
      <div className="mt-2.5 text-[13px] min-h-[20px]">
        {statusText && <span style={{ color: statusColor }}>{statusLabel}</span>}
      </div>
    </div>
  );
}
