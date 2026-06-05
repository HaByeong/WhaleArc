/* VIRT — shared parts (brand, nav, buttons, cards) for light-mode VIRT pages */

/* ============================================================ */
/* Brand                                                          */
/* ============================================================ */
const VirtLogo = () => (
  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
    {/* friendlier whale icon for VIRT */}
    <svg width="28" height="22" viewBox="0 0 32 24" fill="none">
      <defs>
        <linearGradient id="vlg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#5b9dff"/>
          <stop offset="100%" stopColor="#2c6fe6"/>
        </linearGradient>
      </defs>
      <path d="M3 16 Q 8 5 16 8 Q 24 11 28 6 L 30 10 L 28 13 L 26 14 Q 22 18 14 17 Q 8 17 5 19 Q 3 18 3 16 Z"
        fill="url(#vlg)"/>
      <circle cx="10" cy="13" r="1" fill="#fff"/>
    </svg>
    <span style={{ fontSize:15, fontWeight:700, letterSpacing:'.12em',
      color:'var(--ink-0)' }}>
      WHALEARC<span style={{ color:'var(--accent)' }}>-VIRT</span>
    </span>
  </div>
);

/* ============================================================ */
/* Top nav                                                        */
/* ============================================================ */
const VirtNav = ({ active = '내 투자' }) => {
  const items = ['내 투자','포트폴리오','시세','거래','전략','전략 학습','투자 현황'];
  const [cur, setCur] = React.useState(active);
  return (
    <header style={{
      position:'sticky', top:0, zIndex:50,
      background:'rgba(255,255,255,.85)',
      backdropFilter:'blur(14px)',
      borderBottom:'1px solid var(--line)',
      display:'grid', gridTemplateColumns:'auto 1fr auto', alignItems:'center',
      padding:'14px 24px', gap:20,
    }}>
      <a href="WhaleArc.html"><VirtLogo /></a>
      <nav style={{ display:'flex', alignItems:'center', gap:4, justifyContent:'flex-start',
        overflowX:'auto' }} className="no-scrollbar">
        {items.map(it => (
          <a key={it} onClick={() => setCur(it)} style={{
            padding:'8px 12px', borderRadius:8, fontSize:13.5, fontWeight:500,
            color: it === cur ? 'var(--accent)' : 'var(--ink-1)',
            background: it === cur ? 'var(--accent-bg)' : 'transparent',
            cursor:'pointer', whiteSpace:'nowrap', flexShrink:0,
          }}>{it}</a>
        ))}
      </nav>
      <div style={{ display:'flex', alignItems:'center', gap:10, whiteSpace:'nowrap' }}>
        <a style={{ fontSize:13, color:'var(--ink-1)', cursor:'pointer',
          whiteSpace:'nowrap' }}>의견 보내기</a>
        <VirtIconBtn title="실전 모드로">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.4" fill="none"/>
            <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
              <line x1="8" y1="1.5" x2="8" y2="3"/>
              <line x1="8" y1="13" x2="8" y2="14.5"/>
              <line x1="1.5" y1="8" x2="3" y2="8"/>
              <line x1="13" y1="8" x2="14.5" y2="8"/>
              <line x1="3.5" y1="3.5" x2="4.5" y2="4.5"/>
              <line x1="11.5" y1="11.5" x2="12.5" y2="12.5"/>
              <line x1="3.5" y1="12.5" x2="4.5" y2="11.5"/>
              <line x1="11.5" y1="4.5" x2="12.5" y2="3.5"/>
            </g>
          </svg>
        </VirtIconBtn>
        <VirtIconBtn title="알림" badge={3}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3.5 11.5h9l-1-1.2V7.2a3.5 3.5 0 1 0-7 0v3.1l-1 1.2Z"
              stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
            <path d="M6.5 13.2a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </VirtIconBtn>
        <div style={{ display:'flex', alignItems:'center', gap:8,
          padding:'5px 12px 5px 5px', borderRadius:999,
          background:'var(--bg-2)', border:'1px solid var(--line)',
          cursor:'pointer' }}>
          <span style={{
            width:26, height:26, borderRadius:'50%',
            background:'linear-gradient(135deg, #5b9dff, #2c6fe6)',
            color:'#fff', fontSize:12, fontWeight:700,
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>김</span>
          <span style={{ fontSize:13, fontWeight:600 }}>김병하</span>
        </div>
        <a style={{ fontSize:13, color:'var(--ink-2)', cursor:'pointer',
          whiteSpace:'nowrap' }}>로그아웃</a>
      </div>
    </header>
  );
};

const VirtIconBtn = ({ children, title, badge }) => (
  <button title={title} style={{
    position:'relative', width:36, height:36, borderRadius:10,
    border:'1px solid var(--line)', background:'var(--bg-1)',
    color:'var(--ink-1)', cursor:'pointer',
    display:'flex', alignItems:'center', justifyContent:'center',
  }}>
    {children}
    {badge && (
      <span style={{
        position:'absolute', top:-4, right:-4, minWidth:18, height:18,
        padding:'0 5px', borderRadius:999,
        background:'#ef4d4d', color:'#fff', fontSize:10.5, fontWeight:700,
        display:'flex', alignItems:'center', justifyContent:'center',
        boxShadow:'0 0 0 2px var(--bg-0)',
      }}>{badge}</span>
    )}
  </button>
);

/* ============================================================ */
/* Shared light-mode card                                         */
/* ============================================================ */
const virtCard = {
  background:'var(--bg-1)',
  borderRadius:16,
  border:'1px solid var(--line)',
  boxShadow:'0 1px 0 rgba(14,25,54,.02), 0 6px 24px -16px rgba(14,25,54,.10)',
  position:'relative',
  overflow:'hidden',
};

const cardSection = {
  padding:'22px 24px',
};

const sectionTitle = {
  fontSize:15, fontWeight:700, letterSpacing:'-.005em', margin:0,
  color:'var(--ink-0)',
};

const sectionLink = {
  fontSize:12.5, color:'var(--accent)', cursor:'pointer', fontWeight:500,
};

/* ============================================================ */
/* Currency helpers                                               */
/* ============================================================ */
const wKRW = (n) => '₩' + n.toLocaleString('ko-KR');

/* small triangle indicator (up/down) with Korean convention */
const Tri = ({ up }) => (
  <svg width="9" height="9" viewBox="0 0 10 10"
    style={{ display:'inline-block', marginRight:4, verticalAlign:'-1px' }}>
    {up
      ? <path d="M5 2 L1 8 L9 8 Z" fill="var(--up)"/>
      : <path d="M5 8 L1 2 L9 2 Z" fill="var(--down)"/>}
  </svg>
);

/* ============================================================ */
/* VIRT badge (small pill)                                        */
/* ============================================================ */
const VBadge = () => (
  <span style={{
    fontSize:10.5, padding:'2px 7px', borderRadius:5,
    background:'var(--accent-bg-strong)', color:'var(--accent)',
    fontWeight:700, letterSpacing:'.06em',
    border:'1px solid rgba(91,157,255,.30)',
  }}>VIRT</span>
);

Object.assign(window, {
  VirtLogo, VirtNav, VirtIconBtn,
  virtCard, cardSection, sectionTitle, sectionLink,
  wKRW, Tri, VBadge,
});
