/* Shared primitives — logo, nav, buttons, eyebrow, parallax whale */

const Logo = () => (
  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
    <img src="brand-whale.png" alt="WhaleArc" width="24"
      style={{ height:'auto', display:'block', filter:'drop-shadow(0 0 6px rgba(91,157,255,.4))' }} />
    <span className="whalearc-text" style={{ fontSize:15, fontWeight:700, letterSpacing:'.14em' }}>WHALEARC</span>
  </div>
);

const Nav = ({ scrolled }) => (
  <header style={{
    position:'sticky', top:0, zIndex:50,
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'20px 56px',
    backdropFilter: scrolled ? 'blur(14px)' : 'none',
    background: scrolled ? 'rgba(6,11,31,.72)' : 'transparent',
    borderBottom: scrolled ? '1px solid var(--line)' : '1px solid transparent',
    transition:'background .3s ease, border-color .3s ease, backdrop-filter .3s ease',
  }}>
    <Logo />
    <nav style={{ display:'flex', alignItems:'center', gap:36, fontSize:14,
      color:'var(--ink-1)', fontWeight:500 }}>
      <a style={navLink}>전략 라이브러리</a>
      <a style={navLink}>실시간 시세</a>
      <a href="#pricing" style={navLink}>요금제</a>
      <a style={navLink}>커뮤니티</a>
      <button style={{
        marginLeft:8, padding:'10px 18px', borderRadius:999,
        border:'1px solid var(--line-strong)',
        background:'rgba(255,255,255,.06)', color:'#fff',
        fontSize:13.5, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
        backdropFilter:'blur(8px)'
      }} onClick={() => { window.location.href = 'dashboard.html'; }}>항해 이어가기 →</button>
    </nav>
  </header>
);
const navLink = { cursor:'pointer', transition:'color .2s' };

const Eyebrow = ({ children }) => (
  <div style={{
    display:'inline-flex', alignItems:'center', gap:8, padding:'6px 12px',
    border:'1px solid rgba(120,170,255,.32)', borderRadius:999,
    fontSize:12, letterSpacing:'.08em', color:'#9cc1ff',
    background:'rgba(80,130,220,.08)',
  }}>
    <span style={{
      width:6, height:6, borderRadius:'50%',
      background:'var(--accent-glow)',
      boxShadow:'0 0 8px var(--accent-glow)',
      animation:'pulse-dot 2.4s ease-in-out infinite',
    }}/>
    {children}
  </div>
);

const PrimaryButton = ({ children, size='md' }) => {
  const pad = size === 'lg' ? '17px 28px' : '15px 24px';
  const fs = size === 'lg' ? 16 : 15;
  return (
    <button style={{
      padding:pad, borderRadius:12,
      border:'1px solid rgba(140,190,255,.5)',
      background:'linear-gradient(180deg, #4d8aff 0%, #2c6fe6 62%, #2257c8 100%)',
      color:'#fff', fontSize:fs, fontWeight:600, cursor:'pointer', letterSpacing:'.01em',
      boxShadow:'0 14px 30px -12px rgba(44,111,230,.7), inset 0 1px 0 rgba(255,255,255,.4), inset 0 -2px 6px rgba(8,20,50,.3)',
      fontFamily:'inherit',
    }}>{children}</button>
  );
};

const GhostButton = ({ children, size='md' }) => {
  const pad = size === 'lg' ? '18px 24px' : '16px 22px';
  const fs = size === 'lg' ? 16 : 15;
  return (
    <button style={{
      padding:pad, borderRadius:12,
      border:'1px solid var(--line-strong)', background:'transparent',
      color:'#fff', fontSize:fs, fontWeight:500, cursor:'pointer',
      fontFamily:'inherit', display:'inline-flex', alignItems:'center', gap:10,
    }}>{children}</button>
  );
};

const VirtBadge = () => (
  <span style={{
    fontSize:11, padding:'3px 7px', borderRadius:5,
    background:'rgba(180,210,255,.18)', color:'#cfe1ff',
    fontWeight:700, letterSpacing:'.06em',
  }}>VIRT</span>
);

/* Parallax whale — accepts an id (image-slot persistence) and a depth multiplier */
const ParallaxWhale = ({ id, depth = 0.15, animDuration = 8, style, placeholder = "고래 일러스트" }) => {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY * depth;
        el.style.setProperty('--scroll-y', `${-y}px`);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive:true });
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, [depth]);
  return (
    <div ref={ref} style={{
      position:'relative', width:'100%', height:'100%',
      transform:'translateY(var(--scroll-y, 0))',
      ...style,
    }}>
      <div style={{
        position:'absolute', inset:0,
        background:'radial-gradient(60% 60% at 50% 50%, rgba(90,160,255,.28), transparent 70%)',
      }}/>
      <div style={{
        position:'absolute', inset:0,
        animation:`whale-float ${animDuration}s ease-in-out infinite`,
        transformOrigin:'center',
      }}>
        <image-slot
          id={id}
          shape="rounded"
          radius="28"
          style={{
            display:'block', width:'100%', height:'100%',
            background:'transparent', border:'1px dashed rgba(255,255,255,.18)',
          }}
          placeholder={placeholder}
        ></image-slot>
      </div>
    </div>
  );
};

Object.assign(window, { Logo, Nav, Eyebrow, PrimaryButton, GhostButton, VirtBadge, ParallaxWhale });
