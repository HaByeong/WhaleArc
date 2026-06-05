/* backtest-light-app.jsx — strategy detail + result view + runner + App */

const pct = (n) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
const fmtN = (n) => n.toLocaleString('ko-KR');

/* ============================================================ */
/* Strategy Detail (selected, before running)                    */
/* ============================================================ */
const Callout = ({ icon, title, body, color, bg, border }) => (
  <div style={{ padding:'14px 16px', borderRadius:10, background:bg,
    border:`1px solid ${border}`, display:'grid',
    gridTemplateColumns:'auto 1fr', gap:14, alignItems:'flex-start' }}>
    <span style={{ fontSize:16, lineHeight:'20px' }}>{icon}</span>
    <div>
      <div style={{ fontSize:12, color, letterSpacing:'.06em', fontWeight:700,
        marginBottom:4 }}>{title}</div>
      <div style={{ fontSize:13, color:'var(--ink-1)', lineHeight:1.55 }}>{body}</div>
    </div>
  </div>
);

const ConditionCard = ({ side, title, cond }) => {
  const c = side === 'buy' ? 'var(--up)' : 'var(--down)';
  const bg = side === 'buy' ? 'rgba(22,163,74,.10)' : 'rgba(239,68,68,.10)';
  const border = side === 'buy' ? 'rgba(22,163,74,.24)' : 'rgba(239,68,68,.24)';
  return (
    <div style={{ ...lt_card, padding:'20px 22px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
        <span style={{ width:8, height:8, borderRadius:'50%', background:c }}/>
        <span style={{ fontSize:13, fontWeight:700 }}>{title}</span>
      </div>
      <div style={{ padding:'12px 14px', borderRadius:10, background:bg,
        border:`1px solid ${border}`, fontSize:13.5, color:'var(--ink-0)' }}>
        <span className="mono" style={{ color:c, fontWeight:600 }}>{cond}</span>
        <span style={{ marginLeft:8, padding:'2px 8px', borderRadius:5,
          fontSize:11, fontWeight:700, background:c, color:'#fff',
          letterSpacing:'.04em' }}>{side === 'buy' ? '매수' : '매도'}</span>
      </div>
    </div>
  );
};

const StrategyDetail = ({ strategy }) => {
  const lvl = LEVEL_META[strategy.level];
  return (
    <section style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <div style={{ ...lt_card, padding:'26px 30px',
        position:'relative', overflow:'hidden' }}>
        <div aria-hidden style={{ position:'absolute', left:0, top:0, bottom:0, width:3,
          background:'linear-gradient(180deg, var(--accent), var(--accent-glow))' }}/>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between',
          gap:16, flexWrap:'wrap' }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', gap:6, marginBottom:10 }}>
              <span style={tagL('var(--accent)', 'var(--accent-bg)', 'rgba(91,157,255,.24)')}>기본</span>
              <span style={tagL(lvl.color, lvl.bg, lvl.border)}>{lvl.label}</span>
              <span style={tagL('var(--ink-2)', 'var(--bg-2)', 'var(--line)')}>
                조건 {strategy.nCond}개
              </span>
            </div>
            <h2 style={{ margin:0, fontSize:24, fontWeight:700, letterSpacing:'-.015em' }}>
              {strategy.name}
            </h2>
            <p style={{ margin:'10px 0 0', fontSize:14.5, color:'var(--ink-1)', lineHeight:1.6 }}>
              {strategy.long}
            </p>
          </div>
        </div>
        <div style={{ marginTop:20, display:'flex', flexDirection:'column', gap:10 }}>
          <Callout icon="💡" title="쉽게 이해하기" body={strategy.easy}
            color="#946800" bg="#fff8e1" border="#f0d97a"/>
          <Callout icon="🧭" title="왜 이 전략을 쓸까요?" body={strategy.why}
            color="var(--accent)" bg="var(--accent-bg)" border="rgba(91,157,255,.20)"/>
        </div>
      </div>
      <div style={{ display:'grid',
        gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:14 }}>
        <ConditionCard side="buy"  title="매수 조건 (진입)" cond={strategy.buyCond} />
        <ConditionCard side="sell" title="매도 조건 (청산)" cond={strategy.sellCond} />
      </div>
      <div style={{ padding:'14px 18px', borderRadius:10,
        background:'var(--accent-bg)',
        border:'1px solid rgba(91,157,255,.20)',
        display:'flex', alignItems:'center', gap:12 }}>
        <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--accent)',
          animation:'pulse-dot 1.6s ease-in-out infinite' }}/>
        <span style={{ fontSize:13, color:'var(--ink-1)' }}>
          오른쪽 패널에서 종목과 기간을 설정한 뒤 <strong style={{ color:'var(--ink-0)' }}>백테스트 실행</strong>을 눌러보세요.
        </span>
      </div>
    </section>
  );
};

