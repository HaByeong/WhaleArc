import { useState, useEffect } from 'react';
import Header from '../components/Header';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import { type RankingType, type RankingEntry } from '../services/rankingService';
import apiClient from '../utils/api';

/**
 * 포트폴리오 랭킹 페이지
 */
const RankingPage = () => {
  const [rankingType, setRankingType] = useState<RankingType>('all');
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedStrategy, setSelectedStrategy] = useState<{ name: string; description: string } | null>(null);
  const pageSize = 20;

  useEffect(() => {
    setCurrentPage(0); // 필터 변경 시 첫 페이지로
    loadRankings(0);
  }, [rankingType]);

  useEffect(() => {
    loadRankings(currentPage);
  }, [currentPage]);

  const loadRankings = async (page: number = 0) => {
    try {
      setLoading(true);
      setError(null);

      // 백엔드 API 호출 (연동 준비 완료)
      try {
        const response = await apiClient.get('/api/rankings', {
          params: {
            type: rankingType,
            page: page,
            size: pageSize,
          },
        });
        
        if (response.data?.data) {
          setRankings(response.data.data.rankings || []);
          setTotalPages(Math.ceil((response.data.data.totalCount || 0) / pageSize));
        } else {
          // 백엔드가 아직 구현되지 않은 경우 목업 데이터 사용
          const allRankings = getMockRankings();
          const startIndex = page * pageSize;
          const endIndex = startIndex + pageSize;
          setRankings(allRankings.slice(startIndex, endIndex));
          setTotalPages(Math.ceil(allRankings.length / pageSize));
        }
      } catch (apiError: any) {
        // API 에러 시 목업 데이터 표시 (개발 단계)
        if (apiError.response?.status === 404 || apiError.code === 'ERR_NETWORK') {
          console.warn('백엔드 API가 아직 구현되지 않았습니다. 목업 데이터를 표시합니다.');
          const allRankings = getMockRankings();
          const startIndex = page * pageSize;
          const endIndex = startIndex + pageSize;
          setRankings(allRankings.slice(startIndex, endIndex));
          setTotalPages(Math.ceil(allRankings.length / pageSize));
        } else {
          throw apiError;
        }
      }
    } catch (err: any) {
      setError(err.message || '랭킹 데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 목업 데이터 (백엔드 구현 전까지 사용) - 50개 생성
  const getMockRankings = (): RankingEntry[] => {
    const nicknames = [
      '고래왕', '투자왕', '꿀벌', '바다의제왕', '블루칩러버', '차트마스터', '디빈더', '그로스헌터', 
      '밸류파인더', '리스크관리자', '골든타임', '다이아몬드핸드', '월스트리트', '불곰', '황소',
      '코끼리', '독수리', '호랑이', '사자', '늑대', '여우', '토끼', '햄스터', '펭귄', '돌고래',
      '상어', '문어', '게', '새우', '고등어', '참치', '연어', '장어', '오징어', '멸치',
      '고래', '돌고래', '바다사자', '바다표범', '바다거북', '해파리', '산호', '해초', '조개', '전복',
      '성게', '불가사리', '해삼', '멍게', '미역', '다시마', '김', '파래', '톳', '매생이'
    ];
    
    const portfolioNames = [
      '나만의 전략1', '장기투자', '꿀처럼 달콤한 투자', '심해 탐험', '안전한 선택', '기술적 분석',
      '배당 포트폴리오', '성장주 모음', '저평가 주식', '분산투자', '집중투자', '모멘텀 전략',
      '밸류 전략', '그로스 전략', '배당 전략', '섹터 로테이션', '테마 투자', 'ESG 투자',
      '인덱스 추종', '액티브 전략', '퀀트 전략', '알고리즘 트레이딩', '스윙 트레이딩',
      '데이 트레이딩', '스캘핑', '포지션 트레이딩', '롱온리', '숏온리', '롱숏', '마켓 뉴트럴',
      '리버스 전략', '컨트레리언', '트렌드 팔로잉', '평균 회귀', '브레이크아웃', '채널 트레이딩',
      '지지저항', '피보나치', '엘리어트 파동', '갠 이론', '다우 이론', '캔들스틱', '차트 패턴',
      '볼린저 밴드', 'RSI 전략', 'MACD 전략', '스토캐스틱', 'CCI', 'ADX', 'OBV'
    ];

    return Array.from({ length: 50 }, (_, i) => {
      const rank = i + 1;
      const baseReturn = 30 - (i * 0.5); // 30%부터 시작해서 점점 감소
      const randomVariation = (Math.random() - 0.5) * 2; // -1 ~ +1% 변동
      const totalReturn = Math.max(0.1, baseReturn + randomVariation); // 최소 0.1%
      const totalValue = 10000000 + (totalReturn * 100000); // 기본 1천만원 + 수익
      
      return {
        portfolioId: `portfolio-${rank}`,
        rank: rank,
        nickname: nicknames[i % nicknames.length],
        portfolioName: portfolioNames[i % portfolioNames.length],
        totalReturn: totalReturn,
        totalValue: totalValue,
        rankChange: Math.floor((Math.random() - 0.5) * 6), // -3 ~ +3 등락
        isMyRanking: rank === 4, // 4등이 내 포트폴리오
      };
    });
  };

  const renderRankChange = (change: number) => {
    if (change > 0) {
      return (
        <span className="text-green-500 font-semibold flex items-center">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
          {change}
        </span>
      );
    } else if (change < 0) {
      return (
        <span className="text-red-500 font-semibold flex items-center">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          {Math.abs(change)}
        </span>
      );
    } else {
      return <span className="text-gray-400">-</span>;
    }
  };

  const getReturnColor = (returnValue: number) => {
    if (returnValue > 0) return 'text-red-500';
    if (returnValue < 0) return 'text-blue-500';
    return 'text-gray-600';
  };

  const formatAmount = (amount: number) => {
    return `${(amount / 10000).toLocaleString()}만`;
  };

  // 전략 설명 가져오기 (데모 데이터)
  const getStrategyDescription = (portfolioName: string): string => {
    const descriptions: { [key: string]: string } = {
      '나만의 전략1': '개인 맞춤형 투자 전략으로 다양한 기술적 지표를 활용하여 최적의 진입/청산 시점을 찾습니다. RSI와 MACD를 결합하여 과매수/과매도 구간을 판단합니다.',
      '장기투자': '안정적인 우량주 중심의 장기 보유 전략입니다. 배당 수익과 장기 성장을 목표로 합니다.',
      '꿀처럼 달콤한 투자': '고배당주 중심의 수익 창출 전략입니다. 안정적인 현금 흐름을 중시합니다.',
      '심해 탐험': '저평가 종목 발굴에 중점을 둔 밸류 투자 전략입니다.',
      '안전한 선택': '리스크를 최소화하면서도 안정적인 수익을 추구하는 보수적 투자 전략입니다.',
      '기술적 분석': '차트 패턴과 기술적 지표만을 활용한 순수 기술적 분석 전략입니다.',
      '배당 포트폴리오': '배당 수익률이 높은 종목들로 구성된 포트폴리오입니다.',
      '성장주 모음': '고성장 기업 위주로 구성된 공격적 성장 투자 전략입니다.',
      '저평가 주식': 'PER, PBR 등 밸류에이션 지표를 활용한 저평가 종목 투자 전략입니다.',
      '분산투자': '다양한 섹터와 자산에 분산 투자하여 리스크를 분산시키는 전략입니다.',
    };
    
    return descriptions[portfolioName] || `${portfolioName} 전략은 다양한 투자 기법을 활용하여 수익을 극대화하는 전략입니다. 기술적 분석과 펀더멘털 분석을 결합하여 최적의 투자 타이밍을 찾습니다.`;
  };

  const handleStrategyClick = (e: React.MouseEvent, portfolioName: string) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedStrategy({
      name: portfolioName,
      description: getStrategyDescription(portfolioName),
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header showNav={true} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-2xl">🏆</span>
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-whale-dark">
                포트폴리오 랭킹
              </h1>
              <p className="text-gray-600 mt-1">
                수익률 기준으로 정렬된 포트폴리오 순위를 확인하세요
              </p>
            </div>
          </div>
        </div>

        {/* 기간별 필터 */}
        <div className="mb-6 flex flex-wrap gap-3" role="tablist" aria-label="랭킹 기간 필터">
          {[
            { key: 'all' as RankingType, label: '전체', icon: '📊' },
            { key: 'daily' as RankingType, label: '일간', icon: '📅' },
            { key: 'weekly' as RankingType, label: '주간', icon: '📆' },
            { key: 'monthly' as RankingType, label: '월간', icon: '🗓️' },
          ].map((filter) => (
            <button
              key={filter.key}
              onClick={() => setRankingType(filter.key)}
              role="tab"
              aria-selected={rankingType === filter.key}
              aria-controls="ranking-table"
              className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-whale-light focus:ring-offset-2 min-h-[44px] ${
                rankingType === filter.key
                  ? 'bg-whale-light text-white shadow-lg scale-105'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <span className="mr-2" aria-hidden="true">{filter.icon}</span>
              {filter.label}
            </button>
          ))}
        </div>

        {/* 로딩 상태 */}
        {loading && <LoadingSpinner fullScreen={false} message="랭킹 데이터를 불러오는 중..." />}

        {/* 에러 상태 */}
        {error && !loading && (
          <ErrorMessage message={error} onRetry={loadRankings} />
        )}

        {/* 랭킹 테이블 */}
        {!loading && !error && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-whale-dark to-whale-light text-white px-6 py-4">
              <div className="grid grid-cols-12 gap-4 font-semibold" role="row">
                <div className="col-span-1 text-center" role="columnheader">순위</div>
                <div className="col-span-3" role="columnheader">닉네임</div>
                <div className="col-span-3" role="columnheader">포트폴리오명</div>
                <div className="col-span-2 text-right" role="columnheader">수익률</div>
                <div className="col-span-2 text-right" role="columnheader">평가금액</div>
                <div className="col-span-1 text-center" role="columnheader">등락</div>
              </div>
            </div>

            <div className="divide-y divide-gray-200">
              {rankings.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <div className="text-5xl mb-4">🏆</div>
                  <div className="text-gray-500 font-medium text-lg mb-2">랭킹 데이터가 없습니다</div>
                  <div className="text-sm text-gray-400">아직 등록된 포트폴리오가 없습니다</div>
                </div>
              ) : (
                rankings.map((ranking) => (
                  <div
                    key={ranking.portfolioId}
                    role="row"
                    className={`px-6 py-4 hover:bg-blue-50 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-whale-light focus:ring-inset min-h-[60px] ${
                      ranking.isMyRanking ? 'bg-blue-50 border-l-4 border-whale-light' : ''
                    }`}
                    tabIndex={0}
                    onClick={() => window.location.href = `/portfolio/${ranking.portfolioId}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        window.location.href = `/portfolio/${ranking.portfolioId}`;
                      }
                    }}
                    aria-label={`${ranking.rank}위: ${ranking.portfolioName}, 수익률 ${ranking.totalReturn.toFixed(2)}%`}
                  >
                    <div className="grid grid-cols-12 gap-4 items-center">
                      <div className="col-span-1 text-center">
                        <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full font-bold ${
                          ranking.rank === 1 
                            ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white'
                            : ranking.rank === 2
                            ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white'
                            : ranking.rank === 3
                            ? 'bg-gradient-to-br from-orange-600 to-orange-700 text-white'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {ranking.rank === 1 && '🥇'}
                          {ranking.rank === 2 && '🥈'}
                          {ranking.rank === 3 && '🥉'}
                          {ranking.rank > 3 && ranking.rank}
                        </div>
                      </div>
                      <div className="col-span-3">
                        <div className="font-semibold text-whale-dark">
                          {ranking.nickname}
                          {ranking.isMyRanking && (
                            <span className="ml-2 px-2 py-1 bg-whale-light text-white text-xs rounded-full">
                              내 포트폴리오
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="col-span-3">
                        <button
                          onClick={(e) => handleStrategyClick(e, ranking.portfolioName)}
                          className="text-whale-light hover:text-whale-accent font-semibold hover:underline truncate block text-left w-full"
                          aria-label={`${ranking.portfolioName} 전략 설명 보기`}
                        >
                          {ranking.portfolioName}
                        </button>
                      </div>
                      <div className={`col-span-2 text-right font-bold ${getReturnColor(ranking.totalReturn)}`}>
                        {ranking.totalReturn > 0 ? '+' : ''}{ranking.totalReturn.toFixed(1)}%
                      </div>
                      <div className="col-span-2 text-right font-semibold text-gray-700">
                        {formatAmount(ranking.totalValue)}
                      </div>
                      <div className="col-span-1 text-center">
                        {renderRankChange(ranking.rankChange)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 페이지네이션 */}
        {!loading && !error && rankings.length > 0 && totalPages > 1 && (
          <div className="mt-6 flex justify-center items-center space-x-2" aria-label="페이지네이션">
            <button
              onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
              disabled={currentPage === 0}
              className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-whale-light focus:ring-offset-2 min-h-[44px] transition-colors"
              aria-label="이전 페이지"
            >
              이전
            </button>
            
            <div className="flex space-x-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i;
                } else if (currentPage < 3) {
                  pageNum = i;
                } else if (currentPage > totalPages - 4) {
                  pageNum = totalPages - 5 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-4 py-2 rounded-lg border min-w-[44px] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-whale-light focus:ring-offset-2 transition-colors ${
                      currentPage === pageNum
                        ? 'bg-whale-light text-white border-whale-light shadow-md'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                    aria-label={`${pageNum + 1}페이지`}
                    aria-current={currentPage === pageNum ? 'page' : undefined}
                  >
                    {pageNum + 1}
                  </button>
                );
              })}
            </div>
            
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
              disabled={currentPage === totalPages - 1}
              className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-whale-light focus:ring-offset-2 min-h-[44px] transition-colors"
              aria-label="다음 페이지"
            >
              다음
            </button>
          </div>
        )}

        {/* 페이지 정보 */}
        {!loading && !error && rankings.length > 0 && (
          <div className="mt-4 text-center text-sm text-gray-500">
            {currentPage * pageSize + 1} - {Math.min((currentPage + 1) * pageSize, rankings.length + currentPage * pageSize)}위 표시 중
            {totalPages > 1 && ` (전체 ${totalPages}페이지)`}
          </div>
        )}

        {/* 전략 설명 모달 */}
        {selectedStrategy && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
            onClick={() => setSelectedStrategy(null)}
            aria-modal="true"
            role="dialog"
            aria-labelledby="strategy-modal-title"
          >
            <div 
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 md:p-8 relative transform transition-all duration-300 scale-95 animate-fade-in"
              onClick={(e) => e.stopPropagation()}
              style={{ animation: 'fade-in 0.3s ease-out' }}
            >
              {/* 배경 장식 */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-whale-light/10 to-whale-accent/10 rounded-full -mr-20 -mt-20"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-blue-50 to-transparent rounded-full -ml-16 -mb-16"></div>
              
              <button
                onClick={() => setSelectedStrategy(null)}
                className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200"
                aria-label="모달 닫기"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              
              <div className="relative mb-6">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="relative w-14 h-14 bg-gradient-to-br from-whale-light to-whale-dark rounded-xl flex items-center justify-center shadow-lg">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-xl"></div>
                    <span className="relative z-10 text-2xl">📊</span>
                  </div>
                  <h2 id="strategy-modal-title" className="text-2xl md:text-3xl font-bold text-whale-dark">
                    {selectedStrategy.name}
                  </h2>
                </div>
                <div className="relative bg-gradient-to-br from-blue-50 via-whale-light/5 to-white rounded-xl p-6 md:p-7 border border-whale-light/30 shadow-inner">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-whale-light to-whale-accent rounded-t-xl"></div>
                  <h3 className="text-lg font-semibold text-whale-dark mb-4 flex items-center">
                    <span className="mr-2">💡</span>
                    전략 설명
                  </h3>
                  <p className="text-gray-700 leading-relaxed whitespace-pre-line text-base">
                    {selectedStrategy.description}
                  </p>
                </div>
              </div>
              
              <div className="relative flex justify-end space-x-3">
                <button
                  onClick={() => setSelectedStrategy(null)}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-200 font-semibold min-h-[44px] shadow-sm hover:shadow-md"
                >
                  닫기
                </button>
                <button
                  onClick={() => {
                    const portfolio = rankings.find(r => r.portfolioName === selectedStrategy.name);
                    if (portfolio) {
                      window.location.href = `/portfolio/${portfolio.portfolioId}`;
                    }
                  }}
                  className="px-6 py-3 btn-primary min-h-[44px] shadow-lg hover:shadow-xl"
                >
                  상세 보기
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RankingPage;
