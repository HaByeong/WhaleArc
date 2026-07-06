import type { ReactNode } from 'react';
import { useEffect } from 'react';

/* ────────────────────────────────────────────────────────────
   StrategyLearnDrawer — '이 전략 더 알아보기' 플로팅 교육 패널.
   구 /store(ConsoleLearnPage)의 고래튜터 Q&A(EDU)와 핵심 포인트(STRATEGY_TIPS)를
   전략·백테스트 통합 페이지로 이관. 전략 선택 후 '자세히 배우기'로 띄운다.
   ──────────────────────────────────────────────────────────── */

const SONAR = 'var(--ci-sonar)';
const INK1 = 'var(--ci-ink1)', INK2 = 'var(--ci-ink2)';
const HAIR = 'var(--ci-line)', HAIR_S = 'var(--ci-line-strong)';
const CARD = 'var(--ci-card)', SONAR_DIM = 'var(--ci-sonar-dim)';

const WhaleAvatar = ({ size = 36, animated }: { size?: number; animated?: boolean }) => (
  <span className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full" style={{ width: size, height: size, background: 'radial-gradient(120% 120% at 50% 30%, rgba(91,157,255,.18), rgba(91,157,255,.04))', border: '1px solid rgba(91,157,255,.30)', animation: animated ? 'whale-float 5s ease-in-out infinite' : undefined }}>
    <img src="/whales/beluga.png" alt="고래 튜터" draggable={false} style={{ width: size * 0.82, height: size * 0.82, objectFit: 'contain' }} />
  </span>
);

