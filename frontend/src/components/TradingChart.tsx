import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type LineData,
  type Time,
} from 'lightweight-charts';
import { marketService, type Candlestick } from '../services/marketService';
import {
  sma, ema, rsi, macd, bollingerBands,
  stochastic, atr, obv, vwap, williamsR, cci, parabolicSAR, ichimoku,
  type IndicatorConfig,
  INDICATOR_COLORS,
} from '../utils/indicators';

interface TradingChartProps {
  symbol: string;
  price: number;
  changeRate: number;
  className?: string;
  assetType?: 'STOCK' | 'CRYPTO' | 'US_STOCK' | 'ETF';
  activeIndicators?: string[];
  isDark?: boolean;
}

const INTERVALS = [
  { label: '1분', value: '1m' },
  { label: '10분', value: '10m' },
  { label: '30분', value: '30m' },
  { label: '1시간', value: '1h' },
  { label: '1일', value: '1d' },
];

const STOCK_PERIODS = [
  { label: '1개월', months: 1 },
  { label: '3개월', months: 3 },
  { label: '6개월', months: 6 },
  { label: '1년', months: 12 },
  { label: '2년', months: 24 },
];

/** 지표 설정값 해석 */
const INDICATOR_CONFIGS: Record<string, IndicatorConfig> = {
  'MA5': { type: 'MA', period: 5, maType: 'SMA' },
  'MA20': { type: 'MA', period: 20, maType: 'SMA' },
  'MA60': { type: 'MA', period: 60, maType: 'SMA' },
  'EMA': { type: 'MA', period: 20, maType: 'EMA' },
  'RSI': { type: 'RSI', period: 14 },
  'MACD': { type: 'MACD', fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
  'BOLLINGER': { type: 'BOLLINGER', period: 20, stdDev: 2 },
  'STOCHASTIC': { type: 'STOCHASTIC', kPeriod: 14, dPeriod: 3 },
  'ATR': { type: 'ATR', period: 14 },
  'OBV': { type: 'OBV' },
  'VWAP': { type: 'VWAP' },
  'WILLIAMS_R': { type: 'WILLIAMS_R', period: 14 },
  'CCI': { type: 'CCI', period: 20 },
  'PARABOLIC_SAR': { type: 'PARABOLIC_SAR', af: 0.02, maxAf: 0.2 },
  'ICHIMOKU': { type: 'ICHIMOKU', tenkan: 9, kijun: 26, senkouB: 52 },
};

/** 서브차트 지표 목록 */
const SUB_CHART_KEYS = ['RSI', 'MACD', 'STOCHASTIC', 'ATR', 'OBV', 'WILLIAMS_R', 'CCI'] as const;

/** 서브차트 라벨 정보 */
const SUB_CHART_LABELS: Record<string, { label: string; guide?: string[] }> = {
  RSI: { label: 'RSI (14)', guide: ['과매수 70', '과매도 30'] },
  MACD: { label: 'MACD (12, 26, 9)' },
  STOCHASTIC: { label: 'Stochastic (14, 3)', guide: ['과매수 80', '과매도 20'] },
  ATR: { label: 'ATR (14)' },
  OBV: { label: 'OBV' },
  WILLIAMS_R: { label: 'Williams %R (14)', guide: ['과매수 -20', '과매도 -80'] },
  CCI: { label: 'CCI (20)', guide: ['+100', '-100'] },
};

/** 가격대에 따라 소수점 정밀도 결정 */
const getPriceFormat = (p: number, type?: string) => {
  if (type === 'STOCK') return { type: 'price' as const, precision: 0, minMove: 1 };
  // 미국주식·ETF 는 USD 단위 (소수점 2자리)
  if (type === 'US_STOCK' || type === 'ETF') return { type: 'price' as const, precision: 2, minMove: 0.01 };
  if (p >= 10000) return { type: 'price' as const, precision: 0, minMove: 1 };
  if (p >= 100) return { type: 'price' as const, precision: 1, minMove: 0.1 };
  if (p >= 1) return { type: 'price' as const, precision: 2, minMove: 0.01 };
  return { type: 'price' as const, precision: 4, minMove: 0.0001 };
};

interface SubChartInfo {
  chart: IChartApi;
  series: Map<string, ISeriesApi<'Line' | 'Histogram'>>;
  obs: ResizeObserver;
}

const TradingChart = ({
  symbol, price, changeRate, className = '', assetType,
  activeIndicators = [], isDark = false,
}: TradingChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  // 오버레이 시리즈 참조 (MA, 볼린저, VWAP, Ichimoku, Parabolic SAR)
  const overlaySeriesRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());

  // 제네릭 서브차트 시스템
  const subContainersRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const subChartsRef = useRef<Map<string, SubChartInfo>>(new Map());

  const dataRef = useRef<CandlestickData<Time>[]>([]);
  const rawCandlesRef = useRef<Candlestick[]>([]);
  const prevSymbolRef = useRef('');
  const prevIntervalRef = useRef('');
  const [interval, setInterval] = useState('10m');
  const [stockPeriod, setStockPeriod] = useState(3);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // 활성 서브차트 목록
  const activeSubCharts = activeIndicators.filter(k =>
    (SUB_CHART_KEYS as readonly string[]).includes(k)
  );

  // ─── 메인 차트 생성 ────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: isDark ? '#0a1628' : '#ffffff' },
        textColor: isDark ? '#475569' : '#6b7280',
        fontFamily: "'Pretendard', sans-serif",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: isDark ? 'rgba(255,255,255,0.04)' : '#f3f4f6', style: 0 },
        horzLines: { color: isDark ? 'rgba(255,255,255,0.04)' : '#f3f4f6', style: 0 },
      },
      width: containerRef.current.clientWidth,
      height: window.innerWidth < 640 ? 240 : 340,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderVisible: false,
        rightOffset: 3,
        shiftVisibleRangeOnNewBar: true,
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.05, bottom: 0.2 },
      },
      crosshair: {
        mode: 0,
        horzLine: { color: 'rgba(107, 114, 128, 0.2)', labelBackgroundColor: '#374151' },
        vertLine: { color: 'rgba(107, 114, 128, 0.2)', labelBackgroundColor: '#374151' },
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#ef4444',
      downColor: '#3b82f6',
      borderUpColor: '#ef4444',
      borderDownColor: '#3b82f6',
      wickUpColor: '#ef4444',
      wickDownColor: '#3b82f6',
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineColor: 'rgba(107, 114, 128, 0.3)',
      priceLineWidth: 1,
      priceLineStyle: 2,
      priceFormat: getPriceFormat(price, assetType),
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });

    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chart.applyOptions({ width: entry.contentRect.width });
      }
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      overlaySeriesRef.current.clear();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── 테마 변경 시 차트 색상만 업데이트 ─────────────────
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.applyOptions({
        layout: {
          background: { color: isDark ? '#0a1628' : '#ffffff' },
          textColor: isDark ? '#475569' : '#6b7280',
        },
        grid: {
          vertLines: { color: isDark ? 'rgba(255,255,255,0.04)' : '#f3f4f6' },
          horzLines: { color: isDark ? 'rgba(255,255,255,0.04)' : '#f3f4f6' },
        },
      });
    }
    for (const [, info] of subChartsRef.current.entries()) {
      info.chart.applyOptions({
        layout: {
          background: { color: isDark ? '#0a1628' : '#ffffff' },
          textColor: isDark ? '#475569' : '#6b7280',
        },
        grid: {
          vertLines: { color: isDark ? 'rgba(255,255,255,0.03)' : '#f9fafb' },
          horzLines: { color: isDark ? 'rgba(255,255,255,0.04)' : '#f3f4f6' },
        },
      });
    }
  }, [isDark]);

  // ─── 서브차트 생성/제거 (제네릭) ──────────────────────
  useEffect(() => {
    const currentKeys = new Set(activeSubCharts);

    // 비활성 서브차트 제거
    for (const [key, info] of subChartsRef.current.entries()) {
      if (!currentKeys.has(key)) {
        info.obs.disconnect();
        info.chart.remove();
        subChartsRef.current.delete(key);
      }
    }

    // 새 서브차트 생성
    for (const key of activeSubCharts) {
      if (subChartsRef.current.has(key)) continue;
      const container = subContainersRef.current.get(key);
      if (!container) continue;

      const subChart = createChart(container, {
        layout: { background: { color: isDark ? '#0a1628' : '#ffffff' }, textColor: isDark ? '#475569' : '#6b7280', fontFamily: "'Pretendard', sans-serif", fontSize: 10, attributionLogo: false },
        grid: { vertLines: { color: isDark ? 'rgba(255,255,255,0.03)' : '#f9fafb' }, horzLines: { color: isDark ? 'rgba(255,255,255,0.04)' : '#f3f4f6' } },
        width: container.clientWidth,
        height: window.innerWidth < 640 ? 60 : 100,
        timeScale: { visible: false },
        rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.1, bottom: 0.1 } },
        crosshair: { mode: 0 },
      });

      const series = new Map<string, ISeriesApi<'Line' | 'Histogram'>>();
      const lineOpts = { lineWidth: 1 as const, lastValueVisible: false, crosshairMarkerVisible: false };

      switch (key) {
        case 'RSI':
          series.set('main', subChart.addSeries(LineSeries, { ...lineOpts, color: INDICATOR_COLORS['RSI'], lastValueVisible: true }));
          break;
        case 'STOCHASTIC':
          series.set('k', subChart.addSeries(LineSeries, { ...lineOpts, color: INDICATOR_COLORS['STOCHASTIC_K'] }));
          series.set('d', subChart.addSeries(LineSeries, { ...lineOpts, color: INDICATOR_COLORS['STOCHASTIC_D'] }));
          break;
        case 'WILLIAMS_R':
          series.set('main', subChart.addSeries(LineSeries, { ...lineOpts, color: INDICATOR_COLORS['WILLIAMS_R'], lastValueVisible: true }));
          break;
        case 'CCI':
          series.set('main', subChart.addSeries(LineSeries, { ...lineOpts, color: INDICATOR_COLORS['CCI'], lastValueVisible: true }));
          break;
        case 'ATR':
          series.set('main', subChart.addSeries(LineSeries, { ...lineOpts, color: INDICATOR_COLORS['ATR'], lastValueVisible: true }));
          break;
        case 'OBV':
          series.set('main', subChart.addSeries(LineSeries, { ...lineOpts, color: INDICATOR_COLORS['OBV'], lastValueVisible: true }));
          break;
        case 'MACD':
          series.set('macd', subChart.addSeries(LineSeries, { ...lineOpts, color: INDICATOR_COLORS['MACD'] }));
          series.set('signal', subChart.addSeries(LineSeries, { ...lineOpts, color: INDICATOR_COLORS['MACD_SIGNAL'] }));
          series.set('histogram', subChart.addSeries(HistogramSeries, { ...lineOpts, lastValueVisible: false }));
          break;
      }

      const obs = new ResizeObserver(entries => {
        for (const e of entries) subChart.applyOptions({ width: e.contentRect.width });
      });
      obs.observe(container);

      subChartsRef.current.set(key, { chart: subChart, series, obs });
    }

    // 새 차트에 데이터 적용
    setTimeout(() => applyIndicators(), 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubCharts.join(',')]);

  // 언마운트 시 서브차트 전체 정리
  useEffect(() => {
    return () => {
      for (const [, info] of subChartsRef.current.entries()) {
        info.obs.disconnect();
        info.chart.remove();
      }
      subChartsRef.current.clear();
    };
  }, []);

  // ─── 지표 계산 및 차트 적용 ────────────────────────────
  const applyIndicators = useCallback(() => {
    const chart = chartRef.current;
    if (!chart || rawCandlesRef.current.length === 0) return;

    const candles = rawCandlesRef.current;
    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const volumes = candles.map(c => c.volume);
    const times = candles.map(c => c.time as Time);

    // ─ 기존 오버레이 시리즈 제거
    overlaySeriesRef.current.forEach((series) => {
      try { chart.removeSeries(series); } catch { /* ignore */ }
    });
    overlaySeriesRef.current.clear();

    // 유틸: 값 배열 → LineData
    const toLineData = (values: number[]): LineData<Time>[] => {
      const data: LineData<Time>[] = [];
      for (let i = 0; i < values.length; i++) {
        if (!isNaN(values[i])) data.push({ time: times[i], value: values[i] });
      }
      return data;
    };

    const addOverlay = (key: string, values: number[], opts?: Record<string, unknown>) => {
      const lineData = toLineData(values);
      if (lineData.length === 0) return;
      const series = chart.addSeries(LineSeries, {
        color: INDICATOR_COLORS[key] || '#9ca3af',
        lineWidth: 1 as const,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
        priceLineVisible: false,
        ...opts,
      });
      series.setData(lineData);
      overlaySeriesRef.current.set(key, series);
    };

    // ─ MA 오버레이
    for (const key of activeIndicators) {
      const config = INDICATOR_CONFIGS[key];
      if (!config || config.type !== 'MA') continue;
      const values = config.maType === 'EMA' ? ema(closes, config.period) : sma(closes, config.period);
      addOverlay(key, values);
    }

    // ─ 볼린저 밴드 오버레이
    if (activeIndicators.includes('BOLLINGER')) {
      const bb = bollingerBands(closes, 20, 2);
      addOverlay('BOLLINGER_UPPER', bb.upper);
      addOverlay('BOLLINGER_MIDDLE', bb.middle, { lineStyle: 2 });
      addOverlay('BOLLINGER_LOWER', bb.lower);
    }

    // ─ VWAP 오버레이
    if (activeIndicators.includes('VWAP')) {
      const v = vwap(highs, lows, closes, volumes);
      addOverlay('VWAP', v.values, { color: INDICATOR_COLORS['VWAP'], lineWidth: 2 as const });
    }

    // ─ Parabolic SAR 오버레이
    if (activeIndicators.includes('PARABOLIC_SAR')) {
      const sar = parabolicSAR(highs, lows);
      addOverlay('PARABOLIC_SAR', sar.values, { color: INDICATOR_COLORS['PARABOLIC_SAR'], lineStyle: 3 });
    }

    // ─ 일목균형표 오버레이
    if (activeIndicators.includes('ICHIMOKU')) {
      const ichi = ichimoku(highs, lows, closes);
      addOverlay('ICHIMOKU_TENKAN', ichi.tenkan, { color: INDICATOR_COLORS['ICHIMOKU_TENKAN'] });
      addOverlay('ICHIMOKU_KIJUN', ichi.kijun, { color: INDICATOR_COLORS['ICHIMOKU_KIJUN'] });
      addOverlay('ICHIMOKU_SENKOU_A', ichi.senkouA, { color: INDICATOR_COLORS['ICHIMOKU_SENKOU_A'], lineStyle: 2 });
      addOverlay('ICHIMOKU_SENKOU_B', ichi.senkouB, { color: INDICATOR_COLORS['ICHIMOKU_SENKOU_B'], lineStyle: 2 });
      addOverlay('ICHIMOKU_CHIKOU', ichi.chikou, { color: INDICATOR_COLORS['ICHIMOKU_CHIKOU'], lineStyle: 1 });
    }

    // ─ 서브차트 데이터 적용
    for (const key of activeSubCharts) {
      const info = subChartsRef.current.get(key);
      if (!info) continue;

      switch (key) {
        case 'RSI': {
          const r = rsi(closes, 14);
          info.series.get('main')?.setData(toLineData(r.values));
          break;
        }
        case 'STOCHASTIC': {
          const s = stochastic(highs, lows, closes, 14, 3);
          info.series.get('k')?.setData(toLineData(s.k));
          info.series.get('d')?.setData(toLineData(s.d));
          break;
        }
        case 'WILLIAMS_R': {
          const w = williamsR(highs, lows, closes, 14);
          info.series.get('main')?.setData(toLineData(w.values));
          break;
        }
        case 'CCI': {
          const c = cci(highs, lows, closes, 20);
          info.series.get('main')?.setData(toLineData(c.values));
          break;
        }
        case 'ATR': {
          const a = atr(highs, lows, closes, 14);
          info.series.get('main')?.setData(toLineData(a.values));
          break;
        }
        case 'OBV': {
          const o = obv(closes, volumes);
          info.series.get('main')?.setData(toLineData(o.values));
          break;
        }
        case 'MACD': {
          const m = macd(closes, 12, 26, 9);
          info.series.get('macd')?.setData(toLineData(m.macd));
          info.series.get('signal')?.setData(toLineData(m.signal));

          const histData: HistogramData<Time>[] = [];
          for (let i = 0; i < m.histogram.length; i++) {
            if (!isNaN(m.histogram[i])) {
              histData.push({
                time: times[i],
                value: m.histogram[i],
                color: m.histogram[i] >= 0 ? 'rgba(239, 68, 68, 0.5)' : 'rgba(59, 130, 246, 0.5)',
              });
            }
          }
          info.series.get('histogram')?.setData(histData);
          break;
        }
      }
    }
  }, [activeIndicators, activeSubCharts]);

  // 지표 변경 시 재적용
  useEffect(() => {
    if (historyLoaded) applyIndicators();
  }, [activeIndicators, historyLoaded, applyIndicators]);

  // 종목 변경 시 가격 정밀도 업데이트
  useEffect(() => {
    if (candleSeriesRef.current && price > 0) {
      candleSeriesRef.current.applyOptions({ priceFormat: getPriceFormat(price, assetType) });
    }
  }, [symbol, price, assetType]);

  // ─── 캔들 데이터 로드 ──────────────────────────────────
  useEffect(() => {
    if (prevSymbolRef.current === symbol && prevIntervalRef.current === interval) return;
    prevSymbolRef.current = symbol;
    prevIntervalRef.current = interval;
    dataRef.current = [];
    rawCandlesRef.current = [];
    setHistoryLoaded(false);
    if (candleSeriesRef.current) candleSeriesRef.current.setData([]);
    if (volumeSeriesRef.current) volumeSeriesRef.current.setData([]);

    setChartError(null);
    marketService.getCandlesticks(symbol, interval, assetType)
      .then((candles: Candlestick[]) => {
        if (!candleSeriesRef.current || prevSymbolRef.current !== symbol) return;

        const seen = new Set<number>();
        const uniqueCandles = candles.filter(c => {
          if (seen.has(c.time)) return false;
          seen.add(c.time);
          return true;
        });

        if (uniqueCandles.length === 0) {
          setChartError('차트 데이터를 불러올 수 없습니다.');
          setHistoryLoaded(true);
          return;
        }

        rawCandlesRef.current = uniqueCandles;

        const candleData: CandlestickData<Time>[] = uniqueCandles.map(c => ({
          time: c.time as Time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));

        const volumeData: HistogramData<Time>[] = uniqueCandles.map(c => ({
          time: c.time as Time,
          value: c.volume,
          color: c.close >= c.open ? 'rgba(239, 68, 68, 0.3)' : 'rgba(59, 130, 246, 0.3)',
        }));

        dataRef.current = candleData;
        candleSeriesRef.current!.setData(candleData);
        volumeSeriesRef.current!.setData(volumeData);

        if (assetType === 'STOCK' && candleData.length > 0) {
          const cutoff = Math.floor(Date.now() / 1000) - stockPeriod * 30 * 24 * 60 * 60;
          const from = (candleData.find(c => (c.time as number) >= cutoff)?.time ?? candleData[0].time);
          const to = candleData[candleData.length - 1].time;
          chartRef.current?.timeScale().setVisibleRange({ from, to });
        } else if (candleData.length > 100) {
          const from = candleData[candleData.length - 100].time;
          const to = candleData[candleData.length - 1].time;
          chartRef.current?.timeScale().setVisibleRange({ from, to });
        } else {
          chartRef.current?.timeScale().fitContent();
        }
        setChartError(null);
        setHistoryLoaded(true);
      })
      .catch((err) => {
        const msg = err?.code === 'ECONNABORTED'
          ? '서버 응답 시간이 초과되었습니다.'
          : '차트 데이터를 불러오지 못했습니다.';
        setChartError(msg);
        setHistoryLoaded(true);
      });
  }, [symbol, interval, assetType, retryCount]);

  // ─── 주식 기간 변경 시 visible range 업데이트 ──────────
  useEffect(() => {
    if (assetType !== 'STOCK' || !historyLoaded || dataRef.current.length === 0) return;
    const cutoff = Math.floor(Date.now() / 1000) - stockPeriod * 30 * 24 * 60 * 60;
    const from = (dataRef.current.find(c => (c.time as number) >= cutoff)?.time ?? dataRef.current[0].time);
    const to = dataRef.current[dataRef.current.length - 1].time;
    chartRef.current?.timeScale().setVisibleRange({ from, to });
  }, [stockPeriod, assetType, historyLoaded]);

  // ─── 실시간 가격 업데이트 ──────────────────────────────
  useEffect(() => {
    if (!candleSeriesRef.current || !historyLoaded || !price || price === 0) return;
    const now = Math.floor(Date.now() / 1000) as Time;
    const lastCandle = dataRef.current[dataRef.current.length - 1];

    if (lastCandle && (lastCandle.time as number) > (now as number)) {
      const forcedTime = ((lastCandle.time as number) + 1) as Time;
      const updatedCandle: CandlestickData<Time> = { time: forcedTime, open: price, high: price, low: price, close: price };
      dataRef.current.push(updatedCandle);
      candleSeriesRef.current.update(updatedCandle);
      return;
    }

    if (lastCandle && lastCandle.time === now) {
      lastCandle.high = Math.max(lastCandle.high, price);
      lastCandle.low = Math.min(lastCandle.low, price);
      lastCandle.close = price;
      candleSeriesRef.current.update(lastCandle);
    } else {
      const newCandle: CandlestickData<Time> = { time: now, open: price, high: price, low: price, close: price };
      dataRef.current.push(newCandle);
      candleSeriesRef.current.update(newCandle);
    }

    if (dataRef.current.length > 2000) dataRef.current = dataRef.current.slice(-2000);
    chartRef.current?.timeScale().scrollToRealTime();
  }, [price, historyLoaded]);

  return (
    <div className={className}>
      {/* 인터벌 선택 + LIVE 표시 */}
      <div className="flex items-center justify-between mb-3">
        {assetType === 'STOCK' ? (
          <div className="flex items-center space-x-1">
            <span className={`text-xs mr-1 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>일봉</span>
            {STOCK_PERIODS.map(p => (
              <button
                key={p.months}
                onClick={() => setStockPeriod(p.months)}
                className={`px-3 py-1.5 text-xs rounded-full font-medium transition-all ${
                  stockPeriod === p.months
                    ? isDark ? 'bg-white/10 text-cyan-400' : 'bg-whale-dark text-white shadow-sm'
                    : isDark ? 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex space-x-1">
            {INTERVALS.map(iv => (
              <button
                key={iv.value}
                onClick={() => setInterval(iv.value)}
                className={`px-3 py-1.5 text-xs rounded-full font-medium transition-all ${
                  interval === iv.value
                    ? isDark ? 'bg-white/10 text-cyan-400' : 'bg-whale-dark text-white shadow-sm'
                    : isDark ? 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                }`}
              >
                {iv.label}
              </button>
            ))}
          </div>
        )}
        {assetType !== 'STOCK' && (
          <div className="flex items-center space-x-1.5">
            <span className={`inline-block w-1.5 h-1.5 rounded-full animate-pulse ${changeRate >= 0 ? 'bg-red-500' : 'bg-blue-500'}`} />
            <span className="text-[10px] text-gray-400 font-medium">LIVE</span>
          </div>
        )}
      </div>

      {/* 메인 차트 */}
      <div className="relative">
        <div ref={containerRef} className={`rounded-lg overflow-hidden border ${isDark ? 'border-white/[0.06]' : 'border-gray-100'}`} />
        {!historyLoaded && !chartError && (
          <div className={`absolute inset-0 flex flex-col items-center justify-center rounded-lg z-10 ${
            isDark ? 'bg-[#0a1628]' : 'bg-white'
          }`}>
            <div className={`w-5 h-5 border-2 border-t-transparent rounded-full animate-spin mb-3 ${
              isDark ? 'border-cyan-400' : 'border-blue-400'
            }`} />
            <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>차트 데이터를 불러오는 중...</p>
          </div>
        )}
        {chartError && (
          <div className={`absolute inset-0 flex flex-col items-center justify-center rounded-lg z-10 ${
            isDark ? 'bg-[#0a1628]/95' : 'bg-white/90'
          }`}>
            <svg className={`w-8 h-8 mb-2 ${isDark ? 'text-slate-600' : 'text-gray-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <p className={`text-sm mb-2 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{chartError}</p>
            <button
              onClick={() => {
                prevSymbolRef.current = '';
                prevIntervalRef.current = '';
                setRetryCount(c => c + 1);
              }}
              className={`px-4 py-1.5 text-xs font-medium rounded-full transition-colors ${
                isDark ? 'text-cyan-400 bg-cyan-400/10 hover:bg-cyan-400/20 border border-cyan-400/20' : 'text-white bg-blue-500 hover:bg-blue-600'
              }`}
            >
              다시 시도
            </button>
          </div>
        )}
      </div>

      {/* 서브차트 (제네릭 렌더링) */}
      {activeSubCharts.map(key => {
        const meta = SUB_CHART_LABELS[key];
        return (
          <div key={key} className="mt-1">
            <div className="flex items-center justify-between px-1 mb-0.5">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-semibold text-gray-400">{meta?.label ?? key}</span>
                {key === 'MACD' && (
                  <>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-0.5 bg-blue-500 rounded" />
                      <span className="text-[9px] text-gray-300">MACD</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-0.5 bg-red-500 rounded" />
                      <span className="text-[9px] text-gray-300">Signal</span>
                    </div>
                  </>
                )}
                {key === 'STOCHASTIC' && (
                  <>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-0.5 bg-blue-500 rounded" />
                      <span className="text-[9px] text-gray-300">%K</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-0.5 bg-red-500 rounded" />
                      <span className="text-[9px] text-gray-300">%D</span>
                    </div>
                  </>
                )}
              </div>
              {meta?.guide && (
                <div className="flex gap-3 text-[9px] text-gray-300">
                  {meta.guide.map(g => <span key={g}>{g}</span>)}
                </div>
              )}
            </div>
            <div
              ref={el => {
                if (el) subContainersRef.current.set(key, el);
                else subContainersRef.current.delete(key);
              }}
              className="rounded-lg overflow-hidden border border-gray-100"
            />
          </div>
        );
      })}
    </div>
  );
};

export default TradingChart;
