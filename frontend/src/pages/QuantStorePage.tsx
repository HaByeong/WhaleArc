import { useState, useEffect } from 'react';
import { useVirtNavigate, useRoutePrefix } from '../hooks/useRoutePrefix';
import Header from '../components/Header';
import SplashLoading from '../components/SplashLoading';
import VirtSplashLoading from '../components/VirtSplashLoading';
import { Term } from '../components/TermTooltip';
import WhaleCharacterLogo from '../components/WhaleCharacterLogo';
import {
  quantStoreService,
  type QuantProduct,
  type ProductPurchase,
  type Category,
  CATEGORY_LABELS,
  cryptoDisplayName,
  assetDisplayName,
  formatQuantity,
} from '../services/quantStoreService';

// ═══════════════════════════════════════
//  교육 콘텐츠 데이터
// ═══════════════════════════════════════

interface StrategyEdu {
  simpleExplain: string;
  analogy: string;
  howItWorks: string[];
  risk: string;
  bestFor: string;
}

const DIFFICULTY_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
  LOW: { label: '초급', color: 'bg-emerald-100 text-emerald-700', emoji: '🌱' },
  MEDIUM: { label: '중급', color: 'bg-amber-100 text-amber-700', emoji: '🌿' },
  HIGH: { label: '고급', color: 'bg-rose-100 text-rose-700', emoji: '🌳' },
};

const CATEGORY_WHALE: Record<string, { image: string; name: string }> = {
  TREND_FOLLOWING: { image: '/whales/humpback.png', name: '' },
  MOMENTUM: { image: '/whales/orca.png', name: '' },
  MEAN_REVERSION: { image: '/whales/risso-dolphin.png', name: '' },
  VOLATILITY: { image: '/whales/wild-cat-whale.png', name: '' },
  ARBITRAGE: { image: '/whales/beluga.png', name: '' },
  MULTI_FACTOR: { image: '/whales/sperm-whale.png', name: '' },
};

const CATEGORY_SIMPLE: Record<string, string> = {
  TREND_FOLLOWING: '가격의 흐름을 따라가는 전략',
  MOMENTUM: '잘 나가는 종목에 올라타는 전략',
  MEAN_REVERSION: '가격이 평균으로 돌아오는 성질을 이용하는 전략',
  VOLATILITY: '가격 변동을 이용해 수익을 내는 전략',
  ARBITRAGE: '가격 차이를 이용해 안전하게 수익을 내는 전략',
  MULTI_FACTOR: '여러 조건을 종합적으로 분석하는 전략',
};

