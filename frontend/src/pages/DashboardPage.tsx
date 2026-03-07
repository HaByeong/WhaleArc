import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import { tradeService, type Portfolio, type Trade, type StockPrice } from '../services/tradeService';
import { useAuth } from '../contexts/AuthContext';
import { usePolling } from '../hooks/usePolling';

const DashboardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  const [topMovers, setTopMovers] = useState<StockPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || '사용자';

  useEffect(() => {
    loadData();
  }, []);

  const pollData = useCallback(async () => {
    try {
      const [portfolioData, tradesData, stocksData] = await Promise.all([
        tradeService.getPortfolio().catch(() => null),
        tradeService.getTrades().catch(() => []),
        tradeService.getStockList().catch(() => []),
      ]);
      if (portfolioData) setPortfolio(portfolioData);
      if (tradesData.length) setRecentTrades(tradesData.slice(0, 5));
      if (stocksData.length) {
        const sorted = [...stocksData].sort((a, b) => Math.abs(b.changeRate) - Math.abs(a.changeRate));
        setTopMovers(sorted.slice(0, 5));
      }
    } catch {
      // 폴링 실패는 무시
    }
  }, []);
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

      const [portfolioData, tradesData, stocksData] = await Promise.all([
        tradeService.getPortfolio().catch(() => getDemoPortfolio()),
        tradeService.getTrades().catch(() => []),
        tradeService.getStockList().catch(() => []),
      ]);

      setPortfolio(portfolioData);
      setRecentTrades(tradesData.slice(0, 5));
      if (stocksData.length) {
        const sorted = [...stocksData].sort((a, b) => Math.abs(b.changeRate) - Math.abs(a.changeRate));
        setTopMovers(sorted.slice(0, 5));
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
                <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center text-2xl backdrop-blur-sm">
                  🐋
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold">
                    {displayName}님, 환영합니다!
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
          {/* 보유 종목 */}
          {portfolio && portfolio.holdings.length > 0 && (
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
                      <div className="font-semibold text-sm text-gray-800">{holding.stockName}</div>
                      <div className="text-xs text-gray-400">{holding.quantity}개 보유</div>
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
          )}

          {/* 시세 변동 상위 */}
          {topMovers.length > 0 && (
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
                {topMovers.map((stock) => (
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

        {/* 하단: 최근 체결 + 빠른 액션 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 최근 체결 내역 */}
          <div className="lg:col-span-2 card">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-whale-dark">최근 체결 내역</h2>
              <button
                onClick={() => navigate('/trade')}
                className="text-sm text-whale-light hover:text-whale-accent font-medium"
              >
                전체 내역
              </button>
            </div>
            {recentTrades.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">종목</th>
                      <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">구분</th>
                      <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500">체결가</th>
                      <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500">수량</th>
                      <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500">금액</th>
                      <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500">시간</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTrades.map((trade) => (
                      <tr key={trade.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                        <td className="py-3 text-sm font-medium text-gray-800">{trade.stockName}</td>
                        <td className="py-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            trade.orderType === 'BUY'
                              ? 'bg-red-50 text-red-500'
                              : 'bg-blue-50 text-blue-500'
                          }`}>
                            {trade.orderType === 'BUY' ? '매수' : '매도'}
                          </span>
                        </td>
                        <td className="py-3 text-sm text-right text-gray-700">{formatCurrency(trade.price)}</td>
                        <td className="py-3 text-sm text-right text-gray-700">{trade.quantity}개</td>
                        <td className="py-3 text-sm text-right font-semibold text-gray-800">{formatCurrency(trade.totalAmount)}</td>
                        <td className="py-3 text-xs text-right text-gray-400">
                          {new Date(trade.executedAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">📋</div>
                <div className="text-gray-500 font-medium">아직 거래 내역이 없습니다</div>
                <div className="text-sm text-gray-400 mt-1">거래를 시작하면 체결 내역이 표시됩니다</div>
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
