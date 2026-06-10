/* helm.jsx — "항해 계기판" design system: sidebar, panels, sonar, primitives */

const NAV_ITEMS = [
  { key:'home',      label:'내 투자',    href:'dashboard-hub.html',  icon:'helm' },
  { key:'portfolio', label:'포트폴리오',  href:'console-portfolio.html', icon:'pie' },
  { key:'markets',   label:'시세',        href:'markets.html',        icon:'sonar' },
  { key:'trade',     label:'거래',        href:'trade.html',          icon:'swap' },
  { key:'strategy',  label:'전략',        href:'backtest.html',       icon:'route' },
  { key:'learn',     label:'전략 학습',   href:'console-learn.html',  icon:'book' },
  { key:'community', label:'커뮤니티',    href:'console-community.html', icon:'chat' },
  { key:'status',    label:'투자 현황',   href:'console-status.html', icon:'gauge' },
  { key:'billing',   label:'결제',        href:'console-billing.html', icon:'card' },
];

const NavIcon = ({ kind, c = 'currentColor' }) => {
  const p = {
    helm: <><circle cx="11" cy="11" r="6.5" stroke={c} strokeWidth="1.5"/><circle cx="11" cy="11" r="2" stroke={c} strokeWidth="1.5"/><g stroke={c} strokeWidth="1.5" strokeLinecap="round"><path d="M11 2v2.5M11 17.5V20M2 11h2.5M17.5 11H20M4.6 4.6l1.8 1.8M15.6 15.6l1.8 1.8M17.4 4.6l-1.8 1.8M6.4 15.6l-1.8 1.8"/></g></>,
    pie:  <><circle cx="11" cy="11" r="7" stroke={c} strokeWidth="1.5"/><path d="M11 4a7 7 0 0 1 7 7h-7z" fill={c} opacity=".55"/></>,
    sonar:<><circle cx="11" cy="11" r="2.5" stroke={c} strokeWidth="1.5"/><path d="M11 4.5a6.5 6.5 0 0 1 6.5 6.5" stroke={c} strokeWidth="1.5" strokeLinecap="round"/><path d="M11 1.5a9.5 9.5 0 0 1 9.5 9.5" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity=".5"/></>,
    swap: <><path d="M5 7h11l-3-3M17 15H6l3 3" stroke={c} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>,
    route:<><circle cx="5" cy="16" r="2.2" stroke={c} strokeWidth="1.5"/><circle cx="17" cy="6" r="2.2" stroke={c} strokeWidth="1.5"/><path d="M7 15.5q8-1 8.5-7.5" stroke={c} strokeWidth="1.5" fill="none" strokeDasharray="2 2.5" strokeLinecap="round"/></>,
    book: <path d="M4 5h5a3 3 0 0 1 2 1 3 3 0 0 1 2-1h5v11h-5a3 3 0 0 0-2 1 3 3 0 0 0-2-1H4z M11 6v11" stroke={c} strokeWidth="1.5" fill="none" strokeLinejoin="round"/>,
    gauge:<><path d="M4 15a7 7 0 1 1 14 0" stroke={c} strokeWidth="1.5" fill="none" strokeLinecap="round"/><path d="M11 15l3.5-4" stroke={c} strokeWidth="1.5" strokeLinecap="round"/><circle cx="11" cy="15" r="1.3" fill={c}/></>,
    chat:<path d="M4 5h14v9H9l-4 3v-3H4z" stroke={c} strokeWidth="1.5" fill="none" strokeLinejoin="round"/>,
    card:<><rect x="3.5" y="5.5" width="15" height="11" rx="2.2" stroke={c} strokeWidth="1.5"/><path d="M3.5 9.3h15" stroke={c} strokeWidth="1.5"/><path d="M6.2 13.2h3" stroke={c} strokeWidth="1.5" strokeLinecap="round"/></>,
  };
  return <svg width="20" height="20" viewBox="0 0 22 22" fill="none">{p[kind]}</svg>;
};

const WhaleMark = ({ size = 28 }) => (
  <img src="brand-whale.png" alt="WhaleArc" width={size}
    style={{ height:'auto', display:'block', filter:'drop-shadow(0 0 6px rgba(91,157,255,.35))' }} />
);

