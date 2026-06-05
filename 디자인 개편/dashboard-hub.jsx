/* dashboard-hub.jsx — 하이브리드: 기존 카드 디자인 + Helm 사이드바 + 소나 레이더 */

/* ---- compact sonar radar (welcome banner) ---- */
const MiniSonar = ({ blips }) => (
  <div style={{ position:'relative', width:172, height:172 }}>
    <svg viewBox="0 0 200 200" width="100%" height="100%">
      <defs>
        <radialGradient id="ms-g" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(124,196,255,.18)"/>
          <stop offset="60%" stopColor="rgba(91,157,255,.06)"/>
          <stop offset="100%" stopColor="rgba(91,157,255,0)"/>
        </radialGradient>
        <linearGradient id="ms-sweep" x1="1" x2="0" y1="0" y2="0.35">
          <stop offset="0%" stopColor="rgba(124,196,255,.55)"/>
          <stop offset="55%" stopColor="rgba(124,196,255,.12)"/>
          <stop offset="100%" stopColor="rgba(124,196,255,0)"/>
        </linearGradient>
        <radialGradient id="ms-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#bfe0ff"/>
          <stop offset="100%" stopColor="#5b9dff"/>
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="94" fill="url(#ms-g)"/>
      {/* rings */}
      {[32,60,88].map((r,i) => (
        <circle key={r} cx="100" cy="100" r={r} fill="none"
          stroke="rgba(160,200,255,.18)" strokeWidth="1"
          strokeDasharray={i===2 ? '2 4' : 'none'} />
      ))}
      <circle cx="100" cy="100" r="94" fill="none" stroke="rgba(160,200,255,.28)" strokeWidth="1"/>
      {/* bearing ticks */}
      {Array.from({length:24}).map((_,i) => {
        const a = (i/24)*Math.PI*2, r1=88, r2= i%6===0?80:85;
        return <line key={i} x1={100+Math.cos(a)*r1} y1={100+Math.sin(a)*r1}
          x2={100+Math.cos(a)*r2} y2={100+Math.sin(a)*r2}
          stroke="rgba(160,200,255,.3)" strokeWidth={i%6===0?1.4:0.8}/>;
      })}
      {/* axes */}
      <line x1="12" y1="100" x2="188" y2="100" stroke="rgba(160,200,255,.12)" strokeWidth="1"/>
      <line x1="100" y1="12" x2="100" y2="188" stroke="rgba(160,200,255,.12)" strokeWidth="1"/>
    </svg>
    {/* sweep */}
    <div style={{ position:'absolute', inset:0, animation:'sonar-sweep 4.5s linear infinite' }}>
      <svg viewBox="0 0 200 200" width="100%" height="100%">
        <path d="M100 100 L100 6 A94 94 0 0 1 175 40 Z" fill="url(#ms-sweep)"/>
        <line x1="100" y1="100" x2="100" y2="6" stroke="#bfe0ff" strokeWidth="1.5"
          style={{ filter:'drop-shadow(0 0 4px rgba(124,196,255,.9))' }}/>
      </svg>
    </div>
    {/* core hub */}
    <span style={{ position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)',
      width:8, height:8, borderRadius:'50%', background:'url(#ms-core), #bfe0ff',
      boxShadow:'0 0 10px rgba(124,196,255,.9)' }}/>
    {/* blips */}
    {blips.map((b,i) => {
      const col = '#ef4d4d';
      const c = '#ef4d4d';
      return (
        <div key={b.sym} style={{ position:'absolute', left:`${b.x}%`, top:`${b.y}%`, transform:'translate(-50%,-50%)', textAlign:'center' }}>
          <span style={{ position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)',
            width:18, height:18, borderRadius:'50%', border:`1px solid ${c}`,
            animation:`pulse-ring 2.6s ease-out ${i*.5}s infinite` }}/>
          <span style={{ display:'block', width:7, height:7, borderRadius:'50%', background:c,
            boxShadow:`0 0 8px ${c}` }}/>
          <span className="mono" style={{ position:'absolute', top:9, left:'50%', transform:'translateX(-50%)',
            fontSize:8.5, color:'rgba(255,255,255,.62)', whiteSpace:'nowrap', letterSpacing:'.04em' }}>{b.sym}</span>
        </div>
      );
    })}
  </div>
);