/* ============================================================ */
/* Data simulators                                                */
/* ============================================================ */
function genPriceSeries(seed, n) {
  const out = []; let h = seed; let p = 95_000_000;
  for (let i = 0; i < n; i++) {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    const noise = ((h % 1000) - 500) / 500;
    const drift = -0.0007 + Math.sin(i / 38) * 0.003;
    p = p * (1 + drift + noise * 0.018);
    out.push(Math.max(60_000_000, p));
  }
  return out;
}

function genTrades(series, target) {
  const points = [];
  for (let i = 5; i < series.length-5; i++) {
    if (series[i] < series[i-3] && series[i] < series[i+3]) points.push({ idx:i, kind:'dip' });
    if (series[i] > series[i-3] && series[i] > series[i+3]) points.push({ idx:i, kind:'top' });
  }
  points.sort((a,b) => a.idx - b.idx);
  const out = []; let want = 'dip';
  for (const x of points) {
    if (x.kind === want) {
      out.push({ idx:x.idx, side: want === 'dip' ? 'buy' : 'sell', pnl:0, pnlPct:0 });
      want = want === 'dip' ? 'top' : 'dip';
      if (out.length >= target * 2) break;
    }
  }
  for (let i = 0; i < out.length; i += 2) {
    if (out[i] && out[i+1]) {
      const r = (series[out[i+1].idx] - series[out[i].idx]) / series[out[i].idx];
      out[i].pnl = r; out[i].pnlPct = r * 100;
      out[i+1].pnl = r; out[i+1].pnlPct = r * 100;
    }
  }
  return out;
}

function simEquity(series, trades, capital) {
  let cash = capital, qty = 0, tIdx = 0;
  const eq = [];
  for (let i = 0; i < series.length; i++) {
    while (tIdx < trades.length && trades[tIdx].idx === i) {
      const t = trades[tIdx];
      if (t.side === 'buy' && cash > 0) { qty = (cash * 0.999) / series[i]; cash = 0; }
      else if (t.side === 'sell' && qty > 0) { cash = qty * series[i] * 0.999; qty = 0; }
      tIdx++;
    }
    eq.push(cash + qty * series[i]);
  }
  return eq;
}

function simBH(series, capital) {
  const qty = (capital * 0.999) / series[0];
  return series.map(p => qty * p);
}

function maxDD(eq) {
  let peak = eq[0], m = 0;
  for (const v of eq) { if (v > peak) peak = v; const dd = (peak - v) / peak * 100; if (dd > m) m = dd; }
  return m;
}

function sharpe(eq) {
  const r = [];
  for (let i = 1; i < eq.length; i++) r.push((eq[i] - eq[i-1]) / eq[i-1]);
  const mean = r.reduce((s,v)=>s+v, 0) / r.length;
  const std = Math.sqrt(r.reduce((s,v)=>s+(v-mean)*(v-mean), 0) / r.length);
  return std === 0 ? 0 : (mean / std) * Math.sqrt(252);
}

