import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import { tradeService, type Portfolio } from '../services/tradeService';
import { quantStoreService, type ProductPurchase, type PurchasePerformance, cryptoDisplayName, formatQuantity } from '../services/quantStoreService';
import { useAuth } from '../contexts/AuthContext';

/**
 * 내 포트폴리오 상세 페이지
 */
const MyPortfolioPage = () => {
  const navigate = useNavigate();
  const { user, profileName } = useAuth();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [activePurchases, setActivePurchases] = useState<ProductPurchase[]>([]);
  const [purchasePerformance, setPurchasePerformance] = useState<PurchasePerformance[]>([]);
  const [assetRouteMap, setAssetRouteMap] = useState<Record<string, { routeName: string; quantity: number }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const displayName = profileName || user?.user_metadata?.name || user?.email?.split('@')[0] || '사용자';

  useEffect(() => {
    loadPortfolio();
  }, []);

  const loadPortfolio = async () => {
    try {
      setLoading(true);
      setError(null);

      const [portfolioData, purchaseData, perfData] = await Promise.all([
        tradeService.getPortfolio().catch((apiError: any) => {
          if (apiError.response?.status === 404 || apiError.code === 'ERR_NETWORK') {
            return getMockPortfolio();
          }
          throw apiError;
        }),
        quantStoreService.getMyPurchases().catch(() => ({ purchases: [], purchasedProductIds: [] })),
        quantStoreService.getMyPurchasesPerformance().catch(() => [] as PurchasePerformance[]),
      ]);

      setPurchasePerformance(perfData);

      setPortfolio(portfolioData);

      const active = purchaseData.purchases.filter((p) => p.status === 'ACTIVE');
      setActivePurchases(active);

      // 자산 → 항로 이름 + 수량 매핑
      const routeMap: Record<string, { routeName: string; quantity: number }> = {};
      for (const p of active) {
        for (const asset of p.purchasedAssets || []) {
          if (routeMap[asset.code]) {
            routeMap[asset.code].quantity += asset.quantity;
          } else {
            routeMap[asset.code] = { routeName: p.productName, quantity: asset.quantity };
          }
        }
      }
      setAssetRouteMap(routeMap);
    } catch (err: any) {
      setError(err.message || '포트폴리오 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 목업 데이터
  const getMockPortfolio = (): Portfolio => {
    return {
      id: 'my-portfolio-1',
      userId: 'demo',
      cashBalance: 5000000,
      totalValue: 12500000,
      returnRate: 25.0,
      holdings: [
        {
          stockCode: '005930',
          stockName: '삼성전자',
          quantity: 100,
          averagePrice: 60000,
          currentPrice: 75000,
          marketValue: 7500000,
          profitLoss: 1500000,
          returnRate: 25.0,
        },
        {
          stockCode: '000660',
          stockName: 'SK하이닉스',
          quantity: 50,
          averagePrice: 120000,
          currentPrice: 135000,
          marketValue: 6750000,
          profitLoss: 750000,
          returnRate: 12.5,
        },
      ],
    };
  };

  const getReturnColor = (returnValue: number) => {
    if (returnValue > 0) return 'text-red-600';
    if (returnValue < 0) return 'text-blue-600';
    return 'text-gray-600';
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header showNav={true} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingSpinner fullScreen={false} message="포트폴리오 정보를 불러오는 중..." />
        </div>
      </div>
    );
  }

  if (error && !portfolio) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header showNav={true} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <ErrorMessage message={error} onRetry={loadPortfolio} />
        </div>
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header showNav={true} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <ErrorMessage message="포트폴리오를 찾을 수 없습니다." />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header showNav={true} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link 
          to="/dashboard" 
          className="inline-flex items-center text-gray-600 hover:text-whale-light mb-6 transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          대시보드로 돌아가기
        </Link>

        {/* 포트폴리오 기본 정보 */}
        <div className="bg-gradient-to-r from-whale-dark to-whale-light rounded-2xl shadow-xl p-6 md:p-8 text-white mb-6 relative overflow-hidden">
          {/* 배경 장식 */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-whale-accent opacity-10 rounded-full blur-2xl"></div>
          
          <div className="relative z-10">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center backdrop-blur-sm p-1.5">
                <img src="/whales/sperm-whale.png" alt="향유고래" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">
                  내 포트폴리오
                </h1>
                <p className="text-blue-100 text-sm md:text-base mt-1">
                  {displayName}님의 포트폴리오
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                <div className="text-blue-200 text-sm mb-1">총 자산</div>
                <div className="text-2xl font-bold">
                  {formatAmount(portfolio.totalValue)}
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                <div className="text-blue-200 text-sm mb-1">현금</div>
                <div className="text-2xl font-bold">
                  {formatAmount(portfolio.cashBalance)}
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                <div className="text-blue-200 text-sm mb-1">수익률</div>
                <div className={`text-2xl font-bold ${
                  portfolio.returnRate >= 0 ? 'text-red-300' : 'text-blue-300'
                }`}>
                  {portfolio.returnRate >= 0 ? '+' : ''}
                  {portfolio.returnRate.toFixed(2)}%
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                <div className="text-blue-200 text-sm mb-1">보유 종목 수</div>
                <div className="text-2xl font-bold">
                  {portfolio.holdings.length}개
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 보유 종목 */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-whale-dark">보유 종목</h2>
                <button
                  onClick={() => navigate('/trade')}
                  className="btn-primary text-sm px-4 py-2"
                >
                  거래하기
                </button>
              </div>
              
              {portfolio.holdings.length === 0 ? (
                <div className="text-center py-12">
                  <img src="/whales/gray-whale.png" alt="빈 목록" className="w-16 h-16 object-contain mx-auto mb-3 opacity-60" />
                  <div className="text-gray-500 font-medium mb-2">보유 종목이 없습니다</div>
                  <div className="text-sm text-gray-400 mb-4">거래 페이지에서 코인을 매수해보세요</div>
                  <button
                    onClick={() => navigate('/trade')}
                    className="btn-primary"
                  >
                    거래하러 가기
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">종목명</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">보유수량</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">평균단가</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">현재가</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">수익률</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">평가금액</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {portfolio.holdings.map((holding) => (
                        <tr 
                          key={holding.stockCode} 
                          className="hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => navigate('/trade')}
                        >
                          <td className="px-4 py-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-whale-dark">{holding.stockName}</span>
                                {assetRouteMap[holding.stockCode] && (
                                  <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-whale-light/10 text-whale-light rounded">
                                    {assetRouteMap[holding.stockCode].routeName}
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-gray-500">{holding.stockCode}</div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <div className="font-semibold">{formatQuantity(holding.quantity)}개</div>
                            {assetRouteMap[holding.stockCode] && (
                              <div className="text-[11px] text-whale-light">
                                항로 {formatQuantity(assetRouteMap[holding.stockCode].quantity)}개
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-4 text-right text-gray-600">{formatAmount(holding.averagePrice)}</td>
                          <td className="px-4 py-4 text-right font-semibold text-whale-dark">{formatAmount(holding.currentPrice)}</td>
                          <td className={`px-4 py-4 text-right font-bold ${getReturnColor(holding.returnRate)}`}>
                            {holding.returnRate > 0 ? '+' : ''}{holding.returnRate.toFixed(2)}%
                          </td>
                          <td className="px-4 py-4 text-right font-semibold">
                            {formatAmount(holding.marketValue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* 사이드바 */}
          <div className="lg:col-span-1 space-y-6">
            {/* 항해 중인 항로 — 수익률 카드 */}
            {(purchasePerformance.length > 0 || activePurchases.length > 0) && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-whale-dark">항해 중인 항로</h2>
                  <button
                    onClick={() => navigate('/store')}
                    className="text-sm text-whale-light hover:text-whale-accent font-medium"
                  >
                    항로 상점
                  </button>
                </div>
                <div className="space-y-4">
                  {purchasePerformance.length > 0 ? purchasePerformance.map((perf) => (
                    <div key={perf.purchaseId} className="bg-gradient-to-r from-whale-light/5 to-whale-accent/5 border border-whale-light/20 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-bold text-sm text-whale-dark">{perf.productName}</div>
                        {perf.strategyType === 'TURTLE' && (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-700 rounded">WhaleArc 독점</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mb-2">투자: {formatAmount(perf.investmentAmount)}</div>
                      <div className={`text-lg font-bold mb-3 ${perf.totalReturnRate >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                        {perf.totalReturnRate >= 0 ? '+' : ''}{perf.totalReturnRate.toFixed(2)}%
                        <span className="text-xs font-normal ml-1">
                          ({perf.totalPnl >= 0 ? '+' : ''}{formatAmount(Math.round(perf.totalPnl))})
                        </span>
                      </div>

                      {/* 자산별 수익률 */}
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {perf.assets.map((a) => (
                          <span
                            key={a.code}
                            className={`px-2 py-1 text-[11px] font-semibold rounded ${
                              a.returnRate >= 0 ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                            }`}
                          >
                            {a.code} {a.returnRate >= 0 ? '+' : ''}{a.returnRate.toFixed(1)}%
                          </span>
                        ))}
                      </div>

                      {/* 터틀 전용 통계 */}
                      {perf.strategyType === 'TURTLE' && perf.totalTradeCount != null && (
                        <div className="mt-2 pt-2 border-t border-whale-light/10 text-[11px] text-gray-500 flex gap-3">
                          <span>거래 {perf.totalTradeCount}회</span>
                          <span>승률 {perf.totalTradeCount > 0
                            ? ((perf.totalWinCount || 0) / perf.totalTradeCount * 100).toFixed(1)
                            : '0.0'}%</span>
                          <span>실현 {formatAmount(Math.round(perf.realizedPnl || 0))}</span>
                        </div>
                      )}
                    </div>
                  )) : activePurchases.map((p) => (
                    <div key={p.id} className="bg-gradient-to-r from-whale-light/5 to-whale-accent/5 border border-whale-light/20 rounded-lg p-3">
                      <div className="font-semibold text-sm text-whale-dark mb-1">{p.productName}</div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>투자: {formatAmount(p.investmentAmount)}</span>
                        <span>{p.purchasedAssets?.length || 0}개 자산</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {p.purchasedAssets?.map((asset) => (
                          <span key={asset.code} className="px-1.5 py-0.5 text-[10px] bg-whale-light/10 text-whale-light rounded font-medium">
                            {cryptoDisplayName(asset.code)} {formatQuantity(asset.quantity)}개
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 빠른 액션 */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-whale-dark mb-4">빠른 액션</h2>
              <div className="space-y-3">
                <button
                  onClick={() => navigate('/trade')}
                  className="w-full btn-primary text-left flex items-center justify-between"
                >
                  <span>코인 거래하기</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <button
                  onClick={() => navigate('/strategy')}
                  className="w-full btn-secondary text-left flex items-center justify-between"
                >
                  <span>전략 분석하기</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <button
                  onClick={() => navigate('/ranking')}
                  className="w-full btn-secondary text-left flex items-center justify-between"
                >
                  <span>랭킹 확인하기</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* 포트폴리오 통계 */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-whale-dark mb-4">포트폴리오 통계</h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">총 투자금액</span>
                  <span className="font-semibold text-whale-dark">
                    {formatAmount(portfolio.totalValue - portfolio.cashBalance)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">총 수익금</span>
                  <span className={`font-semibold ${
                    portfolio.returnRate >= 0 ? 'text-red-600' : 'text-blue-600'
                  }`}>
                    {portfolio.returnRate >= 0 ? '+' : ''}
                    {formatAmount((portfolio.totalValue - portfolio.cashBalance) * (portfolio.returnRate / 100))}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">보유 종목 수</span>
                  <span className="font-semibold text-whale-dark">
                    {portfolio.holdings.length}개
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyPortfolioPage;

