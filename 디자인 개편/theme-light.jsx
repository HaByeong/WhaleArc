/* theme-light.jsx — shared light-mode primitives for all no-VIRT light pages */

const lt_card = {
  background:'var(--bg-1)',
  borderRadius:16,
  border:'1px solid var(--line)',
  boxShadow:'0 1px 0 rgba(14,25,54,.02), 0 6px 24px -16px rgba(14,25,54,.10)',
  position:'relative',
  overflow:'hidden',
};

const lt_iconBtn = {
  width:36, height:36, borderRadius:10,
  border:'1px solid var(--line)', background:'var(--bg-1)',
  color:'var(--ink-1)', cursor:'pointer',
  display:'flex', alignItems:'center', justifyContent:'center',
};

const lt_pillBtn = (kind) => ({
  padding:'10px 18px', borderRadius:10, cursor:'pointer',
  fontFamily:'inherit', fontSize:13.5, fontWeight:600,
  display:'inline-flex', alignItems:'center', whiteSpace:'nowrap',
  textDecoration:'none',
  ...(kind === 'primary' ? {
    border:0,
    background:'linear-gradient(180deg, var(--accent-glow), var(--accent))',
    color:'#fff',
    boxShadow:'0 6px 14px -8px rgba(60,120,255,.5)',
  } : kind === 'up' ? {
    border:0,
    background:'linear-gradient(180deg, var(--up), #0d8a3f)',
    color:'#fff',
  } : kind === 'down' ? {
    border:0,
    background:'linear-gradient(180deg, var(--down), #c73838)',
    color:'#fff',
  } : kind === 'ghost-danger' ? {
    border:'1px solid rgba(239,68,68,.32)', background:'transparent',
    color:'var(--down)',
  } : {
    border:'1px solid var(--line-strong)', background:'var(--bg-1)',
    color:'var(--ink-0)',
  }),
});

const lt_kicker = {
  fontSize:11, letterSpacing:'.18em', color:'var(--accent)',
  fontWeight:600, textTransform:'uppercase',
};

const lt_cardHeader = {
  padding:'20px 28px',
  borderBottom:'1px solid var(--line)',
  display:'flex', alignItems:'center', justifyContent:'space-between',
  gap:12,
};

const lt_cardTitle = {
  margin:0, fontSize:16, fontWeight:700, letterSpacing:'-.005em',
  color:'var(--ink-0)',
};

const lt_cardLink = {
  fontSize:12.5, color:'var(--accent)', cursor:'pointer', fontWeight:500,
};

/* ----------------------------------------------------------- */
/* Light DashNav                                                 */
/* ----------------------------------------------------------- */
const LtLogo = () => (
  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M2 13 Q6 5 11 9 Q16 13 20 6" stroke="var(--ink-0)" strokeWidth="2"
        strokeLinecap="round" fill="none"/>
      <circle cx="11" cy="9" r="1.6" fill="var(--ink-0)"/>
    </svg>
    <span style={{ fontSize:15, fontWeight:700, letterSpacing:'.14em',
      color:'var(--ink-0)' }}>WHALEARC</span>
  </div>
);

const LtDashNav = ({ active = '내 투자' }) => {
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
      <a href="WhaleArc.html"><LtLogo /></a>
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
        <a style={{ fontSize:13, color:'var(--ink-1)', cursor:'pointer' }}>의견 보내기</a>
        <button title="다크 모드" style={lt_iconBtn}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M12 9.5A5 5 0 0 1 6.5 4a.5.5 0 0 0-.7-.5A6 6 0 1 0 12.5 10.2a.5.5 0 0 0-.5-.7Z"
              stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
          </svg>
        </button>
        <button title="알림" style={{ ...lt_iconBtn, position:'relative' }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3.5 11.5h9l-1-1.2V7.2a3.5 3.5 0 1 0-7 0v3.1l-1 1.2Z"
              stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
            <path d="M6.5 13.2a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <span style={{ position:'absolute', top:-4, right:-4, minWidth:18, height:18,
            padding:'0 5px', borderRadius:999, background:'#ef4444', color:'#fff',
            fontSize:10.5, fontWeight:700,
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:'0 0 0 2px var(--bg-0)' }}>3</span>
        </button>
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
        <a style={{ fontSize:13, color:'var(--ink-2)', cursor:'pointer' }}>로그아웃</a>
      </div>
    </header>
  );
};

const LtFooter = () => (
  <footer style={{ padding:'40px 32px 28px', borderTop:'1px solid var(--line)',
    display:'flex', alignItems:'center', justifyContent:'space-between',
    flexWrap:'wrap', gap:14 }}>
    <span className="mono" style={{ fontSize:12, color:'var(--ink-2)' }}>
      © 2026 WhaleArc Labs · 모든 항해는 사용자의 책임 아래 진행됩니다.
    </span>
    <div style={{ display:'flex', gap:18, fontSize:12.5, color:'var(--ink-1)' }}>
      <a>도움말</a><a>상태</a><a>API</a><a>의견 보내기</a>
    </div>
  </footer>
);

Object.assign(window, {
  lt_card, lt_iconBtn, lt_pillBtn, lt_kicker,
  lt_cardHeader, lt_cardTitle, lt_cardLink,
  LtLogo, LtDashNav, LtFooter,
});
