/* Markets (LIGHT) — port of markets.html in light theme */

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
];

const INDICES = [
  { name:'KOSPI',   v:'2,712.18', d:'+0.42%', up:true  },
  { name:'KOSDAQ',  v:'872.46',   d:'-0.18%', up:false },
  { name:'S&P 500', v:'5,234.12', d:'+0.31%', up:true  },
  { name:'BTC/KRW', v:'₩94.2M',   d:'+1.24%', up:true  },
];

const ASSET_CLASSES = [
  { key:'stock',  label:'주식',     meta:'KOSPI · KOSDAQ' },
  { key:'us',     label:'미국주식', meta:'NYSE · NASDAQ' },
  { key:'etf',    label:'ETF',      meta:'국내 · 해외' },
  { key:'crypto', label:'가상화폐', meta:'빗썸' },
];

/* sparkline */
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

function genCandles(seed, days, start, end) {
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

/* shared light-mode styles */
const lCard = {
  background:'var(--bg-1)',
  borderRadius:16,
  border:'1px solid var(--line)',
  boxShadow:'0 1px 0 rgba(14,25,54,.02), 0 6px 24px -16px rgba(14,25,54,.10)',
  position:'relative',
  overflow:'hidden',
};
const lIconChip = {
  width:26, height:26, borderRadius:6,
  border:'1px solid var(--line)', background:'var(--bg-2)',
  color:'var(--ink-1)', cursor:'pointer',
  display:'inline-flex', alignItems:'center', justifyContent:'center',
};
const lPillBtn = (kind) => ({
  padding:'10px 18px', borderRadius:10, cursor:'pointer',
  fontFamily:'inherit', fontSize:13.5, fontWeight:600,
  display:'inline-flex', alignItems:'center', whiteSpace:'nowrap',
  textDecoration:'none',
  ...(kind === 'primary' ? {
    border:0,
    background:'linear-gradient(180deg, var(--up), #0d8a3f)',
    color:'#fff',
  } : kind === 'danger' ? {
    border:0,
    background:'linear-gradient(180deg, var(--down), #c73838)',
    color:'#fff',
  } : {
    border:'1px solid var(--line-strong)', background:'var(--bg-1)',
    color:'var(--ink-0)',
  }),
});
const lDdSx = { margin:0, textAlign:'right', minWidth:0,
  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' };

/* ============================================================ */
/* Top nav (LIGHT version of DashNav)                            */
/* ============================================================ */
const LightLogo = () => (
  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M2 13 Q6 5 11 9 Q16 13 20 6" stroke="var(--ink-0)" strokeWidth="2"
        strokeLinecap="round" fill="none"/>
      <circle cx="11" cy="9" r="1.6" fill="var(--ink-0)"/>
    </svg>
    <span style={{ fontSize:15, fontWeight:700, letterSpacing:'.14em',
      color:'var(--ink-0)' }}>WHALEARC</span>
  </div>
);

const LightDashNav = ({ active = '시세' }) => {
  const items = ['내 투자','포트폴리오','시세','거래','전략','전략 학습','투자 현황'];
  const [cur, setCur] = React.useState(active);
  return (
    <header style={{
      position:'sticky', top:0, zIndex:50,
      background:'rgba(255,255,255,.85)',
      backdropFilter:'blur(14px)',
      borderBottom:'1px solid var(--line)',
      display:'grid', gridTemplateColumns:'auto 1fr auto', alignItems:'center',
      padding:'14px 24px', gap:20,
    }}>
      <a href="WhaleArc.html"><LightLogo /></a>
      <nav style={{ display:'flex', alignItems:'center', gap:4, justifyContent:'flex-start',
        overflowX:'auto' }} className="no-scrollbar">
        {items.map(it => (
          <a key={it} onClick={() => setCur(it)} style={{
            padding:'8px 12px', borderRadius:8, fontSize:13.5, fontWeight:500,
            color: it === cur ? 'var(--accent)' : 'var(--ink-1)',
            background: it === cur ? 'var(--accent-bg)' : 'transparent',
            cursor:'pointer', whiteSpace:'nowrap', flexShrink:0,
          }}>{it}</a>
        ))}
      </nav>
      <div style={{ display:'flex', alignItems:'center', gap:10, whiteSpace:'nowrap' }}>
        <a style={{ fontSize:13, color:'var(--ink-1)', cursor:'pointer' }}>의견 보내기</a>
        <button title="다크 모드" style={{
          width:36, height:36, borderRadius:10,
          border:'1px solid var(--line)', background:'var(--bg-1)',
          color:'var(--ink-1)', cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M12 9.5A5 5 0 0 1 6.5 4a.5.5 0 0 0-.7-.5A6 6 0 1 0 12.5 10.2a.5.5 0 0 0-.5-.7Z"
              stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
          </svg>
        </button>
        <button title="알림" style={{
          position:'relative', width:36, height:36, borderRadius:10,
          border:'1px solid var(--line)', background:'var(--bg-1)',
          color:'var(--ink-1)', cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3.5 11.5h9l-1-1.2V7.2a3.5 3.5 0 1 0-7 0v3.1l-1 1.2Z"
              stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
            <path d="M6.5 13.2a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <span style={{ position:'absolute', top:-4, right:-4, minWidth:18, height:18,
            padding:'0 5px', borderRadius:999, background:'#ef4444', color:'#fff',
            fontSize:10.5, fontWeight:700,
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:'0 0 0 2px var(--bg-0)' }}>3</span>
        </button>
        <div style={{ display:'flex', alignItems:'center', gap:8,
          padding:'5px 12px 5px 5px', borderRadius:999,
          background:'var(--bg-2)', border:'1px solid var(--line)',
          cursor:'pointer' }}>
          <span style={{
            width:26, height:26, borderRadius:'50%',
            background:'linear-gradient(135deg, #5b9dff, #2c6fe6)',
            color:'#fff', fontSize:12, fontWeight:700,
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>김</span>
          <span style={{ fontSize:13, fontWeight:600 }}>김병하</span>
        </div>
        <a style={{ fontSize:13, color:'var(--ink-2)', cursor:'pointer' }}>로그아웃</a>
      </div>
    </header>
  );
};

/* ============================================================ */
/* Page header + index strip + class tabs                        */
/* ============================================================ */
const LightPageHeader = () => (
  <section style={{ padding:'28px 32px 0' }}>
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
      <span style={{ width:6, height:6, borderRadius:'50%',
        background:'var(--up)', boxShadow:'0 0 8px rgba(22,163,74,.5)',
        animation:'pulse-dot 2s ease-in-out infinite' }}/>
      <span style={{ fontSize:11.5, letterSpacing:'.18em', color:'var(--accent)',
        fontWeight:600 }}>LIVE · 0.2초 갱신 · 마지막 4:32:18</span>
    </div>
    <h1 style={{ margin:0, fontSize:32, lineHeight:1.15, fontWeight:700,
      letterSpacing:'-.02em' }}>시장 현황</h1>
    <p style={{ margin:'8px 0 0', fontSize:14, color:'var(--ink-1)' }}>
      주식 · 미국주식 · ETF · 가상화폐 시세를 한 곳에서 살펴보세요.
    </p>
  </section>
);

const LightIndexStrip = () => (
  <section style={{ padding:'24px 32px 0' }}>
    <div style={{ display:'grid',
      gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:14 }}>
      {INDICES.map(idx => {
        const slug = idx.name.replace(/[^a-zA-Z0-9_-]/g, '');
        return (
        <div key={idx.name} style={{ ...lCard, padding:'18px 20px' }}>
          <div style={{ fontSize:11, color:'var(--ink-2)', letterSpacing:'.14em',
            fontWeight:600 }}>{idx.name}</div>
          <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between',
            marginTop:8 }}>
            <span className="mono" style={{ fontSize:22, fontWeight:700,
              letterSpacing:'-.01em' }}>{idx.v}</span>
            <span className="mono" style={{ fontSize:13, fontWeight:600,
              color: idx.up ? 'var(--up)' : 'var(--down)' }}>{idx.d}</span>
          </div>
          <div style={{ marginTop:8, height:36 }}>
            <svg viewBox="0 0 100 44" width="100%" height="100%" preserveAspectRatio="none">
              <defs>
                <linearGradient id={`lidx-${slug}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={idx.up?'#16a34a':'#ef4444'} stopOpacity=".22"/>
                  <stop offset="100%" stopColor={idx.up?'#16a34a':'#ef4444'} stopOpacity="0"/>
                </linearGradient>
              </defs>
              <path d={sparkPathFor(idx.name, idx.up)} fill="none"
                stroke={idx.up?'#16a34a':'#ef4444'} strokeWidth="1.2"
                vectorEffect="non-scaling-stroke"/>
              <path d={sparkPathFor(idx.name, idx.up) + ' L 100 44 L 0 44 Z'}
                fill={`url(#lidx-${slug})`}/>
            </svg>
          </div>
        </div>
        );
      })}
    </div>
  </section>
);

const LightClassTabs = ({ active, onChange }) => (
  <section style={{ padding:'24px 32px 0', display:'flex', alignItems:'center',
    justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
      {ASSET_CLASSES.map(c => {
        const isActive = c.key === active;
        return (
          <button key={c.key} onClick={() => onChange(c.key)} style={{
            display:'inline-flex', alignItems:'center', gap:8,
            padding:'10px 18px', borderRadius:10,
            border: isActive ? '1px solid var(--accent)' : '1px solid var(--line)',
            background: isActive ? 'var(--accent)' : 'var(--bg-1)',
            color: isActive ? '#fff' : 'var(--ink-0)',
            fontSize:14, fontWeight:600, cursor:'pointer',
            fontFamily:'inherit', whiteSpace:'nowrap',
          }}>
            {c.label}
            <span style={{ fontSize:11, color: isActive ? 'rgba(255,255,255,.8)' : 'var(--ink-2)',
              letterSpacing:'.04em', fontWeight:500 }}>{c.meta}</span>
          </button>
        );
      })}
    </div>
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <span style={{ fontSize:12, color:'var(--ink-2)' }}>정렬</span>
      <select style={{
        padding:'8px 28px 8px 12px', borderRadius:8,
        border:'1px solid var(--line)', background:'var(--bg-1)',
        color:'var(--ink-0)', fontSize:13, fontWeight:500,
        fontFamily:'inherit', cursor:'pointer',
        appearance:'none',
        backgroundImage:'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'10\' viewBox=\'0 0 10 10\'><path d=\'M2 4l3 3 3-3\' stroke=\'%2300\' stroke-width=\'1.4\' fill=\'none\'/></svg>")',
        backgroundRepeat:'no-repeat',
        backgroundPosition:'right 10px center',
      }}>
        <option>거래량순</option>
        <option>시가총액순</option>
        <option>등락률순 (상승)</option>
        <option>등락률순 (하락)</option>
      </select>
    </div>
  </section>
);

/* ============================================================ */
/* Stock list (light)                                            */
/* ============================================================ */
const LightStockList = ({ items, activeSym, onPick }) => {
  const [filter, setFilter] = React.useState('all');
  const [query, setQuery] = React.useState('');
  const filtered = items.filter(s =>
    !query || s.name.includes(query) || s.sym.includes(query)
  );
  return (
    <aside style={{ ...lCard, padding:0, display:'flex', flexDirection:'column',
      minHeight:760 }}>
      <div style={{ padding:'20px 22px 16px', borderBottom:'1px solid var(--line)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
          marginBottom:14 }}>
          <h3 style={{ margin:0, fontSize:16, fontWeight:700 }}>종목 목록</h3>
          <span className="mono" style={{ fontSize:11, color:'var(--ink-2)' }}>
            {items.length}개
          </span>
        </div>

        <div style={{ display:'flex', gap:6, padding:3, borderRadius:8,
          background:'var(--bg-2)', border:'1px solid var(--line)', width:'fit-content' }}>
          {[['all','전체'], ['fav','★ 관심'], ['gain','급등'], ['loss','급락']].map(([k,l]) => (
            <button key={k} onClick={() => setFilter(k)} style={{
              padding:'6px 12px', borderRadius:6, fontSize:12.5, fontWeight:600,
              border:0, cursor:'pointer', fontFamily:'inherit',
              background: filter === k ? 'var(--bg-1)' : 'transparent',
              color: filter === k ? 'var(--ink-0)' : 'var(--ink-1)',
              boxShadow: filter === k ? '0 1px 3px rgba(14,25,54,.08)' : 'none',
            }}>{l}</button>
          ))}
        </div>

        <div style={{ marginTop:14, position:'relative' }}>
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
              border:'1px solid var(--line)', background:'var(--bg-2)',
              color:'var(--ink-0)', fontSize:13, outline:'none', fontFamily:'inherit',
            }}
          />
        </div>
      </div>

      <ul style={{ margin:0, padding:0, listStyle:'none', flex:1, overflowY:'auto',
        maxHeight:640 }} className="no-scrollbar">
        {filtered.map((s, i) => {
          const isActive = s.sym === activeSym;
          const up = s.dPct >= 0;
          return (
            <li key={s.sym}>
              <button onClick={() => onPick(s.sym)} style={{
                width:'100%', textAlign:'left', cursor:'pointer',
                display:'grid', gridTemplateColumns:'1fr 70px auto',
                alignItems:'center', gap:12,
                padding:'14px 22px',
                background: isActive ? 'var(--accent-bg)' : 'transparent',
                borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                border:'none', fontFamily:'inherit', color:'var(--ink-0)',
                borderBottom: i === filtered.length-1 ? 'none' : '1px solid var(--line)',
              }}>
                <div style={{ display:'flex', flexDirection:'column', gap:2, minWidth:0 }}>
                  <span style={{ fontSize:14, fontWeight: isActive ? 700 : 600,
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {s.name}
                  </span>
                  <span className="mono" style={{ fontSize:11, color:'var(--ink-2)' }}>
                    {s.sym} · Vol {s.vol}
                  </span>
                </div>
                <div style={{ height:24 }}>
                  <svg viewBox="0 0 100 44" width="100%" height="100%" preserveAspectRatio="none">
                    <path d={sparkPathFor(s.sym, up)} fill="none"
                      stroke={up ? 'var(--up)' : 'var(--down)'} strokeWidth="1.2"
                      vectorEffect="non-scaling-stroke"/>
                  </svg>
                </div>
                <div style={{ textAlign:'right', display:'flex', flexDirection:'column', gap:2 }}>
                  <span className="mono" style={{ fontSize:13.5, fontWeight:700 }}>
                    {fmtKRW(s.price)}
                  </span>
                  <span className="mono" style={{ fontSize:12, fontWeight:600,
                    color: up ? 'var(--up)' : 'var(--down)' }}>
                    {up ? '+' : ''}{s.dPct.toFixed(2)}%
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <div style={{ padding:'12px 22px', borderTop:'1px solid var(--line)',
        background:'var(--bg-2)' }}>
        <span style={{ fontSize:11, color:'var(--ink-2)' }}>
          * 주식 시세는 KIS 모의투자 API 기준 약 15~20초 시차
        </span>
      </div>
    </aside>
  );
};

/* ============================================================ */
/* Candlestick (light, Western colors)                            */
/* ============================================================ */
const LightCandle = ({ data, height = 320 }) => {
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
  for (let i = 0; i < 7; i++) {
    const idx = Math.round((i / 6) * (data.length - 1));
    xLabels.push({ x: padL + idx * candleW + candleW/2, label: `${idx+1}일` });
  }
  const last = data[data.length-1];
  const lastY = yP(last.c);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ display:'block' }}>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={yP(t)} y2={yP(t)}
            stroke="rgba(14,25,54,.06)" strokeWidth="1"/>
          <text x={W - padR + 6} y={yP(t) + 4}
            fill="var(--ink-2)" fontSize="10" fontFamily="JetBrains Mono, monospace">
            {Math.round(t).toLocaleString()}
          </text>
        </g>
      ))}

      {data.map((d, i) => {
        const up = d.c >= d.o;
        const x = padL + i * candleW + candleW/2;
        const color = up ? '#16a34a' : '#ef4444';
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
        stroke="var(--accent)" strokeWidth=".7" strokeDasharray="3 3" opacity=".6"/>
      <rect x={W - padR + 2} y={lastY - 8} width={48} height={16} rx={3} fill="var(--accent)"/>
      <text x={W - padR + 26} y={lastY + 4} fill="#fff"
        fontSize="10" fontWeight="700" textAnchor="middle"
        fontFamily="JetBrains Mono, monospace">
        {Math.round(last.c).toLocaleString()}
      </text>

      {xLabels.map((l, i) => (
        <text key={i} x={l.x} y={H - padB + 12}
          fill="var(--ink-2)" fontSize="10" textAnchor="middle"
          fontFamily="JetBrains Mono, monospace">{l.label}</text>
      ))}

      <line x1={padL} x2={W - padR} y1={volTop - 4} y2={volTop - 4}
        stroke="rgba(14,25,54,.08)" strokeWidth="1"/>
      <text x={W - padR + 6} y={yV(maxV) + 4}
        fill="var(--ink-2)" fontSize="9"
        fontFamily="JetBrains Mono, monospace">
        {maxV.toFixed(1)}M
      </text>
    </svg>
  );
};

Object.assign(window, {
  STOCKS, INDICES, ASSET_CLASSES, fmtKRW, sparkPathFor, genCandles,
  lCard, lIconChip, lPillBtn, lDdSx,
  LightDashNav, LightLogo, LightPageHeader, LightIndexStrip, LightClassTabs,
  LightStockList, LightCandle,
});