/* Charts */
const PriceTradesChart = ({ series, trades }) => {
  const W = 880, H = 260;
  const padL = 8, padR = 56, padT = 12, padB = 28;
  const innerW = W - padL - padR; const innerH = H - padT - padB;
  const max = Math.max(...series), min = Math.min(...series);
  const range = max - min;
  const yP = p => padT + ((max - p) / range) * innerH;
  const xP = i => padL + (i / (series.length-1)) * innerW;
  const path = 'M ' + series.map((p,i) => `${xP(i)} ${yP(p)}`).join(' L ');
  const fillPath = path + ` L ${xP(series.length-1)} ${padT+innerH} L ${padL} ${padT+innerH} Z`;
  const ticks = [0,.25,.5,.75,1].map(t => min + (1-t)*range);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ display:'block' }}>
      <defs>
        <linearGradient id="lpfill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#4d8aff" stopOpacity=".18"/>
          <stop offset="100%" stopColor="#4d8aff" stopOpacity="0"/>
        </linearGradient>
      </defs>
      {ticks.map((t,i) => (
        <g key={i}>
          <line x1={padL} x2={W-padR} y1={yP(t)} y2={yP(t)} stroke="rgba(14,25,54,.05)" strokeWidth="1"/>
          <text x={W-padR+6} y={yP(t)+4} fill="var(--ink-2)" fontSize="10"
            fontFamily="JetBrains Mono, monospace">{(t/1e6).toFixed(1)}M</text>
        </g>
      ))}
      <path d={fillPath} fill="url(#lpfill)"/>
      <path d={path} stroke="var(--accent)" strokeWidth="1.4" fill="none"
        vectorEffect="non-scaling-stroke"/>
      {trades.map((t,i) => {
        const isBuy = t.side === 'buy';
        return (
          <g key={i}>
            <circle cx={xP(t.idx)} cy={yP(series[t.idx])} r="6"
              fill={isBuy ? '#16a34a' : '#ef4444'} opacity=".25"/>
            <circle cx={xP(t.idx)} cy={yP(series[t.idx])} r="3.5"
              fill={isBuy ? '#16a34a' : '#ef4444'}
              stroke="#fff" strokeWidth="1.2"/>
          </g>
        );
      })}
    </svg>
  );
};

const EquityChart = ({ equity, benchmark, capital }) => {
  const W = 880, H = 220;
  const padL = 8, padR = 56, padT = 12, padB = 28;
  const innerW = W - padL - padR; const innerH = H - padT - padB;
  const all = [...equity, ...benchmark, capital];
  const max = Math.max(...all), min = Math.min(...all);
  const range = (max - min) || 1;
  const yP = p => padT + ((max - p) / range) * innerH;
  const xP = i => padL + (i / (equity.length-1)) * innerW;
  const ep = 'M ' + equity.map((p,i) => `${xP(i)} ${yP(p)}`).join(' L ');
  const bp = 'M ' + benchmark.map((p,i) => `${xP(i)} ${yP(p)}`).join(' L ');
  const ticks = [0,.33,.66,1].map(t => min + (1-t)*range);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ display:'block' }}>
      {ticks.map((t,i) => (
        <g key={i}>
          <line x1={padL} x2={W-padR} y1={yP(t)} y2={yP(t)} stroke="rgba(14,25,54,.05)" strokeWidth="1"/>
          <text x={W-padR+6} y={yP(t)+4} fill="var(--ink-2)" fontSize="10"
            fontFamily="JetBrains Mono, monospace">{(t/1e6).toFixed(0)}M</text>
        </g>
      ))}
      <line x1={padL} x2={W-padR} y1={yP(capital)} y2={yP(capital)}
        stroke="rgba(14,25,54,.2)" strokeDasharray="4 4" strokeWidth=".8"/>
      <path d={bp} stroke="#d97706" strokeWidth="1.3" fill="none"
        strokeDasharray="4 3" vectorEffect="non-scaling-stroke"/>
      <path d={ep} stroke="var(--accent)" strokeWidth="1.6" fill="none"
        vectorEffect="non-scaling-stroke"/>
    </svg>
  );
};

