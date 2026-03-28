import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useVirtNavigate, useRoutePrefix } from '../hooks/useRoutePrefix';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Area, ComposedChart, Line } from 'recharts';
import apiClient from '../utils/api';
import Header from '../components/Header';
import VirtSplashLoading from '../components/VirtSplashLoading';
import SplashLoading from '../components/SplashLoading';
import ErrorMessage from '../components/ErrorMessage';
import UnstableCurrent from '../components/UnstableCurrent';
import { tradeService, portfolioService, type Portfolio, type Trade, type PortfolioSnapshot } from '../services/tradeService';
import {
  quantStoreService,
  type PurchasePerformance,
  formatQuantity,
  CRYPTO_NAMES,
} from '../services/quantStoreService';
import { useAuth } from '../contexts/AuthContext';
import { virtService, type VirtPortfolio, type VirtTrade, type VirtCredentialInfo } from '../services/virtService';

const REFRESH_INTERVAL = 15_000; // 15초

const CHART_COLORS = ['#4a90e2', '#50c878', '#f5a623', '#e74c3c', '#9b59b6', '#1abc9c', '#e67e22', '#3498db'];

/* ═══════════════════════════════════════════════════
   실계좌 포트폴리오 (일반 모드 전용)
   ═══════════════════════════════════════════════════ */
