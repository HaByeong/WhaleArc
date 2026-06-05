/* console-home.jsx — 내 투자 홈 (Helm sonar dashboard) */

/* ============================================================ */
/* Sonar hero — radar with holdings as blips                     */
/* ============================================================ */
const Sonar = ({ blips }) => (
  <div style={{ position:'relative', width:'100%', aspectRatio:'1/1', maxWidth:300,
    margin:'0 auto' }}>
    <svg viewBox="0 0 200 200" width="100%" height="100%">
      <defs>
        <radialGradient id="son-g" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(91,157,255,.12)"/>
          <stop offset="100%" stopColor="rgba(91,157,255,0)"/>
        </radialGradient>
        <linearGradient id="son-sweep" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="rgba(91,157,255,0)"/>
          <stop offset="100%" stopColor="rgba(91,157,255,.45)"/>
        </linearGradient>
      </defs>
      <circle cx="100" cy="100" r="92" fill="url(#son-g)"/>
      {[30,55,80].map(r => (
        <circle key={r} cx="100" cy="100" r={r} fill="none"
          stroke="rgba(255,255,255,.12)" strokeWidth="1"/>
      ))}
      <circle cx="100" cy="100" r="92" fill="none" stroke="rgba(255,255,255,.16)" strokeWidth="1"/>
      <line x1="8" y1="100" x2="192" y2="100" stroke="rgba(255,255,255,.08)" strokeWidth="1"/>
      <line x1="100" y1="8" x2="100" y2="192" stroke="rgba(255,255,255,.08)" strokeWidth="1"/>
    </svg>
    {/* rotating sweep */}
    <div style={{ position:'absolute', inset:0, animation:'sonar-sweep 5s linear infinite' }}>
      <svg viewBox="0 0 200 200" width="100%" height="100%">
        <path d="M100 100 L100 8 A92 92 0 0 1 168 38 Z" fill="url(#son-sweep)" opacity=".8"/>
        <line x1="100" y1="100" x2="100" y2="8" stroke="var(--sonar)" strokeWidth="1.5"/>
      </svg>
    </div>
    {/* blips */}
    {blips.map((b, i) => (
      <div key={b.sym} style={{
        position:'absolute', left:`${b.x}%`, top:`${b.y}%`,
        transform:'translate(-50%,-50%)', textAlign:'center' }}>
        <span style={{ position:'absolute', left:'50%', top:'50%',
          transform:'translate(-50%,-50%)',
          width:18, height:18, borderRadius:'50%',
          border:`1px solid ${b.up ? 'var(--up)' : 'var(--down)'}`,
          animation:`pulse-ring 2.6s ease-out ${i*.5}s infinite` }}/>
        <span style={{ display:'block', width:8, height:8, borderRadius:'50%',
          background: b.up ? 'var(--up)' : 'var(--down)',
          boxShadow:`0 0 8px ${b.up ? 'var(--up)' : 'var(--down)'}` }}/>
        <span className="mono" style={{ position:'absolute', top:11, left:'50%',
          transform:'translateX(-50%)', fontSize:9, color:'var(--ink-1)',
          whiteSpace:'nowrap' }}>{b.sym}</span>
      </div>
    ))}
  </div>
);

