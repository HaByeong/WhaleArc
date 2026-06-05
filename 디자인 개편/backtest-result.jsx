/* Backtest — center views (empty / strategy detail / result) */

const fmtNum = (n) => n.toLocaleString('ko-KR');

/* ============================================================ */
/* Blue → teal gradient station header bar (shared)              */
/* ============================================================ */
const BT_GRAD = 'linear-gradient(105deg, #142647 0%, #1d3c7a 52%, #2c6fe6 100%)';

const StationBar = ({ title, sub, badge }) => (
  <div style={{
    position:'relative', overflow:'hidden',
    display:'flex', alignItems:'center', gap:14,
    padding:'16px 22px', borderRadius:14,
    background: BT_GRAD,
    border:'1px solid rgba(255,255,255,.14)',
    boxShadow:'0 10px 26px -12px rgba(20,130,170,.6), inset 0 1px 0 rgba(255,255,255,.22)',
    color:'rgba(255,255,255,.96)',
  }}>
    <span aria-hidden style={{ position:'absolute', right:-30, top:-40, width:150, height:150,
      borderRadius:'50%', background:'radial-gradient(circle, rgba(255,255,255,.16), transparent 70%)',
      pointerEvents:'none' }}/>
    <span style={{ width:34, height:34, borderRadius:9, flexShrink:0,
      background:'rgba(255,255,255,.16)', border:'1px solid rgba(255,255,255,.3)',
      display:'flex', alignItems:'center', justifyContent:'center' }}>
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
        <path d="M8 1.5C5 1.5 3 3.7 3 6.4C3 10 8 14.5 8 14.5S13 10 13 6.4C13 3.7 11 1.5 8 1.5Z"
          stroke="#fff" strokeWidth="1.4" fill="rgba(255,255,255,.18)"/>
        <circle cx="8" cy="6.3" r="1.9" stroke="#fff" strokeWidth="1.4" fill="none"/>
      </svg>
    </span>
    <div style={{ flex:1, minWidth:0 }}>
      <h2 style={{ margin:0, fontSize:17, fontWeight:700, letterSpacing:'-.012em', color:'rgba(255,255,255,.96)',
        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{title}</h2>
      {sub && <p style={{ margin:'3px 0 0', fontSize:12.5, color:'rgba(255,255,255,.82)',
        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{sub}</p>}
    </div>
    {badge}
  </div>
);

/* ============================================================ */
/* Empty hero — no strategy selected                              */
/* ============================================================ */
/* ============================================================ */
/* Primary CTA — sky-blue glossy button with circular arrow      */
/* ============================================================ */
const CtaArrow = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
    <path d="M3 8h8.4M8.4 4.6 11.8 8l-3.4 3.4" stroke="#fff" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const PrimaryCTA = ({ children, onClick, style }) => (
  <button onClick={onClick} style={{
    position:'relative', padding:'16px 22px', borderRadius:16, cursor:'pointer', fontFamily:'inherit',
    border:'1px solid rgba(165,200,255,.6)',
    background:'linear-gradient(180deg, #5690f2 0%, #3673e2 100%)',
    boxShadow:'0 18px 32px -14px rgba(43,110,230,.65), inset 0 1px 0 rgba(255,255,255,.45), inset 0 0 0 1px rgba(150,185,255,.4)',
    color:'rgba(255,255,255,.98)', fontSize:16, fontWeight:700, letterSpacing:'-.01em',
    display:'flex', alignItems:'center', gap:10, ...style,
  }}>
    <span aria-hidden style={{ width:30, flexShrink:0 }}></span>
    <span style={{ flex:1, textAlign:'center' }}>{children}</span>
    <span style={{ width:30, height:30, borderRadius:'50%', flexShrink:0,
      background:'rgba(255,255,255,.18)', border:'1px solid rgba(255,255,255,.5)',
      display:'flex', alignItems:'center', justifyContent:'center' }}>
      <CtaArrow/>
    </span>
  </button>
);

const EmptyHero = () => (
  <section style={{ display:'flex', flexDirection:'column', gap:18 }}>
    {/* station header */}
    <StationBar title="항로 분석 스테이션" sub="전략을 선택하고 과거 데이터로 검증하세요" />

    {/* main empty state */}
    <div style={{ ...mkCard, padding:'24px 28px' }}>
      <div style={{ marginTop:0, padding:'48px 32px',
        textAlign:'center', borderRadius:12,
        background:'radial-gradient(80% 60% at 50% 30%, rgba(91,157,255,.10), transparent 70%)',
        border:'1px dashed var(--line-strong)' }}>
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none"
          style={{ display:'inline-block', marginBottom:14 }}>
          <path d="M22 4 C 14 4, 8 10, 8 18 C 8 28, 22 40, 22 40 C 22 40, 36 28, 36 18 C 36 10, 30 4, 22 4 Z"
            stroke="var(--accent-glow)" strokeWidth="1.8" fill="rgba(91,157,255,.08)"/>
          <circle cx="22" cy="18" r="5" stroke="var(--accent-glow)" strokeWidth="1.8" fill="none"/>
        </svg>
        <h2 style={{ margin:0, fontSize:24, fontWeight:700, letterSpacing:'-.015em' }}>
          항로를 설정하여 항해를 시작하세요
        </h2>
        <p style={{ margin:'12px auto 0', fontSize:14, color:'var(--ink-1)',
          maxWidth:440, lineHeight:1.6 }}>
          왼쪽에서 전략을 선택하면 항로 분석, 학습 영상, 백테스트가 여기에 표시됩니다.
        </p>
      </div>
    </div>

    {/* metric strip */}
    <div style={{ display:'grid',
      gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:14 }}>
      <BigStat n="8" l="전체 전략" />
      <BigStat n="8" l="기본 제공" />
      <BigStat n="0" l="내 전략" muted />
    </div>

    {/* quick start guide */}
    <div style={{ ...mkCard, padding:'24px 28px' }}>
      <h3 style={{ margin:'0 0 18px', fontSize:15, fontWeight:700 }}>빠른 시작 가이드</h3>
      <ol style={{ margin:0, padding:0, listStyle:'none',
        display:'flex', flexDirection:'column', gap:14 }}>
        <GuideStep n="01" t="전략 선택"
          s="왼쪽 목록에서 기본 전략(골든크로스, RSI 등)을 선택하세요. 각 전략에 마우스를 올리면 상세 설명을 볼 수 있습니다." />
        <GuideStep n="02" t="종목 & 기간 설정"
          s="오른쪽 패널에서 테스트할 종목(예: 비트코인)과 기간을 설정하세요." />
        <GuideStep n="03" t="백테스트 실행"
          s='실행 버튼을 누르면 "이 전략으로 과거에 투자했다면?" 결과가 차트로 표시됩니다.' />
      </ol>

      {/* sample CTA */}
      <PrimaryCTA style={{ marginTop:22, width:'100%' }}>
        가이드 체험 — 골든크로스 × BTC 백테스트
      </PrimaryCTA>

      {/* tip banner */}
      <div style={{ marginTop:12, padding:'12px 16px', borderRadius:10,
        background:'rgba(255,205,120,.06)', border:'1px solid rgba(255,205,120,.18)',
        display:'flex', alignItems:'center', gap:10 }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color:'#ffcd78' }}>
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.4"/>
          <path d="M7 4.5v3 M7 9.5v.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
        <span style={{ fontSize:13, color:'#ffcd78', flex:1 }}>
          처음이신가요? 화면 가이드 받기
        </span>
        <span style={{ fontSize:12, color:'var(--ink-2)', cursor:'pointer' }}>가이드 →</span>
      </div>
    </div>
  </section>
);

const BigStat = ({ n, l, muted }) => (
  <div style={{ ...mkCard, padding:'18px 20px', textAlign:'center' }}>
    <div className="mono" style={{ fontSize:36, fontWeight:700,
      letterSpacing:'-.02em',
      color: muted ? 'var(--ink-3)' : 'var(--accent-glow)' }}>{n}</div>
    <div style={{ marginTop:4, fontSize:12, color:'var(--ink-2)',
      letterSpacing:'.08em' }}>{l}</div>
  </div>
);

const GuideStep = ({ n, t, s }) => (
  <li style={{ display:'grid', gridTemplateColumns:'36px 1fr',
    alignItems:'start', gap:16 }}>
    <span className="mono" style={{
      width:32, height:32, borderRadius:8,
      border:'1px solid rgba(91,157,255,.3)',
      background:'rgba(91,157,255,.08)',
      color:'var(--accent-glow)',
      display:'flex', alignItems:'center', justifyContent:'center',
      fontSize:12, fontWeight:700, letterSpacing:'.04em',
    }}>{n}</span>
    <div>
      <div style={{ fontSize:14, fontWeight:700, marginBottom:4 }}>{t}</div>
      <div style={{ fontSize:13, color:'var(--ink-1)', lineHeight:1.55 }}>{s}</div>
    </div>
  </li>
);

/* ============================================================ */
/* Strategy detail (selected, before running)                     */
/* ============================================================ */
const StrategyDetail = ({ strategy }) => {
  const lvl = LEVEL_META[strategy.level];
  return (
    <section style={{ display:'flex', flexDirection:'column', gap:18 }}>
      {/* station header */}
      <StationBar title={strategy.name} sub={strategy.long} />

      <div style={{ ...mkCard, padding:'26px 30px',
        position:'relative', overflow:'hidden' }}>
        {/* accent strip */}
        <div aria-hidden style={{ position:'absolute', left:0, top:0, bottom:0, width:3,
          background:'linear-gradient(180deg, var(--accent), var(--accent-glow))' }}/>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between',
          gap:16, flexWrap:'wrap' }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', gap:6, marginBottom:10 }}>
              <span style={tagSx('#9cc1ff', 'rgba(91,157,255,.10)')}>기본</span>
              <span style={tagSx(lvl.color, lvl.bg)}>{lvl.label}</span>
              <span style={tagSx('var(--ink-2)', 'rgba(255,255,255,.04)')}>
                조건 {strategy.nCond}개
              </span>
            </div>
            <h2 style={{ margin:0, fontSize:24, fontWeight:700, letterSpacing:'-.015em' }}>
              {strategy.name}
            </h2>
            <p style={{ margin:'10px 0 0', fontSize:14.5, color:'var(--ink-1)',
              lineHeight:1.6 }}>{strategy.long}</p>
          </div>
          <button style={iconChip} title="복제·편집">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L12 5L5 12L1.5 12.5L2 9L9 2Z" stroke="currentColor"
                strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
            </svg>
          </button>
        </div>

        {/* explainer callouts */}
        <div style={{ marginTop:20, display:'flex', flexDirection:'column', gap:10 }}>
          <Callout icon="💡" title="쉽게 이해하기" body={strategy.easy}
            color="#ffcd78" bg="rgba(255,205,120,.06)" border="rgba(255,205,120,.20)"/>
          <Callout icon="🧭" title="왜 이 전략을 쓸까요?" body={strategy.why}
            color="#9cc1ff" bg="rgba(91,157,255,.06)" border="rgba(91,157,255,.20)"/>
        </div>
      </div>

      {/* conditions */}
      <div style={{ display:'grid',
        gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:14 }}>
        <ConditionCard side="buy"  title="매수 조건 (진입)" cond={strategy.buyCond} />
        <ConditionCard side="sell" title="매도 조건 (청산)" cond={strategy.sellCond} />
      </div>

      {/* strategy visualization */}
      <div style={{ ...mkCard, padding:'20px 24px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
          marginBottom:14, flexWrap:'wrap', gap:10 }}>
          <h3 style={{ margin:0, fontSize:14, fontWeight:700 }}>전략 시각화</h3>
          <span style={{ fontSize:11, color:'var(--ink-3)', letterSpacing:'.08em' }}>
            예시 차트 · 실데이터 X
          </span>
        </div>

        {/* legend */}
        <div style={{ display:'flex', alignItems:'center', gap:18, flexWrap:'wrap',
          marginBottom:10, fontSize:11.5 }}>
          <LegendDot c="#f5d061" l="MA 20"/>
          <LegendDot c="#5b9dff" l="MA 60"/>
          <LegendDot c="#ef4d4d" l="골든크로스 (매수)"/>
          <LegendDot c="#4d8aff" l="데드크로스 (매도)"/>
        </div>

        <div style={{ height:240 }}>
          <StrategyVizChart glyph={strategy.glyph}/>
        </div>
      </div>

      {/* CTA hint */}
      <div style={{ padding:'14px 18px', borderRadius:10,
        background:'rgba(91,157,255,.06)',
        border:'1px solid rgba(91,157,255,.20)',
        display:'flex', alignItems:'center', gap:12 }}>
        <span style={{ width:6, height:6, borderRadius:'50%',
          background:'var(--accent-glow)',
          animation:'pulse-dot 1.6s ease-in-out infinite' }}/>
        <span style={{ fontSize:13, color:'var(--ink-1)' }}>
          오른쪽 패널에서 종목과 기간을 설정한 뒤 <strong style={{ color:'#fff' }}>백테스트 실행</strong>을 눌러보세요.
        </span>
      </div>
    </section>
  );
};

const Callout = ({ icon, title, body, color, bg, border }) => (
  <div style={{ padding:'14px 16px', borderRadius:10, background: bg,
    border: `1px solid ${border}`, display:'grid',
    gridTemplateColumns:'auto 1fr', gap:14, alignItems:'flex-start' }}>
    <span style={{ fontSize:16, lineHeight:'20px' }}>{icon}</span>
    <div>
      <div style={{ fontSize:12, color, letterSpacing:'.06em', fontWeight:700,
        marginBottom:4 }}>{title}</div>
      <div style={{ fontSize:13, color:'var(--ink-1)', lineHeight:1.55 }}>{body}</div>
    </div>
  </div>
);

const ConditionCard = ({ side, title, cond }) => {
  const c = side === 'buy' ? 'var(--up)' : 'var(--down)';
  const bg = side === 'buy' ? 'rgba(239,77,77,.10)' : 'rgba(77,138,255,.10)';
  const border = side === 'buy' ? 'rgba(239,77,77,.24)' : 'rgba(77,138,255,.24)';
  return (
    <div style={{ ...mkCard, padding:'20px 22px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
        <span style={{ width:8, height:8, borderRadius:'50%', background:c }}/>
        <span style={{ fontSize:13, fontWeight:700 }}>{title}</span>
      </div>
      <div style={{ padding:'12px 14px', borderRadius:10,
        background: bg, border:`1px solid ${border}`,
        fontSize:13.5, color:'#fff' }}>
        <span className="mono" style={{ color: c, fontWeight:600 }}>
          {cond.replace(/MA\((\d+)\)/g, 'MA($1)').split(' ').slice(0, 3).join(' ')}
        </span>
        <span style={{ color:'var(--ink-1)' }}>
          {' '}{cond.split(' ').slice(3).join(' ')}{' '}
        </span>
        <span style={{ marginLeft:6,
          padding:'2px 8px', borderRadius:5, fontSize:11, fontWeight:700,
          background:c, color:'#0a1230', letterSpacing:'.04em' }}>
          {side === 'buy' ? '매수' : '매도'}
        </span>
      </div>
    </div>
  );
};

const LegendDot = ({ c, l }) => (
  <span style={{ display:'inline-flex', alignItems:'center', gap:6, color:'var(--ink-1)' }}>
    <span style={{ width:8, height:8, borderRadius:'50%', background:c }}/>
    {l}
  </span>
);

/* small MA-cross visualization */
const StrategyVizChart = ({ glyph }) => {
  // generate two MA lines that cross at known points
  const N = 80;
  const ma20 = []; const ma60 = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N-1);
    // ma60 — smoother
    const y60 = 50 + Math.sin(t * Math.PI * 2.2) * 15 + t * 6;
    // ma20 — more responsive, crosses ma60 twice
    const y20 = 50 + Math.sin(t * Math.PI * 2.2 + .3) * 22 + t * 6 + Math.sin(t * Math.PI * 5) * 4;
    ma20.push([t * 100, y20]);
    ma60.push([t * 100, y60]);
  }
  // find crossings
  const crosses = [];
  for (let i = 1; i < N; i++) {
    const diffPrev = ma20[i-1][1] - ma60[i-1][1];
    const diffCur  = ma20[i][1] - ma60[i][1];
    if (diffPrev * diffCur < 0) {
      const isGolden = diffPrev < 0; // ma20 was below, now above = golden
      const x = (ma20[i-1][0] + ma20[i][0]) / 2;
      const y = (ma20[i-1][1] + ma20[i][1]) / 2;
      crosses.push({ x, y, golden: isGolden });
    }
  }

  return (
    <svg viewBox="0 0 100 80" width="100%" height="100%"
      preserveAspectRatio="none" style={{ overflow:'visible' }}>
      {/* grid */}
      {[20,40,60].map(y => (
        <line key={y} x1="0" x2="100" y1={y} y2={y}
          stroke="rgba(255,255,255,.06)" strokeWidth=".3" vectorEffect="non-scaling-stroke"/>
      ))}
      {/* ma60 */}
      <path d={'M ' + ma60.map(p => p.join(' ')).join(' L ')}
        stroke="#5b9dff" strokeWidth="1.4" fill="none" vectorEffect="non-scaling-stroke"/>
      {/* ma20 */}
      <path d={'M ' + ma20.map(p => p.join(' ')).join(' L ')}
        stroke="#f5d061" strokeWidth="1.4" fill="none" vectorEffect="non-scaling-stroke"/>
      {/* crosses */}
      {crosses.map((c, i) => (
        <g key={i}>
          <circle cx={c.x} cy={c.y} r="2.8" fill="none"
            stroke={c.golden ? '#ef4d4d' : '#4d8aff'} strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"/>
          <circle cx={c.x} cy={c.y} r=".7"
            fill={c.golden ? '#ef4d4d' : '#4d8aff'}/>
        </g>
      ))}
    </svg>
  );
};

Object.assign(window, {
  fmtNum, EmptyHero, StrategyDetail, Callout, ConditionCard, StrategyVizChart, LegendDot,
});
