import type { ReactNode } from 'react';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRoutePrefix } from '../hooks/useRoutePrefix';
import HelmShell from '../components/HelmShell';
import {
  quantStoreService, CATEGORY_LABELS, RISK_LABELS, assetDisplayName,
  type QuantProduct, type PurchasePerformance, type ProductPurchase,
} from '../services/quantStoreService';
import { tradeService } from '../services/tradeService';
import { Term } from '../components/GlossaryTerm';

/* ────────────────────────────────────────────────────────────
   ConsoleLearnPage — 전략 학습 & 스토어 (/store) · 실데이터 배선
   실제 상품(quantStoreService) 카드 + 고래튜터 카테고리별 교육 Q&A + 구매(VIRT)·보유·취소.
   ──────────────────────────────────────────────────────────── */

const UP = '#ef4d4d', DOWN = '#4d8aff';
const SONAR = 'var(--ci-sonar)';
const INK0 = 'var(--ci-ink0)', INK1 = 'var(--ci-ink1)', INK2 = 'var(--ci-ink2)', INK3 = 'var(--ci-ink3)';
const HAIR = 'var(--ci-line)', HAIR_S = 'var(--ci-line-strong)';
const CARD = 'var(--ci-card)', SONAR_DIM = 'var(--ci-sonar-dim)';
const panel: React.CSSProperties = { background: 'var(--ci-panel)', border: `1px solid ${HAIR}`, borderRadius: 16, boxShadow: 'var(--ci-panel-shadow)' };
const fieldStyle: React.CSSProperties = { border: `1px solid ${HAIR}`, background: CARD, color: 'var(--ci-ink0)' };
const fmtKRW = (n: number) => '₩' + Math.round(n || 0).toLocaleString('ko-KR');
const isManaged = (p: QuantProduct) => p.strategyType === 'TURTLE';   // 관리형 퀀트 상품(구매→자동운용) vs DIY 신호전략(백테스트)

const WhaleAvatar = ({ size = 36, animated }: { size?: number; animated?: boolean }) => (
  <span className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full" style={{ width: size, height: size, background: 'radial-gradient(120% 120% at 50% 30%, rgba(91,157,255,.18), rgba(91,157,255,.04))', border: '1px solid rgba(91,157,255,.30)', animation: animated ? 'whale-float 5s ease-in-out infinite' : undefined }}>
    <img src="/whales/beluga.png" alt="고래 튜터" draggable={false} style={{ width: size * 0.82, height: size * 0.82, objectFit: 'contain' }} />
  </span>
);
const TagL = ({ children, color, bg, border }: { children: ReactNode; color: string; bg: string; border: string }) => (
  <span className="whitespace-nowrap rounded-[5px] px-2 py-[3px] text-[11px] font-bold tracking-[.04em]" style={{ background: bg, color, border: `1px solid ${border}` }}>{children}</span>
);

const RISK_TAG: Record<string, { color: string; bg: string; border: string }> = {
  LOW: { color: '#4d8aff', bg: 'rgba(77,138,255,.12)', border: 'rgba(77,138,255,.28)' },     // 안전 = 차분한 파랑
  MEDIUM: { color: '#f5d061', bg: 'rgba(255,205,120,.12)', border: 'rgba(255,205,120,.28)' }, // 보통 = 앰버
  HIGH: { color: '#ef4d4d', bg: 'rgba(239,77,77,.12)', border: 'rgba(239,77,77,.28)' },       // 공격 = 경고 빨강
};
const CATS: [string, string][] = [['all', '전체'], ['TREND_FOLLOWING', '추세추종'], ['MOMENTUM', '모멘텀'], ['MEAN_REVERSION', '평균회귀'], ['VOLATILITY', '변동성'], ['ARBITRAGE', '차익거래'], ['MULTI_FACTOR', '멀티팩터']];

/* ── 고래튜터 교육 콘텐츠 (카테고리별) ── */
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
  MULTI_FACTOR: { tagline: '여러 자산을 비중대로 굴려요!', qa: [
    { q: '이 전략이 뭐예요?', a: [{ kind: 'text', body: '여러 자산을 정해진 비율로 보유하고 일정 주기로 비율을 다시 맞춰주는 전략입니다. 오른 자산은 일부 팔고, 줄어든 자산은 더 삽니다.' }, { kind: 'term', name: '리밸런싱', def: '틀어진 자산 비중을 목표 비율로 되돌리는 것. 자동으로 "비싼 것 팔고 싼 것 사는" 효과.' }] },
    { q: '좀 더 쉽게 설명해주세요!', a: [{ kind: 'easy', body: '화분 비율을 일정하게 유지하는 거예요. 자연스럽게 분산 효과가 나고 한 자산에 쏠리지 않아 마음이 편합니다.' }] },
    { q: '구체적으로 어떻게 작동해요?', a: [{ kind: 'steps', steps: ['목표 비중 설정 (예: 60/30/10)', '매월 첫 거래일에 현재 비중과 비교', '5% 이상 차이 나면 다시 맞춤', '주기적으로 반복'] }] },
    { q: '위험한 건 없어요? 🤔', a: [{ kind: 'warning', body: '강한 상승장에선 단순 보유보다 수익률이 낮을 수 있고, 잦은 리밸런싱은 수수료·세금을 늘립니다.' }] },
    { q: '누구에게 적합한가요? 🧭', a: [{ kind: 'text', body: '한 자산에 몰빵하기 불안하고, 마음 편한 분산 투자를 원하는 분에게 맞아요. 자주 매매하지 않고 정기적으로만 관리하고 싶은 직장인 투자자에게 좋습니다.' }] },
  ] },
  ARBITRAGE: { tagline: '가격 차이에서 안전하게 먹어요!', qa: [
    { q: '이 전략이 뭐예요?', a: [{ kind: 'text', body: '같은 자산이 시장마다 다른 가격일 때, 싼 곳에서 사고 비싼 곳에서 파는 차익거래 전략입니다. 위험이 낮지만 수익도 작은 편이에요.' }, { kind: 'term', name: '김치 프리미엄', def: '국내 거래소 가격이 해외보다 높은 현상. 이 가격차를 활용.' }] },
    { q: '좀 더 쉽게 설명해주세요!', a: [{ kind: 'easy', body: '같은 물건이 A마트 1,000원, B마트 1,050원이면 A에서 사서 B에서 파는 거예요. 방향에 베팅하지 않아 시장이 어디로 가든 차이만 먹습니다.' }] },
    { q: '구체적으로 어떻게 작동해요?', a: [{ kind: 'steps', steps: ['두 시장의 가격을 실시간 비교', '괴리가 임계치 이상 벌어지면 진입', '싼 쪽 매수 + 비싼 쪽 매도(헤지)', '괴리가 좁혀지면 청산'] }] },
    { q: '위험한 건 없어요? 🤔', a: [{ kind: 'warning', body: '체결·송금 지연, 수수료, 환율 때문에 이론상 차익이 사라질 수 있어요. 실행 속도와 비용 관리가 핵심입니다.' }] },
    { q: '누구에게 적합한가요? 🧭', a: [{ kind: 'text', body: '방향성 베팅의 스트레스 없이 작은 차익을 안정적으로 모으고 싶은 분에게 맞아요. 다만 빠른 체결과 비용 관리가 가능한 환경(여러 거래소 계좌 등)이 필요합니다.' }] },
  ] },
};
const eduFor = (cat: string) => EDU[cat] || EDU.TREND_FOLLOWING;

