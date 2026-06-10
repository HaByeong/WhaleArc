/* VIRT mode, live ticker, CTA, footer */

/* ----------------------------------------------------------- */
/* VIRT MODE — alternating split with 3 steps                  */
/* ----------------------------------------------------------- */
const VirtMode = () => (
  <section style={{
    position:'relative',
    padding:'140px 56px',
    background:'linear-gradient(180deg, var(--bg-0) 0%, var(--bg-1) 60%, var(--bg-0) 100%)',
    overflow:'hidden',
  }}>
    {/* faint wave divider top */}
    <svg aria-hidden viewBox="0 0 1440 60" preserveAspectRatio="none"
      style={{ position:'absolute', left:0, right:0, top:0, width:'100%', height:60, opacity:.18 }}>
      <path d="M0 30 Q 240 5, 480 30 T 960 30 T 1440 30 V60 H0 Z" fill="#5b9dff"/>
    </svg>

    <div style={{ maxWidth:1240, margin:'0 auto',
      display:'grid', gridTemplateColumns:'1fr 1fr', gap:80, alignItems:'center' }}>
      {/* left text */}
      <div>
        <span style={{ fontSize:11.5, letterSpacing:'.24em', color:'#9cc1ff',
          fontWeight:600, textTransform:'uppercase' }}>VIRT · 가상 항해</span>
        <h2 style={{ margin:'14px 0 0', fontSize:52, lineHeight:1.08, fontWeight:700,
          letterSpacing:'-.025em' }}>
          실수해도 좋아요.<br/>
          <span style={{ color:'rgba(255,255,255,.55)' }}>자산은 안전한 채로.</span>
        </h2>
        <p style={{ marginTop:20, fontSize:17, lineHeight:1.65, color:'var(--ink-1)',
          maxWidth:440 }}>
          실제 시세로 움직이는 모의 계좌에서 전략을 먼저 실험해보세요.
          몇 번이고 다시 항해할 수 있고, 결과는 그대로 백테스트가 됩니다.
        </p>

        <ol style={{ margin:'40px 0 0', padding:0, listStyle:'none',
          display:'flex', flexDirection:'column', gap:18 }}>
          {[
            ['01','VIRT 계좌 개설', '버튼 한 번으로 ₩10,000,000 가상 자금이 지급됩니다.'],
            ['02','전략 실행', '실시간 시세로 거래하고, 손익은 즉시 갱신됩니다.'],
            ['03','복기와 이관', '결과가 만족스러우면 같은 전략을 실계좌로 한 번에 이관.'],
          ].map(([n,t,s]) => (
            <li key={n} style={{ display:'grid', gridTemplateColumns:'48px 1fr',
              alignItems:'start', gap:18 }}>
              <span className="mono" style={{
                width:40, height:40, borderRadius:10,
                border:'1px solid rgba(91,157,255,.3)',
                background:'rgba(91,157,255,.08)',
                color:'var(--accent-glow)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:13, fontWeight:700, letterSpacing:'.04em',
              }}>{n}</span>
              <div>
                <div style={{ fontSize:16, fontWeight:600, marginBottom:4 }}>{t}</div>
                <div style={{ fontSize:14, color:'var(--ink-1)', lineHeight:1.55 }}>{s}</div>
              </div>
            </li>
          ))}
        </ol>

        <div style={{ marginTop:40, display:'flex', alignItems:'center', gap:14 }}>
          <PrimaryButton>VIRT 모드로 시작 →</PrimaryButton>
          <a style={{ fontSize:14, color:'var(--ink-1)', cursor:'pointer',
            display:'inline-flex', alignItems:'center', gap:6 }}>
            가이드 보기 <span style={{ opacity:.6 }}>↗</span>
          </a>
        </div>
      </div>

      {/* right mockup */}
      <VirtMockup />
    </div>
  </section>
);