const Sidebar = ({ active }) => (
  <aside className="helm-aside" style={{
    position:'fixed', left:0, top:0, bottom:0, width:240, zIndex:40,
    background:'var(--aside-bg, linear-gradient(180deg, #061826, #04121d))',
    borderRight:'1px solid var(--hair)',
    display:'flex', flexDirection:'column',
    padding:'22px 16px',
  }}>
    {/* brand */}
    <a className="helm-brand" href="WhaleArc.html" title="홈페이지로" style={{ display:'flex', alignItems:'center', gap:11,
      padding:'4px 8px 22px', borderBottom:'1px solid var(--hair)' }}>
      <span style={{ position:'relative', display:'inline-flex', animation:'float-y 6s ease-in-out infinite' }}>
        <span className="wt-glow-pro" style={{ position:'absolute', inset:'-38%' }}></span>
        <span style={{ position:'relative' }}><WhaleMark /></span>
      </span>
      <span>
        <span className="disp whalearc-text" style={{ display:'block', fontSize:16, fontWeight:700,
          letterSpacing:'.12em' }}>WHALEARC</span>
        <span style={{ display:'block', fontSize:10, letterSpacing:'.22em',
          color:'var(--ink-2)', marginTop:2 }}>HELM CONSOLE</span>
      </span>
    </a>

    {/* nav */}
    <nav className="helm-nav" style={{ marginTop:18, display:'flex', flexDirection:'column', gap:3, flex:1 }}>
      <div className="navkick" style={{ fontSize:10, letterSpacing:'.2em', color:'var(--ink-3)',
        fontWeight:600, padding:'0 12px 10px' }}>항로</div>
      {NAV_ITEMS.map(it => {
        const on = it.key === active;
        return (
          <a key={it.key} href={it.href} className={on ? 'nav-active' : undefined} style={{
            position:'relative', display:'flex', alignItems:'center', gap:12,
            padding:'11px 12px', borderRadius:10, fontSize:14, fontWeight: on ? 600 : 500,
            color: on ? '#cfe1ff' : 'var(--ink-1)',
            background: on ? 'linear-gradient(180deg, rgba(91,157,255,.16), rgba(44,111,230,.07))' : 'transparent',
            border: on ? '1px solid rgba(91,157,255,.28)' : '1px solid transparent',
            boxShadow: on ? 'inset 0 1px 0 rgba(255,255,255,.08)' : 'none',
            transition:'background .15s, color .15s',
          }}
          onMouseEnter={e => { if (!on) e.currentTarget.style.background = 'var(--abyss-2)'; }}
          onMouseLeave={e => { if (!on) e.currentTarget.style.background = 'transparent'; }}>
            <NavIcon kind={it.icon} />
            <span className="navlbl">{it.label}</span>
          </a>
        );
      })}
    </nav>

    {/* VIRT pill + user */}
    <div className="helm-foot" style={{ borderTop:'1px solid var(--hair)', paddingTop:16,
      display:'flex', flexDirection:'column', gap:12 }}>
      <button onClick={() => window.toggleTheme && window.toggleTheme()} style={{
        display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'9px 12px',
        borderRadius:10, border:'1px solid var(--hair)', background:'var(--abyss-1)',
        color:'var(--ink-1)', fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M12 9.5A5 5 0 0 1 6.5 4a.5.5 0 0 0-.7-.5A6 6 0 1 0 12.5 10.2a.5.5 0 0 0-.5-.7Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>
        라이트 / 다크
      </button>
      <a href="virt.html" style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'11px 14px', borderRadius:10,
        background:'var(--sonar-dim)', border:'1px solid rgba(53,224,200,.28)',
        fontSize:13, fontWeight:600, color:'var(--sonar)' }}>
        <span style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--sonar)',
            boxShadow:'0 0 8px var(--sonar)', animation:'dot 2s ease-in-out infinite' }}></span>
          VIRT 가상 항해
        </span>
        <span style={{ opacity:.7 }}>→</span>
      </a>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'4px 8px' }}>
        <span style={{ width:30, height:30, borderRadius:9,
          background:'linear-gradient(135deg, #5b9dff, #2c6fe6)',
          color:'#fff', fontSize:13, fontWeight:700,
          display:'flex', alignItems:'center', justifyContent:'center' }}>김</span>
        <div style={{ minWidth:0, flex:1 }}>
          <div style={{ fontSize:13, fontWeight:600, color:'var(--ink-0)',
            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>김병하</div>
          <div style={{ fontSize:11, color:'var(--ink-2)' }}>항해사 · Lv.3</div>
        </div>
        <span style={{ color:'var(--ink-3)' }}>⋯</span>
      </div>
    </div>
  </aside>
);

/* main shell — accounts for fixed sidebar */
const Shell = ({ children }) => (
  <div className="helm-shell" style={{ marginLeft:240, position:'relative', zIndex:1, minHeight:'100vh' }}>
    {children}
  </div>
);

/* coordinate topbar */
const Topbar = ({ coord, session }) => (
  <header style={{
    position:'sticky', top:0, zIndex:30,
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'18px 32px',
    background:'var(--topbar-bg, rgba(4,18,29,.72))', backdropFilter:'blur(14px)',
    borderBottom:'1px solid var(--hair)', gap:16, flexWrap:'wrap',
  }}>
    <div style={{ display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
      <span className="mono" style={{ fontSize:12, color:'var(--sonar)',
        letterSpacing:'.06em' }}>◎ {(() => { const d = new Date(new Date().toLocaleString('en-US', { timeZone:'Asia/Seoul' })); const w = ['일','월','화','수','목','금','토'][d.getDay()]; return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} (${w})`; })()} · KST</span>
      <span style={{ width:1, height:14, background:'var(--hair-strong)' }}/>
      <span style={{ fontSize:12.5, color:'var(--ink-1)' }}>{session}</span>
    </div>
    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
      <button style={topIcon} title="검색">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
      <button style={{ ...topIcon, position:'relative' }} title="알림">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M3.5 11.5h9l-1-1.2V7.2a3.5 3.5 0 1 0-7 0v3.1l-1 1.2Z"
            stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
          <path d="M6.5 13.2a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <span style={{ position:'absolute', top:-3, right:-3, width:8, height:8,
          borderRadius:'50%', background:'var(--up)', boxShadow:'0 0 0 2px var(--abyss-0)' }}/>
      </button>
    </div>
  </header>
);
const topIcon = {
  width:36, height:36, borderRadius:10,
  border:'1px solid var(--hair)', background:'var(--abyss-1)',
  color:'var(--ink-1)', cursor:'pointer',
  display:'flex', alignItems:'center', justifyContent:'center',
};

/* panel */
const Panel = ({ children, style, pad = true }) => (
  <section style={{
    background:'var(--panel-bg, linear-gradient(180deg, rgba(20,34,62,.6), rgba(9,17,38,.55)))',
    border:'1px solid var(--hair)', borderRadius:16,
    boxShadow:'0 1px 0 rgba(255,255,255,.05) inset, 0 10px 28px -18px rgba(0,0,0,.6)',
    overflow:'hidden',
    ...(pad ? {} : {}),
    ...style,
  }}>{children}</section>
);

const PanelHead = ({ title, kicker, right }) => (
  <div style={{ position:'relative', overflow:'hidden',
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'15px 22px', gap:12,
    background:'linear-gradient(105deg, #142647 0%, #1d3c7a 52%, #2c6fe6 100%)',
    boxShadow:'inset 0 1px 0 rgba(255,255,255,.16)',
    borderBottom:'1px solid rgba(255,255,255,.14)' }}>
    <span aria-hidden style={{ position:'absolute', right:-30, top:-40, width:150, height:150,
      borderRadius:'50%', background:'radial-gradient(circle, rgba(255,255,255,.14), transparent 70%)',
      pointerEvents:'none' }}/>
    <div style={{ position:'relative' }}>
      {kicker && <div style={{ fontSize:10.5, letterSpacing:'.22em', color:'rgba(255,255,255,.8)',
        fontWeight:700, marginBottom:5, display:'flex', alignItems:'center', gap:7 }}>
        <span style={{ width:14, height:1.5, background:'rgba(255,255,255,.75)', borderRadius:1, display:'inline-block' }}></span>{kicker}</div>}
      <h3 style={{ fontSize:16, fontWeight:700, letterSpacing:'-.015em', color:'rgba(255,255,255,.96)' }}>{title}</h3>
    </div>
    <div style={{ position:'relative' }}>{right}</div>
  </div>
);

/* up/down triangle (Korean: red up / blue down) */
const Tri = ({ up }) => (
  <svg width="9" height="9" viewBox="0 0 10 10" style={{ marginRight:3, verticalAlign:'-1px' }}>
    {up ? <path d="M5 2 L1 8 L9 8 Z" fill="var(--up)"/>
        : <path d="M5 8 L1 2 L9 2 Z" fill="var(--down)"/>}
  </svg>
);

const wKRW = (n) => '₩' + Math.round(n).toLocaleString('ko-KR');

Object.assign(window, {
  NAV_ITEMS, NavIcon, WhaleMark, Sidebar, Shell, Topbar, Panel, PanelHead, Tri, wKRW,
});