const bubble: React.CSSProperties = { padding: '12px 14px', borderRadius: 14, borderTopLeftRadius: 4, background: 'var(--ci-card)', border: `1px solid ${HAIR}` };
const BlkView = ({ b }: { b: Blk }) => {
  if (b.kind === 'text') return <div style={bubble}><p className="m-0 text-[13.5px] leading-relaxed" style={{ color: INK1 }}>{b.body}</p></div>;
  if (b.kind === 'term') return <div style={{ ...bubble, padding: '8px 12px', background: SONAR_DIM, border: '1px solid rgba(91,157,255,.22)' }}><span className="text-[12px]" style={{ color: INK2 }}>관련 용어: </span><span className="text-[12.5px] font-semibold underline decoration-dotted underline-offset-2" style={{ color: SONAR }} title={b.def}>{b.name}</span><span className="mt-1 block text-[12px] leading-relaxed" style={{ color: INK2 }}>{b.def}</span></div>;
  if (b.kind === 'easy') return <div style={{ ...bubble, background: 'rgba(245,208,97,.07)', border: '1px solid rgba(245,208,97,.24)' }} className="grid grid-cols-[auto_1fr] items-start gap-3"><span className="text-[18px]">💡</span><p className="m-0 text-[13.5px] leading-relaxed" style={{ color: INK1 }}>{b.body}</p></div>;
  if (b.kind === 'warning') return <div style={{ ...bubble, background: 'rgba(77,138,255,.07)', border: '1px solid rgba(77,138,255,.24)' }} className="grid grid-cols-[auto_1fr] items-start gap-3"><span className="text-[16px]">⚠️</span><p className="m-0 text-[13.5px] leading-relaxed" style={{ color: INK1 }}>{b.body}</p></div>;
  return <div style={bubble}><ol className="m-0 flex list-none flex-col gap-2.5 p-0">{(b as Extract<Blk, { kind: 'steps' }>).steps.map((s, i) => <li key={i} className="grid grid-cols-[22px_1fr] items-start gap-3"><span className="flex h-[22px] w-[22px] items-center justify-center rounded-full font-mono text-[11px] font-bold" style={{ background: SONAR_DIM, border: '1px solid rgba(91,157,255,.32)', color: SONAR }}>{i + 1}</span><span className="text-[13.5px] leading-snug" style={{ color: INK1 }}>{s}</span></li>)}</ol></div>;
};
const Turn = ({ q, a, index }: { q: string; a: Blk[]; index: number }) => (
  <div className="flex flex-col gap-3" style={{ marginTop: index === 0 ? 8 : 20, animation: `message-in .3s ease ${index * 0.08}s both` }}>
    <div className="flex justify-end"><div className="max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13.5px] font-semibold text-white" style={{ borderBottomRightRadius: 4, background: `linear-gradient(180deg, ${SONAR}, #2c6fe6)` }}>{q}</div></div>
    <div className="flex items-start gap-2.5"><WhaleAvatar size={30} /><div className="flex min-w-0 flex-1 flex-col gap-2.5">{a.map((bl, i) => <BlkView key={i} b={bl} />)}</div></div>
  </div>
);

const Metric = ({ label, value, color }: { label: ReactNode; value: string; color?: string }) => (
  <div><div className="mb-1 text-[10.5px] tracking-[.08em]" style={{ color: INK2 }}>{label}</div><div className="font-mono text-[14px] font-bold" style={{ color: color || INK0 }}>{value}</div></div>
);