/* ---- Welcome banner (기존 그라데이션 + 소나) ---- */
const Welcome = ({ blips }) => (
  <section style={{ position:'relative', overflow:'hidden', borderRadius:18,
    background:'radial-gradient(120% 100% at 80% 20%, #1d3a7a 0%, #0e1a3d 55%, #0a1230 100%)',
    border:'1px solid var(--hair-strong)' }}>
    <div aria-hidden style={{ position:'absolute', inset:0,
      background:'radial-gradient(40% 60% at 20% 90%, rgba(80,140,255,.18), transparent 70%)' }}/>
    <div style={{ position:'relative', padding:'34px 38px', display:'grid',
      gridTemplateColumns:'1fr auto', gap:24, alignItems:'center' }}>
      <div>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--sonar)',
            boxShadow:'0 0 8px var(--sonar)', animation:'dot 2.4s ease-in-out infinite' }}/>
          <span style={{ fontSize:11.5, letterSpacing:'.18em', color:'#9cc1ff', fontWeight:600 }}>
            TODAY · 5월 31일 (일) · 오후 4:32
          </span>
        </div>
        <h1 className="disp" style={{ fontSize:32, lineHeight:1.2, fontWeight:700, letterSpacing:'-.01em' }}>
          김병하님, 다시 바다에 오셨군요.
        </h1>
        <p style={{ margin:'10px 0 0', fontSize:15, color:'var(--ink-1)' }}>오늘도 시장의 바다를 유영해볼까요?</p>
        <div style={{ marginTop:24, display:'flex', alignItems:'center', gap:30,
          paddingTop:18, borderTop:'1px solid rgba(255,255,255,.1)', maxWidth:520, flexWrap:'wrap' }}>
          {[['KOSPI','2,712.18','+0.42%',true],['KOSDAQ','872.46','-0.18%',false],
            ['BTC/KRW','94.2M','+1.24%',true],['USD/KRW','1,362.4','+0.06%',true]].map(([n,v,d,u])=>(
            <div key={n} style={{ display:'flex', flexDirection:'column', gap:2 }}>
              <span style={{ fontSize:10.5, color:'var(--ink-2)', letterSpacing:'.12em', fontWeight:600 }}>{n}</span>
              <span className="mono" style={{ fontSize:14, fontWeight:600 }}>{v}</span>
              <span className="mono" style={{ fontSize:11, fontWeight:600, color: u?'var(--up)':'var(--down)' }}>{d}</span>
            </div>
          ))}
        </div>
      </div>
      {/* sonar */}
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
        <MiniSonar blips={blips} />
        <span style={{ fontSize:10.5, letterSpacing:'.16em', color:'var(--ink-2)', fontWeight:600 }}>포지션 소나</span>
      </div>
    </div>
  </section>
);

