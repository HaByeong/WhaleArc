/* Markets (시세) — page header, index strip, asset class tabs */

const ASSET_CLASSES = [
  { key:'stock',  label:'주식',     meta:'KOSPI · KOSDAQ' },
  { key:'us',     label:'미국주식', meta:'NYSE · NASDAQ' },
  { key:'etf',    label:'ETF',      meta:'국내 · 해외' },
  { key:'crypto', label:'가상화폐', meta:'빗썸' },
];

const INDICES = [
  { name:'KOSPI',   v:'2,712.18', d:'+0.42%', up:true  },
  { name:'KOSDAQ',  v:'872.46',   d:'-0.18%', up:false },
  { name:'S&P 500', v:'5,234.12', d:'+0.31%', up:true  },
  { name:'BTC/KRW', v:'₩94.2M',   d:'+1.24%', up:true  },
];

const PageHeader = () => (
  <section style={{ padding:'28px 32px 0' }}>
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
      <span style={{ width:6, height:6, borderRadius:'50%',
        background:'#ef4d4d', boxShadow:'0 0 8px #ef4d4d',
        animation:'pulse-dot 2s ease-in-out infinite' }}/>
      <span style={{ fontSize:11.5, letterSpacing:'.18em', color:'#9cc1ff',
        fontWeight:600 }}>LIVE · 0.2초 갱신 · 마지막 4:32:18</span>
    </div>
    <h1 style={{ margin:0, fontSize:36, lineHeight:1.15, fontWeight:700,
      letterSpacing:'-.02em' }}>시장 현황</h1>
    <p style={{ margin:'8px 0 0', fontSize:14.5, color:'var(--ink-1)' }}>
      주식 · 미국주식 · ETF · 가상화폐 시세를 한 곳에서 살펴보세요.
    </p>
  </section>
);

const IndexStrip = () => (
  <section style={{ padding:'24px 32px 0' }}>
    <div style={{ display:'grid',
      gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:14 }}>
      {INDICES.map(idx => {
        const slug = idx.name.replace(/[^a-zA-Z0-9_-]/g, '');
        return (
        <div key={idx.name} style={{
          padding:'18px 20px', borderRadius:14,
          background:'linear-gradient(180deg, rgba(255,255,255,.035), rgba(255,255,255,.012))',
          border:'1px solid var(--line)', position:'relative', overflow:'hidden',
        }}>
          <div style={{ fontSize:11, color:'var(--ink-2)', letterSpacing:'.14em',
            fontWeight:600 }}>{idx.name}</div>
          <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between',
            marginTop:8 }}>
            <span className="mono" style={{ fontSize:22, fontWeight:600,
              letterSpacing:'-.01em' }}>{idx.v}</span>
            <span className="mono" style={{ fontSize:13, fontWeight:600,
              color: idx.up ? 'var(--up)' : 'var(--down)' }}>{idx.d}</span>
          </div>
          <div style={{ marginTop:8, height:36 }}>
            <svg viewBox="0 0 100 44" width="100%" height="100%" preserveAspectRatio="none">
              <defs>
                <linearGradient id={`idx-${slug}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={idx.up?'#ef4d4d':'#4d8aff'} stopOpacity=".25"/>
                  <stop offset="100%" stopColor={idx.up?'#ef4d4d':'#4d8aff'} stopOpacity="0"/>
                </linearGradient>
              </defs>
              <path d={sparkPathFor(idx.name, idx.up)} fill="none"
                stroke={idx.up?'#ef4d4d':'#4d8aff'} strokeWidth="1.2"
                vectorEffect="non-scaling-stroke"/>
              <path d={sparkPathFor(idx.name, idx.up) + ' L 100 44 L 0 44 Z'}
                fill={`url(#idx-${slug})`}/>
            </svg>
          </div>
        </div>
        );
      })}
    </div>
  </section>
);

const ClassTabs = ({ active, onChange }) => (
  <section style={{ padding:'24px 32px 0', display:'flex', alignItems:'center',
    justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
      {ASSET_CLASSES.map(c => {
        const isActive = c.key === active;
        return (
          <button key={c.key} onClick={() => onChange(c.key)} style={{
            display:'inline-flex', alignItems:'center', gap:8,
            padding:'10px 18px', borderRadius:10,
            border: isActive ? '1px solid rgba(91,157,255,.35)' : '1px solid var(--line)',
            background: isActive ? 'rgba(91,157,255,.12)' : 'rgba(255,255,255,.025)',
            color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer',
            fontFamily:'inherit', whiteSpace:'nowrap',
          }}>
            {c.label}
            <span style={{ fontSize:11, color: isActive ? '#cfe1ff' : 'var(--ink-2)',
              letterSpacing:'.04em', fontWeight:500 }}>{c.meta}</span>
          </button>
        );
      })}
    </div>
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <span style={{ fontSize:12, color:'var(--ink-2)' }}>정렬</span>
      <select style={{
        padding:'8px 28px 8px 12px', borderRadius:8,
        border:'1px solid var(--line)', background:'rgba(255,255,255,.025)',
        color:'#fff', fontSize:13, fontWeight:500,
        fontFamily:'inherit', cursor:'pointer',
        appearance:'none',
        backgroundImage:'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'10\' viewBox=\'0 0 10 10\'><path d=\'M2 4l3 3 3-3\' stroke=\'%23ffffff\' stroke-width=\'1.4\' fill=\'none\'/></svg>")',
        backgroundRepeat:'no-repeat',
        backgroundPosition:'right 10px center',
      }}>
        <option style={{ background:'#0a1230' }}>거래량순</option>
        <option style={{ background:'#0a1230' }}>시가총액순</option>
        <option style={{ background:'#0a1230' }}>등락률순 (상승)</option>
        <option style={{ background:'#0a1230' }}>등락률순 (하락)</option>
      </select>
    </div>
  </section>
);

Object.assign(window, { ASSET_CLASSES, INDICES, PageHeader, IndexStrip, ClassTabs });
