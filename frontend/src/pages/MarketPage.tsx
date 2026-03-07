import { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '../components/Header';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import RealtimeChart from '../components/RealtimeChart';
import { marketService, type MarketPrice, type AssetType } from '../services/marketService';
import { useRealtimePrice } from '../hooks/useRealtimePrice';

const MarketPage = () => {
  const [assetType, setAssetType] = useState<AssetType>('CRYPTO');
  const [selectedAsset, setSelectedAsset] = useState<MarketPrice | null>(null);
  const [assetList, setAssetList] = useState<MarketPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'change'>('name');
  const [filterText, setFilterText] = useState('');

  // 실시간 WebSocket 구독 (코인 탭일 때만)
  const { prices: realtimePrices, connected } = useRealtimePrice({
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
  }, [selectedAsset, realtimePrices, assetType]);

  const getDemoStocks = (): MarketPrice[] => [
    { assetType: 'STOCK', symbol: '005930', name: '삼성전자', price: 75000, change: 1500, changeRate: 2.04, volume: 12500000, market: 'KRX' },
    { assetType: 'STOCK', symbol: '000660', name: 'SK하이닉스', price: 145000, change: -2000, changeRate: -1.36, volume: 3500000, market: 'KRX' },
    { assetType: 'STOCK', symbol: '035420', name: 'NAVER', price: 185000, change: 3000, changeRate: 1.65, volume: 1200000, market: 'KRX' },
    { assetType: 'STOCK', symbol: '035720', name: '카카오', price: 52000, change: -500, changeRate: -0.95, volume: 2500000, market: 'KRX' },
  ];

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const prices = await marketService.getPrices(assetType).catch(() => getDemoStocks());
      setAssetList(prices);
      if (prices.length > 0 && !selectedAsset) {
        setSelectedAsset(prices[0]);
      }
    } catch {
      const demo = getDemoStocks();
      setAssetList(demo);
      if (demo.length > 0 && !selectedAsset) {
        setSelectedAsset(demo[0]);
      }
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
              onClick={() => { setAssetType('STOCK'); setSelectedAsset(null); }}
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
              onClick={() => { setAssetType('CRYPTO'); setSelectedAsset(null); }}
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
                <input
                  type="text"
                  placeholder="종목명 또는 코드 검색..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  className="input-field"
                />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'name' | 'price' | 'change')}
                  className="input-field bg-white"
                >
                  <option value="name">이름순</option>
                  <option value="price">가격순</option>
                  <option value="change">등락률순</option>
                </select>
              </div>

              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {filteredAndSortedAssets.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-4xl mb-3">🔍</div>
                    <div className="text-gray-500 font-medium">검색 결과가 없습니다</div>
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
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-whale-dark">{liveSelectedAsset.name}</h2>
                      <p className="text-gray-500">
                        {liveSelectedAsset.symbol}
                        {liveSelectedAsset.assetType === 'CRYPTO' ? ' / KRW' : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-whale-dark mb-1">
                        {formatCurrency(liveSelectedAsset.price)}
                      </div>
                      <div className={`text-lg font-semibold ${liveSelectedAsset.changeRate >= 0 ? 'price-up' : 'price-down'}`}>
                        {liveSelectedAsset.change >= 0 ? '+' : ''}
                        {formatCurrency(liveSelectedAsset.change)} ({liveSelectedAsset.changeRate >= 0 ? '+' : ''}
                        {liveSelectedAsset.changeRate.toFixed(2)}%)
                      </div>
                    </div>
                  </div>

                  {/* 실시간 차트 */}
                  {assetType === 'CRYPTO' && connected ? (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-semibold text-whale-dark">실시간 차트</h3>
                        <span className="text-xs text-gray-400">WebSocket 실시간 데이터</span>
                      </div>
                      <RealtimeChart
                        symbol={liveSelectedAsset.symbol}
                        price={liveSelectedAsset.price}
                        className="rounded-lg overflow-hidden"
                      />
                    </div>
                  ) : (
                    <div className="mt-4 bg-gray-50 rounded-lg p-8 text-center">
                      <div className="text-gray-400 text-sm">
                        {assetType === 'CRYPTO'
                          ? '실시간 연결 중... 잠시 후 차트가 표시됩니다'
                          : '주식 실시간 차트는 준비 중입니다'}
                      </div>
                    </div>
                  )}
                </div>

                {/* 시장 통계 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="card text-center">
                    <div className="text-sm text-gray-600 mb-1">전일 종가</div>
                    <div className="text-xl font-bold text-whale-dark">
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
              <div className="card text-center py-12">
                <div className="text-4xl mb-3">📊</div>
                <div className="text-gray-500 font-medium">종목을 선택하세요</div>
                <div className="text-sm text-gray-400 mt-1">좌측 목록에서 종목을 클릭하여 상세 정보를 확인하세요</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketPage;
