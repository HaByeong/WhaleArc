import { useState, useRef } from 'react';

// 금융 용어 사전 - 마우스 호버 시 초보자를 위한 설명 표시
export const GLOSSARY: Record<string, { title: string; desc: string; example?: string }> = {
  '골든크로스': { title: '골든크로스 (Golden Cross)', desc: '단기 이동평균선이 장기 이동평균선을 아래에서 위로 뚫고 올라가는 현상입니다. 상승 추세의 시작을 알리는 대표적인 매수 신호로 사용됩니다.', example: '예: 20일 평균이 60일 평균 위로 올라가면 → 매수 신호' },
  '데드크로스': { title: '데드크로스 (Dead Cross)', desc: '단기 이동평균선이 장기 이동평균선을 위에서 아래로 뚫고 내려가는 현상입니다. 하락 추세의 시작을 알리는 대표적인 매도 신호로 사용됩니다.', example: '예: 20일 평균이 60일 평균 아래로 내려가면 → 매도 신호' },
  '이동평균선': { title: '이동평균선 (MA)', desc: '일정 기간 동안의 종가 평균을 매일 계산하여 선으로 연결한 것입니다. 가격의 전체적인 방향(추세)을 파악하는 데 가장 기본적인 도구입니다.', example: 'MA(20) = 최근 20일간 종가의 평균' },
  'RSI': { title: 'RSI (상대강도지수)', desc: '최근 가격이 얼마나 올랐는지/내렸는지를 0~100 사이의 숫자로 나타낸 지표입니다. 시장이 과열되었는지, 침체되었는지를 판단하는 데 사용합니다.', example: '70 이상 = 과매수(너무 올라서 조정 가능성) / 30 이하 = 과매도(너무 내려서 반등 가능성)' },
  'MACD': { title: 'MACD', desc: '단기 이동평균과 장기 이동평균의 차이를 분석하여 추세의 방향과 전환 시점을 알려주는 지표입니다. MACD선, 시그널선, 히스토그램 3가지로 구성됩니다.', example: 'MACD선이 시그널선 위로 올라가면 매수, 아래로 내려가면 매도 신호' },
  '볼린저밴드': { title: '볼린저 밴드 (Bollinger Bands)', desc: '가격의 "정상 범위"를 상단·중심·하단 3개의 밴드로 표시합니다. 통계적으로 가격의 약 95%가 이 밴드 안에서 움직입니다.', example: '밴드가 좁아지면(스퀴즈) → 곧 큰 움직임 예고 / 상단 돌파 → 강한 상승 / 하단 이탈 → 강한 하락' },
  '스토캐스틱': { title: '스토캐스틱 (Stochastic)', desc: '일정 기간의 최고가·최저가 범위에서 현재 가격이 어디에 있는지를 0~100으로 표시합니다. %K선과 %D선의 교차로 매매 신호를 판단합니다.', example: '80 이상 = 과매수 / 20 이하 = 과매도' },
  '과매수': { title: '과매수 (Overbought)', desc: '가격이 단기간에 너무 많이 올라서, 곧 조정(하락)이 올 수 있는 상태를 의미합니다. "너무 비싸졌다"는 경고 신호입니다.', example: 'RSI 70 이상, 스토캐스틱 80 이상일 때 과매수로 판단' },
  '과매도': { title: '과매도 (Oversold)', desc: '가격이 단기간에 너무 많이 내려서, 곧 반등(상승)이 올 수 있는 상태를 의미합니다. "너무 싸졌다"는 매수 기회 신호입니다.', example: 'RSI 30 이하, 스토캐스틱 20 이하일 때 과매도로 판단' },
  '백테스트': { title: '백테스트 (Backtest)', desc: '과거의 실제 시장 데이터를 사용하여 투자 전략이 얼마나 효과적이었는지를 시뮬레이션하는 것입니다. "만약 이 전략으로 과거에 투자했다면?" 이라는 질문에 답합니다.', example: '주의: 과거 성과가 미래 수익을 보장하지는 않습니다' },
  '승률': { title: '승률 (Win Rate)', desc: '전체 거래 중 수익을 낸 거래의 비율입니다. 높을수록 좋지만, 승률만으로 전략의 좋고 나쁨을 판단할 수 없습니다. 1번 크게 잃으면 9번 이겨도 손실이 날 수 있기 때문입니다.', example: '10번 거래 중 7번 수익 → 승률 70%' },
  '샤프비율': { title: '샤프 비율 (Sharpe Ratio)', desc: '투자에서 얻은 수익이 감수한 위험 대비 얼마나 효율적인지를 나타내는 지표입니다. "같은 위험을 감수하고 더 많이 벌었는가?"를 측정합니다.', example: '1.0 이상 = 양호 / 2.0 이상 = 매우 우수 / 0 이하 = 위험 대비 수익 부족' },
  'MDD': { title: '최대 낙폭 (MDD, Maximum Drawdown)', desc: '투자 기간 중 자산이 최고점에서 최저점까지 얼마나 떨어졌는지를 나타냅니다. 최악의 경우 얼마나 잃을 수 있는지를 보여주는 위험 지표입니다.', example: 'MDD 20% = 최고점 대비 최대 20%까지 하락한 적이 있음' },
  'CAGR': { title: '연평균 복합 성장률 (CAGR)', desc: '투자 기간 동안의 수익을 연 단위로 환산한 평균 수익률입니다. 서로 다른 기간의 투자 성과를 공정하게 비교할 수 있게 해줍니다.', example: '2년간 총 44% 수익 → CAGR 약 20% (매년 평균 20%씩 성장)' },
  '손절': { title: '손절 (Stop Loss)', desc: '손실이 일정 수준에 도달하면 더 큰 손실을 방지하기 위해 자동으로 매도하는 것입니다. "여기까지만 잃겠다"는 안전장치입니다.', example: '손절 5% 설정 → 매수가 대비 5% 하락 시 자동 매도' },
  '익절': { title: '익절 (Take Profit)', desc: '수익이 목표치에 도달하면 자동으로 매도하여 이익을 확정하는 것입니다. 욕심을 부리다 수익을 놓치는 것을 방지합니다.', example: '익절 10% 설정 → 매수가 대비 10% 상승 시 자동 매도' },
  '트레일링스탑': { title: '트레일링 스탑 (Trailing Stop)', desc: '가격이 오를 때는 따라 올라가고, 최고점에서 일정 비율 하락하면 매도하는 방식입니다. 상승 추세를 최대한 따라가면서도 수익을 지켜줍니다.', example: '트레일링 5% → 최고점 100만원에서 95만원으로 하락 시 매도' },
  '슬리피지': { title: '슬리피지 (Slippage)', desc: '주문 시점의 가격과 실제 체결 가격 사이의 차이입니다. 시장가 주문 시 가격이 순간적으로 변하면서 발생하며, 실제 거래에서는 피할 수 없는 비용입니다.', example: '1000원에 매수 주문 → 실제 1002원에 체결 = 0.2% 슬리피지' },
  '수수료': { title: '거래 수수료 (Commission)', desc: '거래소에 지불하는 매매 비용입니다. 매수와 매도 시 각각 발생하며, 잦은 거래 시 누적되어 수익에 큰 영향을 줄 수 있습니다.', example: '빗썸 0.25%, 업비트 0.05% (거래소마다 다름)' },
  '롱': { title: '롱 (Long) - 매수', desc: '가격이 오를 것으로 예상하고 매수하는 것입니다. 일반적인 "사서 비싸게 파는" 투자 방식입니다.', example: '1만원에 매수 → 2만원에 매도 = 1만원 수익' },
  '숏': { title: '숏 (Short) - 공매도', desc: '가격이 내릴 것으로 예상하고 먼저 빌려서 팔고, 나중에 싸게 사서 갚는 방식입니다. 하락장에서도 수익을 낼 수 있지만 위험이 큽니다.', example: '2만원에 공매도 → 1만원에 되사기 = 1만원 수익' },
  '추세추종': { title: '추세추종 전략 (Trend Following)', desc: '가격이 현재 오르고 있으면 계속 오를 것이라 보고 따라가는 전략입니다. "추세는 한번 시작되면 계속된다"는 원리를 활용합니다.', example: '대표적: 골든크로스/데드크로스, MACD 전략' },
  '역추세': { title: '역추세 전략 (Mean Reversion)', desc: '가격이 너무 많이 올랐으면 내릴 것이고, 너무 많이 내렸으면 오를 것이라 보는 전략입니다. "가격은 결국 평균으로 돌아온다"는 원리를 활용합니다.', example: '대표적: RSI 과매수/과매도, 볼린저 밴드 반전 전략' },
  '변동성': { title: '변동성 (Volatility)', desc: '가격이 얼마나 크게 오르내리는지를 나타냅니다. 변동성이 높으면 위험하지만 그만큼 수익 기회도 큽니다. 변동성이 낮으면 안정적이지만 수익 기회는 적습니다.', example: '비트코인은 변동성이 높고, 금은 변동성이 낮은 편' },
  'ProfitFactor': { title: '프로핏 팩터 (Profit Factor)', desc: '총 수익금액을 총 손실금액으로 나눈 값입니다. 1보다 크면 수익이 손실보다 크다는 뜻이고, 2 이상이면 우수한 전략으로 평가됩니다.', example: '총 수익 200만원 / 총 손실 100만원 = Profit Factor 2.0' },
  '소르티노': { title: '소르티노 비율 (Sortino Ratio)', desc: '샤프 비율과 비슷하지만, 하락 위험만 고려하여 계산합니다. 상승 변동은 좋은 것이므로 제외하고, 진짜 위험(하락)만 측정하여 더 정확한 위험 대비 수익률을 보여줍니다.', example: '1.0 이상 = 양호 / 2.0 이상 = 우수' },
  '평균보유': { title: '평균 보유 기간', desc: '매수 후 매도까지 평균적으로 며칠 동안 자산을 보유했는지를 나타냅니다. 짧으면 단기 매매, 길면 장기 투자 성격의 전략입니다.', example: '평균 보유 3일 = 단기 스윙 / 30일 = 중기 / 90일+ = 장기' },
  'EMA': { title: '지수이동평균 (EMA)', desc: '일반 이동평균(MA)과 유사하지만 최근 가격에 더 큰 가중치를 부여합니다. 최근 추세 변화에 더 빠르게 반응하므로 단기 매매에서 많이 사용됩니다.', example: 'EMA(12)는 MA(12)보다 최근 가격 변화를 더 빠르게 반영' },
  'ATR': { title: 'ATR (평균 진폭)', desc: '일정 기간 동안 가격이 하루에 평균적으로 얼마나 움직였는지를 나타냅니다. 변동성을 수치로 측정하여 손절 폭이나 포지션 크기를 결정할 때 사용합니다.', example: 'ATR이 1000원이면 하루 평균 1000원 범위에서 가격이 움직임' },
  '%B': { title: '볼린저 %B', desc: '현재 가격이 볼린저 밴드 내에서 어디에 위치하는지를 0~1 사이로 나타냅니다. 0이면 하단 밴드, 1이면 상단 밴드에 위치합니다.', example: '%B > 1 = 상단 밴드 돌파(강한 상승) / %B < 0 = 하단 밴드 이탈(강한 하락)' },
  '모멘텀': { title: '모멘텀 (Momentum)', desc: '가격의 움직이는 "힘"을 의미합니다. 최근에 많이 오른 자산은 계속 오르는 경향이 있다는 이론에 기반한 투자 방식입니다.', example: '최근 한 달간 가장 많이 오른 종목에 투자 → 모멘텀 전략' },
  '평균회귀': { title: '평균회귀 (Mean Reversion)', desc: '가격이 평균에서 크게 벗어나면 다시 평균으로 돌아오려는 성질을 이용하는 전략입니다. "너무 올랐으면 내리고, 너무 내렸으면 오른다"는 원리입니다.', example: 'RSI 30 이하 → 평균으로 돌아갈 가능성 높음 → 매수' },
  '차익거래': { title: '차익거래 (Arbitrage)', desc: '같은 자산이 서로 다른 시장에서 다른 가격에 거래될 때, 싼 곳에서 사서 비싼 곳에서 파는 전략입니다. 위험이 매우 낮지만 수익도 작은 편입니다.', example: '업비트에서 BTC 1억 / 바이낸스에서 BTC 9900만원 → 바이낸스에서 사서 업비트에서 판매' },
  '김프': { title: '김치 프리미엄 (김프)', desc: '한국 거래소의 암호화폐 가격이 해외 거래소보다 높은 현상입니다. 한국 시장의 수요가 많을 때 발생하며, 이 가격 차이를 이용해 수익을 낼 수 있습니다.', example: '해외 BTC 가격 대비 국내가 5% 비쌈 → 김프 5%' },
  '리밸런싱': { title: '리밸런싱 (Rebalancing)', desc: '투자 포트폴리오의 자산 배분 비율이 틀어졌을 때, 원래 목표 비율로 다시 맞추는 것입니다. 자동으로 "비싼 건 팔고, 싼 건 사는" 효과가 있습니다.', example: 'BTC 60%:ETH 40% 목표인데 BTC가 올라서 70%:30%이 됨 → BTC 일부 팔고 ETH 매수' },
  '다이버전스': { title: '다이버전스 (Divergence)', desc: '가격의 움직임과 지표의 움직임이 서로 반대 방향으로 가는 현상입니다. 추세가 곧 바뀔 수 있다는 강력한 신호로 사용됩니다.', example: '가격은 계속 내리는데 RSI는 올라가면 → 곧 반등 가능성' },
  '변동성돌파': { title: '변동성 돌파 전략', desc: '전날의 가격 변동폭을 기준으로, 오늘 가격이 일정 비율 이상 움직이면 그 방향으로 진입하는 전략입니다. 래리 윌리엄스가 개발했습니다.', example: '전날 변동폭 1만원 × 0.5 = 5천원 → 오늘 시가 대비 5천원 이상 오르면 매수' },
  '듀얼모멘텀': { title: '듀얼 모멘텀', desc: '절대 모멘텀(자산이 올랐는가?)과 상대 모멘텀(다른 자산보다 더 올랐는가?)을 동시에 확인하는 전략입니다. 두 조건을 모두 만족해야 투자합니다.', example: 'BTC가 지난달보다 올랐고(절대) + ETH보다 더 올랐으면(상대) → BTC에 투자' },
  '피라미딩': { title: '피라미딩 (Pyramiding)', desc: '수익이 나고 있는 포지션에 추가로 매수하여 포지션 크기를 키우는 기법입니다. 추세가 강할 때 수익을 극대화할 수 있지만, 반전 시 손실도 커집니다.', example: '1차 매수 후 5% 상승 → 2차 추가 매수 → 또 5% 상승 → 3차 추가 매수' },
};

