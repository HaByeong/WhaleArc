/* status-app.jsx — 투자 현황 = 항해사 랭킹 (leaderboard) */

const wON = (n) => '₩' + Math.round(n).toLocaleString('ko-KR');

/* tiers by whale species */
const TIERS = {
  blue:    { label:'대왕고래', c:'#5b9dff' },
  humpback:{ label:'혹등고래', c:'#ef4d4d' },
  orca:    { label:'범고래',   c:'#cfa14b' },
  beluga:  { label:'흰고래',   c:'#9aa7c7' },
};

function spark(seed, up) {
  let h = seed; const N = 20, pts = []; let y = 14;
  for (let i=0;i<=N;i++){ h=(h*1103515245+12345)&0x7fffffff;
    y += ((h%100)-50)/50*1.6 + (up?-0.35:0.3); y=Math.max(3,Math.min(25,y)); pts.push([(i/N)*100,y]); }
  return 'M ' + pts.map(p=>p.map(n=>n.toFixed(1)).join(' ')).join(' L ');
}

const TRADERS = [
  { rank:1, name:'심해의은둔자', tier:'blue', strat:'변동성 돌파', ret:+142.8, win:71, foll:3820, assets:24.2 },
  { rank:2, name:'고래등에탄남자', tier:'blue', strat:'모멘텀 스코어', ret:+98.4, win:64, foll:2940, assets:18.1 },
  { rank:3, name:'블루웨일', tier:'humpback', strat:'골든크로스', ret:+76.2, win:68, foll:2110, assets:15.6 },
  { rank:4, name:'파도를읽는자', tier:'humpback', strat:'RSI 반전', ret:+61.9, win:59, foll:1680, assets:12.4 },
  { rank:5, name:'정박중인배', tier:'humpback', strat:'볼린저 돌파', ret:+54.3, win:62, foll:1320, assets:11.0 },
  { rank:6, name:'심해어부', tier:'orca', strat:'안전 리밸런싱', ret:+41.7, win:73, foll:980, assets:9.8 },
  { rank:7, name:'야간항해사', tier:'orca', strat:'MACD 크로스', ret:+33.5, win:55, foll:740, assets:8.1 },
  { rank:8, name:'산호초지킴이', tier:'orca', strat:'스토캐스틱', ret:+28.9, win:58, foll:610, assets:7.2 },
  { rank:9, name:'먼바다로', tier:'beluga', strat:'골든크로스', ret:+19.4, win:53, foll:430, assets:5.9 },
  { rank:10, name:'조류타기', tier:'beluga', strat:'모멘텀 스코어', ret:+12.1, win:51, foll:280, assets:4.4 },
];
const ME = { rank:142, name:'김병하', tier:'beluga', strat:'골든크로스 추종', ret:-11.81, win:38, foll:12, assets:0.29 };

const Avatar = ({ name, c, size=36 }) => (
  <span style={{ width:size, height:size, borderRadius:11, flexShrink:0,
    background:`linear-gradient(135deg, ${c}, ${c}88)`, color:'var(--abyss-0)',
    fontSize:size*0.4, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>
    {name.slice(0,1)}
  </span>
);

/* podium for top 3 */
const Podium = ({ top }) => {
  const order = [top[1], top[0], top[2]]; // 2nd, 1st, 3rd
  const hts = [104, 132, 88];
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14, alignItems:'end' }}>
      {order.map((t,i) => {
        const tier = TIERS[t.tier];
        const isFirst = t.rank === 1;
        return (
          <Panel key={t.rank} style={{ padding:'18px 16px', textAlign:'center',
            border: isFirst ? '1px solid rgba(91,157,255,.4)' : '1px solid var(--hair)',
            background: isFirst ? 'linear-gradient(180deg, rgba(91,157,255,.12), rgba(14,40,56,.4))' : undefined }}>
            <div style={{ fontSize:isFirst?22:18, marginBottom:8 }}>{isFirst?'🐋':t.rank===2?'🥈':'🥉'}</div>
            <div style={{ display:'flex', justifyContent:'center', marginBottom:10 }}>
              <Avatar name={t.name} c={tier.c} size={isFirst?52:42} />
            </div>
            <div style={{ fontSize:14, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.name}</div>
            <div style={{ fontSize:11, color:tier.c, fontWeight:600, marginTop:3 }}>{tier.label}</div>
            <div className="mono disp" style={{ marginTop:10, fontSize:isFirst?34:23, fontWeight:700, color:'var(--up)' }}>
              +{t.ret.toFixed(1)}%</div>
            <div style={{ height:hts[i]-70, marginTop:12, borderRadius:'8px 8px 0 0',
              background: isFirst ? 'linear-gradient(180deg, rgba(91,157,255,.3), transparent)' : 'linear-gradient(180deg, rgba(255,255,255,.06), transparent)',
              display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:8 }}>
              <span className="mono" style={{ fontSize:18, fontWeight:700, color: isFirst?'var(--sonar)':'var(--ink-2)' }}>{t.rank}</span>
            </div>
          </Panel>
        );
      })}
    </div>
  );
};

