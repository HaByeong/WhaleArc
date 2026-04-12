import { useState, useEffect, useMemo, useRef, useCallback, type ReactNode } from 'react';
import Header from '../components/Header';
import VirtSplashLoading from '../components/VirtSplashLoading';
import SplashLoading from '../components/SplashLoading';
import ErrorMessage from '../components/ErrorMessage';
import UnstableCurrent from '../components/UnstableCurrent';
import RealtimeChart from '../components/RealtimeChart';
import TradingChart from '../components/TradingChart';
import { marketService, type MarketPrice, type AssetType } from '../services/marketService';
import { userService } from '../services/userService';
import { useRealtimePrice } from '../hooks/useRealtimePrice';
import { useRoutePrefix } from '../hooks/useRoutePrefix';
import { useTheme } from '../contexts/ThemeContext';

/** 차트 로딩 래퍼: 데이터 로드 중일 때 placeholder를 보여주고, 로드 완료 후 차트를 표시 */
const ChartLoadingWrapper = ({ symbol, children, isDark }: { symbol: string; children: ReactNode; isDark: boolean }) => {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setReady(false);
    setFailed(false);
    // 차트 컴포넌트가 마운트될 최소 시간만 확보
    timerRef.current = setTimeout(() => setReady(true), 100);
    // 12초 내에 차트가 렌더되지 않으면 지연 안내 (주식은 API 응답이 느릴 수 있음)
    const failTimer = setTimeout(() => setFailed(true), 12000);
    return () => {
      clearTimeout(timerRef.current);
      clearTimeout(failTimer);
    };
  }, [symbol]);

  if (!ready) {
    return (
      <div>
        <div className={`rounded-xl p-10 text-center border ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-gray-50 border-gray-100'}`}>
          <div className={`inline-block w-5 h-5 border-2 border-t-transparent rounded-full animate-spin mb-3 ${isDark ? 'border-cyan-400' : 'border-whale-light'}`} />
          <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-400'}`}>차트 데이터를 불러오는 중입니다</div>
          <div className={`text-xs mt-1 ${isDark ? 'text-slate-600' : 'text-gray-300'}`}>잠시만 기다려주세요.</div>
          {failed && (
            <div className="text-yellow-500 text-xs mt-2">
              로드가 지연되고 있습니다. 네트워크 상태를 확인해주세요.
            </div>
          )}
        </div>
        {/* 차트를 숨긴 상태로 미리 렌더 */}
        <div className="h-0 overflow-hidden">{children}</div>
      </div>
    );
  }

  return <div>{children}</div>;
};

