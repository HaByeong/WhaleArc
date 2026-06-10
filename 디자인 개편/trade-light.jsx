/* trade-light.jsx — light port of 거래 page */

const fmtW = (n) => '₩' + n.toLocaleString('ko-KR');

const TRADE_STOCKS = [
  { sym:'005930', name:'삼성전자',   price:303500, dPct:-1.14, dAbs:-3500,  vol:'10.2M', mcap:'1,802조',  market:'KOSPI', prevClose:307000 },
  { sym:'000660', name:'SK하이닉스', price:2277000, dPct:+1.52, dAbs:+34000, vol:'2.4M',  mcap:'164조',    market:'KOSPI' },
  { sym:'066570', name:'LG전자',     price:226000, dPct:-3.83, dAbs:-9000,  vol:'1.4M',  mcap:'36조',     market:'KOSPI' },
  { sym:'035420', name:'NAVER',      price:203000, dPct:+2.11, dAbs:+4200,  vol:'1.0M',  mcap:'32조',     market:'KOSPI' },
  { sym:'005380', name:'현대차',     price:696000, dPct:+2.20, dAbs:+15000, vol:'965K',  mcap:'145조',    market:'KOSPI' },
  { sym:'035720', name:'카카오',     price:40000,  dPct:-1.23, dAbs:-500,   vol:'950K',  mcap:'17조',     market:'KOSPI' },
  { sym:'006400', name:'삼성SDI',    price:684000, dPct:+8.57, dAbs:+54000, vol:'820K',  mcap:'46조',     market:'KOSPI' },
];

function genC(seed, days, start, end) {
  const out = []; let h = seed; let p = start;
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
    out.push({ o: open, c: close, h: high, l: low, v: 4 + ((h % 800) / 100) });
    p = close;
  }
  return out;
}

const TradeHeader = () => (
  <section style={{ padding:'28px 32px 0' }}>
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12,
      flexWrap:'wrap' }}>
      <span style={{ width:6, height:6, borderRadius:'50%',
        background:'var(--up)', boxShadow:'0 0 8px rgba(22,163,74,.5)',
        animation:'pulse-dot 2s ease-in-out infinite' }}/>
      <span style={{ ...lt_kicker }}>TRADING SESSION · 정규장 진행 중</span>
      <span className="mono" style={{ fontSize:11, color:'var(--ink-3)' }}>
        · 마감까지 30분 28초
      </span>
    </div>
    <h1 style={{ margin:0, fontSize:32, lineHeight:1.15, fontWeight:700,
      letterSpacing:'-.02em' }}>거래</h1>
    <p style={{ margin:'8px 0 0', fontSize:14, color:'var(--ink-1)' }}>
      종목을 선택하고 매수·매도를 실행하세요. 실계좌 미연결 상태에서는 VIRT로 안전하게.
    </p>
  </section>
);

const sparkLight = (sym, up) => {
  let h = 0;
  for (let i = 0; i < sym.length; i++) h = (h * 31 + sym.charCodeAt(i)) & 0xffffffff;
  const N = 24; const pts = []; let y = 22;
  for (let i = 0; i <= N; i++) {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    const n = ((h % 100) - 50) / 50;
    y += n * 2 + (up ? -0.45 : 0.35);
    y = Math.max(4, Math.min(40, y));
    pts.push([(i/N)*100, y]);
  }
  return 'M ' + pts.map(p => p.map(n => n.toFixed(1)).join(' ')).join(' L ');
};

