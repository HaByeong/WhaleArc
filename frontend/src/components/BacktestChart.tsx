import { useEffect, useMemo, useRef, useState, useCallback } from 'react';

/* 백테스트 결과용 인터랙티브 차트 — 줌(휠)·팬(드래그)·크로스헤어 툴팁.
 * 매매 마커(▲매수/▼매도)에 hover하면 사유·손익을 보여준다. 줌하면 보이는 구간에 맞춰 y축도 재스케일된다. */

export interface BtMarker {
  i: number; type: 'BUY' | 'SELL' | 'SHORT' | 'COVER';
  reason?: string; pnl?: number; pnlPercent?: number; price?: number;
}
export interface BtLine { data: number[]; color: string; dash?: boolean; label?: string }

interface Props {
  pts: number[];
  dates?: string[];
  lines?: BtLine[];
  markers?: BtMarker[];
  baseline?: number; baselineLabel?: string;
  height?: number;
  valueFmt: (v: number) => string;
  glow?: string;     // 주 라인 색
  upColor?: string;  // 매수 색
  downColor?: string;// 매도 색
}

const TRADE_KO: Record<string, string> = { BUY: '매수', SELL: '매도', SHORT: '공매도', COVER: '커버' };

export default function BacktestChart({
  pts, dates, lines = [], markers = [], baseline, baselineLabel,
  height = 260, valueFmt, glow = '#5b9dff', upColor = '#ef4d4d', downColor = '#4d8aff',
}: Props) {
  const n = pts.length;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [cw, setCw] = useState(860);
  const [range, setRange] = useState<[number, number]>([0, Math.max(0, n - 1)]);
  const [hover, setHover] = useState<{ idx: number; px: number } | null>(null);
  const dragRef = useRef<{ x: number; range: [number, number] } | null>(null);

  // 새 결과(길이 변경) 시 전체 범위로 리셋
  useEffect(() => { setRange([0, Math.max(0, n - 1)]); setHover(null); }, [n]);

  // 컨테이너 실제 폭 측정(왜곡 없는 좌표계)
  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setCw(el.clientWidth || 860));
    ro.observe(el); setCw(el.clientWidth || 860);
    return () => ro.disconnect();
  }, []);

  const [s, e] = range;
  const span = Math.max(1, e - s);
  const padR = 56, H = height, padT = 10, padB = 18;
  const xOf = (i: number) => ((i - s) / span) * (cw - padR);

  // 보이는 구간 기준 y 범위(줌하면 디테일 확대)
  const { vmin, vmax } = useMemo(() => {
    let mn = Infinity, mx = -Infinity;
    const lo = Math.max(0, Math.floor(s)), hi = Math.min(n - 1, Math.ceil(e));
    for (let i = lo; i <= hi; i++) {
      if (Number.isFinite(pts[i])) { mn = Math.min(mn, pts[i]); mx = Math.max(mx, pts[i]); }
      for (const ln of lines) { const v = ln.data[i]; if (Number.isFinite(v)) { mn = Math.min(mn, v); mx = Math.max(mx, v); } }
    }
    if (baseline != null && Number.isFinite(baseline) && baseline >= mn * 0.9 && baseline <= mx * 1.1) { mn = Math.min(mn, baseline); mx = Math.max(mx, baseline); }
    if (!Number.isFinite(mn) || !Number.isFinite(mx)) { mn = 0; mx = 1; }
    if (mn === mx) { mn -= 1; mx += 1; }
    const pad = (mx - mn) * 0.08;
    return { vmin: mn - pad, vmax: mx + pad };
  }, [s, e, n, pts, lines, baseline]);
  const yOf = (v: number) => padT + ((vmax - v) / (vmax - vmin || 1)) * (H - padT - padB);

  const pathFor = (d: number[]) => {
    let out = '', started = false;
    const lo = Math.max(0, Math.floor(s) - 1), hi = Math.min(n - 1, Math.ceil(e) + 1);
    for (let i = lo; i <= hi; i++) {
      if (!Number.isFinite(d[i])) { started = false; continue; }
      out += `${started ? 'L' : 'M'} ${xOf(i).toFixed(1)} ${yOf(d[i]).toFixed(1)} `; started = true;
    }
    return out;
  };

  // 마우스 → 데이터 인덱스
  const idxFromClient = useCallback((clientX: number) => {
    const el = wrapRef.current; if (!el) return s;
    const rect = el.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (clientX - rect.left) / (rect.width * ((cw - padR) / cw) || 1)));
    return Math.round(s + f * span);
  }, [s, span, cw]);

  const onMove = (ev: React.MouseEvent) => {
    if (dragRef.current) {
      const el = wrapRef.current!; const rect = el.getBoundingClientRect();
      const dxFrac = (ev.clientX - dragRef.current.x) / (rect.width || 1);
      const shift = -dxFrac * span;
      const [os, oe] = dragRef.current.range;
      let ns = os + shift, ne = oe + shift;
      if (ns < 0) { ne -= ns; ns = 0; }
      if (ne > n - 1) { ns -= ne - (n - 1); ne = n - 1; }
      setRange([Math.max(0, ns), Math.min(n - 1, ne)]);
      return;
    }
    const idx = Math.min(e, Math.max(s, idxFromClient(ev.clientX)));
    setHover({ idx, px: xOf(idx) });
  };
  // 휠 줌 — React onWheel은 passive라 preventDefault가 안 먹어, non-passive 리스너로 직접 부착(페이지 스크롤 방지).
  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const handler = (ev: WheelEvent) => {
      if (n < 4) return;
      ev.preventDefault();
      const rect = el.getBoundingClientRect();
      const f = Math.min(1, Math.max(0, (ev.clientX - rect.left) / (rect.width || 1)));
      const center = s + f * span;
      const factor = ev.deltaY < 0 ? 0.8 : 1.25;
      const newSpan = Math.min(n - 1, Math.max(4, span * factor));
      let ns = center - f * newSpan, ne = ns + newSpan;
      if (ns < 0) { ns = 0; ne = newSpan; }
      if (ne > n - 1) { ne = n - 1; ns = ne - newSpan; }
      setRange([Math.max(0, ns), Math.min(n - 1, ne)]);
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [s, e, span, n]);

  const onDown = (ev: React.MouseEvent) => { dragRef.current = { x: ev.clientX, range: [s, e] }; setHover(null); };
  const endDrag = () => { dragRef.current = null; };
  const reset = () => { setRange([0, Math.max(0, n - 1)]); };

  const zoomed = s > 0 || e < n - 1;
  const markerAt = (idx: number) => markers.find(m => m.i === idx) ?? markers.find(m => Math.abs(m.i - idx) <= Math.max(0, Math.round(span / 120)));
  const hoverMarker = hover ? markerAt(hover.idx) : undefined;

  if (n === 0) return <div className="flex h-full items-center justify-center text-[14px]" style={{ color: 'var(--ci-ink3)' }}>데이터 없음</div>;

  const areaPath = pathFor(pts) ? pathFor(pts) + `L ${xOf(Math.min(n - 1, Math.ceil(e))).toFixed(1)} ${H} L ${xOf(Math.max(0, Math.floor(s))).toFixed(1)} ${H} Z` : '';
  const visMarkers = markers.filter(m => m.i >= s - 1 && m.i <= e + 1 && Number.isFinite(pts[m.i]));

  return (
    <div className="relative select-none" style={{ height: H }}>
      {/* 줌 안내 / 리셋 */}
      <div className="pointer-events-none absolute right-1 top-0 z-10 flex items-center gap-2">
        {zoomed && <button onClick={reset} className="pointer-events-auto rounded-md px-2 py-1 text-[11.5px] font-semibold" style={{ background: 'var(--ci-raised)', border: '1px solid var(--ci-line)', color: 'var(--ci-ink1)' }}>전체 보기</button>}
      </div>
      <div
        ref={wrapRef}
        className="h-full w-full cursor-crosshair"
        onMouseMove={onMove}
        onMouseLeave={() => { setHover(null); endDrag(); }}
        onMouseDown={onDown}
        onMouseUp={endDrag}
        onDoubleClick={reset}
      >
        <svg viewBox={`0 0 ${cw} ${H}`} width="100%" height="100%" preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }}>
          <defs><linearGradient id="bt-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={glow} stopOpacity=".18" /><stop offset="100%" stopColor={glow} stopOpacity="0" /></linearGradient></defs>
          {/* 그리드 */}
          {[0, 0.25, 0.5, 0.75, 1].map((t, i) => { const v = vmin + t * (vmax - vmin); const y = yOf(v); return (
            <g key={i}>
              <line x1={0} x2={cw - padR} y1={y} y2={y} stroke="var(--ci-line)" strokeWidth={0.7} vectorEffect="non-scaling-stroke" />
              <text x={cw - padR + 5} y={y + 3.5} fill="var(--ci-ink3)" fontSize="11">{valueFmt(v)}</text>
            </g>
          ); })}
          {/* 기준선 */}
          {baseline != null && Number.isFinite(baseline) && baseline >= vmin && baseline <= vmax && (
            <><line x1={0} x2={cw - padR} y1={yOf(baseline)} y2={yOf(baseline)} stroke="var(--ci-ink3)" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
              {baselineLabel && <text x={4} y={yOf(baseline) - 4} fill="var(--ci-ink3)" fontSize="11">{baselineLabel}</text>}</>
          )}
          {/* 영역 + 주 라인 */}
          {areaPath && <path d={areaPath} fill="url(#bt-area)" />}
          <path d={pathFor(pts)} fill="none" stroke={glow} strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          {/* 보조 라인(Buy&Hold 등) */}
          {lines.map((l, k) => <path key={k} d={pathFor(l.data)} fill="none" stroke={l.color} strokeWidth="1.6" strokeDasharray={l.dash ? '4 3' : undefined} vectorEffect="non-scaling-stroke" />)}
          {/* x축 날짜(시작·중간·끝) */}
          {dates && [s, (s + e) / 2, e].map((i, k) => { const ix = Math.round(i); const d = dates[ix]; if (!d) return null; const x = xOf(ix); return (
            <text key={k} x={Math.min(Math.max(x, 2), cw - padR - 2)} y={H - 4} fill="var(--ci-ink3)" fontSize="10.5" textAnchor={k === 0 ? 'start' : k === 2 ? 'end' : 'middle'}>{d}</text>
          ); })}
          {/* 매매 마커(▲매수 ▼매도) */}
          {visMarkers.map((m, k) => {
            const x = xOf(m.i), y = yOf(pts[m.i]); const buy = m.type === 'BUY' || m.type === 'COVER';
            const c = buy ? upColor : downColor; const on = hoverMarker && hoverMarker.i === m.i;
            return (
              <g key={k}>
                {buy
                  ? <path d={`M ${x} ${y + 9} l -5 9 l 10 0 Z`} fill={c} stroke="var(--ci-card)" strokeWidth={on ? 1.6 : 1} />
                  : <path d={`M ${x} ${y - 9} l -5 -9 l 10 0 Z`} fill={c} stroke="var(--ci-card)" strokeWidth={on ? 1.6 : 1} />}
                <circle cx={x} cy={y} r={on ? 4 : 3} fill={c} stroke="var(--ci-card)" strokeWidth="1.2" />
              </g>
            );
          })}
          {/* 크로스헤어 */}
          {hover && !dragRef.current && Number.isFinite(pts[hover.idx]) && (
            <g>
              <line x1={hover.px} x2={hover.px} y1={padT} y2={H - padB} stroke="var(--ci-ink3)" strokeWidth="0.8" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
              <circle cx={hover.px} cy={yOf(pts[hover.idx])} r="3.5" fill={glow} stroke="var(--ci-card)" strokeWidth="1.4" />
            </g>
          )}
        </svg>
      </div>

      {/* 툴팁 */}
      {hover && !dragRef.current && Number.isFinite(pts[hover.idx]) && (
        <div
          className="pointer-events-none absolute z-20 rounded-lg px-2.5 py-2 text-[12px] leading-relaxed shadow-lg"
          style={{
            top: 4,
            left: Math.min(Math.max(hover.px - 70, 2), cw - 160),
            background: 'var(--ci-raised)', border: '1px solid var(--ci-line)', color: 'var(--ci-ink0)', minWidth: 132,
          }}
        >
          {dates?.[hover.idx] && <div className="mb-1 font-mono text-[11px]" style={{ color: 'var(--ci-ink3)' }}>{dates[hover.idx]}</div>}
          <div className="font-mono font-semibold">{valueFmt(pts[hover.idx])}</div>
          {lines.map((l, k) => Number.isFinite(l.data[hover.idx]) && (
            <div key={k} className="font-mono text-[11px]" style={{ color: l.color }}>{l.label ?? '보조'} {valueFmt(l.data[hover.idx])}</div>
          ))}
          {hoverMarker && (
            <div className="mt-1.5 border-t pt-1.5" style={{ borderColor: 'var(--ci-line)' }}>
              <span className="font-bold" style={{ color: (hoverMarker.type === 'BUY' || hoverMarker.type === 'COVER') ? upColor : downColor }}>
                {(hoverMarker.type === 'BUY' || hoverMarker.type === 'COVER') ? '▲' : '▼'} {TRADE_KO[hoverMarker.type] ?? hoverMarker.type}
              </span>
              {hoverMarker.price != null && <span className="ml-1.5 font-mono">{valueFmt(hoverMarker.price)}</span>}
              {hoverMarker.reason && <div className="mt-0.5" style={{ color: 'var(--ci-ink1)' }}>사유: {hoverMarker.reason}</div>}
              {hoverMarker.pnl != null && (hoverMarker.type === 'SELL' || hoverMarker.type === 'COVER') && (
                <div className="mt-0.5 font-mono" style={{ color: hoverMarker.pnl >= 0 ? upColor : downColor }}>
                  손익 {hoverMarker.pnl >= 0 ? '+' : ''}{valueFmt(hoverMarker.pnl)}{hoverMarker.pnlPercent != null ? ` (${hoverMarker.pnlPercent >= 0 ? '+' : ''}${hoverMarker.pnlPercent.toFixed(2)}%)` : ''}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 줌 힌트 */}
      {!zoomed && n > 8 && (
        <div className="pointer-events-none absolute bottom-0 left-1 z-10 text-[11px]" style={{ color: 'var(--ci-ink3)' }}>스크롤=확대 · 드래그=이동 · 더블클릭=초기화</div>
      )}
    </div>
  );
}
