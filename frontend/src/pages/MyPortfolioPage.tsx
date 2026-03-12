import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Area, AreaChart } from 'recharts';
import Header from '../components/Header';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import { tradeService, portfolioService, type Portfolio, type Trade, type PortfolioSnapshot } from '../services/tradeService';
import {
  quantStoreService,
  type PurchasePerformance,
  cryptoDisplayName,
  formatQuantity,
  CRYPTO_NAMES,
} from '../services/quantStoreService';
import { useAuth } from '../contexts/AuthContext';

const REFRESH_INTERVAL = 15_000; // 15초

const CHART_COLORS = ['#4a90e2', '#50c878', '#f5a623', '#e74c3c', '#9b59b6', '#1abc9c', '#e67e22', '#3498db'];

const MyPortfolioPage = () => {
  const navigate = useNavigate();
  const { user, profileName } = useAuth();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [purchasePerformance, setPurchasePerformance] = useState<PurchasePerformance[]>([]);
  const [historyData, setHistoryData] = useState<PortfolioSnapshot[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'holdings' | 'trades'>('holdings');
  const [settingRoute, setSettingRoute] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  const displayName =
    profileName || user?.user_metadata?.name || user?.email?.split('@')[0] || '사용자';

  const loadPortfolio = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
        setError(null);
      }

      const [portfolioData, perfData, tradeData, history] = await Promise.all([
        tradeService.getPortfolio(),
        quantStoreService.getMyPurchasesPerformance().catch(() => [] as PurchasePerformance[]),
        tradeService.getTrades().catch(() => [] as Trade[]),
        portfolioService.getHistory(30).catch(() => [] as PortfolioSnapshot[]),
      ]);

      setPortfolio(portfolioData);
      setPurchasePerformance(perfData);
      setHistoryData(history);
      setTrades(tradeData.sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime()));
    } catch (err: any) {
      if (!silent) setError(err.message || '포트폴리오 정보를 불러오는데 실패했습니다.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPortfolio();
  }, [loadPortfolio]);

  const handleSetRepresentativeRoute = async (purchaseId: string) => {
    try {
      setSettingRoute(purchaseId);
      const newId = portfolio?.representativePurchaseId === purchaseId ? null : purchaseId;
      await portfolioService.setRepresentativeRoute(newId);
      await loadPortfolio(true);
    } catch {
      // ignore
    } finally {
      setSettingRoute(null);
    }
  };

  // 자동 새로고침
  useEffect(() => {
    const timer = setInterval(() => loadPortfolio(true), REFRESH_INTERVAL);
    return () => clearInterval(timer);
  }, [loadPortfolio]);

  /* ───── 유틸 ───── */
  const fmt = (amount: number) =>
    new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  const fmtCompact = (amount: number) => {
    const abs = Math.abs(amount);
    if (abs >= 1_0000_0000) return `${(amount / 1_0000_0000).toFixed(1)}억`;
    if (abs >= 1_0000) return `${(amount / 1_0000).toFixed(0)}만`;
    return fmt(amount);
  };

  const returnColor = (v: number) =>
    v > 0 ? 'text-red-600' : v < 0 ? 'text-blue-600' : 'text-gray-600';

  const returnBg = (v: number) =>
    v > 0 ? 'bg-red-50 text-red-600' : v < 0 ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-600';

  const signPrefix = (v: number) => (v > 0 ? '+' : '');

  /* ───── 로딩/에러 ───── */
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header showNav />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <LoadingSpinner fullScreen={false} message="포트폴리오 정보를 불러오는 중..." />
        </div>
      </div>
    );
  }
  if (error && !portfolio) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header showNav />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <ErrorMessage message={error} onRetry={() => loadPortfolio()} variant="error" />
        </div>
      </div>
    );
  }
  if (!portfolio) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header showNav />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <ErrorMessage message="포트폴리오를 찾을 수 없습니다." variant="empty" />
        </div>
      </div>
    );
  }

  /* ───── 계산 ───── */
  const initialCash = portfolio.initialCash || 10_000_000;
  const totalValue = portfolio.totalValue;
  const cashBalance = portfolio.cashBalance;
  const turtleAllocated = portfolio.turtleAllocated || 0;
  const holdingsValue = portfolio.holdings.reduce((s, h) => s + h.marketValue, 0);
  const totalPnl = totalValue - initialCash;
  const returnRate = portfolio.returnRate;

  // 주식/가상화폐 구분 헬퍼
  const holdingName = (h: { stockCode: string; stockName: string; assetType?: string }) =>
    h.assetType === 'STOCK' ? h.stockName : (CRYPTO_NAMES[h.stockCode] || h.stockName || h.stockCode);

  // 자산 배분 데이터
  const allocationData = [
    ...(cashBalance > 0 ? [{ name: '현금', value: cashBalance, color: '#94a3b8' }] : []),
    ...portfolio.holdings.map((h, i) => ({
      name: holdingName(h),
      value: h.marketValue,
      color: CHART_COLORS[i % CHART_COLORS.length],
    })),
    ...(turtleAllocated > 0 ? [{ name: '터틀 전략', value: turtleAllocated, color: '#f59e0b' }] : []),
  ].filter((d) => d.value > 0);

  const totalHoldingsPnl = portfolio.holdings.reduce((s, h) => s + h.profitLoss, 0);

  // 자산 → 항로 이름 매핑 (purchasePerformance에서 추출, 복수 항로 지원)
  const assetRouteMap: Record<string, string[]> = {};
  for (const perf of purchasePerformance) {
    for (const a of perf.assets) {
      if (!assetRouteMap[a.code]) assetRouteMap[a.code] = [];
      if (!assetRouteMap[a.code].includes(perf.productName)) {
        assetRouteMap[a.code].push(perf.productName);
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header showNav />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          to="/dashboard"
          className="inline-flex items-center text-gray-500 hover:text-whale-light mb-6 text-sm transition-colors"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          대시보드
        </Link>

        {/* ─── 포트폴리오 헤더 ─── */}
        <div className="bg-gradient-to-r from-whale-dark to-whale-light rounded-2xl shadow-xl p-6 md:p-8 text-white mb-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-whale-accent opacity-10 rounded-full blur-2xl" />

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm p-1.5">
                <img src="/whales/sperm-whale.png" alt="" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">내 포트폴리오</h1>
                <p className="text-blue-100 text-sm">{displayName}님의 투자 현황</p>
              </div>
            </div>

            {/* 핵심 지표 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                <div className="text-blue-200 text-xs mb-1">총 자산</div>
                <div className="text-xl md:text-2xl font-bold">{fmt(totalValue)}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                <div className="text-blue-200 text-xs mb-1">총 수익</div>
                <div className={`text-xl md:text-2xl font-bold ${totalPnl >= 0 ? 'text-red-300' : 'text-blue-300'}`}>
                  {signPrefix(totalPnl)}{fmt(Math.round(totalPnl))}
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                <div className="text-blue-200 text-xs mb-1">수익률</div>
                <div className={`text-xl md:text-2xl font-bold ${returnRate >= 0 ? 'text-red-300' : 'text-blue-300'}`}>
                  {signPrefix(returnRate)}{returnRate.toFixed(2)}%
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                <div className="text-blue-200 text-xs mb-1">초기 자본</div>
                <div className="text-xl md:text-2xl font-bold">{fmtCompact(initialCash)}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ─── 메인 영역 (2/3) ─── */}
          <div className="lg:col-span-2 space-y-6">

            {/* 자산 추이 차트 */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-whale-dark">자산 추이</h2>
                <span className="text-xs text-gray-400">최근 30일</span>
              </div>
              {historyData.length >= 2 ? (() => {
                const chartData = historyData.map((s) => ({
                  date: s.date,
                  label: new Date(s.date + 'T00:00:00').toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
                  totalValue: Math.round(s.totalValue),
                  returnRate: Number(s.returnRate.toFixed(2)),
                }));
                const values = chartData.map((d) => d.totalValue);
                const minVal = Math.min(...values);
                const maxVal = Math.max(...values);
                const padding = Math.max((maxVal - minVal) * 0.1, 10000);
                const trend = chartData[chartData.length - 1].totalValue - chartData[0].totalValue;
                const gradientColor = trend >= 0 ? '#ef4444' : '#3b82f6';
                const lineColor = trend >= 0 ? '#ef4444' : '#3b82f6';

                return (
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                        <defs>
                          <linearGradient id="assetGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={gradientColor} stopOpacity={0.15} />
                            <stop offset="100%" stopColor={gradientColor} stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11, fill: '#9ca3af' }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          domain={[Math.floor(minVal - padding), Math.ceil(maxVal + padding)]}
                          tick={{ fontSize: 11, fill: '#9ca3af' }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v: number) => {
                            if (v >= 1_0000_0000) return `${(v / 1_0000_0000).toFixed(1)}억`;
                            if (v >= 1_0000) return `${(v / 1_0000).toFixed(0)}만`;
                            return `${v}`;
                          }}
                          width={50}
                        />
                        <Tooltip
                          contentStyle={{ borderRadius: '10px', fontSize: '13px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                          formatter={(value: number, name: string) => {
                            if (name === 'totalValue') return [fmt(value), '총 자산'];
                            return [value, name];
                          }}
                          labelFormatter={(label: string) => label}
                        />
                        <Area
                          type="monotone"
                          dataKey="totalValue"
                          stroke={lineColor}
                          strokeWidth={2.5}
                          fill="url(#assetGradient)"
                          dot={false}
                          activeDot={{ r: 4, fill: lineColor, strokeWidth: 2, stroke: '#fff' }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                );
              })() : (
                <div className="h-56 flex flex-col items-center justify-center text-gray-400">
                  <svg className="w-10 h-10 mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                  </svg>
                  <p className="text-sm font-medium">자산 추이 데이터 수집 중</p>
                  <p className="text-xs mt-1">매일 자산이 기록되며, 2일 이상 데이터가 쌓이면 차트가 표시됩니다</p>
                </div>
              )}
            </div>

            {/* 자산 배분 */}
            <div className="bg-white rounded-xl shadow-lg p-4 md:p-6">
              <h2 className="text-lg font-bold text-whale-dark mb-4">자산 배분</h2>
              <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6">
                {/* 도넛 차트 */}
                <div className="w-36 h-36 md:w-48 md:h-48 flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={allocationData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {allocationData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => fmt(value)}
                        contentStyle={{ borderRadius: '8px', fontSize: '13px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* 범례 + 비율 바 */}
                <div className="flex-1 w-full space-y-2.5">
                  {allocationData.map((d) => {
                    const pct = totalValue > 0 ? (d.value / totalValue) * 100 : 0;
                    return (
                      <div key={d.name} className="flex items-center gap-2 md:gap-3">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                        <span className="text-xs md:text-sm text-gray-700 w-14 md:w-20 truncate">{d.name}</span>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden hidden sm:block">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: d.color }} />
                        </div>
                        <span className="text-xs text-gray-500 w-12 text-right">{pct.toFixed(1)}%</span>
                        <span className="text-xs font-medium text-gray-700 w-20 md:w-24 text-right hidden sm:inline">{fmt(d.value)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 탭: 보유 종목 / 거래 내역 */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="flex border-b border-gray-200">
                <button
                  onClick={() => setActiveTab('holdings')}
                  className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                    activeTab === 'holdings'
                      ? 'text-whale-dark border-b-2 border-whale-light bg-whale-light/5'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  보유 종목 ({portfolio.holdings.length})
                </button>
                <button
                  onClick={() => setActiveTab('trades')}
                  className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                    activeTab === 'trades'
                      ? 'text-whale-dark border-b-2 border-whale-light bg-whale-light/5'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  거래 내역 ({trades.length})
                </button>
              </div>

              <div className="p-6">
                {activeTab === 'holdings' ? (
                  /* 보유 종목 */
                  portfolio.holdings.length === 0 ? (
                    <div className="text-center py-12">
                      <img src="/whales/gray-whale.png" alt="" className="w-14 h-14 object-contain mx-auto mb-3 opacity-50" />
                      <p className="text-gray-500 font-medium mb-1">보유 종목이 없습니다</p>
                      <p className="text-sm text-gray-400 mb-4">항로를 구매하거나 직접 거래해보세요</p>
                      <div className="flex justify-center gap-3">
                        <button onClick={() => navigate('/store')} className="btn-primary text-sm px-4 py-2">
                          항로 상점
                        </button>
                        <button onClick={() => navigate('/trade')} className="btn-secondary text-sm px-4 py-2">
                          직접 거래
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* 요약 바 */}
                      <div className="flex items-center justify-between mb-4 px-1">
                        <div className="text-sm text-gray-500">
                          총 평가금액 <span className="font-semibold text-whale-dark">{fmt(holdingsValue)}</span>
                        </div>
                        <div className={`text-sm font-semibold ${returnColor(totalHoldingsPnl)}`}>
                          {signPrefix(totalHoldingsPnl)}{fmt(Math.round(totalHoldingsPnl))}
                        </div>
                      </div>

                      {/* 주식 섹션 */}
                      {(() => {
                        const stockHoldings = portfolio.holdings.filter(h => h.assetType === 'STOCK');
                        return stockHoldings.length > 0 ? (
                          <div className="mb-5">
                            <div className="flex items-center gap-1.5 mb-3 px-1">
                              <img src="/whales/spotted-dolphin.png" alt="주식" className="w-5 h-5 object-contain" />
                              <span className="text-sm font-bold text-indigo-600">주식</span>
                              <span className="text-xs text-gray-400">{stockHoldings.length}종목</span>
                            </div>
                            <div className="space-y-3">
                              {stockHoldings.map((h) => (
                                <div
                                  key={h.stockCode}
                                  className="flex items-center justify-between p-2.5 md:p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer border border-gray-100"
                                  onClick={() => navigate(`/trade?code=${h.stockCode}&type=STOCK`)}
                                >
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-semibold text-sm text-whale-dark">{holdingName(h)}</span>
                                      {assetRouteMap[h.stockCode]?.map((routeName) => (
                                        <span key={routeName} className="px-1.5 py-0.5 text-[9px] font-semibold bg-whale-light/10 text-whale-light rounded">
                                          {routeName}
                                        </span>
                                      ))}
                                    </div>
                                    <div className="text-xs text-gray-400">{h.stockCode} · {Math.floor(h.quantity)}주</div>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-semibold text-sm">{fmt(h.marketValue)}</div>
                                    <div className={`text-xs font-semibold ${returnColor(h.returnRate)}`}>
                                      {signPrefix(h.returnRate)}{h.returnRate.toFixed(2)}%
                                      <span className="text-gray-400 font-normal ml-1">
                                        ({signPrefix(h.profitLoss)}{fmt(Math.round(h.profitLoss))})
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null;
                      })()}

                      {/* 가상화폐 섹션 */}
                      {(() => {
                        const cryptoHoldings = portfolio.holdings.filter(h => h.assetType !== 'STOCK');
                        return cryptoHoldings.length > 0 ? (
                          <div>
                            <div className="flex items-center gap-1.5 mb-3 px-1">
                              <img src="/whales/wild-cat-whale.png" alt="가상화폐" className="w-5 h-5 object-contain" />
                              <span className="text-sm font-bold text-emerald-600">가상화폐</span>
                              <span className="text-xs text-gray-400">{cryptoHoldings.length}종목</span>
                            </div>
                            <div className="space-y-3">
                              {cryptoHoldings.map((h) => (
                                <div
                                  key={h.stockCode}
                                  className="flex items-center justify-between p-2.5 md:p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer border border-gray-100"
                                  onClick={() => navigate(`/trade?code=${h.stockCode}&type=CRYPTO`)}
                                >
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-semibold text-sm text-whale-dark">{holdingName(h)}</span>
                                      {assetRouteMap[h.stockCode]?.map((routeName) => (
                                        <span key={routeName} className="px-1.5 py-0.5 text-[9px] font-semibold bg-whale-light/10 text-whale-light rounded">
                                          {routeName}
                                        </span>
                                      ))}
                                    </div>
                                    <div className="text-xs text-gray-400">{h.stockCode} · {formatQuantity(h.quantity)}개</div>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-semibold text-sm">{fmt(h.marketValue)}</div>
                                    <div className={`text-xs font-semibold ${returnColor(h.returnRate)}`}>
                                      {signPrefix(h.returnRate)}{h.returnRate.toFixed(2)}%
                                      <span className="text-gray-400 font-normal ml-1">
                                        ({signPrefix(h.profitLoss)}{fmt(Math.round(h.profitLoss))})
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null;
                      })()}
                    </>
                  )
                ) : (
                  /* 거래 내역 */
                  trades.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-gray-500 font-medium mb-1">거래 내역이 없습니다</p>
                      <p className="text-sm text-gray-400">매수/매도 시 내역이 여기에 표시됩니다</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {trades.slice(0, 20).map((t) => (
                        <div key={t.id} className="flex items-center justify-between p-2.5 md:p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center gap-2 md:gap-3 min-w-0">
                            <span className={`px-2 py-1 text-xs font-bold rounded flex-shrink-0 ${
                              t.orderType === 'BUY' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                            }`}>
                              {t.orderType === 'BUY' ? '매수' : '매도'}
                            </span>
                            <div className="min-w-0">
                              <span className="font-semibold text-sm text-whale-dark">
                                {t.assetType === 'STOCK' ? t.stockName : (CRYPTO_NAMES[t.stockCode] || t.stockName)}
                              </span>
                              {t.assetType === 'STOCK' && (
                                <span className="ml-1 px-1 py-0.5 text-[9px] font-bold bg-indigo-50 text-indigo-600 rounded">주식</span>
                              )}
                              <span className="text-xs text-gray-400 ml-1 hidden sm:inline">{t.stockCode}</span>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0 ml-2">
                            <div className="text-xs md:text-sm font-medium">
                              {t.assetType === 'STOCK' ? `${Math.floor(t.quantity)}주` : `${formatQuantity(t.quantity)}개`} · {fmt(t.price)}
                            </div>
                            <div className="text-xs text-gray-400">
                              {new Date(t.executedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>

          {/* ─── 사이드바 (1/3) ─── */}
          <div className="lg:col-span-1 space-y-6">

            {/* 포트폴리오 요약 */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-lg font-bold text-whale-dark mb-4">투자 요약</h2>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">현금</span>
                  <span className="font-medium">{fmt(cashBalance)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">보유 종목 평가</span>
                  <span className="font-medium">{fmt(holdingsValue)}</span>
                </div>
                {turtleAllocated > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">터틀 전략 배정</span>
                    <span className="font-medium text-amber-600">{fmt(turtleAllocated)}</span>
                  </div>
                )}
                <div className="border-t border-gray-100 pt-3 flex justify-between text-sm">
                  <span className="font-semibold text-gray-700">총 자산</span>
                  <span className="font-bold text-whale-dark">{fmt(totalValue)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">총 손익</span>
                  <span className={`font-bold ${returnColor(totalPnl)}`}>
                    {signPrefix(totalPnl)}{fmt(Math.round(totalPnl))}
                    <span className="text-xs font-normal ml-1">
                      ({signPrefix(returnRate)}{returnRate.toFixed(2)}%)
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* 항해 중인 항로 */}
            {purchasePerformance.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-whale-dark">항해 중인 항로</h2>
                  <button
                    onClick={() => navigate('/store')}
                    className="text-xs text-whale-light hover:text-whale-accent font-medium"
                  >
                    항로 상점
                  </button>
                </div>
                <div className="space-y-4">
                  {purchasePerformance.map((perf) => (
                    <div
                      key={perf.purchaseId}
                      className="rounded-xl border border-gray-100 overflow-hidden"
                    >
                      {/* 항로 헤더 */}
                      <div className="bg-gradient-to-r from-whale-light/5 to-whale-accent/5 px-4 py-3">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-sm text-whale-dark">{perf.productName}</span>
                            {perf.strategyType === 'TURTLE' && (
                              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-700 rounded">
                                WhaleArc 독점
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => handleSetRepresentativeRoute(perf.purchaseId)}
                            disabled={settingRoute === perf.purchaseId}
                            title={portfolio.representativePurchaseId === perf.purchaseId ? '대표 항로 해제' : '대표 항로로 설정'}
                            className={`p-1 rounded transition-colors ${
                              portfolio.representativePurchaseId === perf.purchaseId
                                ? 'text-yellow-500 hover:text-yellow-600'
                                : 'text-gray-300 hover:text-yellow-400'
                            } ${settingRoute === perf.purchaseId ? 'opacity-50' : ''}`}
                          >
                            <svg className="w-4 h-4" fill={portfolio.representativePurchaseId === perf.purchaseId ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">투자: {fmt(perf.investmentAmount)}</span>
                          {portfolio.representativePurchaseId === perf.purchaseId && (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-yellow-100 text-yellow-700 rounded">
                              대표 항로
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 수익률 */}
                      <div className="px-4 py-3">
                        <div className={`text-xl font-bold ${returnColor(perf.totalReturnRate)}`}>
                          {signPrefix(perf.totalReturnRate)}{perf.totalReturnRate.toFixed(2)}%
                          <span className="text-xs font-normal text-gray-500 ml-1.5">
                            ({signPrefix(perf.totalPnl)}{fmt(Math.round(perf.totalPnl))})
                          </span>
                        </div>

                        {/* 자산별 태그 */}
                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                          {perf.assets.map((a) => (
                            <span
                              key={a.code}
                              className={`px-2 py-0.5 text-[11px] font-semibold rounded ${returnBg(a.returnRate)}`}
                            >
                              {a.code} {signPrefix(a.returnRate)}{a.returnRate.toFixed(1)}%
                            </span>
                          ))}
                        </div>

                        {/* 터틀 전용 통계 */}
                        {perf.strategyType === 'TURTLE' && (
                          <div className="mt-3 pt-2.5 border-t border-gray-100">
                            {(perf.totalTradeCount || 0) === 0 ? (
                              <div className="flex items-center gap-2 text-xs text-amber-600">
                                <svg className="w-3.5 h-3.5 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                </svg>
                                진입 시그널 대기 중 (도치안 채널 돌파 + ADX 확인)
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center">
                                <div>
                                  <div className="text-xs text-gray-400">거래</div>
                                  <div className="text-sm font-bold text-whale-dark">{perf.totalTradeCount}회</div>
                                </div>
                                <div>
                                  <div className="text-xs text-gray-400">승률</div>
                                  <div className="text-sm font-bold text-whale-dark">
                                    {perf.totalTradeCount! > 0
                                      ? (((perf.totalWinCount || 0) / perf.totalTradeCount!) * 100).toFixed(1)
                                      : '0.0'}%
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs text-gray-400">실현 손익</div>
                                  <div className={`text-sm font-bold ${returnColor(perf.realizedPnl || 0)}`}>
                                    {fmt(Math.round(perf.realizedPnl || 0))}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 빠른 액션 */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-lg font-bold text-whale-dark mb-3">빠른 액션</h2>
              <div className="space-y-2">
                {[
                  { label: '거래하기', path: '/trade', primary: true },
                  { label: '항로 둘러보기', path: '/store', primary: false },
                  { label: '전략 분석', path: '/strategy', primary: false },
                ].map((action) => (
                  <button
                    key={action.path}
                    onClick={() => navigate(action.path)}
                    className={`w-full text-left flex items-center justify-between text-sm ${
                      action.primary ? 'btn-primary' : 'btn-secondary'
                    } py-2.5 px-4`}
                  >
                    <span>{action.label}</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
                {/* CSV 내보내기 */}
                <div className="border-t border-gray-100 pt-2 mt-1 space-y-2">
                  <div className="text-xs text-gray-400 px-1">내보내기</div>
                  <button
                    onClick={async () => {
                      setExporting('trades');
                      try {
                        await tradeService.exportTradesCsv();
                      } catch {
                        alert('다운로드에 실패했습니다.');
                      } finally {
                        setExporting(null);
                      }
                    }}
                    disabled={exporting === 'trades'}
                    className="w-full text-left flex items-center justify-between text-sm text-gray-600 hover:bg-gray-50 border border-gray-200 rounded-lg py-2.5 px-4 transition-colors disabled:opacity-50"
                  >
                    <span>{exporting === 'trades' ? '다운로드 중...' : '거래 내역 CSV'}</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                  <button
                    onClick={async () => {
                      setExporting('portfolio');
                      try {
                        await tradeService.exportPortfolioCsv();
                      } catch {
                        alert('다운로드에 실패했습니다.');
                      } finally {
                        setExporting(null);
                      }
                    }}
                    disabled={exporting === 'portfolio'}
                    className="w-full text-left flex items-center justify-between text-sm text-gray-600 hover:bg-gray-50 border border-gray-200 rounded-lg py-2.5 px-4 transition-colors disabled:opacity-50"
                  >
                    <span>{exporting === 'portfolio' ? '다운로드 중...' : '포트폴리오 리포트 CSV'}</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                </div>

                <button
                  onClick={async () => {
                    if (!window.confirm(
                      '⚠️ 모의투자를 완전히 초기화합니다.\n\n' +
                      '다음 데이터가 모두 삭제됩니다:\n' +
                      '- 보유 종목 전부 삭제\n' +
                      '- 거래 내역 전부 삭제\n' +
                      '- 구매한 항로 전부 삭제\n' +
                      '- 적용한 전략 해제\n' +
                      '- 포트폴리오 히스토리 삭제\n' +
                      '- 현금 1,000만원으로 리셋\n\n' +
                      '정말 초기화하시겠습니까?'
                    )) return;
                    if (!window.confirm(
                      '⛔ 최종 확인\n\n' +
                      '이 작업은 되돌릴 수 없습니다.\n' +
                      '모든 투자 기록이 영구 삭제됩니다.\n\n' +
                      '정말로 초기화할까요?'
                    )) return;
                    if (prompt('초기화를 진행하려면 "초기화"를 입력하세요.') !== '초기화') {
                      alert('초기화가 취소되었습니다.');
                      return;
                    }
                    try {
                      await tradeService.resetPortfolio();
                      alert('새 항해가 시작되었습니다! 모의투자가 초기화되었습니다.');
                      loadPortfolio();
                    } catch {
                      alert('초기화에 실패했습니다.');
                    }
                  }}
                  className="w-full text-left flex items-center justify-between text-sm text-red-500 hover:bg-red-50 border border-red-200 rounded-lg py-2.5 px-4 transition-colors"
                >
                  <span>새 항해 시작</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyPortfolioPage;