/** 전략 이름 키워드로 교육 콘텐츠 매칭 */
function getStrategyEducation(name: string): StrategyEdu {
  if (name.includes('골든크로스')) return {
    simpleExplain: '단기 이동평균선(20일)이 장기 이동평균선(60일)을 아래에서 위로 뚫고 올라갈 때 매수하는 추세추종 전략입니다. 가장 널리 사용되는 기술적 분석 기법 중 하나로, 상승 추세의 시작을 포착하는 데 효과적입니다.',
    analogy: '마라톤에서 뒤처졌던 선수(단기 평균)가 앞 선수(장기 평균)를 추월하는 순간을 포착하는 것과 같습니다. 추월에 성공하면 그 기세로 계속 앞서갈 확률이 높듯, 단기 평균이 장기 평균 위로 올라서면 상승세가 이어질 가능성이 높습니다.',
    howItWorks: [
      '매일 20일 평균 가격(단기)과 60일 평균 가격(장기)을 계산합니다',
      '20일선이 60일선을 아래에서 위로 돌파(골든크로스) → 상승 추세 시작 → 매수합니다',
      '반대로 20일선이 60일선 아래로 내려가면(데드크로스) → 하락 추세 전환 → 매도합니다',
      '이동평균 기간이 길수록(예: 50일/200일) 신호가 드물지만 신뢰도가 높아집니다',
    ],
    risk: '횡보장(가격이 오르락내리락 반복)에서는 골든크로스와 데드크로스가 번갈아 발생하면서 잦은 손절로 이어질 수 있습니다. 또한 이동평균은 과거 데이터를 기반으로 하기 때문에 신호가 늦게 나타나는 "후행성"이 있어, 이미 상당 부분 오른 후에 매수 신호가 발생할 수 있습니다.',
    bestFor: '투자를 처음 시작하는 분에게 가장 추천하는 전략입니다. 규칙이 단순하고 명확하며, 큰 추세를 놓치지 않는 장점이 있습니다. 잦은 매매보다 중장기 보유를 선호하는 분에게 적합합니다.',
  };

  if (name.includes('RSI') && name.includes('반전')) return {
    simpleExplain: 'RSI(상대강도지수)라는 지표로 "너무 싸졌을 때(과매도)" 매수하고 "너무 비싸졌을 때(과매수)" 매도하는 평균회귀 전략입니다. 시장의 과열/냉각 상태를 수치로 판단하여 역발상 투자를 합니다.',
    analogy: '고무줄을 생각해보세요. 한쪽으로 너무 많이 당기면 반드시 반대쪽으로 튕기죠. 가격도 마찬가지로, 너무 급격히 올랐으면 조정이 오고, 너무 급격히 내렸으면 반등이 옵니다. RSI는 이 "당겨진 정도"를 0~100 숫자로 정확히 측정합니다.',
    howItWorks: [
      'RSI는 최근 14일간 상승폭과 하락폭을 비교하여 0~100 사이 숫자로 변환합니다',
      'RSI가 30 이하로 떨어지면 → 과매도(너무 많이 내림) 구간 → 반등을 기대하고 매수합니다',
      'RSI가 70 이상으로 올라가면 → 과매수(너무 많이 오름) 구간 → 조정을 예상하고 매도합니다',
      '중립 구간(30~70)에서는 관망하며, RSI가 50 위에 있으면 전반적으로 상승세, 아래면 하락세로 판단합니다',
    ],
    risk: '강한 추세 장세에서는 RSI가 과매도(30 이하)에 진입해도 가격이 계속 떨어질 수 있습니다. 이를 "떨어지는 칼날을 잡는다"고 표현하는데, 반등 없이 폭락이 이어지면 큰 손실로 이어집니다. 반드시 손절 라인을 설정하고, 분할 매수(나눠서 사기)를 활용하는 것이 안전합니다.',
    bestFor: '단기 매매(스윙 트레이딩)에 관심 있는 분, 숫자와 데이터 기반의 체계적인 매매를 좋아하는 분에게 적합합니다. 시장이 급락할 때 저가 매수 기회를 찾고 싶은 분에게 특히 유용합니다.',
  };

  if (name.includes('볼린저')) return {
    simpleExplain: '볼린저 밴드는 가격의 "정상 범위"를 상단·하단 밴드로 시각화하는 도구입니다. 이 전략은 밴드가 좁아졌다가(스퀴즈) 가격이 밴드를 돌파하는 순간에 진입하여 큰 움직임에 올라타는 변동성 돌파 전략입니다.',
    analogy: '압력밥솥을 생각해보세요. 오랫동안 열을 가하면서 압력이 쌓이면 뚜껑을 열 때 "펑!" 하고 터집니다. 볼린저 밴드도 마찬가지로, 밴드가 좁아지는 구간(스퀴즈)은 에너지가 축적되는 시기이고, 밴드 돌파 시 축적된 에너지가 한꺼번에 방출되면서 큰 가격 움직임이 나타납니다.',
    howItWorks: [
      '볼린저 밴드는 20일 이동평균선 위아래로 표준편차 2배 거리에 상단/하단 밴드를 그립니다',
      '밴드 폭이 좁아지는 "스퀴즈" 구간을 찾습니다 — 이는 곧 큰 변동이 올 신호입니다',
      '가격이 상단 밴드(%B > 1)를 돌파하면 → 강한 상승 에너지로 매수합니다',
      '가격이 하단 밴드(%B < 0) 아래로 이탈하면 → 상승 에너지 소진으로 매도합니다',
      '밴드 폭이 넓은 구간에서는 신호를 무시합니다 — 이미 변동이 진행 중인 상태이기 때문입니다',
    ],
    risk: '가짜 돌파(false breakout)가 가장 큰 위험입니다. 가격이 밴드를 잠깐 벗어났다가 바로 다시 안으로 들어오면 손실이 발생합니다. 또한 어느 방향으로 돌파할지 미리 알 수 없어, 하단 돌파(하락) 시 매수하면 큰 손실을 볼 수 있습니다. 거래량 확인과 함께 사용하면 가짜 돌파를 어느 정도 걸러낼 수 있습니다.',
    bestFor: '큰 시세 움직임을 기다릴 수 있는 인내심 있는 분에게 적합합니다. 잦은 매매보다 적은 횟수로 큰 수익을 노리는 스타일, 그리고 차트의 밴드 패턴을 읽는 것에 흥미가 있는 분께 추천합니다.',
  };

  if (name.includes('리밸런싱') || name.includes('안전')) return {
    simpleExplain: '비트코인(BTC), 이더리움(ETH), 스테이블코인(USDT)을 정해진 비율(60:30:10)로 분산 투자하고, 주기적으로 비율을 원래대로 맞춰주는 보수적 전략입니다. "달걀을 한 바구니에 담지 마라"는 분산투자의 원칙을 따릅니다.',
    analogy: '피자를 6:3:1로 나눠 먹기로 약속했는데, 시간이 지나 누군가 더 많이 먹어서 비율이 틀어지면 다시 원래 비율로 맞추는 것과 같습니다. 이 과정에서 자연스럽게 "많이 오른 건 일부 팔고, 많이 내린 건 추가 매수"하는 효과가 생깁니다.',
    howItWorks: [
      'BTC 60%, ETH 30%, USDT(현금성 자산) 10% — 목표 비율을 설정합니다',
      '매주 현재 자산 비율을 확인합니다. 예: BTC가 많이 올라 70%가 되었다면 비율이 틀어진 상태',
      'BTC를 일부 매도하고 ETH/USDT를 매수하여 원래 비율(60:30:10)로 복원합니다',
      'USDT 10%는 급락 시 추가 매수 여력으로 활용되는 안전 자산 역할을 합니다',
      '이 과정이 반복되면 자동으로 "고가 매도, 저가 매수" 효과가 발생합니다',
    ],
    risk: '특정 자산이 로켓처럼 급등할 때, 리밸런싱 때문에 비중을 줄이게 되어 최대 수익을 놓칠 수 있습니다. 예를 들어 BTC가 2배 오르면 자동으로 BTC를 팔게 되므로, 추가 상승분을 놓치게 됩니다. 하지만 반대로 급락 시에는 손실이 제한되는 장점이 있어, 장기적으로 안정적인 수익을 기대할 수 있습니다.',
    bestFor: '투자 초보자에게 가장 추천하는 전략입니다. 안정적이고 꾸준한 수익을 원하는 분, 매일 시장을 확인하기 어려운 직장인, 큰 손실 없이 장기 투자를 하고 싶은 분에게 적합합니다. 가장 낮은 위험도의 전략입니다.',
  };

  if (name.includes('모멘텀 스코어') || name.includes('모멘텀') && !name.includes('듀얼')) return {
    simpleExplain: '최근 일정 기간 동안 가장 많이 오른(가장 강한 모멘텀을 가진) 종목을 찾아서 투자하는 전략입니다. "잘 나가는 종목은 계속 잘 나간다"는 모멘텀 효과를 활용합니다.',
    analogy: '스키 활강 선수가 가장 가파른 경사면을 타고 내려올 때 속도가 가장 빠르듯, 상승 기울기가 가장 가파른 종목에 올라타면 수익도 빠르게 늘어납니다. 이미 달리고 있는 기차에 올라타는 것과 비슷하지만, 기차가 언제 멈출지 항상 주의해야 합니다.',
    howItWorks: [
      '7일, 30일, 90일 수익률을 각각 계산한 후 가중 평균으로 "모멘텀 스코어"를 산출합니다',
      '여러 종목의 모멘텀 스코어를 비교하여 가장 높은 종목을 선택합니다',
      '일정 주기(보통 1~2주)마다 순위를 다시 매기고, 순위가 바뀌면 종목을 교체합니다',
      '모멘텀 스코어가 음수(하락세)인 종목은 아무리 순위가 높아도 투자하지 않습니다',
    ],
    risk: '가장 큰 위험은 "고점 물림"입니다. 이미 크게 오른 후에 올라타면, 상승세가 끝나는 시점에 매수하게 되어 급락에 휘말릴 수 있습니다. 또한 시장 전체가 하락하는 약세장에서는 모멘텀 전략이 효과가 크게 떨어집니다. 시장 전체 추세도 함께 확인하는 것이 중요합니다.',
    bestFor: '적극적으로 시장에 참여하고 싶은 분, 상승세를 놓치기 싫은 분에게 적합합니다. 정기적으로 포트폴리오를 점검할 수 있는 분, 그리고 일정한 손절 규칙을 지킬 수 있는 분께 추천합니다.',
  };

  if (name.includes('김프') || name.includes('차익거래')) return {
    simpleExplain: '같은 암호화폐가 국내 거래소와 해외 거래소에서 서로 다른 가격에 거래되는 "김치 프리미엄(김프)" 현상을 이용하여 안정적인 수익을 추구하는 전략입니다. 방향성 리스크가 거의 없어 가장 안전한 전략 중 하나입니다.',
    analogy: '같은 브랜드의 운동화가 미국에서 10만원, 한국에서 12만원에 팔리고 있다면? 미국에서 사서 한국에서 파는 것만으로 2만원 차익을 얻을 수 있습니다. 김프 차익거래도 동일한 원리로, 싼 곳에서 사고 비싼 곳에서 팔아 가격 차이만큼 수익을 냅니다.',
    howItWorks: [
      '국내 거래소(빗썸 등)와 해외 거래소(바이낸스 등)의 가격을 실시간으로 비교합니다',
      '김프(국내가 비싼 정도)가 일정 수준(예: 3~5%) 이상이면 해외에서 매수, 국내에서 매도합니다',
      '역김프(국내가 싼 경우) 발생 시 반대로 진행합니다',
      '가격 차이가 줄어들면 양쪽 포지션을 청산하여 수익을 확정합니다',
      '환율 변동, 송금 수수료, 체결 시간차를 정밀하게 계산하여 실제 수익을 산정합니다',
    ],
    risk: '환율이 급변하면 수익이 줄거나 손실이 발생할 수 있습니다. 또한 암호화폐 송금에 시간이 걸리는데, 그 사이 가격이 변하면 예상 수익이 사라질 수 있습니다. 거래 수수료와 출금 수수료를 모두 고려해야 하며, 최소 투자금이 크지 않으면 수수료 대비 수익이 미미할 수 있습니다.',
    bestFor: '안정적이고 예측 가능한 수익을 원하는 분, 시장 방향에 관계없이 수익을 내고 싶은 분에게 적합합니다. 환율과 거래소 구조를 이해하고 있는 분, 비교적 큰 투자금으로 안정적인 수익률을 추구하는 분께 추천합니다.',
  };

  if (name.includes('MACD')) return {
    simpleExplain: 'MACD(이동평균 수렴확산)는 단기 이동평균과 장기 이동평균의 차이를 분석하여 추세 전환 시점을 포착하는 지표입니다. 이 전략은 특히 가격과 MACD가 서로 반대로 움직이는 "다이버전스" 현상을 활용하여 추세 반전을 미리 감지합니다.',
    analogy: '공을 바닥에 세게 던지면 높이 튀어오르고, 다시 던져도 점점 약하게 튀죠. 가격도 마찬가지입니다. 가격은 계속 신고가를 갱신하는데 MACD의 힘은 점점 약해진다면? 그건 상승 에너지가 소진되고 있다는 신호입니다. 곧 방향이 바뀔 수 있죠.',
    howItWorks: [
      'MACD선 = 12일 EMA(지수이동평균) - 26일 EMA. 두 이동평균의 차이로 추세의 힘을 측정합니다',
      '시그널선 = MACD선의 9일 EMA. MACD의 평균값으로, 교차점이 매매 타이밍이 됩니다',
      'MACD선이 시그널선을 위로 돌파(골든크로스) → 매수 신호',
      'MACD선이 시그널선을 아래로 돌파(데드크로스) → 매도 신호',
      '다이버전스: 가격은 하락하는데 MACD는 상승하면 → 곧 반등 가능성 → 강한 매수 신호',
    ],
    risk: '다이버전스가 나타나도 추세가 예상보다 오래 지속될 수 있습니다. "시장은 당신이 버틸 수 있는 것보다 더 오래 비합리적일 수 있다"는 격언처럼, 신호가 나타났다고 바로 진입하면 추가 하락에 노출될 수 있습니다. MACD 단독보다 RSI나 거래량 등 다른 지표와 함께 사용하면 신뢰도가 높아집니다.',
    bestFor: '차트 분석에 관심이 있고 추세의 전환점을 잡고 싶은 분에게 적합합니다. 골든크로스 전략보다 조금 더 심화된 기술적 분석을 배우고 싶은 중급 투자자, RSI와 함께 복합적으로 활용하고 싶은 분께 추천합니다.',
  };

  if (name.includes('래리 코너스') || name.includes('RSI(2)')) return {
    simpleExplain: '래리 코너스가 개발한 전략으로, 일반 RSI(14일)보다 훨씬 짧은 2일 RSI를 사용하여 극도로 짧은 가격 반등을 포착합니다. 상승 추세인 종목에서 일시적으로 급락한 순간을 노려 빠르게 매수하고, 반등 시 바로 매도하는 단기 매매 전략입니다.',
    analogy: '서핑에서 작은 파도를 빠르게 타고 내리는 것과 비슷합니다. 큰 파도(장기 상승 추세)를 기다리면서, 그 위에서 발생하는 작은 파도(단기 하락 후 반등)를 재빠르게 잡아 수익을 냅니다. 속도가 생명인 전략이죠.',
    howItWorks: [
      '200일 이동평균 위에 있는 종목만 선별합니다 (장기 상승 추세 확인 — 큰 파도)',
      'RSI(2)를 계산합니다. 일반 RSI(14일)보다 훨씬 민감하게 반응하는 초단기 지표입니다',
      'RSI(2)가 5 이하로 급락하면 → 단기 과매도 → 즉시 매수합니다',
      'RSI(2)가 다시 60 이상으로 회복되면 → 매도하여 수익을 확정합니다',
      '보유 기간이 보통 2~5일로 매우 짧습니다. 빠른 진입과 빠른 청산이 핵심입니다',
    ],
    risk: '매매 횟수가 매우 많아 거래 수수료가 누적되면 수익을 상당 부분 잠식할 수 있습니다. 또한 RSI(2)가 5 이하로 떨어졌다고 반드시 반등하는 것이 아니라, 악재로 인한 본격적인 하락의 시작일 수도 있습니다. 200일선 아래로 떨어지면 즉시 손절하는 규칙을 반드시 지켜야 합니다.',
    bestFor: '빠른 매매를 즐기고 매일 시장을 확인할 수 있는 분, 수학적 규칙에 따른 기계적 매매를 선호하는 분에게 적합합니다. 거래 수수료가 낮은 거래소를 이용하는 것이 중요합니다.',
  };

  if (name.includes('래리 윌리엄스') || name.includes('변동성 돌파')) return {
    simpleExplain: '전설적인 트레이더 래리 윌리엄스가 1987년 세계 선물 트레이딩 챔피언십에서 11,376%의 수익률로 우승할 때 사용한 전략입니다. 전날의 가격 변동폭을 기준으로, 오늘 가격이 일정 비율 이상 올라가면 즉시 매수합니다.',
    analogy: '어제 파도가 1미터 높이였다면, 오늘 파도가 0.5미터(50%) 이상 올라오는 순간 서핑보드에 올라타는 것입니다. 전날의 변동폭이 오늘 움직임의 기준이 되는 셈이죠. "오늘의 에너지가 어제보다 강하면 올라타라"는 논리입니다.',
    howItWorks: [
      '전날의 변동폭을 계산합니다: 고가 - 저가 = 레인지(Range)',
      '오늘의 매수 기준가를 설정합니다: 오늘 시가 + (레인지 × k). k는 보통 0.4~0.6 사이 값을 사용합니다',
      '오늘 가격이 매수 기준가를 돌파하면 → 즉시 매수합니다',
      '다음 날 시가에 무조건 매도합니다 (1일 보유 원칙)',
      'k 값이 작을수록 매매 횟수가 많고, 클수록 신호가 정확하지만 기회가 줄어듭니다',
    ],
    risk: '매일 매매가 발생하므로 거래 수수료가 꾸준히 쌓입니다. 횡보장(가격이 일정 범위에서 왔다 갔다)에서는 돌파 신호가 거짓인 경우가 많아 연속 손실이 발생할 수 있습니다. k 값을 시장 상황에 맞게 조절하는 것이 중요하며, 하락장에서는 전략을 쉬는 것도 방법입니다.',
    bestFor: '매일 적극적으로 매매하고 싶은 분, 체계적이고 규칙적인 데이 트레이딩을 원하는 분에게 적합합니다. 시장을 매일 모니터링할 수 있는 환경이 필요하며, 백테스트로 최적의 k 값을 찾는 과정이 중요합니다.',
  };

  if (name.includes('듀얼 모멘텀')) return {
    simpleExplain: '게리 안토나치가 개발한 듀얼 모멘텀은 "절대 모멘텀"과 "상대 모멘텀" 두 가지 필터를 동시에 적용하는 전략입니다. 자산이 오르고 있는지(절대), 다른 자산보다 더 잘 오르고 있는지(상대)를 모두 확인한 후에만 투자합니다.',
    analogy: '취업할 때 두 가지를 확인하는 것과 같습니다. 첫째, 이 회사가 성장하고 있는가?(절대 모멘텀) 둘째, 같은 업종 다른 회사보다 더 잘 성장하고 있는가?(상대 모멘텀) 두 조건을 모두 만족하는 회사에만 지원하는 거죠.',
    howItWorks: [
      '절대 모멘텀 확인: 지난 12개월 수익률이 0% 이상인가? → 상승 추세인지 판단합니다',
      '상대 모멘텀 확인: 여러 자산(BTC, ETH 등) 중 수익률이 가장 높은 자산은? → 가장 강한 자산을 선택합니다',
      '두 조건을 모두 만족하는 자산에 집중 투자합니다',
      '절대 모멘텀이 음수(하락세)이면 → 어떤 자산도 매수하지 않고 현금(USDT)으로 보유합니다',
      '매월 1회 리뷰하며 종목을 교체합니다',
    ],
    risk: '추세 전환 시점에 후행적으로 반응하기 때문에, 갑작스러운 급락 시 초반 5~15% 정도의 손실을 피하기 어렵습니다. 또한 월 1회 리밸런싱이므로 월 중간에 추세가 바뀌면 대응이 늦을 수 있습니다. 하지만 하락장에서 현금 비중을 높이는 구조 덕분에 MDD(최대 낙폭)가 단순 매수보유 대비 크게 낮습니다.',
    bestFor: '체계적이고 규칙적인 투자를 원하면서도 하락장 방어가 필요한 분에게 적합합니다. 월 1회 정도만 포트폴리오를 관리할 수 있는 바쁜 분, 장기적으로 안정적인 복리 수익을 추구하는 분께 추천합니다.',
  };

  if (name.includes('미너비니') || name.includes('트렌드 템플릿')) return {
    simpleExplain: '미국 투자 챔피언 마크 미너비니의 트렌드 템플릿 전략입니다. 강한 상승 추세에 있으면서 일시적으로 변동성이 줄어드는(압축되는) 종목을 찾아, 다시 폭발하는 순간에 진입하는 고급 전략입니다.',
    analogy: '스프링을 꾹 누르면 점점 압축 에너지가 쌓이다가 손을 놓으면 "펑!" 하고 튀어오릅니다. 주가도 마찬가지로, 강한 상승 후 쉬면서 에너지를 모으는 구간(VCP 패턴)이 있고, 이 구간이 끝나면 다시 강하게 상승하는 경우가 많습니다.',
    howItWorks: [
      '150일, 200일 이동평균선 위에 있는 종목만 선별합니다 (장기 상승 추세 확인)',
      '현재 가격이 52주 최고가의 75% 이상이어야 합니다 (강한 종목만 선별)',
      '최근 변동폭이 점점 줄어드는 VCP(Volatility Contraction Pattern) 패턴을 찾습니다',
      '변동폭이 충분히 줄어든 상태에서 거래량을 동반한 상방 돌파가 나타나면 → 매수합니다',
      '매수가 대비 7~8% 하락 시 즉시 손절합니다 (미너비니의 철칙)',
    ],
    risk: '고급 전략인 만큼 패턴을 정확히 판별하는 안목이 필요합니다. VCP처럼 보이지만 실제로는 하락 전 잠깐 쉬는 구간일 수도 있어, 돌파 실패 시 손실이 발생합니다. 하지만 손절 규칙(7~8%)을 철저히 지키면 한 번의 큰 수익이 여러 번의 작은 손실을 보상하는 구조입니다.',
    bestFor: '성장주 투자와 차트 패턴 분석에 관심이 있는 중급~고급 투자자에게 적합합니다. 철저한 손절 규칙을 지킬 수 있는 분, 소수의 강한 종목에 집중 투자하는 스타일을 선호하는 분께 추천합니다.',
  };

  if (name.includes('터틀') || name.includes('Turtle') || name.includes('turtle')) return {
    simpleExplain: '1983년 리처드 데니스가 실험적으로 개발한 전설적인 터틀 트레이딩을 암호화폐 시장에 맞게 개량한 WhaleArc 독점 전략입니다. 일정 기간의 최고가를 돌파할 때 매수하고, 추세가 강할수록 포지션을 키우는(피라미딩) 공격적인 추세추종 전략입니다.',
    analogy: '100일 동안의 최고가를 넘어서면 "큰 파도가 왔다"고 판단하고 올라타는 거예요. 파도가 계속 커지면 보드 위에서 자세를 더 크게 잡고(추가 매수), 파도가 약해지면 내립니다(매도). 거북이(Turtle)처럼 느리지만 한번 잡은 추세는 끝까지 따라갑니다.',
    howItWorks: [
      '100시간(약 4일) 동안의 최고가를 돌파하면 → 1차 매수 신호가 발생합니다',
      'ADX(평균방향지수) 지표로 추세의 강도를 확인합니다. ADX가 25 이상이면 추세가 충분히 강한 것으로 판단합니다',
      '매수 후 가격이 ATR(평균진폭)의 0.5배만큼 추가 상승하면 → 2차 추가 매수(피라미딩). 최대 5번까지 가능합니다',
      '30시간(약 1.25일) 최저가를 하향 돌파하면 → 전체 포지션 자동 매도',
      '각 포지션마다 ATR 기반 개별 손절가가 설정되어 리스크가 관리됩니다',
    ],
    risk: '추세가 없는 횡보장에서는 잦은 진입과 손절이 반복되어 누적 손실이 발생할 수 있습니다. 피라미딩으로 포지션을 키운 상태에서 급반전이 오면 손실 폭이 클 수 있지만, ATR 기반 손절로 최대 손실은 제한됩니다. 역사적으로 터틀 전략의 승률은 약 40% 정도이지만, 수익 거래의 크기가 손실 거래보다 훨씬 커서 전체적으로 수익을 냅니다.',
    bestFor: '장기적 추세를 끈기 있게 따라갈 수 있는 분, 잦은 손절에도 흔들리지 않는 멘탈을 가진 분에게 적합합니다. WhaleArc만의 독점 알고리즘을 경험해보고 싶은 분, 자동매매에 관심 있는 분께 특히 추천합니다.',
  };

  // 기본 fallback
  return {
    simpleExplain: '과거 데이터의 패턴을 분석하여 최적의 매매 타이밍을 수학적으로 계산하는 퀀트(Quant) 전략입니다. 감정이 아닌 데이터와 규칙에 기반한 체계적 투자 방식입니다.',
    analogy: '날씨 예보처럼, 과거의 기상 데이터 패턴을 분석해서 내일 비가 올 확률을 계산합니다. 퀀트 전략도 마찬가지로, 과거 가격 패턴을 분석하여 "이런 조건에서는 가격이 오를 확률이 높다"는 것을 찾아내고, 그 조건이 충족되면 자동으로 매매합니다.',
    howItWorks: [
      '과거 수년간의 가격 데이터를 수집하고 분석합니다',
      '특정 조건(지표 값, 패턴 등)이 충족되면 매수 또는 매도 신호가 발생합니다',
      '감정이 아닌 미리 정한 규칙에 따라 기계적으로 투자합니다',
      '백테스트를 통해 과거에 이 전략이 얼마나 효과적이었는지 검증합니다',
    ],
    risk: '과거에 잘 작동한 전략이 미래에도 반드시 통하리라는 보장은 없습니다. 시장 환경이 변하면(규제 변화, 새로운 참여자 유입 등) 전략의 효과가 달라질 수 있습니다. 여러 전략을 분산하여 사용하면 특정 전략의 부진을 다른 전략이 보완할 수 있습니다.',
    bestFor: '감정적 매매에서 벗어나 체계적으로 투자하고 싶은 분, 데이터와 규칙 기반의 합리적 의사결정을 선호하는 분에게 적합합니다.',
  };
}

