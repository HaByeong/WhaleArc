/* console-portfolio.jsx — 포트폴리오 (Helm console) */

const ASSET = {
  cash: { c:'#7a8aa8', label:'현금' },
  BTC:  { c:'#f7931a', t:'₿', label:'비트코인' },
  ETH:  { c:'#627eea', t:'Ξ', label:'이더리움' },
  SOL:  { c:'#9945ff', t:'◎', label:'솔라나' },
};

function genTrend(start, end, n, seed, noise=0.008) {
  let h = seed; const out = []; let v = start;
  const drift = (end - start) / n;
  for (let i=0;i<=n;i++){ h=(h*1103515245+12345)&0x7fffffff;
    v += drift + (((h%1000)-500)/500)*(start*noise); out.push(v); }
  return out;
}

const TREND = (() => {
  const init = 10_000_000;
  const port = genTrend(init, 9_643_148, 30, 12345, 0.008);
  const kospi = genTrend(init, 9_950_000, 30, 67890, 0.012);
  return { port, kospi, init };
})();

/* ---- Trend chart ---- */
const TrendChart = ({ data, mode }) => {
  const W = 880, H = 250, padL = 8, padR = 52, padT = 12, padB = 28;
  const innerW = W-padL-padR, innerH = H-padT-padB;
  const port = mode==='pct' ? data.port.map(v=>((v-data.init)/data.init)*100) : data.port;
  const bench = mode==='pct' ? data.kospi.map(v=>((v-data.init)/data.init)*100) : data.kospi;
  const all = [...port,...bench]; const max=Math.max(...all), min=Math.min(...all);
  const range=(max-min)||1;
  const yP=v=>padT+((max-v)/range)*innerH;
  const xP=i=>padL+(i/(port.length-1))*innerW;
  const pp='M '+port.map((p,i)=>`${xP(i)} ${yP(p)}`).join(' L ');
  const fp=pp+` L ${xP(port.length-1)} ${padT+innerH} L ${padL} ${padT+innerH} Z`;
  const bp='M '+bench.map((p,i)=>`${xP(i)} ${yP(p)}`).join(' L ');
  const ticks=[0,.25,.5,.75,1].map(t=>min+(1-t)*range);
  const fmtY=v=>mode==='pct'?`${v>=0?'+':''}${v.toFixed(1)}%`:`${(v/10000).toFixed(0)}만`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ display:'block' }}>
      <defs><linearGradient id="pf" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor="#5b9dff" stopOpacity=".2"/>
        <stop offset="100%" stopColor="#5b9dff" stopOpacity="0"/></linearGradient></defs>
      {ticks.map((t,i)=>(<g key={i}>
        <line x1={padL} x2={W-padR} y1={yP(t)} y2={yP(t)} stroke="rgba(255,255,255,.05)" strokeWidth="1"/>
        <text x={W-padR+6} y={yP(t)+4} fill="var(--ink-2)" fontSize="10" fontFamily="JetBrains Mono, monospace">{fmtY(t)}</text>
      </g>))}
      <path d={fp} fill="url(#pf)"/>
      <path d={bp} stroke="var(--ink-3)" strokeWidth="1.4" strokeDasharray="4 3" fill="none" vectorEffect="non-scaling-stroke"/>
      <path d={pp} stroke="var(--sonar)" strokeWidth="1.8" fill="none" vectorEffect="non-scaling-stroke"/>
      <circle cx={xP(port.length-1)} cy={yP(port[port.length-1])} r="3.5" fill="var(--sonar)" stroke="var(--abyss-0)" strokeWidth="1.5"/>
    </svg>
  );
};

/* ---- Donut ---- */
const Donut = ({ items, total }) => {
  const R=72, inner=48, C=2*Math.PI*R; let acc=0;
  const arcs = items.map(it => { const len=C*(it.value/total); const off=acc; acc+=len; return { len, off, c:it.c }; });
  return (
    <svg viewBox="0 0 180 180" width="100%" height="100%">
      <circle cx="90" cy="90" r={R} fill="none" stroke="var(--abyss-0)" strokeWidth={R-inner}/>
      <g transform="rotate(-90 90 90)">
        {arcs.map((a,i)=>(<circle key={i} cx="90" cy="90" r={R} fill="none" stroke={a.c}
          strokeWidth={R-inner} strokeDasharray={`${a.len} ${C-a.len}`} strokeDashoffset={-a.off}/>))}
      </g>
      <text x="90" y="86" textAnchor="middle" fontSize="9" fill="var(--ink-2)" fontFamily="JetBrains Mono, monospace" letterSpacing="1.5">TOTAL</text>
      <text x="90" y="103" textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--ink-0)" fontFamily="JetBrains Mono, monospace">{wKRW(total)}</text>
    </svg>
  );
};

