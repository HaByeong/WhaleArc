import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import { tradeService, type Portfolio, type StockPrice } from '../services/tradeService';
import { quantStoreService, type ProductPurchase, cryptoDisplayName, formatQuantity } from '../services/quantStoreService';
import { userService } from '../services/userService';
import { useAuth } from '../contexts/AuthContext';
import { usePolling } from '../hooks/usePolling';
import { useRealtimePrice } from '../hooks/useRealtimePrice';

const DashboardPage = () => {
  const navigate = useNavigate();
  const { user, profileName } = useAuth();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [watchlist, setWatchlist] = useState<StockPrice[]>([]);
  const [topMovers, setTopMovers] = useState<StockPrice[]>([]);
  const [favoriteAssets, setFavoriteAssets] = useState<string[]>([]);
  const [activePurchases, setActivePurchases] = useState<ProductPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 실시간 WebSocket 시세
  const { prices: realtimePrices } = useRealtimePrice({ enabled: true });

  // 관심 종목에 실시간 시세 병합
  const liveWatchlist = useMemo(() => {
    if (realtimePrices.size === 0) return watchlist;
    return watchlist.map((stock) => {
      const rt = realtimePrices.get(stock.stockCode);
      if (rt) {
        return { ...stock, currentPrice: rt.price, change: rt.change, changeRate: rt.changeRate, volume: rt.volume };
      }
      return stock;
    });
  }, [watchlist, realtimePrices]);

  // 시세 변동 상위에도 실시간 반영
  const liveTopMovers = useMemo(() => {
    if (realtimePrices.size === 0) return topMovers;
    return topMovers.map((stock) => {
      const rt = realtimePrices.get(stock.stockCode);
      if (rt) {
        return { ...stock, currentPrice: rt.price, change: rt.change, changeRate: rt.changeRate, volume: rt.volume };
      }
      return stock;
    });
  }, [topMovers, realtimePrices]);

  const displayName = profileName || user?.user_metadata?.name || user?.email?.split('@')[0] || '사용자';

  useEffect(() => {
    loadData();
  }, []);

  const pollData = useCallback(async () => {
    try {
      const [portfolioData, stocksData] = await Promise.all([
        tradeService.getPortfolio().catch(() => null),
        tradeService.getStockList().catch(() => []),
      ]);
      if (portfolioData) setPortfolio(portfolioData);
      if (stocksData.length) {
        const sorted = [...stocksData].sort((a, b) => Math.abs(b.changeRate) - Math.abs(a.changeRate));
        setTopMovers(sorted.slice(0, 5));
        if (favoriteAssets.length > 0) {
          const favSet = new Set(favoriteAssets);
          const SYMBOL_ALIASES: Record<string, string> = { MATIC: 'POL', POL: 'MATIC' };
          for (const fav of favoriteAssets) {
            const alias = SYMBOL_ALIASES[fav];
            if (alias) favSet.add(alias);
          }
          setWatchlist(stocksData.filter((s) => favSet.has(s.stockCode)));
        }
      }
    } catch {
      // 폴링 실패는 무시
    }
  }, [favoriteAssets]);
  usePolling(pollData, 15000);

  const getDemoPortfolio = (): Portfolio => ({
    id: 'demo-1',
    userId: 'demo-user',
    cashBalance: 5000000,
    totalValue: 12500000,
    returnRate: 25.0,
    holdings: [
      {
        stockCode: 'BTC',
        stockName: '비트코인',
        quantity: 0.05,
        averagePrice: 85000000,
        currentPrice: 95000000,
        marketValue: 4750000,
        profitLoss: 500000,
        returnRate: 11.76,
      },
      {
        stockCode: 'ETH',
        stockName: '이더리움',
        quantity: 1.5,
        averagePrice: 3200000,
        currentPrice: 3500000,
        marketValue: 5250000,
        profitLoss: 450000,
        returnRate: 9.38,
      },
    ],
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [portfolioData, stocksData, profile, purchaseData] = await Promise.all([
        tradeService.getPortfolio().catch(() => getDemoPortfolio()),
        tradeService.getStockList().catch(() => []),
        userService.getProfile().catch(() => null),
        quantStoreService.getMyPurchases().catch(() => ({ purchases: [], purchasedProductIds: [] })),
      ]);

      setActivePurchases(purchaseData.purchases.filter((p) => p.status === 'ACTIVE'));

      const favAssets = profile?.favoriteAssets?.length ? profile.favoriteAssets : [];
      setFavoriteAssets(favAssets);
      setPortfolio(portfolioData);
      if (stocksData.length) {
        const sorted = [...stocksData].sort((a, b) => Math.abs(b.changeRate) - Math.abs(a.changeRate));
        setTopMovers(sorted.slice(0, 5));
        if (favAssets.length > 0) {
          const favSet = new Set(favAssets);
          // MATIC↔POL 등 리브랜딩 심볼 양방향 매핑
          const SYMBOL_ALIASES: Record<string, string> = { MATIC: 'POL', POL: 'MATIC' };
          for (const fav of favAssets) {
            const alias = SYMBOL_ALIASES[fav];
            if (alias) favSet.add(alias);
          }
          setWatchlist(stocksData.filter((s) => favSet.has(s.stockCode)));
        }
      }
    } catch (err: any) {
      setPortfolio(getDemoPortfolio());
      setError(err.message || '데이터를 불러오는데 실패했습니다.');
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header showNav={true} />
        <LoadingSpinner fullScreen={false} message="데이터를 불러오는 중..." />
      </div>
    );
  }

  if (error) {
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
        {/* 환영 메시지 */}
        <div className="mb-8 bg-gradient-to-r from-whale-dark to-whale-light rounded-2xl shadow-xl p-6 md:p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-whale-accent opacity-10 rounded-full blur-2xl"></div>

          <div className="relative z-10">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center backdrop-blur-sm p-1.5">
                  <img src="/whales/blue-whale.png" alt="고래" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold">
                    {displayName}님, 다시 바다에 오셨군요!
                  </h1>
                  <p className="text-blue-100 text-sm md:text-base mt-1">
                    오늘도 시장의 바다를 유영해볼까요?
                  </p>
                </div>
              </div>

              {portfolio && (
                <div className="flex items-center space-x-6">
                  <div className="text-center">
                    <div className="text-xs md:text-sm text-blue-200 mb-1">총 자산</div>
                    <div className="text-xl md:text-2xl font-bold">
                      {formatCurrency(portfolio.totalValue)}
                    </div>
                  </div>
                  <div className="h-12 w-px bg-white bg-opacity-30"></div>
                  <div className="text-center">
                    <div className="text-xs md:text-sm text-blue-200 mb-1">수익률</div>
                    <div className={`text-xl md:text-2xl font-bold ${
                      portfolio.returnRate >= 0 ? 'text-red-300' : 'text-blue-300'
                    }`}>
                      {portfolio.returnRate >= 0 ? '+' : ''}
                      {portfolio.returnRate.toFixed(2)}%
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 포트폴리오 요약 카드 */}
        {portfolio && (
          <div
            className="mb-8 card card-hover cursor-pointer group"
            onClick={() => navigate('/my-portfolio')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/my-portfolio'); }}
            aria-label="내 포트폴리오 상세 보기"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-whale-dark group-hover:text-whale-light transition-colors">
                포트폴리오 요약
              </h2>
              <div className="flex items-center text-whale-light font-semibold text-sm group-hover:text-whale-accent transition-colors">
                상세 보기
                <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-5 border border-blue-200/50">
                <div className="text-sm text-gray-500 mb-1">총 자산</div>
                <div className="text-2xl font-bold text-whale-dark">
                  {formatCurrency(portfolio.totalValue)}
                </div>
              </div>
              <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-xl p-5 border border-gray-200/50">
                <div className="text-sm text-gray-500 mb-1">현금</div>
                <div className="text-2xl font-bold text-whale-dark">
                  {formatCurrency(portfolio.cashBalance)}
                </div>
              </div>
              <div className={`bg-gradient-to-br rounded-xl p-5 border ${
                portfolio.returnRate >= 0
                  ? 'from-red-50 to-red-100/50 border-red-200/50'
                  : 'from-blue-50 to-blue-100/50 border-blue-200/50'
              }`}>
                <div className="text-sm text-gray-500 mb-1">수익률</div>
                <div className={`text-2xl font-bold ${
                  portfolio.returnRate >= 0 ? 'text-red-600' : 'text-blue-600'
                }`}>
                  {portfolio.returnRate >= 0 ? '+' : ''}
                  {portfolio.returnRate.toFixed(2)}%
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* 보유 종목 or 빈 상태 */}
          {portfolio && portfolio.holdings.length > 0 ? (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-whale-dark">보유 종목</h2>
                <button
                  onClick={() => navigate('/my-portfolio')}
                  className="text-sm text-whale-light hover:text-whale-accent font-medium"
                >
                  전체 보기
                </button>
              </div>
              <div className="space-y-3">
                {portfolio.holdings.slice(0, 5).map((holding) => (
                  <div key={holding.stockCode} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm text-gray-800">{holding.stockName}</span>
                        {(() => {
                          const route = activePurchases.find((p) => p.purchasedAssets?.some(a => a.code === holding.stockCode));
                          return route ? (
                            <span className="px-1 py-0.5 text-[9px] font-semibold bg-whale-light/10 text-whale-light rounded">
                              {route.productName}
                            </span>
                          ) : null;
                        })()}
                      </div>
                      <div className="text-xs text-gray-400">{formatQuantity(holding.quantity)}개 보유</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-gray-800">{formatCurrency(holding.marketValue)}</div>
                      <div className={`text-xs font-semibold ${
                        holding.returnRate >= 0 ? 'text-red-500' : 'text-blue-500'
                      }`}>
                        {holding.returnRate >= 0 ? '+' : ''}{holding.returnRate.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : activePurchases.length > 0 ? (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-whale-dark">항해 중인 항로</h2>
                <button onClick={() => navigate('/store')} className="text-sm text-whale-light hover:text-whale-accent font-medium">
                  항로 상점
                </button>
              </div>
              <div className="space-y-3">
                {activePurchases.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <div className="font-semibold text-sm text-gray-800">{p.productName}</div>
                      <div className="text-xs text-gray-400">
                        투자: {formatCurrency(p.investmentAmount)} · {p.purchasedAssets?.map(a => cryptoDisplayName(a.code)).join(', ')}
                      </div>
                    </div>
                    <span className="px-2 py-1 text-xs font-semibold bg-green-50 text-green-600 rounded-full">항해 중</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="card flex flex-col items-center justify-center text-center py-10">
              <img src="/whales/gray-whale.png" alt="회색고래" className="w-16 h-16 object-contain mb-4 opacity-60" />
              <h3 className="text-lg font-bold text-whale-dark mb-1">아직 보유 종목이 없어요</h3>
              <p className="text-sm text-gray-400 mb-5">거래 또는 항로를 통해 첫 투자를 시작해보세요</p>
              <div className="flex gap-3">
                <button onClick={() => navigate('/trade')} className="btn-primary text-sm px-5 py-2">
                  거래하기
                </button>
                <button onClick={() => navigate('/store')} className="btn-secondary text-sm px-5 py-2">
                  항로 상점
                </button>
              </div>
            </div>
          )}

          {/* 시세 변동 상위 */}
          {liveTopMovers.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-whale-dark">시세 변동 상위</h2>
                <button
                  onClick={() => navigate('/market')}
                  className="text-sm text-whale-light hover:text-whale-accent font-medium"
                >
                  전체 시세
                </button>
              </div>
              <div className="space-y-3">
                {liveTopMovers.map((stock) => (
                  <div
                    key={stock.stockCode}
                    className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50 rounded-lg px-2 -mx-2"
                    onClick={() => navigate('/trade')}
                  >
                    <div>
                      <div className="font-semibold text-sm text-gray-800">{stock.stockName}</div>
                      <div className="text-xs text-gray-400">{stock.stockCode}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-gray-800">{formatCurrency(stock.currentPrice)}</div>
                      <div className={`text-xs font-semibold ${
                        stock.changeRate >= 0 ? 'text-red-500' : 'text-blue-500'
                      }`}>
                        {stock.changeRate >= 0 ? '+' : ''}{stock.changeRate.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 하단: 관심 종목 + 빠른 액션 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 관심 종목 */}
          <div className="lg:col-span-2 card">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-whale-dark">관심 종목</h2>
              <button
                onClick={() => navigate('/user')}
                className="text-sm text-whale-light hover:text-whale-accent font-medium"
              >
                종목 편집
              </button>
            </div>
            {liveWatchlist.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {liveWatchlist.map((stock) => (
                  <div
                    key={stock.stockCode}
                    className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-whale-light/40 hover:shadow-sm cursor-pointer transition-all"
                    onClick={() => navigate('/trade')}
                  >
                    <div>
                      <div className="font-semibold text-sm text-gray-800">{stock.stockName}</div>
                      <div className="text-xs text-gray-400">{stock.stockCode}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-gray-800">{formatCurrency(stock.currentPrice)}</div>
                      <div className={`text-xs font-semibold ${
                        stock.changeRate >= 0 ? 'text-red-500' : 'text-blue-500'
                      }`}>
                        {stock.changeRate >= 0 ? '+' : ''}{stock.changeRate.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <img src="/whales/beluga.png" alt="벨루가" className="w-16 h-16 object-contain mx-auto mb-3" />
                <div className="text-gray-500 font-medium">관심 종목이 없습니다</div>
                <div className="text-sm text-gray-400 mt-1">
                  프로필에서 관심 종목을 추가하면 여기에 실시간 시세가 표시됩니다
                </div>
                <button
                  onClick={() => navigate('/user')}
                  className="mt-4 btn-secondary text-sm"
                >
                  관심 종목 추가하기
                </button>
              </div>
            )}
          </div>

          {/* 우측 사이드바 */}
          <div className="space-y-6">
            {/* 빠른 액션 */}
            <div className="card !p-5">
              <h2 className="text-lg font-bold text-whale-dark mb-3">어디로 항해할까요?</h2>
              <div className="space-y-2">
                <button
                  onClick={() => navigate('/trade')}
                  className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg bg-gradient-to-r from-whale-light to-whale-accent text-white font-semibold text-sm shadow-sm hover:shadow-md hover:opacity-95 transition-all min-h-[44px] border border-transparent"
                >
                  거래하기
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
                {[
                  { path: '/market', label: '시세 확인하기' },
                  { path: '/strategy', label: '전략 분석하기' },
                  { path: '/ranking', label: '투자 현황 보기' },
                ].map((item) => (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg bg-white border border-gray-200 text-sm font-semibold text-whale-dark hover:border-whale-light/40 hover:bg-gray-50 transition-all min-h-[44px]"
                  >
                    {item.label}
                    <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                ))}
              </div>
            </div>

            {/* 포트폴리오 통계 */}
            {portfolio && (
              <div className="card">
                <h2 className="text-lg font-bold text-whale-dark mb-4">포트폴리오 통계</h2>
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">총 투자금액</span>
                    <span className="text-sm font-bold text-whale-dark">{formatCurrency(portfolio.totalValue - portfolio.cashBalance)}</span>
                  </div>
                  <div className="h-px bg-gray-100" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">총 수익금</span>
                    <span className={`text-sm font-bold ${portfolio.returnRate >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                      {portfolio.returnRate >= 0 ? '+' : ''}{formatCurrency(Math.round(portfolio.totalValue * portfolio.returnRate / (100 + portfolio.returnRate)))}
                    </span>
                  </div>
                  <div className="h-px bg-gray-100" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">보유 종목 수</span>
                    <span className="text-sm font-bold text-whale-dark">{portfolio.holdings.length}개</span>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