/* ---- Source tabs ---- */
const SOURCES = [['kis','주식','KIS'],['upbit','코인','Upbit'],['bitget','코인','Bitget']];
const SourceTabs = ({ active, onChange }) => (
  <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
    {SOURCES.map(([k,l,b]) => {
      const on = active===k;
      return (
        <button key={k} onClick={()=>onChange(k)} style={{
          display:'inline-flex', alignItems:'center', gap:8, padding:'9px 16px', borderRadius:10,
          border: on ? '1px solid rgba(91,157,255,.35)' : '1px solid var(--hair)',
          background: on ? 'var(--sonar-dim)' : 'var(--abyss-1)',
          color:'var(--ink-0)', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
          {l}
          <span style={{ fontSize:11, padding:'2px 7px', borderRadius:5, fontWeight:700,
            background: on ? 'rgba(91,157,255,.22)' : 'rgba(255,255,255,.06)',
            color: on ? '#cfe1ff' : 'var(--ink-1)' }}>{b}</span>
          <span style={{ fontSize:11, color:'var(--ink-3)' }}>· 미연결</span>
        </button>
      );
    })}
    <button style={{ padding:'9px 14px', borderRadius:10, border:'1px dashed var(--hair-strong)',
      background:'transparent', color:'var(--ink-1)', fontSize:13.5, fontWeight:500, cursor:'pointer', fontFamily:'inherit' }}>
      + 자산 추가</button>
  </div>
);

/* ---- Connect card (기존 3-step) ---- */
const Step = ({ n, t, s, active }) => (
  <div style={{ padding:'18px', borderRadius:12,
    background: active ? 'var(--sonar-dim)' : 'var(--abyss-0)',
    border: active ? '1px solid rgba(91,157,255,.28)' : '1px solid var(--hair)' }}>
    <div className="mono" style={{ fontSize:11, color: active?'var(--sonar)':'var(--ink-3)', letterSpacing:'.1em', fontWeight:700, marginBottom:6 }}>{n}</div>
    <div style={{ fontSize:14.5, fontWeight:600, marginBottom:4 }}>{t}</div>
    <div style={{ fontSize:12.5, color:'var(--ink-2)', lineHeight:1.5 }}>{s}</div>
  </div>
);
const ConnectCard = () => (
  <Panel style={{ padding:'28px 30px' }}>
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
      <span style={{ fontSize:11, letterSpacing:'.18em', color:'#9cc1ff', fontWeight:600 }}>STEP 1 · 계좌 연결</span>
      <span style={{ fontSize:11, padding:'3px 8px', borderRadius:5, background:'var(--warn-bg)', color:'var(--warn-fg)',
        border:'1px solid var(--warn-border)', fontWeight:700, letterSpacing:'.06em' }}>미연결</span>
    </div>
    <h3 style={{ fontSize:22, fontWeight:700, margin:'8px 0' }}>KIS (한국투자증권) 키를 등록해주세요</h3>
    <p style={{ margin:0, fontSize:14.5, lineHeight:1.6, color:'var(--ink-1)', maxWidth:540 }}>
      API 키를 등록하면 보유 주식 종목과 잔고가 실시간으로 갱신됩니다. 키는 암호화되어 안전하게 보관돼요.
    </p>
    <div style={{ marginTop:28, display:'grid', gridTemplateColumns:'1fr 22px 1fr 22px 1fr', alignItems:'stretch' }}>
      <Step n="01" t="API 키 발급" s="KIS Developers에서 발급" />
      <ArrowMini /><Step n="02" t="WhaleArc에 등록" s="2분 안에 완료 · 암호화 저장" />
      <ArrowMini /><Step n="03" t="자동 동기화" s="0.2초 간격 시세 + 잔고" active />
    </div>
    <div style={{ marginTop:26, display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
      <button style={{ padding:'15px 24px', borderRadius:12,
        border:'1px solid rgba(140,190,255,.5)',
        background:'linear-gradient(180deg, #4d8aff 0%, #2c6fe6 62%, #2257c8 100%)', color:'#fff',
        fontSize:14.5, fontWeight:600, cursor:'pointer', fontFamily:'inherit', letterSpacing:'.01em',
        display:'inline-flex', alignItems:'center', gap:10,
        boxShadow:'0 12px 28px -12px rgba(44,111,230,.7), inset 0 1px 0 rgba(255,255,255,.38), inset 0 -2px 6px rgba(8,20,50,.28)' }}>
        API 키 등록하기
        <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center',
          width:20, height:20, borderRadius:'50%', background:'rgba(255,255,255,.18)', fontSize:12 }}>→</span>
      </button>
      <span style={{ marginLeft:'auto', fontSize:12, color:'var(--ink-2)' }}>🔒 AES-256 암호화 · 출금 권한 미요청</span>
    </div>
  </Panel>
);
const ArrowMini = () => (
  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', color:'var(--ink-3)' }}>
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7H12 M8 3 L12 7 L8 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
  </div>
);

/* ---- VIRT card ---- */
const VirtCard = () => (
  <Panel style={{ padding:'26px 30px',
    background:'linear-gradient(135deg, rgba(91,157,255,.14), rgba(91,157,255,.03) 60%, transparent)',
    border:'1px solid rgba(91,157,255,.28)' }}>
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
      <span style={{ fontSize:10.5, padding:'3px 8px', borderRadius:5, background:'var(--sonar)', color:'#fff', fontWeight:700, letterSpacing:'.06em' }}>VIRT</span>
      <span style={{ fontSize:11, letterSpacing:'.18em', color:'#9cc1ff', fontWeight:600 }}>가상 항해 · 체험하기</span>
    </div>
    <h3 style={{ fontSize:21, fontWeight:700, margin:'4px 0 8px' }}>먼저 가상으로, 안전하게 시작해보세요.</h3>
    <p style={{ margin:0, fontSize:14.5, lineHeight:1.6, color:'var(--ink-1)' }}>
      가상돈 <span className="mono" style={{ color:'#fff', fontWeight:700 }}>₩10,000,000</span>으로 주식·코인 매매를 실험할 수 있어요.
    </p>
    <a href="virt.html" style={{ display:'inline-flex', alignItems:'center', gap:10, marginTop:20,
      padding:'14px 24px', borderRadius:12,
      border:'1px solid rgba(140,190,255,.5)',
      background:'linear-gradient(180deg, #4d8aff 0%, #2c6fe6 62%, #2257c8 100%)', color:'#fff',
      fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit', letterSpacing:'.01em',
      boxShadow:'0 12px 28px -12px rgba(44,111,230,.7), inset 0 1px 0 rgba(255,255,255,.38), inset 0 -2px 6px rgba(8,20,50,.28)' }}>
      VIRT 모드 시작하기
      <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center',
        width:20, height:20, borderRadius:'50%', background:'rgba(255,255,255,.18)', fontSize:12 }}>→</span>
    </a>
  </Panel>
);

