/* VIRT Dashboard — full landing for the sandbox environment */

/* ============================================================ */
/* Hero — blue gradient banner with greeting + summary           */
/* ============================================================ */
const VirtHero = ({ name, totalKRW, ret }) => (
  <section style={{ padding:'24px 32px 0' }}>
    <article style={{
      position:'relative', overflow:'hidden',
      borderRadius:18,
      background:'linear-gradient(120deg, #2c6fe6 0%, #4d8aff 50%, #6ba0ff 100%)',
      color:'#fff',
      boxShadow:'0 16px 40px -16px rgba(44,111,230,.4)',
    }}>
      {/* faint pattern */}
      <div aria-hidden style={{ position:'absolute', inset:0,
        background:'radial-gradient(60% 60% at 80% 30%, rgba(255,255,255,.15), transparent 70%)'}}/>

      <div style={{ position:'relative', padding:'30px 36px',
        display:'grid', gridTemplateColumns:'1fr auto', alignItems:'center',
        gap:24, flexWrap:'wrap' }}>
        {/* left — greeting + whale */}
        <div style={{ display:'flex', alignItems:'center', gap:18, minWidth:0 }}>
          <div aria-hidden style={{
            width:62, height:62, borderRadius:'50%',
            background:'rgba(255,255,255,.18)',
            backdropFilter:'blur(8px)',
            display:'flex', alignItems:'center', justifyContent:'center',
            flexShrink:0,
            animation:'whale-float 7s ease-in-out infinite',
          }}>
            <svg width="36" height="28" viewBox="0 0 32 24" fill="none">
              <path d="M3 16 Q 8 5 16 8 Q 24 11 28 6 L 30 10 L 28 13 L 26 14 Q 22 18 14 17 Q 8 17 5 19 Q 3 18 3 16 Z"
                fill="#fff" opacity=".95"/>
              <circle cx="10" cy="13" r="1" fill="#2c6fe6"/>
            </svg>
          </div>
          <div style={{ minWidth:0 }}>
            <h1 style={{ margin:0, fontSize:24, lineHeight:1.2, fontWeight:700 }}>
              {name}님, 다시 바다에 오셨군요!
            </h1>
            <p style={{ margin:'6px 0 0', fontSize:14, opacity:.86 }}>
              오늘도 시장의 바다를 유영해볼까요?
            </p>
          </div>
        </div>

        {/* right — summary */}
        <div style={{ display:'flex', alignItems:'center', gap:32, whiteSpace:'nowrap' }}>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:11, opacity:.8, letterSpacing:'.1em' }}>총 자산</div>
            <div className="mono" style={{ marginTop:4, fontSize:24, fontWeight:700,
              letterSpacing:'-.01em' }}>{wKRW(totalKRW)}</div>
          </div>
          <div style={{ width:1, height:36, background:'rgba(255,255,255,.25)' }}/>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:11, opacity:.8, letterSpacing:'.1em' }}>수익률</div>
            <div className="mono" style={{ marginTop:4, fontSize:22, fontWeight:700,
              letterSpacing:'-.01em' }}>
              <Tri up={ret >= 0}/>{ret >= 0 ? '+' : ''}{ret.toFixed(2)}%
            </div>
          </div>
        </div>
      </div>
    </article>
  </section>
);

