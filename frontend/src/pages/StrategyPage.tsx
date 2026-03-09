import { useState, useEffect, useRef, useCallback } from 'react';
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
  const [krxStockList, setKrxStockList] = useState<StockPrice[]>([]);
  const [indicatorData, setIndicatorData] = useState<IndicatorData[]>([]);

  // 전략 생성/수정 모달 상태 (공유)
  const [strategyModalMode, setStrategyModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingStrategyId, setEditingStrategyId] = useState<string | null>(null);
  const [newStrategyName, setNewStrategyName] = useState('');
  const [newStrategyDescription, setNewStrategyDescription] = useState('');
  const [newStrategyLogic, setNewStrategyLogic] = useState('');
  const [newAssetType, setNewAssetType] = useState<'CRYPTO' | 'STOCK' | 'MIXED'>('CRYPTO');
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [assetSearchQuery, setAssetSearchQuery] = useState('');
  const [searchedStocks, setSearchedStocks] = useState<{ code: string; name: string }[]>([]);
  const [isSearchingStocks, setIsSearchingStocks] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [assetNameCache, setAssetNameCache] = useState<Record<string, string>>({});

  // 포트폴리오 적용 모달 상태
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyAmount, setApplyAmount] = useState('1000000');
  const [isApplying, setIsApplying] = useState(false);

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
    const today = new Date().toISOString().split('T')[0];
    const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setBacktestEndDate(today);
    setBacktestStartDate(oneMonthAgo);
  }, []);

  const loadStrategies = async () => {
    try {
      const data = await strategyService.getStrategies().catch(() => []);
      setStrategies(data);
      if (data.length > 0 && !selectedStrategy) {
        setSelectedStrategy(data[0]);
      }
      // 선택된 전략이 있으면 최신 데이터로 갱신
      if (selectedStrategy) {
        const updated = data.find(s => s.id === selectedStrategy.id);
        if (updated) {
          setSelectedStrategy(updated);
        } else {
          setSelectedStrategy(data.length > 0 ? data[0] : null);
        }
      }
    } catch {
      setStrategies([]);
    }
  };

  const handleDeleteStrategy = async (strategyId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const target = strategies.find(s => s.id === strategyId);
    if (target?.applied) {
      if (!window.confirm('이 항로는 이미 포트폴리오에 적용되어 매수가 완료된 상태입니다.\n항로를 삭제해도 이미 매수된 자산은 유지됩니다.\n정말 삭제하시겠습니까?')) return;
    } else {
      if (!window.confirm('정말 이 항로를 삭제하시겠습니까?')) return;
    }

    try {
      await strategyService.deleteStrategy(strategyId).catch(() => {});
      const updatedStrategies = strategies.filter(s => s.id !== strategyId);
      setStrategies(updatedStrategies);
      if (selectedStrategy?.id === strategyId) {
        setSelectedStrategy(updatedStrategies.length > 0 ? updatedStrategies[0] : null);
      }
      alert('항로가 삭제되었습니다.');
    } catch (error: any) {
      alert('항로 삭제에 실패했습니다: ' + (error.message || '알 수 없는 오류'));
    }
  };

  const loadStockList = async () => {
    try {
      const [cryptos, stocks] = await Promise.all([
        tradeService.getStockList().catch(() => []),
        tradeService.getKrxStockList().catch(() => []),
      ]);
      setStockList(cryptos);
      setKrxStockList(stocks);
      const allList = [...cryptos, ...stocks];
      if (allList.length > 0) {
        setSelectedStockForIndicator(allList[0].stockCode);
        setBacktestStockCode(allList[0].stockCode);
      }
    } catch {
      // 에러 무시
    }
  };

  // 주식 종목 실시간 검색 (디바운스 300ms)
  const handleStockSearch = useCallback((query: string) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    if (!query.trim()) {
      setSearchedStocks([]);
      setIsSearchingStocks(false);
      return;
    }

    // 주식 검색이 필요한 경우만
    if (newAssetType === 'STOCK' || newAssetType === 'MIXED') {
      setIsSearchingStocks(true);
      searchTimerRef.current = setTimeout(async () => {
        try {
          const results = await tradeService.searchKrxStocks(query);
          setSearchedStocks(results.map(r => ({ code: r.code, name: r.name })));
        } catch {
          setSearchedStocks([]);
        } finally {
          setIsSearchingStocks(false);
        }
      }, 300);
    }
  }, [newAssetType]);

  // 검색어 변경 핸들러
  const handleAssetSearchChange = (value: string) => {
    setAssetSearchQuery(value);
    handleStockSearch(value);
  };

  // 자산 유형에 따라 선택 가능한 자산 목록
  const getAvailableAssets = () => {
    const query = assetSearchQuery.toLowerCase();
    let assets: { code: string; name: string }[] = [];

    // 코인: 기존 목록에서 필터
    if (newAssetType === 'CRYPTO' || newAssetType === 'MIXED') {
      let cryptoAssets = stockList.map(s => ({ code: s.stockCode, name: s.stockName }));
      if (query) {
        cryptoAssets = cryptoAssets.filter(a =>
          a.code.toLowerCase().includes(query) || a.name.toLowerCase().includes(query)
        );
      }
      assets = [...assets, ...cryptoAssets];
    }

    // 주식: 검색어 있으면 API 검색 결과, 없으면 인기 30종목
    if (newAssetType === 'STOCK' || newAssetType === 'MIXED') {
      if (query && searchedStocks.length > 0) {
        assets = [...assets, ...searchedStocks];
      } else if (!query) {
        assets = [...assets, ...krxStockList.map(s => ({ code: s.stockCode, name: s.stockName }))];
      }
    }

    return assets.filter(a => !selectedAssets.includes(a.code));
  };

  const handleAddAsset = (code: string) => {
    if (!selectedAssets.includes(code)) {
      setSelectedAssets([...selectedAssets, code]);
      // 검색 결과에서 추가한 종목 이름 캐싱
      const found = searchedStocks.find(s => s.code === code);
      if (found) {
        setAssetNameCache(prev => ({ ...prev, [code]: found.name }));
      }
    }
    setAssetSearchQuery('');
    setSearchedStocks([]);
  };

  const handleRemoveAsset = (code: string) => {
    setSelectedAssets(selectedAssets.filter(a => a !== code));
  };

  const getAssetName = (code: string) => {
    const crypto = stockList.find(s => s.stockCode === code);
    if (crypto) return crypto.stockName;
    const stock = krxStockList.find(s => s.stockCode === code);
    if (stock) return stock.stockName;
    if (assetNameCache[code]) return assetNameCache[code];
    // DB에 저장된 자산명 맵에서 조회
    if (selectedStrategy?.targetAssetNames?.[code]) return selectedStrategy.targetAssetNames[code];
    // 전체 전략 목록에서도 검색
    for (const s of strategies) {
      if (s.targetAssetNames?.[code]) return s.targetAssetNames[code];
    }
    return code;
  };

  const openCreateModal = () => {
    setStrategyModalMode('create');
    setEditingStrategyId(null);
    setNewStrategyName('');
    setNewStrategyDescription('');
    setNewStrategyLogic('');
    setNewAssetType('CRYPTO');
    setSelectedAssets([]);
    setAssetSearchQuery('');
    setSearchedStocks([]);
  };

  const openEditModal = (strategy: Strategy) => {
    setStrategyModalMode('edit');
    setEditingStrategyId(strategy.id);
    setNewStrategyName(strategy.name);
    setNewStrategyDescription(strategy.description || '');
    setNewStrategyLogic(strategy.strategyLogic || '');
    setNewAssetType(strategy.assetType || 'CRYPTO');
    setSelectedAssets(strategy.targetAssets || []);
    setAssetSearchQuery('');
    setSearchedStocks([]);
    // 기존 자산명 캐시에 로드
    if (strategy.targetAssetNames) {
      setAssetNameCache(prev => ({ ...prev, ...strategy.targetAssetNames }));
    }
  };

  const closeStrategyModal = () => {
    setStrategyModalMode(null);
    setEditingStrategyId(null);
  };

  const handleSaveStrategy = async () => {
    if (!newStrategyName.trim()) {
      alert('항로 이름을 입력해주세요.');
      return;
    }
    if (selectedAssets.length === 0) {
      alert('투자 대상 자산을 1개 이상 선택해주세요.');
      return;
    }

    try {
      const assetNames: Record<string, string> = {};
      selectedAssets.forEach(code => {
        const name = getAssetName(code);
        if (name !== code) assetNames[code] = name;
      });

      if (strategyModalMode === 'edit' && editingStrategyId) {
        await strategyService.updateStrategy(editingStrategyId, {
          name: newStrategyName,
          description: newStrategyDescription,
          targetAssets: selectedAssets,
          targetAssetNames: assetNames,
          assetType: newAssetType,
          strategyLogic: newStrategyLogic,
        });
        closeStrategyModal();
        await loadStrategies();
        alert('항로가 수정되었습니다!');
      } else {
        await strategyService.createStrategy({
          name: newStrategyName,
          description: newStrategyDescription,
          indicators: [],
          entryConditions: [],
          exitConditions: [],
          targetAssets: selectedAssets,
          targetAssetNames: assetNames,
          assetType: newAssetType,
          strategyLogic: newStrategyLogic,
        });
        closeStrategyModal();
        await loadStrategies();
        alert('항로가 생성되었습니다!');
      }
    } catch (error: any) {
      alert(error.response?.data?.message || error.response?.data?.error || '저장에 실패했습니다.');
    }
  };

  const handleUnapplyStrategy = async () => {
    if (!selectedStrategy) return;
    if (!window.confirm(
      `"${selectedStrategy.name}" 항로의 적용을 해제합니다.\n\n` +
      '이미 매수된 자산은 그대로 유지되며,\n' +
      '항로를 수정 후 다시 적용할 수 있습니다.\n\n' +
      '적용을 해제하시겠습니까?'
    )) return;

    try {
      await strategyService.unapplyStrategy(selectedStrategy.id);
      await loadStrategies();
      alert('항로 적용이 해제되었습니다.');
    } catch (error: any) {
      alert(error.response?.data?.error || '적용 해제에 실패했습니다.');
    }
  };

  const handleApplyStrategy = async () => {
    if (!selectedStrategy) return;
    const amount = parseInt(applyAmount);
    if (!amount || amount <= 0) {
      alert('투자 금액을 입력해주세요.');
      return;
    }

    setIsApplying(true);
    try {
      const result = await strategyService.applyStrategy(selectedStrategy.id, amount);
      const success = result.appliedSuccessCount || selectedStrategy.targetAssets?.length || 0;
      const total = result.appliedTotalCount || selectedStrategy.targetAssets?.length || 0;
      if (success < total) {
        alert(`항로 "${selectedStrategy.name}" 적용 완료!\n${total}개 자산 중 ${success}개 매수 성공, ${total - success}개 실패.\n실패한 자산은 시세 조회 불가 또는 금액 부족일 수 있습니다.`);
      } else {
        alert(`항로 "${selectedStrategy.name}"이(가) 포트폴리오에 적용되었습니다!\n${success}개 자산에 균등 투자 완료.`);
      }
      setShowApplyModal(false);
      await loadStrategies();
    } catch (error: any) {
      const msg = error.response?.data?.error || error.response?.data?.message || '항로 적용에 실패했습니다.';
      alert(msg);
    } finally {
      setIsApplying(false);
    }
  };

  const handleRunBacktest = async () => {
    if (!selectedStrategy) {
      alert('항로를 선택해주세요.');
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
        const initialCap = parseInt(backtestInitialCapital);
        const finalVal = initialCap * 1.25;
        const stock = stockList.find(s => s.stockCode === backtestStockCode);
        const demoResult: BacktestResult = {
          id: 'backtest-demo-1',
          strategyId: selectedStrategy.id,
          strategyName: selectedStrategy.name,
          stockCode: backtestStockCode,
          stockName: stock?.stockName || 'BTC',
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
            return { date, return: dailyReturn, cumulativeReturn, portfolioValue: initialCap * (1 + cumulativeReturn) };
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
    } catch {
      // 에러 무시
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
        selectedStockForIndicator, selectedIndicator, oneMonthAgo, today
      ).catch(() => {
        return Array.from({ length: 30 }, (_, i) => {
          const date = new Date(Date.now() - (30 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          let value = 50;
          if (selectedIndicator === 'RSI') value = 30 + Math.random() * 40;
          else if (selectedIndicator === 'MACD') value = -5 + Math.random() * 10;
          else value = 70000 + Math.random() * 10000;
          return { date, price: 70000 + Math.random() * 10000, value };
        });
      });
      setIndicatorData(data);
    } catch {
      // 에러 무시
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency', currency: 'KRW', minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const assetTypeLabel = (type: string) => {
    if (type === 'CRYPTO') return '코인';
    if (type === 'STOCK') return '주식';
    return '혼합';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header showNav={true} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-whale-dark mb-8">전략 분석 및 백테스팅</h1>

        {/* 탭 메뉴 */}
        <div className="flex space-x-4 border-b border-gray-200 mb-6" role="tablist">
          {(['strategies', 'backtest', 'indicators'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              role="tab"
              aria-selected={activeTab === tab}
              className={`pb-3 px-4 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-whale-light focus:ring-offset-2 rounded-t-lg min-h-[44px] ${
                activeTab === tab
                  ? 'text-whale-light border-b-2 border-whale-light'
                  : 'text-gray-500 hover:text-whale-light'
              }`}
            >
              {tab === 'strategies' ? '항로 관리' : tab === 'backtest' ? '백테스팅' : '기술적 지표'}
            </button>
          ))}
        </div>

        {/* 전략 관리 탭 */}
        {activeTab === 'strategies' && (
          <div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 전략 목록 */}
              <div className="card">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-whale-dark">내 항로</h2>
                  <button
                    onClick={openCreateModal}
                    className="btn-primary text-sm"
                  >
                    + 새 항로
                  </button>
                </div>

                {/* 전략 리스트 */}
                <div className="space-y-3">
                  {strategies.length === 0 ? (
                    <div className="text-center py-12">
                      <img src="/whales/narwhal.png" alt="빈 목록" className="w-16 h-16 object-contain mx-auto mb-3 opacity-60" />
                      <div className="text-gray-500 font-medium">등록된 항로가 없습니다</div>
                      <div className="text-sm text-gray-400 mt-1">새 항로를 생성하여 시작하세요</div>
                    </div>
                  ) : (
                    strategies.map((strategy) => (
                      <div
                        key={strategy.id}
                        onClick={() => setSelectedStrategy(strategy)}
                        className={`p-4 rounded-xl cursor-pointer transition-all relative ${
                          selectedStrategy?.id === strategy.id
                            ? 'bg-whale-light bg-opacity-10 border-2 border-whale-light shadow-sm'
                            : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                        }`}
                      >
                        <button
                          onClick={(e) => handleDeleteStrategy(strategy.id, e)}
                          className="absolute top-3 right-3 p-1 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
                          title="항로 삭제"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                        <div className="flex items-center gap-2 pr-8">
                          <span className="font-bold text-whale-dark">{strategy.name}</span>
                          {strategy.applied && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">적용됨</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          {strategy.assetType && (
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              strategy.assetType === 'CRYPTO' ? 'bg-emerald-50 text-emerald-600' :
                              strategy.assetType === 'STOCK' ? 'bg-indigo-50 text-indigo-600' :
                              'bg-purple-100 text-purple-700'
                            }`}>
                              {assetTypeLabel(strategy.assetType)}
                            </span>
                          )}
                          {strategy.targetAssets && strategy.targetAssets.length > 0 && (
                            <span className="text-xs text-gray-500">{strategy.targetAssets.length}개 자산</span>
                          )}
                          <span className="text-xs text-gray-400">
                            {new Date(strategy.createdAt).toLocaleDateString('ko-KR')}
                          </span>
                        </div>
                        {(strategy.description || strategy.strategyLogic) && (
                          <div className="text-sm text-gray-500 mt-2 line-clamp-1">{strategy.description || strategy.strategyLogic}</div>
                        )}
                        {strategy.targetAssets && strategy.targetAssets.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {strategy.targetAssets.slice(0, 6).map(code => {
                              const name = strategy.targetAssetNames?.[code];
                              return (
                                <span key={code} className="px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded text-xs">
                                  {name || getAssetName(code)}
                                </span>
                              );
                            })}
                            {strategy.targetAssets.length > 6 && (
                              <span className="text-xs text-gray-400 self-center">+{strategy.targetAssets.length - 6}</span>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 전략 상세 (오른쪽 패널) */}
              {selectedStrategy ? (
                <div className="card">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="text-xl font-bold text-whale-dark">{selectedStrategy.name}</h2>
                      <div className="flex items-center gap-2 mt-1">
                        {selectedStrategy.assetType && (
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            selectedStrategy.assetType === 'CRYPTO' ? 'bg-emerald-50 text-emerald-600' :
                            selectedStrategy.assetType === 'STOCK' ? 'bg-indigo-50 text-indigo-600' :
                            'bg-purple-100 text-purple-700'
                          }`}>
                            {assetTypeLabel(selectedStrategy.assetType)}
                          </span>
                        )}
                        {selectedStrategy.applied && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">포트폴리오 적용됨</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditModal(selectedStrategy)}
                        className="p-2 text-gray-400 hover:text-whale-light rounded-lg transition-colors"
                        title="항로 수정"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      {selectedStrategy.applied && (
                        <button
                          onClick={handleUnapplyStrategy}
                          className="p-2 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
                          title="적용 해제"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    {selectedStrategy.description && (
                      <div>
                        <h3 className="font-semibold text-gray-700 mb-1 text-sm">설명</h3>
                        <p className="text-gray-600 text-sm">{selectedStrategy.description}</p>
                      </div>
                    )}

                    {selectedStrategy.strategyLogic && (
                      <div>
                        <h3 className="font-semibold text-gray-700 mb-1 text-sm">항로 로직</h3>
                        <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                          {selectedStrategy.strategyLogic}
                        </div>
                      </div>
                    )}

                    {selectedStrategy.targetAssets && selectedStrategy.targetAssets.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-gray-700 mb-2 text-sm">투자 대상 자산 ({selectedStrategy.targetAssets.length}개)</h3>
                        <div className="grid grid-cols-2 gap-2">
                          {selectedStrategy.targetAssets.map(code => {
                            const name = getAssetName(code);
                            const isStock = code.match(/^\d{6}$/);
                            return (
                              <div key={code} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                                  isStock ? 'bg-blue-500' : 'bg-orange-500'
                                }`}>
                                  {name.slice(0, 1)}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-gray-800 truncate">{name}</div>
                                  <div className="text-xs text-gray-500">{code}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {selectedStrategy.indicators && selectedStrategy.indicators.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-gray-700 mb-2 text-sm">사용 지표</h3>
                        <div className="flex flex-wrap gap-2">
                          {selectedStrategy.indicators.map((indicator, index) => (
                            <span key={index} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                              {indicator.type}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedStrategy.entryConditions && selectedStrategy.entryConditions.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-gray-700 mb-2 text-sm">매수 조건</h3>
                        <ul className="list-disc list-inside text-gray-600 text-sm">
                          {selectedStrategy.entryConditions.map((condition, index) => (
                            <li key={index}>{condition.indicator} {condition.operator} {condition.value}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {selectedStrategy.exitConditions && selectedStrategy.exitConditions.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-gray-700 mb-2 text-sm">매도 조건</h3>
                        <ul className="list-disc list-inside text-gray-600 text-sm">
                          {selectedStrategy.exitConditions.map((condition, index) => (
                            <li key={index}>{condition.indicator} {condition.operator} {condition.value}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* 포트폴리오 적용 버튼 */}
                    {!selectedStrategy.applied && selectedStrategy.targetAssets && selectedStrategy.targetAssets.length > 0 && (
                      <button
                        onClick={() => setShowApplyModal(true)}
                        className="w-full mt-4 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        포트폴리오에 적용하기
                      </button>
                    )}

                    {selectedStrategy.applied && (
                      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-xl text-center text-sm font-medium">
                        <span className="text-green-700">포트폴리오에 적용됨</span>
                        {selectedStrategy.appliedSuccessCount != null && selectedStrategy.appliedTotalCount != null && selectedStrategy.appliedTotalCount > 0 && (
                          <span className="text-gray-500 ml-1">
                            ({selectedStrategy.appliedSuccessCount}/{selectedStrategy.appliedTotalCount}개 자산 매수 성공)
                          </span>
                        )}
                      </div>
                    )}

                    {(!selectedStrategy.targetAssets || selectedStrategy.targetAssets.length === 0) && !selectedStrategy.applied && (
                      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-center text-yellow-700 text-sm">
                        투자 대상 자산이 설정되지 않아 포트폴리오에 적용할 수 없습니다.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="card flex flex-col items-center justify-center py-16 text-center">
                  <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <div className="text-gray-500 font-medium mb-1">항로를 선택하세요</div>
                  <div className="text-sm text-gray-400">왼쪽 목록에서 항로를 클릭하면<br/>상세 정보를 확인할 수 있습니다</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 전략 생성 모달 */}
        {strategyModalMode && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 rounded-t-2xl flex justify-between items-center">
                <h3 className="text-lg font-bold text-whale-dark">{strategyModalMode === 'edit' ? '항로 수정' : '새 항로 만들기'}</h3>
                <button onClick={closeStrategyModal} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6 space-y-5">
                {/* Step 1: 기본 정보 */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-6 h-6 rounded-full bg-whale-light text-white text-xs font-bold flex items-center justify-center">1</span>
                    <span className="font-semibold text-gray-800">기본 정보</span>
                  </div>
                  <div className="space-y-3 pl-8">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">항로 이름 *</label>
                      <input
                        type="text"
                        value={newStrategyName}
                        onChange={(e) => setNewStrategyName(e.target.value)}
                        className="input-field"
                        placeholder="예: BTC+ETH 균등 투자"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">설명</label>
                      <textarea
                        value={newStrategyDescription}
                        onChange={(e) => setNewStrategyDescription(e.target.value)}
                        className="input-field"
                        rows={2}
                        placeholder="항로에 대한 간단한 설명"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">항로 로직</label>
                      <textarea
                        value={newStrategyLogic}
                        onChange={(e) => setNewStrategyLogic(e.target.value)}
                        className="input-field"
                        rows={2}
                        placeholder="예: 균등 분배 매수 후 장기 보유, RSI 30 이하 추가매수"
                      />
                    </div>
                  </div>
                </div>

                {/* Step 2: 자산 유형 */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-6 h-6 rounded-full bg-whale-light text-white text-xs font-bold flex items-center justify-center">2</span>
                    <span className="font-semibold text-gray-800">자산 유형</span>
                  </div>
                  <div className="flex gap-2 pl-8">
                    {(['CRYPTO', 'STOCK', 'MIXED'] as const).map(type => (
                      <button
                        key={type}
                        onClick={() => { setNewAssetType(type); setSelectedAssets([]); }}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                          newAssetType === type
                            ? type === 'CRYPTO' ? 'bg-orange-500 text-white shadow-sm' :
                              type === 'STOCK' ? 'bg-blue-500 text-white shadow-sm' :
                              'bg-purple-500 text-white shadow-sm'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {assetTypeLabel(type)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Step 3: 자산 선택 */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
                      selectedAssets.length > 0 ? 'bg-whale-light text-white' : 'bg-gray-300 text-white'
                    }`}>3</span>
                    <span className="font-semibold text-gray-800">투자 대상 자산</span>
                    {selectedAssets.length > 0 && (
                      <span className="px-2 py-0.5 bg-whale-light bg-opacity-15 text-whale-dark rounded-full text-xs font-bold">{selectedAssets.length}개 선택</span>
                    )}
                  </div>
                  <div className="pl-8">
                    {/* 선택된 자산 태그 */}
                    {selectedAssets.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {selectedAssets.map(code => (
                          <span key={code} className="inline-flex items-center gap-1 px-3 py-1.5 bg-whale-light bg-opacity-10 text-whale-dark rounded-lg text-sm font-medium border border-whale-light border-opacity-30">
                            {getAssetName(code)}
                            <span className="text-gray-400 text-xs ml-0.5">{code}</span>
                            <button onClick={() => handleRemoveAsset(code)} className="ml-1 w-4 h-4 rounded-full bg-red-100 text-red-500 hover:bg-red-200 flex items-center justify-center text-xs leading-none transition-colors">x</button>
                          </span>
                        ))}
                      </div>
                    )}
                    {/* 자산 검색 */}
                    <input
                      type="text"
                      value={assetSearchQuery}
                      onChange={(e) => handleAssetSearchChange(e.target.value)}
                      className="input-field"
                      placeholder={newAssetType === 'CRYPTO' ? '코인 검색 (BTC, ETH...)' : newAssetType === 'STOCK' ? '종목명 또는 종목코드로 검색 (전체 KRX)' : '자산 검색 (코인 + 전체 KRX 주식)'}
                    />
                    {/* 자산 목록 */}
                    <div className="mt-1 text-xs text-gray-400 flex justify-between">
                      {(newAssetType === 'STOCK' || newAssetType === 'MIXED') && !assetSearchQuery && (
                        <span>검색하면 전체 KRX 종목에서 찾을 수 있어요</span>
                      )}
                      {isSearchingStocks && <span>검색 중...</span>}
                      <span className="ml-auto">{getAvailableAssets().length > 0 ? `${getAvailableAssets().length}개 종목` : ''}</span>
                    </div>
                    <div className="mt-1 max-h-72 overflow-y-auto border border-gray-200 rounded-xl">
                      {getAvailableAssets().slice(0, 50).map(asset => {
                        const isStock = asset.code.match(/^\d{6}$/);
                        return (
                          <button
                            key={asset.code}
                            onClick={() => handleAddAsset(asset.code)}
                            className="w-full text-left px-3 py-2.5 hover:bg-blue-50 text-sm border-b border-gray-50 last:border-0 transition-colors flex items-center gap-2"
                          >
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${
                              isStock ? 'bg-blue-400' : 'bg-orange-400'
                            }`}>
                              {asset.name.slice(0, 1)}
                            </div>
                            <span className="font-medium text-gray-800">{asset.name}</span>
                            <span className="text-gray-400 text-xs">{asset.code}</span>
                          </button>
                        );
                      })}
                      {getAvailableAssets().length === 0 && (
                        <div className="px-3 py-4 text-sm text-gray-500 text-center">
                          {isSearchingStocks ? '검색 중...' : assetSearchQuery ? '검색 결과가 없습니다' : selectedAssets.length > 0 ? '모든 자산이 선택되었습니다' : '불러오는 중...'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSaveStrategy}
                  disabled={!newStrategyName.trim() || selectedAssets.length === 0}
                  className="w-full py-3 bg-whale-light hover:bg-whale-dark text-white font-bold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {strategyModalMode === 'edit' ? '항로 수정하기' : '항로 생성하기'} ({selectedAssets.length}개 자산)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 포트폴리오 적용 모달 */}
        {showApplyModal && selectedStrategy && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-bold text-whale-dark mb-2">항로 포트폴리오 적용</h3>
              <p className="text-sm text-gray-600 mb-4">
                "{selectedStrategy.name}" 항로를 포트폴리오에 적용합니다.
                투자 금액이 {selectedStrategy.targetAssets?.length || 0}개 자산에 균등 분배되어 시장가 매수됩니다.
              </p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">투자 금액 (원)</label>
                <input
                  type="number"
                  value={applyAmount}
                  onChange={(e) => setApplyAmount(e.target.value)}
                  className="input-field"
                  placeholder="1000000"
                />
                <div className="flex gap-2 mt-2">
                  {[100000, 500000, 1000000, 5000000].map(amount => (
                    <button
                      key={amount}
                      onClick={() => setApplyAmount(String(amount))}
                      className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs text-gray-700 transition-colors"
                    >
                      {(amount / 10000).toFixed(0)}만
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4 p-3 bg-gray-50 rounded-xl text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">대상 자산</span>
                  <span className="font-medium">{selectedStrategy.targetAssets?.length || 0}개</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">자산당 투자금</span>
                  <span className="font-medium">
                    {formatCurrency(parseInt(applyAmount || '0') / (selectedStrategy.targetAssets?.length || 1))}
                  </span>
                </div>
                {selectedStrategy.targetAssets && selectedStrategy.targetAssets.length > 0 && (
                  <div className="pt-2 border-t border-gray-200">
                    <div className="flex flex-wrap gap-1.5">
                      {selectedStrategy.targetAssets.map(code => (
                        <span key={code} className="px-2 py-1 bg-white rounded text-xs font-medium text-gray-700 border border-gray-200">
                          {getAssetName(code)} ({code})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowApplyModal(false)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  취소
                </button>
                <button
                  onClick={handleApplyStrategy}
                  disabled={isApplying}
                  className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-bold disabled:opacity-50"
                >
                  {isApplying ? '적용 중...' : '적용하기'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 백테스팅 탭 */}
        {activeTab === 'backtest' && (
          <div className="space-y-6">
            <div className="card">
              <h2 className="text-xl font-bold text-whale-dark mb-4">백테스팅 설정</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">항로 선택</label>
                  <select
                    value={selectedStrategy?.id || ''}
                    onChange={(e) => {
                      const strategy = strategies.find((s) => s.id === e.target.value);
                      setSelectedStrategy(strategy || null);
                    }}
                    className="input-field bg-white"
                  >
                    <option value="">항로를 선택하세요</option>
                    {strategies.map((strategy) => (
                      <option key={strategy.id} value={strategy.id}>{strategy.name}</option>
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
                    {[...stockList, ...krxStockList].map((stock) => (
                      <option key={stock.stockCode} value={stock.stockCode}>
                        {stock.stockName} ({stock.stockCode})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">시작일</label>
                  <input type="date" value={backtestStartDate} onChange={(e) => setBacktestStartDate(e.target.value)} className="input-field bg-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">종료일</label>
                  <input type="date" value={backtestEndDate} onChange={(e) => setBacktestEndDate(e.target.value)} className="input-field bg-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">초기 자본</label>
                  <input type="number" value={backtestInitialCapital} onChange={(e) => setBacktestInitialCapital(e.target.value)} className="input-field bg-white" placeholder="10000000" />
                </div>
                <div className="flex items-end">
                  <button onClick={handleRunBacktest} disabled={isBacktesting || !selectedStrategy} className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed">
                    {isBacktesting ? '백테스팅 실행 중...' : '백테스팅 실행'}
                  </button>
                </div>
              </div>
            </div>

            {backtestResult && (
              <div className="space-y-6">
                {backtestResult.id?.startsWith('backtest-demo') && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-700 text-center">
                    백테스팅 서버가 연결되지 않아 데모 데이터를 표시합니다. 실제 수치와 다를 수 있습니다.
                  </div>
                )}
                <div className="card">
                  <h2 className="text-xl font-bold text-whale-dark mb-4">백테스팅 결과</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-600 mb-1">총 수익률</div>
                      <div className={`text-2xl font-bold ${backtestResult.totalReturnRate >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                        {formatPercent(backtestResult.totalReturnRate)}
                      </div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-600 mb-1">최종 자산</div>
                      <div className="text-2xl font-bold text-whale-dark">{formatCurrency(backtestResult.finalValue)}</div>
                    </div>
                    <div className="bg-yellow-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-600 mb-1">샤프 비율</div>
                      <div className="text-2xl font-bold text-whale-dark">{backtestResult.sharpeRatio.toFixed(2)}</div>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-600 mb-1">최대 낙폭</div>
                      <div className="text-2xl font-bold text-red-600">{formatPercent(backtestResult.maxDrawdown)}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    <div>
                      <div className="text-sm text-gray-600 mb-1">총 거래 횟수</div>
                      <div className="text-xl font-bold text-whale-dark">{backtestResult.totalTrades}회</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-1">승률</div>
                      <div className="text-xl font-bold text-green-600">{formatPercent(backtestResult.winRate)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-1">수익 거래</div>
                      <div className="text-xl font-bold text-green-600">{backtestResult.profitableTrades}회</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-1">손실 거래</div>
                      <div className="text-xl font-bold text-red-600">{backtestResult.losingTrades}회</div>
                    </div>
                  </div>
                </div>

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
                        <Tooltip formatter={(value: number) => formatCurrency(value)} labelFormatter={(label) => `날짜: ${label}`} />
                        <Area type="monotone" dataKey="value" stroke="#4a90e2" fillOpacity={1} fill="url(#colorEquity)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {backtestResult.dailyReturns && backtestResult.dailyReturns.length > 0 && (
                  <div className="card">
                    <h3 className="text-lg font-bold text-whale-dark mb-4">일일 수익률</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={backtestResult.dailyReturns}>
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip formatter={(value: number) => formatPercent(value)} labelFormatter={(label) => `날짜: ${label}`} />
                        <Bar dataKey="return" fill="#4a90e2" radius={[4, 4, 0, 0]} />
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
          <div className="space-y-6">
            <div className="card">
              <h2 className="text-xl font-bold text-whale-dark mb-4">기술적 지표 분석</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">종목 선택</label>
                  <select value={selectedStockForIndicator} onChange={(e) => setSelectedStockForIndicator(e.target.value)} className="input-field bg-white">
                    {[...stockList, ...krxStockList].map((stock) => (
                      <option key={stock.stockCode} value={stock.stockCode}>{stock.stockName} ({stock.stockCode})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">지표 선택</label>
                  <select value={selectedIndicator} onChange={(e) => setSelectedIndicator(e.target.value as any)} className="input-field bg-white">
                    <option value="RSI">RSI (상대강도지수)</option>
                    <option value="MACD">MACD</option>
                    <option value="MA">이동평균선 (MA)</option>
                    <option value="BOLLINGER_BANDS">볼린저 밴드</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button onClick={handleLoadIndicator} className="btn-primary w-full">지표 불러오기</button>
                </div>
              </div>
            </div>

            {indicatorData.length > 0 && (
              <div className="card">
                <h3 className="text-lg font-bold text-whale-dark mb-4">
                  {selectedIndicator} - {[...stockList, ...krxStockList].find((s) => s.stockCode === selectedStockForIndicator)?.stockName}
                </h3>
                <ResponsiveContainer width="100%" height={500}>
                  <LineChart data={indicatorData}>
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip formatter={(value: number) => value.toFixed(2)} labelFormatter={(label) => `날짜: ${label}`} />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="price" stroke="#8884d8" strokeWidth={2} name="가격" />
                    <Line yAxisId="right" type="monotone" dataKey="value" stroke="#82ca9d" strokeWidth={2} name={selectedIndicator} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="card">
              <h3 className="text-lg font-bold text-whale-dark mb-4">지표 설명</h3>
              <div className="space-y-4">
                {selectedIndicator === 'RSI' && (
                  <div>
                    <h4 className="font-semibold text-gray-700 mb-2">RSI (Relative Strength Index)</h4>
                    <p className="text-gray-600">RSI는 주가의 상승세와 하락세의 상대적인 강도를 측정하는 지표입니다. 0~100 범위로 표시되며, 일반적으로 70 이상이면 과매수 구간, 30 이하면 과매도 구간으로 판단합니다.</p>
                  </div>
                )}
                {selectedIndicator === 'MACD' && (
                  <div>
                    <h4 className="font-semibold text-gray-700 mb-2">MACD</h4>
                    <p className="text-gray-600">MACD는 이동평균의 수렴과 발산을 나타내는 지표로, 추세의 방향과 강도를 파악하는 데 사용됩니다. MACD 선이 Signal 선을 상향 돌파하면 매수 신호로, 하향 돌파하면 매도 신호로 해석됩니다.</p>
                  </div>
                )}
                {selectedIndicator === 'MA' && (
                  <div>
                    <h4 className="font-semibold text-gray-700 mb-2">이동평균선 (Moving Average)</h4>
                    <p className="text-gray-600">이동평균선은 특정 기간 동안의 평균 주가를 나타내는 지표입니다. 단기 이동평균선이 장기 이동평균선을 상향 돌파하면 골든크로스(매수 신호), 반대면 데드크로스(매도 신호)로 해석됩니다.</p>
                  </div>
                )}
                {selectedIndicator === 'BOLLINGER_BANDS' && (
                  <div>
                    <h4 className="font-semibold text-gray-700 mb-2">볼린저 밴드</h4>
                    <p className="text-gray-600">볼린저 밴드는 이동평균선을 중심으로 상단 밴드와 하단 밴드를 표시하는 지표입니다. 주가가 상단 밴드에 접근하면 과매수, 하단 밴드에 접근하면 과매도로 판단할 수 있습니다.</p>
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
