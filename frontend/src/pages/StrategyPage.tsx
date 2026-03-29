import { useState, useEffect, useRef, useCallback } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import Header from '../components/Header';
import SplashLoading from '../components/SplashLoading';
import VirtSplashLoading from '../components/VirtSplashLoading';
import { useRoutePrefix } from '../hooks/useRoutePrefix';
import { GLOSSARY, Term } from '../components/TermTooltip';
import GuideTour, { type TourStep } from '../components/GuideTour';
import {
  strategyService,
  exportBacktestCsv,
  loadBacktestHistory,
  saveBacktestHistory,
  type Strategy,
  type BacktestRequest,
  type BacktestResult,
  type BacktestHistoryEntry,
  type IndicatorData,
  type Indicator,
  type Condition,
} from '../services/strategyService';
import { tradeService, type StockPrice } from '../services/tradeService';
import GoldenCrossCanvasChart from '../components/GoldenCrossCanvasChart';
import RSIChart from '../components/RSIChart';
import BollingerChart from '../components/BollingerChart';
import MACDChart from '../components/MACDChart';
import {
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  ReferenceLine,
  ComposedChart,
  CartesianGrid,
} from 'recharts';


const StrategyPage = () => {
  const { isVirt } = useRoutePrefix();
  // 상태 관리
  const [_activeTab] = useState<'strategies' | 'backtest' | 'indicators'>('strategies');
  const [pageLoading, setPageLoading] = useState(true);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [isBacktesting, setIsBacktesting] = useState(false);
  const [stockList, setStockList] = useState<StockPrice[]>([]);
  const [krxStockList, setKrxStockList] = useState<StockPrice[]>([]);
  const [_indicatorData] = useState<IndicatorData[]>([]);

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

  // 백테스팅 가이드
  const [_showBacktestGuide, _setShowBacktestGuide] = useState(false);

  // 백테스팅 폼 상태
  const [backtestMode, _setBacktestMode] = useState<'strategy' | 'stock'>('strategy');
  const [backtestStockCode, setBacktestStockCode] = useState('');
  const [backtestStartDate, setBacktestStartDate] = useState(() => {
    const d = new Date(); d.setFullYear(d.getFullYear() - 2);
    return d.toISOString().slice(0, 10);
  });
  const [backtestEndDate, setBacktestEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [backtestInitialCapital, setBacktestInitialCapital] = useState('10000000');

  // 리스크 관리
  const [stopLossPercent, setStopLossPercent] = useState('');
  const [takeProfitPercent, setTakeProfitPercent] = useState('');
  const [trailingStopPercent, setTrailingStopPercent] = useState('');
  const [slippagePercent, setSlippagePercent] = useState('0.1');
  const [commissionRate, setCommissionRate] = useState('0.1');
  const [positionSizing, _setPositionSizing] = useState('ALL_IN');
  const [positionValue, _setPositionValue] = useState('');
  const [tradeDirection, setTradeDirection] = useState<'LONG_ONLY' | 'SHORT_ONLY' | 'LONG_SHORT'>('LONG_ONLY');
  const [maxPositions, _setMaxPositions] = useState('1');
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [_showBacktestForm, setShowBacktestForm] = useState(false);

  // 백테스트 히스토리
  const [backtestHistory, setBacktestHistory] = useState<BacktestHistoryEntry[]>([]);
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);
  const historyDropdownRef = useRef<HTMLDivElement>(null);

  // 토스트
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  // 가이드 투어
  const [showTour, setShowTour] = useState(false);
  const tourSteps: TourStep[] = [
    { target: 'strategy-library', title: '1단계: 전략을 골라보세요', description: '골든크로스, RSI, 볼린저 밴드, MACD 등 검증된 투자 전략이 준비되어 있습니다.\n\n각 카드를 클릭하면 전략의 상세 설명과 매매 규칙을 확인할 수 있고, "새 항로" 버튼으로 나만의 전략을 직접 만들 수도 있습니다.', position: 'right' },
    { target: 'strategy-filter', title: '전략 유형별 필터', description: '전략이 많아서 고민이라면 유형별로 필터링해보세요.\n\n• 추세추종 — 오르는 흐름을 따라가는 전략\n• 역추세 — 과매도 반등을 노리는 전략\n• 변동성 — 큰 움직임을 포착하는 전략\n\n각 탭에 마우스를 올리면 설명이 나옵니다.', position: 'bottom' },
    { target: 'center-panel', title: '2단계: 전략 상세 확인', description: '왼쪽에서 전략을 선택하면 이 영역에 상세 정보가 표시됩니다.\n\n• 전략의 핵심 원리와 매매 조건\n• 초보자를 위한 교육 콘텐츠\n• 전략 시각화 차트\n\n파란색 밑줄이 있는 용어에 마우스를 올리면 쉬운 설명이 나옵니다.', position: 'bottom' },
    { target: 'stock-search', title: '3단계: 테스트할 종목 선택', description: '어떤 종목으로 백테스트할지 선택하세요.\n\n• 암호화폐: BTC, ETH, XRP, SOL 등\n• 국내 주식: 삼성전자, 카카오 등\n• 해외 주식: AAPL, TSLA 등\n\n전략에 포함된 종목이 있으면 바로가기 버튼이 자동으로 나타납니다.', position: 'left' },
    { target: 'period-select', title: '4단계: 분석 기간 설정', description: '과거 어느 기간의 데이터로 테스트할지 설정하세요.\n\n• 빠른 선택: 6개월, 1년, 2년, 3년, 5년 버튼\n• 직접 설정: 캘린더에서 시작일/종료일 선택\n\n기간이 길수록 결과가 신뢰할 수 있지만, 시장 환경 변화도 고려해야 합니다.', position: 'left' },
    { target: 'initial-capital', title: '투자금 설정', description: '가상으로 얼마를 투자할지 설정합니다.\n\n빠른 버튼(100만~5000만)을 누르거나 직접 입력할 수 있습니다. 실제 돈이 아니라 시뮬레이션 금액이니 부담 없이 설정하세요.', position: 'left' },
    { target: 'advanced-settings', title: '고급 설정 (선택사항)', description: '더 정밀한 백테스트를 원한다면 펼쳐보세요.\n\n• 손절/익절 — 자동 매도 기준 설정\n• 트레일링 스탑 — 수익 보호 장치\n• 슬리피지/수수료 — 실제 거래 비용 반영\n• 매매 방향 — 롱(매수) 또는 숏(공매도)\n• 수식 조건 — 고급 사용자를 위한 커스텀 매매 규칙\n\n초보자는 기본값 그대로 두어도 됩니다.', position: 'left' },
    { target: 'run-backtest', title: '마지막: 실행!', description: '모든 준비가 끝났으면 이 버튼을 누르세요!\n\n결과로 다음 정보가 표시됩니다:\n• 수익률, 승률, 샤프 비율 등 핵심 성과 지표\n• 매수/매도 포인트가 표시된 가격 차트\n• 자산 변동 추이 (전략 vs 단순 보유 비교)\n• 모든 거래 내역\n\n같은 전략이라도 종목/기간/설정을 바꿔가며 여러 번 테스트해보세요.', position: 'top' },
  ];

  // 전략 필터 탭
  const [strategyFilter, setStrategyFilter] = useState<'전체' | '추세추종' | '역추세' | '변동성'>('전체');

  // 종목 분석 모드 조건
  const [directEntryConditions, setDirectEntryConditions] = useState<Condition[]>([]);
  const [directExitConditions, setDirectExitConditions] = useState<Condition[]>([]);

  // 전략별 지표/조건 커스텀 편집
  const [editableIndicators, setEditableIndicators] = useState<Indicator[]>([]);
  const [editableEntryConditions, setEditableEntryConditions] = useState<Condition[]>([]);
  const [editableExitConditions, setEditableExitConditions] = useState<Condition[]>([]);

  // selectedStrategy 변경 시 편집 가능한 복사본 초기화
  useEffect(() => {
    if (selectedStrategy) {
      setEditableIndicators(selectedStrategy.indicators?.map(i => ({ ...i, parameters: { ...i.parameters } })) || []);
      setEditableEntryConditions(selectedStrategy.entryConditions?.map(c => ({ ...c })) || []);
      setEditableExitConditions(selectedStrategy.exitConditions?.map(c => ({ ...c })) || []);
    } else {
      setEditableIndicators([]);
      setEditableEntryConditions([]);
      setEditableExitConditions([]);
    }
  }, [selectedStrategy]);

  // 데이터 로드
  useEffect(() => {
    loadStrategies();
    loadStockList();
    setBacktestHistory(loadBacktestHistory());
    const today = new Date().toISOString().split('T')[0];
    const twoYearsAgo = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setBacktestEndDate(today);
    setBacktestStartDate(twoYearsAgo);
  }, []);

  // 히스토리 드롭다운 외부 클릭 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (historyDropdownRef.current && !historyDropdownRef.current.contains(e.target as Node))
        setShowHistoryDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const loadStrategies = async () => {
    try {
      const data = await strategyService.getStrategies().catch(() => []);
      setStrategies(data);
      // 선택된 전략이 있으면 최신 데이터로 갱신
      if (selectedStrategy) {
        const updated = data.find(s => s.id === selectedStrategy.id);
        if (updated) {
          setSelectedStrategy(updated);
        } else {
          setSelectedStrategy(null);
        }
      }
    } catch {
      setStrategies([]);
    } finally {
      setPageLoading(false);
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
      await strategyService.deleteStrategy(strategyId).catch(e => console.error('항로 삭제 API 실패:', e));
      const updatedStrategies = strategies.filter(s => s.id !== strategyId);
      setStrategies(updatedStrategies);
      if (selectedStrategy?.id === strategyId) {
        setSelectedStrategy(null);
      }
      showToast('항로가 삭제되었습니다.', 'success');
    } catch (error: any) {
      showToast('항로 삭제에 실패했습니다: ' + (error.message || '알 수 없는 오류'), 'error');
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
      void allList;
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
      showToast('항로 이름을 입력해주세요.', 'error');
      return;
    }
    if (selectedAssets.length === 0) {
      showToast('투자 대상 자산을 1개 이상 선택해주세요.', 'error');
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
        showToast('항로가 수정되었습니다!', 'success');
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
        showToast('항로가 생성되었습니다!', 'success');
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || error.response?.data?.error || '저장에 실패했습니다.', 'error');
    }
  };

  const handleApplyStrategy = async () => {
    if (!selectedStrategy) return;
    const amount = parseInt(applyAmount);
    if (!amount || amount <= 0) {
      showToast('투자 금액을 입력해주세요.', 'error');
      return;
    }

    setIsApplying(true);
    try {
      const result = await strategyService.applyStrategy(selectedStrategy.id, amount);
      const success = result.appliedSuccessCount || selectedStrategy.targetAssets?.length || 0;
      const total = result.appliedTotalCount || selectedStrategy.targetAssets?.length || 0;
      if (success < total) {
        showToast(`항로 "${selectedStrategy.name}" 적용 완료! ${total}개 자산 중 ${success}개 매수 성공, ${total - success}개 실패.`, 'info');
      } else {
        showToast(`항로 "${selectedStrategy.name}" 포트폴리오 적용 완료! ${success}개 자산에 균등 투자.`, 'success');
      }
      setShowApplyModal(false);
      await loadStrategies();
    } catch (error: any) {
      const msg = error.response?.data?.error || error.response?.data?.message || '항로 적용에 실패했습니다.';
      showToast(msg, 'error');
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
    // 백엔드가 내부적으로 _KRW / USDT 접미사를 붙이므로 중복 방지
    const cleanCode = code.replace(/_KRW$/, '');
    setBacktestStockCode(cleanCode);
    setBacktestStockName(name);
    setBacktestAssetType(market || 'CRYPTO');
    setBacktestSearchQuery(name);
    setShowBacktestDropdown(false);
    setBacktestSearchResults([]);
  };

  const handleRunBacktest = async () => {
    if (backtestMode === 'strategy' && !selectedStrategy) {
      showToast('항로를 선택해주세요.', 'error');
      return;
    }

    if (backtestMode === 'strategy' && selectedStrategy
        && (!selectedStrategy.entryConditions || selectedStrategy.entryConditions.length === 0)
        && (!selectedStrategy.exitConditions || selectedStrategy.exitConditions.length === 0)) {
      showToast('선택한 항로에 진입/청산 조건이 설정되어 있지 않습니다. 항로 관리에서 조건을 먼저 추가해주세요.', 'error');
      return;
    }

    if (!backtestStockCode || !backtestStartDate || !backtestEndDate) {
      showToast('종목, 시작일, 종료일을 모두 입력해주세요.', 'error');
      return;
    }

    if (backtestMode === 'stock' && directEntryConditions.length === 0 && directExitConditions.length === 0) {
      showToast('진입 조건 또는 청산 조건을 최소 1개 설정해주세요.', 'error');
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
      const request: BacktestRequest = {
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
      if (tradeDirection !== 'LONG_ONLY') request.tradeDirection = tradeDirection;
      if (parseInt(maxPositions) > 1) request.maxPositions = parseInt(maxPositions);

      if (backtestMode === 'strategy') {
        // 프리셋 전략이고 지표/조건이 편집됐으면 직접 조건으로 전송
        const isPreset = selectedStrategy!.id.startsWith('preset-');
        if (isPreset && editableIndicators.length > 0) {
          request.indicators = editableIndicators;
          request.entryConditions = editableEntryConditions;
          request.exitConditions = editableExitConditions;
        } else {
          request.strategyId = selectedStrategy!.id;
        }
      } else {
        request.entryConditions = directEntryConditions;
        request.exitConditions = directExitConditions;

        // 조건에서 사용된 지표를 자동 추론하여 indicators 배열 생성
        const usedIndicators = new Set<string>();
        const allConds = [...directEntryConditions, ...directExitConditions];
        for (const c of allConds) {
          const ind = c.indicator?.toUpperCase() || '';
          // 크로스오버 키 분해
          if (ind.includes('_CROSSUNDER_')) {
            ind.split('_CROSSUNDER_').forEach(p => usedIndicators.add(p));
          } else if (ind.includes('_CROSS_')) {
            ind.split('_CROSS_').forEach(p => usedIndicators.add(p));
          } else if (ind !== 'PRICE' && ind !== 'CLOSE') {
            usedIndicators.add(ind);
          }
        }
        // 지표 키 → Indicator 타입 매핑
        const keyToType: Record<string, { type: string; params: Record<string, number> }> = {
          RSI: { type: 'RSI', params: { period: 14 } },
          MACD: { type: 'MACD', params: { fast: 12, slow: 26, signal: 9 } },
          MACD_SIGNAL: { type: 'MACD', params: { fast: 12, slow: 26, signal: 9 } },
          MACD_HISTOGRAM: { type: 'MACD', params: { fast: 12, slow: 26, signal: 9 } },
          MA: { type: 'MA', params: { period: 20 } },
          SMA: { type: 'MA', params: { period: 20 } },
          EMA: { type: 'EMA', params: { period: 20 } },
          BOLLINGER_UPPER: { type: 'BOLLINGER_BANDS', params: { period: 20, stdDev: 2 } },
          BOLLINGER_MIDDLE: { type: 'BOLLINGER_BANDS', params: { period: 20, stdDev: 2 } },
          BOLLINGER_LOWER: { type: 'BOLLINGER_BANDS', params: { period: 20, stdDev: 2 } },
          BOLLINGER_PCT_B: { type: 'BOLLINGER_BANDS', params: { period: 20, stdDev: 2 } },
          STOCH_K: { type: 'STOCHASTIC', params: { kPeriod: 14, dPeriod: 3 } },
          STOCH_D: { type: 'STOCHASTIC', params: { kPeriod: 14, dPeriod: 3 } },
          ATR: { type: 'ATR', params: { period: 14 } },
          CCI: { type: 'CCI', params: { period: 20 } },
          WILLIAMS_R: { type: 'WILLIAMS_R', params: { period: 14 } },
          OBV: { type: 'OBV', params: {} },
        };
        const addedTypes = new Set<string>();
        const indicators: any[] = [];
        for (const key of usedIndicators) {
          const mapping = keyToType[key];
          if (mapping && !addedTypes.has(mapping.type)) {
            addedTypes.add(mapping.type);
            indicators.push({ type: mapping.type, parameters: mapping.params });
          }
        }
        if (indicators.length > 0) {
          request.indicators = indicators;
        }
      }

      const result = await strategyService.runBacktest(request);
      setBacktestResult(result);
      // 히스토리에 저장
      saveBacktestHistory(result);
      setBacktestHistory(loadBacktestHistory());
    } catch (error: any) {
      const status = error.response?.status;
      const rawMsg = error.response?.data?.error || error.response?.data?.message || error.message || '';
      let msg = rawMsg;
      if (status === 429) {
        msg = '요청이 너무 많습니다.\n잠시 후 다시 시도해주세요. (분당 5회 제한)';
      } else if (rawMsg.includes('캔들스틱 데이터를 가져올 수 없습니다')) {
        msg = `${backtestStockName || backtestStockCode}의 시세 데이터를 불러올 수 없습니다.\n\n• 종목코드가 올바른지 확인해주세요\n• 상장폐지/거래정지 종목은 조회가 안 됩니다`;
      } else if (rawMsg.includes('충분한 데이터가 없습니다')) {
        msg = `선택한 기간(${backtestStartDate} ~ ${backtestEndDate})에 데이터가 부족합니다.\n\n• 시작일을 더 최근으로 조정해보세요\n• 신규 상장 종목은 상장일 이후부터 가능합니다`;
      } else if (!msg) {
        msg = '백테스팅 실행에 실패했습니다. 잠시 후 다시 시도해주세요.';
      }
      showToast(msg.replace(/\n/g, ' '), 'error');
    } finally {
      setIsBacktesting(false);
    }
  };

  // 종목 분석 모드 프리셋
  const [_activePreset, _setActivePreset] = useState<string>('');

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

  // 조건을 읽기 쉬운 형태로 변환
  const formatCondition = (c: Condition, type: 'entry' | 'exit') => {
    const ind = c.indicator || '';
    const color = type === 'entry' ? 'red' : 'blue';

    // 크로스오버 조건: MA_20_CROSS_MA_60 → "MA(20) ↑ MA(60) 골든크로스"
    if (ind.includes('_CROSS_') || ind.includes('_CROSSUNDER_')) {
      const isUnder = ind.includes('_CROSSUNDER_');
      const parts = isUnder ? ind.split('_CROSSUNDER_', 2) : ind.split('_CROSS_', 2);
      const formatKey = (k: string) => {
        const m = k.match(/^([A-Z]+)_(\d+)$/);
        return m ? `${m[1]}(${m[2]})` : k;
      };
      const a = formatKey(parts[0]);
      const b = formatKey(parts[1]);
      if (isUnder) {
        return (
          <span className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200`}>
            <span className="font-bold">{a}</span>
            <span className="text-blue-400 mx-1">가</span>
            <span className="font-bold">{b}</span>
            <span className="text-blue-400 mx-1">아래로 돌파 시</span>
            <span className="inline-block px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 text-[10px] font-bold ml-0.5">매도</span>
          </span>
        );
      }
      return (
        <span className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-700 border border-red-200`}>
          <span className="font-bold">{a}</span>
          <span className="text-red-400 mx-1">가</span>
          <span className="font-bold">{b}</span>
          <span className="text-red-400 mx-1">위로 돌파 시</span>
          <span className="inline-block px-1.5 py-0.5 rounded bg-red-100 text-red-600 text-[10px] font-bold ml-0.5">매수</span>
        </span>
      );
    }

    // 일반 임계값 조건: RSI < 30
    const opMap: Record<string, string> = { GT: '>', GTE: '≥', LT: '<', LTE: '≤', EQ: '=' };
    return (
      <>
        <span className={`px-2 py-0.5 rounded text-xs font-semibold bg-${color}-100 text-${color}-600`}>{ind}</span>
        <span className={`font-bold ${isVirt ? 'text-whale-dark' : 'text-white'}`}>{opMap[c.operator || ''] || c.operator}</span>
        <span className={`font-semibold ${isVirt ? 'text-whale-dark' : 'text-white'}`}>{c.value}</span>
      </>
    );
  };

  // 전략 ID에 매핑되는 캔버스 차트
  const StrategyChart = ({ strategyId }: { strategyId: string }) => {
    switch (strategyId) {
      case 'preset-golden-cross': return <GoldenCrossCanvasChart />;
      case 'preset-rsi-reversal': return <RSIChart />;
      case 'preset-bollinger-squeeze': return <BollingerChart />;
      case 'preset-macd-divergence': return <MACDChart />;
      default:
        return (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <svg className="w-12 h-12 text-whale-light/30 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
            <p className={`text-sm ${isVirt ? 'text-gray-400' : 'text-slate-500'}`}>차트 준비 중</p>
            <p className={`text-xs mt-1 ${isVirt ? 'text-gray-300' : 'text-slate-600'}`}>이 전략의 시각화 차트가 곧 추가됩니다</p>
          </div>
        );
    }
  };

  // 기본 제공 프리셋 전략 (전략 학습)
  const PRESET_STRATEGIES: Strategy[] = [
    {
      id: 'preset-golden-cross', name: '골든크로스 추종 전략', description: '20일/60일 이동평균선 골든크로스 발생 시 매수, 데드크로스 시 매도하는 추세추종 전략입니다. 중장기 상승 추세에서 안정적인 수익을 추구합니다.',
      beginnerTip: '쉽게 말하면: 최근 흐름이 장기 흐름을 앞지르면 "오르는 중"이라 판단하고 사는 전략이에요.',
      whyUse: '가장 기본적인 전략으로, 큰 상승장을 놓치지 않으면서도 하락장에서 빠져나올 수 있어요. 초보자가 처음 배우기에 가장 좋은 전략입니다.',
      difficulty: '초급',
      strategyLogic: 'MA(20) > MA(60) → 매수 / MA(20) < MA(60) → 매도',
      assetType: 'CRYPTO', targetAssets: ['BTC_KRW', 'ETH_KRW', 'SOL_KRW'], targetAssetNames: { BTC_KRW: '비트코인(BTC)', ETH_KRW: '이더리움(ETH)', SOL_KRW: '솔라나(SOL)' },
      indicators: [{ type: 'MA', parameters: { period: 20 } }, { type: 'MA', parameters: { period: 60 } }],
      entryConditions: [{ indicator: 'MA_20_CROSS_MA_60', operator: 'GT', value: 0, logic: 'AND' }],
      exitConditions: [{ indicator: 'MA_20_CROSSUNDER_MA_60', operator: 'GT', value: 0, logic: 'AND' }],
      applied: false, createdAt: '', updatedAt: '',
    },
    {
      id: 'preset-rsi-reversal', name: 'RSI 반전 매매', description: 'RSI 과매도 구간(30 이하) 진입 후 반등 시 매수, 과매수 구간(70 이상) 도달 시 매도하는 평균회귀 전략입니다.',
      beginnerTip: '쉽게 말하면: 가격이 너무 많이 떨어져서 "이제 반등할 때가 됐다" 싶을 때 사고, 너무 올라서 "이제 내려갈 때" 싶으면 파는 전략이에요.',
      whyUse: '급락 후 반등을 잡아내는 전략이라, 하락장에서도 수익 기회를 만들 수 있어요.',
      difficulty: '초급',
      strategyLogic: 'RSI < 30 → 매수 / RSI > 70 → 매도',
      assetType: 'CRYPTO', targetAssets: ['BTC_KRW', 'ETH_KRW', 'XRP_KRW', 'DOGE_KRW'], targetAssetNames: { BTC_KRW: '비트코인(BTC)', ETH_KRW: '이더리움(ETH)', XRP_KRW: '리플(XRP)', DOGE_KRW: '도지코인(DOGE)' },
      indicators: [{ type: 'RSI', parameters: { period: 14 } }],
      entryConditions: [{ indicator: 'RSI', operator: 'LT', value: 30, logic: 'AND' }],
      exitConditions: [{ indicator: 'RSI', operator: 'GT', value: 70, logic: 'AND' }],
      applied: false, createdAt: '', updatedAt: '',
    },
    {
      id: 'preset-bollinger-squeeze', name: '볼린저 밴드 수축 돌파', description: '볼린저 밴드 수축 구간에서 상단 돌파 시 매수, 중심선 하락 시 손절. 변동성 확대 구간을 노리는 전략입니다.',
      beginnerTip: '쉽게 말하면: 가격이 한동안 조용하다가 갑자기 위로 터지면 "폭발적 상승 시작"이라 보고 올라타는 전략이에요.',
      whyUse: '횡보장에서 기다리다가 큰 움직임이 시작될 때만 거래해서, 불필요한 매매를 줄여줘요.',
      difficulty: '중급',
      strategyLogic: '%B > 1 → 매수 (상단 돌파) / %B < 0 → 매도 (하단 이탈)',
      assetType: 'CRYPTO', targetAssets: ['BTC_KRW', 'ETH_KRW', 'SOL_KRW', 'AVAX_KRW'], targetAssetNames: { BTC_KRW: '비트코인(BTC)', ETH_KRW: '이더리움(ETH)', SOL_KRW: '솔라나(SOL)', AVAX_KRW: '아발란체(AVAX)' },
      indicators: [{ type: 'BOLLINGER_BANDS', parameters: { period: 20, stdDev: 2 } }],
      entryConditions: [{ indicator: 'BOLLINGER_PCT_B', operator: 'GT', value: 1, logic: 'AND' }],
      exitConditions: [{ indicator: 'BOLLINGER_PCT_B', operator: 'LT', value: 0, logic: 'AND' }],
      applied: false, createdAt: '', updatedAt: '',
    },
    {
      id: 'preset-macd-divergence', name: 'MACD 크로스오버', description: 'MACD 시그널 크로스와 히스토그램 전환을 활용한 추세 전환 포착 전략입니다.',
      beginnerTip: '쉽게 말하면: 두 개의 추세선이 교차하는 순간을 포착해서 "추세가 바뀌고 있다"는 신호를 잡아내는 전략이에요.',
      whyUse: '상승↔하락 전환 시점을 미리 감지할 수 있어서, 큰 흐름의 시작에 올라탈 수 있어요.',
      difficulty: '중급',
      strategyLogic: 'MACD 골든크로스 → 매수 / MACD 데드크로스 → 매도',
      assetType: 'MIXED', targetAssets: ['BTC_KRW', 'ETH_KRW'], targetAssetNames: { BTC_KRW: '비트코인(BTC)', ETH_KRW: '이더리움(ETH)' },
      indicators: [{ type: 'MACD', parameters: { fast: 12, slow: 26, signal: 9 } }],
      entryConditions: [{ indicator: 'MACD_CROSS_MACD_SIGNAL', operator: 'GT', value: 0, logic: 'AND' }],
      exitConditions: [{ indicator: 'MACD_CROSSUNDER_MACD_SIGNAL', operator: 'GT', value: 0, logic: 'AND' }],
      applied: false, createdAt: '', updatedAt: '',
    },
    {
      id: 'preset-stochastic', name: '스토캐스틱 크로스', description: '스토캐스틱 %K가 %D를 상향 돌파할 때 매수, 하향 돌파할 때 매도하는 모멘텀 전략입니다.',
      beginnerTip: '쉽게 말하면: "지금 가격이 최근 범위에서 어디쯤인지" 보고, 바닥 근처에서 사고 천장 근처에서 파는 전략이에요.',
      whyUse: '단기 매매에 적합하고, 매수/매도 타이밍을 비교적 명확하게 잡아줘요.',
      difficulty: '중급',
      strategyLogic: '%K ↑ %D 크로스 → 매수 / %K ↓ %D 크로스 → 매도',
      assetType: 'CRYPTO', targetAssets: ['BTC_KRW', 'ETH_KRW', 'XRP_KRW'], targetAssetNames: { BTC_KRW: '비트코인(BTC)', ETH_KRW: '이더리움(ETH)', XRP_KRW: '리플(XRP)' },
      indicators: [{ type: 'STOCHASTIC', parameters: { kPeriod: 14, dPeriod: 3 } }],
      entryConditions: [{ indicator: 'STOCH_K_CROSS_STOCH_D', operator: 'GT', value: 0, logic: 'AND' }],
      exitConditions: [{ indicator: 'STOCH_K_CROSSUNDER_STOCH_D', operator: 'GT', value: 0, logic: 'AND' }],
      applied: false, createdAt: '', updatedAt: '',
    },
    {
      id: 'preset-connors-rsi2', name: '래리 코너스 RSI(2)', description: '초단기 RSI(2일)를 사용하여 급락 후 반등을 포착하는 단기 매매 전략입니다. 래리 코너스가 개발한 전략으로, 상승 추세 종목에서 일시적 과매도 구간을 노립니다.',
      beginnerTip: '쉽게 말하면: 평소 잘 오르던 종목이 갑자기 2~3일 급락했을 때 "일시적 할인"이라 보고 사는 전략이에요.',
      whyUse: '실제 월가에서 검증된 전략으로, 높은 승률이 특징이에요. 단, 단기 매매라 잦은 거래가 발생해요.',
      difficulty: '고급',
      strategyLogic: 'RSI(2) < 5 → 매수 (초단기 과매도) / RSI(2) > 60 → 매도 (반등 확인)',
      assetType: 'CRYPTO', targetAssets: ['BTC_KRW', 'ETH_KRW'], targetAssetNames: { BTC_KRW: '비트코인(BTC)', ETH_KRW: '이더리움(ETH)' },
      indicators: [{ type: 'RSI', parameters: { period: 2 } }],
      entryConditions: [{ indicator: 'RSI', operator: 'LT', value: 5, logic: 'AND' }],
      exitConditions: [{ indicator: 'RSI', operator: 'GT', value: 60, logic: 'AND' }],
      applied: false, createdAt: '', updatedAt: '',
    },
    {
      id: 'preset-volatility-breakout', name: '변동성 돌파 전략', description: '래리 윌리엄스의 변동성 돌파 전략입니다. 전일 변동폭(고가-저가)의 일정 비율만큼 당일 시가에서 상승하면 매수하고, 다음 날 청산합니다.',
      beginnerTip: '쉽게 말하면: 어제 가격이 많이 흔들렸는데, 오늘 그 흔들림의 절반만큼 올라가면 "오늘은 오르는 날"이라 보고 사는 전략이에요.',
      whyUse: '하루 단위로 매매해서 리스크가 제한적이고, 코인처럼 변동성 큰 자산에 잘 맞아요.',
      difficulty: '고급',
      strategyLogic: 'CLOSE > OPEN + (전일고가 - 전일저가) × 0.5 → 매수 / 다음날 시가 매도',
      assetType: 'CRYPTO', targetAssets: ['BTC_KRW', 'ETH_KRW'], targetAssetNames: { BTC_KRW: '비트코인(BTC)', ETH_KRW: '이더리움(ETH)' },
      indicators: [{ type: 'ATR', parameters: { period: 1 } }],
      entryConditions: [{ indicator: 'CLOSE', operator: 'GT', value: 0, logic: 'AND', valueExpression: 'OPEN + (PREV_HIGH - PREV_LOW) * 0.5' }],
      exitConditions: [{ indicator: 'CLOSE', operator: 'LT', value: 0, logic: 'AND', valueExpression: 'OPEN + (PREV_HIGH - PREV_LOW) * 0.3' }],
      applied: false, createdAt: '', updatedAt: '',
    },
    {
      id: 'preset-safe-rebalancing', name: '안전 자산 리밸런싱', description: 'BTC 60% + ETH 30% + 스테이블 10% 비율을 매주 리밸런싱하는 보수적 전략입니다. 장기 안정적 수익을 추구합니다.',
      beginnerTip: '쉽게 말하면: "달걀을 한 바구니에 담지 마라"를 자동으로 실행하는 전략이에요. 비율이 틀어지면 알아서 맞춰줘요.',
      whyUse: '가장 안전한 전략이에요. 복잡한 매매 타이밍 없이, 분산 투자를 자동으로 유지해줘요. 장기 투자자에게 추천!',
      difficulty: '초급',
      strategyLogic: '목표 비율 유지: BTC 60%, ETH 30%, USDT 10%',
      assetType: 'CRYPTO', targetAssets: ['BTC_KRW', 'ETH_KRW', 'USDT_KRW'], targetAssetNames: { BTC_KRW: '비트코인(BTC)', ETH_KRW: '이더리움(ETH)', USDT_KRW: 'USDT' },
      indicators: [],
      entryConditions: [], exitConditions: [],
      applied: false, createdAt: '', updatedAt: '',
    },
  ];

  // 프리셋 + 사용자 항로 합치기
  const allStrategies = [...PRESET_STRATEGIES, ...strategies];

  if (pageLoading && !isVirt) return <SplashLoading message="전략 데이터를 불러오는 중..." />;
  if (pageLoading && isVirt) return <VirtSplashLoading message="전략 데이터를 불러오는 중..." />;

  return (
    <div className={`min-h-screen ${isVirt ? 'bg-gray-50' : 'bg-[#060d18] text-white'}`}>
      {toast && (
        <div className="fixed top-4 right-4 z-50 max-w-sm animate-in slide-in-from-top">
          <div className={`px-4 py-3 rounded-xl shadow-lg border-l-4 backdrop-blur-sm ${
            toast.type === 'success' ? 'bg-emerald-50 border-l-emerald-500 text-emerald-800' :
            toast.type === 'error' ? 'bg-red-50 border-l-red-500 text-red-800' :
            'bg-blue-50 border-l-blue-500 text-blue-800'
          }`}>
            <p className="text-sm">{toast.message}</p>
          </div>
        </div>
      )}
      <style>{`
        @keyframes float { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }
        @keyframes wave { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes sail { 0% { transform: translateX(-10px) rotate(-2deg); } 50% { transform: translateX(10px) rotate(2deg); } 100% { transform: translateX(-10px) rotate(-2deg); } }
        .float-animation { animation: float 3s ease-in-out infinite; }
        .wave-animation { animation: wave 8s linear infinite; }
        .sail-animation { animation: sail 4s ease-in-out infinite; }
      `}</style>
      <Header showNav={true} />

      {/* 풀 와이드 3-컬럼 레이아웃 */}
      <div className="max-w-[1600px] mx-auto px-4 py-4">
      <div className={`flex flex-col lg:flex-row w-full min-h-[calc(100vh-96px)] rounded-2xl overflow-hidden shadow-sm ${isVirt ? 'border border-gray-200' : 'border border-white/[0.06]'}`}>

        {/* ===== LEFT SIDEBAR: 전략 라이브러리 ===== */}
        <div data-tour="strategy-library" className={`lg:flex-[3] flex flex-col min-w-0 shadow-sm ${isVirt ? 'bg-gray-50 border-r border-gray-200' : 'bg-white/[0.02] border-r border-white/[0.06]'}`}>

          {/* ---- 헤더: 타이틀 + 새 항로 버튼 ---- */}
          <div className={`relative px-5 py-4 border-b flex items-center justify-between shrink-0 h-[72px] ${isVirt ? 'border-gray-200 bg-gradient-to-r from-whale-dark to-whale-light' : 'border-white/[0.06] bg-gradient-to-r from-whale-dark to-whale-light'}`}>
            <div>
              <h2 className="text-sm font-bold text-white">전략 라이브러리</h2>
              <p className="text-xs text-white/60 mt-0.5">전략을 선택하고 백테스트로 검증하세요</p>
            </div>
            <button onClick={openCreateModal}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-white/10 border border-white/40 hover:bg-white/20 transition-all shrink-0">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              새 항로
            </button>
            <div className="absolute bottom-0 left-0 right-0 overflow-hidden" style={{ height: '6px' }}>
              <svg viewBox="0 0 1200 20" preserveAspectRatio="none" className="w-full h-full">
                <path d="M0,10 C150,20 350,0 500,10 C650,20 850,0 1000,10 C1100,15 1150,5 1200,10 L1200,20 L0,20 Z" fill={isVirt ? 'white' : '#060d18'} />
              </svg>
            </div>
          </div>

          {/* ---- 필터 탭 ---- */}
          <div data-tour="strategy-filter" className={`px-5 pt-3 pb-0 shrink-0 ${isVirt ? 'bg-slate-50/80 border-b border-gray-200' : 'bg-white/[0.02] border-b border-white/[0.06]'}`}>
            <div className="flex gap-1">
              {([
                { tab: '전체' as const, glossaryKey: '' },
                { tab: '추세추종' as const, glossaryKey: '추세추종' },
                { tab: '역추세' as const, glossaryKey: '역추세' },
                { tab: '변동성' as const, glossaryKey: '변동성' },
              ]).map(({ tab, glossaryKey }) => (
                <button
                  key={tab}
                  onClick={() => setStrategyFilter(tab)}
                  className={`group relative px-3.5 py-2 rounded-t-lg text-xs font-semibold transition-all duration-200 border-b-2 ${
                    strategyFilter === tab
                      ? isVirt ? 'text-white bg-gradient-to-r from-whale-light to-blue-500 border-whale-light shadow-sm' : 'text-cyan-400 bg-white/10 border-cyan-400'
                      : isVirt ? 'text-gray-400 border-transparent hover:text-gray-600 hover:bg-white/80' : 'text-slate-500 border-transparent hover:text-slate-300 hover:bg-white/[0.03]'
                  }`}
                >
                  {tab}
                  {glossaryKey && GLOSSARY[glossaryKey] && (
                    <span className={`hidden group-hover:block absolute left-1/2 -translate-x-1/2 top-full mt-1 z-50 w-56 px-3 py-2 rounded-lg shadow-xl border text-left pointer-events-none ${isVirt ? 'border-gray-200 bg-white' : 'border-white/[0.06] bg-[#0a1628]'}`}>
                      <span className={`block text-[10px] font-bold mb-0.5 ${isVirt ? 'text-whale-dark' : 'text-white'}`}>{GLOSSARY[glossaryKey].title}</span>
                      <span className={`block text-[10px] leading-relaxed font-normal ${isVirt ? 'text-gray-500' : 'text-slate-400'}`}>{GLOSSARY[glossaryKey].desc}</span>
                      <span className={`absolute left-1/2 -translate-x-1/2 top-[-4px] w-2 h-2 rotate-45 ${isVirt ? 'bg-white border-l border-t border-gray-200' : 'bg-[#0a1628] border-l border-t border-white/[0.06]'}`} />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* ---- 전략 카드 목록 (스크롤) ---- */}
          <div className="overflow-y-auto px-5 py-4 space-y-2" style={{ maxHeight: 'calc(100vh - 300px)' }}>
            {(() => {
              const filtered = allStrategies.filter((s) => {
                if (strategyFilter === '전체') return true;
                if (strategyFilter === '추세추종') {
                  return s.entryConditions?.some(c =>
                    c.indicator?.includes('CROSS') || c.indicator?.includes('MA') || c.indicator?.includes('EMA') || c.indicator?.includes('MACD')
                  );
                }
                if (strategyFilter === '역추세') {
                  return s.entryConditions?.some(c =>
                    c.indicator === 'RSI' || c.indicator?.includes('STOCH') || c.indicator?.includes('BOLLINGER') || c.indicator?.includes('CCI')
                  );
                }
                if (strategyFilter === '변동성') {
                  return s.entryConditions?.some(c =>
                    c.indicator?.includes('BOLLINGER') || c.indicator?.includes('ATR')
                  );
                }
                return true;
              });

              if (filtered.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${isVirt ? 'bg-gray-100' : 'bg-white/[0.04]'}`}>
                      <svg className={`w-6 h-6 ${isVirt ? 'text-gray-300' : 'text-slate-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <p className={`text-sm font-medium ${isVirt ? 'text-gray-400' : 'text-slate-500'}`}>해당 전략이 없습니다</p>
                    <button onClick={openCreateModal}
                      className="mt-3 px-4 py-1.5 rounded-lg text-xs font-semibold text-whale-light bg-whale-light/10 border border-whale-light/30 hover:bg-whale-light hover:text-white transition-all">
                      + 새 항로 만들기
                    </button>
                  </div>
                );
              }

              return filtered.map((strategy) => {
                const isSelected = selectedStrategy?.id === strategy.id;
                const isPreset = strategy.id.startsWith('preset-');
                // Determine category color for left border
                const isTrend = strategy.entryConditions?.some(c =>
                  c.indicator?.includes('CROSS') || c.indicator?.includes('MA') || c.indicator?.includes('EMA') || c.indicator?.includes('MACD')
                );
                const isReverse = strategy.entryConditions?.some(c =>
                  c.indicator === 'RSI' || c.indicator?.includes('STOCH') || c.indicator?.includes('CCI')
                );
                const isVolatility = strategy.entryConditions?.some(c =>
                  c.indicator?.includes('BOLLINGER') || c.indicator?.includes('ATR')
                );
                const categoryBorderColor = isVolatility ? 'border-l-orange-400' : isReverse ? 'border-l-purple-400' : isTrend ? 'border-l-blue-400' : 'border-l-gray-300';
                return (
                  <div
                    key={strategy.id}
                    onClick={() => {
                      setSelectedStrategy(strategy);
                      setBacktestResult(null);
                      setShowBacktestForm(true);
                    }}
                    className={`relative rounded-xl cursor-pointer transition-all duration-200 overflow-hidden border border-l-[3px] ${categoryBorderColor} ${
                      isSelected
                        ? isVirt
                          ? 'bg-gradient-to-r from-whale-light/5 to-blue-50 border-whale-light border-l-whale-light shadow-lg ring-1 ring-whale-light/30 shadow-[0_0_15px_rgba(74,144,226,0.15)]'
                          : 'bg-white/[0.06] border-cyan-400/40 border-l-cyan-400 shadow-lg ring-1 ring-cyan-400/20 shadow-[0_0_15px_rgba(34,211,238,0.1)]'
                        : isVirt
                          ? 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-md hover:scale-[1.01]'
                          : 'bg-white/[0.02] border-white/[0.06] hover:border-white/10 hover:bg-white/[0.03] hover:scale-[1.01]'
                    }`}
                  >
                    {/* 선택 표시 — 왼쪽 파란 테두리 */}
                    {isSelected && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-whale-light rounded-l-xl" />
                    )}

                    <div className={`px-4 py-3 ${isSelected ? 'pl-5' : ''}`}>
                      {/* 이름 행 */}
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`font-bold text-sm truncate ${isVirt ? 'text-whale-dark' : 'text-white'}`}>{strategy.name}</span>
                          {isPreset && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold bg-whale-light/10 text-whale-light">기본</span>
                          )}
                          {strategy.difficulty && (
                            <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              strategy.difficulty === '초급' ? 'bg-emerald-100 text-emerald-600' :
                              strategy.difficulty === '중급' ? 'bg-amber-100 text-amber-600' :
                              'bg-red-100 text-red-600'
                            }`}>{strategy.difficulty}</span>
                          )}
                          {strategy.applied && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-600">적용중</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {/* 사용자 항로 삭제 버튼 */}
                          {!isPreset && (
                            <button
                              onClick={(e) => handleDeleteStrategy(strategy.id, e)}
                              className={`p-1 rounded transition-colors ${isVirt ? 'text-gray-300 hover:text-red-400' : 'text-slate-600 hover:text-red-400'}`}>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* 한 줄 설명 */}
                      <p className={`text-sm line-clamp-1 mb-2 ${isVirt ? 'text-gray-400' : 'text-slate-400'}`}>
                        {strategy.description || strategy.strategyLogic || '사용자 전략'}
                      </p>

                      {/* 하단 메타 행 */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          {strategy.assetType && (
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                              strategy.assetType === 'CRYPTO' ? (isVirt ? 'bg-orange-50 text-orange-600' : 'bg-orange-500/10 text-orange-400') :
                              strategy.assetType === 'STOCK' ? (isVirt ? 'bg-indigo-50 text-indigo-600' : 'bg-indigo-500/10 text-indigo-400') :
                              (isVirt ? 'bg-purple-50 text-purple-600' : 'bg-purple-500/10 text-purple-400')
                            }`}>{assetTypeLabel(strategy.assetType)}</span>
                          )}
                          {(strategy.entryConditions?.length || 0) > 0 && (
                            <span className={`text-[9px] ${isVirt ? 'text-gray-400' : 'text-slate-500'}`}>
                              조건 {(strategy.entryConditions?.length || 0) + (strategy.exitConditions?.length || 0)}개
                            </span>
                          )}
                        </div>
                        {isVirt && !strategy.applied && strategy.targetAssets && strategy.targetAssets.length > 0 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedStrategy(strategy); setShowApplyModal(true); }}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-whale-light to-blue-500 hover:from-whale-dark hover:to-whale-light shadow-sm hover:shadow-md transition-all duration-200">
                            포트폴리오 적용
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>

        </div>

        {/* ===== CENTER PANEL: 차트 영역 ===== */}
        <div className={`flex flex-col lg:flex-[5.5] min-w-0 shadow-sm ${isVirt ? 'bg-white border-r border-gray-100' : 'bg-white/[0.01] border-r border-white/[0.06]'}`}>
          {/* 선택된 전략 바 or 페이지 타이틀 */}
          <div data-tour="center-panel" className={`px-6 py-4 border-b flex items-center justify-between h-[72px] ${isVirt ? 'border-gray-200 bg-gradient-to-r from-slate-50 to-blue-50/50' : 'border-white/[0.06] bg-white/[0.02]'}`}>
            {selectedStrategy ? (
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-2 h-8 rounded-full shrink-0 ${isVirt ? 'bg-whale-light' : 'bg-cyan-400'}`} />
                <div className="min-w-0">
                  <h1 className={`text-lg font-bold truncate ${isVirt ? 'text-whale-dark' : 'text-white'}`}>{selectedStrategy.name}</h1>
                  <p className={`text-xs truncate ${isVirt ? 'text-gray-400' : 'text-slate-400'}`}>{selectedStrategy.description?.slice(0, 60) || selectedStrategy.strategyLogic?.slice(0, 60) || '전략 상세'}</p>
                </div>
              </div>
            ) : (
              <div>
                <h1 className={`text-lg font-bold ${isVirt ? 'text-whale-dark' : 'text-white'}`}>항로 분석 스테이션</h1>
                <p className={`text-xs ${isVirt ? 'text-gray-400' : 'text-slate-400'}`}>전략을 선택하고 과거 데이터로 검증하세요</p>
              </div>
            )}
            {backtestResult && (
              <div className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 ${backtestResult.totalReturnRate >= 0 ? (isVirt ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/10 text-emerald-400') : (isVirt ? 'bg-red-100 text-red-700' : 'bg-red-500/10 text-red-400')}`}>
                {backtestResult.totalReturnRate >= 0 ? '수익' : '손실'} {formatPercent(backtestResult.totalReturnRate)}
              </div>
            )}
          </div>

          {/* 차트 메인 영역 */}
          <div className="flex-1 px-6 pb-4 overflow-y-auto">
            {isBacktesting ? (
              /* 로딩 */
              <div className={`w-full h-full min-h-[400px] rounded-xl flex flex-col items-center justify-center ${isVirt ? 'bg-gray-50 border border-gray-200' : 'bg-white/[0.02] border border-white/[0.06]'}`}>
                <div className="sail-animation">
                  <div className="w-14 h-14 border-4 border-whale-light border-t-transparent rounded-full animate-spin mb-5" />
                </div>
                <p className={`text-lg font-bold ${isVirt ? 'text-whale-dark' : 'text-white'}`}>항로 분석 중...</p>
                <p className={`text-sm mt-2 ${isVirt ? 'text-gray-500' : 'text-slate-400'}`}>
                  {backtestStockName || backtestStockCode} · {backtestStartDate?.slice(5)} ~ {backtestEndDate?.slice(5)}
                </p>
                <p className={`text-xs mt-1 ${isVirt ? 'text-gray-400' : 'text-slate-500'}`}>과거 데이터를 항해하고 있습니다</p>
                <div className="w-32 h-4 mt-4 overflow-hidden opacity-30">
                  <div className="wave-animation" style={{ width: '200%' }}>
                    <svg viewBox="0 0 1200 20" className="w-full h-4">
                      <path d="M0,10 C150,18 350,2 500,10 C650,18 850,2 1000,10 C1150,18 1200,10 1200,10 L1200,20 L0,20Z" fill="#4a90e2" opacity="0.5"/>
                    </svg>
                  </div>
                </div>
              </div>
            ) : !backtestResult ? (
              /* 교육 콘텐츠 또는 빈 상태 */
              selectedStrategy ? (
                <div className="space-y-5">
                  {/* 전략 헤더 */}
                  <div className={`rounded-xl p-6 ${isVirt ? 'bg-gradient-to-r from-slate-50 to-blue-50/50 border border-gray-200' : 'bg-white/[0.02] border border-white/[0.06]'}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          {selectedStrategy.assetType && (
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                              selectedStrategy.assetType === 'CRYPTO' ? (isVirt ? 'bg-orange-100 text-orange-700' : 'bg-orange-500/10 text-orange-400') :
                              selectedStrategy.assetType === 'STOCK' ? (isVirt ? 'bg-indigo-100 text-indigo-700' : 'bg-indigo-500/10 text-indigo-400') :
                              (isVirt ? 'bg-purple-100 text-purple-700' : 'bg-purple-500/10 text-purple-400')
                            }`}>{assetTypeLabel(selectedStrategy.assetType)}</span>
                          )}
                          {selectedStrategy.applied && (
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${isVirt ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/10 text-emerald-400'}`}>적용됨</span>
                          )}
                        </div>
                        <h2 className={`text-2xl font-bold ${isVirt ? 'text-whale-dark' : 'text-white'}`}>{selectedStrategy.name}</h2>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => openEditModal(selectedStrategy)}
                          className={`p-2 rounded-lg transition-all hover:shadow-sm ${isVirt ? 'bg-gray-100 hover:bg-gray-200 text-whale-dark' : 'bg-white/[0.04] hover:bg-white/[0.08] text-white'}`} title="수정">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        {isVirt && !selectedStrategy.applied && selectedStrategy.targetAssets && selectedStrategy.targetAssets.length > 0 && (
                          <button onClick={() => setShowApplyModal(true)}
                            className="px-3 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-whale-light to-blue-500 hover:from-whale-dark hover:to-whale-light hover:shadow-md transition-all duration-200">
                            포트폴리오 적용
                          </button>
                        )}
                      </div>
                    </div>
                    {selectedStrategy.description && (
                      <p className={`text-sm leading-relaxed ${isVirt ? 'text-gray-500' : 'text-slate-400'}`}>{selectedStrategy.description}</p>
                    )}
                    {/* 초보자 가이드 */}
                    {selectedStrategy.beginnerTip && (
                      <div className={`rounded-lg p-3.5 mt-3 ${isVirt ? 'bg-blue-50 border border-blue-200' : 'bg-cyan-500/5 border border-cyan-500/20'}`}>
                        <p className={`text-xs font-semibold mb-1.5 ${isVirt ? 'text-blue-600' : 'text-cyan-400'}`}>💡 쉽게 이해하기</p>
                        <p className={`text-xs leading-relaxed ${isVirt ? 'text-blue-700/80' : 'text-cyan-300/80'}`}>{selectedStrategy.beginnerTip}</p>
                      </div>
                    )}
                    {selectedStrategy.whyUse && (
                      <div className={`rounded-lg p-3.5 mt-2 ${isVirt ? 'bg-emerald-50 border border-emerald-200' : 'bg-emerald-500/5 border border-emerald-500/20'}`}>
                        <p className={`text-xs font-semibold mb-1.5 ${isVirt ? 'text-emerald-600' : 'text-emerald-400'}`}>왜 이 전략을 쓸까요?</p>
                        <p className={`text-xs leading-relaxed ${isVirt ? 'text-emerald-700/80' : 'text-emerald-300/80'}`}>{selectedStrategy.whyUse}</p>
                      </div>
                    )}
                  </div>

                  {/* 항로 로직 */}
                  {selectedStrategy.strategyLogic && (
                    <div className={`rounded-xl p-5 ${isVirt ? 'bg-gradient-to-r from-whale-dark/5 to-blue-50/50 border border-whale-light/20' : 'bg-white/[0.02] border border-white/[0.06]'}`}>
                      <h3 className={`text-xs font-bold mb-3 tracking-wide uppercase ${isVirt ? 'text-whale-light' : 'text-cyan-400'}`}>Trading Logic</h3>
                      <div className={`px-4 py-3 rounded-xl text-sm font-mono shadow-sm ${isVirt ? 'text-whale-dark bg-white border border-gray-200' : 'text-white bg-white/[0.04] border border-white/[0.06]'}`}>
                        {selectedStrategy.strategyLogic}
                      </div>
                    </div>
                  )}

                  {/* 매매 조건 시각화 */}
                  {((selectedStrategy.entryConditions?.length || 0) > 0 || (selectedStrategy.exitConditions?.length || 0) > 0) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {selectedStrategy.entryConditions && selectedStrategy.entryConditions.length > 0 && (
                        <div className={`rounded-xl p-5 ${isVirt ? 'bg-gray-50 border border-gray-200' : 'bg-white/[0.02] border border-white/[0.06]'}`}>
                          <h3 className="text-xs font-semibold mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-red-400" />
                            <span className={isVirt ? 'text-red-600' : 'text-red-400'}>매수 조건 (진입)</span>
                          </h3>
                          <div className="space-y-2">
                            {selectedStrategy.entryConditions.map((c, i) => (
                              <div key={i} className="flex items-center gap-2 text-sm">
                                {i > 0 && <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${isVirt ? 'bg-gray-200 text-gray-600' : 'bg-white/[0.06] text-slate-400'}`}>{c.logic}</span>}
                                {formatCondition(c, 'entry')}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {selectedStrategy.exitConditions && selectedStrategy.exitConditions.length > 0 && (
                        <div className={`rounded-xl p-5 ${isVirt ? 'bg-gray-50 border border-gray-200' : 'bg-white/[0.02] border border-white/[0.06]'}`}>
                          <h3 className="text-xs font-semibold mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-400" />
                            <span className={isVirt ? 'text-blue-600' : 'text-blue-400'}>매도 조건 (청산)</span>
                          </h3>
                          <div className="space-y-2">
                            {selectedStrategy.exitConditions.map((c, i) => (
                              <div key={i} className="flex items-center gap-2 text-sm">
                                {i > 0 && <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${isVirt ? 'bg-gray-200 text-gray-600' : 'bg-white/[0.06] text-slate-400'}`}>{c.logic}</span>}
                                {formatCondition(c, 'exit')}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 전략 시각화 차트 */}
                  {selectedStrategy.id.startsWith('preset-') && (
                    <div className={`rounded-xl overflow-hidden ${isVirt ? 'border border-gray-200 bg-white' : 'border border-white/[0.06] bg-white/[0.02]'}`}>
                      <div className={`px-5 py-3.5 flex items-center justify-between ${isVirt ? 'border-b border-gray-200' : 'border-b border-white/[0.06]'}`}>
                        <h3 className={`text-base font-bold border-l-4 pl-3 ${isVirt ? 'text-whale-dark border-whale-light' : 'text-white border-cyan-400'}`}>전략 시각화</h3>
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${isVirt ? 'bg-blue-50 text-blue-500' : 'bg-cyan-500/10 text-cyan-400'}`}>실시간 차트</span>
                      </div>
                      <div className="p-4">
                        <StrategyChart strategyId={selectedStrategy.id} />
                      </div>
                    </div>
                  )}

                  {/* 이 전략 이해하기 — 초보자 교육 콘텐츠 */}
                  <div className={`rounded-xl p-5 ${isVirt ? 'bg-gradient-to-br from-blue-50/50 to-slate-50 border border-gray-200' : 'bg-white/[0.02] border border-white/[0.06]'}`}>
                    <h3 className={`text-base font-bold mb-4 pb-2 border-l-4 pl-3 ${isVirt ? 'text-whale-dark border-b border-gray-200 border-l-whale-light' : 'text-white border-b border-white/[0.06] border-l-cyan-400'}`}>
                      이 전략 이해하기
                      <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-medium ${isVirt ? 'bg-emerald-100 text-emerald-600' : 'bg-emerald-500/10 text-emerald-400'}`}>초보자 가이드</span>
                    </h3>

                    {/* 전략별 상세 교육 콘텐츠 */}
                    {(() => {
                      const sid = selectedStrategy.id;
                      const hasMACross = selectedStrategy.strategyLogic?.includes('MA') || selectedStrategy.entryConditions?.some(c => c.indicator?.includes('MA_') && c.indicator?.includes('_CROSS_'));
                      const hasRSI = selectedStrategy.entryConditions?.some(c => c.indicator === 'RSI');
                      const hasBollinger = selectedStrategy.entryConditions?.some(c => c.indicator?.includes('BOLLINGER'));
                      const hasMACD = selectedStrategy.entryConditions?.some(c => c.indicator?.includes('MACD'));
                      const hasStochastic = selectedStrategy.entryConditions?.some(c => c.indicator?.includes('STOCH'));

                      if (sid === 'preset-golden-cross' || hasMACross) {
                        return (
                          <div className="space-y-4">
                            <div className="flex items-start gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${isVirt ? 'bg-blue-100' : 'bg-blue-500/10'}`}>
                                <span className="text-base">📈</span>
                              </div>
                              <div>
                                <p className={`text-sm font-semibold mb-1 ${isVirt ? 'text-whale-dark' : 'text-white'}`}>핵심 개념: <Term k="이동평균선">이동평균선</Term>과 <Term k="골든크로스">골든크로스</Term></p>
                                <p className={`text-sm leading-relaxed ${isVirt ? 'text-gray-500' : 'text-slate-400'}`}>
                                  <Term k="이동평균선">이동평균선(MA)</Term>은 일정 기간의 평균 가격을 매일 계산해 선으로 연결한 것입니다.
                                  이 선의 방향이 위를 향하면 상승 추세, 아래를 향하면 하락 추세입니다.
                                </p>
                              </div>
                            </div>
                            <div className={`rounded-lg p-4 ${isVirt ? 'bg-white border border-gray-100' : 'bg-white/[0.03] border border-white/[0.06]'}`}>
                              <p className={`text-xs font-bold mb-2 ${isVirt ? 'text-whale-dark' : 'text-white'}`}>이 전략의 매매 원리</p>
                              <div className="space-y-2">
                                <div className="flex items-start gap-2">
                                  <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-600 text-[10px] font-bold shrink-0 mt-0.5">매수</span>
                                  <p className={`text-xs ${isVirt ? 'text-gray-600' : 'text-slate-400'}`}>단기 평균(20일)이 장기 평균(60일) <Term k="골든크로스">위로 돌파</Term>하면 → 상승 추세 시작으로 판단하고 매수합니다</p>
                                </div>
                                <div className="flex items-start gap-2">
                                  <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 text-[10px] font-bold shrink-0 mt-0.5">매도</span>
                                  <p className={`text-xs ${isVirt ? 'text-gray-600' : 'text-slate-400'}`}>단기 평균(20일)이 장기 평균(60일) <Term k="데드크로스">아래로 돌파</Term>하면 → 하락 추세로 전환되었다고 판단하고 매도합니다</p>
                                </div>
                              </div>
                            </div>
                            <div className={`rounded-lg p-3 ${isVirt ? 'bg-amber-50 border border-amber-200' : 'bg-amber-500/5 border border-amber-500/20'}`}>
                              <p className={`text-xs font-semibold mb-1 ${isVirt ? 'text-amber-700' : 'text-amber-400'}`}>초보자 TIP</p>
                              <p className={`text-xs ${isVirt ? 'text-amber-600' : 'text-amber-400/80'}`}>이 전략은 <Term k="추세추종">추세추종</Term> 전략의 대표격입니다. 큰 상승장에서는 높은 수익을 내지만, 횡보장(가격이 오르락내리락 반복)에서는 잦은 손절이 발생할 수 있습니다. <Term k="MDD">MDD(최대 낙폭)</Term>을 확인하여 내가 감당할 수 있는 수준인지 반드시 체크하세요.</p>
                            </div>
                          </div>
                        );
                      } else if (sid === 'preset-rsi-reversal' || hasRSI) {
                        return (
                          <div className="space-y-4">
                            <div className="flex items-start gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${isVirt ? 'bg-purple-100' : 'bg-purple-500/10'}`}>
                                <span className="text-base">🔄</span>
                              </div>
                              <div>
                                <p className={`text-sm font-semibold mb-1 ${isVirt ? 'text-whale-dark' : 'text-white'}`}>핵심 개념: <Term k="RSI">RSI (상대강도지수)</Term></p>
                                <p className={`text-sm leading-relaxed ${isVirt ? 'text-gray-500' : 'text-slate-400'}`}>
                                  <Term k="RSI">RSI</Term>는 최근 가격의 상승/하락 강도를 0~100 사이의 숫자로 보여줍니다.
                                  마치 "가격 체온계"처럼, 시장이 과열인지 냉각인지를 한눈에 알 수 있습니다.
                                </p>
                              </div>
                            </div>
                            <div className={`rounded-lg p-4 ${isVirt ? 'bg-white border border-gray-100' : 'bg-white/[0.03] border border-white/[0.06]'}`}>
                              <p className={`text-xs font-bold mb-2 ${isVirt ? 'text-whale-dark' : 'text-white'}`}>RSI 수치별 의미</p>
                              <div className="flex items-center gap-1 mb-3">
                                <div className="flex-1 h-3 rounded-l-full bg-gradient-to-r from-blue-500 via-gray-300 to-red-500 relative">
                                  <span className="absolute left-[30%] -translate-x-1/2 -top-4 text-[9px] font-bold text-blue-600">30</span>
                                  <span className="absolute left-[70%] -translate-x-1/2 -top-4 text-[9px] font-bold text-red-600">70</span>
                                </div>
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-center">
                                <div className={`rounded-lg p-2 ${isVirt ? 'bg-blue-50' : 'bg-blue-500/10'}`}>
                                  <p className={`text-[10px] font-bold ${isVirt ? 'text-blue-600' : 'text-blue-400'}`}>0~30</p>
                                  <p className={`text-[10px] ${isVirt ? 'text-blue-500' : 'text-blue-400/80'}`}><Term k="과매도">과매도</Term> 구간</p>
                                  <p className={`text-[9px] mt-0.5 ${isVirt ? 'text-gray-400' : 'text-slate-500'}`}>반등 가능성 ↑</p>
                                </div>
                                <div className={`rounded-lg p-2 ${isVirt ? 'bg-gray-50' : 'bg-white/[0.03]'}`}>
                                  <p className={`text-[10px] font-bold ${isVirt ? 'text-gray-500' : 'text-slate-400'}`}>30~70</p>
                                  <p className={`text-[10px] ${isVirt ? 'text-gray-400' : 'text-slate-500'}`}>중립 구간</p>
                                  <p className={`text-[9px] mt-0.5 ${isVirt ? 'text-gray-400' : 'text-slate-500'}`}>관망</p>
                                </div>
                                <div className={`rounded-lg p-2 ${isVirt ? 'bg-red-50' : 'bg-red-500/10'}`}>
                                  <p className={`text-[10px] font-bold ${isVirt ? 'text-red-600' : 'text-red-400'}`}>70~100</p>
                                  <p className={`text-[10px] ${isVirt ? 'text-red-500' : 'text-red-400/80'}`}><Term k="과매수">과매수</Term> 구간</p>
                                  <p className={`text-[9px] mt-0.5 ${isVirt ? 'text-gray-400' : 'text-slate-500'}`}>조정 가능성 ↑</p>
                                </div>
                              </div>
                            </div>
                            <div className={`rounded-lg p-4 ${isVirt ? 'bg-white border border-gray-100' : 'bg-white/[0.03] border border-white/[0.06]'}`}>
                              <p className={`text-xs font-bold mb-2 ${isVirt ? 'text-whale-dark' : 'text-white'}`}>이 전략의 매매 원리</p>
                              <div className="space-y-2">
                                <div className="flex items-start gap-2">
                                  <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-600 text-[10px] font-bold shrink-0 mt-0.5">매수</span>
                                  <p className={`text-xs ${isVirt ? 'text-gray-600' : 'text-slate-400'}`}>RSI가 30 이하로 떨어지면 → "<Term k="과매도">과매도</Term>" 상태이므로, 곧 반등할 수 있다고 판단하여 매수합니다</p>
                                </div>
                                <div className="flex items-start gap-2">
                                  <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 text-[10px] font-bold shrink-0 mt-0.5">매도</span>
                                  <p className={`text-xs ${isVirt ? 'text-gray-600' : 'text-slate-400'}`}>RSI가 70 이상으로 올라가면 → "<Term k="과매수">과매수</Term>" 상태이므로, 곧 하락할 수 있다고 판단하여 매도합니다</p>
                                </div>
                              </div>
                            </div>
                            <div className={`rounded-lg p-3 ${isVirt ? 'bg-amber-50 border border-amber-200' : 'bg-amber-500/5 border border-amber-500/20'}`}>
                              <p className={`text-xs font-semibold mb-1 ${isVirt ? 'text-amber-700' : 'text-amber-400'}`}>초보자 TIP</p>
                              <p className={`text-xs ${isVirt ? 'text-amber-600' : 'text-amber-400/80'}`}>이것은 <Term k="역추세">역추세(평균회귀)</Term> 전략입니다. "너무 떨어졌으니 오를 것이다"라는 논리인데, 강한 하락 추세에서는 RSI가 30 이하에서도 계속 떨어질 수 있습니다. <Term k="손절">손절</Term> 설정을 반드시 함께 사용하세요.</p>
                            </div>
                          </div>
                        );
                      } else if (sid === 'preset-bollinger-squeeze' || hasBollinger) {
                        return (
                          <div className="space-y-4">
                            <div className="flex items-start gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${isVirt ? 'bg-indigo-100' : 'bg-indigo-500/10'}`}>
                                <span className="text-base">📊</span>
                              </div>
                              <div>
                                <p className={`text-sm font-semibold mb-1 ${isVirt ? 'text-whale-dark' : 'text-white'}`}>핵심 개념: <Term k="볼린저밴드">볼린저 밴드</Term></p>
                                <p className={`text-sm leading-relaxed ${isVirt ? 'text-gray-500' : 'text-slate-400'}`}>
                                  <Term k="볼린저밴드">볼린저 밴드</Term>는 가격의 "정상 범위"를 상단·중심·하단 3개의 띠로 보여줍니다.
                                  마치 고무줄처럼, 가격이 밴드 밖으로 벗어나면 다시 안으로 돌아오려는 성질이 있습니다.
                                </p>
                              </div>
                            </div>
                            <div className={`rounded-lg p-4 ${isVirt ? 'bg-white border border-gray-100' : 'bg-white/[0.03] border border-white/[0.06]'}`}>
                              <p className={`text-xs font-bold mb-2 ${isVirt ? 'text-whale-dark' : 'text-white'}`}>볼린저 밴드 구조</p>
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                  <div className="w-16 h-1 rounded bg-red-300" />
                                  <span className={`text-[10px] ${isVirt ? 'text-gray-600' : 'text-slate-400'}`}><strong>상단 밴드</strong> — 가격이 여기를 넘으면 <Term k="과매수">과매수</Term> (<Term k="%B">%B</Term> {'>'} 1)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-16 h-1 rounded bg-gray-400" />
                                  <span className={`text-[10px] ${isVirt ? 'text-gray-600' : 'text-slate-400'}`}><strong>중심선</strong> — 20일 <Term k="이동평균선">이동평균선</Term> (<Term k="%B">%B</Term> = 0.5)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-16 h-1 rounded bg-blue-300" />
                                  <span className={`text-[10px] ${isVirt ? 'text-gray-600' : 'text-slate-400'}`}><strong>하단 밴드</strong> — 가격이 여기 아래면 <Term k="과매도">과매도</Term> (<Term k="%B">%B</Term> {'<'} 0)</span>
                                </div>
                              </div>
                            </div>
                            <div className={`rounded-lg p-4 ${isVirt ? 'bg-white border border-gray-100' : 'bg-white/[0.03] border border-white/[0.06]'}`}>
                              <p className={`text-xs font-bold mb-2 ${isVirt ? 'text-whale-dark' : 'text-white'}`}>이 전략의 매매 원리</p>
                              <div className="space-y-2">
                                <div className="flex items-start gap-2">
                                  <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-600 text-[10px] font-bold shrink-0 mt-0.5">매수</span>
                                  <p className={`text-xs ${isVirt ? 'text-gray-600' : 'text-slate-400'}`}>가격이 상단 밴드를 돌파하면 → 강한 상승 에너지로 판단, <Term k="변동성">변동성</Term> 확대 구간에서 수익을 노립니다</p>
                                </div>
                                <div className="flex items-start gap-2">
                                  <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 text-[10px] font-bold shrink-0 mt-0.5">매도</span>
                                  <p className={`text-xs ${isVirt ? 'text-gray-600' : 'text-slate-400'}`}>가격이 하단 밴드 아래로 이탈하면 → 상승 에너지 소진으로 판단하고 매도합니다</p>
                                </div>
                              </div>
                            </div>
                            <div className={`rounded-lg p-3 ${isVirt ? 'bg-amber-50 border border-amber-200' : 'bg-amber-500/5 border border-amber-500/20'}`}>
                              <p className={`text-xs font-semibold mb-1 ${isVirt ? 'text-amber-700' : 'text-amber-400'}`}>초보자 TIP</p>
                              <p className={`text-xs ${isVirt ? 'text-amber-600' : 'text-amber-400/80'}`}>밴드가 매우 좁아지는 "스퀴즈" 구간을 주목하세요! 이때 폭발적인 가격 변동이 시작되는 경우가 많습니다. <Term k="백테스트">백테스트</Term>로 과거 스퀴즈 구간의 성과를 확인해보세요.</p>
                            </div>
                          </div>
                        );
                      } else if (sid === 'preset-macd-divergence' || hasMACD) {
                        return (
                          <div className="space-y-4">
                            <div className="flex items-start gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${isVirt ? 'bg-blue-100' : 'bg-blue-500/10'}`}>
                                <span className="text-base">🔀</span>
                              </div>
                              <div>
                                <p className={`text-sm font-semibold mb-1 ${isVirt ? 'text-whale-dark' : 'text-white'}`}>핵심 개념: <Term k="MACD">MACD</Term></p>
                                <p className={`text-sm leading-relaxed ${isVirt ? 'text-gray-500' : 'text-slate-400'}`}>
                                  <Term k="MACD">MACD</Term>는 두 <Term k="이동평균선">이동평균선</Term>의 차이를 분석하여 추세의 방향과 전환 시점을 알려줍니다.
                                  "추세가 바뀌려는 순간"을 잡아내는 데 특화된 지표입니다.
                                </p>
                              </div>
                            </div>
                            <div className={`rounded-lg p-4 ${isVirt ? 'bg-white border border-gray-100' : 'bg-white/[0.03] border border-white/[0.06]'}`}>
                              <p className={`text-xs font-bold mb-2 ${isVirt ? 'text-whale-dark' : 'text-white'}`}>MACD 3가지 구성 요소</p>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                                  <span className="text-xs text-gray-600"><strong>MACD선</strong> — 단기 <Term k="EMA">EMA(12)</Term>와 장기 <Term k="EMA">EMA(26)</Term>의 차이</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full bg-orange-400" />
                                  <span className="text-xs text-gray-600"><strong>시그널선</strong> — MACD선의 9일 <Term k="EMA">EMA</Term> (MACD의 평균)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded bg-gray-300" />
                                  <span className="text-xs text-gray-600"><strong>히스토그램</strong> — MACD선과 시그널선의 차이 (막대 그래프)</span>
                                </div>
                              </div>
                            </div>
                            <div className={`rounded-lg p-4 ${isVirt ? 'bg-white border border-gray-100' : 'bg-white/[0.03] border border-white/[0.06]'}`}>
                              <p className={`text-xs font-bold mb-2 ${isVirt ? 'text-whale-dark' : 'text-white'}`}>이 전략의 매매 원리</p>
                              <div className="space-y-2">
                                <div className="flex items-start gap-2">
                                  <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-600 text-[10px] font-bold shrink-0 mt-0.5">매수</span>
                                  <p className={`text-xs ${isVirt ? 'text-gray-600' : 'text-slate-400'}`}>MACD선이 시그널선을 <Term k="골든크로스">위로 돌파</Term>하면 → 상승 추세 전환 신호로 매수</p>
                                </div>
                                <div className="flex items-start gap-2">
                                  <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 text-[10px] font-bold shrink-0 mt-0.5">매도</span>
                                  <p className={`text-xs ${isVirt ? 'text-gray-600' : 'text-slate-400'}`}>MACD선이 시그널선을 <Term k="데드크로스">아래로 돌파</Term>하면 → 하락 추세 전환 신호로 매도</p>
                                </div>
                              </div>
                            </div>
                            <div className={`rounded-lg p-3 ${isVirt ? 'bg-amber-50 border border-amber-200' : 'bg-amber-500/5 border border-amber-500/20'}`}>
                              <p className={`text-xs font-semibold mb-1 ${isVirt ? 'text-amber-700' : 'text-amber-400'}`}>초보자 TIP</p>
                              <p className={`text-xs ${isVirt ? 'text-amber-600' : 'text-amber-400/80'}`}><Term k="MACD">MACD</Term>는 <Term k="RSI">RSI</Term>와 함께 사용하면 더 정확합니다. MACD가 <Term k="골든크로스">골든크로스</Term>이면서 RSI가 <Term k="과매도">과매도</Term> 구간이면 더 강한 매수 신호로 볼 수 있습니다.</p>
                            </div>
                          </div>
                        );
                      } else if (sid === 'preset-stochastic' || hasStochastic) {
                        return (
                          <div className="space-y-4">
                            <div className="flex items-start gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${isVirt ? 'bg-sky-100' : 'bg-sky-500/10'}`}>
                                <span className="text-base">⚡</span>
                              </div>
                              <div>
                                <p className={`text-sm font-semibold mb-1 ${isVirt ? 'text-whale-dark' : 'text-white'}`}>핵심 개념: <Term k="스토캐스틱">스토캐스틱</Term></p>
                                <p className={`text-sm leading-relaxed ${isVirt ? 'text-gray-500' : 'text-slate-400'}`}>
                                  <Term k="스토캐스틱">스토캐스틱</Term>은 일정 기간의 최고가~최저가 범위에서 현재 가격의 위치를 0~100으로 보여줍니다.
                                  <Term k="RSI">RSI</Term>와 비슷하지만 가격 변화에 더 민감하게 반응합니다.
                                </p>
                              </div>
                            </div>
                            <div className={`rounded-lg p-4 ${isVirt ? 'bg-white border border-gray-100' : 'bg-white/[0.03] border border-white/[0.06]'}`}>
                              <p className={`text-xs font-bold mb-2 ${isVirt ? 'text-whale-dark' : 'text-white'}`}>이 전략의 매매 원리</p>
                              <div className="space-y-2">
                                <div className="flex items-start gap-2">
                                  <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-600 text-[10px] font-bold shrink-0 mt-0.5">매수</span>
                                  <p className={`text-xs ${isVirt ? 'text-gray-600' : 'text-slate-400'}`}>%K선이 %D선을 위로 돌파하면 → 상승 모멘텀 발생으로 매수</p>
                                </div>
                                <div className="flex items-start gap-2">
                                  <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 text-[10px] font-bold shrink-0 mt-0.5">매도</span>
                                  <p className={`text-xs ${isVirt ? 'text-gray-600' : 'text-slate-400'}`}>%K선이 %D선을 아래로 돌파하면 → 하락 모멘텀 발생으로 매도</p>
                                </div>
                              </div>
                            </div>
                            <div className={`rounded-lg p-3 ${isVirt ? 'bg-amber-50 border border-amber-200' : 'bg-amber-500/5 border border-amber-500/20'}`}>
                              <p className={`text-xs font-semibold mb-1 ${isVirt ? 'text-amber-700' : 'text-amber-400'}`}>초보자 TIP</p>
                              <p className={`text-xs ${isVirt ? 'text-amber-600' : 'text-amber-400/80'}`}><Term k="과매도">과매도</Term>(20 이하) 구간에서의 <Term k="골든크로스">골든크로스</Term>가 가장 신뢰도 높은 매수 신호입니다. 반대로 <Term k="과매수">과매수</Term>(80 이상) 구간에서의 <Term k="데드크로스">데드크로스</Term>가 강한 매도 신호입니다.</p>
                            </div>
                          </div>
                        );
                      } else if (sid === 'preset-safe-rebalancing') {
                        return (
                          <div className="space-y-4">
                            <div className="flex items-start gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${isVirt ? 'bg-emerald-100' : 'bg-emerald-500/10'}`}>
                                <span className="text-base">⚖️</span>
                              </div>
                              <div>
                                <p className={`text-sm font-semibold mb-1 ${isVirt ? 'text-whale-dark' : 'text-white'}`}>핵심 개념: 리밸런싱 (자산 재배분)</p>
                                <p className={`text-sm leading-relaxed ${isVirt ? 'text-gray-500' : 'text-slate-400'}`}>
                                  여러 자산에 정해진 비율로 나누어 투자하고, 시간이 지나 비율이 틀어지면 원래 비율로 되돌리는 전략입니다.
                                  "달걀을 한 바구니에 담지 마라"는 분산투자의 원칙을 따릅니다.
                                </p>
                              </div>
                            </div>
                            <div className={`rounded-lg p-4 ${isVirt ? 'bg-white border border-gray-100' : 'bg-white/[0.03] border border-white/[0.06]'}`}>
                              <p className={`text-xs font-bold mb-2 ${isVirt ? 'text-whale-dark' : 'text-white'}`}>목표 자산 배분</p>
                              <div className="flex gap-2">
                                <div className={`flex-[6] rounded-lg p-2 text-center ${isVirt ? 'bg-orange-50' : 'bg-orange-500/10'}`}>
                                  <p className={`text-xs font-bold ${isVirt ? 'text-orange-600' : 'text-orange-400'}`}>BTC 60%</p>
                                  <p className={`text-[9px] ${isVirt ? 'text-orange-400' : 'text-orange-400/60'}`}>핵심 자산</p>
                                </div>
                                <div className={`flex-[3] rounded-lg p-2 text-center ${isVirt ? 'bg-blue-50' : 'bg-blue-500/10'}`}>
                                  <p className={`text-xs font-bold ${isVirt ? 'text-blue-600' : 'text-blue-400'}`}>ETH 30%</p>
                                  <p className={`text-[9px] ${isVirt ? 'text-blue-400' : 'text-blue-400/60'}`}>성장 자산</p>
                                </div>
                                <div className={`flex-[1] rounded-lg p-2 text-center ${isVirt ? 'bg-green-50' : 'bg-green-500/10'}`}>
                                  <p className={`text-xs font-bold ${isVirt ? 'text-green-600' : 'text-green-400'}`}>USDT 10%</p>
                                  <p className={`text-[9px] ${isVirt ? 'text-green-400' : 'text-green-400/60'}`}>안전 자산</p>
                                </div>
                              </div>
                            </div>
                            <div className={`rounded-lg p-3 ${isVirt ? 'bg-amber-50 border border-amber-200' : 'bg-amber-500/5 border border-amber-500/20'}`}>
                              <p className={`text-xs font-semibold mb-1 ${isVirt ? 'text-amber-700' : 'text-amber-400'}`}>초보자 TIP</p>
                              <p className={`text-xs ${isVirt ? 'text-amber-600' : 'text-amber-400/80'}`}>리밸런싱은 가장 안전한 투자 방식 중 하나입니다. 자동으로 "비싸진 건 팔고, 싸진 건 사는" 효과가 있어 장기적으로 안정적인 수익을 기대할 수 있습니다. 투자가 처음이라면 이 전략부터 시작해보세요.</p>
                            </div>
                          </div>
                        );
                      } else {
                        return (
                          <div className="space-y-3">
                            <p className={`text-sm leading-relaxed ${isVirt ? 'text-gray-500' : 'text-slate-400'}`}>
                              {selectedStrategy.description || '이 전략을 백테스트하여 과거 성과를 확인할 수 있습니다.'}
                            </p>
                            <div className={`rounded-lg p-3 ${isVirt ? 'bg-amber-50 border border-amber-200' : 'bg-amber-500/5 border border-amber-500/20'}`}>
                              <p className={`text-xs font-semibold mb-1 ${isVirt ? 'text-amber-700' : 'text-amber-400'}`}>시작하기</p>
                              <p className={`text-xs ${isVirt ? 'text-amber-600' : 'text-amber-400/80'}`}>오른쪽 패널에서 종목과 기간을 선택한 후 <Term k="백테스트">백테스트</Term>를 실행해보세요. 과거 데이터로 이 전략이 얼마나 효과적이었는지 확인할 수 있습니다.</p>
                            </div>
                          </div>
                        );
                      }
                    })()}
                  </div>

                  {/* 사용된 기술 지표 */}
                  {selectedStrategy.indicators && selectedStrategy.indicators.length > 0 && (
                    <div className={`rounded-xl p-5 ${isVirt ? 'bg-gray-50 border border-gray-200' : 'bg-white/[0.02] border border-white/[0.06]'}`}>
                      <h3 className={`text-base font-bold mb-3 pb-2 border-l-4 pl-3 ${isVirt ? 'text-whale-dark border-b border-gray-200 border-l-whale-light' : 'text-white border-b border-white/[0.06] border-l-cyan-400'}`}>사용된 기술 지표</h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedStrategy.indicators.map((ind, i) => {
                          const indGlossary: Record<string, string> = {
                            MA: '이동평균선', EMA: 'EMA', RSI: 'RSI', MACD: 'MACD',
                            BOLLINGER_BANDS: '볼린저밴드', STOCHASTIC: '스토캐스틱', ATR: 'ATR',
                          };
                          const paramLabelsKo: Record<string, Record<string, string>> = {
                            MA: { period: '기간(일)' }, EMA: { period: '기간(일)' }, RSI: { period: '기간(일)' },
                            BOLLINGER_BANDS: { period: '기간(일)', stdDev: '표준편차' },
                            MACD: { fast: '단기', slow: '장기', signal: '시그널' },
                            STOCHASTIC: { kPeriod: '%K 기간', dPeriod: '%D 기간' },
                            ATR: { period: '기간(일)' },
                          };
                          const gKey = indGlossary[ind.type];
                          const pLabels = paramLabelsKo[ind.type] || {};
                          return (
                            <span key={i} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-default ${isVirt ? 'bg-gray-100 text-whale-dark border border-gray-200 hover:border-whale-light/50 hover:bg-whale-light/5' : 'bg-white/[0.04] text-white border border-white/[0.06] hover:border-cyan-400/30 hover:bg-white/[0.06]'}`}>
                              {gKey ? <Term k={gKey}><span className="font-bold">{ind.type}</span></Term> : <span className="font-bold">{ind.type}</span>}
                              <span className={`text-xs ml-1.5 ${isVirt ? 'text-gray-400' : 'text-slate-500'}`}>
                                ({Object.entries(ind.parameters).map(([k, v]) => `${pLabels[k] || k}=${v}`).join(', ')})
                              </span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 투자 대상 자산 */}
                  {selectedStrategy.targetAssets && selectedStrategy.targetAssets.length > 0 && (
                    <div className={`rounded-xl p-5 ${isVirt ? 'bg-gray-50 border border-gray-200' : 'bg-white/[0.02] border border-white/[0.06]'}`}>
                      <h3 className={`text-base font-bold mb-3 pb-2 border-l-4 pl-3 ${isVirt ? 'text-whale-dark border-b border-gray-200 border-l-whale-light' : 'text-white border-b border-white/[0.06] border-l-cyan-400'}`}>항해 대상 ({selectedStrategy.targetAssets.length}개 자산)</h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedStrategy.targetAssets.map(code => (
                          <span key={code} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-default ${isVirt ? 'bg-gray-100 text-whale-dark border border-gray-200 hover:border-whale-light/50 hover:bg-whale-light/5' : 'bg-white/[0.04] text-white border border-white/[0.06] hover:border-cyan-400/30 hover:bg-white/[0.06]'}`}>
                            {selectedStrategy.targetAssetNames?.[code] || getAssetName(code)} <span className={isVirt ? 'text-gray-400' : 'text-slate-500'}>({code})</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* 항로 미선택 — 개요 대시보드 */
                <div className="space-y-5">
                  <div className={`rounded-xl p-8 text-center ${isVirt ? 'bg-gradient-to-br from-whale-light/5 to-blue-50 border border-whale-light/20' : 'bg-white/[0.02] border border-white/[0.06]'}`}>
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${isVirt ? 'bg-whale-light/10' : 'bg-cyan-500/10'}`}>
                      <svg className="w-16 h-16 text-whale-light float-animation" viewBox="0 0 64 64" fill="currentColor">
                        <path d="M32 8c-4 0-8 2-10 6-3 5-2 12 2 16l8 10 8-10c4-4 5-11 2-16-2-4-6-6-10-6zm0 4c2.5 0 5 1.2 6.5 3.8 2 3.5 1.2 8-1.5 11L32 33l-5-6.2c-2.7-3-3.5-7.5-1.5-11C27 13.2 29.5 12 32 12z"/>
                        <path d="M20 40c-2 2-4 6-4 10h32c0-4-2-8-4-10l-6-2h-12l-6 2z" opacity="0.3"/>
                      </svg>
                    </div>
                    <h2 className={`text-xl font-bold mb-2 ${isVirt ? 'text-whale-dark' : 'text-white'}`}>항로를 설정하여 항해를 시작하세요</h2>
                    <p className={`text-sm ${isVirt ? 'text-gray-500' : 'text-slate-400'}`}>왼쪽에서 전략을 선택하면 항로 분석, 학습 영상, 백테스트가 여기에 표시됩니다</p>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className={`rounded-xl p-4 text-center shadow-sm ${isVirt ? 'bg-white border border-gray-100' : 'bg-white/[0.02] border border-white/[0.06]'}`}>
                      <div className={`text-2xl font-bold ${isVirt ? 'text-whale-light' : 'text-cyan-400'}`}>{allStrategies.length}</div>
                      <div className={`text-xs mt-1 ${isVirt ? 'text-gray-400' : 'text-slate-500'}`}>전체 전략</div>
                    </div>
                    <div className={`rounded-xl p-4 text-center shadow-sm ${isVirt ? 'bg-white border border-gray-100' : 'bg-white/[0.02] border border-white/[0.06]'}`}>
                      <div className="text-2xl font-bold text-emerald-500">{PRESET_STRATEGIES.length}</div>
                      <div className={`text-xs mt-1 ${isVirt ? 'text-gray-400' : 'text-slate-500'}`}>기본 제공</div>
                    </div>
                    <div className={`rounded-xl p-4 text-center shadow-sm ${isVirt ? 'bg-white border border-gray-100' : 'bg-white/[0.02] border border-white/[0.06]'}`}>
                      <div className="text-2xl font-bold text-indigo-500">{strategies.length}</div>
                      <div className={`text-xs mt-1 ${isVirt ? 'text-gray-400' : 'text-slate-500'}`}>내 전략</div>
                    </div>
                  </div>
                  <div className={`rounded-xl p-5 shadow-sm ${isVirt ? 'bg-white border border-gray-100' : 'bg-white/[0.02] border border-white/[0.06]'}`}>
                    <h3 className={`text-sm font-bold mb-4 ${isVirt ? 'text-whale-dark' : 'text-white'}`}>빠른 시작 가이드</h3>
                    <div className="space-y-3">
                      {[
                        { step: '1', title: '전략 선택', desc: '왼쪽 목록에서 기본 전략(골든크로스, RSI 등)을 선택하세요. 각 전략에 마우스를 올리면 상세 설명을 볼 수 있습니다.' },
                        { step: '2', title: '종목 & 기간 설정', desc: '오른쪽 패널에서 테스트할 종목(예: 비트코인)과 기간을 설정하세요.' },
                        { step: '3', title: '백테스트 실행', desc: '실행 버튼을 누르면 "이 전략으로 과거에 투자했다면?" 결과가 차트로 표시됩니다.' },
                      ].map((item, idx) => (
                        <div key={item.step} className="flex items-start gap-3 relative">
                          {idx < 2 && <div className="absolute left-[14px] top-7 bottom-0 border-l-2 border-dashed border-whale-light/30" />}
                          <div className={`w-7 h-7 rounded-lg font-bold text-sm flex items-center justify-center shrink-0 relative z-10 ${isVirt ? 'bg-whale-light/10 text-whale-light' : 'bg-cyan-500/10 text-cyan-400'}`}>{item.step}</div>
                          <div>
                            <div className={`text-sm font-semibold ${isVirt ? 'text-whale-dark' : 'text-white'}`}>{item.title}</div>
                            <div className={`text-xs ${isVirt ? 'text-gray-400' : 'text-slate-500'}`}>{item.desc}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* 가이드 체험 버튼 */}
                    <div className={`mt-5 pt-4 ${isVirt ? 'border-t border-gray-100' : 'border-t border-white/[0.06]'}`}>
                      <button
                        onClick={() => {
                          // 1. 골든크로스 전략 선택
                          const goldenCross = allStrategies.find(s => s.id === 'preset-golden-cross');
                          if (goldenCross) {
                            setSelectedStrategy(goldenCross);
                            setBacktestResult(null);
                          }
                          // 2. BTC 종목 선택
                          setBacktestStockCode('BTC');
                          setBacktestStockName('비트코인(BTC)');
                          setBacktestAssetType('CRYPTO');
                          setBacktestSearchQuery('비트코인(BTC)');
                          // 3. 1년 기간 설정
                          const d = new Date(); d.setFullYear(d.getFullYear() - 1);
                          setBacktestStartDate(d.toISOString().slice(0, 10));
                          setBacktestEndDate(new Date().toISOString().slice(0, 10));
                          // 4. 투자금 1천만원
                          setBacktestInitialCapital('10000000');
                        }}
                        className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-whale-light to-blue-500 hover:from-whale-dark hover:to-whale-light shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        가이드 체험 — 골든크로스 × BTC 백테스트
                      </button>
                      <p className={`text-[10px] text-center mt-2 ${isVirt ? 'text-gray-400' : 'text-slate-500'}`}>
                        골든크로스 전략으로 비트코인 1년 백테스트를 자동으로 세팅합니다.
                        <br />오른쪽 패널에서 '백테스트 실행' 버튼만 누르면 됩니다.
                      </p>
                      {(() => {
                        const tourBtnCls = isVirt
                          ? 'group w-full mt-3 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 relative overflow-hidden transition-all duration-200 text-whale-dark bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 hover:border-amber-300 hover:from-amber-100 hover:to-orange-100 hover:shadow-lg'
                          : 'group w-full mt-3 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 relative overflow-hidden transition-all duration-200 text-white bg-amber-600/20 border-2 border-amber-500/30 hover:border-amber-400 hover:bg-amber-600/30 hover:shadow-lg';
                        return (
                          <button onClick={() => setShowTour(true)} className={tourBtnCls}>
                            <span className="relative flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-amber-400 text-white text-xs font-bold flex items-center justify-center animate-pulse">?</span>
                              처음이신가요? 화면 가이드 받기
                            </span>
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )
            ) : (
              /* 백테스트 결과 차트 */
              <div className="space-y-4">
                {/* 테스트 요약 카드 */}
                <div className={`rounded-xl p-4 ${isVirt ? 'bg-gradient-to-r from-slate-50 to-blue-50/50 border border-gray-200' : 'bg-white/[0.02] border border-white/[0.06]'}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isVirt ? 'bg-whale-light/10' : 'bg-cyan-500/10'}`}>
                      <svg className={`w-4 h-4 ${isVirt ? 'text-whale-light' : 'text-cyan-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <h3 className={`text-sm font-bold ${isVirt ? 'text-whale-dark' : 'text-white'}`}>테스트 요약</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className={isVirt ? 'text-gray-400' : 'text-slate-500'}>전략</span>
                      <span className={`font-semibold truncate ml-2 ${isVirt ? 'text-whale-dark' : 'text-white'}`}>{selectedStrategy?.name || '직접 설정'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={isVirt ? 'text-gray-400' : 'text-slate-500'}>종목</span>
                      <span className={`font-semibold ${isVirt ? 'text-whale-dark' : 'text-white'}`}>{backtestStockName || backtestStockCode || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={isVirt ? 'text-gray-400' : 'text-slate-500'}>기간</span>
                      <span className={`font-semibold ${isVirt ? 'text-whale-dark' : 'text-white'}`}>{backtestStartDate?.slice(2).replace(/-/g, '.')} ~ {backtestEndDate?.slice(2).replace(/-/g, '.')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={isVirt ? 'text-gray-400' : 'text-slate-500'}>투자금</span>
                      <span className={`font-semibold ${isVirt ? 'text-whale-dark' : 'text-white'}`}>{Number(backtestInitialCapital).toLocaleString()}원</span>
                    </div>
                    {(stopLossPercent || takeProfitPercent) && (
                      <div className="flex justify-between">
                        <span className={isVirt ? 'text-gray-400' : 'text-slate-500'}><Term k="손절">손절</Term>/<Term k="익절">익절</Term></span>
                        <span className={`font-semibold ${isVirt ? 'text-whale-dark' : 'text-white'}`}>
                          {stopLossPercent ? `${stopLossPercent}%` : '-'} / {takeProfitPercent ? `${takeProfitPercent}%` : '-'}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className={isVirt ? 'text-gray-400' : 'text-slate-500'}>매매방향</span>
                      <span className={`font-semibold ${isVirt ? 'text-whale-dark' : 'text-white'}`}>
                        {tradeDirection === 'LONG_ONLY' ? <Term k="롱">롱</Term> : tradeDirection === 'SHORT_ONLY' ? <Term k="숏">숏</Term> : <><Term k="롱">롱</Term>+<Term k="숏">숏</Term></>}
                      </span>
                    </div>
                    {commissionRate && Number(commissionRate) > 0 && (
                      <div className="flex justify-between">
                        <span className={isVirt ? 'text-gray-400' : 'text-slate-500'}>수수료</span>
                        <span className={`font-semibold ${isVirt ? 'text-whale-dark' : 'text-white'}`}>{commissionRate}%</span>
                      </div>
                    )}
                    {trailingStopPercent && (
                      <div className="flex justify-between">
                        <span className={isVirt ? 'text-gray-400' : 'text-slate-500'}><Term k="트레일링스탑">트레일링</Term></span>
                        <span className={`font-semibold ${isVirt ? 'text-whale-dark' : 'text-white'}`}>{trailingStopPercent}%</span>
                      </div>
                    )}
                  </div>
                  {selectedStrategy?.strategyLogic && (
                    <div className={`mt-3 px-3 py-2 rounded-lg font-mono text-xs shadow-sm ${isVirt ? 'bg-white border border-gray-200 text-whale-dark' : 'bg-white/[0.04] border border-white/[0.06] text-white'}`}>
                      {selectedStrategy.strategyLogic}
                    </div>
                  )}
                </div>

                {/* 핵심 KPI 배너 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: '기대 수익률', glossary: '', value: formatPercent(backtestResult.totalReturnRate), color: backtestResult.totalReturnRate >= 0 ? '#10b981' : '#ef4444', sub: `CAGR ${formatPercent(backtestResult.cagr ?? 0)}`, subGlossary: 'CAGR' },
                    { label: '최대 파고 (MDD)', glossary: 'MDD', value: `${backtestResult.maxDrawdown.toFixed(1)}%`, color: '#f59e0b', sub: `기간 ${backtestResult.maxDrawdownDuration ?? 0}일`, subGlossary: '' },
                    { label: '승률', glossary: '승률', value: `${backtestResult.winRate.toFixed(1)}%`, color: '#60a5fa', sub: `${backtestResult.totalTrades}회 거래`, subGlossary: '' },
                    { label: '샤프 비율', glossary: '샤프비율', value: backtestResult.sharpeRatio.toFixed(2), color: '#a78bfa', sub: backtestResult.sharpeRatio >= 1 ? '양호' : backtestResult.sharpeRatio >= 0.5 ? '보통' : '개선 필요', subGlossary: '' },
                  ].map((kpi, i) => (
                    <div key={i} className="group relative rounded-xl p-3 text-center shadow-sm border transition-all duration-200 hover:shadow-md cursor-help" style={{ backgroundColor: `${kpi.color}08`, borderColor: `${kpi.color}30`, borderTopWidth: '3px', borderTopColor: kpi.color }}>
                      <div className="text-xs mb-1 font-medium" style={{ color: `${kpi.color}cc` }}>
                        {kpi.glossary ? <Term k={kpi.glossary}>{kpi.label}</Term> : kpi.label}
                      </div>
                      <div className="text-lg font-bold" style={{ color: kpi.color }}>{kpi.value}</div>
                      <div className={`text-[10px] mt-0.5 ${isVirt ? 'text-gray-400' : 'text-slate-500'}`}>
                        {kpi.subGlossary ? <Term k={kpi.subGlossary}>{kpi.sub}</Term> : kpi.sub}
                      </div>
                    </div>
                  ))}
                </div>

                {/* 가격 차트 + 매매 마커 */}
                {backtestResult.priceData && backtestResult.priceData.length > 0 && (
                  <div className={`rounded-xl p-4 ${isVirt ? 'bg-gray-50 border border-gray-200' : 'bg-white/[0.02] border border-white/[0.06]'}`}>
                    <h3 className={`text-sm font-bold mb-1 ${isVirt ? 'text-whale-dark' : 'text-white'}`}>가격 차트 & 매매 포인트</h3>
                    <p className={`text-xs mb-3 ${isVirt ? 'text-gray-400' : 'text-slate-500'}`}>빨강 = 매수 / 파랑 = 매도 / 보라 = 숏진입 / 남색 = 숏청산</p>
                    <ResponsiveContainer width="100%" height={260}>
                      <ComposedChart data={(() => {
                        const tradeMap = new Map<string, { type: string; price: number }>();
                        (backtestResult.trades || []).forEach(t => tradeMap.set(t.date, { type: t.type, price: t.price }));
                        return backtestResult.priceData!.map(p => {
                          const t = tradeMap.get(p.date);
                          return {
                            date: p.date,
                            close: p.close,
                            buySignal: t?.type === 'BUY' ? p.close * 0.97 : null,
                            sellSignal: t?.type === 'SELL' ? p.close * 1.03 : null,
                            shortSignal: t?.type === 'SHORT' ? p.close * 1.03 : null,
                            coverSignal: t?.type === 'COVER' ? p.close * 0.97 : null,
                          };
                        });
                      })()}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isVirt ? '#e5e7eb' : 'rgba(255,255,255,0.06)'} />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: isVirt ? '#6b7280' : '#64748b' }} tickFormatter={(v) => v.substring(5)} />
                        <YAxis tick={{ fontSize: 10, fill: isVirt ? '#6b7280' : '#64748b' }} domain={['auto', 'auto']}
                          tickFormatter={(v: number) => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : `${v}`} />
                        <Tooltip contentStyle={isVirt ? { backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8, color: '#1a2b4d', fontSize: 12 } : { backgroundColor: '#0a1628', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, color: '#ffffff', fontSize: 12 }}
                          formatter={(value: number, name: string) => [formatCurrency(value), name === 'buySignal' ? '매수' : name === 'sellSignal' ? '매도' : name === 'shortSignal' ? '숏진입' : name === 'coverSignal' ? '숏청산' : '종가']} />
                        <Line type="monotone" dataKey="close" stroke="#4a90e2" strokeWidth={1.5} dot={false} name="종가" />
                        <Line type="monotone" dataKey="buySignal" stroke="none" dot={{ r: 5, fill: '#ef4444', stroke: '#ef4444' }} name="매수" legendType="triangle" />
                        <Line type="monotone" dataKey="sellSignal" stroke="none" dot={{ r: 5, fill: '#3b82f6', stroke: '#3b82f6' }} name="매도" legendType="triangle" />
                        <Line type="monotone" dataKey="shortSignal" stroke="none" dot={{ r: 5, fill: '#8b5cf6', stroke: '#8b5cf6' }} name="숏진입" legendType="triangle" />
                        <Line type="monotone" dataKey="coverSignal" stroke="none" dot={{ r: 5, fill: '#6366f1', stroke: '#6366f1' }} name="숏청산" legendType="triangle" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* 자산 변동 추이 */}
                {backtestResult.equityCurve && backtestResult.equityCurve.length > 0 && (
                  <div className={`rounded-xl p-4 ${isVirt ? 'bg-gray-50 border border-gray-200' : 'bg-white/[0.02] border border-white/[0.06]'}`}>
                    <h3 className={`text-sm font-bold mb-3 ${isVirt ? 'text-whale-dark' : 'text-white'}`}>
                      자산 변동 추이
                      {backtestResult.buyHoldCurve && <span className={`text-xs font-normal ml-2 ${isVirt ? 'text-gray-400' : 'text-slate-500'}`}>전략 vs Buy & Hold</span>}
                    </h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={(() => {
                        const bhMap = new Map((backtestResult.buyHoldCurve || []).map(p => [p.date, p.value]));
                        return backtestResult.equityCurve.map(p => ({
                          date: p.date,
                          value: p.value,
                          buyHold: bhMap.get(p.date) ?? null,
                        }));
                      })()}>
                        <defs>
                          <linearGradient id="colorEquityLight" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4a90e2" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#4a90e2" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={isVirt ? '#e5e7eb' : 'rgba(255,255,255,0.06)'} />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: isVirt ? '#6b7280' : '#64748b' }} tickFormatter={(v) => v.substring(5)} />
                        <YAxis tick={{ fontSize: 10, fill: isVirt ? '#6b7280' : '#64748b' }} tickFormatter={(v: number) => v >= 1e8 ? `${(v / 1e8).toFixed(1)}억` : v >= 1e4 ? `${(v / 1e4).toFixed(0)}만` : `${v}`} />
                        <Tooltip contentStyle={isVirt ? { backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8, color: '#1a2b4d', fontSize: 12 } : { backgroundColor: '#0a1628', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, color: '#ffffff', fontSize: 12 }}
                          formatter={(value: number, name: string) => [formatCurrency(value), name === 'buyHold' ? 'Buy & Hold' : '전략']} />
                        <ReferenceLine y={backtestResult.initialCapital} stroke="#9ca3af" strokeDasharray="5 5" />
                        <Area type="monotone" dataKey="value" stroke="#4a90e2" fillOpacity={1} fill="url(#colorEquityLight)" strokeWidth={2} name="전략" />
                        {backtestResult.buyHoldCurve && (
                          <Area type="monotone" dataKey="buyHold" stroke="#f59e0b" fill="none" strokeWidth={1.5} strokeDasharray="6 3" name="buyHold" dot={false} />
                        )}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* 상세 지표 그리드 */}
                <div className={`rounded-xl p-4 ${isVirt ? 'bg-gray-50 border border-gray-200' : 'bg-white/[0.02] border border-white/[0.06]'}`}>
                  <h3 className={`text-sm font-bold mb-3 ${isVirt ? 'text-whale-dark' : 'text-white'}`}>상세 성과 지표</h3>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {[
                      { label: '총 수익률', value: formatPercent(backtestResult.totalReturnRate), glossary: '' },
                      { label: '최종 자산', value: formatCurrency(backtestResult.finalValue), glossary: '' },
                      { label: 'CAGR', value: formatPercent(backtestResult.cagr ?? 0), glossary: 'CAGR' },
                      { label: 'Profit Factor', value: (backtestResult.profitFactor ?? 0).toFixed(2), glossary: 'ProfitFactor' },
                      { label: '소르티노', value: (backtestResult.sortinoRatio ?? 0).toFixed(2), glossary: '소르티노' },
                      { label: '평균 보유', value: `${(backtestResult.avgHoldingDays ?? 0).toFixed(1)}일`, glossary: '평균보유' },
                      { label: '수익 거래', value: `${backtestResult.profitableTrades}회`, glossary: '' },
                      { label: '손실 거래', value: `${backtestResult.losingTrades}회`, glossary: '' },
                    ].map((item, i) => (
                      <div key={i} className={`p-2.5 rounded-lg text-center shadow-sm ${isVirt ? 'bg-white border border-gray-100' : 'bg-white/[0.03] border border-white/[0.06]'}`}>
                        <div className={`text-xs mb-0.5 ${isVirt ? 'text-gray-400' : 'text-slate-500'}`}>{item.glossary ? <Term k={item.glossary}>{item.label}</Term> : item.label}</div>
                        <div className={`text-sm font-bold ${isVirt ? 'text-whale-dark' : 'text-white'}`}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 거래 내역 테이블 (간소화) */}
                {backtestResult.trades && backtestResult.trades.length > 0 && (
                  <div className={`rounded-xl p-4 ${isVirt ? 'bg-gray-50 border border-gray-200' : 'bg-white/[0.02] border border-white/[0.06]'}`}>
                    <h3 className={`text-sm font-bold mb-3 ${isVirt ? 'text-whale-dark' : 'text-white'}`}>거래 내역 ({backtestResult.trades.length}건)</h3>
                    <div className="overflow-x-auto max-h-48">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className={isVirt ? 'border-b border-gray-200' : 'border-b border-white/[0.06]'}>
                            {['날짜','구분','가격','손익','수익률','사유'].map(h => (
                              <th key={h} className={`py-2 px-2 text-left font-semibold ${isVirt ? 'text-gray-400' : 'text-slate-500'}`}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {backtestResult.trades.map((trade, idx) => {
                            const isEntry = trade.type === 'BUY' || trade.type === 'SHORT';
                            const isExit = trade.type === 'SELL' || trade.type === 'COVER';
                            return (
                              <tr key={idx} className={isVirt ? 'border-b border-gray-100' : 'border-b border-white/[0.04]'}>
                                <td className={`py-1.5 px-2 font-mono ${isVirt ? 'text-whale-dark' : 'text-white'}`}>{trade.date}</td>
                                <td className="py-1.5 px-2">
                                  <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                                    trade.type === 'BUY' ? 'bg-red-100 text-red-600' :
                                    trade.type === 'SHORT' ? 'bg-purple-100 text-purple-600' :
                                    trade.type === 'COVER' ? 'bg-indigo-100 text-indigo-600' :
                                    'bg-blue-100 text-blue-600'
                                  }`}>
                                    {trade.type === 'BUY' ? '매수' : trade.type === 'SHORT' ? '숏진입' : trade.type === 'COVER' ? '숏청산' : '매도'}
                                  </span>
                                </td>
                                <td className={`py-1.5 px-2 font-mono ${isVirt ? 'text-whale-dark' : 'text-white'}`}>{formatCurrency(trade.price)}</td>
                                <td className={`py-1.5 px-2 font-bold font-mono ${isEntry ? 'text-slate-600' : trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {isExit ? formatCurrency(Math.round(trade.pnl)) : '-'}
                                </td>
                                <td className={`py-1.5 px-2 font-bold ${isEntry ? 'text-slate-600' : (trade.pnlPercent ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {isExit ? `${(trade.pnlPercent ?? 0) >= 0 ? '+' : ''}${(trade.pnlPercent ?? 0).toFixed(2)}%` : '-'}
                                </td>
                                <td className={`py-1.5 px-2 max-w-[120px] truncate ${isVirt ? 'text-gray-400' : 'text-slate-500'}`}>{trade.reason}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className={`mt-4 p-3 rounded-lg ${isVirt ? 'bg-amber-50 border border-amber-200' : 'bg-amber-500/5 border border-amber-500/20'}`}>
                  <p className={`text-[11px] leading-relaxed text-center ${isVirt ? 'text-amber-700' : 'text-amber-400/80'}`}>
                    본 백테스트 결과는 과거 데이터를 기반으로 한 시뮬레이션이며, 미래 수익을 보장하지 않습니다.
                    실제 투자 시 슬리피지, 수수료, 시장 충격 등으로 결과가 달라질 수 있습니다. 투자 판단의 최종 책임은 본인에게 있습니다.
                  </p>
                </div>

                <div className="flex justify-center gap-3 pt-2">
                  <button
                    onClick={() => exportBacktestCsv(backtestResult)}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm ${isVirt ? 'text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100' : 'text-emerald-400 bg-emerald-500/[0.06] border border-emerald-500/20 hover:bg-emerald-500/[0.12]'}`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    CSV 다운로드
                  </button>
                  <button
                    onClick={() => setBacktestResult(null)}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm ${isVirt ? 'text-whale-dark bg-white border border-gray-200 hover:border-whale-light hover:bg-whale-light/[0.05]' : 'text-white bg-white/[0.04] border border-white/[0.06] hover:border-cyan-400/[0.3] hover:bg-white/[0.06]'}`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    전략 상세로 돌아가기
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 하단 태그/설명 바 */}
          {selectedStrategy && (
            <div className="px-6 pb-5">
              <div className={`rounded-xl p-4 flex flex-wrap items-center gap-3 ${isVirt ? 'bg-gray-50 border border-gray-200' : 'bg-white/[0.02] border border-white/[0.06]'}`}>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                  <span className={`font-bold truncate ${isVirt ? 'text-whale-dark' : 'text-white'}`}>{selectedStrategy.name}</span>
                  {selectedStrategy.applied && <span className={`px-2 py-0.5 rounded-full text-xs ${isVirt ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/10 text-emerald-400'}`}>적용됨</span>}
                </div>
                {selectedStrategy.assetType && (
                  <span className={`px-2 py-1 rounded-lg text-xs font-medium shrink-0 ${
                    selectedStrategy.assetType === 'CRYPTO' ? (isVirt ? 'bg-orange-100 text-orange-700' : 'bg-orange-500/10 text-orange-400') :
                    selectedStrategy.assetType === 'STOCK' ? (isVirt ? 'bg-indigo-100 text-indigo-700' : 'bg-indigo-500/10 text-indigo-400') :
                    (isVirt ? 'bg-purple-100 text-purple-700' : 'bg-purple-500/10 text-purple-400')
                  }`}>
                    {assetTypeLabel(selectedStrategy.assetType)}
                  </span>
                )}
                {selectedStrategy.targetAssets && selectedStrategy.targetAssets.slice(0, 4).map(code => (
                  <span key={code} className={`px-2 py-1 rounded-lg text-xs shrink-0 ${isVirt ? 'bg-gray-100 text-whale-dark' : 'bg-white/[0.04] text-white'}`}>
                    {selectedStrategy.targetAssetNames?.[code] || getAssetName(code)}
                  </span>
                ))}
                {selectedStrategy.targetAssets && selectedStrategy.targetAssets.length > 4 && (
                  <span className={`text-xs shrink-0 ${isVirt ? 'text-gray-400' : 'text-slate-500'}`}>+{selectedStrategy.targetAssets.length - 4}</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ===== RIGHT PANEL: 백테스트 실행 ===== */}
        <div className={`lg:flex-[2.5] flex flex-col min-w-0 shadow-sm ${isVirt ? 'bg-white border-l border-gray-200' : 'bg-white/[0.01] border-l border-white/[0.06]'}`}>
          <div className={`relative px-5 py-4 border-b shrink-0 h-[72px] flex items-center ${isVirt ? 'border-gray-200 bg-gradient-to-r from-whale-dark to-whale-light' : 'border-white/[0.06] bg-gradient-to-r from-whale-dark to-whale-light'}`}>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-white"><Term k="백테스트" className="!text-white [&_.border-b]:border-white/60 [&_svg]:text-white/50">백테스트 실행</Term></h2>
                {selectedStrategy && (
                  <p className="text-xs text-white/60 mt-0.5 truncate">— {selectedStrategy.name}</p>
                )}
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 overflow-hidden" style={{ height: '6px' }}>
              <svg viewBox="0 0 1200 20" preserveAspectRatio="none" className="w-full h-full">
                <path d="M0,10 C150,20 350,0 500,10 C650,20 850,0 1000,10 C1100,15 1150,5 1200,10 L1200,20 L0,20 Z" fill={isVirt ? 'white' : '#060d18'} />
              </svg>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

            {/* 선택된 전략 표시 */}
            {selectedStrategy ? (
              <div className={`px-3 py-2.5 rounded-xl border-l-4 ${isVirt ? 'bg-whale-light/5 border border-whale-light/20 border-l-whale-light' : 'bg-white/[0.03] border border-white/[0.06] border-l-cyan-400'}`}>
                <p className={`text-sm font-semibold ${isVirt ? 'text-whale-dark' : 'text-white'}`}>{selectedStrategy.name}</p>
                <p className={`text-xs mt-1 ${isVirt ? 'text-gray-400' : 'text-slate-500'}`}>
                  진입 {selectedStrategy.entryConditions?.length || 0}개 · 청산 {selectedStrategy.exitConditions?.length || 0}개 조건
                </p>
              </div>
            ) : (
              <div className={`px-3 py-2.5 rounded-xl ${isVirt ? 'bg-gray-50 border border-gray-200' : 'bg-white/[0.02] border border-white/[0.06]'}`}>
                <p className={`text-sm ${isVirt ? 'text-gray-400' : 'text-slate-500'}`}>왼쪽 라이브러리에서 전략을 선택하세요</p>
              </div>
            )}

            {/* 종목 검색 */}
            <div data-tour="stock-search" className="relative">
              <label className={`block text-xs font-semibold mb-1.5 ${isVirt ? 'text-gray-500' : 'text-slate-400'}`}>종목 검색</label>

              {/* 항로 자산 바로가기 */}
              {selectedStrategy?.targetAssets && selectedStrategy.targetAssets.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {selectedStrategy.targetAssets.map((assetCode) => {
                    const assetName = selectedStrategy.targetAssetNames?.[assetCode] || assetCode;
                    const isStock = /^\d{6}$/.test(assetCode);
                    const isSel = backtestStockCode === assetCode;
                    return (
                      <button key={assetCode} type="button"
                        onClick={() => handleBacktestStockSelect(assetCode, assetName, isStock ? 'STOCK' : 'CRYPTO')}
                        className={`px-2 py-1 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1 border ${isSel ? 'bg-gradient-to-r from-whale-light to-blue-500 text-white border-whale-light shadow-md' : isVirt ? 'bg-gray-50 text-gray-600 border-gray-200 hover:border-whale-light hover:shadow-sm hover:shadow-whale-light/20' : 'bg-white/[0.03] text-slate-400 border-white/[0.06] hover:border-cyan-400/30 hover:bg-white/[0.05]'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isStock ? 'bg-indigo-400' : 'bg-emerald-400'}`} />
                        {assetName}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="relative">
                <input type="text" value={backtestSearchQuery} onChange={(e) => handleBacktestSearch(e.target.value)}
                  onFocus={() => { if (backtestSearchResults.length > 0) setShowBacktestDropdown(true); }}
                  className={`w-full px-3 py-2.5 rounded-xl text-sm pr-8 focus:ring-2 focus:ring-whale-light focus:border-whale-light ${isVirt ? 'bg-gray-50 border border-gray-200 text-gray-800' : 'bg-white/[0.04] border border-white/10 text-white placeholder-slate-600'}`}
                  placeholder="BTC, 삼성전자, AAPL..." />
                {isBacktestSearching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-whale-light border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {!isBacktestSearching && backtestStockCode && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
              {backtestStockCode && (
                <div className={`mt-1.5 inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs ${isVirt ? 'bg-gray-100 border border-gray-200' : 'bg-white/[0.04] border border-white/[0.06]'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${backtestAssetType === 'STOCK' ? 'bg-indigo-400' : 'bg-emerald-400'}`} />
                  <span className={`font-medium ${isVirt ? 'text-whale-dark' : 'text-white'}`}>{backtestStockName}</span>
                  <span className={isVirt ? 'text-gray-400' : 'text-slate-500'}>({backtestStockCode})</span>
                </div>
              )}
              {showBacktestDropdown && backtestSearchResults.length > 0 && (
                <div className={`absolute z-20 w-full mt-1 rounded-xl shadow-xl max-h-48 overflow-y-auto ${isVirt ? 'bg-white border border-gray-200' : 'bg-[#0a1628] border border-white/[0.06]'}`}>
                  {backtestSearchResults.map((r) => (
                    <button key={`${r.market}-${r.code}`} type="button"
                      onClick={() => handleBacktestStockSelect(r.code, r.name, r.market)}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between last:border-0 ${isVirt ? 'hover:bg-gray-50 border-b border-gray-100 text-gray-800' : 'hover:bg-white/[0.03] border-b border-white/[0.04] text-white'}`}>
                      <span>{r.name} <span className={isVirt ? 'text-gray-400' : 'text-slate-500'}>({r.code})</span></span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${r.market === 'STOCK' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
                        {r.market === 'STOCK' ? '주식' : '코인'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 기간 빠른 선택 */}
            <div data-tour="period-select">
              <label className={`block text-[10px] font-semibold mb-1.5 ${isVirt ? 'text-gray-500' : 'text-slate-400'}`}>분석 기간</label>
              <div className="flex gap-1.5 mb-2">
                {[
                  { label: '6개월', months: 6 },
                  { label: '1년', months: 12 },
                  { label: '2년', months: 24 },
                  { label: '3년', months: 36 },
                  { label: '5년', months: 60 },
                ].map(({ label, months }) => {
                  const d = new Date(); d.setMonth(d.getMonth() - months);
                  const start = d.toISOString().slice(0, 10);
                  const isActive = backtestStartDate === start;
                  return (
                    <button key={label} onClick={() => { setBacktestStartDate(start); setBacktestEndDate(new Date().toISOString().slice(0, 10)); }}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-medium transition-all border ${isActive ? 'bg-whale-light text-white border-whale-light' : isVirt ? 'bg-white text-gray-500 border-gray-200 hover:border-whale-light hover:text-whale-light' : 'bg-white/[0.03] text-slate-500 border-white/[0.06] hover:border-cyan-400/30 hover:text-cyan-400'}`}>
                      {label}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className={`block text-[10px] font-semibold mb-1 ${isVirt ? 'text-gray-400' : 'text-slate-500'}`}>시작일</label>
                  <DatePicker
                    selected={backtestStartDate ? new Date(backtestStartDate + 'T00:00:00') : null}
                    onChange={(date: Date | null) => date && setBacktestStartDate(date.toISOString().slice(0, 10))}
                    maxDate={backtestEndDate ? new Date(backtestEndDate + 'T00:00:00') : undefined}
                    dateFormat="yyyy.MM.dd"
                    className={`w-full px-3 py-2 rounded-lg text-xs focus:ring-2 focus:ring-whale-light focus:border-whale-light transition-all cursor-pointer ${isVirt ? 'bg-white border border-gray-200 text-gray-800' : 'bg-white/[0.04] border border-white/10 text-white'}`}
                    calendarClassName="whale-datepicker"
                    showMonthDropdown
                    showYearDropdown
                    dropdownMode="select"
                  />
                </div>
                <span className={`text-xs mt-4 ${isVirt ? 'text-gray-300' : 'text-slate-600'}`}>~</span>
                <div className="flex-1">
                  <label className={`block text-[10px] font-semibold mb-1 ${isVirt ? 'text-gray-400' : 'text-slate-500'}`}>종료일</label>
                  <DatePicker
                    selected={backtestEndDate ? new Date(backtestEndDate + 'T00:00:00') : null}
                    onChange={(date: Date | null) => date && setBacktestEndDate(date.toISOString().slice(0, 10))}
                    minDate={backtestStartDate ? new Date(backtestStartDate + 'T00:00:00') : undefined}
                    maxDate={new Date()}
                    dateFormat="yyyy.MM.dd"
                    className={`w-full px-3 py-2 rounded-lg text-xs focus:ring-2 focus:ring-whale-light focus:border-whale-light transition-all cursor-pointer ${isVirt ? 'bg-white border border-gray-200 text-gray-800' : 'bg-white/[0.04] border border-white/10 text-white'}`}
                    calendarClassName="whale-datepicker"
                    showMonthDropdown
                    showYearDropdown
                    dropdownMode="select"
                  />
                </div>
              </div>
            </div>

            {/* 초기 투자금 */}
            <div data-tour="initial-capital">
              <label className={`block text-[10px] font-semibold mb-1.5 ${isVirt ? 'text-gray-500' : 'text-slate-400'}`}>초기 투자금</label>
              <input type="number" value={backtestInitialCapital} onChange={(e) => setBacktestInitialCapital(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg text-xs focus:ring-2 focus:ring-whale-light focus:border-whale-light transition-all ${isVirt ? 'bg-white border border-gray-200 text-gray-800' : 'bg-white/[0.04] border border-white/10 text-white placeholder-slate-600'}`}
                placeholder="10,000,000" />
            </div>

            {/* 초기 자본 빠른 버튼 */}
            <div className="flex flex-wrap gap-1.5">
              {[1000000, 5000000, 10000000, 50000000].map(v => (
                <button key={v} onClick={() => setBacktestInitialCapital(String(v))}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all duration-200 border ${backtestInitialCapital === String(v) ? 'bg-gradient-to-r from-whale-light to-blue-500 text-white border-whale-light shadow-sm' : isVirt ? 'bg-white text-gray-600 border-gray-200 hover:border-whale-light hover:bg-whale-light/5' : 'bg-white/[0.03] text-slate-400 border-white/[0.06] hover:border-cyan-400/30 hover:bg-white/[0.05]'}`}>
                  {v >= 1e8 ? `${v/1e8}억` : `${v/1e4}만`}
                </button>
              ))}
            </div>

            {/* 고급 설정 (접이식) */}
            <div data-tour="advanced-settings" className={`rounded-xl overflow-hidden ${isVirt ? 'border border-gray-200' : 'border border-white/[0.06]'}`}>
              <button onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold transition-colors ${showAdvancedSettings ? (isVirt ? 'bg-gray-100 text-whale-dark' : 'bg-white/[0.04] text-white') : (isVirt ? 'bg-white text-gray-500 hover:bg-gray-50' : 'bg-white/[0.02] text-slate-400 hover:bg-white/[0.03]')}`}>
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  고급 설정
                </span>
                <svg className={`w-3.5 h-3.5 transition-transform ${showAdvancedSettings ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showAdvancedSettings && (
                <div className={`px-4 pb-4 pt-3 space-y-3 ${isVirt ? 'bg-gray-50' : 'bg-white/[0.02]'}`}>

                  {/* ── 매매 조건 편집 ── */}
                  {selectedStrategy && editableIndicators.length > 0 && (
                    <>
                      <p className={`text-xs font-bold ${isVirt ? 'text-whale-dark' : 'text-white'}`}>지표 파라미터</p>
                      <div className="grid grid-cols-2 gap-2">
                        {editableIndicators.map((ind, idx) => {
                          const paramLabels: Record<string, Record<string, string>> = {
                            MA: { period: '이동평균 기간' },
                            EMA: { period: 'EMA 기간' },
                            RSI: { period: 'RSI 기간' },
                            BOLLINGER_BANDS: { period: '볼린저 기간', stdDev: '표준편차 배수' },
                            MACD: { fast: '단기 EMA', slow: '장기 EMA', signal: '시그널' },
                            STOCHASTIC: { kPeriod: '%K 기간', dPeriod: '%D 기간' },
                            ATR: { period: 'ATR 기간' },
                            CCI: { period: 'CCI 기간' },
                          };
                          // 같은 타입 지표가 여러 개면 순서로 구분 (e.g. 단기MA / 장기MA)
                          const sameTypeCount = editableIndicators.filter(i => i.type === ind.type).length;
                          const sameTypeIdx = editableIndicators.slice(0, idx).filter(i => i.type === ind.type).length;
                          const prefix = sameTypeCount > 1 ? (sameTypeIdx === 0 ? '단기 ' : '장기 ') : '';
                          const labels = paramLabels[ind.type] || {};
                          return Object.entries(ind.parameters).map(([key, val]) => (
                            <div key={`${idx}-${key}`}>
                              <label className={`block text-xs font-semibold mb-1 ${isVirt ? 'text-gray-500' : 'text-slate-400'}`}>
                                {prefix}{labels[key] || `${ind.type} ${key}`}
                              </label>
                              <input type="number" value={val}
                                onChange={(e) => {
                                  const next = [...editableIndicators];
                                  next[idx] = { ...next[idx], parameters: { ...next[idx].parameters, [key]: Number(e.target.value) } };
                                  setEditableIndicators(next);
                                }}
                                className={`w-full px-2 py-1.5 rounded-lg text-xs ${isVirt ? 'bg-white border border-gray-200 text-gray-800' : 'bg-white/[0.04] border border-white/10 text-white'}`} />
                            </div>
                          ));
                        })}
                      </div>
                    </>
                  )}

                  {/* ── 진입/청산 기준값 편집 ── */}
                  {selectedStrategy && (editableEntryConditions.some(c => c.value !== 0) || editableExitConditions.some(c => c.value !== 0)) && (
                    <>
                      <p className={`text-xs font-bold mt-2 ${isVirt ? 'text-whale-dark' : 'text-white'}`}>매매 기준값</p>
                      <div className="grid grid-cols-2 gap-2">
                        {editableEntryConditions.map((c, idx) => {
                          if (c.value === 0) return null;
                          const condLabels: Record<string, string> = {
                            RSI: 'RSI 매수 기준',
                            BOLLINGER_PCT_B: '%B 매수 기준',
                            STOCH_K: '%K 매수 기준',
                          };
                          return (
                            <div key={`entry-${idx}`}>
                              <label className={`block text-xs font-semibold mb-1 ${isVirt ? 'text-gray-500' : 'text-slate-400'}`}>
                                {condLabels[c.indicator || ''] || `진입 ${c.indicator}`}
                              </label>
                              <input type="number" value={c.value}
                                onChange={(e) => {
                                  const next = [...editableEntryConditions];
                                  next[idx] = { ...next[idx], value: Number(e.target.value) };
                                  setEditableEntryConditions(next);
                                }}
                                className={`w-full px-2 py-1.5 rounded-lg text-xs ${isVirt ? 'bg-white border border-gray-200 text-gray-800' : 'bg-white/[0.04] border border-white/10 text-white'}`} />
                            </div>
                          );
                        })}
                        {editableExitConditions.map((c, idx) => {
                          if (c.value === 0) return null;
                          const condLabels: Record<string, string> = {
                            RSI: 'RSI 매도 기준',
                            BOLLINGER_PCT_B: '%B 매도 기준',
                            STOCH_K: '%K 매도 기준',
                          };
                          return (
                            <div key={`exit-${idx}`}>
                              <label className={`block text-xs font-semibold mb-1 ${isVirt ? 'text-gray-500' : 'text-slate-400'}`}>
                                {condLabels[c.indicator || ''] || `청산 ${c.indicator}`}
                              </label>
                              <input type="number" value={c.value}
                                onChange={(e) => {
                                  const next = [...editableExitConditions];
                                  next[idx] = { ...next[idx], value: Number(e.target.value) };
                                  setEditableExitConditions(next);
                                }}
                                className={`w-full px-2 py-1.5 rounded-lg text-xs ${isVirt ? 'bg-white border border-gray-200 text-gray-800' : 'bg-white/[0.04] border border-white/10 text-white'}`} />
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {selectedStrategy && editableIndicators.length > 0 && (
                    <div className={`pt-3 ${isVirt ? 'border-t border-gray-200' : 'border-t border-white/[0.06]'}`} />
                  )}

                  {/* ── 리스크 관리 ── */}
                  <p className={`text-xs font-bold ${isVirt ? 'text-whale-dark' : 'text-white'}`}>리스크 관리</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: '손절 (%)', glossary: '손절', value: stopLossPercent, setter: setStopLossPercent, placeholder: '5' },
                      { label: '익절 (%)', glossary: '익절', value: takeProfitPercent, setter: setTakeProfitPercent, placeholder: '10' },
                      { label: '트레일링 (%)', glossary: '트레일링스탑', value: trailingStopPercent, setter: setTrailingStopPercent, placeholder: '5' },
                      { label: '슬리피지 (%)', glossary: '슬리피지', value: slippagePercent, setter: setSlippagePercent, placeholder: '0.1' },
                    ].map(({ label, glossary, value, setter, placeholder }) => (
                      <div key={label}>
                        <label className={`block text-xs font-semibold mb-1 ${isVirt ? 'text-gray-500' : 'text-slate-400'}`}><Term k={glossary}>{label}</Term></label>
                        <input type="number" value={value} onChange={(e) => setter(e.target.value)} placeholder={placeholder}
                          className={`w-full px-2 py-1.5 rounded-lg text-xs ${isVirt ? 'bg-white border border-gray-200 text-gray-800' : 'bg-white/[0.04] border border-white/10 text-white'}`} />
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={`block text-xs font-semibold mb-1 ${isVirt ? 'text-gray-500' : 'text-slate-400'}`}>매매 방향</label>
                      <select value={tradeDirection} onChange={(e) => setTradeDirection(e.target.value as any)}
                        className={`w-full px-2 py-1.5 rounded-lg text-xs ${isVirt ? 'bg-white border border-gray-200 text-gray-800' : 'bg-white/[0.04] border border-white/10 text-white'}`}>
                        <option value="LONG_ONLY">롱 (매수만)</option>
                        <option value="SHORT_ONLY">숏 (공매도만)</option>
                        <option value="LONG_SHORT">롱+숏</option>
                      </select>
                      <p className={`text-[9px] mt-0.5 ${isVirt ? 'text-gray-400' : 'text-slate-500'}`}><Term k="롱">롱</Term>=가격 상승에 베팅 / <Term k="숏">숏</Term>=가격 하락에 베팅</p>
                    </div>
                    <div>
                      <label className={`block text-xs font-semibold mb-1 ${isVirt ? 'text-gray-500' : 'text-slate-400'}`}><Term k="수수료">수수료율 (%)</Term></label>
                      <input type="number" value={commissionRate} onChange={(e) => setCommissionRate(e.target.value)} placeholder="0.1"
                        className={`w-full px-2 py-1.5 rounded-lg text-xs ${isVirt ? 'bg-white border border-gray-200 text-gray-800' : 'bg-white/[0.04] border border-white/10 text-white'}`} />
                    </div>
                  </div>

                  {/* ── 커스텀 수식 조건 (선택) ── */}
                  <div className={`pt-3 ${isVirt ? 'border-t border-gray-200' : 'border-t border-white/[0.06]'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <p className={`text-xs font-bold ${isVirt ? 'text-whale-dark' : 'text-white'}`}><Term k="수식조건">수식 조건</Term> (선택)</p>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${isVirt ? 'bg-amber-50 text-amber-600' : 'bg-amber-500/10 text-amber-400'}`}>고급</span>
                    </div>
                    <p className={`text-[10px] mb-2 leading-relaxed ${isVirt ? 'text-gray-400' : 'text-slate-500'}`}>
                      숫자 대신 수식으로 비교값을 설정합니다. 전략에 이미 조건이 있으면 무시됩니다.
                    </p>
                    <div className="space-y-2">
                      <div>
                        <label className={`block text-[10px] font-semibold mb-1 ${isVirt ? 'text-gray-500' : 'text-slate-400'}`}>매수 조건 — 지표</label>
                        <select
                          value={directEntryConditions[0]?.indicator || ''}
                          onChange={(e) => {
                            if (!e.target.value) { setDirectEntryConditions([]); return; }
                            setDirectEntryConditions([{ indicator: e.target.value, operator: 'GT', value: 0, logic: 'AND', valueExpression: directEntryConditions[0]?.valueExpression || '' }]);
                          }}
                          className={`w-full px-2 py-1.5 rounded-lg text-xs ${isVirt ? 'bg-white border border-gray-200 text-gray-800' : 'bg-white/[0.04] border border-white/10 text-white'}`}>
                          <option value="">사용 안 함</option>
                          <option value="CLOSE">종가 (CLOSE)</option>
                          <option value="HIGH">고가 (HIGH)</option>
                          <option value="RSI">RSI</option>
                          <option value="MACD">MACD</option>
                          <option value="BOLLINGER_PCT_B">볼린저 %B</option>
                          <option value="CCI">CCI</option>
                        </select>
                      </div>
                      {directEntryConditions.length > 0 && (
                        <>
                          <div className="flex items-center gap-1.5">
                            <select
                              value={directEntryConditions[0]?.operator || 'GT'}
                              onChange={(e) => {
                                const next = [...directEntryConditions];
                                next[0] = { ...next[0], operator: e.target.value as any };
                                setDirectEntryConditions(next);
                              }}
                              className={`w-16 px-1.5 py-1.5 rounded-lg text-xs ${isVirt ? 'bg-white border border-gray-200 text-gray-800' : 'bg-white/[0.04] border border-white/10 text-white'}`}>
                              <option value="GT">&gt;</option>
                              <option value="GTE">&ge;</option>
                              <option value="LT">&lt;</option>
                              <option value="LTE">&le;</option>
                            </select>
                            <input
                              type="text"
                              value={directEntryConditions[0]?.valueExpression || ''}
                              onChange={(e) => {
                                const next = [...directEntryConditions];
                                next[0] = { ...next[0], valueExpression: e.target.value, value: 0 };
                                setDirectEntryConditions(next);
                              }}
                              placeholder="OPEN + (PREV_HIGH - PREV_LOW) * 0.5"
                              className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-mono ${isVirt ? 'bg-white border border-gray-200 text-gray-800' : 'bg-white/[0.04] border border-white/10 text-white'}`} />
                          </div>
                        </>
                      )}
                      <div>
                        <label className={`block text-[10px] font-semibold mb-1 ${isVirt ? 'text-gray-500' : 'text-slate-400'}`}>매도 조건 — 지표</label>
                        <select
                          value={directExitConditions[0]?.indicator || ''}
                          onChange={(e) => {
                            if (!e.target.value) { setDirectExitConditions([]); return; }
                            setDirectExitConditions([{ indicator: e.target.value, operator: 'LT', value: 0, logic: 'AND', valueExpression: directExitConditions[0]?.valueExpression || '' }]);
                          }}
                          className={`w-full px-2 py-1.5 rounded-lg text-xs ${isVirt ? 'bg-white border border-gray-200 text-gray-800' : 'bg-white/[0.04] border border-white/10 text-white'}`}>
                          <option value="">사용 안 함</option>
                          <option value="CLOSE">종가 (CLOSE)</option>
                          <option value="LOW">저가 (LOW)</option>
                          <option value="RSI">RSI</option>
                          <option value="MACD">MACD</option>
                          <option value="BOLLINGER_PCT_B">볼린저 %B</option>
                          <option value="CCI">CCI</option>
                        </select>
                      </div>
                      {directExitConditions.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <select
                            value={directExitConditions[0]?.operator || 'LT'}
                            onChange={(e) => {
                              const next = [...directExitConditions];
                              next[0] = { ...next[0], operator: e.target.value as any };
                              setDirectExitConditions(next);
                            }}
                            className={`w-16 px-1.5 py-1.5 rounded-lg text-xs ${isVirt ? 'bg-white border border-gray-200 text-gray-800' : 'bg-white/[0.04] border border-white/10 text-white'}`}>
                            <option value="GT">&gt;</option>
                            <option value="GTE">&ge;</option>
                            <option value="LT">&lt;</option>
                            <option value="LTE">&le;</option>
                          </select>
                          <input
                            type="text"
                            value={directExitConditions[0]?.valueExpression || ''}
                            onChange={(e) => {
                              const next = [...directExitConditions];
                              next[0] = { ...next[0], valueExpression: e.target.value, value: 0 };
                              setDirectExitConditions(next);
                            }}
                            placeholder="OPEN + (PREV_HIGH - PREV_LOW) * 0.3"
                            className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-mono ${isVirt ? 'bg-white border border-gray-200 text-gray-800' : 'bg-white/[0.04] border border-white/10 text-white'}`} />
                        </div>
                      )}
                      {(directEntryConditions.length > 0 || directExitConditions.length > 0) && (
                        <div className={`rounded-lg p-2.5 space-y-1.5 ${isVirt ? 'bg-blue-50 border border-blue-200' : 'bg-blue-500/5 border border-blue-500/20'}`}>
                          <p className={`text-[10px] font-semibold ${isVirt ? 'text-blue-700' : 'text-blue-400'}`}>사용 가능 변수</p>
                          <div className={`grid grid-cols-2 gap-x-3 gap-y-0.5 text-[9px] ${isVirt ? 'text-blue-600' : 'text-blue-400/80'}`}>
                            <span><Term k="시가">OPEN</Term> — 당일 시가</span>
                            <span><Term k="고가">HIGH</Term> — 당일 고가</span>
                            <span><Term k="저가">LOW</Term> — 당일 저가</span>
                            <span><Term k="종가">CLOSE</Term> — 당일 종가</span>
                            <span><Term k="전일고가">PREV_HIGH</Term> — 전일 고가</span>
                            <span><Term k="전일저가">PREV_LOW</Term> — 전일 저가</span>
                            <span><Term k="전일종가">PREV_CLOSE</Term> — 전일 종가</span>
                            <span><Term k="변동성돌파">PREV_RANGE</Term> — 전일 변동폭</span>
                            <span><Term k="RSI">RSI</Term>, <Term k="MACD">MACD</Term>, <Term k="ATR">ATR</Term> 등</span>
                            <span>+, -, *, /, 괄호 ()</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 실행 버튼 */}
            <button data-tour="run-backtest" onClick={handleRunBacktest}
              disabled={isBacktesting || (!selectedStrategy && directEntryConditions.length === 0) || !backtestStockCode}
              className={`w-full py-3.5 rounded-xl font-bold text-sm text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 overflow-hidden relative ${isBacktesting ? 'bg-gray-400' : 'bg-gradient-to-r from-whale-light to-blue-500 hover:from-whale-dark hover:to-whale-light shadow-lg hover:shadow-xl'}`}>
              {!isBacktesting && !(isBacktesting || (!selectedStrategy && directEntryConditions.length === 0) || !backtestStockCode) && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" style={{ animation: 'wave 3s ease-in-out infinite', width: '200%' }} />
              )}
              {isBacktesting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  분석 중...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="relative z-10">백테스트 실행</span>
                </>
              )}
            </button>

            {!backtestStockCode && (
              <p className={`text-center text-xs ${isVirt ? 'text-gray-400' : 'text-slate-500'}`}>종목을 먼저 선택해주세요</p>
            )}

            {/* 이전 결과 히스토리 */}
            {backtestHistory.length > 0 && (
              <div ref={historyDropdownRef} className="relative mt-2">
                <button
                  onClick={() => setShowHistoryDropdown(!showHistoryDropdown)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${isVirt ? 'text-gray-500 bg-gray-50 border border-gray-200 hover:bg-gray-100' : 'text-slate-400 bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04]'}`}
                >
                  <span className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    이전 결과 ({backtestHistory.length})
                  </span>
                  <svg className={`w-3.5 h-3.5 transition-transform ${showHistoryDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showHistoryDropdown && (
                  <div className={`absolute z-30 w-full mt-1 rounded-xl shadow-xl max-h-60 overflow-y-auto ${isVirt ? 'bg-white border border-gray-200' : 'bg-[#0f1d32] border border-white/[0.08]'}`}>
                    {backtestHistory.map((entry) => (
                      <button
                        key={entry.id}
                        onClick={() => {
                          setBacktestResult(entry.result);
                          setShowHistoryDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-2.5 text-xs transition-colors first:rounded-t-xl last:rounded-b-xl ${isVirt ? 'hover:bg-blue-50 border-b border-gray-100 last:border-b-0' : 'hover:bg-white/[0.04] border-b border-white/[0.04] last:border-b-0'}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`font-semibold truncate ${isVirt ? 'text-whale-dark' : 'text-white'}`}>
                            {entry.strategyName}
                          </span>
                          <span className={`ml-2 shrink-0 font-bold ${entry.totalReturnRate >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {entry.totalReturnRate >= 0 ? '+' : ''}{entry.totalReturnRate.toFixed(1)}%
                          </span>
                        </div>
                        <div className={`mt-0.5 flex items-center gap-2 ${isVirt ? 'text-gray-400' : 'text-slate-500'}`}>
                          <span>{entry.stockCode}</span>
                          <span>{new Date(entry.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

      </div>
      </div>

      {/* ===== 가이드 투어 ===== */}
      <GuideTour steps={tourSteps} isActive={showTour} onFinish={() => setShowTour(false)} />

      {/* ===== 전략 생성/수정 모달 ===== */}
      {strategyModalMode && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className={`rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto ${isVirt ? 'bg-white' : 'bg-[#0a1628] border border-white/[0.06]'}`}>
            <div className={`sticky top-0 px-6 py-4 rounded-t-2xl flex justify-between items-center ${isVirt ? 'bg-white border-b border-gray-100' : 'bg-[#0a1628] border-b border-white/[0.06]'}`}>
              <h3 className={`text-lg font-bold ${isVirt ? 'text-whale-dark' : 'text-white'}`}>{strategyModalMode === 'edit' ? '항로 수정' : '새 항로 만들기'}</h3>
              <button onClick={closeStrategyModal} className={`p-1 transition-colors ${isVirt ? 'text-gray-400 hover:text-gray-600' : 'text-slate-500 hover:text-white'}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Step 1: 기본 정보 */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center bg-whale-light">1</span>
                  <span className={`font-semibold ${isVirt ? 'text-gray-800' : 'text-white'}`}>기본 정보</span>
                </div>
                <div className="space-y-3 pl-8">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isVirt ? 'text-gray-600' : 'text-slate-400'}`}>항로 이름 *</label>
                    <input type="text" value={newStrategyName} onChange={(e) => setNewStrategyName(e.target.value)}
                      className="input-field" placeholder="예: BTC+ETH 균등 투자" />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isVirt ? 'text-gray-600' : 'text-slate-400'}`}>설명</label>
                    <textarea value={newStrategyDescription} onChange={(e) => setNewStrategyDescription(e.target.value)}
                      className="input-field" rows={2} placeholder="항로에 대한 간단한 설명" />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isVirt ? 'text-gray-600' : 'text-slate-400'}`}>항로 로직</label>
                    <textarea value={newStrategyLogic} onChange={(e) => setNewStrategyLogic(e.target.value)}
                      className="input-field" rows={2} placeholder="예: 균등 분배 매수 후 장기 보유, RSI 30 이하 추가매수" />
                  </div>
                </div>
              </div>

              {/* Step 2: 자산 유형 */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center bg-whale-light">2</span>
                  <span className={`font-semibold ${isVirt ? 'text-gray-800' : 'text-white'}`}>자산 유형</span>
                </div>
                <div className="flex gap-2 pl-8">
                  {(['CRYPTO', 'STOCK', 'MIXED'] as const).map(type => (
                    <button key={type}
                      onClick={() => { setNewAssetType(type); setSelectedAssets([]); }}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        newAssetType === type
                          ? type === 'CRYPTO' ? 'bg-orange-500 text-white shadow-sm' :
                            type === 'STOCK' ? 'bg-blue-500 text-white shadow-sm' :
                            'bg-purple-500 text-white shadow-sm'
                          : isVirt ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]'
                      }`}>
                      {assetTypeLabel(type)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 3: 자산 선택 */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${selectedAssets.length > 0 ? 'bg-whale-light text-white' : 'bg-gray-300 text-gray-600'}`}>3</span>
                  <span className={`font-semibold ${isVirt ? 'text-gray-800' : 'text-white'}`}>투자 대상 자산</span>
                  {selectedAssets.length > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold bg-whale-light/10 ${isVirt ? 'text-whale-dark' : 'text-white'}`}>{selectedAssets.length}개 선택</span>
                  )}
                </div>
                <div className="pl-8">
                  {selectedAssets.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {selectedAssets.map(code => (
                        <span key={code} className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-whale-light/10 border border-whale-light/30 ${isVirt ? 'text-whale-dark' : 'text-white'}`}>
                          {getAssetName(code)}
                          <span className={`text-xs ml-0.5 ${isVirt ? 'text-gray-400' : 'text-slate-500'}`}>{code}</span>
                          <button onClick={() => handleRemoveAsset(code)} className="ml-1 w-4 h-4 rounded-full bg-red-100 text-red-500 hover:bg-red-200 flex items-center justify-center text-xs leading-none">x</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <input type="text" value={assetSearchQuery} onChange={(e) => handleAssetSearchChange(e.target.value)}
                    className="input-field"
                    placeholder={newAssetType === 'CRYPTO' ? '가상화폐 검색 (BTC, ETH...)' : newAssetType === 'STOCK' ? '종목명 또는 종목코드로 검색' : '자산 검색'} />
                  <div className={`mt-1 max-h-60 overflow-y-auto rounded-xl ${isVirt ? 'border border-gray-200' : 'border border-white/[0.06]'}`}>
                    {getAvailableAssets().slice(0, 50).map(asset => {
                      const isStock = asset.code.match(/^\d{6}$/);
                      return (
                        <button key={asset.code} onClick={() => handleAddAsset(asset.code)}
                          className={`w-full text-left px-3 py-2.5 text-sm last:border-0 transition-colors flex items-center gap-2 ${isVirt ? 'hover:bg-blue-50 border-b border-gray-50' : 'hover:bg-white/[0.03] border-b border-white/[0.04]'}`}>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-whale-dark flex-shrink-0 ${isStock ? 'bg-blue-400' : 'bg-orange-400'}`}>
                            {asset.name.slice(0, 1)}
                          </div>
                          <span className={`font-medium ${isVirt ? 'text-gray-800' : 'text-white'}`}>{asset.name}</span>
                          <span className={`text-xs ${isVirt ? 'text-gray-400' : 'text-slate-500'}`}>{asset.code}</span>
                        </button>
                      );
                    })}
                    {getAvailableAssets().length === 0 && (
                      <div className={`px-3 py-4 text-sm text-center ${isVirt ? 'text-gray-500' : 'text-slate-500'}`}>
                        {isSearchingStocks ? '검색 중...' : assetSearchQuery ? '검색 결과가 없습니다' : selectedAssets.length > 0 ? '모든 자산이 선택되었습니다' : '불러오는 중...'}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Step 4: 매매 조건 */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${newEntryConditions.length > 0 || newExitConditions.length > 0 ? 'bg-whale-light text-white' : 'bg-gray-300 text-gray-600'}`}>4</span>
                  <span className={`font-semibold ${isVirt ? 'text-gray-800' : 'text-white'}`}>매매 조건</span>
                  <span className={`text-xs ${isVirt ? 'text-gray-400' : 'text-slate-500'}`}>(백테스팅에 사용)</span>
                </div>
                <div className="pl-8 space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-600">사용할 지표</label>
                      <select className={`text-xs rounded-lg px-2 py-1 ${isVirt ? 'border border-gray-200 bg-white' : 'border border-white/10 bg-white/[0.04] text-white'}`} value=""
                        onChange={(e) => {
                          if (!e.target.value) return;
                          const type = e.target.value as any;
                          const defaults: Record<string, Record<string, number>> = {
                            RSI: { period: 14 }, MACD: { fast: 12, slow: 26, signal: 9 },
                            MA: { period: 20 }, EMA: { period: 20 },
                            BOLLINGER_BANDS: { period: 20, stdDev: 2 },
                            STOCHASTIC: { kPeriod: 14, dPeriod: 3 },
                            ATR: { period: 14 }, CCI: { period: 20 },
                            WILLIAMS_R: { period: 14 }, OBV: {},
                          };
                          if (!newIndicators.some(ind => ind.type === type)) {
                            setNewIndicators([...newIndicators, { type, parameters: defaults[type] || {} }]);
                          }
                        }}>
                        <option value="">+ 지표 추가</option>
                        {(['RSI','MACD','MA','EMA','BOLLINGER_BANDS','STOCHASTIC','ATR','CCI','WILLIAMS_R','OBV'] as const)
                          .filter(t => !newIndicators.some(ind => ind.type === t))
                          .map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    {newIndicators.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {newIndicators.map((ind, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5 text-sm">
                            <span className="font-semibold text-blue-700">{ind.type}</span>
                            <button type="button" onClick={() => setNewIndicators(newIndicators.filter((_, i) => i !== idx))}
                              className="ml-1 text-blue-300 hover:text-red-500 text-xs">x</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 진입 조건 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-red-600">매수 조건 (진입)</label>
                      <button type="button"
                        onClick={() => setNewEntryConditions([...newEntryConditions, { indicator: 'RSI', operator: 'LT', value: 30, logic: 'AND' }])}
                        className="text-xs text-red-500 hover:text-red-700 font-medium">+ 조건 추가</button>
                    </div>
                    {newEntryConditions.map((cond, idx) => {
                      const isCross = cond.indicator.includes('_CROSS_') || cond.indicator.includes('_CROSSUNDER_');
                      return (
                        <div key={idx} className="flex items-center gap-2 mb-2">
                          {idx > 0 && (
                            <select className={`text-xs rounded px-1.5 py-1 w-14 ${isVirt ? 'border border-gray-200 bg-white' : 'border border-white/10 bg-white/[0.04] text-white'}`}
                              value={cond.logic}
                              onChange={(e) => { const u = [...newEntryConditions]; u[idx] = { ...cond, logic: e.target.value as any }; setNewEntryConditions(u); }}>
                              <option value="AND">AND</option>
                              <option value="OR">OR</option>
                            </select>
                          )}
                          <select className={`text-sm rounded-lg px-2 py-1.5 ${isVirt ? 'border border-gray-200 bg-white' : 'border border-white/10 bg-white/[0.04] text-white'} ${isCross ? 'flex-[2]' : 'flex-1'}`}
                            value={cond.indicator}
                            onChange={(e) => { const u = [...newEntryConditions]; u[idx] = { ...cond, indicator: e.target.value }; setNewEntryConditions(u); }}>
                            <option value="PRICE">현재가</option>
                            <option value="RSI">RSI</option>
                            <option value="MACD">MACD</option>
                            <option value="MACD_SIGNAL">MACD 시그널</option>
                            <option value="MACD_HISTOGRAM">MACD 히스토그램</option>
                            <option value="MA">이동평균 (MA)</option>
                            <option value="EMA">지수이동평균 (EMA)</option>
                            <option value="BOLLINGER_UPPER">볼린저 상단</option>
                            <option value="BOLLINGER_MIDDLE">볼린저 중간</option>
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
                          </select>
                          {!isCross && (
                            <>
                              <select className={`text-sm rounded-lg px-2 py-1.5 w-16 ${isVirt ? 'border border-gray-200 bg-white' : 'border border-white/10 bg-white/[0.04] text-white'}`} value={cond.operator}
                                onChange={(e) => { const u = [...newEntryConditions]; u[idx] = { ...cond, operator: e.target.value as any }; setNewEntryConditions(u); }}>
                                <option value="GT">&gt;</option>
                                <option value="GTE">&ge;</option>
                                <option value="LT">&lt;</option>
                                <option value="LTE">&le;</option>
                                <option value="EQ">=</option>
                              </select>
                              <input type="number" className={`text-sm rounded-lg px-2 py-1.5 w-20 ${isVirt ? 'border border-gray-200 bg-white' : 'border border-white/10 bg-white/[0.04] text-white'}`}
                                value={cond.value}
                                onChange={(e) => { const u = [...newEntryConditions]; u[idx] = { ...cond, value: parseFloat(e.target.value) || 0 }; setNewEntryConditions(u); }} />
                            </>
                          )}
                          <button type="button" onClick={() => setNewEntryConditions(newEntryConditions.filter((_, i) => i !== idx))}
                            className={`text-sm ${isVirt ? 'text-gray-300' : 'text-slate-600'} hover:text-red-500`}>x</button>
                        </div>
                      );
                    })}
                  </div>

                  {/* 청산 조건 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-blue-600">매도 조건 (청산)</label>
                      <button type="button"
                        onClick={() => setNewExitConditions([...newExitConditions, { indicator: 'RSI', operator: 'GT', value: 70, logic: 'AND' }])}
                        className="text-xs text-blue-500 hover:text-blue-700 font-medium">+ 조건 추가</button>
                    </div>
                    {newExitConditions.map((cond, idx) => {
                      const isCross = cond.indicator.includes('_CROSS_') || cond.indicator.includes('_CROSSUNDER_');
                      return (
                        <div key={idx} className="flex items-center gap-2 mb-2">
                          {idx > 0 && (
                            <select className={`text-xs rounded px-1.5 py-1 w-14 ${isVirt ? 'border border-gray-200 bg-white' : 'border border-white/10 bg-white/[0.04] text-white'}`}
                              value={cond.logic}
                              onChange={(e) => { const u = [...newExitConditions]; u[idx] = { ...cond, logic: e.target.value as any }; setNewExitConditions(u); }}>
                              <option value="AND">AND</option>
                              <option value="OR">OR</option>
                            </select>
                          )}
                          <select className={`text-sm rounded-lg px-2 py-1.5 ${isVirt ? 'border border-gray-200 bg-white' : 'border border-white/10 bg-white/[0.04] text-white'} ${isCross ? 'flex-[2]' : 'flex-1'}`}
                            value={cond.indicator}
                            onChange={(e) => { const u = [...newExitConditions]; u[idx] = { ...cond, indicator: e.target.value }; setNewExitConditions(u); }}>
                            <option value="PRICE">현재가</option>
                            <option value="RSI">RSI</option>
                            <option value="MACD">MACD</option>
                            <option value="MACD_SIGNAL">MACD 시그널</option>
                            <option value="MACD_HISTOGRAM">MACD 히스토그램</option>
                            <option value="MA">이동평균 (MA)</option>
                            <option value="EMA">지수이동평균 (EMA)</option>
                            <option value="BOLLINGER_UPPER">볼린저 상단</option>
                            <option value="BOLLINGER_MIDDLE">볼린저 중간</option>
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
                          </select>
                          {!isCross && (
                            <>
                              <select className={`text-sm rounded-lg px-2 py-1.5 w-16 ${isVirt ? 'border border-gray-200 bg-white' : 'border border-white/10 bg-white/[0.04] text-white'}`} value={cond.operator}
                                onChange={(e) => { const u = [...newExitConditions]; u[idx] = { ...cond, operator: e.target.value as any }; setNewExitConditions(u); }}>
                                <option value="GT">&gt;</option>
                                <option value="GTE">&ge;</option>
                                <option value="LT">&lt;</option>
                                <option value="LTE">&le;</option>
                                <option value="EQ">=</option>
                              </select>
                              <input type="number" className={`text-sm rounded-lg px-2 py-1.5 w-20 ${isVirt ? 'border border-gray-200 bg-white' : 'border border-white/10 bg-white/[0.04] text-white'}`}
                                value={cond.value}
                                onChange={(e) => { const u = [...newExitConditions]; u[idx] = { ...cond, value: parseFloat(e.target.value) || 0 }; setNewExitConditions(u); }} />
                            </>
                          )}
                          <button type="button" onClick={() => setNewExitConditions(newExitConditions.filter((_, i) => i !== idx))}
                            className={`text-sm ${isVirt ? 'text-gray-300' : 'text-slate-600'} hover:text-red-500`}>x</button>
                        </div>
                      );
                    })}
                  </div>

                  {/* 프리셋 버튼 */}
                  {newIndicators.length === 0 && newEntryConditions.length === 0 && newExitConditions.length === 0 && (
                    <div className="pt-1">
                      <p className={`text-xs mb-2 ${isVirt ? 'text-gray-500' : 'text-slate-500'}`}>빠른 설정 (프리셋)</p>
                      <div className="flex flex-wrap gap-2">
                        <button type="button"
                          onClick={() => { setNewIndicators([{ type: 'RSI', parameters: { period: 14 } }]); setNewEntryConditions([{ indicator: 'RSI', operator: 'LT', value: 30, logic: 'AND' }]); setNewExitConditions([{ indicator: 'RSI', operator: 'GT', value: 70, logic: 'AND' }]); }}
                          className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-xs font-medium hover:bg-purple-100 border border-purple-200">RSI 과매수/과매도</button>
                        <button type="button"
                          onClick={() => { setNewIndicators([{ type: 'MACD', parameters: { fast: 12, slow: 26, signal: 9 } }]); setNewEntryConditions([{ indicator: 'MACD_HISTOGRAM', operator: 'GT', value: 0, logic: 'AND' }]); setNewExitConditions([{ indicator: 'MACD_HISTOGRAM', operator: 'LT', value: 0, logic: 'AND' }]); }}
                          className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100 border border-blue-200">MACD 골든/데드크로스</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <button onClick={handleSaveStrategy}
                disabled={!newStrategyName.trim() || selectedAssets.length === 0}
                className="w-full py-3 text-white font-bold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-whale-light hover:bg-whale-dark">
                {strategyModalMode === 'edit' ? '항로 수정하기' : '항로 생성하기'} ({selectedAssets.length}개 자산)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 포트폴리오 적용 모달 ===== */}
      {showApplyModal && selectedStrategy && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className={`rounded-2xl shadow-xl max-w-md w-full p-6 ${isVirt ? 'bg-white' : 'bg-[#0a1628] border border-white/[0.06]'}`}>
            <h3 className={`text-lg font-bold mb-2 ${isVirt ? 'text-whale-dark' : 'text-white'}`}>항로 포트폴리오 적용</h3>
            <p className={`text-sm mb-4 ${isVirt ? 'text-gray-600' : 'text-slate-400'}`}>
              "{selectedStrategy.name}" 항로를 포트폴리오에 적용합니다.
              투자 금액이 {selectedStrategy.targetAssets?.length || 0}개 자산에 균등 분배되어 시장가 매수됩니다.
            </p>

            <div className="mb-4">
              <label className={`block text-sm font-medium mb-1 ${isVirt ? 'text-gray-700' : 'text-slate-300'}`}>투자 금액 (원)</label>
              <input type="number" value={applyAmount} onChange={(e) => setApplyAmount(e.target.value)}
                className="input-field" placeholder="1000000" />
              <div className="flex gap-2 mt-2">
                {[100000, 500000, 1000000, 5000000].map(amount => (
                  <button key={amount} onClick={() => setApplyAmount(String(amount))}
                    className={`px-3 py-1 rounded text-xs transition-colors ${isVirt ? 'bg-gray-100 hover:bg-gray-200 text-gray-700' : 'bg-white/[0.04] hover:bg-white/[0.08] text-slate-300'}`}>
                    {(amount / 10000).toFixed(0)}만
                  </button>
                ))}
              </div>
            </div>

            <div className={`mb-4 p-3 rounded-xl text-sm space-y-2 ${isVirt ? 'bg-gray-50' : 'bg-white/[0.02]'}`}>
              <div className="flex justify-between">
                <span className={isVirt ? 'text-gray-600' : 'text-slate-400'}>대상 자산</span>
                <span className="font-medium">{selectedStrategy.targetAssets?.length || 0}개</span>
              </div>
              <div className="flex justify-between">
                <span className={isVirt ? 'text-gray-600' : 'text-slate-400'}>자산당 투자금</span>
                <span className="font-medium">{formatCurrency(parseInt(applyAmount || '0') / (selectedStrategy.targetAssets?.length || 1))}</span>
              </div>
              {selectedStrategy.targetAssets && selectedStrategy.targetAssets.length > 0 && (
                <div className={`pt-2 ${isVirt ? 'border-t border-gray-200' : 'border-t border-white/[0.06]'}`}>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedStrategy.targetAssets.map(code => (
                      <span key={code} className={`px-2 py-1 rounded text-xs font-medium ${isVirt ? 'bg-white text-gray-700 border border-gray-200' : 'bg-white/[0.04] text-white border border-white/[0.06]'}`}>
                        {getAssetName(code)} ({code})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowApplyModal(false)}
                className={`flex-1 py-2.5 rounded-lg transition-colors font-medium ${isVirt ? 'border border-gray-300 text-gray-700 hover:bg-gray-50' : 'border border-white/[0.06] text-slate-300 hover:bg-white/[0.03]'}`}>
                취소
              </button>
              <button onClick={handleApplyStrategy} disabled={isApplying}
                className="flex-1 py-2.5 text-white rounded-lg transition-colors font-bold disabled:opacity-50 bg-whale-light hover:bg-whale-dark">
                {isApplying ? '적용 중...' : '적용하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StrategyPage;