/* ---- Holdings/trades tabs ---- */
const HoldingsTrades = ({ holdings, trades }) => {
  const [tab, setTab] = React.useState('holdings');
  const equity = holdings.reduce((s,h)=>s+h.value, 0);
  const pnl = holdings.reduce((s,h)=>s+h.pnlAbs, 0);
  return (
    <Panel style={{ padding:0 }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', borderBottom:'1px solid var(--hair)' }}>
        {[['holdings','보유 종목',holdings.length],['trades','거래 내역',trades.length]].map(([k,l,n],idx) => (
          <button key={k} onClick={() => setTab(k)} style={{
            position:'relative', padding:'15px', border:0, background:'transparent',
            color: tab===k ? 'var(--ink-0)' : 'var(--ink-2)', fontSize:14, fontWeight: tab===k?700:500,
            cursor:'pointer', fontFamily:'inherit',
            borderRight: idx===0 ? '1px solid var(--hair)' : 'none' }}>
            {l} <span style={{ color:'var(--ink-2)', fontWeight:600 }}>({n})</span>
            {tab===k && <span style={{ position:'absolute', left:14, right:14, bottom:-1, height:2,
              background:'var(--sonar)', borderRadius:1 }}/>}
          </button>
        ))}
      </div>
      {tab==='holdings' && (
        <>
          <div style={{ padding:'14px 22px', display:'flex', justifyContent:'space-between',
            alignItems:'baseline', borderBottom:'1px solid var(--hair)', background:'var(--abyss-0)', flexWrap:'wrap', gap:8 }}>
            <span style={{ fontSize:12, color:'var(--ink-2)' }}>총 평가금액
              <span className="mono" style={{ marginLeft:10, fontSize:16, fontWeight:700, color:'var(--ink-0)' }}>{wKRW(equity)}</span></span>
            <span className="mono" style={{ fontSize:13, fontWeight:600, color: pnl>=0?'var(--up)':'var(--down)' }}>
              <Tri up={pnl>=0}/>{pnl>=0?'+':''}{pnl.toLocaleString('ko-KR')}</span>
          </div>
          {holdings.map((h,i) => {
            const up=h.dPct>=0, g=ASSET[h.sym];
            return (
              <div key={h.sym} style={{ display:'grid', gridTemplateColumns:'auto 1fr auto', gap:14,
                alignItems:'center', padding:'14px 22px', borderTop: i?'1px solid var(--hair)':'none' }}>
                <span style={{ width:34, height:34, borderRadius:10, background:g.c, color:'#fff',
                  fontSize:16, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>{g.t}</span>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:600 }}>{h.name}</div>
                  <div className="mono" style={{ fontSize:11, color:'var(--ink-2)', marginTop:2 }}>{h.sym} · {h.qty}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div className="mono" style={{ fontSize:14, fontWeight:700 }}>{wKRW(h.value)}</div>
                  <div className="mono" style={{ fontSize:12, fontWeight:600, marginTop:2, color: up?'var(--up)':'var(--down)' }}>
                    <Tri up={up}/>{up?'+':''}{h.dPct.toFixed(2)}%</div>
                </div>
              </div>
            );
          })}
        </>
      )}
      {tab==='trades' && (
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:520 }}>
            <thead><tr>{['시간','구분','종목','수량','가격'].map(h=>(
              <th key={h} style={{ textAlign:'left', padding:'12px 18px', fontSize:11,
                color:'var(--ink-2)', letterSpacing:'.1em', fontWeight:600,
                borderBottom:'1px solid var(--hair)', textTransform:'uppercase' }}>{h}</th>))}</tr></thead>
            <tbody>{trades.map((t,i)=>(
              <tr key={i}>
                <td className="mono" style={td}>{t.time}</td>
                <td style={td}><span style={{ padding:'2px 8px', borderRadius:5, fontSize:11, fontWeight:700,
                  color: t.side==='buy'?'var(--up)':'var(--down)',
                  background: t.side==='buy'?'rgba(239,77,77,.12)':'rgba(77,138,255,.12)' }}>
                  {t.side==='buy'?'매수':'매도'}</span></td>
                <td style={td}>{t.name}</td>
                <td className="mono" style={td}>{t.qty}</td>
                <td className="mono" style={td}>{wKRW(t.price)}</td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
    </Panel>
  );
};
const td = { padding:'13px 18px', fontSize:13, borderBottom:'1px solid var(--hair)' };

/* ---- App ---- */
function ConsolePortfolio() {
  const cash = 7_000_001;
  const holdings = [
    { sym:'BTC', name:'비트코인', qty:'0.0083325개', value:898_235, dPct:-10.09, pnlAbs:-100_765 },
    { sym:'ETH', name:'이더리움', qty:'0.29723326개', value:869_407, dPct:-12.97, pnlAbs:-129_594 },
    { sym:'SOL', name:'솔라나',   qty:'7.35100072개', value:875_504, dPct:-12.38, pnlAbs:-123_497 },
  ];
  const equity = holdings.reduce((s,h)=>s+h.value, 0);
  const total = cash + equity;
  const pnlAbs = -356_852, pnlPct = -3.57;
  const trades = [
    { time:'05.27 14:23', side:'sell', name:'솔라나',   qty:'2',     price:118_300 },
    { time:'05.27 11:08', side:'buy',  name:'비트코인', qty:'0.001', price:91_200_000 },
    { time:'05.26 10:42', side:'buy',  name:'이더리움', qty:'0.05',  price:3_350_000 },
  ];
  const alloc = [
    { ...ASSET.cash, value:cash },
    { ...ASSET.BTC, value:holdings[0].value },
    { ...ASSET.ETH, value:holdings[1].value },
    { ...ASSET.SOL, value:holdings[2].value },
  ];
  const [mode, setMode] = React.useState('value');

  return (
    <>
      <Sidebar active="portfolio" />
      <Shell>
        <Topbar coord="N 37.50° · E 127.04°" session="2026.05.31 (일) · VIRT 가상 항해 · 14일째" />
        <main style={{ padding:'28px 32px 64px', maxWidth:1320, margin:'0 auto',
          display:'flex', flexDirection:'column', gap:18 }}>
          <div>
            <h1 className="disp" style={{ fontSize:26, fontWeight:700, letterSpacing:'-.01em' }}>내 포트폴리오</h1>
            <p style={{ margin:'8px 0 0', fontSize:13.5, color:'var(--ink-1)' }}>김병하 항해사님의 항해 일지 · 가상 계좌</p>
          </div>

          {/* hero: total + donut */}
          <Panel style={{ padding:0 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1.3fr 1fr', gap:0 }}>
              <div style={{ padding:'30px 32px', borderRight:'1px solid var(--hair)' }}>
                <div style={{ fontSize:10.5, letterSpacing:'.2em', color:'var(--sonar)', fontWeight:600, marginBottom:10 }}>총 자산</div>
                <div className="disp" style={{ fontSize:58, fontWeight:700, letterSpacing:'-.03em', lineHeight:1 }}>{wKRW(total)}</div>
                <div className="mono" style={{ marginTop:14, fontSize:16, fontWeight:600, color: pnlAbs<0?'var(--down)':'var(--up)' }}>
                  <Tri up={pnlAbs>=0}/>{pnlAbs>=0?'+':'-'}{wKRW(Math.abs(pnlAbs))} ({pnlPct>=0?'+':''}{pnlPct.toFixed(2)}%)</div>
                <div style={{ marginTop:26, display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                  {[['현금',wKRW(cash)],['보유 평가',wKRW(equity)],['초기 자본','1,000만']].map(([l,v])=>(
                    <div key={l} style={{ padding:'13px 14px', borderRadius:11, background:'var(--abyss-0)', border:'1px solid var(--hair)' }}>
                      <div style={{ fontSize:10.5, color:'var(--ink-2)' }}>{l}</div>
                      <div className="mono" style={{ marginTop:6, fontSize:15, fontWeight:600 }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ padding:'24px 26px' }}>
                <div style={{ fontSize:10.5, letterSpacing:'.2em', color:'var(--ink-2)', fontWeight:600, marginBottom:14 }}>자산 배분</div>
                <div style={{ display:'grid', gridTemplateColumns:'120px 1fr', gap:20, alignItems:'center' }}>
                  <div style={{ width:120, height:120 }}><Donut items={alloc} total={total}/></div>
                  <ul style={{ margin:0, padding:0, listStyle:'none', display:'flex', flexDirection:'column', gap:9 }}>
                    {alloc.map(a => (
                      <li key={a.label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:12.5 }}>
                        <span style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
                          <span style={{ width:9, height:9, borderRadius:'50%', background:a.c }}/>{a.label}</span>
                        <span className="mono" style={{ color:'var(--ink-1)' }}>{((a.value/total)*100).toFixed(1)}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </Panel>

          {/* trend */}
          <Panel>
            <PanelHead kicker="VOYAGE LOG" title="자산 추이"
              right={
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ display:'flex', gap:3, padding:3, borderRadius:8, background:'var(--abyss-0)', border:'1px solid var(--hair)' }}>
                    {[['value','총 자산'],['pct','수익률 %']].map(([k,l])=>(
                      <button key={k} onClick={()=>setMode(k)} style={{ padding:'5px 10px', borderRadius:6, fontSize:11.5, fontWeight:600,
                        border:0, cursor:'pointer', fontFamily:'inherit',
                        background: mode===k?'var(--sonar-dim)':'transparent', color: mode===k?'var(--sonar)':'var(--ink-2)' }}>{l}</button>
                    ))}
                  </div>
                  <span style={{ fontSize:11.5, color:'var(--ink-2)' }}>최근 30일</span>
                </div>
              } />
            <div style={{ padding:'10px 14px 8px', display:'flex', justifyContent:'flex-end', gap:16, fontSize:11, color:'var(--ink-1)' }}>
              <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}><span style={{ width:14, height:2, background:'var(--sonar)' }}/>내 포트폴리오</span>
              <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}><span style={{ width:14, borderTop:'2px dashed var(--ink-3)' }}/>KOSPI</span>
            </div>
            <div style={{ padding:'0 12px 18px', height:250 }}><TrendChart data={TREND} mode={mode}/></div>
          </Panel>

          {/* holdings + sailing */}
          <div style={{ display:'grid', gridTemplateColumns:'1.5fr 1fr', gap:18, alignItems:'start' }}>
            <HoldingsTrades holdings={holdings} trades={trades} />
            <Panel>
              <PanelHead kicker="ACTIVE ROUTE" title="항해 중인 항로"
                right={<a style={{ fontSize:12, color:'var(--down)' }}>항해 취소</a>} />
              <div style={{ padding:'20px 22px' }}>
                <div style={{ fontSize:15, fontWeight:700, marginBottom:6 }}>골든크로스 추종 전략</div>
                <div style={{ fontSize:12.5, color:'var(--ink-2)' }}>투자 <span className="mono" style={{ color:'var(--ink-0)', fontWeight:600 }}>{wKRW(2_997_002)}</span></div>
                <div style={{ marginTop:16, padding:'16px 18px', borderRadius:12,
                  background:'rgba(77,138,255,.07)', border:'1px solid rgba(77,138,255,.22)' }}>
                  <div className="mono disp" style={{ fontSize:26, fontWeight:700, color:'var(--down)' }}><Tri up={false}/>-11.81%</div>
                  <div className="mono" style={{ marginTop:4, fontSize:12, color:'var(--ink-2)' }}>(-{wKRW(353_855)})</div>
                </div>
                <div style={{ marginTop:16, display:'flex', flexWrap:'wrap', gap:12, fontSize:12.5 }}>
                  {[['BTC',-10.1],['ETH',-13.0],['SOL',-12.4]].map(([s,p],i)=>(
                    <React.Fragment key={s}>
                      {i>0 && <span style={{ color:'var(--ink-3)' }}>·</span>}
                      <span style={{ color:'var(--ink-1)' }}>{s} <span className="mono" style={{ fontWeight:600, color:'var(--down)' }}>{p}%</span></span>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </Panel>
          </div>

          <footer style={{ marginTop:8, paddingTop:20, borderTop:'1px solid var(--hair)',
            display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
            <span className="mono" style={{ fontSize:11.5, color:'var(--ink-3)' }}>© 2026 WHALEARC · 이 계좌의 모든 거래는 가상입니다.</span>
            <span style={{ fontSize:11.5, color:'var(--ink-3)' }}>Built quietly, beneath the surface.</span>
          </footer>
        </main>
      </Shell>
    </>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<ConsolePortfolio />);
