/* VIRT portfolio — right rail + App */

/* ============================================================ */
/* Right: Investment Summary                                      */
/* ============================================================ */
const PortfolioInvestmentSummary = ({ cash, equity, total, pnlAbs, pnlPct }) => (
  <section style={{ ...virtCard }}>
    <header style={{ ...cardSection, paddingBottom:14,
      borderBottom:'1px solid var(--line)' }}>
      <h3 style={sectionTitle}>투자 요약</h3>
    </header>
    <dl style={{ margin:0, padding:'16px 24px 20px',
      display:'flex', flexDirection:'column', gap:14 }}>
      <SumRow label="현금"          value={wKRW(cash)} />
      <SumRow label="보유 종목 평가" value={wKRW(equity)} />
      <SumRow label="총 자산"        value={wKRW(total)} emphasis />
      <SumRow label="총 손익" value={
        <span style={{ color: pnlAbs >= 0 ? 'var(--up)' : 'var(--down)' }}>
          {pnlAbs >= 0 ? '+' : '-'}{wKRW(Math.abs(pnlAbs))}
          <span style={{ marginLeft:6, fontSize:12, fontWeight:600 }}>
            (<Tri up={pnlAbs >= 0}/>{pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)
          </span>
        </span>
      } />
    </dl>
  </section>
);

const SumRow = ({ label, value, emphasis }) => (
  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline',
    gap:12 }}>
    <dt style={{ fontSize:13, color:'var(--ink-1)' }}>{label}</dt>
    <dd className="mono" style={{ margin:0, fontSize: emphasis ? 16 : 14,
      fontWeight: emphasis ? 700 : 600, color:'var(--ink-0)', whiteSpace:'nowrap' }}>
      {value}
    </dd>
  </div>
);

