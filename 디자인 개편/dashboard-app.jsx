/* Dashboard main content + App composition */

/* ----------------------------------------------------------- */
/* Connect account empty state                                  */
/* ----------------------------------------------------------- */
const sourceMeta = {
  kis:    { name:'KIS (한국투자증권)', kind:'주식',  guide:'KIS Developers에서 발급' },
  upbit:  { name:'Upbit',              kind:'코인',  guide:'Upbit 마이페이지 → Open API' },
  bitget: { name:'Bitget',             kind:'코인',  guide:'Bitget API Management' },
};

const ConnectCard = ({ source }) => {
  const m = sourceMeta[source];
  return (
    <article style={cardSx}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
        <span style={kickerSx}>STEP 1 · 계좌 연결</span>
        <span style={{ fontSize:11, padding:'3px 8px', borderRadius:5,
          background:'rgba(255,205,120,.10)', color:'#ffcd78',
          border:'1px solid rgba(255,205,120,.24)',
          fontWeight:700, letterSpacing:'.06em' }}>미연결</span>
      </div>
      <h3 style={{ margin:'0 0 8px', fontSize:22, fontWeight:700, letterSpacing:'-.01em' }}>
        {m.name} 키를 등록해주세요
      </h3>
      <p style={{ margin:0, fontSize:14.5, lineHeight:1.6, color:'var(--ink-1)', maxWidth:540 }}>
        API 키를 등록하면 보유 {m.kind} 종목과 잔고가 이 화면에서
        실시간으로 갱신됩니다. 키는 암호화되어 안전하게 보관돼요.
      </p>

      {/* 3-step pipeline preview */}
      <div style={{ marginTop:28, display:'grid',
        gridTemplateColumns:'1fr 24px 1fr 24px 1fr', alignItems:'stretch', gap:0 }}>
        <Step n="01" t="API 키 발급" s={m.guide} />
        <Arrow />
        <Step n="02" t="WhaleArc에 등록" s="2분 안에 완료 · 키는 암호화 저장" />
        <Arrow />
        <Step n="03" t="자동 동기화" s="0.2초 간격 시세 + 잔고 실시간" active />
      </div>

      <div style={{ marginTop:28, display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
        <PrimaryButton>API 키 등록하기 →</PrimaryButton>
        <a style={linkSx}>발급 가이드 보기 ↗</a>
        <span style={{ marginLeft:'auto', fontSize:12, color:'var(--ink-2)',
          display:'inline-flex', alignItems:'center', gap:8 }}>
          <LockIcon/> 키는 AES-256으로 암호화 저장 · 출금 권한 요청하지 않음
        </span>
      </div>
    </article>
  );
};

const Step = ({ n, t, s, active }) => (
  <div style={{
    padding:'18px 18px', borderRadius:12,
    background: active ? 'rgba(91,157,255,.08)' : 'rgba(255,255,255,.025)',
    border: active ? '1px solid rgba(91,157,255,.28)' : '1px solid var(--line)',
  }}>
    <div className="mono" style={{ fontSize:11, color: active ? 'var(--accent-glow)' : 'var(--ink-3)',
      letterSpacing:'.1em', fontWeight:700, marginBottom:6 }}>{n}</div>
    <div style={{ fontSize:14.5, fontWeight:600, marginBottom:4 }}>{t}</div>
    <div style={{ fontSize:12.5, color:'var(--ink-2)', lineHeight:1.5 }}>{s}</div>
  </div>
);

const Arrow = () => (
  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', color:'var(--ink-3)' }}>
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 7H12 M8 3 L12 7 L8 11" stroke="currentColor" strokeWidth="1.4"
        strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </div>
);

const LockIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <rect x="2.5" y="5.5" width="7" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.2"/>
    <path d="M4 5.5V4a2 2 0 1 1 4 0v1.5" stroke="currentColor" strokeWidth="1.2"/>
  </svg>
);

/* ----------------------------------------------------------- */
/* VIRT card                                                    */
/* ----------------------------------------------------------- */
const VirtCardLarge = () => (
  <article style={{
    position:'relative', overflow:'hidden',
    padding:'28px 32px', borderRadius:18,
    background:'linear-gradient(135deg, rgba(91,157,255,.14), rgba(91,157,255,.03) 60%, transparent)',
    border:'1px solid rgba(91,157,255,.28)',
  }}>
    {/* glow */}
    <div aria-hidden style={{ position:'absolute', right:-60, top:-60, width:260, height:260,
      borderRadius:'50%',
      background:'radial-gradient(closest-side, rgba(91,157,255,.25), transparent)' }}/>
    {/* mini equity curve at right */}
    <div aria-hidden style={{ position:'absolute', right:32, bottom:24, width:200, height:60,
      opacity:.7, pointerEvents:'none' }}>
      <svg viewBox="0 0 200 60" width="100%" height="100%" preserveAspectRatio="none">
        <defs>
          <linearGradient id="virt-fill-mini" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#ef4d4d" stopOpacity=".35"/>
            <stop offset="100%" stopColor="#ef4d4d" stopOpacity="0"/>
          </linearGradient>
        </defs>
        <path d="M0 44 C 20 42, 40 36, 60 38 S 100 28, 130 22 S 170 14, 200 6"
          fill="none" stroke="#ef4d4d" strokeWidth="1.4"/>
        <path d="M0 44 C 20 42, 40 36, 60 38 S 100 28, 130 22 S 170 14, 200 6 L 200 60 L 0 60 Z"
          fill="url(#virt-fill-mini)"/>
      </svg>
    </div>

    <div style={{ position:'relative', maxWidth:520 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
        <VirtBadge/>
        <span style={kickerSx}>가상 항해 · 체험하기</span>
      </div>
      <h3 style={{ margin:'0 0 8px', fontSize:22, fontWeight:700, letterSpacing:'-.01em' }}>
        먼저 가상으로, 안전하게 시작해보세요.
      </h3>
      <p style={{ margin:0, fontSize:14.5, lineHeight:1.6, color:'var(--ink-1)' }}>
        가상돈 <span className="mono" style={{ color:'#fff', fontWeight:600 }}>₩10,000,000</span>
        으로 주식·코인 매매를 실험할 수 있어요. 결과는 그대로 백테스트가 됩니다.
      </p>
      <div style={{ marginTop:16, display:'flex', gap:10, flexWrap:'wrap' }}>
        {['백테스팅','자동 매매','무제한 리셋'].map(t => (
          <span key={t} style={{
            fontSize:12, padding:'5px 10px', borderRadius:999,
            background:'rgba(255,255,255,.05)', border:'1px solid var(--line)',
            color:'var(--ink-1)', fontWeight:500,
          }}>· {t}</span>
        ))}
      </div>
      <div style={{ marginTop:22, display:'flex', alignItems:'center', gap:14 }}>
        <PrimaryButton>VIRT 모드 시작하기 →</PrimaryButton>
        <a style={linkSx}>어떻게 동작하나요? ↗</a>
      </div>
    </div>
  </article>
);

/* ----------------------------------------------------------- */
/* Onboarding tip                                               */
/* ----------------------------------------------------------- */
const TipBanner = ({ onDismiss }) => (
  <article style={{
    padding:'16px 20px', borderRadius:12,
    background:'rgba(255,255,255,.03)',
    border:'1px solid var(--line)',
    display:'flex', alignItems:'center', gap:16,
  }}>
    <span style={{
      width:32, height:32, borderRadius:'50%',
      background:'rgba(91,157,255,.12)', color:'var(--accent-glow)',
      display:'flex', alignItems:'center', justifyContent:'center',
      border:'1px solid rgba(91,157,255,.2)',
    }}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M7 6V10 M7 4.2V4.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    </span>
    <div style={{ flex:1 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
        <span style={{ fontSize:13.5, fontWeight:600 }}>처음이신가요? 화면 가이드 받기</span>
        <span style={{ fontSize:11, color:'var(--ink-2)' }}>· 약 3분</span>
      </div>
      {/* progress */}
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <div style={{ width:140, height:4, borderRadius:2,
          background:'rgba(255,255,255,.08)', overflow:'hidden' }}>
          <div style={{ width:'25%', height:'100%',
            background:'linear-gradient(90deg, #5b9dff, #2c6fe6)' }}/>
        </div>
        <span className="mono" style={{ fontSize:11, color:'var(--ink-2)' }}>1 / 4</span>
      </div>
    </div>
    <button style={{
      padding:'8px 14px', borderRadius:8, border:'1px solid var(--line-strong)',
      background:'transparent', color:'#fff', fontSize:13, fontWeight:500,
      cursor:'pointer', fontFamily:'inherit',
    }}>가이드 시작 →</button>
    <button onClick={onDismiss} style={{
      width:28, height:28, borderRadius:8, border:0, background:'transparent',
      color:'var(--ink-2)', cursor:'pointer',
    }}>✕</button>
  </article>
);

/* ----------------------------------------------------------- */
/* Watchlist empty                                              */
/* ----------------------------------------------------------- */
const WatchlistCard = () => (
  <article style={{ ...cardSx, padding:0, minHeight:340 }}>
    <header style={cardHeaderSx}>
      <h3 style={cardHeaderTitle}>관심 종목</h3>
      <a style={cardHeaderLink}>종목 편집 →</a>
    </header>
    <div style={{ padding:'18px 28px 28px' }}>
    <p style={{ margin:'0 0 22px', fontSize:12.5, color:'var(--ink-2)' }}>
      추가한 종목의 실시간 시세를 한눈에 봅니다.
    </p>

    {/* faint placeholder rows */}
    <div style={{ position:'relative' }}>
      {[0,1,2].map(i => (
        <div key={i} style={{
          display:'grid', gridTemplateColumns:'80px 1fr 100px 70px',
          alignItems:'center', padding:'14px 4px',
          borderBottom:'1px solid var(--line)',
          opacity: 0.35 - i*0.08,
        }}>
          <span style={{ width:48, height:10, borderRadius:3,
            background:'rgba(255,255,255,.06)' }}/>
          <span style={{ width:120, height:10, borderRadius:3,
            background:'rgba(255,255,255,.05)' }}/>
          <span style={{ width:60, height:10, borderRadius:3,
            background:'rgba(255,255,255,.05)', justifySelf:'end' }}/>
          <span style={{ width:40, height:10, borderRadius:3,
            background:'rgba(255,255,255,.05)', justifySelf:'end' }}/>
        </div>
      ))}

      {/* empty state overlay */}
      <div style={{
        position:'absolute', inset:0,
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        textAlign:'center', gap:14,
        background:'linear-gradient(180deg, transparent, rgba(10,18,48,.85) 40%)',
      }}>
        <div style={{
          width:44, height:44, borderRadius:12,
          background:'rgba(91,157,255,.08)', border:'1px solid rgba(91,157,255,.18)',
          display:'flex', alignItems:'center', justifyContent:'center',
          color:'var(--accent-glow)',
        }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 3 L12.3 7.6 L17.5 8.3 L13.7 11.9 L14.7 17 L10 14.5 L5.3 17 L6.3 11.9 L2.5 8.3 L7.7 7.6 Z"
              stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="none"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize:15, fontWeight:600, marginBottom:4 }}>관심 종목이 없습니다</div>
          <div style={{ fontSize:12.5, color:'var(--ink-2)', maxWidth:280 }}>
            프로필에서 종목을 추가하면 여기에 실시간 시세가 표시됩니다.
          </div>
        </div>
        <button style={{
          marginTop:4, padding:'10px 18px', borderRadius:10,
          border:'1px solid rgba(91,157,255,.3)',
          background:'rgba(91,157,255,.10)', color:'#fff',
          fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
        }}>+ 관심 종목 추가하기</button>
      </div>
    </div>
    </div>
  </article>
);

/* ----------------------------------------------------------- */
/* Quick actions panel                                          */
/* ----------------------------------------------------------- */
const quickItems = [
  ['시세 확인하기', '12,000+ 자산 실시간', 'chart'],
  ['내 포트폴리오', '연결된 계좌 잔고·수익률', 'pie'],
  ['전략 백테스트', '과거 데이터로 시뮬레이션', 'flask'],
  ['전략 학습', '검증된 전략을 단계별로', 'book'],
  ['투자 현황 보기', '거래 내역과 일일 손익', 'list'],
  ['API · 내 자산 연동', '거래소 키 등록 / 관리', 'plug', true],
];

const QuickIcon = ({ kind }) => {
  const c = 'currentColor';
  const paths = {
    chart: <path d="M3 17 L8 11 L13 15 L19 7" stroke={c} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    pie:   <><circle cx="11" cy="11" r="7" stroke={c} strokeWidth="1.5"/><path d="M11 4 A7 7 0 0 1 18 11 L11 11 Z" fill={c} opacity=".5"/></>,
    flask: <><path d="M9 3v5L4 17a1.5 1.5 0 0 0 1.3 2h11.4A1.5 1.5 0 0 0 18 17l-5-9V3" stroke={c} strokeWidth="1.5" fill="none" strokeLinejoin="round"/><path d="M8 3h6" stroke={c} strokeWidth="1.5" strokeLinecap="round"/></>,
    book:  <path d="M4 4h6a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H4z M18 4h-6a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h7z" stroke={c} strokeWidth="1.5" fill="none" strokeLinejoin="round"/>,
    list:  <><path d="M5 6h12 M5 11h12 M5 16h8" stroke={c} strokeWidth="1.5" strokeLinecap="round"/></>,
    plug:  <><path d="M8 3v4 M14 3v4" stroke={c} strokeWidth="1.5" strokeLinecap="round"/><rect x="5" y="7" width="12" height="6" rx="2" stroke={c} strokeWidth="1.5" fill="none"/><path d="M11 13v3a3 3 0 0 1-3 3H7" stroke={c} strokeWidth="1.5" fill="none" strokeLinecap="round"/></>,
  };
  return <svg width="22" height="22" viewBox="0 0 22 22" fill="none">{paths[kind]}</svg>;
};

const QuickActions = () => (
  <article style={{ ...cardSx, padding:0 }}>
    <header style={{ ...cardHeaderSx, alignItems:'flex-start' }}>
      <div>
        <h3 style={cardHeaderTitle}>어디로 항해할까요?</h3>
        <p style={{ margin:'4px 0 0', fontSize:12.5, color:'var(--ink-2)' }}>
          자주 가는 곳을 모았어요.
        </p>
      </div>
    </header>
    <ul style={{ margin:0, padding:'10px 0', listStyle:'none',
      display:'flex', flexDirection:'column', gap:2 }}>
      {quickItems.map(([t, s, k, accent], i) => (
        <li key={t}>
          <a style={{
            display:'grid', gridTemplateColumns:'40px 1fr auto', alignItems:'center',
            gap:14, padding:'12px 20px', cursor:'pointer',
            borderTop: i === quickItems.length-1 ? '1px solid var(--line)' : 'none',
            marginTop: i === quickItems.length-1 ? 10 : 0,
            paddingTop: i === quickItems.length-1 ? 16 : 12,
          }}>
            <span style={{
              width:36, height:36, borderRadius:10,
              background: accent ? 'rgba(91,157,255,.14)' : 'rgba(255,255,255,.04)',
              border: accent ? '1px solid rgba(91,157,255,.28)' : '1px solid var(--line)',
              color: accent ? 'var(--accent-glow)' : 'var(--ink-1)',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}><QuickIcon kind={k}/></span>
            <div>
              <div style={{ fontSize:14, fontWeight: accent ? 700 : 600,
                color: accent ? '#fff' : '#fff' }}>{t}</div>
              <div style={{ fontSize:12, color:'var(--ink-2)', marginTop:2 }}>{s}</div>
            </div>
            <span style={{ color: accent ? 'var(--accent-glow)' : 'var(--ink-3)',
              fontSize:14 }}>→</span>
          </a>
        </li>
      ))}
    </ul>
  </article>
);

/* ----------------------------------------------------------- */
/* Shared styles                                                */
/* ----------------------------------------------------------- */
const cardSx = {
  padding:'28px 32px',
  borderRadius:18,
  background:'linear-gradient(180deg, rgba(255,255,255,.035), rgba(255,255,255,.012))',
  border:'1px solid var(--line)',
  position:'relative',
  overflow:'hidden',
};
const cardHeaderSx = {
  padding:'20px 28px',
  borderBottom:'1px solid var(--line)',
  display:'flex', alignItems:'center', justifyContent:'space-between',
  gap:12,
};
const cardHeaderTitle = {
  margin:0, fontSize:16, fontWeight:700, letterSpacing:'-.005em',
};
const cardHeaderLink = {
  fontSize:12.5, color:'var(--accent-glow)', cursor:'pointer', fontWeight:500,
};
const kickerSx = {
  fontSize:11, letterSpacing:'.18em', color:'#9cc1ff',
  fontWeight:600, textTransform:'uppercase',
};
const linkSx = {
  fontSize:13.5, fontWeight:500, color:'var(--ink-1)', cursor:'pointer',
};

Object.assign(window, { ConnectCard, VirtCardLarge, TipBanner, WatchlistCard, QuickActions,
  cardSx, cardHeaderSx, cardHeaderTitle, cardHeaderLink, kickerSx, linkSx });

/* ----------------------------------------------------------- */
/* App                                                          */
/* ----------------------------------------------------------- */
function DashboardApp() {
  const [source, setSource] = React.useState('kis');
  const [tipDismissed, setTipDismissed] = React.useState(false);

  return (
    <>
      <DashNav />
      <WelcomeStrip />
      <SourceTabs active={source} onChange={setSource} />

      <main style={{ padding:'24px 32px 80px',
        display:'grid', gridTemplateColumns:'minmax(0, 1.6fr) minmax(320px, 1fr)',
        gap:24, alignItems:'start' }}>
        {/* LEFT column */}
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
          <ConnectCard source={source} />
          <VirtCardLarge />
          {!tipDismissed && <TipBanner onDismiss={() => setTipDismissed(true)} />}
          <WatchlistCard />
        </div>
        {/* RIGHT column */}
        <div style={{ display:'flex', flexDirection:'column', gap:20, position:'sticky', top:96 }}>
          <QuickActions />
          <TodaysSignalsCard />
        </div>
      </main>

      <footer style={{ padding:'40px 32px 28px', borderTop:'1px solid var(--line)',
        display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:14 }}>
        <span className="mono" style={{ fontSize:12, color:'var(--ink-3)' }}>
          © 2026 WhaleArc Labs · 모든 항해는 사용자의 책임 아래 진행됩니다.
        </span>
        <div style={{ display:'flex', gap:18, fontSize:12.5, color:'var(--ink-2)' }}>
          <a>도움말</a><a>상태</a><a>API</a><a>의견 보내기</a>
        </div>
      </footer>
    </>
  );
}

/* small signals card on the right rail */
const TodaysSignalsCard = () => (
  <article style={{ ...cardSx, padding:0 }}>
    <header style={cardHeaderSx}>
      <h3 style={{ ...cardHeaderTitle, fontSize:15 }}>오늘의 시그널</h3>
      <span style={{ fontSize:11, color:'var(--ink-3)', letterSpacing:'.08em' }}>06:00 갱신</span>
    </header>
    <div style={{ padding:'4px 22px 18px' }}>
    {[
      ['BUY','시장 변동성 하락','VIX 14.2 · 매수 구간 진입','#ef4d4d'],
      ['NOTE','연준 발표 예정','내일 새벽 04:00 · 금리 결정','#cfa14b'],
      ['INFO','VIRT를 먼저','연결된 계좌가 없습니다 — 가상으로 연습해보세요','#9cc1ff'],
    ].map(([tag,t,s,c]) => (
      <div key={t} style={{ padding:'12px 0', borderTop:'1px solid var(--line)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
          <span style={{ fontSize:10, padding:'2px 6px', borderRadius:4,
            background:'rgba(255,255,255,.06)', color:c, fontWeight:700,
            letterSpacing:'.08em' }}>{tag}</span>
        </div>
        <div style={{ fontSize:13.5, fontWeight:600, marginBottom:4 }}>{t}</div>
        <div style={{ fontSize:12, color:'var(--ink-2)' }}>{s}</div>
      </div>
    ))}
    </div>
  </article>
);

ReactDOM.createRoot(document.getElementById('root')).render(<DashboardApp />);
