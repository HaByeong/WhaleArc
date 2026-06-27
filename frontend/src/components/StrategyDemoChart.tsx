import { useEffect, useRef, useState, useCallback } from 'react';
import { TV, mulberry32, badge, type DemoBuilt, type DemoConfig } from './demoChartUtils';

/* 전략 시뮬레이션 데모 차트 — 재사용 엔진.
 * 시드 캔들 데이터를 만들고, 전략이 잡는 매수·매도 신호를 프레임별로 애니메이션한다.
 * 기존 GoldenCrossCanvasChart 등과 동일한 TradingView 톤·캔들·배지 스타일.
 * 지표 계산·시드 데이터·드로잉 헬퍼는 demoChartUtils.ts 참조. */

const SEED = 7;

export default function StrategyDemoChart({ config }: { config: DemoConfig }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const playingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dataRef = useRef<DemoBuilt>(config.build(mulberry32(SEED)));
  const dprRef = useRef(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);

  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [status, setStatus] = useState<{ text: string; color: string } | null>(null);

  const N = dataRef.current.closes.length;

  const draw = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const dpr = dprRef.current;
    const W = canvas.width / dpr, H = canvas.height / dpr;
    const pad = { t: 16, r: 58, b: 22, l: 8 };
    const frame = frameRef.current;
    const { opens, closes, highs, lows, lines, signals } = dataRef.current;
    const cw = (W - pad.l - pad.r) / N;

    ctx.fillStyle = TV.bg; ctx.fillRect(0, 0, W, H);

    let hi = -Infinity, lo = Infinity;
    for (let i = 0; i <= frame && i < N; i++) {
      hi = Math.max(hi, highs[i]); lo = Math.min(lo, lows[i]);
      for (const ln of lines) { const v = ln.data[i]; if (v !== null && v !== undefined) { hi = Math.max(hi, v); lo = Math.min(lo, v); } }
    }
    let range = hi - lo || 1; hi += range * 0.07; lo -= range * 0.07; range = hi - lo;
    const yP = (v: number) => pad.t + (1 - (v - lo) / range) * (H - pad.t - pad.b);

    for (let i = 0; i <= 5; i++) {
      const y = yP(lo + range * i / 5);
      ctx.strokeStyle = TV.grid; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
    }

    // 캔들
    for (let i = 0; i <= frame && i < N; i++) {
      const x = pad.l + i * cw + cw / 2, bw = Math.max(cw * 0.66, 2);
      const bull = closes[i] >= opens[i], color = bull ? TV.bull : TV.bear;
      ctx.strokeStyle = color; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, yP(highs[i])); ctx.lineTo(x, yP(lows[i])); ctx.stroke();
      const top = yP(Math.max(opens[i], closes[i])), bot = yP(Math.min(opens[i], closes[i]));
      ctx.fillStyle = color; ctx.fillRect(x - bw / 2, top, bw, Math.max(bot - top, 1));
    }

    // 지표선
    for (const ln of lines) {
      ctx.strokeStyle = ln.color; ctx.lineWidth = ln.width ?? 1.5;
      ctx.save(); if (ln.dash) ctx.setLineDash([4, 3]);
      ctx.beginPath(); let started = false;
      for (let i = 0; i <= frame && i < N; i++) {
        const v = ln.data[i]; if (v === null || v === undefined) { started = false; continue; }
        const x = pad.l + i * cw + cw / 2, y = yP(v);
        if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
      }
      ctx.stroke(); ctx.restore();
    }

    // 신호 마커
    for (const sg of signals) {
      if (sg.i > frame) continue;
      const x = pad.l + sg.i * cw + cw / 2, y = yP(sg.price);
      const clr = sg.kind === 'buy' ? TV.bull : sg.kind === 'sell' ? TV.bear : (sg.markColor ?? '#5b9dff');
      const rgb = sg.kind === 'buy' ? '38,166,154' : sg.kind === 'sell' ? '239,83,80' : '91,157,255';
      ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI * 2); ctx.fillStyle = `rgba(${rgb},0.15)`; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fillStyle = `rgba(${rgb},0.3)`; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, 5.5, 0, Math.PI * 2); ctx.fillStyle = clr; ctx.fill();
      badge(ctx, sg.label, x, y - 22, `rgba(${rgb},0.92)`, 11);
      if (sg.kind !== 'mark') {
        ctx.font = '600 13px -apple-system, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = clr; ctx.fillText(sg.kind === 'buy' ? '▲' : '▼', x, y + 22);
        badge(ctx, sg.kind === 'buy' ? '매수' : '매도', x, y + 36, `rgba(${rgb},0.85)`, 10);
      }
    }

    // 우측 가격축
    ctx.fillStyle = TV.bg; ctx.fillRect(W - pad.r, 0, pad.r, H);
    ctx.strokeStyle = TV.grid; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(W - pad.r, 0); ctx.lineTo(W - pad.r, H); ctx.stroke();
    for (let i = 0; i <= 5; i++) {
      const v = lo + range * i / 5, y = yP(v);
      ctx.fillStyle = TV.gridText; ctx.font = '11px -apple-system, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(v.toFixed(1), W - pad.r + 6, y);
    }
    const li = Math.min(frame, N - 1), lp = closes[li], yp = yP(lp), bull = closes[li] >= opens[li];
    ctx.fillStyle = bull ? TV.bull : TV.bear; ctx.fillRect(W - pad.r, yp - 10, pad.r, 20);
    ctx.fillStyle = '#fff'; ctx.font = '600 11px -apple-system, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(lp.toFixed(1), W - pad.r + 6, yp);
    ctx.save(); ctx.setLineDash([4, 3]); ctx.strokeStyle = bull ? 'rgba(38,166,154,0.4)' : 'rgba(239,83,80,0.4)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(pad.l, yp); ctx.lineTo(W - pad.r, yp); ctx.stroke(); ctx.restore();

    // 상태(현재 프레임에 신호가 있으면 표시)
    const hit = signals.find(s => s.i === frame);
    if (hit) setStatus({ text: `${hit.label}${hit.sub ? ' — ' + hit.sub : ''}`, color: hit.kind === 'buy' ? TV.bull : hit.kind === 'sell' ? TV.bear : (hit.markColor ?? '#5b9dff') });
  }, [N]);

  const resize = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    dprRef.current = window.devicePixelRatio || 1;
    const dpr = dprRef.current, p = canvas.parentElement!;
    canvas.width = p.clientWidth * dpr; canvas.height = p.clientHeight * dpr;
    canvas.style.width = p.clientWidth + 'px'; canvas.style.height = p.clientHeight + 'px';
    const ctx = canvas.getContext('2d'); if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, []);

  const stop = useCallback(() => {
    playingRef.current = false; setPlaying(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (frameRef.current >= N - 1) setFinished(true);
  }, [N]);
  const step = useCallback(() => { if (frameRef.current < N - 1) { frameRef.current++; draw(); } else stop(); }, [draw, stop, N]);
  const start = useCallback(() => {
    if (playingRef.current) return; playingRef.current = true; setPlaying(true); setFinished(false);
    if (frameRef.current >= N - 1) { frameRef.current = 0; setStatus(null); }
    timerRef.current = setInterval(step, 55);
  }, [step, N]);
  const reset = useCallback(() => { stop(); dataRef.current = config.build(mulberry32(SEED)); frameRef.current = 0; setStatus(null); setFinished(false); draw(); }, [stop, draw, config]);

  useEffect(() => {
    if (!canvasRef.current) return; resize(); draw();
    const onResize = () => { resize(); draw(); };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); if (timerRef.current) clearInterval(timerRef.current); };
  }, [resize, draw]);

  const onClickCanvas = () => { if (finished) reset(); else if (playingRef.current) stop(); else start(); };

  return (
    <div>
      <div className="mb-2.5 flex flex-wrap gap-3 text-[13px] text-gray-500">
        {config.legend.map((lg, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: lg.color }} />{lg.label}
          </span>
        ))}
      </div>
      <div className="relative w-full overflow-hidden rounded-xl cursor-pointer" style={{ height: config.height ?? 400 }} onClick={onClickCanvas}>
        <canvas ref={canvasRef} className="block" />
        {!playing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 shadow-lg transition-transform hover:scale-110">
              {finished
                ? <svg className="h-7 w-7 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                : <svg className="ml-1 h-8 w-8 text-gray-700" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>}
            </div>
          </div>
        )}
      </div>
      <div className="mt-2.5 min-h-[20px] text-[14px]">
        {status && <span style={{ color: status.color }}>{status.text}</span>}
      </div>
    </div>
  );
}