const VirtMockup = () => (
  <div style={{ position:'relative' }}>
    {/* glow */}
    <div aria-hidden style={{ position:'absolute', inset:-40,
      background:'radial-gradient(50% 50% at 50% 50%, rgba(91,157,255,.22), transparent 70%)',
      pointerEvents:'none' }}/>
    <div style={{
      position:'relative',
      borderRadius:20, overflow:'hidden',
      border:'1px solid var(--line-strong)',
      background:'linear-gradient(180deg, #0d1736, #080e25)',
      boxShadow:'0 60px 120px -40px rgba(0,0,0,.6)',
    }}>
      {/* virt header */}
      <div style={{ padding:'18px 22px', borderBottom:'1px solid var(--line)',
        display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <VirtBadge/>
          <span style={{ fontSize:13.5, fontWeight:600 }}>가상 계좌 #VIRT-0042</span>
        </div>
        <span className="mono" style={{ fontSize:12, color:'var(--ink-2)' }}>
          잔고 ₩ 10,482,310
        </span>
      </div>

      {/* order ticket */}
      <div style={{ padding:'22px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <div style={{ padding:14, borderRadius:10,
          background:'rgba(239,77,77,.08)', border:'1px solid rgba(239,77,77,.24)' }}>
          <div style={{ fontSize:11, letterSpacing:'.16em', color:'#ef4d4d',
            fontWeight:700 }}>BUY · 매수</div>
          <div className="mono" style={{ marginTop:6, fontSize:22, fontWeight:600 }}>
            0.024 BTC
          </div>
          <div className="mono" style={{ fontSize:12, color:'var(--ink-2)', marginTop:2 }}>
            @ ₩ 94,210,000
          </div>
        </div>
        <div style={{ padding:14, borderRadius:10,
          background:'rgba(255,255,255,.025)', border:'1px solid var(--line)' }}>
          <div style={{ fontSize:11, letterSpacing:'.16em', color:'var(--ink-2)',
            fontWeight:700 }}>LIMIT</div>
          <div className="mono" style={{ marginTop:6, fontSize:22, fontWeight:600 }}>
            ₩ 93,000,000
          </div>
          <div className="mono" style={{ fontSize:12, color:'var(--ink-2)', marginTop:2 }}>
            대기 시간 4h 22m
          </div>
        </div>
      </div>

      {/* mini equity curve */}
      <div style={{ padding:'0 22px 22px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline',
          marginBottom:8 }}>
          <span style={{ fontSize:12, color:'var(--ink-2)', letterSpacing:'.06em' }}>
            VIRT 누적 수익률
          </span>
          <span className="mono" style={{ fontSize:18, fontWeight:600, color:'var(--up)' }}>
            +4.82%
          </span>
        </div>
        <div style={{ height:80 }}>
          <svg viewBox="0 0 300 80" width="100%" height="100%" preserveAspectRatio="none">
            <defs>
              <linearGradient id="virt-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#ef4d4d" stopOpacity=".35"/>
                <stop offset="100%" stopColor="#ef4d4d" stopOpacity="0"/>
              </linearGradient>
            </defs>
            <path d="M0 60 C 30 58, 50 50, 80 52 S 120 40, 160 36 S 210 30, 250 18 S 290 12, 300 8"
              fill="none" stroke="#ef4d4d" strokeWidth="1.6"/>
            <path d="M0 60 C 30 58, 50 50, 80 52 S 120 40, 160 36 S 210 30, 250 18 S 290 12, 300 8 L 300 80 L 0 80 Z"
              fill="url(#virt-fill)"/>
          </svg>
        </div>
      </div>

      {/* footer status */}
      <div style={{ padding:'14px 22px', borderTop:'1px solid var(--line)',
        background:'rgba(255,255,255,.02)', display:'flex',
        alignItems:'center', justifyContent:'space-between' }}>
        <span style={{ fontSize:12, color:'var(--ink-2)', display:'flex',
          alignItems:'center', gap:8 }}>
          <span style={{ width:6, height:6, borderRadius:'50%',
            background:'#ef4d4d',
            boxShadow:'0 0 8px #ef4d4d',
            animation:'pulse-dot 2s ease-in-out infinite' }}/>
          시뮬레이션 진행 중 · 14일째
        </span>
        <span style={{ fontSize:12, color:'var(--accent-glow)', fontWeight:600,
          cursor:'pointer' }}>실계좌로 이관 →</span>
      </div>
    </div>
  </div>
);

/* ----------------------------------------------------------- */
/* LIVE TICKER WIDGET                                          */
/* ----------------------------------------------------------- */
const tickerItems = [
  ['BTC','94,210.4','+1.24%', true],
  ['ETH','3,482.10','+0.81%', true],
  ['SOL','182.40','-0.42%', false],
  ['ARB','1.18','+2.07%', true],
  ['LINK','18.62','+0.34%', true],
  ['DOGE','0.182','-1.12%', false],
  ['AVAX','42.30','+0.96%', true],
  ['MATIC','0.78','-0.21%', false],
  ['DOT','7.18','+1.45%', true],
  ['ATOM','9.32','+0.18%', true],
  ['NEAR','5.84','-0.62%', false],
  ['XRP','0.62','+0.84%', true],
];

const TickerItem = ({ data }) => {
  const [sym, price, delta, up] = data;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'0 28px',
      borderRight:'1px solid var(--line)', minWidth:220 }}>
      <span style={{ fontSize:12.5, fontWeight:700, letterSpacing:'.08em',
        color:'var(--ink-2)' }}>{sym}</span>
      <span className="mono" style={{ fontSize:14.5, fontWeight:500, color:'#fff' }}>
        {price}
      </span>
      <span className="mono" style={{ fontSize:13, fontWeight:600,
        color: up ? 'var(--up)' : 'var(--down)' }}>{delta}</span>
    </div>
  );
};

