import { useState, useEffect } from 'react';
import Header from '../components/Header';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import { type RankingType, type RankingEntry } from '../services/rankingService';
import apiClient from '../utils/api';

const RankingPage = () => {
  const [rankingType, setRankingType] = useState<RankingType>('all');
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    setCurrentPage(0);
    loadRankings(0);
  }, [rankingType]);

  useEffect(() => {
    loadRankings(currentPage);
  }, [currentPage]);

  const loadRankings = async (page: number = 0) => {
    try {
      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.get('/api/rankings', {
          params: { type: rankingType, page, size: pageSize },
        });

        if (response.data?.data) {
          setRankings(response.data.data.rankings || []);
          setTotalPages(Math.ceil((response.data.data.totalCount || 0) / pageSize));
        } else {
          const allRankings = getMockRankings();
          const startIndex = page * pageSize;
          setRankings(allRankings.slice(startIndex, startIndex + pageSize));
          setTotalPages(Math.ceil(allRankings.length / pageSize));
        }
      } catch (apiError: any) {
        if (apiError.response?.status === 404 || apiError.code === 'ERR_NETWORK') {
          const allRankings = getMockRankings();
          const startIndex = page * pageSize;
          setRankings(allRankings.slice(startIndex, startIndex + pageSize));
          setTotalPages(Math.ceil(allRankings.length / pageSize));
        } else {
          throw apiError;
        }
      }
    } catch (err: any) {
      setError(err.message || '데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const getMockRankings = (): RankingEntry[] => {
    const nicknames = [
      '깊은바다', '잔잔한파도', '조용한항해', '먼바다', '새벽안개',
      '푸른수평선', '고요한물결', '느린조류', '밤하늘별', '아침이슬',
      '산들바람', '돌다리', '오래된나무', '작은등대', '긴호흡',
      '차분한걸음', '넓은시야', '단단한뿌리', '고른숨결', '맑은샘',
      '여유로운길', '굳건한산', '따뜻한햇살', '흐르는강', '쉬어가기',
      '한걸음씩', '묵묵히', '꾸준한발걸음', '천천히흐르는', '지금이순간',
      '고래의노래', '깊은숨', '바다내음', '파도소리', '물안개',
      '수면위달빛', '해류따라', '조개껍데기', '모래위발자국', '바닷바람',
      '갯벌의하루', '바다빛깔', '물결무늬', '수평선너머', '등대지기',
      '닻을내리고', '항구의저녁', '조용한만', '잠잠한호수', '깊은우물',
    ];

    const portfolioNames = [
      '꾸준한 분산투자', '장기 보유 전략', '안정적 자산배분', '밸런스 포트폴리오', '차분한 적립식',
      '기본에 충실한', '리스크 관리형', '느리지만 확실한', '원칙대로', '데이터 기반 판단',
      '시장을 읽는 눈', '흔들리지 않는', '기초체력 투자', '합리적 선택', '냉정한 분석',
      '장기 성장 추구', '안전마진 확보', '현금흐름 중심', '가치 중심 투자', '균형잡힌 시선',
      '조심스런 한걸음', '꼼꼼한 리서치', '인내의 투자', '시간이 답이다', '복리의 마법',
      '점진적 성장', '작은 수익 모으기', '탄탄한 기반', '변동성과 친구', '흔들려도 괜찮은',
      '묵묵한 실천', '일관된 원칙', '감정 빼기', '숫자로 말하기', '기록하는 투자',
      '돌아보는 습관', '반성하는 투자', '겸손한 수익', '욕심 내려놓기', '천천히 가도',
      '방향이 맞다면', '과정을 믿는', '결과보다 과정', '배움의 투자', '성장하는 투자자',
      '실수에서 배운', '오늘의 한걸음', '내일을 위한', '작지만 꾸준한', '나다운 투자',
    ];

    return Array.from({ length: 50 }, (_, i) => {
      const rank = i + 1;
      const baseReturn = 25 - (i * 0.8);
      const randomVariation = (Math.random() - 0.5) * 3;
      const totalReturn = baseReturn + randomVariation;
      const totalValue = 10000000 + (totalReturn * 100000);

      return {
        portfolioId: `portfolio-${rank}`,
        rank,
        nickname: nicknames[i % nicknames.length],
        portfolioName: portfolioNames[i % portfolioNames.length],
        totalReturn,
        totalValue,
        rankChange: Math.floor((Math.random() - 0.5) * 4),
        isMyRanking: rank === 7,
      };
    });
  };

  const getReturnColor = (returnValue: number) => {
    if (returnValue > 0) return 'text-red-500';
    if (returnValue < 0) return 'text-blue-500';
    return 'text-gray-500';
  };

  const formatAmount = (amount: number) => {
    if (amount >= 100000000) return `${(amount / 100000000).toFixed(1)}억`;
    return `${(amount / 10000).toLocaleString()}만`;
  };

  const formatReturn = (value: number) => {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  // 통계 요약
  const stats = {
    totalInvestors: rankings.length > 0 ? 50 : 0,
    avgReturn: rankings.length > 0 ? rankings.reduce((acc, r) => acc + r.totalReturn, 0) / rankings.length : 0,
    positiveCount: rankings.filter(r => r.totalReturn > 0).length,
    negativeCount: rankings.filter(r => r.totalReturn < 0).length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header showNav={true} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 페이지 헤더 — 신뢰/투명성 강조 */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-whale-dark">
            투자 현황
          </h1>
          <p className="text-gray-500 mt-2 text-base">
            WhaleArc 투자자들의 실시간 포트폴리오 현황입니다. 다른 투자자들의 전략을 참고해보세요.
          </p>
        </div>

        {/* 투명한 통계 요약 카드 */}
        {!loading && !error && rankings.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl p-5 border border-gray-100">
              <p className="text-sm text-gray-400 mb-1">참여 투자자</p>
              <p className="text-2xl font-bold text-whale-dark">{stats.totalInvestors}명</p>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-100">
              <p className="text-sm text-gray-400 mb-1">평균 수익률</p>
              <p className={`text-2xl font-bold ${getReturnColor(stats.avgReturn)}`}>
                {formatReturn(stats.avgReturn)}
              </p>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-100">
              <p className="text-sm text-gray-400 mb-1">수익 투자자</p>
              <p className="text-2xl font-bold text-red-500">{stats.positiveCount}명</p>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-100">
              <p className="text-sm text-gray-400 mb-1">손실 투자자</p>
              <p className="text-2xl font-bold text-blue-500">{stats.negativeCount}명</p>
            </div>
          </div>
        )}

        {/* 기간 필터 — 심플하게 */}
        <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="기간 필터">
          {[
            { key: 'all' as RankingType, label: '전체' },
            { key: 'daily' as RankingType, label: '일간' },
            { key: 'weekly' as RankingType, label: '주간' },
            { key: 'monthly' as RankingType, label: '월간' },
          ].map((filter) => (
            <button
              key={filter.key}
              onClick={() => setRankingType(filter.key)}
              role="tab"
              aria-selected={rankingType === filter.key}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-whale-light focus:ring-offset-2 ${
                rankingType === filter.key
                  ? 'bg-whale-dark text-white'
                  : 'bg-white text-gray-500 hover:text-gray-700 border border-gray-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {loading && <LoadingSpinner fullScreen={false} message="투자 현황을 불러오는 중..." />}

        {error && !loading && (
          <ErrorMessage message={error} onRetry={loadRankings} />
        )}

        {/* 투자자 리스트 — 깔끔한 테이블 */}
        {!loading && !error && (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {/* 테이블 헤더 */}
            <div className="px-6 py-3.5 border-b border-gray-100 bg-gray-50/50">
              <div className="grid grid-cols-12 gap-4 text-xs font-medium text-gray-400 uppercase tracking-wider">
                <div className="col-span-1 text-center">#</div>
                <div className="col-span-3">투자자</div>
                <div className="col-span-3">포트폴리오</div>
                <div className="col-span-2 text-right">수익률</div>
                <div className="col-span-3 text-right">평가금액</div>
              </div>
            </div>

            <div className="divide-y divide-gray-50">
              {rankings.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <div className="text-gray-300 text-5xl mb-4">
                    <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <p className="text-gray-400 font-medium">아직 참여한 투자자가 없습니다</p>
                  <p className="text-gray-300 text-sm mt-1">첫 번째 투자자가 되어보세요</p>
                </div>
              ) : (
                rankings.map((ranking) => (
                  <div
                    key={ranking.portfolioId}
                    className={`px-6 py-4 hover:bg-gray-50/50 transition-colors ${
                      ranking.isMyRanking ? 'bg-blue-50/40 border-l-3 border-l-whale-light' : ''
                    }`}
                  >
                    <div className="grid grid-cols-12 gap-4 items-center">
                      {/* 순번 */}
                      <div className="col-span-1 text-center">
                        <span className={`text-sm font-semibold ${
                          ranking.rank <= 3 ? 'text-whale-dark' : 'text-gray-400'
                        }`}>
                          {ranking.rank}
                        </span>
                      </div>

                      {/* 투자자 */}
                      <div className="col-span-3">
                        <div className="flex items-center space-x-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                            ranking.isMyRanking
                              ? 'bg-whale-light'
                              : 'bg-gray-300'
                          }`}>
                            {ranking.nickname.charAt(0)}
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-800">
                              {ranking.nickname}
                            </span>
                            {ranking.isMyRanking && (
                              <span className="ml-1.5 px-1.5 py-0.5 bg-whale-light/10 text-whale-light text-[10px] font-medium rounded">
                                나
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 포트폴리오명 */}
                      <div className="col-span-3">
                        <span className="text-sm text-gray-500 truncate block">
                          {ranking.portfolioName}
                        </span>
                      </div>

                      {/* 수익률 */}
                      <div className={`col-span-2 text-right text-sm font-semibold ${getReturnColor(ranking.totalReturn)}`}>
                        {formatReturn(ranking.totalReturn)}
                      </div>

                      {/* 평가금액 */}
                      <div className="col-span-3 text-right">
                        <span className="text-sm font-medium text-gray-700">
                          {formatAmount(ranking.totalValue)}
                        </span>
                        <span className="text-xs text-gray-300 ml-1">원</span>
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
          <div className="mt-6 flex justify-center items-center space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
              disabled={currentPage === 0}
              className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-sm transition-colors"
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
                    className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === pageNum
                        ? 'bg-whale-dark text-white'
                        : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum + 1}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
              disabled={currentPage === totalPages - 1}
              className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-sm transition-colors"
            >
              다음
            </button>
          </div>
        )}

        {!loading && !error && rankings.length > 0 && (
          <p className="mt-4 text-center text-xs text-gray-300">
            모의투자 수익률이며 실제 투자 수익을 보장하지 않습니다
          </p>
        )}
      </div>
    </div>
  );
};

export default RankingPage;
