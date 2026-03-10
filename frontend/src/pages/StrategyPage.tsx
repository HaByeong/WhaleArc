import { useState, useEffect, useRef, useCallback } from 'react';
import Header from '../components/Header';
import {
  strategyService,
  type Strategy,
  type BacktestResult,
  type IndicatorData,
  type Indicator,
  type Condition,
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
  Bar,
  ReferenceLine,
  ComposedChart,
  CartesianGrid,
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

  // 지표 + 조건 상태
  const [newIndicators, setNewIndicators] = useState<Indicator[]>([]);
  const [newEntryConditions, setNewEntryConditions] = useState<Condition[]>([]);
  const [newExitConditions, setNewExitConditions] = useState<Condition[]>([]);

  // 포트폴리오 적용 모달 상태
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyAmount, setApplyAmount] = useState('1000000');
  const [isApplying, setIsApplying] = useState(false);

  // 백테스팅 폼 상태
  const [backtestMode, setBacktestMode] = useState<'strategy' | 'stock'>('strategy');
  const [backtestStockCode, setBacktestStockCode] = useState('');
  const [backtestStartDate, setBacktestStartDate] = useState('');
  const [backtestEndDate, setBacktestEndDate] = useState('');
  const [backtestInitialCapital, setBacktestInitialCapital] = useState('10000000');

  // 리스크 관리
  const [stopLossPercent, setStopLossPercent] = useState('');
  const [takeProfitPercent, setTakeProfitPercent] = useState('');
  const [trailingStopPercent, setTrailingStopPercent] = useState('');
  const [slippagePercent, setSlippagePercent] = useState('0.1');
  const [commissionRate, setCommissionRate] = useState('0.1');
  const [positionSizing, setPositionSizing] = useState('ALL_IN');
  const [positionValue, setPositionValue] = useState('');
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  // 종목 분석 모드 조건
  const [directEntryConditions, setDirectEntryConditions] = useState<Condition[]>([]);
  const [directExitConditions, setDirectExitConditions] = useState<Condition[]>([]);

  // 기술적 지표 선택
  const [selectedIndicator, setSelectedIndicator] = useState<string>('RSI');
  const [selectedStockForIndicator, setSelectedStockForIndicator] = useState('');
  const [indicatorSearchQuery, setIndicatorSearchQuery] = useState('');
  const [indicatorSearchResults, setIndicatorSearchResults] = useState<{ code: string; name: string; market?: string }[]>([]);
  const [isIndicatorSearching, setIsIndicatorSearching] = useState(false);
  const [indicatorStockName, setIndicatorStockName] = useState('');
  const [indicatorStockMarket, setIndicatorStockMarket] = useState<string>('CRYPTO');
  const [isLoadingIndicator, setIsLoadingIndicator] = useState(false);
  const indicatorSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showIndicatorDropdown, setShowIndicatorDropdown] = useState(false);

  // 데이터 로드
  useEffect(() => {
    loadStrategies();
    loadStockList();
    const today = new Date().toISOString().split('T')[0];
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setBacktestEndDate(today);
    setBacktestStartDate(sixMonthsAgo);
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
        const first = allList[0];
        const isCrypto = cryptos.some(c => c.stockCode === first.stockCode);
        setSelectedStockForIndicator(first.stockCode);
        setIndicatorStockName(first.stockName);
        setIndicatorStockMarket(isCrypto ? 'CRYPTO' : 'KRX');
        setIndicatorSearchQuery(first.stockName);
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

    // 가상화폐: 기존 목록에서 필터
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

  // 기술적 지표 종목 검색 핸들러
  const handleIndicatorStockSearch = useCallback((query: string) => {
    setIndicatorSearchQuery(query);
    if (indicatorSearchTimerRef.current) clearTimeout(indicatorSearchTimerRef.current);

    if (!query.trim()) {
      setIndicatorSearchResults([]);
      setIsIndicatorSearching(false);
      setShowIndicatorDropdown(false);
      return;
    }

    setShowIndicatorDropdown(true);
    const lowerQuery = query.toLowerCase();

    // 가상화폐 로컬 필터
    const cryptoResults = stockList
      .filter(s => s.stockCode.toLowerCase().includes(lowerQuery) || s.stockName.toLowerCase().includes(lowerQuery))
      .map(s => ({ code: s.stockCode, name: s.stockName, market: 'CRYPTO' as string }));

    // KRX 로컬 필터
    const krxLocalResults = krxStockList
      .filter(s => s.stockCode.toLowerCase().includes(lowerQuery) || s.stockName.toLowerCase().includes(lowerQuery))
      .map(s => ({ code: s.stockCode, name: s.stockName, market: 'KRX' as string }));

    setIndicatorSearchResults([...cryptoResults, ...krxLocalResults].slice(0, 20));

    // API 검색 (더 넓은 KRX 종목)
    setIsIndicatorSearching(true);
    indicatorSearchTimerRef.current = setTimeout(async () => {
      try {
        const results = await tradeService.searchKrxStocks(query);
        const apiResults = results.map(r => ({ code: r.code, name: r.name, market: r.market || 'KRX' }));
        // 로컬 + API 결과 합치고 중복 제거
        const merged = [...cryptoResults];
        const seen = new Set(cryptoResults.map(r => r.code));
        for (const r of [...krxLocalResults, ...apiResults]) {
          if (!seen.has(r.code)) {
            seen.add(r.code);
            merged.push(r);
          }
        }
        setIndicatorSearchResults(merged.slice(0, 30));
      } catch {
        // 로컬 결과 유지
      } finally {
        setIsIndicatorSearching(false);
      }
    }, 300);
  }, [stockList, krxStockList]);

  const handleIndicatorStockSelect = (code: string, name: string, market?: string) => {
    setSelectedStockForIndicator(code);
    setIndicatorStockName(name);
    setIndicatorStockMarket(market || 'CRYPTO');
    setIndicatorSearchQuery(name);
    setShowIndicatorDropdown(false);
    setIndicatorSearchResults([]);
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
    setNewIndicators([]);
    setNewEntryConditions([]);
    setNewExitConditions([]);
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
    setNewIndicators(strategy.indicators || []);
    setNewEntryConditions(strategy.entryConditions || []);
    setNewExitConditions(strategy.exitConditions || []);
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
          indicators: newIndicators,
          entryConditions: newEntryConditions,
          exitConditions: newExitConditions,
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
          indicators: newIndicators,
          entryConditions: newEntryConditions,
          exitConditions: newExitConditions,
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

  // 백테스트 종목 검색
  const [backtestSearchQuery, setBacktestSearchQuery] = useState('');
  const [backtestSearchResults, setBacktestSearchResults] = useState<{ code: string; name: string; market?: string }[]>([]);
  const [isBacktestSearching, setIsBacktestSearching] = useState(false);
  const [backtestStockName, setBacktestStockName] = useState('');
  const [backtestAssetType, setBacktestAssetType] = useState<string>('CRYPTO');
  const [showBacktestDropdown, setShowBacktestDropdown] = useState(false);
  const backtestSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleBacktestSearch = (query: string) => {
    setBacktestSearchQuery(query);
    if (backtestSearchTimerRef.current) clearTimeout(backtestSearchTimerRef.current);
    if (!query.trim()) {
      setBacktestSearchResults([]);
      setShowBacktestDropdown(false);
      return;
    }
    setIsBacktestSearching(true);
    backtestSearchTimerRef.current = setTimeout(async () => {
      try {
        const cryptoResults = stockList
          .filter(s => s.stockName.includes(query) || s.stockCode.toLowerCase().includes(query.toLowerCase()))
          .map(s => ({ code: s.stockCode, name: s.stockName, market: 'CRYPTO' }));
        const krxResults = await tradeService.searchKrxStocks(query).catch(() => []);
        const krxMapped = krxResults.map((s: any) => ({ code: s.stockCode || s.code, name: s.stockName || s.name, market: 'STOCK' }));
        setBacktestSearchResults([...cryptoResults.slice(0, 10), ...krxMapped.slice(0, 10)]);
        setShowBacktestDropdown(true);
      } catch {
        setBacktestSearchResults([]);
      } finally {
        setIsBacktestSearching(false);
      }
    }, 300);
  };

  const handleBacktestStockSelect = (code: string, name: string, market?: string) => {
    setBacktestStockCode(code);
    setBacktestStockName(name);
    setBacktestAssetType(market || 'CRYPTO');
    setBacktestSearchQuery(name);
    setShowBacktestDropdown(false);
    setBacktestSearchResults([]);
  };

  const handleRunBacktest = async () => {
    if (backtestMode === 'strategy' && !selectedStrategy) {
      alert('항로를 선택해주세요.');
      return;
    }

    if (!backtestStockCode || !backtestStartDate || !backtestEndDate) {
      alert('종목, 시작일, 종료일을 모두 입력해주세요.');
      return;
    }

    if (backtestMode === 'stock' && directEntryConditions.length === 0 && directExitConditions.length === 0) {
      alert('진입 조건 또는 청산 조건을 최소 1개 설정해주세요.');
      return;
    }

    // 청산 조건 없이 실행하면 경고
    if (backtestMode === 'stock' && directEntryConditions.length > 0 && directExitConditions.length === 0
        && !stopLossPercent && !takeProfitPercent && !trailingStopPercent) {
      if (!window.confirm('청산 조건이 없습니다.\n\n손절/익절/트레일링 스탑도 미설정 상태이므로,\n매수 후 백테스트 종료 시까지 매도하지 않습니다.\n\n그래도 실행하시겠습니까?')) return;
    }

    setIsBacktesting(true);
    setBacktestResult(null);

    try {
      const request: any = {
        stockCode: backtestStockCode,
        stockName: backtestStockName || backtestStockCode,
        startDate: backtestStartDate,
        endDate: backtestEndDate,
        initialCapital: parseInt(backtestInitialCapital),
        assetType: backtestAssetType,
      };

      // 리스크 관리 파라미터
      if (stopLossPercent) request.stopLossPercent = parseFloat(stopLossPercent);
      if (takeProfitPercent) request.takeProfitPercent = parseFloat(takeProfitPercent);
      if (trailingStopPercent) request.trailingStopPercent = parseFloat(trailingStopPercent);
      if (slippagePercent) request.slippagePercent = parseFloat(slippagePercent);
      if (commissionRate && commissionRate !== '0.1') request.commissionRate = parseFloat(commissionRate);
      if (positionSizing !== 'ALL_IN') {
        request.positionSizing = positionSizing;
        if (positionValue) request.positionValue = parseFloat(positionValue);
      }

      if (backtestMode === 'strategy') {
        request.strategyId = selectedStrategy!.id;
      } else {
        request.entryConditions = directEntryConditions;
        request.exitConditions = directExitConditions;
      }

      const result = await strategyService.runBacktest(request);
      setBacktestResult(result);
    } catch (error: any) {
      const rawMsg = error.response?.data?.error || error.message || '';
      let msg = rawMsg;
      if (rawMsg.includes('캔들스틱 데이터를 가져올 수 없습니다')) {
        msg = `${backtestStockName || backtestStockCode}의 시세 데이터를 불러올 수 없습니다.\n\n• 종목코드가 올바른지 확인해주세요\n• 상장폐지/거래정지 종목은 조회가 안 됩니다`;
      } else if (rawMsg.includes('충분한 데이터가 없습니다')) {
        msg = `선택한 기간(${backtestStartDate} ~ ${backtestEndDate})에 데이터가 부족합니다.\n\n• 시작일을 더 최근으로 조정해보세요\n• 신규 상장 종목은 상장일 이후부터 가능합니다`;
      } else if (!msg) {
        msg = '백테스팅 실행에 실패했습니다. 잠시 후 다시 시도해주세요.';
      }
      alert(msg);
    } finally {
      setIsBacktesting(false);
    }
  };

  // 종목 분석 모드 프리셋
  const [activePreset, setActivePreset] = useState<string>('');
  const applyDirectPreset = (preset: string) => {
    setActivePreset(preset);
    switch (preset) {
      case 'RSI':
        setDirectEntryConditions([{ indicator: 'RSI', operator: 'LT', value: 30, logic: 'AND' }]);
        setDirectExitConditions([{ indicator: 'RSI', operator: 'GT', value: 70, logic: 'AND' }]);
        break;
      case 'MACD':
        setDirectEntryConditions([{ indicator: 'MACD_CROSS_MACD_SIGNAL', operator: 'GT', value: 0, logic: 'AND' }]);
        setDirectExitConditions([{ indicator: 'MACD_CROSSUNDER_MACD_SIGNAL', operator: 'GT', value: 0, logic: 'AND' }]);
        break;
      case 'BOLLINGER':
        setDirectEntryConditions([{ indicator: 'BOLLINGER_PCT_B', operator: 'LT', value: 0, logic: 'AND' }]);
        setDirectExitConditions([{ indicator: 'BOLLINGER_PCT_B', operator: 'GT', value: 1, logic: 'AND' }]);
        break;
      case 'RSI_CONSERVATIVE':
        setDirectEntryConditions([{ indicator: 'RSI', operator: 'LT', value: 40, logic: 'AND' }]);
        setDirectExitConditions([{ indicator: 'RSI', operator: 'GT', value: 60, logic: 'AND' }]);
        break;
      case 'STOCHASTIC':
        setDirectEntryConditions([{ indicator: 'STOCH_K_CROSS_STOCH_D', operator: 'GT', value: 0, logic: 'AND' }]);
        setDirectExitConditions([{ indicator: 'STOCH_K_CROSSUNDER_STOCH_D', operator: 'GT', value: 0, logic: 'AND' }]);
        break;
      case 'GOLDEN_CROSS':
        setDirectEntryConditions([{ indicator: 'EMA_CROSS_MA', operator: 'GT', value: 0, logic: 'AND' }]);
        setDirectExitConditions([{ indicator: 'EMA_CROSSUNDER_MA', operator: 'GT', value: 0, logic: 'AND' }]);
        break;
    }
  };

  // 종목 분석 조건 편집
  const updateDirectCondition = (type: 'entry' | 'exit', index: number, field: string, val: any) => {
    const setter = type === 'entry' ? setDirectEntryConditions : setDirectExitConditions;
    const conditions = type === 'entry' ? [...directEntryConditions] : [...directExitConditions];
    conditions[index] = { ...conditions[index], [field]: val };
    setter(conditions);
    setActivePreset('');
  };

  const addDirectCondition = (type: 'entry' | 'exit') => {
    const newCond: Condition = { indicator: 'RSI', operator: 'LT', value: 30, logic: 'AND' };
    if (type === 'entry') setDirectEntryConditions([...directEntryConditions, newCond]);
    else setDirectExitConditions([...directExitConditions, newCond]);
    setActivePreset('');
  };

  const removeDirectCondition = (type: 'entry' | 'exit', index: number) => {
    if (type === 'entry') setDirectEntryConditions(directEntryConditions.filter((_, i) => i !== index));
    else setDirectExitConditions(directExitConditions.filter((_, i) => i !== index));
    setActivePreset('');
  };

  // 종목 + 지표 변경 시 자동 로드
  const indicatorLoadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!selectedStockForIndicator || !selectedIndicator) return;

    // 디바운스 300ms (종목/지표 빠르게 변경 시 마지막 것만 호출)
    if (indicatorLoadTimerRef.current) clearTimeout(indicatorLoadTimerRef.current);
    indicatorLoadTimerRef.current = setTimeout(async () => {
      setIsLoadingIndicator(true);
      try {
        const assetType = indicatorStockMarket === 'CRYPTO' ? undefined : 'STOCK';
        const data = await strategyService.getIndicatorData(
          selectedStockForIndicator, selectedIndicator, assetType
        );
        setIndicatorData(data);
      } catch {
        // 자동 로드이므로 alert 대신 조용히 실패
        setIndicatorData([]);
      } finally {
        setIsLoadingIndicator(false);
      }
    }, 300);

    return () => {
      if (indicatorLoadTimerRef.current) clearTimeout(indicatorLoadTimerRef.current);
    };
  }, [selectedStockForIndicator, selectedIndicator, indicatorStockMarket]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency', currency: 'KRW', minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const assetTypeLabel = (type: string) => {
    if (type === 'CRYPTO') return '가상화폐';
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
                            <span key={index} className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm border border-blue-200">
                              <span className="font-semibold">{indicator.type}</span>
                              <span className="text-blue-400 text-xs ml-1">
                                ({Object.entries(indicator.parameters).map(([k, v]) => `${k}=${v}`).join(', ')})
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedStrategy.entryConditions && selectedStrategy.entryConditions.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-red-600 mb-2 text-sm">매수 조건 (진입)</h3>
                        <div className="space-y-1.5">
                          {selectedStrategy.entryConditions.map((condition, index) => (
                            <div key={index} className="flex items-center gap-1.5 text-sm">
                              {index > 0 && <span className="text-xs font-bold text-gray-400 px-1">{condition.logic}</span>}
                              <span className="px-2 py-0.5 bg-red-50 text-red-700 rounded font-medium">{condition.indicator}</span>
                              <span className="text-gray-500 font-bold">{({'GT':'>','GTE':'≥','LT':'<','LTE':'≤','EQ':'='} as any)[condition.operator]}</span>
                              <span className="font-semibold text-gray-800">{condition.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedStrategy.exitConditions && selectedStrategy.exitConditions.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-blue-600 mb-2 text-sm">매도 조건 (청산)</h3>
                        <div className="space-y-1.5">
                          {selectedStrategy.exitConditions.map((condition, index) => (
                            <div key={index} className="flex items-center gap-1.5 text-sm">
                              {index > 0 && <span className="text-xs font-bold text-gray-400 px-1">{condition.logic}</span>}
                              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-medium">{condition.indicator}</span>
                              <span className="text-gray-500 font-bold">{({'GT':'>','GTE':'≥','LT':'<','LTE':'≤','EQ':'='} as any)[condition.operator]}</span>
                              <span className="font-semibold text-gray-800">{condition.value}</span>
                            </div>
                          ))}
                        </div>
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
                      placeholder={newAssetType === 'CRYPTO' ? '가상화폐 검색 (BTC, ETH...)' : newAssetType === 'STOCK' ? '종목명 또는 종목코드로 검색 (전체 KRX)' : '자산 검색 (가상화폐 + 전체 KRX 주식)'}
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

                {/* Step 4: 매매 조건 (백테스팅용) */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
                      newEntryConditions.length > 0 || newExitConditions.length > 0 ? 'bg-whale-light text-white' : 'bg-gray-300 text-white'
                    }`}>4</span>
                    <span className="font-semibold text-gray-800">매매 조건</span>
                    <span className="text-xs text-gray-400">(백테스팅에 사용)</span>
                  </div>
                  <div className="pl-8 space-y-4">

                    {/* 지표 추가 */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-600">사용할 지표</label>
                        <select
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white"
                          value=""
                          onChange={(e) => {
                            if (!e.target.value) return;
                            const type = e.target.value as Indicator['type'];
                            const defaults: Record<string, Record<string, number>> = {
                              RSI: { period: 14 },
                              MACD: { fast: 12, slow: 26, signal: 9 },
                              MA: { period: 20 },
                              BOLLINGER_BANDS: { period: 20, stdDev: 2 },
                            };
                            if (!newIndicators.some(ind => ind.type === type)) {
                              setNewIndicators([...newIndicators, { type, parameters: defaults[type] || {} }]);
                            }
                          }}
                        >
                          <option value="">+ 지표 추가</option>
                          {(['RSI', 'MACD', 'MA', 'BOLLINGER_BANDS'] as const)
                            .filter(t => !newIndicators.some(ind => ind.type === t))
                            .map(t => (
                              <option key={t} value={t}>
                                {t === 'RSI' ? 'RSI (상대강도지수)' : t === 'MACD' ? 'MACD' : t === 'MA' ? '이동평균선 (MA)' : '볼린저 밴드'}
                              </option>
                            ))}
                        </select>
                      </div>
                      {newIndicators.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {newIndicators.map((ind, idx) => (
                            <div key={idx} className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5 text-sm">
                              <span className="font-semibold text-blue-700">{ind.type}</span>
                              <span className="text-blue-400 text-xs">
                                ({Object.entries(ind.parameters).map(([k, v]) => `${k}=${v}`).join(', ')})
                              </span>
                              <button
                                type="button"
                                onClick={() => setNewIndicators(newIndicators.filter((_, i) => i !== idx))}
                                className="ml-1 text-blue-300 hover:text-red-500 text-xs"
                              >x</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 진입 조건 */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-red-600">매수 조건 (진입)</label>
                        <button
                          type="button"
                          onClick={() => setNewEntryConditions([...newEntryConditions, { indicator: 'RSI', operator: 'LT', value: 30, logic: 'AND' }])}
                          className="text-xs text-red-500 hover:text-red-700 font-medium"
                        >+ 조건 추가</button>
                      </div>
                      {newEntryConditions.length === 0 && (
                        <p className="text-xs text-gray-400">조건을 추가하면 백테스팅 시 자동으로 매수 시점을 판단합니다</p>
                      )}
                      {newEntryConditions.map((cond, idx) => (
                        <div key={idx} className="flex items-center gap-2 mb-2">
                          {idx > 0 && (
                            <select
                              className="text-xs border border-gray-200 rounded px-1.5 py-1 bg-white w-14"
                              value={cond.logic}
                              onChange={(e) => {
                                const updated = [...newEntryConditions];
                                updated[idx] = { ...cond, logic: e.target.value as 'AND' | 'OR' };
                                setNewEntryConditions(updated);
                              }}
                            >
                              <option value="AND">AND</option>
                              <option value="OR">OR</option>
                            </select>
                          )}
                          <select
                            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white flex-1"
                            value={cond.indicator}
                            onChange={(e) => {
                              const updated = [...newEntryConditions];
                              updated[idx] = { ...cond, indicator: e.target.value };
                              setNewEntryConditions(updated);
                            }}
                          >
                            <option value="PRICE">가격</option>
                            <option value="RSI">RSI</option>
                            <option value="MACD">MACD</option>
                            <option value="MACD_SIGNAL">MACD 시그널</option>
                            <option value="MACD_HISTOGRAM">MACD 히스토그램</option>
                            <option value="MA">이동평균 (MA)</option>
                            <option value="BOLLINGER_UPPER">볼린저 상단</option>
                            <option value="BOLLINGER_MIDDLE">볼린저 중간</option>
                            <option value="BOLLINGER_LOWER">볼린저 하단</option>
                          </select>
                          <select
                            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white w-16"
                            value={cond.operator}
                            onChange={(e) => {
                              const updated = [...newEntryConditions];
                              updated[idx] = { ...cond, operator: e.target.value as Condition['operator'] };
                              setNewEntryConditions(updated);
                            }}
                          >
                            <option value="GT">&gt;</option>
                            <option value="GTE">&ge;</option>
                            <option value="LT">&lt;</option>
                            <option value="LTE">&le;</option>
                            <option value="EQ">=</option>
                          </select>
                          <input
                            type="number"
                            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white w-20"
                            value={cond.value}
                            onChange={(e) => {
                              const updated = [...newEntryConditions];
                              updated[idx] = { ...cond, value: parseFloat(e.target.value) || 0 };
                              setNewEntryConditions(updated);
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setNewEntryConditions(newEntryConditions.filter((_, i) => i !== idx))}
                            className="text-gray-300 hover:text-red-500 text-sm"
                          >x</button>
                        </div>
                      ))}
                    </div>

                    {/* 청산 조건 */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-blue-600">매도 조건 (청산)</label>
                        <button
                          type="button"
                          onClick={() => setNewExitConditions([...newExitConditions, { indicator: 'RSI', operator: 'GT', value: 70, logic: 'AND' }])}
                          className="text-xs text-blue-500 hover:text-blue-700 font-medium"
                        >+ 조건 추가</button>
                      </div>
                      {newExitConditions.length === 0 && (
                        <p className="text-xs text-gray-400">조건을 추가하면 백테스팅 시 자동으로 매도 시점을 판단합니다</p>
                      )}
                      {newExitConditions.map((cond, idx) => (
                        <div key={idx} className="flex items-center gap-2 mb-2">
                          {idx > 0 && (
                            <select
                              className="text-xs border border-gray-200 rounded px-1.5 py-1 bg-white w-14"
                              value={cond.logic}
                              onChange={(e) => {
                                const updated = [...newExitConditions];
                                updated[idx] = { ...cond, logic: e.target.value as 'AND' | 'OR' };
                                setNewExitConditions(updated);
                              }}
                            >
                              <option value="AND">AND</option>
                              <option value="OR">OR</option>
                            </select>
                          )}
                          <select
                            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white flex-1"
                            value={cond.indicator}
                            onChange={(e) => {
                              const updated = [...newExitConditions];
                              updated[idx] = { ...cond, indicator: e.target.value };
                              setNewExitConditions(updated);
                            }}
                          >
                            <option value="PRICE">가격</option>
                            <option value="RSI">RSI</option>
                            <option value="MACD">MACD</option>
                            <option value="MACD_SIGNAL">MACD 시그널</option>
                            <option value="MACD_HISTOGRAM">MACD 히스토그램</option>
                            <option value="MA">이동평균 (MA)</option>
                            <option value="BOLLINGER_UPPER">볼린저 상단</option>
                            <option value="BOLLINGER_MIDDLE">볼린저 중간</option>
                            <option value="BOLLINGER_LOWER">볼린저 하단</option>
                          </select>
                          <select
                            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white w-16"
                            value={cond.operator}
                            onChange={(e) => {
                              const updated = [...newExitConditions];
                              updated[idx] = { ...cond, operator: e.target.value as Condition['operator'] };
                              setNewExitConditions(updated);
                            }}
                          >
                            <option value="GT">&gt;</option>
                            <option value="GTE">&ge;</option>
                            <option value="LT">&lt;</option>
                            <option value="LTE">&le;</option>
                            <option value="EQ">=</option>
                          </select>
                          <input
                            type="number"
                            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white w-20"
                            value={cond.value}
                            onChange={(e) => {
                              const updated = [...newExitConditions];
                              updated[idx] = { ...cond, value: parseFloat(e.target.value) || 0 };
                              setNewExitConditions(updated);
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setNewExitConditions(newExitConditions.filter((_, i) => i !== idx))}
                            className="text-gray-300 hover:text-red-500 text-sm"
                          >x</button>
                        </div>
                      ))}
                    </div>

                    {/* 프리셋 버튼 */}
                    {newIndicators.length === 0 && newEntryConditions.length === 0 && newExitConditions.length === 0 && (
                      <div className="pt-1">
                        <p className="text-xs text-gray-500 mb-2">빠른 설정 (프리셋)</p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setNewIndicators([{ type: 'RSI', parameters: { period: 14 } }]);
                              setNewEntryConditions([{ indicator: 'RSI', operator: 'LT', value: 30, logic: 'AND' }]);
                              setNewExitConditions([{ indicator: 'RSI', operator: 'GT', value: 70, logic: 'AND' }]);
                            }}
                            className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-xs font-medium hover:bg-purple-100 border border-purple-200"
                          >RSI 과매수/과매도</button>
                          <button
                            type="button"
                            onClick={() => {
                              setNewIndicators([{ type: 'MACD', parameters: { fast: 12, slow: 26, signal: 9 } }]);
                              setNewEntryConditions([{ indicator: 'MACD_HISTOGRAM', operator: 'GT', value: 0, logic: 'AND' }]);
                              setNewExitConditions([{ indicator: 'MACD_HISTOGRAM', operator: 'LT', value: 0, logic: 'AND' }]);
                            }}
                            className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100 border border-blue-200"
                          >MACD 골든/데드크로스</button>
                          <button
                            type="button"
                            onClick={() => {
                              setNewIndicators([{ type: 'BOLLINGER_BANDS', parameters: { period: 20, stdDev: 2 } }]);
                              setNewEntryConditions([{ indicator: 'PRICE', operator: 'LT', value: 0, logic: 'AND' }]);
                              setNewExitConditions([{ indicator: 'PRICE', operator: 'GT', value: 0, logic: 'AND' }]);
                              // 볼린저는 값이 동적이므로 힌트 표시
                              alert('볼린저 밴드 전략:\n매수 조건의 값을 볼린저 하단 근처 가격으로,\n매도 조건의 값을 볼린저 상단 근처 가격으로 설정하세요.\n\n또는 RSI와 조합하여 사용하면 더 효과적입니다.');
                            }}
                            className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium hover:bg-indigo-100 border border-indigo-200"
                          >볼린저 밴드 반전</button>
                        </div>
                      </div>
                    )}
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
            <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl border border-slate-200 p-6 md:p-8">
              {/* 모드 토글 */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white text-lg shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-slate-800">백테스팅</h2>
                  <p className="text-sm text-slate-500">전략의 과거 성과를 시뮬레이션합니다</p>
                </div>
                <div className="flex bg-white rounded-xl border border-slate-200 p-1">
                  <button
                    onClick={() => setBacktestMode('strategy')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${backtestMode === 'strategy' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    항로 백테스트
                  </button>
                  <button
                    onClick={() => setBacktestMode('stock')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${backtestMode === 'stock' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    종목 분석
                  </button>
                </div>
              </div>

              {/* 모드별 상단 영역 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                {backtestMode === 'strategy' ? (
                  /* 항로 모드: 항로 선택 */
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">항로 선택</label>
                    <select
                      value={selectedStrategy?.id || ''}
                      onChange={(e) => {
                        const strategy = strategies.find((s) => s.id === e.target.value);
                        setSelectedStrategy(strategy || null);
                      }}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all appearance-none cursor-pointer"
                    >
                      <option value="">항로를 선택하세요</option>
                      {strategies.map((strategy) => (
                        <option key={strategy.id} value={strategy.id}>{strategy.name}</option>
                      ))}
                    </select>
                    {selectedStrategy && (
                      <div className="mt-2 text-xs text-slate-500">
                        진입 {selectedStrategy.entryConditions?.length || 0}개 · 청산 {selectedStrategy.exitConditions?.length || 0}개 조건
                      </div>
                    )}
                  </div>
                ) : (
                  /* 종목 분석 모드: 프리셋 + 조건 편집 */
                  <div className="md:col-span-2">
                    {/* 프리셋 버튼 */}
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">빠른 프리셋</label>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {[
                        { id: 'RSI', label: 'RSI 과매도/과매수 (30/70)' },
                        { id: 'MACD', label: 'MACD 골든/데드크로스' },
                        { id: 'BOLLINGER', label: '볼린저 밴드 돌파' },
                        { id: 'STOCHASTIC', label: '스토캐스틱 크로스' },
                        { id: 'GOLDEN_CROSS', label: 'EMA/SMA 크로스' },
                        { id: 'RSI_CONSERVATIVE', label: 'RSI 보수적 (40/60)' },
                      ].map((p) => (
                        <button
                          key={p.id}
                          onClick={() => applyDirectPreset(p.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                            activePreset === p.id
                              ? 'border-blue-400 bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>

                    {/* 진입 조건 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">진입 조건 (매수)</label>
                          <button onClick={() => addDirectCondition('entry')} className="text-xs text-blue-500 hover:text-blue-700 font-medium">+ 추가</button>
                        </div>
                        <div className="space-y-2">
                          {directEntryConditions.map((c, i) => {
                            const isCross = c.indicator.includes('_CROSS_') || c.indicator.includes('_CROSSUNDER_');
                            return (
                            <div key={i} className="flex items-center gap-1.5 bg-white rounded-lg border border-slate-200 p-2">
                              <select value={c.indicator} onChange={(e) => updateDirectCondition('entry', i, 'indicator', e.target.value)}
                                className={`${isCross ? 'flex-1' : 'flex-1'} text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white`}>
                                <option value="RSI">RSI</option>
                                <option value="MACD">MACD</option>
                                <option value="MACD_SIGNAL">MACD 시그널</option>
                                <option value="MACD_HISTOGRAM">MACD 히스토그램</option>
                                <option value="MA">이동평균(MA)</option>
                                <option value="EMA">지수이동평균(EMA)</option>
                                <option value="BOLLINGER_UPPER">볼린저 상단</option>
                                <option value="BOLLINGER_LOWER">볼린저 하단</option>
                                <option value="BOLLINGER_PCT_B">볼린저 %B</option>
                                <option value="STOCH_K">스토캐스틱 %K</option>
                                <option value="STOCH_D">스토캐스틱 %D</option>
                                <option value="ATR">ATR</option>
                                <option value="CCI">CCI</option>
                                <option value="WILLIAMS_R">Williams %R</option>
                                <option value="OBV">OBV</option>
                                <option value="MACD_CROSS_MACD_SIGNAL">MACD 골든크로스</option>
                                <option value="MACD_CROSSUNDER_MACD_SIGNAL">MACD 데드크로스</option>
                                <option value="STOCH_K_CROSS_STOCH_D">스토캐스틱 골든크로스</option>
                                <option value="STOCH_K_CROSSUNDER_STOCH_D">스토캐스틱 데드크로스</option>
                                <option value="EMA_CROSS_MA">EMA ↑ SMA 크로스</option>
                                <option value="EMA_CROSSUNDER_MA">EMA ↓ SMA 크로스</option>
                                <option value="PRICE">현재가</option>
                              </select>
                              {!isCross && (
                                <>
                                  <select value={c.operator} onChange={(e) => updateDirectCondition('entry', i, 'operator', e.target.value)}
                                    className="w-14 text-xs border border-slate-200 rounded-lg px-1 py-1.5 bg-white text-center">
                                    <option value="GT">&gt;</option>
                                    <option value="LT">&lt;</option>
                                    <option value="GTE">&ge;</option>
                                    <option value="LTE">&le;</option>
                                  </select>
                                  <input type="number" value={c.value} onChange={(e) => updateDirectCondition('entry', i, 'value', parseFloat(e.target.value) || 0)}
                                    className="w-16 text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-right" />
                                </>
                              )}
                              {isCross && <span className="text-[10px] text-emerald-600 font-medium px-2">발생 시</span>}
                              <button onClick={() => removeDirectCondition('entry', i)} className="text-slate-300 hover:text-red-500 text-sm px-1">&times;</button>
                            </div>
                            );
                          })}
                          {directEntryConditions.length === 0 && (
                            <div className="text-xs text-slate-400 text-center py-3 bg-white rounded-lg border border-dashed border-slate-200">프리셋을 선택하거나 조건을 추가하세요</div>
                          )}
                        </div>
                      </div>

                      {/* 청산 조건 */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-semibold text-rose-600 uppercase tracking-wider">청산 조건 (매도)</label>
                          <button onClick={() => addDirectCondition('exit')} className="text-xs text-blue-500 hover:text-blue-700 font-medium">+ 추가</button>
                        </div>
                        <div className="space-y-2">
                          {directExitConditions.map((c, i) => {
                            const isCross = c.indicator.includes('_CROSS_') || c.indicator.includes('_CROSSUNDER_');
                            return (
                            <div key={i} className="flex items-center gap-1.5 bg-white rounded-lg border border-slate-200 p-2">
                              <select value={c.indicator} onChange={(e) => updateDirectCondition('exit', i, 'indicator', e.target.value)}
                                className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white">
                                <option value="RSI">RSI</option>
                                <option value="MACD">MACD</option>
                                <option value="MACD_SIGNAL">MACD 시그널</option>
                                <option value="MACD_HISTOGRAM">MACD 히스토그램</option>
                                <option value="MA">이동평균(MA)</option>
                                <option value="EMA">지수이동평균(EMA)</option>
                                <option value="BOLLINGER_UPPER">볼린저 상단</option>
                                <option value="BOLLINGER_LOWER">볼린저 하단</option>
                                <option value="BOLLINGER_PCT_B">볼린저 %B</option>
                                <option value="STOCH_K">스토캐스틱 %K</option>
                                <option value="STOCH_D">스토캐스틱 %D</option>
                                <option value="ATR">ATR</option>
                                <option value="CCI">CCI</option>
                                <option value="WILLIAMS_R">Williams %R</option>
                                <option value="OBV">OBV</option>
                                <option value="MACD_CROSS_MACD_SIGNAL">MACD 골든크로스</option>
                                <option value="MACD_CROSSUNDER_MACD_SIGNAL">MACD 데드크로스</option>
                                <option value="STOCH_K_CROSS_STOCH_D">스토캐스틱 골든크로스</option>
                                <option value="STOCH_K_CROSSUNDER_STOCH_D">스토캐스틱 데드크로스</option>
                                <option value="EMA_CROSS_MA">EMA ↑ SMA 크로스</option>
                                <option value="EMA_CROSSUNDER_MA">EMA ↓ SMA 크로스</option>
                                <option value="PRICE">현재가</option>
                              </select>
                              {!isCross && (
                                <>
                                  <select value={c.operator} onChange={(e) => updateDirectCondition('exit', i, 'operator', e.target.value)}
                                    className="w-14 text-xs border border-slate-200 rounded-lg px-1 py-1.5 bg-white text-center">
                                    <option value="GT">&gt;</option>
                                    <option value="LT">&lt;</option>
                                    <option value="GTE">&ge;</option>
                                    <option value="LTE">&le;</option>
                                  </select>
                                  <input type="number" value={c.value} onChange={(e) => updateDirectCondition('exit', i, 'value', parseFloat(e.target.value) || 0)}
                                    className="w-16 text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-right" />
                                </>
                              )}
                              {isCross && <span className="text-[10px] text-emerald-600 font-medium px-2">발생 시</span>}
                              <button onClick={() => removeDirectCondition('exit', i)} className="text-slate-300 hover:text-red-500 text-sm px-1">&times;</button>
                            </div>
                            );
                          })}
                          {directExitConditions.length === 0 && (
                            <div className="text-xs text-slate-400 text-center py-3 bg-white rounded-lg border border-dashed border-slate-200">프리셋을 선택하거나 조건을 추가하세요</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 종목 검색 (공통) */}
                <div className="relative">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">종목 검색</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={backtestSearchQuery}
                      onChange={(e) => handleBacktestSearch(e.target.value)}
                      onFocus={() => { if (backtestSearchResults.length > 0) setShowBacktestDropdown(true); }}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all pr-10"
                      placeholder="종목명 또는 코드 (예: BTC, 삼성전자)"
                    />
                    {isBacktestSearching && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                    {!isBacktestSearching && backtestStockCode && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                  {backtestStockCode && (
                    <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-white rounded-lg border border-slate-200 text-xs">
                      <span className={`w-2 h-2 rounded-full ${backtestAssetType === 'STOCK' ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
                      <span className="font-medium text-slate-700">{backtestStockName}</span>
                      <span className="text-slate-400">{backtestStockCode}</span>
                      <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${backtestAssetType === 'STOCK' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {backtestAssetType === 'STOCK' ? '주식' : '코인'}
                      </span>
                    </div>
                  )}
                  {showBacktestDropdown && backtestSearchResults.length > 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                      {backtestSearchResults.map((r) => (
                        <button
                          key={`${r.market}-${r.code}`}
                          type="button"
                          onClick={() => handleBacktestStockSelect(r.code, r.name, r.market)}
                          className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-sm flex items-center justify-between transition-colors first:rounded-t-xl last:rounded-b-xl"
                        >
                          <span className="font-medium text-slate-800">{r.name} <span className="text-slate-400 text-xs">({r.code})</span></span>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${r.market === 'STOCK' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                            {r.market === 'STOCK' ? '주식' : '코인'}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 날짜 + 자본 */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">시작일</label>
                  <input type="date" value={backtestStartDate} onChange={(e) => setBacktestStartDate(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">종료일</label>
                  <input type="date" value={backtestEndDate} onChange={(e) => setBacktestEndDate(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">초기 투자금</label>
                  <input type="number" value={backtestInitialCapital} onChange={(e) => setBacktestInitialCapital(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" placeholder="10,000,000" />
                </div>
              </div>

              {/* 고급 설정 토글 */}
              <div>
                <button onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                  className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className={`w-3.5 h-3.5 transition-transform ${showAdvancedSettings ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  리스크 관리 & 고급 설정
                </button>
                {showAdvancedSettings && (
                  <div className="mt-3 space-y-3 p-4 bg-slate-50/50 rounded-xl border border-slate-100">
                    {/* 리스크 관리 */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">손절 (%)</label>
                        <input type="number" value={stopLossPercent} onChange={(e) => setStopLossPercent(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs" placeholder="5" step="0.5" min="0" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">익절 (%)</label>
                        <input type="number" value={takeProfitPercent} onChange={(e) => setTakeProfitPercent(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs" placeholder="10" step="0.5" min="0" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">트레일링 스탑 (%)</label>
                        <input type="number" value={trailingStopPercent} onChange={(e) => setTrailingStopPercent(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs" placeholder="5" step="0.5" min="0" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">슬리피지 (%)</label>
                        <input type="number" value={slippagePercent} onChange={(e) => setSlippagePercent(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs" placeholder="0.1" step="0.05" min="0" />
                      </div>
                    </div>
                    {/* 수수료 & 포지션 사이징 */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">수수료율 (%)</label>
                        <input type="number" value={commissionRate} onChange={(e) => setCommissionRate(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs" placeholder="0.1" step="0.01" min="0" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">포지션 사이징</label>
                        <select value={positionSizing} onChange={(e) => setPositionSizing(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs">
                          <option value="ALL_IN">전액 투자</option>
                          <option value="PERCENT">자본 비율 (%)</option>
                          <option value="FIXED_AMOUNT">고정 금액</option>
                        </select>
                      </div>
                      {positionSizing !== 'ALL_IN' && (
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">
                            {positionSizing === 'PERCENT' ? '투자 비율 (%)' : '투자 금액 (원)'}
                          </label>
                          <input type="number" value={positionValue} onChange={(e) => setPositionValue(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs"
                            placeholder={positionSizing === 'PERCENT' ? '50' : '5000000'} min="0" />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 실행 버튼 */}
              <div>
                <button onClick={handleRunBacktest} disabled={isBacktesting || (backtestMode === 'strategy' ? !selectedStrategy : directEntryConditions.length === 0)}
                  className="w-full py-3.5 px-6 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all duration-200 text-sm flex items-center justify-center gap-2">
                  {isBacktesting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      분석 중...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      백테스트 실행
                    </>
                  )}
                </button>
              </div>
            </div>

            {backtestResult && (
              <div className="space-y-6">
                {/* 결과 헤더 + 핵심 KPI */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg ${backtestResult.totalReturnRate >= 0 ? 'bg-gradient-to-br from-red-400 to-rose-600' : 'bg-gradient-to-br from-blue-400 to-indigo-600'}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          {backtestResult.totalReturnRate >= 0
                            ? <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            : <path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                          }
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-slate-800">백테스팅 결과</h2>
                        <div className="text-sm text-slate-500">{backtestResult.stockName || backtestResult.stockCode} · {backtestResult.startDate} ~ {backtestResult.endDate}</div>
                      </div>
                    </div>
                    {backtestResult.buyHoldReturnRate !== undefined && (() => {
                      const diff = backtestResult.totalReturnRate - backtestResult.buyHoldReturnRate!;
                      const isWin = diff >= 0;
                      return (
                        <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${isWin ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {isWin ? 'OUTPERFORM' : 'UNDERPERFORM'} {isWin ? '+' : ''}{diff.toFixed(2)}%p
                        </span>
                      );
                    })()}
                  </div>

                  {/* 핵심 KPI 6개 */}
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-5">
                    <div className={`p-3 rounded-xl border ${backtestResult.totalReturnRate >= 0 ? 'bg-red-50/70 border-red-100' : 'bg-blue-50/70 border-blue-100'}`}>
                      <div className="text-[10px] font-medium text-slate-500 mb-1">총 수익률</div>
                      <div className={`text-xl font-bold tracking-tight ${backtestResult.totalReturnRate >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                        {formatPercent(backtestResult.totalReturnRate)}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{formatCurrency(backtestResult.totalReturn)}</div>
                    </div>
                    <div className="p-3 rounded-xl border bg-slate-50/70 border-slate-100">
                      <div className="text-[10px] font-medium text-slate-500 mb-1">최종 자산</div>
                      <div className="text-xl font-bold text-slate-800 tracking-tight">{formatCurrency(backtestResult.finalValue)}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">초기 {formatCurrency(backtestResult.initialCapital)}</div>
                    </div>
                    <div className="p-3 rounded-xl border bg-purple-50/70 border-purple-100">
                      <div className="text-[10px] font-medium text-slate-500 mb-1">CAGR</div>
                      <div className={`text-xl font-bold tracking-tight ${(backtestResult.cagr ?? 0) >= 0 ? 'text-purple-600' : 'text-blue-600'}`}>
                        {formatPercent(backtestResult.cagr ?? 0)}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">연평균 성장률</div>
                    </div>
                    <div className="p-3 rounded-xl border bg-amber-50/70 border-amber-100">
                      <div className="text-[10px] font-medium text-slate-500 mb-1">샤프 비율</div>
                      <div className="text-xl font-bold text-slate-800 tracking-tight">{backtestResult.sharpeRatio.toFixed(2)}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{backtestResult.sharpeRatio >= 1 ? '양호' : backtestResult.sharpeRatio >= 0.5 ? '보통' : '주의'}</div>
                    </div>
                    <div className="p-3 rounded-xl border bg-orange-50/70 border-orange-100">
                      <div className="text-[10px] font-medium text-slate-500 mb-1">최대 낙폭</div>
                      <div className="text-xl font-bold text-orange-600 tracking-tight">{formatPercent(backtestResult.maxDrawdown)}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">MDD</div>
                    </div>
                    <div className="p-3 rounded-xl border bg-emerald-50/70 border-emerald-100">
                      <div className="text-[10px] font-medium text-slate-500 mb-1">승률</div>
                      <div className="text-xl font-bold text-emerald-600 tracking-tight">{backtestResult.winRate.toFixed(1)}%</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{backtestResult.totalTrades}회 거래</div>
                    </div>
                  </div>

                  {/* Buy & Hold 비교 바 */}
                  {backtestResult.buyHoldReturnRate !== undefined && (
                    <div className="mb-5 p-4 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="font-semibold text-slate-500 uppercase tracking-wider">벤치마크 비교</span>
                        <span className="text-slate-400">Buy & Hold {formatPercent(backtestResult.buyHoldReturnRate!)}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden relative">
                          <div className={`h-full rounded-full ${backtestResult.totalReturnRate >= 0 ? 'bg-blue-500' : 'bg-blue-500'}`}
                            style={{ width: `${Math.min(Math.max(((backtestResult.totalReturnRate - Math.min(0, backtestResult.buyHoldReturnRate!)) / (Math.max(Math.abs(backtestResult.totalReturnRate), Math.abs(backtestResult.buyHoldReturnRate!)) * 2 || 1)) * 100, 2), 100)}%` }} />
                        </div>
                        <div className="flex gap-3 text-xs shrink-0">
                          <span><span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1" />전략 <b className={backtestResult.totalReturnRate >= 0 ? 'text-red-600' : 'text-blue-600'}>{formatPercent(backtestResult.totalReturnRate)}</b></span>
                          <span><span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1" />B&H <b className={backtestResult.buyHoldReturnRate! >= 0 ? 'text-red-600' : 'text-blue-600'}>{formatPercent(backtestResult.buyHoldReturnRate!)}</b></span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 상세 지표 그리드 */}
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {[
                      { label: '소르티노 비율', value: (backtestResult.sortinoRatio ?? 0).toFixed(2), sub: (backtestResult.sortinoRatio ?? 0) >= 1 ? '양호' : '보통' },
                      { label: 'Profit Factor', value: (backtestResult.profitFactor ?? 0).toFixed(2), sub: (backtestResult.profitFactor ?? 0) >= 1.5 ? '양호' : (backtestResult.profitFactor ?? 0) >= 1 ? '보통' : '손실' },
                      { label: 'Payoff Ratio', value: (backtestResult.payoffRatio ?? 0).toFixed(2), sub: '평균이익/평균손실' },
                      { label: '평균 이익', value: formatCurrency(backtestResult.avgWin ?? 0), sub: `${(backtestResult.avgWinRate ?? 0).toFixed(1)}%` },
                      { label: '평균 손실', value: formatCurrency(-(backtestResult.avgLoss ?? 0)), sub: `${(backtestResult.avgLossRate ?? 0).toFixed(1)}%` },
                      { label: '수익 거래', value: `${backtestResult.profitableTrades}회`, sub: `연승 ${backtestResult.maxConsecutiveWins ?? 0}` },
                      { label: '손실 거래', value: `${backtestResult.losingTrades}회`, sub: `연패 ${backtestResult.maxConsecutiveLosses ?? 0}` },
                      { label: '평균 보유', value: `${(backtestResult.avgHoldingDays ?? 0).toFixed(1)}일`, sub: '거래당' },
                      { label: 'MDD 지속', value: `${backtestResult.maxDrawdownDuration ?? 0}일`, sub: '최대 낙폭 기간' },
                      { label: '회복 비율', value: (backtestResult.recoveryFactor ?? 0).toFixed(2), sub: '수익/MDD' },
                      { label: '총 수수료', value: formatCurrency(Math.round(backtestResult.initialCapital * (parseFloat(commissionRate || '0.1') / 100) * (backtestResult.totalTrades * 2))), sub: `${backtestResult.totalTrades * 2}회 (${commissionRate || '0.1'}%)` },
                      { label: '거래 기간', value: `${backtestResult.equityCurve?.length ?? 0}일`, sub: `${backtestResult.startDate} ~` },
                    ].map((item, i) => (
                      <div key={i} className="p-2.5 rounded-lg bg-slate-50/70 border border-slate-100 text-center">
                        <div className="text-[10px] text-slate-400 font-medium mb-0.5">{item.label}</div>
                        <div className="text-sm font-bold text-slate-700">{item.value}</div>
                        <div className="text-[9px] text-slate-400">{item.sub}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 가격 차트 + 매매 마커 */}
                {backtestResult.priceData && backtestResult.priceData.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-1">가격 차트 & 매매 포인트</h3>
                    <p className="text-xs text-slate-400 mb-4">빨간 삼각형 = 매수 / 파란 삼각형 = 매도</p>
                    <ResponsiveContainer width="100%" height={400}>
                      <ComposedChart data={(() => {
                        const tradeMap = new Map<string, { type: string; price: number }>();
                        (backtestResult.trades || []).forEach(t => tradeMap.set(t.date, { type: t.type, price: t.price }));
                        return backtestResult.priceData!.map(p => ({
                          date: p.date,
                          close: p.close,
                          buySignal: tradeMap.get(p.date)?.type === 'BUY' ? p.close * 0.97 : null,
                          sellSignal: tradeMap.get(p.date)?.type === 'SELL' ? p.close * 1.03 : null,
                        }));
                      })()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.substring(5)} />
                        <YAxis tick={{ fontSize: 10 }} domain={['auto', 'auto']}
                          tickFormatter={(v: number) => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : `${v}`} />
                        <Tooltip formatter={(value: number, name: string) => [
                          formatCurrency(value),
                          name === 'buySignal' ? '매수' : name === 'sellSignal' ? '매도' : '종가'
                        ]} labelFormatter={(label) => `${label}`} />
                        <Line type="monotone" dataKey="close" stroke="#64748b" strokeWidth={1.5} dot={false} name="종가" />
                        <Line type="monotone" dataKey="buySignal" stroke="none" dot={{ r: 5, fill: '#ef4444', stroke: '#ef4444' }} name="매수" legendType="triangle" />
                        <Line type="monotone" dataKey="sellSignal" stroke="none" dot={{ r: 5, fill: '#3b82f6', stroke: '#3b82f6' }} name="매도" legendType="triangle" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* 자산 변동 추이 (전략 vs Buy & Hold) */}
                {backtestResult.equityCurve && backtestResult.equityCurve.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">
                      자산 변동 추이
                      {backtestResult.buyHoldCurve && <span className="text-sm font-normal text-slate-400 ml-2">전략 vs Buy & Hold</span>}
                    </h3>
                    <ResponsiveContainer width="100%" height={350}>
                      <AreaChart data={(() => {
                        const bhMap = new Map((backtestResult.buyHoldCurve || []).map(p => [p.date, p.value]));
                        return backtestResult.equityCurve.map(p => ({
                          date: p.date,
                          value: p.value,
                          buyHold: bhMap.get(p.date) ?? null,
                        }));
                      })()}>
                        <defs>
                          <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4a90e2" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#4a90e2" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.substring(5)} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => v >= 1e8 ? `${(v / 1e8).toFixed(1)}억` : v >= 1e4 ? `${(v / 1e4).toFixed(0)}만` : `${v}`} />
                        <Tooltip formatter={(value: number, name: string) => [formatCurrency(value), name === 'buyHold' ? 'Buy & Hold' : '전략']} labelFormatter={(label) => `${label}`} />
                        <Legend formatter={(value) => value === 'buyHold' ? 'Buy & Hold' : '전략'} />
                        <ReferenceLine y={backtestResult.initialCapital} stroke="#94a3b8" strokeDasharray="5 5" label={{ value: '초기', position: 'right', fontSize: 10, fill: '#94a3b8' }} />
                        <Area type="monotone" dataKey="value" stroke="#4a90e2" fillOpacity={1} fill="url(#colorEquity)" strokeWidth={2} name="전략" />
                        {backtestResult.buyHoldCurve && (
                          <Area type="monotone" dataKey="buyHold" stroke="#f59e0b" fill="none" strokeWidth={2} strokeDasharray="6 3" name="buyHold" dot={false} />
                        )}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* 드로다운 차트 */}
                {backtestResult.drawdownCurve && backtestResult.drawdownCurve.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-1">드로다운 (Drawdown)</h3>
                    <p className="text-xs text-slate-400 mb-4">고점 대비 자산 하락률 추이</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={backtestResult.drawdownCurve}>
                        <defs>
                          <linearGradient id="colorDD" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.substring(5)} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${v.toFixed(1)}%`} />
                        <Tooltip formatter={(value: number) => [`${value.toFixed(2)}%`, '드로다운']} labelFormatter={(label) => `${label}`} />
                        <ReferenceLine y={0} stroke="#94a3b8" />
                        <Area type="monotone" dataKey="value" stroke="#ef4444" fillOpacity={1} fill="url(#colorDD)" strokeWidth={1.5} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* 일일 수익률 */}
                {backtestResult.dailyReturns && backtestResult.dailyReturns.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">일일 수익률</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <ComposedChart data={backtestResult.dailyReturns}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.substring(5)} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${v.toFixed(1)}%`} />
                        <Tooltip formatter={(value: number) => `${value.toFixed(2)}%`} labelFormatter={(label) => `${label}`} />
                        <ReferenceLine y={0} stroke="#94a3b8" />
                        <Bar dataKey="dailyReturn" name="일일 수익률" fill="#4a90e2" radius={[2, 2, 0, 0]} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* 거래 내역 테이블 */}
                {backtestResult.trades && backtestResult.trades.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">거래 내역 ({backtestResult.trades.length}건)</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b-2 border-slate-200">
                            <th className="text-left py-2.5 px-2 font-semibold text-slate-600">날짜</th>
                            <th className="text-center py-2.5 px-2 font-semibold text-slate-600">구분</th>
                            <th className="text-right py-2.5 px-2 font-semibold text-slate-600">가격</th>
                            <th className="text-right py-2.5 px-2 font-semibold text-slate-600">수량</th>
                            <th className="text-right py-2.5 px-2 font-semibold text-slate-600">손익</th>
                            <th className="text-right py-2.5 px-2 font-semibold text-slate-600">수익률</th>
                            <th className="text-right py-2.5 px-2 font-semibold text-slate-600">보유일</th>
                            <th className="text-right py-2.5 px-2 font-semibold text-slate-600">잔고</th>
                            <th className="text-left py-2.5 px-2 font-semibold text-slate-600">사유</th>
                          </tr>
                        </thead>
                        <tbody>
                          {backtestResult.trades!.map((trade, idx) => (
                            <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                              <td className="py-2 px-2 text-slate-600 font-mono">{trade.date}</td>
                              <td className="py-2 px-2 text-center">
                                <span className={`inline-block w-12 text-center px-1.5 py-0.5 rounded text-[10px] font-bold ${trade.type === 'BUY' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                                  {trade.type === 'BUY' ? '매수' : '매도'}
                                </span>
                              </td>
                              <td className="py-2 px-2 text-right text-slate-700 font-mono">{formatCurrency(trade.price)}</td>
                              <td className="py-2 px-2 text-right text-slate-600 font-mono">{trade.quantity < 1 ? trade.quantity.toFixed(6) : Math.floor(trade.quantity).toLocaleString()}</td>
                              <td className={`py-2 px-2 text-right font-bold font-mono ${trade.type === 'BUY' ? 'text-slate-300' : trade.pnl >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                                {trade.type === 'SELL' ? formatCurrency(Math.round(trade.pnl)) : '-'}
                              </td>
                              <td className={`py-2 px-2 text-right font-bold ${trade.type === 'BUY' ? 'text-slate-300' : (trade.pnlPercent ?? 0) >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                                {trade.type === 'SELL' ? `${(trade.pnlPercent ?? 0) >= 0 ? '+' : ''}${(trade.pnlPercent ?? 0).toFixed(2)}%` : '-'}
                              </td>
                              <td className="py-2 px-2 text-right text-slate-500">{trade.type === 'SELL' ? `${trade.holdingDays ?? 0}일` : '-'}</td>
                              <td className="py-2 px-2 text-right text-slate-600 font-mono">{trade.balance ? formatCurrency(trade.balance) : '-'}</td>
                              <td className="py-2 px-2 text-slate-400 max-w-[120px] truncate">{trade.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 기술적 지표 탭 */}
        {activeTab === 'indicators' && (() => {
          const INDICATORS = [
            { group: '이동평균', icon: '〰️', items: [
              { key: 'MA', name: '이동평균선 (MA)', eng: 'Moving Average', color: '#3b82f6', range: '가격과 동일', difficulty: '초급',
                desc: '일정 기간 동안의 평균 가격을 선으로 연결한 것입니다. 가격의 전체적인 흐름(추세)을 부드럽게 보여주어, 현재 상승 중인지 하락 중인지 쉽게 판단할 수 있습니다.',
                how: '단기 MA(5일)가 장기 MA(20일) 위로 올라가면 "골든크로스"로 매수 신호입니다. 반대로 아래로 내려가면 "데드크로스"로 매도 신호입니다.',
                tip: '처음에는 MA20(20일)과 MA60(60일) 두 개만 켜보세요. 두 선의 방향이 같으면 추세가 뚜렷합니다.' },
              { key: 'EMA', name: '지수이동평균 (EMA)', eng: 'Exponential Moving Average', color: '#10b981', range: '가격과 동일', difficulty: '초급',
                desc: '일반 이동평균(MA)과 비슷하지만, 최근 가격에 더 큰 비중을 둡니다. 그래서 가격 변화에 더 빠르게 반응하여, 추세 전환을 조금 더 빨리 포착할 수 있습니다.',
                how: '가격이 EMA를 위로 돌파하면 상승 전환, 아래로 돌파하면 하락 전환 가능성이 있습니다.',
                tip: 'MA보다 민감하게 반응하므로 단기 매매에 유리합니다. MA와 함께 비교하면 더 정확합니다.' },
            ]},
            { group: '추세 · 밴드', icon: '📊', items: [
              { key: 'BOLLINGER_BANDS', name: '볼린저 밴드', eng: 'Bollinger Bands', color: '#6366f1', range: '가격 중심 ± 표준편차', difficulty: '초급',
                desc: '가격의 "정상 범위"를 상단·하단 밴드로 보여줍니다. 밴드는 변동성이 커지면 넓어지고, 작아지면 좁아집니다. 마치 가격이 움직이는 "통로"와 같습니다.',
                how: '가격이 상단 밴드를 터치하면 과매수(너무 비싸진 상태), 하단 밴드를 터치하면 과매도(너무 싸진 상태)일 수 있습니다.',
                tip: '밴드가 좁아지면("스퀴즈") 곧 큰 움직임이 올 수 있다는 신호입니다. 돌파 방향을 주시하세요.' },
              { key: 'VWAP', name: '거래량 가중평균가', eng: 'Volume Weighted Average Price', color: '#ec4899', range: '가격과 동일', difficulty: '중급',
                desc: '거래량을 반영한 평균 가격입니다. 많이 거래된 가격대에 더 큰 가중치를 두기 때문에, 기관 투자자들이 "적정 가격"의 기준점으로 활용합니다.',
                how: '가격이 VWAP 위에 있으면 매수세가 강한 상태, 아래에 있으면 매도세가 강한 상태입니다.',
                tip: '당일 거래에서 VWAP를 기준으로 매수/매도 타이밍을 잡는 데 활용합니다.' },
              { key: 'ICHIMOKU', name: '일목균형표', eng: 'Ichimoku Cloud', color: '#ef4444', range: '복합 (구름 형태)', difficulty: '고급',
                desc: '일본에서 개발된 복합 분석 도구로, 5개의 선으로 추세 방향, 지지/저항 구간, 전환 시점을 한눈에 보여줍니다. "구름" 영역이 핵심입니다.',
                how: '가격이 구름 위에 있으면 상승 추세, 아래에 있으면 하락 추세입니다. 구름이 두꺼울수록 지지/저항이 강합니다.',
                tip: '선이 많아 복잡해 보이지만, 처음에는 "구름 위/아래"만 확인해도 충분합니다.' },
              { key: 'PARABOLIC_SAR', name: '파라볼릭 SAR', eng: 'Parabolic Stop And Reverse', color: '#8b5cf6', range: '가격 근처 점(dot)', difficulty: '중급',
                desc: '차트 위에 점(dot)으로 표시되며, 추세의 방향과 전환점을 알려줍니다. "SAR"은 "Stop And Reverse(멈추고 반전)"의 약자입니다.',
                how: '점이 가격 아래에 있으면 상승 추세, 가격 위에 있으면 하락 추세입니다. 점의 위치가 바뀌면 추세 전환 신호입니다.',
                tip: '손절매(Stop Loss) 지점을 정하는 데 유용합니다. 점의 위치를 손절 라인으로 활용하세요.' },
            ]},
            { group: '오실레이터', icon: '📈', items: [
              { key: 'RSI', name: '상대강도지수 (RSI)', eng: 'Relative Strength Index', color: '#8b5cf6', range: '0 ~ 100', difficulty: '초급',
                desc: '가격이 최근에 얼마나 올랐는지/내렸는지를 0~100 사이의 수치로 나타냅니다. 가장 많이 사용되는 보조 지표 중 하나로, "지금 너무 많이 올랐나? 내렸나?"를 판단합니다.',
                how: '70 이상이면 "과매수" — 가격이 너무 올라서 곧 조정(하락)이 올 수 있습니다.\n30 이하면 "과매도" — 가격이 너무 내려서 곧 반등(상승)할 수 있습니다.',
                tip: '가장 먼저 배우기 좋은 지표입니다. 매수할 때 RSI가 30 근처인지, 매도할 때 70 근처인지 확인해보세요.' },
              { key: 'MACD', name: 'MACD', eng: 'Moving Average Convergence Divergence', color: '#3b82f6', range: '중심선(0) 기준 위/아래', difficulty: '초급',
                desc: '두 이동평균의 차이를 분석하여 추세의 방향과 전환 시점을 알려줍니다. MACD선, 시그널선, 히스토그램 3가지 요소로 구성됩니다.',
                how: 'MACD선이 시그널선을 위로 돌파하면 매수 신호, 아래로 돌파하면 매도 신호입니다. 히스토그램이 0 위에서 커지면 상승 강도 증가, 아래로 커지면 하락 강도 증가입니다.',
                tip: 'RSI와 함께 사용하면 더 정확합니다. 두 지표가 같은 방향을 가리키면 신뢰도가 높아집니다.' },
              { key: 'STOCHASTIC', name: '스토캐스틱', eng: 'Stochastic Oscillator', color: '#2563eb', range: '0 ~ 100', difficulty: '중급',
                desc: '일정 기간 동안의 최고가·최저가 범위에서 현재 가격이 어디에 위치하는지를 나타냅니다. %K(빠른 선)와 %D(느린 선) 두 선으로 구성됩니다.',
                how: '80 이상이면 과매수, 20 이하면 과매도입니다. %K가 %D를 위로 돌파하면 매수, 아래로 돌파하면 매도 신호입니다.',
                tip: 'RSI와 비슷하지만 더 민감하게 반응합니다. 횡보장(방향 없는 시장)에서 특히 유용합니다.' },
              { key: 'WILLIAMS_R', name: '윌리엄스 %R', eng: 'Williams %R', color: '#14b8a6', range: '-100 ~ 0', difficulty: '중급',
                desc: '스토캐스틱과 원리가 비슷하지만 범위가 -100~0이며, 값이 반전되어 있습니다. 과매수/과매도를 빠르게 포착합니다.',
                how: '-20 이상이면 과매수(가격 하락 가능), -80 이하면 과매도(가격 상승 가능)입니다.',
                tip: '빠른 반응이 필요한 단기 매매에 적합합니다. 다른 지표와 함께 확인하면 오신호를 줄일 수 있습니다.' },
              { key: 'CCI', name: '상품채널지수 (CCI)', eng: 'Commodity Channel Index', color: '#f59e0b', range: '보통 -200 ~ +200', difficulty: '중급',
                desc: '가격이 평균에서 얼마나 벗어났는지를 측정합니다. 원래 상품(원자재) 시장용으로 만들어졌지만, 주식과 가상화폐에도 널리 사용됩니다.',
                how: '+100을 돌파하면 강한 상승 추세가 시작될 수 있고, -100을 돌파하면 강한 하락 추세가 시작될 수 있습니다.',
                tip: '추세의 "시작"을 포착하는 데 유용합니다. ±100을 돌파하는 순간을 주목하세요.' },
            ]},
            { group: '거래량 · 변동성', icon: '📉', items: [
              { key: 'OBV', name: '거래량 균형 (OBV)', eng: 'On Balance Volume', color: '#06b6d4', range: '누적 거래량', difficulty: '중급',
                desc: '가격이 오른 날의 거래량은 더하고, 내린 날의 거래량은 빼서 누적합니다. 거래량의 흐름으로 "돈의 움직임"을 추적할 수 있습니다.',
                how: 'OBV가 상승하는데 가격이 횡보하면 → 곧 가격 상승 가능 (매수세 축적)\nOBV가 하락하는데 가격이 유지되면 → 곧 가격 하락 가능 (매도세 축적)',
                tip: '가격보다 거래량이 먼저 움직이는 경우가 많습니다. OBV의 방향 변화를 미리 확인하세요.' },
              { key: 'ATR', name: '평균진폭 (ATR)', eng: 'Average True Range', color: '#f97316', range: '0 이상 (가격 단위)', difficulty: '중급',
                desc: '일정 기간 동안 가격이 평균적으로 얼마나 움직였는지를 보여줍니다. 변동성(위험도)을 측정하는 대표적인 지표입니다.',
                how: 'ATR이 높으면 변동성이 큰 상태(리스크 높음), 낮으면 안정적인 상태입니다. ATR 자체는 방향을 알려주지 않습니다.',
                tip: '손절매 폭을 정할 때 유용합니다. 예: "ATR의 2배"를 손절 라인으로 설정하는 전략이 일반적입니다.' },
            ]},
          ];

          const currentIndicator = INDICATORS.flatMap(g => g.items).find(i => i.key === selectedIndicator);

          return (
          <div className="space-y-6">
            {/* 종목 + 지표 선택 */}
            <div className="card">
              <div className="flex items-center gap-2 mb-5">
                <svg className="w-5 h-5 text-whale-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <h2 className="text-xl font-bold text-whale-dark">기술적 지표 분석</h2>
              </div>

              {/* 종목 + 지표 + 버튼 */}
              <div className="space-y-4">
                {/* 1행: 종목 검색 + 선택된 종목 */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">분석할 종목</label>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        type="text"
                        value={indicatorSearchQuery}
                        onChange={e => handleIndicatorStockSearch(e.target.value)}
                        onFocus={() => { if (indicatorSearchQuery.trim()) setShowIndicatorDropdown(true); }}
                        placeholder="종목명 또는 코드 검색..."
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-whale-light/50 focus:border-whale-light bg-white"
                      />
                      {indicatorSearchQuery && (
                        <button
                          onClick={() => { setIndicatorSearchQuery(''); setIndicatorSearchResults([]); setShowIndicatorDropdown(false); }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      )}
                      {isIndicatorSearching && (
                        <div className="absolute right-10 top-1/2 -translate-y-1/2">
                          <div className="w-4 h-4 border-2 border-whale-light border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                      {/* 검색 결과 드롭다운 */}
                      {showIndicatorDropdown && indicatorSearchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-200 z-20 max-h-60 overflow-y-auto">
                          {indicatorSearchResults.map(r => (
                            <div
                              key={r.code}
                              onClick={() => handleIndicatorStockSelect(r.code, r.name, r.market)}
                              className="px-4 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors flex justify-between items-center"
                            >
                              <div>
                                <span className="text-sm font-semibold text-gray-800">{r.name}</span>
                                <span className="text-xs text-gray-400 ml-2">{r.code}</span>
                              </div>
                              <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{r.market}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {showIndicatorDropdown && indicatorSearchQuery.trim() && indicatorSearchResults.length === 0 && !isIndicatorSearching && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-200 z-20 px-4 py-3 text-sm text-gray-400">
                          검색 결과가 없습니다
                        </div>
                      )}
                    </div>
                    {selectedStockForIndicator && (
                      <div className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2.5 bg-whale-light/10 text-whale-dark text-sm font-semibold rounded-xl border border-whale-light/20">
                        {indicatorStockName || selectedStockForIndicator}
                        <span className="text-xs text-gray-400">({selectedStockForIndicator})</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2행: 지표 선택 + 로딩 표시 */}
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">지표 선택</label>
                    <select value={selectedIndicator} onChange={(e) => setSelectedIndicator(e.target.value)} className="w-full py-2.5 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-whale-light/50 focus:border-whale-light bg-white">
                      {INDICATORS.map(group => (
                        <optgroup key={group.group} label={`${group.icon} ${group.group}`}>
                          {group.items.map(ind => (
                            <option key={ind.key} value={ind.key}>{ind.name}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  {isLoadingIndicator && (
                    <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 text-sm text-gray-500">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      불러오는 중...
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 차트 영역 */}
            {indicatorData.length > 0 && (
              <div className="card">
                <h3 className="text-lg font-bold text-whale-dark mb-4">
                  {currentIndicator?.name || selectedIndicator} — {indicatorStockName || [...stockList, ...krxStockList].find((s) => s.stockCode === selectedStockForIndicator)?.stockName || selectedStockForIndicator}
                </h3>
                {(() => {
                  const isOverlay = ['MA', 'EMA', 'VWAP', 'PARABOLIC_SAR'].includes(selectedIndicator);
                  const isMacd = selectedIndicator === 'MACD';
                  const isBollinger = selectedIndicator === 'BOLLINGER_BANDS';
                  const isStochastic = selectedIndicator === 'STOCHASTIC';
                  const isIchimoku = selectedIndicator === 'ICHIMOKU';
                  const color = currentIndicator?.color || '#82ca9d';
                  const name = currentIndicator?.name || selectedIndicator;

                  const fmtPrice = (v: number) => v >= 10000 ? `${(v / 10000).toFixed(1)}만` : v >= 1000 ? `${(v / 1000).toFixed(1)}천` : v.toLocaleString();
                  const fmtTooltip = (v: number) => v >= 1000 ? v.toLocaleString() : v.toFixed(2);
                  const fmtDate = (d: string) => d.slice(5); // "03-10" 형식

                  // MACD: MACD선/시그널 (라인) + 히스토그램 (막대)
                  if (isMacd) return (
                    <ResponsiveContainer width="100%" height={500}>
                      <ComposedChart data={indicatorData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(v: number) => v.toFixed(4)} labelFormatter={(l) => `날짜: ${l}`} />
                        <Legend />
                        <ReferenceLine y={0} stroke="#999" strokeWidth={1} />
                        <Bar dataKey="value3" fill="#95a5a6" opacity={0.4} name="Histogram" />
                        <Line type="monotone" dataKey="value" stroke="#e74c3c" strokeWidth={2} name="MACD" dot={false} />
                        <Line type="monotone" dataKey="value2" stroke="#3498db" strokeWidth={2} name="Signal" dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  );

                  // 볼린저: 가격 + 상단/중단/하단 밴드 (같은 축)
                  if (isBollinger) return (
                    <ResponsiveContainer width="100%" height={500}>
                      <LineChart data={indicatorData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 12 }} />
                        <YAxis tickFormatter={fmtPrice} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(v: number) => fmtTooltip(v)} labelFormatter={(l) => `날짜: ${l}`} />
                        <Legend />
                        <Line type="monotone" dataKey="price" stroke="#8884d8" strokeWidth={2} name="가격" dot={false} />
                        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} name="중심선" dot={false} />
                        <Line type="monotone" dataKey="value2" stroke="#e74c3c" strokeWidth={1} name="상단" dot={false} strokeDasharray="4 2" />
                        <Line type="monotone" dataKey="value3" stroke="#3498db" strokeWidth={1} name="하단" dot={false} strokeDasharray="4 2" />
                      </LineChart>
                    </ResponsiveContainer>
                  );

                  // 스토캐스틱: %K + %D + 과매수/과매도 기준선
                  if (isStochastic) return (
                    <ResponsiveContainer width="100%" height={500}>
                      <LineChart data={indicatorData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 12 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(v: number) => v.toFixed(2)} labelFormatter={(l) => `날짜: ${l}`} />
                        <Legend />
                        <ReferenceLine y={80} stroke="#e74c3c" strokeDasharray="4 4" opacity={0.6} label={{ value: '과매수 80', position: 'right', fontSize: 11, fill: '#e74c3c' }} />
                        <ReferenceLine y={20} stroke="#3498db" strokeDasharray="4 4" opacity={0.6} label={{ value: '과매도 20', position: 'right', fontSize: 11, fill: '#3498db' }} />
                        <Line type="monotone" dataKey="value" stroke="#e74c3c" strokeWidth={2} name="%K" dot={false} />
                        <Line type="monotone" dataKey="value2" stroke="#3498db" strokeWidth={2} name="%D" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  );

                  // 일목균형표: 가격 + 5개 선
                  if (isIchimoku) return (
                    <ResponsiveContainer width="100%" height={500}>
                      <LineChart data={indicatorData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 12 }} />
                        <YAxis tickFormatter={fmtPrice} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(v: number) => fmtTooltip(v)} labelFormatter={(l) => `날짜: ${l}`} />
                        <Legend />
                        <Line type="monotone" dataKey="price" stroke="#8884d8" strokeWidth={2} name="가격" dot={false} />
                        <Line type="monotone" dataKey="value" stroke="#e74c3c" strokeWidth={1.5} name="전환선" dot={false} />
                        <Line type="monotone" dataKey="value2" stroke="#3498db" strokeWidth={1.5} name="기준선" dot={false} />
                        <Line type="monotone" dataKey="value3" stroke="#2ecc71" strokeWidth={1} name="선행스팬A" dot={false} strokeDasharray="4 2" />
                        <Line type="monotone" dataKey="value4" stroke="#e67e22" strokeWidth={1} name="선행스팬B" dot={false} strokeDasharray="4 2" />
                        <Line type="monotone" dataKey="value5" stroke="#9b59b6" strokeWidth={1} name="후행스팬" dot={false} strokeDasharray="2 2" />
                      </LineChart>
                    </ResponsiveContainer>
                  );

                  // 오버레이 지표 (MA, EMA, VWAP 등): 가격과 같은 축
                  if (isOverlay) return (
                    <ResponsiveContainer width="100%" height={500}>
                      <LineChart data={indicatorData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 12 }} />
                        <YAxis tickFormatter={fmtPrice} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(v: number) => fmtTooltip(v)} labelFormatter={(l) => `날짜: ${l}`} />
                        <Legend />
                        <Line type="monotone" dataKey="price" stroke="#8884d8" strokeWidth={2} name="가격" dot={false} />
                        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} name={name} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  );

                  // RSI: 기준선 포함
                  if (selectedIndicator === 'RSI') return (
                    <ResponsiveContainer width="100%" height={500}>
                      <LineChart data={indicatorData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 12 }} />
                        <YAxis yAxisId="left" tickFormatter={fmtPrice} tick={{ fontSize: 12 }} />
                        <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(v: number) => fmtTooltip(v)} labelFormatter={(l) => `날짜: ${l}`} />
                        <Legend />
                        <ReferenceLine yAxisId="right" y={70} stroke="#e74c3c" strokeDasharray="4 4" opacity={0.6} label={{ value: '과매수 70', position: 'right', fontSize: 11, fill: '#e74c3c' }} />
                        <ReferenceLine yAxisId="right" y={30} stroke="#3498db" strokeDasharray="4 4" opacity={0.6} label={{ value: '과매도 30', position: 'right', fontSize: 11, fill: '#3498db' }} />
                        <Line yAxisId="left" type="monotone" dataKey="price" stroke="#8884d8" strokeWidth={2} name="가격" dot={false} />
                        <Line yAxisId="right" type="monotone" dataKey="value" stroke={color} strokeWidth={2} name={name} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  );

                  // Williams %R: 기준선 포함
                  if (selectedIndicator === 'WILLIAMS_R') return (
                    <ResponsiveContainer width="100%" height={500}>
                      <LineChart data={indicatorData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 12 }} />
                        <YAxis yAxisId="left" tickFormatter={fmtPrice} tick={{ fontSize: 12 }} />
                        <YAxis yAxisId="right" orientation="right" domain={[-100, 0]} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(v: number) => fmtTooltip(v)} labelFormatter={(l) => `날짜: ${l}`} />
                        <Legend />
                        <ReferenceLine yAxisId="right" y={-20} stroke="#e74c3c" strokeDasharray="4 4" opacity={0.6} label={{ value: '과매수 -20', position: 'right', fontSize: 11, fill: '#e74c3c' }} />
                        <ReferenceLine yAxisId="right" y={-80} stroke="#3498db" strokeDasharray="4 4" opacity={0.6} label={{ value: '과매도 -80', position: 'right', fontSize: 11, fill: '#3498db' }} />
                        <Line yAxisId="left" type="monotone" dataKey="price" stroke="#8884d8" strokeWidth={2} name="가격" dot={false} />
                        <Line yAxisId="right" type="monotone" dataKey="value" stroke={color} strokeWidth={2} name={name} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  );

                  // CCI: 기준선 포함
                  if (selectedIndicator === 'CCI') return (
                    <ResponsiveContainer width="100%" height={500}>
                      <LineChart data={indicatorData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 12 }} />
                        <YAxis yAxisId="left" tickFormatter={fmtPrice} tick={{ fontSize: 12 }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(v: number) => fmtTooltip(v)} labelFormatter={(l) => `날짜: ${l}`} />
                        <Legend />
                        <ReferenceLine yAxisId="right" y={100} stroke="#e74c3c" strokeDasharray="4 4" opacity={0.6} label={{ value: '+100', position: 'right', fontSize: 11, fill: '#e74c3c' }} />
                        <ReferenceLine yAxisId="right" y={-100} stroke="#3498db" strokeDasharray="4 4" opacity={0.6} label={{ value: '-100', position: 'right', fontSize: 11, fill: '#3498db' }} />
                        <ReferenceLine yAxisId="right" y={0} stroke="#999" strokeWidth={1} />
                        <Line yAxisId="left" type="monotone" dataKey="price" stroke="#8884d8" strokeWidth={2} name="가격" dot={false} />
                        <Line yAxisId="right" type="monotone" dataKey="value" stroke={color} strokeWidth={2} name={name} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  );

                  // 나머지 오실레이터 (ATR, OBV): 가격 + 지표 별도 축
                  return (
                    <ResponsiveContainer width="100%" height={500}>
                      <LineChart data={indicatorData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 12 }} />
                        <YAxis yAxisId="left" tickFormatter={fmtPrice} tick={{ fontSize: 12 }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(v: number) => fmtTooltip(v)} labelFormatter={(l) => `날짜: ${l}`} />
                        <Legend />
                        <Line yAxisId="left" type="monotone" dataKey="price" stroke="#8884d8" strokeWidth={2} name="가격" dot={false} />
                        <Line yAxisId="right" type="monotone" dataKey="value" stroke={color} strokeWidth={2} name={name} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  );
                })()}
              </div>
            )}

            {/* 선택된 지표 상세 설명 */}
            {currentIndicator && (
              <div className="card">
                <div className="flex items-start gap-4 mb-5">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${currentIndicator.color}15` }}>
                    <div className="w-5 h-5 rounded-full" style={{ backgroundColor: currentIndicator.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="text-lg font-bold text-whale-dark">{currentIndicator.name}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                        currentIndicator.difficulty === '초급' ? 'bg-green-100 text-green-700' :
                        currentIndicator.difficulty === '중급' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {currentIndicator.difficulty}
                      </span>
                    </div>
                    <span className="text-sm text-gray-400">{currentIndicator.eng}</span>
                  </div>
                </div>

                {/* 핵심 정보 카드 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-xs font-semibold text-gray-500">표시 범위</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-800">{currentIndicator.range}</span>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <span className="text-xs font-semibold text-gray-500">표시 위치</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-800">
                      {['MA', 'EMA', 'BOLLINGER_BANDS', 'VWAP', 'ICHIMOKU', 'PARABOLIC_SAR'].includes(currentIndicator.key) ? '메인 차트 위에 오버레이' : '별도 하단 차트'}
                    </span>
                  </div>
                </div>

                {/* 설명 섹션들 */}
                <div className="space-y-4">
                  {/* 이 지표는? */}
                  <div className="border border-gray-100 rounded-xl p-4">
                    <h4 className="text-sm font-bold text-whale-dark mb-2 flex items-center gap-2">
                      <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center text-xs font-bold">?</span>
                      이 지표는?
                    </h4>
                    <p className="text-sm text-gray-600 leading-relaxed">{currentIndicator.desc}</p>
                  </div>

                  {/* 매매 신호 읽는 법 */}
                  <div className="border border-green-100 bg-green-50/50 rounded-xl p-4">
                    <h4 className="text-sm font-bold text-green-800 mb-2 flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                      매매 신호 읽는 법
                    </h4>
                    <p className="text-sm text-green-900/80 leading-relaxed whitespace-pre-line">{currentIndicator.how}</p>
                  </div>

                  {/* 실전 팁 */}
                  <div className="border border-amber-100 bg-amber-50/50 rounded-xl p-4">
                    <h4 className="text-sm font-bold text-amber-800 mb-2 flex items-center gap-2">
                      <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" />
                      </svg>
                      실전 팁
                    </h4>
                    <p className="text-sm text-amber-900/80 leading-relaxed">{currentIndicator.tip}</p>
                  </div>
                </div>
              </div>
            )}

            {/* 전체 지표 가이드 */}
            <div className="card">
              <h3 className="text-lg font-bold text-whale-dark mb-4">전체 기술적 지표 가이드</h3>
              <p className="text-sm text-gray-500 mb-5">클릭하면 해당 지표가 선택됩니다. 거래 페이지의 차트에서도 동일한 지표를 사용할 수 있습니다.</p>
              <div className="space-y-5">
                {INDICATORS.map(group => (
                  <div key={group.group}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-base">{group.icon}</span>
                      <span className="text-sm font-bold text-gray-700">{group.group}</span>
                      <div className="flex-1 h-px bg-gray-100" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {group.items.map(ind => {
                        const isSelected = selectedIndicator === ind.key;
                        return (
                          <div
                            key={ind.key}
                            onClick={() => setSelectedIndicator(ind.key)}
                            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                              isSelected
                                ? 'border-whale-light bg-whale-light/5 shadow-sm'
                                : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <div className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: ind.color }} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className={`text-sm font-semibold ${isSelected ? 'text-whale-dark' : 'text-gray-700'}`}>{ind.name}</span>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                                  ind.difficulty === '초급' ? 'bg-green-100 text-green-600' :
                                  ind.difficulty === '중급' ? 'bg-amber-100 text-amber-600' :
                                  'bg-red-100 text-red-600'
                                }`}>
                                  {ind.difficulty}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{ind.desc}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 초보자 안내 */}
            <div className="bg-gradient-to-r from-whale-dark to-whale-light rounded-2xl p-6 text-white">
              <h3 className="text-lg font-bold mb-2">처음 시작하는 분들께</h3>
              <p className="text-sm opacity-90 leading-relaxed mb-4">
                기술적 지표가 많아 복잡해 보일 수 있지만, 처음에는 2~3개만 사용해도 충분합니다.
                추천 조합은 다음과 같습니다:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-white/15 rounded-xl p-3 backdrop-blur-sm">
                  <div className="text-xs font-bold mb-1 opacity-80">추세 확인</div>
                  <div className="text-sm font-semibold">MA20 + MA60</div>
                  <div className="text-xs opacity-70 mt-1">두 선의 방향과 교차를 확인</div>
                </div>
                <div className="bg-white/15 rounded-xl p-3 backdrop-blur-sm">
                  <div className="text-xs font-bold mb-1 opacity-80">매수/매도 타이밍</div>
                  <div className="text-sm font-semibold">RSI + MACD</div>
                  <div className="text-xs opacity-70 mt-1">과매수/과매도와 추세 전환 포착</div>
                </div>
                <div className="bg-white/15 rounded-xl p-3 backdrop-blur-sm">
                  <div className="text-xs font-bold mb-1 opacity-80">위험 관리</div>
                  <div className="text-sm font-semibold">볼린저 밴드 + ATR</div>
                  <div className="text-xs opacity-70 mt-1">변동성 범위와 리스크 판단</div>
                </div>
              </div>
            </div>
          </div>
          );
        })()}
      </div>
    </div>
  );
};

export default StrategyPage;
