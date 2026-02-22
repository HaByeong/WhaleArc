import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import { tradeService, type Portfolio } from '../services/tradeService';
import { authService } from '../services/authService';

const DashboardPage = () => {
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    // 현재 사용자 정보 가져오기
    setCurrentUserId(authService.getCurrentUserId());
    loadData();
    // 실시간 포트폴리오 업데이트 (10초마다)
    const interval = setInterval(() => {
      loadPortfolio();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // 데모 데이터
  const getDemoPortfolio = (): Portfolio => {
    return {
      id: 'demo-1',
      userId: 'demo-user',
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
      ],
    };
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const portfolioData = await tradeService.getPortfolio().catch(() => {
        // API 실패 시 데모 데이터 사용
        return getDemoPortfolio();
      });

      setPortfolio(portfolioData);
    } catch (err: any) {
      // 에러 발생 시에도 데모 데이터 표시
      setPortfolio(getDemoPortfolio());
      setError(err.message || '포트폴리오 데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const loadPortfolio = async () => {
    try {
      const portfolioData = await tradeService.getPortfolio();
      setPortfolio(portfolioData);
    } catch (err) {
      console.error('포트폴리오 조회 실패:', err);
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
        {/* 환영 메시지 섹션 */}
        <div className="mb-8 bg-gradient-to-r from-whale-dark to-whale-light rounded-2xl shadow-xl p-6 md:p-8 text-white relative overflow-hidden">
          {/* 배경 장식 */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-whale-accent opacity-10 rounded-full blur-2xl"></div>
          
          <div className="relative z-10">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center space-x-3 mb-2">
                  <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center text-2xl backdrop-blur-sm">
                    🐋
                  </div>
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold">
                      {currentUserId ? `${currentUserId}님, 환영합니다!` : '환영합니다!'}
                    </h1>
                    <p className="text-blue-100 text-sm md:text-base mt-1">
                      오늘도 수익률을 높여보세요
                    </p>
                  </div>
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
                      portfolio.returnRate >= 0 ? 'text-green-300' : 'text-red-300'
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
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                navigate('/my-portfolio');
              }
            }}
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
              <div className="relative bg-gradient-to-br from-blue-50 via-blue-100 to-blue-50 rounded-xl p-5 border border-blue-200/50 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden group">
                <div className="absolute top-0 right-0 w-20 h-20 bg-blue-200/20 rounded-full -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-500"></div>
                <div className="relative">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-lg">💰</span>
                    <div className="text-sm text-gray-600 font-medium">총 자산</div>
                  </div>
                  <div className="text-2xl font-bold text-whale-dark">
                    {formatCurrency(portfolio.totalValue)}
                  </div>
                </div>
              </div>
              <div className="relative bg-gradient-to-br from-green-50 via-green-100 to-green-50 rounded-xl p-5 border border-green-200/50 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden group">
                <div className="absolute top-0 right-0 w-20 h-20 bg-green-200/20 rounded-full -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-500"></div>
                <div className="relative">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-lg">💵</span>
                    <div className="text-sm text-gray-600 font-medium">현금</div>
                  </div>
                  <div className="text-2xl font-bold text-whale-dark">
                    {formatCurrency(portfolio.cashBalance)}
                  </div>
                </div>
              </div>
              <div className={`relative bg-gradient-to-br rounded-xl p-5 border shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden group ${
                portfolio.returnRate >= 0 
                  ? 'from-red-50 via-red-100 to-red-50 border-red-200/50' 
                  : 'from-blue-50 via-blue-100 to-blue-50 border-blue-200/50'
              }`}>
                <div className={`absolute top-0 right-0 w-20 h-20 rounded-full -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-500 ${
                  portfolio.returnRate >= 0 ? 'bg-red-200/20' : 'bg-blue-200/20'
                }`}></div>
                <div className="relative">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-lg">{portfolio.returnRate >= 0 ? '📈' : '📉'}</span>
                    <div className="text-sm text-gray-600 font-medium">수익률</div>
                  </div>
                  <div className={`text-2xl font-bold ${
                    portfolio.returnRate >= 0 ? 'text-red-600' : 'text-blue-600'
                  }`}>
                    {portfolio.returnRate >= 0 ? '+' : ''}
                    {portfolio.returnRate.toFixed(2)}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 네비게이션 카드 */}
        <div className="mb-6">
          <h2 className="text-2xl md:text-3xl font-bold text-whale-dark mb-2">주요 기능</h2>
          <p className="text-gray-600">원하는 기능을 선택하여 이동하세요</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* 시장 카드 */}
          <div 
            className="relative card card-hover cursor-pointer group overflow-hidden"
            onClick={() => navigate('/market')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                navigate('/market');
              }
            }}
            aria-label="시장 페이지로 이동"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-green-50/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-green-200/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
            
            <div className="relative flex items-start space-x-4">
              <div className="relative w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center text-3xl shadow-lg group-hover:scale-110 group-hover:shadow-xl transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-xl"></div>
                <span className="relative z-10">📈</span>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-whale-dark mb-2 group-hover:text-whale-light transition-colors duration-300">
                  시장
                </h3>
                <p className="text-gray-600 text-sm mb-3 leading-relaxed">
                  실시간 주가와 시장 동향을 확인하세요
                </p>
                <div className="flex items-center text-whale-light font-semibold text-sm group-hover:text-whale-accent transition-colors duration-300">
                  바로가기
                  <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* 거래 카드 */}
          <div 
            className="relative card card-hover cursor-pointer group overflow-hidden"
            onClick={() => navigate('/trade')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                navigate('/trade');
              }
            }}
            aria-label="거래 페이지로 이동"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-orange-50/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-200/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
            
            <div className="relative flex items-start space-x-4">
              <div className="relative w-16 h-16 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center text-3xl shadow-lg group-hover:scale-110 group-hover:shadow-xl transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-xl"></div>
                <span className="relative z-10">💰</span>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-whale-dark mb-2 group-hover:text-whale-light transition-colors duration-300">
                  거래
                </h3>
                <p className="text-gray-600 text-sm mb-3 leading-relaxed">
                  주식을 매수/매도하고 주문을 관리하세요
                </p>
                <div className="flex items-center text-whale-light font-semibold text-sm group-hover:text-whale-accent transition-colors duration-300">
                  바로가기
                  <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* 전략 카드 */}
          <div 
            className="relative card card-hover cursor-pointer group overflow-hidden"
            onClick={() => navigate('/strategy')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                navigate('/strategy');
              }
            }}
            aria-label="전략 페이지로 이동"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-50/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-200/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
            
            <div className="relative flex items-start space-x-4">
              <div className="relative w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center text-3xl shadow-lg group-hover:scale-110 group-hover:shadow-xl transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-xl"></div>
                <span className="relative z-10">🎯</span>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-whale-dark mb-2 group-hover:text-whale-light transition-colors duration-300">
                  전략
                </h3>
                <p className="text-gray-600 text-sm mb-3 leading-relaxed">
                  백테스팅과 기술적 지표로 전략을 분석하세요
                </p>
                <div className="flex items-center text-whale-light font-semibold text-sm group-hover:text-whale-accent transition-colors duration-300">
                  바로가기
                  <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* 랭킹 카드 */}
          <div 
            className="relative card card-hover cursor-pointer group overflow-hidden"
            onClick={() => navigate('/ranking')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                navigate('/ranking');
              }
            }}
            aria-label="랭킹 페이지로 이동"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-50/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-200/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
            
            <div className="relative flex items-start space-x-4">
              <div className="relative w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center text-3xl shadow-lg group-hover:scale-110 group-hover:shadow-xl transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-xl"></div>
                <span className="relative z-10">🏆</span>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-whale-dark mb-2 group-hover:text-whale-light transition-colors duration-300">
                  랭킹
                </h3>
                <p className="text-gray-600 text-sm mb-3 leading-relaxed">
                  다른 투자자들의 포트폴리오 순위를 확인하세요
                </p>
                <div className="flex items-center text-whale-light font-semibold text-sm group-hover:text-whale-accent transition-colors duration-300">
                  바로가기
                  <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
