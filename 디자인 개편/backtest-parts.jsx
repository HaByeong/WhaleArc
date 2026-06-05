/* Backtest — strategy library + center detail + empty state */

/* ============================================================ */
/* Strategy dataset                                              */
/* ============================================================ */
const STRATEGIES = [
  {
    id:'buyhold', name:'Buy & Hold (장기 보유)',
    category:'basic', level:'beginner',
    short:'시작 시점에 매수 후 종료 시점까지 그대로 보유하는 가장 단순한 전략',
    long:'시작일에 매수, 종료일에 매도. 시장이 장기적으로 우상향한다는 가정에 베팅하는 가장 단순하고 강력한 벤치마크 전략입니다.',
    easy:'쉽게 말하면: 사두고 가만히 기다리는 전략이에요. 시장이 길게 보면 오른다는 믿음이 핵심.',
    why:'대부분 전략의 비교 기준이 되는 벤치마크입니다. "내 전략이 정말 이것보다 나은가?"를 항상 먼저 물어보세요.',
    buyCond: '시작일 첫 거래일 시가',
    sellCond:'종료일 마지막 거래일 종가',
    nCond: 2, glyph:'flat',
  },
  {
    id:'golden', name:'골든크로스 추종 전략',
    category:'trend', level:'beginner',
    short:'20일/60일 이동평균선 골든크로스 발생 시 매수, 데드크로스 시 매도하는 추세추종 전략',
    long:'20일/60일 이동평균선 골든크로스 발생 시 매수, 데드크로스 시 매도하는 추세추종 전략입니다. 중장기 상승 추세에서 안정적인 수익을 추구합니다.',
    easy:'쉽게 말하면: 최근 흐름이 장기 흐름을 앞지르면 "오르는 중"이라 판단하고 사는 전략이에요.',
    why:'가장 기본적인 추세 전략으로, 큰 상승장을 놓치지 않으면서도 하락장에서 빠져나올 수 있어요. 초보자가 처음 배우기에 가장 좋은 전략입니다.',
    buyCond: 'MA(20) 가 MA(60) 위로 돌파',
    sellCond:'MA(20) 가 MA(60) 아래로 돌파',
    nCond: 2, glyph:'cross',
  },
  {
    id:'rsi-rev', name:'RSI 반전 매매',
    category:'reversal', level:'beginner',
    short:'RSI 과매도 구간(30 이하) 진입 후 반등 시 매수, 과매수 구간(70 이상)에서 매도',
    long:'RSI 30 이하에서 진입 신호, 70 이상에서 청산 신호. 횡보장에서 효과적인 평균회귀 전략입니다.',
    easy:'쉽게 말하면: 너무 떨어진 종목은 다시 오르고, 너무 오른 종목은 다시 내린다는 가정이에요.',
    why:'추세 없는 횡보장에서 추세추종 전략이 부진할 때 유용한 보완 도구입니다.',
    buyCond:'RSI(14) < 30 이후 상승 반전',
    sellCond:'RSI(14) > 70',
    nCond: 2, glyph:'wave',
  },
  {
    id:'bollinger', name:'볼린저 밴드 수축 돌파',
    category:'volatility', level:'intermediate',
    short:'볼린저 밴드 수축 구간에서 상단 돌파 시 매수, 중심선 하락 시 매도',
    long:'밴드 폭이 좁아진 후 가격이 상단 밴드를 돌파할 때 진입. 변동성 확장 초입을 노리는 전략입니다.',
    easy:'쉽게 말하면: 조용했던 종목이 갑자기 움직이기 시작할 때 올라타는 전략.',
    why:'박스권 이탈 시점에 진입해 큰 추세 초입을 잡는 데 강합니다. 단, 잦은 가짜 신호 주의.',
    buyCond:'밴드 폭 < 5% 이후 상단 돌파',
    sellCond:'중심선(MA20) 하향 이탈',
    nCond: 2, glyph:'breakout',
  },
  {
    id:'macd', name:'MACD 크로스오버',
    category:'trend', level:'intermediate',
    short:'MACD 시그널 크로스와 히스토그램 전환을 활용한 추세 전환 포착',
    long:'MACD 선이 시그널 선을 상향 돌파할 때 매수, 하향 돌파할 때 매도. 추세 변곡점을 일찍 잡습니다.',
    easy:'쉽게 말하면: 두 선이 교차하는 순간을 추세 전환의 신호로 보는 전략.',
    why:'단순 이동평균보다 더 빠르게 추세 변화를 잡습니다.',
    buyCond:'MACD > Signal (상향 돌파)',
    sellCond:'MACD < Signal (하향 돌파)',
    nCond: 2, glyph:'cross',
  },
  {
    id:'stoch', name:'스토캐스틱 크로스',
    category:'reversal', level:'intermediate',
    short:'스토캐스틱 %K가 %D를 상향 돌파할 때 매수, 하향 돌파할 때 매도',
    long:'단기 모멘텀의 변곡점을 노리는 평균회귀 전략. 횡보장과 약한 추세장에서 유효합니다.',
    easy:'쉽게 말하면: 최근 가격의 위치를 보고 빠르게 들어갔다 나오는 전략.',
    why:'짧은 사이클의 반복적 진입·청산을 통해 횡보장에서 누적 수익을 만듭니다.',
    buyCond:'%K > %D, %K < 30',
    sellCond:'%K < %D, %K > 70',
    nCond: 2, glyph:'wave',
  },
  {
    id:'larry', name:'래리 코너스 RSI(2)',
    category:'reversal', level:'advanced',
    short:'초단기 RSI(2일)를 사용하여 급락 후 반등을 포착하는 단기 매매 전략',
    long:'2일 RSI가 극단적으로 낮을 때(<10) 매수, 5일 이동평균 회복 시 매도. 평균 보유 기간 3~5일.',
    easy:'쉽게 말하면: 며칠 사이 강하게 떨어진 종목의 반등을 빠르게 잡는 전략.',
    why:'백테스트 통계상 매우 높은 승률을 보이지만, 손실 분포가 극단적이므로 자금 관리가 필수.',
    buyCond:'RSI(2) < 10 + 종가 < MA(5)',
    sellCond:'종가 > MA(5)',
    nCond: 3, glyph:'wave',
  },
  {
    id:'vol-break', name:'변동성 돌파 전략',
    category:'volatility', level:'advanced',
    short:'래리 윌리엄스의 변동성 돌파 전략입니다. 전일 변동폭(고가–저가)에 K값을 곱한 임계치를 돌파하면 진입',
    long:'장 시작 후 전일 (고가–저가)×K 만큼 가격이 움직이면 추세 진입으로 판단하고 매수. 일간 트레이딩의 고전.',
    easy:'쉽게 말하면: 오늘 일찍 어제보다 크게 움직이면 추세가 시작됐다고 보고 따라가는 전략.',
    why:'당일 청산되는 일중 전략으로, 오버나잇 리스크를 회피합니다.',
    buyCond:'시가 + (전일 고가–저가) × 0.7',
    sellCond:'당일 종가 또는 손절선',
    nCond: 2, glyph:'breakout',
  },
];

