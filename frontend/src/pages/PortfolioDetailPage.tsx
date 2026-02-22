import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Header from '../components/Header';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import apiClient from '../utils/api';

interface PortfolioDetail {
  portfolioId: string;
  portfolioName: string;
  nickname: string;
  currentRank: number;
  totalReturn: number;
  totalReturnAmount: number;
  initialCapital: number;
  totalValue: number;
  currentCash: number;
  holdings: {
    stockCode: string;
    stockName: string;
    quantity: number;
    avgPrice: number;
    currentPrice: number;
    profit: number;
    profitRate: number;
  }[];
  recentTrades: {
    date: string;
    type: '매수' | '매도';
    stockName: string;
    quantity: number;
    price: number;
    amount: number;
  }[];
}

/**
 * 포트폴리오 상세 페이지
 */
const PortfolioDetailPage = () => {
  const { portfolioId } = useParams<{ portfolioId: string }>();
  const [portfolio, setPortfolio] = useState<PortfolioDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (portfolioId) {
      loadPortfolioDetail();
    }
  }, [portfolioId]);

  const loadPortfolioDetail = async () => {
    try {
      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.get(`/api/portfolios/${portfolioId}`);
        
        if (response.data?.data) {
          setPortfolio(response.data.data);
        } else {
          // 백엔드가 아직 구현되지 않은 경우 목업 데이터 사용
          setPortfolio(getMockPortfolio());
        }
      } catch (apiError: any) {
        // API 에러 시 목업 데이터 표시 (개발 단계)
        if (apiError.response?.status === 404 || apiError.code === 'ERR_NETWORK') {
          console.warn('백엔드 API가 아직 구현되지 않았습니다. 목업 데이터를 표시합니다.');
          setPortfolio(getMockPortfolio());
        } else {
          throw apiError;
        }
      }
    } catch (err: any) {
      setError(err.message || '포트폴리오 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 목업 데이터
  const getMockPortfolio = (): PortfolioDetail => {
    return {
      portfolioId: portfolioId || '1',
      portfolioName: '나만의 전략1',
      nickname: '고래왕',
      currentRank: 1,
      totalReturn: 25.3,
      totalReturnAmount: 2530000,
      initialCapital: 10000000,
      totalValue: 12530000,
      currentCash: 500000,
      holdings: [
        { stockCode: '005930', stockName: '삼성전자', quantity: 10, avgPrice: 65000, currentPrice: 71000, profit: 60000, profitRate: 9.2 },
        { stockCode: '000660', stockName: 'SK하이닉스', quantity: 5, avgPrice: 120000, currentPrice: 135000, profit: 75000, profitRate: 12.5 },
        { stockCode: '035420', stockName: 'NAVER', quantity: 3, avgPrice: 180000, currentPrice: 195000, profit: 45000, profitRate: 8.3 },
      ],
      recentTrades: [
        { date: '2024-01-15', type: '매수', stockName: '삼성전자', quantity: 5, price: 71000, amount: 355000 },
        { date: '2024-01-14', type: '매도', stockName: 'SK하이닉스', quantity: 2, price: 132000, amount: 264000 },
        { date: '2024-01-13', type: '매수', stockName: 'NAVER', quantity: 3, price: 195000, amount: 585000 },
      ],
    };
  };

  const getReturnColor = (returnValue: number) => {
    if (returnValue > 0) return 'text-red-500';
    if (returnValue < 0) return 'text-blue-500';
    return 'text-gray-600';
  };

  const formatAmount = (amount: number) => {
    return `${amount.toLocaleString()}원`;
  };

  const formatAmountWon = (amount: number) => {
    return `${(amount / 10000).toLocaleString()}만원`;
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

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header showNav={true} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <ErrorMessage message={error} onRetry={loadPortfolioDetail} />
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
          to="/ranking" 
          className="inline-flex items-center text-gray-600 hover:text-whale-light mb-6 transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          랭킹으로 돌아가기
        </Link>

        {/* 포트폴리오 기본 정보 */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <h1 className="text-3xl font-bold text-whale-dark">
                  {portfolio.portfolioName}
                </h1>
                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-semibold">
                  🥇 {portfolio.currentRank}위
                </span>
              </div>
              <p className="text-gray-600">
                운영자: <span className="font-semibold text-whale-dark">{portfolio.nickname}</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-6 border border-red-200">
              <div className="text-gray-600 text-sm mb-1">총 수익률</div>
              <div className={`text-3xl font-bold ${getReturnColor(portfolio.totalReturn)}`}>
                +{portfolio.totalReturn.toFixed(1)}%
              </div>
              <div className="text-gray-600 text-sm mt-2">
                {formatAmount(portfolio.totalReturnAmount)}
              </div>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
              <div className="text-gray-600 text-sm mb-1">총 평가금액</div>
              <div className="text-3xl font-bold text-whale-dark">
                {formatAmountWon(portfolio.totalValue)}
              </div>
              <div className="text-gray-600 text-sm mt-2">
                {formatAmount(portfolio.totalValue)}
              </div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
              <div className="text-gray-600 text-sm mb-1">초기 자본</div>
              <div className="text-3xl font-bold text-whale-dark">
                {formatAmountWon(portfolio.initialCapital)}
              </div>
              <div className="text-gray-600 text-sm mt-2">
                {formatAmount(portfolio.initialCapital)}
              </div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6 border border-purple-200">
              <div className="text-gray-600 text-sm mb-1">보유 현금</div>
              <div className="text-3xl font-bold text-whale-dark">
                {formatAmountWon(portfolio.currentCash)}
              </div>
              <div className="text-gray-600 text-sm mt-2">
                {formatAmount(portfolio.currentCash)}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 보유 종목 */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-whale-dark mb-6">보유 종목</h2>
              
              {portfolio.holdings.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  보유 종목이 없습니다.
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
                        <tr key={holding.stockCode} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-4">
                            <div>
                              <div className="font-semibold text-whale-dark">{holding.stockName}</div>
                              <div className="text-sm text-gray-500">{holding.stockCode}</div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right font-semibold">{holding.quantity}주</td>
                          <td className="px-4 py-4 text-right text-gray-600">{formatAmount(holding.avgPrice)}</td>
                          <td className="px-4 py-4 text-right font-semibold text-whale-dark">{formatAmount(holding.currentPrice)}</td>
                          <td className={`px-4 py-4 text-right font-bold ${getReturnColor(holding.profitRate)}`}>
                            {holding.profitRate > 0 ? '+' : ''}{holding.profitRate.toFixed(1)}%
                          </td>
                          <td className="px-4 py-4 text-right font-semibold">
                            {formatAmount(holding.currentPrice * holding.quantity)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* 최근 거래 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-whale-dark mb-6">최근 거래</h2>
              
              {portfolio.recentTrades.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  거래 내역이 없습니다.
                </div>
              ) : (
                <div className="space-y-4">
                  {portfolio.recentTrades.map((trade, index) => (
                    <div 
                      key={index}
                      className="border-l-4 pl-4 py-2"
                      style={{
                        borderColor: trade.type === '매수' ? '#ef4444' : '#3b82f6'
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm font-semibold ${
                          trade.type === '매수' ? 'text-red-600' : 'text-blue-600'
                        }`}>
                          {trade.type}
                        </span>
                        <span className="text-xs text-gray-500">{trade.date}</span>
                      </div>
                      <div className="font-semibold text-whale-dark">{trade.stockName}</div>
                      <div className="text-sm text-gray-600">
                        {trade.quantity}주 × {formatAmount(trade.price)} = {formatAmount(trade.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PortfolioDetailPage;
