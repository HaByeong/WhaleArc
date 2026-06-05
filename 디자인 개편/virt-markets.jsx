/* VIRT markets — light mode + Korean color convention (red↑ / blue↓) */

/* ============================================================ */
/* Dataset                                                        */
/* ============================================================ */
const VIRT_STOCKS = [
  { sym:'005930', name:'삼성전자',   price:292500,  dPct:-4.72, dAbs:-14500, vol:'21.7M', market:'KOSPI', prevClose:307000 },
  { sym:'000660', name:'SK하이닉스', price:2196000, dPct:-2.10, dAbs:-47000, vol:'4.3M',  market:'KOSPI' },
  { sym:'066570', name:'LG전자',     price:218000,  dPct:-7.23, dAbs:-17000, vol:'2.5M',  market:'KOSPI' },
  { sym:'035720', name:'카카오',     price:38950,   dPct:-3.83, dAbs:-1550,  vol:'2.1M',  market:'KOSPI' },
  { sym:'005380', name:'현대차',     price:660000,  dPct:-3.08, dAbs:-21000, vol:'1.8M',  market:'KOSPI' },
  { sym:'009150', name:'삼성전기',   price:1723000, dPct:+5.71, dAbs:+93000, vol:'1.8M',  market:'KOSPI' },
  { sym:'035420', name:'NAVER',      price:197900,  dPct:-1.45, dAbs:-2900,  vol:'1.2M',  market:'KOSPI' },
  { sym:'373220', name:'LG에너지솔루션', price:412000, dPct:+1.23, dAbs:+5000, vol:'1.0M', market:'KOSPI' },
  { sym:'207940', name:'삼성바이오로직스', price:842000, dPct:-0.71, dAbs:-6000, vol:'820K', market:'KOSPI' },
  { sym:'051910', name:'LG화학',     price:395000,  dPct:+0.51, dAbs:+2000,  vol:'712K',  market:'KOSPI' },
];

const VIRT_CLASSES = [
  { key:'stock',  label:'주식' },
  { key:'us',     label:'미국주식' },
  { key:'etf',    label:'ETF' },
  { key:'crypto', label:'가상화폐 (빗썸)' },
];

const fmtV = (n) => '₩' + n.toLocaleString('ko-KR');

/* ============================================================ */
/* Page header + class tabs                                       */
/* ============================================================ */
const MarketsHeader = () => (
  <section style={{ padding:'28px 32px 0' }}>
    <h1 style={{ margin:0, fontSize:32, lineHeight:1.15, fontWeight:700,
      letterSpacing:'-.02em' }}>시장 현황</h1>
    <p style={{ margin:'8px 0 0', fontSize:13, color:'var(--ink-1)' }}>
      주식/미국주식/ETF/가상화폐 시세를 한 곳에서 확인하세요
    </p>
  </section>
);

const ClassTabs = ({ active, onChange }) => (
  <section style={{ padding:'22px 32px 0', display:'flex', gap:8, flexWrap:'wrap' }}>
    {VIRT_CLASSES.map(c => {
      const isOn = c.key === active;
      return (
        <button key={c.key} onClick={() => onChange(c.key)} style={{
          padding:'9px 18px', borderRadius:10, fontSize:13, fontWeight:600,
          border: isOn ? '1px solid var(--accent)' : '1px solid var(--line)',
          background: isOn ? 'var(--accent)' : 'var(--bg-1)',
          color: isOn ? '#fff' : 'var(--ink-0)',
          cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap',
          boxShadow: isOn ? '0 6px 14px -8px rgba(60,120,255,.4)' : '0 1px 0 rgba(14,25,54,.02)',
        }}>{c.label}</button>
      );
    })}
  </section>
);