/* 전략별 맞춤 교육 — 상품명·로직·설명에서 전략 키워드를 찾아 핵심 포인트 제공 (옛 store 12전략 키워드 복원) */
const STRATEGY_TIPS: [string[], string][] = [
  [['골든크로스', '데드크로스'], '단기·장기 이동평균이 교차하는 지점이 핵심 신호예요. 추세장에서 강하지만 횡보장에선 잦은 가짜 신호(휩쏘)에 주의하세요.'],
  [['이동평균', 'MA(', 'MA '], '이동평균선의 방향과 배열(정배열/역배열)로 추세를 읽어요. 가격이 이평선 위에 있으면 강세로 봅니다.'],
  [['RSI(2)', '래리 코너스', '코너스'], '짧은 RSI(2)로 급락 후 단기 반등을 노려요. 승률은 높지만 거래가 잦아 비용 관리가 중요해요.'],
  [['RSI', '과매도', '과매수', '평균회귀'], 'RSI 30/70 같은 임계선이 매매 기준이에요. 강한 추세장에선 과매수·과매도가 오래 유지되니 추세 필터와 함께 쓰면 좋아요.'],
  [['볼린저', '밴드', '수축', '%B'], '밴드 폭이 좁아졌다가(수축) 넓어질 때(확장) 큰 움직임이 나와요. 상단 돌파는 강세, 하단 이탈은 약세로 봅니다.'],
  [['MACD', '시그널', '히스토그램'], 'MACD가 시그널선을 상향 돌파하면 매수, 하향 돌파하면 매도예요. 0선 위/아래로 추세 방향도 함께 확인하세요.'],
  [['스토캐스틱', '%K', '%D'], '%K가 %D를 교차하는 시점이 신호예요. 과매도(20 이하)에서의 골든크로스가 신뢰도가 높아요.'],
  [['변동성 돌파', '변동성', '돌파'], '전일 변동폭의 일정 비율을 돌파하면 진입해요. 하루 단위라 리스크가 제한적이지만 횡보장에선 손실이 누적될 수 있어요.'],
  [['모멘텀', '추세추종', '추세'], '오르는 자산은 더 오르고 내리는 자산은 더 내린다는 관성에 베팅해요. 큰 추세를 놓치지 않지만 전환점에서 손실이 날 수 있어요.'],
  [['리밸런싱', '비중', '분산', '포트폴리오'], '자산 비중이 목표에서 벗어나면 다시 맞춰요. 오른 자산을 팔고 내린 자산을 사는 "역발상"이 자동으로 이뤄져요.'],
  [['적립', '분할', 'DCA'], '한 번에 사지 않고 나눠 사서 평균 단가를 낮춰요. 시장 타이밍 부담이 줄고 변동성에 강해져요.'],
  [['Buy', '보유', '장기'], '사서 묻어두는 가장 단순한 전략이에요. 매매 비용·실수가 적어 장기 우상향 시장에서 강합니다.'],
];
const matchTips = (p: QuantProduct): string[] => {
  const hay = `${p.name} ${p.strategyLogic || ''} ${p.description || ''}`.toLowerCase();
  const out: string[] = [];
  for (const [keys, tip] of STRATEGY_TIPS) {
    if (keys.some(k => hay.includes(k.toLowerCase())) && !out.includes(tip)) out.push(tip);
    if (out.length >= 2) break;
  }
  return out;
};

/* 상품 → 전략 빌더 프리셋 id 매핑 — 학습에서 본 전략을 백테스트 화면에 자동 세팅(?strategy=<id>).
   id는 presetStrategies.ts(PRESET_STRATEGIES)의 키와 일치해야 함(preset-*). */
// 광범위 어휘(예: 단독 '래리'·'돌파'·'ma(')는 전략 종류가 아닌 텍스트에 오매칭되므로 의미 키워드로 한정.
// '래리 윌리엄스 변동성 돌파'(변동성)가 connors(RSI2 평균회귀)로 새지 않도록 코너스 계열로만 매칭.
const PRESET_KEYWORDS: [string[], string][] = [
  [['래리 코너스', '코너스', 'connors', 'rsi(2)', 'rsi 2'], 'preset-connors-rsi2'],
  [['변동성 돌파', '변동성돌파', 'volatility breakout'], 'preset-volatility-breakout'],
  [['골든크로스', '데드크로스', '골든 크로스', '이동평균 교차', '이평 교차', 'golden cross', 'ma 교차'], 'preset-golden-cross'],
  [['볼린저', 'bollinger', '%b'], 'preset-bollinger-squeeze'],
  [['macd'], 'preset-macd-divergence'],
  [['스토캐스틱', 'stochastic'], 'preset-stochastic'],
  [['과매도', '과매수', '평균회귀', 'mean revers', 'rsi'], 'preset-rsi-reversal'],
  [['buy & hold', 'buy and hold', '바이앤홀드', '단순 보유', '장기 보유', 'buyhold'], 'preset-buy-hold'],
];
// 정확 매칭만: 상품명·로직에 전략 키워드가 명시된 경우에만 프리셋을 로드한다(카테고리 추정 폴백 제거).
// 키워드가 없는 상품(예: 마크 미너비니 트렌드 템플릿)은 실제 전략과 다른 프리셋이 열리는 불일치를 피하려 숨긴다.
const presetFor = (p: QuantProduct): string | null => {
  const hay = `${p.name} ${p.strategyLogic || ''} ${p.description || ''}`.toLowerCase();
  for (const [keys, id] of PRESET_KEYWORDS) {
    if (keys.some(k => hay.includes(k.toLowerCase()))) return id;
  }
  return null;
};

