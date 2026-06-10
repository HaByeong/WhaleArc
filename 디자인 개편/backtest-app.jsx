/* Backtest — result view + right panel + App */

/* ============================================================ */
/* RESULT VIEW                                                    */
/* ============================================================ */
const ResultView = ({ strategy, ticker, period, capital }) => {
  // generate seed-based price series
  const seed = React.useMemo(() => {
    let h = 11;
    const k = strategy.id + ticker;
    for (const c of k) h = (h*31 + c.charCodeAt(0)) & 0x7fffffff;
    return h;
  }, [strategy.id, ticker]);

  const series = React.useMemo(() => genPriceSeries(seed, 240), [seed]);
  const trades = React.useMemo(() => genTrades(series, 6), [series]);
  const equity = React.useMemo(() => simulateEquity(series, trades, capital), [series, trades, capital]);
  const buyhold = React.useMemo(() => simulateBuyhold(series, capital), [series, capital]);

  const totalReturn = ((equity[equity.length-1] - capital) / capital) * 100;
  const finalEquity = equity[equity.length-1];
  const maxDD = computeMaxDrawdown(equity);
  const wins = trades.filter(t => t.pnl > 0).length;
  const winRate = trades.length ? (wins / trades.length) * 100 : 0;
  const sharpe = computeSharpe(equity);
  const profitFactor = computeProfitFactor(trades);

  const lossy = totalReturn < 0;

  return (
    <section style={{ display:'flex', flexDirection:'column', gap:18 }}>
      {/* station header */}
      <StationBar
        title={strategy.name}
        sub={strategy.long}
        badge={
          <span style={{
            padding:'8px 14px', borderRadius:9, fontSize:13.5, fontWeight:700,
            flexShrink:0, whiteSpace:'nowrap',
            background:'rgba(255,255,255,.16)',
            border:'1px solid rgba(255,255,255,.34)',
            color:'rgba(255,255,255,.96)', display:'inline-flex', alignItems:'center', gap:8,
          }}>
            {lossy ? '손실' : '수익'} {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(2)}%
          </span>
        }
      />

      {/* test summary */}
      <TestSummaryCard
        strategy={strategy} ticker={ticker} period={period} capital={capital}
      />

      {/* KPI grid */}
      <div style={{ display:'grid',
        gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:14 }}>
        <KPI label="기대 수익률" value={pct(totalReturn)}
          sub={`CAGR ${pct(totalReturn)}`} color={lossy ? 'var(--down)' : 'var(--up)'}/>
        <KPI label="최대 낙폭 (MDD)" value={pct(-maxDD)}
          sub={`기간 ${Math.floor(series.length*0.45)}일`} color="var(--down)" tooltip/>
        <KPI label="승률" value={`${winRate.toFixed(1)}%`}
          sub={`${trades.length}회 거래`} color="#9cc1ff" tooltip/>
        <KPI label="샤프 비율" value={sharpe.toFixed(2)}
          sub={sharpe >= 1 ? '양호' : sharpe >= 0 ? '낮음' : '개선 필요'}
          color={sharpe >= 0 ? '#9cc1ff' : 'var(--down)'} tooltip/>
      </div>

      {/* price chart with trades */}
      <div style={{ ...mkCard, padding:'22px 24px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline',
          marginBottom:8 }}>
          <h3 style={{ margin:0, fontSize:14.5, fontWeight:700 }}>가격 차트 & 매매 포인트</h3>
          <div style={{ display:'flex', gap:14, fontSize:11, color:'var(--ink-2)' }}>
            <LegendDot c="#ef4d4d" l="매수"/>
            <LegendDot c="#4d8aff" l="매도"/>
          </div>
        </div>
        <div style={{ height:260, marginTop:14 }}>
          <PriceTradesChart series={series} trades={trades}/>
        </div>
      </div>

      {/* equity vs buy-hold */}
      <div style={{ ...mkCard, padding:'22px 24px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline',
          marginBottom:8 }}>
          <h3 style={{ margin:0, fontSize:14.5, fontWeight:700 }}>자산 변동 추이</h3>
          <div style={{ display:'flex', gap:14, fontSize:11, color:'var(--ink-2)' }}>
            <LegendDot c="#5b9dff" l="전략"/>
            <LegendDot c="#ffcd78" l="Buy & Hold"/>
          </div>
        </div>
        <div style={{ height:220, marginTop:14 }}>
          <EquityChart equity={equity} benchmark={buyhold} capital={capital}/>
        </div>
      </div>

      {/* detail metrics */}
      <div style={{ ...mkCard, padding:'22px 24px' }}>
        <h3 style={{ margin:'0 0 16px', fontSize:14.5, fontWeight:700 }}>상세 성과 지표</h3>
        <div style={{ display:'grid',
          gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:14 }}>
          <Metric label="총 수익률"       value={pct(totalReturn)} color={lossy?'var(--down)':'var(--up)'}/>
          <Metric label="최종 자산"       value={`₩${fmtNum(Math.round(finalEquity))}`}/>
          <Metric label="CAGR"            value={pct(totalReturn)} tooltip/>
          <Metric label="Profit Factor"   value={profitFactor.toFixed(2)} tooltip/>
          <Metric label="평균 보유 기간"   value={`${Math.floor(series.length / Math.max(1, trades.length))}일`}/>
          <Metric label="최대 수익 거래"   value={pct(Math.max(...trades.map(t => t.pnlPct), 0))} color="var(--up)"/>
          <Metric label="최대 손실 거래"   value={pct(Math.min(...trades.map(t => t.pnlPct), 0))} color="var(--down)"/>
          <Metric label="총 거래 비용"     value={`₩${fmtNum(Math.round(trades.length * capital * 0.001))}`}
            tooltip/>
        </div>
      </div>

      {/* trade log */}
      <TradeLog trades={trades} series={series}/>
    </section>
  );
};

