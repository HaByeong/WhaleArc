import { useEffect, useRef, useState } from 'react';
import { createChart, AreaSeries, type IChartApi, type ISeriesApi, type AreaData, type Time } from 'lightweight-charts';
import { marketService } from '../services/marketService';

interface RealtimeChartProps {
  symbol: string;
  price: number;
  className?: string;
  isDark?: boolean;
}

const INTERVALS = [
  { label: '1분', value: '1m' },
  { label: '10분', value: '10m' },
  { label: '30분', value: '30m' },
  { label: '1시간', value: '1h' },
  { label: '1일', value: '1d' },
];

const RealtimeChart = ({ symbol, price, className = '', isDark = false }: RealtimeChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const dataRef = useRef<AreaData<Time>[]>([]);
  const prevSymbolRef = useRef<string>('');
  const prevIntervalRef = useRef<string>('');
  const [interval, setInterval] = useState('10m');
  const [historyLoaded, setHistoryLoaded] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: isDark ? '#0a1628' : '#ffffff' },
        textColor: isDark ? '#475569' : '#94a3b8',
        fontFamily: "'Pretendard', sans-serif",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9', style: 0 },
      },
      width: containerRef.current.clientWidth,
      height: 340,
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
        borderVisible: false,
        rightOffset: 5,
        shiftVisibleRangeOnNewBar: true,
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      crosshair: {
        mode: 0,
        horzLine: {
          color: 'rgba(74, 144, 226, 0.15)',
          labelBackgroundColor: '#4a90e2',
        },
        vertLine: {
          color: 'rgba(74, 144, 226, 0.15)',
          labelBackgroundColor: '#4a90e2',
        },
      },
    });

    const lineColor = isDark ? '#22d3ee' : '#4a90e2';
    const series = chart.addSeries(AreaSeries, {
      lineColor,
      lineWidth: 2,
      topColor: isDark ? 'rgba(34, 211, 238, 0.15)' : 'rgba(74, 144, 226, 0.2)',
      bottomColor: isDark ? 'rgba(34, 211, 238, 0.01)' : 'rgba(74, 144, 226, 0.01)',
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      crosshairMarkerBackgroundColor: lineColor,
      crosshairMarkerBorderColor: isDark ? '#0a1628' : '#ffffff',
      crosshairMarkerBorderWidth: 2,
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineColor: isDark ? 'rgba(34, 211, 238, 0.3)' : 'rgba(74, 144, 226, 0.3)',
      priceLineWidth: 1,
      priceLineStyle: 2,
      priceFormat: { type: 'price', precision: 0, minMove: 1 },
    });

    chartRef.current = chart;
    seriesRef.current = series as unknown as ISeriesApi<'Area'>;

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
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (prevSymbolRef.current === symbol && prevIntervalRef.current === interval) return;
    prevSymbolRef.current = symbol;
    prevIntervalRef.current = interval;
    dataRef.current = [];
    setHistoryLoaded(false);
    if (seriesRef.current) seriesRef.current.setData([]);

    marketService.getCandlesticks(symbol, interval)
      .then((candles) => {
        if (!seriesRef.current || prevSymbolRef.current !== symbol) return;
        const chartData: AreaData<Time>[] = candles.map((c) => ({ time: c.time as Time, value: c.close }));
        const uniqueData = chartData.reduce<AreaData<Time>[]>((acc, item) => {
          if (acc.length === 0 || acc[acc.length - 1].time !== item.time) acc.push(item);
          return acc;
        }, []);
        dataRef.current = uniqueData;
        seriesRef.current.setData(uniqueData);
        chartRef.current?.timeScale().scrollToRealTime();
        setHistoryLoaded(true);
      })
      .catch(() => setHistoryLoaded(true));
  }, [symbol, interval]);

  useEffect(() => {
    if (!seriesRef.current || !historyLoaded || !price || price === 0) return;
    const now = Math.floor(Date.now() / 1000) as Time;
    const newPoint: AreaData<Time> = { time: now, value: price };
    const lastPoint = dataRef.current[dataRef.current.length - 1];

    if (lastPoint && lastPoint.time === now) {
      dataRef.current[dataRef.current.length - 1] = newPoint;
    } else if (lastPoint && (lastPoint.time as number) > (now as number)) {
      const forcedTime = ((lastPoint.time as number) + 1) as Time;
      const forcedPoint: AreaData<Time> = { time: forcedTime, value: price };
      dataRef.current.push(forcedPoint);
      seriesRef.current.update(forcedPoint);
      return;
    } else {
      dataRef.current.push(newPoint);
    }
    if (dataRef.current.length > 2000) dataRef.current = dataRef.current.slice(-2000);
    seriesRef.current.update(newPoint);
    chartRef.current?.timeScale().scrollToRealTime();
  }, [price, historyLoaded]);

  return (
    <div className={className}>
      {/* 인터벌 + LIVE */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex space-x-1">
          {INTERVALS.map((iv) => (
            <button
              key={iv.value}
              onClick={() => setInterval(iv.value)}
              className={`px-3 py-1.5 text-xs rounded-full font-medium transition-all ${
                interval === iv.value
                  ? isDark ? 'bg-white/10 text-cyan-400' : 'bg-whale-light text-white shadow-sm'
                  : isDark ? 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]' : 'text-gray-400 hover:text-whale-dark hover:bg-gray-100'
              }`}
            >
              {iv.label}
            </button>
          ))}
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className={`text-[10px] font-medium ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>LIVE</span>
        </div>
      </div>

      {/* 차트 */}
      <div className="relative">
        <div ref={containerRef} className={`rounded-xl overflow-hidden border ${isDark ? 'border-white/[0.06]' : 'border-gray-100'}`} />
      </div>
    </div>
  );
};

export default RealtimeChart;
