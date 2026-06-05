/* VIRT portfolio — main content components (hero, trend, donut, holdings) */

/* ============================================================ */
/* Asset color palette                                            */
/* ============================================================ */
const ASSET_COLORS = {
  cash: '#94a3b8',
  BTC:  '#f7931a',
  ETH:  '#627eea',
  SOL:  '#9945ff',
};
const ASSET_GLYPH = {
  BTC: { bg:'#f7931a', label:'₿', fg:'#fff' },
  ETH: { bg:'#627eea', label:'Ξ', fg:'#fff' },
  SOL: { bg:'#9945ff', label:'◎', fg:'#fff' },
};

/* ============================================================ */
/* Breadcrumb                                                     */
/* ============================================================ */
const PortfolioCrumb = () => (
  <section style={{ padding:'22px 32px 0' }}>
    <a href="virt.html" style={{
      display:'inline-flex', alignItems:'center', gap:6, fontSize:13,
      color:'var(--ink-1)', cursor:'pointer', fontWeight:500,
    }}>
      <span style={{ fontSize:14 }}>‹</span>
      대시보드
    </a>
  </section>
);

/* ============================================================ */
/* Hero — blue gradient with 4 stat tiles                        */
/* ============================================================ */
const PortfolioHero = ({ name, total, profit, ret, capital }) => (
  <section style={{ padding:'14px 32px 0' }}>
    <article style={{
      position:'relative', overflow:'hidden',
      borderRadius:18,
      background:'linear-gradient(120deg, #2c6fe6 0%, #4d8aff 50%, #6ba0ff 100%)',
      color:'#fff',
      boxShadow:'0 16px 40px -16px rgba(44,111,230,.4)',
      padding:'26px 32px',
    }}>
      <div aria-hidden style={{ position:'absolute', inset:0,
        background:'radial-gradient(60% 60% at 80% 30%, rgba(255,255,255,.14), transparent 70%)'}}/>

      {/* title row */}
      <div style={{ position:'relative', display:'flex', alignItems:'center', gap:14,
        marginBottom:20 }}>
        <div aria-hidden style={{
          width:44, height:44, borderRadius:'50%',
          background:'rgba(255,255,255,.18)',
          backdropFilter:'blur(8px)',
          display:'flex', alignItems:'center', justifyContent:'center',
          animation:'whale-float 7s ease-in-out infinite',
        }}>
          <svg width="24" height="20" viewBox="0 0 32 24" fill="none">
            <path d="M3 16 Q 8 5 16 8 Q 24 11 28 6 L 30 10 L 28 13 L 26 14 Q 22 18 14 17 Q 8 17 5 19 Q 3 18 3 16 Z"
              fill="#fff" opacity=".95"/>
            <circle cx="10" cy="13" r=".8" fill="#2c6fe6"/>
          </svg>
        </div>
        <div>
          <h1 style={{ margin:0, fontSize:22, fontWeight:700, letterSpacing:'-.01em' }}>
            내 포트폴리오
          </h1>
          <p style={{ margin:'4px 0 0', fontSize:13, opacity:.85 }}>
            {name}님의 투자 현황
          </p>
        </div>
      </div>

      {/* stats grid */}
      <div style={{ position:'relative', display:'grid',
        gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:12 }}>
        <HeroTile label="총 자산" value={wKRW(total)} />
        <HeroTile label="총 수익"
          value={`${profit >= 0 ? '+' : '-'}${wKRW(Math.abs(profit))}`}
          tone="bold" />
        <HeroTile label="수익률"
          value={<><Tri up={ret >= 0}/>{ret >= 0 ? '+' : ''}{ret.toFixed(2)}%</>}
          tone="bold" />
        <HeroTile label="초기 자본" value={`${(capital/10000).toFixed(0)}만`} />
      </div>
    </article>
  </section>
);