/* ============================================================ */
/* Right: Sailing Strategy (rich, with per-holding P&L)           */
/* ============================================================ */
const SailingStrategyDetail = ({ name, invested, pnlAbs, pnlPct, breakdown }) => (
  <section style={{ ...virtCard }}>
    <header style={{ ...cardSection, paddingBottom:14,
      display:'flex', alignItems:'center', justifyContent:'space-between',
      borderBottom:'1px solid var(--line)' }}>
      <h3 style={sectionTitle}>항해 중인 항로</h3>
      <a style={{ ...sectionLink, color:'var(--down)' }}>항해 취소</a>
    </header>
    <div style={{ padding:'18px 24px 20px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
        gap:8, marginBottom:6 }}>
        <span style={{ fontSize:14, fontWeight:700 }}>{name}</span>
        <button style={{
          width:24, height:24, borderRadius:6, border:'1px solid var(--line)',
          background:'var(--bg-2)', color:'var(--ink-2)', cursor:'pointer',
          display:'inline-flex', alignItems:'center', justifyContent:'center',
        }} title="즐겨찾기">
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
            <path d="M8 2.5L9.8 6.5L14 7L11 10L11.8 14L8 12L4.2 14L5 10L2 7L6.2 6.5Z"
              stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="none"/>
          </svg>
        </button>
      </div>
      <div style={{ fontSize:12.5, color:'var(--ink-2)' }}>
        투자: <span className="mono" style={{ color:'var(--ink-0)', fontWeight:600 }}>
          {wKRW(invested)}
        </span>
      </div>

      {/* P&L block */}
      <div style={{ marginTop:14, padding:'14px 16px', borderRadius:10,
        background: pnlPct >= 0 ? 'rgba(239,77,77,.06)' : 'rgba(44,111,230,.06)',
        border: pnlPct >= 0
          ? '1px solid rgba(239,77,77,.20)'
          : '1px solid rgba(44,111,230,.20)' }}>
        <div className="mono" style={{ fontSize:22, fontWeight:700,
          letterSpacing:'-.01em',
          color: pnlPct >= 0 ? 'var(--up)' : 'var(--down)' }}>
          <Tri up={pnlPct >= 0}/>{pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
        </div>
        <div className="mono" style={{ marginTop:4, fontSize:12,
          color:'var(--ink-2)' }}>
          ({pnlAbs >= 0 ? '+' : '-'}{wKRW(Math.abs(pnlAbs))})
        </div>
      </div>

      {/* per-asset row */}
      <div style={{ marginTop:14, display:'flex', flexWrap:'wrap', gap:12,
        fontSize:12 }}>
        {breakdown.map(b => (
          <span key={b.sym} style={{ color:'var(--ink-1)' }}>
            {b.sym} <span className="mono" style={{
              color: b.pct >= 0 ? 'var(--up)' : 'var(--down)',
              fontWeight:600,
            }}>{b.pct >= 0 ? '+' : ''}{b.pct.toFixed(1)}%</span>
          </span>
        )).reduce((acc, el, i, arr) => acc.concat(
          i < arr.length - 1 ? [el, <span key={'sep'+i} style={{ color:'var(--ink-3)' }}>·</span>] : [el]
        ), [])}
      </div>
    </div>
  </section>
);

/* ============================================================ */
/* Right: Quick Actions with Export                               */
/* ============================================================ */
const PortfolioQuickActions = () => (
  <section style={{ ...virtCard, padding:'18px 18px' }}>
    <h3 style={{ ...sectionTitle, padding:'4px 6px 14px' }}>빠른 액션</h3>
    <ul style={{ margin:0, padding:0, listStyle:'none',
      display:'flex', flexDirection:'column', gap:8 }}>
      <PActionItem variant="primary" label="거래하기" href="trade.html" />
      <PActionItem label="항로 둘러보기" href="learn.html" />
      <PActionItem label="전략 분석" href="backtest.html" />
    </ul>

    {/* export section */}
    <div style={{ marginTop:18, paddingTop:14, borderTop:'1px solid var(--line)' }}>
      <div style={{ padding:'2px 6px 10px',
        fontSize:11, color:'var(--ink-2)', letterSpacing:'.1em',
        fontWeight:600, textTransform:'uppercase' }}>
        내보내기
      </div>
      <ul style={{ margin:0, padding:0, listStyle:'none',
        display:'flex', flexDirection:'column', gap:8 }}>
        <PActionItem label="거래 내역 CSV" icon={<DownloadIcon/>} />
        <PActionItem label="포트폴리오 리포트 CSV" icon={<DownloadIcon/>} />
      </ul>
    </div>

    <div style={{ marginTop:14 }}>
      <PActionItem variant="danger" label="새 항해 시작" icon={
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
          <path d="M2.5 7a4.5 4.5 0 1 0 1.3-3.2 M4 1.5V4H1.5" stroke="currentColor"
            strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        </svg>
      } />
    </div>
  </section>
);

const DownloadIcon = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
    <path d="M3 9v2.5h8V9 M7 2v8 M4 7l3 3 3-3" stroke="currentColor"
      strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
);

const PActionItem = ({ label, icon, variant, href }) => {
  const base = {
    width:'100%', padding:'12px 14px', borderRadius:10,
    fontFamily:'inherit', fontSize:13, fontWeight:600,
    cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between',
    transition:'background .15s, border-color .15s', textDecoration:'none',
  };
  const styles = variant === 'primary' ? {
    ...base,
    background:'linear-gradient(180deg, var(--accent-glow), var(--accent))',
    color:'#fff', border:0,
    boxShadow:'0 6px 14px -8px rgba(60,120,255,.5)',
  } : variant === 'danger' ? {
    ...base,
    background:'transparent', border:'1px solid rgba(239,77,77,.32)',
    color:'var(--up)',
  } : {
    ...base,
    background:'var(--bg-2)', border:'1px solid var(--line)',
    color:'var(--ink-0)',
  };
  const C = href ? 'a' : 'button';
  return (
    <li>
      <C href={href} style={styles}>
        <span style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
          {icon}
          {label}
        </span>
        <span style={{ fontSize:14, opacity:.7 }}>{variant === 'danger' ? '↻' : '›'}</span>
      </C>
    </li>
  );
};