/* ============================================================ */
/* Result View                                                    */
/* ============================================================ */
const KPI = ({ label, value, sub, color }) => (
  <div style={{ ...lt_card, padding:'20px 22px' }}>
    <div style={{ fontSize:11.5, color:'var(--ink-2)', letterSpacing:'.12em',
      fontWeight:600, whiteSpace:'nowrap' }}>{label}</div>
    <div className="mono" style={{ marginTop:10, fontSize:26, fontWeight:700,
      letterSpacing:'-.02em',
      color: color || 'var(--ink-0)', whiteSpace:'nowrap' }}>{value}</div>
    {sub && <div style={{ marginTop:6, fontSize:12, color:'var(--ink-3)',
      whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{sub}</div>}
  </div>
);

const Metric = ({ label, value, color }) => (
  <div style={{ padding:'14px 16px', borderRadius:10,
    background:'var(--bg-2)', border:'1px solid var(--line)', minWidth:0 }}>
    <div style={{ fontSize:11, color:'var(--ink-2)', letterSpacing:'.08em',
      whiteSpace:'nowrap', marginBottom:6 }}>{label}</div>
    <div className="mono" style={{ fontSize:'clamp(15px, 1.9vw, 19px)', fontWeight:700,
      color: color || 'var(--ink-0)', whiteSpace:'nowrap' }}>{value}</div>
  </div>
);

const Pill = ({ children, color, mono }) => (
  <span className={mono ? 'mono' : ''} style={{
    padding:'4px 10px', borderRadius:6, fontSize:12.5, fontWeight:700,
    background: color ? color : 'var(--bg-2)',
    color: color ? '#fff' : 'var(--ink-1)',
    border: color ? 'none' : '1px solid var(--line)',
    letterSpacing:'.02em' }}>{children}</span>
);

const LegDot = ({ c, l, dashed }) => (
  <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
    <span style={{ width:14, height:2,
      borderTop: dashed ? `2px dashed ${c}` : `2px solid ${c}`,
      display:'inline-block' }}/>{l}
  </span>
);

const ResultView = ({ strategy, ticker, period, capital }) => {
  const seed = React.useMemo(() => {
    let h = 11; const k = strategy.id + ticker;
    for (const c of k) h = (h*31 + c.charCodeAt(0)) & 0x7fffffff;
    return h;
  }, [strategy.id, ticker]);

  const series = React.useMemo(() => genPriceSeries(seed, 240), [seed]);
  const trades = React.useMemo(() => genTrades(series, 6), [series]);
  const equity = React.useMemo(() => simEquity(series, trades, capital), [series, trades, capital]);
  const buyhold = React.useMemo(() => simBH(series, capital), [series, capital]);

  const totalRet = ((equity[equity.length-1] - capital) / capital) * 100;
  const dd = maxDD(equity);
  const wins = trades.filter(t => t.pnl > 0).length;
  const wr = trades.length ? (wins / trades.length) * 100 : 0;
  const sh = sharpe(equity);
  const lossy = totalRet < 0;

  return (
    <section style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <div style={{ ...lt_card, padding:'22px 26px',
        position:'relative', overflow:'hidden' }}>
        <div aria-hidden style={{ position:'absolute', left:0, top:0, bottom:0, width:3,
          background:'linear-gradient(180deg, var(--accent), var(--accent-glow))' }}/>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start',
          gap:16, flexWrap:'wrap' }}>
          <div style={{ flex:1, minWidth:0 }}>
            <h2 style={{ margin:0, fontSize:22, fontWeight:700,
              letterSpacing:'-.01em' }}>{strategy.name}</h2>
            <p style={{ margin:'6px 0 0', fontSize:13, color:'var(--ink-1)' }}>{strategy.long}</p>
          </div>
          <span style={{
            padding:'8px 14px', borderRadius:8, fontSize:13.5, fontWeight:700,
            background: lossy ? 'rgba(239,68,68,.10)' : 'rgba(22,163,74,.10)',
            border: lossy ? '1px solid rgba(239,68,68,.28)' : '1px solid rgba(22,163,74,.28)',
            color: lossy ? 'var(--down)' : 'var(--up)',
            whiteSpace:'nowrap' }}>
            {lossy ? '손실' : '수익'} {totalRet >= 0 ? '+' : ''}{totalRet.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* test summary */}
      <div style={{ ...lt_card, padding:'22px 26px' }}>
        <h3 style={{ margin:'0 0 14px', fontSize:14.5, fontWeight:700 }}>테스트 요약</h3>
        <dl style={{ margin:0, display:'grid',
          gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))',
          rowGap:14, columnGap:32, fontSize:13.5 }}>
          {[
            ['전략', strategy.name, false],
            ['종목', ticker, true],
            ['기간', period, true],
            ['투자금', `${fmtN(capital)}원`, true],
            ['매매방향', '롱', true],
            ['수수료', '0.1%', true],
          ].map(([l,v,m]) => (
            <div key={l} style={{ display:'flex', justifyContent:'space-between',
              alignItems:'baseline', gap:12, paddingBottom:6,
              borderBottom:'1px dotted var(--line)' }}>
              <dt style={{ fontSize:12, color:'var(--ink-2)', letterSpacing:'.04em',
                whiteSpace:'nowrap' }}>{l}</dt>
              <dd className={m ? 'mono' : ''} style={{ margin:0, fontWeight:600,
                textAlign:'right', overflow:'hidden', textOverflow:'ellipsis',
                whiteSpace:'nowrap', minWidth:0 }}>{v}</dd>
            </div>
          ))}
        </dl>
        <div style={{ marginTop:18, padding:'14px 16px', borderRadius:10,
          background:'var(--bg-2)', border:'1px solid var(--line)',
          display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', fontSize:13 }}>
          <Pill mono>{strategy.buyCond}</Pill>
          <span style={{ color:'var(--ink-2)' }}>→</span>
          <Pill color="var(--up)">매수</Pill>
          <span style={{ color:'var(--ink-3)', margin:'0 4px' }}>/</span>
          <Pill mono>{strategy.sellCond}</Pill>
          <span style={{ color:'var(--ink-2)' }}>→</span>
          <Pill color="var(--down)">매도</Pill>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid',
        gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:14 }}>
        <KPI label="기대 수익률" value={pct(totalRet)}
          sub={`CAGR ${pct(totalRet)}`}
          color={lossy ? 'var(--down)' : 'var(--up)'}/>
        <KPI label="최대 낙폭 (MDD)" value={pct(-dd)}
          sub={`기간 ${Math.floor(series.length*0.45)}일`} color="var(--down)"/>
        <KPI label="승률" value={`${wr.toFixed(1)}%`}
          sub={`${trades.length}회 거래`} color="var(--accent)"/>
        <KPI label="샤프 비율" value={sh.toFixed(2)}
          sub={sh >= 1 ? '양호' : sh >= 0 ? '낮음' : '개선 필요'}
          color={sh >= 0 ? 'var(--accent)' : 'var(--down)'}/>
      </div>

      {/* price chart */}
      <div style={{ ...lt_card, padding:'22px 24px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline',
          marginBottom:8, flexWrap:'wrap', gap:8 }}>
          <h3 style={{ margin:0, fontSize:14.5, fontWeight:700 }}>가격 차트 & 매매 포인트</h3>
          <div style={{ display:'flex', gap:14, fontSize:11, color:'var(--ink-2)' }}>
            <LegDot c="var(--up)" l="매수"/>
            <LegDot c="var(--down)" l="매도"/>
          </div>
        </div>
        <div style={{ height:260, marginTop:14 }}>
          <PriceTradesChart series={series} trades={trades}/>
        </div>
      </div>

      {/* equity chart */}
      <div style={{ ...lt_card, padding:'22px 24px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline',
          marginBottom:8, flexWrap:'wrap', gap:8 }}>
          <h3 style={{ margin:0, fontSize:14.5, fontWeight:700 }}>자산 변동 추이</h3>
          <div style={{ display:'flex', gap:14, fontSize:11, color:'var(--ink-2)' }}>
            <LegDot c="var(--accent)" l="전략"/>
            <LegDot c="#d97706" l="Buy & Hold" dashed/>
          </div>
        </div>
        <div style={{ height:220, marginTop:14 }}>
          <EquityChart equity={equity} benchmark={buyhold} capital={capital}/>
        </div>
      </div>

      {/* detail metrics */}
      <div style={{ ...lt_card, padding:'22px 24px' }}>
        <h3 style={{ margin:'0 0 16px', fontSize:14.5, fontWeight:700 }}>상세 성과 지표</h3>
        <div style={{ display:'grid',
          gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:14 }}>
          <Metric label="총 수익률" value={pct(totalRet)}
            color={lossy ? 'var(--down)' : 'var(--up)'}/>
          <Metric label="최종 자산" value={`₩${fmtN(Math.round(equity[equity.length-1]))}`}/>
          <Metric label="CAGR" value={pct(totalRet)}/>
          <Metric label="Profit Factor" value="0.24"/>
          <Metric label="평균 보유 기간" value={`${Math.floor(series.length / Math.max(1, trades.length))}일`}/>
          <Metric label="최대 수익 거래" value={pct(Math.max(...trades.map(t => t.pnlPct), 0))}
            color="var(--up)"/>
          <Metric label="최대 손실 거래" value={pct(Math.min(...trades.map(t => t.pnlPct), 0))}
            color="var(--down)"/>
          <Metric label="총 거래 비용" value={`₩${fmtN(Math.round(trades.length * capital * 0.001))}`}/>
        </div>
      </div>
    </section>
  );
};

