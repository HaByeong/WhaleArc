import { useState, useEffect, useMemo, useRef, useCallback, type ReactNode } from 'react';
import Header from '../components/Header';
import VirtSplashLoading from '../components/VirtSplashLoading';
import SplashLoading from '../components/SplashLoading';
import ErrorMessage from '../components/ErrorMessage';
import UnstableCurrent from '../components/UnstableCurrent';
import RealtimeChart from '../components/RealtimeChart';
import TradingChart from '../components/TradingChart';
import { marketService, type MarketPrice, type AssetType } from '../services/marketService';
import { useRealtimePrice } from '../hooks/useRealtimePrice';
import { useRoutePrefix } from '../hooks/useRoutePrefix';

/** 차트 로딩 래퍼: 데이터 로드 중일 때 placeholder를 보여주고, 로드 완료 후 차트를 표시 */
const ChartLoadingWrapper = ({ symbol, children, isDark }: { symbol: string; children: ReactNode; isDark: boolean }) => {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setReady(false);
    setFailed(false);
    // 차트가 내부적으로 데이터를 로드할 시간을 확보한 뒤 표시
    timerRef.current = setTimeout(() => setReady(true), 600);
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

    // 항상 서버 검색 수행 (전체 KRX 종목 대상)
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

  // 실시간 WebSocket 구독 (가상화폐 탭일 때만)
  const { prices: realtimePrices, connected, tickCount } = useRealtimePrice({
    enabled: assetType === 'CRYPTO',
  });

  useEffect(() => {
    loadData();

    // 주식 탭: 10초마다 시세 갱신 (가상화폐는 WebSocket 사용)
    if (assetType === 'STOCK') {
      let consecutiveFails = 0;
      const interval = setInterval(async () => {
        try {
          const prices = await marketService.getPrices('STOCK');
          setAssetList(prices);
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
      <div className={`min-h-screen ${!isVirt ? 'bg-[#060d18] text-white' : 'bg-gray-50'}`}>
        <Header showNav={true} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {!isVirt ? (
            <UnstableCurrent message="해류가 불안정합니다" sub={error || '데이터를 다시 불러오고 있어요...'} />
          ) : (
            <ErrorMessage message={error} onRetry={loadData} variant="offline" />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${!isVirt ? 'bg-[#060d18] text-white' : 'bg-gray-50'}`}>
      <Header showNav={true} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
            <h1 className={`text-2xl sm:text-3xl md:text-4xl font-bold ${!isVirt ? 'text-white' : 'text-whale-dark'}`}>시장 현황</h1>
            {assetType === 'CRYPTO' && (
              <div className="flex items-center space-x-2">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-yellow-400 animate-pulse'}`} />
                <span className={`text-sm font-medium ${connected ? (!isVirt ? 'text-green-400' : 'text-green-600') : (!isVirt ? 'text-yellow-400' : 'text-yellow-600')}`}>
                  {connected ? '실시간' : '연결 중...'}
                </span>
              </div>
            )}
          </div>
          <p className={`mb-3 ${!isVirt ? 'text-slate-400' : 'text-gray-600'}`}>주식/가상화폐 시세를 한 곳에서 확인하세요</p>
          <div className="flex space-x-3">
            <button
              type="button"
              className={`px-4 py-2 rounded-lg text-sm font-semibold min-h-[44px] ${
                assetType === 'STOCK'
                  ? !isVirt ? 'bg-cyan-500 text-white shadow-md' : 'bg-whale-light text-white shadow-md'
                  : !isVirt ? 'bg-white/[0.04] text-slate-400 border border-white/[0.06] hover:bg-white/[0.06]' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
              onClick={() => { setAssetType('STOCK'); setSelectedAsset(null); setChartType('area'); }}
            >
              주식
            </button>
            <button
              type="button"
              className={`px-4 py-2 rounded-lg text-sm font-semibold min-h-[44px] ${
                assetType === 'CRYPTO'
                  ? !isVirt ? 'bg-cyan-500 text-white shadow-md' : 'bg-whale-light text-white shadow-md'
                  : !isVirt ? 'bg-white/[0.04] text-slate-400 border border-white/[0.06] hover:bg-white/[0.06]' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
              onClick={() => { setAssetType('CRYPTO'); setSelectedAsset(null); setChartType('area'); }}
            >
              가상화폐 (빗썸)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 좌측: 종목 목록 */}
          <div className="lg:col-span-1 space-y-4">
            <div className="card">
              <h2 className={`text-xl font-bold mb-4 ${!isVirt ? 'text-white' : 'text-whale-dark'}`}>종목 목록</h2>

              <div className="mb-4 space-y-3">
                <div className="relative">
                  <input
                    type="text"
                    placeholder={assetType === 'STOCK' ? '전체 KOSPI/KOSDAQ 종목 검색...' : '가상화폐 검색 (이름/코드)...'}
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
                    <div className={`absolute z-10 w-full mt-1 rounded-lg shadow-lg max-h-60 overflow-y-auto ${!isVirt ? 'bg-[#0c1a2e] border border-white/[0.06]' : 'bg-white border border-gray-200'}`}>
                      <div className={`px-3 py-1.5 text-[10px] font-medium border-b ${!isVirt ? 'text-slate-500 border-white/[0.06]' : 'text-gray-400 border-gray-200'}`}>
                        검색 결과 ({searchResults.length}건) — 클릭하여 추가
                      </div>
                      {searchResults.map((r) => (
                        <div
                          key={r.code}
                          onClick={() => handleSearchResultClick(r)}
                          className={`px-3 py-2.5 cursor-pointer flex justify-between items-center last:border-0 ${!isVirt ? 'hover:bg-white/[0.03] border-b border-white/[0.06]' : 'hover:bg-blue-50 border-b border-gray-50'}`}
                        >
                          <div>
                            <span className={`font-medium ${!isVirt ? 'text-white' : 'text-whale-dark'}`}>{r.name}</span>
                            <span className={`text-xs ml-2 ${!isVirt ? 'text-slate-500' : 'text-gray-400'}`}>{r.code}</span>
                          </div>
                          <span className={`text-[10px] ${!isVirt ? 'text-slate-500' : 'text-gray-400'}`}>{r.market}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'name' | 'price' | 'change' | 'volume')}
                  className={`input-field ${!isVirt ? 'bg-white/[0.04]' : 'bg-white'}`}
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
                    <div className={`font-medium ${!isVirt ? 'text-slate-400' : 'text-gray-400'}`}>검색 결과가 없습니다</div>
                    <div className={`text-sm mt-1 ${!isVirt ? 'text-slate-600' : 'text-gray-300'}`}>다른 키워드로 검색해보세요</div>
                    {filterText && (
                      <button
                        onClick={() => { setFilterText(''); setSearchResults([]); }}
                        className={`mt-3 text-sm font-medium transition-colors ${!isVirt ? 'text-cyan-400 hover:text-cyan-300' : 'text-whale-light hover:text-whale-dark'}`}
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
                          <div className={`font-bold ${!isVirt ? 'text-white' : 'text-whale-dark'}`}>{asset.name}</div>
                          <div className={`text-sm ${!isVirt ? 'text-slate-500' : 'text-gray-500'}`}>
                            {asset.symbol} {asset.assetType === 'CRYPTO' ? '/ KRW' : ''}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-semibold ${!isVirt ? 'text-slate-100' : 'text-whale-dark'}`}>
                            {formatCurrency(asset.price)}
                          </div>
                          <div className={`text-sm font-semibold ${asset.changeRate >= 0 ? 'price-up' : 'price-down'}`}>
                            {asset.changeRate >= 0 ? '+' : ''}{asset.changeRate.toFixed(2)}%
                          </div>
                          <div className={`text-xs ${!isVirt ? 'text-slate-500' : 'text-gray-400'}`}>
                            Vol {formatVolume(asset.volume)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {assetType === 'STOCK' && (
                <p className={`text-[10px] text-right mt-2 ${!isVirt ? 'text-slate-600' : 'text-gray-400'}`}>
                  * 주식 시세는 KIS 모의투자 API 기준 약 15~20초 지연
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
                      <h2 className={`text-xl md:text-2xl font-bold ${!isVirt ? 'text-white' : 'text-whale-dark'}`}>{liveSelectedAsset.name}</h2>
                      <p className={`text-sm ${!isVirt ? 'text-slate-500' : 'text-gray-500'}`}>
                        {liveSelectedAsset.symbol}
                        {liveSelectedAsset.assetType === 'CRYPTO' ? ' / KRW' : ''}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <div className={`text-2xl md:text-3xl font-bold mb-1 ${!isVirt ? 'text-white' : 'text-whale-dark'}`}>
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

                      {chartType === 'area' ? (
                        connected ? (
                          <RealtimeChart
                            symbol={liveSelectedAsset.symbol}
                            price={liveSelectedAsset.price}
                            isDark={!isVirt}
                          />
                        ) : (
                          <div className={`rounded-xl p-8 text-center border ${!isVirt ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-gray-50 border-gray-100'}`}>
                            <div className={`text-sm ${!isVirt ? 'text-slate-400' : 'text-gray-400'}`}>실시간 연결 중... 잠시 후 차트가 표시됩니다</div>
                          </div>
                        )
                      ) : (
                        <ChartLoadingWrapper symbol={liveSelectedAsset.symbol} isDark={!isVirt}>
                          <TradingChart
                            symbol={liveSelectedAsset.symbol}
                            price={liveSelectedAsset.price}
                            changeRate={liveSelectedAsset.changeRate}
                            isDark={!isVirt}
                          />
                        </ChartLoadingWrapper>
                      )}
                    </div>
                  ) : (
                    <div className="mt-4">
                      <TradingChart
                        symbol={liveSelectedAsset.symbol}
                        price={liveSelectedAsset.price}
                        changeRate={liveSelectedAsset.changeRate}
                        assetType="STOCK"
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
                      {formatCurrency(liveSelectedAsset.price - liveSelectedAsset.change)}
                    </div>
                  </div>
                  <div className="card text-center">
                    <div className={`text-sm mb-1 ${!isVirt ? 'text-slate-400' : 'text-gray-600'}`}>등락률</div>
                    <div className={`text-xl font-bold ${liveSelectedAsset.changeRate >= 0 ? 'price-up' : 'price-down'}`}>
                      {liveSelectedAsset.changeRate >= 0 ? '+' : ''}{liveSelectedAsset.changeRate.toFixed(2)}%
                    </div>
                  </div>
                  <div className="card text-center">
                    <div className={`text-sm mb-1 ${!isVirt ? 'text-slate-400' : 'text-gray-600'}`}>등락액</div>
                    <div className={`text-xl font-bold ${liveSelectedAsset.change >= 0 ? 'price-up' : 'price-down'}`}>
                      {liveSelectedAsset.change >= 0 ? '+' : ''}{formatCurrency(liveSelectedAsset.change)}
                    </div>
                  </div>
                  <div className="card text-center">
                    <div className={`text-sm mb-1 ${!isVirt ? 'text-slate-400' : 'text-gray-600'}`}>거래량</div>
                    <div className={`text-xl font-bold ${!isVirt ? 'text-white' : 'text-whale-dark'}`}>
                      {formatVolume(liveSelectedAsset.volume)}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="card text-center py-16">
                <div className={`text-sm font-medium tracking-wide mb-2 ${!isVirt ? 'text-slate-500' : 'text-gray-300'}`}>종목을 선택해주세요</div>
                <div className={`text-xs ${!isVirt ? 'text-slate-600' : 'text-gray-400'}`}>좌측 목록에서 종목을 클릭하면 상세 정보를 확인할 수 있습니다</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketPage;
