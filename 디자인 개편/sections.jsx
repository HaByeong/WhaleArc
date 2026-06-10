/* Landing page sections — features, dashboard preview, VIRT, ticker, CTA, footer */

/* ----------------------------------------------------------- */
/* Shared section header                                       */
/* ----------------------------------------------------------- */
const SectionHeader = ({ kicker, title, lede, align='left' }) => (
  <div style={{ textAlign:align, maxWidth: align==='center' ? 720 : 640,
    margin: align==='center' ? '0 auto 56px' : '0 0 56px' }}>
    <div style={{ display:'flex', justifyContent: align==='center' ? 'center' : 'flex-start',
      marginBottom:14 }}>
      <span style={{ fontSize:11.5, letterSpacing:'.24em', color:'#9cc1ff',
        fontWeight:600, textTransform:'uppercase' }}>{kicker}</span>
    </div>
    <h2 style={{ margin:0, fontSize:48, lineHeight:1.12, fontWeight:700,
      letterSpacing:'-.02em' }}>{title}</h2>
    {lede && (
      <p style={{ marginTop:16, fontSize:17, lineHeight:1.65,
        color:'var(--ink-1)' }}>{lede}</p>
    )}
  </div>
);

/* ----------------------------------------------------------- */
/* FEATURES — 4 cards                                          */
/* ----------------------------------------------------------- */
const featureItems = [
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <path d="M3 18 L8 12 L13 16 L18 8 L25 14" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <circle cx="8" cy="12" r="1.6" fill="currentColor"/>
        <circle cx="13" cy="16" r="1.6" fill="currentColor"/>
        <circle cx="18" cy="8" r="1.6" fill="currentColor"/>
      </svg>
    ),
    title:'실시간 시세 스트림',
    body:'KIS 모의투자 API로 국내 주식·코인 시세를 추적합니다. 대시보드에서 보유 종목과 함께.',
    meta:'KOSPI · KOSDAQ · 빗썸',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <circle cx="14" cy="14" r="9" stroke="currentColor" strokeWidth="2"/>
        <path d="M9 13 Q 11 9 14 13 Q 17 17 19 12" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" fill="none"/>
        <circle cx="14" cy="13" r="1" fill="currentColor"/>
      </svg>
    ),
    title:'고래 튜터와 전략 학습',
    body:'골든크로스·RSI·볼린저 등 8가지 검증된 전략을 챗으로 쉽게 알려드려요. 용어 설명과 예시까지.',
    meta:'8개 기본 전략 · 초급~고급',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <rect x="4" y="6" width="20" height="16" rx="3" stroke="currentColor" strokeWidth="2"/>
        <path d="M4 11 H24" stroke="currentColor" strokeWidth="2"/>
        <circle cx="8" cy="8.5" r="1" fill="currentColor"/>
        <circle cx="11" cy="8.5" r="1" fill="currentColor"/>
        <text x="14" y="18.5" fill="currentColor" fontSize="6" fontWeight="700"
          fontFamily="ui-monospace, monospace">VIRT</text>
      </svg>
    ),
    title:'VIRT 가상 항해',
    body:'실제 시세로 움직이는 모의 계좌. 전략을 실험하고, 실수해도 자산은 안전하게 지킵니다.',
    meta:'가상돈 ₩1,000만 · 무제한 리셋',
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <rect x="4" y="4" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="2"/>
        <rect x="15" y="4" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="2"/>
        <rect x="4" y="15" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="2"/>
        <rect x="15" y="15" width="9" height="9" rx="1.5" fill="currentColor"/>
      </svg>
    ),
    title:'전략 라이브러리',
    body:'검증된 전략을 선택해 투자금·종목·기간을 설정하면, 수익률 · MDD · 승률 · 샤프 비율까지 한 화면에서.',
    meta:'8개 전략 · 백테스트 내장',
  },
];

