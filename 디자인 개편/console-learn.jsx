/* console-learn.jsx — 전략 학습 (Helm hybrid + chat modal) */

const TagL = ({ children, color, bg, border }) => (
  <span style={{ fontSize:11, padding:'3px 8px', borderRadius:5,
    background:bg, color, fontWeight:700, letterSpacing:'.04em',
    border:`1px solid ${border}`, whiteSpace:'nowrap' }}>{children}</span>
);

/* ---- Voyage strip ---- */
const VoyageStrip = () => (
  <Panel style={{ padding:'22px 26px',
    background:'linear-gradient(135deg, rgba(91,157,255,.12), rgba(91,157,255,.02) 60%, transparent)',
    border:'1px solid rgba(91,157,255,.28)' }}>
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:24, flexWrap:'wrap' }}>
      <div style={{ minWidth:0, flex:1 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8, flexWrap:'wrap' }}>
          <span style={{ fontSize:10.5, letterSpacing:'.18em', color:'var(--sonar)', fontWeight:600 }}>ACTIVE ROUTE</span>
          <span style={{ fontSize:11, padding:'2px 8px', borderRadius:5, background:'rgba(239,77,77,.14)', color:'var(--up)',
            fontWeight:700, border:'1px solid rgba(239,77,77,.28)', display:'inline-flex', alignItems:'center', gap:5 }}>
            <span style={{ width:5, height:5, borderRadius:'50%', background:'var(--up)', animation:'dot 2s ease-in-out infinite' }}/>항해 중
          </span>
        </div>
        <div style={{ fontSize:18, fontWeight:700 }}>골든크로스 추종 전략</div>
        <div style={{ marginTop:8, fontSize:13, color:'var(--ink-1)' }}>
          투자 <span className="mono" style={{ color:'#fff', fontWeight:600 }}>₩2,997,002</span>
          <span style={{ color:'var(--ink-3)', margin:'0 8px' }}>·</span>
          비트코인 · 이더리움 · 솔라나
        </div>
      </div>
      <button style={{ padding:'10px 18px', borderRadius:9, border:'1px solid rgba(77,138,255,.32)',
        background:'rgba(77,138,255,.08)', color:'var(--down)', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
        항해 취소</button>
    </div>
  </Panel>
);

/* ---- Category filter ---- */
const CategoryBar = ({ active, onChange }) => (
  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
    {LEARN_CATEGORIES.map(c => {
      const on = c.key===active;
      return (
        <button key={c.key} onClick={()=>onChange(c.key)} style={{
          padding:'8px 16px', borderRadius:999, fontSize:13, fontWeight:600,
          border: on ? '1px solid rgba(91,157,255,.35)' : '1px solid var(--hair)',
          background: on ? 'var(--sonar-dim)' : 'var(--abyss-1)',
          color: on ? 'var(--sonar)' : 'var(--ink-1)', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
          {c.label}</button>
      );
    })}
  </div>
);

/* ---- Strategy card ---- */
const Card = ({ s, onOpen }) => {
  const lvl = LEARN_LEVELS[s.level];
  const sailing = s.status === 'sailing';
  return (
    <Panel style={{ display:'flex', flexDirection:'column', transition:'border-color .15s' }}>
      <div style={{ padding:'18px 22px 0', display:'flex', gap:6, flexWrap:'wrap' }}>
        <TagL color={lvl.color} bg={lvl.bg} border={lvl.border}>{lvl.label}</TagL>
        <TagL color="var(--sonar)" bg="var(--sonar-dim)" border="rgba(91,157,255,.24)">{CATEGORY_LABEL[s.category]}</TagL>
        <TagL color="var(--ink-1)" bg="rgba(255,255,255,.04)" border="var(--hair)">{ASSET_LABEL[s.assetKind]}</TagL>
      </div>
      <h3 style={{ margin:'14px 22px', fontSize:17.5, fontWeight:700 }}>{s.name}</h3>
      <div style={{ margin:'0 22px 16px', display:'grid', gridTemplateColumns:'auto 1fr', gap:10, alignItems:'flex-start' }}>
        <WhaleAvatar size={32}/>
        <div style={{ padding:'12px 14px', borderRadius:12, borderTopLeftRadius:4,
          background:'var(--abyss-0)', border:'1px solid var(--hair)' }}>
          <p style={{ margin:0, fontSize:13, lineHeight:1.6, color:'var(--ink-1)',
            display:'-webkit-box', WebkitLineClamp:4, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{s.short}</p>
        </div>
      </div>
      <div style={{ padding:'0 22px 16px', display:'flex', flexWrap:'wrap', gap:6 }}>
        {s.assetChips.map(([sym,name],i)=>(
          <span key={i} style={{ fontSize:11.5, padding:'4px 9px', borderRadius:5,
            background:'rgba(255,255,255,.03)', border:'1px solid var(--hair)', color:'var(--ink-1)', whiteSpace:'nowrap' }}>
            {name||sym}{name&&sym?`(${sym})`:''}</span>
        ))}
      </div>
      <div style={{ marginTop:'auto', padding:'14px 18px', borderTop:'1px solid var(--hair)',
        background:'var(--abyss-0)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
        <button onClick={onOpen} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid var(--hair-strong)',
          background:'var(--abyss-1)', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
          display:'inline-flex', alignItems:'center', gap:6 }}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="2" y="2.5" width="10" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.3"/><path d="M4.5 5.5H9.5M4.5 7.5H8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
          알아보기</button>
        {sailing ? (
          <span style={{ padding:'8px 14px', borderRadius:8, background:'rgba(239,77,77,.16)',
            border:'1px solid rgba(239,77,77,.32)', color:'var(--up)', fontSize:13, fontWeight:700,
            display:'inline-flex', alignItems:'center', gap:6 }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--up)', animation:'dot 2s ease-in-out infinite' }}/>항해 중 ⛵</span>
        ) : (
          <span style={{ padding:'8px 14px', borderRadius:8, border:'1px solid rgba(91,157,255,.32)',
            background:'var(--sonar-dim)', color:'var(--sonar)', fontSize:13, fontWeight:600,
            display:'inline-flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:10, padding:'2px 5px', borderRadius:4, background:'var(--sonar)', color:'#fff', fontWeight:700 }}>VIRT</span>전용</span>
        )}
      </div>
    </Panel>
  );
};

/* ---- Chat modal ---- */
const bubble = { padding:'12px 14px', borderRadius:14, borderTopLeftRadius:4,
  background:'var(--abyss-2)', border:'1px solid var(--hair)' };
const Blk = ({ b }) => {
  if (b.kind==='text') return <div style={bubble}><p style={{ margin:0, fontSize:13.5, lineHeight:1.65, color:'var(--ink-1)' }}>{b.body}</p></div>;
  if (b.kind==='term') return (
    <div style={{ ...bubble, padding:'8px 12px', background:'var(--sonar-dim)', border:'1px solid rgba(91,157,255,.22)' }}>
      <span style={{ fontSize:12, color:'var(--ink-2)' }}>관련 용어: </span>
      <span style={{ fontSize:12.5, color:'var(--sonar)', fontWeight:600, textDecoration:'underline',
        textDecorationStyle:'dotted', textUnderlineOffset:3, cursor:'help' }} title={b.def}>{b.name}</span></div>);
  if (b.kind==='easy') return (
    <div style={{ ...bubble, background:'rgba(245,208,97,.07)', border:'1px solid rgba(245,208,97,.24)',
      display:'grid', gridTemplateColumns:'auto 1fr', gap:12, alignItems:'flex-start' }}>
      <span style={{ fontSize:18 }}>💡</span><p style={{ margin:0, fontSize:13.5, lineHeight:1.65, color:'var(--ink-1)' }}>{b.body}</p></div>);
  if (b.kind==='steps') return (
    <div style={bubble}><ol style={{ margin:0, padding:0, listStyle:'none', display:'flex', flexDirection:'column', gap:10 }}>
      {b.steps.map((s,i)=>(<li key={i} style={{ display:'grid', gridTemplateColumns:'22px 1fr', gap:12, alignItems:'flex-start' }}>
        <span style={{ width:22, height:22, borderRadius:'50%', background:'var(--sonar-dim)', border:'1px solid rgba(91,157,255,.32)',
          color:'var(--sonar)', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, fontFamily:'JetBrains Mono, monospace' }}>{i+1}</span>
        <span style={{ fontSize:13.5, lineHeight:1.6, color:'var(--ink-1)' }}>{s}</span></li>))}</ol></div>);
  if (b.kind==='warning') return (
    <div style={{ ...bubble, background:'rgba(77,138,255,.07)', border:'1px solid rgba(77,138,255,.24)',
      display:'grid', gridTemplateColumns:'auto 1fr', gap:12, alignItems:'flex-start' }}>
      <span style={{ fontSize:16 }}>⚠️</span><p style={{ margin:0, fontSize:13.5, lineHeight:1.65, color:'#ffd9d9' }}>{b.body}</p></div>);
  return null;
};
const Turn = ({ q, a, index }) => (
  <div style={{ display:'flex', flexDirection:'column', gap:12, marginTop: index===0?8:20,
    animation:`message-in .3s ease ${index*.08}s both` }}>
    <div style={{ display:'flex', justifyContent:'flex-end' }}>
      <div style={{ maxWidth:'80%', padding:'10px 14px', borderRadius:16, borderBottomRightRadius:4,
        background:'linear-gradient(180deg, var(--sonar), var(--accent))', color:'#fff', fontSize:13.5, fontWeight:600 }}>{q}</div>
    </div>
    <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
      <WhaleAvatar size={30}/>
      <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:10 }}>{a.map((bl,i)=><Blk key={i} b={bl}/>)}</div>
    </div>
  </div>
);
const Modal = ({ strategy, onClose }) => {
  React.useEffect(() => {
    const k = e => { if (e.key==='Escape') onClose(); };
    document.addEventListener('keydown', k);
    const prev = document.body.style.overflow; document.body.style.overflow='hidden';
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow=prev; };
  }, [onClose]);
  if (!strategy) return null;
  const lvl = LEARN_LEVELS[strategy.level]; const s = strategy.summary;
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:100, background:'rgba(6,11,31,.72)',
      backdropFilter:'blur(6px)', display:'flex', alignItems:'flex-start', justifyContent:'center',
      padding:'48px 24px', overflowY:'auto', animation:'backdrop-in .2s ease' }}>
      <div onClick={e=>e.stopPropagation()} style={{ position:'relative', width:'100%', maxWidth:680, borderRadius:18,
        background:'linear-gradient(180deg, #0d1736, #080e25)', border:'1px solid var(--hair-strong)',
        boxShadow:'0 60px 120px -40px rgba(0,0,0,.6)', animation:'modal-in .25s cubic-bezier(.2,.8,.2,1)' }}>
        <button onClick={onClose} style={{ position:'absolute', top:18, right:18, zIndex:2, width:32, height:32, borderRadius:8,
          border:'1px solid var(--hair)', background:'var(--abyss-1)', color:'var(--ink-1)', cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'inherit' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg></button>
        <header style={{ padding:'28px 28px 18px', borderBottom:'1px solid var(--hair)' }}>
          <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
            <TagL color={lvl.color} bg={lvl.bg} border={lvl.border}>{lvl.label}</TagL>
            <TagL color="var(--sonar)" bg="var(--sonar-dim)" border="rgba(91,157,255,.24)">{CATEGORY_LABEL[strategy.category]}</TagL>
          </div>
          <h2 style={{ fontSize:22, fontWeight:700 }}>{strategy.name}</h2>
          <div style={{ marginTop:14, display:'flex', alignItems:'center', gap:10 }}>
            <WhaleAvatar size={32} animated/>
            <span style={{ padding:'8px 14px', borderRadius:14, background:'var(--abyss-2)', border:'1px solid var(--hair)',
              fontSize:13, color:'var(--ink-1)' }}>이 전략에 대해 쉽게 알려드릴게요!</span>
          </div>
        </header>
        <div style={{ padding:'20px 28px 8px' }}>
          {strategy.qa.map((t,i)=><Turn key={i} index={i} q={t.q} a={t.a}/>)}
        </div>
        <div style={{ margin:'4px 28px 16px', padding:'16px 18px', borderRadius:12,
          background:'var(--sonar-dim)', border:'1px solid rgba(91,157,255,.18)' }}>
          <div style={{ fontSize:11, letterSpacing:'.16em', color:'var(--sonar)', fontWeight:600, marginBottom:10 }}>한눈에 보기</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(110px, 1fr))', gap:14 }}>
            {[['적합한 시장',s.market],['보유 기간',s.holding],['거래 빈도',s.frequency],['리스크',s.risk]].map(([l,v])=>(
              <div key={l}><div style={{ fontSize:10.5, color:'var(--ink-2)', letterSpacing:'.08em', marginBottom:4 }}>{l}</div>
                <div style={{ fontSize:13, fontWeight:600,
                  color: l==='리스크' ? (v==='고'?'var(--down)':v==='저'?'var(--up)':'var(--compass)') : 'var(--ink-0)' }}>{v}</div></div>
            ))}
          </div>
        </div>
        <footer style={{ padding:'18px 28px 24px', borderTop:'1px solid var(--hair)',
          display:'flex', alignItems:'center', justifyContent:'space-between', gap:14, flexWrap:'wrap' }}>
          <span style={{ fontSize:12, color:'var(--ink-2)' }}>준비됐다면 직접 항해를 시작해보세요.</span>
          <div style={{ display:'flex', gap:10 }}>
            <a href="console-strategy.html" style={{ padding:'10px 16px', borderRadius:8, border:'1px solid var(--hair-strong)',
              background:'var(--abyss-1)', color:'#fff', fontSize:13, fontWeight:600 }}>백테스트로 검증</a>
            <button style={{ padding:'11px 18px', borderRadius:10,
              border:'1px solid rgba(140,190,255,.5)',
              background:'linear-gradient(180deg, #4d8aff 0%, #2c6fe6 62%, #2257c8 100%)', color:'#fff', fontSize:13, fontWeight:700,
              cursor:'pointer', fontFamily:'inherit', display:'inline-flex', alignItems:'center', gap:8, letterSpacing:'.01em',
              boxShadow:'0 12px 26px -12px rgba(44,111,230,.7), inset 0 1px 0 rgba(255,255,255,.38), inset 0 -2px 6px rgba(8,20,50,.28)' }}>
              <span style={{ fontSize:10, padding:'2px 5px', borderRadius:4, background:'rgba(255,255,255,.2)', fontWeight:700 }}>VIRT</span>항해 시작 →</button>
          </div>
        </footer>
      </div>
    </div>
  );
};

/* ---- App ---- */
function ConsoleLearn() {
  const [cat, setCat] = React.useState('all');
  const [openId, setOpenId] = React.useState(null);
  const items = STRATEGY_GUIDES.filter(s => cat==='all' || s.category===cat);
  const open = STRATEGY_GUIDES.find(s => s.id===openId);
  return (
    <>
      <Sidebar active="learn" />
      <Shell>
        <Topbar coord="N 37.50° · E 127.04°" session="2026.05.31 (일) · 전략 라이브러리 8종" />
        <main style={{ padding:'28px 32px 64px', maxWidth:1320, margin:'0 auto', display:'flex', flexDirection:'column', gap:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <WhaleAvatar size={40} animated/>
            <div>
              <h1 className="disp" style={{ fontSize:26, fontWeight:700, letterSpacing:'-.01em' }}>전략 가이드</h1>
              <p style={{ margin:'6px 0 0', fontSize:13.5, color:'var(--ink-1)' }}>
                카드를 클릭하면 고래 튜터가 챗으로 쉽게 설명해드려요.</p>
            </div>
          </div>
          <VoyageStrip />
          <CategoryBar active={cat} onChange={setCat} />
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:20 }}>
            {items.map(s => <Card key={s.id} s={s} onOpen={()=>setOpenId(s.id)} />)}
          </div>
        </main>
      </Shell>
      {open && <Modal strategy={open} onClose={()=>setOpenId(null)} />}
    </>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<ConsoleLearn />);
