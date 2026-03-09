import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Header from '../components/Header';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import apiClient from '../utils/api';

interface PortfolioSummary {
  portfolioId: string;
  portfolioName: string;
  nickname: string;
  currentRank: number;
  totalReturn: number;
  totalReturnAmount: number;
  initialCapital: number;
  totalValue: number;
  stockCount: number;
  cryptoCount: number;
  routeName?: string | null;
  routeStrategyType?: string | null;
  routeReturnRate?: number | null;
  routeDescription?: string | null;
}

const PortfolioDetailPage = () => {
  const { portfolioId } = useParams<{ portfolioId: string }>();
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (portfolioId) loadDetail();
  }, [portfolioId]);

  const loadDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get(`/api/rankings/portfolios/${portfolioId}`);
      setPortfolio(res.data.data);
    } catch (err: any) {
      setError(err.message || '포트폴리오 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const returnColor = (v: number) =>
    v > 0 ? 'text-red-500' : v < 0 ? 'text-blue-500' : 'text-gray-600';
  const signPrefix = (v: number) => (v > 0 ? '+' : '');
  const fmt = (amount: number) =>
    new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
  const fmtCompact = (amount: number) => {
    const abs = Math.abs(amount);
    if (abs >= 1_0000_0000) return `${(amount / 1_0000_0000).toFixed(1)}억`;
    if (abs >= 1_0000) return `${(amount / 1_0000).toFixed(0)}만`;
    return fmt(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header showNav />
        <div className="max-w-3xl mx-auto px-4 py-8">
          <LoadingSpinner fullScreen={false} message="포트폴리오 정보를 불러오는 중..." />
        </div>
      </div>
    );
  }

  if (error || !portfolio) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header showNav />
        <div className="max-w-3xl mx-auto px-4 py-8">
          <ErrorMessage message={error || '포트폴리오를 찾을 수 없습니다.'} onRetry={loadDetail} />
        </div>
      </div>
    );
  }

  const rankBadge = portfolio.currentRank <= 3
    ? ['', '/whales/blue-whale.png', '/whales/narwhal.png', '/whales/dolphin.png'][portfolio.currentRank]
    : null;

  const totalHoldings = portfolio.stockCount + portfolio.cryptoCount;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header showNav />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <Link
          to="/ranking"
          className="inline-flex items-center text-gray-500 hover:text-whale-light mb-6 text-sm transition-colors"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          투자 현황
        </Link>

        {/* 헤더 카드 */}
        <div className="bg-gradient-to-r from-whale-dark to-whale-light rounded-2xl shadow-xl p-6 md:p-8 text-white mb-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              {rankBadge ? (
                <img src={rankBadge} alt="" className="w-10 h-10 object-contain" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-lg">
                  {portfolio.currentRank}
                </div>
              )}
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">{portfolio.portfolioName}</h1>
                <p className="text-blue-200 text-sm">{portfolio.nickname} · {portfolio.currentRank}위</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                <div className="text-blue-200 text-xs mb-1">총 수익률</div>
                <div className={`text-xl md:text-2xl font-bold ${portfolio.totalReturn >= 0 ? 'text-red-300' : 'text-blue-300'}`}>
                  {signPrefix(portfolio.totalReturn)}{portfolio.totalReturn.toFixed(2)}%
                </div>
                <div className="text-blue-200 text-xs mt-1">
                  {signPrefix(portfolio.totalReturnAmount)}{fmt(Math.round(portfolio.totalReturnAmount))}
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                <div className="text-blue-200 text-xs mb-1">총 자산</div>
                <div className="text-xl md:text-2xl font-bold">{fmtCompact(portfolio.totalValue)}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                <div className="text-blue-200 text-xs mb-1">초기 자본</div>
                <div className="text-xl md:text-2xl font-bold">{fmtCompact(portfolio.initialCapital)}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                <div className="text-blue-200 text-xs mb-1">보유 종목</div>
                <div className="text-xl md:text-2xl font-bold">{totalHoldings}종목</div>
              </div>
            </div>
          </div>
        </div>

        {/* 투자 요약 */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-lg font-bold text-whale-dark mb-4">투자 요약</h2>
          <div className="space-y-3">
            {portfolio.stockCount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <img src="/whales/spotted-dolphin.png" alt="" className="w-5 h-5 object-contain" />
                  <span className="text-gray-600">주식</span>
                </div>
                <span className="font-semibold text-indigo-600">{portfolio.stockCount}종목</span>
              </div>
            )}
            {portfolio.cryptoCount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <img src="/whales/wild-cat-whale.png" alt="" className="w-5 h-5 object-contain" />
                  <span className="text-gray-600">코인</span>
                </div>
                <span className="font-semibold text-emerald-600">{portfolio.cryptoCount}종목</span>
              </div>
            )}
            {totalHoldings === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">아직 보유 종목이 없습니다</p>
            )}
          </div>
        </div>

        {/* 대표 항로 */}
        {portfolio.routeName && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
              <h2 className="text-lg font-bold text-whale-dark">대표 항로</h2>
            </div>

            <div className="bg-gradient-to-r from-whale-light/5 to-whale-accent/5 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-whale-dark text-lg">{portfolio.routeName}</span>
                  {portfolio.routeStrategyType === 'TURTLE' && (
                    <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-700 rounded">
                      WhaleArc 독점
                    </span>
                  )}
                </div>
              </div>

              {portfolio.routeReturnRate != null && (
                <div className="flex items-baseline gap-2 mb-4">
                  <span className={`text-3xl font-bold ${returnColor(portfolio.routeReturnRate)}`}>
                    {signPrefix(portfolio.routeReturnRate)}{portfolio.routeReturnRate.toFixed(2)}%
                  </span>
                  <span className="text-xs text-gray-400">항로 수익률</span>
                </div>
              )}

              <div className="space-y-2 pt-3 border-t border-gray-200">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">전략 유형</span>
                  <span className="font-medium text-gray-700">
                    {portfolio.routeStrategyType === 'TURTLE' ? '터틀 트레이딩' : '일반'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">포트폴리오 수익률</span>
                  <span className={`font-medium ${returnColor(portfolio.totalReturn)}`}>
                    {signPrefix(portfolio.totalReturn)}{portfolio.totalReturn.toFixed(2)}%
                  </span>
                </div>
              </div>

              {portfolio.routeDescription && (
                <div className="mt-4 pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-400 mb-1">전략 로직</p>
                  <p className="text-sm text-gray-600 leading-relaxed">{portfolio.routeDescription}</p>
                </div>
              )}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-300 mt-6">
          개인정보 보호를 위해 보유종목 상세 및 거래 내역은 비공개입니다
        </p>
      </div>
    </div>
  );
};

export default PortfolioDetailPage;