/* ============================================================ */
/* Runner panel (right)                                           */
/* ============================================================ */
const RunnerLabel = ({ children }) => (
  <span style={{ fontSize:11.5, color:'var(--ink-2)', letterSpacing:'.06em',
    fontWeight:600 }}>{children}</span>
);

const BacktestRunner = ({ strategy, onRun, ticker, setTicker, period, setPeriod, capital, setCapital }) => {
  const periods = [['6M','6개월'],['1Y','1년'],['2Y','2년'],['3Y','3년'],['5Y','5년']];
  const quickCaps = [[1_000_000,'100만'],[5_000_000,'500만'],[10_000_000,'1000만'],[50_000_000,'5000만']];
  const tickers = [['BTC','비트코인'],['005930','삼성전자'],['NVDA','엔비디아']];
  const canRun = !!strategy && !!ticker;

  return (
    <aside style={{ display:'flex', flexDirection:'column', gap:14,
      position:'sticky', top:96 }}>
      <div style={{
        position:'relative', overflow:'hidden', padding:'18px 22px', borderRadius:14,
        background:'linear-gradient(135deg, var(--accent-bg-strong), var(--accent-bg))',
        border:'1px solid rgba(91,157,255,.30)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ width:30, height:30, borderRadius:8,
            background:'var(--accent-bg-strong)', color:'var(--accent)',
            display:'flex', alignItems:'center', justifyContent:'center',
            border:'1px solid rgba(91,157,255,.32)' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <polygon points="3,2 12,7 3,12" fill="currentColor"/>
            </svg>
          </span>
          <div>
            <div style={{ fontSize:13.5, fontWeight:700 }}>백테스트 실행</div>
            <div style={{ fontSize:11, color:'var(--ink-2)', marginTop:2 }}>
              {strategy ? `— ${strategy.name}` : '왼쪽 라이브러리에서 전략을 선택하세요'}
            </div>
          </div>
        </div>
      </div>
      {strategy && (
        <div style={{ ...lt_card, padding:'14px 16px' }}>
          <div style={{ fontSize:13.5, fontWeight:700, marginBottom:4 }}>{strategy.name}</div>
          <div style={{ fontSize:11.5, color:'var(--ink-2)' }}>진입 1개 · 청산 1개 조건</div>
        </div>
      )}
      <div style={{ ...lt_card, padding:'16px 18px' }}>
        <RunnerLabel>종목 검색</RunnerLabel>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:8 }}>
          {tickers.map(([k,l]) => {
            const isOn = ticker === k;
            return (
              <button key={k} onClick={() => setTicker(k)} style={{
                padding:'6px 11px', borderRadius:8, fontSize:12, fontWeight:600,
                border: isOn ? '1px solid rgba(91,157,255,.40)' : '1px solid var(--line)',
                background: isOn ? 'var(--accent-bg)' : 'var(--bg-1)',
                color: isOn ? 'var(--accent)' : 'var(--ink-1)',
                cursor:'pointer', fontFamily:'inherit',
                display:'inline-flex', alignItems:'center', gap:6 }}>
                <span style={{ width:6, height:6, borderRadius:'50%',
                  background: isOn ? 'var(--accent)' : 'var(--ink-3)' }}/>
                {l}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ ...lt_card, padding:'16px 18px' }}>
        <RunnerLabel>분석 기간</RunnerLabel>
        <div style={{ marginTop:8, display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:6 }}>
          {periods.map(([k,l]) => (
            <button key={k} onClick={() => setPeriod(k)} style={{
              padding:'8px 0', borderRadius:8, fontSize:12, fontWeight:600,
              border: period === k ? '1px solid rgba(91,157,255,.40)' : '1px solid var(--line)',
              background: period === k ? 'var(--accent-bg)' : 'var(--bg-1)',
              color: period === k ? 'var(--accent)' : 'var(--ink-1)',
              cursor:'pointer', fontFamily:'inherit' }}>{l}</button>
          ))}
        </div>
        <div style={{ marginTop:12, display:'grid', gridTemplateColumns:'1fr 12px 1fr',
          alignItems:'center', gap:8 }}>
          <input type="date" defaultValue="2025-05-28" className="mono" style={dateInputSx}/>
          <span style={{ textAlign:'center', color:'var(--ink-3)' }}>–</span>
          <input type="date" defaultValue="2026-05-28" className="mono" style={dateInputSx}/>
        </div>
      </div>
      <div style={{ ...lt_card, padding:'16px 18px' }}>
        <RunnerLabel>초기 투자금</RunnerLabel>
        <input type="number" value={capital}
          onChange={e => setCapital(Number(e.target.value) || 0)}
          className="mono" style={{
            marginTop:8, width:'100%', padding:'10px 12px', borderRadius:8,
            border:'1px solid var(--line)', background:'var(--bg-1)', color:'var(--ink-0)',
            fontSize:15, fontWeight:700, outline:'none',
            fontFamily:'JetBrains Mono, monospace', textAlign:'right' }}/>
        <div style={{ marginTop:8, display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:6 }}>
          {quickCaps.map(([v,l]) => (
            <button key={v} onClick={() => setCapital(v)} style={{
              padding:'8px 0', borderRadius:8, fontSize:11.5, fontWeight:600,
              border: capital === v ? '1px solid rgba(91,157,255,.40)' : '1px solid var(--line)',
              background: capital === v ? 'var(--accent-bg)' : 'var(--bg-1)',
              color: capital === v ? 'var(--accent)' : 'var(--ink-1)',
              cursor:'pointer', fontFamily:'inherit' }}>{l}</button>
          ))}
        </div>
      </div>
      <button disabled={!canRun} onClick={onRun} style={{
        marginTop:4, padding:'14px 18px', borderRadius:10,
        border:0, cursor: canRun ? 'pointer' : 'not-allowed',
        fontFamily:'inherit', fontSize:14, fontWeight:700,
        background: canRun
          ? 'linear-gradient(180deg, var(--accent-glow), var(--accent))'
          : 'var(--bg-2)',
        color: canRun ? '#fff' : 'var(--ink-3)',
        boxShadow: canRun ? '0 10px 24px -10px rgba(60,120,255,.5)' : 'none',
        display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8 }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <polygon points="3,2 12,7 3,12" fill="currentColor"/>
        </svg>
        백테스트 실행
      </button>
      {!canRun && (
        <div style={{ textAlign:'center', fontSize:12, color:'var(--ink-3)' }}>
          {!strategy ? '전략을 선택해주세요' : '종목을 먼저 선택해주세요'}
        </div>
      )}
    </aside>
  );
};

const dateInputSx = {
  padding:'8px 10px', borderRadius:8,
  border:'1px solid var(--line)', background:'var(--bg-1)',
  color:'var(--ink-0)', fontSize:12.5, fontWeight:500, outline:'none',
  fontFamily:'JetBrains Mono, monospace', width:'100%',
};

/* ============================================================ */
/* App                                                            */
/* ============================================================ */
function App() {
  const [activeId, setActiveId] = React.useState(null);
  const [ticker, setTicker] = React.useState('BTC');
  const [period, setPeriod] = React.useState('1Y');
  const [capital, setCapital] = React.useState(10_000_000);
  const [hasResult, setHasResult] = React.useState(false);
  const strategy = STRATEGIES.find(s => s.id === activeId);
  return (
    <>
      <LtDashNav active="전략" />
      <main className="app-3col" style={{ padding:'24px 32px 80px' }}>
        <StrategyLibrary activeId={activeId}
          onPick={(id) => { setActiveId(id); setHasResult(false); }} />
        <div style={{ minWidth:0 }}>
          {!strategy && <EmptyHero/>}
          {strategy && !hasResult && <StrategyDetail strategy={strategy}/>}
          {strategy && hasResult && (
            <ResultView strategy={strategy} ticker={ticker}
              period="25.05.28 ~ 26.05.28" capital={capital}/>
          )}
        </div>
        <BacktestRunner strategy={strategy} onRun={() => setHasResult(true)}
          ticker={ticker} setTicker={setTicker}
          period={period} setPeriod={setPeriod}
          capital={capital} setCapital={setCapital}/>
      </main>
      <LtFooter />
    </>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