const StockListL = ({ items, activeSym, onPick }) => (
  <aside style={{ ...lt_card, padding:0, display:'flex', flexDirection:'column',
    minHeight:820 }}>
    <div style={{ padding:'12px 12px 0' }}>
      <div style={{ display:'flex', gap:4 }}>
        {[['stock','주식'],['us','미국주식'],['etf','ETF'],['crypto','가상화폐']].map(([k,l],i) => (
          <button key={k} style={{
            flex:1, padding:'8px 6px', borderRadius:8, fontSize:12.5, fontWeight:600,
            border: i===0 ? '1px solid rgba(91,157,255,.32)' : '1px solid var(--line)',
            background: i===0 ? 'var(--accent-bg)' : 'var(--bg-1)',
            color: i===0 ? 'var(--accent)' : 'var(--ink-1)',
            cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap',
          }}>{l}</button>
        ))}
      </div>
    </div>
    <div style={{ padding:'14px 14px 12px', borderBottom:'1px solid var(--line)' }}>
      <div style={{ position:'relative' }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{
          position:'absolute', left:12, top:'50%', transform:'translateY(-50%)',
          color:'var(--ink-3)' }}>
          <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.4"/>
          <path d="M9 9l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
        <input placeholder="전체 KOSPI/KOSDAQ 종목 검색…" style={{
          width:'100%', padding:'10px 12px 10px 34px', borderRadius:8,
          border:'1px solid var(--line)', background:'var(--bg-2)',
          color:'var(--ink-0)', fontSize:13, outline:'none', fontFamily:'inherit',
        }}/>
      </div>
      <div style={{ marginTop:12, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span style={{ fontSize:11.5, color:'var(--ink-2)', letterSpacing:'.06em' }}>
          주식 <span className="mono" style={{ color:'var(--ink-0)', fontWeight:600 }}>{items.length}개</span>
        </span>
        <button style={{ fontSize:11.5, color:'var(--ink-1)', background:'transparent',
          border:0, cursor:'pointer', fontFamily:'inherit' }}>편집</button>
      </div>
    </div>
    <ul style={{ margin:0, padding:0, listStyle:'none', flex:1, overflowY:'auto',
      maxHeight:720 }} className="no-scrollbar">
      {items.map((s,i) => {
        const isActive = s.sym === activeSym;
        const up = s.dPct >= 0;
        return (
          <li key={s.sym}>
            <button onClick={() => onPick(s.sym)} style={{
              width:'100%', textAlign:'left', cursor:'pointer',
              display:'grid', gridTemplateColumns:'1fr auto', alignItems:'center', gap:10,
              padding:'12px 14px',
              background: isActive ? 'var(--accent-bg)' : 'transparent',
              borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
              border:'none', fontFamily:'inherit', color:'var(--ink-0)',
              borderBottom: i === items.length-1 ? 'none' : '1px solid var(--line)',
            }}>
              <div style={{ display:'flex', flexDirection:'column', gap:2, minWidth:0 }}>
                <span style={{ fontSize:13.5, fontWeight: isActive ? 700 : 600,
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {s.name}
                </span>
                <span className="mono" style={{ fontSize:11, color:'var(--ink-2)' }}>{s.sym}</span>
              </div>
              <div style={{ textAlign:'right', display:'flex', flexDirection:'column', gap:2 }}>
                <span className="mono" style={{ fontSize:13, fontWeight:700 }}>{fmtW(s.price)}</span>
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
    <div style={{ padding:'10px 18px', borderTop:'1px solid var(--line)', background:'var(--bg-2)' }}>
      <span style={{ fontSize:10.5, color:'var(--ink-2)' }}>
        * 주식 시세는 KIS 모의투자 API 기준 약 15~20초 시차
      </span>
    </div>
  </aside>
);

/* Candle (light, Western) */
const CandleL = ({ data, height = 320 }) => {
  const W = 880, H = height;
  const padL = 8, padR = 56, padT = 16, padB = 92;
  const innerW = W - padL - padR;
  const priceH = H - padT - padB;
  const volH = 60;
  const volTop = H - padB + 16;
  const maxP = Math.max(...data.map(d => d.h));
  const minP = Math.min(...data.map(d => d.l));
  const rangeP = maxP - minP;
  const yP = p => padT + ((maxP - p) / rangeP) * priceH;
  const maxV = Math.max(...data.map(d => d.v));
  const yV = v => volTop + (1 - v / maxV) * volH;
  const candleW = innerW / data.length;
  const bodyW = Math.max(2, candleW * 0.65);
  const ticks = [0,.25,.5,.75,1].map(t => minP + (1-t)*rangeP);
  const last = data[data.length-1];
  const lastY = yP(last.c);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ display:'block' }}>
      {ticks.map((t,i) => (
        <g key={i}>
          <line x1={padL} x2={W-padR} y1={yP(t)} y2={yP(t)} stroke="rgba(14,25,54,.06)" strokeWidth="1"/>
          <text x={W-padR+6} y={yP(t)+4} fill="var(--ink-2)" fontSize="10"
            fontFamily="JetBrains Mono, monospace">{Math.round(t).toLocaleString()}</text>
        </g>
      ))}
      {data.map((d,i) => {
        const up = d.c >= d.o;
        const x = padL + i * candleW + candleW/2;
        const c = up ? '#16a34a' : '#ef4444';
        const yo = yP(d.o), yc = yP(d.c);
        const bt = Math.min(yo, yc), bh = Math.max(1, Math.abs(yc - yo));
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={yP(d.h)} y2={yP(d.l)} stroke={c} strokeWidth="1"/>
            <rect x={x-bodyW/2} y={bt} width={bodyW} height={bh} fill={c}/>
            <rect x={x-bodyW/2} y={yV(d.v)} width={bodyW} height={(volTop+volH)-yV(d.v)} fill={c} opacity=".35"/>
          </g>
        );
      })}
      <line x1={padL} x2={W-padR} y1={lastY} y2={lastY} stroke="var(--accent)"
        strokeWidth=".7" strokeDasharray="3 3" opacity=".6"/>
      <rect x={W-padR+2} y={lastY-8} width={48} height={16} rx={3} fill="var(--accent)"/>
      <text x={W-padR+26} y={lastY+4} fill="#fff" fontSize="10" fontWeight="700"
        textAnchor="middle" fontFamily="JetBrains Mono, monospace">
        {Math.round(last.c).toLocaleString()}
      </text>
      <line x1={padL} x2={W-padR} y1={volTop-4} y2={volTop-4} stroke="rgba(14,25,54,.08)" strokeWidth="1"/>
    </svg>
  );
};

/* Stock header card */
const StockHeaderL = ({ stock }) => {
  const up = stock.dPct >= 0;
  const prev = stock.prevClose || (stock.price - stock.dAbs);
  return (
    <div style={{ ...lt_card, padding:'22px 26px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start',
        gap:24, flexWrap:'wrap' }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
            <span style={{ fontSize:10.5, padding:'3px 8px', borderRadius:5,
              background:'var(--accent-bg)', color:'var(--accent)',
              fontWeight:700, letterSpacing:'.08em',
              border:'1px solid rgba(91,157,255,.28)' }}>{stock.market} · KRX</span>
            <span className="mono" style={{ fontSize:12, color:'var(--ink-2)' }}>{stock.sym}</span>
          </div>
          <h2 style={{ margin:0, fontSize:26, fontWeight:700, letterSpacing:'-.01em' }}>
            {stock.name}
          </h2>
        </div>
        <div style={{ textAlign:'right' }}>
          <span className="mono" style={{ fontSize:32, fontWeight:700,
            letterSpacing:'-.02em' }}>{fmtW(stock.price)}</span>
          <div className="mono" style={{ marginTop:4, fontSize:14, fontWeight:600,
            color: up ? 'var(--up)' : 'var(--down)' }}>
            {up?'+':''}{stock.dAbs.toLocaleString()} ({up?'+':''}{stock.dPct.toFixed(2)}%)
          </div>
        </div>
      </div>
      <div style={{ marginTop:18, paddingTop:18, borderTop:'1px solid var(--line)',
        display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(120px, 1fr))', gap:18 }}>
        {[
          ['거래량', stock.vol],
          ['전일 종가', fmtW(prev)],
          ['시가총액', stock.mcap || '—'],
          ['변동성', `${(Math.abs(stock.dPct) * 1.4).toFixed(1)}%`],
        ].map(([l,v]) => (
          <div key={l} style={{ display:'flex', flexDirection:'column', gap:4, minWidth:0 }}>
            <span style={{ fontSize:10.5, color:'var(--ink-2)', letterSpacing:'.12em', fontWeight:600 }}>{l}</span>
            <span className="mono" style={{ fontSize:15, fontWeight:700,
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* Tab bar */
const TabBar = ({ active, onChange, tabs }) => (
  <div style={{ display:'flex', alignItems:'center', gap:0,
    borderBottom:'1px solid var(--line)', padding:'0 6px' }}>
    {tabs.map(({ key, label, badge }) => {
      const isOn = active === key;
      return (
        <button key={key} onClick={() => onChange(key)} style={{
          position:'relative', padding:'14px 18px', border:0, background:'transparent',
          color: isOn ? 'var(--ink-0)' : 'var(--ink-2)',
          fontSize:14, fontWeight: isOn ? 700 : 500, cursor:'pointer',
          fontFamily:'inherit', display:'inline-flex', alignItems:'center', gap:8 }}>
          {label}
          {badge != null && (
            <span style={{ fontSize:11, padding:'2px 7px', borderRadius:999,
              background: isOn ? 'var(--accent-bg)' : 'var(--bg-2)',
              color: isOn ? 'var(--accent)' : 'var(--ink-2)', fontWeight:700 }}>{badge}</span>
          )}
          {isOn && <span style={{ position:'absolute', left:12, right:12, bottom:-1, height:2,
            background:'linear-gradient(90deg, var(--accent), var(--accent-glow))',
            borderRadius:1 }}/>}
        </button>
      );
    })}
  </div>
);

/* Chart panel */
const ChartPanelL = ({ stock }) => {
  const [period, setPeriod] = React.useState('3M');
  const periods = ['1D','1W','1M','3M','6M','1Y','3Y'];
  const seed = React.useMemo(() => {
    let h = 7;
    for (const c of stock.sym) h = (h*31 + c.charCodeAt(0)) & 0x7fffffff;
    return h;
  }, [stock.sym]);
  const data = React.useMemo(() => genC(seed, 60, stock.price*0.55, stock.price*1.02), [seed, stock.price]);
  return (
    <div style={{ padding:'18px 20px' }}>
      <div style={{ display:'flex', gap:4, padding:3, borderRadius:8, marginBottom:14,
        background:'var(--bg-2)', border:'1px solid var(--line)', width:'fit-content' }}>
        {periods.map(p => (
          <button key={p} onClick={() => setPeriod(p)} style={{
            padding:'5px 11px', borderRadius:6, fontSize:11.5, fontWeight:600,
            border:0, cursor:'pointer', fontFamily:'inherit', minWidth:32,
            background: period === p ? 'var(--bg-1)' : 'transparent',
            color: period === p ? 'var(--ink-0)' : 'var(--ink-1)',
            boxShadow: period === p ? '0 1px 3px rgba(14,25,54,.08)' : 'none' }}>{p}</button>
        ))}
      </div>
      <div style={{ height:300 }}><CandleL data={data} height={300}/></div>
    </div>
  );
};

/* Order panel */
const FieldLabel = ({ children }) => (
  <span style={{ fontSize:11.5, color:'var(--ink-2)', letterSpacing:'.06em',
    fontWeight:600 }}>{children}</span>
);
const NumField = ({ value, onChange, step = 1, suffix, disabled }) => (
  <div style={{ marginTop:6, display:'grid', gridTemplateColumns:'36px 1fr 36px',
    border:'1px solid var(--line)', borderRadius:8, overflow:'hidden',
    background: disabled ? 'var(--bg-2)' : 'var(--bg-1)' }}>
    <button onClick={() => !disabled && onChange(Math.max(0, value - step))}
      disabled={disabled} style={{ background:'var(--bg-2)', border:0,
      borderRight:'1px solid var(--line)',
      color:'var(--ink-1)', fontSize:16, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>−</button>
    <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
      <input type="number" value={value} onChange={e => onChange(Number(e.target.value) || 0)}
        disabled={disabled} className="mono" style={{
          width:'100%', padding:'10px 36px 10px 12px', border:0, background:'transparent',
          color: disabled ? 'var(--ink-3)' : 'var(--ink-0)',
          fontSize:15, fontWeight:600, outline:'none',
          fontFamily:'JetBrains Mono, monospace', textAlign:'right' }}/>
      {suffix && <span style={{ position:'absolute', right:12, color:'var(--ink-3)',
        fontSize:12, pointerEvents:'none' }}>{suffix}</span>}
    </div>
    <button onClick={() => !disabled && onChange(value + step)}
      disabled={disabled} style={{ background:'var(--bg-2)', border:0,
      borderLeft:'1px solid var(--line)',
      color:'var(--ink-1)', fontSize:16, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>+</button>
  </div>
);
const OrderTicketL = ({ stock, side, setSide }) => {
  const [orderType, setOrderType] = React.useState('limit');
  const [price, setPrice] = React.useState(stock.price);
  const [qty, setQty] = React.useState(10);
  const total = price * qty;
  const available = 7000001;
  React.useEffect(() => { setPrice(stock.price); }, [stock.sym]);
  const isBuy = side === 'buy';
  const tick = stock.price >= 1000000 ? 1000 : stock.price >= 100000 ? 100 : 50;
  return (
    <div style={{ ...lt_card, padding:'20px 22px' }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:0,
        padding:3, borderRadius:10,
        background:'var(--bg-2)', border:'1px solid var(--line)' }}>
        {[['buy','매수','var(--up)'],['sell','매도','var(--down)']].map(([k,l,c]) => (
          <button key={k} onClick={() => setSide(k)} style={{
            padding:'10px', borderRadius:8, border:0, cursor:'pointer',
            fontFamily:'inherit', fontSize:14, fontWeight:700,
            background: side === k ? c : 'transparent',
            color: side === k ? '#fff' : 'var(--ink-1)' }}>{l}</button>
        ))}
      </div>
      <div style={{ marginTop:18 }}>
        <FieldLabel>주문 종류</FieldLabel>
        <div style={{ display:'flex', gap:6, marginTop:6 }}>
          {[['limit','지정가'],['market','시장가'],['cond','조건']].map(([k,l]) => (
            <button key={k} onClick={() => setOrderType(k)} style={{
              flex:1, padding:'9px 0', borderRadius:8, fontSize:12.5, fontWeight:600,
              border: orderType===k ? '1px solid rgba(91,157,255,.40)' : '1px solid var(--line)',
              background: orderType===k ? 'var(--accent-bg)' : 'var(--bg-1)',
              color: orderType===k ? 'var(--accent)' : 'var(--ink-1)',
              cursor:'pointer', fontFamily:'inherit' }}>{l}</button>
          ))}
        </div>
      </div>
      <div style={{ marginTop:18 }}>
        <FieldLabel>주문 가격</FieldLabel>
        <NumField value={price} onChange={setPrice} step={tick}
          disabled={orderType === 'market'} suffix="원" />
      </div>
      <div style={{ marginTop:14 }}>
        <FieldLabel>수량</FieldLabel>
        <NumField value={qty} onChange={setQty} step={1} suffix="주" />
        <div style={{ marginTop:8, display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:6 }}>
          {['10%','25%','50%','최대'].map((p,i) => (
            <button key={p} onClick={() => {
              const pct = i === 3 ? 1 : [0.1,0.25,0.5][i];
              setQty(Math.floor((available * pct) / price));
            }} style={{
              padding:'7px 0', borderRadius:6, fontSize:11.5, fontWeight:600,
              border:'1px solid var(--line)', background:'var(--bg-1)',
              color:'var(--ink-1)', cursor:'pointer', fontFamily:'inherit' }}>{p}</button>
          ))}
        </div>
      </div>
      <div style={{ marginTop:18, padding:'14px 16px', borderRadius:10,
        background:'var(--bg-2)', border:'1px solid var(--line)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:12.5, color:'var(--ink-1)' }}>주문 총액</span>
          <span className="mono" style={{ fontSize:18, fontWeight:700 }}>{fmtW(total)}</span>
        </div>
        <div style={{ marginTop:10, display:'flex', justifyContent:'space-between',
          alignItems:'center', fontSize:12, color:'var(--ink-2)' }}>
          <span>{isBuy ? '주문 가능' : '보유 수량'}</span>
          <span className="mono">{isBuy ? fmtW(available) : '0주'}</span>
        </div>
      </div>
      <div style={{ marginTop:14, display:'flex', alignItems:'center', gap:10,
        padding:'10px 12px', borderRadius:8,
        background:'#fff8e1', border:'1px solid #f0d97a' }}>
        <span style={{ fontSize:14, color:'#946800' }}>⚠</span>
        <span style={{ fontSize:11.5, color:'#5a4500', lineHeight:1.4 }}>
          실계좌가 연결되지 않았습니다. <strong>VIRT 모의 거래</strong>로 진행됩니다.
        </span>
      </div>
      <button style={{
        marginTop:14, width:'100%', padding:'14px 18px', borderRadius:10,
        border:0, cursor:'pointer', fontFamily:'inherit',
        fontSize:15, fontWeight:700,
        background: isBuy
          ? 'linear-gradient(180deg, var(--up), #0d8a3f)'
          : 'linear-gradient(180deg, var(--down), #c73838)',
        color:'#fff',
        boxShadow: isBuy ? '0 10px 24px -12px rgba(22,163,74,.5)' : '0 10px 24px -12px rgba(239,68,68,.5)' }}>
        <span style={{ fontSize:10, padding:'2px 6px', borderRadius:4,
          background:'rgba(255,255,255,.20)', color:'#fff',
          fontWeight:700, letterSpacing:'.06em', marginRight:8 }}>VIRT</span>
        {qty}주 {isBuy ? '매수' : '매도'} 주문
      </button>
    </div>
  );
};

/* Orderbook */
const Orderbook = ({ stock }) => {
  const tick = stock.price >= 1000000 ? 1000 : stock.price >= 100000 ? 100 : 50;
  const seed = stock.sym.split('').reduce((h,c) => (h*31 + c.charCodeAt(0)) & 0x7fffffff, 7);
  const rand = (n) => { let h = seed * (n+1); h = (h*1103515245 + 12345) & 0x7fffffff; return (h%1000)/1000; };
  const asks = []; const bids = []; let maxQty = 1;
  for (let i = 0; i < 5; i++) {
    const aq = Math.floor(800 + rand(i)*4200);
    const bq = Math.floor(800 + rand(i+10)*4200);
    asks.unshift({ price: stock.price + tick*(i+1), qty: aq });
    bids.push({ price: stock.price - tick*(i+1), qty: bq });
    maxQty = Math.max(maxQty, aq, bq);
  }
  const totAsk = asks.reduce((s,a)=>s+a.qty, 0);
  const totBid = bids.reduce((s,b)=>s+b.qty, 0);
  return (
    <div style={{ ...lt_card, padding:'14px 0 0', display:'flex',
      flexDirection:'column', minWidth:0 }}>
      <div style={{ padding:'0 18px 12px', borderBottom:'1px solid var(--line)',
        display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <h3 style={{ margin:0, fontSize:13.5, fontWeight:700 }}>호가</h3>
        <span style={{ fontSize:10.5, color:'var(--ink-2)', letterSpacing:'.08em' }}>5단계 · 실시간</span>
      </div>
      <ul style={{ margin:0, padding:0, listStyle:'none' }}>
        {asks.map((a,i) => <OBRow key={'a'+i} side="ask" price={a.price} qty={a.qty} maxQty={maxQty}/>)}
      </ul>
      <div style={{ padding:'10px 18px',
        background:'var(--accent-bg)',
        borderTop:'1px solid rgba(91,157,255,.24)', borderBottom:'1px solid rgba(91,157,255,.24)',
        display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize:11, color:'var(--accent)', letterSpacing:'.1em', fontWeight:600 }}>현재가</span>
        <span className="mono" style={{ fontSize:15, fontWeight:700 }}>{fmtW(stock.price)}</span>
      </div>
      <ul style={{ margin:0, padding:0, listStyle:'none' }}>
        {bids.map((b,i) => <OBRow key={'b'+i} side="bid" price={b.price} qty={b.qty} maxQty={maxQty}/>)}
      </ul>
      <div style={{ padding:'12px 18px', borderTop:'1px solid var(--line)',
        display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:11 }}>
        <div>
          <div style={{ color:'var(--ink-2)', letterSpacing:'.08em' }}>매도 잔량</div>
          <div className="mono" style={{ color:'var(--down)', fontWeight:600, marginTop:2 }}>{totAsk.toLocaleString()}</div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ color:'var(--ink-2)', letterSpacing:'.08em' }}>매수 잔량</div>
          <div className="mono" style={{ color:'var(--up)', fontWeight:600, marginTop:2 }}>{totBid.toLocaleString()}</div>
        </div>
      </div>
    </div>
  );
};
const OBRow = ({ side, price, qty, maxQty }) => {
  const isAsk = side === 'ask';
  const fillW = (qty / maxQty) * 100;
  return (
    <li style={{ position:'relative', display:'grid',
      gridTemplateColumns:'1fr 1fr', alignItems:'center', padding:'6px 18px', fontSize:12 }}>
      <div aria-hidden style={{
        position:'absolute', top:2, bottom:2,
        [isAsk ? 'right' : 'left']:0, width:`${fillW * 0.55}%`,
        background: isAsk ? 'rgba(239,68,68,.10)' : 'rgba(22,163,74,.10)',
        borderRadius: isAsk ? '0 4px 4px 0' : '4px 0 0 4px' }}/>
      <span className="mono" style={{ position:'relative', color:'var(--ink-2)', textAlign:'left' }}>
        {!isAsk && qty.toLocaleString()}
      </span>
      <span className="mono" style={{ position:'relative', textAlign:'right', fontWeight:600,
        color: isAsk ? 'var(--down)' : 'var(--up)' }}>
        {price.toLocaleString()}
      </span>
      {isAsk && <span className="mono" style={{ position:'absolute', left:18,
        color:'var(--ink-2)', fontSize:12 }}>{qty.toLocaleString()}</span>}
    </li>
  );
};

const OrderPanelL = ({ stock }) => {
  const [side, setSide] = React.useState('buy');
  return (
    <div style={{ display:'grid', gridTemplateColumns:'minmax(0, 1fr) minmax(260px, 320px)',
      gap:18, padding:'18px 20px' }}>
      <OrderTicketL stock={stock} side={side} setSide={setSide} />
      <Orderbook stock={stock} />
    </div>
  );
};

/* Fills + Holdings panels */
const FILLS = [
  { time:'14:23:18', side:'buy',  qty:5,  price:303800, mode:'VIRT' },
  { time:'11:08:42', side:'sell', qty:3,  price:308200, mode:'VIRT' },
  { time:'10:42:11', side:'buy',  qty:10, price:307500, mode:'VIRT' },
];
const tdLight = { padding:'14px 12px', fontSize:13.5, borderBottom:'1px solid var(--line)' };
const FillsPanel = () => (
  <div style={{ padding:'18px 20px' }}>
    <table style={{ width:'100%', borderCollapse:'collapse' }}>
      <thead><tr>{['시간','구분','수량','체결가','체결액','상태','모드'].map(h => (
        <th key={h} style={{ textAlign:'left', padding:'10px 12px', fontSize:11,
          color:'var(--ink-2)', letterSpacing:'.12em', fontWeight:600,
          borderBottom:'1px solid var(--line)', textTransform:'uppercase' }}>{h}</th>
      ))}</tr></thead>
      <tbody>{FILLS.map((f,i) => (
        <tr key={i}>
          <td className="mono" style={tdLight}>{f.time}</td>
          <td style={tdLight}>
            <span style={{ padding:'2px 8px', borderRadius:5, fontSize:11, fontWeight:700,
              color: f.side === 'buy' ? 'var(--up)' : 'var(--down)',
              background: f.side === 'buy' ? 'rgba(22,163,74,.10)' : 'rgba(239,68,68,.10)' }}>
              {f.side === 'buy' ? '매수' : '매도'}
            </span>
          </td>
          <td className="mono" style={tdLight}>{f.qty}주</td>
          <td className="mono" style={tdLight}>{fmtW(f.price)}</td>
          <td className="mono" style={tdLight}>{fmtW(f.qty * f.price)}</td>
          <td style={tdLight}><span style={{ fontSize:12, color:'var(--up)' }}>체결</span></td>
          <td style={tdLight}>
            <span style={{ fontSize:10, padding:'2px 6px', borderRadius:4,
              background:'var(--accent-bg)', color:'var(--accent)',
              fontWeight:700, letterSpacing:'.06em' }}>{f.mode}</span>
          </td>
        </tr>
      ))}</tbody>
    </table>
  </div>
);

const HOLDINGS = [
  { sym:'005930', name:'삼성전자',   qty:7,  avg:307500, price:303500 },
  { sym:'000660', name:'SK하이닉스', qty:1,  avg:2240000, price:2277000 },
  { sym:'035420', name:'NAVER',      qty:5,  avg:198000, price:203000 },
];
const HoldingsPanel = () => (
  <div style={{ padding:'18px 20px' }}>
    <table style={{ width:'100%', borderCollapse:'collapse' }}>
      <thead><tr>{['종목','수량','평균가','현재가','평가액','평가 손익','수익률'].map(h => (
        <th key={h} style={{ textAlign:'left', padding:'10px 12px', fontSize:11,
          color:'var(--ink-2)', letterSpacing:'.12em', fontWeight:600,
          borderBottom:'1px solid var(--line)', textTransform:'uppercase' }}>{h}</th>
      ))}</tr></thead>
      <tbody>{HOLDINGS.map(h => {
        const pl = (h.price - h.avg) * h.qty;
        const plPct = ((h.price - h.avg) / h.avg) * 100;
        const up = pl >= 0;
        return (
          <tr key={h.sym}>
            <td style={tdLight}>
              <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                <span style={{ fontWeight:600 }}>{h.name}</span>
                <span className="mono" style={{ fontSize:11, color:'var(--ink-2)' }}>{h.sym}</span>
              </div>
            </td>
            <td className="mono" style={tdLight}>{h.qty}주</td>
            <td className="mono" style={tdLight}>{fmtW(h.avg)}</td>
            <td className="mono" style={tdLight}>{fmtW(h.price)}</td>
            <td className="mono" style={tdLight}>{fmtW(h.qty * h.price)}</td>
            <td className="mono" style={{ ...tdLight, color: up?'var(--up)':'var(--down)', fontWeight:600 }}>
              {up?'+':''}{pl.toLocaleString()}
            </td>
            <td className="mono" style={{ ...tdLight, color: up?'var(--up)':'var(--down)', fontWeight:600 }}>
              {up?'+':''}{plPct.toFixed(2)}%
            </td>
          </tr>
        );
      })}</tbody>
    </table>
  </div>
);

/* Note */
const NoteCardL = ({ stock }) => {
  const [note, setNote] = React.useState('');
  return (
    <div style={{ ...lt_card, padding:'18px 22px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
        marginBottom:10 }}>
        <h3 style={{ margin:0, fontSize:14, fontWeight:700,
          display:'flex', alignItems:'center', gap:8 }}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ color:'var(--ink-2)' }}>
            <path d="M9 2L12 5L5 12L1.5 12.5L2 9L9 2Z" stroke="currentColor"
              strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
          </svg>
          종목 메모
        </h3>
        <span className="mono" style={{ fontSize:11, color:'var(--ink-3)' }}>{note.length}/200</span>
      </div>
      <textarea value={note} onChange={e => setNote(e.target.value.slice(0, 200))}
        placeholder={`${stock.name}에 대한 메모를 남겨보세요 (자동 저장)`}
        style={{ width:'100%', minHeight:80, padding:'12px 14px',
          borderRadius:8, border:'1px solid var(--line)',
          background:'var(--bg-2)', color:'var(--ink-0)',
          fontSize:13.5, lineHeight:1.5, resize:'vertical',
          outline:'none', fontFamily:'inherit' }}/>
    </div>
  );
};

/* Right rail */
const VirtPromoL = () => (
  <article style={{ position:'relative', overflow:'hidden',
    padding:'24px 22px', borderRadius:16,
    background:'linear-gradient(160deg, var(--accent-bg-strong), var(--accent-bg) 50%, var(--bg-1))',
    border:'1px solid rgba(91,157,255,.28)' }}>
    <div aria-hidden style={{ position:'relative', height:64, marginBottom:14,
      display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ animation:'whale-float 7s ease-in-out infinite' }}>
        <svg width="84" height="56" viewBox="0 0 84 56" fill="none">
          <path d="M10 32 Q 24 16 44 22 Q 60 24 68 30 L 76 24 L 74 32 L 80 38 L 70 38
                   Q 60 44 44 42 Q 26 42 18 46 Q 12 40 10 32 Z" fill="var(--accent)" opacity=".75"/>
          <circle cx="24" cy="30" r="1.6" fill="#fff"/>
        </svg>
      </div>
    </div>
    <div style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'center', marginBottom:10 }}>
      <span style={{ fontSize:10.5, padding:'2px 7px', borderRadius:5,
        background:'var(--accent)', color:'#fff', fontWeight:700,
        letterSpacing:'.06em' }}>VIRT</span>
      <span style={{ ...lt_kicker, fontSize:11.5 }}>가상 거래</span>
    </div>
    <h3 style={{ margin:'0 0 8px', fontSize:17, fontWeight:700, textAlign:'center',
      letterSpacing:'-.01em' }}>
      Virt에서 안전하게 거래하세요
    </h3>
    <p style={{ margin:0, fontSize:13, color:'var(--ink-1)', textAlign:'center', lineHeight:1.55 }}>
      가상돈으로 매수·매도 주문을 체험하고<br/>전략을 테스트해보세요.
    </p>
    <a href="virt.html" style={{
      display:'block', marginTop:18, padding:'12px 16px', borderRadius:10,
      border:0, textAlign:'center',
      background:'linear-gradient(180deg, var(--accent-glow), var(--accent))',
      color:'#fff', fontSize:13.5, fontWeight:600, cursor:'pointer',
      fontFamily:'inherit', textDecoration:'none',
      boxShadow:'0 10px 24px -10px rgba(60,120,255,.6)' }}>
      Virt에서 거래하기 →
    </a>
  </article>
);

const PortfolioMiniL = () => (
  <article style={{ ...lt_card, padding:'22px 22px' }}>
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline',
      marginBottom:18 }}>
      <h3 style={{ margin:0, fontSize:14, fontWeight:700 }}>내 포트폴리오</h3>
      <a style={{ fontSize:11, color:'var(--ink-2)', cursor:'pointer' }}>전체 →</a>
    </div>
    <dl style={{ margin:0, display:'flex', flexDirection:'column', gap:12 }}>
      {[
        ['총 자산', '₩9,692,366', true],
        ['현금',    '₩7,000,001'],
      ].map(([l,v,em]) => (
        <div key={l} style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
          <dt style={{ fontSize:13, color:'var(--ink-1)' }}>{l}</dt>
          <dd className="mono" style={{ margin:0, fontSize: em?16:14, fontWeight: em?700:600 }}>{v}</dd>
        </div>
      ))}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
        <dt style={{ fontSize:13, color:'var(--ink-1)' }}>평가 손익</dt>
        <dd style={{ margin:0 }}>
          <span style={{ color:'var(--down)', fontWeight:600, fontSize:14 }}>▼ -3.08%</span>
          <span style={{ marginLeft:6, color:'var(--ink-2)', fontSize:11.5 }}>(-₩307,634)</span>
        </dd>
      </div>
    </dl>
    <div style={{ marginTop:18, paddingTop:16, borderTop:'1px solid var(--line)' }}>
      <div style={{ fontSize:11, color:'var(--ink-3)', letterSpacing:'.12em',
        fontWeight:600, marginBottom:10 }}>보유 종목</div>
      <ul style={{ margin:0, padding:0, listStyle:'none',
        display:'flex', flexDirection:'column', gap:10 }}>
        {[['비트코인',-8.5],['이더리움',-11.2],['솔라나',-10.7]].map(([n,p]) => (
          <li key={n} style={{ display:'flex', justifyContent:'space-between',
            alignItems:'center', fontSize:13 }}>
            <span style={{ color:'var(--ink-1)' }}>{n}</span>
            <span className="mono" style={{ color:'var(--down)', fontWeight:600 }}>{p}%</span>
          </li>
        ))}
      </ul>
    </div>
  </article>
);

/* App */
function App() {
  const [activeSym, setActiveSym] = React.useState(TRADE_STOCKS[0].sym);
  const stock = TRADE_STOCKS.find(s => s.sym === activeSym) || TRADE_STOCKS[0];
  const [tab, setTab] = React.useState('chart');
  const tabs = [
    { key:'chart', label:'차트' },
    { key:'order', label:'주문', badge:3 },
    { key:'fills', label:'체결', badge:3 },
    { key:'holding', label:'보유', badge:3 },
  ];
  return (
    <>
      <LtDashNav active="거래" />
      <TradeHeader />
      <main style={{ padding:'24px 32px 80px',
        display:'grid',
        gridTemplateColumns:'minmax(0, 260px) minmax(0, 1fr) minmax(0, 300px)',
        gap:20, alignItems:'start' }}>
        <StockListL items={TRADE_STOCKS} activeSym={activeSym} onPick={setActiveSym} />
        <div style={{ display:'flex', flexDirection:'column', gap:18, minWidth:0 }}>
          <StockHeaderL stock={stock} />
          <div style={{ ...lt_card, padding:0 }}>
            <TabBar active={tab} onChange={setTab} tabs={tabs} />
            {tab === 'chart' && <ChartPanelL stock={stock} />}
            {tab === 'order' && <OrderPanelL stock={stock} />}
            {tab === 'fills' && <FillsPanel />}
            {tab === 'holding' && <HoldingsPanel />}
          </div>
          <NoteCardL stock={stock} />
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:18,
          position:'sticky', top:96 }}>
          <VirtPromoL />
          <PortfolioMiniL />
        </div>
      </main>
      <LtFooter />
    </>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