const STRATEGY_FILTERS = [
  { key:'all',         label:'전체' },
  { key:'trend',       label:'추세추종' },
  { key:'reversal',    label:'역추세' },
  { key:'volatility',  label:'변동성' },
];

const LEVEL_META = {
  beginner:     { label:'초급', color:'#ef4d4d', bg:'rgba(239,77,77,.12)' },
  intermediate: { label:'중급', color:'#ffcd78', bg:'rgba(255,205,120,.12)' },
  advanced:     { label:'고급', color:'#4d8aff', bg:'rgba(77,138,255,.12)' },
};

const CATEGORY_META = {
  basic:      { label:'기본' },
  trend:      { label:'기본' },
  reversal:   { label:'기본' },
  volatility: { label:'기본' },
};

/* ============================================================ */
/* Tiny strategy glyph                                            */
/* ============================================================ */
const StrategyGlyph = ({ kind, color = 'currentColor' }) => {
  const c = color;
  if (kind === 'flat')
    return <svg width="40" height="14" viewBox="0 0 40 14" fill="none"><path d="M2 9 L38 5" stroke={c} strokeWidth="1.4" strokeLinecap="round"/></svg>;
  if (kind === 'cross')
    return <svg width="40" height="14" viewBox="0 0 40 14" fill="none"><path d="M2 11 L38 3" stroke={c} strokeWidth="1.4" strokeLinecap="round"/><path d="M2 3 L38 11" stroke={c} strokeWidth="1.4" strokeLinecap="round" opacity=".5"/><circle cx="20" cy="7" r="2" fill={c}/></svg>;
  if (kind === 'wave')
    return <svg width="40" height="14" viewBox="0 0 40 14" fill="none"><path d="M2 7 Q 10 1 18 7 T 34 7 L 38 7" stroke={c} strokeWidth="1.4" strokeLinecap="round" fill="none"/></svg>;
  if (kind === 'breakout')
    return <svg width="40" height="14" viewBox="0 0 40 14" fill="none"><path d="M2 9 L 12 9 L 14 5 L 16 9 L 22 9" stroke={c} strokeWidth="1.4" strokeLinecap="round" fill="none" opacity=".5"/><path d="M22 9 L 28 9 L 30 9 L 34 2 L 38 1" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>;
  return null;
};

