/* Trade page — header, tabs, order ticket, orderbook, fills, holdings */

/* ============================================================ */
/* Page header — session status                                  */
/* ============================================================ */
const TradeHeader = () => (
  <section style={{ padding:'28px 32px 0' }}>
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12,
      flexWrap:'wrap' }}>
      <span style={{ width:6, height:6, borderRadius:'50%',
        background:'#ef4d4d', boxShadow:'0 0 8px #ef4d4d',
        animation:'pulse-dot 2s ease-in-out infinite' }}/>
      <span style={{ fontSize:11.5, letterSpacing:'.18em', color:'#9cc1ff',
        fontWeight:600 }}>TRADING SESSION · 정규장 진행 중</span>
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

/* ============================================================ */
/* Stock header card                                              */
/* ============================================================ */
const StockHeaderCard = ({ stock }) => {
  const up = stock.dPct >= 0;
  const prevClose = stock.prevClose || (stock.price - stock.dAbs);
  return (
    <div style={{ ...mkCard, padding:'22px 26px' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between',
        gap:24, flexWrap:'wrap' }}>
        <div style={{ minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
            <span style={{
              fontSize:10.5, padding:'3px 8px', borderRadius:5,
              background:'rgba(91,157,255,.14)', color:'#cfe1ff',
              fontWeight:700, letterSpacing:'.08em',
              border:'1px solid rgba(91,157,255,.24)',
            }}>{stock.market} · KRX</span>
            <span className="mono" style={{ fontSize:12, color:'var(--ink-3)' }}>
              {stock.sym}
            </span>
            <button style={iconChip} title="관심">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M8 2.5L9.8 6.5L14 7L11 10L11.8 14L8 12L4.2 14L5 10L2 7L6.2 6.5Z"
                  stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
              </svg>
            </button>
            <button style={iconChip} title="알림">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M3.5 11.5h9l-1-1.2V7.2a3.5 3.5 0 1 0-7 0v3.1l-1 1.2Z"
                  stroke="currentColor" strokeWidth="1.3"/>
              </svg>
            </button>
          </div>
          <h2 style={{ margin:0, fontSize:26, fontWeight:700, letterSpacing:'-.01em' }}>
            {stock.name}
          </h2>
        </div>
        <div style={{ textAlign:'right', display:'flex', flexDirection:'column', gap:6 }}>
          <span className="mono" style={{ fontSize:32, fontWeight:600,
            letterSpacing:'-.02em' }}>{fmtKRW(stock.price)}</span>
          <span className="mono" style={{ fontSize:14, fontWeight:600,
            color: up ? 'var(--up)' : 'var(--down)' }}>
            {up ? '+' : ''}{stock.dAbs.toLocaleString()} ({up?'+':''}{stock.dPct.toFixed(2)}%)
          </span>
        </div>
      </div>

      {/* inline stat strip */}
      <div style={{ marginTop:18, paddingTop:18, borderTop:'1px solid var(--line)',
        display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(120px, 1fr))',
        gap:18 }}>
        <InlineStat label="거래량" value={stock.vol} />
        <InlineStat label="전일 종가" value={fmtKRW(prevClose)} />
        <InlineStat label="시가총액" value={stock.mcap || '—'} />
        <InlineStat label="변동성"
          value={`${(Math.abs(stock.dPct) * 1.4).toFixed(1)}%`} />
      </div>
    </div>
  );
};

const InlineStat = ({ label, value }) => (
  <div style={{ display:'flex', flexDirection:'column', gap:4, minWidth:0 }}>
    <span style={{ fontSize:10.5, color:'var(--ink-2)', letterSpacing:'.12em',
      fontWeight:600 }}>{label}</span>
    <span className="mono" style={{ fontSize:15, fontWeight:600,
      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{value}</span>
  </div>
);

/* ============================================================ */
/* Tab bar                                                        */
/* ============================================================ */
const TabBar = ({ active, onChange, tabs }) => (
  <div style={{ display:'flex', alignItems:'center', gap:0,
    borderBottom:'1px solid var(--line)', padding:'0 6px' }}>
    {tabs.map(({ key, label, badge }) => {
      const isOn = active === key;
      return (
        <button key={key} onClick={() => onChange(key)} style={{
          position:'relative', padding:'14px 18px', border:0, background:'transparent',
          color: isOn ? '#fff' : 'var(--ink-2)',
          fontSize:14, fontWeight: isOn ? 700 : 500, cursor:'pointer',
          fontFamily:'inherit', display:'inline-flex', alignItems:'center', gap:8,
        }}>
          {label}
          {badge != null && (
            <span style={{
              fontSize:11, padding:'2px 7px', borderRadius:999,
              background: isOn ? 'rgba(91,157,255,.22)' : 'rgba(255,255,255,.06)',
              color: isOn ? '#cfe1ff' : 'var(--ink-2)', fontWeight:700,
            }}>{badge}</span>
          )}
          {isOn && (
            <span style={{ position:'absolute', left:12, right:12, bottom:-1, height:2,
              background:'linear-gradient(90deg, var(--accent), var(--accent-glow))',
              borderRadius:1 }}/>
          )}
        </button>
      );
    })}
  </div>
);

/* ============================================================ */
/* Chart panel (smaller, with periods)                            */
/* ============================================================ */
const ChartPanel = ({ stock }) => {
  const [period, setPeriod] = React.useState('3M');
  const periods = ['1D','1W','1M','3M','6M','1Y','3Y'];
  const seed = React.useMemo(() => {
    let h = 7;
    for (const c of stock.sym) h = (h*31 + c.charCodeAt(0)) & 0x7fffffff;
    return h;
  }, [stock.sym]);
  const data = React.useMemo(() => genCandles(seed, 60,
    stock.price * 0.55, stock.price * 1.02), [seed, stock.price]);

  return (
    <div style={{ padding:'18px 20px' }}>
      <div style={{ display:'flex', gap:4, padding:3, borderRadius:8, marginBottom:14,
        background:'rgba(255,255,255,.04)', border:'1px solid var(--line)', width:'fit-content' }}>
        {periods.map(p => (
          <button key={p} onClick={() => setPeriod(p)} style={{
            padding:'5px 11px', borderRadius:6, fontSize:11.5, fontWeight:600,
            border:0, cursor:'pointer', fontFamily:'inherit', minWidth:32,
            background: period === p ? 'rgba(91,157,255,.18)' : 'transparent',
            color: period === p ? '#fff' : 'var(--ink-1)',
          }}>{p}</button>
        ))}
      </div>
      <div style={{ height:300 }}>
        <CandlestickChart data={data} height={300}/>
      </div>
    </div>
  );
};

/* ============================================================ */
/* Order ticket + orderbook                                       */
/* ============================================================ */
const OrderPanel = ({ stock }) => {
  const [side, setSide] = React.useState('buy');
  return (
    <div style={{ display:'grid',
      gridTemplateColumns:'minmax(0, 1fr) minmax(260px, 320px)',
      gap:18, padding:'18px 20px' }}>
      <OrderTicket stock={stock} side={side} setSide={setSide} />
      <Orderbook stock={stock} />
    </div>
  );
};

const OrderTicket = ({ stock, side, setSide }) => {
  const [orderType, setOrderType] = React.useState('limit'); // limit | market
  const [price, setPrice] = React.useState(stock.price);
  const [qty, setQty] = React.useState(10);
  const total = price * qty;
  const available = 7000001; // mock cash

  React.useEffect(() => { setPrice(stock.price); }, [stock.sym]);

  const isBuy = side === 'buy';
  const tick = stock.price >= 1000000 ? 1000 : stock.price >= 100000 ? 100 : 50;

  return (
    <div style={{ ...mkCard, padding:'20px 22px' }}>
      {/* buy/sell toggle */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:0,
        padding:3, borderRadius:10,
        background:'rgba(255,255,255,.04)', border:'1px solid var(--line)' }}>
        {[
          ['buy','매수','var(--up)'],
          ['sell','매도','var(--down)'],
        ].map(([k,l,c]) => (
          <button key={k} onClick={() => setSide(k)} style={{
            padding:'10px', borderRadius:8, border:0, cursor:'pointer',
            fontFamily:'inherit', fontSize:14, fontWeight:700,
            background: side === k ? c : 'transparent',
            color: side === k ? '#0a1230' : 'var(--ink-1)',
            transition:'all .15s',
          }}>{l}</button>
        ))}
      </div>

      {/* order type */}
      <div style={{ marginTop:18 }}>
        <FieldLabel>주문 종류</FieldLabel>
        <div style={{ display:'flex', gap:6, marginTop:6 }}>
          {[
            ['limit','지정가'],
            ['market','시장가'],
            ['cond','조건'],
          ].map(([k,l]) => (
            <button key={k} onClick={() => setOrderType(k)} style={{
              flex:1, padding:'9px 0', borderRadius:8, fontSize:12.5, fontWeight:600,
              border: orderType===k ? '1px solid rgba(91,157,255,.32)' : '1px solid var(--line)',
              background: orderType===k ? 'rgba(91,157,255,.12)' : 'transparent',
              color: orderType===k ? '#fff' : 'var(--ink-1)',
              cursor:'pointer', fontFamily:'inherit',
            }}>{l}</button>
          ))}
        </div>
      </div>

      {/* price */}
      <div style={{ marginTop:18 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
          <FieldLabel>주문 가격</FieldLabel>
          <span className="mono" style={{ fontSize:11, color:'var(--ink-3)' }}>
            전일 +{((price - stock.price)/stock.price*100).toFixed(2)}%
          </span>
        </div>
        <NumberField
          value={price}
          onChange={setPrice}
          step={tick}
          disabled={orderType === 'market'}
          suffix="원"
        />
      </div>

      {/* qty */}
      <div style={{ marginTop:14 }}>
        <FieldLabel>수량</FieldLabel>
        <NumberField
          value={qty}
          onChange={setQty}
          step={1}
          suffix="주"
        />
        <div style={{ marginTop:8, display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:6 }}>
          {['10%','25%','50%','최대'].map((p, i) => (
            <button key={p} onClick={() => {
              const pct = i === 3 ? 1 : [0.1, 0.25, 0.5][i];
              setQty(Math.floor((available * pct) / price));
            }} style={{
              padding:'7px 0', borderRadius:6, fontSize:11.5, fontWeight:600,
              border:'1px solid var(--line)', background:'rgba(255,255,255,.025)',
              color:'var(--ink-1)', cursor:'pointer', fontFamily:'inherit',
            }}>{p}</button>
          ))}
        </div>
      </div>

      {/* total + balance */}
      <div style={{ marginTop:18, padding:'14px 16px', borderRadius:10,
        background:'rgba(255,255,255,.025)', border:'1px solid var(--line)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:12.5, color:'var(--ink-2)' }}>주문 총액</span>
          <span className="mono" style={{ fontSize:18, fontWeight:600 }}>
            {fmtKRW(total)}
          </span>
        </div>
        <div style={{ marginTop:10, display:'flex', justifyContent:'space-between',
          alignItems:'center', fontSize:12, color:'var(--ink-2)' }}>
          <span>{isBuy ? '주문 가능' : '보유 수량'}</span>
          <span className="mono">{isBuy ? fmtKRW(available) : '0주'}</span>
        </div>
      </div>

      {/* mode + submit */}
      <div style={{ marginTop:14, display:'flex', alignItems:'center', gap:10,
        padding:'10px 12px', borderRadius:8,
        background:'rgba(255,205,120,.08)', border:'1px solid rgba(255,205,120,.18)' }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color:'#ffcd78' }}>
          <path d="M7 2L13 12H1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
          <path d="M7 6v3 M7 10.5v.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
        <span style={{ fontSize:11.5, color:'#ffcd78', lineHeight:1.4 }}>
          실계좌가 연결되지 않았습니다. <strong>VIRT 모의 거래</strong>로 진행됩니다.
        </span>
      </div>

      <button style={{
        marginTop:14, width:'100%', padding:'14px 18px', borderRadius:10,
        border:0, cursor:'pointer', fontFamily:'inherit',
        fontSize:15, fontWeight:700,
        background: isBuy
          ? 'linear-gradient(180deg, var(--up), #c73a3a)'
          : 'linear-gradient(180deg, var(--down), #2f6fe0)',
        color:'#0a1230',
        boxShadow: isBuy
          ? '0 10px 28px -12px rgba(239,77,77,.5)'
          : '0 10px 28px -12px rgba(77,138,255,.5)',
      }}>
        <span style={{
          fontSize:10, padding:'2px 6px', borderRadius:4,
          background:'rgba(10,18,48,.18)', color:'#0a1230',
          fontWeight:700, letterSpacing:'.06em', marginRight:8,
        }}>VIRT</span>
        {qty}주 {isBuy ? '매수' : '매도'} 주문
      </button>
    </div>
  );
};

const FieldLabel = ({ children }) => (
  <span style={{ fontSize:11.5, color:'var(--ink-2)', letterSpacing:'.06em',
    fontWeight:600 }}>{children}</span>
);

const NumberField = ({ value, onChange, step = 1, suffix, disabled }) => (
  <div style={{ marginTop:6, display:'grid', gridTemplateColumns:'36px 1fr 36px', gap:0,
    border:'1px solid var(--line)', borderRadius:8, overflow:'hidden',
    background: disabled ? 'rgba(255,255,255,.01)' : 'rgba(255,255,255,.025)' }}>
    <button onClick={() => !disabled && onChange(Math.max(0, value - step))}
      disabled={disabled} style={fieldBtnSx}>−</button>
    <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
      <input
        type="number"
        value={value} onChange={e => onChange(Number(e.target.value) || 0)}
        disabled={disabled}
        className="mono"
        style={{
          width:'100%', padding:'10px 36px 10px 12px',
          border:0, background:'transparent',
          color: disabled ? 'var(--ink-3)' : '#fff', fontSize:15, fontWeight:600,
          outline:'none', fontFamily:'JetBrains Mono, monospace', textAlign:'right',
        }}
      />
      {suffix && (
        <span style={{ position:'absolute', right:12, color:'var(--ink-3)',
          fontSize:12, pointerEvents:'none' }}>{suffix}</span>
      )}
    </div>
    <button onClick={() => !disabled && onChange(value + step)}
      disabled={disabled} style={fieldBtnSx}>+</button>
  </div>
);

const fieldBtnSx = {
  background:'rgba(255,255,255,.02)', border:0, borderInline:'1px solid var(--line)',
  color:'var(--ink-1)', fontSize:16, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
};

/* ============================================================ */
/* Orderbook (호가)                                                */
/* ============================================================ */
const Orderbook = ({ stock }) => {
  // generate 5 ask + 5 bid levels around current price
  const tick = stock.price >= 1000000 ? 1000 : stock.price >= 100000 ? 100 : 50;
  const seed = stock.sym.split('').reduce((h,c) => (h*31 + c.charCodeAt(0)) & 0x7fffffff, 7);
  const rand = (n) => { seed; let h = seed * (n+1); h = (h*1103515245 + 12345) & 0x7fffffff; return (h % 1000) / 1000; };
  const asks = [];
  const bids = [];
  let maxQty = 1;
  for (let i = 0; i < 5; i++) {
    const askQty = Math.floor(800 + rand(i)*4200);
    const bidQty = Math.floor(800 + rand(i+10)*4200);
    asks.unshift({ price: stock.price + tick * (i+1), qty: askQty });
    bids.push({ price: stock.price - tick * (i+1), qty: bidQty });
    maxQty = Math.max(maxQty, askQty, bidQty);
  }

  const totalAsk = asks.reduce((s,a)=>s+a.qty, 0);
  const totalBid = bids.reduce((s,b)=>s+b.qty, 0);

  return (
    <div style={{ ...mkCard, padding:'14px 0 0', display:'flex',
      flexDirection:'column', minWidth:0 }}>
      <div style={{ padding:'0 18px 12px', borderBottom:'1px solid var(--line)',
        display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <h3 style={{ margin:0, fontSize:13.5, fontWeight:700 }}>호가</h3>
        <span style={{ fontSize:10.5, color:'var(--ink-3)', letterSpacing:'.08em' }}>
          5단계 · 실시간
        </span>
      </div>

      {/* asks (top, descending in display = highest at top) */}
      <ul style={{ margin:0, padding:0, listStyle:'none' }}>
        {asks.map((a, i) => (
          <OrderbookRow key={'a'+i} side="ask" price={a.price} qty={a.qty} maxQty={maxQty}/>
        ))}
      </ul>

      {/* current price spread */}
      <div style={{ padding:'10px 18px',
        background:'rgba(91,157,255,.06)',
        borderTop:'1px solid rgba(91,157,255,.2)',
        borderBottom:'1px solid rgba(91,157,255,.2)',
        display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize:11, color:'var(--accent-glow)', letterSpacing:'.1em',
          fontWeight:600 }}>현재가</span>
        <span className="mono" style={{ fontSize:15, fontWeight:700, color:'#fff' }}>
          {fmtKRW(stock.price)}
        </span>
      </div>

      <ul style={{ margin:0, padding:0, listStyle:'none' }}>
        {bids.map((b, i) => (
          <OrderbookRow key={'b'+i} side="bid" price={b.price} qty={b.qty} maxQty={maxQty}/>
        ))}
      </ul>

      {/* totals */}
      <div style={{ padding:'12px 18px', borderTop:'1px solid var(--line)',
        display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:11 }}>
        <div>
          <div style={{ color:'var(--ink-2)', letterSpacing:'.08em' }}>매도 잔량</div>
          <div className="mono" style={{ color:'var(--down)', fontWeight:600, marginTop:2 }}>
            {totalAsk.toLocaleString()}
          </div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ color:'var(--ink-2)', letterSpacing:'.08em' }}>매수 잔량</div>
          <div className="mono" style={{ color:'var(--up)', fontWeight:600, marginTop:2 }}>
            {totalBid.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
};

const OrderbookRow = ({ side, price, qty, maxQty }) => {
  const isAsk = side === 'ask';
  const fillW = (qty / maxQty) * 100;
  return (
    <li style={{ position:'relative', display:'grid',
      gridTemplateColumns:'1fr 1fr', alignItems:'center', padding:'6px 18px',
      fontSize:12 }}>
      {/* bar */}
      <div aria-hidden style={{
        position:'absolute', top:2, bottom:2,
        [isAsk ? 'right' : 'left']:0, width:`${fillW * 0.55}%`,
        background: isAsk ? 'rgba(77,138,255,.10)' : 'rgba(239,77,77,.10)',
        borderRadius: isAsk ? '0 4px 4px 0' : '4px 0 0 4px',
      }}/>
      <span className="mono" style={{ position:'relative',
        color: isAsk ? 'var(--ink-2)' : 'var(--ink-2)', textAlign:'left' }}>
        {!isAsk && qty.toLocaleString()}
      </span>
      <span className="mono" style={{ position:'relative', textAlign:'right',
        fontWeight:600,
        color: isAsk ? 'var(--down)' : 'var(--up)' }}>
        {price.toLocaleString()}
      </span>
      {isAsk && (
        <span className="mono" style={{ position:'absolute', left:18,
          color:'var(--ink-2)', fontSize:12 }}>
          {qty.toLocaleString()}
        </span>
      )}
    </li>
  );
};

Object.assign(window, {
  TradeHeader, StockHeaderCard, TabBar, ChartPanel, OrderPanel,
});