const HeroTile = ({ label, value, tone }) => (
  <div style={{
    padding:'14px 16px', borderRadius:12,
    background:'rgba(255,255,255,.14)',
    backdropFilter:'blur(6px)',
    border:'1px solid rgba(255,255,255,.18)',
  }}>
    <div style={{ fontSize:11, opacity:.85, letterSpacing:'.08em' }}>{label}</div>
    <div className="mono" style={{ marginTop:6, fontSize:22, fontWeight:700,
      letterSpacing:'-.01em' }}>{value}</div>
  </div>
);

/* ============================================================ */
/* Asset Trend Chart                                              */
/* ============================================================ */
const AssetTrendCard = ({ data }) => {
  const [mode, setMode] = React.useState('value'); // value | pct
  return (
    <section style={{ ...virtCard }}>
      <header style={{ ...cardSection, paddingBottom:14,
        display:'flex', alignItems:'center', justifyContent:'space-between',
        borderBottom:'1px solid var(--line)', flexWrap:'wrap', gap:12 }}>
        <h3 style={sectionTitle}>자산 추이</h3>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ display:'flex', gap:4, padding:3, borderRadius:8,
            background:'var(--bg-2)', border:'1px solid var(--line)' }}>
            {[['value','총 자산'], ['pct','수익률 %']].map(([k,l]) => (
              <button key={k} onClick={() => setMode(k)} style={{
                padding:'5px 10px', borderRadius:6, fontSize:11.5, fontWeight:600,
                border:0, cursor:'pointer', fontFamily:'inherit',
                background: mode === k ? 'var(--bg-1)' : 'transparent',
                color: mode === k ? 'var(--ink-0)' : 'var(--ink-2)',
                boxShadow: mode === k ? '0 1px 3px rgba(14,25,54,.08)' : 'none',
              }}>{l}</button>
            ))}
          </div>
          <span style={{ fontSize:11.5, color:'var(--ink-2)' }}>최근 30일</span>
        </div>
      </header>

      {/* legend */}
      <div style={{ padding:'14px 24px 0', display:'flex', justifyContent:'flex-end',
        gap:18, fontSize:11.5, color:'var(--ink-1)' }}>
        <LegendItem c="var(--accent)" l="내 포트폴리오" />
        <LegendItem c="var(--ink-3)" l="KOSPI" dashed />
      </div>

      <div style={{ padding:'8px 12px 22px', height:280 }}>
        <TrendChart data={data} mode={mode} />
      </div>
    </section>
  );
};

const LegendItem = ({ c, l, dashed }) => (
  <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
    <span style={{ width:14, height:2, background:'transparent',
      borderTop: dashed ? `2px dashed ${c}` : `2px solid ${c}`,
      display:'inline-block' }}/>
    {l}
  </span>
);