/* ── 고래튜터 교육 콘텐츠 (전략 계열별) ── */
type Blk = { kind: 'text' | 'easy' | 'warning'; body: string } | { kind: 'term'; name: string; def: string } | { kind: 'steps'; steps: string[] };
const EDU: Record<string, { tagline: string; qa: { q: string; a: Blk[] }[] }> = {
  TREND_FOLLOWING: { tagline: '추세를 읽고 올라타는 전략이에요!', qa: [
    { q: '이 전략이 뭐예요?', a: [{ kind: 'text', body: '두 이동평균선이 교차하는 순간을 추세 전환 신호로 보는 고전적 추세추종 전략입니다. 단기선이 장기선을 상향 돌파(골든크로스)하면 매수, 하향 돌파(데드크로스)하면 매도합니다.' }, { kind: 'term', name: '이동평균선', def: '최근 N일간 종가의 평균을 매일 새로 계산해 이은 선.' }] },
    { q: '좀 더 쉽게 설명해주세요!', a: [{ kind: 'easy', body: '최근 흐름이 장기 흐름을 앞지르면 "오르는 중"이라 보고 올라타요. 큰 배(60일선)를 작은 보트(20일선)가 추월하면 물살이 바뀌는 신호죠.' }] },
    { q: '구체적으로 어떻게 작동해요?', a: [{ kind: 'steps', steps: ['단기·장기 이동평균을 매일 계산', '단기선이 장기선을 위로 뚫으면 → 매수', '아래로 다시 뚫으면 → 매도', '반대 신호가 나올 때까지 보유'] }] },
    { q: '위험한 건 없어요? 🤔', a: [{ kind: 'warning', body: '횡보장에선 골든·데드 크로스가 자주 반복돼 "휩쏘"가 발생합니다. 추세가 명확한 시장에서 쓰는 게 좋아요.' }] },
    { q: '누구에게 적합한가요? 🧭', a: [{ kind: 'text', body: '추세가 한 방향으로 길게 이어지는 시장을 좋아하고, 잦은 매매보다 큰 흐름을 기다릴 수 있는 분에게 맞아요. 차트의 큰 그림부터 익히고 싶은 초보 항해사에게 입문용으로 좋습니다.' }] },
  ] },
  MOMENTUM: { tagline: '잘 나가는 종목에 올라타요!', qa: [
    { q: '이 전략이 뭐예요?', a: [{ kind: 'text', body: '후보 종목들의 최근 1~3개월 수익률(모멘텀 점수)을 매겨, 점수 높은 상위 N개에 분산 투자합니다. "잘 나가는 종목은 계속 잘 나간다"는 모멘텀 효과를 활용해요.' }, { kind: 'term', name: '모멘텀', def: '가격이 움직이는 "힘". 최근 많이 오른 자산이 계속 오르는 경향.' }] },
    { q: '좀 더 쉽게 설명해주세요!', a: [{ kind: 'easy', body: '경주에서 앞서가는 말에 베팅하는 것과 비슷해요. 다만 1등부터 N등까지 골고루 배팅합니다.' }] },
    { q: '구체적으로 어떻게 작동해요?', a: [{ kind: 'steps', steps: ['매월 말 후보들의 최근 90일 수익률 계산', '상위 N개 종목 선정', '균등 비중으로 한 달 보유', '월말마다 다시 점수 매겨 교체'] }] },
    { q: '위험한 건 없어요? 🤔', a: [{ kind: 'warning', body: '추세가 갑자기 꺾이는 "모멘텀 크래시"에선 큰 손실이 날 수 있어요. 변동성 필터와 함께 쓰세요.' }] },
    { q: '누구에게 적합한가요? 🧭', a: [{ kind: 'text', body: '여러 종목을 골고루 담아 분산하고 싶고, 월 1회 정도 규칙적으로 점검할 수 있는 분에게 맞아요. 개별 종목을 깊게 분석하기보다 "잘 나가는 것에 분산"이 편한 분께 추천합니다.' }] },
  ] },
  MEAN_REVERSION: { tagline: '평균으로 돌아오는 성질을 노려요!', qa: [
    { q: '이 전략이 뭐예요?', a: [{ kind: 'text', body: 'RSI가 30 이하(과매도)일 때 매수, 70 이상(과매수)일 때 매도하는 평균회귀 전략입니다. "너무 떨어졌으니 오를 것"이라는 역발상이에요.' }, { kind: 'term', name: 'RSI', def: '최근 14일 상승폭/하락폭 비율을 0~100으로 정규화. 70↑ 과매수, 30↓ 과매도.' }] },
    { q: '좀 더 쉽게 설명해주세요!', a: [{ kind: 'easy', body: '시장의 "기분"을 0~100점으로 매긴다고 생각해보세요. 30점 아래면 곧 반등, 70점 위면 곧 식을 가능성이 높다는 거죠.' }] },
    { q: '구체적으로 어떻게 작동해요?', a: [{ kind: 'steps', steps: ['RSI(14)를 매일 계산', 'RSI가 30 아래로 갔다 다시 위로 → 매수', 'RSI가 70 위로 갔다 다시 아래로 → 매도', '추세가 강하면 빗나가니 손절선 필수'] }] },
    { q: '위험한 건 없어요? 🤔', a: [{ kind: 'warning', body: '강한 추세장에선 RSI가 오래 과매수/과매도에 머물러요(신호 함정). 손절을 꼭 함께 쓰세요.' }] },
    { q: '누구에게 적합한가요? 🧭', a: [{ kind: 'text', body: '급락 후 반등을 노리는 역발상이 잘 맞고, 손절 규칙을 지킬 수 있는 분에게 맞아요. 변동성 있는 시장에서 저점 매수 기회를 차분히 기다릴 수 있는 분께 좋습니다.' }] },
  ] },
  VOLATILITY: { tagline: '변동성이 터지는 초입을 노려요!', qa: [
    { q: '이 전략이 뭐예요?', a: [{ kind: 'text', body: '전날 변동폭을 기준으로 오늘 가격이 일정 비율 이상 올라가면 즉시 매수하는 변동성 돌파 전략입니다. 변동성이 압축됐다 폭발하는 순간을 노려요.' }, { kind: 'term', name: '변동성 돌파', def: '전일 변동폭(고가–저가)에 k값을 곱한 임계치를 시가에서 더해 돌파하면 진입.' }] },
    { q: '좀 더 쉽게 설명해주세요!', a: [{ kind: 'easy', body: '어제 파도가 1m였다면 오늘 0.5m 이상 올라오는 순간 서핑보드에 올라타는 거예요. 압축된 스프링이 튕길 때 같이 튀어 오릅니다.' }] },
    { q: '구체적으로 어떻게 작동해요?', a: [{ kind: 'steps', steps: ['전날 변동폭 계산: 고가 − 저가 = 레인지', '매수 기준가 = 오늘 시가 + (레인지 × k), k는 0.4~0.6', '오늘 가격이 기준가를 돌파하면 → 매수', '다음 날 시가에 매도 또는 트레일링'] }] },
    { q: '위험한 건 없어요? 🤔', a: [{ kind: 'warning', body: '잦은 매매로 수수료가 쌓이고, 횡보장에선 거짓 돌파로 연속 손실이 날 수 있어요. 손절선을 함께 두세요.' }] },
    { q: '누구에게 적합한가요? 🧭', a: [{ kind: 'text', body: '하루 단위로 빠르게 진입·청산하는 단기 매매가 맞고, 변동성이 큰 코인·종목을 다루는 분에게 맞아요. 장중 시세를 자주 확인할 수 있는 분께 적합합니다.' }] },
  ] },
};