const MarketPage = () => {
  const { isVirt } = useRoutePrefix();
  const { isDark } = useTheme();
  const [assetType, setAssetType] = useState<AssetType>('STOCK');
  const [selectedAsset, setSelectedAsset] = useState<MarketPrice | null>(null);
  const [assetList, setAssetList] = useState<MarketPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'change' | 'volume'>('volume');
  const [filterText, setFilterText] = useState('');
  const [chartType, setChartType] = useState<'area' | 'candle'>('area');
  const [activeIndicators, setActiveIndicators] = useState<string[]>([]);
  const [showIndicatorPanel, setShowIndicatorPanel] = useState(false);
  const [listFilter, setListFilter] = useState<'all' | 'favorites'>('all');
  const [favoriteAssets, setFavoriteAssets] = useState<string[]>([]);

  // 탭별 데이터 캐시 (stale-while-revalidate)
  const assetCacheRef = useRef<Record<AssetType, MarketPrice[]>>({ STOCK: [], CRYPTO: [], US_STOCK: [] });
  const selectionCacheRef = useRef<Record<AssetType, MarketPrice | null>>({ STOCK: null, CRYPTO: null, US_STOCK: null });

  // 환율 상태 (미국주식 탭용)
  const [usdKrwRate, setUsdKrwRate] = useState<number>(1400);

  // 주식 종목 검색
  const [searchResults, setSearchResults] = useState<{ code: string; name: string; market: string }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();
  // 검색으로 추가된 종목을 추적 (시세 갱신 시에도 유지)
  const searchAddedRef = useRef<MarketPrice[]>([]);

  const handleStockSearch = useCallback((keyword: string) => {
    setFilterText(keyword);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    if ((assetType !== 'STOCK' && assetType !== 'US_STOCK') || keyword.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    // 항상 서버 검색 수행 (전체 KRX / US 종목 대상)
    searchTimerRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = assetType === 'US_STOCK'
          ? await marketService.searchUsStocks(keyword)
          : await marketService.searchStocks(keyword);
        // 이미 리스트에 있는 종목 제외
        const existing = new Set(assetList.map(a => a.symbol));
        setSearchResults(results.filter(r => !existing.has(r.code)));
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  }, [assetType, assetList]);

  const handleSearchResultClick = async (result: { code: string; name: string; market: string }) => {
    try {
      const price = await marketService.getStockPrice(result.code);
      searchAddedRef.current = [price, ...searchAddedRef.current.filter(a => a.symbol !== price.symbol)];
      setAssetList(prev => [price, ...prev.filter(a => a.symbol !== price.symbol)]);
      setSelectedAsset(price);
      setFilterText('');
      setSearchResults([]);
      // 최근 본 종목 저장
      try {
        const entry = { stockCode: price.symbol, stockName: price.name, assetType: price.assetType };
        const saved = localStorage.getItem('whalearc_recent_stocks');
        const prev2: { stockCode: string; stockName: string; assetType: string }[] = saved ? JSON.parse(saved) : [];
        const filtered = prev2.filter(r => r.stockCode !== entry.stockCode);
        const next = [entry, ...filtered].slice(0, 8);
        localStorage.setItem('whalearc_recent_stocks', JSON.stringify(next));
      } catch { /* ignore */ }
    } catch {
      setError('종목 시세 조회에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
  };

  // 관심 종목 로드 + 목록에 없는 종목은 검색해서 추가
  useEffect(() => {
    userService.getProfile().then(async (profile) => {
      const favs = profile?.favoriteAssets ?? [];
      if (favs.length === 0) return;
      setFavoriteAssets(favs);

      // 현재 목록에 없는 관심 종목을 개별 조회해서 추가
      const currentSymbols = new Set(assetList.map(a => a.symbol));
      const currentNames = new Set(assetList.map(a => a.name));
      const missing = favs.filter(f => !currentSymbols.has(f) && !currentNames.has(f) && !currentSymbols.has(f.toUpperCase()));

      const extra: MarketPrice[] = [];
      for (const fav of missing) {
        try {
          // 먼저 종목 검색으로 코드 찾기
          const results = await marketService.searchStocks(fav);
          if (results.length > 0) {
            const price = await marketService.getStockPrice(results[0].code);
            if (!currentSymbols.has(price.symbol)) extra.push(price);
          }
        } catch { /* 조회 실패 무시 */ }
      }
      if (extra.length > 0) {
        searchAddedRef.current = [...searchAddedRef.current, ...extra];
        setAssetList(prev => {
          const existing = new Set(prev.map(a => a.symbol));
          return [...prev, ...extra.filter(e => !existing.has(e.symbol))];
        });
      }
    }).catch(() => {});
  }, []);

  const SYMBOL_ALIASES: Record<string, string> = { MATIC: 'POL', POL: 'MATIC' };
  const favoriteSet = useMemo(() => {
    const set = new Set<string>();
    for (const fav of favoriteAssets) {
      set.add(fav);
      set.add(fav.toUpperCase());
      set.add(fav.toLowerCase());
      const alias = SYMBOL_ALIASES[fav];
      if (alias) { set.add(alias); set.add(alias.toLowerCase()); }
    }
    return set;
  }, [favoriteAssets]);

  const isFavorite = useCallback((asset: MarketPrice) => {
    return favoriteSet.has(asset.symbol) || favoriteSet.has(asset.name)
      || favoriteSet.has(asset.symbol?.toUpperCase()) || favoriteSet.has(asset.name?.toUpperCase());
  }, [favoriteSet]);

  // 실시간 WebSocket 구독 (가상화폐 탭일 때만)
  const { prices: realtimePrices, connected, tickCount } = useRealtimePrice({
    enabled: assetType === 'CRYPTO',
  });

  useEffect(() => {
    loadData();

    // 주식/미국주식 탭: 10초마다 시세 갱신 (가상화폐는 WebSocket 사용)
    if (assetType === 'STOCK' || assetType === 'US_STOCK') {
      let consecutiveFails = 0;
      const interval = setInterval(async () => {
        try {
          const prices = await marketService.getPrices(assetType);
          assetCacheRef.current[assetType] = prices;
          // 검색으로 추가된 종목을 유지하면서 병합
          const serverSymbols = new Set(prices.map(p => p.symbol));
          const extraAssets = searchAddedRef.current.filter(a => !serverSymbols.has(a.symbol));
          setAssetList([...extraAssets, ...prices]);
          setSelectedAsset(prev => {
            if (!prev) return prev;
            const updated = prices.find(p => p.symbol === prev.symbol);
            return updated || prev;
          });
          consecutiveFails = 0;
          setError(null);
        } catch {
          consecutiveFails++;
          if (consecutiveFails >= 3) {
            setError('시세 갱신에 실패하고 있습니다. 네트워크 상태를 확인해주세요.');
          }
        }
      }, 10_000);
      return () => clearInterval(interval);
    }
  }, [assetType]);

  // 환율 정보 주기적 갱신 (미국주식 가격 표시용)
  useEffect(() => {
    const fetchRate = async () => {
      try {
        const { usdKrw } = await marketService.getExchangeRate();
        setUsdKrwRate(usdKrw);
      } catch { /* fallback */ }
    };
    fetchRate();
    const interval = setInterval(fetchRate, 30000);
    return () => clearInterval(interval);
  }, []);

  // 실시간 데이터로 목록 병합
  const mergedAssetList = useMemo(() => {
    if (assetType !== 'CRYPTO' || realtimePrices.size === 0) return assetList;

    return assetList.map((asset) => {
      const realtime = realtimePrices.get(asset.symbol);
      if (realtime) {
        return { ...asset, price: realtime.price, change: realtime.change, changeRate: realtime.changeRate, volume: realtime.volume };
      }
      return asset;
    });
  }, [assetList, realtimePrices, assetType]);

  // 선택된 종목도 실시간 반영
  const liveSelectedAsset = useMemo(() => {
    if (!selectedAsset) return null;
    if (assetType !== 'CRYPTO') return selectedAsset;
    const realtime = realtimePrices.get(selectedAsset.symbol);
    if (realtime) {
      return { ...selectedAsset, price: realtime.price, change: realtime.change, changeRate: realtime.changeRate, volume: realtime.volume };
    }
    return selectedAsset;
  }, [selectedAsset, realtimePrices, assetType, tickCount]);

  const loadData = async () => {
    try {
      setError(null);
      // 캐시된 데이터가 있으면 즉시 표시 (stale-while-revalidate)
      const cached = assetCacheRef.current[assetType];
      if (cached.length > 0) {
        setAssetList(cached);
        if (!selectedAsset) {
          const cachedSelection = selectionCacheRef.current[assetType];
          setSelectedAsset(cachedSelection || cached[0]);
        }
      } else {
        setLoading(true);
      }

      // 백그라운드에서 최신 데이터 fetch
      const prices = await marketService.getPrices(assetType);
      assetCacheRef.current[assetType] = prices;
      // 검색으로 추가된 종목을 유지하면서 병합
      const serverSymbols = new Set(prices.map(p => p.symbol));
      const extraAssets = searchAddedRef.current.filter(a => !serverSymbols.has(a.symbol));
      setAssetList([...extraAssets, ...prices]);
      if (prices.length > 0 && !selectedAsset) {
        setSelectedAsset(prices[0]);
      }
    } catch {
      if (assetCacheRef.current[assetType].length === 0) {
        setError('시세 데이터를 불러오지 못했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleIndicator = (key: string) => {
    setActiveIndicators(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const INDICATOR_GROUPS = [
    { label: '이동평균', items: [
      { key: 'MA5', label: 'MA5' },
      { key: 'MA20', label: 'MA20' },
      { key: 'MA60', label: 'MA60' },
      { key: 'EMA', label: 'EMA20' },
    ]},
    { label: '밴드/추세', items: [
      { key: 'BOLLINGER', label: '볼린저' },
      { key: 'VWAP', label: 'VWAP' },
      { key: 'PARABOLIC_SAR', label: 'SAR' },
      { key: 'ICHIMOKU', label: '일목균형' },
    ]},
    { label: '오실레이터', items: [
      { key: 'RSI', label: 'RSI' },
      { key: 'MACD', label: 'MACD' },
      { key: 'STOCHASTIC', label: '스토캐스틱' },
      { key: 'CCI', label: 'CCI' },
      { key: 'WILLIAMS_R', label: 'W%R' },
    ]},
    { label: '기타', items: [
      { key: 'ATR', label: 'ATR' },
      { key: 'OBV', label: 'OBV' },
    ]},
  ];

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

  const formatVolume = (value: number) => {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return value.toString();
  };

  const handleAssetSelect = (asset: MarketPrice) => {
    setSelectedAsset(asset);
    selectionCacheRef.current[assetType] = asset;
    // 최근 본 종목 저장
    try {
      const entry = { stockCode: asset.symbol, stockName: asset.name, assetType: asset.assetType };
      const saved = localStorage.getItem('whalearc_recent_stocks');
      const prev: { stockCode: string; stockName: string; assetType: string }[] = saved ? JSON.parse(saved) : [];
      const filtered = prev.filter(r => r.stockCode !== entry.stockCode);
      const next = [entry, ...filtered].slice(0, 8);
      localStorage.setItem('whalearc_recent_stocks', JSON.stringify(next));
    } catch { /* ignore */ }
  };

  const filteredAndSortedAssets = mergedAssetList
    .filter((asset) => {
      if (!asset) return false;
      if (listFilter === 'favorites' && !isFavorite(asset)) return false;
      const name = (asset.name ?? '').toLowerCase();
      const symbol = (asset.symbol ?? '').toLowerCase();
      const keyword = filterText.toLowerCase();
      return name.includes(keyword) || symbol.includes(keyword);
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name': return a.name.localeCompare(b.name);
        case 'price': return b.price - a.price;
        case 'change': return b.changeRate - a.changeRate;
        case 'volume': return b.volume - a.volume;
        default: return 0;
      }
    });

  if (loading && assetList.length === 0) {
    if (!isVirt) return <SplashLoading message="시세 데이터를 불러오는 중..." />;
    return <VirtSplashLoading message="시세 데이터를 불러오는 중..." />;
  }

  if (error && assetList.length === 0) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-[var(--wa-page-bg)] text-white' : 'bg-[var(--wa-page-bg)]'}`}>
        <Header showNav={true} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {isDark ? (
            <UnstableCurrent message="해류가 불안정합니다" sub={error || '데이터를 다시 불러오고 있어요...'} />
          ) : (
            <ErrorMessage message={error} onRetry={loadData} variant="offline" />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[var(--wa-page-bg)] text-white' : 'bg-[var(--wa-page-bg)]'}`}>
      <Header showNav={true} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
            <h1 className={`text-2xl sm:text-3xl md:text-4xl font-bold ${isDark ? 'text-white' : 'text-whale-dark'}`}>시장 현황</h1>
            {assetType === 'CRYPTO' && (
              <div className="flex items-center space-x-2">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-yellow-400 animate-pulse'}`} />
                <span className={`text-sm font-medium ${connected ? (isDark ? 'text-green-400' : 'text-green-600') : (isDark ? 'text-yellow-400' : 'text-yellow-600')}`}>
                  {connected ? '실시간' : '연결 중...'}
                </span>
              </div>
            )}
          </div>
          <p className={`mb-3 ${!isVirt ? 'text-slate-400' : 'text-gray-600'}`}>주식/미국주식/가상화폐 시세를 한 곳에서 확인하세요</p>
          <div className="flex space-x-3">
            <button
              type="button"
              className={`px-4 py-2 rounded-lg text-sm font-semibold min-h-[44px] ${
                assetType === 'STOCK'
                  ? isDark ? 'bg-cyan-500 text-white shadow-md' : 'bg-whale-light text-white shadow-md'
                  : isDark ? 'bg-white/[0.04] text-slate-400 border border-white/[0.06] hover:bg-white/[0.06]' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
              onClick={() => { selectionCacheRef.current[assetType] = selectedAsset; searchAddedRef.current = []; setAssetType('STOCK'); setSelectedAsset(selectionCacheRef.current['STOCK']); setChartType('area'); }}
            >
              주식
            </button>
            <button
              type="button"
              className={`px-4 py-2 rounded-lg text-sm font-semibold min-h-[44px] ${
                assetType === 'US_STOCK'
                  ? !isVirt ? 'bg-cyan-500 text-white shadow-md' : 'bg-whale-light text-white shadow-md'
                  : !isVirt ? 'bg-white/[0.04] text-slate-400 border border-white/[0.06] hover:bg-white/[0.06]' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
              onClick={() => { selectionCacheRef.current[assetType] = selectedAsset; searchAddedRef.current = []; setAssetType('US_STOCK'); setSelectedAsset(selectionCacheRef.current['US_STOCK']); setChartType('area'); }}
            >
              미국주식
            </button>
            <button
              type="button"
              className={`px-4 py-2 rounded-lg text-sm font-semibold min-h-[44px] ${
                assetType === 'CRYPTO'
                  ? isDark ? 'bg-cyan-500 text-white shadow-md' : 'bg-whale-light text-white shadow-md'
                  : isDark ? 'bg-white/[0.04] text-slate-400 border border-white/[0.06] hover:bg-white/[0.06]' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
              onClick={() => { selectionCacheRef.current[assetType] = selectedAsset; searchAddedRef.current = []; setAssetType('CRYPTO'); setSelectedAsset(selectionCacheRef.current['CRYPTO']); setChartType('area'); }}
            >
              가상화폐 (빗썸)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 좌측: 종목 목록 */}
          <div className="lg:col-span-1 space-y-4">
            <div className="card">
              <h2 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-whale-dark'}`}>종목 목록</h2>

              {/* 전체 / 관심 탭 */}
              <div className="flex gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setListFilter('all')}
                  className={`px-3.5 py-1.5 text-sm font-semibold rounded-lg transition-all ${
                    listFilter === 'all'
                      ? !isVirt ? 'bg-cyan-500 text-white' : 'bg-whale-light text-white'
                      : !isVirt ? 'bg-white/[0.04] text-slate-400 hover:bg-white/[0.06]' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  전체
                </button>
                <button
                  type="button"
                  onClick={() => setListFilter('favorites')}
                  className={`px-3.5 py-1.5 text-sm font-semibold rounded-lg transition-all flex items-center gap-1 ${
                    listFilter === 'favorites'
                      ? !isVirt ? 'bg-cyan-500 text-white' : 'bg-whale-light text-white'
                      : !isVirt ? 'bg-white/[0.04] text-slate-400 hover:bg-white/[0.06]' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                  관심
                </button>
              </div>

              <div className="mb-4 space-y-3">
                <div className="relative">
                  <input
                    type="text"
                    placeholder={assetType === 'STOCK' ? '전체 KOSPI/KOSDAQ 종목 검색...' : assetType === 'US_STOCK' ? '미국주식 검색 (애플, AAPL...)' : '가상화폐 검색 (이름/코드)...'}
                    value={filterText}
                    onChange={(e) => (assetType === 'STOCK' || assetType === 'US_STOCK') ? handleStockSearch(e.target.value) : setFilterText(e.target.value)}
                    className="input-field"
                  />
                  {searchLoading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-whale-light border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  {/* 서버 검색 결과 드롭다운 */}
                  {searchResults.length > 0 && (
                    <div className={`absolute z-10 w-full mt-1 rounded-lg shadow-lg max-h-60 overflow-y-auto ${isDark ? 'bg-[#0c1a2e] border border-white/[0.06]' : 'bg-white border border-gray-200'}`}>
                      <div className={`px-3 py-1.5 text-[10px] font-medium border-b ${isDark ? 'text-slate-500 border-white/[0.06]' : 'text-gray-400 border-gray-200'}`}>
                        검색 결과 ({searchResults.length}건) — 클릭하여 추가
                      </div>
                      {searchResults.map((r) => (
                        <div
                          key={r.code}
                          onClick={() => handleSearchResultClick(r)}
                          className={`px-3 py-2.5 cursor-pointer flex justify-between items-center last:border-0 ${isDark ? 'hover:bg-white/[0.03] border-b border-white/[0.06]' : 'hover:bg-blue-50 border-b border-gray-50'}`}
                        >
                          <div>
                            <span className={`font-medium ${isDark ? 'text-white' : 'text-whale-dark'}`}>{r.name}</span>
                            <span className={`text-xs ml-2 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>{r.code}</span>
                          </div>
                          <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>{r.market}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'name' | 'price' | 'change' | 'volume')}
                  className={`input-field ${isDark ? 'bg-white/[0.04]' : 'bg-white'}`}
                >
                  <option value="volume">거래량순</option>
                  <option value="name">이름순</option>
                  <option value="price">가격순</option>
                  <option value="change">등락률순</option>
                </select>
              </div>

              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {filteredAndSortedAssets.length === 0 ? (
                  <div className="text-center py-12">
                    {listFilter === 'favorites' ? (
                      <>
                        <svg className={`w-10 h-10 mx-auto mb-3 ${!isVirt ? 'text-slate-600' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                        <div className={`font-medium ${!isVirt ? 'text-slate-400' : 'text-gray-400'}`}>관심 종목이 없습니다</div>
                        <div className={`text-sm mt-1 ${!isVirt ? 'text-slate-600' : 'text-gray-300'}`}>프로필에서 관심 종목을 등록해보세요</div>
                      </>
                    ) : (
                      <>
                        <div className={`font-medium ${!isVirt ? 'text-slate-400' : 'text-gray-400'}`}>검색 결과가 없습니다</div>
                        <div className={`text-sm mt-1 ${!isVirt ? 'text-slate-600' : 'text-gray-300'}`}>다른 키워드로 검색해보세요</div>
                      </>
                    )}
                    {filterText && (
                      <button
                        onClick={() => { setFilterText(''); setSearchResults([]); }}
                        className={`mt-3 text-sm font-medium transition-colors ${isDark ? 'text-cyan-400 hover:text-cyan-300' : 'text-whale-light hover:text-whale-dark'}`}
                      >
                        검색어 초기화
                      </button>
                    )}
                  </div>
                ) : (
                  filteredAndSortedAssets.map((asset) => (
                    <div
                      key={asset.symbol}
                      onClick={() => handleAssetSelect(asset)}
                      className={
                        selectedAsset?.symbol === asset.symbol
                          ? 'stock-item-selected'
                          : 'stock-item-default'
                      }
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className={`font-bold flex items-center gap-1 ${!isVirt ? 'text-white' : 'text-whale-dark'}`}>
                            {asset.name}
                            {isFavorite(asset) && <svg className={`w-3 h-3 flex-shrink-0 ${!isVirt ? 'text-cyan-400' : 'text-whale-light'}`} fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>}
                          </div>
                          <div className={`text-sm ${!isVirt ? 'text-slate-500' : 'text-gray-500'}`}>
                            {asset.symbol} {asset.assetType === 'CRYPTO' ? '/ KRW' : asset.assetType === 'US_STOCK' ? '/ USD' : ''}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-semibold ${!isVirt ? 'text-slate-100' : 'text-whale-dark'}`}>
                            {asset.assetType === 'US_STOCK'
                              ? `$${asset.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : formatCurrency(asset.price)}
                          </div>
                          {asset.assetType === 'US_STOCK' && (
                            <div className={`text-xs ${!isVirt ? 'text-slate-500' : 'text-gray-400'}`}>
                              {formatCurrency(Math.round(asset.price * usdKrwRate))}
                            </div>
                          )}
                          <div className={`text-sm font-semibold ${asset.changeRate >= 0 ? 'price-up' : 'price-down'}`}>
                            {asset.changeRate >= 0 ? '+' : ''}{asset.changeRate.toFixed(2)}%
                          </div>
                          <div className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                            Vol {formatVolume(asset.volume)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {assetType === 'STOCK' && (
                <p className={`text-[10px] text-right mt-2 ${isDark ? 'text-slate-600' : 'text-gray-400'}`}>
                  * 주식 시세는 KIS 모의투자 API 기준 약 15~20초 지연
                </p>
              )}
              {assetType === 'US_STOCK' && (
                <p className={`text-[10px] text-right mt-2 ${!isVirt ? 'text-slate-600' : 'text-gray-400'}`}>
                  * 미국주식 시세는 약 15~20초 지연 · 환율 1$ ≈ ₩{usdKrwRate.toLocaleString()}
                </p>
              )}
            </div>
          </div>

          {/* 우측: 선택된 종목 상세 정보 및 차트 */}
          <div className="lg:col-span-2 space-y-6">
            {liveSelectedAsset ? (
              <>
                {/* 종목 정보 카드 */}
                <div className="card">
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-2 mb-4">
                    <div>
                      <h2 className={`text-xl md:text-2xl font-bold ${isDark ? 'text-white' : 'text-whale-dark'}`}>{liveSelectedAsset.name}</h2>
                      <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                        {liveSelectedAsset.symbol}
                        {liveSelectedAsset.assetType === 'CRYPTO' ? ' / KRW' : liveSelectedAsset.assetType === 'US_STOCK' ? ' / USD' : ''}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <div className={`text-2xl md:text-3xl font-bold mb-1 ${!isVirt ? 'text-white' : 'text-whale-dark'}`}>
                        {liveSelectedAsset.assetType === 'US_STOCK'
                          ? `$${liveSelectedAsset.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : formatCurrency(liveSelectedAsset.price)}
                      </div>
                      {liveSelectedAsset.assetType === 'US_STOCK' && (
                        <div className={`text-sm mb-1 ${!isVirt ? 'text-slate-400' : 'text-gray-500'}`}>
                          {formatCurrency(Math.round(liveSelectedAsset.price * usdKrwRate))}
                        </div>
                      )}
                      <div className={`text-sm md:text-lg font-semibold ${liveSelectedAsset.changeRate >= 0 ? 'price-up' : 'price-down'}`}>
                        {liveSelectedAsset.change >= 0 ? '+' : ''}
                        {formatCurrency(liveSelectedAsset.change)} ({liveSelectedAsset.changeRate >= 0 ? '+' : ''}
                        {liveSelectedAsset.changeRate.toFixed(2)}%)
                      </div>
                    </div>
                  </div>

                  {/* 차트 */}
                  {assetType === 'CRYPTO' ? (
                    <div className="mt-4">
                      {/* 차트 타입 토글 + 지표 버튼 */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setChartType('area')}
                            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
                              chartType === 'area'
                                ? !isVirt ? 'bg-cyan-500 text-white shadow-sm' : 'bg-whale-light text-white shadow-sm'
                                : !isVirt ? 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.03]' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                            }`}
                          >
                            <svg className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4" />
                            </svg>
                            라인
                          </button>
                          <button
                            onClick={() => setChartType('candle')}
                            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
                              chartType === 'candle'
                                ? !isVirt ? 'bg-cyan-500 text-white shadow-sm' : 'bg-whale-light text-white shadow-sm'
                                : !isVirt ? 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.03]' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                            }`}
                          >
                            <svg className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l6 13V6" />
                            </svg>
                            캔들
                          </button>
                        </div>
                        {chartType === 'candle' && (
                          <button
                            onClick={() => setShowIndicatorPanel(!showIndicatorPanel)}
                            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all flex items-center gap-1 ${
                              showIndicatorPanel || activeIndicators.length > 0
                                ? !isVirt ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-whale-light/10 text-whale-light border border-whale-light/30'
                                : !isVirt ? 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.03] border border-white/[0.06]' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 border border-gray-200'
                            }`}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            지표{activeIndicators.length > 0 && ` (${activeIndicators.length})`}
                          </button>
                        )}
                      </div>

                      {/* 지표 선택 패널 (캔들 모드에서만) */}
                      {chartType === 'candle' && showIndicatorPanel && (
                        <div className={`mb-3 p-3 rounded-xl border ${!isVirt ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-gray-50 border-gray-100'}`}>
                          {INDICATOR_GROUPS.map(group => (
                            <div key={group.label} className="mb-2 last:mb-0">
                              <span className={`text-[10px] font-semibold ${!isVirt ? 'text-slate-500' : 'text-gray-400'}`}>{group.label}</span>
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {group.items.map(item => (
                                  <button
                                    key={item.key}
                                    type="button"
                                    onClick={() => toggleIndicator(item.key)}
                                    className={`px-2.5 py-1 text-[11px] rounded-md font-medium transition-all ${
                                      activeIndicators.includes(item.key)
                                        ? !isVirt ? 'bg-cyan-500 text-white shadow-sm' : 'bg-whale-light text-white shadow-sm'
                                        : !isVirt ? 'bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] border border-white/[0.06]' : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-200'
                                    }`}
                                  >
                                    {item.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                          {activeIndicators.length > 0 && (
                            <button
                              onClick={() => setActiveIndicators([])}
                              className={`mt-2 text-[10px] font-medium ${!isVirt ? 'text-slate-500 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                              전체 해제
                            </button>
                          )}
                        </div>
                      )}

                      {chartType === 'area' ? (
                        connected ? (
                          <RealtimeChart
                            symbol={liveSelectedAsset.symbol}
                            price={liveSelectedAsset.price}
                            isDark={isDark}
                          />
                        ) : (
                          <div className={`rounded-xl p-8 text-center border ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-gray-50 border-gray-100'}`}>
                            <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-400'}`}>실시간 연결 중... 잠시 후 차트가 표시됩니다</div>
                          </div>
                        )
                      ) : (
                        <ChartLoadingWrapper symbol={liveSelectedAsset.symbol} isDark={isDark}>
                          <TradingChart
                            symbol={liveSelectedAsset.symbol}
                            price={liveSelectedAsset.price}
                            changeRate={liveSelectedAsset.changeRate}
                            activeIndicators={activeIndicators}
                            isDark={!isVirt}
                          />
                        </ChartLoadingWrapper>
                      )}
                    </div>
                  ) : (
                    <div className="mt-4">
                      {/* 주식 차트 지표 버튼 */}
                      <div className="flex items-center justify-end mb-3">
                        <button
                          onClick={() => setShowIndicatorPanel(!showIndicatorPanel)}
                          className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all flex items-center gap-1 ${
                            showIndicatorPanel || activeIndicators.length > 0
                              ? !isVirt ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-whale-light/10 text-whale-light border border-whale-light/30'
                              : !isVirt ? 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.03] border border-white/[0.06]' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 border border-gray-200'
                          }`}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          지표{activeIndicators.length > 0 && ` (${activeIndicators.length})`}
                        </button>
                      </div>
                      {showIndicatorPanel && (
                        <div className={`mb-3 p-3 rounded-xl border ${!isVirt ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-gray-50 border-gray-100'}`}>
                          {INDICATOR_GROUPS.map(group => (
                            <div key={group.label} className="mb-2 last:mb-0">
                              <span className={`text-[10px] font-semibold ${!isVirt ? 'text-slate-500' : 'text-gray-400'}`}>{group.label}</span>
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {group.items.map(item => (
                                  <button
                                    key={item.key}
                                    type="button"
                                    onClick={() => toggleIndicator(item.key)}
                                    className={`px-2.5 py-1 text-[11px] rounded-md font-medium transition-all ${
                                      activeIndicators.includes(item.key)
                                        ? !isVirt ? 'bg-cyan-500 text-white shadow-sm' : 'bg-whale-light text-white shadow-sm'
                                        : !isVirt ? 'bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] border border-white/[0.06]' : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-200'
                                    }`}
                                  >
                                    {item.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                          {activeIndicators.length > 0 && (
                            <button
                              onClick={() => setActiveIndicators([])}
                              className={`mt-2 text-[10px] font-medium ${!isVirt ? 'text-slate-500 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                              전체 해제
                            </button>
                          )}
                        </div>
                      )}
                      <TradingChart
                        symbol={liveSelectedAsset.symbol}
                        price={liveSelectedAsset.price}
                        changeRate={liveSelectedAsset.changeRate}
                        assetType={assetType === 'US_STOCK' ? 'US_STOCK' : 'STOCK'}
                        activeIndicators={activeIndicators}
                        isDark={!isVirt}
                      />
                    </div>
                  )}
                </div>

                {/* 시장 통계 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="card text-center">
                    <div className={`text-sm mb-1 ${!isVirt ? 'text-slate-400' : 'text-gray-600'}`}>전일 종가</div>
                    <div className={`text-lg md:text-xl font-bold ${!isVirt ? 'text-white' : 'text-whale-dark'}`}>
                      {liveSelectedAsset.assetType === 'US_STOCK'
                        ? `$${(liveSelectedAsset.price - liveSelectedAsset.change).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : formatCurrency(liveSelectedAsset.price - liveSelectedAsset.change)}
                    </div>
                  </div>
                  <div className="card text-center">
                    <div className={`text-sm mb-1 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>등락률</div>
                    <div className={`text-xl font-bold ${liveSelectedAsset.changeRate >= 0 ? 'price-up' : 'price-down'}`}>
                      {liveSelectedAsset.changeRate >= 0 ? '+' : ''}{liveSelectedAsset.changeRate.toFixed(2)}%
                    </div>
                  </div>
                  <div className="card text-center">
                    <div className={`text-sm mb-1 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>등락액</div>
                    <div className={`text-xl font-bold ${liveSelectedAsset.change >= 0 ? 'price-up' : 'price-down'}`}>
                      {liveSelectedAsset.change >= 0 ? '+' : ''}
                      {liveSelectedAsset.assetType === 'US_STOCK'
                        ? `$${Math.abs(liveSelectedAsset.change).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : formatCurrency(liveSelectedAsset.change)}
                    </div>
                  </div>
                  <div className="card text-center">
                    <div className={`text-sm mb-1 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>거래량</div>
                    <div className={`text-xl font-bold ${isDark ? 'text-white' : 'text-whale-dark'}`}>
                      {formatVolume(liveSelectedAsset.volume)}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="card text-center py-16">
                <div className={`text-sm font-medium tracking-wide mb-2 ${isDark ? 'text-slate-500' : 'text-gray-300'}`}>종목을 선택해주세요</div>
                <div className={`text-xs ${isDark ? 'text-slate-600' : 'text-gray-400'}`}>좌측 목록에서 종목을 클릭하면 상세 정보를 확인할 수 있습니다</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketPage;
