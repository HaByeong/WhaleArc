/* learn-light.jsx — light port of 전략 학습 page + chat modal */

/* ============================================================ */
/* Header                                                         */
/* ============================================================ */
const LearnHeaderL = () => (
  <section style={{ padding:'40px 32px 8px', textAlign:'center' }}>
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
      gap:12, marginBottom:8 }}>
      <WhaleAvatar size={42} animated/>
      <h1 style={{ margin:0, fontSize:36, lineHeight:1.1, fontWeight:800,
        letterSpacing:'-.02em' }}>전략 가이드</h1>
    </div>
    <p style={{ margin:'8px auto 0', fontSize:14, lineHeight:1.65,
      color:'var(--ink-1)', maxWidth:560 }}>
      각 전략을 쉽게 알려드려요! 카드를 클릭하면 챗으로 설명을 들을 수 있어요.<br/>
      마음에 드는 전략이 있다면 직접 항해도 시작할 수 있어요.
    </p>
  </section>
);

/* ============================================================ */
/* My voyage strip                                                */
/* ============================================================ */
const MyVoyageStripL = ({ active, holdings, totalKRW, onCancel }) => (
  <section style={{ padding:'24px 32px 0' }}>
    <article style={{
      position:'relative', overflow:'hidden',
      padding:'22px 26px', borderRadius:16,
      background:'linear-gradient(135deg, var(--accent-bg-strong), var(--accent-bg) 60%, var(--bg-1))',
      border:'1px solid rgba(91,157,255,.28)',
    }}>
      <div aria-hidden style={{ position:'absolute', left:0, top:0, bottom:0, width:3,
        background:'linear-gradient(180deg, var(--accent), var(--accent-glow))' }}/>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
        gap:24, flexWrap:'wrap' }}>
        <div style={{ minWidth:0, flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8,
            flexWrap:'wrap' }}>
            <span style={{ width:24, height:24, borderRadius:6,
              background:'rgba(22,163,74,.14)',
              border:'1px solid rgba(22,163,74,.32)',
              color:'var(--up)',
              display:'inline-flex', alignItems:'center', justifyContent:'center' }}>
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path d="M2 11 L 12 11 M 7 2 L 4 5 M 7 2 L 10 5 M 7 2 L 7 11"
                  stroke="currentColor" strokeWidth="1.4"
                  strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
            </span>
            <h3 style={{ margin:0, fontSize:14, fontWeight:700,
              letterSpacing:'.02em' }}>내 항해 현황</h3>
            <span style={{ fontSize:11, padding:'2px 8px', borderRadius:5,
              background:'rgba(22,163,74,.14)', color:'var(--up)',
              fontWeight:700, letterSpacing:'.08em',
              border:'1px solid rgba(22,163,74,.28)',
              display:'inline-flex', alignItems:'center', gap:5 }}>
              <span style={{ width:5, height:5, borderRadius:'50%',
                background:'var(--up)',
                animation:'pulse-dot 2s ease-in-out infinite' }}/>
              항해 중
            </span>
          </div>
          <div style={{ fontSize:18, fontWeight:700, letterSpacing:'-.005em' }}>
            {active}
          </div>
          <div style={{ marginTop:8, display:'flex', alignItems:'baseline', gap:12,
            flexWrap:'wrap', color:'var(--ink-1)', fontSize:13 }}>
            <span>투자:</span>
            <span className="mono" style={{ fontSize:15, fontWeight:700,
              color:'var(--ink-0)' }}>
              ₩{totalKRW.toLocaleString('ko-KR')}
            </span>
            <span style={{ color:'var(--ink-3)' }}>·</span>
            {holdings.map((h, i) => (
              <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                <span style={{ color:'var(--ink-1)' }}>{h.name}</span>
                <span className="mono" style={{ color:'var(--ink-2)', fontSize:12 }}>{h.qty}</span>
                {i < holdings.length - 1 && <span style={{ color:'var(--ink-3)' }}>,</span>}
              </span>
            ))}
          </div>
        </div>
        <button onClick={onCancel} style={{
          padding:'10px 18px', borderRadius:8,
          border:'1px solid rgba(239,68,68,.32)',
          background:'rgba(239,68,68,.06)',
          color:'var(--down)', fontSize:13, fontWeight:600,
          cursor:'pointer', fontFamily:'inherit',
          display:'inline-flex', alignItems:'center', gap:6, whiteSpace:'nowrap' }}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M3 3 L11 11 M11 3 L3 11" stroke="currentColor"
              strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          항해 취소
        </button>
      </div>
    </article>
  </section>
);