// 프리셋 카테고리(소문자: trend/reversal/volatility/basic/custom) → 교육 계열(EDU 키) 매핑.
// 모멘텀 로테이션 프리셋은 카테고리가 'trend'라 id로 별도 판별.
const eduKeyFor = (id: string, cat: string): string => {
  if (id.includes('momentum')) return 'MOMENTUM';
  if (cat === 'reversal') return 'MEAN_REVERSION';
  if (cat === 'volatility') return 'VOLATILITY';
  return 'TREND_FOLLOWING'; // trend·basic·custom 기본
};

/* 전략별 맞춤 핵심 포인트 — 이름·로직에서 키워드를 찾아 최대 2개 제공 */
const STRATEGY_TIPS: [string[], string][] = [
  [['골든크로스', '데드크로스'], '단기·장기 이동평균이 교차하는 지점이 핵심 신호예요. 추세장에서 강하지만 횡보장에선 잦은 가짜 신호(휩쏘)에 주의하세요.'],
  [['이동평균', 'ema', 'ma('], '이동평균선의 방향과 배열(정배열/역배열)로 추세를 읽어요. 가격이 이평선 위에 있으면 강세로 봅니다.'],
  [['rsi(2)', '래리 코너스', '코너스'], '짧은 RSI(2)로 급락 후 단기 반등을 노려요. 승률은 높지만 거래가 잦아 비용 관리가 중요해요.'],
  [['rsi', '과매도', '과매수', '평균회귀'], 'RSI 30/70 같은 임계선이 매매 기준이에요. 강한 추세장에선 과매수·과매도가 오래 유지되니 추세 필터와 함께 쓰면 좋아요.'],
  [['볼린저', '밴드', '수축', '%b'], '밴드 폭이 좁아졌다가(수축) 넓어질 때(확장) 큰 움직임이 나와요. 상단 돌파는 강세, 하단 이탈은 약세로 봅니다.'],
  [['macd', '시그널', '히스토그램'], 'MACD가 시그널선을 상향 돌파하면 매수, 하향 돌파하면 매도예요. 0선 위/아래로 추세 방향도 함께 확인하세요.'],
  [['스토캐스틱', '%k', '%d'], '%K가 %D를 교차하는 시점이 신호예요. 과매도(20 이하)에서의 골든크로스가 신뢰도가 높아요.'],
  [['변동성 돌파', '변동성', '돌파', '켈트너'], '전일 변동폭의 일정 비율을 돌파하면 진입해요. 하루 단위라 리스크가 제한적이지만 횡보장에선 손실이 누적될 수 있어요.'],
  [['모멘텀', '추세추종', '추세', '터틀', '돈치안'], '오르는 자산은 더 오르고 내리는 자산은 더 내린다는 관성에 베팅해요. 큰 추세를 놓치지 않지만 전환점에서 손실이 날 수 있어요.'],
  [['리밸런싱', '비중', '분산', '포트폴리오'], '자산 비중이 목표에서 벗어나면 다시 맞춰요. 오른 자산을 팔고 내린 자산을 사는 "역발상"이 자동으로 이뤄져요.'],
  [['적립', '분할', 'dca'], '한 번에 사지 않고 나눠 사서 평균 단가를 낮춰요. 시장 타이밍 부담이 줄고 변동성에 강해져요.'],
  [['buy', '보유', '장기'], '사서 묻어두는 가장 단순한 전략이에요. 매매 비용·실수가 적어 장기 우상향 시장에서 강합니다.'],
];
const matchTips = (name: string, logic?: string): string[] => {
  const hay = `${name} ${logic || ''}`.toLowerCase();
  const out: string[] = [];
  for (const [keys, tip] of STRATEGY_TIPS) {
    if (keys.some(k => hay.includes(k.toLowerCase())) && !out.includes(tip)) out.push(tip);
    if (out.length >= 2) break;
  }
  return out;
};

