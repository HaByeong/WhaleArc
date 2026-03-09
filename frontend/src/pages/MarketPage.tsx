import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Header from '../components/Header';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import RealtimeChart from '../components/RealtimeChart';
import TradingChart from '../components/TradingChart';
import { marketService, type MarketPrice, type AssetType } from '../services/marketService';
import { useRealtimePrice } from '../hooks/useRealtimePrice';

const MarketPage = () => {
  const [assetType, setAssetType] = useState<AssetType>('STOCK');
  const [selectedAsset, setSelectedAsset] = useState<MarketPrice | null>(null);
  const [assetList, setAssetList] = useState<MarketPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'change' | 'volume'>('volume');
  const [filterText, setFilterText] = useState('');
  const [chartType, setChartType] = useState<'area' | 'candle'>('area');

  // 주식 종목 검색
  const [searchResults, setSearchResults] = useState<{ code: string; name: string; market: string }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleStockSearch = useCallback((keyword: string) => {
    setFilterText(keyword);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    if (assetType !== 'STOCK' || keyword.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    // 이미 리스트에 있는지 로컬 필터로 충분한지 확인
    const localMatch = assetList.filter(a =>
      a.name.toLowerCase().includes(keyword.toLowerCase()) || a.symbol.includes(keyword)
    );
    if (localMatch.length > 0) {
      setSearchResults([]);
      return;
    }

    // 서버 검색 (300ms debounce)
    searchTimerRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await marketService.searchStocks(keyword);
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
      setAssetList(prev => [price, ...prev]);
      setSelectedAsset(price);
      setSearchResults([]);
    } catch {
      // 조회 실패 시 무시
    }
  };

  // 실시간 WebSocket 구독 (코인 탭일 때만)
  const { prices: realtimePrices, connected, tickCount } = useRealtimePrice({
    enabled: assetType === 'CRYPTO',
  });

  useEffect(() => {
    loadData();
  }, [assetType]);

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
      setLoading(true);
      setError(null);
      const prices = await marketService.getPrices(assetType);
      setAssetList(prices);
      if (prices.length > 0 && !selectedAsset) {
        setSelectedAsset(prices[0]);
      }
    } catch {
      setError('시세 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

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
  };

  const filteredAndSortedAssets = mergedAssetList
    .filter((asset) => {
      if (!asset) return false;
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
    return (
      <div className="min-h-screen bg-gray-50">
        <Header showNav={true} />
        <LoadingSpinner fullScreen={false} message="시장 데이터를 불러오는 중..." />
      </div>
    );
  }

  if (error && assetList.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header showNav={true} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <ErrorMessage message={error} onRetry={loadData} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header showNav={true} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
            <h1 className="text-3xl md:text-4xl font-bold text-whale-dark">시장 현황</h1>
            {assetType === 'CRYPTO' && (
              <div className="flex items-center space-x-2">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                <span className={`text-sm font-medium ${connected ? 'text-green-600' : 'text-gray-500'}`}>
                  {connected ? '실시간' : '연결 중...'}
                </span>
              </div>
            )}
          </div>
          <p className="text-gray-600 mb-3">주식/코인 시세를 한 곳에서 확인하세요</p>
          <div className="flex space-x-3">
            <button
              type="button"
              className={`px-4 py-2 rounded-lg text-sm font-semibold min-h-[44px] ${
                assetType === 'STOCK'
                  ? 'bg-whale-light text-white shadow-md'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
              onClick={() => { setAssetType('STOCK'); setSelectedAsset(null); setChartType('area'); }}
            >
              주식
            </button>
            <button
              type="button"
              className={`px-4 py-2 rounded-lg text-sm font-semibold min-h-[44px] ${
                assetType === 'CRYPTO'
                  ? 'bg-whale-light text-white shadow-md'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
              onClick={() => { setAssetType('CRYPTO'); setSelectedAsset(null); setChartType('area'); }}
            >
              코인 (빗썸)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 좌측: 종목 목록 */}
          <div className="lg:col-span-1 space-y-4">
            <div className="card">
              <h2 className="text-xl font-bold text-whale-dark mb-4">종목 목록</h2>

              <div className="mb-4 space-y-3">
                <div className="relative">
                  <input
                    type="text"
                    placeholder={assetType === 'STOCK' ? '종목명 또는 코드 검색 (전 종목)...' : '종목명 또는 코드 검색...'}
                    value={filterText}
                    onChange={(e) => assetType === 'STOCK' ? handleStockSearch(e.target.value) : setFilterText(e.target.value)}
                    className="input-field"
                  />
                  {searchLoading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-whale-light border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  {/* 서버 검색 결과 드롭다운 */}
                  {searchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      <div className="px-3 py-1.5 text-[10px] text-gray-400 font-medium border-b">
                        검색 결과 ({searchResults.length}건) — 클릭하여 추가
                      </div>
                      {searchResults.map((r) => (
                        <div
                          key={r.code}
                          onClick={() => handleSearchResultClick(r)}
                          className="px-3 py-2.5 hover:bg-blue-50 cursor-pointer flex justify-between items-center border-b border-gray-50 last:border-0"
                        >
                          <div>
                            <span className="font-medium text-whale-dark">{r.name}</span>
                            <span className="text-xs text-gray-400 ml-2">{r.code}</span>
                          </div>
                          <span className="text-[10px] text-gray-400">{r.market}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'name' | 'price' | 'change' | 'volume')}
                  className="input-field bg-white"
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
                    <div className="text-gray-400 font-medium">검색 결과가 없습니다</div>
                    <div className="text-gray-300 text-sm mt-1">다른 키워드로 검색해보세요</div>
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
                          <div className="font-bold text-whale-dark">{asset.name}</div>
                          <div className="text-sm text-gray-500">
                            {asset.symbol} {asset.assetType === 'CRYPTO' ? '/ KRW' : ''}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-whale-dark">
                            {formatCurrency(asset.price)}
                          </div>
                          <div className={`text-sm font-semibold ${asset.changeRate >= 0 ? 'price-up' : 'price-down'}`}>
                            {asset.changeRate >= 0 ? '+' : ''}{asset.changeRate.toFixed(2)}%
                          </div>
                          <div className="text-xs text-gray-400">
                            Vol {formatVolume(asset.volume)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
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
                      <h2 className="text-xl md:text-2xl font-bold text-whale-dark">{liveSelectedAsset.name}</h2>
                      <p className="text-gray-500 text-sm">
                        {liveSelectedAsset.symbol}
                        {liveSelectedAsset.assetType === 'CRYPTO' ? ' / KRW' : ''}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <div className="text-2xl md:text-3xl font-bold text-whale-dark mb-1">
                        {formatCurrency(liveSelectedAsset.price)}
                      </div>
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
                      {/* 차트 타입 토글 */}
                      <div className="flex items-center gap-1 mb-3">
                        <button
                          onClick={() => setChartType('area')}
                          className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
                            chartType === 'area'
                              ? 'bg-whale-light text-white shadow-sm'
                              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          <svg className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4" />
                          </svg>
                          영역
                        </button>
                        <button
                          onClick={() => setChartType('candle')}
                          className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
                            chartType === 'candle'
                              ? 'bg-whale-light text-white shadow-sm'
                              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          <svg className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l6 13V6" />
                          </svg>
                          캔들
                        </button>
                      </div>

                      {chartType === 'area' ? (
                        connected ? (
                          <RealtimeChart
                            symbol={liveSelectedAsset.symbol}
                            price={liveSelectedAsset.price}
                          />
                        ) : (
                          <div className="bg-gray-50 rounded-xl p-8 text-center border border-gray-100">
                            <div className="text-gray-400 text-sm">실시간 연결 중... 잠시 후 차트가 표시됩니다</div>
                          </div>
                        )
                      ) : (
                        <TradingChart
                          symbol={liveSelectedAsset.symbol}
                          price={liveSelectedAsset.price}
                          changeRate={liveSelectedAsset.changeRate}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="mt-4">
                      <TradingChart
                        symbol={liveSelectedAsset.symbol}
                        price={liveSelectedAsset.price}
                        changeRate={liveSelectedAsset.changeRate}
                        assetType="STOCK"
                      />
                    </div>
                  )}
                </div>

                {/* 시장 통계 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="card text-center">
                    <div className="text-sm text-gray-600 mb-1">전일 종가</div>
                    <div className="text-lg md:text-xl font-bold text-whale-dark">
                      {formatCurrency(liveSelectedAsset.price - liveSelectedAsset.change)}
                    </div>
                  </div>
                  <div className="card text-center">
                    <div className="text-sm text-gray-600 mb-1">등락률</div>
                    <div className={`text-xl font-bold ${liveSelectedAsset.changeRate >= 0 ? 'price-up' : 'price-down'}`}>
                      {liveSelectedAsset.changeRate >= 0 ? '+' : ''}{liveSelectedAsset.changeRate.toFixed(2)}%
                    </div>
                  </div>
                  <div className="card text-center">
                    <div className="text-sm text-gray-600 mb-1">등락액</div>
                    <div className={`text-xl font-bold ${liveSelectedAsset.change >= 0 ? 'price-up' : 'price-down'}`}>
                      {liveSelectedAsset.change >= 0 ? '+' : ''}{formatCurrency(liveSelectedAsset.change)}
                    </div>
                  </div>
                  <div className="card text-center">
                    <div className="text-sm text-gray-600 mb-1">거래량</div>
                    <div className="text-xl font-bold text-whale-dark">
                      {formatVolume(liveSelectedAsset.volume)}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="card text-center py-16">
                <div className="text-gray-300 text-sm font-medium tracking-wide mb-2">종목을 선택해주세요</div>
                <div className="text-gray-400 text-xs">좌측 목록에서 종목을 클릭하면 상세 정보를 확인할 수 있습니다</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketPage;