/* ============================================================ */
/* Helm hero — assets + sonar + depth gauge                      */
/* ============================================================ */
const HelmHero = ({ total, pnlAbs, pnlPct, cash, invested, blips, target }) => {
  const progress = Math.min(100, Math.max(0, (Math.abs(pnlPct) / target) * 100));
  const lossy = pnlAbs < 0;
  return (
    <Panel style={{ padding:0 }}>
      <div style={{ display:'grid', gridTemplateColumns:'1.3fr .9fr', gap:0 }}>
        {/* left — figures */}
        <div style={{ padding:'30px 32px', borderRight:'1px solid var(--hair)' }}>
          <div style={{ fontSize:10.5, letterSpacing:'.2em', color:'var(--sonar)',
            fontWeight:600, marginBottom:10 }}>항해 계기판 · 총 자산</div>
          <div className="disp" style={{ fontSize:46, fontWeight:700, letterSpacing:'-.02em',
            lineHeight:1 }}>{wKRW(total)}</div>
          <div className="mono" style={{ marginTop:12, fontSize:15, fontWeight:600,
            color: lossy ? 'var(--down)' : 'var(--up)' }}>
            <Tri up={!lossy}/>{pnlAbs >= 0 ? '+' : '-'}{wKRW(Math.abs(pnlAbs))} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)
          </div>

          {/* depth gauge */}
          <div style={{ marginTop:28 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline',
              marginBottom:8 }}>
              <span style={{ fontSize:12, color:'var(--ink-2)' }}>목표 수심 (수익률 {target}%)</span>
              <span className="mono" style={{ fontSize:12, color:'var(--ink-1)' }}>
                {Math.abs(pnlPct).toFixed(1)}% / {target}%
              </span>
            </div>
            <div style={{ position:'relative', height:8, borderRadius:4,
              background:'var(--abyss-0)', border:'1px solid var(--hair)', overflow:'hidden' }}>
              <div style={{ position:'absolute', inset:0, opacity:.5,
                backgroundImage:'repeating-linear-gradient(90deg, transparent 0 19px, rgba(255,255,255,.12) 19px 20px)' }}/>
              <div style={{ position:'absolute', left:0, top:0, bottom:0, width:`${progress}%`,
                background: lossy
                  ? 'linear-gradient(90deg, rgba(77,138,255,.5), var(--down))'
                  : 'linear-gradient(90deg, rgba(239,77,77,.5), var(--sonar))' }}/>
            </div>
          </div>

          {/* cash / invested split */}
          <div style={{ marginTop:24, display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <div style={{ padding:'14px 16px', borderRadius:12,
              background:'var(--abyss-0)', border:'1px solid var(--hair)' }}>
              <div style={{ fontSize:11, color:'var(--ink-2)', letterSpacing:'.04em' }}>현금 (정박)</div>
              <div className="mono" style={{ marginTop:6, fontSize:17, fontWeight:600 }}>{wKRW(cash)}</div>
            </div>
            <div style={{ padding:'14px 16px', borderRadius:12,
              background:'var(--abyss-0)', border:'1px solid var(--hair)' }}>
              <div style={{ fontSize:11, color:'var(--ink-2)', letterSpacing:'.04em' }}>투자 (항해 중)</div>
              <div className="mono" style={{ marginTop:6, fontSize:17, fontWeight:600 }}>{wKRW(invested)}</div>
            </div>
          </div>
        </div>

        {/* right — sonar */}
        <div style={{ padding:'24px', display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center',
          background:'radial-gradient(80% 80% at 50% 50%, rgba(91,157,255,.04), transparent)' }}>
          <div style={{ fontSize:10.5, letterSpacing:'.2em', color:'var(--ink-2)',
            fontWeight:600, marginBottom:14, alignSelf:'flex-start' }}>포지션 소나</div>
          <Sonar blips={blips} />
          <div style={{ marginTop:14, display:'flex', gap:16, fontSize:11, color:'var(--ink-2)' }}>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background:'var(--up)' }}/>상승
            </span>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background:'var(--down)' }}/>하락
            </span>
          </div>
        </div>
      </div>
    </Panel>
  );
};

/* ============================================================ */
/* Instrument cards (3)                                          */
/* ============================================================ */
const Instruments = () => {
  const items = [
    { k:'시장 수심', v:'-0.18%', sub:'KOSDAQ · 약한 하락 해류', tone:'down',
      spark:[20,18,22,16,19,14,17,12] },
    { k:'오늘의 항로', v:'BUY 2', sub:'시그널 2건 · 관망 1건', tone:'sonar',
      spark:[10,14,12,18,16,22,20,24] },
    { k:'다음 기항지', v:'04:00', sub:'연준 금리 결정 · 변동성 주의', tone:'compass',
      spark:[16,15,17,16,18,17,19,18] },
  ];
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:18 }}>
      {items.map(it => {
        const color = it.tone === 'down' ? 'var(--down)'
                    : it.tone === 'compass' ? 'var(--compass)' : 'var(--sonar)';
        const max = Math.max(...it.spark), min = Math.min(...it.spark);
        const pts = it.spark.map((v,i) =>
          `${(i/(it.spark.length-1))*100} ${28 - ((v-min)/((max-min)||1))*24}`).join(' L ');
        return (
          <Panel key={it.k} style={{ padding:'20px 22px' }}>
            <div style={{ fontSize:11.5, color:'var(--ink-2)', letterSpacing:'.06em',
              marginBottom:10 }}>{it.k}</div>
            <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:12 }}>
              <div>
                <div className="mono disp" style={{ fontSize:26, fontWeight:700,
                  color, letterSpacing:'-.01em' }}>{it.v}</div>
                <div style={{ fontSize:11.5, color:'var(--ink-2)', marginTop:6 }}>{it.sub}</div>
              </div>
              <svg width="80" height="30" viewBox="0 0 100 30" preserveAspectRatio="none"
                style={{ flexShrink:0 }}>
                <path d={`M ${pts}`} fill="none" stroke={color} strokeWidth="1.6"
                  vectorEffect="non-scaling-stroke"/>
              </svg>
            </div>
          </Panel>
        );
      })}
    </div>
  );
};