const bubble: React.CSSProperties = { padding: '12px 14px', borderRadius: 14, borderTopLeftRadius: 4, background: 'var(--ci-card)', border: `1px solid ${HAIR}` };
const BlkView = ({ b }: { b: Blk }) => {
  if (b.kind === 'text') return <div style={bubble}><p className="m-0 text-[14.5px] leading-relaxed" style={{ color: INK1 }}>{b.body}</p></div>;
  if (b.kind === 'term') return <div style={{ ...bubble, padding: '8px 12px', background: SONAR_DIM, border: '1px solid rgba(91,157,255,.22)' }}><span className="text-[13px]" style={{ color: INK2 }}>관련 용어: </span><span className="text-[13.5px] font-semibold underline decoration-dotted underline-offset-2" style={{ color: SONAR }} title={b.def}>{b.name}</span><span className="mt-1 block text-[13px] leading-relaxed" style={{ color: INK2 }}>{b.def}</span></div>;
  if (b.kind === 'easy') return <div style={{ ...bubble, background: 'rgba(245,208,97,.07)', border: '1px solid rgba(245,208,97,.24)' }} className="grid grid-cols-[auto_1fr] items-start gap-3"><span className="text-[19.5px]">💡</span><p className="m-0 text-[14.5px] leading-relaxed" style={{ color: INK1 }}>{b.body}</p></div>;
  if (b.kind === 'warning') return <div style={{ ...bubble, background: 'rgba(77,138,255,.07)', border: '1px solid rgba(77,138,255,.24)' }} className="grid grid-cols-[auto_1fr] items-start gap-3"><span className="text-[17.5px]">⚠️</span><p className="m-0 text-[14.5px] leading-relaxed" style={{ color: INK1 }}>{b.body}</p></div>;
  return <div style={bubble}><ol className="m-0 flex list-none flex-col gap-2.5 p-0">{(b as Extract<Blk, { kind: 'steps' }>).steps.map((s, i) => <li key={i} className="grid grid-cols-[22px_1fr] items-start gap-3"><span className="flex h-[22px] w-[22px] items-center justify-center rounded-full font-mono text-[12px] font-bold" style={{ background: SONAR_DIM, border: '1px solid rgba(91,157,255,.32)', color: SONAR }}>{i + 1}</span><span className="text-[14.5px] leading-snug" style={{ color: INK1 }}>{s}</span></li>)}</ol></div>;
};
const Turn = ({ q, a, index }: { q: string; a: Blk[]; index: number }) => (
  <div className="flex flex-col gap-3" style={{ marginTop: index === 0 ? 8 : 20, animation: `message-in .3s ease ${index * 0.08}s both` }}>
    <div className="flex justify-end"><div className="max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[14.5px] font-semibold text-white" style={{ borderBottomRightRadius: 4, background: `linear-gradient(180deg, ${SONAR}, #2c6fe6)` }}>{q}</div></div>
    <div className="flex items-start gap-2.5"><WhaleAvatar size={30} /><div className="flex min-w-0 flex-1 flex-col gap-2.5">{a.map((bl, i) => <BlkView key={i} b={bl} />)}</div></div>
  </div>
);

