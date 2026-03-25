import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import Header from '../components/Header';
import { useAuth } from '../contexts/AuthContext';
import { usePolling } from '../hooks/usePolling';
import {
  virtService,
  type VirtPortfolio,
  type VirtTrade,
  type VirtCredentialInfo,
} from '../services/virtService';

const CHART_COLORS = ['#38bdf8', '#22d3ee', '#818cf8', '#a78bfa', '#34d399', '#f472b6', '#fb923c', '#94a3b8'];

const VirtDashboardPage = () => {
  const navigate = useNavigate();
  const { profileName, user } = useAuth();
  const displayName = profileName || user?.user_metadata?.name || user?.email?.split('@')[0] || '선원';

  // 서비스 탭
  const [serviceTab, setServiceTab] = useState<'stock' | 'upbit' | 'bitget'>('stock');

  // KIS
  const [credInfo, setCredInfo] = useState<VirtCredentialInfo | null>(null);
  const [portfolio, setPortfolio] = useState<VirtPortfolio | null>(null);
  const [trades, setTrades] = useState<VirtTrade[]>([]);

  // 업비트
  const [upbitCredInfo, setUpbitCredInfo] = useState<VirtCredentialInfo | null>(null);
  const [upbitPortfolio, setUpbitPortfolio] = useState<VirtPortfolio | null>(null);

  // 비트겟
  const [bitgetCredInfo, setBitgetCredInfo] = useState<VirtCredentialInfo | null>(null);
  const [bitgetPortfolio, setBitgetPortfolio] = useState<VirtPortfolio | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'holdings' | 'trades'>('holdings');

  // 설정 모달
  const [showSetup, setShowSetup] = useState<false | 'kis' | 'upbit' | 'bitget'>(false);
  const [setupForm, setSetupForm] = useState({ appkey: '', appsecret: '', accountNumber: '', accountProductCode: '01' });
  const [upbitSetupForm, setUpbitSetupForm] = useState({ accessKey: '', secretKey: '' });
  const [bitgetSetupForm, setBitgetSetupForm] = useState({ apiKey: '', secretKey: '', passphrase: '' });
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // 데이터 로드
  const loadData = useCallback(async (silent = false) => {
    try {
      if (!silent) { setLoading(true); setError(null); }
      const [cred, upbitCred, bgCred] = await Promise.all([
        virtService.getCredentialInfo().catch(() => ({ connected: false } as VirtCredentialInfo)),
        virtService.getUpbitCredentialInfo().catch(() => ({ connected: false } as VirtCredentialInfo)),
        virtService.getBitgetCredentialInfo().catch(() => ({ connected: false } as VirtCredentialInfo)),
      ]);
      setCredInfo(cred); setUpbitCredInfo(upbitCred); setBitgetCredInfo(bgCred);

      if (cred.connected === true) {
        const [p, t] = await Promise.all([
          virtService.getPortfolio().catch((e) => { if (!silent) setError(`KIS: ${e.response?.data?.message || e.message}`); return null; }),
          virtService.getTrades(30).catch(() => []),
        ]);
        if (p) setPortfolio(p);
        setTrades(t);
      }
      if (upbitCred.connected === true) {
        const p = await virtService.getUpbitPortfolio().catch(() => null);
        if (p) setUpbitPortfolio(p);
      }
      if (bgCred.connected === true) {
        const p = await virtService.getBitgetPortfolio().catch(() => null);
        if (p) setBitgetPortfolio(p);
      }
    } catch (err: any) {
      if (!silent) setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  usePolling(() => loadData(true), 30000);

  // 핸들러들
  const handleSaveKis = async () => {
    if (!setupForm.appkey || !setupForm.appsecret || !setupForm.accountNumber) { setSetupError('모든 필드를 입력해주세요.'); return; }
    setSetupLoading(true); setSetupError(null); setTestResult(null);
    try {
      await virtService.saveCredential(setupForm);
      const r = await virtService.testConnection();
      setTestResult(r);
      if (r.success) setTimeout(() => { setShowSetup(false); loadData(); }, 1500);
    } catch (e: any) { setSetupError(e.response?.data?.message || e.message); } finally { setSetupLoading(false); }
  };
  const handleSaveUpbit = async () => {
    if (!upbitSetupForm.accessKey || !upbitSetupForm.secretKey) { setSetupError('모든 필드를 입력해주세요.'); return; }
    setSetupLoading(true); setSetupError(null); setTestResult(null);
    try {
      await virtService.saveUpbitCredential(upbitSetupForm);
      const r = await virtService.testUpbitConnection();
      setTestResult(r);
      if (r.success) setTimeout(() => { setShowSetup(false); loadData(); }, 1500);
    } catch (e: any) { setSetupError(e.response?.data?.message || e.message); } finally { setSetupLoading(false); }
  };
  const handleSaveBitget = async () => {
    if (!bitgetSetupForm.apiKey || !bitgetSetupForm.secretKey || !bitgetSetupForm.passphrase) { setSetupError('모든 필드를 입력해주세요.'); return; }
    setSetupLoading(true); setSetupError(null); setTestResult(null);
    try {
      await virtService.saveBitgetCredential(bitgetSetupForm);
      const r = await virtService.testBitgetConnection();
      setTestResult(r);
      if (r.success) setTimeout(() => { setShowSetup(false); loadData(); }, 1500);
    } catch (e: any) { setSetupError(e.response?.data?.message || e.message); } finally { setSetupLoading(false); }
  };
  const handleDisconnect = async (type: 'kis' | 'upbit' | 'bitget') => {
    const labels = { kis: 'KIS', upbit: '업비트', bitget: '비트겟' };
    if (!window.confirm(`${labels[type]} 연결을 해제하시겠습니까?`)) return;
    try {
      if (type === 'kis') { await virtService.deleteCredential(); setCredInfo(null); setPortfolio(null); setTrades([]); }
      else if (type === 'upbit') { await virtService.deleteUpbitCredential(); setUpbitCredInfo(null); setUpbitPortfolio(null); }
      else { await virtService.deleteBitgetCredential(); setBitgetCredInfo(null); setBitgetPortfolio(null); }
    } catch { alert('연결 해제에 실패했습니다.'); }
  };

  // 유틸
  const fmt = (v: number) => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
  const fmtCompact = (v: number) => {
    const abs = Math.abs(v);
    if (abs >= 1_0000_0000) return `${(v / 1_0000_0000).toFixed(2)}억`;
    if (abs >= 1_0000) return `${(v / 1_0000).toFixed(0)}만`;
    return fmt(v);
  };
  const sign = (v: number) => (v > 0 ? '+' : '');
  const rc = (v: number) => (v > 0 ? 'text-red-400' : v < 0 ? 'text-blue-400' : 'text-slate-400');

  const isKis = credInfo?.connected === true;
  const isUpbit = upbitCredInfo?.connected === true;
  const isBitget = bitgetCredInfo?.connected === true;
  const isConnected = serviceTab === 'stock' ? isKis : serviceTab === 'upbit' ? isUpbit : isBitget;
  const activePortfolio = serviceTab === 'stock' ? portfolio : serviceTab === 'upbit' ? upbitPortfolio : bitgetPortfolio;

  // Virt 전용 헤더 (공통)
  const VirtHeader = () => (
    <header className="relative z-50 border-b border-white/[0.06]" style={{ backgroundColor: '#060d18' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          <span className="text-xs">WhaleArc</span>
        </button>
        <div className="flex items-center gap-1.5">
          <img src="/tail-sample-2.png" alt="" className="w-14 h-14 object-contain" />
          <span className="text-sm font-bold tracking-tighter">
            <span className="text-slate-500">WHALEARC</span><span className="text-slate-700">/</span><span className="text-white">VIRT</span>
          </span>
        </div>
        <div className="w-16" />
      </div>
    </header>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060d18]">
        <VirtHeader />
        <div className="flex items-center justify-center h-[85vh]">
          <div className="text-center">
            <div className="relative w-48 h-48 md:w-64 md:h-64 mx-auto mb-6">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-3/4 h-3/4 bg-cyan-500/[0.06] rounded-full blur-[60px] animate-pulse" style={{ animationDuration: '3s' }} />
              </div>
              <img src="/tail-sample-2.png" alt="" className="relative w-full h-full object-contain opacity-50 animate-pulse"
                style={{ filter: 'drop-shadow(0 0 30px rgba(56, 189, 248, 0.15))' }} />
            </div>
            <p className="text-slate-500 text-sm">로딩 중...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !credInfo && !upbitCredInfo && !bitgetCredInfo) {
    return (
      <div className="min-h-screen bg-[#060d18]">
        <VirtHeader />
        <div className="flex items-center justify-center h-[85vh]">
          <div className="text-center max-w-md px-4">
            <div className="relative w-40 h-40 mx-auto mb-6">
              <img src="/tail-sample-2.png" alt="" className="w-full h-full object-contain opacity-30"
                style={{ filter: 'drop-shadow(0 0 20px rgba(56, 189, 248, 0.1))' }} />
            </div>
            <p className="text-red-400 text-sm mb-4">{error}</p>
            <button onClick={() => loadData()} className="px-5 py-2.5 bg-cyan-500/10 text-cyan-400 text-sm rounded-lg border border-cyan-500/30 hover:bg-cyan-500/20 transition-colors">
              다시 시도
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060d18] text-white">
      <VirtHeader />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">

        {/* ═══ 상단: 서비스 탭 + 총 자산 ═══ */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          {/* 탭 */}
          <div className="flex items-center gap-2">
            {([
              { key: 'stock' as const, label: '주식', sub: 'KIS', connected: isKis },
              { key: 'upbit' as const, label: '코인', sub: 'Upbit', connected: isUpbit },
              { key: 'bitget' as const, label: '코인', sub: 'Bitget', connected: isBitget },
            ]).map((t) => (
              <button
                key={t.key}
                onClick={() => setServiceTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                  serviceTab === t.key
                    ? 'bg-white/10 text-white border-cyan-500/40'
                    : 'bg-white/[0.03] text-slate-500 border-white/[0.06] hover:text-slate-300'
                }`}
              >
                {t.label} <span className="text-[10px] text-slate-600">{t.sub}</span>
                {t.connected && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
              </button>
            ))}

            {!isConnected && (
              <button
                onClick={() => setShowSetup(serviceTab === 'stock' ? 'kis' : serviceTab === 'upbit' ? 'upbit' : 'bitget')}
                className="flex items-center gap-1.5 px-4 py-2 text-sm text-cyan-400 font-medium border border-cyan-500/30 rounded-lg hover:bg-cyan-500/10 transition-colors"
              >
                연결하기
              </button>
            )}
          </div>

          {/* 총 자산 요약 (연결 시) */}
          {isConnected && activePortfolio && (
            <div className="flex items-baseline gap-4">
              <div>
                <span className="text-slate-500 text-xs mr-2">총 자산</span>
                <span className="text-2xl md:text-3xl font-bold text-white">{fmtCompact(activePortfolio.totalValue)}</span>
              </div>
              <div className={`text-lg font-bold ${rc(activePortfolio.totalPnl)}`}>
                {sign(activePortfolio.totalPnl)}{fmtCompact(activePortfolio.totalPnl)}
              </div>
              <div className={`text-sm font-semibold ${rc(activePortfolio.returnRate)}`}>
                {sign(activePortfolio.returnRate)}{activePortfolio.returnRate.toFixed(2)}%
              </div>
            </div>
          )}
        </div>

        {/* ═══ 지표 카드 ═══ */}
        {isConnected && activePortfolio && activePortfolio.totalValue !== undefined ? (
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              { label: '총 자산', value: fmt(activePortfolio.totalValue), color: 'text-white', border: 'border-cyan-500/20' },
              { label: '총 손익', value: `${sign(activePortfolio.totalPnl)}${fmt(activePortfolio.totalPnl)}`, color: rc(activePortfolio.totalPnl), border: activePortfolio.totalPnl >= 0 ? 'border-red-500/20' : 'border-blue-500/20' },
              { label: '수익률', value: `${sign(activePortfolio.returnRate)}${activePortfolio.returnRate.toFixed(2)}%`, color: rc(activePortfolio.returnRate), border: activePortfolio.returnRate >= 0 ? 'border-red-500/20' : 'border-blue-500/20' },
              { label: serviceTab === 'stock' ? '예수금' : serviceTab === 'upbit' ? 'KRW 잔고' : 'USDT (추정)', value: fmt(activePortfolio.cashBalance), color: 'text-white', border: 'border-white/[0.06]' },
            ].map((m) => (
              <div key={m.label} className={`bg-white/[0.02] rounded-xl p-4 border ${m.border}`}>
                <div className="text-slate-500 text-[11px] mb-1.5">{m.label}</div>
                <div className={`text-lg font-bold ${m.color}`}>{m.value}</div>
              </div>
            ))}
          </div>
        ) : isConnected && !activePortfolio && !error ? (
          <div className="text-center py-12 mb-8">
            <div className="w-10 h-10 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-500 text-sm">포트폴리오 로딩 중...</p>
          </div>
        ) : !isConnected ? (
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-8 mb-8 text-center">
            <p className="text-slate-400 mb-4">
              {serviceTab === 'stock' ? 'KIS API 키를 등록하면 보유 종목과 잔고를 확인할 수 있습니다'
                : serviceTab === 'upbit' ? '업비트 API 키를 등록하면 코인 보유 현황을 확인할 수 있습니다'
                : '비트겟 API 키를 등록하면 코인 보유 현황을 확인할 수 있습니다'}
            </p>
            <button
              onClick={() => setShowSetup(serviceTab === 'stock' ? 'kis' : serviceTab === 'upbit' ? 'upbit' : 'bitget')}
              className="px-6 py-2.5 bg-cyan-500/10 text-cyan-400 font-semibold text-sm rounded-lg border border-cyan-500/30 hover:bg-cyan-500/20 transition-colors"
            >
              API 키 등록하기
            </button>
          </div>
        ) : null}

        {/* 에러 */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>
        )}

        {/* ═══ 메인 콘텐츠 ═══ */}
        {isConnected && activePortfolio && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-12">
            {/* 메인 (8/12) */}
            <div className="lg:col-span-8 space-y-6">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                <div className="flex border-b border-white/[0.06]">
                  {(['holdings', 'trades'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`flex-1 py-3.5 text-sm font-semibold transition-all ${
                        activeTab === tab ? 'text-cyan-400 border-b-2 border-cyan-500 bg-cyan-500/5' : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {tab === 'holdings'
                        ? `보유 ${serviceTab === 'stock' ? '종목' : '코인'} (${activePortfolio.holdings.length})`
                        : `체결 내역 ${serviceTab === 'stock' ? `(${trades.length})` : ''}`}
                    </button>
                  ))}
                </div>
                <div className="p-5">
                  {activeTab === 'holdings' ? (
                    activePortfolio.holdings.length === 0 ? (
                      <div className="text-center py-16 text-slate-500"><p>보유 종목이 없습니다</p></div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-4 text-sm">
                          <span className="text-slate-400">평가금액 <span className="font-bold text-white">{fmt(activePortfolio.holdingsValue)}</span></span>
                          <span className={`font-bold ${rc(activePortfolio.totalPnl)}`}>{sign(activePortfolio.totalPnl)}{fmt(activePortfolio.totalPnl)}</span>
                        </div>
                        <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[11px] font-medium text-slate-600 border-b border-white/[0.04] mb-1">
                          <div className="col-span-4">종목</div>
                          <div className="col-span-2 text-right">수량</div>
                          <div className="col-span-3 text-right">평가금액</div>
                          <div className="col-span-3 text-right">수익률</div>
                        </div>
                        {activePortfolio.holdings.map((h) => (
                          <div key={h.stockCode} className="grid grid-cols-12 gap-2 px-3 py-3 rounded-lg hover:bg-white/[0.03] transition-colors">
                            <div className="col-span-4">
                              <div className="font-semibold text-sm text-white">{h.stockName}</div>
                              <div className="text-[11px] text-slate-600">{h.stockCode}</div>
                            </div>
                            <div className="col-span-2 text-right self-center text-sm text-slate-300">
                              {serviceTab === 'stock' ? `${h.quantity.toLocaleString()}주` : h.quantity}
                            </div>
                            <div className="col-span-3 text-right self-center text-sm font-medium text-white">{fmtCompact(h.marketValue)}</div>
                            <div className="col-span-3 text-right self-center">
                              <div className={`text-sm font-bold ${rc(h.returnRate)}`}>{sign(h.returnRate)}{h.returnRate.toFixed(2)}%</div>
                              <div className={`text-[11px] ${rc(h.profitLoss)}`}>{sign(h.profitLoss)}{fmtCompact(h.profitLoss)}</div>
                            </div>
                          </div>
                        ))}
                      </>
                    )
                  ) : serviceTab !== 'stock' ? (
                    <div className="text-center py-16 text-slate-500">
                      <p className="font-medium">코인 체결 내역은 지원 예정입니다</p>
                    </div>
                  ) : trades.length === 0 ? (
                    <div className="text-center py-16 text-slate-500"><p>체결 내역이 없습니다</p></div>
                  ) : (
                    <div className="space-y-1">
                      {trades.map((t) => (
                        <div key={t.orderId} className="flex items-center justify-between px-3 py-3 rounded-lg hover:bg-white/[0.03] transition-colors">
                          <div className="flex items-center gap-3">
                            <span className={`px-2 py-1 text-[11px] font-bold rounded ${
                              t.orderType === 'BUY' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            }`}>{t.orderType === 'BUY' ? '매수' : '매도'}</span>
                            <div>
                              <span className="font-semibold text-sm text-white">{t.stockName}</span>
                              <span className="text-[11px] text-slate-600 ml-1.5">{t.stockCode}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium text-white">{t.quantity}주 · {fmt(t.price)}</div>
                            <div className="text-[11px] text-slate-600">{t.executedAt}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 사이드바 (4/12) */}
            <div className="lg:col-span-4 space-y-6">
              {/* 자산 배분 */}
              {activePortfolio.holdings.length > 0 && (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                  <h2 className="text-sm font-bold text-white mb-4">자산 배분</h2>
                  <div className="w-full h-44 mb-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            ...(activePortfolio.cashBalance > 0 ? [{ name: serviceTab === 'stock' ? '예수금' : 'KRW', value: activePortfolio.cashBalance, color: '#475569' }] : []),
                            ...activePortfolio.holdings.map((h, i) => ({ name: h.stockName, value: h.marketValue, color: CHART_COLORS[i % CHART_COLORS.length] })),
                          ]}
                          dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={2} stroke="none"
                        >
                          {[
                            ...(activePortfolio.cashBalance > 0 ? [{ color: '#475569' }] : []),
                            ...activePortfolio.holdings.map((_, i) => ({ color: CHART_COLORS[i % CHART_COLORS.length] })),
                          ].map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', fontSize: '12px', color: '#e2e8f0' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2">
                    {activePortfolio.holdings.map((h, i) => (
                      <div key={h.stockCode} className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="text-xs text-slate-400 flex-1 truncate">{h.stockName}</span>
                        <span className="text-xs text-slate-300">{fmtCompact(h.marketValue)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 투자 요약 */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                <h2 className="text-sm font-bold text-white mb-3">투자 요약</h2>
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">{serviceTab === 'stock' ? '예수금' : 'KRW'}</span><span className="text-white">{fmt(activePortfolio.cashBalance)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">보유 평가</span><span className="text-white">{fmt(activePortfolio.holdingsValue)}</span></div>
                  <div className="border-t border-white/[0.06] pt-2.5">
                    <div className="flex justify-between"><span className="text-slate-400 font-medium">총 자산</span><span className="font-bold text-white">{fmt(activePortfolio.totalValue)}</span></div>
                    <div className="flex justify-between mt-1.5">
                      <span className="text-slate-500">총 손익</span>
                      <span className={`font-bold ${rc(activePortfolio.totalPnl)}`}>
                        {sign(activePortfolio.totalPnl)}{fmt(activePortfolio.totalPnl)}
                        <span className="text-xs font-normal ml-1">({sign(activePortfolio.returnRate)}{activePortfolio.returnRate.toFixed(2)}%)</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 연결 정보 */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                <h2 className="text-sm font-bold text-white mb-3">연결 정보</h2>
                <div className="text-sm text-slate-400">
                  {serviceTab === 'stock' ? (
                    <><div className="flex justify-between mb-1"><span>API Key</span><span className="font-mono text-xs text-slate-300">{credInfo?.appkey || '-'}</span></div>
                    <div className="flex justify-between"><span>계좌</span><span className="font-mono text-xs text-slate-300">{credInfo?.accountNumber || '-'}</span></div></>
                  ) : serviceTab === 'upbit' ? (
                    <div className="flex justify-between"><span>Access Key</span><span className="font-mono text-xs text-slate-300">{(upbitCredInfo as any)?.accessKey || '-'}</span></div>
                  ) : (
                    <div className="flex justify-between"><span>API Key</span><span className="font-mono text-xs text-slate-300">{(bitgetCredInfo as any)?.apiKey || '-'}</span></div>
                  )}
                </div>
                <button
                  onClick={() => handleDisconnect(serviceTab === 'stock' ? 'kis' : serviceTab)}
                  className="w-full mt-3 px-3 py-2 text-xs text-red-400/70 border border-red-500/20 rounded-lg hover:bg-red-500/10 hover:text-red-400 transition-colors"
                >
                  연결 해제
                </button>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* ═══ 설정 모달 ═══ */}
      {showSetup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#0c1a2e] border border-white/10 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white">
                  {showSetup === 'kis' ? 'KIS API 연결' : showSetup === 'upbit' ? '업비트 API 연결' : '비트겟 API 연결'}
                </h2>
                <button onClick={() => { setShowSetup(false); setSetupError(null); setTestResult(null); }} className="text-slate-500 hover:text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="bg-cyan-500/5 border border-cyan-500/15 rounded-lg p-3 mb-5 text-xs text-cyan-300/70">
                입력한 키는 AES-256으로 암호화되어 저장됩니다.
              </div>

              {showSetup === 'kis' ? (
                <div className="space-y-4">
                  <div><label className="block text-sm text-slate-400 mb-1">App Key</label>
                    <input type="text" value={setupForm.appkey} onChange={(e) => setSetupForm(p => ({ ...p, appkey: e.target.value }))}
                      className="w-full px-4 py-3 bg-white/[0.04] border border-white/10 rounded-lg text-white text-sm placeholder-slate-600 focus:border-cyan-500/40 focus:outline-none" placeholder="PSxxxxxxxxxxx" /></div>
                  <div><label className="block text-sm text-slate-400 mb-1">App Secret</label>
                    <input type="password" value={setupForm.appsecret} onChange={(e) => setSetupForm(p => ({ ...p, appsecret: e.target.value }))}
                      className="w-full px-4 py-3 bg-white/[0.04] border border-white/10 rounded-lg text-white text-sm placeholder-slate-600 focus:border-cyan-500/40 focus:outline-none" placeholder="시크릿 키" /></div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2"><label className="block text-sm text-slate-400 mb-1">계좌번호 (앞 8자리)</label>
                      <input type="text" value={setupForm.accountNumber} onChange={(e) => setSetupForm(p => ({ ...p, accountNumber: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
                        className="w-full px-4 py-3 bg-white/[0.04] border border-white/10 rounded-lg text-white text-sm placeholder-slate-600 focus:border-cyan-500/40 focus:outline-none" placeholder="12345678" maxLength={8} /></div>
                    <div><label className="block text-sm text-slate-400 mb-1">뒤 2자리</label>
                      <input type="text" value={setupForm.accountProductCode} onChange={(e) => setSetupForm(p => ({ ...p, accountProductCode: e.target.value.replace(/\D/g, '').slice(0, 2) }))}
                        className="w-full px-4 py-3 bg-white/[0.04] border border-white/10 rounded-lg text-white text-sm placeholder-slate-600 focus:border-cyan-500/40 focus:outline-none" placeholder="01" maxLength={2} /></div>
                  </div>
                </div>
              ) : showSetup === 'upbit' ? (
                <div className="space-y-4">
                  <div><label className="block text-sm text-slate-400 mb-1">Access Key</label>
                    <input type="text" value={upbitSetupForm.accessKey} onChange={(e) => setUpbitSetupForm(p => ({ ...p, accessKey: e.target.value }))}
                      className="w-full px-4 py-3 bg-white/[0.04] border border-white/10 rounded-lg text-white text-sm placeholder-slate-600 focus:border-cyan-500/40 focus:outline-none" placeholder="Access Key" /></div>
                  <div><label className="block text-sm text-slate-400 mb-1">Secret Key</label>
                    <input type="password" value={upbitSetupForm.secretKey} onChange={(e) => setUpbitSetupForm(p => ({ ...p, secretKey: e.target.value }))}
                      className="w-full px-4 py-3 bg-white/[0.04] border border-white/10 rounded-lg text-white text-sm placeholder-slate-600 focus:border-cyan-500/40 focus:outline-none" placeholder="Secret Key" /></div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div><label className="block text-sm text-slate-400 mb-1">API Key</label>
                    <input type="text" value={bitgetSetupForm.apiKey} onChange={(e) => setBitgetSetupForm(p => ({ ...p, apiKey: e.target.value }))}
                      className="w-full px-4 py-3 bg-white/[0.04] border border-white/10 rounded-lg text-white text-sm placeholder-slate-600 focus:border-cyan-500/40 focus:outline-none" placeholder="API Key" /></div>
                  <div><label className="block text-sm text-slate-400 mb-1">Secret Key</label>
                    <input type="password" value={bitgetSetupForm.secretKey} onChange={(e) => setBitgetSetupForm(p => ({ ...p, secretKey: e.target.value }))}
                      className="w-full px-4 py-3 bg-white/[0.04] border border-white/10 rounded-lg text-white text-sm placeholder-slate-600 focus:border-cyan-500/40 focus:outline-none" placeholder="Secret Key" /></div>
                  <div><label className="block text-sm text-slate-400 mb-1">Passphrase</label>
                    <input type="password" value={bitgetSetupForm.passphrase} onChange={(e) => setBitgetSetupForm(p => ({ ...p, passphrase: e.target.value }))}
                      className="w-full px-4 py-3 bg-white/[0.04] border border-white/10 rounded-lg text-white text-sm placeholder-slate-600 focus:border-cyan-500/40 focus:outline-none" placeholder="Passphrase" /></div>
                </div>
              )}

              {setupError && <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">{setupError}</div>}
              {testResult && <div className={`mt-4 p-3 rounded-lg text-xs border ${testResult.success ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>{testResult.message}</div>}

              <div className="flex gap-3 mt-6">
                <button onClick={() => { setShowSetup(false); setSetupError(null); setTestResult(null); }}
                  className="flex-1 px-4 py-3 text-sm text-slate-400 border border-white/10 rounded-lg hover:bg-white/5">취소</button>
                <button onClick={showSetup === 'kis' ? handleSaveKis : showSetup === 'upbit' ? handleSaveUpbit : handleSaveBitget}
                  disabled={setupLoading}
                  className="flex-1 px-4 py-3 text-sm font-bold text-[#060d18] bg-cyan-400 rounded-lg hover:bg-cyan-300 transition-colors disabled:opacity-50">
                  {setupLoading ? '연결 중...' : '연결 및 테스트'}
                </button>
              </div>

              {showSetup === 'kis' && isKis && <button onClick={() => { handleDisconnect('kis'); setShowSetup(false); }} className="w-full mt-3 px-4 py-2 text-xs text-red-400/70 hover:bg-red-500/10 rounded-lg">KIS 연결 해제</button>}
              {showSetup === 'upbit' && isUpbit && <button onClick={() => { handleDisconnect('upbit'); setShowSetup(false); }} className="w-full mt-3 px-4 py-2 text-xs text-red-400/70 hover:bg-red-500/10 rounded-lg">업비트 연결 해제</button>}
              {showSetup === 'bitget' && isBitget && <button onClick={() => { handleDisconnect('bitget'); setShowSetup(false); }} className="w-full mt-3 px-4 py-2 text-xs text-red-400/70 hover:bg-red-500/10 rounded-lg">비트겟 연결 해제</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VirtDashboardPage;
