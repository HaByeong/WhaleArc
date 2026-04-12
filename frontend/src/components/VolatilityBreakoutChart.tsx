import { useEffect, useRef, useState, useCallback } from 'react';

const N = 120;
const K = 0.5; // 변동성 돌파 계수
const SEED = 33;

const TV = {
  bg: '#131722', grid: '#1e222d', gridText: '#787b86',
  bull: '#26a69a', bear: '#ef5350', breakout: '#ffeb3b',
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

interface VBData {
  opens: number[]; closes: number[]; highs: number[]; lows: number[];
  breakoutLines: (number | null)[]; // 각 봉의 돌파 기준선
}

function genData(rng: () => number): VBData {
  const opens: number[] = [], closes: number[] = [], highs: number[] = [], lows: number[] = [];
  let p = 100;
  for (let i = 0; i < N; i++) {
    let trend = 0;
    if (i < 15) trend = 0.3;
    else if (i < 25) trend = 0.9;   // 강한 상승
    else if (i < 35) trend = -0.2;
    else if (i < 45) trend = 0.7;   // 상승
    else if (i < 55) trend = -0.8;  // 하락
    else if (i < 65) trend = 0.1;
    else if (i < 75) trend = 1.0;   // 강한 상승
    else if (i < 85) trend = -0.5;
    else if (i < 95) trend = 0.6;
    else if (i < 110) trend = -0.3;
    else trend = 0.4;
    const vol = 1.5 + Math.sin(i * 0.09) * 0.5;
    const change = trend + (rng() - 0.5) * vol;
    const o = p, c = p + change;
    const h = Math.max(o, c) + rng() * 1.5;
    const l = Math.min(o, c) - rng() * 1.5;
    opens.push(o); closes.push(c); highs.push(h); lows.push(l);
    p = c;
  }
  // 돌파 기준선: 당일 시가 + 전일(고가 - 저가) × K
  const breakoutLines: (number | null)[] = [null];
  for (let i = 1; i < N; i++) {
    const prevRange = highs[i - 1] - lows[i - 1];
    breakoutLines.push(opens[i] + prevRange * K);
  }
  return { opens, closes, highs, lows, breakoutLines };
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

export default function VolatilityBreakoutChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const playingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dataRef = useRef<VBData>(genData(mulberry32(SEED)));
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
    const { opens, closes, highs, lows, breakoutLines } = dataRef.current;
    const cw = (W - pad.l - pad.r) / N;
    const chartBot = H - pad.b;

    ctx.fillStyle = TV.bg; ctx.fillRect(0, 0, W, H);

    /* ── 캔들 영역 ── */
    let visHi = -Infinity, visLo = Infinity;
    for (let i = 0; i <= frame && i < N; i++) {
      visHi = Math.max(visHi, highs[i]); visLo = Math.min(visLo, lows[i]);
      if (breakoutLines[i] !== null) { visHi = Math.max(visHi, breakoutLines[i]!); }
    }
    let range = visHi - visLo || 1;
    visHi += range * 0.06; visLo -= range * 0.06; range = visHi - visLo;
    const yP = (v: number) => pad.t + (1 - (v - visLo) / range) * (chartBot - pad.t);

    // 그리드
    for (let i = 0; i <= 5; i++) {
      const y = pad.t + (chartBot - pad.t) * i / 5;
      ctx.strokeStyle = TV.grid; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
    }

    // 돌파 기준선 (점선)
    for (let i = 1; i <= frame && i < N; i++) {
      if (breakoutLines[i] === null) continue;
      const x = pad.l + i * cw, xEnd = x + cw;
      const y = yP(breakoutLines[i]!);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,235,59,0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(xEnd, y); ctx.stroke();
      ctx.restore();
    }

    // 캔들
    for (let i = 0; i <= frame && i < N; i++) {
      const x = pad.l + i * cw + cw / 2, bw = Math.max(cw * 0.7, 2.5);
      const bull = closes[i] >= opens[i], color = bull ? TV.bull : TV.bear;
      ctx.strokeStyle = color; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, yP(highs[i])); ctx.lineTo(x, yP(lows[i])); ctx.stroke();
      const top = yP(Math.max(opens[i], closes[i])), bot = yP(Math.min(opens[i], closes[i]));
      ctx.fillStyle = color; ctx.fillRect(x - bw / 2, top, bw, Math.max(bot - top, 1));
    }

    /* ── 시그널: 종가 > 돌파선 → 매수, 다음날 시가 매도 (강한 돌파 + 쿨다운) ── */
    const signals: { i: number; type: 'buy' | 'sell'; price: number }[] = [];
    let inPosition = false;
    const MIN_GAP = 8;
    let lastExitIdx = -MIN_GAP;
    for (let i = 1; i <= frame && i < N; i++) {
      if (!inPosition && breakoutLines[i] !== null && i - lastExitIdx >= MIN_GAP) {
        const bl = breakoutLines[i]!;
        const prevRange = highs[i - 1] - lows[i - 1];
        // 돌파 강도: 종가가 돌파선 대비 전일 변동폭의 30% 이상 상승해야 유효
        if (closes[i] > bl && (closes[i] - bl) > prevRange * 0.3) {
          signals.push({ i, type: 'buy', price: closes[i] });
          inPosition = true;
        }
      } else if (inPosition) {
        signals.push({ i, type: 'sell', price: opens[i] });
        inPosition = false;
        lastExitIdx = i;
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

      const label = isBuy ? '변동성 돌파 매수' : '익일 시가 청산';
      drawLabelBadge(ctx, label, x, cy - 22, alpha + '0.92)');
      ctx.font = '600 13px -apple-system, sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = clr;
      ctx.fillText(isBuy ? '▲' : '▼', x, cy + 20);
      drawBadge(ctx, isBuy ? '매수' : '매도', x, cy + 34, alpha + '0.85)');
    });

    /* ── 가격 축 ── */
    ctx.fillStyle = TV.bg; ctx.fillRect(W - pad.r, 0, pad.r, H);
    ctx.strokeStyle = TV.grid; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(W - pad.r, 0); ctx.lineTo(W - pad.r, H); ctx.stroke();
    for (let i = 0; i <= 5; i++) {
      const v = visLo + (range * i / 5), y = yP(v);
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
          ? 'buy:▲ 변동성 돌파 — 종가가 시가 + 전일 변동폭 × 0.5를 초과. 매수 진입.'
          : 'sell:▼ 익일 시가 청산 — 전일 매수 포지션 자동 청산.');
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
          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: TV.breakout }} />돌파 기준선 (K={K})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-[15px] h-[15px] rounded-full inline-flex items-center justify-center text-[9px] text-white font-semibold" style={{ background: '#26a69a' }}>B</span>
          종가 {'>'} 기준선 매수
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-[15px] h-[15px] rounded-full inline-flex items-center justify-center text-[9px] text-white font-semibold" style={{ background: '#ef5350' }}>S</span>
          익일 시가 청산
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
