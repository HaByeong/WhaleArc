import { useState, useEffect, useCallback, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import Header from '../components/Header';
import VirtSplashLoading from '../components/VirtSplashLoading';
import ErrorMessage from '../components/ErrorMessage';
import { tradeService, type Portfolio, type StockPrice } from '../services/tradeService';
import { quantStoreService, type ProductPurchase, type PurchasePerformance, cryptoDisplayName, formatQuantity } from '../services/quantStoreService';
import { userService } from '../services/userService';
import { useAuth } from '../contexts/AuthContext';
import { usePolling } from '../hooks/usePolling';
import { useRealtimePrice } from '../hooks/useRealtimePrice';
import { useVirtNavigate, useRoutePrefix } from '../hooks/useRoutePrefix';
import { virtService, type VirtCredentialInfo, type VirtPortfolio } from '../services/virtService';
import { useTheme } from '../contexts/ThemeContext';
import SplashLoading from '../components/SplashLoading';
import UnstableCurrent from '../components/UnstableCurrent';
import GuideTour, { type TourStep } from '../components/GuideTour';

const CHART_COLORS = ['#3b82f6', '#22d3ee', '#818cf8', '#a78bfa', '#34d399', '#f472b6', '#fb923c', '#94a3b8'];


const DashboardPage = () => {
  const navigate = useVirtNavigate();
  const { isVirt } = useRoutePrefix();
  const { user, profileName } = useAuth();
  const { resolvePageDark } = useTheme();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [watchlist, setWatchlist] = useState<StockPrice[]>([]);
  const [topMovers, setTopMovers] = useState<StockPrice[]>([]);
  const [favoriteAssets, setFavoriteAssets] = useState<string[]>([]);
  const [activePurchases, setActivePurchases] = useState<ProductPurchase[]>([]);
  const [_purchasePerformance, setPurchasePerformance] = useState<PurchasePerformance[]>([]);
  void _purchasePerformance;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  // ── 목표 수익률 설정 ──
  const [targetReturn, setTargetReturn] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('whalearc_target_return');
      if (saved) return parseFloat(saved);
    } catch { /* ignore */ }
    return 10;
  });
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState(String(targetReturn));

  const handleTargetSave = () => {
    const val = parseFloat(targetInput);
    if (!isNaN(val) && val > 0) {
      setTargetReturn(val);
      localStorage.setItem('whalearc_target_return', String(val));
    } else {
      setTargetInput(String(targetReturn));
    }
    setEditingTarget(false);
  };

  // 일반 모드 가이드 투어
  const [showNormalTour, setShowNormalTour] = useState(false);
  const normalTourSteps: TourStep[] = [
    { target: 'normal-api-panel', title: '실계좌 자산 연동', description: 'KIS, 업비트, 비트겟 API를 연동하면\n내 실제 자산을 한눈에 확인할 수 있습니다.\n\n읽기 전용 API 키만 사용하므로 안전합니다.', position: 'bottom' },
    { target: 'virt-actions', title: '빠른 항해', description: '거래하기 — 주식·코인 매수/매도\n시세 확인하기 — 실시간 시장 시세\n내 포트폴리오 — 자산 추이·배분 분석\n전략 백테스트 — 과거 데이터로 전략 검증\n전략 학습 — 검증된 퀀트 전략 탐색\n투자 현황 보기 — 다른 투자자 랭킹\n\n각 버튼을 눌러 원하는 페이지로 바로 이동하세요!', position: 'left' },
  ];

  // Virt 가이드 투어
  const [showVirtTour, setShowVirtTour] = useState(false);
  const virtTourSteps: TourStep[] = [
    { target: 'virt-portfolio', title: '포트폴리오 요약', description: '가상 자금 1,000만원으로 시작합니다.\n\n총 자산, 현금 잔고, 수익률을 한눈에 확인할 수 있어요. 카드를 클릭하면 상세 포트폴리오 페이지로 이동합니다.', position: 'bottom' },
    { target: 'virt-target-return', title: '목표 수익률', description: '나만의 목표 수익률을 설정할 수 있어요.\n\n연필 아이콘을 클릭하면 목표를 수정할 수 있고,\n프로그레스 바로 달성률을 한눈에 확인합니다.\n\n목표 달성 시 축하 표시가 나타나요!', position: 'bottom' },
    { target: 'virt-holdings', title: '보유 종목', description: '매수한 주식과 암호화폐가 여기에 표시됩니다.\n\n종목별 수익률, 평가금액을 실시간으로 확인할 수 있어요. 아직 매수한 종목이 없다면 거래 페이지에서 첫 매수를 해보세요!', position: 'bottom' },
    { target: 'virt-routes', title: '항해 중인 항로', description: '퀀트 전략(항로)을 구매하면 자동으로 매매가 실행됩니다.\n\n전략 학습 페이지에서 다양한 전략을 백테스트하고, 마음에 드는 전략을 적용해보세요.', position: 'bottom' },
    { target: 'virt-watchlist', title: '관심 종목', description: '프로필에서 관심 종목을 등록하면 실시간 시세가 여기에 표시됩니다.\n\n급등·급락 종목도 자동으로 추천해드려요.', position: 'top' },
    { target: 'virt-actions', title: '빠른 항해', description: '거래하기 — 주식·코인 매수/매도\n시세 확인하기 — 실시간 시장 시세\n내 포트폴리오 — 자산 추이·배분 분석\n전략 백테스트 — 과거 데이터로 전략 검증\n전략 학습 — 검증된 퀀트 전략 탐색\n투자 현황 보기 — 다른 투자자 랭킹\n\n각 버튼을 눌러 원하는 페이지로 바로 이동하세요!', position: 'left' },
  ];

  // ── 실계좌 연동 (인라인) ──
  const [apiPanelOpen, setApiPanelOpen] = useState(false);
  const [apiTab, setApiTab] = useState<'kis' | 'upbit' | 'bitget'>('kis');
  const [kisCredInfo, setKisCredInfo] = useState<VirtCredentialInfo | null>(null);
  const [upbitCredInfo, setUpbitCredInfo] = useState<VirtCredentialInfo | null>(null);
  const [bitgetCredInfo, setBitgetCredInfo] = useState<VirtCredentialInfo | null>(null);
  const [apiForm, setApiForm] = useState<Record<string, string>>({});
  const [apiSaving, setApiSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiSuccess, setApiSuccess] = useState<string | null>(null);

  // ── 실계좌 자산 데이터 ──
  const [kisPortfolio, setKisPortfolio] = useState<VirtPortfolio | null>(null);
  const [upbitPortfolio, setUpbitPortfolio] = useState<VirtPortfolio | null>(null);
  const [bitgetPortfolio, setBitgetPortfolio] = useState<VirtPortfolio | null>(null);
  const [realAssetLoading, setRealAssetLoading] = useState(false);

  // 실계좌 연결 상태 로드 + 자산 조회
  const loadApiStatus = useCallback(async () => {
    try {
      const [kis, upbit, bitget] = await Promise.all([
        virtService.getCredentialInfo().catch(() => ({ connected: false } as VirtCredentialInfo)),
        virtService.getUpbitCredentialInfo().catch(() => ({ connected: false } as VirtCredentialInfo)),
        virtService.getBitgetCredentialInfo().catch(() => ({ connected: false } as VirtCredentialInfo)),
      ]);
      setKisCredInfo(kis); setUpbitCredInfo(upbit); setBitgetCredInfo(bitget);

      // 연동된 거래소 자산 조회
      const hasAny = kis.connected || upbit.connected || bitget.connected;
      if (hasAny) {
        setRealAssetLoading(true);
        const [kisP, upbitP, bitgetP] = await Promise.all([
          kis.connected ? virtService.getPortfolio().catch(() => null) : Promise.resolve(null),
          upbit.connected ? virtService.getUpbitPortfolio().catch(() => null) : Promise.resolve(null),
          bitget.connected ? virtService.getBitgetPortfolio().catch(() => null) : Promise.resolve(null),
        ]);
        if (kisP) setKisPortfolio(kisP);
        if (upbitP) setUpbitPortfolio(upbitP);
        if (bitgetP) setBitgetPortfolio(bitgetP);
      }
    } catch { /* ignore */ } finally {
      setRealAssetLoading(false);
    }
  }, []);

  useEffect(() => { if (!isVirt) loadApiStatus(); }, [isVirt, loadApiStatus]);

  const handleApiSave = async () => {
    setApiSaving(true); setApiError(null); setApiSuccess(null);
    try {
      if (apiTab === 'kis') {
        await virtService.saveCredential({ appkey: apiForm.appkey || '', appsecret: apiForm.appsecret || '', accountNumber: apiForm.accountNumber || '', accountProductCode: apiForm.accountProductCode || '01' });
      } else if (apiTab === 'upbit') {
        await virtService.saveUpbitCredential({ accessKey: apiForm.accessKey || '', secretKey: apiForm.secretKey || '' });
      } else {
        await virtService.saveBitgetCredential({ apiKey: apiForm.apiKey || '', secretKey: apiForm.secretKey || '', passphrase: apiForm.passphrase || '' });
      }
      setApiSuccess('연결 성공!');
      setApiForm({});
      await loadApiStatus();
      setApiPanelOpen(false);
    } catch (e: any) {
      setApiError(e.response?.data?.message || e.message || '연결 실패');
    } finally { setApiSaving(false); }
  };

  const handleApiDisconnect = async () => {
    if (!window.confirm('연결을 해제하시겠습니까?')) return;
    try {
      if (apiTab === 'kis') { await virtService.deleteCredential(); setKisPortfolio(null); }
      else if (apiTab === 'upbit') { await virtService.deleteUpbitCredential(); setUpbitPortfolio(null); }
      else { await virtService.deleteBitgetCredential(); setBitgetPortfolio(null); }
      await loadApiStatus();
    } catch { /* ignore */ }
  };

  const _apiConnected = apiTab === 'kis' ? kisCredInfo?.connected : apiTab === 'upbit' ? upbitCredInfo?.connected : bitgetCredInfo?.connected; void _apiConnected;

  // 실시간 WebSocket 시세
  const { prices: realtimePrices } = useRealtimePrice({ enabled: true });


  // 관심 종목에 실시간 시세 병합
  const liveWatchlist = useMemo(() => {
    if (realtimePrices.size === 0) return watchlist;
    return watchlist.map((stock) => {
      const rt = realtimePrices.get(stock.stockCode);
      if (rt) {
        return { ...stock, currentPrice: rt.price, change: rt.change, changeRate: rt.changeRate, volume: rt.volume };
      }
      return stock;
    });
  }, [watchlist, realtimePrices]);

  // 시세 변동 상위에도 실시간 반영
  const liveTopMovers = useMemo(() => {
    if (realtimePrices.size === 0) return topMovers;
    return topMovers.map((stock) => {
      const rt = realtimePrices.get(stock.stockCode);
      if (rt) {
        return { ...stock, currentPrice: rt.price, change: rt.change, changeRate: rt.changeRate, volume: rt.volume };
      }
      return stock;
    });
  }, [topMovers, realtimePrices]);

  const displayName = profileName || user?.user_metadata?.name || user?.email?.split('@')[0] || '사용자';

  useEffect(() => {
    loadData();
  }, []);

  // 일반 모드에서는 가상 포트폴리오 로드 생략
  void isVirt;

  const pollData = useCallback(async () => {
    try {
      const [portfolioData, stocksData] = await Promise.all([
        isVirt ? tradeService.getPortfolio().catch(() => null) : Promise.resolve(null),
        tradeService.getStockList().catch(() => []),
      ]);
      if (portfolioData && isVirt) setPortfolio(portfolioData);
      if (stocksData.length) {
        const sorted = [...stocksData].sort((a, b) => Math.abs(b.changeRate) - Math.abs(a.changeRate));
        setTopMovers(sorted.slice(0, 5));
        if (favoriteAssets.length > 0) {
          const favSet = new Set(favoriteAssets);
          const SYMBOL_ALIASES: Record<string, string> = { MATIC: 'POL', POL: 'MATIC' };
          for (const fav of favoriteAssets) {
            const alias = SYMBOL_ALIASES[fav];
            if (alias) favSet.add(alias);
          }
          setWatchlist(stocksData.filter((s) => favSet.has(s.stockCode)));
        }
      }
    } catch {
      // 폴링 실패는 무시
    }
  }, [favoriteAssets]);
  usePolling(pollData, 15000);

  const getDemoPortfolio = (): Portfolio => ({
    id: 'demo-1',
    userId: 'demo-user',
    cashBalance: 5000000,
    initialCash: 10000000,
    turtleAllocated: 0,
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

      let portfolioFallback = false;
      const [portfolioData, stocksData, profile, purchaseData] = await Promise.all([
        isVirt ? tradeService.getPortfolio().catch(() => { portfolioFallback = true; return getDemoPortfolio(); }) : Promise.resolve(null),
        tradeService.getStockList().catch(() => []),
        userService.getProfile().catch(() => null),
        isVirt ? quantStoreService.getMyPurchases().catch(() => ({ purchases: [], purchasedProductIds: [] })) : Promise.resolve({ purchases: [], purchasedProductIds: [] }),
      ]);

      const actives = purchaseData.purchases.filter((p) => p.status === 'ACTIVE');
      setActivePurchases(actives);
      if (isVirt && actives.length > 0) {
        quantStoreService.getMyPurchasesPerformance()
          .then((perf) => setPurchasePerformance(perf))
          .catch(() => setPurchasePerformance([]));
      }
      setIsDemo(portfolioFallback);

      const favAssets = profile?.favoriteAssets?.length ? profile.favoriteAssets : [];
      setFavoriteAssets(favAssets);
      setPortfolio(portfolioData);
      if (stocksData.length) {
        const sorted = [...stocksData].sort((a, b) => Math.abs(b.changeRate) - Math.abs(a.changeRate));
        setTopMovers(sorted.slice(0, 5));
        if (favAssets.length > 0) {
          const favSet = new Set(favAssets);
          // MATIC↔POL 등 리브랜딩 심볼 양방향 매핑
          const SYMBOL_ALIASES: Record<string, string> = { MATIC: 'POL', POL: 'MATIC' };
          for (const fav of favAssets) {
            const alias = SYMBOL_ALIASES[fav];
            if (alias) favSet.add(alias);
          }
          setWatchlist(stocksData.filter((s) => favSet.has(s.stockCode)));
        }
      }
    } catch (err: any) {
      if (isVirt) {
        setPortfolio(getDemoPortfolio());
        setIsDemo(true);
      }
      setError(err.message || '대시보드 데이터를 불러오지 못했습니다. 네트워크 연결을 확인해주세요.');
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

  const pageDark = resolvePageDark(isVirt);
  const pageBg = pageDark ? 'bg-[#060d18] text-white' : 'bg-gray-50';

  if (loading) {
    if (!isVirt) return <SplashLoading message="실계좌 자산을 불러오는 중..." />;
    return <VirtSplashLoading message="가상 투자 데이터를 불러오는 중..." />;
  }

  if (error) {
    return (
      <div className={`min-h-screen ${pageBg}`}>
        <Header showNav={true} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {!isVirt ? (
            <UnstableCurrent message="해류가 불안정합니다" sub={error || '데이터를 다시 불러오고 있어요...'} />
          ) : (
            <ErrorMessage message={error} onRetry={loadData} variant="error" />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${pageBg}`}>
      <Header showNav={true} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 환영 메시지 — 살아있는 바다 */}
        <div className="mb-8 bg-gradient-to-r from-whale-dark to-whale-light rounded-2xl shadow-xl p-6 md:p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-whale-accent opacity-10 rounded-full blur-2xl"></div>

          <div className="relative z-10">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center space-x-3">
                <div className="relative w-14 h-14">
                  <div className="absolute inset-0 rounded-full border border-white/20 dash-ripple-1" />
                  <div className="absolute inset-0 rounded-full border border-white/10 dash-ripple-2" />
                  <div className="w-full h-full bg-white bg-opacity-20 rounded-full flex items-center justify-center backdrop-blur-sm p-1.5 relative z-10 dash-whale-float">
                    <img src="/whales/blue-whale.png" alt="고래" className="w-full h-full object-contain" loading="lazy" />
                  </div>
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
                    {displayName}님, 다시 바다에 오셨군요!
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-white/40 text-white/80 align-middle">BETA</span>
                  </h1>
                  <p className="text-blue-100 text-sm md:text-base mt-1">
                    오늘도 시장의 바다를 유영해볼까요?
                  </p>
                </div>
              </div>

              {isVirt && portfolio && (
                <div className="flex items-center gap-4 md:gap-6">
                  <div className="text-center">
                    <div className="text-xs md:text-sm text-blue-200 mb-1">총 자산</div>
                    <div className="text-lg md:text-2xl font-bold">
                      {formatCurrency(portfolio.totalValue)}
                    </div>
                  </div>
                  <div className="h-10 md:h-12 w-px bg-white bg-opacity-20"></div>
                  <div className="text-center">
                    <div className="text-xs md:text-sm text-blue-200 mb-1">수익률</div>
                    <div className={`text-lg md:text-2xl font-bold ${
                      portfolio.returnRate >= 0 ? 'text-red-400' : 'text-blue-400'
                    }`}>
                      {portfolio.returnRate >= 0 ? '▲ +' : '▼ '}
                      {portfolio.returnRate.toFixed(2)}%
                    </div>
                  </div>
                </div>
              )}
              {!isVirt && (() => {
                const realTotal = (kisPortfolio?.totalValue || 0) + (upbitPortfolio?.totalValue || 0) + (bitgetPortfolio?.totalValue || 0);
                const realPnl = (kisPortfolio?.totalPnl || 0) + (upbitPortfolio?.totalPnl || 0) + (bitgetPortfolio?.totalPnl || 0);
                const invested = realTotal - realPnl;
                const _realReturn = invested !== 0 ? (realPnl / invested) * 100 : 0; void _realReturn;
                if (realTotal === 0) return null;
                return (
                  <div className="flex items-center gap-4 md:gap-6">
                    <div className="text-center">
                      <div className="text-xs md:text-sm text-blue-200 mb-1">실계좌 총 자산</div>
                      <div className="text-lg md:text-2xl font-bold">
                        {formatCurrency(realTotal)}
                      </div>
                    </div>
                    <div className="h-10 md:h-12 w-px bg-white bg-opacity-20"></div>
                    <div className="text-center">
                      <div className="text-xs md:text-sm text-blue-200 mb-1">총 손익</div>
                      <div className={`text-lg md:text-2xl font-bold ${realPnl >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                        {realPnl >= 0 ? '+' : ''}{formatCurrency(Math.round(realPnl))}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* ═══ 일반 모드: 실계좌 자산 ═══ */}
        {!isVirt && (
          <div data-tour="normal-api-panel" className="mb-8 space-y-5">

            {/* 서비스 탭 */}
            <div className="flex items-center gap-2">
              {([
                { key: 'kis' as const, label: '주식', sub: 'KIS', connected: kisCredInfo?.connected },
                { key: 'upbit' as const, label: '코인', sub: 'Upbit', connected: upbitCredInfo?.connected },
                { key: 'bitget' as const, label: '코인', sub: 'Bitget', connected: bitgetCredInfo?.connected },
              ]).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setApiTab(t.key)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                    apiTab === t.key
                      ? 'bg-white/10 text-white border-cyan-500/40'
                      : 'bg-white/[0.03] text-slate-500 border-white/[0.06] hover:text-slate-300'
                  }`}
                >
                  {t.label} <span className="text-[10px] text-slate-600">{t.sub}</span>
                  {t.connected && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
                </button>
              ))}
            </div>

            {/* 지표 카드 + 보유 종목 */}
            {(() => {
              const ap = apiTab === 'kis' ? kisPortfolio : apiTab === 'upbit' ? upbitPortfolio : bitgetPortfolio;
              const isConn = apiTab === 'kis' ? kisCredInfo?.connected : apiTab === 'upbit' ? upbitCredInfo?.connected : bitgetCredInfo?.connected;
              const sign = (v: number) => (v > 0 ? '+' : '');
              const rc = (v: number) => (v > 0 ? 'text-red-500' : v < 0 ? 'text-blue-500' : 'text-gray-400');

              if (realAssetLoading) return (
                <div className="card text-center py-16">
                  <div className="w-12 h-12 border-[3px] border-gray-100 border-t-whale-light rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-gray-400 text-sm">실계좌 자산을 불러오는 중...</p>
                </div>
              );

              if (isConn && ap) return (
                <>
                  {/* 총 자산 히어로 */}
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                    <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 p-6 border-b border-white/[0.06]">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-white/60 text-sm font-medium">
                            {apiTab === 'kis' ? 'KIS 주식 계좌' : apiTab === 'upbit' ? '업비트 계좌' : '비트겟 계좌'}
                          </span>
                          <span className="px-1.5 py-0.5 text-[9px] font-bold bg-white/20 text-white rounded">LIVE</span>
                        </div>
                        <button onClick={() => loadApiStatus()} className="text-white/50 hover:text-white text-xs transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        </button>
                      </div>
                      <div className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                        {formatCurrency(ap.totalValue)}
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <span className={`text-sm font-bold ${ap.totalPnl >= 0 ? 'text-red-300' : 'text-blue-300'}`}>
                          {sign(ap.totalPnl)}{formatCurrency(Math.round(ap.totalPnl))}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          ap.returnRate >= 0 ? 'bg-red-400/20 text-red-200' : 'bg-blue-400/20 text-blue-200'
                        }`}>
                          {ap.returnRate >= 0 ? '▲ ' : '▼ '}{sign(ap.returnRate)}{ap.returnRate.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 divide-x divide-white/[0.06]">
                      <div className="p-4 text-center">
                        <div className="text-[11px] text-slate-500 mb-1">보유 평가</div>
                        <div className="text-base font-bold text-white">{formatCurrency(ap.totalValue - ap.cashBalance)}</div>
                      </div>
                      <div className="p-4 text-center">
                        <div className="text-[11px] text-slate-500 mb-1">{apiTab === 'kis' ? '예수금' : apiTab === 'upbit' ? 'KRW 잔고' : 'USDT'}</div>
                        <div className="text-base font-bold text-white">{formatCurrency(ap.cashBalance)}</div>
                      </div>
                      <div className="p-4 text-center">
                        <div className="text-[11px] text-slate-500 mb-1">보유 종목</div>
                        <div className="text-base font-bold text-white">{ap.holdings.length}개</div>
                      </div>
                    </div>
                  </div>

                  {/* 메인 콘텐츠: 12컬럼 그리드 */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    {/* 왼쪽: 보유 종목 (8/12) */}
                    <div className="lg:col-span-8">
                      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
                          <span className="text-sm font-semibold text-cyan-400">
                            보유 {apiTab === 'kis' ? '종목' : '코인'} ({ap.holdings.length})
                          </span>
                          {ap.holdings.length > 0 && (
                            <span className="text-sm text-slate-400">
                              평가금액 <span className="font-bold text-white">{formatCurrency(ap.totalValue - ap.cashBalance)}</span>
                            </span>
                          )}
                        </div>
                        {ap.holdings.length === 0 ? (
                          <div className="text-center py-16 text-slate-500"><p>보유 종목이 없습니다</p></div>
                        ) : (
                          <div className="p-5">
                            <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[11px] font-medium text-slate-600 border-b border-white/[0.04] mb-1">
                              <div className="col-span-4">종목</div>
                              <div className="col-span-2 text-right">수량</div>
                              <div className="col-span-3 text-right">평가금액</div>
                              <div className="col-span-3 text-right">수익률</div>
                            </div>
                            {ap.holdings.map((h) => (
                              <div key={h.stockCode} className="grid grid-cols-12 gap-2 px-3 py-3 rounded-lg hover:bg-white/[0.03] transition-colors">
                                <div className="col-span-4">
                                  <div className="font-semibold text-sm text-white">{h.stockName}</div>
                                  <div className="text-[11px] text-slate-600">{h.stockCode}</div>
                                </div>
                                <div className="col-span-2 text-right self-center text-sm text-slate-300">
                                  {apiTab === 'kis' ? `${h.quantity.toLocaleString()}주` : formatQuantity(h.quantity)}
                                </div>
                                <div className="col-span-3 text-right self-center text-sm font-medium text-white">{formatCurrency(h.marketValue)}</div>
                                <div className="col-span-3 text-right self-center">
                                  <div className={`text-sm font-bold ${rc(h.returnRate)}`}>{h.returnRate >= 0 ? '▲ ' : '▼ '}{sign(h.returnRate)}{h.returnRate.toFixed(2)}%</div>
                                  <div className={`text-[11px] ${rc(h.profitLoss)}`}>{sign(h.profitLoss)}{formatCurrency(Math.round(h.profitLoss))}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 오른쪽: 사이드바 (4/12) */}
                    <div className="lg:col-span-4 space-y-5">
                      {/* 자산 배분 차트 */}
                      {ap.holdings.length > 0 && (
                        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                          <h3 className="text-sm font-bold text-white mb-3">자산 배분</h3>
                          <div className="w-full h-44 mb-3">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={[
                                    ...(ap.cashBalance > 0 ? [{ name: apiTab === 'kis' ? '예수금' : 'KRW', value: ap.cashBalance, color: '#475569' }] : []),
                                    ...ap.holdings.map((h, i) => ({ name: h.stockName, value: h.marketValue, color: CHART_COLORS[i % CHART_COLORS.length] })),
                                  ]}
                                  dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2} stroke="none"
                                >
                                  {[
                                    ...(ap.cashBalance > 0 ? [{ color: '#475569' }] : []),
                                    ...ap.holdings.map((_, i) => ({ color: CHART_COLORS[i % CHART_COLORS.length] })),
                                  ].map((e, i) => <Cell key={i} fill={e.color} />)}
                                </Pie>
                                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', fontSize: '12px', color: '#e2e8f0' }} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="space-y-1.5">
                            {ap.holdings.map((h, i) => (
                              <div key={h.stockCode} className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                                <span className="text-xs text-slate-400 flex-1 truncate">{h.stockName}</span>
                                <span className="text-xs text-slate-300">{formatCurrency(h.marketValue)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 투자 요약 */}
                      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                        <h3 className="text-sm font-bold text-white mb-3">투자 요약</h3>
                        <div className="space-y-2.5 text-sm">
                          <div className="flex justify-between"><span className="text-slate-500">{apiTab === 'kis' ? '예수금' : apiTab === 'upbit' ? 'KRW' : 'USDT'}</span><span className="text-white">{formatCurrency(ap.cashBalance)}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">보유 평가</span><span className="text-white">{formatCurrency(ap.totalValue - ap.cashBalance)}</span></div>
                          <div className="border-t border-white/[0.06] pt-2.5">
                            <div className="flex justify-between"><span className="text-slate-400 font-medium">총 자산</span><span className="font-bold text-white">{formatCurrency(ap.totalValue)}</span></div>
                            <div className="flex justify-between mt-1.5">
                              <span className="text-slate-500">총 손익</span>
                              <span className={`font-bold ${rc(ap.totalPnl)}`}>
                                {sign(ap.totalPnl)}{formatCurrency(Math.round(ap.totalPnl))}
                                <span className="text-xs font-normal ml-1">({ap.returnRate >= 0 ? '▲ ' : '▼ '}{sign(ap.returnRate)}{ap.returnRate.toFixed(2)}%)</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 연결 정보 */}
                      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                        <h3 className="text-sm font-bold text-white mb-3">연결 정보</h3>
                        <div className="text-sm text-slate-400 space-y-1.5">
                          {apiTab === 'kis' && kisCredInfo && (
                            <>
                              <div className="flex justify-between"><span>API Key</span><span className="font-mono text-xs text-slate-300">{(kisCredInfo as any)?.appkey || '-'}</span></div>
                              <div className="flex justify-between"><span>계좌</span><span className="font-mono text-xs text-slate-300">{(kisCredInfo as any)?.accountNumber || '-'}</span></div>
                            </>
                          )}
                          {apiTab === 'upbit' && upbitCredInfo && (
                            <div className="flex justify-between"><span>Access Key</span><span className="font-mono text-xs text-slate-300">{(upbitCredInfo as any)?.accessKey || '-'}</span></div>
                          )}
                          {apiTab === 'bitget' && bitgetCredInfo && (
                            <div className="flex justify-between"><span>API Key</span><span className="font-mono text-xs text-slate-300">{(bitgetCredInfo as any)?.apiKey || '-'}</span></div>
                          )}
                        </div>
                        <button onClick={handleApiDisconnect} className="w-full mt-3 px-3 py-2 text-xs text-red-400/70 border border-red-500/20 rounded-lg hover:bg-red-500/10 hover:text-red-400 transition-colors">
                          연결 해제
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              );

              if (!isConn) return (
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-8 text-center">
                  <p className="text-slate-400 mb-4">
                    {apiTab === 'kis' ? 'KIS API 키를 등록하면 보유 종목과 잔고를 확인할 수 있습니다'
                      : apiTab === 'upbit' ? '업비트 API 키를 등록하면 코인 보유 현황을 확인할 수 있습니다'
                      : '비트겟 API 키를 등록하면 코인 보유 현황을 확인할 수 있습니다'}
                  </p>
                  <button
                    onClick={() => setApiPanelOpen(true)}
                    className="px-6 py-2.5 bg-cyan-500/10 text-cyan-400 font-semibold text-sm rounded-lg border border-cyan-500/30 hover:bg-cyan-500/20 transition-colors"
                  >
                    API 키 등록하기
                  </button>
                </div>
              );

              return null;
            })()}

            {/* Virt 안내 배너 */}
            <button
              onClick={() => navigate('/virt/dashboard')}
              className="w-full text-left px-5 py-4 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.04] hover:bg-cyan-500/[0.08] transition-colors group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-cyan-400">VIRT 가상 투자</span>
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-cyan-500/20 text-cyan-300 rounded-full border border-cyan-500/30">체험하기</span>
                </div>
                <svg className="w-4 h-4 text-slate-600 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </div>
              <p className="text-xs text-slate-500 mt-1.5">가상돈 1,000만원으로 주식·코인 매매 체험 · 전략 백테스팅 · 자동 매매</p>
            </button>
          </div>
        )}

        {/* API 설정 모달 */}
        {!isVirt && apiPanelOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-[#0c1a2e] border border-white/10 rounded-2xl shadow-2xl max-w-lg w-full">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold text-white">
                    {apiTab === 'kis' ? 'KIS API 연결' : apiTab === 'upbit' ? '업비트 API 연결' : '비트겟 API 연결'}
                  </h2>
                  <button onClick={() => { setApiPanelOpen(false); setApiError(null); setApiSuccess(null); }} className="text-slate-500 hover:text-white">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                {/* 탭 */}
                <div className="flex gap-1.5 mb-5">
                  {([
                    { key: 'kis' as const, label: 'KIS 한투' },
                    { key: 'upbit' as const, label: '업비트' },
                    { key: 'bitget' as const, label: '비트겟' },
                  ]).map((t) => (
                    <button key={t.key} onClick={() => { setApiTab(t.key); setApiForm({}); setApiError(null); setApiSuccess(null); }}
                      className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${apiTab === t.key ? 'bg-white/10 text-white' : 'bg-white/[0.03] text-slate-500 hover:text-slate-300'}`}
                    >{t.label}</button>
                  ))}
                </div>
                {/* API 키 발급 가이드 */}
                <details className="mb-4 rounded-lg bg-cyan-500/[0.06] border border-cyan-500/15 overflow-hidden">
                  <summary className="px-4 py-2.5 text-xs font-semibold text-cyan-400 cursor-pointer hover:bg-cyan-500/[0.04] transition-colors flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {apiTab === 'kis' ? 'KIS API 키 발급 방법' : apiTab === 'upbit' ? '업비트 API 키 발급 방법' : '비트겟 API 키 발급 방법'}
                  </summary>
                  <div className="px-4 pb-3 text-[11px] text-slate-400 leading-relaxed space-y-1.5">
                    {apiTab === 'kis' && (
                      <>
                        <p><span className="text-slate-300 font-medium">1.</span> 한국투자증권 홈페이지 접속 후 로그인</p>
                        <p><span className="text-slate-300 font-medium">2.</span> KIS Developers → API 신청/관리 메뉴 이동</p>
                        <p><span className="text-slate-300 font-medium">3.</span> 앱 등록 → <span className="text-cyan-400">App Key / App Secret</span> 발급</p>
                        <p><span className="text-slate-300 font-medium">4.</span> 권한 설정 시 <span className="text-amber-400 font-medium">"조회" 권한만</span> 선택</p>
                        <p><span className="text-slate-300 font-medium">5.</span> 계좌번호는 앞 8자리만 입력 (뒤 2자리 제외)</p>
                      </>
                    )}
                    {apiTab === 'upbit' && (
                      <>
                        <p><span className="text-slate-300 font-medium">1.</span> 업비트 로그인 → 마이페이지 → Open API 관리</p>
                        <p><span className="text-slate-300 font-medium">2.</span> Open API Key 발급하기 클릭</p>
                        <p><span className="text-slate-300 font-medium">3.</span> <span className="text-amber-400 font-medium">"자산조회"만 체크</span>, "주문하기"는 반드시 해제</p>
                        <p><span className="text-slate-300 font-medium">4.</span> IP 주소 등록 (서버 IP 입력 필요)</p>
                        <p><span className="text-slate-300 font-medium">5.</span> 발급된 <span className="text-cyan-400">Access Key / Secret Key</span> 입력</p>
                      </>
                    )}
                    {apiTab === 'bitget' && (
                      <>
                        <p><span className="text-slate-300 font-medium">1.</span> 비트겟 로그인 → 프로필 → API Management</p>
                        <p><span className="text-slate-300 font-medium">2.</span> Create API Key 클릭</p>
                        <p><span className="text-slate-300 font-medium">3.</span> 권한을 <span className="text-amber-400 font-medium">"Read Only"</span>로 설정</p>
                        <p><span className="text-slate-300 font-medium">4.</span> IP 허용 목록 설정 (선택)</p>
                        <p><span className="text-slate-300 font-medium">5.</span> 발급된 <span className="text-cyan-400">API Key / Secret Key / Passphrase</span> 입력</p>
                      </>
                    )}
                  </div>
                </details>

                <div className="space-y-3">
                  {apiTab === 'kis' && (
                    <>
                      <input placeholder="App Key" value={apiForm.appkey || ''} onChange={(e) => setApiForm({ ...apiForm, appkey: e.target.value })} className="w-full px-4 py-3 text-sm rounded-lg bg-white/[0.04] border border-white/10 text-white placeholder-slate-600 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 outline-none" />
                      <input placeholder="App Secret" type="password" value={apiForm.appsecret || ''} onChange={(e) => setApiForm({ ...apiForm, appsecret: e.target.value })} className="w-full px-4 py-3 text-sm rounded-lg bg-white/[0.04] border border-white/10 text-white placeholder-slate-600 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 outline-none" />
                      <input placeholder="계좌번호 (8자리)" value={apiForm.accountNumber || ''} onChange={(e) => setApiForm({ ...apiForm, accountNumber: e.target.value })} className="w-full px-4 py-3 text-sm rounded-lg bg-white/[0.04] border border-white/10 text-white placeholder-slate-600 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 outline-none" />
                    </>
                  )}
                  {apiTab === 'upbit' && (
                    <>
                      <input placeholder="Access Key" value={apiForm.accessKey || ''} onChange={(e) => setApiForm({ ...apiForm, accessKey: e.target.value })} className="w-full px-4 py-3 text-sm rounded-lg bg-white/[0.04] border border-white/10 text-white placeholder-slate-600 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 outline-none" />
                      <input placeholder="Secret Key" type="password" value={apiForm.secretKey || ''} onChange={(e) => setApiForm({ ...apiForm, secretKey: e.target.value })} className="w-full px-4 py-3 text-sm rounded-lg bg-white/[0.04] border border-white/10 text-white placeholder-slate-600 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 outline-none" />
                    </>
                  )}
                  {apiTab === 'bitget' && (
                    <>
                      <input placeholder="API Key" value={apiForm.apiKey || ''} onChange={(e) => setApiForm({ ...apiForm, apiKey: e.target.value })} className="w-full px-4 py-3 text-sm rounded-lg bg-white/[0.04] border border-white/10 text-white placeholder-slate-600 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 outline-none" />
                      <input placeholder="Secret Key" type="password" value={apiForm.secretKey || ''} onChange={(e) => setApiForm({ ...apiForm, secretKey: e.target.value })} className="w-full px-4 py-3 text-sm rounded-lg bg-white/[0.04] border border-white/10 text-white placeholder-slate-600 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 outline-none" />
                      <input placeholder="Passphrase" type="password" value={apiForm.passphrase || ''} onChange={(e) => setApiForm({ ...apiForm, passphrase: e.target.value })} className="w-full px-4 py-3 text-sm rounded-lg bg-white/[0.04] border border-white/10 text-white placeholder-slate-600 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 outline-none" />
                    </>
                  )}
                  {apiError && <p className="text-xs text-red-400">{apiError}</p>}
                  {apiSuccess && <p className="text-xs text-emerald-400">{apiSuccess}</p>}
                  <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-3.5 py-3 space-y-2.5">
                    <div className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-cyan-500/60 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      <div className="text-[11px] text-slate-500 leading-relaxed">
                        <p className="text-slate-400 font-semibold mb-1">보안 안내</p>
                        <p>WhaleArc는 <span className="text-slate-400">자산 조회만</span> 수행하며, 어떠한 주문·출금도 실행하지 않습니다. API 키는 AES 암호화되어 저장됩니다.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-amber-500/60 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="text-[11px] text-slate-500 leading-relaxed">
                        <p className="text-amber-400/80 font-semibold mb-1">반드시 읽기 전용 키를 발급해주세요</p>
                        <p>
                          {apiTab === 'kis' && 'KIS 개발자센터에서 API 키 발급 시 "조회" 권한만 선택해주세요.'}
                          {apiTab === 'upbit' && '업비트 Open API에서 "자산조회"만 체크하고, "주문하기"는 반드시 체크 해제해주세요.'}
                          {apiTab === 'bitget' && '비트겟 API 관리에서 "Read Only" 권한으로 발급해주세요.'}
                          {' '}읽기 전용 키는 유출되더라도 자산에 영향을 줄 수 없습니다.
                        </p>
                      </div>
                    </div>
                  </div>
                  <button onClick={handleApiSave} disabled={apiSaving}
                    className="w-full py-3 bg-cyan-500 text-white text-sm font-semibold rounded-lg hover:bg-cyan-600 disabled:opacity-50 transition-colors">
                    {apiSaving ? '연결 중...' : 'API 연결'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 일반 모드 가이드 투어 버튼 */}
        {!isVirt && (
          <button
            onClick={() => setShowNormalTour(true)}
            className="mb-4 w-full flex items-center justify-center gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.04] px-4 py-3 text-sm text-cyan-400 hover:bg-cyan-500/[0.08] transition-colors"
          >
            <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs font-bold">?</span>
            <span className="font-medium">처음이신가요? 화면 가이드 받기</span>
          </button>
        )}

        {/* 일반 모드 가이드 투어 */}
        <GuideTour steps={normalTourSteps} isActive={showNormalTour} onFinish={() => setShowNormalTour(false)} />

        {/* Virt 가이드 투어 버튼 */}
        {isVirt && (
          <button
            onClick={() => setShowVirtTour(true)}
            className="mb-4 w-full flex items-center justify-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700 hover:bg-amber-100 transition-colors"
          >
            <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-700 flex items-center justify-center text-xs font-bold">?</span>
            <span className="font-medium">처음이신가요? 화면 가이드 받기</span>
          </button>
        )}

        {/* Virt 가이드 투어 */}
        <GuideTour steps={virtTourSteps} isActive={showVirtTour} onFinish={() => setShowVirtTour(false)} />

        {/* 샘플 데이터 안내 - Virt 모드만 */}
        {isVirt && isDemo && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-700">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
            </svg>
            <span>샘플 데이터입니다. 거래를 시작하면 실제 데이터가 표시됩니다.</span>
          </div>
        )}

        {/* ═══ Virt 모드: 카드 섹션 ═══ */}
        {isVirt && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* ── 좌측: 메인 콘텐츠 (8/12) ── */}
            <div className="lg:col-span-8 space-y-6">
              {/* 포트폴리오 요약 카드 */}
              {portfolio && (
                <div
                  data-tour="virt-portfolio"
                  className="card card-hover cursor-pointer group"
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
                        portfolio.returnRate >= 0 ? 'text-red-500' : 'text-blue-500'
                      }`}>
                        {portfolio.returnRate >= 0 ? '▲ +' : '▼ '}
                        {portfolio.returnRate.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                  {/* 목표 수익률 */}
                  {(() => {
                    const progress = targetReturn > 0 ? Math.min(Math.max(portfolio.returnRate / targetReturn * 100, 0), 100) : 0;
                    const achieved = portfolio.returnRate >= targetReturn;
                    return (
                      <div data-tour="virt-target-return" className="mt-4 pt-4 border-t border-gray-100" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-gray-500">목표 수익률</span>
                          <div className="flex items-center gap-1">
                            {editingTarget ? (
                              <>
                                <input
                                  type="number"
                                  value={targetInput}
                                  onChange={e => setTargetInput(e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter') handleTargetSave(); if (e.key === 'Escape') { setEditingTarget(false); setTargetInput(String(targetReturn)); } }}
                                  onBlur={handleTargetSave}
                                  className="w-14 px-1.5 py-0.5 text-xs border border-gray-300 rounded text-right focus:outline-none focus:ring-1 focus:ring-whale-light"
                                  autoFocus min="0.1" step="0.1"
                                />
                                <span className="text-xs text-gray-400">%</span>
                              </>
                            ) : (
                              <button
                                onClick={() => { setEditingTarget(true); setTargetInput(String(targetReturn)); }}
                                className="text-xs text-whale-light hover:text-whale-accent font-medium flex items-center gap-0.5"
                              >
                                {targetReturn}%
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${achieved ? 'bg-gradient-to-r from-whale-light to-whale-accent' : 'bg-gradient-to-r from-whale-light to-blue-400'}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-[10px] text-gray-400">
                            {portfolio.returnRate >= 0 ? '+' : ''}{portfolio.returnRate.toFixed(2)}% / {targetReturn}%
                          </span>
                          {achieved && (
                            <span className="text-[10px] font-bold text-whale-light">
                              목표 달성!
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* 보유 종목 카드 */}
              {portfolio && portfolio.holdings.length > 0 && (
                <div data-tour="virt-holdings" className="card">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-whale-dark">보유 종목</h2>
                    <button
                      onClick={() => navigate('/my-portfolio')}
                      className="text-sm text-whale-light hover:text-whale-accent font-medium"
                    >
                      전체 보기
                    </button>
                  </div>
                  {/* 주식 섹션 */}
                  {(() => {
                    const stockHoldings = portfolio.holdings.filter(h => h.assetType === 'STOCK');
                    return stockHoldings.length > 0 ? (
                      <div className="mb-4">
                        <div className="flex items-center gap-1.5 mb-2">
                          <img src="/whales/spotted-dolphin.png" alt="주식" className="w-5 h-5 object-contain" loading="lazy" />
                          <span className="text-sm font-bold text-indigo-600">주식</span>
                          <span className="text-xs text-gray-400">{stockHoldings.length}종목</span>
                        </div>
                        <div className="space-y-2">
                          {stockHoldings.slice(0, 5).map((holding) => (
                            <div key={holding.stockCode} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-sm text-gray-800">{holding.stockName}</span>
                                  {(() => {
                                    const route = activePurchases.find((p) => p.purchasedAssets?.some(a => a.code === holding.stockCode));
                                    return route ? (
                                      <span className="px-1 py-0.5 text-[9px] font-semibold bg-whale-light/10 text-whale-light rounded">
                                        {route.productName}
                                      </span>
                                    ) : null;
                                  })()}
                                </div>
                                <div className="text-xs text-gray-400">{Math.floor(holding.quantity)}주 보유</div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-semibold text-gray-800">{formatCurrency(holding.marketValue)}</div>
                                <div className={`text-xs font-semibold ${holding.returnRate >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                                  {holding.returnRate >= 0 ? '▲ +' : '▼ '}{holding.returnRate.toFixed(2)}%
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
                        <div className="flex items-center gap-1.5 mb-2">
                          <img src="/whales/wild-cat-whale.png" alt="가상화폐" className="w-5 h-5 object-contain" loading="lazy" />
                          <span className="text-sm font-bold text-emerald-600">가상화폐</span>
                          <span className="text-xs text-gray-400">{cryptoHoldings.length}종목</span>
                        </div>
                        <div className="space-y-2">
                          {cryptoHoldings.slice(0, 5).map((holding) => (
                            <div key={holding.stockCode} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-sm text-gray-800">{holding.stockName}</span>
                                  {(() => {
                                    const route = activePurchases.find((p) => p.purchasedAssets?.some(a => a.code === holding.stockCode));
                                    return route ? (
                                      <span className="px-1 py-0.5 text-[9px] font-semibold bg-whale-light/10 text-whale-light rounded">
                                        {route.productName}
                                      </span>
                                    ) : null;
                                  })()}
                                </div>
                                <div className="text-xs text-gray-400">{formatQuantity(holding.quantity)}개 보유</div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-semibold text-gray-800">{formatCurrency(holding.marketValue)}</div>
                                <div className={`text-xs font-semibold ${holding.returnRate >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                                  {holding.returnRate >= 0 ? '▲ +' : '▼ '}{holding.returnRate.toFixed(2)}%
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null;
                  })()}
                </div>
              )}

              {/* 보유 종목이 없을 때 — 첫 항해 안내 */}
              {(!portfolio || portfolio.holdings.length === 0) && (
                <div data-tour="virt-holdings" className="card py-8">
                  <div className="text-center mb-6">
                    <img src="/whales/beluga.png" alt="벨루가" className="w-14 h-14 object-contain mx-auto mb-3" loading="lazy" />
                    <h3 className="text-lg font-bold text-whale-dark mb-1">첫 항해를 시작해볼까요?</h3>
                    <p className="text-sm text-gray-400">가상 자금 1,000만원으로 부담 없이 체험해보세요</p>
                  </div>
                  <div className="space-y-2.5 max-w-sm mx-auto">
                    <button
                      onClick={() => navigate('/trade?code=005930&type=STOCK')}
                      className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-blue-100 bg-blue-50/50 hover:bg-blue-50 transition-colors text-left group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <img src="/whales/spotted-dolphin.png" alt="" className="w-6 h-6 object-contain" loading="lazy" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-whale-dark">삼성전자 1주 사보기</div>
                        <div className="text-xs text-gray-400">국내 대표 주식으로 첫 매수 체험</div>
                      </div>
                      <svg className="w-4 h-4 text-gray-300 group-hover:text-whale-light group-hover:translate-x-0.5 transition-all flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                    <button
                      onClick={() => navigate('/trade?code=BTC&type=CRYPTO')}
                      className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-amber-100 bg-amber-50/50 hover:bg-amber-50 transition-colors text-left group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <img src="/whales/wild-cat-whale.png" alt="" className="w-6 h-6 object-contain" loading="lazy" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-whale-dark">비트코인 소량 사보기</div>
                        <div className="text-xs text-gray-400">가상화폐 매수를 체험해보세요</div>
                      </div>
                      <svg className="w-4 h-4 text-gray-300 group-hover:text-whale-light group-hover:translate-x-0.5 transition-all flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                    <button
                      onClick={() => navigate('/store')}
                      className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-purple-100 bg-purple-50/50 hover:bg-purple-50 transition-colors text-left group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                        <img src="/whales/narwhal.png" alt="" className="w-6 h-6 object-contain" loading="lazy" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-whale-dark">전략으로 자동 매매 시작</div>
                        <div className="text-xs text-gray-400">검증된 퀀트 전략이 대신 매매해줍니다</div>
                      </div>
                      <svg className="w-4 h-4 text-gray-300 group-hover:text-whale-light group-hover:translate-x-0.5 transition-all flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                  </div>
                </div>
              )}

              {/* 관심 종목 카드 */}
              <div data-tour="virt-watchlist">
                {/* 관심 종목 */}
                <div className="card">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-bold text-whale-dark">관심 종목</h2>
                    <button
                      onClick={() => navigate('/user')}
                      className="text-sm font-medium text-whale-light hover:text-whale-accent"
                    >
                      종목 편집
                    </button>
                  </div>
                  {liveWatchlist.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {liveWatchlist.map((stock) => (
                        <div
                          key={stock.stockCode}
                          className="flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all border border-gray-100 hover:border-whale-light/40 hover:shadow-sm"
                          onClick={() => navigate(`/trade?code=${stock.stockCode}&type=${stock.assetType || 'CRYPTO'}`)}
                        >
                          <div>
                            <div className="font-semibold text-sm text-gray-800">{stock.stockName}</div>
                            <div className="text-xs text-gray-400">{stock.stockCode}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold text-gray-800">{formatCurrency(stock.currentPrice)}</div>
                            <div className={`text-xs font-semibold ${
                              stock.changeRate >= 0 ? 'text-red-500' : 'text-blue-500'
                            }`}>
                              {stock.changeRate >= 0 ? '▲ +' : '▼ '}{stock.changeRate.toFixed(2)}%
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <img src="/whales/beluga.png" alt="벨루가" className="w-16 h-16 object-contain mx-auto mb-3" loading="lazy" />
                      <div className="font-medium text-gray-500">관심 종목이 없습니다</div>
                      <div className="text-sm mt-1 text-gray-400">
                        프로필에서 관심 종목을 추가하면 여기에 실시간 시세가 표시됩니다
                      </div>
                      <button
                        onClick={() => navigate('/user')}
                        className="mt-4 text-sm btn-secondary"
                      >
                        관심 종목 추가하기
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── 우측: 사이드바 (4/12) ── */}
            <div className="lg:col-span-4 space-y-6">
              {/* 투자 요약 카드 */}
              {portfolio && (
                <div className="card">
                  <h2 className="text-lg font-bold text-whale-dark mb-4">투자 요약</h2>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">현금</span>
                      <span className="text-sm font-bold text-whale-dark">{formatCurrency(portfolio.cashBalance)}</span>
                    </div>
                    <div className="h-px bg-gray-100" />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">보유 종목 평가</span>
                      <span className="text-sm font-bold text-whale-dark">{formatCurrency(portfolio.totalValue - portfolio.cashBalance)}</span>
                    </div>
                    <div className="h-px bg-gray-100" />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">총 자산</span>
                      <span className="text-sm font-bold text-whale-dark">{formatCurrency(portfolio.totalValue)}</span>
                    </div>
                    <div className="h-px bg-gray-100" />
                    {(() => {
                      const initial = portfolio.initialCash || 10_000_000;
                      const pnl = portfolio.totalValue - initial;
                      return (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-500">총 손익</span>
                          <span className={`text-sm font-bold ${pnl >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                            {pnl >= 0 ? '+' : ''}{formatCurrency(Math.round(pnl))}
                            <span className="text-xs font-normal ml-1">({portfolio.returnRate >= 0 ? '+' : ''}{portfolio.returnRate.toFixed(2)}%)</span>
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* 항해 중인 항로 */}
              <div data-tour="virt-routes" className="card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-whale-dark">항해 중인 항로</h2>
                  <button onClick={() => navigate('/store')} className="text-sm text-whale-light hover:text-whale-accent font-medium">
                    전략 학습
                  </button>
                </div>
                {activePurchases.length > 0 ? (
                  <div className="space-y-3">
                    {activePurchases.map((p) => (
                      <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                        <div>
                          <div className="font-semibold text-sm text-gray-800">{p.productName}</div>
                          <div className="text-xs text-gray-400">
                            투자: {formatCurrency(p.investmentAmount)} · {p.purchasedAssets?.map(a => cryptoDisplayName(a.code)).join(', ')}
                          </div>
                        </div>
                        <span className="shrink-0 px-2 py-1 text-[10px] font-semibold bg-green-50 text-green-600 rounded-full whitespace-nowrap">운항중</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <div className="text-sm text-gray-400">아직 적용 중인 전략이 없습니다</div>
                    <button
                      onClick={() => navigate('/store')}
                      className="mt-2 text-sm text-whale-light hover:text-whale-accent font-medium"
                    >
                      전략 둘러보기
                    </button>
                  </div>
                )}
              </div>

              {/* 빠른 액션 카드 */}
              <div data-tour="virt-actions" className="card !p-5">
                <h2 className="text-lg font-bold mb-3 text-whale-dark">빠른 액션</h2>
                <div className="space-y-2">
                  <button
                    onClick={() => navigate('/trade')}
                    className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg bg-gradient-to-r from-whale-light to-whale-accent text-white font-semibold text-sm shadow-sm hover:shadow-md hover:opacity-95 transition-all min-h-[44px] border border-transparent"
                  >
                    거래하기
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                  {[
                    { path: '/store', label: '항로 둘러보기' },
                    { path: '/strategy', label: '전략 분석' },
                  ].map((item) => (
                    <button
                      key={item.path}
                      onClick={() => navigate(item.path)}
                      className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-semibold transition-all min-h-[44px] bg-white border border-gray-200 text-whale-dark hover:border-whale-light/40 hover:bg-gray-50"
                    >
                      {item.label}
                      <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      if (!portfolio) return;
                      const rows = [['종목코드','종목명','수량','평균단가','현재가','평가금액','수익률']];
                      portfolio.holdings.forEach(h => rows.push([h.stockCode, h.stockName, String(h.quantity), String(h.averagePrice), String(h.currentPrice), String(h.marketValue), h.returnRate.toFixed(2) + '%']));
                      const csv = rows.map(r => r.join(',')).join('\n');
                      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url; a.download = `whalearc_portfolio_${new Date().toISOString().slice(0,10)}.csv`;
                      a.click(); URL.revokeObjectURL(url);
                    }}
                    className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-semibold transition-all min-h-[44px] bg-white border border-gray-200 text-whale-dark hover:border-whale-light/40 hover:bg-gray-50"
                  >
                    CSV 내보내기
                    <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('포트폴리오를 초기화하고 새로운 항해를 시작하시겠습니까?\n현금 1,000만원으로 리셋됩니다.')) {
                        tradeService.resetPortfolio().then(() => { loadData(); }).catch(() => {});
                      }
                    }}
                    className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-semibold transition-all min-h-[44px] bg-white border border-red-200 text-red-500 hover:border-red-300 hover:bg-red-50"
                  >
                    새 항해 시작
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  </button>
                </div>
              </div>

              {/* 깊은 바다로 — WhaleArc 전환 배너 */}
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="w-full text-left px-5 py-4 rounded-xl border border-whale-light/30 bg-gradient-to-r from-whale-dark/[0.08] to-whale-light/[0.10] hover:from-whale-dark/[0.14] hover:to-whale-light/[0.16] transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-whale-dark">더 깊은 바다로</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-whale-light/15 text-whale-light rounded-full border border-whale-light/30">WhaleArc</span>
                  </div>
                  <svg className="w-4 h-4 text-whale-light/40 group-hover:text-whale-light group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </div>
                <p className="text-xs text-gray-500 mt-1.5">실계좌 자산 연동 · 포트폴리오 관리 · 실전 투자 대시보드</p>
              </button>
            </div>
          </div>
        )}

        {/* ═══ 일반 모드: 관심 종목 + 빠른 액션 ═══ */}
        {!isVirt && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* 관심 종목 */}
          <div className="md:col-span-2 lg:col-span-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">관심 종목</h2>
              <button
                onClick={() => navigate('/user')}
                className="text-sm font-medium text-cyan-400 hover:text-cyan-300"
              >
                종목 편집
              </button>
            </div>
            {liveWatchlist.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {liveWatchlist.map((stock) => (
                  <div
                    key={stock.stockCode}
                    className="flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all border border-white/[0.06] hover:bg-white/[0.04]"
                    onClick={() => navigate(`/trade?code=${stock.stockCode}&type=${stock.assetType || 'CRYPTO'}`)}
                  >
                    <div>
                      <div className="font-semibold text-sm text-white">{stock.stockName}</div>
                      <div className="text-xs text-slate-500">{stock.stockCode}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-white">{formatCurrency(stock.currentPrice)}</div>
                      <div className={`text-xs font-semibold ${
                        stock.changeRate >= 0 ? 'text-red-500' : 'text-blue-500'
                      }`}>
                        {stock.changeRate >= 0 ? '▲ +' : '▼ '}{stock.changeRate.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="font-medium text-slate-400">관심 종목이 없습니다</div>
                <div className="text-sm mt-1 text-slate-500">
                  프로필에서 관심 종목을 추가하면 여기에 실시간 시세가 표시됩니다
                </div>
                <button
                  onClick={() => navigate('/user')}
                  className="mt-4 text-sm px-4 py-2 border border-cyan-500/30 text-cyan-400 rounded-lg hover:bg-cyan-500/10 transition-colors"
                >
                  관심 종목 추가하기
                </button>
              </div>
            )}
          </div>

          {/* 우측 사이드바 */}
          <div className="space-y-6">
            {/* 빠른 액션 */}
            <div data-tour="virt-actions" className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
              <h2 className="text-lg font-bold mb-3 text-white">어디로 항해할까요?</h2>
              <div className="space-y-2">
                {[
                  { path: '/market', label: '시세 확인하기' },
                  { path: '/my-portfolio', label: '내 포트폴리오' },
                  { path: '/strategy', label: '전략 백테스트' },
                  { path: '/store', label: '전략 학습' },
                  { path: '/ranking', label: '투자 현황 보기' },
                ].map((item) => (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-semibold transition-all min-h-[44px] bg-white/[0.03] border border-white/[0.06] text-slate-300 hover:bg-white/[0.06] hover:text-white"
                  >
                    {item.label}
                    <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                ))}

                {/* API 설정 - 일반 모드에서만 표시 */}
                <div className="pt-2 mt-1 border-t border-white/[0.06]">
                  <button
                    onClick={() => { setApiPanelOpen(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-medium hover:bg-cyan-500/15 transition-colors min-h-[44px]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold">API</span>
                      <span className="text-cyan-500/30">|</span>
                      <span className="text-xs text-slate-400">내 자산 연동</span>
                    </div>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        )}

      </div>
    </div>
  );
};

export default DashboardPage;
