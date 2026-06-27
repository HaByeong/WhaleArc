import StrategyDemoChart from './StrategyDemoChart';
import {
  TV, genWalk, sma, ema, bollinger, keltner, donchian, rsi, macd,
  type DemoSignal, type DemoLine,
} from './demoChartUtils';

/* 8개 전략 시뮬레이션 데모 — 공용 엔진(StrategyDemoChart)에 데이터·지표선·신호 설정만 전달하는 얇은 래퍼.
 * 시드 데이터라 매번 같은 시나리오가 재생된다(매수/매도 신호가 보이도록 추세를 짠다). */

const C = { amber: '#f7a21b', blue: '#2962ff', purple: '#9c6ade', gray: '#787b86', gold: '#f5d061', sonar: '#5b9dff' };

/* ── 초급: Buy & Hold ── */
export function BuyHoldChart() {
  return <StrategyDemoChart config={{
    legend: [{ color: TV.bull, label: '매수 후 계속 보유' }, { color: C.sonar, label: '보유 구간' }],
    build: (rng) => {
      const d = genWalk(rng, [{ len: 14, drift: -0.15, vol: 2 }, { len: 48, drift: 0.42, vol: 2.4 }, { len: 16, drift: -0.25, vol: 2.6 }, { len: 42, drift: 0.5, vol: 2.4 }]);
      const N = d.closes.length;
      const signals: DemoSignal[] = [
        { i: 5, price: d.closes[5], kind: 'buy', label: '매수 후 보유', sub: '시작 시점에 사서 그대로 보유' },
        { i: Math.floor(N * 0.5), price: d.closes[Math.floor(N * 0.5)], kind: 'mark', label: '보유 중', sub: '매매 타이밍을 잡지 않음', markColor: C.sonar },
        { i: N - 2, price: d.closes[N - 2], kind: 'mark', label: '계속 보유(미매도)', markColor: C.sonar },
      ];
      return { ...d, lines: [], signals };
    },
  }} />;
}

/* ── 초급: 트리플 EMA 추세 정렬 ── */
export function TripleEmaChart() {
  return <StrategyDemoChart config={{
    legend: [{ color: C.amber, label: '단기 EMA' }, { color: C.blue, label: '중기 EMA' }, { color: C.purple, label: '장기 EMA' }],
    build: (rng) => {
      const d = genWalk(rng, [{ len: 30, drift: -0.28, vol: 2.2 }, { len: 10, drift: 0.05, vol: 2 }, { len: 78, drift: 0.42, vol: 2.2 }]);
      const e1 = ema(d.closes, 10), e2 = ema(d.closes, 20), e3 = ema(d.closes, 60);
      let buy = -1;
      for (let i = 61; i < d.closes.length; i++) {
        if (e1[i - 1] != null && e2[i - 1] != null && e1[i] != null && e2[i] != null && e3[i] != null
          && e1[i - 1]! <= e2[i - 1]! && e1[i]! > e2[i]! && e2[i]! > e3[i]!) { buy = i; break; }
      }
      if (buy < 0) buy = Math.floor(d.closes.length * 0.7);
      const lines: DemoLine[] = [{ data: e1, color: C.amber }, { data: e2, color: C.blue }, { data: e3, color: C.purple }];
      const signals: DemoSignal[] = [{ i: buy, price: (e1[buy] ?? d.closes[buy])!, kind: 'buy', label: '정배열 + 골든크로스', sub: '단기>중기>장기로 줄 맞춘 상태에서 진입' }];
      return { ...d, lines, signals };
    },
  }} />;
}

/* ── 중급: 켈트너 채널 변동성 돌파 ── */
export function KeltnerChart() {
  return <StrategyDemoChart config={{
    legend: [{ color: C.blue, label: '상·하단 밴드(ATR)' }, { color: C.gray, label: '중심선 EMA20' }],
    build: (rng) => {
      const d = genWalk(rng, [{ len: 34, drift: 0, vol: 1.1 }, { len: 10, drift: 0.1, vol: 1.0 }, { len: 66, drift: 0.5, vol: 2.6 }]);
      const k = keltner(d.highs, d.lows, d.closes, 20, 2);
      let buy = -1;
      for (let i = 21; i < d.closes.length; i++) {
        if (k.up[i] != null && d.closes[i - 1] <= (k.up[i - 1] ?? Infinity) && d.closes[i] > k.up[i]!) { buy = i; break; }
      }
      if (buy < 0) buy = Math.floor(d.closes.length * 0.6);
      const lines: DemoLine[] = [{ data: k.up, color: C.blue }, { data: k.mid, color: C.gray, dash: true }, { data: k.lo, color: C.blue }];
      const signals: DemoSignal[] = [{ i: buy, price: d.closes[buy], kind: 'buy', label: '상단 밴드 돌파', sub: '평소 변동폭(ATR)보다 세게 위로 돌파' }];
      return { ...d, lines, signals };
    },
  }} />;
}

