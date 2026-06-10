/* Pricing section — 요금제 (Free / Basic / Pro + Add-ons) */

const PRICING_TIERS = [
  {
    id:'free', name:'Free', tagline:'무료로 시작하기',
    price:0, priceLabel:'무료', cadence:'',
    cta:'무료로 시작', ctaKind:'ghost',
    featured:false,
    groups:[
      { label:'기본', items:[
        ['시세 조회', true],
        ['가상매매 (VIRT)', true],
        ['랭킹', true],
        ['피드백', true],
        ['알림 3개', true],
      ]},
      { label:'백테스팅', items:[
        ['단일 전략 · 단일 종목', true],
        ['최근 1년 데이터', true],
        ['멀티 종목 / 전략', false],
      ]},
      { label:'실거래', items:[
        ['실거래', false],
        ['퀀트스토어', false],
      ]},
    ],
  },
  {
    id:'basic', name:'Basic', tagline:'본격적인 백테스트',
    price:9900, priceLabel:'9,900', cadence:'월',
    cta:'Basic 시작하기', ctaKind:'ghost',
    featured:false,
    groups:[
      { label:'기본', items:[
        ['Free의 모든 기능', true],
        ['알림 20개', true],
      ]},
      { label:'백테스팅', items:[
        ['최근 5년 데이터', true],
        ['멀티 종목 (5개)', true],
        ['멀티 전략 (3개)', true],
        ['기본 리포트', true],
      ]},
      { label:'실거래 (기본)', items:[
        ['전략 1개 · 종목 3개', true],
        ['리밸런싱 자동화', false],
      ]},
    ],
  },
  {
    id:'pro', name:'Pro', tagline:'무제한 · 자동화',
    price:29900, priceLabel:'29,900', cadence:'월',
    cta:'Pro 시작하기', ctaKind:'primary',
    featured:true,
    groups:[
      { label:'기본', items:[
        ['Basic의 모든 기능', true],
        ['알림 무제한', true],
      ]},
      { label:'백테스팅', items:[
        ['최근 10년+ 데이터', true],
        ['멀티 종목 무제한', true],
        ['멀티 전략 무제한', true],
        ['상세 리포트 · 파라미터 최적화', true],
      ]},
      { label:'실거래 (고급)', items:[
        ['전략 · 종목 무제한', true],
        ['리밸런싱 자동화 · 우선 체결', true],
        ['퀀트스토어 열람', true],
      ]},
    ],
  },
];

const ADDONS = [
  { name:'프리미엄 전략', price:'전략당 월 5,000원~',
    desc:'검증된 고급 전략을 구독으로 추가', icon:'star' },
  { name:'실계좌 연동 (VIRT)', price:'월 4,900원',
    desc:'가상에서 실계좌로 전략을 그대로 이관', icon:'link' },
  { name:'항로 상품 구매', price:'상품별 개별 가격',
    desc:'전문가가 설계한 포트폴리오 항로', icon:'cart' },
];

const Check = ({ on }) => on ? (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink:0 }}>
    <circle cx="8" cy="8" r="8" fill="rgba(239,77,77,.18)"/>
    <path d="M5 8.2 L7 10.2 L11 5.8" stroke="#ef4d4d" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
) : (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink:0 }}>
    <circle cx="8" cy="8" r="8" fill="rgba(255,255,255,.05)"/>
    <path d="M5.5 8 H10.5" stroke="rgba(255,255,255,.3)" strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
);

const AddonIcon = ({ kind }) => {
  const c = 'currentColor';
  const p = {
    star: <path d="M11 3L13.2 7.6L18.3 8.3L14.6 11.9L15.5 17L11 14.6L6.5 17L7.4 11.9L3.7 8.3L8.8 7.6Z" stroke={c} strokeWidth="1.5" strokeLinejoin="round" fill="none"/>,
    link: <><path d="M8 11a3 3 0 0 0 4.2 0l2.3-2.3a3 3 0 0 0-4.2-4.2L9 5.8" stroke={c} strokeWidth="1.5" fill="none" strokeLinecap="round"/><path d="M14 11a3 3 0 0 1-4.2 0L7.5 8.7a3 3 0 0 1 4.2-4.2" stroke={c} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity=".5"/></>,
    cart: <><circle cx="8" cy="18" r="1.4" fill={c}/><circle cx="16" cy="18" r="1.4" fill={c}/><path d="M3 4h2l2 10h10l2-7H6" stroke={c} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>,
  };
  return <svg width="22" height="22" viewBox="0 0 22 22" fill="none">{p[kind]}</svg>;
};