const FeatureCard = ({ item, i }) => (
  <article style={{
    position:'relative',
    padding:'32px 28px',
    borderRadius:18,
    background:'linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.015))',
    border:'1px solid var(--line)',
    overflow:'hidden',
  }}>
    {/* accent corner */}
    <div aria-hidden style={{ position:'absolute', top:-40, right:-40, width:160, height:160,
      borderRadius:'50%',
      background:'radial-gradient(closest-side, rgba(91,157,255,.18), transparent)' }}/>
    <div style={{ position:'relative' }}>
      <div style={{
        width:48, height:48, borderRadius:12,
        background:'rgba(91,157,255,.12)', color:'var(--accent-glow)',
        display:'flex', alignItems:'center', justifyContent:'center',
        marginBottom:24, border:'1px solid rgba(91,157,255,.22)',
      }}>{item.icon}</div>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
        <span className="mono" style={{ fontSize:11, color:'var(--ink-3)', letterSpacing:'.1em' }}>
          0{i+1}
        </span>
        <span style={{ fontSize:11, color:'var(--ink-2)', letterSpacing:'.06em' }}>{item.meta}</span>
      </div>
      <h3 style={{ margin:'0 0 10px', fontSize:20, fontWeight:700, letterSpacing:'-.01em' }}>
        {item.title}
      </h3>
      <p style={{ margin:0, fontSize:14.5, lineHeight:1.6, color:'var(--ink-1)' }}>
        {item.body}
      </p>
    </div>
  </article>
);

const Features = () => (
  <section style={{ padding:'120px 56px', background:'var(--bg-0)' }}>
    <div style={{ maxWidth:1240, margin:'0 auto' }}>
      <SectionHeader
        kicker="핵심 기능"
        title={<>시장을 읽는 네 가지 도구.</>}
        lede="시세 · 전략 학습 · 백테스트 · VIRT 가상 거래를 한 갑판 위에 올렸어요."
      />
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:20 }}>
        {featureItems.map((it, i) => <FeatureCard key={it.title} item={it} i={i} />)}
      </div>
    </div>
  </section>
);

/* ----------------------------------------------------------- */
/* DASHBOARD PREVIEW                                           */
/* ----------------------------------------------------------- */
const sparkPath = "M0 40 C 20 30, 40 35, 60 25 S 100 10, 130 18 S 180 30, 220 14 S 260 8, 300 20";
const sparkPathDown = "M0 20 C 20 28, 40 22, 60 30 S 100 38, 130 32 S 180 24, 220 36 S 260 42, 300 30";

const Sparkline = ({ up=true, w=300, h=44 }) => (
  <svg width={w} height={h} viewBox="0 0 300 44" style={{ display:'block' }}>
    <defs>
      <linearGradient id={up?'spk-u':'spk-d'} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor={up?'#ef4d4d':'#4d8aff'} stopOpacity=".4"/>
        <stop offset="100%" stopColor={up?'#ef4d4d':'#4d8aff'} stopOpacity="0"/>
      </linearGradient>
    </defs>
    <path d={up?sparkPath:sparkPathDown} fill="none"
      stroke={up?'#ef4d4d':'#4d8aff'} strokeWidth="1.6" strokeLinecap="round"/>
    <path d={`${up?sparkPath:sparkPathDown} L 300 44 L 0 44 Z`} fill={`url(#${up?'spk-u':'spk-d'})`}/>
  </svg>
);

