import { useEffect, useRef } from 'react';
import { createChart, type IChartApi, type ISeriesApi, type LineData, type Time } from 'lightweight-charts';

interface RealtimeChartProps {
  symbol: string;
  price: number;
  className?: string;
}

const RealtimeChart = ({ symbol, price, className = '' }: RealtimeChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const dataRef = useRef<LineData<Time>[]>([]);
  const prevSymbolRef = useRef<string>('');

  // 차트 초기화
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: '#6b7280',
        fontFamily: "'Pretendard', sans-serif",
      },
      grid: {
        vertLines: { color: 'rgba(107, 114, 128, 0.1)' },
        horzLines: { color: 'rgba(107, 114, 128, 0.1)' },
      },
      width: containerRef.current.clientWidth,
      height: 300,
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
        borderColor: 'rgba(107, 114, 128, 0.2)',
      },
      rightPriceScale: {
        borderColor: 'rgba(107, 114, 128, 0.2)',
      },
      crosshair: {
        horzLine: { color: 'rgba(74, 144, 226, 0.3)' },
        vertLine: { color: 'rgba(74, 144, 226, 0.3)' },
      },
    });

    const series = chart.addAreaSeries({
      lineColor: '#4a90e2',
      topColor: 'rgba(74, 144, 226, 0.3)',
      bottomColor: 'rgba(74, 144, 226, 0.02)',
      lineWidth: 2,
      priceFormat: {
        type: 'price',
        precision: 0,
        minMove: 1,
      },
    });

    chartRef.current = chart;
    seriesRef.current = series;

    // 리사이즈 처리
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

  // 심볼이 바뀌면 데이터 초기화
  useEffect(() => {
    if (prevSymbolRef.current !== symbol) {
      dataRef.current = [];
      prevSymbolRef.current = symbol;
      if (seriesRef.current) {
        seriesRef.current.setData([]);
      }
    }
  }, [symbol]);

  // 가격 업데이트 시 차트에 데이터 추가
  useEffect(() => {
    if (!seriesRef.current || !price || price === 0) return;

    const now = Math.floor(Date.now() / 1000) as Time;
    const newPoint: LineData<Time> = { time: now, value: price };

    // 같은 초에 업데이트가 오면 마지막 데이터 교체
    const lastPoint = dataRef.current[dataRef.current.length - 1];
    if (lastPoint && lastPoint.time === now) {
      dataRef.current[dataRef.current.length - 1] = newPoint;
    } else {
      dataRef.current.push(newPoint);
    }

    // 최근 300개만 유지
    if (dataRef.current.length > 300) {
      dataRef.current = dataRef.current.slice(-300);
    }

    seriesRef.current.update(newPoint);
  }, [price]);

  return (
    <div ref={containerRef} className={className} />
  );
};

export default RealtimeChart;
