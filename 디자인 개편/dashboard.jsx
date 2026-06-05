/* Dashboard — 내 투자 홈 (signed-in landing) */

/* ----------------------------------------------------------- */
/* Top app nav — product chrome (different from marketing Nav) */
/* ----------------------------------------------------------- */
const DashNav = ({ active: activeProp = '내 투자' }) => {
  const items = ['내 투자','포트폴리오','시세','거래','전략','전략 학습','투자 현황'];
  const [active, setActive] = React.useState(activeProp);
  return (
    <header style={{
      position:'sticky', top:0, zIndex:50,
      backdropFilter:'blur(14px)',
      background:'rgba(6,11,31,.72)',
      borderBottom:'1px solid var(--line)',
      display:'grid', gridTemplateColumns:'auto 1fr auto', alignItems:'center',
      padding:'14px 24px', gap:20,
    }}>
      <a href="WhaleArc.html"><Logo /></a>
      <nav style={{ display:'flex', alignItems:'center', gap:4, justifyContent:'flex-start',
        overflowX:'auto', scrollbarWidth:'none' }} className="no-scrollbar">
        {items.map(it => (
          <a key={it} onClick={() => setActive(it)} style={{
            padding:'8px 12px', borderRadius:8, fontSize:13.5, fontWeight:500,
            color: it === active ? '#fff' : 'var(--ink-1)',
            background: it === active ? 'rgba(91,157,255,.14)' : 'transparent',
            border: it === active ? '1px solid rgba(91,157,255,.24)' : '1px solid transparent',
            cursor:'pointer', whiteSpace:'nowrap', flexShrink:0,
          }}>{it}</a>
        ))}
      </nav>
      <div style={{ display:'flex', alignItems:'center', gap:10, whiteSpace:'nowrap' }}>
        <a style={{ fontSize:13, color:'var(--ink-1)', cursor:'pointer', whiteSpace:'nowrap' }}>의견 보내기</a>
        <IconBtn title="테마">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M12 9.5A5 5 0 0 1 6.5 4a.5.5 0 0 0-.7-.5A6 6 0 1 0 12.5 10.2a.5.5 0 0 0-.5-.7Z"
              stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
          </svg>
        </IconBtn>
        <IconBtn title="알림" badge={3}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3.5 11.5h9l-1-1.2V7.2a3.5 3.5 0 1 0-7 0v3.1l-1 1.2Z"
              stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
            <path d="M6.5 13.2a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </IconBtn>
        <div style={{ display:'flex', alignItems:'center', gap:8,
          padding:'5px 12px 5px 5px', borderRadius:999,
          background:'rgba(255,255,255,.04)', border:'1px solid var(--line)',
          cursor:'pointer', whiteSpace:'nowrap' }}>
          <span style={{
            width:26, height:26, borderRadius:'50%',
            background:'linear-gradient(135deg, #5b9dff, #2c6fe6)',
            color:'#fff', fontSize:12, fontWeight:700,
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>김</span>
          <span style={{ fontSize:13, fontWeight:600 }}>김병하</span>
        </div>
        <a style={{ fontSize:13, color:'var(--ink-2)', cursor:'pointer', whiteSpace:'nowrap' }}>로그아웃</a>
      </div>
    </header>
  );
};

const IconBtn = ({ children, title, badge }) => (
  <button title={title} style={{
    position:'relative', width:36, height:36, borderRadius:10,
    border:'1px solid var(--line)', background:'rgba(255,255,255,.04)',
    color:'var(--ink-1)', cursor:'pointer',
    display:'flex', alignItems:'center', justifyContent:'center',
  }}>
    {children}
    {badge && (
      <span style={{
        position:'absolute', top:-4, right:-4, minWidth:18, height:18,
        padding:'0 5px', borderRadius:999,
        background:'#ff5757', color:'#fff', fontSize:10.5, fontWeight:700,
        display:'flex', alignItems:'center', justifyContent:'center',
        boxShadow:'0 0 0 2px var(--bg-0)',
      }}>{badge}</span>
    )}
  </button>
);

/* ----------------------------------------------------------- */
/* Welcome strip                                                */
/* ----------------------------------------------------------- */
const WelcomeStrip = () => (
  <section style={{
    position:'relative',
    margin:'24px 32px 0',
    borderRadius:20,
    overflow:'hidden',
    background:'radial-gradient(120% 100% at 80% 20%, #1d3a7a 0%, #0e1a3d 55%, #0a1230 100%)',
    border:'1px solid var(--line-strong)',
  }}>
    {/* aura */}
    <div aria-hidden style={{ position:'absolute', inset:0,
      background:'radial-gradient(40% 60% at 20% 90%, rgba(80,140,255,.18), transparent 70%)' }}/>

    {/* whale glyph float right */}
    <div aria-hidden style={{
      position:'absolute', right:32, top:'50%', transform:'translateY(-50%)',
      width:240, height:160, opacity:.65, pointerEvents:'none',
    }}>
      <div style={{ width:'100%', height:'100%',
        animation:'whale-float 7s ease-in-out infinite' }}>
        <svg viewBox="0 0 240 160" width="100%" height="100%" fill="none">
          {/* stylized whale silhouette */}
          <defs>
            <linearGradient id="whaleg" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#9cc1ff" stopOpacity=".9"/>
              <stop offset="100%" stopColor="#2c6fe6" stopOpacity=".6"/>
            </linearGradient>
          </defs>
          <path d="M30 90 Q 70 50 130 60 Q 180 65 200 80 L 220 70 L 215 90 L 225 100 L 200 100
                   Q 180 115 130 110 Q 80 110 60 120 Q 45 110 30 90 Z"
            fill="url(#whaleg)" opacity=".85"/>
          <circle cx="70" cy="82" r="2.4" fill="#fff"/>
          {/* tiny candle accent (your original concept, made tasteful) */}
          <g opacity=".55">
            <rect x="115" y="78" width="2" height="10" fill="#ef4d4d"/>
            <rect x="113" y="80" width="6" height="5" fill="#ef4d4d" rx="1"/>
            <rect x="128" y="74" width="2" height="14" fill="#ef4d4d"/>
            <rect x="126" y="77" width="6" height="7" fill="#ef4d4d" rx="1"/>
            <rect x="141" y="80" width="2" height="8" fill="#4d8aff"/>
            <rect x="139" y="82" width="6" height="4" fill="#4d8aff" rx="1"/>
          </g>
        </svg>
      </div>
    </div>

    <div style={{ position:'relative', padding:'36px 40px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
        <span style={{ width:6, height:6, borderRadius:'50%',
          background:'var(--accent-glow)', boxShadow:'0 0 8px var(--accent-glow)',
          animation:'pulse-dot 2.4s ease-in-out infinite' }}/>
        <span style={{ fontSize:11.5, letterSpacing:'.18em', color:'#9cc1ff',
          fontWeight:600 }}>TODAY · 5월 28일 (목) · 오후 4:32</span>
      </div>
      <h1 style={{ margin:0, fontSize:36, lineHeight:1.2, fontWeight:700,
        letterSpacing:'-.02em' }}>
        김병하님, 다시 바다에 오셨군요.
      </h1>
      <p style={{ margin:'10px 0 0', fontSize:15, color:'var(--ink-1)' }}>
        오늘도 시장의 바다를 유영해볼까요?
      </p>

      {/* market pulse mini */}
      <div style={{ marginTop:24, display:'flex', alignItems:'center', gap:32,
        paddingTop:18, borderTop:'1px solid rgba(255,255,255,.08)', maxWidth:520 }}>
        <MiniIndex name="KOSPI"  v="2,712.18" d="+0.42%" up />
        <MiniIndex name="KOSDAQ" v="872.46"   d="-0.18%" />
        <MiniIndex name="BTC/KRW" v="94.2M"   d="+1.24%" up />
        <MiniIndex name="USD/KRW" v="1,362.4" d="+0.06%" up />
      </div>
    </div>
  </section>
);

const MiniIndex = ({ name, v, d, up }) => (
  <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
    <span style={{ fontSize:10.5, color:'var(--ink-2)', letterSpacing:'.12em',
      fontWeight:600 }}>{name}</span>
    <span className="mono" style={{ fontSize:14, fontWeight:600 }}>{v}</span>
    <span className="mono" style={{ fontSize:11, fontWeight:600,
      color: up ? 'var(--up)' : 'var(--down)' }}>{d}</span>
  </div>
);

/* ----------------------------------------------------------- */
/* Source tabs                                                  */
/* ----------------------------------------------------------- */
const SOURCES = [
  { key:'kis',    label:'주식',  badge:'KIS',    connected:false },
  { key:'upbit',  label:'코인',  badge:'Upbit',  connected:false },
  { key:'bitget', label:'코인',  badge:'Bitget', connected:false },
];

const SourceTabs = ({ active, onChange }) => (
  <div style={{ display:'flex', alignItems:'center', gap:8, padding:'0 32px',
    marginTop:24, flexWrap:'wrap' }}>
    {SOURCES.map(s => {
      const isActive = active === s.key;
      return (
        <button key={s.key} onClick={() => onChange(s.key)} style={{
          display:'inline-flex', alignItems:'center', gap:8,
          padding:'9px 16px', borderRadius:10,
          border: isActive ? '1px solid rgba(91,157,255,.35)' : '1px solid var(--line)',
          background: isActive ? 'rgba(91,157,255,.10)' : 'rgba(255,255,255,.025)',
          color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer',
          fontFamily:'inherit', whiteSpace:'nowrap', flexShrink:0,
        }}>
          {s.label}
          <span style={{
            fontSize:11, padding:'2px 7px', borderRadius:5, fontWeight:700,
            background: isActive ? 'rgba(91,157,255,.22)' : 'rgba(255,255,255,.06)',
            color: isActive ? '#cfe1ff' : 'var(--ink-1)',
            letterSpacing:'.04em',
          }}>{s.badge}</span>
          {!s.connected && (
            <span style={{ fontSize:11, color:'var(--ink-3)', marginLeft:2 }}>· 미연결</span>
          )}
        </button>
      );
    })}
    <button style={{
      padding:'9px 14px', borderRadius:10, border:'1px dashed var(--line-strong)',
      background:'transparent', color:'var(--ink-1)', fontSize:13.5, fontWeight:500,
      cursor:'pointer', fontFamily:'inherit', display:'inline-flex', alignItems:'center', gap:6,
      whiteSpace:'nowrap', flexShrink:0,
    }}>+ 자산 추가</button>
  </div>
);

Object.assign(window, { DashNav, WelcomeStrip, SourceTabs, IconBtn, SOURCES });
