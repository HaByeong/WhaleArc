/* Markets — stock detail panel + app */

/* ============================================================ */
/* RIGHT: detail panel (markets-specific — 52w range + facts)    */
/* ============================================================ */
const StockDetail = ({ stock }) => {
  const [period, setPeriod] = React.useState('3M');
  const periods = ['1D','1W','1M','3M','6M','1Y','3Y'];
  const indicators = ['이동평균','거래량','RSI','MACD','볼린저'];
  const [active, setActive] = React.useState(['이동평균','거래량']);
  const toggle = (k) => setActive(a => a.includes(k) ? a.filter(x=>x!==k) : [...a, k]);

  const seed = React.useMemo(() => {
    let h = 7;
    for (const c of stock.sym) h = (h*31 + c.charCodeAt(0)) & 0x7fffffff;
    return h;
  }, [stock.sym]);
  const data = React.useMemo(() => genCandles(seed,
    period === '1D' ? 48 : period === '1W' ? 56 : period === '1M' ? 60 : 64,
    stock.price * 0.55, stock.price * 1.02), [seed, period, stock.price]);

  const up = stock.dPct >= 0;
  const prevClose = stock.prevClose || (stock.price - stock.dAbs);
  const yrLow = Math.round(stock.price * 0.62);
  const yrHi  = Math.round(stock.price * 1.18);
  const yrPos = ((stock.price - yrLow) / (yrHi - yrLow)) * 100;

  return (
    <section style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <div style={{ ...mkCard, padding:'24px 28px' }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between',
          gap:24, flexWrap:'wrap' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
              <span style={{
                fontSize:10.5, padding:'3px 8px', borderRadius:5,
                background:'rgba(91,157,255,.14)', color:'#cfe1ff',
                fontWeight:700, letterSpacing:'.08em',
                border:'1px solid rgba(91,157,255,.24)',
              }}>{stock.market}</span>
              <span className="mono" style={{ fontSize:12, color:'var(--ink-3)' }}>
                {stock.sym}
              </span>
              <button style={iconChip} title="관심 추가">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2.5L9.8 6.5L14 7L11 10L11.8 14L8 12L4.2 14L5 10L2 7L6.2 6.5Z"
                    stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
                </svg>
              </button>
              <button style={iconChip} title="알림 설정">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M3.5 11.5h9l-1-1.2V7.2a3.5 3.5 0 1 0-7 0v3.1l-1 1.2Z"
                    stroke="currentColor" strokeWidth="1.3"/>
                </svg>
              </button>
            </div>
            <h2 style={{ margin:0, fontSize:30, fontWeight:700, letterSpacing:'-.01em' }}>
              {stock.name}
            </h2>
            <div style={{ marginTop:14, display:'flex', alignItems:'baseline', gap:14, flexWrap:'wrap' }}>
              <span className="mono" style={{ fontSize:38, fontWeight:600,
                letterSpacing:'-.02em' }}>{fmtKRW(stock.price)}</span>
              <span className="mono" style={{ fontSize:16, fontWeight:600,
                color: up ? 'var(--up)' : 'var(--down)' }}>
                {up ? '+' : ''}{stock.dAbs.toLocaleString()} ({up?'+':''}{stock.dPct.toFixed(2)}%)
              </span>
            </div>
          </div>

          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <a href="trade.html" style={pillBtn('primary')}>매수</a>
            <a href="trade.html" style={pillBtn('danger')}>매도</a>
            <button style={pillBtn('ghost')}>
              <span style={{ fontSize:10, padding:'2px 5px', borderRadius:4,
                background:'rgba(180,210,255,.18)', color:'#cfe1ff',
                fontWeight:700, letterSpacing:'.06em', marginRight:6 }}>VIRT</span>
              모의 거래
            </button>
            <button style={pillBtn('ghost')}>전략 백테스트 →</button>
          </div>
        </div>
      </div>

      <div style={{ ...mkCard, padding:'20px 24px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
          gap:16, flexWrap:'wrap', marginBottom:14 }}>
          <div style={{ display:'flex', gap:4, padding:3, borderRadius:8,
            background:'rgba(255,255,255,.04)', border:'1px solid var(--line)' }}>
            {periods.map(p => (
              <button key={p} onClick={() => setPeriod(p)} style={{
                padding:'6px 12px', borderRadius:6, fontSize:12, fontWeight:600,
                border:0, cursor:'pointer', fontFamily:'inherit', minWidth:36,
                background: period === p ? 'rgba(91,157,255,.18)' : 'transparent',
                color: period === p ? '#fff' : 'var(--ink-1)',
              }}>{p}</button>
            ))}
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {indicators.map(ind => {
              const isOn = active.includes(ind);
              return (
                <button key={ind} onClick={() => toggle(ind)} style={{
                  padding:'6px 10px', borderRadius:6, fontSize:12, fontWeight:500,
                  border: isOn ? '1px solid rgba(91,157,255,.32)' : '1px solid var(--line)',
                  background: isOn ? 'rgba(91,157,255,.10)' : 'transparent',
                  color: isOn ? '#fff' : 'var(--ink-2)',
                  cursor:'pointer', fontFamily:'inherit',
                  display:'inline-flex', alignItems:'center', gap:5,
                }}>
                  <span style={{ width:6, height:6, borderRadius:'50%',
                    background: isOn ? 'var(--accent-glow)' : 'var(--ink-3)' }}/>
                  {ind}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ height:340 }}>
          <CandlestickChart data={data} height={320}/>
        </div>
      </div>

      <div style={{ display:'grid',
        gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:14 }}>
        <Stat label="전일 종가" value={fmtKRW(prevClose)} />
        <Stat label="등락률"    value={`${up?'+':''}${stock.dPct.toFixed(2)}%`}
              color={up ? 'var(--up)' : 'var(--down)'} />
        <Stat label="등락액"    value={`${up?'+':''}${stock.dAbs.toLocaleString()}`}
              prefix="₩" color={up ? 'var(--up)' : 'var(--down)'} />
        <Stat label="거래량"    value={stock.vol} />
      </div>

      <div style={{ display:'grid',
        gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:18 }}>
        <div style={{ ...mkCard, padding:'22px 24px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline',
            marginBottom:14, gap:12, flexWrap:'wrap' }}>
            <h3 style={{ margin:0, fontSize:14, fontWeight:700, letterSpacing:'.02em',
              whiteSpace:'nowrap' }}>52주 범위</h3>
            <span className="mono" style={{ fontSize:11, color:'var(--ink-3)', whiteSpace:'nowrap' }}>
              현재 위치 {yrPos.toFixed(0)}%
            </span>
          </div>
          <div style={{ position:'relative', height:6, borderRadius:3,
            background:'rgba(255,255,255,.06)' }}>
            <div style={{ position:'absolute', left:0, top:0, bottom:0,
              width:`${yrPos}%`, borderRadius:3,
              background:'linear-gradient(90deg, var(--accent), var(--accent-glow))' }}/>
            <div style={{ position:'absolute', top:-4, width:14, height:14,
              borderRadius:'50%', background:'#fff',
              left:`calc(${yrPos}% - 7px)`,
              boxShadow:'0 0 0 3px rgba(91,157,255,.3), 0 2px 8px rgba(0,0,0,.4)' }}/>
          </div>
          <div style={{ marginTop:14, display:'flex', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontSize:11, color:'var(--ink-2)', letterSpacing:'.1em' }}>최저</div>
              <div className="mono" style={{ fontSize:16, fontWeight:600, marginTop:4 }}>
                {fmtKRW(yrLow)}
              </div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:11, color:'var(--ink-2)', letterSpacing:'.1em' }}>최고</div>
              <div className="mono" style={{ fontSize:16, fontWeight:600, marginTop:4 }}>
                {fmtKRW(yrHi)}
              </div>
            </div>
          </div>
        </div>

        <div style={{ ...mkCard, padding:'22px 24px' }}>
          <h3 style={{ margin:'0 0 14px', fontSize:14, fontWeight:700,
            letterSpacing:'.02em' }}>기본 정보</h3>
          <dl style={{ margin:0, display:'grid', gridTemplateColumns:'auto 1fr',
            rowGap:10, columnGap:14, fontSize:13 }}>
            <dt style={{ color:'var(--ink-2)', whiteSpace:'nowrap' }}>시가총액</dt>
            <dd className="mono" style={ddSx}>{stock.mcap}</dd>
            <dt style={{ color:'var(--ink-2)', whiteSpace:'nowrap' }}>업종</dt>
            <dd style={ddSx}>전기·전자 / 반도체</dd>
            <dt style={{ color:'var(--ink-2)', whiteSpace:'nowrap' }}>거래대금</dt>
            <dd className="mono" style={ddSx}>2.96조</dd>
            <dt style={{ color:'var(--ink-2)', whiteSpace:'nowrap' }}>외인 비율</dt>
            <dd className="mono" style={ddSx}>53.42%</dd>
          </dl>
        </div>
      </div>
    </section>
  );
};

/* ============================================================ */
/* App                                                           */
/* ============================================================ */
function MarketsApp() {
  const [klass, setKlass] = React.useState('stock');
  const [activeSym, setActiveSym] = React.useState(STOCKS[0].sym);
  const stock = STOCKS.find(s => s.sym === activeSym) || STOCKS[0];

  return (
    <>
      <SideNav active="markets" />
      <SideShell>
      <PageHeader />
      <IndexStrip />
      <ClassTabs active={klass} onChange={setKlass} />

      <main style={{ padding:'24px 32px 80px',
        display:'grid', gridTemplateColumns:'minmax(320px, 380px) 1fr',
        gap:24, alignItems:'start' }}>
        <StockList items={STOCKS} activeSym={activeSym} onPick={setActiveSym} />
        <StockDetail stock={stock} />
      </main>

      <footer style={{ padding:'40px 32px 28px', borderTop:'1px solid var(--line)',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        flexWrap:'wrap', gap:14 }}>
        <span className="mono" style={{ fontSize:12, color:'var(--ink-3)' }}>
          © 2026 WhaleArc Labs · 모든 항해는 사용자의 책임 아래 진행됩니다.
        </span>
        <div style={{ display:'flex', gap:18, fontSize:12.5, color:'var(--ink-2)' }}>
          <a>도움말</a><a>상태</a><a>API</a><a>의견 보내기</a>
        </div>
      </footer>
      </SideShell>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<MarketsApp />);