/* ============================================================ */
/* Stock List (light)                                             */
/* ============================================================ */
const VirtStockList = ({ items, activeSym, onPick }) => {
  const [filter, setFilter] = React.useState('all');
  const [query, setQuery] = React.useState('');
  const [sort, setSort] = React.useState('vol');

  const filtered = items.filter(s =>
    !query || s.name.includes(query) || s.sym.includes(query)
  );

  return (
    <aside style={{ ...virtCard, padding:0, display:'flex', flexDirection:'column',
      minHeight:740 }}>
      <div style={{ padding:'20px 22px 16px', borderBottom:'1px solid var(--line)' }}>
        <h3 style={{ ...sectionTitle, marginBottom:14 }}>종목 목록</h3>

        {/* tabs */}
        <div style={{ display:'flex', gap:6 }}>
          {[['all','전체'], ['fav','★ 관심']].map(([k,l]) => (
            <button key={k} onClick={() => setFilter(k)} style={{
              padding:'7px 14px', borderRadius:8, fontSize:12.5, fontWeight:600,
              border: filter === k ? '1px solid var(--accent)' : '1px solid var(--line)',
              background: filter === k ? 'var(--accent)' : 'var(--bg-1)',
              color: filter === k ? '#fff' : 'var(--ink-1)',
              cursor:'pointer', fontFamily:'inherit',
            }}>{l}</button>
          ))}
        </div>

        {/* search */}
        <div style={{ marginTop:12, position:'relative' }}>
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

        {/* sort */}
        <select value={sort} onChange={e => setSort(e.target.value)} style={{
          marginTop:10, width:'100%',
          padding:'10px 28px 10px 12px', borderRadius:8,
          border:'1px solid var(--line)', background:'var(--bg-2)',
          color:'var(--ink-0)', fontSize:13, fontWeight:500,
          fontFamily:'inherit', cursor:'pointer',
          appearance:'none',
          backgroundImage:'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'10\' viewBox=\'0 0 10 10\'><path d=\'M2 4l3 3 3-3\' stroke=\'%2300\' stroke-width=\'1.4\' fill=\'none\'/></svg>")',
          backgroundRepeat:'no-repeat',
          backgroundPosition:'right 10px center',
        }}>
          <option value="vol">거래량순</option>
          <option value="mcap">시가총액순</option>
          <option value="up">등락률순 (상승)</option>
          <option value="down">등락률순 (하락)</option>
        </select>
      </div>

      <ul style={{ margin:0, padding:'6px 0', listStyle:'none', flex:1,
        overflowY:'auto', maxHeight:600 }} className="no-scrollbar">
        {filtered.map(s => {
          const isActive = s.sym === activeSym;
          const up = s.dPct >= 0;
          return (
            <li key={s.sym} style={{ padding:'4px 10px' }}>
              <button onClick={() => onPick(s.sym)} style={{
                width:'100%', textAlign:'left', cursor:'pointer',
                padding:'12px 14px', borderRadius:10,
                background: isActive ? 'var(--accent-bg)' : 'transparent',
                border: isActive ? '1px solid rgba(91,157,255,.32)' : '1px solid transparent',
                fontFamily:'inherit', color:'var(--ink-0)',
                display:'grid', gridTemplateColumns:'1fr auto', alignItems:'center',
                gap:10,
              }}>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight: isActive ? 700 : 600,
                    color: isActive ? 'var(--accent)' : 'var(--ink-0)',
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {s.name}
                  </div>
                  <div className="mono" style={{ fontSize:11, color:'var(--ink-2)',
                    marginTop:2 }}>{s.sym}</div>
                </div>
                <div style={{ textAlign:'right', whiteSpace:'nowrap' }}>
                  <div className="mono" style={{ fontSize:13.5, fontWeight:700,
                    color:'var(--ink-0)' }}>{fmtV(s.price)}</div>
                  <div className="mono" style={{ marginTop:2, fontSize:12, fontWeight:600,
                    color: up ? 'var(--up)' : 'var(--down)' }}>
                    {up ? '+' : ''}{s.dPct.toFixed(2)}%
                  </div>
                  <div className="mono" style={{ marginTop:2, fontSize:10.5,
                    color:'var(--ink-3)' }}>Vol {s.vol}</div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <div style={{ padding:'10px 22px', borderTop:'1px solid var(--line)',
        background:'var(--bg-2)' }}>
        <span style={{ fontSize:10.5, color:'var(--ink-2)' }}>
          * 주식 시세는 KIS 모의투자 API 기준 약 15~20초 시차
        </span>
      </div>
    </aside>
  );
};

/* ============================================================ */
/* Candle generator                                               */
/* ============================================================ */
function virtGenCandles(seed, days, start, end) {
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

/* ============================================================ */
/* Light-mode Candlestick (Korean colors: red↑, blue↓)            */
/* ============================================================ */
const VirtCandlestick = ({ data, height = 320 }) => {
  const W = 880, H = height;
  const padL = 8, padR = 56, padT = 16, padB = 64;
  const innerW = W - padL - padR;
  const priceH = H - padT - padB;
  const volH = 40;
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
    const day = (idx * 4 % 30) + 1;
    xLabels.push({ x: padL + idx * candleW + candleW/2, label: `${day}일` });
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
        // Korean convention: up = red, down = blue
        const color = up ? '#ef4d4d' : '#2c6fe6';
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
        stroke="var(--ink-0)" strokeWidth=".7" strokeDasharray="3 3" opacity=".5"/>
      <rect x={W - padR + 2} y={lastY - 8} width={50} height={16} rx={3} fill="var(--ink-0)"/>
      <text x={W - padR + 27} y={lastY + 4} fill="#fff"
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

/* ============================================================ */
/* Stock detail                                                   */
/* ============================================================ */
const VirtStockDetail = ({ stock }) => {
  const [period, setPeriod] = React.useState('3M');
  const periods = ['일봉','1개월','3개월','6개월','1년','2년'];
  const periodKeys = ['1D','1M','3M','6M','1Y','2Y'];

  const seed = React.useMemo(() => {
    let h = 7;
    for (const c of stock.sym) h = (h*31 + c.charCodeAt(0)) & 0x7fffffff;
    return h;
  }, [stock.sym]);
  const data = React.useMemo(() => virtGenCandles(seed, 64,
    stock.price * 0.55, stock.price * 1.02), [seed, stock.price]);

  const up = stock.dPct >= 0;
  const prev = stock.prevClose || (stock.price - stock.dAbs);

  return (
    <section style={{ display:'flex', flexDirection:'column', gap:18 }}>
      {/* chart card */}
      <div style={{ ...virtCard, padding:'24px 28px' }}>
        {/* header */}
        <div style={{ display:'flex', justifyContent:'space-between',
          alignItems:'flex-start', gap:20, flexWrap:'wrap', marginBottom:14 }}>
          <div>
            <h2 style={{ margin:0, fontSize:24, fontWeight:700, letterSpacing:'-.01em' }}>
              {stock.name}
            </h2>
            <div className="mono" style={{ marginTop:4, fontSize:12, color:'var(--ink-2)' }}>
              {stock.sym}
            </div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div className="mono" style={{ fontSize:26, fontWeight:700,
              letterSpacing:'-.01em' }}>{fmtV(stock.price)}</div>
            <div className="mono" style={{ marginTop:4, fontSize:13.5, fontWeight:600,
              color: up ? 'var(--up)' : 'var(--down)' }}>
              {up ? '+' : ''}{stock.dAbs.toLocaleString()} ({up?'+':''}{stock.dPct.toFixed(2)}%)
            </div>
          </div>
        </div>

        {/* indicator + period row */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
          marginBottom:14, gap:14, flexWrap:'wrap' }}>
          <div style={{ display:'flex', gap:4 }}>
            {periods.map((p, i) => {
              const k = periodKeys[i];
              const isOn = period === k;
              return (
                <button key={k} onClick={() => setPeriod(k)} style={{
                  padding:'7px 14px', borderRadius:999, fontSize:12, fontWeight:600,
                  border:0, cursor:'pointer', fontFamily:'inherit',
                  background: isOn ? 'var(--ink-0)' : 'transparent',
                  color: isOn ? '#fff' : 'var(--ink-1)',
                }}>{p}</button>
              );
            })}
          </div>
          <button style={{
            padding:'7px 14px', borderRadius:8,
            border:'1px solid var(--line)', background:'var(--bg-1)',
            color:'var(--ink-1)', fontSize:12.5, fontWeight:600,
            cursor:'pointer', fontFamily:'inherit',
            display:'inline-flex', alignItems:'center', gap:6,
          }}>
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path d="M2 11 L 5 7 L 8 10 L 12 3" stroke="currentColor" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
            지표
          </button>
        </div>

        <div style={{ height:340 }}>
          <VirtCandlestick data={data} height={340}/>
        </div>
      </div>

      {/* 4 stats */}
      <div style={{ display:'grid',
        gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:14 }}>
        <VStat label="전일 종가" value={fmtV(prev)} />
        <VStat label="등락률"
          value={`${up?'+':''}${stock.dPct.toFixed(2)}%`}
          color={up ? 'var(--up)' : 'var(--down)'} />
        <VStat label="등락액"
          value={`${up?'+':''}${stock.dAbs.toLocaleString()}`}
          prefix="₩" color={up ? 'var(--up)' : 'var(--down)'} />
        <VStat label="거래량" value={stock.vol} />
      </div>
    </section>
  );
};

const VStat = ({ label, value, color, prefix }) => (
  <div style={{ ...virtCard, padding:'22px 24px' }}>
    <div style={{ fontSize:12, color:'var(--ink-2)', letterSpacing:'.04em' }}>{label}</div>
    <div className="mono" style={{ marginTop:10, fontSize:'clamp(16px, 2vw, 22px)',
      fontWeight:700, letterSpacing:'-.01em',
      color: color || 'var(--ink-0)', whiteSpace:'nowrap' }}>
      {prefix && value && !value.startsWith('-') && !value.startsWith('+') ? prefix : ''}
      {value}
    </div>
  </div>
);

/* ============================================================ */
/* APP                                                            */
/* ============================================================ */
function VirtMarketsApp() {
  const [klass, setKlass] = React.useState('stock');
  const [activeSym, setActiveSym] = React.useState(VIRT_STOCKS[0].sym);
  const stock = VIRT_STOCKS.find(s => s.sym === activeSym) || VIRT_STOCKS[0];

  return (
    <>
      <VirtNav active="시세" />
      <MarketsHeader />
      <ClassTabs active={klass} onChange={setKlass} />

      <main style={{ padding:'22px 32px 80px',
        display:'grid',
        gridTemplateColumns:'minmax(0, 280px) minmax(0, 1fr)',
        gap:24, alignItems:'start' }}>
        <VirtStockList items={VIRT_STOCKS} activeSym={activeSym} onPick={setActiveSym} />
        <VirtStockDetail stock={stock} />
      </main>

      <footer style={{ padding:'40px 32px 28px',
        borderTop:'1px solid var(--line)',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        flexWrap:'wrap', gap:14 }}>
        <span className="mono" style={{ fontSize:12, color:'var(--ink-2)' }}>
          © 2026 WhaleArc-VIRT · 이 환경의 모든 거래는 가상이며 실제 자금이 움직이지 않습니다.
        </span>
        <div style={{ display:'flex', gap:18, fontSize:12.5, color:'var(--ink-1)' }}>
          <a>도움말</a><a>상태</a><a>API</a><a>의견 보내기</a>
        </div>
      </footer>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<VirtMarketsApp />);
