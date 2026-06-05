/* billing-app.jsx — 결제 · 구독 (subscription & billing console page)
   Pricing mirrors the marketing landing page (pricing.jsx). */

const CURRENT_PLAN = 'basic';
const RANK = { free:0, basic:1, pro:2 };

const PLANS = [
  { id:'free',  name:'Free',  tagline:'무료로 시작하기',
    monthly:0, yearly:0,
    features:['시세 조회 · VIRT 가상매매', '백테스트 단일 전략 · 1년', '랭킹 · 피드백 · 알림 3개'] },
  { id:'basic', name:'Basic', tagline:'본격적인 백테스트',
    monthly:9900, yearly:99000,
    features:['Free의 모든 기능', '백테스트 5년 · 멀티 종목 5', '실거래 전략 1 · 종목 3', '알림 20개'] },
  { id:'pro',   name:'Pro',   tagline:'무제한 · 자동화', featured:true,
    monthly:29900, yearly:299000,
    features:['Basic의 모든 기능', '백테스트 10년+ · 무제한', '실거래 무제한 · 리밸런싱 자동화', '퀀트스토어 · 알림 무제한'] },
];

const ADDONS = [
  { id:'premium', name:'프리미엄 전략',      price:'전략당 월 5,000원~', desc:'검증된 고급 전략을 구독으로 추가', icon:'star' },
  { id:'link',    name:'실계좌 연동 (VIRT)', price:'월 4,900원',        desc:'가상에서 실계좌로 전략을 그대로 이관', icon:'link', active:true },
  { id:'cart',    name:'항로 상품 구매',      price:'상품별 개별 가격',   desc:'전문가가 설계한 포트폴리오 항로', icon:'cart' },
];

const HISTORY = [
  ['2026.05.15', 'Basic 구독',          9900, '신한카드 ****1234'],
  ['2026.04.15', 'Basic 구독',          9900, '신한카드 ****1234'],
  ['2026.03.15', 'Basic 구독',          9900, '신한카드 ****1234'],
  ['2026.03.02', '실계좌 연동 (VIRT)',  4900, '신한카드 ****1234'],
  ['2026.02.15', 'Basic 구독',          9900, '신한카드 ****1234'],
];

const won = (n) => '₩' + n.toLocaleString('ko-KR');

/* ---- primary CTA: sky-blue glossy button with circular arrow ---- */
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
    <span style={{ flex:1, textAlign:'center', whiteSpace:'nowrap' }}>{children}</span>
    <span style={{ width:30, height:30, borderRadius:'50%', flexShrink:0,
      background:'rgba(255,255,255,.18)', border:'1px solid rgba(255,255,255,.5)',
      display:'flex', alignItems:'center', justifyContent:'center' }}>
      <CtaArrow/>
    </span>
  </button>
);

const AddonGlyph = ({ kind }) => {
  const c = 'currentColor';
  const p = {
    star: <path d="M11 3L13.2 7.6L18.3 8.3L14.6 11.9L15.5 17L11 14.6L6.5 17L7.4 11.9L3.7 8.3L8.8 7.6Z" stroke={c} strokeWidth="1.5" strokeLinejoin="round" fill="none"/>,
    link: <><path d="M8 11a3 3 0 0 0 4.2 0l2.3-2.3a3 3 0 0 0-4.2-4.2L9 5.8" stroke={c} strokeWidth="1.5" fill="none" strokeLinecap="round"/><path d="M14 11a3 3 0 0 1-4.2 0L7.5 8.7a3 3 0 0 1 4.2-4.2" stroke={c} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity=".5"/></>,
    cart: <><circle cx="8" cy="18" r="1.4" fill={c}/><circle cx="16" cy="18" r="1.4" fill={c}/><path d="M3 4h2l2 10h10l2-7H6" stroke={c} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>,
  };
  return <svg width="22" height="22" viewBox="0 0 22 22" fill="none">{p[kind]}</svg>;
};