// 용어 툴팁 컴포넌트 - 마우스 호버 시 설명 표시
export const Term = ({ k, children, className = '' }: { k: string; children?: React.ReactNode; className?: string }) => {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState<'top' | 'bottom'>('top');
  const ref = useRef<HTMLSpanElement>(null);
  const entry = GLOSSARY[k];
  if (!entry) return <span className={className}>{children || k}</span>;

  const handleEnter = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPos(rect.top < 200 ? 'bottom' : 'top');
    }
    setShow(true);
  };

  return (
    <span ref={ref} className={`relative inline-flex items-center cursor-help ${className}`}
      onMouseEnter={handleEnter} onMouseLeave={() => setShow(false)}>
      <span className="border-b border-dashed border-whale-light/60 text-whale-light font-medium">
        {children || k}
      </span>
      <svg className="w-3 h-3 ml-0.5 text-whale-light/50 shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
      </svg>
      {show && (
        <span className={`absolute left-1/2 -translate-x-1/2 z-[100] w-72 px-4 py-3 rounded-xl shadow-2xl border border-whale-light/20 bg-white text-left pointer-events-none ${pos === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'}`}>
          <span className="block text-xs font-bold text-whale-dark mb-1">{entry.title}</span>
          <span className="block text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{entry.desc}</span>
          {entry.example && (
            <span className="block text-[11px] text-whale-light mt-1.5 pt-1.5 border-t border-gray-100 leading-relaxed">{entry.example}</span>
          )}
          <span className={`absolute left-1/2 -translate-x-1/2 w-2 h-2 bg-white border-whale-light/20 rotate-45 ${pos === 'top' ? 'bottom-[-5px] border-r border-b' : 'top-[-5px] border-l border-t'}`} />
        </span>
      )}
    </span>
  );
};
