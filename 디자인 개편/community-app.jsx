/* community-app.jsx — 커뮤니티 (항해사 라운지) */

const wON = (n) => '₩' + Math.round(n).toLocaleString('ko-KR');

const TIERS = {
  blue:{ l:'대왕고래', c:'#5b9dff' }, hump:{ l:'혹등고래', c:'#ef4d4d' },
  orca:{ l:'범고래', c:'#cfa14b' }, beluga:{ l:'흰고래', c:'#9aa7c7' },
};

const Avatar = ({ name, c, size=40 }) => (
  <span style={{ width:size, height:size, borderRadius:12, flexShrink:0,
    background:`linear-gradient(135deg, ${c}, ${c}77)`, color:'var(--abyss-0)',
    fontSize:size*0.42, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>
    {name.slice(0,1)}
  </span>
);

function sparkP(seed, up) {
  let h=seed; const N=22, pts=[]; let y=14;
  for(let i=0;i<=N;i++){ h=(h*1103515245+12345)&0x7fffffff;
    y += ((h%100)-50)/50*1.6 + (up?-0.4:0.3); y=Math.max(3,Math.min(25,y)); pts.push([(i/N)*100,y]); }
  return 'M '+pts.map(p=>p.map(n=>n.toFixed(1)).join(' ')).join(' L ');
}

/* ---- channels ---- */
const CHANNELS = [
  ['all','전체 항로','🌊'], ['log','항해 일지','⚓'], ['strategy','전략 공유','🧭'],
  ['question','정박지 질문','❓'], ['brag','만선 자랑','🐟'],
];

/* ---- posts ---- */
const POSTS = [
  { id:1, name:'심해의은둔자', tier:'blue', time:'12분 전', ch:'전략 공유',
    title:'변동성 돌파 K값, 0.5보다 0.6이 백테스트가 더 좋더라',
    body:'최근 3년 KOSPI 대형주로 돌려봤는데 K=0.6에서 MDD가 눈에 띄게 줄었어요. 다만 거래 횟수가 줄어서 횡보장엔 답답할 수 있음. 같이 검증해보실 분?',
    strat:'변동성 돌파', ret:+142.8, up:true, likes:128, comments:34, shared:true },
  { id:2, name:'파도를읽는자', tier:'hump', time:'1시간 전', ch:'항해 일지',
    title:'골든크로스 14일째 항해 중 — 지금 -11% 버티는 중',
    body:'BTC/ETH/SOL 골든크로스 추종으로 들어왔다가 조정 맞았네요. 데드크로스 신호 아직 안 떠서 일단 항로 유지합니다. 인내가 고래의 미덕이라 믿고…',
    strat:'골든크로스 추종', ret:-11.8, up:false, likes:64, comments:21, shared:true },
  { id:3, name:'산호초지킴이', tier:'orca', time:'3시간 전', ch:'정박지 질문',
    title:'RSI(2) 래리 코너스 전략, 코인에도 먹히나요?',
    body:'주식에선 승률이 좋다는데 변동성 큰 코인에선 어떤지 궁금합니다. VIRT로 먼저 돌려보려는데 추천 종목 있을까요?',
    strat:null, ret:null, up:null, likes:18, comments:42, shared:false },
  { id:4, name:'먼바다로', tier:'beluga', time:'어제', ch:'만선 자랑',
    title:'첫 VIRT 항해 +24% 입항 완료 🐳',
    body:'1,000만 가상자금으로 시작해서 한 달 만에 1,240만으로! 모멘텀 스코어 전략 정말 좋네요. 이제 실계좌 연동 고민 중입니다.',
    strat:'모멘텀 스코어', ret:+24.0, up:true, likes:212, comments:58, shared:true },
];

const Post = ({ p }) => {
  const t = TIERS[p.tier];
  return (
    <Panel style={{ padding:'20px 22px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
        <Avatar name={p.name} c={t.c} />
        <div style={{ minWidth:0, flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <span style={{ fontSize:14, fontWeight:700 }}>{p.name}</span>
            <span style={{ fontSize:10.5, padding:'2px 7px', borderRadius:5, fontWeight:700,
              background:`${t.c}1f`, color:t.c, border:`1px solid ${t.c}44` }}>{t.l}</span>
          </div>
          <div style={{ fontSize:11.5, color:'var(--ink-3)', marginTop:3 }}>{p.ch} · {p.time}</div>
        </div>
        <button style={{ width:30, height:30, borderRadius:8, border:'1px solid var(--hair)',
          background:'var(--abyss-1)', color:'var(--ink-2)', cursor:'pointer' }}>···</button>
      </div>

      <h3 style={{ fontSize:16.5, fontWeight:700, marginBottom:8, letterSpacing:'-.01em' }}>{p.title}</h3>
      <p style={{ margin:0, fontSize:13.5, lineHeight:1.7, color:'var(--ink-1)' }}>{p.body}</p>

      {p.shared && (
        <div style={{ marginTop:14, padding:'14px 16px', borderRadius:12,
          background:'var(--abyss-0)', border:'1px solid var(--hair)',
          display:'flex', alignItems:'center', justifyContent:'space-between', gap:14, flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ width:32, height:32, borderRadius:9, background:'var(--sonar-dim)', color:'var(--sonar)',
              border:'1px solid rgba(91,157,255,.24)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <NavIcon kind="route" /></span>
            <div>
              <div style={{ fontSize:13, fontWeight:600 }}>{p.strat}</div>
              <div style={{ fontSize:11, color:'var(--ink-3)' }}>공유된 항로</div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <svg viewBox="0 0 100 28" width="84" height="26" preserveAspectRatio="none">
              <path d={sparkP(p.id*53+9, p.up)} fill="none" stroke={p.up?'var(--up)':'var(--down)'} strokeWidth="1.6" vectorEffect="non-scaling-stroke"/>
            </svg>
            <span className="mono disp" style={{ fontSize:18, fontWeight:700, color: p.up?'var(--up)':'var(--down)' }}>
              <Tri up={p.up}/>{p.up?'+':''}{p.ret.toFixed(1)}%</span>
            <a href="backtest.html" style={{ padding:'7px 12px', borderRadius:8, fontSize:12, fontWeight:600,
              border:'1px solid rgba(91,157,255,.3)', background:'var(--sonar-dim)', color:'var(--sonar)' }}>항로 따라가기</a>
          </div>
        </div>
      )}

      <div style={{ marginTop:14, paddingTop:14, borderTop:'1px solid var(--hair)',
        display:'flex', alignItems:'center', gap:6 }}>
        {[['♡', p.likes, '공감'],['💬', p.comments, '댓글'],['↗', null, '공유']].map(([ic,n,l],i)=>(
          <button key={i} style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'7px 12px',
            borderRadius:8, border:0, background:'transparent', color:'var(--ink-2)', cursor:'pointer',
            fontFamily:'inherit', fontSize:12.5 }}>
            <span style={{ fontSize:13 }}>{ic}</span>{l}{n!=null && <span className="mono" style={{ color:'var(--ink-1)' }}>{n}</span>}
          </button>
        ))}
      </div>
    </Panel>
  );
};

/* ---- composer ---- */
const Composer = () => (
  <Panel style={{ padding:'16px 18px' }}>
    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
      <Avatar name="김" c="#5b9dff" size={38} />
      <input placeholder="이번 항해는 어땠나요? 항로를 공유해보세요…" style={{
        flex:1, padding:'11px 14px', borderRadius:10, border:'1px solid var(--hair)',
        background:'var(--abyss-0)', color:'var(--ink-0)', fontSize:13.5, outline:'none', fontFamily:'inherit' }}/>
      <button style={{ padding:'11px 18px', borderRadius:10, border:'1px solid rgba(140,190,255,.5)',
        background:'linear-gradient(180deg, #4d8aff, #2c6fe6 62%, #2257c8)', color:'#fff',
        fontSize:13.5, fontWeight:600, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap',
        boxShadow:'0 10px 22px -12px rgba(44,111,230,.7), inset 0 1px 0 rgba(255,255,255,.35)' }}>일지 쓰기</button>
    </div>
  </Panel>
);

/* ---- right rail ---- */
const RailTraders = () => (
  <Panel>
    <PanelHead kicker="THIS WEEK" title="이주의 항해사" />
    <div style={{ padding:'6px 0' }}>
      {[['심해의은둔자','blue',142.8],['고래등에탄남자','blue',98.4],['블루웨일','hump',76.2]].map(([n,tr,r],i)=>(
        <div key={n} style={{ display:'grid', gridTemplateColumns:'20px auto 1fr auto', gap:12, alignItems:'center',
          padding:'12px 20px', borderTop: i?'1px solid var(--hair)':'none' }}>
          <span className="mono disp" style={{ fontSize:14, fontWeight:700, color: i===0?'var(--sonar)':'var(--ink-2)' }}>{i+1}</span>
          <Avatar name={n} c={TIERS[tr].c} size={32} />
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{n}</div>
            <div style={{ fontSize:11, color:TIERS[tr].c, fontWeight:600 }}>{TIERS[tr].l}</div>
          </div>
          <span className="mono" style={{ fontSize:13, fontWeight:700, color:'var(--up)' }}>+{r}%</span>
        </div>
      ))}
    </div>
    <div style={{ padding:'12px 20px', borderTop:'1px solid var(--hair)' }}>
      <a href="console-status.html" style={{ fontSize:12.5, color:'var(--sonar)' }}>전체 랭킹 보기 →</a>
    </div>
  </Panel>
);

const RailStrategies = () => (
  <Panel>
    <PanelHead kicker="POPULAR ROUTES" title="인기 항로" />
    <div style={{ padding:'6px 0' }}>
      {[['골든크로스 추종','1,204명 항해 중'],['변동성 돌파','842명 항해 중'],['모멘텀 스코어','610명 항해 중']].map(([n,s],i)=>(
        <a key={n} href="backtest.html" style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 20px',
          borderTop: i?'1px solid var(--hair)':'none' }}>
          <span style={{ width:30, height:30, borderRadius:9, background:'var(--sonar-dim)', color:'var(--sonar)',
            border:'1px solid rgba(91,157,255,.24)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <NavIcon kind="route" /></span>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13.5, fontWeight:600 }}>{n}</div>
            <div style={{ fontSize:11, color:'var(--ink-3)' }}>{s}</div>
          </div>
          <span style={{ color:'var(--ink-3)' }}>→</span>
        </a>
      ))}
    </div>
  </Panel>
);

const RailGuide = () => (
  <Panel style={{ padding:'18px 20px',
    background:'linear-gradient(135deg, rgba(91,157,255,.12), rgba(91,157,255,.02) 60%, transparent)',
    border:'1px solid rgba(91,157,255,.28)' }}>
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
      <span style={{ animation:'float-y 6s ease-in-out infinite' }}>
        <img src="brand-whale.png" alt="" width="26" style={{ height:'auto', display:'block' }} /></span>
      <span style={{ fontSize:13.5, fontWeight:700 }}>라운지 항해 수칙</span>
    </div>
    <p style={{ margin:0, fontSize:12.5, color:'var(--ink-1)', lineHeight:1.6 }}>
      서로의 항로를 존중하고, 수익 인증은 VIRT/실계좌를 명시해주세요. 투자 권유·종목 리딩은 금지입니다.
    </p>
  </Panel>
);

/* ---- App ---- */
function Community() {
  const [ch, setCh] = React.useState('all');
  return (
    <>
      <Sidebar active="community" />
      <Shell>
        <Topbar coord="" session="2026.05.31 (일) · 항해사 라운지 · 온라인 1,284명" />
        <main style={{ padding:'28px 32px 64px', maxWidth:1320, margin:'0 auto' }}>
          {/* header */}
          <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', flexWrap:'wrap', gap:12, marginBottom:18 }}>
            <div>
              <h1 className="disp" style={{ fontSize:26, fontWeight:700 }}>항해사 라운지</h1>
              <p style={{ margin:'8px 0 0', fontSize:13.5, color:'var(--ink-1)' }}>
                다른 항해사들의 항로와 일지를 나누고, 마음에 드는 전략은 따라가 보세요.</p>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:18, fontSize:12.5, color:'var(--ink-2)' }}>
              <span>오늘의 일지 <span className="mono" style={{ color:'#fff', fontWeight:600 }}>328</span></span>
              <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--up)', animation:'dot 2s ease-in-out infinite' }}/>
                온라인 <span className="mono" style={{ color:'#fff', fontWeight:600 }}>1,284</span></span>
            </div>
          </div>

          {/* channels */}
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:18 }}>
            {CHANNELS.map(([k,l,ic])=>{
              const on=ch===k;
              return (
                <button key={k} onClick={()=>setCh(k)} style={{ display:'inline-flex', alignItems:'center', gap:7,
                  padding:'9px 16px', borderRadius:999, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
                  border: on?'1px solid rgba(91,157,255,.35)':'1px solid var(--hair)',
                  background: on?'var(--sonar-dim)':'var(--abyss-1)', color: on?'var(--sonar)':'var(--ink-1)' }}>
                  <span>{ic}</span>{l}</button>
              );
            })}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'minmax(0, 1fr) minmax(280px, 320px)', gap:20, alignItems:'start' }}>
            {/* feed */}
            <div style={{ display:'flex', flexDirection:'column', gap:18, minWidth:0 }}>
              <Composer />
              {POSTS.map(p => <Post key={p.id} p={p} />)}
              <div style={{ textAlign:'center', padding:'8px' }}>
                <button style={{ padding:'11px 22px', borderRadius:10, border:'1px solid var(--hair-strong)',
                  background:'var(--abyss-1)', color:'var(--ink-1)', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                  더 깊은 바다로 ↓</button>
              </div>
            </div>
            {/* rail */}
            <div style={{ display:'flex', flexDirection:'column', gap:18, position:'sticky', top:88 }}>
              <RailTraders />
              <RailStrategies />
              <RailGuide />
            </div>
          </div>

          <footer style={{ marginTop:24, paddingTop:20, borderTop:'1px solid var(--hair)',
            display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
            <span className="mono" style={{ fontSize:11.5, color:'var(--ink-3)' }}>© 2026 WHALEARC · 모든 게시물은 작성자의 의견이며 투자 권유가 아닙니다.</span>
          </footer>
        </main>
      </Shell>
    </>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<Community />);
