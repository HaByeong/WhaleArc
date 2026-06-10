/* WhaleArc-light.jsx — light port of marketing landing page */

/* ============================================================ */
/* Nav                                                            */
/* ============================================================ */
const Logo = () => (
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

const Nav = ({ scrolled }) => (
  <header style={{
    position:'sticky', top:0, zIndex:50,
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'20px 56px',
    backdropFilter: scrolled ? 'blur(14px)' : 'none',
    background: scrolled ? 'rgba(255,255,255,.85)' : 'transparent',
    borderBottom: scrolled ? '1px solid var(--line)' : '1px solid transparent',
    transition:'background .3s ease, border-color .3s ease' }}>
    <Logo />
    <nav style={{ display:'flex', alignItems:'center', gap:36, fontSize:14,
      color:'var(--ink-1)', fontWeight:500 }}>
      <a style={{ cursor:'pointer' }}>전략 라이브러리</a>
      <a style={{ cursor:'pointer' }}>실시간 시세</a>
      <a style={{ cursor:'pointer' }}>요금제</a>
      <a style={{ cursor:'pointer' }}>커뮤니티</a>
      <a href="dashboard-light.html" style={{
        marginLeft:8, padding:'10px 18px', borderRadius:999,
        border:'1px solid var(--line-strong)',
        background:'var(--bg-1)', color:'var(--ink-0)',
        fontSize:13.5, fontWeight:600, cursor:'pointer' }}>
        항해 이어가기 →
      </a>
    </nav>
  </header>
);

/* ============================================================ */
/* Hero                                                           */
/* ============================================================ */
const Hero = () => (
  <section style={{ position:'relative',
    background:'linear-gradient(180deg, var(--bg-0) 0%, var(--bg-deep) 100%)',
    minHeight:760, overflow:'hidden' }}>
    <div aria-hidden style={{ position:'absolute', inset:0, pointerEvents:'none',
      background:'radial-gradient(80% 60% at 80% 30%, var(--accent-bg), transparent 60%)' }}/>
    <div style={{ position:'relative', display:'grid',
      gridTemplateColumns:'1.05fr .95fr', gap:32, padding:'72px 56px 96px',
      alignItems:'center', maxWidth:1440, margin:'0 auto' }}>
      <div>
        <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'6px 12px',
          border:'1px solid rgba(91,157,255,.28)', borderRadius:999,
          fontSize:12, letterSpacing:'.08em', color:'var(--accent)',
          background:'var(--accent-bg)', marginBottom:24 }}>
          <span style={{ width:6, height:6, borderRadius:'50%',
            background:'var(--accent-glow)', boxShadow:'0 0 8px var(--accent-glow)',
            animation:'pulse-dot 2.4s ease-in-out infinite' }}/>
          AI 기반 실시간 시장 분석
        </div>
        <h1 style={{ margin:'0 0 0', fontSize:72, lineHeight:1.06, fontWeight:800,
          letterSpacing:'-.025em', color:'var(--ink-0)' }}>
          고래처럼,<br/>
          <span style={{ color:'var(--ink-2)', fontWeight:700 }}>시장을 유영하듯</span>
        </h1>
        <p style={{ marginTop:24, fontSize:18, lineHeight:1.6, color:'var(--ink-1)',
          maxWidth:480, fontWeight:400 }}>
          실시간 시세 데이터와 포트폴리오 분석으로<br/>
          나만의 투자 전략을 안전하게 실험해보세요.
        </p>
        <div style={{ marginTop:36, display:'flex', alignItems:'center', gap:14,
          flexWrap:'wrap' }}>
          <a href="dashboard-light.html" style={{
            padding:'16px 24px', borderRadius:12, border:0,
            background:'linear-gradient(180deg, var(--accent-glow), var(--accent))',
            color:'#fff', fontSize:15, fontWeight:600, cursor:'pointer',
            boxShadow:'0 10px 28px -10px rgba(60,120,255,.5), inset 0 1px 0 rgba(255,255,255,.25)',
            fontFamily:'inherit', textDecoration:'none' }}>
            항해 시작하기 →
          </a>
          <a href="virt.html" style={{
            padding:'16px 22px', borderRadius:12,
            border:'1px solid var(--line-strong)', background:'var(--bg-1)',
            color:'var(--ink-0)', fontSize:15, fontWeight:500, cursor:'pointer',
            fontFamily:'inherit', display:'inline-flex', alignItems:'center', gap:10,
            textDecoration:'none' }}>
            첫 항해가 불안하다면
            <span style={{ fontSize:11, padding:'3px 7px', borderRadius:5,
              background:'var(--accent-bg-strong)', color:'var(--accent)',
              fontWeight:700, letterSpacing:'.06em' }}>VIRT</span>
          </a>
        </div>
        <div style={{ marginTop:48, display:'flex', alignItems:'center', gap:24,
          color:'var(--ink-2)', fontSize:12.5, letterSpacing:'.02em', flexWrap:'wrap' }}>
          <span>· 가상 자산 12,000+ 추적</span>
          <span>· 실시간 호가 0.2초</span>
          <span>· 누적 항해사 38,400명</span>
        </div>
      </div>
      <div style={{ position:'relative', height:520 }}>
        <div aria-hidden style={{ position:'absolute', inset:0,
          background:'radial-gradient(60% 60% at 50% 50%, rgba(91,157,255,.18), transparent 70%)' }}/>
        <div style={{ position:'absolute', inset:0,
          animation:'whale-float 8s ease-in-out infinite' }}>
          <svg viewBox="0 0 400 400" width="100%" height="100%" fill="none">
            <defs>
              <linearGradient id="wh-l" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" stopColor="#5b9dff"/>
                <stop offset="100%" stopColor="#2c6fe6"/>
              </linearGradient>
            </defs>
            <path d="M50 220 Q 110 130 220 150 Q 320 165 360 130 L 380 160
                     L 370 200 L 380 230 L 360 235 Q 320 290 220 270
                     Q 130 270 90 300 Q 60 280 50 220 Z"
              fill="url(#wh-l)" opacity=".88"/>
            <circle cx="120" cy="200" r="4.5" fill="#fff"/>
            <g opacity=".55">
              <rect x="200" y="200" width="3" height="14" fill="var(--up)"/>
              <rect x="197" y="204" width="9" height="7" fill="var(--up)" rx="1.5"/>
              <rect x="220" y="194" width="3" height="20" fill="var(--up)"/>
              <rect x="217" y="200" width="9" height="10" fill="var(--up)" rx="1.5"/>
              <rect x="240" y="204" width="3" height="12" fill="var(--down)"/>
              <rect x="237" y="208" width="9" height="6" fill="var(--down)" rx="1.5"/>
            </g>
          </svg>
        </div>
      </div>
    </div>
  </section>
);