/* ============================================================ */
/* Tip banner (yellow)                                           */
/* ============================================================ */
const VirtTipBanner = ({ onClose }) => (
  <section style={{ padding:'20px 32px 0' }}>
    <article style={{
      padding:'16px 22px',
      borderRadius:14,
      background:'var(--bg-1)',
      border:'1px solid var(--line)',
      boxShadow:'0 1px 0 rgba(14,25,54,.02), 0 6px 24px -16px rgba(14,25,54,.10)',
      display:'flex', alignItems:'center', gap:16, flexWrap:'wrap',
    }}>
      <span style={{
        width:34, height:34, borderRadius:'50%',
        background:'var(--accent-bg)', color:'var(--accent)',
        display:'inline-flex', alignItems:'center', justifyContent:'center',
        border:'1px solid rgba(91,157,255,.20)', flexShrink:0,
      }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.4"/>
          <path d="M7 6V10 M7 4.2V4.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
      </span>
      <div style={{ flex:1, minWidth:200 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6,
          flexWrap:'wrap' }}>
          <span style={{ fontSize:13.5, fontWeight:600, color:'var(--ink-0)' }}>
            처음이신가요? 화면 가이드 받기
          </span>
          <span style={{ fontSize:11.5, color:'var(--ink-2)' }}>· 약 3분</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:160, height:5, borderRadius:3,
            background:'var(--bg-2)', border:'1px solid var(--line)',
            overflow:'hidden' }}>
            <div style={{ width:'25%', height:'100%',
              background:'linear-gradient(90deg, var(--accent), var(--accent-glow))' }}/>
          </div>
          <span className="mono" style={{ fontSize:11, color:'var(--ink-2)' }}>1 / 4</span>
        </div>
      </div>
      <button style={{
        padding:'9px 16px', borderRadius:9,
        border:0,
        background:'linear-gradient(180deg, var(--accent-glow), var(--accent))',
        color:'#fff', fontSize:13, fontWeight:600,
        cursor:'pointer', fontFamily:'inherit',
        boxShadow:'0 6px 14px -8px rgba(60,120,255,.5)',
      }}>가이드 시작 →</button>
      <button onClick={onClose} aria-label="닫기" style={{
        width:28, height:28, borderRadius:8, border:0, background:'transparent',
        color:'var(--ink-2)', cursor:'pointer',
      }}>✕</button>
    </article>
  </section>
);