const TrendChart = ({ data, mode }) => {
  const W = 880, H = 250;
  const padL = 8, padR = 50, padT = 12, padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  // data has portfolio[] and kospi[] (each 30 points)
  const port = mode === 'value' ? data.portfolio : data.portfolioPct;
  const bench = mode === 'value' ? data.kospi : data.kospiPct;

  const all = [...port, ...bench];
  const max = Math.max(...all);
  const min = Math.min(...all);
  const range = (max - min) || 1;
  const yP = (v) => padT + ((max - v) / range) * innerH;
  const xP = (i) => padL + (i / (port.length-1)) * innerW;

  const portPath = 'M ' + port.map((p, i) => `${xP(i)} ${yP(p)}`).join(' L ');
  const fillPath = portPath + ` L ${xP(port.length-1)} ${padT+innerH} L ${padL} ${padT+innerH} Z`;
  const benchPath = 'M ' + bench.map((p, i) => `${xP(i)} ${yP(p)}`).join(' L ');

  // 5 ticks for y axis
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => min + (1-t) * range);
  // ~8 date labels
  const labels = [];
  const labelCount = 8;
  for (let i = 0; i < labelCount; i++) {
    const idx = Math.round((i / (labelCount-1)) * (port.length - 1));
    const day = 28 - (port.length - 1 - idx);
    const m = day <= 0 ? 4 : 5;
    const d = day <= 0 ? 30 + day : day;
    labels.push({ x: xP(idx), label: `${m}월 ${d}일` });
  }

  const fmtY = (v) => mode === 'value'
    ? (v / 10000).toFixed(0) + '만'
    : (v >= 0 ? '+' : '') + v.toFixed(1) + '%';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ display:'block' }}>
      <defs>
        <linearGradient id="port-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#5b9dff" stopOpacity=".18"/>
          <stop offset="100%" stopColor="#5b9dff" stopOpacity="0"/>
        </linearGradient>
      </defs>

      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={padL} x2={W-padR} y1={yP(t)} y2={yP(t)}
            stroke="rgba(14,25,54,.06)" strokeWidth="1"/>
          <text x={W-padR+6} y={yP(t)+4}
            fill="var(--ink-2)" fontSize="10"
            fontFamily="JetBrains Mono, monospace">{fmtY(t)}</text>
        </g>
      ))}

      <path d={fillPath} fill="url(#port-fill)"/>
      <path d={benchPath} stroke="var(--ink-3)" strokeWidth="1.4"
        strokeDasharray="4 3" fill="none" vectorEffect="non-scaling-stroke"/>
      <path d={portPath} stroke="var(--accent)" strokeWidth="1.8"
        fill="none" vectorEffect="non-scaling-stroke"/>

      {/* last point dot */}
      <circle cx={xP(port.length-1)} cy={yP(port[port.length-1])} r="3.5"
        fill="var(--accent)" stroke="#fff" strokeWidth="1.5"/>

      {labels.map((l, i) => (
        <text key={i} x={l.x} y={H-8}
          fill="var(--ink-2)" fontSize="10" textAnchor="middle"
          fontFamily="JetBrains Mono, monospace">{l.label}</text>
      ))}
    </svg>
  );
};

