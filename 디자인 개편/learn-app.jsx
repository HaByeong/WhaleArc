/* Learn — main page (header + my voyage + filters + card grid) + App */

/* ============================================================ */
/* Page header                                                    */
/* ============================================================ */
const LearnHeader = () => (
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
/* 내 항해 현황 strip                                              */
/* ============================================================ */
const MyVoyageStrip = ({ active, holdings, totalKRW, onCancel }) => (
  <section style={{ padding:'24px 32px 0' }}>
    <article style={{
      position:'relative', overflow:'hidden',
      padding:'22px 26px', borderRadius:16,
      background:'linear-gradient(135deg, rgba(91,157,255,.10), rgba(91,157,255,.02) 60%, transparent)',
      border:'1px solid rgba(91,157,255,.24)',
    }}>
      {/* accent strip */}
      <div aria-hidden style={{ position:'absolute', left:0, top:0, bottom:0, width:3,
        background:'linear-gradient(180deg, var(--accent), var(--accent-glow))' }}/>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
        gap:24, flexWrap:'wrap' }}>
        <div style={{ minWidth:0, flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
            <span style={{
              width:24, height:24, borderRadius:6,
              background:'rgba(239,77,77,.14)',
              border:'1px solid rgba(239,77,77,.32)',
              color:'var(--up)',
              display:'inline-flex', alignItems:'center', justifyContent:'center',
            }}>
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path d="M2 11 L 12 11 M 7 2 L 4 5 M 7 2 L 10 5 M 7 2 L 7 11" stroke="currentColor"
                  strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
            </span>
            <h3 style={{ margin:0, fontSize:14, fontWeight:700, letterSpacing:'.02em' }}>
              내 항해 현황
            </h3>
            <span style={{
              fontSize:11, padding:'2px 8px', borderRadius:5,
              background:'rgba(239,77,77,.14)', color:'var(--up)',
              fontWeight:700, letterSpacing:'.08em',
              border:'1px solid rgba(239,77,77,.28)',
              display:'inline-flex', alignItems:'center', gap:5,
            }}>
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
            <span className="mono" style={{ fontSize:15, fontWeight:700, color:'#fff' }}>
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
          border:'1px solid rgba(77,138,255,.32)',
          background:'rgba(77,138,255,.10)',
          color:'var(--down)', fontSize:13, fontWeight:600,
          cursor:'pointer', fontFamily:'inherit',
          display:'inline-flex', alignItems:'center', gap:6, whiteSpace:'nowrap',
        }}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M3 3 L11 11 M11 3 L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
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
const CategoryBar = ({ active, onChange }) => (
  <section style={{ padding:'28px 32px 0', display:'flex', justifyContent:'center' }}>
    <div style={{ display:'flex', gap:6, flexWrap:'wrap', justifyContent:'center',
      maxWidth:760 }}>
      {LEARN_CATEGORIES.map(c => {
        const isOn = c.key === active;
        return (
          <button key={c.key} onClick={() => onChange(c.key)} style={{
            padding:'8px 16px', borderRadius:999, fontSize:13, fontWeight:600,
            border: isOn ? '1px solid rgba(91,157,255,.32)' : '1px solid var(--line)',
            background: isOn ? 'rgba(91,157,255,.16)' : 'rgba(255,255,255,.025)',
            color: isOn ? '#fff' : 'var(--ink-1)',
            cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap',
          }}>{c.label}</button>
        );
      })}
    </div>
  </section>
);

/* ============================================================ */
/* Strategy card grid                                             */
/* ============================================================ */
const StrategyGrid = ({ items, onOpen }) => (
  <section style={{ padding:'28px 32px 60px' }}>
    <div style={{ display:'grid',
      gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:20 }}>
      {items.map(s => <StrategyGuideCard key={s.id} s={s} onOpen={() => onOpen(s)} />)}
    </div>
  </section>
);

