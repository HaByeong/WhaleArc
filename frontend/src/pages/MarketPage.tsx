import { useState, useEffect, useCallback } from 'react';
import Header from '../components/Header';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import { marketService, type MarketPrice, type AssetType } from '../services/marketService';
import { usePolling } from '../hooks/usePolling';
import { XAxis, YAxis, ResponsiveContainer, Tooltip, AreaChart, Area } from 'recharts';

/**
 * 시장 페이지 - 주식/코인 시세 조회
 * - assetType 탭(STOCK/CRYPTO)에 따라 백엔드 /api/market/prices 호출
 * - 백엔드 실패 시에는 기존 데모 데이터로 폴백
 */
const MarketPage = () => {
  const [assetType, setAssetType] = useState<AssetType>('STOCK');
  const [selectedAsset, setSelectedAsset] = useState<MarketPrice | null>(null);
  const [assetList, setAssetList] = useState<MarketPrice[]>([]);
  const [priceHistory, setPriceHistory] = useState<{ time: string; price: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'change'>('name');
  const [filterText, setFilterText] = useState('');

  useEffect(() => {
    loadData();
  }, [assetType]);

  // 스마트 폴링: 탭 비활성 시 자동 중지, 중복 요청 방지
  const pollPrices = useCallback(async () => {
    try {
      const prices = await marketService.getPrices(assetType);
      setAssetList(prices);
    } catch {
      // 폴링 실패는 조용히 무시
    }
  }, [assetType]);
  usePolling(pollPrices, 15000);

  // 데모 종목 데이터 (백엔드 실패 시 폴백)
  const getDemoStocks = (): MarketPrice[] => {
    const baseDate = new Date().toISOString();
    return [
      {
        assetType: 'STOCK',
        symbol: '005930',
        name: '삼성전자',
        price: 75000,
        change: 1500,
        changeRate: 2.04,
        volume: 12500000,
        market: 'KRX',
      },
      {
        assetType: 'STOCK',
        symbol: '000660',
        name: 'SK하이닉스',
        price: 145000,
        change: -2000,
        changeRate: -1.36,
        volume: 3500000,
        market: 'KRX',
      },
      {
        assetType: 'STOCK',
        symbol: '035420',
        name: 'NAVER',
        price: 185000,
        change: 3000,
        changeRate: 1.65,
        volume: 1200000,
        market: 'KRX',
      },
      {
        assetType: 'STOCK',
        symbol: '035720',
        name: '카카오',
        price: 52000,
        change: -500,
        changeRate: -0.95,
        volume: 2500000,
        market: 'KRX',
      },
    ];
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const prices = await marketService.getPrices(assetType).catch(() => {
        return getDemoStocks();
      });

      setAssetList(prices);

      if (prices.length > 0 && !selectedAsset) {
        setSelectedAsset(prices[0]);
      }
    } catch (err: any) {
      // 에러 발생 시에도 데모 데이터 표시
      const demo = getDemoStocks();
      setAssetList(demo);
      if (demo.length > 0 && !selectedAsset) {
        setSelectedAsset(demo[0]);
      }
    } finally {
      setLoading(false);
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

  const handleAssetSelect = (asset: MarketPrice) => {
    setSelectedAsset(asset);
    setPriceHistory(prev => [
      ...prev,
      { time: new Date().toLocaleTimeString(), price: asset.price },
    ].slice(-20));
  };

  // 필터링 및 정렬된 종목 목록
  const filteredAndSortedAssets = assetList
    .filter((asset) => {
      if (!asset) return false;
      const name = (asset.name ?? '').toLowerCase();
      const symbol = (asset.symbol ?? '').toLowerCase();
      const keyword = filterText.toLowerCase();
      return name.includes(keyword) || symbol.includes(keyword);
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'price':
          return b.price - a.price;
        case 'change':
          return b.changeRate - a.changeRate;
        default:
          return 0;
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
          <h1 className="text-3xl md:text-4xl font-bold text-whale-dark mb-2">시장 현황</h1>
          <p className="text-gray-600 mb-3">주식/코인 시세를 한 곳에서 확인하세요</p>
          <div className="flex space-x-3">
            <button
              type="button"
              className={`px-4 py-2 rounded-lg text-sm font-semibold min-h-[44px] ${
                assetType === 'STOCK'
                  ? 'bg-whale-light text-white shadow-md'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
              onClick={() => {
                setAssetType('STOCK');
                setSelectedAsset(null);
                setPriceHistory([]);
              }}
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
              onClick={() => {
                setAssetType('CRYPTO');
                setSelectedAsset(null);
                setPriceHistory([]);
              }}
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
              
              {/* 검색 및 정렬 */}
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

              {/* 종목 목록 */}
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
                          <div
                            className={`text-sm font-semibold ${
                                asset.changeRate >= 0 ? 'price-up' : 'price-down'
                            }`}
                          >
                              {asset.changeRate >= 0 ? '+' : ''}
                              {asset.changeRate.toFixed(2)}%
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
            {selectedAsset ? (
              <>
                {/* 종목 정보 카드 */}
                <div className="card">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-whale-dark">{selectedAsset.name}</h2>
                      <p className="text-gray-500">
                        {selectedAsset.symbol}
                        {selectedAsset.assetType === 'CRYPTO' ? ' / KRW' : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-whale-dark mb-1">
                        {formatCurrency(selectedAsset.price)}
                      </div>
                      <div
                        className={`text-lg font-semibold ${
                          selectedAsset.changeRate >= 0 ? 'price-up' : 'price-down'
                        }`}
                      >
                        {selectedAsset.change >= 0 ? '+' : ''}
                        {formatCurrency(selectedAsset.change)} ({selectedAsset.changeRate >= 0 ? '+' : ''}
                        {selectedAsset.changeRate.toFixed(2)}%)
                      </div>
                    </div>
                  </div>

                  {/* 실시간 가격 차트 */}
                  {priceHistory.length > 0 && (
                    <div className="mt-6">
                      <h3 className="text-lg font-semibold text-whale-dark mb-3">실시간 가격 추이</h3>
                      <ResponsiveContainer width="100%" height={250}>
                        <AreaChart data={priceHistory}>
                          <defs>
                            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#4a90e2" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#4a90e2" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="time" />
                          <YAxis domain={['auto', 'auto']} />
                          <Tooltip
                            formatter={(value: number) => formatCurrency(value)}
                            labelFormatter={(label) => `시간: ${label}`}
                          />
                          <Area
                            type="monotone"
                            dataKey="price"
                            stroke="#4a90e2"
                            strokeWidth={2}
                            fill="url(#colorPrice)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* 시장 통계 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="card text-center">
                    <div className="text-sm text-gray-600 mb-1">전일 종가</div>
                    <div className="text-xl font-bold text-whale-dark">
                      {formatCurrency(selectedAsset.price - selectedAsset.change)}
                    </div>
                  </div>
                  <div className="card text-center">
                    <div className="text-sm text-gray-600 mb-1">등락률</div>
                    <div
                      className={`text-xl font-bold ${
                        selectedAsset.changeRate >= 0 ? 'price-up' : 'price-down'
                      }`}
                    >
                      {selectedAsset.changeRate >= 0 ? '+' : ''}
                      {selectedAsset.changeRate.toFixed(2)}%
                    </div>
                  </div>
                  <div className="card text-center">
                    <div className="text-sm text-gray-600 mb-1">등락액</div>
                    <div
                      className={`text-xl font-bold ${
                        selectedAsset.change >= 0 ? 'price-up' : 'price-down'
                      }`}
                    >
                      {selectedAsset.change >= 0 ? '+' : ''}
                      {formatCurrency(selectedAsset.change)}
                    </div>
                  </div>
                  <div className="card text-center">
                    <div className="text-sm text-gray-600 mb-1">총 종목 수</div>
                    <div className="text-xl font-bold text-whale-dark">{assetList.length}개</div>
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