const Check = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ flexShrink:0 }}>
    <circle cx="8" cy="8" r="8" fill="var(--sonar-dim)"/>
    <path d="M5 8.2 L7 10.2 L11 5.8" stroke="var(--sonar)" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
);

/* ---- credit card visual ---- */
const PaymentCard = () => (
  <div style={{ position:'relative', overflow:'hidden', borderRadius:14, padding:'20px 22px',
    background:'linear-gradient(120deg, #142647 0%, #1d3c7a 55%, #2c6fe6 100%)',
    boxShadow:'0 16px 34px -18px rgba(20,130,170,.7), inset 0 1px 0 rgba(255,255,255,.22)',
    color:'rgba(255,255,255,.96)', minHeight:148, display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
    <span aria-hidden style={{ position:'absolute', right:-40, top:-50, width:170, height:170,
      borderRadius:'50%', background:'radial-gradient(circle, rgba(255,255,255,.18), transparent 70%)' }}/>
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
      <span style={{ fontSize:12.5, fontWeight:600, letterSpacing:'.04em', opacity:.92 }}>신한카드</span>
      <span style={{ width:30, height:21, borderRadius:4, background:'rgba(255,255,255,.28)',
        border:'1px solid rgba(255,255,255,.4)' }}/>
    </div>
    <div className="mono" style={{ fontSize:17, letterSpacing:'.12em', fontWeight:600 }}>
      •••• &nbsp;•••• &nbsp;•••• &nbsp;1234
    </div>
    <div style={{ display:'flex', justifyContent:'space-between', fontSize:11.5, opacity:.86 }}>
      <span>김병하</span>
      <span className="mono">만료 09/27</span>
    </div>
  </div>
);

/* ---- plan card ---- */
const PlanCard = ({ plan, cycle }) => {
  const isCurrent = plan.id === CURRENT_PLAN;
  const price = cycle === 'yearly' ? plan.yearly : plan.monthly;
  const cmp = RANK[plan.id] - RANK[CURRENT_PLAN];
  const ctaLabel = isCurrent ? '현재 이용 중' : cmp > 0 ? '업그레이드' : '다운그레이드';
  const featured = plan.featured;
  return (
    <article style={{ position:'relative', display:'flex', flexDirection:'column',
      padding:'26px 24px', borderRadius:16,
      background: featured
        ? 'linear-gradient(180deg, rgba(91,157,255,.14), rgba(91,157,255,.03) 60%, transparent)'
        : 'rgba(255,255,255,.025)',
      border: isCurrent ? '1px solid var(--sonar)'
        : featured ? '1px solid rgba(91,157,255,.4)' : '1px solid var(--hair)',
      boxShadow: isCurrent ? '0 0 0 3px var(--sonar-dim)' : 'none' }}>
      <span style={{ position:'absolute', top:-11, left:22, display:'flex', gap:6 }}>
        {isCurrent && <span style={{ padding:'4px 11px', borderRadius:999, fontSize:11, fontWeight:700,
          background:'var(--sonar)', color:'rgba(255,255,255,.96)', boxShadow:'0 6px 14px -6px rgba(60,120,255,.7)' }}>현재 플랜</span>}
        {featured && !isCurrent && <span style={{ padding:'4px 11px', borderRadius:999, fontSize:11, fontWeight:700,
          background:'linear-gradient(180deg, var(--sonar), var(--accent))', color:'rgba(255,255,255,.96)' }}>가장 인기</span>}
      </span>

      <div style={{ fontSize:17, fontWeight:700 }}>{plan.name}</div>
      <div style={{ fontSize:12, color:'var(--ink-2)', marginTop:3 }}>{plan.tagline}</div>

      <div style={{ display:'flex', alignItems:'baseline', gap:6, margin:'18px 0 4px' }}>
        {price === 0
          ? <span className="mono disp" style={{ fontSize:30, fontWeight:700 }}>무료</span>
          : <>
              <span className="mono disp" style={{ fontSize:30, fontWeight:700, letterSpacing:'-.02em' }}>{won(price)}</span>
              <span style={{ fontSize:13, color:'var(--ink-2)' }}>/ {cycle === 'yearly' ? '년' : '월'}</span>
            </>}
      </div>
      <div style={{ height:16, fontSize:11.5, color:'var(--sonar)', fontWeight:600 }}>
        {cycle === 'yearly' && price > 0 ? '2개월 무료 · 월 ' + won(Math.round(price/12)) + ' 상당' : ''}
      </div>

      {featured && !isCurrent
        ? <PrimaryCTA style={{ width:'100%', marginTop:16 }}>{ctaLabel}</PrimaryCTA>
        : <button disabled={isCurrent} style={{ width:'100%', marginTop:16, padding:'12px 16px', borderRadius:11,
            fontFamily:'inherit', fontSize:13.5, fontWeight:600,
            cursor: isCurrent ? 'default' : 'pointer',
            ...(isCurrent
              ? { border:'1px solid var(--hair)', background:'transparent', color:'var(--ink-2)' }
              : { border:'1px solid var(--hair-strong)', background:'transparent', color:'var(--ink-0)' }) }}>
            {ctaLabel}
          </button>}

      <ul style={{ margin:'22px 0 0', padding:0, listStyle:'none', display:'flex', flexDirection:'column', gap:11 }}>
        {plan.features.map(f => (
          <li key={f} style={{ display:'flex', alignItems:'center', gap:10, fontSize:13, color:'var(--ink-1)' }}>
            <Check />{f}
          </li>
        ))}
      </ul>
    </article>
  );
};

/* ---- main ---- */
function BillingApp() {
  const [cycle, setCycle] = React.useState('monthly');
  const [addons, setAddons] = React.useState(
    () => Object.fromEntries(ADDONS.map(a => [a.id, !!a.active])));
  const current = PLANS.find(p => p.id === CURRENT_PLAN);

  return (
    <>
      <Sidebar active="billing" />
      <Shell>
        <Topbar coord="N 37.50° · E 127.04°" session="2026.05.31 (일) · 구독 · Basic 플랜" />
        <main style={{ padding:'28px 32px 64px', maxWidth:1320, margin:'0 auto',
          display:'flex', flexDirection:'column', gap:18 }}>

          <div>
            <h1 className="disp" style={{ fontSize:26, fontWeight:700, letterSpacing:'-.01em' }}>결제 · 구독</h1>
            <p style={{ margin:'8px 0 0', fontSize:13.5, color:'var(--ink-1)' }}>
              김병하 항해사님의 구독 플랜과 결제 수단을 관리하세요.
            </p>
          </div>

          {/* current subscription + payment method */}
          <Panel style={{ padding:0 }}>
            <PanelHead kicker="MY SUBSCRIPTION" title="현재 구독"
              right={<span style={{ display:'inline-flex', alignItems:'center', gap:7,
                padding:'5px 11px', borderRadius:999, fontSize:11.5, fontWeight:700,
                background:'rgba(255,255,255,.16)', border:'1px solid rgba(255,255,255,.3)', color:'rgba(255,255,255,.96)' }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background:'#7af5c8',
                  boxShadow:'0 0 8px #7af5c8' }}/>이용 중</span>} />
            <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:0 }} className="bill-hero">
              <div style={{ padding:'26px 30px', borderRight:'1px solid var(--hair)' }}>
                <div style={{ display:'flex', alignItems:'baseline', gap:10, flexWrap:'wrap' }}>
                  <span className="disp" style={{ fontSize:34, fontWeight:700, letterSpacing:'-.02em' }}>{current.name}</span>
                  <span className="mono" style={{ fontSize:18, fontWeight:600, color:'var(--ink-1)' }}>
                    {won(current.monthly)} <span style={{ fontSize:13, color:'var(--ink-2)' }}>/ 월</span>
                  </span>
                </div>
                <p style={{ margin:'8px 0 0', fontSize:13, color:'var(--ink-2)' }}>{current.tagline}</p>

                <div style={{ marginTop:22, display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  {[['다음 결제일','2026.06.15'], ['결제 주기','매월 15일'],
                    ['이번 달 청구액', won(current.monthly + 4900)], ['가입일','2026.01.15']].map(([l,v]) => (
                    <div key={l} style={{ padding:'13px 15px', borderRadius:12,
                      background:'var(--abyss-0)', border:'1px solid var(--hair)' }}>
                      <div style={{ fontSize:11, color:'var(--ink-2)' }}>{l}</div>
                      <div className="mono" style={{ marginTop:6, fontSize:15, fontWeight:600 }}>{v}</div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop:20, display:'flex', gap:10, flexWrap:'wrap' }}>
                  <PrimaryCTA>플랜 변경</PrimaryCTA>
                  <button style={{ padding:'16px 20px', borderRadius:16, cursor:'pointer',
                    fontFamily:'inherit', fontSize:14, fontWeight:600, color:'var(--ink-1)',
                    background:'transparent', border:'1px solid var(--hair-strong)' }}>구독 해지</button>
                </div>
              </div>

              <div style={{ padding:'24px 26px' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                  <span style={{ fontSize:10.5, letterSpacing:'.2em', color:'var(--ink-2)', fontWeight:600 }}>결제 수단</span>
                  <a style={{ fontSize:12, color:'var(--sonar)', cursor:'pointer', fontWeight:600 }}>변경</a>
                </div>
                <PaymentCard />
                <div style={{ marginTop:14, fontSize:11.5, color:'var(--ink-3)', lineHeight:1.6 }}>
                  결제일에 등록된 카드로 자동 청구됩니다. 다음 청구 예정:
                  <span className="mono" style={{ color:'var(--ink-1)' }}> 2026.06.15</span>
                </div>
              </div>
            </div>
          </Panel>

          {/* plans */}
          <Panel style={{ padding:0 }}>
            <PanelHead kicker="CHOOSE PLAN" title="플랜 선택"
              right={
                <div style={{ display:'flex', gap:3, padding:3, borderRadius:9,
                  background:'rgba(255,255,255,.16)', border:'1px solid rgba(255,255,255,.28)' }}>
                  {[['monthly','월간'], ['yearly','연간 -17%']].map(([k,l]) => (
                    <button key={k} onClick={() => setCycle(k)} style={{ padding:'6px 12px', borderRadius:6,
                      fontSize:12, fontWeight:700, border:0, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap',
                      background: cycle === k ? '#fff' : 'transparent',
                      color: cycle === k ? 'var(--accent)' : 'rgba(255,255,255,.86)' }}>{l}</button>
                  ))}
                </div>
              } />
            <div style={{ padding:'30px 26px 26px', display:'grid',
              gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:18, alignItems:'start' }}>
              {PLANS.map(p => <PlanCard key={p.id} plan={p} cycle={cycle} />)}
            </div>
          </Panel>

          {/* add-ons */}
          <Panel style={{ padding:0 }}>
            <PanelHead kicker="ADD-ON · 개별 과금" title="추가 상품" />
            <div style={{ padding:'20px 22px', display:'grid',
              gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:14 }}>
              {ADDONS.map(a => {
                const on = addons[a.id];
                return (
                  <div key={a.id} style={{ display:'flex', alignItems:'flex-start', gap:14,
                    padding:'18px 18px', borderRadius:14,
                    background:'var(--abyss-0)', border:'1px solid var(--hair)' }}>
                    <span style={{ width:42, height:42, borderRadius:11, flexShrink:0,
                      background:'var(--sonar-dim)', color:'var(--sonar)',
                      border:'1px solid rgba(91,157,255,.22)',
                      display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <AddonGlyph kind={a.icon} />
                    </span>
                    <div style={{ minWidth:0, flex:1 }}>
                      <div style={{ fontSize:14.5, fontWeight:700 }}>{a.name}</div>
                      <div style={{ fontSize:12.5, color:'var(--ink-2)', lineHeight:1.5, margin:'3px 0 8px' }}>{a.desc}</div>
                      <div className="mono" style={{ fontSize:12.5, fontWeight:600, color:'var(--sonar)' }}>{a.price}</div>
                    </div>
                    <button onClick={() => setAddons(s => ({ ...s, [a.id]: !s[a.id] }))}
                      style={{ flexShrink:0, padding:'8px 14px', borderRadius:9, cursor:'pointer',
                        fontFamily:'inherit', fontSize:12.5, fontWeight:600,
                        ...(on
                          ? { border:'1px solid var(--sonar)', background:'var(--sonar-dim)', color:'var(--sonar)' }
                          : { border:'1px solid var(--hair-strong)', background:'transparent', color:'var(--ink-0)' }) }}>
                      {on ? '이용 중' : '추가'}
                    </button>
                  </div>
                );
              })}
            </div>
          </Panel>

          {/* billing history */}
          <Panel style={{ padding:0 }}>
            <PanelHead kicker="BILLING HISTORY" title="결제 내역"
              right={<a style={{ fontSize:12, color:'var(--sonar)', cursor:'pointer', fontWeight:600 }}>영수증 전체 보기 →</a>} />
            <div style={{ padding:'6px 10px 14px', overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, minWidth:560 }}>
                <thead>
                  <tr style={{ color:'var(--ink-2)', fontSize:11.5, textAlign:'left' }}>
                    <th style={thS}>날짜</th><th style={thS}>항목</th>
                    <th style={{ ...thS, textAlign:'right' }}>금액</th>
                    <th style={thS}>결제 수단</th>
                    <th style={{ ...thS, textAlign:'right' }}>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {HISTORY.map((h, i) => (
                    <tr key={i} style={{ borderTop:'1px solid var(--hair)' }}>
                      <td className="mono" style={{ ...tdS, color:'var(--ink-1)' }}>{h[0]}</td>
                      <td style={tdS}>{h[1]}</td>
                      <td className="mono" style={{ ...tdS, textAlign:'right', fontWeight:600 }}>{won(h[2])}</td>
                      <td style={{ ...tdS, color:'var(--ink-2)' }}>{h[3]}</td>
                      <td style={{ ...tdS, textAlign:'right' }}>
                        <span style={{ padding:'3px 10px', borderRadius:999, fontSize:11, fontWeight:600,
                          background:'rgba(122,245,200,.10)', color:'#3fd6a0',
                          border:'1px solid rgba(122,245,200,.24)' }}>결제완료</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <p style={{ marginTop:4, fontSize:12, color:'var(--ink-3)', textAlign:'center' }}>
            모든 가격은 부가세 포함 · 언제든 해지 가능 · 실거래 연동은 VIRT 검증 후 활성화됩니다.
          </p>

          <footer style={{ marginTop:8, paddingTop:20, borderTop:'1px solid var(--hair)',
            display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
            <span className="mono" style={{ fontSize:11.5, color:'var(--ink-3)' }}>© 2026 WHALEARC · 결제는 안전하게 암호화되어 처리됩니다.</span>
            <span style={{ fontSize:11.5, color:'var(--ink-3)' }}>Built quietly, beneath the surface.</span>
          </footer>
        </main>
      </Shell>
    </>
  );
}

const thS = { padding:'12px 14px', fontWeight:600, letterSpacing:'.02em' };
const tdS = { padding:'13px 14px', color:'var(--ink-0)' };

ReactDOM.createRoot(document.getElementById('root')).render(<BillingApp />);