type LearnStrat = { id: string; name: string; cat: string };
const StrategyLearnDrawer = ({ strat, logic, onClose }: { strat: LearnStrat | null; logic?: string; onClose: () => void }): ReactNode => {
  useEffect(() => {
    if (!strat) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k); const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = prev; };
  }, [strat, onClose]);
  if (!strat) return null;
  const edu = EDU[eduKeyFor(strat.id, strat.cat)] || EDU.TREND_FOLLOWING;
  const tips = matchTips(strat.name, logic);
  return (
    <div onClick={onClose} className="fixed inset-0 z-[115] flex items-start justify-center overflow-y-auto px-6 py-12" style={{ background: 'rgba(6,11,31,.72)', backdropFilter: 'blur(6px)', animation: 'backdrop-in .2s ease' }}>
      <div onClick={e => e.stopPropagation()} className="relative w-full max-w-[680px] rounded-[18px]" style={{ background: 'var(--ci-overlay)', border: `1px solid ${HAIR_S}`, boxShadow: 'var(--ci-panel-shadow)', animation: 'modal-in .25s cubic-bezier(.2,.8,.2,1)' }}>
        <button onClick={onClose} aria-label="닫기" className="absolute right-[18px] top-[18px] z-[2] flex h-8 w-8 items-center justify-center rounded-lg" style={{ border: `1px solid ${HAIR}`, background: CARD, color: INK1 }}><svg aria-hidden width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg></button>
        <header className="flex items-center gap-3 px-7 pb-[18px] pt-7" style={{ borderBottom: `1px solid ${HAIR}` }}>
          <WhaleAvatar size={40} animated />
          <div className="min-w-0">
            <div className="text-[12px] font-semibold tracking-[.12em]" style={{ color: SONAR }}>고래 튜터 · 이 전략 배우기</div>
            <h2 className="truncate text-[21px] font-bold">{strat.name}</h2>
          </div>
        </header>
        <div className="px-7 pb-2 pt-5">
          <div className="flex items-center gap-2.5"><WhaleAvatar size={32} animated /><span className="rounded-2xl px-3.5 py-2 text-[14px]" style={{ background: CARD, border: `1px solid ${HAIR}`, color: INK1 }}>{edu.tagline} 쉽게 알려드릴게요.</span></div>
          {edu.qa.map((t, i) => <Turn key={i} index={i} q={t.q} a={t.a} />)}
        </div>
        {tips.length > 0 && (
          <div className="mx-7 mt-3 rounded-xl px-[18px] py-4" style={{ background: 'rgba(245,208,97,.07)', border: '1px solid rgba(245,208,97,.24)' }}>
            <div className="mb-2 text-[12px] font-semibold tracking-[.16em]" style={{ color: '#f5d061' }}>💡 이 전략 핵심 포인트</div>
            <ul className="m-0 flex flex-col gap-2 p-0" style={{ listStyle: 'none' }}>{tips.map((t, i) => <li key={i} className="flex gap-2 text-[13.5px] leading-relaxed" style={{ color: INK1 }}><span style={{ color: '#f5d061' }}>•</span><span>{t}</span></li>)}</ul>
          </div>
        )}
        <footer className="mt-4 flex items-center justify-between gap-3 px-7 pb-6 pt-[18px]" style={{ borderTop: `1px solid ${HAIR}` }}>
          <span className="text-[13px]" style={{ color: INK2 }}>이해했다면 오른쪽에서 바로 백테스트로 검증해보세요.</span>
          <button onClick={onClose} className="rounded-lg px-4 py-2.5 text-[14px] font-bold text-white" style={{ background: `linear-gradient(180deg, ${SONAR}, #2c6fe6)` }}>백테스트 하러 가기 →</button>
        </footer>
      </div>
    </div>
  );
};

export default StrategyLearnDrawer;