/* ============================================================ */
/* Positions panel (holdings)                                    */
/* ============================================================ */
const GLYPH = {
  BTC:{ bg:'#f7931a', t:'₿' }, ETH:{ bg:'#627eea', t:'Ξ' }, SOL:{ bg:'#9945ff', t:'◎' },
};
const Positions = ({ items }) => {
  const equity = items.reduce((s,h)=>s+h.value, 0);
  return (
    <Panel>
      <PanelHead kicker="CURRENT POSITIONS" title="현재 포지션"
        right={<a style={{ fontSize:12.5, color:'var(--sonar)' }}>전체 →</a>} />
      <div style={{ padding:'6px 0' }}>
        {items.map((h,i) => {
          const up = h.dPct >= 0;
          const g = GLYPH[h.sym];
          const w = (h.value / equity) * 100;
          return (
            <div key={h.sym} style={{ display:'grid',
              gridTemplateColumns:'auto 1fr auto', gap:14, alignItems:'center',
              padding:'14px 22px',
              borderTop: i ? '1px solid var(--hair)' : 'none' }}>
              <span style={{ width:34, height:34, borderRadius:10, background:g.bg,
                color:'#fff', fontSize:16, fontWeight:700,
                display:'flex', alignItems:'center', justifyContent:'center' }}>{g.t}</span>
              <div style={{ minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:14, fontWeight:600 }}>{h.name}</span>
                  <span style={{ fontSize:10, padding:'1px 6px', borderRadius:4,
                    background:'var(--sonar-dim)', color:'var(--sonar)', fontWeight:600 }}>
                    {h.sym}
                  </span>
                </div>
                {/* weight bar */}
                <div style={{ marginTop:7, height:4, borderRadius:2,
                  background:'var(--abyss-0)', overflow:'hidden', maxWidth:200 }}>
                  <div style={{ width:`${w}%`, height:'100%', background:'var(--sonar)', opacity:.6 }}/>
                </div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div className="mono" style={{ fontSize:14, fontWeight:700 }}>{wKRW(h.value)}</div>
                <div className="mono" style={{ fontSize:12, fontWeight:600, marginTop:2,
                  color: up ? 'var(--up)' : 'var(--down)' }}>
                  <Tri up={up}/>{up?'+':''}{h.dPct.toFixed(2)}%
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
};

/* ============================================================ */
/* Sailing strategy panel                                        */
/* ============================================================ */
const SailingStrategy = ({ name, invested, pnlPct, breakdown }) => {
  const lossy = pnlPct < 0;
  return (
    <Panel>
      <PanelHead kicker="ACTIVE ROUTE" title="항해 중인 항로"
        right={<span style={{ fontSize:11, padding:'3px 9px', borderRadius:999,
          background:'var(--sonar-dim)', color:'var(--sonar)', fontWeight:700,
          display:'inline-flex', alignItems:'center', gap:6 }}>
          <span style={{ width:5, height:5, borderRadius:'50%', background:'var(--sonar)',
            animation:'dot 2s ease-in-out infinite' }}/>운항중
        </span>} />
      <div style={{ padding:'20px 22px' }}>
        <div style={{ fontSize:16, fontWeight:700, marginBottom:6 }}>{name}</div>
        <div style={{ fontSize:12.5, color:'var(--ink-2)' }}>
          투자 <span className="mono" style={{ color:'var(--ink-0)', fontWeight:600 }}>{wKRW(invested)}</span>
        </div>
        <div style={{ marginTop:16, padding:'16px 18px', borderRadius:12,
          background: lossy ? 'rgba(77,138,255,.07)' : 'rgba(239,77,77,.07)',
          border: `1px solid ${lossy ? 'rgba(77,138,255,.22)' : 'rgba(239,77,77,.22)'}` }}>
          <div className="mono disp" style={{ fontSize:28, fontWeight:700,
            color: lossy ? 'var(--down)' : 'var(--up)' }}>
            <Tri up={!lossy}/>{pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
          </div>
        </div>
        <div style={{ marginTop:16, display:'flex', flexWrap:'wrap', gap:14, fontSize:12.5 }}>
          {breakdown.map((b,i) => (
            <React.Fragment key={b.sym}>
              {i > 0 && <span style={{ color:'var(--ink-3)' }}>·</span>}
              <span style={{ color:'var(--ink-1)' }}>{b.sym}{' '}
                <span className="mono" style={{ fontWeight:600,
                  color: b.pct >= 0 ? 'var(--up)' : 'var(--down)' }}>
                  {b.pct >= 0 ? '+' : ''}{b.pct.toFixed(1)}%</span></span>
            </React.Fragment>
          ))}
        </div>
      </div>
    </Panel>
  );
};

/* ============================================================ */
/* Compass quick-nav                                             */
/* ============================================================ */
const Compass = () => {
  const items = [
    ['거래하기','시장가·지정가 가상 매매','swap'],
    ['전략 백테스트','과거 데이터로 검증','route'],
    ['시세 살펴보기','실시간 시장 수심','sonar'],
    ['전략 학습','고래 튜터와 함께','book'],
  ];
  return (
    <Panel>
      <PanelHead kicker="QUICK BEARINGS" title="어디로 항해할까요?" />
      <div style={{ padding:'10px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        {items.map(([t,s,ic]) => (
          <a key={t} style={{ display:'flex', flexDirection:'column', gap:10,
            padding:'16px 16px', borderRadius:12, cursor:'pointer',
            background:'var(--abyss-0)', border:'1px solid var(--hair)',
            transition:'border-color .15s, background .15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(91,157,255,.32)';
              e.currentTarget.style.background = 'var(--abyss-2)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--hair)';
              e.currentTarget.style.background = 'var(--abyss-0)'; }}>
            <span style={{ width:34, height:34, borderRadius:10,
              background:'var(--sonar-dim)', color:'var(--sonar)',
              border:'1px solid rgba(239,77,77,.22)',
              display:'flex', alignItems:'center', justifyContent:'center' }}>
              <NavIcon kind={ic} />
            </span>
            <div>
              <div style={{ fontSize:13.5, fontWeight:600 }}>{t}</div>
              <div style={{ fontSize:11.5, color:'var(--ink-2)', marginTop:3 }}>{s}</div>
            </div>
          </a>
        ))}
      </div>
    </Panel>
  );
};

/* ============================================================ */
/* App                                                           */
/* ============================================================ */
function ConsoleHome() {
  const cash = 7_000_001;
  const holdings = [
    { sym:'BTC', name:'비트코인', value:898_235, dPct:-10.09, x:64, y:34 },
    { sym:'ETH', name:'이더리움', value:869_407, dPct:-12.97, x:38, y:60 },
    { sym:'SOL', name:'솔라나',   value:875_504, dPct:-12.38, x:62, y:68 },
  ];
  const invested = holdings.reduce((s,h)=>s+h.value, 0);
  const total = cash + invested;
  const pnlAbs = -356_852;
  const pnlPct = -3.57;
  const blips = holdings.map(h => ({ sym:h.sym, x:h.x, y:h.y, up:h.dPct >= 0 }));

  return (
    <>
      <Sidebar active="home" />
      <Shell>
        <Topbar coord="N 37.50° · E 127.04°" session="2026.05.31 (일) · 정규장 마감 · 다음 개장 09:00" />
        <main style={{ padding:'28px 32px 64px',
          display:'flex', flexDirection:'column', gap:18, maxWidth:1320, margin:'0 auto' }}>
          {/* greeting */}
          <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between',
            flexWrap:'wrap', gap:10 }}>
            <h1 className="disp" style={{ fontSize:24, fontWeight:700, letterSpacing:'-.01em' }}>
              김병하 항해사님, 오늘도 깊은 바다로.
            </h1>
            <span style={{ fontSize:12.5, color:'var(--ink-2)' }}>
              마지막 입항 · 2일 전
            </span>
          </div>

          <HelmHero total={total} pnlAbs={pnlAbs} pnlPct={pnlPct}
            cash={cash} invested={invested} blips={blips} target={10} />

          <Instruments />

          <div style={{ display:'grid', gridTemplateColumns:'1.5fr 1fr', gap:18,
            alignItems:'start' }}>
            <Positions items={holdings} />
            <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
              <SailingStrategy name="골든크로스 추종 전략" invested={2_997_002}
                pnlPct={-11.81}
                breakdown={[{sym:'BTC',pct:-10.1},{sym:'ETH',pct:-13.0},{sym:'SOL',pct:-12.4}]} />
            </div>
          </div>

          <Compass />

          <footer style={{ marginTop:8, paddingTop:20, borderTop:'1px solid var(--hair)',
            display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
            <span className="mono" style={{ fontSize:11.5, color:'var(--ink-3)' }}>
              © 2026 WHALEARC · 모든 항해는 사용자의 책임 아래 진행됩니다.
            </span>
            <span style={{ fontSize:11.5, color:'var(--ink-3)' }}>Built quietly, beneath the surface.</span>
          </footer>
        </main>
      </Shell>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<ConsoleHome />);