/* ============================================================ */
/* Category filter                                                */
/* ============================================================ */
const CategoryBarL = ({ active, onChange }) => (
  <section style={{ padding:'28px 32px 0', display:'flex', justifyContent:'center' }}>
    <div style={{ display:'flex', gap:6, flexWrap:'wrap', justifyContent:'center',
      maxWidth:760 }}>
      {LEARN_CATEGORIES.map(c => {
        const isOn = c.key === active;
        return (
          <button key={c.key} onClick={() => onChange(c.key)} style={{
            padding:'8px 16px', borderRadius:999, fontSize:13, fontWeight:600,
            border: isOn ? '1px solid var(--accent)' : '1px solid var(--line)',
            background: isOn ? 'var(--accent)' : 'var(--bg-1)',
            color: isOn ? '#fff' : 'var(--ink-1)',
            cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap',
          }}>{c.label}</button>
        );
      })}
    </div>
  </section>
);

/* ============================================================ */
/* Strategy card                                                  */
/* ============================================================ */
const TagL = ({ children, color, bg, border }) => (
  <span style={{
    fontSize:11, padding:'3px 8px', borderRadius:5,
    background: bg, color, fontWeight:700, letterSpacing:'.04em',
    border:`1px solid ${border}`, whiteSpace:'nowrap',
  }}>{children}</span>
);

const StrategyGuideCardL = ({ s, onOpen }) => {
  const lvl = LEARN_LEVELS[s.level];
  const isSailing = s.status === 'sailing';
  return (
    <article style={{
      ...lt_card, padding:0, display:'flex', flexDirection:'column',
      transition:'transform .15s, border-color .15s, box-shadow .15s',
    }}
    onMouseEnter={e => {
      e.currentTarget.style.borderColor = 'rgba(91,157,255,.32)';
      e.currentTarget.style.boxShadow = '0 1px 0 rgba(14,25,54,.02), 0 12px 32px -16px rgba(91,157,255,.25)';
    }}
    onMouseLeave={e => {
      e.currentTarget.style.borderColor = 'var(--line)';
      e.currentTarget.style.boxShadow = '0 1px 0 rgba(14,25,54,.02), 0 6px 24px -16px rgba(14,25,54,.10)';
    }}>
      <div style={{ padding:'18px 22px 0', display:'flex', gap:6, flexWrap:'wrap' }}>
        <TagL color={lvl.color} bg={lvl.bg} border={lvl.border}>{lvl.label}</TagL>
        <TagL color="var(--accent)" bg="var(--accent-bg)" border="rgba(91,157,255,.24)">
          {CATEGORY_LABEL[s.category]}
        </TagL>
        <TagL color="var(--ink-1)" bg="var(--bg-2)" border="var(--line)">
          {ASSET_LABEL[s.assetKind]}
        </TagL>
      </div>
      <h3 style={{ margin:'14px 22px 14px', fontSize:18, fontWeight:700,
        letterSpacing:'-.01em' }}>{s.name}</h3>
      <div style={{ margin:'0 22px 16px', display:'grid',
        gridTemplateColumns:'auto 1fr', gap:10, alignItems:'flex-start' }}>
        <WhaleAvatar size={32}/>
        <div style={{ padding:'12px 14px', borderRadius:12,
          borderTopLeftRadius:4,
          background:'var(--bg-2)', border:'1px solid var(--line)' }}>
          <p style={{ margin:0, fontSize:13, lineHeight:1.6, color:'var(--ink-1)',
            display:'-webkit-box', WebkitLineClamp:4, WebkitBoxOrient:'vertical',
            overflow:'hidden' }}>
            {s.short}
          </p>
        </div>
      </div>
      <div style={{ padding:'0 22px 16px', display:'flex', flexWrap:'wrap', gap:6 }}>
        {s.assetChips.map(([sym, name], i) => (
          <span key={i} style={{
            fontSize:11.5, padding:'4px 9px', borderRadius:5,
            background:'var(--bg-2)', border:'1px solid var(--line)',
            color:'var(--ink-1)', whiteSpace:'nowrap',
          }}>
            {name || sym}{name && sym ? `(${sym})` : ''}
          </span>
        ))}
      </div>
      <div style={{ marginTop:'auto', padding:'14px 18px',
        borderTop:'1px solid var(--line)', background:'var(--bg-2)',
        display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
        <button onClick={onOpen} style={{
          padding:'8px 14px', borderRadius:8,
          border:'1px solid var(--line-strong)', background:'var(--bg-1)',
          color:'var(--ink-0)', fontSize:13, fontWeight:600,
          cursor:'pointer', fontFamily:'inherit',
          display:'inline-flex', alignItems:'center', gap:6 }}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <rect x="2" y="2.5" width="10" height="8" rx="1.2" stroke="currentColor"
              strokeWidth="1.3" fill="none"/>
            <path d="M4.5 5.5 L9.5 5.5 M4.5 7.5 L8 7.5" stroke="currentColor"
              strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          알아보기
        </button>
        {isSailing ? (
          <span style={{
            padding:'8px 14px', borderRadius:8,
            background:'linear-gradient(180deg, rgba(22,163,74,.22), rgba(22,163,74,.10))',
            border:'1px solid rgba(22,163,74,.32)',
            color:'var(--up)', fontSize:13, fontWeight:700,
            display:'inline-flex', alignItems:'center', gap:6, whiteSpace:'nowrap' }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--up)',
              animation:'pulse-dot 2s ease-in-out infinite' }}/>
            항해 중
            <span>⛵</span>
          </span>
        ) : (
          <button style={{
            padding:'8px 14px', borderRadius:8,
            border:'1px solid rgba(91,157,255,.32)',
            background:'var(--accent-bg)',
            color:'var(--accent)', fontSize:13, fontWeight:600,
            cursor:'pointer', fontFamily:'inherit',
            display:'inline-flex', alignItems:'center', gap:6, whiteSpace:'nowrap' }}>
            <span style={{ fontSize:10, padding:'2px 5px', borderRadius:4,
              background:'var(--accent)', color:'#fff',
              fontWeight:700, letterSpacing:'.04em' }}>VIRT</span>
            전용
          </button>
        )}
      </div>
    </article>
  );
};

