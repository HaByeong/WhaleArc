import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type Time,
} from 'lightweight-charts';
import { marketService, type Candlestick } from '../services/marketService';

interface TradingChartProps {
  symbol: string;
  price: number;
  changeRate: number;
  className?: string;
}

const INTERVALS = [
  { label: '1분', value: '1m' },
  { label: '10분', value: '10m' },
  { label: '30분', value: '30m' },
  { label: '1시간', value: '1h' },
  { label: '24시간', value: '24h' },
];

const TradingChart = ({ symbol, price, changeRate, className = '' }: TradingChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<typeof CandlestickSeries> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<typeof HistogramSeries> | null>(null);
  const dataRef = useRef<CandlestickData<Time>[]>([]);
  const prevSymbolRef = useRef('');
  const prevIntervalRef = useRef('');
  const [interval, setInterval] = useState('10m');
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // 차트 생성
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
        horzLine: {
          color: 'rgba(107, 114, 128, 0.2)',
          labelBackgroundColor: '#374151',
        },
        vertLine: {
          color: 'rgba(107, 114, 128, 0.2)',
          labelBackgroundColor: '#374151',
        },
      },
    });

    // 캔들스틱 시리즈
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
      priceFormat: { type: 'price', precision: 0, minMove: 1 },
    });

    // 거래량 시리즈
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
    };
  }, []);

  // 캔들 데이터 로드
  useEffect(() => {
    if (prevSymbolRef.current === symbol && prevIntervalRef.current === interval) return;
    prevSymbolRef.current = symbol;
    prevIntervalRef.current = interval;
    dataRef.current = [];
    setHistoryLoaded(false);
    if (candleSeriesRef.current) candleSeriesRef.current.setData([]);
    if (volumeSeriesRef.current) volumeSeriesRef.current.setData([]);

    marketService.getCandlesticks(symbol, interval)
      .then((candles: Candlestick[]) => {
        if (!candleSeriesRef.current || prevSymbolRef.current !== symbol) return;

        // 중복 시간 제거 + 정렬
        const seen = new Set<number>();
        const uniqueCandles = candles.filter(c => {
          if (seen.has(c.time)) return false;
          seen.add(c.time);
          return true;
        });

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
        chartRef.current?.timeScale().scrollToRealTime();
        setHistoryLoaded(true);
      })
      .catch(() => setHistoryLoaded(true));
  }, [symbol, interval]);

  // 실시간 가격 업데이트
  useEffect(() => {
    if (!candleSeriesRef.current || !historyLoaded || !price || price === 0) return;
    const now = Math.floor(Date.now() / 1000) as Time;
    const lastCandle = dataRef.current[dataRef.current.length - 1];

    if (lastCandle && (lastCandle.time as number) > (now as number)) {
      // 시간 역전 방지
      const forcedTime = ((lastCandle.time as number) + 1) as Time;
      const updatedCandle: CandlestickData<Time> = {
        time: forcedTime,
        open: price,
        high: price,
        low: price,
        close: price,
      };
      dataRef.current.push(updatedCandle);
      candleSeriesRef.current.update(updatedCandle);
      return;
    }

    if (lastCandle && lastCandle.time === now) {
      // 같은 시간 → 캔들 업데이트
      lastCandle.high = Math.max(lastCandle.high, price);
      lastCandle.low = Math.min(lastCandle.low, price);
      lastCandle.close = price;
      candleSeriesRef.current.update(lastCandle);
    } else {
      // 새 캔들
      const newCandle: CandlestickData<Time> = {
        time: now,
        open: price,
        high: price,
        low: price,
        close: price,
      };
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
        <div className="flex items-center space-x-1.5">
          <span className={`inline-block w-1.5 h-1.5 rounded-full animate-pulse ${changeRate >= 0 ? 'bg-red-500' : 'bg-blue-500'}`} />
          <span className="text-[10px] text-gray-400 font-medium">LIVE</span>
        </div>
      </div>

      {/* 차트 영역 */}
      <div className="relative">
        <div ref={containerRef} className="rounded-lg overflow-hidden border border-gray-100" />
      </div>
    </div>
  );
};

export default TradingChart;