/* ── 고급: 볼린저 %b 레짐 평균회귀 ── */
export function BollingerPctBChart() {
  return <StrategyDemoChart config={{
    legend: [{ color: C.blue, label: '볼린저 상·하단' }, { color: C.gray, label: '중심선' }, { color: C.amber, label: '장기 추세선' }],
    build: (rng) => {
      const d = genWalk(rng, [{ len: 28, drift: 0.32, vol: 2 }, { len: 9, drift: -0.95, vol: 2.6 }, { len: 12, drift: 0.55, vol: 2.4 }, { len: 52, drift: 0.34, vol: 2.2 }]);
      const bb = bollinger(d.closes, 20, 2); const reg = sma(d.closes, 40);
      let buy = -1, sell = -1;
      for (let i = 40; i < d.closes.length; i++) { if (bb.lo[i] != null && d.closes[i] < bb.lo[i]!) { buy = i; break; } }
      if (buy < 0) buy = 45;
      for (let i = buy + 1; i < d.closes.length; i++) { if (bb.pctB[i] != null && bb.pctB[i]! >= 0.5) { sell = i; break; } }
      const lines: DemoLine[] = [{ data: bb.up, color: C.blue }, { data: bb.mid, color: C.gray, dash: true }, { data: bb.lo, color: C.blue }, { data: reg, color: C.amber }];
      const signals: DemoSignal[] = [{ i: buy, price: d.closes[buy], kind: 'buy', label: '하단 이탈 매수', sub: '상승추세(추세선 위)에서 과매도 → 일시적 할인' }];
      if (sell > 0) signals.push({ i: sell, price: d.closes[sell], kind: 'sell', label: '중심선 회귀 청산', sub: '제자리로 돌아오면 매도' });
      return { ...d, lines, signals };
    },
  }} />;
}

/* ── 고급: 멀티 오실레이터 컨플루언스 반전 ── */
export function OscillatorConfluenceChart() {
  return <StrategyDemoChart config={{
    legend: [{ color: C.amber, label: '장기 추세선' }, { color: TV.bull, label: '과매도 합의 매수' }],
    build: (rng) => {
      const d = genWalk(rng, [{ len: 28, drift: 0.32, vol: 2 }, { len: 10, drift: -1.0, vol: 2.6 }, { len: 12, drift: 0.55, vol: 2.4 }, { len: 56, drift: 0.3, vol: 2.2 }]);
      const reg = sma(d.closes, 40); const r = rsi(d.closes, 14);
      let buy = -1, lowR = 100;
      for (let i = 30; i < d.closes.length - 12; i++) { if (r[i] != null && r[i]! < lowR) { lowR = r[i]!; buy = i; } }
      const lines: DemoLine[] = [{ data: reg, color: C.amber }];
      const signals: DemoSignal[] = [{ i: buy < 0 ? 42 : buy, price: d.closes[buy < 0 ? 42 : buy], kind: 'buy', label: '4개 지표 과매도 합의', sub: 'RSI·스토캐스틱·윌리엄스·CCI 모두 과매도 + 추세선 위' }];
      return { ...d, lines, signals };
    },
  }} />;
}

