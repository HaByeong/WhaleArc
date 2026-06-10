/* Trade page — fills, holdings, right rail, note, App */

/* ============================================================ */
/* Fills history (체결)                                            */
/* ============================================================ */
const FILLS = [
  { time:'14:23:18', side:'buy',  qty:5,  price:303800, status:'filled',  mode:'VIRT' },
  { time:'11:08:42', side:'sell', qty:3,  price:308200, status:'filled',  mode:'VIRT' },
  { time:'10:42:11', side:'buy',  qty:10, price:307500, status:'partial', mode:'VIRT' },
];

const FillsPanel = () => (
  <div style={{ padding:'18px 20px' }}>
    <table style={{ width:'100%', borderCollapse:'collapse' }}>
      <thead>
        <tr>
          {['시간','구분','수량','체결가','체결액','상태','모드'].map(h => (
            <th key={h} style={{
              textAlign:'left', padding:'10px 12px', fontSize:11,
              color:'var(--ink-3)', letterSpacing:'.12em', fontWeight:600,
              borderBottom:'1px solid var(--line)', textTransform:'uppercase',
            }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {FILLS.map((f, i) => (
          <tr key={i}>
            <td className="mono" style={tdSx}>{f.time}</td>
            <td style={tdSx}>
              <span style={{
                padding:'2px 8px', borderRadius:5, fontSize:11, fontWeight:700,
                color: f.side === 'buy' ? 'var(--up)' : 'var(--down)',
                background: f.side === 'buy' ? 'rgba(239,77,77,.12)' : 'rgba(77,138,255,.12)',
              }}>{f.side === 'buy' ? '매수' : '매도'}</span>
            </td>
            <td className="mono" style={tdSx}>{f.qty}주</td>
            <td className="mono" style={tdSx}>{fmtKRW(f.price)}</td>
            <td className="mono" style={tdSx}>{fmtKRW(f.qty * f.price)}</td>
            <td style={tdSx}>
              <span style={{ fontSize:12, color: f.status === 'filled' ? 'var(--up)' : 'var(--ink-1)' }}>
                {f.status === 'filled' ? '체결' : '부분 체결'}
              </span>
            </td>
            <td style={tdSx}>
              <span style={{
                fontSize:10, padding:'2px 6px', borderRadius:4,
                background:'rgba(180,210,255,.18)', color:'#cfe1ff',
                fontWeight:700, letterSpacing:'.06em',
              }}>{f.mode}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const tdSx = { padding:'14px 12px', fontSize:13.5, borderBottom:'1px solid var(--line)' };

/* ============================================================ */
/* Holdings (보유)                                                 */
/* ============================================================ */
const HOLDINGS = [
  { sym:'005930', name:'삼성전자',   qty:7,  avg:307500, price:303500, market:'KOSPI' },
  { sym:'000660', name:'SK하이닉스', qty:1,  avg:2240000, price:2277000, market:'KOSPI' },
  { sym:'035420', name:'NAVER',      qty:5,  avg:198000, price:203000, market:'KOSPI' },
];

const HoldingsPanel = () => (
  <div style={{ padding:'18px 20px' }}>
    <table style={{ width:'100%', borderCollapse:'collapse' }}>
      <thead>
        <tr>
          {['종목','수량','평균가','현재가','평가액','평가 손익','수익률'].map(h => (
            <th key={h} style={{
              textAlign:'left', padding:'10px 12px', fontSize:11,
              color:'var(--ink-3)', letterSpacing:'.12em', fontWeight:600,
              borderBottom:'1px solid var(--line)', textTransform:'uppercase',
            }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {HOLDINGS.map((h, i) => {
          const pl = (h.price - h.avg) * h.qty;
          const plPct = ((h.price - h.avg) / h.avg) * 100;
          const up = pl >= 0;
          return (
            <tr key={h.sym}>
              <td style={tdSx}>
                <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                  <span style={{ fontWeight:600 }}>{h.name}</span>
                  <span className="mono" style={{ fontSize:11, color:'var(--ink-3)' }}>{h.sym}</span>
                </div>
              </td>
              <td className="mono" style={tdSx}>{h.qty}주</td>
              <td className="mono" style={tdSx}>{fmtKRW(h.avg)}</td>
              <td className="mono" style={tdSx}>{fmtKRW(h.price)}</td>
              <td className="mono" style={tdSx}>{fmtKRW(h.qty * h.price)}</td>
              <td className="mono" style={{ ...tdSx, color: up ? 'var(--up)' : 'var(--down)', fontWeight:600 }}>
                {up?'+':''}{pl.toLocaleString()}
              </td>
              <td className="mono" style={{ ...tdSx, color: up ? 'var(--up)' : 'var(--down)', fontWeight:600 }}>
                {up?'+':''}{plPct.toFixed(2)}%
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

/* ============================================================ */
/* Stock note                                                     */
/* ============================================================ */
const NoteCard = ({ stock }) => {
  const [note, setNote] = React.useState('');
  return (
    <div style={{ ...mkCard, padding:'18px 22px' }}>
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
        <span className="mono" style={{ fontSize:11, color:'var(--ink-3)' }}>
          {note.length}/200
        </span>
      </div>
      <textarea
        value={note}
        onChange={e => setNote(e.target.value.slice(0, 200))}
        placeholder={`${stock.name}에 대한 메모를 남겨보세요 (자동 저장)`}
        style={{
          width:'100%', minHeight:80, padding:'12px 14px',
          borderRadius:8, border:'1px solid var(--line)',
          background:'rgba(255,255,255,.02)',
          color:'#fff', fontSize:13.5, lineHeight:1.5, resize:'vertical',
          outline:'none', fontFamily:'inherit',
        }}
      />
    </div>
  );
};

/* ============================================================ */
/* Right rail: VIRT promo                                         */
/* ============================================================ */
const VirtPromo = () => (
  <article style={{
    position:'relative', overflow:'hidden',
    padding:'24px 22px',
    borderRadius:16,
    background:'linear-gradient(160deg, rgba(91,157,255,.18), rgba(91,157,255,.04) 50%, transparent)',
    border:'1px solid rgba(91,157,255,.30)',
  }}>
    {/* whale glyph */}
    <div aria-hidden style={{ position:'relative', height:64, marginBottom:14,
      display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ animation:'whale-float 7s ease-in-out infinite' }}>
        <svg width="84" height="56" viewBox="0 0 84 56" fill="none">
          <defs>
            <linearGradient id="whalep" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#9cc1ff"/>
              <stop offset="100%" stopColor="#2c6fe6"/>
            </linearGradient>
          </defs>
          <path d="M10 32 Q 24 16 44 22 Q 60 24 68 30 L 76 24 L 74 32 L 80 38 L 70 38
                   Q 60 44 44 42 Q 26 42 18 46 Q 12 40 10 32 Z"
            fill="url(#whalep)" opacity=".9"/>
          <circle cx="24" cy="30" r="1.6" fill="#fff"/>
        </svg>
      </div>
    </div>

    <div style={{ display:'flex', alignItems:'center', gap:8,
      justifyContent:'center', marginBottom:10 }}>
      <VirtBadge/>
      <span style={{ fontSize:11.5, color:'#9cc1ff', letterSpacing:'.12em',
        fontWeight:600 }}>가상 거래</span>
    </div>
    <h3 style={{ margin:'0 0 8px', fontSize:17, fontWeight:700, textAlign:'center',
      letterSpacing:'-.01em' }}>
      Virt에서 안전하게 거래하세요
    </h3>
    <p style={{ margin:0, fontSize:13, color:'var(--ink-1)', textAlign:'center',
      lineHeight:1.55 }}>
      가상돈으로 매수·매도 주문을 체험하고<br/>
      전략을 테스트해보세요.
    </p>
    <button style={{
      marginTop:18, width:'100%', padding:'12px 16px', borderRadius:10,
      border:0,
      background:'linear-gradient(180deg, var(--accent-glow), var(--accent))',
      color:'#fff', fontSize:13.5, fontWeight:600, cursor:'pointer',
      fontFamily:'inherit',
      boxShadow:'0 10px 24px -10px rgba(60,120,255,.6)',
    }}>Virt에서 거래하기 →</button>
  </article>
);

/* ============================================================ */
/* Right rail: portfolio mini                                     */
/* ============================================================ */
const PORTFOLIO_HOLDINGS = [
  { name:'비트코인',  pct:-8.5  },
  { name:'이더리움', pct:-11.2 },
  { name:'솔라나',    pct:-10.7 },
];

const PortfolioMini = () => (
  <article style={{ ...mkCard, padding:'22px 22px' }}>
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline',
      marginBottom:18 }}>
      <h3 style={{ margin:0, fontSize:14, fontWeight:700 }}>내 포트폴리오</h3>
      <a style={{ fontSize:11, color:'var(--ink-2)', cursor:'pointer' }}>전체 →</a>
    </div>

    {/* summary */}
    <dl style={{ margin:0, display:'flex', flexDirection:'column', gap:12 }}>
      <PortfolioRow label="총 자산" value="₩9,692,366" emphasis />
      <PortfolioRow label="현금"     value="₩7,000,001" />
      <PortfolioRow
        label="평가 손익"
        value={<>
          <span style={{ marginRight:8 }}>
            <svg width="9" height="9" viewBox="0 0 10 10" style={{ marginRight:2 }}>
              <path d="M5 8 L1 3 L9 3 Z" fill="var(--down)"/>
            </svg>
          </span>
          <span style={{ color:'var(--down)', fontWeight:600 }}>-3.08%</span>
          <span style={{ marginLeft:6, color:'var(--ink-2)', fontSize:11.5 }}>(-₩307,634)</span>
        </>}
      />
    </dl>

    {/* holdings sub-list */}
    <div style={{ marginTop:18, paddingTop:16, borderTop:'1px solid var(--line)' }}>
      <div style={{ fontSize:11, color:'var(--ink-3)', letterSpacing:'.12em',
        fontWeight:600, marginBottom:10 }}>보유 종목</div>
      <ul style={{ margin:0, padding:0, listStyle:'none',
        display:'flex', flexDirection:'column', gap:10 }}>
        {PORTFOLIO_HOLDINGS.map(h => (
          <li key={h.name} style={{ display:'flex', justifyContent:'space-between',
            alignItems:'center', fontSize:13 }}>
            <span style={{ color:'var(--ink-1)' }}>{h.name}</span>
            <span className="mono" style={{ color:'var(--down)', fontWeight:600 }}>
              {h.pct}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  </article>
);

const PortfolioRow = ({ label, value, emphasis }) => (
  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
    <dt style={{ fontSize:13, color:'var(--ink-2)' }}>{label}</dt>
    <dd className="mono" style={{ margin:0, fontSize: emphasis ? 18 : 14,
      fontWeight: emphasis ? 700 : 600 }}>{value}</dd>
  </div>
);

/* ============================================================ */
/* App                                                            */
/* ============================================================ */
function TradeApp() {
  const [activeSym, setActiveSym] = React.useState(STOCKS[0].sym);
  const stock = STOCKS.find(s => s.sym === activeSym) || STOCKS[0];

  const [tab, setTab] = React.useState('chart');
  const tabs = [
    { key:'chart',    label:'차트' },
    { key:'order',    label:'주문',  badge:3 },
    { key:'fills',    label:'체결',  badge:3 },
    { key:'holding',  label:'보유',  badge:3 },
  ];

  return (
    <>
      <SideNav active="trade" />
      <SideShell>
      <TradeHeader />

      <main style={{ padding:'24px 32px 80px',
        display:'grid',
        gridTemplateColumns:'minmax(0, 260px) minmax(0, 1fr) minmax(0, 300px)',
        gap:20, alignItems:'start' }}>
        {/* LEFT */}
        <StockList
          items={STOCKS}
          activeSym={activeSym}
          onPick={setActiveSym}
          compact
          classTabs
          minHeight={820}
        />

        {/* CENTER */}
        <div style={{ display:'flex', flexDirection:'column', gap:18, minWidth:0 }}>
          <StockHeaderCard stock={stock} />
          <div style={{ ...mkCard, padding:0 }}>
            <TabBar active={tab} onChange={setTab} tabs={tabs} />
            {tab === 'chart'   && <ChartPanel stock={stock} />}
            {tab === 'order'   && <OrderPanel stock={stock} />}
            {tab === 'fills'   && <FillsPanel />}
            {tab === 'holding' && <HoldingsPanel />}
          </div>
          <NoteCard stock={stock} />
        </div>

        {/* RIGHT */}
        <div style={{ display:'flex', flexDirection:'column', gap:18,
          position:'sticky', top:96 }}>
          <VirtPromo />
          <PortfolioMini />
        </div>
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

ReactDOM.createRoot(document.getElementById('root')).render(<TradeApp />);