const LiveTicker = () => {
  // duplicate the list to make scroll seamless
  const list = [...tickerItems, ...tickerItems];
  return (
    <section style={{ padding:'80px 0 100px', background:'var(--bg-0)' }}>
      <div style={{ padding:'0 56px', maxWidth:1240, margin:'0 auto 36px' }}>
        <SectionHeader
          kicker="LIVE MARKETS"
          title={<>지금 이 순간, 바다는 어떻습니까.</>}
          lede="주요 자산의 실시간 시세를 한눈에. 화면을 떠나도 시장은 멈추지 않습니다."
          align="center"
        />
      </div>

      <div style={{ position:'relative', overflow:'hidden',
        borderTop:'1px solid var(--line)', borderBottom:'1px solid var(--line)',
        background:'linear-gradient(180deg, rgba(91,157,255,.04), transparent)' }}>
        {/* fade edges */}
        <div aria-hidden style={{ position:'absolute', left:0, top:0, bottom:0, width:120,
          background:'linear-gradient(90deg, var(--bg-0), transparent)', zIndex:2, pointerEvents:'none' }}/>
        <div aria-hidden style={{ position:'absolute', right:0, top:0, bottom:0, width:120,
          background:'linear-gradient(-90deg, var(--bg-0), transparent)', zIndex:2, pointerEvents:'none' }}/>

        <div style={{ display:'flex', alignItems:'center', height:64,
          width:'max-content',
          animation:'ticker-scroll 60s linear infinite' }}>
          {list.map((d,i) => <TickerItem key={i} data={d}/>)}
        </div>
      </div>

      <div style={{ padding:'24px 56px 0', maxWidth:1240, margin:'0 auto',
        display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10,
          fontSize:12.5, color:'var(--ink-2)' }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background:'#ef4d4d',
            boxShadow:'0 0 8px #ef4d4d',
            animation:'pulse-dot 2s ease-in-out infinite' }}/>
          12,000+ 자산 · 0.2초 갱신
        </div>
        <a style={{ fontSize:13.5, color:'var(--accent-glow)', fontWeight:600,
          cursor:'pointer' }}>전체 마켓 보기 →</a>
      </div>
    </section>
  );
};

/* ----------------------------------------------------------- */
/* CTA                                                          */
/* ----------------------------------------------------------- */
const CTA = () => (
  <section style={{
    position:'relative', padding:'140px 56px',
    background:'radial-gradient(100% 100% at 50% 0%, #1d3a7a 0%, #0a1230 55%, #060b1f 100%)',
    overflow:'hidden', textAlign:'center',
  }}>
    {/* small whale glyph */}
    <img src="brand-whale.png" alt="WhaleArc" width="150"
      style={{ height:'auto', marginBottom:28, filter:'drop-shadow(0 0 24px rgba(91,157,255,.45))' }} />
    <h2 style={{ margin:0, fontSize:64, lineHeight:1.06, fontWeight:800,
      letterSpacing:'-.03em', maxWidth:880, margin:'0 auto' }}>
      이제, 당신의 항해를<br/>
      <span style={{ color:'rgba(255,255,255,.55)' }}>시작할 시간입니다.</span>
    </h2>
    <p style={{ marginTop:20, fontSize:17, lineHeight:1.65, color:'var(--ink-1)',
      maxWidth:520, margin:'20px auto 0' }}>
      가입은 30초. 첫 항해는 VIRT 모드로 부담 없이.
    </p>
    <div style={{ marginTop:40, display:'flex', justifyContent:'center',
      alignItems:'center', gap:14, flexWrap:'wrap' }}>
      <PrimaryButton size="lg">항해 시작하기 →</PrimaryButton>
      <GhostButton size="lg">먼저 VIRT로 둘러보기 <VirtBadge/></GhostButton>
    </div>
  </section>
);

/* ----------------------------------------------------------- */
/* FOOTER                                                       */
/* ----------------------------------------------------------- */
const Footer = () => (
  <footer style={{ background:'var(--bg-0)', borderTop:'1px solid var(--line)',
    padding:'72px 56px 40px' }}>
    <div style={{ maxWidth:1240, margin:'0 auto',
      display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr', gap:48 }}>
      <div>
        <Logo />
        <p style={{ marginTop:18, fontSize:13.5, lineHeight:1.65,
          color:'var(--ink-2)', maxWidth:300 }}>
          시장을 깊고 조용하게 유영하는 항해사들을 위한 포트폴리오 플랫폼.
        </p>
        <div style={{ marginTop:20, display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:12, color:'var(--ink-3)',
            letterSpacing:'.08em' }}>FOLLOW</span>
          {['X','LinkedIn','GitHub','Brunch'].map(s => (
            <a key={s} style={{ fontSize:12.5, color:'var(--ink-1)',
              padding:'4px 10px', borderRadius:6,
              border:'1px solid var(--line)', cursor:'pointer' }}>{s}</a>
          ))}
        </div>
      </div>
      {[
        ['제품', ['대시보드','전략 라이브러리','VIRT 모드','실시간 시세','요금제']],
        ['리소스', ['가이드','API','상태 페이지','체인지로그']],
        ['회사', ['소개','채용','블로그','연락처']],
        ['약관', ['개인정보 처리방침','이용약관','보안','면책 조항']],
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

Object.assign(window, { VirtMode, LiveTicker, CTA, Footer });