// ═══════════════════════════════════════
//  컴포넌트
// ═══════════════════════════════════════

const ALL_CATEGORIES: (Category | 'ALL')[] = [
  'ALL', 'TREND_FOLLOWING', 'MOMENTUM', 'MEAN_REVERSION', 'VOLATILITY', 'ARBITRAGE', 'MULTI_FACTOR',
];

const CATEGORY_TAB_LABELS: Record<string, string> = {
  ALL: '전체',
  TREND_FOLLOWING: '추세추종',
  MOMENTUM: '모멘텀',
  MEAN_REVERSION: '평균회귀',
  VOLATILITY: '변동성',
  ARBITRAGE: '차익거래',
  MULTI_FACTOR: '멀티팩터',
};

const CATEGORY_GLOSSARY_KEY: Record<string, string> = {
  TREND_FOLLOWING: '추세추종',
  MOMENTUM: '모멘텀',
  MEAN_REVERSION: '평균회귀',
  VOLATILITY: '변동성',
  ARBITRAGE: '차익거래',
};

const QuantStorePage = () => {
  const navigate = useVirtNavigate();
  const { isVirt } = useRoutePrefix();
  const [products, setProducts] = useState<QuantProduct[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | 'ALL'>('ALL');
  const [selectedProduct, setSelectedProduct] = useState<QuantProduct | null>(null);
  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set());
  const [purchases, setPurchases] = useState<ProductPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);

  // 투자 금액 입력 모달
  const [investModal, setInvestModal] = useState<QuantProduct | null>(null);
  const [investmentAmount, setInvestmentAmount] = useState('');
  const [confirmStep, setConfirmStep] = useState(false);

  // 취소 확인 모달
  const [cancelTarget, setCancelTarget] = useState<ProductPurchase | null>(null);

  useEffect(() => { loadProducts(); loadPurchases(); }, []);
  useEffect(() => { loadProducts(); }, [selectedCategory]);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const category = selectedCategory === 'ALL' ? undefined : selectedCategory;
      const data = await quantStoreService.getProducts(category);
      setProducts(data);
    } catch { setProducts([]); }
    finally { setLoading(false); }
  };

  const loadPurchases = async () => {
    try {
      const result = await quantStoreService.getMyPurchases();
      setPurchasedIds(new Set(result.purchasedProductIds));
      setPurchases(result.purchases.filter((p) => p.status === 'ACTIVE'));
    } catch { /* 비로그인 */ }
  };

  const openInvestModal = (product: QuantProduct) => {
    if (!isVirt) return; // 일반 모드에서는 구매 불가
    if (purchasedIds.has(product.id)) return;
    setInvestModal(product);
    setInvestmentAmount('');
    setConfirmStep(false);
  };

  const goToConfirmStep = () => {
    const amount = Number(investmentAmount.replace(/,/g, ''));
    if (!amount || amount <= 0) { alert('투자 금액을 입력해주세요.'); return; }
    setConfirmStep(true);
  };

  const handlePurchase = async () => {
    if (!investModal) return;
    const amount = Number(investmentAmount.replace(/,/g, ''));
    setPurchasing(true);
    try {
      await quantStoreService.purchaseProduct(investModal.id, amount);
      setPurchasedIds((prev) => new Set(prev).add(investModal.id));
      setInvestModal(null);
      setConfirmStep(false);
      setSelectedProduct(null);
      await loadPurchases();
    } catch (err: any) {
      alert(err.response?.data?.message || '항로 구매에 실패했습니다.');
    } finally { setPurchasing(false); }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(cancelTarget.id);
    try {
      await quantStoreService.cancelPurchase(cancelTarget.id);
      setPurchasedIds((prev) => { const next = new Set(prev); next.delete(cancelTarget.productId); return next; });
      setCancelTarget(null);
      await loadPurchases();
    } catch (err: any) {
      alert(err.response?.data?.message || '취소에 실패했습니다.');
    } finally { setCancelling(null); }
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', minimumFractionDigits: 0 }).format(v);

  const formatInputAmount = (raw: string) => {
    const num = raw.replace(/[^0-9]/g, '');
    if (!num) return '';
    return Number(num).toLocaleString('ko-KR');
  };

  const QUICK_AMOUNTS = [1000000, 3000000, 5000000, 10000000];

  // ── 말풍선 컴포넌트 ──
  const WhaleBubble = ({ whale, children, size = 'md' }: {
    whale: string; name?: string; children: React.ReactNode; size?: 'sm' | 'md';
  }) => (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 flex flex-col items-center">
        <div className={`${size === 'sm' ? 'w-10 h-10' : 'w-12 h-12'} rounded-full bg-gradient-to-br from-sky-50 to-blue-100 p-1.5 shadow-sm border border-sky-200`}>
          <img src={whale} alt="" className="w-full h-full object-contain" />
        </div>
      </div>
      <div className={`relative rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm max-w-[calc(100%-4rem)] ${isVirt ? 'bg-white border border-gray-200' : 'bg-white/[0.02] border border-white/[0.06]'}`}>
        <div className={`absolute -left-[7px] top-3 w-0 h-0 border-t-[6px] border-t-transparent border-r-[7px] border-b-[6px] border-b-transparent ${isVirt ? 'border-r-gray-200' : 'border-r-white/[0.06]'}`} />
        <div className={`absolute -left-[5px] top-[13px] w-0 h-0 border-t-[5px] border-t-transparent border-r-[6px] border-b-[5px] border-b-transparent ${isVirt ? 'border-r-white' : 'border-r-[#0a1525]'}`} />
        {children}
      </div>
    </div>
  );

  const QuestionBubble = ({ children }: { children: React.ReactNode }) => (
    <div className="flex justify-end">
      <div className="bg-gradient-to-r from-whale-light to-whale-dark text-white rounded-2xl rounded-tr-sm px-4 py-2.5 shadow-sm max-w-[80%]">
        <p className="text-sm font-medium">{children}</p>
      </div>
    </div>
  );

  const getWhale = (product: QuantProduct) => {
    const n = product.name;
    if (n.includes('골든크로스')) return { image: '/whales/narwhal.png', name: '' };
    if (n.includes('RSI') && n.includes('반전')) return { image: '/whales/dolphin.png', name: '' };
    if (n.includes('볼린저')) return { image: '/whales/blue-whale.png', name: '' };
    if (n.includes('리밸런싱') || n.includes('안전')) return { image: '/whales/beluga.png', name: '' };
    if (n.includes('모멘텀') && !n.includes('듀얼')) return { image: '/whales/orca.png', name: '' };
    if (n.includes('김프') || n.includes('차익')) return { image: '/whales/spotted-dolphin.png', name: '' };
    if (n.includes('MACD')) return { image: '/whales/humpback.png', name: '' };
    if (n.includes('래리 코너스') || n.includes('RSI(2)')) return { image: '/whales/risso-dolphin.png', name: '' };
    if (n.includes('래리 윌리엄스') || n.includes('변동성 돌파')) return { image: '/whales/wild-cat-whale.png', name: '' };
    if (n.includes('듀얼 모멘텀')) return { image: '/whales/sperm-whale.png', name: '' };
    if (n.includes('미너비니') || n.includes('트렌드 템플릿')) return { image: '/whales/gray-whale.png', name: '' };
    if (n.includes('터틀') || n.includes('Turtle')) return { image: '/whales/narwhal.png', name: '' };
    return CATEGORY_WHALE[product.category] || { image: '/whales/humpback.png', name: '' };
  };

  // ═══════════════════════════════════════
  //  렌더링
  // ═══════════════════════════════════════

  if (loading && !isVirt) return <SplashLoading message="전략 가이드를 불러오는 중..." />;
  if (loading && isVirt) return <VirtSplashLoading message="전략 가이드를 불러오는 중..." />;

  return (
    <div className={`min-h-screen ${isVirt ? 'bg-gradient-to-b from-sky-50/50 via-white to-sky-50/30' : 'bg-[#060d18] text-white'}`}>
      <Header showNav={true} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ── 헤더 ── */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-sky-100 to-blue-200 p-2 shadow-md">
              <img src="/whales/humpback.png" alt="" className="w-full h-full object-contain" />
            </div>
            <h1 className={`text-2xl md:text-3xl font-bold ${isVirt ? 'text-whale-dark' : 'text-white'}`}>전략 가이드</h1>
          </div>
          <p className={`text-sm md:text-base max-w-xl mx-auto leading-relaxed ${isVirt ? 'text-gray-500' : 'text-slate-400'}`}>
            각 전략을 쉽게 알려드려요! 용어에 마우스를 올리면 설명이 나와요.<br className="hidden md:inline" />
            마음에 드는 전략이 있다면 직접 항해도 시작할 수 있어요.
          </p>
        </div>

        {/* ── 내 항해 현황 ── */}
        {purchases.length > 0 && (
          <div className={`mb-8 rounded-xl p-5 ${isVirt ? 'bg-white border border-sky-100 shadow-sm' : 'bg-white/[0.02] border border-white/[0.06]'}`}>
            <h2 className={`text-base font-bold mb-3 flex items-center gap-2 ${isVirt ? 'text-whale-dark' : 'text-white'}`}>
              <span className="text-lg">⛵</span> 내 항해 현황
            </h2>
            <div className="space-y-2">
              {purchases.map((p) => (
                <div key={p.id} className={`flex flex-col sm:flex-row sm:items-center justify-between rounded-lg p-3 gap-2 ${isVirt ? 'bg-sky-50/50' : 'bg-white/[0.04]'}`}>
                  <div className="min-w-0">
                    <div className={`font-semibold text-sm ${isVirt ? 'text-whale-dark' : 'text-white'}`}>{p.productName}</div>
                    <div className={`text-xs truncate ${isVirt ? 'text-gray-500' : 'text-slate-500'}`}>
                      투자: {formatCurrency(p.investmentAmount)} · {p.purchasedAssets?.map(a => `${cryptoDisplayName(a.code)} ${formatQuantity(a.quantity)}개`).join(', ') || '-'}
                    </div>
                  </div>
                  <button
                    onClick={() => setCancelTarget(p)}
                    disabled={cancelling === p.id}
                    className="px-4 py-2 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {cancelling === p.id ? '취소 중...' : '항해 취소'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 카테고리 필터 ── */}
        <div className="flex flex-wrap gap-2 mb-8 justify-center">
          {ALL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                selectedCategory === cat
                  ? isVirt ? 'bg-whale-light text-white shadow-md scale-105' : 'text-cyan-400 bg-white/10 scale-105'
                  : isVirt ? 'bg-white text-gray-500 hover:bg-sky-50 border border-gray-200 hover:border-sky-300' : 'text-slate-500 border border-white/[0.06] hover:bg-white/[0.03]'
              }`}
            >
              {CATEGORY_TAB_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* ── 카테고리 설명 ── */}
        {selectedCategory !== 'ALL' && (
          <div className="mb-6 flex justify-center">
            <div className={`inline-flex items-center gap-2 rounded-full px-5 py-2 ${isVirt ? 'bg-white border border-sky-100 shadow-sm' : 'bg-white/[0.02] border border-white/[0.06]'}`}>
              <img src={CATEGORY_WHALE[selectedCategory]?.image} alt="" className="w-6 h-6 object-contain" />
              <span className={`text-sm ${isVirt ? 'text-gray-600' : 'text-slate-400'}`}>
                {CATEGORY_GLOSSARY_KEY[selectedCategory]
                  ? <><Term k={CATEGORY_GLOSSARY_KEY[selectedCategory]}>{CATEGORY_TAB_LABELS[selectedCategory]}</Term> — {CATEGORY_SIMPLE[selectedCategory]}</>
                  : CATEGORY_SIMPLE[selectedCategory]
                }
              </span>
            </div>
          </div>
        )}

        {/* ── 카드 그리드 ── */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`rounded-2xl p-6 animate-pulse border ${isVirt ? 'bg-white shadow-sm border-gray-100' : 'bg-white/[0.02] border-white/[0.06]'}`}>
                <div className={`h-5 rounded-full w-1/3 mb-4 ${isVirt ? 'bg-gray-200' : 'bg-white/[0.06]'}`} />
                <div className={`h-6 rounded w-3/4 mb-4 ${isVirt ? 'bg-gray-200' : 'bg-white/[0.06]'}`} />
                <div className="flex items-start gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-full ${isVirt ? 'bg-gray-200' : 'bg-white/[0.06]'}`} />
                  <div className={`flex-1 rounded-2xl h-16 ${isVirt ? 'bg-gray-100' : 'bg-white/[0.04]'}`} />
                </div>
                <div className={`h-10 rounded-xl ${isVirt ? 'bg-gray-200' : 'bg-white/[0.06]'}`} />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => {
              const whale = getWhale(product);
              const edu = getStrategyEducation(product.name);
              const diff = DIFFICULTY_CONFIG[product.riskLevel] || DIFFICULTY_CONFIG.MEDIUM;
              const isPurchased = purchasedIds.has(product.id);

              return (
                <div
                  key={product.id}
                  className={`group rounded-2xl p-5 border hover:-translate-y-1 transition-all cursor-pointer relative ${isVirt ? 'bg-white shadow-sm border-gray-100 hover:shadow-lg hover:border-sky-200' : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.03] hover:border-white/10'}`}
                  onClick={() => setSelectedProduct(product)}
                >
                  {/* 뱃지 */}
                  <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                    <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${diff.color}`}>
                      {diff.emoji} {diff.label}
                    </span>
                    <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-sky-50 text-sky-600">
                      {CATEGORY_LABELS[product.category]}
                    </span>
                    {product.assetType === 'STOCK' ? (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-50 text-indigo-500">주식</span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-50 text-emerald-500">가상화폐</span>
                    )}
                    {product.strategyType === 'TURTLE' && (
                      <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-gradient-to-r from-amber-400 to-orange-400 text-white">독점</span>
                    )}
                  </div>

                  {/* 전략명 */}
                  <h3 className={`text-lg font-bold mb-3 group-hover:text-whale-light transition-colors ${isVirt ? 'text-whale-dark' : 'text-white'}`}>
                    {product.name}
                  </h3>

                  {/* 고래 말풍선 */}
                  <div className="mb-4">
                    <WhaleBubble whale={whale.image} size="sm">
                      <p className={`text-sm leading-relaxed ${isVirt ? 'text-gray-700' : 'text-slate-400'}`}>{edu.simpleExplain}</p>
                    </WhaleBubble>
                  </div>

                  {/* 대상 자산 */}
                  <div className="flex flex-wrap gap-1 mb-4">
                    {product.targetAssets.map((asset) => (
                      <span key={asset} className={`px-2 py-0.5 text-xs rounded-md ${isVirt ? 'bg-gray-50 text-gray-500' : 'bg-white/[0.04] text-slate-500'}`}>
                        {assetDisplayName(asset, product.assetType)}
                      </span>
                    ))}
                  </div>

                  {/* 버튼 */}
                  <div className={`flex items-center gap-2 pt-3 border-t ${isVirt ? 'border-gray-100' : 'border-white/[0.06]'}`}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedProduct(product); }}
                      className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-colors ${isVirt ? 'text-whale-light bg-sky-50 hover:bg-sky-100' : 'text-cyan-400 bg-white/[0.04] hover:bg-white/[0.06]'}`}
                    >
                      📚 알아보기
                    </button>
                    {isPurchased ? (
                      <span className="px-4 py-2.5 text-sm font-semibold text-emerald-600 bg-emerald-50 rounded-xl">
                        항해 중 ⛵
                      </span>
                    ) : isVirt ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); openInvestModal(product); }}
                        className="px-4 py-2.5 text-sm font-semibold text-white bg-whale-light hover:bg-whale-dark rounded-xl transition-colors"
                      >
                        항해하기
                      </button>
                    ) : (
                      <span className={`px-4 py-2.5 text-sm font-semibold rounded-xl ${isVirt ? 'text-gray-400 bg-gray-100' : 'text-slate-500 bg-white/[0.04]'}`}>
                        Virt 전용
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ═══ 교육 상세 모달 ═══ */}
        {selectedProduct && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedProduct(null)}>
            <div
              className={`rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl ${isVirt ? 'bg-gradient-to-b from-sky-50 to-white' : 'bg-[#0c1829] border border-white/[0.06]'}`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* 모달 헤더 */}
              <div className={`sticky top-0 backdrop-blur-sm px-5 pt-5 pb-3 z-10 ${isVirt ? 'bg-gradient-to-b from-sky-50 to-sky-50/80' : 'bg-[#0c1829]/90'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${(DIFFICULTY_CONFIG[selectedProduct.riskLevel] || DIFFICULTY_CONFIG.MEDIUM).color}`}>
                      {(DIFFICULTY_CONFIG[selectedProduct.riskLevel] || DIFFICULTY_CONFIG.MEDIUM).emoji}{' '}
                      {(DIFFICULTY_CONFIG[selectedProduct.riskLevel] || DIFFICULTY_CONFIG.MEDIUM).label}
                    </span>
                    <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-sky-100 text-sky-600">
                      {CATEGORY_LABELS[selectedProduct.category]}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedProduct(null)}
                    className="p-2 hover:bg-white/80 rounded-full transition-colors"
                    aria-label="닫기"
                  >
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <h2 className={`text-xl font-bold ${isVirt ? 'text-whale-dark' : 'text-white'}`}>{selectedProduct.name}</h2>
              </div>

              {/* 대화형 교육 콘텐츠 */}
              <div className="px-5 pb-5 space-y-4">
                {(() => {
                  const whale = getWhale(selectedProduct);
                  const edu = getStrategyEducation(selectedProduct.name);

                  return (
                    <>
                      {/* 인사 */}
                      <WhaleBubble whale={whale.image}>
                        <p className={`text-sm ${isVirt ? 'text-gray-700' : 'text-slate-400'}`}>
                          이 전략에 대해 쉽게 알려드릴게요!
                        </p>
                      </WhaleBubble>

                      {/* Q1: 이 전략이 뭐예요? */}
                      <QuestionBubble>이 전략이 뭐예요?</QuestionBubble>
                      <WhaleBubble whale={whale.image}>
                        <p className={`text-sm leading-relaxed ${isVirt ? 'text-gray-700' : 'text-slate-400'}`}>{edu.simpleExplain}</p>
                        {/* 관련 용어 바로가기 */}
                        {(() => {
                          const termKeys: string[] = [];
                          const n = selectedProduct.name;
                          if (n.includes('골든크로스')) termKeys.push('골든크로스', '이동평균선');
                          if (n.includes('RSI')) termKeys.push('RSI', '과매수', '과매도');
                          if (n.includes('볼린저')) termKeys.push('볼린저밴드', '변동성');
                          if (n.includes('MACD')) termKeys.push('MACD', '다이버전스');
                          if (n.includes('모멘텀')) termKeys.push('모멘텀');
                          if (n.includes('리밸런싱') || n.includes('안전')) termKeys.push('리밸런싱');
                          if (n.includes('김프') || n.includes('차익')) termKeys.push('김프', '차익거래');
                          if (n.includes('변동성 돌파') || n.includes('래리 윌리엄스')) termKeys.push('변동성돌파');
                          if (n.includes('듀얼 모멘텀')) termKeys.push('듀얼모멘텀');
                          if (n.includes('터틀') || n.includes('Turtle')) termKeys.push('피라미딩', '추세추종');
                          if (termKeys.length === 0) return null;
                          return (
                            <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-gray-100">
                              <span className="text-[10px] text-gray-400 mr-1 self-center">관련 용어:</span>
                              {termKeys.map(k => <Term key={k} k={k}><span className="text-xs">{k}</span></Term>)}
                            </div>
                          );
                        })()}
                      </WhaleBubble>

                      {/* Q2: 쉽게 설명해주세요 */}
                      <QuestionBubble>좀 더 쉽게 설명해주세요!</QuestionBubble>
                      <WhaleBubble whale={whale.image}>
                        <p className={`text-sm leading-relaxed ${isVirt ? 'text-gray-700' : 'text-slate-400'}`}>💡 {edu.analogy}</p>
                      </WhaleBubble>

                      {/* Q3: 어떻게 작동해요? */}
                      <QuestionBubble>구체적으로 어떻게 작동해요?</QuestionBubble>
                      <WhaleBubble whale={whale.image}>
                        <div className="space-y-2">
                          {edu.howItWorks.map((step, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-sky-100 text-sky-600 text-xs font-bold flex items-center justify-center mt-0.5">
                                {i + 1}
                              </span>
                              <p className={`text-sm ${isVirt ? 'text-gray-700' : 'text-slate-400'}`}>{step}</p>
                            </div>
                          ))}
                        </div>
                      </WhaleBubble>

                      {/* Q4: 위험한 건 없어요? */}
                      <QuestionBubble>위험한 건 없어요? 😥</QuestionBubble>
                      <WhaleBubble whale={whale.image}>
                        <div className="bg-rose-50 rounded-lg p-3 border border-rose-100">
                          <p className="text-sm text-rose-700 leading-relaxed">⚠️ {edu.risk}</p>
                        </div>
                      </WhaleBubble>

                      {/* Q5: 어떤 분에게 맞아요? */}
                      <QuestionBubble>어떤 사람에게 맞는 전략이에요?</QuestionBubble>
                      <WhaleBubble whale={whale.image}>
                        <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                          <p className="text-sm text-emerald-700 leading-relaxed">🎯 {edu.bestFor}</p>
                        </div>
                      </WhaleBubble>

                      {/* 대상 자산 */}
                      <div className={`rounded-xl border p-4 ${isVirt ? 'bg-white border-gray-100 shadow-sm' : 'bg-white/[0.02] border-white/[0.06]'}`}>
                        <h4 className={`text-xs font-semibold uppercase tracking-wider mb-2 ${isVirt ? 'text-gray-400' : 'text-slate-500'}`}>투자 대상</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedProduct.targetAssets.map((asset) => (
                            <span key={asset} className={`px-3 py-1 text-sm rounded-lg font-medium border ${isVirt ? 'bg-gray-50 text-gray-700 border-gray-100' : 'bg-white/[0.04] text-slate-300 border-white/[0.06]'}`}>
                              {assetDisplayName(asset, selectedProduct.assetType)}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* 태그 */}
                      {selectedProduct.tags.filter(t => !['무료', '유료', '프리미엄', '할인', '이벤트'].includes(t)).length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {selectedProduct.tags.filter(t => !['무료', '유료', '프리미엄', '할인', '이벤트'].includes(t)).map((tag) => (
                            <span key={tag} className={`px-2.5 py-1 text-xs rounded-full font-medium ${isVirt ? 'bg-sky-50 text-sky-500' : 'bg-cyan-500/10 text-cyan-400'}`}>
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* 하단 CTA */}
                      <div className={`rounded-xl border p-4 space-y-3 ${isVirt ? 'bg-white border-gray-100 shadow-sm' : 'bg-white/[0.02] border-white/[0.06]'}`}>
                        {/* 백테스트 유도 */}
                        <button
                          onClick={() => { setSelectedProduct(null); navigate('/strategy'); }}
                          className={`w-full py-3 text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 ${isVirt ? 'text-sky-600 bg-sky-50 hover:bg-sky-100' : 'text-cyan-400 bg-white/[0.04] hover:bg-white/[0.06]'}`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          이 전략으로 백테스트 해보기
                        </button>

                        {/* 항해 시작 */}
                        {purchasedIds.has(selectedProduct.id) ? (
                          <div className="w-full py-3 text-sm font-semibold text-center text-emerald-600 bg-emerald-50 rounded-xl">
                            ⛵ 이미 항해 중인 전략이에요!
                          </div>
                        ) : isVirt ? (
                          <button
                            onClick={() => openInvestModal(selectedProduct)}
                            className="w-full py-3 text-sm font-semibold text-white bg-gradient-to-r from-whale-light to-whale-dark hover:opacity-90 rounded-xl transition-all shadow-md"
                          >
                            이 전략으로 항해 시작하기
                          </button>
                        ) : (
                          <div className={`w-full py-3 text-sm font-semibold text-center rounded-xl ${isVirt ? 'text-gray-400 bg-gray-100' : 'text-slate-500 bg-white/[0.04]'}`}>
                            Virt 모드에서 항해를 시작할 수 있어요
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* ═══ 투자 금액 입력 모달 ═══ */}
        {investModal && !confirmStep && (
          <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={() => setInvestModal(null)}>
            <div className={`rounded-2xl max-w-md w-full p-6 shadow-2xl ${isVirt ? 'bg-white' : 'bg-[#0c1829] border border-white/[0.06]'}`} onClick={(e) => e.stopPropagation()}>
              <h3 className={`text-xl font-bold mb-1 ${isVirt ? 'text-whale-dark' : 'text-white'}`}>투자 금액 설정</h3>
              <p className={`text-sm mb-5 ${isVirt ? 'text-gray-500' : 'text-slate-400'}`}>
                "{investModal.name}" 항로에 투자할 금액을 입력하세요.
                <br />
                <span className={`text-xs ${isVirt ? 'text-gray-400' : 'text-slate-500'}`}>
                  투자 금액이 {investModal.targetAssets.length}개 자산({investModal.targetAssets.map(cryptoDisplayName).join(', ')})에 균등 분배됩니다.
                </span>
              </p>

              <div className="relative mb-4">
                <input
                  type="text"
                  value={investmentAmount}
                  onChange={(e) => setInvestmentAmount(formatInputAmount(e.target.value))}
                  placeholder="0"
                  className={`w-full text-2xl font-bold text-right pr-10 pl-4 py-3 border-2 rounded-xl focus:border-whale-light focus:ring-2 focus:ring-whale-light/20 outline-none ${isVirt ? 'border-gray-200' : 'border-white/10 bg-white/[0.04] text-white'}`}
                  autoFocus
                />
                <span className={`absolute right-4 top-1/2 -translate-y-1/2 font-medium ${isVirt ? 'text-gray-400' : 'text-slate-500'}`}>원</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
                {QUICK_AMOUNTS.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setInvestmentAmount(amount.toLocaleString('ko-KR'))}
                    className={`py-2 text-sm font-medium rounded-lg transition-colors ${isVirt ? 'text-gray-600 bg-gray-100 hover:bg-whale-light/10 hover:text-whale-light' : 'text-slate-400 bg-white/[0.04] hover:bg-white/[0.06] hover:text-cyan-400'}`}
                  >
                    {amount >= 10000000 ? `${amount / 10000000}천만` : `${amount / 10000}만`}
                  </button>
                ))}
              </div>

              {false && investModal.price > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-800">
                  전략 이용료: {formatCurrency(investModal.price)} (별도)
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setInvestModal(null)} className={`flex-1 py-3 rounded-xl font-medium transition-colors ${isVirt ? 'text-gray-600 bg-gray-100 hover:bg-gray-200' : 'text-slate-400 bg-white/[0.04] hover:bg-white/[0.06]'}`}>
                  취소
                </button>
                <button onClick={goToConfirmStep} disabled={!investmentAmount} className="flex-1 py-3 bg-whale-light hover:bg-whale-dark text-white rounded-xl font-semibold transition-colors disabled:opacity-50">
                  다음
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ 구매 최종 확인 모달 ═══ */}
        {investModal && confirmStep && (
          <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
            <div className={`rounded-2xl max-w-md w-full p-6 shadow-2xl ${isVirt ? 'bg-white' : 'bg-[#0c1829] border border-white/[0.06]'}`}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-full bg-whale-light/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-whale-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className={`text-xl font-bold ${isVirt ? 'text-whale-dark' : 'text-white'}`}>주문 확인</h3>
              </div>

              <div className={`rounded-xl p-4 mb-4 space-y-3 ${isVirt ? 'bg-gray-50' : 'bg-white/[0.04]'}`}>
                <div className="flex justify-between">
                  <span className={`text-sm ${isVirt ? 'text-gray-500' : 'text-slate-500'}`}>항로</span>
                  <span className={`text-sm font-semibold ${isVirt ? 'text-whale-dark' : 'text-white'}`}>{investModal.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className={`text-sm ${isVirt ? 'text-gray-500' : 'text-slate-500'}`}>총 투자 금액</span>
                  <span className={`text-sm font-bold ${isVirt ? 'text-whale-dark' : 'text-white'}`}>{investmentAmount}원</span>
                </div>
                <div className="flex justify-between">
                  <span className={`text-sm ${isVirt ? 'text-gray-500' : 'text-slate-500'}`}>투자 대상</span>
                  <span className={`text-sm font-medium ${isVirt ? 'text-gray-700' : 'text-slate-300'}`}>{investModal.targetAssets.map(cryptoDisplayName).join(', ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className={`text-sm ${isVirt ? 'text-gray-500' : 'text-slate-500'}`}>자산당 배분</span>
                  <span className={`text-sm font-medium ${isVirt ? 'text-gray-700' : 'text-slate-300'}`}>
                    ~{formatCurrency(Math.floor(Number(investmentAmount.replace(/,/g, '')) / investModal.targetAssets.length))}
                  </span>
                </div>
                {false && investModal.price > 0 && (
                  <div className="flex justify-between pt-2 border-t border-gray-200">
                    <span className="text-sm text-amber-700">전략 이용료</span>
                    <span className="text-sm font-bold text-amber-700">{formatCurrency(investModal.price)}</span>
                  </div>
                )}
              </div>

              <div className={`border rounded-lg p-3 mb-5 ${investModal.strategyType === 'TURTLE' ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
                <div className="flex gap-2">
                  <svg className={`w-5 h-5 flex-shrink-0 mt-0.5 ${investModal.strategyType === 'TURTLE' ? 'text-amber-500' : 'text-blue-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {investModal.strategyType === 'TURTLE' ? (
                    <div className="text-sm text-amber-800">
                      <p className="font-medium mb-1">시그널 기반 자동매매</p>
                      <p className="text-xs text-amber-600">
                        투자 금액이 각 자산에 배분되며, 즉시 매수하지 않습니다.
                        매 시간 알고리즘이 시그널을 분석하여 최적의 타이밍에 자동으로 진입/청산합니다.
                      </p>
                    </div>
                  ) : (
                    <div className="text-sm text-blue-800">
                      <p className="font-medium mb-1">시장가 즉시 매수</p>
                      <p className="text-xs text-blue-600">
                        현재 시장가로 각 자산이 즉시 매수되며, 포트폴리오에 반영됩니다.
                        실제 체결 금액은 시장 상황에 따라 다를 수 있습니다.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg mb-3">
                <p className="text-[10px] text-amber-700 leading-relaxed text-center">
                  본 전략은 교육 목적으로 제공되며, 투자 권유가 아닙니다. 과거 성과가 미래 수익을 보장하지 않으며, 투자 판단과 책임은 본인에게 있습니다.
                </p>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setConfirmStep(false)} className={`flex-1 py-3 rounded-xl font-medium transition-colors ${isVirt ? 'text-gray-600 bg-gray-100 hover:bg-gray-200' : 'text-slate-400 bg-white/[0.04] hover:bg-white/[0.06]'}`}>이전</button>
                <button onClick={handlePurchase} disabled={purchasing} className="flex-1 py-3 bg-whale-light hover:bg-whale-dark text-white rounded-xl font-semibold transition-colors disabled:opacity-50">
                  {purchasing ? '매수 진행 중...' : '확인, 항해 시작'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ 취소 확인 모달 ═══ */}
        {cancelTarget && (
          <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
            <div className={`rounded-2xl max-w-md w-full p-6 shadow-2xl ${isVirt ? 'bg-white' : 'bg-[#0c1829] border border-white/[0.06]'}`}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-red-700">항해 취소</h3>
              </div>

              <div className={`rounded-xl p-4 mb-4 space-y-2 ${isVirt ? 'bg-gray-50' : 'bg-white/[0.04]'}`}>
                <div className="flex justify-between">
                  <span className={`text-sm ${isVirt ? 'text-gray-500' : 'text-slate-500'}`}>항로</span>
                  <span className={`text-sm font-semibold ${isVirt ? 'text-whale-dark' : 'text-white'}`}>{cancelTarget.productName}</span>
                </div>
                <div className="flex justify-between">
                  <span className={`text-sm ${isVirt ? 'text-gray-500' : 'text-slate-500'}`}>투자 금액</span>
                  <span className={`text-sm font-bold ${isVirt ? '' : 'text-white'}`}>{formatCurrency(cancelTarget.investmentAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className={`text-sm ${isVirt ? 'text-gray-500' : 'text-slate-500'}`}>보유 자산</span>
                  <span className={`text-sm font-medium ${isVirt ? '' : 'text-slate-300'}`}>{cancelTarget.purchasedAssets?.map(a => `${cryptoDisplayName(a.code)} ${formatQuantity(a.quantity)}개`).join(', ') || '-'}</span>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-5">
                <div className="flex gap-2">
                  <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div className="text-sm text-red-800">
                    <p className="font-semibold mb-1">이 작업은 되돌릴 수 없습니다</p>
                    <p className="text-xs text-red-600">
                      항해를 취소하면 이 항로로 매수한 수량만 <strong>현재 시장가로 즉시 매도</strong>됩니다.
                      개인적으로 추가 매수한 수량은 영향받지 않습니다.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setCancelTarget(null)} className={`flex-1 py-3 rounded-xl font-medium transition-colors ${isVirt ? 'text-gray-600 bg-gray-100 hover:bg-gray-200' : 'text-slate-400 bg-white/[0.04] hover:bg-white/[0.06]'}`}>돌아가기</button>
                <button onClick={handleCancel} disabled={cancelling === cancelTarget.id} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-colors disabled:opacity-50">
                  {cancelling === cancelTarget.id ? '매도 진행 중...' : '취소 및 전량 매도'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── 빈 상태 ── */}
        {!loading && products.length === 0 && (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-full bg-sky-50 mx-auto mb-4 flex items-center justify-center">
              <img src="/whales/gray-whale.png" alt="" className="w-14 h-14 object-contain opacity-60" />
            </div>
            <div className={`font-medium text-lg ${isVirt ? 'text-gray-500' : 'text-slate-400'}`}>이 카테고리에 등록된 전략이 없어요</div>
            <div className={`text-sm mt-1 ${isVirt ? 'text-gray-400' : 'text-slate-500'}`}>다른 카테고리를 탐색해보세요!</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuantStorePage;