/* ============================================================ */
/* Mock data                                                      */
/* ============================================================ */
function genTrend(initial, target, steps, seed, noise = 0.012) {
  let h = seed;
  const out = [];
  let v = initial;
  const drift = (target - initial) / steps;
  for (let i = 0; i <= steps; i++) {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    const n = ((h % 1000) - 500) / 500;
    v += drift + n * (initial * noise);
    out.push(v);
  }
  return out;
}

const TREND_DATA = (() => {
  const initial = 10_000_000;
  const finalP = 9_643_148;
  const port = genTrend(initial, finalP, 30, 12345, 0.008);
  // KOSPI benchmark — different shape, ends roughly flat
  const kospi = genTrend(initial, 9_950_000, 30, 67890, 0.012);
  // percent versions
  const portPct  = port.map(v => ((v - initial) / initial) * 100);
  const kospiPct = kospi.map(v => ((v - initial) / initial) * 100);
  return { portfolio: port, kospi, portfolioPct: portPct, kospiPct };
})();

/* ============================================================ */
/* APP                                                            */
/* ============================================================ */
function VirtPortfolioApp() {
  const cash = 7_000_001;
  const holdings = [
    { sym:'BTC', name:'비트코인', strategy:'골든크로스 추종 전략',
      qty:'0.0083325개', value:898_235, dPct:-10.09, pnlAbs:-100_765 },
    { sym:'ETH', name:'이더리움', strategy:'골든크로스 추종 전략',
      qty:'0.29723326개', value:869_407, dPct:-12.97, pnlAbs:-129_594 },
    { sym:'SOL', name:'솔라나',   strategy:'골든크로스 추종 전략',
      qty:'7.35100072개', value:875_504, dPct:-12.38, pnlAbs:-123_497 },
  ];
  const equity = holdings.reduce((s, h) => s + h.value, 0);
  const total = cash + equity;
  const pnlAbs = -356_852;
  const pnlPct = -3.57;

  const trades = [
    { time:'05.27 14:23', side:'sell', sym:'SOL', name:'솔라나',   qty:'2',        price:118_300 },
    { time:'05.27 11:08', side:'buy',  sym:'BTC', name:'비트코인', qty:'0.001',    price:91_200_000 },
    { time:'05.26 10:42', side:'buy',  sym:'ETH', name:'이더리움', qty:'0.05',     price:3_350_000 },
  ];

  const allocItems = [
    { label:'현금',     value:cash,             color:ASSET_COLORS.cash },
    { label:'비트코인', value:holdings[0].value, color:ASSET_COLORS.BTC },
    { label:'이더리움', value:holdings[1].value, color:ASSET_COLORS.ETH },
    { label:'솔라나',   value:holdings[2].value, color:ASSET_COLORS.SOL },
  ];

  return (
    <>
      <VirtNav active="포트폴리오" />
      <PortfolioCrumb />
      <PortfolioHero name="김병하" total={total} profit={pnlAbs}
        ret={pnlPct} capital={10_000_000} />

      <main style={{ padding:'24px 32px 80px',
        display:'grid',
        gridTemplateColumns:'minmax(0, 1.55fr) minmax(280px, 1fr)',
        gap:24, alignItems:'start' }}>
        {/* LEFT */}
        <div style={{ display:'flex', flexDirection:'column', gap:20, minWidth:0 }}>
          <AssetTrendCard data={TREND_DATA} />
          <AssetAllocationCard items={allocItems} total={total} />
          <HoldingsTradesCard holdings={holdings} trades={trades} />
        </div>

        {/* RIGHT */}
        <div style={{ display:'flex', flexDirection:'column', gap:20,
          position:'sticky', top:96 }}>
          <PortfolioInvestmentSummary cash={cash} equity={equity} total={total}
            pnlAbs={pnlAbs} pnlPct={pnlPct} />
          <SailingStrategyDetail
            name="골든크로스 추종 전략"
            invested={2_997_002}
            pnlAbs={-353_855}
            pnlPct={-11.81}
            breakdown={[
              { sym:'BTC', pct:-10.1 },
              { sym:'ETH', pct:-13.0 },
              { sym:'SOL', pct:-12.4 },
            ]}
          />
          <PortfolioQuickActions />
        </div>
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

ReactDOM.createRoot(document.getElementById('root')).render(<VirtPortfolioApp />);