const PricingCard = ({ tier }) => (
  <article style={{
    position:'relative',
    display:'flex', flexDirection:'column',
    padding:'32px 28px',
    borderRadius:20,
    background: tier.featured
      ? 'linear-gradient(180deg, rgba(91,157,255,.14), rgba(91,157,255,.03) 60%, rgba(255,255,255,.012))'
      : 'linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.012))',
    border: tier.featured ? '1px solid rgba(91,157,255,.40)' : '1px solid var(--line)',
    boxShadow: tier.featured ? '0 30px 70px -30px rgba(60,120,255,.45)' : 'none',
  }}>
    {tier.featured && (
      <span style={{ position:'absolute', top:-12, left:'50%', transform:'translateX(-50%)',
        padding:'5px 14px', borderRadius:999, fontSize:11.5, fontWeight:700,
        letterSpacing:'.08em', whiteSpace:'nowrap',
        background:'linear-gradient(180deg, var(--accent-glow), var(--accent))',
        color:'#fff', boxShadow:'0 8px 18px -8px rgba(60,120,255,.6)' }}>
        가장 인기
      </span>
    )}

    <div style={{ marginBottom:6 }}>
      <span style={{ fontSize:18, fontWeight:700, letterSpacing:'-.01em' }}>{tier.name}</span>
    </div>
    <div style={{ fontSize:12.5, color:'var(--ink-2)', marginBottom:20 }}>{tier.tagline}</div>

    <div style={{ display:'flex', alignItems:'baseline', gap:6, marginBottom:24 }}>
      {tier.price === 0 ? (
        <span className="mono" style={{ fontSize:36, fontWeight:700, letterSpacing:'-.02em' }}>무료</span>
      ) : (
        <>
          <span className="mono" style={{ fontSize:36, fontWeight:700, letterSpacing:'-.02em' }}>
            ₩{tier.priceLabel}
          </span>
          <span style={{ fontSize:14, color:'var(--ink-2)' }}>/ {tier.cadence}</span>
        </>
      )}
    </div>

    <button style={{
      width:'100%', padding:'13px 18px', borderRadius:11, cursor:'pointer',
      fontFamily:'inherit', fontSize:14.5, fontWeight:600, marginBottom:24,
      ...(tier.ctaKind === 'primary' ? {
        border:0,
        background:'linear-gradient(180deg, var(--accent-glow), var(--accent))',
        color:'#fff',
        boxShadow:'0 10px 24px -10px rgba(60,120,255,.6)',
      } : {
        border:'1px solid var(--line-strong)', background:'transparent', color:'#fff',
      }),
    }}>{tier.cta}</button>

    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      {tier.groups.map(g => (
        <div key={g.label}>
          <div style={{ fontSize:11, letterSpacing:'.14em', color:'var(--ink-3)',
            fontWeight:600, textTransform:'uppercase', marginBottom:10 }}>{g.label}</div>
          <ul style={{ margin:0, padding:0, listStyle:'none',
            display:'flex', flexDirection:'column', gap:9 }}>
            {g.items.map(([label, on]) => (
              <li key={label} style={{ display:'flex', alignItems:'center', gap:10,
                fontSize:13.5,
                color: on ? 'var(--ink-1)' : 'var(--ink-3)' }}>
                <Check on={on} />
                <span style={{ textDecoration: on ? 'none' : 'none' }}>{label}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  </article>
);

const Pricing = () => (
  <section id="pricing" style={{ padding:'120px 56px', background:'var(--bg-0)' }}>
    <div style={{ maxWidth:1240, margin:'0 auto' }}>
      <SectionHeader
        kicker="요금제"
        title={<>항해 방식에 맞는 요금제.</>}
        lede="모든 플랜에서 시세 조회와 VIRT 가상매매는 무료입니다. 백테스트 범위와 실거래 자동화 수준에 따라 선택하세요."
        align="center"
      />

      <div style={{ display:'grid',
        gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:20,
        alignItems:'start', maxWidth:1080, margin:'8px auto 0' }}>
        {PRICING_TIERS.map(t => <PricingCard key={t.id} tier={t} />)}
      </div>

      {/* add-ons */}
      <div style={{ marginTop:64 }}>
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <span style={{ fontSize:11.5, letterSpacing:'.24em', color:'#9cc1ff',
            fontWeight:600, textTransform:'uppercase' }}>ADD-ON · 개별 과금</span>
          <p style={{ margin:'10px 0 0', fontSize:14.5, color:'var(--ink-1)' }}>
            필요한 만큼만 추가하세요. 플랜과 별개로 개별 구매할 수 있어요.
          </p>
        </div>
        <div style={{ display:'grid',
          gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))', gap:16,
          maxWidth:1080, margin:'0 auto' }}>
          {ADDONS.map(a => (
            <article key={a.name} style={{
              display:'flex', alignItems:'flex-start', gap:16,
              padding:'22px 24px', borderRadius:16,
              background:'rgba(255,255,255,.025)', border:'1px solid var(--line)' }}>
              <span style={{ width:44, height:44, borderRadius:12, flexShrink:0,
                background:'rgba(91,157,255,.12)', color:'var(--accent-glow)',
                border:'1px solid rgba(91,157,255,.22)',
                display:'flex', alignItems:'center', justifyContent:'center' }}>
                <AddonIcon kind={a.icon} />
              </span>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:15, fontWeight:700, marginBottom:4 }}>{a.name}</div>
                <div style={{ fontSize:13, color:'var(--ink-1)', lineHeight:1.5,
                  marginBottom:8 }}>{a.desc}</div>
                <div className="mono" style={{ fontSize:13, fontWeight:600,
                  color:'var(--accent-glow)' }}>{a.price}</div>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* footnote */}
      <p style={{ marginTop:40, textAlign:'center', fontSize:12.5, color:'var(--ink-3)' }}>
        모든 가격은 부가세 포함 · 언제든 해지 가능 · 실거래 연동은 VIRT 검증 후 활성화됩니다.
      </p>
    </div>
  </section>
);

Object.assign(window, { Pricing });
