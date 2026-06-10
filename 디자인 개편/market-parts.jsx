/* market-parts.jsx — shared building blocks for markets + trade pages */

const fmtKRW = (n) => '₩' + n.toLocaleString('ko-KR');

const STOCKS = [
  { sym:'005930', name:'삼성전자',   price:303500, dPct:-1.14, dAbs:-3500,  vol:'10.2M', mcap:'1,802조',  market:'KOSPI', prevClose:307000 },
  { sym:'000660', name:'SK하이닉스', price:2277000, dPct:+1.52, dAbs:+34000, vol:'2.4M',  mcap:'164조',    market:'KOSPI' },
  { sym:'066570', name:'LG전자',     price:226000, dPct:-3.83, dAbs:-9000,  vol:'1.4M',  mcap:'36조',     market:'KOSPI' },
  { sym:'035420', name:'NAVER',      price:203000, dPct:+2.11, dAbs:+4200,  vol:'1.0M',  mcap:'32조',     market:'KOSPI' },
  { sym:'005380', name:'현대차',     price:696000, dPct:+2.20, dAbs:+15000, vol:'965K',  mcap:'145조',    market:'KOSPI' },
  { sym:'035720', name:'카카오',     price:40000,  dPct:-1.23, dAbs:-500,   vol:'950K',  mcap:'17조',     market:'KOSPI' },
  { sym:'006400', name:'삼성SDI',    price:684000, dPct:+8.57, dAbs:+54000, vol:'820K',  mcap:'46조',     market:'KOSPI' },
  { sym:'012330', name:'현대모비스', price:704000, dPct:+2.33, dAbs:+16000, vol:'710K',  mcap:'68조',     market:'KOSPI' },
  { sym:'373220', name:'LG에너지솔루션', price:444000, dPct:+15.78, dAbs:+60500, vol:'820K', mcap:'104조', market:'KOSPI' },
  { sym:'009150', name:'삼성전기',   price:1701000, dPct:+4.36, dAbs:+71000, vol:'620K',  mcap:'12조',     market:'KOSPI' },
  { sym:'000270', name:'기아',       price:167200, dPct:+1.52, dAbs:+2500,  vol:'584K',  mcap:'68조',     market:'KOSPI' },
  { sym:'105560', name:'KB금융',     price:150300, dPct:-2.28, dAbs:-3500,  vol:'520K',  mcap:'62조',     market:'KOSPI' },
  { sym:'017670', name:'SK텔레콤',   price:97000,  dPct:-3.39, dAbs:-3400,  vol:'480K',  mcap:'21조',     market:'KOSPI' },
];

/* sparkline path with deterministic seed per symbol */
function sparkPathFor(sym, up = true) {
  let h = 0;
  for (let i = 0; i < sym.length; i++) h = (h * 31 + sym.charCodeAt(i)) & 0xffffffff;
  const N = 24;
  const pts = [];
  let y = 22;
  for (let i = 0; i <= N; i++) {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    const noise = ((h % 100) - 50) / 50;
    const drift = up ? -0.45 : 0.35;
    y += noise * 2 + drift;
    y = Math.max(4, Math.min(40, y));
    pts.push([(i / N) * 100, y]);
  }
  return 'M ' + pts.map(p => p.map(n => n.toFixed(1)).join(' ')).join(' L ');
}

/* OHLCV candle generator */
function genCandles(seed, days = 64, start = 180000, end = 305000) {
  const out = [];
  let h = seed;
  let p = start;
  const drift = (end - start) / days;
  for (let i = 0; i < days; i++) {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    const noise = ((h % 1000) - 500) / 500;
    const open = p;
    const range = Math.max(800, Math.abs(noise) * 6000 + 1500);
    const close = open + drift + noise * 4500;
    const high = Math.max(open, close) + Math.abs(noise) * range * 0.5 + 300;
    const low  = Math.min(open, close) - Math.abs(noise) * range * 0.4 - 300;
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    const vol = 4 + ((h % 800) / 100);
    out.push({ o: open, c: close, h: high, l: low, v: vol });
    p = close;
  }
  return out;
}

