import { useEffect, useRef, useState, useCallback } from 'react';

const N = 120;
const K_P = 14;
const D_P = 3;
const SEED = 55;

const TV = {
  bg: '#131722', grid: '#1e222d', gridText: '#787b86',
  bull: '#26a69a', bear: '#ef5350', kLine: '#2962ff', dLine: '#ff6d00',
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

interface StochData {
  opens: number[]; closes: number[]; highs: number[]; lows: number[];
  stochK: (number | null)[]; stochD: (number | null)[];
}

function genData(rng: () => number): StochData {
  const opens: number[] = [], closes: number[] = [], highs: number[] = [], lows: number[] = [];
  let p = 100;
  for (let i = 0; i < N; i++) {
    let trend = 0;
    if (i < 20) trend = 0.5;
    else if (i < 40) trend = -0.6;
    else if (i < 60) trend = 0.55;
    else if (i < 80) trend = -0.4;
    else if (i < 100) trend = 0.5;
    else trend = -0.3;
    const vol = 1.8 + Math.sin(i * 0.1) * 0.5;
    const change = trend + (rng() - 0.5) * vol;
    const o = p, c = p + change;
    const h = Math.max(o, c) + rng() * 1.2;
    const l = Math.min(o, c) - rng() * 1.2;
    opens.push(o); closes.push(c); highs.push(h); lows.push(l);
    p = c;
  }
  // %K 계산
  const stochK: (number | null)[] = [];
  for (let i = 0; i < N; i++) {
    if (i < K_P - 1) { stochK.push(null); continue; }
    let hh = -Infinity, ll = Infinity;
    for (let j = i - K_P + 1; j <= i; j++) { hh = Math.max(hh, highs[j]); ll = Math.min(ll, lows[j]); }
    stochK.push(hh === ll ? 50 : ((closes[i] - ll) / (hh - ll)) * 100);
  }
  // %D 계산 (SMA of %K)
  const stochD: (number | null)[] = [];
  for (let i = 0; i < N; i++) {
    if (i < K_P - 1 + D_P - 1) { stochD.push(null); continue; }
    let sum = 0, cnt = 0;
    for (let j = i - D_P + 1; j <= i; j++) { if (stochK[j] !== null) { sum += stochK[j]!; cnt++; } }
    stochD.push(cnt > 0 ? sum / cnt : null);
  }
  return { opens, closes, highs, lows, stochK, stochD };
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

export default function StochasticChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const playingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dataRef = useRef<StochData>(genData(mulberry32(SEED)));
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
    const { opens, closes, highs, lows, stochK, stochD } = dataRef.current;
    const cw = (W - pad.l - pad.r) / N;
    const splitY = pad.t + (H - pad.t - pad.b) * 0.62;
    const stTop = splitY + 18;
    const stBot = H - pad.b;

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

    /* ── 스토캐스틱 영역 ── */
    ctx.strokeStyle = TV.grid; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.l, splitY + 6); ctx.lineTo(W - pad.r, splitY + 6); ctx.stroke();
    ctx.fillStyle = TV.gridText; ctx.font = '10px -apple-system, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(`Stoch(${K_P},${D_P})`, pad.l + 4, stTop - 3);

    const stY = (v: number) => stTop + (1 - v / 100) * (stBot - stTop);

    // 과매수/과매도 영역 배경
    ctx.fillStyle = 'rgba(38,166,154,0.07)';
    ctx.fillRect(pad.l, stY(20), W - pad.l - pad.r, stBot - stY(20));
    ctx.fillStyle = 'rgba(239,83,80,0.07)';
    ctx.fillRect(pad.l, stTop, W - pad.l - pad.r, stY(80) - stTop);

    [20, 50, 80].forEach(v => {
      const y = stY(v);
      ctx.save();
      ctx.strokeStyle = v === 50 ? TV.grid : (v === 20 ? 'rgba(38,166,154,0.5)' : 'rgba(239,83,80,0.5)');
      ctx.lineWidth = v === 50 ? 0.5 : 0.8;
      if (v === 50) ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = TV.gridText; ctx.font = '10px -apple-system, sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(String(v), W - pad.r + 6, y + 4);
    });

    // %K 라인
    ctx.strokeStyle = TV.kLine; ctx.lineWidth = 1.5; ctx.beginPath();
    let started = false;
    for (let i = 0; i <= frame && i < N; i++) {
      if (stochK[i] === null) continue;
      const x = pad.l + i * cw + cw / 2, y = stY(stochK[i]!);
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // %D 라인
    ctx.strokeStyle = TV.dLine; ctx.lineWidth = 1.5; ctx.beginPath();
    started = false;
    for (let i = 0; i <= frame && i < N; i++) {
      if (stochD[i] === null) continue;
      const x = pad.l + i * cw + cw / 2, y = stY(stochD[i]!);
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
    ctx.stroke();

    /* ── 시그널 (극단 구간 + 쿨다운: 의미 있는 크로스만) ── */
    const signals: { i: number; type: 'buy' | 'sell'; price: number }[] = [];
    const MIN_GAP = 10;
    let lastSignalIdx = -MIN_GAP;
    for (let i = K_P + D_P; i <= frame && i < N; i++) {
      if (stochK[i] === null || stochD[i] === null || stochK[i - 1] === null || stochD[i - 1] === null) continue;
      if (i - lastSignalIdx < MIN_GAP) continue;
      // 과매도 구간(< 25)에서 골든크로스만 매수
      if (stochK[i - 1]! < stochD[i - 1]! && stochK[i]! >= stochD[i]! && stochK[i]! < 25) {
        signals.push({ i, type: 'buy', price: closes[i] }); lastSignalIdx = i;
      }
      // 과매수 구간(> 75)에서 데드크로스만 매도
      if (stochK[i - 1]! > stochD[i - 1]! && stochK[i]! <= stochD[i]! && stochK[i]! > 75) {
        signals.push({ i, type: 'sell', price: closes[i] }); lastSignalIdx = i;
      }
    }

    signals.forEach(s => {
      const x = pad.l + s.i * cw + cw / 2;
      const cy = yP(s.price);
      const isBuy = s.type === 'buy';
      const clr = isBuy ? TV.bull : TV.bear;
      const alpha = isBuy ? 'rgba(38,166,154,' : 'rgba(239,83,80,';

      ctx.beginPath(); ctx.arc(x, cy, 14, 0, Math.PI * 2);
      ctx.fillStyle = alpha + '0.15)'; ctx.fill();
      ctx.beginPath(); ctx.arc(x, cy, 10, 0, Math.PI * 2);
      ctx.fillStyle = alpha + '0.3)'; ctx.fill();
      ctx.beginPath(); ctx.arc(x, cy, 6, 0, Math.PI * 2);
      ctx.fillStyle = clr; ctx.fill();

      const label = isBuy ? '%K ↑ %D 골든크로스' : '%K ↓ %D 데드크로스';
      drawLabelBadge(ctx, label, x, cy - 22, alpha + '0.92)');
      ctx.font = '600 13px -apple-system, sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = clr;
      ctx.fillText(isBuy ? '▲' : '▼', x, cy + 20);
      drawBadge(ctx, isBuy ? '매수' : '매도', x, cy + 34, alpha + '0.85)');
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
          ? 'buy:%K가 %D를 상향 돌파 — 매수 신호'
          : 'sell:%K가 %D를 하향 돌파 — 매도 신호');
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

  const statusColor = statusText.startsWith('buy') ? '#26a69a' : statusText.startsWith('sell') ? '#ef5350' : '';
  const statusLabel = statusText.includes(':') ? statusText.slice(statusText.indexOf(':') + 1) : statusText;

  return (
    <div>
      <div className="flex gap-4 flex-wrap mb-2.5 text-[12px] text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: TV.kLine }} />%K({K_P})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: TV.dLine }} />%D({D_P})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-[15px] h-[15px] rounded-full inline-flex items-center justify-center text-[9px] text-white font-semibold" style={{ background: '#26a69a' }}>B</span>
          %K ↑ %D 매수
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-[15px] h-[15px] rounded-full inline-flex items-center justify-center text-[9px] text-white font-semibold" style={{ background: '#ef5350' }}>S</span>
          %K ↓ %D 매도
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
