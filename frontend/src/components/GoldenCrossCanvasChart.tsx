import { useEffect, useRef, useState, useCallback } from 'react';

const N = 120;
const SHORT_P = 10;
const LONG_P = 25;
const SEED = 7;

const TV = {
  bg: '#131722', grid: '#1e222d', gridText: '#787b86',
  bull: '#26a69a', bear: '#ef5350', ma1: '#f7a21b', ma2: '#2962ff',
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

interface OHLCData {
  opens: number[]; closes: number[]; highs: number[]; lows: number[];
  shortMA: (number | null)[]; longMA: (number | null)[];
}

function genData(rng: () => number): OHLCData {
  const opens: number[] = [], closes: number[] = [], highs: number[] = [], lows: number[] = [];
  const shortMA: (number | null)[] = [], longMA: (number | null)[] = [];
  let p = 100;
  for (let i = 0; i < N; i++) {
    let trend = 0;
    if (i < 20) trend = -0.25; else if (i < 50) trend = 0.38;
    else if (i < 65) trend = 0.05; else if (i < 90) trend = -0.32; else trend = 0.30;
    const vol = 1.8 + Math.sin(i * 0.1) * 0.5;
    const change = trend + (rng() - 0.5) * vol;
    const o = p, c = p + change;
    const h = Math.max(o, c) + rng() * 1.2, l = Math.min(o, c) - rng() * 1.2;
    opens.push(o); closes.push(c); highs.push(h); lows.push(l); p = c;
  }
  for (let i = 0; i < N; i++) {
    if (i >= SHORT_P - 1) { let s = 0; for (let j = i - SHORT_P + 1; j <= i; j++) s += closes[j]; shortMA.push(s / SHORT_P); } else shortMA.push(null);
    if (i >= LONG_P - 1) { let s = 0; for (let j = i - LONG_P + 1; j <= i; j++) s += closes[j]; longMA.push(s / LONG_P); } else longMA.push(null);
  }
  return { opens, closes, highs, lows, shortMA, longMA };
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

export default function GoldenCrossCanvasChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const playingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dataRef = useRef<OHLCData>(genData(mulberry32(SEED)));
  const dprRef = useRef(window.devicePixelRatio || 1);

  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
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
    const { opens, closes, highs, lows, shortMA, longMA } = dataRef.current;
    const cw = (W - pad.l - pad.r) / N;

    ctx.fillStyle = TV.bg; ctx.fillRect(0, 0, W, H);

    let visHi = -Infinity, visLo = Infinity;
    for (let i = 0; i <= frame && i < N; i++) {
      visHi = Math.max(visHi, highs[i]); visLo = Math.min(visLo, lows[i]);
      if (shortMA[i] !== null) { visHi = Math.max(visHi, shortMA[i]!); visLo = Math.min(visLo, shortMA[i]!); }
      if (longMA[i] !== null) { visHi = Math.max(visHi, longMA[i]!); visLo = Math.min(visLo, longMA[i]!); }
    }
    let range = visHi - visLo || 1;
    visHi += range * 0.06; visLo -= range * 0.06; range = visHi - visLo;
    const yP = (v: number) => pad.t + (1 - (v - visLo) / range) * (H - pad.t - pad.b);

    for (let i = 0; i <= 6; i++) {
      const y = yP(visLo + (range * i / 6));
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

    const drawMA = (arr: (number | null)[], color: string) => {
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath();
      let s = false;
      for (let i = 0; i <= frame && i < N; i++) {
        if (arr[i] === null) continue;
        const x = pad.l + i * cw + cw / 2;
        if (!s) { ctx.moveTo(x, yP(arr[i]!)); s = true; } else ctx.lineTo(x, yP(arr[i]!));
      }
      ctx.stroke();
    };
    drawMA(shortMA, TV.ma1);
    drawMA(longMA, TV.ma2);

    const crossEvents: { i: number; type: 'golden' | 'dead'; price: number }[] = [];
    for (let i = LONG_P; i <= frame && i < N; i++) {
      if (!shortMA[i] || !longMA[i] || !shortMA[i - 1] || !longMA[i - 1]) continue;
      const prev = shortMA[i - 1]! - longMA[i - 1]!, curr = shortMA[i]! - longMA[i]!;
      if (prev <= 0 && curr > 0) crossEvents.push({ i, type: 'golden', price: (shortMA[i]! + longMA[i]!) / 2 });
      else if (prev >= 0 && curr < 0) crossEvents.push({ i, type: 'dead', price: (shortMA[i]! + longMA[i]!) / 2 });
    }

    crossEvents.forEach(e => {
      const x = pad.l + e.i * cw + cw / 2, y = yP(e.price);
      const isG = e.type === 'golden';
      const clr = isG ? TV.bull : TV.bear;
      const alpha = isG ? 'rgba(38,166,154,' : 'rgba(239,83,80,';

      ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.fillStyle = alpha + '0.15)'; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fillStyle = alpha + '0.3)'; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = clr; ctx.fill();

      drawLabelBadge(ctx, isG ? 'Golden Cross' : 'Dead Cross', x, y - 22, alpha + '0.92)');

      ctx.font = '600 13px -apple-system, sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = clr;
      ctx.fillText(isG ? '▲' : '▼', x, y + 20);
      drawBadge(ctx, isG ? '매수/롱' : '매도/숏', x, y + 34, alpha + '0.85)');
    });

    ctx.fillStyle = TV.bg; ctx.fillRect(W - pad.r, 0, pad.r, H);
    ctx.strokeStyle = TV.grid; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(W - pad.r, 0); ctx.lineTo(W - pad.r, H); ctx.stroke();
    for (let i = 0; i <= 6; i++) {
      const v = visLo + (range * i / 6), y = yP(v);
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
    if (frameRef.current >= N - 1) setFinished(true);
  }, []);
  const step = useCallback(() => { if (frameRef.current < N - 1) { frameRef.current++; draw(); } else stopPlayback(); }, [draw, stopPlayback]);
  const startPlayback = useCallback(() => {
    if (playingRef.current) return; playingRef.current = true; setPlaying(true); setFinished(false);
    if (frameRef.current >= N - 1) { frameRef.current = 0; setStatusText(''); }
    timerRef.current = setInterval(step, 50);
  }, [step]);
  const handlePlayPause = useCallback(() => { if (playingRef.current) stopPlayback(); else startPlayback(); }, [startPlayback, stopPlayback]);
  const handleReset = useCallback(() => { stopPlayback(); dataRef.current = genData(mulberry32(SEED)); frameRef.current = 0; setStatusText(''); setFinished(false); draw(); }, [stopPlayback, draw]);

  useEffect(() => {
    if (!canvasRef.current) return; resize(); draw();
    const onResize = () => { resize(); draw(); };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); if (timerRef.current) clearInterval(timerRef.current); };
  }, [resize, draw]);

  const statusColor = statusText.startsWith('golden') ? '#26a69a' : statusText.startsWith('dead') ? '#ef5350' : '';
  const statusLabel = statusText.includes(':') ? statusText.slice(statusText.indexOf(':') + 1) : statusText;

  return (
    <div>
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
      <div className="relative w-full h-[420px] rounded-xl overflow-hidden cursor-pointer" onClick={() => { if (finished) handleReset(); else handlePlayPause(); }}>
        <canvas ref={canvasRef} className="block" />
        {!playing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity">
            <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
              {finished ? (
                <svg className="w-7 h-7 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              ) : (
                <svg className="w-8 h-8 text-gray-700 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="mt-2.5 text-[13px] min-h-[20px]">
        {statusText && <span style={{ color: statusColor }}>{statusLabel}</span>}
      </div>
    </div>
  );
}