/* ============================================================ */
/* Portfolio summary (3 stat cards + target progress)            */
/* ============================================================ */
const PortfolioSummary = ({ total, cash, ret, target = 10 }) => {
  const progress = Math.min(100, Math.max(0, (Math.abs(ret) / target) * 100));
  return (
    <section style={{ ...virtCard }}>
      <header style={{ ...cardSection, paddingBottom:0,
        display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <h3 style={sectionTitle}>포트폴리오 요약</h3>
        <a style={sectionLink}>상세 보기 →</a>
      </header>
      <div style={{ padding:'18px 24px 0', display:'grid',
        gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:14 }}>
        <SumCard label="총 자산" value={wKRW(total)} />
        <SumCard label="현금"    value={wKRW(cash)} />
        <SumCard label="수익률"  value={
          <span><Tri up={ret >= 0}/>{ret >= 0 ? '+' : ''}{ret.toFixed(2)}%</span>
        } emphasis />
      </div>
      <div style={{ ...cardSection, paddingTop:24 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline',
          marginBottom:10 }}>
          <span style={{ fontSize:12.5, color:'var(--ink-1)' }}>목표 수익률</span>
          <a style={{ ...sectionLink, fontSize:12 }}>
            {target}% <span style={{ color:'var(--ink-2)', marginLeft:4 }}>✎</span>
          </a>
        </div>
        <div style={{ position:'relative', height:6, borderRadius:3,
          background:'var(--bg-2)', border:'1px solid var(--line)' }}>
          <div style={{ position:'absolute', left:0, top:0, bottom:0,
            width:`${progress}%`, borderRadius:3,
            background: ret >= 0
              ? 'linear-gradient(90deg, var(--up), #ff6b6b)'
              : 'linear-gradient(90deg, var(--accent), var(--accent-glow))' }}/>
        </div>
        <div style={{ marginTop:8, fontSize:11.5, color:'var(--ink-2)' }}>
          {Math.abs(ret).toFixed(2)}% / {target}%
        </div>
      </div>
    </section>
  );
};

const SumCard = ({ label, value, emphasis }) => (
  <div style={{
    padding:'18px 18px', borderRadius:12,
    background: emphasis ? 'var(--accent-bg)' : 'var(--bg-2)',
    border: emphasis ? '1px solid rgba(91,157,255,.28)' : '1px solid var(--line)',
  }}>
    <div style={{ fontSize:11.5, color:'var(--ink-2)', letterSpacing:'.04em' }}>{label}</div>
    <div className="mono" style={{ marginTop:8, fontSize:22, fontWeight:700,
      letterSpacing:'-.01em', color: emphasis ? 'var(--accent)' : 'var(--ink-0)' }}>
      {value}
    </div>
  </div>
);

/* ============================================================ */
/* Holdings card (3 crypto holdings)                              */
/* ============================================================ */
const COIN_GLYPHS = {
  BTC: { bg:'#f7931a', label:'₿', fg:'#fff' },
  ETH: { bg:'#627eea', label:'Ξ', fg:'#fff' },
  SOL: { bg:'#9945ff', label:'◎', fg:'#fff' },
};

const HoldingsCard = ({ items }) => (
  <section style={{ ...virtCard }}>
    <header style={{ ...cardSection, paddingBottom:14,
      display:'flex', alignItems:'center', justifyContent:'space-between',
      borderBottom:'1px solid var(--line)' }}>
      <h3 style={sectionTitle}>보유 종목</h3>
      <a style={sectionLink}>전체 보기 →</a>
    </header>

    <div style={{ padding:'18px 24px 8px',
      display:'flex', alignItems:'center', gap:10 }}>
      <span style={{ fontSize:14 }}>🐋</span>
      <span style={{ fontSize:13, fontWeight:600 }}>가상화폐</span>
      <span style={{ fontSize:12, color:'var(--ink-2)' }}>{items.length}종목</span>
    </div>

    <ul style={{ margin:0, padding:0, listStyle:'none' }}>
      {items.map((h, i) => {
        const up = h.dPct >= 0;
        const glyph = COIN_GLYPHS[h.sym] || { bg:'#e5e7eb', label:h.sym[0], fg:'#374151' };
        return (
          <li key={h.sym} style={{
            padding:'14px 24px',
            borderTop: i === 0 ? '1px solid var(--line)' : 'none',
            borderBottom: '1px solid var(--line)',
            display:'grid', gridTemplateColumns:'auto 1fr auto', gap:14,
            alignItems:'center',
          }}>
            <span style={{
              width:34, height:34, borderRadius:'50%',
              background:glyph.bg, color:glyph.fg,
              display:'inline-flex', alignItems:'center', justifyContent:'center',
              fontSize:16, fontWeight:700, flexShrink:0,
            }}>{glyph.label}</span>
            <div style={{ minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3,
                flexWrap:'wrap' }}>
                <span style={{ fontSize:14.5, fontWeight:600 }}>{h.name}</span>
                {h.strategy && (
                  <span style={{
                    fontSize:10.5, padding:'2px 7px', borderRadius:5,
                    background:'var(--accent-bg)', color:'var(--accent)',
                    border:'1px solid rgba(91,157,255,.28)',
                    fontWeight:600, whiteSpace:'nowrap',
                  }}>{h.strategy}</span>
                )}
              </div>
              <div className="mono" style={{ fontSize:11.5, color:'var(--ink-2)' }}>
                {h.qty} 보유
              </div>
            </div>
            <div style={{ textAlign:'right', whiteSpace:'nowrap' }}>
              <div className="mono" style={{ fontSize:14.5, fontWeight:700 }}>
                {wKRW(h.value)}
              </div>
              <div className="mono" style={{ marginTop:3, fontSize:12, fontWeight:600,
                color: up ? 'var(--up)' : 'var(--down)' }}>
                <Tri up={up}/>{up ? '+' : ''}{h.dPct.toFixed(2)}%
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  </section>
);

/* ============================================================ */
/* Watchlist empty (cute baby whale)                             */
/* ============================================================ */
const BabyWhale = () => (
  <svg width="84" height="64" viewBox="0 0 84 64" fill="none"
    style={{ display:'block', animation:'baby-whale-bob 4s ease-in-out infinite' }}>
    <defs>
      <linearGradient id="bw-body" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor="#cfe1ff"/>
        <stop offset="100%" stopColor="#a8c8f3"/>
      </linearGradient>
      <linearGradient id="bw-belly" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor="#fff"/>
        <stop offset="100%" stopColor="#eef3fb"/>
      </linearGradient>
    </defs>
    {/* tail */}
    <path d="M68 22 L 80 16 L 78 28 L 80 40 L 68 36 Z" fill="url(#bw-body)"/>
    {/* body */}
    <ellipse cx="38" cy="32" rx="34" ry="20" fill="url(#bw-body)"/>
    {/* belly */}
    <ellipse cx="34" cy="38" rx="22" ry="11" fill="url(#bw-belly)"/>
    {/* eye */}
    <circle cx="18" cy="28" r="2.2" fill="#0e1936"/>
    <circle cx="18.7" cy="27.3" r=".7" fill="#fff"/>
    {/* mouth */}
    <path d="M8 32 Q 12 35 16 33" stroke="#0e1936" strokeWidth="1.4"
      strokeLinecap="round" fill="none"/>
    {/* water spout */}
    <g opacity=".5">
      <circle cx="42" cy="10" r="1.5" fill="#a8c8f3"/>
      <circle cx="46" cy="6" r="1.2" fill="#a8c8f3"/>
      <circle cx="40" cy="6" r="1" fill="#a8c8f3"/>
    </g>
  </svg>
);

const WatchlistEmpty = () => (
  <section style={{ ...virtCard }}>
    <header style={{ ...cardSection, paddingBottom:14,
      display:'flex', alignItems:'center', justifyContent:'space-between',
      borderBottom:'1px solid var(--line)' }}>
      <h3 style={sectionTitle}>관심 종목</h3>
      <a style={sectionLink}>종목 편집 →</a>
    </header>
    <div style={{ padding:'44px 24px 36px', textAlign:'center' }}>
      <div style={{ display:'flex', justifyContent:'center', marginBottom:16 }}>
        <BabyWhale/>
      </div>
      <div style={{ fontSize:15, fontWeight:600, color:'var(--ink-0)' }}>
        관심 종목이 없습니다
      </div>
      <p style={{ margin:'8px auto 18px', fontSize:13, color:'var(--ink-1)',
        maxWidth:340, lineHeight:1.55 }}>
        프로필에서 관심 종목을 추가하면 여기에 실시간 시세가 표시됩니다.
      </p>
      <button style={{
        padding:'10px 18px', borderRadius:10,
        border:'1px solid var(--line-strong)', background:'var(--bg-1)',
        color:'var(--ink-0)', fontSize:13, fontWeight:600, cursor:'pointer',
        fontFamily:'inherit',
      }}>관심 종목 추가하기</button>
    </div>
  </section>
);

/* ============================================================ */
/* RIGHT: Investment summary                                      */
/* ============================================================ */
const InvestmentSummary = ({ cash, equity, total, pnlAbs, pnlPct }) => (
  <section style={{ ...virtCard }}>
    <header style={{ ...cardSection, paddingBottom:14,
      borderBottom:'1px solid var(--line)' }}>
      <h3 style={sectionTitle}>투자 요약</h3>
    </header>
    <dl style={{ margin:0, padding:'16px 24px 20px',
      display:'flex', flexDirection:'column', gap:14 }}>
      <Row label="현금"          value={wKRW(cash)} />
      <Row label="보유 종목 평가" value={wKRW(equity)} />
      <Row label="총 자산"        value={wKRW(total)} emphasis />
      <Row label="총 손익" value={
        <span style={{ color: pnlAbs >= 0 ? 'var(--up)' : 'var(--down)' }}>
          {pnlAbs >= 0 ? '+' : '-'}{wKRW(Math.abs(pnlAbs))}
          <span style={{ marginLeft:6, fontSize:12, fontWeight:600 }}>
            ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)
          </span>
        </span>
      } />
    </dl>
  </section>
);

const Row = ({ label, value, emphasis }) => (
  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline',
    gap:12 }}>
    <dt style={{ fontSize:13, color:'var(--ink-1)' }}>{label}</dt>
    <dd className="mono" style={{ margin:0, fontSize: emphasis ? 16 : 14,
      fontWeight: emphasis ? 700 : 600, color:'var(--ink-0)', whiteSpace:'nowrap' }}>{value}</dd>
  </div>
);

/* ============================================================ */
/* RIGHT: Sailing strategy                                        */
/* ============================================================ */
const SailingStrategy = ({ name, totalKRW, holdings }) => (
  <section style={{ ...virtCard }}>
    <header style={{ ...cardSection, paddingBottom:14,
      display:'flex', alignItems:'center', justifyContent:'space-between',
      borderBottom:'1px solid var(--line)' }}>
      <h3 style={sectionTitle}>항해 중인 항로</h3>
      <a href="learn.html" style={sectionLink}>전략 학습 →</a>
    </header>
    <div style={{ padding:'18px 24px 22px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8,
        flexWrap:'wrap' }}>
        <span style={{ fontSize:14.5, fontWeight:700 }}>{name}</span>
        <span style={{
          fontSize:11, padding:'2px 8px', borderRadius:5,
          background:'rgba(239,77,77,.14)', color:'#0d9d6e',
          fontWeight:700, letterSpacing:'.04em',
          border:'1px solid rgba(239,77,77,.32)',
          display:'inline-flex', alignItems:'center', gap:5,
        }}>
          <span style={{ width:5, height:5, borderRadius:'50%',
            background:'#0d9d6e',
            animation:'pulse-dot 2s ease-in-out infinite' }}/>
          운항중
        </span>
      </div>
      <div style={{ fontSize:12.5, color:'var(--ink-1)', lineHeight:1.55 }}>
        투자: <span className="mono" style={{ color:'var(--ink-0)', fontWeight:600 }}>
          {wKRW(totalKRW)}
        </span> · {holdings.join(', ')}
      </div>
    </div>
  </section>
);

/* ============================================================ */
/* RIGHT: Quick actions                                           */
/* ============================================================ */
const QuickActions = () => (
  <section style={{ ...virtCard, padding:'18px 18px' }}>
    <h3 style={{ ...sectionTitle, padding:'4px 6px 14px' }}>빠른 액션</h3>
    <ul style={{ margin:0, padding:0, listStyle:'none',
      display:'flex', flexDirection:'column', gap:8 }}>
      <ActionItem variant="primary" label="거래하기" href="trade.html" />
      <ActionItem label="항로 둘러보기" href="learn.html" />
      <ActionItem label="전략 분석" href="backtest.html" />
      <ActionItem label="CSV 내보내기" icon={
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
          <path d="M3 9v2.5h8V9 M7 2v8 M4 7l3 3 3-3" stroke="currentColor"
            strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        </svg>
      } />
      <ActionItem variant="danger" label="새 항해 시작" icon={
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
          <path d="M2.5 7a4.5 4.5 0 1 0 1.3-3.2 M4 1.5V4H1.5" stroke="currentColor"
            strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        </svg>
      } />
    </ul>
  </section>
);

const ActionItem = ({ label, icon, variant, href }) => {
  const base = {
    width:'100%', padding:'12px 14px', borderRadius:10,
    fontFamily:'inherit', fontSize:13, fontWeight:600,
    cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between',
    transition:'background .15s, border-color .15s', textDecoration:'none',
  };
  const styles = variant === 'primary' ? {
    ...base,
    background:'linear-gradient(180deg, var(--accent-glow), var(--accent))',
    color:'#fff', border:0,
    boxShadow:'0 6px 14px -8px rgba(60,120,255,.5)',
  } : variant === 'danger' ? {
    ...base,
    background:'transparent', border:'1px solid rgba(239,77,77,.32)',
    color:'var(--up)',
  } : {
    ...base,
    background:'var(--bg-2)', border:'1px solid var(--line)',
    color:'var(--ink-0)',
  };
  const C = href ? 'a' : 'button';
  return (
    <li>
      <C href={href} style={styles}>
        <span style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
          {icon}
          {label}
        </span>
        <span style={{ fontSize:14, opacity:.7 }}>{variant === 'danger' ? '' : '›'}</span>
      </C>
    </li>
  );
};

/* ============================================================ */
/* RIGHT: Deeper ocean (upsell to real WhaleArc)                  */
/* ============================================================ */
const DeeperOcean = () => (
  <a href="dashboard.html" style={{
    display:'block',
    padding:'18px 20px', borderRadius:14,
    background:'linear-gradient(135deg, rgba(91,157,255,.10), rgba(91,157,255,.02))',
    border:'1px solid rgba(91,157,255,.24)',
    cursor:'pointer', textDecoration:'none', color:'inherit',
    transition:'transform .15s',
  }}
  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
      gap:12 }}>
      <div>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
          <span style={{ fontSize:14, fontWeight:700, color:'var(--ink-0)' }}>
            더 깊은 바다로
          </span>
          <span style={{
            fontSize:10.5, padding:'2px 7px', borderRadius:5,
            background:'var(--accent)', color:'#fff',
            fontWeight:700, letterSpacing:'.04em',
          }}>WhaleArc</span>
        </div>
        <div style={{ fontSize:11.5, color:'var(--ink-1)' }}>
          실계좌 자산 연동 · 포트폴리오 관리 · 실전 투자 대시보드
        </div>
      </div>
      <span style={{ fontSize:18, color:'var(--accent)' }}>→</span>
    </div>
  </a>
);

/* ============================================================ */
/* APP                                                            */
/* ============================================================ */
function VirtDashboardApp() {
  const [tipDismissed, setTipDismissed] = React.useState(false);

  // mock state matching the screenshot
  const cash = 7_000_001;
  const equity = 2_644_545;
  const total = cash + equity;
  const pnlAbs = -355_454;
  const pnlPct = (pnlAbs / (total - pnlAbs)) * 100;

  const holdings = [
    { sym:'BTC', name:'비트코인', strategy:'골든크로스 추종 전략',
      qty:'0.0083325개', value:900_368, dPct:-9.87 },
    { sym:'ETH', name:'이더리움', strategy:'골든크로스 추종 전략',
      qty:'0.29723326개', value:869_407, dPct:-12.97 },
    { sym:'SOL', name:'솔라나',   strategy:'골든크로스 추종 전략',
      qty:'7.35100072개', value:874_769, dPct:-12.44 },
  ];

  return (
    <>
      <VirtNav active="내 투자" />
      <VirtHero name="김병하" totalKRW={total} ret={pnlPct} />
      {!tipDismissed && <VirtTipBanner onClose={() => setTipDismissed(true)} />}

      <main style={{ padding:'24px 32px 80px',
        display:'grid',
        gridTemplateColumns:'minmax(0, 1.55fr) minmax(280px, 1fr)',
        gap:24, alignItems:'start' }}>
        {/* LEFT */}
        <div style={{ display:'flex', flexDirection:'column', gap:20, minWidth:0 }}>
          <PortfolioSummary total={total} cash={cash} ret={pnlPct} target={10}/>
          <HoldingsCard items={holdings}/>
          <WatchlistEmpty/>
        </div>

        {/* RIGHT */}
        <div style={{ display:'flex', flexDirection:'column', gap:20,
          position:'sticky', top:96 }}>
          <InvestmentSummary cash={cash} equity={equity} total={total}
            pnlAbs={pnlAbs} pnlPct={pnlPct} />
          <SailingStrategy
            name="골든크로스 추종 전략"
            totalKRW={2_997_002}
            holdings={['비트코인(BTC)','이더리움(ETH)','솔라나(SOL)']}
          />
          <QuickActions/>
          <DeeperOcean/>
        </div>
      </main>

      <footer style={{ padding:'40px 32px 28px',
        borderTop:'1px solid var(--line)',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        flexWrap:'wrap', gap:14 }}>
        <span className="mono" style={{ fontSize:12, color:'var(--ink-2)' }}>
          © 2026 WhaleArc-VIRT · 이 환경의 모든 거래는 가상이며 실제 자금이 움직이지 않습니다.
        </span>
        <div style={{ display:'flex', gap:18, fontSize:12.5, color:'var(--ink-1)' }}>
          <a>도움말</a><a>상태</a><a>API</a><a>의견 보내기</a>
        </div>
      </footer>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<VirtDashboardApp />);
