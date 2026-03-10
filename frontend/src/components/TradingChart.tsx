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
  type IndicatorConfig,
  INDICATOR_COLORS,
} from '../utils/indicators';

interface TradingChartProps {
  symbol: string;
  price: number;
  changeRate: number;
  className?: string;
  assetType?: 'STOCK' | 'CRYPTO';
  activeIndicators?: string[];
}

const INTERVALS = [
  { label: '1분', value: '1m' },
  { label: '10분', value: '10m' },
  { label: '30분', value: '30m' },
  { label: '1시간', value: '1h' },
  { label: '24시간', value: '24h' },
];

/** 지표 설정값 해석 */
const INDICATOR_CONFIGS: Record<string, IndicatorConfig> = {
  'MA5': { type: 'MA', period: 5, maType: 'SMA' },
  'MA20': { type: 'MA', period: 20, maType: 'SMA' },
  'MA60': { type: 'MA', period: 60, maType: 'SMA' },
  'EMA12': { type: 'MA', period: 12, maType: 'EMA' },
  'EMA26': { type: 'MA', period: 26, maType: 'EMA' },
  'RSI': { type: 'RSI', period: 14 },
  'MACD': { type: 'MACD', fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
  'BOLLINGER': { type: 'BOLLINGER', period: 20, stdDev: 2 },
};

/** 가격대에 따라 소수점 정밀도 결정 */
const getPriceFormat = (p: number, type?: string) => {
  if (type === 'STOCK') return { type: 'price' as const, precision: 0, minMove: 1 };
  if (p >= 10000) return { type: 'price' as const, precision: 0, minMove: 1 };
  if (p >= 100) return { type: 'price' as const, precision: 1, minMove: 0.1 };
  if (p >= 1) return { type: 'price' as const, precision: 2, minMove: 0.01 };
  return { type: 'price' as const, precision: 4, minMove: 0.0001 };
};

const TradingChart = ({
  symbol, price, changeRate, className = '', assetType,
  activeIndicators = [],
}: TradingChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rsiContainerRef = useRef<HTMLDivElement>(null);
  const macdContainerRef = useRef<HTMLDivElement>(null);

  const chartRef = useRef<IChartApi | null>(null);
  const rsiChartRef = useRef<IChartApi | null>(null);
  const macdChartRef = useRef<IChartApi | null>(null);

  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  // 오버레이 시리즈 참조 (MA, 볼린저)
  const overlaySeriesRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());
  // RSI/MACD 시리즈 참조
  const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdLineRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdSignalRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdHistRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  const dataRef = useRef<CandlestickData<Time>[]>([]);
  const rawCandlesRef = useRef<Candlestick[]>([]);
  const prevSymbolRef = useRef('');
  const prevIntervalRef = useRef('');
  const [interval, setInterval] = useState('10m');
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const showRSI = activeIndicators.includes('RSI');
  const showMACD = activeIndicators.includes('MACD');

  // ─── 메인 차트 생성 ────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: '#ffffff' },
        textColor: '#6b7280',
        fontFamily: "'Pretendard', sans-serif",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: '#f3f4f6', style: 0 },
        horzLines: { color: '#f3f4f6', style: 0 },
      },
      width: containerRef.current.clientWidth,
      height: 340,
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
  }, []);

  // ─── RSI 차트 생성/제거 ────────────────────────────────
  useEffect(() => {
    if (showRSI && rsiContainerRef.current && !rsiChartRef.current) {
      const rChart = createChart(rsiContainerRef.current, {
        layout: { background: { color: '#ffffff' }, textColor: '#6b7280', fontFamily: "'Pretendard', sans-serif", fontSize: 10, attributionLogo: false },
        grid: { vertLines: { color: '#f9fafb' }, horzLines: { color: '#f3f4f6' } },
        width: rsiContainerRef.current.clientWidth,
        height: 100,
        timeScale: { visible: false },
        rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.1, bottom: 0.1 } },
        crosshair: { mode: 0 },
      });

      const rsiLine = rChart.addSeries(LineSeries, {
        color: INDICATOR_COLORS['RSI'],
        lineWidth: 1,
        priceFormat: { type: 'price', precision: 1, minMove: 0.1 },
        lastValueVisible: true,
        crosshairMarkerVisible: false,
      });

      rsiChartRef.current = rChart;
      rsiSeriesRef.current = rsiLine;

      const obs = new ResizeObserver((entries) => {
        for (const e of entries) rChart.applyOptions({ width: e.contentRect.width });
      });
      obs.observe(rsiContainerRef.current);

      return () => { obs.disconnect(); };
    }

    if (!showRSI && rsiChartRef.current) {
      rsiChartRef.current.remove();
      rsiChartRef.current = null;
      rsiSeriesRef.current = null;
    }
  }, [showRSI]);

  // ─── MACD 차트 생성/제거 ───────────────────────────────
  useEffect(() => {
    if (showMACD && macdContainerRef.current && !macdChartRef.current) {
      const mChart = createChart(macdContainerRef.current, {
        layout: { background: { color: '#ffffff' }, textColor: '#6b7280', fontFamily: "'Pretendard', sans-serif", fontSize: 10, attributionLogo: false },
        grid: { vertLines: { color: '#f9fafb' }, horzLines: { color: '#f3f4f6' } },
        width: macdContainerRef.current.clientWidth,
        height: 100,
        timeScale: { visible: false },
        rightPriceScale: { borderVisible: false },
        crosshair: { mode: 0 },
      });

      const macdLine = mChart.addSeries(LineSeries, {
        color: INDICATOR_COLORS['MACD'],
        lineWidth: 1,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });

      const signalLine = mChart.addSeries(LineSeries, {
        color: INDICATOR_COLORS['MACD_SIGNAL'],
        lineWidth: 1,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });

      const histSeries = mChart.addSeries(HistogramSeries, {
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });

      macdChartRef.current = mChart;
      macdLineRef.current = macdLine;
      macdSignalRef.current = signalLine;
      macdHistRef.current = histSeries;

      const obs = new ResizeObserver((entries) => {
        for (const e of entries) mChart.applyOptions({ width: e.contentRect.width });
      });
      obs.observe(macdContainerRef.current);

      return () => { obs.disconnect(); };
    }

    if (!showMACD && macdChartRef.current) {
      macdChartRef.current.remove();
      macdChartRef.current = null;
      macdLineRef.current = null;
      macdSignalRef.current = null;
      macdHistRef.current = null;
    }
  }, [showMACD]);

  // ─── 지표 계산 및 차트 적용 ────────────────────────────
  const applyIndicators = useCallback(() => {
    const chart = chartRef.current;
    if (!chart || rawCandlesRef.current.length === 0) return;

    const candles = rawCandlesRef.current;
    const closes = candles.map(c => c.close);
    const times = candles.map(c => c.time as Time);

    // 기존 오버레이 시리즈 제거
    overlaySeriesRef.current.forEach((series) => {
      try { chart.removeSeries(series); } catch { /* ignore */ }
    });
    overlaySeriesRef.current.clear();

    // MA 오버레이
    for (const key of activeIndicators) {
      const config = INDICATOR_CONFIGS[key];
      if (!config || config.type !== 'MA') continue;

      const values = config.maType === 'EMA' ? ema(closes, config.period) : sma(closes, config.period);
      const lineData: LineData<Time>[] = [];
      for (let i = 0; i < values.length; i++) {
        if (!isNaN(values[i])) lineData.push({ time: times[i], value: values[i] });
      }

      const series = chart.addSeries(LineSeries, {
        color: INDICATOR_COLORS[key] || '#9ca3af',
        lineWidth: 1,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
        priceLineVisible: false,
      });
      series.setData(lineData);
      overlaySeriesRef.current.set(key, series);
    }

    // 볼린저 밴드 오버레이
    if (activeIndicators.includes('BOLLINGER')) {
      const bb = bollingerBands(closes, 20, 2);
      const bands = [
        { key: 'BOLLINGER_UPPER', data: bb.upper },
        { key: 'BOLLINGER_MIDDLE', data: bb.middle },
        { key: 'BOLLINGER_LOWER', data: bb.lower },
      ];

      for (const band of bands) {
        const lineData: LineData<Time>[] = [];
        for (let i = 0; i < band.data.length; i++) {
          if (!isNaN(band.data[i])) lineData.push({ time: times[i], value: band.data[i] });
        }

        const series = chart.addSeries(LineSeries, {
          color: INDICATOR_COLORS[band.key] || '#6366f1',
          lineWidth: band.key === 'BOLLINGER_MIDDLE' ? 1 : 1,
          lineStyle: band.key === 'BOLLINGER_MIDDLE' ? 2 : 0, // 중간선 점선
          lastValueVisible: false,
          crosshairMarkerVisible: false,
          priceLineVisible: false,
        });
        series.setData(lineData);
        overlaySeriesRef.current.set(band.key, series);
      }
    }

    // RSI 서브차트
    if (showRSI && rsiSeriesRef.current) {
      const rsiResult = rsi(closes, 14);
      const rsiData: LineData<Time>[] = [];
      for (let i = 0; i < rsiResult.values.length; i++) {
        if (!isNaN(rsiResult.values[i])) rsiData.push({ time: times[i], value: rsiResult.values[i] });
      }
      rsiSeriesRef.current.setData(rsiData);
    }

    // MACD 서브차트
    if (showMACD && macdLineRef.current && macdSignalRef.current && macdHistRef.current) {
      const macdResult = macd(closes, 12, 26, 9);
      const macdData: LineData<Time>[] = [];
      const signalData: LineData<Time>[] = [];
      const histData: HistogramData<Time>[] = [];

      for (let i = 0; i < macdResult.macd.length; i++) {
        if (!isNaN(macdResult.macd[i])) macdData.push({ time: times[i], value: macdResult.macd[i] });
        if (!isNaN(macdResult.signal[i])) signalData.push({ time: times[i], value: macdResult.signal[i] });
        if (!isNaN(macdResult.histogram[i])) {
          histData.push({
            time: times[i],
            value: macdResult.histogram[i],
            color: macdResult.histogram[i] >= 0 ? 'rgba(239, 68, 68, 0.5)' : 'rgba(59, 130, 246, 0.5)',
          });
        }
      }

      macdLineRef.current.setData(macdData);
      macdSignalRef.current.setData(signalData);
      macdHistRef.current.setData(histData);
    }
  }, [activeIndicators, showRSI, showMACD]);

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

    marketService.getCandlesticks(symbol, interval, assetType)
      .then((candles: Candlestick[]) => {
        if (!candleSeriesRef.current || prevSymbolRef.current !== symbol) return;

        const seen = new Set<number>();
        const uniqueCandles = candles.filter(c => {
          if (seen.has(c.time)) return false;
          seen.add(c.time);
          return true;
        });

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

        if (candleData.length > 100) {
          const from = candleData[candleData.length - 100].time;
          const to = candleData[candleData.length - 1].time;
          chartRef.current?.timeScale().setVisibleRange({ from, to });
        } else {
          chartRef.current?.timeScale().fitContent();
        }
        setHistoryLoaded(true);
      })
      .catch(() => setHistoryLoaded(true));
  }, [symbol, interval, assetType]);

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
          <div className="text-xs text-gray-400 font-medium">일봉 (3개월)</div>
        ) : (
          <div className="flex space-x-1">
            {INTERVALS.map(iv => (
              <button
                key={iv.value}
                onClick={() => setInterval(iv.value)}
                className={`px-3 py-1.5 text-xs rounded-full font-medium transition-all ${
                  interval === iv.value
                    ? 'bg-whale-dark text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
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
        <div ref={containerRef} className="rounded-lg overflow-hidden border border-gray-100" />
      </div>

      {/* RSI 서브차트 */}
      {showRSI && (
        <div className="mt-1">
          <div className="flex items-center justify-between px-1 mb-0.5">
            <span className="text-[10px] font-semibold text-gray-400">RSI (14)</span>
            <div className="flex gap-3 text-[9px] text-gray-300">
              <span>과매수 70</span>
              <span>과매도 30</span>
            </div>
          </div>
          <div ref={rsiContainerRef} className="rounded-lg overflow-hidden border border-gray-100" />
        </div>
      )}

      {/* MACD 서브차트 */}
      {showMACD && (
        <div className="mt-1">
          <div className="flex items-center gap-3 px-1 mb-0.5">
            <span className="text-[10px] font-semibold text-gray-400">MACD (12, 26, 9)</span>
            <div className="flex items-center gap-1">
              <span className="w-2 h-0.5 bg-blue-500 rounded" />
              <span className="text-[9px] text-gray-300">MACD</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-0.5 bg-red-500 rounded" />
              <span className="text-[9px] text-gray-300">Signal</span>
            </div>
          </div>
          <div ref={macdContainerRef} className="rounded-lg overflow-hidden border border-gray-100" />
        </div>
      )}
    </div>
  );
};

export default TradingChart;