const StrategyGridL = ({ items, onOpen }) => (
  <section style={{ padding:'28px 32px 60px' }}>
    <div style={{ display:'grid',
      gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:20 }}>
      {items.map(s => <StrategyGuideCardL key={s.id} s={s} onOpen={() => onOpen(s)} />)}
    </div>
  </section>
);

/* ============================================================ */
/* Modal — chat style                                             */
/* ============================================================ */
const lt_baseBubble = {
  padding:'12px 14px', borderRadius:14, borderTopLeftRadius:4,
  background:'var(--bg-2)', border:'1px solid var(--line)',
};

const AnswerBlockL = ({ blk }) => {
  if (blk.kind === 'text')
    return (
      <div style={lt_baseBubble}>
        <p style={{ margin:0, fontSize:13.5, lineHeight:1.65, color:'var(--ink-1)' }}>
          {blk.body}
        </p>
      </div>
    );
  if (blk.kind === 'term')
    return (
      <div style={{ ...lt_baseBubble, padding:'8px 12px',
        background:'var(--accent-bg)', border:'1px solid rgba(91,157,255,.24)' }}>
        <span style={{ fontSize:12, color:'var(--ink-2)' }}>관련 용어: </span>
        <span style={{ fontSize:12.5, color:'var(--accent)', fontWeight:600,
          textDecoration:'underline', textDecorationStyle:'dotted',
          textUnderlineOffset:3, cursor:'help' }} title={blk.def}>{blk.name}</span>
        <span style={{ marginLeft:4, color:'var(--ink-3)', fontSize:11 }}>ⓘ</span>
      </div>
    );
  if (blk.kind === 'easy')
    return (
      <div style={{ ...lt_baseBubble,
        background:'#fff8e1', border:'1px solid #f0d97a',
        display:'grid', gridTemplateColumns:'auto 1fr', gap:12, alignItems:'flex-start' }}>
        <span style={{ fontSize:18, lineHeight:'18px' }}>💡</span>
        <p style={{ margin:0, fontSize:13.5, lineHeight:1.65,
          color:'#5a4500' }}>{blk.body}</p>
      </div>
    );
  if (blk.kind === 'steps')
    return (
      <div style={lt_baseBubble}>
        <ol style={{ margin:0, padding:0, listStyle:'none',
          display:'flex', flexDirection:'column', gap:10 }}>
          {blk.steps.map((s, i) => (
            <li key={i} style={{ display:'grid', gridTemplateColumns:'22px 1fr',
              alignItems:'flex-start', gap:12 }}>
              <span style={{ width:22, height:22, borderRadius:'50%',
                background:'var(--accent-bg)',
                border:'1px solid rgba(91,157,255,.32)',
                color:'var(--accent)',
                display:'inline-flex', alignItems:'center', justifyContent:'center',
                fontSize:11, fontWeight:700, fontFamily:'JetBrains Mono, monospace',
                lineHeight:1 }}>{i + 1}</span>
              <span style={{ fontSize:13.5, lineHeight:1.6, color:'var(--ink-1)' }}>{s}</span>
            </li>
          ))}
        </ol>
      </div>
    );
  if (blk.kind === 'warning')
    return (
      <div style={{ ...lt_baseBubble,
        background:'#fef2f2', border:'1px solid #fca5a5',
        display:'grid', gridTemplateColumns:'auto 1fr', gap:12, alignItems:'flex-start' }}>
        <span style={{ fontSize:16, lineHeight:'16px' }}>⚠️</span>
        <p style={{ margin:0, fontSize:13.5, lineHeight:1.65,
          color:'#7f1d1d' }}>{blk.body}</p>
      </div>
    );
  return null;
};