/* ============================================================ */
/* Strategy library (LEFT)                                        */
/* ============================================================ */
const StrategyLibrary = ({ activeId, onPick }) => {
  const [filter, setFilter] = React.useState('all');
  const items = STRATEGIES.filter(s => filter === 'all' || s.category === filter);
  return (
    <aside style={{ ...mkCard, padding:0, display:'flex', flexDirection:'column',
      minHeight:560, overflow:'hidden',
      position:'sticky', top:96, alignSelf:'start', maxHeight:'calc(100vh - 116px)' }}>
      {/* header */}
      <div style={{ position:'relative', overflow:'hidden', padding:'18px 22px',
        background:'linear-gradient(105deg, #142647 0%, #1d3c7a 52%, #2c6fe6 100%)',
        boxShadow:'inset 0 1px 0 rgba(255,255,255,.16)',
        borderBottom:'1px solid rgba(255,255,255,.14)' }}>
        <span aria-hidden style={{ position:'absolute', right:-30, top:-40, width:150, height:150,
          borderRadius:'50%', background:'radial-gradient(circle, rgba(255,255,255,.16), transparent 70%)',
          pointerEvents:'none' }}/>
        <h3 style={{ margin:0, fontSize:16, fontWeight:700, letterSpacing:'-.01em', color:'rgba(255,255,255,.96)' }}>
          전략 라이브러리
        </h3>
        <p style={{ margin:'5px 0 0', fontSize:12.5, color:'rgba(255,255,255,.82)' }}>
          전략을 선택하고 백테스트로 검증하세요.
        </p>
      </div>

      {/* filters */}
      <div style={{ padding:'14px 14px 8px', borderBottom:'1px solid var(--line)' }}>
        <div style={{ display:'flex', gap:6, padding:3, borderRadius:8,
          background:'rgba(255,255,255,.04)', border:'1px solid var(--line)', width:'fit-content' }}>
          {STRATEGY_FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)} style={{
              padding:'6px 12px', borderRadius:6, fontSize:12.5, fontWeight:600,
              border:0, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap',
              background: filter === f.key ? 'rgba(91,157,255,.18)' : 'transparent',
              color: filter === f.key ? '#fff' : 'var(--ink-1)',
            }}>{f.label}</button>
          ))}
        </div>
      </div>

      {/* list */}
      <ul style={{ margin:0, padding:'8px 0', listStyle:'none', flex:1, overflowY:'auto' }} className="no-scrollbar">
        {items.map(s => {
          const isActive = s.id === activeId;
          const lvl = LEVEL_META[s.level];
          return (
            <li key={s.id} style={{ padding:'4px 12px' }}>
              <button onClick={() => onPick(s.id)} style={{
                width:'100%', textAlign:'left', cursor:'pointer',
                padding:'14px 14px 12px', borderRadius:10,
                background: isActive ? 'rgba(91,157,255,.10)' : 'transparent',
                border: isActive ? '1px solid rgba(91,157,255,.32)' : '1px solid transparent',
                fontFamily:'inherit', color:'#fff',
                transition:'background .15s, border .15s',
              }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between',
                  gap:8, marginBottom:6 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8,
                    minWidth:0, flex:1 }}>
                    <StrategyGlyph kind={s.glyph}
                      color={isActive ? 'var(--accent-glow)' : 'var(--ink-2)'} />
                    <span style={{ fontSize:13.5, fontWeight:700,
                      letterSpacing:'-.005em',
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {s.name}
                    </span>
                  </div>
                </div>
                <div style={{ display:'flex', gap:6, marginBottom:8 }}>
                  <span style={tagSx('#9cc1ff', 'rgba(91,157,255,.10)')}>기본</span>
                  <span style={tagSx(lvl.color, lvl.bg)}>{lvl.label}</span>
                </div>
                <p style={{ margin:0, fontSize:12.5, color:'var(--ink-1)',
                  lineHeight:1.5, display:'-webkit-box',
                  WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                  {s.short}
                </p>
                <div style={{ marginTop:8, paddingTop:8, borderTop:'1px solid var(--line)',
                  fontSize:11, color:'var(--ink-3)', letterSpacing:'.04em' }}>
                  조건 {s.nCond}개
                </div>
              </button>
            </li>
          );
        })}

        {/* new strategy CTA */}
        <li style={{ padding:'12px' }}>
          <button style={{
            width:'100%', padding:'18px 14px', borderRadius:10,
            background:'transparent',
            border:'1px dashed var(--line-strong)',
            color:'var(--ink-1)', cursor:'pointer', fontFamily:'inherit',
            textAlign:'left',
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
              <span style={{
                width:20, height:20, borderRadius:5,
                background:'rgba(91,157,255,.14)',
                border:'1px solid rgba(91,157,255,.3)',
                color:'var(--accent-glow)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:14, fontWeight:700, lineHeight:1,
              }}>+</span>
              <span style={{ fontSize:13.5, fontWeight:700, color:'#fff' }}>
                새 항로 만들기
              </span>
            </div>
            <p style={{ margin:'2px 0 0 28px', fontSize:12, color:'var(--ink-2)',
              lineHeight:1.5 }}>
              나만의 매매 조건으로 직접 항로를 설계하고 백테스트로 검증해보세요.
            </p>
            <span style={{ marginLeft:28, fontSize:10.5, color:'var(--ink-3)',
              letterSpacing:'.06em', marginTop:8, display:'block' }}>
              지표·조건 직접 작성
            </span>
          </button>
        </li>
      </ul>
    </aside>
  );
};

const tagSx = (color, bg) => ({
  fontSize:10.5, padding:'2px 7px', borderRadius:4,
  background: bg, color: color, fontWeight:700, letterSpacing:'.06em',
  whiteSpace:'nowrap',
});

Object.assign(window, {
  STRATEGIES, STRATEGY_FILTERS, LEVEL_META,
  StrategyGlyph, StrategyLibrary, tagSx,
});