/* ── 상품 상세 모달 (실데이터 + 교육 Q&A) ── */
const ProductModal = ({ p, purchased, onClose, onRun, onBuy, onCancel }: { p: QuantProduct; purchased: boolean; onClose: () => void; onRun: () => void; onBuy: () => void; onCancel: () => void }) => {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k); const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = prev; };
  }, [onClose]);
  const edu = eduFor(p.category);
  const tips = matchTips(p);
  const rt = RISK_TAG[p.riskLevel];
  return (
    <div onClick={onClose} className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto px-6 py-12" style={{ background: 'rgba(6,11,31,.72)', backdropFilter: 'blur(6px)', animation: 'backdrop-in .2s ease' }}>
      <div onClick={e => e.stopPropagation()} className="relative w-full max-w-[680px] rounded-[18px]" style={{ background: 'var(--ci-overlay)', border: `1px solid ${HAIR_S}`, boxShadow: 'var(--ci-panel-shadow)', animation: 'modal-in .25s cubic-bezier(.2,.8,.2,1)' }}>
        <button onClick={onClose} className="absolute right-[18px] top-[18px] z-[2] flex h-8 w-8 items-center justify-center rounded-lg" style={{ border: `1px solid ${HAIR}`, background: CARD, color: INK1 }}><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg></button>
        <header className="px-7 pb-[18px] pt-7" style={{ borderBottom: `1px solid ${HAIR}` }}>
          <div className="mb-3 flex flex-wrap gap-1.5"><TagL color={SONAR} bg={SONAR_DIM} border="rgba(91,157,255,.24)">{CATEGORY_LABELS[p.category]}</TagL><TagL color={rt.color} bg={rt.bg} border={rt.border}>{RISK_LABELS[p.riskLevel]} 리스크</TagL>{p.assetType && <TagL color={INK1} bg={CARD} border={HAIR}>{p.assetType === 'CRYPTO' ? '가상화폐' : '주식'}</TagL>}</div>
          <h2 className="text-[22px] font-bold">{p.name}</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: INK1 }}>{p.description}</p>
          <div className="mt-4 grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(92px, 1fr))' }}>
            <Metric label="대상 자산" value={`${p.targetAssets?.length || 0}종목`} />
            <Metric label="자산 유형" value={p.assetType === 'CRYPTO' ? '가상화폐' : '주식'} />
            <Metric label={<Term k="MDD" compact>리스크</Term>} value={RISK_LABELS[p.riskLevel]} color={rt.color} />
            <Metric label="구독자" value={`${(p.subscribers || 0).toLocaleString('ko-KR')}명`} />
          </div>
          <div className="mt-3.5 rounded-lg px-3.5 py-2.5 text-[12px] leading-relaxed" style={{ background: 'rgba(245,208,97,.08)', border: '1px solid rgba(245,208,97,.24)', color: INK1 }}>
            ℹ️ 수익률·샤프·승률 같은 성과는 시장·기간에 따라 달라집니다. 아래 <span style={{ color: '#f5d061', fontWeight: 700 }}>백테스트로 검증</span>에서 직접 과거 데이터로 확인해보세요.
          </div>
        </header>
        <div className="px-7 pt-5">
          <div className="flex items-center gap-2.5"><WhaleAvatar size={32} animated /><span className="rounded-2xl px-3.5 py-2 text-[13px]" style={{ background: CARD, border: `1px solid ${HAIR}`, color: INK1 }}>{edu.tagline} 쉽게 알려드릴게요.</span></div>
          {edu.qa.map((t, i) => <Turn key={i} index={i} q={t.q} a={t.a} />)}
        </div>
        {p.targetAssets?.length > 0 && (
          <div className="mx-7 mt-4 rounded-xl px-[18px] py-4" style={{ background: CARD, border: `1px solid ${HAIR}` }}>
            <div className="mb-2.5 text-[11px] font-semibold tracking-[.16em]" style={{ color: SONAR }}>대상 자산</div>
            <div className="flex flex-wrap gap-1.5">{p.targetAssets.map(a => <span key={a} className="whitespace-nowrap rounded-[5px] px-2.5 py-1 text-[11.5px]" style={{ background: 'var(--ci-card)', border: `1px solid ${HAIR}`, color: INK1 }}>{assetDisplayName(a, p.assetType)}</span>)}</div>
          </div>
        )}
        {p.strategyLogic && (
          <div className="mx-7 mt-3 rounded-xl px-[18px] py-4" style={{ background: SONAR_DIM, border: '1px solid rgba(91,157,255,.18)' }}>
            <div className="mb-1.5 text-[11px] font-semibold tracking-[.16em]" style={{ color: SONAR }}>전략 로직</div>
            <p className="m-0 whitespace-pre-wrap text-[12.5px] leading-relaxed" style={{ color: INK1 }}>{p.strategyLogic}</p>
          </div>
        )}
        {tips.length > 0 && (
          <div className="mx-7 mt-3 rounded-xl px-[18px] py-4" style={{ background: 'rgba(245,208,97,.07)', border: '1px solid rgba(245,208,97,.24)' }}>
            <div className="mb-2 text-[11px] font-semibold tracking-[.16em]" style={{ color: '#f5d061' }}>💡 이 전략 핵심 포인트</div>
            <ul className="m-0 flex flex-col gap-2 p-0" style={{ listStyle: 'none' }}>{tips.map((t, i) => <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed" style={{ color: INK1 }}><span style={{ color: '#f5d061' }}>•</span><span>{t}</span></li>)}</ul>
          </div>
        )}
        <footer className="mt-4 flex flex-wrap items-center justify-between gap-3.5 px-7 pb-6 pt-[18px]" style={{ borderTop: `1px solid ${HAIR}` }}>
          {isManaged(p) ? (
            <>
              <span className="text-[12px]" style={{ color: INK2 }}>{purchased ? '이 전략으로 자동 운용 중입니다.' : '구매하면 대상 자산을 매수해 규칙대로 자동 운용합니다. (모의)'}</span>
              {purchased
                ? <button onClick={onCancel} className="rounded-lg px-4 py-2.5 text-[13px] font-semibold" style={{ border: '1px solid rgba(77,138,255,.32)', background: 'rgba(77,138,255,.08)', color: DOWN }}>항해 취소</button>
                : <button onClick={onBuy} className="inline-flex items-center gap-2 rounded-[10px] px-[18px] py-2.5 text-[13px] font-bold text-white" style={{ border: '1px solid rgba(140,190,255,.5)', background: 'linear-gradient(180deg,#4d8aff 0%,#2c6fe6 62%,#2257c8 100%)', boxShadow: '0 12px 26px -12px rgba(44,111,230,.7), inset 0 1px 0 rgba(255,255,255,.38)' }}><span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: 'rgba(255,255,255,.2)' }}>VIRT</span>구매 · 자동 운용 →</button>}
            </>
          ) : (
            <>
              <span className="text-[12px]" style={{ color: INK2 }}>먼저 백테스트로 과거 성과를 검증한 뒤, 모의 자동매매로 이어갈 수 있어요.</span>
              <button onClick={onRun} title="이 전략이 세팅된 채로 모의(VIRT) 백테스트 화면이 열려요" className="inline-flex items-center gap-2 rounded-[10px] px-[18px] py-2.5 text-[13px] font-bold text-white" style={{ border: '1px solid rgba(140,190,255,.5)', background: 'linear-gradient(180deg,#4d8aff 0%,#2c6fe6 62%,#2257c8 100%)', boxShadow: '0 12px 26px -12px rgba(44,111,230,.7), inset 0 1px 0 rgba(255,255,255,.38)' }}>
                <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: 'rgba(255,255,255,.2)' }}>VIRT</span>이 전략 백테스트 →
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
};