/* shared style atoms */
const mkCard = {
  borderRadius:16,
  background:'linear-gradient(180deg, rgba(255,255,255,.035), rgba(255,255,255,.012))',
  border:'1px solid var(--line)',
  position:'relative',
  overflow:'hidden',
};
const iconChip = {
  width:26, height:26, borderRadius:6,
  border:'1px solid var(--line)', background:'rgba(255,255,255,.04)',
  color:'var(--ink-1)', cursor:'pointer',
  display:'inline-flex', alignItems:'center', justifyContent:'center',
};
const pillBtn = (kind) => ({
  padding:'10px 18px', borderRadius:10, cursor:'pointer',
  fontFamily:'inherit', fontSize:13.5, fontWeight:600,
  display:'inline-flex', alignItems:'center', whiteSpace:'nowrap',
  ...(kind === 'primary' ? {
    border:0,
    background:'linear-gradient(180deg, var(--up), #c73a3a)',
    color:'#0a1230',
  } : kind === 'danger' ? {
    border:0,
    background:'linear-gradient(180deg, var(--down), #2f6fe0)',
    color:'#0a1230',
  } : {
    border:'1px solid var(--line-strong)', background:'transparent', color:'#fff',
  }),
});
const ddSx = { margin:0, textAlign:'right', minWidth:0,
  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' };

const Stat = ({ label, value, color, prefix }) => (
  <div style={{ ...mkCard, padding:'18px 20px', minWidth:0 }}>
    <div style={{ fontSize:11, color:'var(--ink-2)', letterSpacing:'.14em',
      fontWeight:600, whiteSpace:'nowrap' }}>{label}</div>
    <div className="mono" style={{ marginTop:10, fontSize:'clamp(16px, 2.1vw, 22px)', fontWeight:600,
      letterSpacing:'-.01em', color: color || '#fff', whiteSpace:'nowrap' }}>
      {prefix && value && !value.startsWith('-') && !value.startsWith('+') ? prefix : ''}
      {value}
    </div>
  </div>
);

/* ============================================================ */
/* Stock list (left panel, used by markets + trade)              */
/* ============================================================ */
const StockList = ({ items, activeSym, onPick, compact = false, classTabs = false, minHeight = 760 }) => {
  const [klass, setKlass] = React.useState('stock');
  const [filter, setFilter] = React.useState('all');
  const [query, setQuery] = React.useState('');
  const filtered = items.filter(s =>
    !query || s.name.includes(query) || s.sym.includes(query)
  );
  return (
    <aside style={{ ...mkCard, padding:0, display:'flex', flexDirection:'column', minHeight }}>
      {classTabs && (
        <div style={{ display:'flex', gap:4, padding:'12px 12px 0' }}>
          {[['stock','주식'],['us','미국주식'],['etf','ETF'],['crypto','가상화폐']].map(([k,l]) => (
            <button key={k} onClick={() => setKlass(k)} style={{
              flex:1, padding:'8px 6px', borderRadius:8, fontSize:12.5, fontWeight:600,
              border: klass === k ? '1px solid rgba(91,157,255,.32)' : '1px solid var(--line)',
              background: klass === k ? 'rgba(91,157,255,.12)' : 'transparent',
              color: klass === k ? '#fff' : 'var(--ink-1)',
              cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap',
            }}>{l}</button>
          ))}
        </div>
      )}

      <div style={{ padding: compact ? '14px 14px 12px' : '20px 22px 16px',
        borderBottom:'1px solid var(--line)' }}>
        {!classTabs && (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
            marginBottom:14 }}>
            <h3 style={{ margin:0, fontSize:16, fontWeight:700 }}>종목 목록</h3>
            <span className="mono" style={{ fontSize:11, color:'var(--ink-3)' }}>
              {items.length}개
            </span>
          </div>
        )}
        {/* search */}
        <div style={{ position:'relative', marginTop: classTabs ? 12 : 0 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{
            position:'absolute', left:12, top:'50%', transform:'translateY(-50%)',
            color:'var(--ink-3)',
          }}>
            <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M9 9l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input
            value={query} onChange={e => setQuery(e.target.value)}
            placeholder="전체 KOSPI/KOSDAQ 종목 검색…"
            style={{
              width:'100%', padding:'10px 12px 10px 34px', borderRadius:8,
              border:'1px solid var(--line)', background:'rgba(255,255,255,.025)',
              color:'#fff', fontSize:13, outline:'none', fontFamily:'inherit',
            }}
          />
        </div>

        {!compact && (
          <div style={{ display:'flex', gap:6, padding:3, borderRadius:8, marginTop:14,
            background:'rgba(255,255,255,.04)', border:'1px solid var(--line)', width:'fit-content' }}>
            {[['all','전체'],['fav','★ 관심'],['gain','급등'],['loss','급락']].map(([k,l]) => (
              <button key={k} onClick={() => setFilter(k)} style={{
                padding:'6px 12px', borderRadius:6, fontSize:12.5, fontWeight:600,
                border:0, cursor:'pointer', fontFamily:'inherit',
                background: filter === k ? 'rgba(91,157,255,.18)' : 'transparent',
                color: filter === k ? '#fff' : 'var(--ink-1)',
              }}>{l}</button>
            ))}
          </div>
        )}

        {compact && (
          <div style={{ marginTop:12, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontSize:11.5, color:'var(--ink-2)', letterSpacing:'.06em' }}>
              주식 <span className="mono" style={{ color:'#fff', fontWeight:600 }}>{items.length}개</span>
            </span>
            <button style={{
              fontSize:11.5, color:'var(--ink-1)', background:'transparent', border:0,
              cursor:'pointer', fontFamily:'inherit',
            }}>편집</button>
          </div>
        )}
      </div>

      <ul style={{ margin:0, padding:0, listStyle:'none', flex:1, overflowY:'auto',
        maxHeight: compact ? 720 : 640 }} className="no-scrollbar">
        {filtered.map((s, i) => {
          const isActive = s.sym === activeSym;
          const up = s.dPct >= 0;
          return (
            <li key={s.sym}>
              <button onClick={() => onPick(s.sym)} style={{
                width:'100%', textAlign:'left', cursor:'pointer',
                display:'grid',
                gridTemplateColumns: compact ? '1fr auto' : '1fr 70px auto',
                alignItems:'center', gap: compact ? 10 : 12,
                padding: compact ? '12px 14px' : '14px 22px',
                background: isActive ? 'rgba(91,157,255,.10)' : 'transparent',
                borderLeft: isActive ? '2px solid var(--accent-glow)' : '2px solid transparent',
                border:'none', fontFamily:'inherit', color:'#fff',
                borderBottom: i === filtered.length-1 ? 'none' : '1px solid var(--line)',
              }}>
                <div style={{ display:'flex', flexDirection:'column', gap:2, minWidth:0 }}>
                  <span style={{ fontSize:13.5, fontWeight: isActive ? 700 : 600,
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {s.name}
                  </span>
                  <span className="mono" style={{ fontSize:11, color:'var(--ink-3)' }}>
                    {s.sym}{compact ? '' : ` · Vol ${s.vol}`}
                  </span>
                </div>
                {!compact && (
                  <div style={{ height:24, opacity:.8 }}>
                    <svg viewBox="0 0 100 44" width="100%" height="100%" preserveAspectRatio="none">
                      <path d={sparkPathFor(s.sym, up)} fill="none"
                        stroke={up ? 'var(--up)' : 'var(--down)'} strokeWidth="1.2"
                        vectorEffect="non-scaling-stroke"/>
                    </svg>
                  </div>
                )}
                <div style={{ textAlign:'right', display:'flex', flexDirection:'column', gap:2 }}>
                  <span className="mono" style={{ fontSize:13, fontWeight:600 }}>
                    {fmtKRW(s.price)}
                  </span>
                  <span className="mono" style={{ fontSize:11.5, fontWeight:600,
                    color: up ? 'var(--up)' : 'var(--down)' }}>
                    {up ? '+' : ''}{s.dPct.toFixed(2)}%
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <div style={{ padding:'12px 18px', borderTop:'1px solid var(--line)',
        background:'rgba(255,255,255,.015)' }}>
        <span style={{ fontSize:11, color:'var(--ink-3)' }}>
          * 주식 시세는 KIS 모의투자 API 기준 약 15~20초 시차
        </span>
      </div>
    </aside>
  );
};

/* ============================================================ */
/* Candlestick chart                                              */
/* ============================================================ */
const CandlestickChart = ({ data, height = 320 }) => {
  const W = 880, H = height;
  const padL = 8, padR = 56, padT = 16, padB = 92;
  const innerW = W - padL - padR;
  const priceH = H - padT - padB;
  const volH = 60;
  const volTop = H - padB + 16;

  const maxP = Math.max(...data.map(d => d.h));
  const minP = Math.min(...data.map(d => d.l));
  const rangeP = maxP - minP;
  const yP = (p) => padT + ((maxP - p) / rangeP) * priceH;

  const maxV = Math.max(...data.map(d => d.v));
  const yV = (v) => volTop + (1 - v / maxV) * volH;

  const candleW = innerW / data.length;
  const bodyW = Math.max(2, candleW * 0.65);

  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => minP + (1-t) * rangeP);
  const xLabels = [];
  const labelCount = 7;
  for (let i = 0; i < labelCount; i++) {
    const idx = Math.round((i / (labelCount-1)) * (data.length - 1));
    xLabels.push({ x: padL + idx * candleW + candleW/2, label: `${idx+1}일` });
  }
  const last = data[data.length-1];
  const lastY = yP(last.c);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ display:'block' }}>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={yP(t)} y2={yP(t)}
            stroke="rgba(255,255,255,.05)" strokeWidth="1"/>
          <text x={W - padR + 6} y={yP(t) + 4}
            fill="rgba(255,255,255,.4)" fontSize="10" fontFamily="JetBrains Mono, monospace">
            {Math.round(t).toLocaleString()}
          </text>
        </g>
      ))}

      {data.map((d, i) => {
        const up = d.c >= d.o;
        const x = padL + i * candleW + candleW/2;
        const color = up ? '#ef4d4d' : '#4d8aff';
        const yOpen = yP(d.o), yClose = yP(d.c);
        const bodyTop = Math.min(yOpen, yClose);
        const bodyHeight = Math.max(1, Math.abs(yClose - yOpen));
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={yP(d.h)} y2={yP(d.l)} stroke={color} strokeWidth="1"/>
            <rect x={x - bodyW/2} y={bodyTop} width={bodyW} height={bodyHeight} fill={color}/>
            <rect x={x - bodyW/2} y={yV(d.v)}
              width={bodyW} height={(volTop + volH) - yV(d.v)}
              fill={color} opacity=".35"/>
          </g>
        );
      })}

      <line x1={padL} x2={W - padR} y1={lastY} y2={lastY}
        stroke="#5b9dff" strokeWidth=".7" strokeDasharray="3 3" opacity=".6"/>
      <rect x={W - padR + 2} y={lastY - 8} width={48} height={16} rx={3} fill="#5b9dff"/>
      <text x={W - padR + 26} y={lastY + 4} fill="#fff"
        fontSize="10" fontWeight="700" textAnchor="middle"
        fontFamily="JetBrains Mono, monospace">
        {Math.round(last.c).toLocaleString()}
      </text>

      {xLabels.map((l, i) => (
        <text key={i} x={l.x} y={H - padB + 12}
          fill="rgba(255,255,255,.4)" fontSize="10" textAnchor="middle"
          fontFamily="JetBrains Mono, monospace">{l.label}</text>
      ))}

      <line x1={padL} x2={W - padR} y1={volTop - 4} y2={volTop - 4}
        stroke="rgba(255,255,255,.08)" strokeWidth="1"/>
      <text x={W - padR + 6} y={yV(maxV) + 4}
        fill="rgba(255,255,255,.4)" fontSize="9"
        fontFamily="JetBrains Mono, monospace">
        {maxV.toFixed(1)}M
      </text>
    </svg>
  );
};

Object.assign(window, {
  STOCKS, fmtKRW, sparkPathFor, genCandles, CandlestickChart,
  StockList, mkCard, iconChip, pillBtn, ddSx, Stat,
});