/* ============================================================ */
/* Features                                                       */
/* ============================================================ */
const Features = () => {
  const items = [
    { title:'실시간 시세 스트림', body:'12,000개 이상의 자산을 0.2초 간격으로 추적합니다.',
      meta:'0.2s · 12,000+ 자산' },
    { title:'AI 포트폴리오 분석', body:'보유 자산의 리스크·상관관계를 AI가 매일 진단합니다.',
      meta:'매일 06:00 · 자동 리포트' },
    { title:'VIRT 가상 항해', body:'실제 시세로 움직이는 모의 계좌. 실수해도 자산은 안전합니다.',
      meta:'무제한 · 무료' },
    { title:'전략 라이브러리', body:'검증된 전략을 복제하고 백테스트로 즉시 확인하세요.',
      meta:'240+ 전략' },
  ];
  return (
    <section style={{ padding:'120px 56px', background:'var(--bg-1)' }}>
      <div style={{ maxWidth:1240, margin:'0 auto' }}>
        <div style={{ marginBottom:56, maxWidth:640 }}>
          <span style={{ fontSize:11.5, letterSpacing:'.24em', color:'var(--accent)',
            fontWeight:600, textTransform:'uppercase' }}>핵심 기능</span>
          <h2 style={{ margin:'14px 0 0', fontSize:48, lineHeight:1.12, fontWeight:700,
            letterSpacing:'-.02em' }}>시장을 읽는 네 가지 도구.</h2>
          <p style={{ marginTop:16, fontSize:17, lineHeight:1.65, color:'var(--ink-1)' }}>
            WhaleArc는 단순한 시세 화면이 아닙니다. 데이터, 분석, 시뮬레이션, 커뮤니티를 한 갑판 위에 올렸어요.
          </p>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))',
          gap:20 }}>
          {items.map((it, i) => (
            <article key={it.title} style={{
              padding:'32px 28px', borderRadius:18,
              background:'var(--bg-0)',
              border:'1px solid var(--line)', position:'relative', overflow:'hidden' }}>
              <div aria-hidden style={{ position:'absolute', top:-40, right:-40,
                width:160, height:160, borderRadius:'50%',
                background:'radial-gradient(closest-side, var(--accent-bg), transparent)' }}/>
              <div style={{ position:'relative' }}>
                <div style={{ width:48, height:48, borderRadius:12,
                  background:'var(--accent-bg)', color:'var(--accent)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  marginBottom:24, border:'1px solid rgba(91,157,255,.22)' }}>
                  <span className="mono" style={{ fontSize:14, fontWeight:700 }}>0{i+1}</span>
                </div>
                <div style={{ fontSize:11, color:'var(--ink-2)', letterSpacing:'.06em',
                  marginBottom:6 }}>{it.meta}</div>
                <h3 style={{ margin:'0 0 10px', fontSize:20, fontWeight:700,
                  letterSpacing:'-.01em' }}>{it.title}</h3>
                <p style={{ margin:0, fontSize:14.5, lineHeight:1.6, color:'var(--ink-1)' }}>
                  {it.body}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ============================================================ */
/* Ticker                                                         */
/* ============================================================ */
const tickerItems = [
  ['BTC','94,210.4','+1.24%', true], ['ETH','3,482.10','+0.81%', true],
  ['SOL','182.40','-0.42%', false], ['ARB','1.18','+2.07%', true],
  ['LINK','18.62','+0.34%', true], ['DOGE','0.182','-1.12%', false],
  ['AVAX','42.30','+0.96%', true], ['MATIC','0.78','-0.21%', false],
  ['DOT','7.18','+1.45%', true], ['ATOM','9.32','+0.18%', true],
];

const Ticker = () => {
  const list = [...tickerItems, ...tickerItems];
  return (
    <section style={{ padding:'80px 0 100px', background:'var(--bg-0)' }}>
      <div style={{ padding:'0 56px', maxWidth:1240, margin:'0 auto 36px',
        textAlign:'center' }}>
        <span style={{ fontSize:11.5, letterSpacing:'.24em', color:'var(--accent)',
          fontWeight:600 }}>LIVE MARKETS</span>
        <h2 style={{ margin:'14px 0 0', fontSize:48, fontWeight:700,
          letterSpacing:'-.02em' }}>지금 이 순간, 바다는 어떻습니까.</h2>
      </div>
      <div style={{ position:'relative', overflow:'hidden',
        borderTop:'1px solid var(--line)', borderBottom:'1px solid var(--line)',
        background:'var(--bg-1)' }}>
        <div aria-hidden style={{ position:'absolute', left:0, top:0, bottom:0, width:120,
          background:'linear-gradient(90deg, var(--bg-1), transparent)', zIndex:2 }}/>
        <div aria-hidden style={{ position:'absolute', right:0, top:0, bottom:0, width:120,
          background:'linear-gradient(-90deg, var(--bg-1), transparent)', zIndex:2 }}/>
        <div style={{ display:'flex', alignItems:'center', height:64,
          width:'max-content',
          animation:'ticker-scroll 60s linear infinite' }}>
          {list.map((d,i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:12,
              padding:'0 28px', borderRight:'1px solid var(--line)', minWidth:220 }}>
              <span style={{ fontSize:12.5, fontWeight:700, letterSpacing:'.08em',
                color:'var(--ink-2)' }}>{d[0]}</span>
              <span className="mono" style={{ fontSize:14.5, fontWeight:500,
                color:'var(--ink-0)' }}>{d[1]}</span>
              <span className="mono" style={{ fontSize:13, fontWeight:600,
                color: d[3] ? 'var(--up)' : 'var(--down)' }}>{d[2]}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ============================================================ */
/* CTA + Footer                                                   */
/* ============================================================ */
const CTA = () => (
  <section style={{ position:'relative', padding:'140px 56px',
    background:'linear-gradient(180deg, var(--bg-0) 0%, var(--bg-deep) 100%)',
    textAlign:'center', overflow:'hidden' }}>
    <svg width="48" height="48" viewBox="0 0 22 22" fill="none"
      style={{ opacity:.5, marginBottom:24 }}>
      <path d="M2 13 Q6 5 11 9 Q16 13 20 6" stroke="var(--accent)" strokeWidth="1.5"
        strokeLinecap="round" fill="none"/>
      <circle cx="11" cy="9" r="1.4" fill="var(--accent)"/>
    </svg>
    <h2 style={{ margin:'0 auto', fontSize:64, lineHeight:1.06, fontWeight:800,
      letterSpacing:'-.03em', maxWidth:880, color:'var(--ink-0)' }}>
      이제, 당신의 항해를<br/>
      <span style={{ color:'var(--ink-2)' }}>시작할 시간입니다.</span>
    </h2>
    <p style={{ marginTop:20, fontSize:17, lineHeight:1.65, color:'var(--ink-1)',
      maxWidth:520, margin:'20px auto 0' }}>
      가입은 30초. 첫 항해는 VIRT 모드로 부담 없이.
    </p>
    <div style={{ marginTop:40, display:'flex', justifyContent:'center',
      alignItems:'center', gap:14, flexWrap:'wrap' }}>
      <a href="dashboard-light.html" style={{
        padding:'18px 28px', borderRadius:12, border:0,
        background:'linear-gradient(180deg, var(--accent-glow), var(--accent))',
        color:'#fff', fontSize:16, fontWeight:600, cursor:'pointer',
        boxShadow:'0 10px 28px -10px rgba(60,120,255,.5)',
        fontFamily:'inherit', textDecoration:'none' }}>
        항해 시작하기 →
      </a>
      <a href="virt.html" style={{
        padding:'18px 24px', borderRadius:12,
        border:'1px solid var(--line-strong)', background:'var(--bg-1)',
        color:'var(--ink-0)', fontSize:16, fontWeight:500, cursor:'pointer',
        fontFamily:'inherit', display:'inline-flex', alignItems:'center', gap:10,
        textDecoration:'none' }}>
        먼저 VIRT로 둘러보기
        <span style={{ fontSize:11, padding:'3px 7px', borderRadius:5,
          background:'var(--accent-bg-strong)', color:'var(--accent)',
          fontWeight:700, letterSpacing:'.06em' }}>VIRT</span>
      </a>
    </div>
  </section>
);

const Footer = () => (
  <footer style={{ background:'var(--bg-0)', borderTop:'1px solid var(--line)',
    padding:'72px 56px 40px' }}>
    <div style={{ maxWidth:1240, margin:'0 auto',
      display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:32 }}>
      <div>
        <Logo />
        <p style={{ marginTop:18, fontSize:13.5, lineHeight:1.65,
          color:'var(--ink-2)', maxWidth:300 }}>
          시장을 깊고 조용하게 유영하는 항해사들을 위한 포트폴리오 플랫폼.
        </p>
      </div>
      {[
        ['제품', ['대시보드','전략 라이브러리','VIRT 모드','실시간 시세','요금제']],
        ['리소스', ['가이드','API','상태 페이지','체인지로그']],
        ['회사', ['소개','채용','블로그','연락처']],
        ['약관', ['개인정보','이용약관','보안','면책 조항']],
      ].map(([title, links]) => (
        <div key={title}>
          <div style={{ fontSize:12, color:'var(--ink-3)',
            letterSpacing:'.16em', fontWeight:600, textTransform:'uppercase',
            marginBottom:18 }}>{title}</div>
          <ul style={{ margin:0, padding:0, listStyle:'none',
            display:'flex', flexDirection:'column', gap:12 }}>
            {links.map(l => (
              <li key={l} style={{ fontSize:13.5, color:'var(--ink-1)',
                cursor:'pointer' }}>{l}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
    <div style={{ maxWidth:1240, margin:'56px auto 0',
      padding:'24px 0 0', borderTop:'1px solid var(--line)',
      display:'flex', alignItems:'center', justifyContent:'space-between',
      flexWrap:'wrap', gap:16 }}>
      <span className="mono" style={{ fontSize:12, color:'var(--ink-3)' }}>
        © 2026 WhaleArc Labs · 모든 항해는 사용자의 책임 아래 진행됩니다.
      </span>
      <span style={{ fontSize:12, color:'var(--ink-3)' }}>
        Built quietly, beneath the surface.
      </span>
    </div>
  </footer>
);

/* ============================================================ */
/* App                                                            */
/* ============================================================ */
function App() {
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on(); window.addEventListener('scroll', on, { passive:true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return (
    <>
      <Nav scrolled={scrolled} />
      <Hero />
      <Features />
      <Ticker />
      <CTA />
      <Footer />
    </>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
