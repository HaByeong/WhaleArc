import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import VirtSplashLoading from '../components/VirtSplashLoading';
import SplashLoading from '../components/SplashLoading';
import ErrorMessage from '../components/ErrorMessage';
import UnstableCurrent from '../components/UnstableCurrent';
import { usePolling } from '../hooks/usePolling';
import { useRealtimePrice } from '../hooks/useRealtimePrice';
import { useRoutePrefix, useVirtNavigate } from '../hooks/useRoutePrefix';
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

/* ─── 인기 가상화폐 (종목 목록 상단 고정) ─── */
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
  const { isVirt } = useRoutePrefix();
  const d = !isVirt; // dark mode flag
  const _virtNavigate = useVirtNavigate(); void _virtNavigate;
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

  const [orderMemo, setOrderMemo] = useState('');

  // 가격 알림
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertTargetPrice, setAlertTargetPrice] = useState('');
  const [alertCondition, setAlertCondition] = useState<'ABOVE' | 'BELOW'>('ABOVE');
  const [priceAlerts, setPriceAlerts] = useState<any[]>([]);

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

  // WebSocket 실시간 가격 (가상화폐만)
  const { prices: realtimePrices } = useRealtimePrice({ enabled: marketTab === 'CRYPTO' });

  // 실시간 가격을 종목 목록에 병합 (가상화폐만)
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
      setError(err.message || '종목 데이터를 불러오지 못했습니다. 네트워크 연결을 확인해주세요.');
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

  usePolling(pollStockPrices, 10000);

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
        memo: orderMemo || undefined,
      };
      await tradeService.createOrder(orderRequest);
      setQuantity('');
      setLimitPrice('');
      setOrderMemo('');
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
    const map: Record<string, { label: string; cls: string }> = d ? {
      FILLED: { label: '체결', cls: 'bg-green-500/10 text-green-400' },
      PENDING: { label: '대기', cls: 'bg-amber-500/10 text-amber-400' },
      CANCELLED: { label: '취소', cls: 'bg-white/[0.04] text-slate-500' },
      PARTIALLY_FILLED: { label: '부분체결', cls: 'bg-blue-500/10 text-blue-400' },
    } : {
      FILLED: { label: '체결', cls: 'bg-green-50 text-green-700' },
      PENDING: { label: '대기', cls: 'bg-amber-50 text-amber-700' },
      CANCELLED: { label: '취소', cls: 'bg-gray-100 text-gray-500' },
      PARTIALLY_FILLED: { label: '부분체결', cls: 'bg-blue-50 text-blue-700' },
    };
    return map[status] || { label: status, cls: d ? 'bg-white/[0.04] text-slate-500' : 'bg-gray-100 text-gray-600' };
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

  // 인기 가상화폐를 상단에 정렬 (가상화폐만)
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
    if (!isVirt) return <SplashLoading message="거래 데이터를 불러오는 중..." />;
    return <VirtSplashLoading message="거래 데이터를 불러오는 중..." />;
  }
  if (error && stockList.length === 0) {
    return (
      <div className={`min-h-screen ${isVirt ? 'bg-gray-50' : 'bg-[#060d18] text-white'}`}>
        <Header showNav />
        <div className="max-w-7xl mx-auto px-4 py-8">
          {!isVirt ? (
            <UnstableCurrent message="해류가 불안정합니다" sub={error || '데이터를 다시 불러오고 있어요...'} />
          ) : (
            <ErrorMessage message={error} onRetry={loadInitialData} variant="offline" />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isVirt ? 'bg-gray-50' : 'bg-[#060d18] text-white'}`}>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">

          {/* ━━━ 좌측: 종목 목록 (3칸) ━━━ */}
          <div className="md:col-span-1 lg:col-span-3 space-y-4">
            {/* 가상화폐/주식 탭 */}
            <div className={`flex gap-1 rounded-xl p-1 ${d ? 'bg-white/[0.04]' : 'bg-gray-100'}`}>
              <button
                onClick={() => setMarketTab('CRYPTO')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                  marketTab === 'CRYPTO'
                    ? (d ? 'bg-white/10 text-cyan-400' : 'bg-white text-whale-dark shadow-sm')
                    : (d ? 'text-slate-500 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600')
                }`}
              >
                가상화폐
              </button>
              <button
                onClick={() => setMarketTab('STOCK')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                  marketTab === 'STOCK'
                    ? (d ? 'bg-white/10 text-cyan-400' : 'bg-white text-whale-dark shadow-sm')
                    : (d ? 'text-slate-500 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600')
                }`}
              >
                주식
              </button>
            </div>

            {/* 검색 */}
            <div className="relative">
              <svg className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${d ? 'text-slate-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={e => marketTab === 'STOCK' ? handleStockSearch(e.target.value) : setSearchQuery(e.target.value)}
                placeholder={marketTab === 'CRYPTO' ? '가상화폐 검색 (비트코인, ETH...)' : '전체 KOSPI/KOSDAQ 종목 검색...'}
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-whale-light/50 focus:border-whale-light ${
                  d ? 'bg-white/[0.04] border-white/10 text-white placeholder-slate-600' : 'border-gray-200'
                }`}
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(''); setStockSearchResults([]); }} className={`absolute right-3 top-1/2 -translate-y-1/2 ${d ? 'text-slate-500 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600'}`}>
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
                <div className={`absolute top-full left-0 right-0 mt-1 rounded-xl shadow-xl border z-20 max-h-60 overflow-y-auto ${
                  d ? 'bg-[#0c1829] border-white/[0.06]' : 'bg-white border-gray-200'
                }`}>
                  {stockSearchResults.map(r => (
                    <div
                      key={r.code}
                      onClick={() => handleSearchResultClick(r)}
                      className={`px-4 py-2.5 cursor-pointer transition-colors flex justify-between items-center ${
                        d ? 'hover:bg-white/[0.03]' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div>
                        <span className={`text-sm font-semibold ${d ? 'text-slate-100' : 'text-gray-800'}`}>{r.name}</span>
                        <span className={`text-xs ml-2 ${d ? 'text-slate-500' : 'text-gray-400'}`}>{r.code}</span>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${d ? 'text-slate-500 bg-white/[0.04]' : 'text-gray-400 bg-gray-100'}`}>{r.market}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 종목 리스트 */}
            <div className={`rounded-xl shadow-lg overflow-hidden ${d ? 'border border-white/[0.06] bg-white/[0.02]' : 'bg-white'}`}>
              <div className="px-4 py-3 bg-gradient-to-r from-whale-dark to-whale-light">
                <div className="flex items-center justify-between text-white">
                  <span className="text-sm font-semibold">{marketTab === 'CRYPTO' ? '가상화폐' : '주식'}</span>
                  <span className="text-xs opacity-80">{sortedStocks.length}개</span>
                </div>
              </div>
              <div className={`max-h-[calc(100vh-320px)] overflow-y-auto divide-y ${d ? 'divide-white/[0.04]' : 'divide-gray-50'}`}>
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
                          ? (d ? 'bg-cyan-500/10 border-l-3 border-l-cyan-400' : 'bg-whale-light/10 border-l-3 border-l-whale-light')
                          : (d ? 'hover:bg-white/[0.03]' : 'hover:bg-gray-50')
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`font-semibold text-sm truncate ${isSelected ? (d ? 'text-cyan-400' : 'text-whale-dark') : (d ? 'text-slate-100' : 'text-gray-800')}`}>
                              {name}
                            </span>
                            {isPopular && (
                              <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-amber-400" />
                            )}
                          </div>
                          <span className={`text-xs ${d ? 'text-slate-500' : 'text-gray-400'}`}>{stock.stockCode}</span>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <div className={`text-sm font-semibold ${d ? 'text-slate-100' : 'text-gray-800'}`}>{fmt(stock.currentPrice)}</div>
                          <div className={`text-xs font-semibold ${stock.changeRate >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                            {stock.changeRate >= 0 ? '+' : ''}{stock.changeRate.toFixed(2)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {sortedStocks.length === 0 && (
                  <div className={`p-6 text-center text-sm ${d ? 'text-slate-500' : 'text-gray-400'}`}>검색 결과가 없습니다</div>
                )}
              </div>
              {marketTab === 'STOCK' && (
                <p className={`text-[10px] text-right px-4 py-1.5 ${d ? 'text-slate-600' : 'text-gray-400'}`}>
                  * 주식 시세는 KIS 모의투자 API 기준 약 15~20초 지연
                </p>
              )}
            </div>
          </div>

          {/* ━━━ 중앙: 차트 + 탭 내용 (5칸) ━━━ */}
          <div className="md:col-span-1 lg:col-span-5 space-y-4">
            {!liveSelectedStock ? (
              <div className={`rounded-xl shadow-lg flex flex-col items-center justify-center py-24 px-6 ${d ? 'border border-white/[0.06] bg-white/[0.02]' : 'bg-white'}`}>
                <svg className={`w-16 h-16 mb-4 ${d ? 'text-slate-700' : 'text-gray-200'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13l4-4 4 4 4-8 4 4m1 7H4a1 1 0 01-1-1V4" />
                </svg>
                <p className={`text-sm font-semibold mb-1 ${d ? 'text-slate-400' : 'text-gray-400'}`}>종목이 선택되지 않았습니다</p>
                <p className={`text-xs ${d ? 'text-slate-600' : 'text-gray-300'}`}>좌측에서 종목을 선택해주세요</p>
              </div>
            ) : (
              <>
                {/* 종목 헤더 */}
                <div className={`rounded-xl shadow-lg p-5 ${d ? 'border border-white/[0.06] bg-white/[0.02]' : 'bg-white'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className={`text-xl font-bold ${d ? 'text-white' : 'text-whale-dark'}`}>{selectedDisplayName}</h2>
                        {isSelectedStock && (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${d ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>주식</span>
                        )}
                        <button
                          onClick={() => {
                            const next = !showAlertModal;
                            setShowAlertModal(next);
                            setAlertTargetPrice('');
                            if (next) { tradeService.getPriceAlerts().then(a => setPriceAlerts(a || [])).catch(e => console.error('알림 로드 실패:', e)); }
                          }}
                          title="가격 알림 설정"
                          className={`p-1.5 rounded-lg transition-colors ${
                            showAlertModal
                              ? (d ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-600')
                              : (d ? 'hover:bg-white/[0.06] text-slate-500 hover:text-yellow-400' : 'hover:bg-gray-100 text-gray-400 hover:text-yellow-500')
                          }`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                          </svg>
                        </button>
                      </div>
                      <span className={`text-sm ${d ? 'text-slate-500' : 'text-gray-400'}`}>
                        {isSelectedStock ? `${liveSelectedStock.stockCode} · KRX` : `${liveSelectedStock.stockCode}/KRW`}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${d ? 'text-white' : 'text-whale-dark'}`}>{fmt(liveSelectedStock.currentPrice)}</div>
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
                        { label: '시가', value: fmt(liveSelectedStock.open), cls: d ? 'text-slate-300' : 'text-gray-700' },
                        { label: '거래량', value: fmtNum(liveSelectedStock.volume), cls: d ? 'text-slate-300' : 'text-gray-700' },
                      ].map(item => (
                        <div key={item.label} className={`rounded-lg p-2 text-center ${d ? 'bg-white/[0.04]' : 'bg-gray-50'}`}>
                          <div className={`text-[10px] mb-0.5 ${d ? 'text-slate-500' : 'text-gray-400'}`}>{item.label}</div>
                          <div className={`text-xs font-semibold ${item.cls}`}>{item.value}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {isSelectedStock && (
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: '거래량', value: fmtNum(liveSelectedStock.volume), cls: d ? 'text-slate-300' : 'text-gray-700' },
                        { label: '전일 종가', value: fmt(liveSelectedStock.previousClose), cls: d ? 'text-slate-300' : 'text-gray-700' },
                      ].map(item => (
                        <div key={item.label} className={`rounded-lg p-2 text-center ${d ? 'bg-white/[0.04]' : 'bg-gray-50'}`}>
                          <div className={`text-[10px] mb-0.5 ${d ? 'text-slate-500' : 'text-gray-400'}`}>{item.label}</div>
                          <div className={`text-xs font-semibold ${item.cls}`}>{item.value}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* 가격 알림 패널 */}
                  {showAlertModal && (
                    <div className={`mt-3 rounded-xl p-4 ${d ? 'bg-white/[0.04] border border-white/[0.08]' : 'bg-yellow-50 border border-yellow-100'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className={`text-sm font-bold ${d ? 'text-yellow-400' : 'text-yellow-700'}`}>가격 알림 설정</h4>
                        <button onClick={() => setShowAlertModal(false)} className={`text-xs ${d ? 'text-slate-500 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600'}`}>닫기</button>
                      </div>
                      <div className="flex gap-2 mb-3">
                        <input
                          type="number"
                          placeholder="목표 가격"
                          value={alertTargetPrice}
                          onChange={(e) => setAlertTargetPrice(e.target.value)}
                          className={`flex-1 text-sm rounded-lg px-3 py-2 outline-none ${
                            d ? 'bg-white/[0.06] text-slate-200 border border-white/[0.08] focus:border-yellow-500/40'
                              : 'bg-white text-gray-700 border border-gray-200 focus:border-yellow-400'
                          }`}
                        />
                        <div className="flex rounded-lg overflow-hidden">
                          {(['ABOVE', 'BELOW'] as const).map(cond => (
                            <button
                              key={cond}
                              type="button"
                              onClick={() => setAlertCondition(cond)}
                              className={`px-3 py-2 text-xs font-semibold transition-colors ${
                                alertCondition === cond
                                  ? (d ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-200 text-yellow-800')
                                  : (d ? 'bg-white/[0.04] text-slate-500 hover:bg-white/[0.06]' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')
                              }`}
                            >
                              {cond === 'ABOVE' ? '이상' : '이하'}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!alertTargetPrice || parseFloat(alertTargetPrice) <= 0 || !liveSelectedStock) return;
                          try {
                            await tradeService.createPriceAlert({
                              stockCode: liveSelectedStock.stockCode,
                              stockName: isSelectedStock ? liveSelectedStock.stockName : assetName(liveSelectedStock.stockCode),
                              assetType: isSelectedStock ? 'STOCK' : 'CRYPTO',
                              condition: alertCondition,
                              targetPrice: parseFloat(alertTargetPrice),
                            });
                            showToast('가격 알림이 설정되었습니다.', 'success');
                            setAlertTargetPrice('');
                            try { const alerts = await tradeService.getPriceAlerts(); setPriceAlerts(alerts || []); } catch (e) { console.error('알림 갱신 실패:', e); }
                          } catch { showToast('알림 설정에 실패했습니다.', 'error'); }
                        }}
                        disabled={!alertTargetPrice || parseFloat(alertTargetPrice) <= 0}
                        className={`w-full py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-40 ${
                          d ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30' : 'bg-yellow-400 text-yellow-900 hover:bg-yellow-500'
                        }`}
                      >
                        알림 설정
                      </button>
                      {priceAlerts.filter((a: any) => a.stockCode === liveSelectedStock.stockCode).length > 0 && (
                        <div className="mt-3 space-y-1.5">
                          <div className={`text-[10px] font-semibold ${d ? 'text-slate-500' : 'text-gray-400'}`}>설정된 알림</div>
                          {priceAlerts.filter((a: any) => a.stockCode === liveSelectedStock.stockCode).map((alert: any) => (
                            <div key={alert.id} className={`flex items-center justify-between text-xs px-2 py-1.5 rounded-lg ${d ? 'bg-white/[0.04]' : 'bg-white'}`}>
                              <span className={d ? 'text-slate-300' : 'text-gray-600'}>
                                {fmt(alert.targetPrice)} {alert.condition === 'ABOVE' ? '이상' : '이하'}
                              </span>
                              <button
                                onClick={async () => {
                                  try {
                                    await tradeService.deletePriceAlert(alert.id);
                                    setPriceAlerts(prev => prev.filter((a: any) => a.id !== alert.id));
                                    showToast('알림이 삭제되었습니다.');
                                  } catch (e) { console.error('알림 삭제 실패:', e); }
                                }}
                                className={`text-[10px] ${d ? 'text-red-400 hover:text-red-300' : 'text-red-500 hover:text-red-600'}`}
                              >
                                삭제
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 탭 */}
                <div className={`rounded-xl shadow-lg overflow-hidden ${d ? 'border border-white/[0.06] bg-white/[0.02]' : 'bg-white'}`}>
                  <div className={`flex border-b ${d ? 'border-white/[0.06]' : 'border-gray-100'}`}>
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
                            ? (d ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/5' : 'text-whale-light border-b-2 border-whale-light bg-whale-light/5')
                            : (d ? 'text-slate-500 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600')
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="p-4">
                    {/* 차트 탭 */}
                    {activeTab === 'chart' && (
                      <>
                        <TradingChart
                          symbol={liveSelectedStock.stockCode}
                          price={liveSelectedStock.currentPrice}
                          changeRate={liveSelectedStock.changeRate}
                          assetType={isSelectedStock ? 'STOCK' : undefined}
                          isDark={!isVirt}
                        />
                      </>
                    )}

                    {/* 주문 내역 */}
                    {activeTab === 'orders' && (
                      orders.length === 0 ? (
                        <div className={`py-12 text-center text-sm ${d ? 'text-slate-500' : 'text-gray-400'}`}>주문 내역이 없습니다</div>
                      ) : (
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                          {orders.map(order => {
                            const st = getStatusLabel(order.status);
                            const name = getDisplayName(order.stockCode, order.stockName, order.assetType);
                            return (
                              <div key={order.id} className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                                d ? 'border-white/[0.06] hover:bg-white/[0.03]' : 'border-gray-100 hover:bg-gray-50'
                              }`}>
                                <div className="flex items-center gap-3">
                                  <span className={`px-2 py-1 text-xs font-bold rounded ${order.orderType === 'BUY' ? (d ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600') : (d ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600')}`}>
                                    {order.orderType === 'BUY' ? '매수' : '매도'}
                                  </span>
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span className={`text-sm font-semibold ${d ? 'text-slate-100' : ''}`}>{name}</span>
                                      {order.assetType === 'STOCK' && <span className={`text-[9px] px-1 py-0.5 rounded ${d ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>주식</span>}
                                    </div>
                                    <div className={`text-xs ${d ? 'text-slate-500' : 'text-gray-400'}`}>
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
                        <div className={`py-12 text-center text-sm ${d ? 'text-slate-500' : 'text-gray-400'}`}>체결 내역이 없습니다</div>
                      ) : (
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                          {trades.map(trade => {
                            const name = getDisplayName(trade.stockCode, trade.stockName, trade.assetType);
                            return (
                              <div key={trade.id} className={`p-3 rounded-lg border transition-colors ${
                                d ? 'border-white/[0.06] hover:bg-white/[0.03]' : 'border-gray-100 hover:bg-gray-50'
                              }`}>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <span className={`px-2 py-1 text-xs font-bold rounded ${trade.orderType === 'BUY' ? (d ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600') : (d ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600')}`}>
                                      {trade.orderType === 'BUY' ? '매수' : '매도'}
                                    </span>
                                    <div>
                                      <div className="flex items-center gap-1.5">
                                        <span className={`text-sm font-semibold ${d ? 'text-slate-100' : ''}`}>{name}</span>
                                        {trade.assetType === 'STOCK' && <span className={`text-[9px] px-1 py-0.5 rounded ${d ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>주식</span>}
                                      </div>
                                      <div className={`text-xs ${d ? 'text-slate-500' : 'text-gray-400'}`}>
                                        {trade.assetType === 'STOCK' ? `${Math.floor(trade.quantity)}주` : `${formatQuantity(trade.quantity)}개`} · {fmt(trade.price)}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className={`text-sm font-semibold ${d ? 'text-slate-100' : ''}`}>{fmt(trade.totalAmount)}</div>
                                    <div className={`text-xs ${d ? 'text-slate-500' : 'text-gray-400'}`}>
                                      {new Date(trade.executedAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                  </div>
                                </div>
                                {trade.memo && (
                                  <div className={`mt-1.5 text-[11px] italic ${d ? 'text-slate-500' : 'text-gray-400'}`}>
                                    {'\u{1F4DD}'} {trade.memo}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )
                    )}

                    {/* 보유 종목 */}
                    {activeTab === 'holdings' && portfolio && (
                      portfolio.holdings.length === 0 ? (
                        <div className="py-12 text-center">
                          <svg className={`w-10 h-10 mx-auto mb-3 ${d ? 'text-slate-700' : 'text-gray-200'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                          <p className={`text-sm ${d ? 'text-slate-400' : 'text-gray-400'}`}>보유 종목이 없습니다</p>
                          <p className={`text-xs mt-1 ${d ? 'text-slate-600' : 'text-gray-300'}`}>시세 탭에서 종목을 검색하고 매수해보세요</p>
                        </div>
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
                                className={`flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer ${
                                  d ? 'border-white/[0.06] hover:bg-white/[0.03]' : 'border-gray-100 hover:bg-gray-50'
                                }`}
                              >
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className={`text-sm font-semibold ${d ? 'text-slate-100' : ''}`}>{name}</span>
                                    {h.assetType === 'STOCK' && <span className={`text-[9px] px-1 py-0.5 rounded ${d ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>주식</span>}
                                  </div>
                                  <div className={`text-xs ${d ? 'text-slate-500' : 'text-gray-400'}`}>
                                    {h.assetType === 'STOCK' ? `${Math.floor(h.quantity)}주` : `${formatQuantity(h.quantity)}개`} · 평단 {fmt(h.averagePrice)}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className={`text-sm font-semibold ${d ? 'text-slate-100' : ''}`}>{fmt(h.marketValue)}</div>
                                  <div className={`text-xs font-semibold ${h.returnRate >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                                    {h.returnRate >= 0 ? '+' : ''}{h.returnRate.toFixed(2)}%
                                    <span className={`font-normal ml-1 ${d ? 'text-slate-500' : 'text-gray-400'}`}>({h.profitLoss >= 0 ? '+' : ''}{fmt(Math.round(h.profitLoss))})</span>
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
          <div className="md:col-span-2 lg:col-span-4 space-y-4">
            {!isVirt ? (
              <div className={`rounded-xl shadow-lg flex flex-col items-center justify-center py-16 px-6 text-center ${d ? 'border border-white/[0.06] bg-white/[0.02]' : 'bg-white'}`}>
                <img src="/whales/gray-whale.png" alt="" className="w-16 h-16 object-contain mb-4 opacity-60" />
                <h3 className={`text-lg font-bold mb-2 ${d ? 'text-white' : 'text-whale-dark'}`}>가상 거래는 Virt에서 이용하세요</h3>
                <p className={`text-sm mb-5 ${d ? 'text-slate-400' : 'text-gray-400'}`}>가상돈으로 매수/매도 주문을 체험하고 전략을 테스트해보세요</p>
                <button
                  onClick={() => window.location.href = '/virt/trade' + (urlCode ? `?code=${urlCode}&type=${urlType || 'CRYPTO'}` : '')}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-500 text-white font-bold rounded-xl hover:bg-cyan-600 transition-colors"
                >
                  Virt에서 거래하기
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                </button>
              </div>
            ) : !liveSelectedStock ? (
              <div className={`rounded-xl shadow-lg flex flex-col items-center justify-center py-16 px-6 ${d ? 'border border-white/[0.06] bg-white/[0.02]' : 'bg-white'}`}>
                <svg className={`w-12 h-12 mb-3 ${d ? 'text-slate-700' : 'text-gray-200'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
                <p className={`text-sm font-semibold mb-1 ${d ? 'text-slate-400' : 'text-gray-400'}`}>주문 패널</p>
                <p className={`text-xs ${d ? 'text-slate-600' : 'text-gray-300'}`}>좌측에서 종목을 선택해주세요</p>
              </div>
            ) : (
              <div className={`rounded-xl shadow-lg p-5 ${d ? 'border border-white/[0.06] bg-white/[0.02]' : 'bg-white'}`}>
                {/* 매수/매도 토글 */}
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => { setOrderType('BUY'); setQuantity(''); setLimitPrice(''); }}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
                      orderType === 'BUY'
                        ? (d ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'bg-red-500 text-white shadow-lg shadow-red-200')
                        : (d ? 'bg-white/[0.04] text-slate-500 hover:bg-white/[0.06]' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')
                    }`}
                  >
                    매수
                  </button>
                  <button
                    onClick={() => { setOrderType('SELL'); setQuantity(''); setLimitPrice(''); }}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
                      orderType === 'SELL'
                        ? (d ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-blue-500 text-white shadow-lg shadow-blue-200')
                        : (d ? 'bg-white/[0.04] text-slate-500 hover:bg-white/[0.06]' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')
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
                          ? (d ? 'bg-white/10 text-cyan-400' : 'bg-whale-dark text-white')
                          : (d ? 'bg-white/[0.04] text-slate-500 hover:bg-white/[0.06]' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')
                      }`}
                    >
                      {method === 'MARKET' ? '시장가' : '지정가'}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleOrderSubmit} className="space-y-3">
                  {/* 주문 가격 */}
                  <div className={`rounded-xl p-3 ${d ? 'bg-white/[0.04]' : 'bg-gray-50'}`}>
                    <div className={`text-xs mb-1 ${d ? 'text-slate-500' : 'text-gray-400'}`}>
                      {orderMethod === 'MARKET' ? '현재가 (시장가)' : '지정가'}
                    </div>
                    {orderMethod === 'MARKET' ? (
                      <div className={`text-lg font-bold ${d ? 'text-white' : 'text-whale-dark'}`}>{fmt(liveSelectedStock.currentPrice)}</div>
                    ) : (
                      <input
                        type="number"
                        value={limitPrice}
                        onChange={e => setLimitPrice(e.target.value)}
                        placeholder="희망 가격 입력"
                        className={`w-full text-lg font-bold bg-transparent border-none outline-none placeholder:font-normal ${
                          d ? 'text-white placeholder:text-slate-600' : 'text-whale-dark placeholder:text-gray-300'
                        }`}
                        step={isSelectedStock ? '1' : 'any'}
                      />
                    )}
                  </div>

                  {/* 수량 */}
                  <div className={`rounded-xl p-3 ${d ? 'bg-white/[0.04]' : 'bg-gray-50'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs ${d ? 'text-slate-500' : 'text-gray-400'}`}>수량 {isSelectedStock ? '(주)' : ''}</span>
                      <span className={`text-xs ${d ? 'text-slate-500' : 'text-gray-400'}`}>
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
                      className={`w-full text-lg font-bold bg-transparent border-none outline-none placeholder:font-normal ${
                        d ? 'text-white placeholder:text-slate-600' : 'text-whale-dark placeholder:text-gray-300'
                      }`}
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
                          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                            d
                              ? 'bg-white/[0.02] border-white/10 text-slate-400 hover:border-cyan-400 hover:text-cyan-400'
                              : 'bg-white border-gray-200 text-gray-500 hover:border-whale-light hover:text-whale-light'
                          }`}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 예상 금액 */}
                  {estimatedTotal > 0 && (
                    <div className={`rounded-xl p-3 ${orderType === 'BUY' ? (d ? 'bg-red-500/10' : 'bg-red-50') : (d ? 'bg-blue-500/10' : 'bg-blue-50')}`}>
                      <div className="flex justify-between items-center">
                        <span className={`text-xs ${d ? 'text-slate-400' : 'text-gray-500'}`}>예상 금액</span>
                        <span className={`text-lg font-bold ${orderType === 'BUY' ? (d ? 'text-red-400' : 'text-red-600') : (d ? 'text-blue-400' : 'text-blue-600')}`}>
                          {fmt(Math.round(estimatedTotal))}
                        </span>
                      </div>
                      <div className={`text-right text-[10px] mt-0.5 ${d ? 'text-slate-500' : 'text-gray-400'}`}>수수료 0.1% 포함</div>
                    </div>
                  )}

                  {/* 메모 입력 */}
                  <details className={`rounded-xl overflow-hidden ${d ? 'bg-white/[0.04]' : 'bg-gray-50'}`}>
                    <summary className={`cursor-pointer px-3 py-2 text-xs font-semibold select-none ${d ? 'text-slate-400 hover:text-slate-300' : 'text-gray-500 hover:text-gray-600'}`}>
                      메모 추가 (선택)
                    </summary>
                    <div className="px-3 pb-3">
                      <textarea
                        placeholder="이 거래에 대한 메모를 남겨보세요"
                        value={orderMemo}
                        onChange={(e) => setOrderMemo(e.target.value)}
                        maxLength={500}
                        rows={2}
                        className={`w-full text-xs rounded-lg p-2 resize-none outline-none transition-colors ${
                          d ? 'bg-white/[0.06] text-slate-200 placeholder-slate-600 border border-white/[0.08] focus:border-cyan-500/40'
                            : 'bg-white text-gray-700 placeholder-gray-400 border border-gray-200 focus:border-whale-dark/40'
                        }`}
                      />
                      <div className={`text-right text-[10px] mt-0.5 ${d ? 'text-slate-600' : 'text-gray-400'}`}>{orderMemo.length}/500</div>
                    </div>
                  </details>

                  {/* 투자 유의사항 */}
                  <p className={`text-[10px] leading-relaxed text-center px-2 ${d ? 'text-slate-600' : 'text-gray-400'}`}>
                    투자 판단의 최종 책임은 본인에게 있으며, WhaleArc는 투자 손실에 대해 책임지지 않습니다.
                  </p>

                  {/* 주문 버튼 */}
                  <button
                    type="submit"
                    disabled={isSubmitting || !quantity || parseFloat(quantity) <= 0}
                    className={`w-full py-3.5 rounded-xl font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                      orderType === 'BUY'
                        ? `bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-lg ${d ? 'shadow-red-500/20' : 'shadow-red-200'}`
                        : `bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg ${d ? 'shadow-blue-500/20' : 'shadow-blue-200'}`
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
              <div className={`rounded-xl shadow-lg p-5 ${d ? 'border border-white/[0.06] bg-white/[0.02]' : 'bg-white'}`}>
                <h3 className={`text-sm font-bold mb-3 ${d ? 'text-white' : 'text-whale-dark'}`}>내 포트폴리오</h3>
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className={`text-xs ${d ? 'text-slate-500' : 'text-gray-400'}`}>총 자산</span>
                    <span className={`text-sm font-bold ${d ? 'text-white' : 'text-whale-dark'}`}>{fmt(portfolio.totalValue)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={`text-xs ${d ? 'text-slate-500' : 'text-gray-400'}`}>현금</span>
                    <span className={`text-sm font-semibold ${d ? 'text-slate-100' : ''}`}>{fmt(portfolio.cashBalance)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={`text-xs ${d ? 'text-slate-500' : 'text-gray-400'}`}>평가 손익</span>
                    <span className={`text-sm font-bold ${portfolio.returnRate >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                      {portfolio.returnRate >= 0 ? '+' : ''}{portfolio.returnRate.toFixed(2)}%
                      <span className={`font-normal text-xs ml-1 ${d ? 'text-slate-500' : 'text-gray-400'}`}>
                        ({portfolio.returnRate >= 0 ? '+' : ''}{fmt(Math.round(portfolio.totalValue - (portfolio.initialCash || 10_000_000)))})
                      </span>
                    </span>
                  </div>
                  {(portfolio.turtleAllocated || 0) > 0 && (
                    <div className="flex justify-between items-center">
                      <span className={`text-xs ${d ? 'text-slate-500' : 'text-gray-400'}`}>터틀 전략</span>
                      <span className={`text-sm font-semibold ${d ? 'text-amber-400' : 'text-amber-600'}`}>{fmt(portfolio.turtleAllocated)}</span>
                    </div>
                  )}
                </div>

                {/* 보유 종목 미니 리스트 */}
                {portfolio.holdings.length > 0 && (
                  <div className={`mt-3 pt-3 border-t ${d ? 'border-white/[0.06]' : 'border-gray-100'}`}>
                    <div className={`text-xs mb-2 ${d ? 'text-slate-500' : 'text-gray-400'}`}>보유 종목</div>
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
                            className={`flex justify-between items-center py-1 cursor-pointer rounded px-1 -mx-1 transition-colors ${d ? 'hover:bg-white/[0.03]' : 'hover:bg-gray-50'}`}
                          >
                            <span className={`text-xs font-semibold flex items-center gap-1 ${d ? 'text-slate-300' : 'text-gray-700'}`}>
                              {name}
                              {h.assetType === 'STOCK' && <span className={`text-[8px] px-1 rounded ${d ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>주식</span>}
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