/* ── 고급: MACD·RSI·EMA200 삼중 추세 게이트 ── */
export function MacdRsiGateChart() {
  return <StrategyDemoChart config={{
    legend: [{ color: C.amber, label: '추세선(EMA)' }, { color: TV.bull, label: '삼중 게이트 매수' }],
    build: (rng) => {
      const d = genWalk(rng, [{ len: 34, drift: -0.3, vol: 2.2 }, { len: 8, drift: 0, vol: 2 }, { len: 74, drift: 0.45, vol: 2.2 }]);
      const m = macd(d.closes); const reg = ema(d.closes, 50); const r = rsi(d.closes, 14);
      let buy = -1;
      for (let i = 50; i < d.closes.length; i++) {
        if (m.line[i - 1] != null && m.signal[i - 1] != null && m.line[i] != null && m.signal[i] != null && reg[i] != null && r[i] != null
          && m.line[i - 1]! <= m.signal[i - 1]! && m.line[i]! > m.signal[i]! && d.closes[i] > reg[i]! && r[i]! > 50) { buy = i; break; }
      }
      if (buy < 0) for (let i = 50; i < d.closes.length; i++) { if (reg[i] != null && d.closes[i] > reg[i]! && d.closes[i - 1] <= (reg[i - 1] ?? Infinity)) { buy = i; break; } }
      if (buy < 0) buy = Math.floor(d.closes.length * 0.7);
      const lines: DemoLine[] = [{ data: reg, color: C.amber }];
      const signals: DemoSignal[] = [{ i: buy, price: d.closes[buy], kind: 'buy', label: '삼중 게이트 통과', sub: '추세(EMA 위)·모멘텀(RSI>50)·MACD 골든크로스 동시' }];
      return { ...d, lines, signals };
    },
  }} />;
}

/* ── 고급: 터틀 트레이딩 (돈치안 돌파) ── */
export function TurtleChart() {
  return <StrategyDemoChart config={{
    legend: [{ color: C.blue, label: '진입 상단(20일 고가)' }, { color: C.amber, label: '청산 하단(10일 저가)' }],
    build: (rng) => {
      const d = genWalk(rng, [{ len: 30, drift: 0, vol: 1.6 }, { len: 6, drift: 0.7, vol: 2 }, { len: 34, drift: 0.42, vol: 2.2 }, { len: 9, drift: -0.8, vol: 2.6 }, { len: 30, drift: -0.1, vol: 2 }]);
      const dc = donchian(d.highs, d.lows, 20); const ex = donchian(d.highs, d.lows, 10);
      let buy = -1; for (let i = 21; i < d.closes.length; i++) { if (dc.up[i] != null && d.closes[i] > dc.up[i]!) { buy = i; break; } }
      if (buy < 0) buy = 38;
      let sell = -1; for (let i = buy + 5; i < d.closes.length; i++) { if (ex.lo[i] != null && d.closes[i] < ex.lo[i]!) { sell = i; break; } }
      const lines: DemoLine[] = [{ data: dc.up, color: C.blue }, { data: ex.lo, color: C.amber }];
      const signals: DemoSignal[] = [{ i: buy, price: d.closes[buy], kind: 'buy', label: '20일 고가 돌파 (롱)', sub: '한동안의 최고가를 뚫으면 추세 진입' }];
      if (sell > 0) signals.push({ i: sell, price: d.closes[sell], kind: 'sell', label: '10일 저가 이탈 (청산)', sub: '추세가 꺾이면 현금으로' });
      return { ...d, lines, signals };
    },
  }} />;
}

/* ── 고급: 미국주식 모멘텀 Top5 로테이션 ── */
export function MomentumRotationChart() {
  return <StrategyDemoChart config={{
    legend: [{ color: TV.bull, label: '내 바스켓(상위 5종)' }, { color: C.gray, label: '시장(벤치마크)' }, { color: C.gold, label: '리밸런싱' }],
    build: (rng) => {
      const d = genWalk(rng, [{ len: 6, drift: 0.1, vol: 1.2 }, { len: 112, drift: 0.46, vol: 2.0 }]);
      const N = d.closes.length;
      const bench: (number | null)[] = d.closes.map((_, i) => d.closes[0] * (1 + i * 0.0016));
      const signals: DemoSignal[] = [{ i: 4, price: d.closes[4], kind: 'buy', label: '최강 5종 매수', sub: '최근 1년 모멘텀 상위 5종목 균등 매수' }];
      for (let i = 26; i < N - 4; i += 26) signals.push({ i, price: d.closes[i], kind: 'mark', label: '리밸런싱', sub: '매달 새로 줄 세워 갈아탐', markColor: C.gold });
      const lines: DemoLine[] = [{ data: bench, color: C.gray, dash: true }];
      return { ...d, lines, signals };
    },
  }} />;
}