const RealPortfolioPage = () => {
  const [serviceTab, setServiceTab] = useState<'kis' | 'upbit' | 'bitget'>('kis');
  const [activeTab, setActiveTab] = useState<'holdings' | 'trades'>('holdings');
  const [kisCredInfo, setKisCredInfo] = useState<VirtCredentialInfo | null>(null);
  const [upbitCredInfo, setUpbitCredInfo] = useState<VirtCredentialInfo | null>(null);
  const [bitgetCredInfo, setBitgetCredInfo] = useState<VirtCredentialInfo | null>(null);
  const [kisPortfolio, setKisPortfolio] = useState<VirtPortfolio | null>(null);
  const [upbitPortfolio, setUpbitPortfolio] = useState<VirtPortfolio | null>(null);
  const [bitgetPortfolio, setBitgetPortfolio] = useState<VirtPortfolio | null>(null);
  const [trades, setTrades] = useState<VirtTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // API 설정 모달
  const [showSetup, setShowSetup] = useState<false | 'kis' | 'upbit' | 'bitget'>(false);
  const [setupForm, setSetupForm] = useState<Record<string, string>>({});
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

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
      if (kisP) setKisPortfolio(kisP);
      if (upbitP) setUpbitPortfolio(upbitP);
      if (bitgetP) setBitgetPortfolio(bitgetP);

      // KIS 체결 내역
      if (kis.connected) {
        const t = await virtService.getTrades(30).catch(() => []);
        setTrades(t);
      }

      // 연결된 첫 번째 탭으로 이동
      if (!silent) {
        if (kis.connected) setServiceTab('kis');
        else if (upbit.connected) setServiceTab('upbit');
        else if (bitget.connected) setServiceTab('bitget');
      }
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

  const fmt = (v: number) => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
  const sign = (v: number) => (v > 0 ? '+' : '');
  const rc = (v: number) => (v > 0 ? 'text-red-500' : v < 0 ? 'text-blue-500' : 'text-gray-400');

  const isKis = kisCredInfo?.connected === true;
  const isUpbit = upbitCredInfo?.connected === true;
  const isBitget = bitgetCredInfo?.connected === true;
  const hasAnyConnection = isKis || isUpbit || isBitget;

  const activePortfolio = serviceTab === 'kis' ? kisPortfolio : serviceTab === 'upbit' ? upbitPortfolio : bitgetPortfolio;
  const isConnected = serviceTab === 'kis' ? isKis : serviceTab === 'upbit' ? isUpbit : isBitget;

  // 전체 합산
  const totalAll = (kisPortfolio?.totalValue || 0) + (upbitPortfolio?.totalValue || 0) + (bitgetPortfolio?.totalValue || 0);
  const totalPnlAll = (kisPortfolio?.totalPnl || 0) + (upbitPortfolio?.totalPnl || 0) + (bitgetPortfolio?.totalPnl || 0);
  const investedAll = totalAll - totalPnlAll;
  const returnAll = investedAll !== 0 ? (totalPnlAll / investedAll) * 100 : 0;

  const handleDisconnect = async (type: 'kis' | 'upbit' | 'bitget') => {
    const labels = { kis: 'KIS', upbit: '업비트', bitget: '비트겟' };
    if (!window.confirm(`${labels[type]} 연결을 해제하시겠습니까?`)) return;
    try {
      if (type === 'kis') { await virtService.deleteCredential(); setKisPortfolio(null); setTrades([]); }
      else if (type === 'upbit') { await virtService.deleteUpbitCredential(); setUpbitPortfolio(null); }
      else { await virtService.deleteBitgetCredential(); setBitgetPortfolio(null); }
      await loadData();
    } catch { /* ignore */ }
  };

  const handleSetupSave = async () => {
    setSetupLoading(true); setSetupError(null);
    try {
      if (showSetup === 'kis') {
        await virtService.saveCredential({ appkey: setupForm.appkey || '', appsecret: setupForm.appsecret || '', accountNumber: setupForm.accountNumber || '', accountProductCode: '01' });
      } else if (showSetup === 'upbit') {
        await virtService.saveUpbitCredential({ accessKey: setupForm.accessKey || '', secretKey: setupForm.secretKey || '' });
      } else if (showSetup === 'bitget') {
        await virtService.saveBitgetCredential({ apiKey: setupForm.apiKey || '', secretKey: setupForm.secretKey || '', passphrase: setupForm.passphrase || '' });
      }
      setShowSetup(false); setSetupForm({});
      await loadData();
    } catch (e: any) { setSetupError(e.response?.data?.message || e.message || '연결 실패'); }
    finally { setSetupLoading(false); }
  };

  if (loading) {
    return <SplashLoading message="실계좌 자산을 불러오는 중..." />;
  }

  return (
    <div className="min-h-screen bg-[#060d18] text-white">
      <Header showNav />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* 뒤로가기 */}
        <Link to="/dashboard" className="inline-flex items-center text-slate-500 hover:text-white mb-6 text-sm transition-colors">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          대시보드
        </Link>

        {/* 전체 자산 히어로 */}
        {hasAnyConnection && (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden mb-6">
            <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 p-6 md:p-8 border-b border-white/[0.06]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-white/60 text-sm">전체 실계좌 자산</span>
                <button onClick={() => loadData()} className="text-white/40 hover:text-white text-xs transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
              </div>
              <div className="text-3xl md:text-4xl font-bold text-white tracking-tight">{fmt(totalAll)}</div>
              <div className="flex items-center gap-3 mt-2">
                <span className={`text-sm font-bold ${totalPnlAll >= 0 ? 'text-red-300' : 'text-blue-300'}`}>
                  {sign(totalPnlAll)}{fmt(Math.round(totalPnlAll))}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  returnAll >= 0 ? 'bg-red-400/20 text-red-200' : 'bg-blue-400/20 text-blue-200'
                }`}>
                  {sign(returnAll)}{returnAll.toFixed(2)}%
                </span>
              </div>
            </div>
            {/* 거래소별 요약 */}
            <div className="grid grid-cols-3 divide-x divide-white/[0.06]">
              {([
                { label: 'KIS 주식', value: kisPortfolio?.totalValue || 0, connected: isKis },
                { label: '업비트', value: upbitPortfolio?.totalValue || 0, connected: isUpbit },
                { label: '비트겟', value: bitgetPortfolio?.totalValue || 0, connected: isBitget },
              ]).map((s) => (
                <div key={s.label} className="p-4 text-center">
                  <div className="text-[11px] text-slate-500 mb-1 flex items-center justify-center gap-1">
                    {s.label}
                    {s.connected && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />}
                  </div>
                  <div className="text-base font-bold text-white">{s.connected ? fmt(s.value) : <span className="text-slate-600">미연결</span>}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 서비스 탭 */}
        <div className="flex items-center gap-2 mb-6">
          {([
            { key: 'kis' as const, label: '주식', sub: 'KIS', connected: isKis },
            { key: 'upbit' as const, label: '코인', sub: 'Upbit', connected: isUpbit },
            { key: 'bitget' as const, label: '코인', sub: 'Bitget', connected: isBitget },
          ]).map((t) => (
            <button
              key={t.key}
              onClick={() => { setServiceTab(t.key); setActiveTab('holdings'); }}
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
        </div>

        {error && (
          <UnstableCurrent message="해류가 불안정합니다" sub={error || '데이터를 다시 불러오고 있어요...'} />
        )}

        {/* 미연결 상태 */}
        {!isConnected && (
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-8 text-center">
            <p className="text-slate-400 mb-4">
              {serviceTab === 'kis' ? 'KIS API 키를 등록하면 보유 종목과 잔고를 확인할 수 있습니다'
                : serviceTab === 'upbit' ? '업비트 API 키를 등록하면 코인 보유 현황을 확인할 수 있습니다'
                : '비트겟 API 키를 등록하면 코인 보유 현황을 확인할 수 있습니다'}
            </p>
            <button
              onClick={() => setShowSetup(serviceTab === 'kis' ? 'kis' : serviceTab)}
              className="px-6 py-2.5 bg-cyan-500/10 text-cyan-400 font-semibold text-sm rounded-lg border border-cyan-500/30 hover:bg-cyan-500/20 transition-colors"
            >
              API 키 등록하기
            </button>
          </div>
        )}

        {/* 연결된 경우: 상세 포트폴리오 */}
        {isConnected && activePortfolio && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-12">

            {/* 메인 영역 (8/12) */}
            <div className="lg:col-span-8 space-y-6">

              {/* 지표 카드 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: '총 자산', value: fmt(activePortfolio.totalValue), color: 'text-white', border: 'border-cyan-500/20' },
                  { label: '총 손익', value: `${sign(activePortfolio.totalPnl)}${fmt(Math.round(activePortfolio.totalPnl))}`, color: rc(activePortfolio.totalPnl), border: activePortfolio.totalPnl >= 0 ? 'border-red-500/20' : 'border-blue-500/20' },
                  { label: '수익률', value: `${sign(activePortfolio.returnRate)}${activePortfolio.returnRate.toFixed(2)}%`, color: rc(activePortfolio.returnRate), border: activePortfolio.returnRate >= 0 ? 'border-red-500/20' : 'border-blue-500/20' },
                  { label: serviceTab === 'kis' ? '예수금' : serviceTab === 'upbit' ? 'KRW 잔고' : 'USDT', value: fmt(activePortfolio.cashBalance), color: 'text-white', border: 'border-white/[0.06]' },
                ].map((m) => (
                  <div key={m.label} className={`bg-white/[0.02] rounded-xl p-4 border ${m.border}`}>
                    <div className="text-slate-500 text-[11px] mb-1.5">{m.label}</div>
                    <div className={`text-lg font-bold ${m.color}`}>{m.value}</div>
                  </div>
                ))}
              </div>

              {/* 보유 종목 / 체결 내역 탭 */}
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
                        ? `보유 ${serviceTab === 'kis' ? '종목' : '코인'} (${activePortfolio.holdings.length})`
                        : `체결 내역 ${serviceTab === 'kis' ? `(${trades.length})` : ''}`}
                    </button>
                  ))}
                </div>
                <div className="p-5">
                  {activeTab === 'holdings' ? (
                    activePortfolio.holdings.length === 0 ? (
                      <div className="text-center py-16 text-slate-500"><p>보유 종목이 없습니다</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-4 text-sm">
                          <span className="text-slate-400">평가금액 <span className="font-bold text-white">{fmt(activePortfolio.holdingsValue)}</span></span>
                          <span className={`font-bold ${rc(activePortfolio.totalPnl)}`}>{sign(activePortfolio.totalPnl)}{fmt(Math.round(activePortfolio.totalPnl))}</span>
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
                              {serviceTab === 'kis' ? `${h.quantity.toLocaleString()}주` : formatQuantity(h.quantity)}
                            </div>
                            <div className="col-span-3 text-right self-center text-sm font-medium text-white">{fmt(h.marketValue)}</div>
                            <div className="col-span-3 text-right self-center">
                              <div className={`text-sm font-bold ${rc(h.returnRate)}`}>{sign(h.returnRate)}{h.returnRate.toFixed(2)}%</div>
                              <div className={`text-[11px] ${rc(h.profitLoss)}`}>{sign(h.profitLoss)}{fmt(Math.round(h.profitLoss))}</div>
                            </div>
                          </div>
                        ))}
                      </>
                    )
                  ) : serviceTab !== 'kis' ? (
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

              {/* 자산 배분 차트 */}
              {activePortfolio.holdings.length > 0 && (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                  <h3 className="text-sm font-bold text-white mb-3">자산 배분</h3>
                  <div className="w-full h-48 mb-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            ...(activePortfolio.cashBalance > 0 ? [{ name: serviceTab === 'kis' ? '예수금' : 'KRW', value: activePortfolio.cashBalance, color: '#475569' }] : []),
                            ...activePortfolio.holdings.map((h, i) => ({ name: h.stockName, value: h.marketValue, color: CHART_COLORS[i % CHART_COLORS.length] })),
                          ]}
                          dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={2} stroke="none"
                        >
                          {[
                            ...(activePortfolio.cashBalance > 0 ? [{ color: '#475569' }] : []),
                            ...activePortfolio.holdings.map((_, i) => ({ color: CHART_COLORS[i % CHART_COLORS.length] })),
                          ].map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                        <Tooltip
                          formatter={(v: number) => fmt(v)}
                          contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', fontSize: '12px', color: '#e2e8f0' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1.5">
                    {activePortfolio.cashBalance > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: '#475569' }} />
                        <span className="text-xs text-slate-400 flex-1">{serviceTab === 'kis' ? '예수금' : 'KRW'}</span>
                        <span className="text-xs text-slate-300">{fmt(activePortfolio.cashBalance)}</span>
                      </div>
                    )}
                    {activePortfolio.holdings.map((h, i) => (
                      <div key={h.stockCode} className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="text-xs text-slate-400 flex-1 truncate">{h.stockName}</span>
                        <span className="text-xs text-slate-300">{fmt(h.marketValue)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 투자 요약 */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                <h3 className="text-sm font-bold text-white mb-3">투자 요약</h3>
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">{serviceTab === 'kis' ? '예수금' : serviceTab === 'upbit' ? 'KRW' : 'USDT'}</span><span className="text-white">{fmt(activePortfolio.cashBalance)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">보유 평가</span><span className="text-white">{fmt(activePortfolio.holdingsValue)}</span></div>
                  <div className="border-t border-white/[0.06] pt-2.5">
                    <div className="flex justify-between"><span className="text-slate-400 font-medium">총 자산</span><span className="font-bold text-white">{fmt(activePortfolio.totalValue)}</span></div>
                    <div className="flex justify-between mt-1.5">
                      <span className="text-slate-500">총 손익</span>
                      <span className={`font-bold ${rc(activePortfolio.totalPnl)}`}>
                        {sign(activePortfolio.totalPnl)}{fmt(Math.round(activePortfolio.totalPnl))}
                        <span className="text-xs font-normal ml-1">({sign(activePortfolio.returnRate)}{activePortfolio.returnRate.toFixed(2)}%)</span>
                      </span>
                    </div>
                  </div>
                  <div className="border-t border-white/[0.06] pt-2.5">
                    <div className="flex justify-between"><span className="text-slate-500">보유 종목</span><span className="text-white">{activePortfolio.holdings.length}개</span></div>
                  </div>
                </div>
              </div>

              {/* 연결 정보 */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                <h3 className="text-sm font-bold text-white mb-3">연결 정보</h3>
                <div className="text-sm text-slate-400 space-y-1.5">
                  {serviceTab === 'kis' && kisCredInfo && (
                    <>
                      <div className="flex justify-between"><span>API Key</span><span className="font-mono text-xs text-slate-300">{(kisCredInfo as any)?.appkey || '-'}</span></div>
                      <div className="flex justify-between"><span>계좌</span><span className="font-mono text-xs text-slate-300">{(kisCredInfo as any)?.accountNumber || '-'}</span></div>
                    </>
                  )}
                  {serviceTab === 'upbit' && upbitCredInfo && (
                    <div className="flex justify-between"><span>Access Key</span><span className="font-mono text-xs text-slate-300">{(upbitCredInfo as any)?.accessKey || '-'}</span></div>
                  )}
                  {serviceTab === 'bitget' && bitgetCredInfo && (
                    <div className="flex justify-between"><span>API Key</span><span className="font-mono text-xs text-slate-300">{(bitgetCredInfo as any)?.apiKey || '-'}</span></div>
                  )}
                </div>
                <button
                  onClick={() => handleDisconnect(serviceTab === 'kis' ? 'kis' : serviceTab)}
                  className="w-full mt-3 px-3 py-2 text-xs text-red-400/70 border border-red-500/20 rounded-lg hover:bg-red-500/10 hover:text-red-400 transition-colors"
                >
                  연결 해제
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 연결 없음 */}
        {!hasAnyConnection && !error && (
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-8 text-center mt-6">
            <p className="text-slate-400 mb-4">연결된 계좌가 없습니다. API 키를 등록하면 실계좌 자산을 확인할 수 있습니다.</p>
            <button onClick={() => setShowSetup('kis')} className="px-6 py-2.5 bg-cyan-500/10 text-cyan-400 font-semibold text-sm rounded-lg border border-cyan-500/30 hover:bg-cyan-500/20 transition-colors">
              API 키 등록하기
            </button>
          </div>
        )}
      </div>

      {/* ═══ API 설정 모달 ═══ */}
      {showSetup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#0c1a2e] border border-white/10 rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white">
                  {showSetup === 'kis' ? 'KIS API 연결' : showSetup === 'upbit' ? '업비트 API 연결' : '비트겟 API 연결'}
                </h2>
                <button onClick={() => { setShowSetup(false); setSetupError(null); setSetupForm({}); }} className="text-slate-500 hover:text-white">
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
                  <button key={t.key} onClick={() => { setShowSetup(t.key); setSetupForm({}); setSetupError(null); }}
                    className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${showSetup === t.key ? 'bg-white/10 text-white' : 'bg-white/[0.03] text-slate-500 hover:text-slate-300'}`}
                  >{t.label}</button>
                ))}
              </div>
              <div className="space-y-3">
                {showSetup === 'kis' && (
                  <>
                    <input placeholder="App Key" value={setupForm.appkey || ''} onChange={(e) => setSetupForm({ ...setupForm, appkey: e.target.value })} className="w-full px-4 py-3 text-sm rounded-lg bg-white/[0.04] border border-white/10 text-white placeholder-slate-600 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 outline-none" />
                    <input placeholder="App Secret" type="password" value={setupForm.appsecret || ''} onChange={(e) => setSetupForm({ ...setupForm, appsecret: e.target.value })} className="w-full px-4 py-3 text-sm rounded-lg bg-white/[0.04] border border-white/10 text-white placeholder-slate-600 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 outline-none" />
                    <input placeholder="계좌번호 (8자리)" value={setupForm.accountNumber || ''} onChange={(e) => setSetupForm({ ...setupForm, accountNumber: e.target.value })} className="w-full px-4 py-3 text-sm rounded-lg bg-white/[0.04] border border-white/10 text-white placeholder-slate-600 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 outline-none" />
                  </>
                )}
                {showSetup === 'upbit' && (
                  <>
                    <input placeholder="Access Key" value={setupForm.accessKey || ''} onChange={(e) => setSetupForm({ ...setupForm, accessKey: e.target.value })} className="w-full px-4 py-3 text-sm rounded-lg bg-white/[0.04] border border-white/10 text-white placeholder-slate-600 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 outline-none" />
                    <input placeholder="Secret Key" type="password" value={setupForm.secretKey || ''} onChange={(e) => setSetupForm({ ...setupForm, secretKey: e.target.value })} className="w-full px-4 py-3 text-sm rounded-lg bg-white/[0.04] border border-white/10 text-white placeholder-slate-600 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 outline-none" />
                  </>
                )}
                {showSetup === 'bitget' && (
                  <>
                    <input placeholder="API Key" value={setupForm.apiKey || ''} onChange={(e) => setSetupForm({ ...setupForm, apiKey: e.target.value })} className="w-full px-4 py-3 text-sm rounded-lg bg-white/[0.04] border border-white/10 text-white placeholder-slate-600 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 outline-none" />
                    <input placeholder="Secret Key" type="password" value={setupForm.secretKey || ''} onChange={(e) => setSetupForm({ ...setupForm, secretKey: e.target.value })} className="w-full px-4 py-3 text-sm rounded-lg bg-white/[0.04] border border-white/10 text-white placeholder-slate-600 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 outline-none" />
                    <input placeholder="Passphrase" type="password" value={setupForm.passphrase || ''} onChange={(e) => setSetupForm({ ...setupForm, passphrase: e.target.value })} className="w-full px-4 py-3 text-sm rounded-lg bg-white/[0.04] border border-white/10 text-white placeholder-slate-600 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 outline-none" />
                  </>
                )}
                {setupError && <p className="text-xs text-red-400">{setupError}</p>}
                <button onClick={handleSetupSave} disabled={setupLoading}
                  className="w-full py-3 bg-cyan-500 text-white text-sm font-semibold rounded-lg hover:bg-cyan-600 disabled:opacity-50 transition-colors">
                  {setupLoading ? '연결 중...' : 'API 연결'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const MyPortfolioPage = () => {
  const navigate = useVirtNavigate();
  const { prefix, isVirt } = useRoutePrefix();
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
  const [kospiBenchmark, setKospiBenchmark] = useState<{ price: number; change: number } | null>(null);

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
      if (!silent) setError(err.message || '포트폴리오 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPortfolio();
  }, [loadPortfolio]);

  // KOSPI 현재가 조회 (벤치마크용)
  useEffect(() => {
    apiClient.get('/api/market/indices')
      .then((res) => {
        const kospi = (res.data as Array<{ code: string; name: string; price: number; change: number; changeRate: number }>)
          ?.find((d) => d.code === 'KOSPI' || d.name === 'KOSPI' || d.code === '0001');
        if (kospi) setKospiBenchmark({ price: kospi.price, change: kospi.change });
      })
      .catch(() => { /* graceful degradation */ });
  }, []);

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

  // ═══ 일반 모드: 실계좌 포트폴리오 ═══
  if (!isVirt) {
    return <RealPortfolioPage />;
  }

  /* ───── 로딩/에러 ───── */
  if (loading) {
    return <VirtSplashLoading message="포트폴리오를 불러오는 중..." />;
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
          to={`${prefix}/dashboard`}
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
                // KOSPI 벤치마크: 포트폴리오 시작값 기준으로 정규화
                // change = 오늘 등락폭이므로 KOSPI 전일가 = price - change
                // 30일 전 KOSPI는 알 수 없으므로 일일 변동을 기간에 비례 외삽
                const startValue = historyData[0].totalValue;
                const hasKospi = kospiBenchmark != null;

                // KOSPI 정규화: 시작값을 포트폴리오와 동일하게 맞추고
                // 현재 KOSPI 등락률을 기간에 걸쳐 선형 보간
                const kospiDailyRate = hasKospi ? (kospiBenchmark.change / (kospiBenchmark.price - kospiBenchmark.change)) : 0;
                const totalDays = historyData.length - 1;
                // 30일간 누적 변동을 단순 선형 보간 (일별 데이터 미제공)
                const kospiTotalReturn = kospiDailyRate * totalDays;
                const kospiEndValue = Math.round(startValue * (1 + kospiTotalReturn));

                const chartData = historyData.map((s, i) => {
                  const base: Record<string, any> = {
                    date: s.date,
                    label: new Date(s.date + 'T00:00:00').toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
                    totalValue: Math.round(s.totalValue),
                    returnRate: Number(s.returnRate.toFixed(2)),
                  };
                  if (hasKospi && totalDays > 0) {
                    const progress = i / totalDays;
                    base.kospi = Math.round(startValue + progress * (kospiEndValue - startValue));
                  }
                  return base;
                });
                const values = chartData.map((d) => d.totalValue);
                const allValues = hasKospi ? [...values, startValue, kospiEndValue] : values;
                const minVal = Math.min(...allValues);
                const maxVal = Math.max(...allValues);
                const padding = Math.max((maxVal - minVal) * 0.1, 10000);
                const trend = chartData[chartData.length - 1].totalValue - chartData[0].totalValue;
                const gradientColor = trend >= 0 ? '#ef4444' : '#3b82f6';
                const lineColor = trend >= 0 ? '#ef4444' : '#3b82f6';

                return (
                  <>
                    {/* 범례 */}
                    <div className="flex items-center gap-4 mb-2 justify-end">
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: lineColor }} />
                        <span className="text-[11px] text-gray-500">내 포트폴리오</span>
                      </div>
                      {hasKospi && (
                        <div className="flex items-center gap-1.5">
                          <span className="w-3 h-0.5 rounded-full border-t border-dashed border-gray-400" style={{ borderTopWidth: 2 }} />
                          <span className="text-[11px] text-gray-400">KOSPI</span>
                        </div>
                      )}
                    </div>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
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
                              if (name === 'totalValue') return [fmt(value), '내 포트폴리오'];
                              if (name === 'kospi') return [fmt(value), 'KOSPI 벤치마크'];
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
                          {hasKospi && (
                            <Line
                              type="monotone"
                              dataKey="kospi"
                              stroke="#9ca3af"
                              strokeWidth={1.5}
                              strokeDasharray="6 3"
                              dot={false}
                              activeDot={{ r: 3, fill: '#9ca3af', strokeWidth: 1, stroke: '#fff' }}
                            />
                          )}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </>
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
                          전략 학습
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
                      <img src="/whales/gray-whale.png" alt="" className="w-14 h-14 object-contain mx-auto mb-3 opacity-50" />
                      <p className="text-gray-500 font-medium mb-1">거래 내역이 없습니다</p>
                      <p className="text-sm text-gray-400">매수 또는 매도를 하면 여기에 거래 내역이 기록됩니다.</p>
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
                    전략 학습
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
                        alert('CSV 다운로드에 실패했습니다. 데이터가 없거나 네트워크 문제일 수 있습니다.');
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
                        alert('CSV 다운로드에 실패했습니다. 데이터가 없거나 네트워크 문제일 수 있습니다.');
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
