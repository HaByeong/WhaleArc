
/**
 * 랭킹 관련 API 서비스
 * 
 * 백엔드 연동 시 이 파일의 함수들을 사용하여 API를 호출합니다.
 */

// 랭킹 타입
export type RankingType = 'all' | 'daily' | 'weekly' | 'monthly';

// 랭킹 응답 데이터 타입
export interface RankingResponse {
  rankingType: RankingType;
  snapshotDate: string;
  totalCount: number;
  rankings: RankingEntry[];
}

// 랭킹 항목 타입
export interface RankingEntry {
  portfolioId: string;
  rank: number;
  nickname: string;
  portfolioName: string;
  totalReturn: number;
  totalValue: number;
  rankChange: number;
  isMyRanking?: boolean;
}

// 포트폴리오 상세 정보 타입
export interface PortfolioDetail {
  portfolioId: string;
  portfolioName: string;
  nickname: string;
  currentRank: number;
  totalReturn: number;
  totalReturnAmount: number;
  initialCapital: number;
  totalValue: number;
  currentCash: number;
  holdings: Holding[];
  recentTrades: Trade[];
}

// 보유 종목 타입
export interface Holding {
  stockCode: string;
  stockName: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  profit: number;
  profitRate: number;
}

// 거래 내역 타입
export interface Trade {
  date: string;
  type: '매수' | '매도';
  stockName: string;
  quantity: number;
  price: number;
  amount: number;
}

/**
 * 랭킹 목록 조회
 * 
 * 백엔드 연동 시:
 * 1. API_BASE_URL을 백엔드 서버 주소로 설정 (예: 'http://localhost:8080')
 * 2. 인증 토큰을 헤더에 추가 (JWT)
 * 3. 실제 API 엔드포인트로 변경 (예: GET /api/rankings)
 * 
 * @param rankingType 랭킹 타입 (all, daily, weekly, monthly)
 * @param page 페이지 번호 (0부터 시작)
 * @param size 페이지 크기
 * @returns 랭킹 응답 데이터
 */
export const getRankings = async (
  _rankingType: RankingType = 'all',
  _page: number = 0,
  _size: number = 50
): Promise<RankingResponse> => {
  try {
    // TODO: 백엔드 연동 시 아래 주석을 해제하고 수정
    /*
    const response = await axios.get<RankingResponse>(
      `${API_BASE_URL}/api/rankings`,
      {
        params: {
          type: rankingType,
          page,
          size,
        },
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
        },
      }
    );
    return response.data;
    */

    // 현재는 목업 데이터 반환
    throw new Error('백엔드 API 연동 필요');
  } catch (error) {
    console.error('랭킹 조회 실패:', error);
    throw error;
  }
};

/**
 * 포트폴리오 상세 정보 조회
 * 
 * 백엔드 연동 시:
 * 1. API_BASE_URL을 백엔드 서버 주소로 설정
 * 2. 인증 토큰을 헤더에 추가 (JWT)
 * 3. 실제 API 엔드포인트로 변경 (예: GET /api/portfolios/:portfolioId)
 * 
 * @param portfolioId 포트폴리오 ID
 * @returns 포트폴리오 상세 정보
 */
export const getPortfolioDetail = async (
  _portfolioId: string
): Promise<PortfolioDetail> => {
  try {
    // TODO: 백엔드 연동 시 아래 주석을 해제하고 수정
    /*
    const response = await axios.get<PortfolioDetail>(
      `${API_BASE_URL}/api/portfolios/${portfolioId}`,
      {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
        },
      }
    );
    return response.data;
    */

    // 현재는 목업 데이터 반환
    throw new Error('백엔드 API 연동 필요');
  } catch (error) {
    console.error('포트폴리오 상세 조회 실패:', error);
    throw error;
  }
};

/**
 * 내 포트폴리오 랭킹 조회
 * 
 * 백엔드 연동 시:
 * 1. API_BASE_URL을 백엔드 서버 주소로 설정
 * 2. 인증 토큰을 헤더에 추가 (JWT)
 * 3. 실제 API 엔드포인트로 변경 (예: GET /api/rankings/my)
 * 
 * @returns 내 포트폴리오 랭킹 정보
 */
export const getMyRanking = async (): Promise<{
  currentRank: number;
  previousRank: number;
  totalReturn: number;
  totalValue: number;
}> => {
  try {
    // TODO: 백엔드 연동 시 아래 주석을 해제하고 수정
    /*
    const response = await axios.get(
      `${API_BASE_URL}/api/rankings/my`,
      {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
        },
      }
    );
    return response.data;
    */

    // 현재는 목업 데이터 반환
    throw new Error('백엔드 API 연동 필요');
  } catch (error) {
    console.error('내 랭킹 조회 실패:', error);
    throw error;
  }
};


// 서비스 객체로 export (tradeService와 동일한 패턴)
export const rankingService = {
  getRankings,
  getPortfolioDetail,
  getMyRanking,
};

