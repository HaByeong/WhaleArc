import { useState, useEffect, useRef, useCallback } from 'react';
import { useVirtNavigate, useRoutePrefix } from '../hooks/useRoutePrefix';
import Header from '../components/Header';
import VirtSplashLoading from '../components/VirtSplashLoading';
import SplashLoading from '../components/SplashLoading';
import ErrorMessage from '../components/ErrorMessage';
import UnstableCurrent from '../components/UnstableCurrent';
import { type RankingType, type RankingEntry } from '../services/rankingService';
import { virtService, type VirtCredentialInfo, type VirtPortfolio, type VirtHolding } from '../services/virtService';
import apiClient from '../utils/api';
import { useTheme } from '../contexts/ThemeContext';

/* ═══════════════════════════════════════════════════
   실계좌 투자 현황 (일반 모드)
   ═══════════════════════════════════════════════════ */
const RealInvestmentStatusPage = () => {
  const { isDark } = useTheme();
  const navigate = useVirtNavigate();
  const [serviceTab, setServiceTab] = useState<'kis' | 'upbit' | 'bitget' | 'all'>('all');
  const [kisCredInfo, setKisCredInfo] = useState<VirtCredentialInfo | null>(null);
  const [upbitCredInfo, setUpbitCredInfo] = useState<VirtCredentialInfo | null>(null);
  const [bitgetCredInfo, setBitgetCredInfo] = useState<VirtCredentialInfo | null>(null);
  const [kisPortfolio, setKisPortfolio] = useState<VirtPortfolio | null>(null);
  const [upbitPortfolio, setUpbitPortfolio] = useState<VirtPortfolio | null>(null);
  const [bitgetPortfolio, setBitgetPortfolio] = useState<VirtPortfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (silent = false) => {
    try {
      if (!silent) { setLoading(true); setError(null); }
      const [kis, upbit, bitget] = await Promise.all([
        virtService.getCredentialInfo().catch(() => ({ connected: false } as VirtCredentialInfo)),
        virtService.getUpbitCredentialInfo().catch(() => ({ connected: false } as VirtCredentialInfo)),
        virtService.getBitgetCredentialInfo().catch(() => ({ connected: false } as VirtCredentialInfo)),
      ]);
      setKisCredInfo(kis); setUpbitCredInfo(upbit); setBitgetCredInfo(bitget);

      const [kisP, upbitP, bitgetP] = await Promise.all([
        kis.connected ? virtService.getPortfolio().catch(() => null) : Promise.resolve(null),
        upbit.connected ? virtService.getUpbitPortfolio().catch(() => null) : Promise.resolve(null),
        bitget.connected ? virtService.getBitgetPortfolio().catch(() => null) : Promise.resolve(null),
      ]);
      setKisPortfolio(kisP); setUpbitPortfolio(upbitP); setBitgetPortfolio(bitgetP);
    } catch (err: any) {
      if (!silent) setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    const iv = setInterval(() => loadData(true), 30000);
    return () => clearInterval(iv);
  }, [loadData]);

  const isKis = kisCredInfo?.connected === true;
  const isUpbit = upbitCredInfo?.connected === true;
  const isBitget = bitgetCredInfo?.connected === true;
  const hasAny = isKis || isUpbit || isBitget;

  const fmt = (v: number) => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
  const sign = (v: number) => (v > 0 ? '+' : '');
  const rc = (v: number) => (v > 0 ? 'text-red-500' : v < 0 ? 'text-blue-500' : 'text-slate-500');

  // 전체 합산
  const totalValue = (kisPortfolio?.totalValue ?? 0) + (upbitPortfolio?.totalValue ?? 0) + (bitgetPortfolio?.totalValue ?? 0);
  const totalPnl = (kisPortfolio?.totalPnl ?? 0) + (upbitPortfolio?.totalPnl ?? 0) + (bitgetPortfolio?.totalPnl ?? 0);
  const totalHoldingsValue = (kisPortfolio?.holdingsValue ?? 0) + (upbitPortfolio?.holdingsValue ?? 0) + (bitgetPortfolio?.holdingsValue ?? 0);
  const totalCash = (kisPortfolio?.cashBalance ?? 0) + (upbitPortfolio?.cashBalance ?? 0) + (bitgetPortfolio?.cashBalance ?? 0);
  const totalReturnRate = totalValue > 0 ? (totalPnl / (totalValue - totalPnl)) * 100 : 0;

  const allHoldings: (VirtHolding & { source: string })[] = [
    ...(kisPortfolio?.holdings ?? []).map(h => ({ ...h, source: 'KIS' })),
    ...(upbitPortfolio?.holdings ?? []).map(h => ({ ...h, source: '업비트' })),
    ...(bitgetPortfolio?.holdings ?? []).map(h => ({ ...h, source: '비트겟' })),
  ];

  const getFilteredHoldings = () => {
    if (serviceTab === 'all') return allHoldings;
    if (serviceTab === 'kis') return allHoldings.filter(h => h.source === 'KIS');
    if (serviceTab === 'upbit') return allHoldings.filter(h => h.source === '업비트');
    return allHoldings.filter(h => h.source === '비트겟');
  };

  const getFilteredPortfolio = () => {
    if (serviceTab === 'all') return { totalValue, totalPnl, holdingsValue: totalHoldingsValue, cashBalance: totalCash, returnRate: totalReturnRate };
    if (serviceTab === 'kis') return kisPortfolio;
    if (serviceTab === 'upbit') return upbitPortfolio;
    return bitgetPortfolio;
  };

  if (loading) return <SplashLoading message="실계좌 투자 현황을 불러오는 중..." />;

  return (
    <div className="min-h-screen bg-[var(--wa-page-bg)] text-white">
      <Header showNav={true} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white">투자 현황</h1>
          <p className="mt-2 text-base text-slate-400">
            연동된 실계좌의 자산 현황을 한눈에 확인하세요.
          </p>
        </div>

        {error && <UnstableCurrent message="해류가 불안정합니다" sub={error} />}

        {!hasAny ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-cyan-500/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">연동된 계좌가 없습니다</h3>
            <p className="text-slate-400 text-sm mb-4">거래소 API 키를 연동하면 실제 자산 현황을 확인할 수 있습니다.</p>
            <div className="max-w-md mx-auto mb-6 rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 text-left space-y-3">
              <p className="text-xs text-slate-300 leading-relaxed">
                <span className="font-semibold text-slate-200">API 키란?</span>{' '}
                거래소가 발급해주는 <span className="text-cyan-400">일종의 조회 전용 비밀번호</span>입니다. 이 키를 등록하면 WhaleArc가 여러분의 거래소 자산을 자동으로 불러와 보여줍니다.
              </p>
              <div className="text-[11px] text-slate-500 leading-relaxed space-y-1">
                <p className="text-slate-400 font-medium mb-1">지원 거래소</p>
                <p><span className="text-cyan-400">KIS (한국투자증권)</span> — 국내 주식 자산 조회</p>
                <p><span className="text-cyan-400">업비트</span> — 암호화폐 자산 조회</p>
                <p><span className="text-cyan-400">비트겟</span> — 암호화폐 자산 조회</p>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                <span className="text-amber-400/80 font-medium">안전한가요?</span>{' '}
                읽기 전용 키만 사용하므로 주문·출금이 실행되지 않습니다. 키는 AES 암호화되어 저장됩니다.
              </p>
            </div>
            <button
              onClick={() => navigate('/api-setting')}
              className="px-6 py-3 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-xl font-semibold text-sm hover:bg-cyan-500/20 transition-colors"
            >
              API 설정하러 가기
            </button>
          </div>
        ) : (
          <>
            {/* 서비스 탭 */}
            <div className="mb-6 flex flex-wrap gap-2">
              {[
                { key: 'all' as const, label: '전체', active: true },
                { key: 'kis' as const, label: 'KIS (주식)', active: isKis },
                { key: 'upbit' as const, label: '업비트', active: isUpbit },
                { key: 'bitget' as const, label: '비트겟', active: isBitget },
              ].filter(t => t.key === 'all' || t.active).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setServiceTab(tab.key)}
                  className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    serviceTab === tab.key
                      ? 'text-cyan-400 bg-white/10'
                      : 'text-slate-500 border border-white/[0.06] hover:bg-white/[0.03]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 자산 요약 카드 */}
            {(() => {
              const p = getFilteredPortfolio();
              if (!p) return null;
              return (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <div className="rounded-xl p-5 border bg-white/[0.02] border-white/[0.06]">
                    <p className="text-sm mb-1 text-slate-500">총 자산</p>
                    <p className="text-2xl font-bold text-white">{fmt(p.totalValue)}</p>
                  </div>
                  <div className="rounded-xl p-5 border bg-white/[0.02] border-white/[0.06]">
                    <p className="text-sm mb-1 text-slate-500">총 손익</p>
                    <p className={`text-2xl font-bold ${rc(p.totalPnl)}`}>{sign(p.totalPnl)}{fmt(p.totalPnl)}</p>
                  </div>
                  <div className="rounded-xl p-5 border bg-white/[0.02] border-white/[0.06]">
                    <p className="text-sm mb-1 text-slate-500">수익률</p>
                    <p className={`text-2xl font-bold ${rc(p.returnRate)}`}>
                      {p.returnRate > 0 ? '▲ +' : p.returnRate < 0 ? '▼ ' : ''}{p.returnRate.toFixed(2)}%
                    </p>
                  </div>
                  <div className="rounded-xl p-5 border bg-white/[0.02] border-white/[0.06]">
                    <p className="text-sm mb-1 text-slate-500">보유 종목</p>
                    <p className="text-2xl font-bold text-white">{getFilteredHoldings().length}개</p>
                  </div>
                </div>
              );
            })()}

            {/* 보유 종목 테이블 */}
            <div className="rounded-xl border overflow-hidden bg-white/[0.02] border-white/[0.06]">
              {/* 테이블 헤더 */}
              <div className="hidden md:block px-6 py-3.5 border-b border-white/[0.06] bg-white/[0.02]">
                <div className="grid grid-cols-12 gap-4 text-xs font-medium uppercase tracking-wider text-slate-500">
                  <div className="col-span-1 text-center">#</div>
                  <div className="col-span-3">종목</div>
                  <div className="col-span-1">거래소</div>
                  <div className="col-span-2 text-right">현재가</div>
                  <div className="col-span-2 text-right">평가금액</div>
                  <div className="col-span-1 text-right">수량</div>
                  <div className="col-span-2 text-right">수익률</div>
                </div>
              </div>

              <div className="divide-y divide-white/[0.04]">
                {getFilteredHoldings().length === 0 ? (
                  <div className="px-6 py-16 text-center">
                    <p className="font-medium text-slate-500">보유 종목이 없습니다</p>
                  </div>
                ) : (
                  getFilteredHoldings()
                    .sort((a, b) => b.marketValue - a.marketValue)
                    .map((h, idx) => (
                    <div key={`${h.source}-${h.stockCode}`} className="px-4 md:px-6 py-3.5 md:py-4 hover:bg-white/[0.03] transition-colors">
                      {/* 모바일 */}
                      <div className="md:hidden">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white">{h.stockName}</span>
                            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-cyan-500/10 text-cyan-400 rounded">{h.source}</span>
                          </div>
                          <div className="text-right">
                            <div className={`text-sm font-semibold ${rc(h.returnRate)}`}>
                              {h.returnRate > 0 ? '▲ +' : h.returnRate < 0 ? '▼ ' : ''}{h.returnRate.toFixed(2)}%
                            </div>
                            <div className="text-[11px] text-slate-500">{fmt(h.marketValue)}</div>
                          </div>
                        </div>
                      </div>
                      {/* 데스크톱 */}
                      <div className="hidden md:grid grid-cols-12 gap-4 items-center">
                        <div className="col-span-1 text-center text-sm font-semibold text-slate-500">{idx + 1}</div>
                        <div className="col-span-3">
                          <span className="text-sm font-medium text-white">{h.stockName}</span>
                          <span className="ml-1.5 text-xs text-slate-500">{h.stockCode}</span>
                        </div>
                        <div className="col-span-1">
                          <span className="px-1.5 py-0.5 text-[9px] font-bold bg-cyan-500/10 text-cyan-400 rounded">{h.source}</span>
                        </div>
                        <div className="col-span-2 text-right text-sm text-slate-300">{fmt(h.currentPrice)}</div>
                        <div className="col-span-2 text-right text-sm font-medium text-white">{fmt(h.marketValue)}</div>
                        <div className="col-span-1 text-right text-sm text-slate-400">{h.quantity.toLocaleString()}</div>
                        <div className={`col-span-2 text-right text-sm font-semibold ${rc(h.returnRate)}`}>
                          {h.returnRate > 0 ? '▲ +' : h.returnRate < 0 ? '▼ ' : ''}{h.returnRate.toFixed(2)}%
                          <div className={`text-xs ${rc(h.profitLoss)}`}>{sign(h.profitLoss)}{fmt(h.profitLoss)}</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 자산 배분 요약 */}
            {serviceTab === 'all' && (isKis ? 1 : 0) + (isUpbit ? 1 : 0) + (isBitget ? 1 : 0) > 1 && (
              <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                {isKis && kisPortfolio && (
                  <div className="rounded-xl p-5 border bg-white/[0.02] border-white/[0.06]">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-slate-400">KIS (주식)</span>
                      <span className={`text-sm font-semibold ${rc(kisPortfolio.returnRate)}`}>
                        {kisPortfolio.returnRate > 0 ? '+' : ''}{kisPortfolio.returnRate.toFixed(2)}%
                      </span>
                    </div>
                    <p className="text-lg font-bold text-white">{fmt(kisPortfolio.totalValue)}</p>
                    <p className="text-xs text-slate-500 mt-1">{kisPortfolio.holdings.length}종목 보유</p>
                  </div>
                )}
                {isUpbit && upbitPortfolio && (
                  <div className="rounded-xl p-5 border bg-white/[0.02] border-white/[0.06]">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-slate-400">업비트</span>
                      <span className={`text-sm font-semibold ${rc(upbitPortfolio.returnRate)}`}>
                        {upbitPortfolio.returnRate > 0 ? '+' : ''}{upbitPortfolio.returnRate.toFixed(2)}%
                      </span>
                    </div>
                    <p className="text-lg font-bold text-white">{fmt(upbitPortfolio.totalValue)}</p>
                    <p className="text-xs text-slate-500 mt-1">{upbitPortfolio.holdings.length}종목 보유</p>
                  </div>
                )}
                {isBitget && bitgetPortfolio && (
                  <div className="rounded-xl p-5 border bg-white/[0.02] border-white/[0.06]">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-slate-400">비트겟</span>
                      <span className={`text-sm font-semibold ${rc(bitgetPortfolio.returnRate)}`}>
                        {bitgetPortfolio.returnRate > 0 ? '+' : ''}{bitgetPortfolio.returnRate.toFixed(2)}%
                      </span>
                    </div>
                    <p className="text-lg font-bold text-white">{fmt(bitgetPortfolio.totalValue)}</p>
                    <p className="text-xs text-slate-500 mt-1">{bitgetPortfolio.holdings.length}종목 보유</p>
                  </div>
                )}
              </div>
            )}

            <p className="mt-6 text-center text-xs text-slate-600">
              실시간 시세 기반이며, 체결 후 반영까지 지연이 있을 수 있습니다
            </p>
          </>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════
   가상 투자 랭킹 (Virt 모드)
   ═══════════════════════════════════════════════════ */

const RankingPage = () => {
  const { isVirt } = useRoutePrefix();

  // 일반 모드 → 실계좌 투자 현황
  if (!isVirt) return <RealInvestmentStatusPage />;

  return <VirtRankingPage />;
};

const VirtRankingPage = () => {
  const navigate = useVirtNavigate();
  const [rankingType, setRankingType] = useState<RankingType>('all');
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedRanking, setSelectedRanking] = useState<RankingEntry | null>(null);
  const [serverStats, setServerStats] = useState({ totalInvestors: 0, avgReturn: 0, positiveCount: 0, negativeCount: 0 });
  const pageSize = 20;

  const rankingTypeRef = useRef(rankingType);

  useEffect(() => {
    rankingTypeRef.current = rankingType;
    setCurrentPage(0);
    loadRankings(0);
  }, [rankingType]);

  useEffect(() => {
    if (currentPage === 0) return;
    loadRankings(currentPage);
  }, [currentPage]);

  const loadRankings = async (page: number = 0) => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.get('/api/rankings', {
        params: { type: rankingType, page, size: pageSize },
      });

      if (response.data?.data) {
        const data = response.data.data;
        setRankings(data.rankings || []);
        setTotalPages(data.totalPages || Math.ceil((data.totalCount || 0) / pageSize));
        setServerStats({
          totalInvestors: data.totalCount || 0,
          avgReturn: data.avgReturn || 0,
          positiveCount: data.positiveCount || 0,
          negativeCount: data.negativeCount || 0,
        });
      } else {
        setRankings([]);
        setTotalPages(1);
      }
    } catch (err: any) {
      setError(err.message || '랭킹 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
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
    const arrow = value > 0 ? '▲ ' : value < 0 ? '▼ ' : '';
    const sign = value > 0 ? '+' : '';
    return `${arrow}${sign}${value.toFixed(2)}%`;
  };

  const stats = serverStats;

  const strategyLabel = (type: string | null | undefined) => {
    if (!type) return '일반';
    if (type === 'TURTLE') return '터틀 트레이딩';
    return '일반';
  };

  if (loading && rankings.length === 0) {
    return <VirtSplashLoading message="투자 현황을 불러오는 중..." />;
  }

  return (
    <div className="min-h-screen bg-[var(--wa-page-bg)]">
      <Header showNav={true} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 페이지 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-whale-dark">
            가상 투자 현황
          </h1>
          <p className="mt-2 text-base text-gray-500">
            WhaleArc 가상 투자자들의 수익률을 확인해보세요. 클릭하면 전략 정보를 볼 수 있습니다.
          </p>
        </div>

        {/* 통계 요약 카드 */}
        {!loading && !error && rankings.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="rounded-xl p-5 border bg-white border-gray-100">
              <p className="text-sm mb-1 text-gray-400">참여 투자자</p>
              <p className="text-2xl font-bold text-whale-dark">{stats.totalInvestors}명</p>
            </div>
            <div className="rounded-xl p-5 border bg-white border-gray-100">
              <p className="text-sm mb-1 text-gray-400">평균 수익률</p>
              <p className={`text-2xl font-bold ${getReturnColor(stats.avgReturn)}`}>
                {formatReturn(stats.avgReturn)}
              </p>
            </div>
            <div className="rounded-xl p-5 border bg-white border-gray-100">
              <p className="text-sm mb-1 text-gray-400">수익 투자자</p>
              <p className="text-2xl font-bold text-red-500">{stats.positiveCount}명</p>
            </div>
            <div className="rounded-xl p-5 border bg-white border-gray-100">
              <p className="text-sm mb-1 text-gray-400">손실 투자자</p>
              <p className="text-2xl font-bold text-blue-500">{stats.negativeCount}명</p>
            </div>
          </div>
        )}

        {/* 기간 필터 */}
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

        {loading && rankings.length > 0 && (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-2 rounded-full animate-spin border-whale-light/30 border-t-whale-light" />
          </div>
        )}

        {error && !loading && (
          <ErrorMessage message={error} onRetry={() => loadRankings(currentPage)} variant="error" />
        )}

        {/* 투자자 리스트 */}
        {!loading && !error && (
          <div className="rounded-xl border overflow-hidden bg-white border-gray-100">
            {/* 테이블 헤더 — 데스크톱만 */}
            <div className="hidden md:block px-6 py-3.5 border-b border-gray-100 bg-gray-50/50">
              <div className="grid grid-cols-12 gap-4 text-xs font-medium uppercase tracking-wider text-gray-400">
                <div className="col-span-1 text-center">#</div>
                <div className="col-span-4">투자자</div>
                <div className="col-span-3">대표 항로</div>
                <div className="col-span-2 text-right">항로 수익률</div>
                <div className="col-span-2 text-right">총 자산</div>
              </div>
            </div>

            <div className="divide-y divide-gray-50">
              {rankings.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <p className="font-medium text-gray-400">아직 참여한 투자자가 없습니다</p>
                  <p className="text-sm mt-1 mb-4 text-gray-300">첫 번째 항해를 시작해보세요</p>
                  <button
                    onClick={() => navigate('/trade')}
                    className="inline-flex items-center px-5 py-2.5 rounded-lg text-sm font-semibold transition-all btn-primary"
                  >
                    거래하기
                  </button>
                </div>
              ) : (
                rankings.map((ranking) => (
                  <div
                    key={ranking.portfolioId}
                    onClick={() => {
                      if (ranking.routeName) setSelectedRanking(ranking);
                      else navigate(`/portfolio/${ranking.portfolioId}`);
                    }}
                    className={`px-4 md:px-6 py-3.5 md:py-4 transition-colors cursor-pointer hover:bg-gray-50/80 ${ranking.isMyRanking ? 'bg-blue-50/40 border-l-3 border-l-whale-light' : ''}`}
                  >
                    {/* 모바일 레이아웃 */}
                    <div className="md:hidden">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-8 text-center">
                          {ranking.rank === 1 ? (
                            <img src="/whales/blue-whale.png" alt="대왕고래" className="w-6 h-6 object-contain mx-auto" />
                          ) : ranking.rank === 2 ? (
                            <img src="/whales/narwhal.png" alt="일각고래" className="w-6 h-6 object-contain mx-auto" />
                          ) : ranking.rank === 3 ? (
                            <img src="/whales/dolphin.png" alt="돌고래" className="w-5 h-5 object-contain mx-auto" />
                          ) : (
                            <span className="text-sm font-semibold text-gray-400">{ranking.rank}</span>
                          )}
                        </div>
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                          ranking.isMyRanking ? 'bg-whale-light' : 'bg-gray-300'
                        }`}>
                          {ranking.nickname.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium truncate text-gray-800">{ranking.nickname}</span>
                            {ranking.isMyRanking && (
                              <span className="px-1.5 py-0.5 bg-whale-light/10 text-whale-light text-[10px] font-medium rounded flex-shrink-0">나</span>
                            )}
                          </div>
                          {ranking.routeName ? (
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-xs truncate text-gray-400">{ranking.routeName}</span>
                              {ranking.routeStrategyType === 'TURTLE' && (
                                <span className="px-1 py-0.5 text-[7px] font-bold bg-amber-100 text-amber-700 rounded flex-shrink-0">터틀</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-gray-300">항로 미설정</span>
                          )}
                        </div>
                        <div className="flex-shrink-0 text-right">
                          {ranking.routeReturnRate != null ? (
                            <div className={`text-sm font-semibold ${getReturnColor(ranking.routeReturnRate)}`}>
                              {formatReturn(ranking.routeReturnRate)}
                            </div>
                          ) : (
                            <div className={`text-sm font-semibold ${getReturnColor(ranking.totalReturn)}`}>
                              {formatReturn(ranking.totalReturn)}
                            </div>
                          )}
                          <div className="text-[11px] text-gray-400">{formatAmount(ranking.totalValue)}원</div>
                        </div>
                      </div>
                    </div>

                    {/* 데스크톱 레이아웃 */}
                    <div className="hidden md:grid grid-cols-12 gap-4 items-center">
                      <div className="col-span-1 text-center">
                        {ranking.rank === 1 ? (
                          <img src="/whales/blue-whale.png" alt="대왕고래" title="대왕고래" className="w-7 h-7 object-contain mx-auto" />
                        ) : ranking.rank === 2 ? (
                          <img src="/whales/narwhal.png" alt="일각고래" title="일각고래" className="w-7 h-7 object-contain mx-auto" />
                        ) : ranking.rank === 3 ? (
                          <img src="/whales/dolphin.png" alt="돌고래" title="돌고래" className="w-6 h-6 object-contain mx-auto" />
                        ) : (
                          <span className="text-sm font-semibold text-gray-400">{ranking.rank}</span>
                        )}
                      </div>
                      <div className="col-span-4">
                        <div className="flex items-center space-x-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                            ranking.isMyRanking ? 'bg-whale-light' : 'bg-gray-300'
                          }`}>
                            {ranking.nickname.charAt(0)}
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-800">{ranking.nickname}</span>
                            {ranking.isMyRanking && (
                              <span className="ml-1.5 px-1.5 py-0.5 bg-whale-light/10 text-whale-light text-[10px] font-medium rounded">나</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="col-span-3">
                        {ranking.routeName ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium truncate text-whale-dark">{ranking.routeName}</span>
                            {ranking.routeStrategyType === 'TURTLE' && (
                              <span className="px-1 py-0.5 text-[8px] font-bold bg-amber-100 text-amber-700 rounded flex-shrink-0">터틀</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300">미설정</span>
                        )}
                      </div>
                      <div className="col-span-2 text-right">
                        {ranking.routeReturnRate != null ? (
                          <span className={`text-sm font-semibold ${getReturnColor(ranking.routeReturnRate)}`}>{formatReturn(ranking.routeReturnRate)}</span>
                        ) : (
                          <span className="text-xs text-gray-300">-</span>
                        )}
                      </div>
                      <div className="col-span-2 text-right">
                        <span className="text-sm font-medium text-gray-700">{formatAmount(ranking.totalValue)}</span>
                        <span className="text-xs ml-0.5 text-gray-300">원</span>
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
              className="px-4 py-2 rounded-lg border text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
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
              className="px-4 py-2 rounded-lg border text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
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

      {/* 항로 상세 모달 */}
      {selectedRanking && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={() => setSelectedRanking(null)}
        >
          <div
            className="rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div className="bg-gradient-to-r from-whale-dark to-whale-light p-6 text-white relative">
              <button
                onClick={() => setSelectedRanking(null)}
                className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm">
                  {selectedRanking.nickname.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-lg">{selectedRanking.nickname}</h3>
                  <p className="text-blue-200 text-xs">{selectedRanking.rank}위 투자자</p>
                </div>
              </div>
            </div>

            {/* 모달 본문 */}
            <div className="p-6 space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                  <span className="text-sm font-semibold text-gray-500">대표 항로</span>
                </div>

                <div className="rounded-xl p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-whale-dark">{selectedRanking.routeName}</span>
                      {selectedRanking.routeStrategyType === 'TURTLE' && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-700 rounded">
                          WhaleArc 독점
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-baseline gap-2 mb-3">
                    {selectedRanking.routeReturnRate != null && (
                      <span className={`text-2xl font-bold ${getReturnColor(selectedRanking.routeReturnRate)}`}>
                        {formatReturn(selectedRanking.routeReturnRate)}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">항로 수익률</span>
                  </div>

                  <div className="space-y-2.5 pt-3 border-t border-gray-200">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">전략 유형</span>
                      <span className="font-medium text-gray-700">{strategyLabel(selectedRanking.routeStrategyType)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">총 자산</span>
                      <span className="font-medium text-gray-700">{formatAmount(selectedRanking.totalValue)}원</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">포트폴리오 수익률</span>
                      <span className={`font-medium ${getReturnColor(selectedRanking.totalReturn)}`}>
                        {formatReturn(selectedRanking.totalReturn)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {selectedRanking.routeDescription && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm font-semibold text-gray-500">전략 로직</span>
                  </div>
                  <p className="text-sm leading-relaxed rounded-xl p-4 text-gray-600 bg-gray-50">
                    {selectedRanking.routeDescription}
                  </p>
                </div>
              )}

              <button
                onClick={() => {
                  setSelectedRanking(null);
                  navigate(`/portfolio/${selectedRanking.portfolioId}`);
                }}
                className="w-full py-2.5 text-sm font-semibold text-whale-light hover:text-whale-dark bg-whale-light/5 hover:bg-whale-light/10 rounded-xl transition-colors"
              >
                포트폴리오 상세 보기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RankingPage;
