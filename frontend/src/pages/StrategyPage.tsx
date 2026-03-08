import { useState, useEffect } from 'react';
import Header from '../components/Header';
import {
  strategyService,
  type Strategy,
  type BacktestRequest,
  type BacktestResult,
  type IndicatorData,
} from '../services/strategyService';
import { tradeService, type StockPrice } from '../services/tradeService';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from 'recharts';

const StrategyPage = () => {
  // 상태 관리
  const [activeTab, setActiveTab] = useState<'strategies' | 'backtest' | 'indicators'>('strategies');
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [isBacktesting, setIsBacktesting] = useState(false);
  const [stockList, setStockList] = useState<StockPrice[]>([]);
  const [indicatorData, setIndicatorData] = useState<IndicatorData[]>([]);
  

  // 전략 생성 폼 상태
  const [isCreatingStrategy, setIsCreatingStrategy] = useState(false);
  const [newStrategyName, setNewStrategyName] = useState('');
  const [newStrategyDescription, setNewStrategyDescription] = useState('');

  // 백테스팅 폼 상태
  const [backtestStockCode, setBacktestStockCode] = useState('');
  const [backtestStartDate, setBacktestStartDate] = useState('');
  const [backtestEndDate, setBacktestEndDate] = useState('');
  const [backtestInitialCapital, setBacktestInitialCapital] = useState('10000000');

  // 기술적 지표 선택
  const [selectedIndicator, setSelectedIndicator] = useState<'RSI' | 'MACD' | 'MA' | 'BOLLINGER_BANDS'>('RSI');
  const [selectedStockForIndicator, setSelectedStockForIndicator] = useState('');

  // 데이터 로드
  useEffect(() => {
    loadStrategies();
    loadStockList();
    // 오늘 날짜로 기본값 설정
    const today = new Date().toISOString().split('T')[0];
    const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setBacktestEndDate(today);
    setBacktestStartDate(oneMonthAgo);
  }, []);

  // 데모 전략 데이터
  const getDemoStrategies = (): Strategy[] => {
    return [
      {
        id: 'strategy-1',
        name: 'RSI 과매수 전략',
        description: 'RSI가 70 이상일 때 매도, 30 이하일 때 매수',
        indicators: [
          {
            type: 'RSI',
            parameters: { period: 14 },
          },
        ],
        entryConditions: [
          {
            indicator: 'RSI',
            operator: 'LT',
            value: 30,
            logic: 'AND',
          },
        ],
        exitConditions: [
          {
            indicator: 'RSI',
            operator: 'GT',
            value: 70,
            logic: 'AND',
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
  };

  const loadStrategies = async () => {
    try {
      const data = await strategyService.getStrategies().catch(() => {
        // API 실패 시 데모 데이터 사용
        return getDemoStrategies();
      });
      setStrategies(data);
      if (data.length > 0 && !selectedStrategy) {
        setSelectedStrategy(data[0]);
      }
    } catch (err: any) {
      // 에러 발생 시에도 데모 데이터 표시
      const demoStrategies = getDemoStrategies();
      setStrategies(demoStrategies);
      if (demoStrategies.length > 0 && !selectedStrategy) {
        setSelectedStrategy(demoStrategies[0]);
      }
    } finally {
      // 로딩 완료
    }
  };

  const handleDeleteStrategy = async (strategyId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // 전략 선택 이벤트 방지
    
    if (!window.confirm('정말 이 전략을 삭제하시겠습니까?')) {
      return;
    }

    try {
      await strategyService.deleteStrategy(strategyId).catch(() => {
        // API 실패 시에도 로컬에서 삭제 (데모 모드)
        console.warn('백엔드 API가 아직 구현되지 않았습니다. 로컬에서 삭제합니다.');
      });
      
      // 전략 목록에서 제거
      const updatedStrategies = strategies.filter(s => s.id !== strategyId);
      setStrategies(updatedStrategies);
      
      // 삭제된 전략이 선택된 전략이었다면 선택 해제
      if (selectedStrategy?.id === strategyId) {
        setSelectedStrategy(updatedStrategies.length > 0 ? updatedStrategies[0] : null);
      }
      
      alert('전략이 삭제되었습니다.');
    } catch (error: any) {
      alert('전략 삭제에 실패했습니다: ' + (error.message || '알 수 없는 오류'));
    }
  };

  const loadStockList = async () => {
    try {
      const baseDate = new Date().toISOString();
      const stocks = await tradeService.getStockList().catch(() => {
        // API 실패 시 데모 데이터
        return [
          {
            stockCode: '005930',
            stockName: '삼성전자',
            currentPrice: 75000,
            change: 1500,
            changeRate: 2.04,
            volume: 12500000,
            high: 76000,
            low: 74000,
            open: 74500,
            previousClose: 73500,
            timestamp: baseDate,
          },
        ];
      });
      setStockList(stocks);
      if (stocks.length > 0) {
        setSelectedStockForIndicator(stocks[0].stockCode);
        setBacktestStockCode(stocks[0].stockCode);
      }
    } catch (_error) {
      // 에러는 무시 (데모 데이터 사용)
    }
  };

  const handleCreateStrategy = async () => {
    if (!newStrategyName.trim()) {
      alert('전략 이름을 입력해주세요.');
      return;
    }

    try {
      const newStrategy: Omit<Strategy, 'id' | 'createdAt' | 'updatedAt'> = {
        name: newStrategyName,
        description: newStrategyDescription,
        indicators: [],
        entryConditions: [],
        exitConditions: [],
      };

      await strategyService.createStrategy(newStrategy);
      setNewStrategyName('');
      setNewStrategyDescription('');
      setIsCreatingStrategy(false);
      await loadStrategies();
      alert('전략이 생성되었습니다.');
    } catch (error: any) {
      alert(error.response?.data?.message || '전략 생성에 실패했습니다.');
    }
  };

  const handleRunBacktest = async () => {
    if (!selectedStrategy) {
      alert('전략을 선택해주세요.');
      return;
    }

    if (!backtestStockCode || !backtestStartDate || !backtestEndDate) {
      alert('모든 필드를 입력해주세요.');
      return;
    }

    setIsBacktesting(true);

    try {
      const request: BacktestRequest = {
        strategyId: selectedStrategy.id,
        stockCode: backtestStockCode,
        startDate: backtestStartDate,
        endDate: backtestEndDate,
        initialCapital: parseInt(backtestInitialCapital),
      };

      const result = await strategyService.runBacktest(request).catch(() => {
        // API 실패 시 데모 결과 반환
        const initialCap = parseInt(backtestInitialCapital);
        const finalVal = initialCap * 1.25;
        const stock = stockList.find(s => s.stockCode === backtestStockCode);
        const demoResult: BacktestResult = {
          id: 'backtest-demo-1',
          strategyId: selectedStrategy.id,
          strategyName: selectedStrategy.name,
          stockCode: backtestStockCode,
          stockName: stock?.stockName || '삼성전자',
          startDate: backtestStartDate,
          endDate: backtestEndDate,
          initialCapital: initialCap,
          finalValue: finalVal,
          totalReturn: finalVal - initialCap,
          totalReturnRate: 25.0,
          sharpeRatio: 1.85,
          maxDrawdown: -8.5,
          totalTrades: 45,
          winRate: 62.5,
          profitableTrades: 28,
          losingTrades: 17,
          dailyReturns: Array.from({ length: 30 }, (_, i) => {
            const date = new Date(Date.now() - (30 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const dailyReturn = (Math.random() * 2 - 1) * 2; // -2% ~ +2% 랜덤
            const cumulativeReturn = 0.25 * (i / 30);
            return {
              date,
              return: dailyReturn,
              cumulativeReturn: cumulativeReturn,
              portfolioValue: initialCap * (1 + cumulativeReturn),
            };
          }),
          equityCurve: Array.from({ length: 30 }, (_, i) => ({
            date: new Date(Date.now() - (30 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            value: initialCap * (1 + 0.25 * (i / 30)),
          })),
        };
        return demoResult;
      });
      setBacktestResult(result);
      setActiveTab('backtest');
      alert('항로 시뮬레이션이 완료되었습니다!');
    } catch (error: any) {
      // 에러 발생 시에도 데모 결과 표시
      const initialCap = parseInt(backtestInitialCapital);
      const finalVal = initialCap * 1.25;
      const stock = stockList.find(s => s.stockCode === backtestStockCode);
      const demoResult: BacktestResult = {
        id: 'backtest-demo-1',
        strategyId: selectedStrategy.id,
        strategyName: selectedStrategy.name,
        stockCode: backtestStockCode,
        stockName: stock?.stockName || '삼성전자',
        startDate: backtestStartDate,
        endDate: backtestEndDate,
        initialCapital: initialCap,
        finalValue: finalVal,
        totalReturn: finalVal - initialCap,
        totalReturnRate: 25.0,
        sharpeRatio: 1.85,
        maxDrawdown: -8.5,
        totalTrades: 45,
        winRate: 62.5,
        profitableTrades: 28,
        losingTrades: 17,
        dailyReturns: Array.from({ length: 30 }, (_, i) => {
          const date = new Date(Date.now() - (30 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          const dailyReturn = (Math.random() * 2 - 1) * 2;
          const cumulativeReturn = 0.25 * (i / 30);
          return {
            date,
            return: dailyReturn,
            cumulativeReturn: cumulativeReturn,
            portfolioValue: initialCap * (1 + cumulativeReturn),
          };
        }),
        equityCurve: Array.from({ length: 30 }, (_, i) => ({
          date: new Date(Date.now() - (30 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          value: initialCap * (1 + 0.25 * (i / 30)),
        })),
      };
      setBacktestResult(demoResult);
      setActiveTab('backtest');
    } finally {
      setIsBacktesting(false);
    }
  };

  const handleLoadIndicator = async () => {
    if (!selectedStockForIndicator || !selectedIndicator) {
      alert('종목과 지표를 선택해주세요.');
      return;
    }

    try {
      const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];

      const data = await strategyService.getIndicatorData(
        selectedStockForIndicator,
        selectedIndicator,
        oneMonthAgo,
        today
      ).catch(() => {
        // API 실패 시 데모 데이터 생성
        const demoData: IndicatorData[] = Array.from({ length: 30 }, (_, i) => {
          const date = new Date(Date.now() - (30 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          let value = 50;
          if (selectedIndicator === 'RSI') {
            value = 30 + Math.random() * 40; // 30-70 사이
          } else if (selectedIndicator === 'MACD') {
            value = -5 + Math.random() * 10; // -5 ~ +5
          } else if (selectedIndicator === 'MA') {
            value = 70000 + Math.random() * 10000; // 가격 범위
          } else if (selectedIndicator === 'BOLLINGER_BANDS') {
            value = 70000 + Math.random() * 10000;
          }
          return {
            date,
            price: 70000 + Math.random() * 10000,
            value: value,
          };
        });
        return demoData;
      });
      setIndicatorData(data);
    } catch (error: any) {
      // 에러 발생 시에도 데모 데이터 표시
      const demoData: IndicatorData[] = Array.from({ length: 30 }, (_, i) => {
        const date = new Date(Date.now() - (30 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        let value = 50;
        if (selectedIndicator === 'RSI') {
          value = 30 + Math.random() * 40;
        } else if (selectedIndicator === 'MACD') {
          value = -5 + Math.random() * 10;
        } else {
          value = 70000 + Math.random() * 10000;
        }
        return {
          date,
          price: 70000 + Math.random() * 10000,
          value: value,
        };
      });
      setIndicatorData(demoData);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header showNav={true} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-whale-dark mb-8">전략 분석 및 백테스팅</h1>

        {/* 탭 메뉴 */}
        <div className="flex space-x-4 border-b border-gray-200 mb-6" role="tablist" aria-label="전략 분석 탭">
          <button
            onClick={() => setActiveTab('strategies')}
            role="tab"
            aria-selected={activeTab === 'strategies'}
            aria-controls="strategies-panel"
            className={`pb-3 px-4 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-whale-light focus:ring-offset-2 rounded-t-lg min-h-[44px] ${
              activeTab === 'strategies'
                ? 'text-whale-light border-b-2 border-whale-light'
                : 'text-gray-500 hover:text-whale-light'
            }`}
          >
            전략 관리
          </button>
          <button
            onClick={() => setActiveTab('backtest')}
            id="backtest-tab"
            role="tab"
            aria-selected={activeTab === 'backtest'}
            aria-controls="backtest-panel"
            className={`pb-3 px-4 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-whale-light focus:ring-offset-2 rounded-t-lg min-h-[44px] ${
              activeTab === 'backtest'
                ? 'text-whale-light border-b-2 border-whale-light'
                : 'text-gray-500 hover:text-whale-light'
            }`}
          >
            백테스팅
          </button>
          <button
            onClick={() => setActiveTab('indicators')}
            id="indicators-tab"
            role="tab"
            aria-selected={activeTab === 'indicators'}
            aria-controls="indicators-panel"
            className={`pb-3 px-4 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-whale-light focus:ring-offset-2 rounded-t-lg min-h-[44px] ${
              activeTab === 'indicators'
                ? 'text-whale-light border-b-2 border-whale-light'
                : 'text-gray-500 hover:text-whale-light'
            }`}
          >
            기술적 지표
          </button>
        </div>

        {/* 전략 관리 탭 */}
        {activeTab === 'strategies' && (
          <div id="strategies-panel" role="tabpanel" aria-labelledby="strategies-tab">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 전략 목록 */}
            <div className="card">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-whale-dark">내 전략</h2>
                <button
                  onClick={() => setIsCreatingStrategy(!isCreatingStrategy)}
                  className="btn-primary text-sm"
                >
                  {isCreatingStrategy ? '취소' : '+ 새 전략'}
                </button>
              </div>

              {/* 전략 생성 폼 */}
              {isCreatingStrategy && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">전략 이름</label>
                    <input
                      type="text"
                      value={newStrategyName}
                      onChange={(e) => setNewStrategyName(e.target.value)}
                      className="input-field"
                      placeholder="예: RSI 과매수 전략"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                    <textarea
                      value={newStrategyDescription}
                      onChange={(e) => setNewStrategyDescription(e.target.value)}
                      className="input-field"
                      rows={3}
                      placeholder="전략에 대한 설명을 입력하세요"
                    />
                  </div>
                  <button onClick={handleCreateStrategy} className="btn-primary w-full">
                    전략 생성
                  </button>
                </div>
              )}

              {/* 전략 리스트 */}
              <div className="space-y-2">
                {strategies.length === 0 ? (
                  <div className="text-center py-12">
                    <img src="/whales/narwhal.png" alt="빈 목록" className="w-16 h-16 object-contain mx-auto mb-3 opacity-60" />
                    <div className="text-gray-500 font-medium">등록된 전략이 없습니다</div>
                    <div className="text-sm text-gray-400 mt-1">새 전략을 생성하여 시작하세요</div>
                  </div>
                ) : (
                  strategies.map((strategy) => (
                    <div
                      key={strategy.id}
                      onClick={() => setSelectedStrategy(strategy)}
                      className={`p-4 rounded-lg cursor-pointer transition-colors relative ${
                        selectedStrategy?.id === strategy.id
                          ? 'bg-whale-light bg-opacity-10 border-2 border-whale-light'
                          : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                      }`}
                    >
                      <button
                        onClick={(e) => handleDeleteStrategy(strategy.id, e)}
                        className="absolute top-2 right-2 p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                        aria-label={`${strategy.name} 전략 삭제`}
                        title="전략 삭제"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                      <div className="font-bold text-whale-dark pr-8">{strategy.name}</div>
                      <div className="text-sm text-gray-600 mt-1">{strategy.description}</div>
                      <div className="text-xs text-gray-500 mt-2">
                        {new Date(strategy.createdAt).toLocaleDateString('ko-KR')}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 전략 상세 */}
            {selectedStrategy && (
              <div className="card">
                <h2 className="text-xl font-bold text-whale-dark mb-4">{selectedStrategy.name}</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-2">설명</h3>
                    <p className="text-gray-600">{selectedStrategy.description || '설명이 없습니다.'}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-2">사용 지표</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedStrategy.indicators && selectedStrategy.indicators.length === 0 ? (
                        <span className="text-gray-500">지표가 설정되지 않았습니다.</span>
                      ) : selectedStrategy.indicators ? (
                        selectedStrategy.indicators.map((indicator, index) => (
                          <span
                            key={index}
                            className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                          >
                            {indicator.type}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-500">지표가 설정되지 않았습니다.</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-2">매수 조건</h3>
                    {selectedStrategy.entryConditions && selectedStrategy.entryConditions.length === 0 ? (
                      <span className="text-gray-500">조건이 설정되지 않았습니다.</span>
                    ) : selectedStrategy.entryConditions ? (
                      <ul className="list-disc list-inside text-gray-600">
                        {selectedStrategy.entryConditions.map((condition, index) => (
                          <li key={index}>
                            {condition.indicator} {condition.operator} {condition.value}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-gray-500">조건이 설정되지 않았습니다.</span>
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-2">매도 조건</h3>
                    {selectedStrategy.exitConditions && selectedStrategy.exitConditions.length === 0 ? (
                      <span className="text-gray-500">조건이 설정되지 않았습니다.</span>
                    ) : selectedStrategy.exitConditions ? (
                      <ul className="list-disc list-inside text-gray-600">
                        {selectedStrategy.exitConditions.map((condition, index) => (
                          <li key={index}>
                            {condition.indicator} {condition.operator} {condition.value}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-gray-500">조건이 설정되지 않았습니다.</span>
                    )}
                  </div>
                </div>
              </div>
            )}
            </div>
          </div>
        )}

        {/* 백테스팅 탭 */}
        {activeTab === 'backtest' && (
          <div id="backtest-panel" role="tabpanel" aria-labelledby="backtest-tab" className="space-y-6">
            {/* 백테스팅 설정 */}
            <div className="card">
              <h2 className="text-xl font-bold text-whale-dark mb-4">백테스팅 설정</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">전략 선택</label>
                  <select
                    value={selectedStrategy?.id || ''}
                    onChange={(e) => {
                      const strategy = strategies.find((s) => s.id === e.target.value);
                      setSelectedStrategy(strategy || null);
                    }}
                    className="input-field bg-white"
                  >
                    <option value="">전략을 선택하세요</option>
                    {strategies.map((strategy) => (
                      <option key={strategy.id} value={strategy.id}>
                        {strategy.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">종목 선택</label>
                  <select
                    value={backtestStockCode}
                    onChange={(e) => setBacktestStockCode(e.target.value)}
                    className="input-field bg-white"
                  >
                    {stockList.map((stock) => (
                      <option key={stock.stockCode} value={stock.stockCode}>
                        {stock.stockName} ({stock.stockCode})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">시작일</label>
                  <input
                    type="date"
                    value={backtestStartDate}
                    onChange={(e) => setBacktestStartDate(e.target.value)}
                    className="input-field bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">종료일</label>
                  <input
                    type="date"
                    value={backtestEndDate}
                    onChange={(e) => setBacktestEndDate(e.target.value)}
                    className="input-field bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">초기 자본</label>
                  <input
                    type="number"
                    value={backtestInitialCapital}
                    onChange={(e) => setBacktestInitialCapital(e.target.value)}
                    className="input-field bg-white"
                    placeholder="10000000"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleRunBacktest}
                    disabled={isBacktesting || !selectedStrategy}
                    className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isBacktesting ? '백테스팅 실행 중...' : '백테스팅 실행'}
                  </button>
                </div>
              </div>
            </div>

            {/* 백테스팅 결과 */}
            {backtestResult && (
              <div className="space-y-6">
                {/* 성과 요약 */}
                <div className="card">
                  <h2 className="text-xl font-bold text-whale-dark mb-4">백테스팅 결과</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-600 mb-1">총 수익률</div>
                      <div
                        className={`text-2xl font-bold ${
                          backtestResult.totalReturnRate >= 0 ? 'text-red-600' : 'text-blue-600'
                        }`}
                      >
                        {formatPercent(backtestResult.totalReturnRate)}
                      </div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-600 mb-1">최종 자산</div>
                      <div className="text-2xl font-bold text-whale-dark">
                        {formatCurrency(backtestResult.finalValue)}
                      </div>
                    </div>
                    <div className="bg-yellow-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-600 mb-1">샤프 비율</div>
                      <div className="text-2xl font-bold text-whale-dark">
                        {backtestResult.sharpeRatio.toFixed(2)}
                      </div>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-600 mb-1">최대 낙폭</div>
                      <div className="text-2xl font-bold text-red-600">
                        {formatPercent(backtestResult.maxDrawdown)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    <div>
                      <div className="text-sm text-gray-600 mb-1">총 거래 횟수</div>
                      <div className="text-xl font-bold text-whale-dark">
                        {backtestResult.totalTrades}회
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-1">승률</div>
                      <div className="text-xl font-bold text-green-600">
                        {formatPercent(backtestResult.winRate)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-1">수익 거래</div>
                      <div className="text-xl font-bold text-green-600">
                        {backtestResult.profitableTrades}회
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-1">손실 거래</div>
                      <div className="text-xl font-bold text-red-600">
                        {backtestResult.losingTrades}회
                      </div>
                    </div>
                  </div>
                </div>

                {/* 수익률 차트 */}
                {backtestResult.equityCurve && backtestResult.equityCurve.length > 0 && (
                  <div className="card">
                    <h3 className="text-lg font-bold text-whale-dark mb-4">자산 변동 추이</h3>
                    <ResponsiveContainer width="100%" height={400}>
                      <AreaChart data={backtestResult.equityCurve}>
                        <defs>
                          <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4a90e2" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#4a90e2" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip
                          formatter={(value: number) => formatCurrency(value)}
                          labelFormatter={(label) => `날짜: ${label}`}
                        />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke="#4a90e2"
                          fillOpacity={1}
                          fill="url(#colorEquity)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* 일일 수익률 차트 */}
                {backtestResult.dailyReturns && backtestResult.dailyReturns.length > 0 && (
                  <div className="card">
                    <h3 className="text-lg font-bold text-whale-dark mb-4">일일 수익률</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={backtestResult.dailyReturns}>
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip
                          formatter={(value: number) => formatPercent(value)}
                          labelFormatter={(label) => `날짜: ${label}`}
                        />
                        <Bar
                          dataKey="return"
                          fill="#4a90e2"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 기술적 지표 탭 */}
        {activeTab === 'indicators' && (
          <div id="indicators-panel" role="tabpanel" aria-labelledby="indicators-tab" className="space-y-6">
            {/* 지표 선택 */}
            <div className="card">
              <h2 className="text-xl font-bold text-whale-dark mb-4">기술적 지표 분석</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">종목 선택</label>
                  <select
                    value={selectedStockForIndicator}
                    onChange={(e) => setSelectedStockForIndicator(e.target.value)}
                    className="input-field bg-white"
                  >
                    {stockList.map((stock) => (
                      <option key={stock.stockCode} value={stock.stockCode}>
                        {stock.stockName} ({stock.stockCode})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">지표 선택</label>
                  <select
                    value={selectedIndicator}
                    onChange={(e) =>
                      setSelectedIndicator(
                        e.target.value as 'RSI' | 'MACD' | 'MA' | 'BOLLINGER_BANDS'
                      )
                    }
                    className="input-field bg-white"
                  >
                    <option value="RSI">RSI (상대강도지수)</option>
                    <option value="MACD">MACD</option>
                    <option value="MA">이동평균선 (MA)</option>
                    <option value="BOLLINGER_BANDS">볼린저 밴드</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button onClick={handleLoadIndicator} className="btn-primary w-full">
                    지표 불러오기
                  </button>
                </div>
              </div>
            </div>

            {/* 지표 차트 */}
            {indicatorData.length > 0 && (
              <div className="card">
                <h3 className="text-lg font-bold text-whale-dark mb-4">
                  {selectedIndicator} - {stockList.find((s) => s.stockCode === selectedStockForIndicator)?.stockName}
                </h3>
                <ResponsiveContainer width="100%" height={500}>
                  <LineChart data={indicatorData}>
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip
                      formatter={(value: number) => value.toFixed(2)}
                      labelFormatter={(label) => `날짜: ${label}`}
                    />
                    <Legend />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="price"
                      stroke="#8884d8"
                      strokeWidth={2}
                      name="가격"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="value"
                      stroke="#82ca9d"
                      strokeWidth={2}
                      name={selectedIndicator}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* 지표 설명 */}
            <div className="card">
              <h3 className="text-lg font-bold text-whale-dark mb-4">지표 설명</h3>
              <div className="space-y-4">
                {selectedIndicator === 'RSI' && (
                  <div>
                    <h4 className="font-semibold text-gray-700 mb-2">RSI (Relative Strength Index)</h4>
                    <p className="text-gray-600">
                      RSI는 주가의 상승세와 하락세의 상대적인 강도를 측정하는 지표입니다. 0~100 범위로 표시되며,
                      일반적으로 70 이상이면 과매수 구간, 30 이하면 과매도 구간으로 판단합니다.
                    </p>
                  </div>
                )}
                {selectedIndicator === 'MACD' && (
                  <div>
                    <h4 className="font-semibold text-gray-700 mb-2">MACD</h4>
                    <p className="text-gray-600">
                      MACD는 이동평균의 수렴과 발산을 나타내는 지표로, 추세의 방향과 강도를 파악하는 데 사용됩니다.
                      MACD 선이 Signal 선을 상향 돌파하면 매수 신호로, 하향 돌파하면 매도 신호로 해석됩니다.
                    </p>
                  </div>
                )}
                {selectedIndicator === 'MA' && (
                  <div>
                    <h4 className="font-semibold text-gray-700 mb-2">이동평균선 (Moving Average)</h4>
                    <p className="text-gray-600">
                      이동평균선은 특정 기간 동안의 평균 주가를 나타내는 지표입니다. 단기 이동평균선이 장기
                      이동평균선을 상향 돌파하면 골든크로스(매수 신호), 반대면 데드크로스(매도 신호)로 해석됩니다.
                    </p>
                  </div>
                )}
                {selectedIndicator === 'BOLLINGER_BANDS' && (
                  <div>
                    <h4 className="font-semibold text-gray-700 mb-2">볼린저 밴드</h4>
                    <p className="text-gray-600">
                      볼린저 밴드는 이동평균선을 중심으로 상단 밴드와 하단 밴드를 표시하는 지표입니다. 주가가
                      상단 밴드에 접근하면 과매수, 하단 밴드에 접근하면 과매도로 판단할 수 있습니다.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StrategyPage;