const ChatTurnL = ({ q, a, index }) => (
  <div style={{ display:'flex', flexDirection:'column', gap:12,
    marginTop: index === 0 ? 8 : 20,
    animation:`message-in .3s ease ${index * .08}s both` }}>
    <div style={{ display:'flex', justifyContent:'flex-end' }}>
      <div style={{ maxWidth:'80%',
        padding:'10px 14px', borderRadius:16, borderBottomRightRadius:4,
        background:'linear-gradient(180deg, var(--accent-glow), var(--accent))',
        color:'#fff', fontSize:13.5, fontWeight:600 }}>{q}</div>
    </div>
    <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
      <WhaleAvatar size={30}/>
      <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:10 }}>
        {a.map((blk, i) => <AnswerBlockL key={i} blk={blk} />)}
      </div>
    </div>
  </div>
);

const SumStatL = ({ label, value, riskTone }) => {
  const tone = riskTone === '고' ? 'var(--down)'
             : riskTone === '저' ? 'var(--up)' : '#d97706';
  return (
    <div style={{ minWidth:0 }}>
      <div style={{ fontSize:10.5, color:'var(--ink-2)', letterSpacing:'.08em',
        whiteSpace:'nowrap', marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:13, fontWeight:600,
        color: riskTone ? tone : 'var(--ink-0)',
        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{value}</div>
    </div>
  );
};

const LearnModalL = ({ strategy, onClose }) => {
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (!strategy) return null;
  const lvl = LEARN_LEVELS[strategy.level];
  const s = strategy.summary;

  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, zIndex:100,
      background:'rgba(14,25,54,.30)', backdropFilter:'blur(6px)',
      display:'flex', alignItems:'flex-start', justifyContent:'center',
      padding:'48px 24px', overflowY:'auto',
      animation:'backdrop-in .2s ease' }}>
      <div onClick={e => e.stopPropagation()} style={{
        position:'relative', width:'100%', maxWidth:680,
        borderRadius:18, background:'var(--bg-1)',
        border:'1px solid var(--line-strong)',
        boxShadow:'0 60px 120px -40px rgba(14,25,54,.4)',
        animation:'modal-in .25s cubic-bezier(.2,.8,.2,1)',
      }}>
        <button onClick={onClose} aria-label="닫기" style={{
          position:'absolute', top:18, right:18, zIndex:2,
          width:32, height:32, borderRadius:8,
          border:'1px solid var(--line)', background:'var(--bg-2)',
          color:'var(--ink-1)', cursor:'pointer', fontFamily:'inherit',
          display:'flex', alignItems:'center', justifyContent:'center' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3 L11 11 M11 3 L3 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </button>

        <header style={{ padding:'28px 28px 18px', borderBottom:'1px solid var(--line)' }}>
          <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
            <TagL color={lvl.color} bg={lvl.bg} border={lvl.border}>{lvl.label}</TagL>
            <TagL color="var(--accent)" bg="var(--accent-bg)" border="rgba(91,157,255,.24)">
              {CATEGORY_LABEL[strategy.category]}
            </TagL>
          </div>
          <h2 style={{ margin:0, fontSize:22, fontWeight:700, letterSpacing:'-.015em' }}>
            {strategy.name}
          </h2>
          <div style={{ marginTop:14, display:'flex', alignItems:'center', gap:10 }}>
            <WhaleAvatar size={32} animated/>
            <span style={{
              padding:'8px 14px', borderRadius:14,
              background:'var(--bg-2)', border:'1px solid var(--line)',
              fontSize:13, color:'var(--ink-1)',
            }}>
              이 전략에 대해 쉽게 알려드릴게요!
            </span>
          </div>
        </header>

        <div style={{ padding:'20px 28px 8px' }}>
          {strategy.qa.map((turn, i) => (
            <ChatTurnL key={i} index={i} q={turn.q} a={turn.a} />
          ))}
          <div style={{ marginTop:14, marginBottom:8,
            display:'flex', justifyContent:'center' }}>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center' }}>
              {['실제 수익률은?','추천 시작 자본은?','비슷한 전략이 있나요?'].map(s => (
                <button key={s} style={{
                  padding:'7px 12px', borderRadius:999, fontSize:12, fontWeight:500,
                  border:'1px solid var(--line-strong)',
                  background:'var(--bg-1)', color:'var(--ink-1)',
                  cursor:'pointer', fontFamily:'inherit' }}>{s}</button>
              ))}
            </div>
          </div>
        </div>

        {/* summary strip */}
        <div style={{ margin:'4px 28px 16px', padding:'16px 18px', borderRadius:12,
          background:'var(--accent-bg)',
          border:'1px solid rgba(91,157,255,.20)' }}>
          <div style={{ fontSize:11, letterSpacing:'.16em', color:'var(--accent)',
            fontWeight:600, marginBottom:10 }}>한눈에 보기</div>
          <div style={{ display:'grid',
            gridTemplateColumns:'repeat(auto-fit, minmax(110px, 1fr))', gap:14 }}>
            <SumStatL label="적합한 시장" value={s.market}/>
            <SumStatL label="보유 기간"   value={s.holding}/>
            <SumStatL label="거래 빈도"   value={s.frequency}/>
            <SumStatL label="리스크"      value={s.risk} riskTone={s.risk}/>
          </div>
        </div>

        <footer style={{ padding:'18px 28px 24px',
          borderTop:'1px solid var(--line)',
          display:'flex', alignItems:'center', justifyContent:'space-between',
          gap:14, flexWrap:'wrap' }}>
          <span style={{ fontSize:12, color:'var(--ink-2)' }}>
            준비됐다면, 이 전략으로 직접 항해를 시작해보세요.
          </span>
          <div style={{ display:'flex', gap:10 }}>
            <a href="backtest-light.html" style={{
              padding:'10px 16px', borderRadius:8,
              border:'1px solid var(--line-strong)', background:'var(--bg-1)',
              color:'var(--ink-0)', fontSize:13, fontWeight:600, cursor:'pointer',
              fontFamily:'inherit', display:'inline-flex', alignItems:'center', gap:6 }}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path d="M2 11 L 5 7 L 8 10 L 12 3" stroke="currentColor" strokeWidth="1.4"
                  strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
              백테스트로 검증
            </a>
            <button style={{
              padding:'10px 16px', borderRadius:8, border:0,
              background:'linear-gradient(180deg, var(--accent-glow), var(--accent))',
              color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer',
              fontFamily:'inherit', display:'inline-flex', alignItems:'center', gap:8,
              boxShadow:'0 8px 18px -8px rgba(60,120,255,.6)' }}>
              <span style={{ fontSize:10, padding:'2px 5px', borderRadius:4,
                background:'rgba(255,255,255,.20)', color:'#fff',
                fontWeight:700, letterSpacing:'.06em' }}>VIRT</span>
              항해 시작하기 →
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

/* ============================================================ */
/* App                                                            */
/* ============================================================ */
function App() {
  const [category, setCategory] = React.useState('all');
  const [openId, setOpenId] = React.useState(null);
  const filtered = STRATEGY_GUIDES.filter(s =>
    category === 'all' || s.category === category);
  const openStrategy = STRATEGY_GUIDES.find(s => s.id === openId);
  return (
    <>
      <LtDashNav active="전략 학습" />
      <LearnHeaderL />
      <MyVoyageStripL
        active="골든크로스 추종 전략"
        totalKRW={2_997_002}
        holdings={[
          { name:'비트코인(BTC)',  qty:'0.0083325개' },
          { name:'이더리움(ETH)',  qty:'0.29723326개' },
          { name:'솔라나(SOL)',    qty:'7.35100072개' },
        ]}
      />
      <CategoryBarL active={category} onChange={setCategory} />
      <StrategyGridL items={filtered} onOpen={(s) => setOpenId(s.id)} />
      {openStrategy && (
        <LearnModalL strategy={openStrategy} onClose={() => setOpenId(null)} />
      )}
      <LtFooter />
    </>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
