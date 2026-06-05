/* Learn — chat-style detail modal */

const LearnModal = ({ strategy, onClose }) => {
  // close on Esc + body scroll lock
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

  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, zIndex:100,
      background:'rgba(6,11,31,.72)', backdropFilter:'blur(6px)',
      display:'flex', alignItems:'flex-start', justifyContent:'center',
      padding:'48px 24px', overflowY:'auto',
      animation:'backdrop-in .2s ease',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        position:'relative', width:'100%', maxWidth:680,
        borderRadius:18,
        background:'linear-gradient(180deg, #0d1736, #080e25)',
        border:'1px solid var(--line-strong)',
        boxShadow:'0 60px 120px -40px rgba(0,0,0,.6)',
        animation:'modal-in .25s cubic-bezier(.2,.8,.2,1)',
      }}>
        {/* close */}
        <button onClick={onClose} aria-label="닫기" style={{
          position:'absolute', top:18, right:18, zIndex:2,
          width:32, height:32, borderRadius:8,
          border:'1px solid var(--line)', background:'rgba(255,255,255,.04)',
          color:'var(--ink-1)', cursor:'pointer', fontFamily:'inherit',
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3 L11 11 M11 3 L3 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </button>

        {/* header */}
        <header style={{ padding:'28px 28px 18px', borderBottom:'1px solid var(--line)' }}>
          <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
            <Tag color={lvl.color} bg={lvl.bg} border={lvl.border}>{lvl.label}</Tag>
            <Tag color="#9cc1ff" bg="rgba(91,157,255,.10)" border="rgba(91,157,255,.24)">
              {CATEGORY_LABEL[strategy.category]}
            </Tag>
          </div>
          <h2 style={{ margin:0, fontSize:22, fontWeight:700, letterSpacing:'-.015em' }}>
            {strategy.name}
          </h2>

          {/* whale intro */}
          <div style={{ marginTop:14, display:'flex', alignItems:'center', gap:10 }}>
            <WhaleAvatar size={32} animated/>
            <span style={{
              padding:'8px 14px', borderRadius:14,
              background:'rgba(255,255,255,.04)',
              border:'1px solid var(--line)',
              fontSize:13, color:'var(--ink-1)',
            }}>
              이 전략에 대해 쉽게 알려드릴게요!
            </span>
          </div>
        </header>

        {/* conversation */}
        <div style={{ padding:'20px 28px 8px' }}>
          {strategy.qa.map((turn, i) => (
            <ChatTurn key={i} index={i} q={turn.q} a={turn.a} />
          ))}

          {/* suggested follow-ups */}
          <div style={{ marginTop:14, marginBottom:8,
            display:'flex', justifyContent:'center' }}>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center' }}>
              {['실제 수익률은?', '추천 시작 자본은?', '비슷한 전략이 있나요?'].map(s => (
                <button key={s} style={{
                  padding:'7px 12px', borderRadius:999, fontSize:12, fontWeight:500,
                  border:'1px solid var(--line-strong)',
                  background:'rgba(255,255,255,.03)', color:'var(--ink-1)',
                  cursor:'pointer', fontFamily:'inherit',
                }}>{s}</button>
              ))}
            </div>
          </div>
        </div>

        {/* summary card */}
        <SummaryStrip s={strategy.summary} />

        {/* footer actions */}
        <footer style={{ padding:'18px 28px 24px',
          borderTop:'1px solid var(--line)',
          display:'flex', alignItems:'center', justifyContent:'space-between',
          gap:14, flexWrap:'wrap' }}>
          <span style={{ fontSize:12, color:'var(--ink-2)' }}>
            준비됐다면, 이 전략으로 직접 항해를 시작해보세요.
          </span>
          <div style={{ display:'flex', gap:10 }}>
            <a href="backtest.html" style={{
              padding:'10px 16px', borderRadius:8,
              border:'1px solid var(--line-strong)', background:'transparent',
              color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer',
              fontFamily:'inherit', display:'inline-flex', alignItems:'center', gap:6,
            }}>
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
              boxShadow:'0 8px 18px -8px rgba(60,120,255,.6)',
            }}>
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
/* Chat turn                                                      */
/* ============================================================ */
const ChatTurn = ({ q, a, index }) => (
  <div style={{ display:'flex', flexDirection:'column', gap:12,
    marginTop: index === 0 ? 8 : 20,
    animation:`message-in .3s ease ${index * .08}s both` }}>
    {/* user question */}
    <div style={{ display:'flex', justifyContent:'flex-end' }}>
      <div style={{
        maxWidth:'80%',
        padding:'10px 14px', borderRadius:16,
        borderBottomRightRadius:4,
        background:'linear-gradient(180deg, var(--accent-glow), var(--accent))',
        color:'#fff', fontSize:13.5, fontWeight:600,
      }}>{q}</div>
    </div>

    {/* whale answer */}
    <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
      <WhaleAvatar size={30}/>
      <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:10 }}>
        {a.map((blk, i) => <AnswerBlock key={i} blk={blk} />)}
      </div>
    </div>
  </div>
);