const pct = (n) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%';

/* ============================================================ */
/* Test summary                                                   */
/* ============================================================ */
const TestSummaryCard = ({ strategy, ticker, period, capital }) => {
  return (
    <div style={{ ...mkCard, padding:'22px 26px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
        <span style={{
          width:32, height:32, borderRadius:8,
          background:'rgba(91,157,255,.12)',
          border:'1px solid rgba(91,157,255,.24)',
          color:'var(--accent-glow)',
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="2" y="3" width="10" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M2 5.5h10" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M5 8.5h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </span>
        <h3 style={{ margin:0, fontSize:14.5, fontWeight:700 }}>테스트 요약</h3>
      </div>

      <dl style={{ margin:0, display:'grid',
        gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))',
        rowGap:14, columnGap:32, fontSize:13.5 }}>
        <SumRow label="전략"     value={strategy.name} mono={false}/>
        <SumRow label="종목"     value={ticker}/>
        <SumRow label="기간"     value={period}/>
        <SumRow label="투자금"   value={`${fmtNum(capital)}원`}/>
        <SumRow label="매매방향" value="롱"/>
        <SumRow label="수수료"   value="0.1%"/>
      </dl>

      {/* condition pills */}
      <div style={{ marginTop:18, padding:'14px 16px', borderRadius:10,
        background:'rgba(255,255,255,.025)', border:'1px solid var(--line)',
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
  );
};

const SumRow = ({ label, value, mono = true }) => (
  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline',
    gap:12, paddingBottom:6, borderBottom:'1px dotted rgba(255,255,255,.08)' }}>
    <dt style={{ fontSize:12, color:'var(--ink-2)', letterSpacing:'.04em',
      whiteSpace:'nowrap' }}>{label}</dt>
    <dd className={mono ? 'mono' : ''} style={{ margin:0, fontWeight:600,
      textAlign:'right',
      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
      minWidth:0 }}>{value}</dd>
  </div>
);

const Pill = ({ children, color, mono }) => (
  <span className={mono ? 'mono' : ''} style={{
    padding:'4px 10px', borderRadius:6, fontSize:12.5, fontWeight:700,
    background: color ? color : 'rgba(255,255,255,.06)',
    color: color ? '#0a1230' : 'var(--ink-1)',
    border: color ? 'none' : '1px solid var(--line)',
    letterSpacing:'.02em',
  }}>{children}</span>
);

/* ============================================================ */
/* KPI + Metric                                                   */
/* ============================================================ */
const KPI = ({ label, value, sub, color, tooltip }) => (
  <div style={{ ...mkCard, padding:'20px 22px' }}>
    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
      <span style={{ fontSize:11.5, color:'var(--ink-2)', letterSpacing:'.12em',
        fontWeight:600, whiteSpace:'nowrap' }}>{label}</span>
      {tooltip && (
        <span style={{ width:14, height:14, borderRadius:'50%',
          border:'1px solid var(--line-strong)', color:'var(--ink-3)',
          display:'inline-flex', alignItems:'center', justifyContent:'center',
          fontSize:9.5, fontWeight:700, cursor:'help' }}>?</span>
      )}
    </div>
    <div className="mono" style={{ fontSize:30, fontWeight:700, letterSpacing:'-.02em',
      color: color || '#fff', whiteSpace:'nowrap' }}>{value}</div>
    {sub && (
      <div style={{ marginTop:6, fontSize:12, color:'var(--ink-3)', whiteSpace:'nowrap',
        overflow:'hidden', textOverflow:'ellipsis' }}>{sub}</div>
    )}
  </div>
);

const Metric = ({ label, value, color, tooltip }) => (
  <div style={{ padding:'14px 16px', borderRadius:10,
    background:'rgba(255,255,255,.02)', border:'1px solid var(--line)', minWidth:0 }}>
    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
      <span style={{ fontSize:11, color:'var(--ink-2)', letterSpacing:'.08em',
        whiteSpace:'nowrap' }}>{label}</span>
      {tooltip && (
        <span style={{ width:12, height:12, borderRadius:'50%',
          border:'1px solid var(--line-strong)', color:'var(--ink-3)',
          display:'inline-flex', alignItems:'center', justifyContent:'center',
          fontSize:8.5, fontWeight:700, cursor:'help' }}>?</span>
      )}
    </div>
    <div className="mono" style={{ fontSize:'clamp(15px, 1.9vw, 19px)', fontWeight:700,
      color: color || '#fff', whiteSpace:'nowrap' }}>{value}</div>
  </div>
);

/* ============================================================ */
/* Price+trades chart                                             */
/* ============================================================ */
const PriceTradesChart = ({ series, trades }) => {
  const W = 880, H = 260;
  const padL = 8, padR = 56, padT = 12, padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const max = Math.max(...series);
  const min = Math.min(...series);
  const range = max - min;
  const yP = (p) => padT + ((max - p) / range) * innerH;
  const xP = (i) => padL + (i / (series.length-1)) * innerW;

  const path = 'M ' + series.map((p, i) => `${xP(i)} ${yP(p)}`).join(' L ');
  const fillPath = path + ` L ${xP(series.length-1)} ${padT+innerH} L ${padL} ${padT+innerH} Z`;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => min + (1-t) * range);
  const xLabels = [];
  for (let i = 0; i < 10; i++) {
    const idx = Math.round((i / 9) * (series.length-1));
    const month = String(((idx % 12) + 6) % 12 + 1).padStart(2, '0');
    const day = String(((idx * 7) % 28) + 1).padStart(2, '0');
    xLabels.push({ x: xP(idx), label: `${month}-${day}` });
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ display:'block' }}>
      <defs>
        <linearGradient id="price-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#5b9dff" stopOpacity=".18"/>
          <stop offset="100%" stopColor="#5b9dff" stopOpacity="0"/>
        </linearGradient>
      </defs>

      {/* grid */}
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={padL} x2={W-padR} y1={yP(t)} y2={yP(t)}
            stroke="rgba(255,255,255,.05)" strokeWidth="1"/>
          <text x={W-padR+6} y={yP(t)+4}
            fill="rgba(255,255,255,.4)" fontSize="10"
            fontFamily="JetBrains Mono, monospace">
            {(t/1e6).toFixed(1)}M
          </text>
        </g>
      ))}

      <path d={fillPath} fill="url(#price-fill)"/>
      <path d={path} stroke="#5b9dff" strokeWidth="1.4" fill="none"
        vectorEffect="non-scaling-stroke"/>

      {/* trade markers */}
      {trades.map((t, i) => {
        const isBuy = t.side === 'buy';
        return (
          <g key={i}>
            <circle cx={xP(t.idx)} cy={yP(series[t.idx])} r="6"
              fill={isBuy ? '#ef4d4d' : '#4d8aff'} opacity=".25"/>
            <circle cx={xP(t.idx)} cy={yP(series[t.idx])} r="3.5"
              fill={isBuy ? '#ef4d4d' : '#4d8aff'}
              stroke="#0a1230" strokeWidth="1"/>
          </g>
        );
      })}

      {/* x labels */}
      {xLabels.map((l, i) => (
        <text key={i} x={l.x} y={H-8}
          fill="rgba(255,255,255,.4)" fontSize="10" textAnchor="middle"
          fontFamily="JetBrains Mono, monospace">{l.label}</text>
      ))}
    </svg>
  );
};

