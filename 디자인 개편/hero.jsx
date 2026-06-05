/* Three hero layout variants — all in the "Refined Dark" direction */

const heroBg = {
  position:'relative',
  background:'radial-gradient(120% 80% at 80% 20%, #1d3a7a 0%, #0a1230 55%, #060b1f 100%)',
  overflow:'hidden',
};

const heroAura = (
  <div aria-hidden style={{ position:'absolute', inset:0, pointerEvents:'none',
    background:'radial-gradient(60% 40% at 20% 90%, rgba(80,140,255,.18), transparent 70%)' }} />
);

const trustStrip = (
  <div style={{ marginTop:48, display:'flex', alignItems:'center', gap:24,
    color:'var(--ink-2)', fontSize:12.5, letterSpacing:'.02em', flexWrap:'wrap' }}>
    <span>· 가상 자산 12,000+ 추적</span>
    <span>· 실시간 호가 0.2초</span>
    <span>· 누적 항해사 38,400명</span>
  </div>
);

/* ----------------------------------------------------------- */
/* A1 — Text left, whale right (current direction, refined)    */
/* ----------------------------------------------------------- */
const HeroA1 = () => (
  <section style={{ ...heroBg, minHeight:760 }}>
    {heroAura}
    <div style={{ position:'relative', display:'grid', gridTemplateColumns:'1.05fr .95fr',
      gap:32, padding:'72px 56px 96px', alignItems:'center', maxWidth:1440, margin:'0 auto' }}>
      <div>
        <Eyebrow>AI 기반 실시간 시장 분석</Eyebrow>
        <h1 style={{
          margin:'24px 0 0', fontSize:72, lineHeight:1.06, fontWeight:800,
          letterSpacing:'-.025em',
        }}>
          고래처럼,<br/>
          <span style={{ color:'rgba(255,255,255,.55)', fontWeight:700 }}>시장을 유영하듯</span>
        </h1>
        <p style={{ marginTop:24, fontSize:18, lineHeight:1.6, color:'var(--ink-1)',
          maxWidth:480, fontWeight:400 }}>
          실시간 시세 데이터와 포트폴리오 분석으로<br/>
          나만의 투자 전략을 안전하게 실험해보세요.
        </p>
        <div style={{ marginTop:36, display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
          <a href="dashboard-hub.html" style={{ textDecoration:'none' }}><PrimaryButton>대시보드로 이동 →</PrimaryButton></a>
          <a href="virt.html" style={{ textDecoration:'none' }}><GhostButton>첫 항해가 불안하다면 <VirtBadge/></GhostButton></a>
        </div>
        {trustStrip}
      </div>
      <div style={{ position:'relative', height:520, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div aria-hidden style={{ position:'absolute', inset:0,
          background:'radial-gradient(55% 55% at 50% 45%, rgba(91,157,255,.22), transparent 70%)' }} />
        <img src="whale-hero-logo.png" alt="WhaleArc" style={{
          position:'relative', width:'min(440px, 90%)', height:'auto',
          animation:'whale-float 8s ease-in-out infinite',
          filter:'drop-shadow(0 0 40px rgba(91,157,255,.35))' }} />
      </div>
    </div>
  </section>
);

/* ----------------------------------------------------------- */
/* A2 — Centered hero, whale ambient behind                    */
/* ----------------------------------------------------------- */
const HeroA2 = () => (
  <section style={{ ...heroBg, minHeight:820 }}>
    {heroAura}
    {/* ambient whale behind */}
    <div style={{ position:'absolute', inset:0, opacity:.55, pointerEvents:'none',
      maskImage:'radial-gradient(60% 70% at 50% 45%, #000 30%, transparent 75%)',
      WebkitMaskImage:'radial-gradient(60% 70% at 50% 45%, #000 30%, transparent 75%)' }}>
      <div style={{ position:'absolute', left:'50%', top:'46%', transform:'translate(-50%,-50%)',
        width:'min(1100px, 88%)', height:560 }}>
        <ParallaxWhale id="whalearc-hero-A2" depth={0.18} animDuration={10}
          placeholder="고래 일러스트 — 배경 앰비언트" />
      </div>
    </div>

    <div style={{ position:'relative', textAlign:'center',
      padding:'120px 56px 96px', maxWidth:1100, margin:'0 auto' }}>
      <div style={{ display:'flex', justifyContent:'center' }}>
        <Eyebrow>AI 기반 실시간 시장 분석</Eyebrow>
      </div>
      <h1 style={{
        margin:'28px 0 0', fontSize:96, lineHeight:1.02, fontWeight:800,
        letterSpacing:'-.03em',
      }}>
        고래처럼,<br/>
        <span style={{ color:'rgba(255,255,255,.55)', fontWeight:700 }}>시장을 유영하듯</span>
      </h1>
      <p style={{ margin:'32px auto 0', fontSize:19, lineHeight:1.65,
        color:'var(--ink-1)', maxWidth:560 }}>
        실시간 시세 데이터와 포트폴리오 분석으로<br/>
        나만의 투자 전략을 안전하게 실험해보세요.
      </p>
      <div style={{ marginTop:40, display:'flex', justifyContent:'center',
        alignItems:'center', gap:14, flexWrap:'wrap' }}>
        <PrimaryButton size="lg">항해 시작하기 →</PrimaryButton>
        <GhostButton size="lg">첫 항해가 불안하다면 <VirtBadge/></GhostButton>
      </div>

      {/* stat row pinned to bottom */}
      <div style={{ marginTop:96, display:'grid', gridTemplateColumns:'repeat(3,1fr)',
        gap:0, paddingTop:32, borderTop:'1px solid var(--line)' }}>
        {[
          ['12,000+','추적 자산'],
          ['0.2s','실시간 호가'],
          ['38.4K','누적 항해사'],
        ].map(([n,l],i) => (
          <div key={l} style={{
            borderLeft: i>0 ? '1px solid var(--line)' : 'none', padding:'0 24px',
          }}>
            <div className="mono" style={{ fontSize:36, fontWeight:600,
              color:'#fff', letterSpacing:'-.02em' }}>{n}</div>
            <div style={{ fontSize:12, color:'var(--ink-2)', marginTop:6,
              letterSpacing:'.08em' }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

/* ----------------------------------------------------------- */
/* A3 — Editorial split: huge title bottom-left, whale top-right */
/* ----------------------------------------------------------- */
const HeroA3 = () => (
  <section style={{ ...heroBg, minHeight:880 }}>
    {heroAura}

    <div style={{ position:'relative', maxWidth:1440, margin:'0 auto',
      padding:'56px 56px 80px', display:'grid',
      gridTemplateColumns:'1fr 1fr', gridTemplateRows:'auto 1fr',
      gap:'0 48px', minHeight:760 }}>
      {/* top-left: eyebrow + sub */}
      <div style={{ alignSelf:'start' }}>
        <Eyebrow>AI 기반 실시간 시장 분석</Eyebrow>
        <p style={{ marginTop:28, fontSize:17, lineHeight:1.65, color:'var(--ink-1)',
          maxWidth:380 }}>
          실시간 시세 데이터와 포트폴리오 분석으로
          나만의 투자 전략을 안전하게 실험해보세요. 시장의 깊은 곳을
          조용히, 그러나 단단하게 항해합니다.
        </p>
      </div>

      {/* top-right: whale */}
      <div style={{ position:'relative', height:440, gridRow:'1 / span 2', alignSelf:'start',
        marginTop:-16 }}>
        <ParallaxWhale id="whalearc-hero-A3" depth={0.10} animDuration={9}
          placeholder="고래 일러스트 — 우상단" />
      </div>

      {/* bottom-left: huge title + CTAs */}
      <div style={{ alignSelf:'end' }}>
        <h1 style={{
          margin:0, fontSize:112, lineHeight:.96, fontWeight:800,
          letterSpacing:'-.035em',
        }}>
          고래처럼,<br/>
          <span style={{ color:'rgba(255,255,255,.5)', fontWeight:700 }}>유영하듯.</span>
        </h1>
        <div style={{ marginTop:36, display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
          <PrimaryButton size="lg">항해 시작하기 →</PrimaryButton>
          <GhostButton size="lg">첫 항해가 불안하다면 <VirtBadge/></GhostButton>
        </div>
      </div>
    </div>

    {/* full-width trust strip */}
    <div style={{ position:'relative', borderTop:'1px solid var(--line)',
      padding:'20px 56px', display:'flex', alignItems:'center', gap:40,
      color:'var(--ink-2)', fontSize:12.5, letterSpacing:'.04em', flexWrap:'wrap',
      maxWidth:1440, margin:'0 auto' }}>
      <span style={{ color:'#9cc1ff', fontWeight:600, letterSpacing:'.16em',
        fontSize:11 }}>BY THE NUMBERS</span>
      <span>· 가상 자산 12,000+ 추적</span>
      <span>· 실시간 호가 0.2초</span>
      <span>· 누적 항해사 38,400명</span>
      <span>· 가상 항해(VIRT) 무제한 무료</span>
    </div>
  </section>
);

const HERO_VARIANTS = { A1: HeroA1, A2: HeroA2, A3: HeroA3 };
Object.assign(window, { HeroA1, HeroA2, HeroA3, HERO_VARIANTS });