/* ---- Quick actions ---- */
const quick = [
  ['시세 확인하기','12,000+ 자산 실시간','sonar','console-markets.html'],
  ['내 포트폴리오','연결 계좌 잔고·수익률','pie','console-portfolio.html'],
  ['전략 백테스트','과거 데이터로 시뮬레이션','route','#'],
  ['전략 학습','검증된 전략을 단계별로','book','#'],
];
const QuickActions = () => (
  <Panel style={{ padding:0 }}>
    <PanelHead kicker="QUICK BEARINGS" title="어디로 항해할까요?" />
    <ul style={{ margin:0, padding:'10px 0', listStyle:'none' }}>
      {quick.map(([t,s,ic,href],i) => (
        <li key={t}>
          <a href={href} style={{ display:'grid', gridTemplateColumns:'38px 1fr auto', alignItems:'center',
            gap:14, padding:'12px 22px', cursor:'pointer' }}>
            <span style={{ width:34, height:34, borderRadius:10, background:'var(--sonar-dim)', color:'var(--sonar)',
              border:'1px solid rgba(91,157,255,.22)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <NavIcon kind={ic} /></span>
            <div><div style={{ fontSize:14, fontWeight:600 }}>{t}</div>
              <div style={{ fontSize:12, color:'var(--ink-2)', marginTop:2 }}>{s}</div></div>
            <span style={{ color:'var(--ink-3)' }}>→</span>
          </a>
        </li>
      ))}
    </ul>
  </Panel>
);

/* ---- Signals ---- */
const Signals = () => (
  <Panel style={{ padding:0 }}>
    <PanelHead title="오늘의 시그널" right={<span style={{ fontSize:11, color:'var(--ink-3)' }}>06:00 갱신</span>} />
    <div style={{ padding:'4px 22px 18px' }}>
      {[['BUY','시장 변동성 하락','VIX 14.2 · 매수 구간','var(--up)'],
        ['NOTE','연준 발표 예정','내일 04:00 · 금리 결정','var(--compass)'],
        ['INFO','VIRT를 먼저','연결 계좌 없음 — 가상으로 연습','var(--sonar)']].map(([tag,t,s,c])=>(
        <div key={t} style={{ padding:'12px 0', borderTop:'1px solid var(--hair)' }}>
          <span style={{ fontSize:10, padding:'2px 6px', borderRadius:4, background:'rgba(255,255,255,.06)', color:c, fontWeight:700, letterSpacing:'.08em' }}>{tag}</span>
          <div style={{ fontSize:13.5, fontWeight:600, margin:'7px 0 4px' }}>{t}</div>
          <div style={{ fontSize:12, color:'var(--ink-2)' }}>{s}</div>
        </div>
      ))}
    </div>
  </Panel>
);

/* ---- App ---- */
function Hub() {
  const [src, setSrc] = React.useState('kis');
  const blips = [{ sym:'BTC', x:64, y:34, up:false },{ sym:'ETH', x:38, y:60, up:false },{ sym:'SOL', x:62, y:68, up:false }];
  return (
    <>
      <Sidebar active="home" />
      <Shell>
        <Topbar coord="N 37.50° · E 127.04°" session="2026.05.31 (일) · 정규장 마감 · 다음 개장 09:00" />
        <main style={{ padding:'28px 32px 64px', maxWidth:1320, margin:'0 auto',
          display:'flex', flexDirection:'column', gap:20 }}>
          <Welcome blips={blips} />
          <SourceTabs active={src} onChange={setSrc} />
          <div style={{ display:'grid', gridTemplateColumns:'minmax(0, 1.6fr) minmax(300px, 1fr)', gap:20, alignItems:'start' }}>
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
              <ConnectCard />
              <VirtCard />
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:20, position:'sticky', top:88 }}>
              <QuickActions />
              <Signals />
            </div>
          </div>
          <footer style={{ marginTop:8, paddingTop:20, borderTop:'1px solid var(--hair)',
            display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
            <span className="mono" style={{ fontSize:11.5, color:'var(--ink-3)' }}>© 2026 WHALEARC · 모든 항해는 사용자의 책임 아래 진행됩니다.</span>
          </footer>
        </main>
      </Shell>
    </>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<Hub />);