/* ============================================================ */
/* Equity chart                                                   */
/* ============================================================ */
const EquityChart = ({ equity, benchmark, capital }) => {
  const W = 880, H = 220;
  const padL = 8, padR = 56, padT = 12, padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const all = [...equity, ...benchmark, capital];
  const max = Math.max(...all);
  const min = Math.min(...all);
  const range = (max - min) || 1;
  const yP = (p) => padT + ((max - p) / range) * innerH;
  const xP = (i) => padL + (i / (equity.length-1)) * innerW;

  const eqPath = 'M ' + equity.map((p, i) => `${xP(i)} ${yP(p)}`).join(' L ');
  const bmPath = 'M ' + benchmark.map((p, i) => `${xP(i)} ${yP(p)}`).join(' L ');

  const ticks = [0, 0.33, 0.66, 1].map(t => min + (1-t) * range);
  // baseline (initial capital)
  const baseY = yP(capital);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ display:'block' }}>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={padL} x2={W-padR} y1={yP(t)} y2={yP(t)}
            stroke="rgba(255,255,255,.05)" strokeWidth="1"/>
          <text x={W-padR+6} y={yP(t)+4}
            fill="rgba(255,255,255,.4)" fontSize="10"
            fontFamily="JetBrains Mono, monospace">
            {(t/1e6).toFixed(0)}M
          </text>
        </g>
      ))}
      {/* capital baseline */}
      <line x1={padL} x2={W-padR} y1={baseY} y2={baseY}
        stroke="rgba(255,255,255,.25)" strokeDasharray="4 4" strokeWidth=".8"/>

      <path d={bmPath} stroke="#ffcd78" strokeWidth="1.3" fill="none"
        strokeDasharray="4 3" vectorEffect="non-scaling-stroke"/>
      <path d={eqPath} stroke="#5b9dff" strokeWidth="1.6" fill="none"
        vectorEffect="non-scaling-stroke"/>
    </svg>
  );
};

