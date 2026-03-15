import { useEffect, useRef, useState, useCallback } from 'react';

const N = 120;
const BB_P = 20;
const BB_K = 2;
const SEED = 13;

const TV = {
  bg: '#131722', grid: '#1e222d', gridText: '#787b86',
  bull: '#26a69a', bear: '#ef5350',
  sma: '#f7a21b', upper: '#2962ff', lower: '#2962ff',
  band: 'rgba(41,98,255,0.06)', squeeze: '#ff9800',
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

interface BBData {
  opens: number[]; closes: number[]; highs: number[]; lows: number[];
  sma: (number | null)[]; upper: (number | null)[]; lower: (number | null)[];
  bandwidth: (number | null)[];
}

function genData(rng: () => number): BBData {
  const opens: number[] = [], closes: number[] = [], highs: number[] = [], lows: number[] = [];
  let p = 100;
  for (let i = 0; i < N; i++) {
    // 변동성 패턴: 수축 → 확장 → 수축 → 확장
    let trend = 0, volMult = 1;
    if (i < 20) { trend = 0.1; volMult = 1.2; }
    else if (i < 40) { trend = 0.02; volMult = 0.35; } // 스퀴즈
    else if (i < 55) { trend = 0.6; volMult = 1.8; }   // 상방 돌파
    else if (i < 70) { trend = -0.1; volMult = 1.0; }
    else if (i < 88) { trend = -0.02; volMult = 0.3; }  // 스퀴즈
    else if (i < 105) { trend = -0.55; volMult = 1.7; }  // 하방 돌파
    else { trend = 0.15; volMult = 0.9; }
    const vol = (1.2 + Math.sin(i * 0.05) * 0.3) * volMult;
    const change = trend + (rng() - 0.5) * vol;
    const o = p, c = p + change;
    const h = Math.max(o, c) + rng() * 0.8 * volMult;
    const l = Math.min(o, c) - rng() * 0.8 * volMult;
    opens.push(o); closes.push(c); highs.push(h); lows.push(l);
    p = c;
  }
  const sma: (number | null)[] = [], upper: (number | null)[] = [], lower: (number | null)[] = [];
  const bandwidth: (number | null)[] = [];
  for (let i = 0; i < N; i++) {
    if (i < BB_P - 1) { sma.push(null); upper.push(null); lower.push(null); bandwidth.push(null); continue; }
    let sum = 0;
    for (let j = i - BB_P + 1; j <= i; j++) sum += closes[j];
    const m = sum / BB_P;
    let sq = 0;
    for (let j = i - BB_P + 1; j <= i; j++) sq += (closes[j] - m) ** 2;
    const std = Math.sqrt(sq / BB_P);
    sma.push(m); upper.push(m + BB_K * std); lower.push(m - BB_K * std);
    bandwidth.push(m > 0 ? ((BB_K * 2 * std) / m) * 100 : 0);
  }
  return { opens, closes, highs, lows, sma, upper, lower, bandwidth };
}

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

export default function BollingerChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const playingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dataRef = useRef<BBData>(genData(mulberry32(SEED)));
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
    const { opens, closes, highs, lows, sma, upper, lower, bandwidth } = dataRef.current;
    const cw = (W - pad.l - pad.r) / N;

    ctx.fillStyle = TV.bg; ctx.fillRect(0, 0, W, H);

    let visHi = -Infinity, visLo = Infinity;
    for (let i = 0; i <= frame && i < N; i++) {
      visHi = Math.max(visHi, highs[i]); visLo = Math.min(visLo, lows[i]);
      if (upper[i] !== null) visHi = Math.max(visHi, upper[i]!);
      if (lower[i] !== null) visLo = Math.min(visLo, lower[i]!);
    }
    let range = visHi - visLo || 1;
    visHi += range * 0.06; visLo -= range * 0.06; range = visHi - visLo;
    const yP = (v: number) => pad.t + (1 - (v - visLo) / range) * (H - pad.t - pad.b);

    const steps = 6;
    for (let i = 0; i <= steps; i++) {
      const y = yP(visLo + (range * i / steps));
      ctx.strokeStyle = TV.grid; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
    }

    /* ── 볼린저밴드 영역 채우기 ── */
    ctx.beginPath();
    let bandStarted = false;
    const upperPts: { x: number; y: number }[] = [];
    for (let i = 0; i <= frame && i < N; i++) {
      if (upper[i] === null) continue;
      const x = pad.l + i * cw + cw / 2;
      upperPts.push({ x, y: yP(upper[i]!) });
      if (!bandStarted) { ctx.moveTo(x, yP(upper[i]!)); bandStarted = true; }
      else ctx.lineTo(x, yP(upper[i]!));
    }
    for (let i = upperPts.length - 1; i >= 0; i--) {
      const idx = BB_P - 1 + i;
      if (idx > frame || idx >= N || lower[idx] === null) continue;
      ctx.lineTo(upperPts[i].x, yP(lower[idx]!));
    }
    ctx.closePath();
    ctx.fillStyle = TV.band; ctx.fill();

    /* ── 캔들 ── */
    for (let i = 0; i <= frame && i < N; i++) {
      const x = pad.l + i * cw + cw / 2, bw = Math.max(cw * 0.7, 2.5);
      const bull = closes[i] >= opens[i], color = bull ? TV.bull : TV.bear;
      ctx.strokeStyle = color; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, yP(highs[i])); ctx.lineTo(x, yP(lows[i])); ctx.stroke();
      const top = yP(Math.max(opens[i], closes[i])), bot = yP(Math.min(opens[i], closes[i]));
      ctx.fillStyle = color; ctx.fillRect(x - bw / 2, top, bw, Math.max(bot - top, 1));
    }

    /* ── 밴드 라인 ── */
    const drawLine = (arr: (number | null)[], color: string, dash?: number[]) => {
      ctx.strokeStyle = color; ctx.lineWidth = 1.2;
      if (dash) ctx.setLineDash(dash);
      ctx.beginPath();
      let s = false;
      for (let i = 0; i <= frame && i < N; i++) {
        if (arr[i] === null) continue;
        const x = pad.l + i * cw + cw / 2;
        if (!s) { ctx.moveTo(x, yP(arr[i]!)); s = true; } else ctx.lineTo(x, yP(arr[i]!));
      }
      ctx.stroke();
      if (dash) ctx.setLineDash([]);
    };
    drawLine(upper, TV.upper, [4, 3]);
    drawLine(sma, TV.sma);
    drawLine(lower, TV.lower, [4, 3]);

    /* ── 스퀴즈 & 돌파 시그널 ── */
    // 스퀴즈 감지: bandwidth가 낮은 구간 → 그 후 돌파
    const bwThreshold = 1.5;
    const signals: { i: number; type: 'squeeze_up' | 'squeeze_down'; price: number }[] = [];
    let inSqueeze = false;
    for (let i = BB_P; i <= frame && i < N; i++) {
      if (bandwidth[i] === null) continue;
      if (bandwidth[i]! < bwThreshold) {
        inSqueeze = true;
      } else if (inSqueeze && bandwidth[i]! >= bwThreshold) {
        inSqueeze = false;
        // 돌파 방향 판단
        if (closes[i] > sma[i]!) {
          signals.push({ i, type: 'squeeze_up', price: closes[i] });
        } else {
          signals.push({ i, type: 'squeeze_down', price: closes[i] });
        }
      }
    }

    signals.forEach(s => {
      const x = pad.l + s.i * cw + cw / 2;
      const y = yP(s.price);
      const isUp = s.type === 'squeeze_up';
      const clr = isUp ? TV.bull : TV.bear;
      const alpha = isUp ? 'rgba(38,166,154,' : 'rgba(239,83,80,';

      ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.fillStyle = alpha + '0.15)'; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fillStyle = alpha + '0.3)'; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = clr; ctx.fill();

      const label = isUp ? '스퀴즈 상방 돌파' : '스퀴즈 하방 돌파';
      drawLabelBadge(ctx, label, x, y - 22, alpha + '0.92)');

      ctx.font = '600 13px -apple-system, sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = clr;
      ctx.fillText(isUp ? '▲' : '▼', x, y + 20);
      drawBadge(ctx, isUp ? '매수/롱' : '매도/숏', x, y + 34, alpha + '0.85)');
    });

    // 스퀴즈 구간 하이라이트 (하단 마커)
    for (let i = BB_P; i <= frame && i < N; i++) {
      if (bandwidth[i] === null) continue;
      const x = pad.l + i * cw + cw / 2;
      const dotY = H - pad.b + 8;
      ctx.beginPath(); ctx.arc(x, dotY, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = bandwidth[i]! < bwThreshold ? TV.squeeze : TV.grid;
      ctx.fill();
    }

    /* ── 가격 축 ── */
    ctx.fillStyle = TV.bg; ctx.fillRect(W - pad.r, 0, pad.r, H);
    ctx.strokeStyle = TV.grid; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(W - pad.r, 0); ctx.lineTo(W - pad.r, H); ctx.stroke();
    for (let i = 0; i <= steps; i++) {
      const v = visLo + (range * i / steps), y = yP(v);
      ctx.fillStyle = TV.gridText; ctx.font = '11px -apple-system, sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(v.toFixed(2), W - pad.r + 6, y + 4);
    }

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
        setStatusText(last.type === 'squeeze_up'
          ? 'buy:▲ 스퀴즈 상방 돌파 — 밴드 수축 후 가격이 상단 밴드 위로 돌파. 매수 신호.'
          : 'sell:▼ 스퀴즈 하방 돌파 — 밴드 수축 후 가격이 하단 밴드 아래로 돌파. 매도 신호.');
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
          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#f7a21b' }} />SMA(20)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#2962ff' }} />Upper / Lower Band
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#ff9800' }} />Squeeze
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-[15px] h-[15px] rounded-full inline-flex items-center justify-center text-[9px] text-white font-semibold" style={{ background: '#26a69a' }}>B</span>
          상방 돌파
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-[15px] h-[15px] rounded-full inline-flex items-center justify-center text-[9px] text-white font-semibold" style={{ background: '#ef5350' }}>S</span>
          하방 돌파
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