const DashboardPreview = () => {
  const holdings = [
    ['BTC','비트코인',      '900,368', '-9.87%',  false, '9.3%'],
    ['ETH','이더리움',    '869,407', '-12.97%', false, '9.0%'],
    ['SOL','솔라나',          '874,769', '-12.44%', false, '9.1%'],
  ];
  return (
    <section style={{ padding:'40px 56px 120px', background:'var(--bg-0)' }}>
      <div style={{ maxWidth:1240, margin:'0 auto' }}>
        <SectionHeader
          kicker="PRODUCT TOUR"
          title="한 화면에서 시장의 깊이를 본다."
          lede="시세, 보유 자산, 전략, 시그널을 한 갑판에 모았습니다. 작업 흐름을 끊지 않는 정보 밀도."
        />

        {/* macOS-window style frame */}
        <div style={{
          borderRadius:18, overflow:'hidden',
          border:'1px solid var(--line-strong)',
          background:'linear-gradient(180deg, #0d1736, #080e25)',
          boxShadow:'0 60px 120px -40px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.04)',
        }}>
          {/* title bar */}
          <div style={{
            display:'flex', alignItems:'center', gap:10, padding:'12px 16px',
            borderBottom:'1px solid var(--line)', background:'rgba(255,255,255,.02)',
          }}>
            <span style={{ width:11, height:11, borderRadius:'50%', background:'#ff5f57' }}/>
            <span style={{ width:11, height:11, borderRadius:'50%', background:'#febc2e' }}/>
            <span style={{ width:11, height:11, borderRadius:'50%', background:'#28c840' }}/>
            <span style={{ marginLeft:16, fontSize:12, color:'var(--ink-2)', letterSpacing:'.04em' }}>
              app.whalearc.io / dashboard
            </span>
          </div>

          {/* body grid */}
          <div style={{ display:'grid', gridTemplateColumns:'200px 1fr 280px',
            minHeight:520 }}>
            {/* sidebar */}
            <aside style={{ borderRight:'1px solid var(--line)', padding:'20px 14px',
              display:'flex', flexDirection:'column', gap:4 }}>
              {[
                ['내 투자', true],
                ['포트폴리오', false],
                ['시세', false],
                ['거래', false],
                ['전략', false],
                ['전략 학습', false],
                ['투자 현황', false],
                ['VIRT 대시보드', false, true],
              ].map(([label, active, virt]) => (
                <div key={label} style={{
                  padding:'9px 12px', borderRadius:8, fontSize:13,
                  color: active ? '#fff' : 'var(--ink-1)',
                  background: active ? 'rgba(91,157,255,.14)' : 'transparent',
                  border: active ? '1px solid rgba(91,157,255,.24)' : '1px solid transparent',
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  fontWeight: active ? 600 : 500,
                }}>
                  {label}
                  {virt && <span style={{ fontSize:9, padding:'2px 5px', borderRadius:4,
                    background:'rgba(180,210,255,.18)', color:'#cfe1ff',
                    fontWeight:700, letterSpacing:'.06em' }}>VIRT</span>}
                </div>
              ))}
            </aside>

            {/* main */}
            <main style={{ padding:'24px 28px' }}>
              <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between',
                marginBottom:6 }}>
                <div style={{ fontSize:13, color:'var(--ink-2)', letterSpacing:'.06em' }}>
                  내 포트폴리오
                </div>
                <div className="mono" style={{ fontSize:12, color:'var(--ink-2)' }}>
                  업데이트 0.2s 전
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'baseline', gap:14, flexWrap:'wrap' }}>
                <span className="mono" style={{ fontSize:38, fontWeight:600,
                  letterSpacing:'-.02em' }}>
                  ₩ 9,644,546
                </span>
                <span style={{ fontSize:14, color:'var(--down)', fontWeight:600 }}>
                  -3.55% (-₩ 356,852)
                </span>
                <span style={{ fontSize:11, padding:'2px 7px', borderRadius:5,
                  background:'rgba(180,210,255,.18)', color:'#cfe1ff',
                  fontWeight:700, letterSpacing:'.06em' }}>VIRT</span>
              </div>

              {/* chart card */}
              <div style={{ marginTop:24, padding:20, borderRadius:14,
                background:'rgba(255,255,255,.025)', border:'1px solid var(--line)' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div style={{ display:'flex', gap:8 }}>
                    {['1D','1W','1M','3M','1Y','ALL'].map((t,i) => (
                      <span key={t} style={{
                        padding:'5px 11px', borderRadius:6, fontSize:12, fontWeight:600,
                        color: i===2 ? '#fff' : 'var(--ink-2)',
                        background: i===2 ? 'rgba(91,157,255,.16)' : 'transparent',
                        border: i===2 ? '1px solid rgba(91,157,255,.3)' : '1px solid transparent',
                      }}>{t}</span>
                    ))}
                  </div>
                  <span className="mono" style={{ fontSize:12, color:'var(--ink-2)' }}>
                    KRW · Spot
                  </span>
                </div>
                <div style={{ marginTop:14, height:180, position:'relative' }}>
                  <BigChart />
                </div>
              </div>

              {/* holdings */}
              <div style={{ marginTop:20 }}>
                <div style={{ display:'grid',
                  gridTemplateColumns:'90px 1fr 120px 80px 110px 70px',
                  fontSize:11, color:'var(--ink-3)', letterSpacing:'.1em',
                  textTransform:'uppercase', padding:'0 4px 8px',
                  borderBottom:'1px solid var(--line)' }}>
                  <span>자산</span><span>이름</span><span style={{ textAlign:'right' }}>가격</span>
                  <span style={{ textAlign:'right' }}>24h</span>
                  <span style={{ textAlign:'right' }}>추이</span>
                  <span style={{ textAlign:'right' }}>비중</span>
                </div>
                {holdings.map(([sym,name,price,delta,up,w], i) => (
                  <div key={sym} style={{ display:'grid',
                    gridTemplateColumns:'90px 1fr 120px 80px 110px 70px',
                    alignItems:'center', padding:'12px 4px',
                    borderBottom: i<holdings.length-1 ? '1px solid var(--line)' : 'none',
                    fontSize:13.5 }}>
                    <span style={{ fontWeight:700, letterSpacing:'.06em' }}>{sym}</span>
                    <span style={{ color:'var(--ink-1)' }}>{name}</span>
                    <span className="mono" style={{ textAlign:'right' }}>{price}</span>
                    <span className="mono" style={{ textAlign:'right',
                      color: up ? 'var(--up)' : 'var(--down)', fontWeight:600 }}>{delta}</span>
                    <span style={{ display:'flex', justifyContent:'flex-end' }}>
                      <Sparkline up={up} w={96} h={28}/>
                    </span>
                    <span className="mono" style={{ textAlign:'right', color:'var(--ink-1)' }}>{w}</span>
                  </div>
                ))}
              </div>
            </main>

            {/* right rail — 항해 중인 전략 + 빠른 액션 */}
            <aside style={{ borderLeft:'1px solid var(--line)', padding:'22px 20px' }}>
              <div style={{ fontSize:11.5, color:'var(--ink-2)', letterSpacing:'.16em',
                fontWeight:600, marginBottom:14 }}>항해 중인 항로</div>
              <div style={{ padding:'14px 14px', borderRadius:12, marginBottom:14,
                background:'linear-gradient(135deg, rgba(91,157,255,.14), rgba(91,157,255,.04))',
                border:'1px solid rgba(91,157,255,.28)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                  <span style={{ width:5, height:5, borderRadius:'50%',
                    background:'var(--up)' }}/>
                  <span style={{ fontSize:10, padding:'2px 6px', borderRadius:4,
                    background:'rgba(239,77,77,.18)', color:'var(--up)', fontWeight:700,
                    letterSpacing:'.08em' }}>운항중</span>
                </div>
                <div style={{ fontSize:13.5, fontWeight:700, marginBottom:4 }}>
                  골든크로스 추종 전략
                </div>
                <div style={{ fontSize:11.5, color:'var(--ink-2)' }}>
                  투자 ₩2,997,002 · BTC·ETH·SOL
                </div>
              </div>

              <div style={{ fontSize:11.5, color:'var(--ink-2)', letterSpacing:'.16em',
                fontWeight:600, marginBottom:10 }}>빠른 액션</div>
              {[
                ['거래하기', '→'],
                ['전략 백테스트', '→'],
                ['이는 VIRT에서 먼저', '→'],
              ].map(([t,arr]) => (
                <div key={t} style={{ padding:'12px 14px', borderRadius:10, marginBottom:8,
                  background:'rgba(255,255,255,.025)', border:'1px solid var(--line)',
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  fontSize:13, fontWeight:600 }}>
                  <span>{t}</span>
                  <span style={{ color:'var(--ink-3)' }}>{arr}</span>
                </div>
              ))}
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
};

/* big chart inside the dashboard */
const BigChart = () => {
  // build a soft sine-ish chart line
  const W = 100, H = 100;
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const x = (i/40) * W;
    const t = i/40;
    const y = 60 - Math.sin(t*Math.PI*1.6) * 16 - t*14 + Math.sin(t*9) * 3;
    pts.push([x, y]);
  }
  const d = 'M ' + pts.map(p => p.join(' ')).join(' L ');
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none">
      <defs>
        <linearGradient id="bigchart-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#5b9dff" stopOpacity=".35"/>
          <stop offset="100%" stopColor="#5b9dff" stopOpacity="0"/>
        </linearGradient>
        <linearGradient id="bigchart-line" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#9cc1ff"/>
          <stop offset="100%" stopColor="#5b9dff"/>
        </linearGradient>
      </defs>
      {/* grid */}
      {[0,25,50,75,100].map(y => (
        <line key={y} x1="0" x2="100" y1={y} y2={y}
          stroke="rgba(255,255,255,.06)" strokeWidth=".3" />
      ))}
      <path d={d+' L 100 100 L 0 100 Z'} fill="url(#bigchart-fill)"/>
      <path d={d} fill="none" stroke="url(#bigchart-line)" strokeWidth=".7"
        vectorEffect="non-scaling-stroke"/>
      {/* end dot */}
      <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r=".9"
        fill="#fff" stroke="#5b9dff" strokeWidth=".4"/>
    </svg>
  );
};

Object.assign(window, { Features, DashboardPreview, SectionHeader });