const Rrow = ({ t, me }) => {
  const tier = TIERS[t.tier]; const up = t.ret >= 0;
  return (
    <div style={{ display:'grid', gridTemplateColumns:'48px auto 1fr 90px 80px 90px auto',
      gap:14, alignItems:'center', padding:'14px 20px',
      background: me ? 'var(--sonar-dim)' : 'transparent',
      borderTop:'1px solid var(--hair)',
      borderLeft: me ? '2px solid var(--sonar)' : '2px solid transparent' }}>
      <span className="mono disp" style={{ fontSize:16, fontWeight:700, color: me?'var(--sonar)':'var(--ink-2)', textAlign:'center' }}>{t.rank}</span>
      <Avatar name={t.name} c={tier.c} />
      <div style={{ minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:14, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.name}</span>
          {me && <span style={{ fontSize:10, padding:'1px 6px', borderRadius:4, background:'var(--sonar)', color:'#fff', fontWeight:700 }}>나</span>}
        </div>
        <div style={{ fontSize:11.5, color:tier.c, fontWeight:600, marginTop:2 }}>{tier.label} · {t.strat}</div>
      </div>
      <svg viewBox="0 0 100 28" width="90" height="28" preserveAspectRatio="none" style={{ display:'block' }}>
        <path d={spark(t.rank*97+7, up)} fill="none" stroke={up?'var(--up)':'var(--down)'} strokeWidth="1.5" vectorEffect="non-scaling-stroke"/>
      </svg>
      <div style={{ textAlign:'right' }}>
        <div style={{ fontSize:11, color:'var(--ink-3)' }}>승률</div>
        <div className="mono" style={{ fontSize:13, fontWeight:600 }}>{t.win}%</div>
      </div>
      <div style={{ textAlign:'right' }}>
        <div className="mono disp" style={{ fontSize:17, fontWeight:700, color: up?'var(--up)':'var(--down)' }}>
          <Tri up={up}/>{up?'+':''}{t.ret.toFixed(1)}%</div>
        <div className="mono" style={{ fontSize:11, color:'var(--ink-3)', marginTop:2 }}>팔로워 {t.foll.toLocaleString()}</div>
      </div>
      <button style={{ padding:'8px 14px', borderRadius:8, fontFamily:'inherit', fontSize:12.5, fontWeight:600, cursor:'pointer',
        border: me ? '1px solid var(--hair-strong)' : '1px solid rgba(91,157,255,.32)',
        background: me ? 'transparent' : 'var(--sonar-dim)', color: me ? 'var(--ink-1)' : 'var(--sonar)', whiteSpace:'nowrap' }}>
        {me ? '내 프로필' : '항로 보기'}
      </button>
    </div>
  );
};

function StatusBoard() {
  const [period, setPeriod] = React.useState('월간');
  const [cat, setCat] = React.useState('전체');
  return (
    <>
      <Sidebar active="status" />
      <Shell>
        <Topbar coord="N 37.50° · E 127.04°" session="2026.05.31 (일) · 랭킹 갱신 매일 00:00" />
        <main style={{ padding:'28px 32px 64px', maxWidth:1320, margin:'0 auto', display:'flex', flexDirection:'column', gap:18 }}>
          <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
            <div>
              <h1 className="disp" style={{ fontSize:26, fontWeight:700 }}>항해사 랭킹</h1>
              <p style={{ margin:'8px 0 0', fontSize:13.5, color:'var(--ink-1)' }}>
                각 항해사의 대표 포트폴리오 수익률로 매기는 순위. 마음에 드는 항로는 따라가 보세요.</p>
            </div>
            <div style={{ display:'flex', gap:3, padding:3, borderRadius:9, background:'var(--abyss-1)', border:'1px solid var(--hair)' }}>
              {['일간','주간','월간','전체'].map(p=>(
                <button key={p} onClick={()=>setPeriod(p)} style={{ padding:'6px 14px', borderRadius:6, fontSize:12, fontWeight:600,
                  border:0, cursor:'pointer', fontFamily:'inherit',
                  background: period===p?'var(--sonar-dim)':'transparent', color: period===p?'var(--sonar)':'var(--ink-2)' }}>{p}</button>
              ))}
            </div>
          </div>

          {/* podium */}
          <Podium top={TRADERS.slice(0,3)} />

          {/* my rank highlight */}
          <Panel style={{ padding:'18px 22px',
            background:'linear-gradient(135deg, rgba(91,157,255,.12), rgba(14,40,56,.4))',
            border:'1px solid rgba(91,157,255,.32)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, flexWrap:'wrap' }}>
              <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:10.5, color:'var(--ink-2)', letterSpacing:'.1em' }}>내 순위</div>
                  <div className="mono disp" style={{ fontSize:36, fontWeight:700, lineHeight:1 }}>#{ME.rank}</div>
                </div>
                <Avatar name={ME.name} c={TIERS[ME.tier].c} size={44} />
                <div>
                  <div style={{ fontSize:15, fontWeight:700 }}>{ME.name}</div>
                  <div style={{ fontSize:12, color:TIERS[ME.tier].c, fontWeight:600, marginTop:2 }}>{TIERS[ME.tier].label} · {ME.strat}</div>
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:28, flexWrap:'wrap' }}>
                <div style={{ textAlign:'right' }}><div style={{ fontSize:11, color:'var(--ink-3)' }}>대표 수익률</div>
                  <div className="mono disp" style={{ fontSize:26, fontWeight:700, color:'var(--down)' }}><Tri up={false}/>{ME.ret.toFixed(2)}%</div></div>
                <div style={{ textAlign:'right' }}><div style={{ fontSize:11, color:'var(--ink-3)' }}>승률</div>
                  <div className="mono" style={{ fontSize:16, fontWeight:600 }}>{ME.win}%</div></div>
                <div style={{ textAlign:'right' }}><div style={{ fontSize:11, color:'var(--ink-3)' }}>상위</div>
                  <div className="mono" style={{ fontSize:16, fontWeight:600 }}>68%</div></div>
              </div>
            </div>
          </Panel>

          {/* full ranking */}
          <Panel style={{ padding:0 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'18px 22px', borderBottom:'1px solid var(--hair)', gap:12, flexWrap:'wrap' }}>
              <div>
                <div style={{ fontSize:10.5, letterSpacing:'.2em', color:'var(--sonar)', fontWeight:600, marginBottom:5 }}>LEADERBOARD</div>
                <h3 style={{ fontSize:15.5, fontWeight:700 }}>전체 랭킹</h3>
              </div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {['전체','주식','코인','추세추종','역추세'].map(c=>(
                  <button key={c} onClick={()=>setCat(c)} style={{ padding:'7px 14px', borderRadius:999, fontSize:12.5, fontWeight:600,
                    border: cat===c?'1px solid rgba(91,157,255,.35)':'1px solid var(--hair)',
                    background: cat===c?'var(--sonar-dim)':'transparent', color: cat===c?'var(--sonar)':'var(--ink-1)',
                    cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>{c}</button>
                ))}
              </div>
            </div>
            {/* column header */}
            <div style={{ display:'grid', gridTemplateColumns:'48px auto 1fr 90px 80px 90px auto', gap:14,
              padding:'10px 20px', fontSize:10.5, color:'var(--ink-3)', letterSpacing:'.1em', fontWeight:600, textTransform:'uppercase' }}>
              <span style={{ textAlign:'center' }}>순위</span><span></span><span>항해사 · 전략</span>
              <span style={{ textAlign:'center' }}>추이</span><span style={{ textAlign:'right' }}>승률</span>
              <span style={{ textAlign:'right' }}>수익률</span><span></span>
            </div>
            {TRADERS.map(t => <Rrow key={t.rank} t={t} />)}
            <Rrow t={ME} me />
          </Panel>

          <footer style={{ marginTop:8, paddingTop:20, borderTop:'1px solid var(--hair)',
            display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
            <span className="mono" style={{ fontSize:11.5, color:'var(--ink-3)' }}>© 2026 WHALEARC · 랭킹은 대표 포트폴리오 수익률 기준 · 투자 권유가 아닙니다.</span>
            <span style={{ fontSize:11.5, color:'var(--ink-3)' }}>Built quietly, beneath the surface.</span>
          </footer>
        </main>
      </Shell>
    </>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<StatusBoard />);
