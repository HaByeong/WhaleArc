import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import { usePolling } from '../hooks/usePolling';
import { useRealtimePrice } from '../hooks/useRealtimePrice';
import {
  tradeService,
  type StockPrice,
  type OrderRequest,
  type Order,
  type Trade,
  type Portfolio,
} from '../services/tradeService';
import { CRYPTO_NAMES, formatQuantity } from '../services/quantStoreService';
import TradingChart from '../components/TradingChart';

/* ─── 인기 코인 (종목 목록 상단 고정) ─── */
const POPULAR_COINS = ['BTC', 'ETH', 'XRP', 'SOL', 'DOGE', 'ADA', 'AVAX', 'LINK', 'DOT', 'MATIC'];
const COMMISSION_RATE = 0.001; // 0.1% (백엔드와 동일)

/* ─── 유틸 ─── */
const fmt = (v: number) =>
  new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

const fmtNum = (v: number) => new Intl.NumberFormat('ko-KR').format(v);

const assetName = (code: string, assetType?: string) => {
  if (assetType === 'STOCK') return code; // 주식은 stockName 사용
  return CRYPTO_NAMES[code] || code;
};

const TradePage = () => {
  const [searchParams] = useSearchParams();
  const urlCode = searchParams.get('code');
  const urlType = searchParams.get('type') as 'CRYPTO' | 'STOCK' | null;

  /* ─── 마켓 탭 ─── */
  const [marketTab, setMarketTab] = useState<'CRYPTO' | 'STOCK'>(urlType || 'STOCK');

  /* ─── 상태 ─── */
  const [selectedStock, setSelectedStock] = useState<StockPrice | null>(null);
  const [stockList, setStockList] = useState<StockPrice[]>([]);
  const [krxStockList, setKrxStockList] = useState<StockPrice[]>([]);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);

  const [orderType, setOrderType] = useState<'BUY' | 'SELL'>('BUY');
  const [orderMethod, setOrderMethod] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [quantity, setQuantity] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [activeTab, setActiveTab] = useState<'chart' | 'orders' | 'trades' | 'holdings'>('chart');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // 주식 검색
  const [stockSearchResults, setStockSearchResults] = useState<{ code: string; name: string; market: string }[]>([]);
  const [stockSearchLoading, setStockSearchLoading] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const selectedStockRef = useRef<StockPrice | null>(null);
  selectedStockRef.current = selectedStock;

  // WebSocket 실시간 가격 (코인만)
  const { prices: realtimePrices } = useRealtimePrice({ enabled: marketTab === 'CRYPTO' });

  // 실시간 가격을 종목 목록에 병합 (코인만)
  const mergedStockList = useMemo(() => {
    if (marketTab === 'STOCK') return krxStockList;
    if (realtimePrices.size === 0) return stockList;
    return stockList.map(stock => {
      const rt = realtimePrices.get(stock.stockCode);
      if (rt) {
        return { ...stock, currentPrice: rt.price, change: rt.change, changeRate: rt.changeRate, volume: rt.volume };
      }
      return stock;
    });
  }, [stockList, krxStockList, realtimePrices, marketTab]);

  // 선택된 종목도 실시간 반영
  const liveSelectedStock = useMemo(() => {
    if (!selectedStock) return null;
    if (selectedStock.assetType === 'STOCK') return selectedStock;
    const rt = realtimePrices.get(selectedStock.stockCode);
    if (rt) {
      return { ...selectedStock, currentPrice: rt.price, change: rt.change, changeRate: rt.changeRate, volume: rt.volume };
    }
    return selectedStock;
  }, [selectedStock, realtimePrices]);

  // 토스트 타이머 cleanup
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  /* ─── 토스트 ─── */
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  /* ─── 데이터 로드 ─── */
  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [stocks, krxStocks, portfolioData, ordersData, tradesData] = await Promise.all([
        tradeService.getStockList(),
        tradeService.getKrxStockList(),
        tradeService.getPortfolio(),
        tradeService.getOrders(),
        tradeService.getTrades(),
      ]);
      setStockList(stocks);
      setKrxStockList(krxStocks);
      setPortfolio(portfolioData);
      setOrders(ordersData);
      setTrades(tradesData);

      // URL 파라미터로 전달된 종목 선택
      if (urlCode && !selectedStockRef.current) {
        const targetList = urlType === 'CRYPTO' ? stocks : krxStocks;
        const found = targetList.find(s => s.stockCode === urlCode);
        if (found) {
          setSelectedStock(found);
        } else if (urlType === 'STOCK') {
          // 인기 종목 목록에 없는 주식 → 개별 조회
          try {
            const stockPrice = await tradeService.getKrxStockPrice(urlCode);
            if (stockPrice) {
              setKrxStockList(prev => [stockPrice, ...prev]);
              setSelectedStock(stockPrice);
            }
          } catch {
            // 조회 실패 시 기본 종목 선택
            if (krxStocks.length > 0) setSelectedStock(krxStocks[0]);
          }
        } else {
          if (targetList.length > 0) setSelectedStock(targetList[0]);
        }
      } else if (!selectedStockRef.current) {
        const defaultList = (urlType || 'STOCK') === 'CRYPTO' ? stocks : krxStocks;
        if (defaultList.length > 0) setSelectedStock(defaultList[0]);
      }
    } catch (err: any) {
      setError(err.message || '데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadInitialData(); }, [loadInitialData]);

  /* ─── 마켓 탭 전환 시 선택 초기화 (사용자가 직접 탭을 바꿀 때만) ─── */
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return; // 초기 마운트 시에는 URL 파라미터 선택을 유지
    }
    const list = marketTab === 'CRYPTO' ? stockList : krxStockList;
    if (list.length > 0) {
      setSelectedStock(list[0]);
    }
    setSearchQuery('');
    setStockSearchResults([]);
    setQuantity('');
    setLimitPrice('');
    setActiveTab('chart');
  }, [marketTab]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── 폴링 (10초) — 포트폴리오/주문/체결만 ─── */
  const pollData = useCallback(async () => {
    try {
      const [portfolioData, ordersData, tradesData] = await Promise.all([
        tradeService.getPortfolio(),
        tradeService.getOrders(),
        tradeService.getTrades(),
      ]);
      setPortfolio(portfolioData);
      setOrders(ordersData);
      setTrades(tradesData);
    } catch { /* 폴링 실패 무시 */ }
  }, []);

  usePolling(pollData, 10000);

  // 주식 탭일 때 시세 폴링 (30초)
  const pollStockPrices = useCallback(async () => {
    if (marketTab !== 'STOCK') return;
    try {
      const fresh = await tradeService.getKrxStockList();
      setKrxStockList(fresh);
      // 선택된 종목 시세 갱신
      if (selectedStockRef.current?.assetType === 'STOCK') {
        const updated = fresh.find(s => s.stockCode === selectedStockRef.current!.stockCode);
        if (updated) {
          setSelectedStock(prev => prev ? { ...prev, currentPrice: updated.currentPrice, change: updated.change, changeRate: updated.changeRate, volume: updated.volume } : prev);
        }
      }
    } catch { /* ignore */ }
  }, [marketTab]);

  usePolling(pollStockPrices, 30000);

  /* ─── 종목 선택 ─── */
  const handleStockSelect = (stock: StockPrice) => {
    setSelectedStock(stock);
    setActiveTab('chart');
    setQuantity('');
    setLimitPrice('');
  };

  /* ─── 주식 검색 (디바운스) ─── */
  const handleStockSearch = (keyword: string) => {
    setSearchQuery(keyword);
    if (marketTab !== 'STOCK') return;

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!keyword.trim()) {
      setStockSearchResults([]);
      return;
    }

    searchTimerRef.current = setTimeout(async () => {
      setStockSearchLoading(true);
      try {
        const results = await tradeService.searchKrxStocks(keyword.trim());
        // 이미 리스트에 있는 종목 제외
        const existingCodes = new Set(krxStockList.map(s => s.stockCode));
        setStockSearchResults(results.filter(r => !existingCodes.has(r.code)));
      } catch { /* ignore */ }
      setStockSearchLoading(false);
    }, 300);
  };

  /* ─── 주식 검색 결과 클릭 ─── */
  const handleSearchResultClick = async (result: { code: string; name: string; market: string }) => {
    setStockSearchResults([]);
    setSearchQuery('');
    try {
      const stockPrice = await tradeService.getKrxStockPrice(result.code);
      stockPrice.stockName = result.name;
      setKrxStockList(prev => [stockPrice, ...prev]);
      setSelectedStock(stockPrice);
      setActiveTab('chart');
    } catch {
      showToast('종목 시세를 불러올 수 없습니다.', 'error');
    }
  };

  /* ─── 주문 제출 ─── */
  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(quantity);
    if (!selectedStock || !quantity || isNaN(qty) || qty <= 0) {
      showToast('종목과 수량을 확인해주세요.', 'error');
      return;
    }

    const isStock = selectedStock.assetType === 'STOCK';

    // 주식은 정수 단위만
    if (isStock && qty !== Math.floor(qty)) {
      showToast('주식은 1주 단위로만 거래할 수 있습니다.', 'error');
      return;
    }

    if (orderMethod === 'LIMIT' && (!limitPrice || parseFloat(limitPrice) <= 0)) {
      showToast('지정가를 입력해주세요.', 'error');
      return;
    }

    // 잔고 체크 — 실시간 가격 사용
    const rt = !isStock ? realtimePrices.get(selectedStock.stockCode) : null;
    const currentPrice = rt ? rt.price : selectedStock.currentPrice;
    const price = orderMethod === 'MARKET' ? currentPrice : parseFloat(limitPrice);
    const total = price * qty * (1 + COMMISSION_RATE);
    if (orderType === 'BUY' && portfolio && total > portfolio.cashBalance) {
      showToast('잔고가 부족합니다.', 'error');
      return;
    }
    if (orderType === 'SELL') {
      const available = getAvailableQuantity(selectedStock.stockCode);
      if (qty > available) {
        showToast('보유 수량이 부족합니다.', 'error');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const displayName = isStock ? selectedStock.stockName : assetName(selectedStock.stockCode);
      const orderRequest: OrderRequest = {
        stockCode: selectedStock.stockCode,
        stockName: displayName,
        orderType,
        orderMethod,
        quantity: qty,
        price: orderMethod === 'LIMIT' ? parseFloat(limitPrice) : undefined,
        assetType: isStock ? 'STOCK' : 'CRYPTO',
      };
      await tradeService.createOrder(orderRequest);
      setQuantity('');
      setLimitPrice('');
      showToast(
        `${displayName} ${orderType === 'BUY' ? '매수' : '매도'} 주문 완료!`,
        'success'
      );
      const [portfolioData, ordersData, tradesData] = await Promise.all([
        tradeService.getPortfolio(),
        tradeService.getOrders(),
        tradeService.getTrades(),
      ]);
      setPortfolio(portfolioData);
      setOrders(ordersData);
      setTrades(tradesData);
    } catch (err: any) {
      showToast(err?.response?.data?.message || '주문 실패. 다시 시도해주세요.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ─── 주문 취소 ─── */
  const handleCancelOrder = async (orderId: string) => {
    if (!confirm('주문을 취소하시겠습니까?')) return;
    try {
      await tradeService.cancelOrder(orderId);
      showToast('주문이 취소되었습니다.');
      const [portfolioData, ordersData] = await Promise.all([
        tradeService.getPortfolio(),
        tradeService.getOrders(),
      ]);
      setPortfolio(portfolioData);
      setOrders(ordersData);
    } catch {
      showToast('주문 취소 실패', 'error');
    }
  };

  /* ─── 유틸 함수 ─── */
  const getAvailableQuantity = (stockCode: string): number => {
    if (!portfolio) return 0;
    return portfolio.holdings.find(h => h.stockCode === stockCode)?.quantity || 0;
  };

  const getDisplayName = (code: string, name?: string, type?: string) => {
    if (type === 'STOCK' && name) return name;
    return CRYPTO_NAMES[code] || name || code;
  };

  const getStatusLabel = (status: Order['status']) => {
    const map: Record<string, { label: string; cls: string }> = {
      FILLED: { label: '체결', cls: 'bg-green-50 text-green-700' },
      PENDING: { label: '대기', cls: 'bg-amber-50 text-amber-700' },
      CANCELLED: { label: '취소', cls: 'bg-gray-100 text-gray-500' },
      PARTIALLY_FILLED: { label: '부분체결', cls: 'bg-blue-50 text-blue-700' },
    };
    return map[status] || { label: status, cls: 'bg-gray-100 text-gray-600' };
  };

  /* ─── 빠른 수량 버튼 계산 ─── */
  const setQuickQuantity = (pct: number) => {
    if (!selectedStock) return;
    const isStock = selectedStock.assetType === 'STOCK';
    if (orderType === 'BUY') {
      const cash = portfolio?.cashBalance || 0;
      const rtPrice = !isStock ? (realtimePrices.get(selectedStock.stockCode)?.price ?? selectedStock.currentPrice) : selectedStock.currentPrice;
      const price = orderMethod === 'LIMIT' && limitPrice ? parseFloat(limitPrice) : rtPrice;
      if (price <= 0) return;
      const maxQty = (cash * pct) / (price * (1 + COMMISSION_RATE));
      if (isStock) {
        setQuantity(Math.floor(maxQty).toString());
      } else {
        setQuantity(maxQty > 0 ? maxQty.toFixed(8).replace(/\.?0+$/, '') : '0');
      }
    } else {
      const holding = getAvailableQuantity(selectedStock.stockCode);
      const qty = holding * pct;
      if (isStock) {
        setQuantity(Math.floor(qty).toString());
      } else {
        setQuantity(qty > 0 ? qty.toFixed(8).replace(/\.?0+$/, '') : '0');
      }
    }
  };

  /* ─── 종목 필터 ─── */
  const filteredStocks = mergedStockList.filter(s => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const name = (s.assetType === 'STOCK' ? s.stockName : assetName(s.stockCode)).toLowerCase();
    return s.stockCode.toLowerCase().includes(q) || name.includes(q);
  });

  // 인기 코인을 상단에 정렬 (코인만)
  const sortedStocks = [...filteredStocks].sort((a, b) => {
    if (marketTab === 'CRYPTO') {
      const aPopular = POPULAR_COINS.indexOf(a.stockCode);
      const bPopular = POPULAR_COINS.indexOf(b.stockCode);
      if (aPopular >= 0 && bPopular >= 0) return aPopular - bPopular;
      if (aPopular >= 0) return -1;
      if (bPopular >= 0) return 1;
    }
    return b.volume - a.volume; // 거래량 순
  });

  /* ─── 현재 선택 종목이 주식인지 ─── */
  const isSelectedStock = liveSelectedStock?.assetType === 'STOCK';
  const selectedDisplayName = liveSelectedStock
    ? (isSelectedStock ? liveSelectedStock.stockName : assetName(liveSelectedStock.stockCode))
    : '';

  /* ─── 예상 금액 ─── */
  const estimatedTotal = liveSelectedStock && quantity
    ? (orderMethod === 'MARKET' ? liveSelectedStock.currentPrice : parseFloat(limitPrice) || 0) * parseFloat(quantity || '0') * (orderType === 'BUY' ? (1 + COMMISSION_RATE) : (1 - COMMISSION_RATE))
    : 0;

  /* ─── 로딩/에러 ─── */
  if (loading && stockList.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header showNav />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <LoadingSpinner fullScreen={false} message="시세 데이터를 불러오는 중..." />
        </div>
      </div>
    );
  }
  if (error && stockList.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header showNav />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <ErrorMessage message={error} onRetry={loadInitialData} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header showNav />

      {/* 토스트 */}
      {toast && (
        <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-lg text-sm font-semibold transition-all animate-fade-in ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* ━━━ 좌측: 종목 목록 (3칸) ━━━ */}
          <div className="lg:col-span-3 space-y-4">
            {/* 코인/주식 탭 */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              <button
                onClick={() => setMarketTab('CRYPTO')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                  marketTab === 'CRYPTO'
                    ? 'bg-white text-whale-dark shadow-sm'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                코인
              </button>
              <button
                onClick={() => setMarketTab('STOCK')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                  marketTab === 'STOCK'
                    ? 'bg-white text-whale-dark shadow-sm'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                주식
              </button>
            </div>

            {/* 검색 */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={e => marketTab === 'STOCK' ? handleStockSearch(e.target.value) : setSearchQuery(e.target.value)}
                placeholder={marketTab === 'CRYPTO' ? '코인 검색 (이름/코드)' : '주식 검색 (이름/코드)'}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-whale-light/50 focus:border-whale-light"
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(''); setStockSearchResults([]); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
              {stockSearchLoading && (
                <div className="absolute right-10 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-whale-light border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {/* 주식 검색 드롭다운 */}
              {marketTab === 'STOCK' && stockSearchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-200 z-20 max-h-60 overflow-y-auto">
                  {stockSearchResults.map(r => (
                    <div
                      key={r.code}
                      onClick={() => handleSearchResultClick(r)}
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
            </div>

            {/* 종목 리스트 */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="px-4 py-3 bg-gradient-to-r from-whale-dark to-whale-light">
                <div className="flex items-center justify-between text-white">
                  <span className="text-sm font-semibold">{marketTab === 'CRYPTO' ? '코인' : '주식'}</span>
                  <span className="text-xs opacity-80">{sortedStocks.length}개</span>
                </div>
              </div>
              <div className="max-h-[calc(100vh-320px)] overflow-y-auto divide-y divide-gray-50">
                {sortedStocks.map(stock => {
                  const isSelected = selectedStock?.stockCode === stock.stockCode;
                  const isPopular = marketTab === 'CRYPTO' && POPULAR_COINS.includes(stock.stockCode);
                  const name = stock.assetType === 'STOCK' ? stock.stockName : assetName(stock.stockCode);
                  return (
                    <div
                      key={stock.stockCode}
                      onClick={() => handleStockSelect(stock)}
                      className={`px-4 py-3 cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-whale-light/10 border-l-3 border-l-whale-light'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`font-semibold text-sm truncate ${isSelected ? 'text-whale-dark' : 'text-gray-800'}`}>
                              {name}
                            </span>
                            {isPopular && (
                              <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-amber-400" />
                            )}
                          </div>
                          <span className="text-xs text-gray-400">{stock.stockCode}</span>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <div className="text-sm font-semibold text-gray-800">{fmt(stock.currentPrice)}</div>
                          <div className={`text-xs font-semibold ${stock.changeRate >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                            {stock.changeRate >= 0 ? '+' : ''}{stock.changeRate.toFixed(2)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {sortedStocks.length === 0 && (
                  <div className="p-6 text-center text-gray-400 text-sm">검색 결과가 없습니다</div>
                )}
              </div>
              {marketTab === 'STOCK' && (
                <p className="text-[10px] text-gray-400 text-right px-4 py-1.5">
                  * 주식 시세는 KIS 모의투자 API 기준 약 15~20초 지연
                </p>
              )}
            </div>
          </div>

          {/* ━━━ 중앙: 차트 + 탭 내용 (5칸) ━━━ */}
          <div className="lg:col-span-5 space-y-4">
            {liveSelectedStock && (
              <>
                {/* 종목 헤더 */}
                <div className="bg-white rounded-xl shadow-lg p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold text-whale-dark">{selectedDisplayName}</h2>
                        {isSelectedStock && (
                          <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">주식</span>
                        )}
                      </div>
                      <span className="text-sm text-gray-400">
                        {isSelectedStock ? `${liveSelectedStock.stockCode} · KRX` : `${liveSelectedStock.stockCode}/KRW`}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-whale-dark">{fmt(liveSelectedStock.currentPrice)}</div>
                      <div className={`text-sm font-semibold ${liveSelectedStock.changeRate >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                        {liveSelectedStock.changeRate >= 0 ? '+' : ''}{fmt(liveSelectedStock.change)}
                        <span className="ml-1">({liveSelectedStock.changeRate >= 0 ? '+' : ''}{liveSelectedStock.changeRate.toFixed(2)}%)</span>
                      </div>
                    </div>
                  </div>

                  {/* 미니 지표 */}
                  {!isSelectedStock && (
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { label: '고가', value: fmt(liveSelectedStock.high), cls: 'text-red-500' },
                        { label: '저가', value: fmt(liveSelectedStock.low), cls: 'text-blue-500' },
                        { label: '시가', value: fmt(liveSelectedStock.open), cls: 'text-gray-700' },
                        { label: '거래량', value: fmtNum(liveSelectedStock.volume), cls: 'text-gray-700' },
                      ].map(item => (
                        <div key={item.label} className="bg-gray-50 rounded-lg p-2 text-center">
                          <div className="text-[10px] text-gray-400 mb-0.5">{item.label}</div>
                          <div className={`text-xs font-semibold ${item.cls}`}>{item.value}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {isSelectedStock && (
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: '거래량', value: fmtNum(liveSelectedStock.volume), cls: 'text-gray-700' },
                        { label: '전일 종가', value: fmt(liveSelectedStock.previousClose), cls: 'text-gray-700' },
                      ].map(item => (
                        <div key={item.label} className="bg-gray-50 rounded-lg p-2 text-center">
                          <div className="text-[10px] text-gray-400 mb-0.5">{item.label}</div>
                          <div className={`text-xs font-semibold ${item.cls}`}>{item.value}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 탭 */}
                <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                  <div className="flex border-b border-gray-100">
                    {([
                      { key: 'chart', label: '차트' },
                      { key: 'orders', label: `주문 (${orders.length})` },
                      { key: 'trades', label: `체결 (${trades.length})` },
                      { key: 'holdings', label: `보유 (${portfolio?.holdings.length || 0})` },
                    ] as const).map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex-1 py-3 text-xs font-semibold transition-colors ${
                          activeTab === tab.key
                            ? 'text-whale-light border-b-2 border-whale-light bg-whale-light/5'
                            : 'text-gray-400 hover:text-gray-600'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="p-4">
                    {/* 차트 탭 */}
                    {activeTab === 'chart' && (
                      <TradingChart
                        symbol={liveSelectedStock.stockCode}
                        price={liveSelectedStock.currentPrice}
                        changeRate={liveSelectedStock.changeRate}
                        assetType={isSelectedStock ? 'STOCK' : undefined}
                      />
                    )}

                    {/* 주문 내역 */}
                    {activeTab === 'orders' && (
                      orders.length === 0 ? (
                        <div className="py-12 text-center text-gray-400 text-sm">주문 내역이 없습니다</div>
                      ) : (
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                          {orders.map(order => {
                            const st = getStatusLabel(order.status);
                            const name = getDisplayName(order.stockCode, order.stockName, order.assetType);
                            return (
                              <div key={order.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                                <div className="flex items-center gap-3">
                                  <span className={`px-2 py-1 text-xs font-bold rounded ${order.orderType === 'BUY' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                                    {order.orderType === 'BUY' ? '매수' : '매도'}
                                  </span>
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-sm font-semibold">{name}</span>
                                      {order.assetType === 'STOCK' && <span className="text-[9px] bg-indigo-50 text-indigo-600 px-1 py-0.5 rounded">주식</span>}
                                    </div>
                                    <div className="text-xs text-gray-400">
                                      {order.orderMethod === 'MARKET' ? '시장가' : '지정가'} · {order.assetType === 'STOCK' ? `${Math.floor(order.quantity)}주` : `${formatQuantity(order.quantity)}개`} · {fmt(order.price)}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 text-xs font-semibold rounded ${st.cls}`}>{st.label}</span>
                                  {order.status === 'PENDING' && (
                                    <button onClick={() => handleCancelOrder(order.id)} className="text-xs text-red-500 hover:text-red-700 font-semibold">취소</button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )
                    )}

                    {/* 체결 내역 */}
                    {activeTab === 'trades' && (
                      trades.length === 0 ? (
                        <div className="py-12 text-center text-gray-400 text-sm">체결 내역이 없습니다</div>
                      ) : (
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                          {trades.map(trade => {
                            const name = getDisplayName(trade.stockCode, trade.stockName, trade.assetType);
                            return (
                              <div key={trade.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                                <div className="flex items-center gap-3">
                                  <span className={`px-2 py-1 text-xs font-bold rounded ${trade.orderType === 'BUY' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                                    {trade.orderType === 'BUY' ? '매수' : '매도'}
                                  </span>
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-sm font-semibold">{name}</span>
                                      {trade.assetType === 'STOCK' && <span className="text-[9px] bg-indigo-50 text-indigo-600 px-1 py-0.5 rounded">주식</span>}
                                    </div>
                                    <div className="text-xs text-gray-400">
                                      {trade.assetType === 'STOCK' ? `${Math.floor(trade.quantity)}주` : `${formatQuantity(trade.quantity)}개`} · {fmt(trade.price)}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-semibold">{fmt(trade.totalAmount)}</div>
                                  <div className="text-xs text-gray-400">
                                    {new Date(trade.executedAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )
                    )}

                    {/* 보유 종목 */}
                    {activeTab === 'holdings' && portfolio && (
                      portfolio.holdings.length === 0 ? (
                        <div className="py-12 text-center text-gray-400 text-sm">보유 종목이 없습니다</div>
                      ) : (
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                          {portfolio.holdings.map(h => {
                            const name = getDisplayName(h.stockCode, h.stockName, h.assetType);
                            return (
                              <div
                                key={h.stockCode}
                                onClick={() => {
                                  const stock = mergedStockList.find(s => s.stockCode === h.stockCode);
                                  if (stock) handleStockSelect(stock);
                                }}
                                className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                              >
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-semibold">{name}</span>
                                    {h.assetType === 'STOCK' && <span className="text-[9px] bg-indigo-50 text-indigo-600 px-1 py-0.5 rounded">주식</span>}
                                  </div>
                                  <div className="text-xs text-gray-400">
                                    {h.assetType === 'STOCK' ? `${Math.floor(h.quantity)}주` : `${formatQuantity(h.quantity)}개`} · 평단 {fmt(h.averagePrice)}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-semibold">{fmt(h.marketValue)}</div>
                                  <div className={`text-xs font-semibold ${h.returnRate >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                                    {h.returnRate >= 0 ? '+' : ''}{h.returnRate.toFixed(2)}%
                                    <span className="text-gray-400 font-normal ml-1">({h.profitLoss >= 0 ? '+' : ''}{fmt(Math.round(h.profitLoss))})</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ━━━ 우측: 주문 폼 + 포트폴리오 (4칸) ━━━ */}
          <div className="lg:col-span-4 space-y-4">
            {liveSelectedStock && (
              <div className="bg-white rounded-xl shadow-lg p-5">
                {/* 매수/매도 토글 */}
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => { setOrderType('BUY'); setQuantity(''); setLimitPrice(''); }}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
                      orderType === 'BUY'
                        ? 'bg-red-500 text-white shadow-lg shadow-red-200'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    매수
                  </button>
                  <button
                    onClick={() => { setOrderType('SELL'); setQuantity(''); setLimitPrice(''); }}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
                      orderType === 'SELL'
                        ? 'bg-blue-500 text-white shadow-lg shadow-blue-200'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    매도
                  </button>
                </div>

                {/* 시장가/지정가 */}
                <div className="flex gap-2 mb-4">
                  {(['MARKET', 'LIMIT'] as const).map(method => (
                    <button
                      key={method}
                      onClick={() => setOrderMethod(method)}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                        orderMethod === method
                          ? 'bg-whale-dark text-white'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {method === 'MARKET' ? '시장가' : '지정가'}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleOrderSubmit} className="space-y-3">
                  {/* 주문 가격 */}
                  <div className="bg-gray-50 rounded-xl p-3">
                    <div className="text-xs text-gray-400 mb-1">
                      {orderMethod === 'MARKET' ? '현재가 (시장가)' : '지정가'}
                    </div>
                    {orderMethod === 'MARKET' ? (
                      <div className="text-lg font-bold text-whale-dark">{fmt(liveSelectedStock.currentPrice)}</div>
                    ) : (
                      <input
                        type="number"
                        value={limitPrice}
                        onChange={e => setLimitPrice(e.target.value)}
                        placeholder="희망 가격 입력"
                        className="w-full text-lg font-bold text-whale-dark bg-transparent border-none outline-none placeholder:text-gray-300 placeholder:font-normal"
                        step={isSelectedStock ? '1' : '1'}
                      />
                    )}
                  </div>

                  {/* 수량 */}
                  <div className="bg-gray-50 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-400">수량 {isSelectedStock ? '(주)' : ''}</span>
                      <span className="text-xs text-gray-400">
                        {orderType === 'BUY'
                          ? `잔고: ${fmt(portfolio?.cashBalance || 0)}`
                          : `보유: ${isSelectedStock ? `${Math.floor(getAvailableQuantity(liveSelectedStock.stockCode))}주` : `${formatQuantity(getAvailableQuantity(liveSelectedStock.stockCode))}개`}`
                        }
                      </span>
                    </div>
                    <input
                      type="number"
                      value={quantity}
                      onChange={e => setQuantity(e.target.value)}
                      placeholder={isSelectedStock ? '주 수 입력' : '수량 입력'}
                      className="w-full text-lg font-bold text-whale-dark bg-transparent border-none outline-none placeholder:text-gray-300 placeholder:font-normal"
                      min="0"
                      step={isSelectedStock ? '1' : 'any'}
                    />
                    {/* 빠른 수량 버튼 */}
                    <div className="flex gap-1.5 mt-2">
                      {[
                        { label: '10%', value: 0.1 },
                        { label: '25%', value: 0.25 },
                        { label: '50%', value: 0.5 },
                        { label: '100%', value: 1.0 },
                      ].map(btn => (
                        <button
                          key={btn.label}
                          type="button"
                          onClick={() => setQuickQuantity(btn.value)}
                          className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-white border border-gray-200 text-gray-500 hover:border-whale-light hover:text-whale-light transition-colors"
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 예상 금액 */}
                  {estimatedTotal > 0 && (
                    <div className={`rounded-xl p-3 ${orderType === 'BUY' ? 'bg-red-50' : 'bg-blue-50'}`}>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">예상 금액</span>
                        <span className={`text-lg font-bold ${orderType === 'BUY' ? 'text-red-600' : 'text-blue-600'}`}>
                          {fmt(Math.round(estimatedTotal))}
                        </span>
                      </div>
                      <div className="text-right text-[10px] text-gray-400 mt-0.5">수수료 0.1% 포함</div>
                    </div>
                  )}

                  {/* 주문 버튼 */}
                  <button
                    type="submit"
                    disabled={isSubmitting || !quantity || parseFloat(quantity) <= 0}
                    className={`w-full py-3.5 rounded-xl font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                      orderType === 'BUY'
                        ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-lg shadow-red-200'
                        : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-200'
                    }`}
                  >
                    {isSubmitting
                      ? '주문 처리 중...'
                      : `${selectedDisplayName} ${orderType === 'BUY' ? '매수' : '매도'}`
                    }
                  </button>
                </form>
              </div>
            )}

            {/* 포트폴리오 요약 */}
            {portfolio && (
              <div className="bg-white rounded-xl shadow-lg p-5">
                <h3 className="text-sm font-bold text-whale-dark mb-3">내 포트폴리오</h3>
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">총 자산</span>
                    <span className="text-sm font-bold text-whale-dark">{fmt(portfolio.totalValue)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">현금</span>
                    <span className="text-sm font-semibold">{fmt(portfolio.cashBalance)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">평가 손익</span>
                    <span className={`text-sm font-bold ${portfolio.returnRate >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                      {portfolio.returnRate >= 0 ? '+' : ''}{portfolio.returnRate.toFixed(2)}%
                      <span className="text-gray-400 font-normal text-xs ml-1">
                        ({portfolio.returnRate >= 0 ? '+' : ''}{fmt(Math.round(portfolio.totalValue - (portfolio.initialCash || 10_000_000)))})
                      </span>
                    </span>
                  </div>
                  {(portfolio.turtleAllocated || 0) > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-400">터틀 전략</span>
                      <span className="text-sm font-semibold text-amber-600">{fmt(portfolio.turtleAllocated)}</span>
                    </div>
                  )}
                </div>

                {/* 보유 종목 미니 리스트 */}
                {portfolio.holdings.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="text-xs text-gray-400 mb-2">보유 종목</div>
                    <div className="space-y-1.5">
                      {portfolio.holdings.slice(0, 5).map(h => {
                        const name = getDisplayName(h.stockCode, h.stockName, h.assetType);
                        return (
                          <div
                            key={h.stockCode}
                            onClick={() => {
                              const stock = mergedStockList.find(s => s.stockCode === h.stockCode);
                              if (stock) handleStockSelect(stock);
                            }}
                            className="flex justify-between items-center py-1 cursor-pointer hover:bg-gray-50 rounded px-1 -mx-1 transition-colors"
                          >
                            <span className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                              {name}
                              {h.assetType === 'STOCK' && <span className="text-[8px] bg-indigo-50 text-indigo-600 px-1 rounded">주식</span>}
                            </span>
                            <span className={`text-xs font-semibold ${h.returnRate >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                              {h.returnRate >= 0 ? '+' : ''}{h.returnRate.toFixed(1)}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 토스트 애니메이션 */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translate(-50%, -10px); } to { opacity: 1; transform: translate(-50%, 0); } }
        .animate-fade-in { animation: fadeIn 0.3s ease-out; }
      `}</style>
    </div>
  );
};

export default TradePage;