const AnswerBlock = ({ blk }) => {
  if (blk.kind === 'text')
    return (
      <div style={baseBubble}>
        <p style={{ margin:0, fontSize:13.5, lineHeight:1.65, color:'var(--ink-1)' }}>
          {blk.body}
        </p>
      </div>
    );

  if (blk.kind === 'term')
    return (
      <div style={{ ...baseBubble, padding:'8px 12px',
        background:'rgba(91,157,255,.06)', border:'1px solid rgba(91,157,255,.20)' }}>
        <span style={{ fontSize:12, color:'var(--ink-2)' }}>관련 용어: </span>
        <span style={{ fontSize:12.5, color:'var(--accent-glow)', fontWeight:600,
          textDecoration:'underline', textDecorationStyle:'dotted',
          textUnderlineOffset:3, cursor:'help' }}
          title={blk.def}>{blk.name}</span>
        <span style={{ marginLeft:4, color:'var(--ink-3)', fontSize:11 }}>ⓘ</span>
      </div>
    );

  if (blk.kind === 'easy')
    return (
      <div style={{ ...baseBubble,
        background:'rgba(255,205,120,.06)',
        border:'1px solid rgba(255,205,120,.22)',
        display:'grid', gridTemplateColumns:'auto 1fr', gap:12, alignItems:'flex-start' }}>
        <span style={{ fontSize:18, lineHeight:'18px' }}>💡</span>
        <p style={{ margin:0, fontSize:13.5, lineHeight:1.65,
          color:'var(--ink-1)' }}>{blk.body}</p>
      </div>
    );

  if (blk.kind === 'steps')
    return (
      <div style={baseBubble}>
        <ol style={{ margin:0, padding:0, listStyle:'none',
          display:'flex', flexDirection:'column', gap:10 }}>
          {blk.steps.map((s, i) => (
            <li key={i} style={{ display:'grid', gridTemplateColumns:'22px 1fr',
              alignItems:'flex-start', gap:12 }}>
              <span style={{
                width:22, height:22, borderRadius:'50%',
                background:'rgba(91,157,255,.14)',
                border:'1px solid rgba(91,157,255,.32)',
                color:'var(--accent-glow)',
                display:'inline-flex', alignItems:'center', justifyContent:'center',
                fontSize:11, fontWeight:700, fontFamily:'JetBrains Mono, monospace',
                lineHeight:1,
              }}>{i + 1}</span>
              <span style={{ fontSize:13.5, lineHeight:1.6, color:'var(--ink-1)' }}>{s}</span>
            </li>
          ))}
        </ol>
      </div>
    );

  if (blk.kind === 'warning')
    return (
      <div style={{ ...baseBubble,
        background:'rgba(255,205,120,.05)',
        border:'1px solid rgba(255,205,120,.24)',
        display:'grid', gridTemplateColumns:'auto 1fr', gap:12, alignItems:'flex-start' }}>
        <span style={{ fontSize:16, lineHeight:'16px' }}>⚠️</span>
        <p style={{ margin:0, fontSize:13.5, lineHeight:1.65,
          color:'#ffe5b8' }}>{blk.body}</p>
      </div>
    );

  return null;
};

const baseBubble = {
  padding:'12px 14px', borderRadius:14,
  borderTopLeftRadius:4,
  background:'rgba(255,255,255,.04)',
  border:'1px solid var(--line)',
};

/* ============================================================ */
/* Summary strip                                                  */
/* ============================================================ */
const SummaryStrip = ({ s }) => (
  <div style={{ margin:'4px 28px 16px', padding:'16px 18px', borderRadius:12,
    background:'rgba(91,157,255,.05)',
    border:'1px solid rgba(91,157,255,.18)' }}>
    <div style={{ fontSize:11, letterSpacing:'.16em', color:'#9cc1ff',
      fontWeight:600, marginBottom:10 }}>한눈에 보기</div>
    <div style={{ display:'grid',
      gridTemplateColumns:'repeat(auto-fit, minmax(110px, 1fr))', gap:14 }}>
      <SumStat label="적합한 시장" value={s.market}/>
      <SumStat label="보유 기간"   value={s.holding}/>
      <SumStat label="거래 빈도"   value={s.frequency}/>
      <SumStat label="리스크"      value={s.risk} riskTone={s.risk}/>
    </div>
  </div>
);

const SumStat = ({ label, value, riskTone }) => {
  const tone = riskTone === '고' ? 'var(--down)'
             : riskTone === '저' ? 'var(--up)'
             : '#ffcd78';
  return (
    <div style={{ minWidth:0 }}>
      <div style={{ fontSize:10.5, color:'var(--ink-2)', letterSpacing:'.08em',
        whiteSpace:'nowrap', marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:13, fontWeight:600,
        color: riskTone ? tone : '#fff',
        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{value}</div>
    </div>
  );
};

/* shared tag */
const Tag = ({ children, color, bg, border }) => (
  <span style={{
    fontSize:11, padding:'3px 8px', borderRadius:5,
    background: bg, color, fontWeight:700, letterSpacing:'.04em',
    border:`1px solid ${border}`, whiteSpace:'nowrap',
  }}>{children}</span>
);

Object.assign(window, { LearnModal, Tag });