/* ============================================================ */
/* Trade log                                                      */
/* ============================================================ */
const TradeLog = ({ trades, series }) => {
  // Compute paired trade rows (buy → sell)
  const rows = [];
  for (let i = 0; i < trades.length; i++) {
    const t = trades[i];
    if (t.side === 'buy') {
      const exit = trades.slice(i+1).find(x => x.side === 'sell');
      if (exit) {
        const ret = ((series[exit.idx] - series[t.idx]) / series[t.idx]) * 100;
        rows.push({
          n: rows.length + 1,
          entryIdx: t.idx, exitIdx: exit.idx,
          entry: series[t.idx], exit: series[exit.idx],
          ret, days: exit.idx - t.idx,
        });
      }
    }
  }

  return (
    <div style={{ ...mkCard, padding:0 }}>
      <div style={{ padding:'18px 22px', borderBottom:'1px solid var(--line)',
        display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <h3 style={{ margin:0, fontSize:14.5, fontWeight:700 }}>거래 내역</h3>
        <span style={{ fontSize:11.5, color:'var(--ink-3)' }}>{rows.length}건</span>
      </div>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', minWidth:600 }}>
          <thead>
            <tr>
              {['#','진입일','청산일','진입가','청산가','수익률','보유일'].map(h => (
                <th key={h} style={{
                  textAlign:'left', padding:'12px 18px', fontSize:10.5,
                  color:'var(--ink-3)', letterSpacing:'.12em', fontWeight:600,
                  borderBottom:'1px solid var(--line)', textTransform:'uppercase',
                  whiteSpace:'nowrap',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const up = r.ret >= 0;
              return (
                <tr key={r.n}>
                  <td className="mono" style={tlTdSx}>{String(r.n).padStart(2,'0')}</td>
                  <td className="mono" style={tlTdSx}>{dayLabel(r.entryIdx)}</td>
                  <td className="mono" style={tlTdSx}>{dayLabel(r.exitIdx)}</td>
                  <td className="mono" style={tlTdSx}>{fmtNum(Math.round(r.entry))}</td>
                  <td className="mono" style={tlTdSx}>{fmtNum(Math.round(r.exit))}</td>
                  <td className="mono" style={{ ...tlTdSx,
                    color: up ? 'var(--up)' : 'var(--down)', fontWeight:700 }}>
                    {up?'+':''}{r.ret.toFixed(2)}%
                  </td>
                  <td className="mono" style={tlTdSx}>{r.days}일</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const tlTdSx = { padding:'12px 18px', fontSize:13, borderBottom:'1px solid var(--line)' };

const dayLabel = (idx) => {
  const month = String(((idx % 12) + 6) % 12 + 1).padStart(2, '0');
  const day = String(((idx * 7) % 28) + 1).padStart(2, '0');
  return `25.${month}.${day}`;
};

/* ============================================================ */
/* Data simulators                                                */
/* ============================================================ */
function genPriceSeries(seed, n) {
  const out = [];
  let h = seed;
  let p = 95000000;
  for (let i = 0; i < n; i++) {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    const noise = ((h % 1000) - 500) / 500;
    const drift = -0.0007 + Math.sin(i / 38) * 0.003;
    p = p * (1 + drift + noise * 0.018);
    out.push(Math.max(60000000, p));
  }
  return out;
}

function genTrades(series, target) {
  // pick alternating buy/sell at peaks/troughs roughly
  const sortedDips = [];
  for (let i = 5; i < series.length-5; i++) {
    if (series[i] < series[i-3] && series[i] < series[i+3])
      sortedDips.push({ idx: i, p: series[i], kind:'dip' });
    if (series[i] > series[i-3] && series[i] > series[i+3])
      sortedDips.push({ idx: i, p: series[i], kind:'top' });
  }
  // sort by idx
  sortedDips.sort((a,b) => a.idx - b.idx);
  // pick alternating starting at a dip
  const out = [];
  let want = 'dip';
  for (const x of sortedDips) {
    if (x.kind === want) {
      out.push({ idx: x.idx, side: want === 'dip' ? 'buy' : 'sell', pnl: 0, pnlPct: 0 });
      want = want === 'dip' ? 'top' : 'dip';
      if (out.length >= target * 2) break;
    }
  }
  // compute pnl per pair
  for (let i = 0; i < out.length; i += 2) {
    if (out[i].side === 'buy' && out[i+1] && out[i+1].side === 'sell') {
      const ret = (series[out[i+1].idx] - series[out[i].idx]) / series[out[i].idx];
      out[i].pnl = ret;   out[i].pnlPct = ret * 100;
      out[i+1].pnl = ret; out[i+1].pnlPct = ret * 100;
    }
  }
  return out;
}

function simulateEquity(series, trades, capital) {
  let cash = capital;
  let qty = 0;
  let tIdx = 0;
  const equity = [];
  for (let i = 0; i < series.length; i++) {
    while (tIdx < trades.length && trades[tIdx].idx === i) {
      const t = trades[tIdx];
      if (t.side === 'buy' && cash > 0) {
        qty = (cash * (1 - 0.001)) / series[i];
        cash = 0;
      } else if (t.side === 'sell' && qty > 0) {
        cash = qty * series[i] * (1 - 0.001);
        qty = 0;
      }
      tIdx++;
    }
    equity.push(cash + qty * series[i]);
  }
  return equity;
}

function simulateBuyhold(series, capital) {
  const qty = (capital * (1 - 0.001)) / series[0];
  return series.map(p => qty * p);
}

function computeMaxDrawdown(equity) {
  let peak = equity[0];
  let mdd = 0;
  for (const v of equity) {
    if (v > peak) peak = v;
    const dd = (peak - v) / peak * 100;
    if (dd > mdd) mdd = dd;
  }
  return mdd;
}

function computeSharpe(equity) {
  const rets = [];
  for (let i = 1; i < equity.length; i++) {
    rets.push((equity[i] - equity[i-1]) / equity[i-1]);
  }
  const mean = rets.reduce((s,r)=>s+r, 0) / rets.length;
  const variance = rets.reduce((s,r)=>s+(r-mean)*(r-mean), 0) / rets.length;
  const std = Math.sqrt(variance);
  return std === 0 ? 0 : (mean / std) * Math.sqrt(252);
}

function computeProfitFactor(trades) {
  let gp = 0, gl = 0;
  for (let i = 0; i < trades.length; i += 2) {
    if (!trades[i+1]) continue;
    const r = trades[i].pnl;
    if (r > 0) gp += r;
    else       gl += Math.abs(r);
  }
  return gl === 0 ? 99 : gp / gl;
}

/* ============================================================ */
/* RIGHT PANEL — Backtest runner                                  */
/* ============================================================ */
const BacktestRunner = ({ strategy, onRun, ticker, setTicker, period, setPeriod, capital, setCapital }) => {
  const periods = [
    ['6M','6개월'], ['1Y','1년'], ['2Y','2년'], ['3Y','3년'], ['5Y','5년'],
  ];
  const quickCaps = [
    [1_000_000,  '100만'],
    [5_000_000,  '500만'],
    [10_000_000, '1000만'],
    [50_000_000, '5000만'],
  ];
  const tickers = [
    ['BTC', '비트코인'], ['005930','삼성전자'], ['NVDA','엔비디아'],
  ];
  const canRun = !!strategy && !!ticker;

  return (
    <aside style={{ display:'flex', flexDirection:'column', gap:14,
      position:'sticky', top:96, alignSelf:'start' }}>
      {/* header */}
      <div style={{
        position:'relative', overflow:'hidden',
        padding:'16px 20px', borderRadius:14,
        background: BT_GRAD,
        border:'1px solid rgba(255,255,255,.14)',
        boxShadow:'0 10px 26px -12px rgba(20,130,170,.6), inset 0 1px 0 rgba(255,255,255,.22)',
      }}>
        <span aria-hidden style={{ position:'absolute', right:-30, top:-40, width:140, height:140,
          borderRadius:'50%', background:'radial-gradient(circle, rgba(255,255,255,.16), transparent 70%)',
          pointerEvents:'none' }}/>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{
            width:30, height:30, borderRadius:8, flexShrink:0,
            background:'rgba(255,255,255,.16)', color:'rgba(255,255,255,.96)',
            display:'flex', alignItems:'center', justifyContent:'center',
            border:'1px solid rgba(255,255,255,.3)',
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <polygon points="3,2 12,7 3,12" fill="currentColor"/>
            </svg>
          </span>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:13.5, fontWeight:700, color:'rgba(255,255,255,.96)' }}>백테스트 실행</div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,.82)', marginTop:2,
              whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {strategy ? `— ${strategy.name}` : '왼쪽 라이브러리에서 전략을 선택하세요'}
            </div>
          </div>
        </div>
      </div>

      {/* selected strategy */}
      {strategy && (
        <div style={{ ...mkCard, padding:'14px 16px' }}>
          <div style={{ fontSize:13.5, fontWeight:700, marginBottom:4 }}>
            {strategy.name}
          </div>
          <div style={{ fontSize:11.5, color:'var(--ink-2)' }}>
            진입 1개 · 청산 1개 조건
          </div>
        </div>
      )}

      {/* ticker search */}
      <div style={{ ...mkCard, padding:'16px 18px' }}>
        <Label>종목 검색</Label>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:8 }}>
          {tickers.map(([k,l]) => {
            const isOn = ticker === k;
            return (
              <button key={k} onClick={() => setTicker(k)} style={{
                padding:'6px 11px', borderRadius:8, fontSize:12, fontWeight:600,
                border: isOn ? '1px solid rgba(91,157,255,.32)' : '1px solid var(--line)',
                background: isOn ? 'rgba(91,157,255,.14)' : 'rgba(255,255,255,.025)',
                color: isOn ? '#fff' : 'var(--ink-1)',
                cursor:'pointer', fontFamily:'inherit',
                display:'inline-flex', alignItems:'center', gap:6,
              }}>
                <span style={{ width:6, height:6, borderRadius:'50%',
                  background: isOn ? 'var(--accent-glow)' : 'var(--ink-3)' }}/>
                {l}
              </button>
            );
          })}
        </div>
        {ticker && (
          <div style={{ marginTop:10, padding:'10px 12px', borderRadius:8,
            background:'rgba(91,157,255,.10)',
            border:'1px solid rgba(91,157,255,.28)',
            display:'flex', alignItems:'center', gap:8, fontSize:13, fontWeight:600 }}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ color:'var(--accent-glow)' }}>
              <path d="M2 7L6 11L12 3" stroke="currentColor" strokeWidth="1.6"
                strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {tickers.find(t => t[0] === ticker)?.[1]}({ticker})
            <span style={{ marginLeft:'auto', fontSize:11, padding:'2px 6px',
              borderRadius:5, background:'rgba(255,255,255,.06)',
              color:'var(--ink-1)', fontWeight:700, letterSpacing:'.04em' }}>{ticker}</span>
          </div>
        )}
      </div>

      {/* period */}
      <div style={{ ...mkCard, padding:'16px 18px' }}>
        <Label>분석 기간</Label>
        <div style={{ marginTop:8, display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:6 }}>
          {periods.map(([k,l]) => (
            <button key={k} onClick={() => setPeriod(k)} style={{
              padding:'8px 0', borderRadius:8, fontSize:12, fontWeight:600,
              border: period === k ? '1px solid rgba(91,157,255,.32)' : '1px solid var(--line)',
              background: period === k ? 'rgba(91,157,255,.18)' : 'rgba(255,255,255,.025)',
              color: period === k ? '#fff' : 'var(--ink-1)',
              cursor:'pointer', fontFamily:'inherit',
            }}>{l}</button>
          ))}
        </div>
        <div style={{ marginTop:12, display:'grid', gridTemplateColumns:'1fr 12px 1fr',
          alignItems:'center', gap:8 }}>
          <DateInput value="2025-05-28" label="시작일"/>
          <span style={{ textAlign:'center', color:'var(--ink-3)' }}>–</span>
          <DateInput value="2026-05-28" label="종료일"/>
        </div>
      </div>

      {/* capital */}
      <div style={{ ...mkCard, padding:'16px 18px' }}>
        <Label>초기 투자금</Label>
        <input
          type="number"
          value={capital}
          onChange={e => setCapital(Number(e.target.value) || 0)}
          className="mono"
          style={{
            marginTop:8, width:'100%', padding:'10px 12px',
            borderRadius:8, border:'1px solid var(--line)',
            background:'rgba(255,255,255,.025)', color:'#fff',
            fontSize:15, fontWeight:600, outline:'none',
            fontFamily:'JetBrains Mono, monospace', textAlign:'right',
          }}
        />
        <div style={{ marginTop:8, display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:6 }}>
          {quickCaps.map(([v,l]) => (
            <button key={v} onClick={() => setCapital(v)} style={{
              padding:'8px 0', borderRadius:8, fontSize:11.5, fontWeight:600,
              border: capital === v ? '1px solid rgba(91,157,255,.32)' : '1px solid var(--line)',
              background: capital === v ? 'rgba(91,157,255,.18)' : 'rgba(255,255,255,.025)',
              color: capital === v ? '#fff' : 'var(--ink-1)',
              cursor:'pointer', fontFamily:'inherit',
            }}>{l}</button>
          ))}
        </div>
        <label style={{ marginTop:12, display:'flex', alignItems:'center', gap:8,
          fontSize:12.5, color:'var(--ink-1)', cursor:'pointer' }}>
          <input type="checkbox" style={{ accentColor:'var(--accent)' }}/>
          적립식 투자 <span style={{ color:'var(--ink-3)' }}>(매월 첫 거래일)</span>
        </label>
      </div>

      {/* advanced */}
      <button style={{
        padding:'10px 14px', borderRadius:8, border:'1px solid var(--line)',
        background:'rgba(255,255,255,.025)', color:'var(--ink-1)',
        fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
        display:'flex', alignItems:'center', justifyContent:'space-between',
      }}>
        <span style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M2 7h10 M2 4h10 M2 10h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          고급 설정
        </span>
        <span style={{ color:'var(--ink-3)' }}>▾</span>
      </button>

      {/* run button */}
      <button disabled={!canRun} onClick={onRun} style={{
        marginTop:4, padding:'14px 18px', borderRadius:10,
        border:0, cursor: canRun ? 'pointer' : 'not-allowed',
        fontFamily:'inherit', fontSize:14, fontWeight:700,
        background: canRun
          ? 'linear-gradient(180deg, var(--accent-glow), var(--accent))'
          : 'rgba(255,255,255,.06)',
        color: canRun ? '#fff' : 'var(--ink-3)',
        boxShadow: canRun ? '0 10px 24px -10px rgba(60,120,255,.5)' : 'none',
        display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8,
        transition:'all .15s',
      }}>
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

      {/* previous results */}
      <button style={{
        padding:'12px 16px', borderRadius:8,
        border:'1px solid var(--line)', background:'rgba(255,255,255,.025)',
        color:'var(--ink-1)', fontSize:13, fontWeight:600,
        cursor:'pointer', fontFamily:'inherit',
        display:'flex', alignItems:'center', justifyContent:'space-between',
      }}>
        <span style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M7 4v3l2 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          이전 결과 <span style={{ color:'var(--ink-3)' }}>(2)</span>
        </span>
        <span style={{ color:'var(--ink-3)' }}>▾</span>
      </button>
    </aside>
  );
};

const Label = ({ children }) => (
  <span style={{ fontSize:11.5, color:'var(--ink-2)', letterSpacing:'.06em',
    fontWeight:600 }}>{children}</span>
);

const DateInput = ({ value, label }) => (
  <input
    type="date" defaultValue={value} aria-label={label}
    className="mono"
    style={{
      padding:'8px 10px', borderRadius:8,
      border:'1px solid var(--line)', background:'rgba(255,255,255,.025)',
      color:'#fff', fontSize:12.5, fontWeight:500, outline:'none',
      fontFamily:'JetBrains Mono, monospace', width:'100%',
    }}
  />
);

/* ============================================================ */
/* APP                                                            */
/* ============================================================ */
function BacktestApp() {
  const [activeId, setActiveId] = React.useState(null);
  const [ticker, setTicker] = React.useState('BTC');
  const [period, setPeriod] = React.useState('1Y');
  const [capital, setCapital] = React.useState(10_000_000);
  const [hasResult, setHasResult] = React.useState(false);

  const strategy = STRATEGIES.find(s => s.id === activeId);

  const handlePick = (id) => {
    setActiveId(id);
    setHasResult(false);
  };
  const handleRun = () => setHasResult(true);

  return (
    <>
      <SideNav active="strategy" />
      <SideShell>
      <main className="app-3col" style={{ padding:'24px 32px 80px', flex:'1 0 auto' }}>
        <StrategyLibrary activeId={activeId} onPick={handlePick} />

        <div style={{ minWidth:0 }}>
          {!strategy && <EmptyHero/>}
          {strategy && !hasResult && <StrategyDetail strategy={strategy}/>}
          {strategy && hasResult && (
            <ResultView strategy={strategy} ticker={ticker}
              period={`25.05.28 ~ 26.05.28`} capital={capital}/>
          )}
        </div>

        <BacktestRunner
          strategy={strategy} onRun={handleRun}
          ticker={ticker} setTicker={setTicker}
          period={period} setPeriod={setPeriod}
          capital={capital} setCapital={setCapital}
        />
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

ReactDOM.createRoot(document.getElementById('root')).render(<BacktestApp />);