const StrategyGuideCard = ({ s, onOpen }) => {
  const lvl = LEARN_LEVELS[s.level];
  const isSailing = s.status === 'sailing';
  return (
    <article style={{
      ...mkCard, padding:0, display:'flex', flexDirection:'column',
      transition:'transform .15s, border-color .15s',
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(91,157,255,.28)'}
    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--line)'}>
      {/* tag row */}
      <div style={{ padding:'18px 22px 0', display:'flex', gap:6, flexWrap:'wrap' }}>
        <Tag color={lvl.color} bg={lvl.bg} border={lvl.border}>{lvl.label}</Tag>
        <Tag color="#9cc1ff" bg="rgba(91,157,255,.10)" border="rgba(91,157,255,.24)">
          {CATEGORY_LABEL[s.category]}
        </Tag>
        <Tag color="var(--ink-1)" bg="rgba(255,255,255,.04)" border="var(--line)">
          {ASSET_LABEL[s.assetKind]}
        </Tag>
      </div>

      {/* title */}
      <h3 style={{ margin:'14px 22px 14px', fontSize:18, fontWeight:700,
        letterSpacing:'-.01em' }}>{s.name}</h3>

      {/* whale narrator bubble */}
      <div style={{ margin:'0 22px 16px', display:'grid',
        gridTemplateColumns:'auto 1fr', gap:10, alignItems:'flex-start' }}>
        <WhaleAvatar size={32}/>
        <div style={{
          padding:'12px 14px', borderRadius:12,
          borderTopLeftRadius:4,
          background:'rgba(255,255,255,.025)',
          border:'1px solid var(--line)',
        }}>
          <p style={{ margin:0, fontSize:13, lineHeight:1.6, color:'var(--ink-1)',
            display:'-webkit-box', WebkitLineClamp:4, WebkitBoxOrient:'vertical',
            overflow:'hidden' }}>
            {s.short}
          </p>
        </div>
      </div>

      {/* asset chips */}
      <div style={{ padding:'0 22px 16px', display:'flex', flexWrap:'wrap', gap:6 }}>
        {s.assetChips.map(([sym, name], i) => (
          <span key={i} style={{
            fontSize:11.5, padding:'4px 9px', borderRadius:5,
            background:'rgba(255,255,255,.03)',
            border:'1px solid var(--line)',
            color:'var(--ink-1)', whiteSpace:'nowrap',
          }}>
            {name || sym}{name && sym ? `(${sym})` : ''}
          </span>
        ))}
      </div>

      {/* footer */}
      <div style={{ marginTop:'auto', padding:'14px 18px',
        borderTop:'1px solid var(--line)',
        background:'rgba(255,255,255,.015)',
        display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
        <button onClick={onOpen} style={{
          padding:'8px 14px', borderRadius:8,
          border:'1px solid var(--line-strong)',
          background:'rgba(255,255,255,.04)', color:'#fff',
          fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
          display:'inline-flex', alignItems:'center', gap:6,
        }}>
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
            background:'linear-gradient(180deg, rgba(239,77,77,.22), rgba(239,77,77,.10))',
            border:'1px solid rgba(239,77,77,.32)',
            color:'var(--up)', fontSize:13, fontWeight:700,
            display:'inline-flex', alignItems:'center', gap:6, whiteSpace:'nowrap',
          }}>
            <span style={{ width:6, height:6, borderRadius:'50%',
              background:'var(--up)',
              animation:'pulse-dot 2s ease-in-out infinite' }}/>
            항해 중
            <span style={{ fontSize:13 }}>⛵</span>
          </span>
        ) : (
          <button style={{
            padding:'8px 14px', borderRadius:8,
            border:'1px solid rgba(91,157,255,.32)',
            background:'rgba(91,157,255,.10)',
            color:'#cfe1ff', fontSize:13, fontWeight:600,
            cursor:'pointer', fontFamily:'inherit',
            display:'inline-flex', alignItems:'center', gap:6, whiteSpace:'nowrap',
          }}>
            <span style={{ fontSize:10, padding:'2px 5px', borderRadius:4,
              background:'rgba(180,210,255,.18)', color:'#cfe1ff',
              fontWeight:700, letterSpacing:'.04em' }}>VIRT</span>
            전용
          </button>
        )}
      </div>
    </article>
  );
};

/* ============================================================ */
/* APP                                                            */
/* ============================================================ */
function LearnApp() {
  const [category, setCategory] = React.useState('all');
  const [openId, setOpenId] = React.useState(null);

  const filtered = STRATEGY_GUIDES.filter(s =>
    category === 'all' || s.category === category
  );
  const openStrategy = STRATEGY_GUIDES.find(s => s.id === openId);

  return (
    <>
      <DashNav active="전략 학습" />
      <LearnHeader />
      <MyVoyageStrip
        active="골든크로스 추종 전략"
        totalKRW={2_997_002}
        holdings={[
          { name:'비트코인(BTC)',  qty:'0.0083325개' },
          { name:'이더리움(ETH)',  qty:'0.29723326개' },
          { name:'솔라나(SOL)',    qty:'7.35100072개' },
        ]}
      />
      <CategoryBar active={category} onChange={setCategory} />
      <StrategyGrid items={filtered} onOpen={(s) => setOpenId(s.id)} />

      {openStrategy && (
        <LearnModal strategy={openStrategy} onClose={() => setOpenId(null)} />
      )}

      <footer style={{ padding:'40px 32px 28px', borderTop:'1px solid var(--line)',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        flexWrap:'wrap', gap:14 }}>
        <span className="mono" style={{ fontSize:12, color:'var(--ink-3)' }}>
          © 2026 WhaleArc Labs · 모든 항해는 사용자의 책임 아래 진행됩니다.
        </span>
        <div style={{ display:'flex', gap:18, fontSize:12.5, color:'var(--ink-2)' }}>
          <a>도움말</a><a>상태</a><a>API</a><a>의견 보내기</a>
        </div>
      </footer>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<LearnApp />);