/* ============================================================ */
/* Asset Allocation (donut + legend)                              */
/* ============================================================ */
const AssetAllocationCard = ({ items, total }) => (
  <section style={{ ...virtCard }}>
    <header style={{ ...cardSection, paddingBottom:14,
      borderBottom:'1px solid var(--line)' }}>
      <h3 style={sectionTitle}>자산 배분</h3>
    </header>
    <div style={{ padding:'22px 24px',
      display:'grid', gridTemplateColumns:'180px 1fr', gap:32,
      alignItems:'center' }}>
      <div style={{ width:180, height:180, position:'relative' }}>
        <Donut items={items} total={total} />
      </div>
      <ul style={{ margin:0, padding:0, listStyle:'none',
        display:'flex', flexDirection:'column', gap:12 }}>
        {items.map(it => (
          <li key={it.label} style={{ display:'grid',
            gridTemplateColumns:'auto 80px 1fr auto', alignItems:'center',
            gap:10, fontSize:13 }}>
            <span style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
              <span style={{ width:9, height:9, borderRadius:'50%',
                background: it.color }}/>
              <span style={{ color:'var(--ink-0)', fontWeight:500 }}>{it.label}</span>
            </span>
            <span className="mono" style={{ color:'var(--ink-1)', fontWeight:600,
              textAlign:'right' }}>
              {((it.value/total) * 100).toFixed(1)}%
            </span>
            <span style={{ height:6, borderRadius:3,
              background:'var(--bg-2)', overflow:'hidden',
              border:'1px solid var(--line)' }}>
              <span style={{ display:'block',
                width:`${(it.value/total)*100}%`, height:'100%',
                background: it.color }}/>
            </span>
            <span className="mono" style={{ fontSize:12.5, fontWeight:600,
              color:'var(--ink-0)', textAlign:'right',
              whiteSpace:'nowrap' }}>{wKRW(it.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  </section>
);

const Donut = ({ items, total }) => {
  const R = 72;
  const inner = 48;
  const C = 2 * Math.PI * R;

  let acc = 0;
  const arcs = items.map((it, i) => {
    const frac = it.value / total;
    const len = C * frac;
    const offset = -C * acc + C / 4;
    acc += frac;
    return { len, offset, color: it.color, frac };
  });

  return (
    <svg viewBox="0 0 180 180" width="100%" height="100%">
      {/* base ring */}
      <circle cx="90" cy="90" r={R} fill="none"
        stroke="var(--bg-2)" strokeWidth={R - inner}/>
      {/* slices */}
      <g transform="rotate(-90 90 90)">
        {arcs.map((a, i) => (
          <circle key={i} cx="90" cy="90" r={R}
            fill="none"
            stroke={a.color}
            strokeWidth={R - inner}
            strokeDasharray={`${a.len} ${C - a.len}`}
            strokeDashoffset={-((arcs.slice(0, i).reduce((s,x)=>s+x.len, 0)))}
            transform="rotate(0 90 90)" />
        ))}
      </g>
      {/* center label */}
      <text x="90" y="86" textAnchor="middle"
        fontSize="10" fill="var(--ink-2)"
        fontFamily="JetBrains Mono, monospace"
        letterSpacing="1.5">TOTAL</text>
      <text x="90" y="103" textAnchor="middle"
        fontSize="15" fontWeight="700" fill="var(--ink-0)"
        fontFamily="JetBrains Mono, monospace">{wKRW(total)}</text>
    </svg>
  );
};

/* ============================================================ */
/* Holdings + Trades tabs                                         */
/* ============================================================ */
const HoldingsTradesCard = ({ holdings, trades }) => {
  const [tab, setTab] = React.useState('holdings');
  const equity = holdings.reduce((s, h) => s + h.value, 0);
  const pnl = holdings.reduce((s, h) => s + (h.pnlAbs || 0), 0);

  return (
    <section style={{ ...virtCard, padding:0 }}>
      {/* tabs */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr',
        borderBottom:'1px solid var(--line)' }}>
        {[
          ['holdings','보유 종목', holdings.length],
          ['trades',  '거래 내역', trades.length],
        ].map(([k, l, n]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            position:'relative', padding:'16px 18px',
            border:0, background:'transparent',
            color: tab === k ? 'var(--ink-0)' : 'var(--ink-2)',
            fontSize:14, fontWeight: tab === k ? 700 : 500,
            cursor:'pointer', fontFamily:'inherit',
            display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8,
            borderRight: k === 'holdings' ? '1px solid var(--line)' : 'none',
          }}>
            {l} <span style={{ color:'var(--ink-2)', fontWeight:600 }}>({n})</span>
            {tab === k && (
              <span style={{ position:'absolute', left:12, right:12, bottom:-1, height:2,
                background:'linear-gradient(90deg, var(--accent), var(--accent-glow))',
                borderRadius:1 }}/>
            )}
          </button>
        ))}
      </div>

      {tab === 'holdings' && (
        <>
          {/* summary header */}
          <div style={{ padding:'16px 24px',
            display:'flex', justifyContent:'space-between', alignItems:'baseline',
            borderBottom:'1px solid var(--line)', background:'var(--bg-2)',
            flexWrap:'wrap', gap:8 }}>
            <div>
              <span style={{ fontSize:12, color:'var(--ink-2)' }}>총 평가금액</span>
              <span className="mono" style={{ marginLeft:10, fontSize:16, fontWeight:700 }}>
                {wKRW(equity)}
              </span>
            </div>
            <span className="mono" style={{ fontSize:13, fontWeight:600,
              color: pnl >= 0 ? 'var(--up)' : 'var(--down)' }}>
              <Tri up={pnl >= 0}/>{pnl >= 0 ? '+' : ''}{pnl.toLocaleString('ko-KR')}
            </span>
          </div>

          {/* type subheader */}
          <div style={{ padding:'14px 24px 6px',
            display:'flex', alignItems:'center', gap:10, fontSize:13 }}>
            <span style={{ fontSize:14 }}>🐋</span>
            <span style={{ fontWeight:600 }}>가상화폐</span>
            <span style={{ color:'var(--ink-2)' }}>{holdings.length}종목</span>
          </div>

          <ul style={{ margin:0, padding:0, listStyle:'none' }}>
            {holdings.map((h, i) => {
              const up = h.dPct >= 0;
              const glyph = ASSET_GLYPH[h.sym];
              return (
                <li key={h.sym} style={{
                  padding:'14px 24px',
                  borderTop:'1px solid var(--line)',
                  display:'grid', gridTemplateColumns:'auto 1fr auto', gap:14,
                  alignItems:'center',
                }}>
                  <span style={{
                    width:34, height:34, borderRadius:'50%',
                    background:glyph.bg, color:glyph.fg,
                    display:'inline-flex', alignItems:'center', justifyContent:'center',
                    fontSize:16, fontWeight:700, flexShrink:0,
                  }}>{glyph.label}</span>
                  <div style={{ minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3,
                      flexWrap:'wrap' }}>
                      <span style={{ fontSize:14, fontWeight:600 }}>{h.name}</span>
                      {h.strategy && (
                        <span style={{
                          fontSize:10.5, padding:'2px 7px', borderRadius:5,
                          background:'var(--accent-bg)', color:'var(--accent)',
                          border:'1px solid rgba(91,157,255,.28)',
                          fontWeight:600,
                        }}>{h.strategy}</span>
                      )}
                    </div>
                    <div className="mono" style={{ fontSize:11.5, color:'var(--ink-2)' }}>
                      {h.sym} · {h.qty}
                    </div>
                  </div>
                  <div style={{ textAlign:'right', whiteSpace:'nowrap' }}>
                    <div className="mono" style={{ fontSize:14.5, fontWeight:700 }}>
                      {wKRW(h.value)}
                    </div>
                    <div className="mono" style={{ marginTop:3, fontSize:12, fontWeight:600,
                      color: up ? 'var(--up)' : 'var(--down)' }}>
                      <Tri up={up}/>{up ? '+' : ''}{h.dPct.toFixed(2)}%
                      <span style={{ marginLeft:6, color:'var(--ink-2)', fontWeight:500 }}>
                        ({h.pnlAbs >= 0 ? '+' : '-'}{wKRW(Math.abs(h.pnlAbs))})
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {tab === 'trades' && <TradesTable trades={trades} />}
    </section>
  );
};

const TradesTable = ({ trades }) => (
  <div style={{ overflowX:'auto' }}>
    <table style={{ width:'100%', borderCollapse:'collapse', minWidth:600 }}>
      <thead>
        <tr>
          {['시간','구분','종목','수량','가격','체결액'].map(h => (
            <th key={h} style={{
              textAlign:'left', padding:'12px 18px', fontSize:11,
              color:'var(--ink-2)', letterSpacing:'.12em', fontWeight:600,
              borderBottom:'1px solid var(--line)', textTransform:'uppercase',
              background:'var(--bg-2)',
            }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {trades.map((t, i) => (
          <tr key={i}>
            <td className="mono" style={trTdSx}>{t.time}</td>
            <td style={trTdSx}>
              <span style={{
                padding:'2px 8px', borderRadius:5, fontSize:11, fontWeight:700,
                color: t.side === 'buy' ? 'var(--up)' : 'var(--down)',
                background: t.side === 'buy'
                  ? 'rgba(239,77,77,.10)'
                  : 'rgba(44,111,230,.10)',
              }}>{t.side === 'buy' ? '매수' : '매도'}</span>
            </td>
            <td style={trTdSx}>
              <span style={{ fontWeight:600 }}>{t.name}</span>
              <span className="mono" style={{ marginLeft:6, fontSize:11.5,
                color:'var(--ink-2)' }}>{t.sym}</span>
            </td>
            <td className="mono" style={trTdSx}>{t.qty}</td>
            <td className="mono" style={trTdSx}>{wKRW(t.price)}</td>
            <td className="mono" style={trTdSx}>{wKRW(t.qty * t.price)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const trTdSx = {
  padding:'12px 18px', fontSize:13,
  borderBottom:'1px solid var(--line)',
};

Object.assign(window, {
  ASSET_COLORS, ASSET_GLYPH,
  PortfolioCrumb, PortfolioHero, AssetTrendCard, AssetAllocationCard,
  HoldingsTradesCard,
});