const Card = ({ p, purchased, onOpen, onRun, onBuy }: { p: QuantProduct; purchased: boolean; onOpen: () => void; onRun: () => void; onBuy: () => void }) => {
  const rt = RISK_TAG[p.riskLevel];
  const managed = isManaged(p);
  return (
    <div className="flex flex-col" style={panel}>
      <div className="flex flex-wrap gap-1.5 px-[22px] pt-[18px]"><TagL color={SONAR} bg={SONAR_DIM} border="rgba(91,157,255,.24)">{CATEGORY_LABELS[p.category]}</TagL><TagL color={rt.color} bg={rt.bg} border={rt.border}>{RISK_LABELS[p.riskLevel]}</TagL>{p.assetType && <TagL color={INK1} bg={CARD} border={HAIR}>{p.assetType === 'CRYPTO' ? '가상화폐' : '주식'}</TagL>}</div>
      <h3 className="mx-[22px] my-3 text-[17.5px] font-bold">{p.name}</h3>
      <div className="mx-[22px] mb-3 grid grid-cols-[auto_1fr] items-start gap-2.5">
        <WhaleAvatar size={32} />
        <div className="rounded-xl px-3.5 py-3" style={{ borderTopLeftRadius: 4, background: CARD, border: `1px solid ${HAIR}` }}><p className="m-0 line-clamp-3 text-[13px] leading-relaxed" style={{ color: INK1 }}>{p.description}</p></div>
      </div>
      <div className="mx-[22px] mb-3 grid grid-cols-3 gap-2">
        <Metric label="대상 자산" value={`${p.targetAssets?.length || 0}종목`} />
        <Metric label="리스크" value={RISK_LABELS[p.riskLevel]} color={rt.color} />
        <Metric label="구독자" value={`${(p.subscribers || 0).toLocaleString('ko-KR')}명`} />
      </div>
      <div className="flex flex-wrap gap-1.5 px-[22px] pb-4">{(p.targetAssets || []).slice(0, 5).map(a => <span key={a} className="whitespace-nowrap rounded-[5px] px-2.5 py-1 text-[11.5px]" style={{ background: 'var(--ci-card)', border: `1px solid ${HAIR}`, color: INK1 }}>{assetDisplayName(a, p.assetType)}</span>)}</div>
      <div className="mt-auto flex items-center justify-between gap-2.5 px-[18px] py-3.5" style={{ borderTop: `1px solid ${HAIR}`, background: CARD }}>
        <button onClick={onOpen} className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold text-white" style={{ border: `1px solid ${HAIR_S}`, background: CARD }}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="2" y="2.5" width="10" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.3" /><path d="M4.5 5.5H9.5M4.5 7.5H8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>알아보기
        </button>
        {managed
          ? (purchased
              ? <span className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-bold" style={{ background: 'rgba(63,214,160,.16)', border: '1px solid rgba(63,214,160,.32)', color: '#3fd6a0' }}><span className="h-1.5 w-1.5 rounded-full animate-pulse-dot" style={{ background: '#3fd6a0' }} />운용 중 ⛵</span>
              : <button onClick={onBuy} className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-bold text-white" style={{ border: '1px solid rgba(140,190,255,.5)', background: 'linear-gradient(180deg,#4d8aff,#2c6fe6)' }}><span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: 'rgba(255,255,255,.2)' }}>VIRT</span>구매 →</button>)
          : <button onClick={onRun} className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-bold text-white" style={{ border: '1px solid rgba(140,190,255,.5)', background: 'linear-gradient(180deg,#4d8aff,#2c6fe6)' }}><span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: 'rgba(255,255,255,.2)' }}>VIRT</span>돌려보기 →</button>}
      </div>
    </div>
  );
};

/* ── 투자금 입력 모달 (관리형 상품 구매, VIRT) ── */
const QUICK = [500_000, 1_000_000, 3_000_000, 5_000_000];
const InvestModal = ({ p, cash, onClose, onConfirm, busy }: { p: QuantProduct; cash: number | null; onClose: () => void; onConfirm: (amount: number) => void; busy: boolean }) => {
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<'amount' | 'confirm'>('amount'); // 2단계 구매 확인
  const num = Number(amount.replace(/,/g, '')) || 0;
  const over = cash != null && num > cash;
  const canNext = num > 0 && !over && cash != null;
  return (
    <div onClick={onClose} className="fixed inset-0 z-[110] flex items-start justify-center overflow-y-auto px-6 py-12" style={{ background: 'rgba(6,11,31,.78)', backdropFilter: 'blur(6px)', animation: 'backdrop-in .2s ease' }}>
      <div onClick={e => e.stopPropagation()} className="relative w-full max-w-[440px] rounded-[18px]" style={{ background: 'var(--ci-overlay)', border: `1px solid ${HAIR_S}`, boxShadow: 'var(--ci-panel-shadow)', animation: 'modal-in .25s cubic-bezier(.2,.8,.2,1)' }}>
        <div className="wa-force-dark flex items-center justify-between rounded-t-[18px] px-6 py-4 text-white" style={{ background: 'linear-gradient(105deg,#142647 0%,#1d3c7a 52%,#2c6fe6 100%)' }}>
          <h3 className="text-[15px] font-bold">{step === 'amount' ? '항해 시작' : '구매 확인'} · {p.name}</h3>
          <button onClick={onClose} aria-label="닫기" className="flex h-8 w-8 items-center justify-center rounded-lg text-[15px]" style={{ border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.08)' }}><span aria-hidden>✕</span></button>
        </div>
        {/* 단계 표시 */}
        <div className="flex items-center gap-2 px-6 pt-3.5 text-[11px] font-semibold">
          <span style={{ color: step === 'amount' ? SONAR : INK3 }}>① 금액 입력</span>
          <span style={{ color: INK3 }}>→</span>
          <span style={{ color: step === 'confirm' ? SONAR : INK3 }}>② 구매 확인</span>
        </div>
        {step === 'amount' ? (
          <>
            <div className="flex flex-col gap-3 p-6 pt-3">
              <div className="flex items-center justify-between text-[12.5px]"><span style={{ color: INK2 }}>보유 잔고 (VIRT)</span><span className="font-mono font-semibold">{cash != null ? fmtKRW(cash) : '…'}</span></div>
              <div>
                <div className="mb-1.5 text-[11.5px] font-semibold" style={{ color: INK2 }}>투자 금액</div>
                <input value={amount} onChange={e => { const v = e.target.value.replace(/[^\d]/g, ''); setAmount(v ? Number(v).toLocaleString('ko-KR') : ''); }} placeholder="₩ 투자할 금액" inputMode="numeric" className="w-full rounded-lg px-3.5 py-2.5 text-right font-mono text-[15px] font-semibold outline-none" style={fieldStyle} />
                <div className="mt-2 grid grid-cols-4 gap-1.5">{QUICK.map(v => <button key={v} onClick={() => setAmount(v.toLocaleString('ko-KR'))} className="rounded-md py-1.5 text-[11.5px] font-semibold" style={{ border: `1px solid ${HAIR}`, background: CARD, color: INK1 }}>{(v / 10000).toLocaleString('ko-KR')}만</button>)}</div>
                {cash != null && <button onClick={() => setAmount(Math.floor(cash).toLocaleString('ko-KR'))} className="mt-1.5 text-[11.5px] font-semibold" style={{ color: SONAR }}>전액 ({fmtKRW(cash)})</button>}
              </div>
              {over && <div className="rounded-lg px-3 py-2 text-[12px]" style={{ background: 'rgba(239,77,77,.1)', border: '1px solid rgba(239,77,77,.25)', color: '#fca5a5' }}>잔고가 부족합니다.</div>}
              <p className="text-[11px]" style={{ color: INK3 }}>입력한 금액으로 상품의 대상 자산을 비중대로 매수해 모의 자동 운용을 시작합니다.</p>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4" style={{ borderTop: `1px solid ${HAIR}` }}>
              <button onClick={onClose} className="rounded-lg px-4 py-2.5 text-[13px] font-semibold" style={{ border: `1px solid ${HAIR}`, color: INK1 }}>취소</button>
              <button onClick={() => setStep('confirm')} disabled={!canNext} className="rounded-lg px-5 py-2.5 text-[13.5px] font-bold text-white disabled:opacity-50" style={{ background: `linear-gradient(180deg, ${SONAR}, #2c6fe6)` }}>다음 →</button>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-3 p-6 pt-3">
              <p className="m-0 text-[13px] leading-relaxed" style={{ color: INK1 }}>아래 내용으로 <span style={{ color: 'var(--ci-ink0)', fontWeight: 700 }}>모의 자동 운용</span>을 시작합니다. 맞나요?</p>
              <dl className="m-0 grid gap-2.5 rounded-xl px-4 py-3.5 text-[13px]" style={{ background: CARD, border: `1px solid ${HAIR}` }}>
                <div className="flex justify-between"><dt style={{ color: INK2 }}>상품</dt><dd className="m-0 font-semibold">{p.name}</dd></div>
                <div className="flex justify-between"><dt style={{ color: INK2 }}>투자 금액</dt><dd className="m-0 font-mono font-bold" style={{ color: 'var(--ci-ink0)' }}>{fmtKRW(num)}</dd></div>
                <div className="flex justify-between"><dt style={{ color: INK2 }}>대상 자산</dt><dd className="m-0 font-semibold">{p.targetAssets?.length || 0}개 종목 분산</dd></div>
                <div className="flex justify-between"><dt style={{ color: INK2 }}>리스크</dt><dd className="m-0 font-semibold" style={{ color: RISK_TAG[p.riskLevel].color }}>{RISK_LABELS[p.riskLevel]}</dd></div>
                <div className="flex justify-between" style={{ borderTop: `1px solid ${HAIR}`, paddingTop: 8 }}><dt style={{ color: INK2 }}>매수 후 잔고</dt><dd className="m-0 font-mono font-semibold">{cash != null ? fmtKRW(cash - num) : '—'}</dd></div>
              </dl>
              <p className="text-[11px]" style={{ color: INK3 }}>* 실제 자금이 아닌 모의투자(₩) 계좌에서 시장가로 매수됩니다.</p>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4" style={{ borderTop: `1px solid ${HAIR}` }}>
              <button onClick={() => setStep('amount')} disabled={busy} className="rounded-lg px-4 py-2.5 text-[13px] font-semibold" style={{ border: `1px solid ${HAIR}`, color: INK1 }}>← 뒤로</button>
              <button onClick={() => onConfirm(num)} disabled={busy || !canNext} className="rounded-lg px-5 py-2.5 text-[13.5px] font-bold text-white disabled:opacity-50" style={{ background: `linear-gradient(180deg, ${SONAR}, #2c6fe6)` }}>{busy ? '구매 중…' : '구매 확정'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const Toast = ({ msg }: { msg: string }) => (
  <div className="fixed bottom-6 left-1/2 z-[130] -translate-x-1/2 rounded-xl px-5 py-3 text-[13px] font-semibold text-white" style={{ background: 'linear-gradient(180deg,#2f9e6e,#1f7d57)', boxShadow: '0 14px 32px -10px rgba(0,0,0,.55)', animation: 'message-in .25s ease' }}>{msg}</div>
);

const ConsoleLearnPage = () => {
  const { session } = useAuth();
  const { isVirt } = useRoutePrefix();
  const navigate = useNavigate();
  const userName = session?.user?.email ? session.user.email.split('@')[0] : '항해사';

  const [cat, setCat] = useState('all');
  const [products, setProducts] = useState<QuantProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  // 관리형(터틀) 상품 구매 상태
  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set());
  const [purchases, setPurchases] = useState<ProductPurchase[]>([]);
  const [perf, setPerf] = useState<PurchasePerformance[]>([]);
  const [invest, setInvest] = useState<QuantProduct | null>(null);
  const [cash, setCash] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState<{ run: () => Promise<void> } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const showToast = useCallback((m: string) => { setToast(m); if (toastTimer.current) clearTimeout(toastTimer.current); toastTimer.current = window.setTimeout(() => setToast(null), 2800); }, []);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  useEffect(() => {
    setLoading(true);
    quantStoreService.getProducts(cat === 'all' ? undefined : (cat as any))
      .then(ps => { setProducts(ps); setError(null); })
      .catch(() => setError('전략 상품을 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, [cat]);

  const loadMine = useCallback(() => {
    quantStoreService.getMyPurchases().then(r => { setPurchasedIds(new Set(r.purchasedProductIds)); setPurchases(r.purchases || []); }).catch(() => {});
    quantStoreService.getMyPurchasesPerformance().then(setPerf).catch(() => {});
  }, []);
  useEffect(() => { loadMine(); }, [loadMine]);

  // DIY 신호전략: 학습 → 백테스트 퍼널 (그 전략 로드 → 검증 → 자동매매)
  const runBacktest = (p: QuantProduct) => { const id = presetFor(p); navigate(id ? `/virt/strategy?strategy=${id}` : '/virt/strategy'); };
  // 관리형(터틀) 상품: 구매 → 자동 운용
  const startInvest = (p: QuantProduct) => {
    setInvest(p); setOpenId(null); setCash(null);
    tradeService.getPortfolio().then(pf => setCash(pf.cashBalance)).catch(() => setCash(null));
  };
  const confirmInvest = async (amount: number) => {
    if (!invest) return;
    setBusy(true);
    try {
      await quantStoreService.purchaseProduct(invest.id, amount);
      showToast(`'${invest.name}' 자동 운용을 시작했습니다.`);
      setInvest(null); loadMine();
    } catch (e: any) { showToast(e?.response?.data?.message || '구매에 실패했습니다.'); }
    finally { setBusy(false); }
  };
  const cancelByProduct = (productId: string) => {
    const pur = purchases.find(x => x.productId === productId && x.status === 'ACTIVE');
    if (!pur) { showToast('보유 정보를 찾을 수 없습니다.'); return; }
    setConfirmCancel({ run: async () => {
      try { await quantStoreService.cancelPurchase(pur.id); showToast('운용을 종료했습니다.'); setOpenId(null); loadMine(); }
      catch (e: any) { showToast(e?.response?.data?.message || '취소에 실패했습니다.'); }
    } });
  };
  const cancelByPurchaseId = (purchaseId: string) => {
    setConfirmCancel({ run: async () => {
      try { await quantStoreService.cancelPurchase(purchaseId); showToast('운용을 종료했습니다.'); loadMine(); }
      catch (e: any) { showToast(e?.response?.data?.message || '취소에 실패했습니다.'); }
    } });
  };

  // 노출: 관리형(터틀) + DIY 신호전략(프리셋 매핑). 비신호 일회성매수형은 숨김.
  const shown = products.filter(p => isManaged(p) || presetFor(p) != null);
  const open = shown.find(p => p.id === openId) || null;

  return (
    <HelmShell active="learn" virt={isVirt} userName={userName} session="전략 학습 & 백테스트">
      <div className="mx-auto flex max-w-[1560px] flex-col gap-5">
        <div className="flex items-center gap-3">
          <WhaleAvatar size={40} animated />
          <div><h1 className="text-[26px] font-bold tracking-tight">전략 가이드</h1><p className="mt-1.5 text-[13.5px]" style={{ color: INK1 }}>고래 튜터가 전략을 쉽게 설명해드려요. 마음에 들면 <b style={{ color: INK0 }}>VIRT로 돌려보기</b>로 백테스트해 검증하고, 자동매매까지 이어가보세요.</p></div>
        </div>
        {/* 자동 운용 중(관리형 상품 보유) */}
        {perf.length > 0 && (
          <div className="flex flex-col gap-3" style={{ ...panel, background: 'linear-gradient(135deg, rgba(91,157,255,.12), rgba(91,157,255,.02) 60%, transparent)', border: '1px solid rgba(91,157,255,.28)', padding: '20px 24px' }}>
            <div className="text-[10.5px] font-semibold tracking-[.18em]" style={{ color: SONAR }}>ACTIVE ROUTES · 자동 운용 중</div>
            {perf.map(pp => { const up = pp.totalReturnRate >= 0; return (
              <div key={pp.purchaseId} className="flex flex-wrap items-center justify-between gap-4 rounded-xl px-4 py-3" style={{ background: CARD, border: `1px solid ${HAIR}` }}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><span className="text-[15px] font-bold">{pp.productName}</span><span className="inline-flex items-center gap-1.5 rounded-[5px] px-2 py-0.5 text-[11px] font-bold" style={{ background: 'rgba(63,214,160,.14)', color: '#3fd6a0', border: '1px solid rgba(63,214,160,.28)' }}><span className="h-[5px] w-[5px] rounded-full animate-pulse-dot" style={{ background: '#3fd6a0' }} />운용 중</span></div>
                  <div className="mt-1 text-[12.5px]" style={{ color: INK1 }}>투자 <span className="font-mono font-semibold" style={{ color: INK0 }}>{fmtKRW(pp.investmentAmount)}</span><span className="mx-2" style={{ color: INK3 }}>·</span>평가 <span className="font-mono font-semibold" style={{ color: INK0 }}>{fmtKRW(pp.totalCurrentValue)}</span></div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right"><div className="font-mono text-[18px] font-bold" style={{ color: up ? UP : DOWN }}>{up ? '+' : ''}{pp.totalReturnRate.toFixed(2)}%</div><div className="font-mono text-[11.5px]" style={{ color: up ? UP : DOWN }}>{up ? '+' : ''}{fmtKRW(pp.totalPnl)}</div></div>
                  <button onClick={() => cancelByPurchaseId(pp.purchaseId)} className="rounded-[9px] px-[14px] py-2 text-[12.5px] font-semibold" style={{ border: '1px solid rgba(77,138,255,.32)', background: 'rgba(77,138,255,.08)', color: DOWN }}>운용 종료</button>
                </div>
              </div>
            ); })}
          </div>
        )}
        {/* 카테고리 */}
        <div className="flex flex-wrap gap-1.5">
          {CATS.map(([k, l]) => { const on = k === cat; return <button key={k} onClick={() => setCat(k)} className="whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-semibold" style={{ border: on ? '1px solid rgba(91,157,255,.35)' : `1px solid ${HAIR}`, background: on ? SONAR_DIM : CARD, color: on ? SONAR : INK1 }}>{l}</button>; })}
        </div>
        {/* 카드 그리드 — 백테스트 가능한 신호형 전략만 */}
        {loading ? <div style={{ ...panel, padding: 48, textAlign: 'center' }}><span className="text-[13px]" style={{ color: INK3 }}>전략을 불러오는 중…</span></div>
          : error ? <div style={{ ...panel, padding: 36, textAlign: 'center' }}><div className="text-[13px]" style={{ color: INK2 }}>{error}</div><button onClick={() => setCat(c => c)} className="mt-3 rounded-lg px-4 py-2 text-[12.5px] font-semibold" style={{ border: `1px solid ${HAIR_S}`, color: SONAR }}>다시 시도</button></div>
            : shown.length === 0 ? <div style={{ ...panel, padding: 48, textAlign: 'center' }}><div className="text-[28px]">🧭</div><div className="mt-2 text-[14px] font-semibold">해당 카테고리의 전략이 아직 없어요.</div></div>
              : <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
                  {shown.map(p => <Card key={p.id} p={p} purchased={purchasedIds.has(p.id)} onOpen={() => setOpenId(p.id)} onRun={() => runBacktest(p)} onBuy={() => startInvest(p)} />)}
                </div>}
      </div>
      {open && <ProductModal p={open} purchased={purchasedIds.has(open.id)} onClose={() => setOpenId(null)} onRun={() => runBacktest(open)} onBuy={() => startInvest(open)} onCancel={() => cancelByProduct(open.id)} />}
      {invest && <InvestModal p={invest} cash={cash} busy={busy} onClose={() => setInvest(null)} onConfirm={confirmInvest} />}
      {confirmCancel && (
        <div onClick={() => setConfirmCancel(null)} className="fixed inset-0 z-[120] flex items-center justify-center px-6" style={{ background: 'rgba(6,11,31,.78)', backdropFilter: 'blur(6px)', animation: 'backdrop-in .2s ease' }}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-[380px] rounded-[18px] p-6" style={{ background: 'var(--ci-overlay)', border: `1px solid ${HAIR_S}`, boxShadow: 'var(--ci-panel-shadow)', animation: 'modal-in .25s cubic-bezier(.2,.8,.2,1)' }}>
            <h3 className="text-[16px] font-bold">운용을 종료할까요?</h3>
            <p className="mt-2 text-[13px] leading-relaxed" style={{ color: INK1 }}>이 상품으로 매수한 모의 자산이 정리되고 현금으로 환원됩니다. 되돌릴 수 없어요.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setConfirmCancel(null)} className="rounded-lg px-4 py-2.5 text-[13px] font-semibold" style={{ border: `1px solid ${HAIR}`, color: INK1 }}>유지하기</button>
              <button onClick={() => { const c = confirmCancel; setConfirmCancel(null); c.run(); }} className="rounded-lg px-4 py-2.5 text-[13px] font-bold text-white" style={{ background: 'linear-gradient(180deg,#e0524f,#c23b38)' }}>운용 종료</button>
            </div>
          </div>
        </div>
      )}
      {toast && <Toast msg={toast} />}
    </HelmShell>
  );
};

export default ConsoleLearnPage;
