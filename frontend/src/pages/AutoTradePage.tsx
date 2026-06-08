import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import HelmShell from '../components/HelmShell';
import Toast, { type ToastItem } from '../components/Toast';
import { useRoutePrefix } from '../hooks/useRoutePrefix';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { strategyService, type Strategy, type BacktestHistoryItem } from '../services/strategyService';
import { PRESET_STRATEGIES } from '../data/presetStrategies';
import {
  liveTradeService,
  type Deployment,
  type DeploymentStatus,
  type LiveOrderLog,
} from '../services/liveTradeService';

// ── 헬퍼 ──
const formatKRW = (n?: number) =>
  n === undefined || n === null ? '-' : `${new Intl.NumberFormat('ko-KR').format(Math.round(n))}원`;

const formatNum = (n?: number, digits = 4) =>
  n === undefined || n === null ? '-' : new Intl.NumberFormat('ko-KR', { maximumFractionDigits: digits }).format(n);

const formatTime = (iso?: string) => {
  if (!iso) return '평가 전';
  try {
    return new Date(iso).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '-';
  }
};

const INTERVAL_LABELS: Record<string, string> = {
  '1m': '1분봉', '5m': '5분봉', '15m': '15분봉', '30m': '30분봉',
  '1h': '1시간봉', '4h': '4시간봉', '1d': '일봉',
};
const parseIntervalMs = (iv: string): number => {
  const m = iv?.match(/^(\d+)(m|h|d)$/i);
  if (!m) return 0;
  const n = parseInt(m[1]);
  const u = m[2].toLowerCase();
  return n * (u === 'm' ? 60_000 : u === 'h' ? 3_600_000 : 86_400_000);
};
// RUNNING 배포의 다음 평가 예상 시점 (그 외 상태는 null → 미표시, 상태 배지로 충분)
const nextEvalLabel = (d: { lastEvaluatedAt?: string; interval: string; status: string }): string | null => {
  if (d.status !== 'RUNNING') return null;
  const ms = parseIntervalMs(d.interval);
  if (!ms || !d.lastEvaluatedAt) return '다음 봉 마감 시 평가';
  const remaining = new Date(d.lastEvaluatedAt).getTime() + ms - Date.now();
  if (remaining <= 0) return '곧 평가 예정';
  const mins = Math.round(remaining / 60_000);
  if (mins < 60) return `다음 평가까지 약 ${mins}분`;
  const hrs = Math.floor(mins / 60), rm = mins % 60;
  return `다음 평가까지 약 ${hrs}시간${rm > 0 ? ` ${rm}분` : ''}`;
};

const formatLogTime = (iso?: string) => {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '-';
  }
};

const errMsg = (e: unknown, fallback = '오류가 발생했습니다.') => {
  const anyErr = e as { response?: { data?: { message?: string } } };
  return anyErr?.response?.data?.message || fallback;
};

const STATUS_META: Record<DeploymentStatus, { label: string; dark: string; light: string }> = {
  RUNNING: { label: '가동 중', dark: 'bg-emerald-500/15 text-emerald-400', light: 'bg-emerald-50 text-emerald-600' },
  PAUSED: { label: '일시정지', dark: 'bg-amber-500/15 text-amber-400', light: 'bg-amber-50 text-amber-600' },
  STOPPED: { label: '정지됨', dark: 'bg-slate-500/15 text-slate-400', light: 'bg-gray-100 text-gray-500' },
  ERROR: { label: '오류', dark: 'bg-red-500/15 text-red-400', light: 'bg-red-50 text-red-600' },
};

const REASON_LABEL: Record<string, string> = {
  ENTRY: '진입 신호',
  STOP: '손절',
  TAKE_PROFIT: '익절',
  EXIT_SIGNAL: '청산 신호',
  TRAILING_STOP: '트레일링 손절',
};

const AutoTradePage = () => {
  const navigate = useNavigate();
  const { isVirt } = useRoutePrefix();
  const { isDark } = useTheme();
  const { session } = useAuth();
  const userName = session?.user?.email ? session.user.email.split('@')[0] : '항해사';

  const [pageLoading, setPageLoading] = useState(true);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [killSwitch, setKillSwitch] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // 백테스트 히스토리 (백테스트 vs 실전 비교용)
  const [backtestHistory, setBacktestHistory] = useState<BacktestHistoryItem[]>([]);

  // 실행 로그 (배포별 lazy 로딩)
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [orderLogs, setOrderLogs] = useState<Record<string, LiveOrderLog[]>>({});
  const [logsLoading, setLogsLoading] = useState<Record<string, boolean>>({});

  // 자동매매 교육 게이트
  const [showGuide, setShowGuide] = useState(false);
  const [guideChecked, setGuideChecked] = useState(false);

  // 생성 모달
  const [showCreate, setShowCreate] = useState(false);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    strategyId: '',
    accountKind: 'PAPER',
    allocatedCash: '1000000',
    targetAssetsText: '',
    assetType: '',
    interval: '1h',
    stopLossPct: '',
    takeProfitPct: '',
    trailingStopPct: '',
    dailyLossLimit: '',
  });

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const pushToast = useCallback((type: ToastItem['type'], title: string, message = '') => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setToasts(prev => [...prev, { id, type, title, message }]);
    const timer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      toastTimers.current.delete(timer);
    }, 4000);
    toastTimers.current.add(timer);
  }, []);
  const dismissToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));
  useEffect(() => {
    const timers = toastTimers.current;
    return () => { timers.forEach(clearTimeout); timers.clear(); };
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [deps, ks] = await Promise.all([
        liveTradeService.getDeployments(),
        liveTradeService.getKillSwitch(),
      ]);
      setDeployments(deps);
      setKillSwitch(ks);
    } catch (e) {
      pushToast('error', '불러오기 실패', errMsg(e));
    }
  }, [pushToast]);

  useEffect(() => {
    (async () => {
      await loadData();
      setPageLoading(false);
    })();
    const timer = setInterval(loadData, 30_000);
    return () => clearInterval(timer);
  }, [loadData]);

  // 백테스트 히스토리 최초 1회 로드
  useEffect(() => {
    strategyService.getBacktestHistory().then(setBacktestHistory).catch(() => {});
  }, []);

  // 실행 로그 lazy 로드 (이미 로드됐으면 토글만)
  const loadOrders = async (deploymentId: string) => {
    if (orderLogs[deploymentId] !== undefined) {
      setExpandedLogId(prev => prev === deploymentId ? null : deploymentId);
      return;
    }
    setExpandedLogId(deploymentId);
    setLogsLoading(prev => ({ ...prev, [deploymentId]: true }));
    try {
      const logs = await liveTradeService.getOrders(deploymentId);
      setOrderLogs(prev => ({ ...prev, [deploymentId]: logs }));
    } catch {
      setOrderLogs(prev => ({ ...prev, [deploymentId]: [] }));
    } finally {
      setLogsLoading(prev => ({ ...prev, [deploymentId]: false }));
    }
  };

  const openCreate = async () => {
    const guideSeen = (() => { try { return localStorage.getItem('wa_autotrade_guide') === '1'; } catch { return false; } })();
    if (!guideSeen) {
      setGuideChecked(false);
      setShowGuide(true);
    } else {
      await _doOpenCreate();
    }
  };

  const _doOpenCreate = async () => {
    setShowCreate(true);
    if (strategies.length === 0) {
      try {
        setStrategies(await strategyService.getStrategies());
      } catch (e) {
        pushToast('error', '전략 목록 실패', errMsg(e));
      }
    }
  };

  const confirmGuide = async (neverAgain: boolean) => {
    if (neverAgain) { try { localStorage.setItem('wa_autotrade_guide', '1'); } catch {} }
    setShowGuide(false);
    await _doOpenCreate();
  };

  const allStrategies = [...PRESET_STRATEGIES, ...strategies];

  const onSelectStrategy = (strategyId: string) => {
    const s = allStrategies.find(st => st.id === strategyId);
    setForm(prev => ({
      ...prev,
      strategyId,
      targetAssetsText: s ? s.targetAssets.join(', ') : prev.targetAssetsText,
      assetType: s ? (s.assetType === 'MIXED' ? '' : s.assetType) : prev.assetType,
    }));
  };

  const handleCreate = async () => {
    if (!form.strategyId) {
      pushToast('error', '전략 선택', '가동할 전략을 선택해주세요.');
      return;
    }
    const allocatedCash = Number(form.allocatedCash);
    if (!allocatedCash || allocatedCash <= 0) {
      pushToast('error', '금액 확인', '할당 금액을 올바르게 입력해주세요.');
      return;
    }
    const pctErr = (label: string, raw: string, capped: boolean): string | null => {
      if (!raw) return null;
      const n = Number(raw);
      if (isNaN(n) || n <= 0) return `${label}은(는) 0보다 큰 값이어야 합니다.`;
      if (capped && n >= 100) return `${label}은(는) 100%보다 작아야 합니다.`;
      return null;
    };
    const riskError = pctErr('손절률', form.stopLossPct, true)
      || pctErr('트레일링 스탑률', form.trailingStopPct, true)
      || pctErr('익절률', form.takeProfitPct, false);
    if (riskError) { pushToast('error', '리스크 값 확인', riskError); return; }

    const selected = allStrategies.find(s => s.id === form.strategyId);
    const isPreset = form.strategyId.startsWith('preset-');
    const typedAssets = form.targetAssetsText.split(',').map(s => s.trim()).filter(Boolean);
    const targetAssets = typedAssets.length ? typedAssets : (isPreset ? (selected?.targetAssets ?? []) : []);

    setCreating(true);
    try {
      await liveTradeService.createDeployment({
        ...(isPreset
          ? {
              strategyName: selected?.name,
              indicators: selected?.indicators,
              entryConditions: selected?.entryConditions,
              exitConditions: selected?.exitConditions,
            }
          : { strategyId: form.strategyId }),
        allocatedCash,
        targetAssets: targetAssets.length ? targetAssets : undefined,
        assetType: form.assetType || undefined,
        interval: form.interval,
        accountMode: form.accountKind === 'KIS' ? 'LIVE' : 'PAPER',
        brokerType: form.accountKind === 'KIS' ? 'KIS' : 'MOCK',
        stopLossPct: form.stopLossPct ? Number(form.stopLossPct) : undefined,
        takeProfitPct: form.takeProfitPct ? Number(form.takeProfitPct) : undefined,
        trailingStopPct: form.trailingStopPct ? Number(form.trailingStopPct) : undefined,
        dailyLossLimit: form.dailyLossLimit ? Number(form.dailyLossLimit) : undefined,
      });
      pushToast('success', '자동매매 시작', '모의 자동매매가 가동되었습니다.');
      setShowCreate(false);
      setForm(prev => ({ ...prev, strategyId: '', targetAssetsText: '', stopLossPct: '', takeProfitPct: '', trailingStopPct: '', dailyLossLimit: '' }));
      await loadData();
    } catch (e) {
      pushToast('error', '시작 실패', errMsg(e));
    } finally {
      setCreating(false);
    }
  };

  const changeStatus = async (d: Deployment, action: 'start' | 'pause' | 'stop') => {
    setBusyId(d.id);
    try {
      const updated = await liveTradeService[action](d.id);
      setDeployments(prev => prev.map(x => (x.id === d.id ? updated : x)));
      pushToast('success', '상태 변경', `'${d.strategyName}' ${action === 'start' ? '가동' : action === 'pause' ? '일시정지' : '정지'}`);
    } catch (e) {
      pushToast('error', '변경 실패', errMsg(e));
    } finally {
      setBusyId(null);
    }
  };

  const evaluateNow = async (d: Deployment) => {
    setBusyId(d.id);
    try {
      const updated = await liveTradeService.evaluateNow(d.id);
      setDeployments(prev => prev.map(x => (x.id === d.id ? updated : x)));
      pushToast('success', '평가 완료', `'${d.strategyName}' 신호를 즉시 평가했습니다.`);
    } catch (e) {
      pushToast('error', '평가 실패', errMsg(e));
    } finally {
      setBusyId(null);
    }
  };

  const toggleKillSwitch = async () => {
    const next = !killSwitch;
    if (next && !window.confirm('모든 자동매매를 즉시 중단합니다. 진행할까요?')) return;
    try {
      const result = await liveTradeService.setKillSwitch(next);
      setKillSwitch(result);
      pushToast(result ? 'error' : 'success', '킬스위치', result ? '전체 자동매매 정지됨' : '킬스위치 해제됨');
      await loadData();
    } catch (e) {
      pushToast('error', '킬스위치 실패', errMsg(e));
    }
  };

  const card = isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-white border-gray-200';
  const subText = isDark ? 'text-slate-400' : 'text-gray-500';
  const primaryBtn = isDark
    ? 'bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/30'
    : 'bg-whale-light text-white hover:bg-blue-600';
  const divBorder = isDark ? 'border-white/[0.06]' : 'border-gray-100';
  const divideY = isDark ? 'divide-white/[0.06]' : 'divide-gray-100';

  if (pageLoading) {
    return (
      <HelmShell active="autotrade" virt={isVirt} userName={userName} session="모의 자동매매">
        <div className={`py-24 text-center text-sm ${subText}`}>자동매매 정보를 불러오는 중...</div>
      </HelmShell>
    );
  }

  return (
    <HelmShell active="autotrade" virt={isVirt} userName={userName} session="모의 자동매매">
      <Toast toasts={toasts} onDismiss={dismissToast} />
      <div className="mx-auto max-w-6xl">
        {/* 헤더 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className={`text-2xl sm:text-3xl font-bold ${isDark ? 'text-white' : 'text-whale-dark'}`}>자동매매</h1>
            <p className={`mt-1 text-sm ${subText}`}>백테스트한 전략을 모의 자금으로 자동 매매합니다. 봉 단위(시간/일)로 신호를 평가해 주문합니다.</p>
          </div>
          <button onClick={openCreate} className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${primaryBtn}`}>
            + 새 자동매매 시작
          </button>
        </div>

        {/* 킬스위치 배너 */}
        <div className={`mb-6 rounded-xl border px-4 py-3 flex items-center justify-between gap-3 ${
          killSwitch
            ? (isDark ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200')
            : (isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-white border-gray-200')
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            <span className={`text-lg ${killSwitch ? 'text-red-500' : (isDark ? 'text-slate-400' : 'text-gray-400')}`}>🛑</span>
            <div className="min-w-0">
              <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>전역 킬스위치 {killSwitch ? '(작동 중)' : ''}</p>
              <p className={`text-xs ${subText}`}>{killSwitch ? '모든 자동매매가 정지되어 신호 평가를 건너뜁니다.' : '비상 시 모든 자동매매를 한 번에 멈춥니다.'}</p>
            </div>
          </div>
          <button
            onClick={toggleKillSwitch}
            className={`shrink-0 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
              killSwitch
                ? (isDark ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30' : 'bg-emerald-500 text-white hover:bg-emerald-600')
                : (isDark ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30' : 'bg-red-500 text-white hover:bg-red-600')
            }`}
          >
            {killSwitch ? '해제' : '전체 정지'}
          </button>
        </div>

        {/* 배포 목록 */}
        {deployments.length === 0 ? (
          <div className={`rounded-2xl border p-12 text-center ${card}`}>
            <p className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-700'}`}>가동 중인 자동매매가 없습니다</p>
            <p className={`mt-1 text-sm ${subText}`}>전략을 골라 모의 자동매매를 시작해보세요.</p>
            <button onClick={openCreate} className={`mt-4 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${primaryBtn}`}>
              + 새 자동매매 시작
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {deployments.map(d => {
              const sm = STATUS_META[d.status];
              const pnlPositive = (d.realizedPnl ?? 0) > 0;
              const pnlNegative = (d.realizedPnl ?? 0) < 0;
              const liveReturn = (d.allocatedCash ?? 0) > 0
                ? ((d.realizedPnl ?? 0) / (d.allocatedCash ?? 1)) * 100 : 0;
              const liveWinRate = (d.tradeCount ?? 0) > 0
                ? ((d.winCount ?? 0) / (d.tradeCount ?? 1)) * 100 : null;
              // 백테스트 히스토리에서 이 배포의 전략명과 매칭되는 가장 최근 결과
              const matchedBt = backtestHistory
                .filter(h => h.strategyName === d.strategyName)
                .sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
              const logsOpen = expandedLogId === d.id;
              const logsData = orderLogs[d.id];
              return (
                <div key={d.id} className={`rounded-2xl border p-5 ${card}`}>
                  {/* 카드 헤더 */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={`text-base font-bold truncate ${isDark ? 'text-white' : 'text-gray-800'}`}>{d.strategyName}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          d.accountMode === 'LIVE'
                            ? (isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-600')
                            : (isDark ? 'bg-blue-500/15 text-blue-300' : 'bg-blue-50 text-blue-600')
                        }`}>
                          {d.accountMode === 'LIVE' ? 'KIS 모의' : '모의'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${isDark ? sm.dark : sm.light}`}>{sm.label}</span>
                      </div>
                      <p className={`mt-1 text-xs ${subText}`}>
                        {(d.targetAssets || []).join(', ')} · {d.assetType || '-'} · {INTERVAL_LABELS[d.interval] ?? d.interval}
                        {nextEvalLabel(d) && (
                          <span className="ml-2 font-semibold" style={{ color: '#3fd6a0' }}>{nextEvalLabel(d)}</span>
                        )}
                        <span className={`ml-1.5 ${isDark ? 'text-white/30' : 'text-gray-400'}`}>· 마지막 {formatTime(d.lastEvaluatedAt)}</span>
                      </p>
                    </div>
                  </div>

                  {/* 지표 요약 */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div>
                      <p className={`text-[11px] ${subText}`}>할당금</p>
                      <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>{formatKRW(d.allocatedCash)}</p>
                    </div>
                    <div>
                      <p className={`text-[11px] ${subText}`}>실현손익</p>
                      <p className={`text-sm font-semibold ${pnlPositive ? 'text-red-500' : pnlNegative ? 'text-blue-500' : (isDark ? 'text-white' : 'text-gray-800')}`}>
                        {pnlPositive ? '+' : ''}{formatKRW(d.realizedPnl)}
                      </p>
                    </div>
                    <div>
                      <p className={`text-[11px] ${subText}`}>거래수 / 승</p>
                      <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>{d.tradeCount} / {d.winCount}</p>
                    </div>
                  </div>

                  {/* 일일 손실한도 */}
                  {d.dailyLossLimit != null && d.dailyLossLimit > 0 && (() => {
                    const today = d.todayRealizedPnl ?? 0;
                    const ratio = Math.min(1, Math.max(0, -today) / d.dailyLossLimit);
                    const near = ratio >= 0.8;
                    return (
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className={subText}>오늘 손익 / 일일 손실한도</span>
                          <span className={`font-semibold ${today < 0 ? 'text-blue-500' : today > 0 ? 'text-red-500' : (isDark ? 'text-slate-300' : 'text-gray-600')}`}>
                            {today > 0 ? '+' : ''}{formatKRW(today)} / -{formatKRW(d.dailyLossLimit)}
                          </span>
                        </div>
                        <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.06]' : 'bg-gray-100'}`}>
                          <div className={`h-full rounded-full ${near ? 'bg-red-500' : 'bg-amber-400'}`} style={{ width: `${ratio * 100}%` }} />
                        </div>
                      </div>
                    );
                  })()}

                  {/* 포지션 */}
                  <div className={`rounded-lg border divide-y ${divBorder} ${divideY} mb-3`}>
                    {(d.positions || []).map(p => (
                      <div key={p.symbol} className="flex items-center justify-between px-3 py-2 text-xs">
                        <span className={`font-medium ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>{p.symbol}</span>
                        <span className="flex items-center gap-2">
                          {p.direction === 'LONG' ? (
                            <>
                              <span className={`px-1.5 py-0.5 rounded ${isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-600'} font-bold`}>보유</span>
                              <span className={subText}>{formatNum(p.quantity)}주 @ {formatNum(p.avgPrice, 2)}</span>
                            </>
                          ) : (
                            <span className={subText}>대기</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* ── 백테스트 vs 실전 비교 ── */}
                  {matchedBt && (
                    <div className={`mb-3 rounded-xl border overflow-hidden ${isDark ? 'border-white/[0.08]' : 'border-gray-100'}`}>
                      <div className={`px-3 py-2 flex items-center gap-2 ${isDark ? 'bg-white/[0.03]' : 'bg-gray-50'}`}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
                        </svg>
                        <span className={`text-[11px] font-semibold ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>백테스트 예상 vs 실전 성과</span>
                        <span className={`ml-auto text-[10px] ${subText}`}>{matchedBt.stockCode} 기준</span>
                      </div>
                      <div className={`grid grid-cols-3 divide-x ${divBorder}`}>
                        {[
                          {
                            label: '수익률',
                            bt: `${matchedBt.totalReturnRate >= 0 ? '+' : ''}${matchedBt.totalReturnRate.toFixed(1)}%`,
                            live: `${liveReturn >= 0 ? '+' : ''}${liveReturn.toFixed(1)}%`,
                            liveColor: liveReturn >= 0 ? 'text-red-500' : 'text-blue-500',
                          },
                          {
                            label: '거래수',
                            bt: `${matchedBt.totalTrades}건`,
                            live: `${d.tradeCount}건`,
                            liveColor: isDark ? 'text-white' : 'text-gray-800',
                          },
                          {
                            label: '승률',
                            bt: '—',
                            live: liveWinRate != null ? `${liveWinRate.toFixed(1)}%` : '—',
                            liveColor: liveWinRate != null && liveWinRate >= 50 ? 'text-red-500' : liveWinRate != null ? 'text-blue-500' : (isDark ? 'text-slate-400' : 'text-gray-400'),
                          },
                        ].map(col => (
                          <div key={col.label} className="px-3 py-2.5 text-center">
                            <p className={`text-[10px] mb-1 ${subText}`}>{col.label}</p>
                            <div className="flex items-center justify-center gap-1.5">
                              <span className={`text-[11px] line-through ${subText}`}>{col.bt}</span>
                              <span className="text-[10px] text-gray-400">→</span>
                              <span className={`text-[12px] font-bold ${col.liveColor}`}>{col.live}</span>
                            </div>
                            <p className={`text-[9px] mt-0.5 ${subText}`}>예상 → 실전</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── 실행 로그 ── */}
                  <div className={`mb-3 rounded-xl border overflow-hidden ${isDark ? 'border-white/[0.08]' : 'border-gray-100'}`}>
                    <button
                      onClick={() => loadOrders(d.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-[11px] font-semibold transition-colors ${isDark ? 'text-slate-300 hover:bg-white/[0.03]' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                      <span className="flex items-center gap-1.5">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                        </svg>
                        실행 로그
                        {logsData !== undefined && (
                          <span className={`font-mono ${subText}`}>({logsData.length}건)</span>
                        )}
                      </span>
                      <span>{logsLoading[d.id] ? '불러오는 중…' : logsOpen ? '▲ 접기' : '▼ 펼치기'}</span>
                    </button>
                    {logsOpen && !logsLoading[d.id] && (
                      <div className={`border-t ${divBorder} max-h-[260px] overflow-y-auto`}>
                        {!logsData || logsData.length === 0 ? (
                          <p className={`py-6 text-center text-xs ${subText}`}>아직 실행된 주문이 없습니다.</p>
                        ) : (
                          [...logsData].reverse().map(log => {
                            const isBuy = log.side === 'BUY';
                            const isFilled = log.status === 'FILLED';
                            return (
                              <div key={log.id} className={`grid grid-cols-[auto_1fr_auto] items-center gap-2 px-3 py-2.5 border-b last:border-b-0 ${divBorder}`}>
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isFilled ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`text-[11px] font-bold ${isBuy ? 'text-red-500' : 'text-blue-500'}`}>{isBuy ? '매수' : '매도'}</span>
                                    <span className={`text-[11px] font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>{log.symbol}</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'bg-white/[0.06] text-slate-400' : 'bg-gray-100 text-gray-500'}`}>{REASON_LABEL[log.reason] ?? log.reason}</span>
                                  </div>
                                  <div className={`text-[10px] mt-0.5 ${subText}`}>
                                    {formatNum(log.quantity, 4)}개 · {formatKRW(log.price)} · {isFilled ? '체결' : '미체결'}
                                  </div>
                                </div>
                                <span className={`text-[10px] shrink-0 ${subText}`}>{formatLogTime(log.createdAt)}</span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>

                  {/* 액션 버튼 */}
                  <div className="flex items-center gap-2">
                    {d.status === 'RUNNING' && (
                      <button disabled={busyId === d.id || killSwitch} onClick={() => evaluateNow(d)}
                        title={killSwitch ? '전역 킬스위치가 켜져 있어 평가할 수 없습니다.' : undefined}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed ${isDark ? 'bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}>
                        지금 평가
                      </button>
                    )}
                    {d.status === 'RUNNING' ? (
                      <button disabled={busyId === d.id} onClick={() => changeStatus(d, 'pause')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${isDark ? 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'}`}>
                        일시정지
                      </button>
                    ) : (d.status === 'PAUSED' || d.status === 'STOPPED') ? (
                      <button disabled={busyId === d.id} onClick={() => changeStatus(d, 'start')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${isDark ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>
                        {d.status === 'STOPPED' ? '재가동' : '가동'}
                      </button>
                    ) : null}
                    {d.status !== 'STOPPED' && (
                      <button disabled={busyId === d.id} onClick={() => changeStatus(d, 'stop')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${isDark ? 'bg-red-500/15 text-red-300 hover:bg-red-500/25' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}>
                        정지
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 자동매매 시작 전 교육 게이트 모달 */}
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setShowGuide(false)}>
          <div
            className={`w-full max-w-md rounded-2xl shadow-2xl ${isDark ? 'bg-[var(--wa-card-bg,#0f1b2d)] border border-white/10' : 'bg-white'}`}
            onClick={e => e.stopPropagation()}
          >
            <div className={`px-6 py-5 border-b ${isDark ? 'border-white/10' : 'border-gray-100'}`}>
              <div className={`text-[10.5px] font-bold tracking-[.18em] mb-1 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>BEFORE YOU START</div>
              <h2 className={`text-[18px] font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>자동매매, 이것만 알고 시작해요</h2>
              <p className={`text-[12px] mt-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>3분이면 충분합니다. 모의투자라 돈 걱정은 없어요.</p>
            </div>
            <div className="px-6 py-4 space-y-3.5">
              {[
                {
                  icon: '🎭',
                  title: '이건 가상 돈입니다',
                  body: '실제 내 계좌 돈이 나가지 않아요. 시스템이 ₩1,000만 가상 자금으로 연습합니다. 잘못 눌러도 괜찮아요.',
                },
                {
                  icon: '📡',
                  title: '봉 단위 평가 = 정해진 시간마다 신호 확인',
                  body: '"1시간봉"이면 1시간마다 한 번 조건을 체크합니다. 조건에 맞으면 자동으로 사고 팔아요.',
                },
                {
                  icon: '🛡️',
                  title: '손절 설정을 꼭 하세요',
                  body: '손절 없이 운영하면 손실이 계속 쌓일 수 있어요. 예: -5% 손절 = 매수가 대비 5% 하락 시 자동 매도.',
                },
                {
                  icon: '⏸️',
                  title: '언제든 멈출 수 있어요',
                  body: '실행 중에도 일시정지 또는 중지 버튼으로 즉시 멈출 수 있고, 상단 킬스위치로 전체 정지도 가능합니다.',
                },
              ].map((item, i) => (
                <div key={i} className={`flex gap-3 rounded-[10px] p-3.5 ${isDark ? 'bg-white/[0.04]' : 'bg-gray-50'}`}>
                  <span className="text-[22px] shrink-0 mt-0.5">{item.icon}</span>
                  <div>
                    <div className={`text-[13px] font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>{item.title}</div>
                    <div className={`text-[11.5px] mt-0.5 leading-relaxed ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{item.body}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className={`px-6 py-4 border-t ${isDark ? 'border-white/10' : 'border-gray-100'}`}>
              <label className="flex items-center gap-2.5 cursor-pointer mb-2.5">
                <input type="checkbox" checked={guideChecked} onChange={e => setGuideChecked(e.target.checked)} className="w-4 h-4 rounded accent-blue-500" />
                <span className={`text-[13px] ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>위 내용을 읽고 이해했습니다</span>
              </label>
              <button onClick={() => navigate('/virt/learn?tab=mistakes')} className={`mb-4 text-[12px] font-semibold transition-opacity hover:opacity-80 ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>
                📚 자동매매가 처음이면 — 학습 노트 '흔한 실수'에서 손절·리스크 더 보기 →
              </button>
              <div className="flex gap-2.5">
                <button onClick={() => setShowGuide(false)} className={`flex-1 rounded-lg py-2.5 text-[13px] font-semibold ${isDark ? 'text-slate-300 border border-white/10 hover:bg-white/5' : 'text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
                  나중에
                </button>
                <button
                  onClick={() => confirmGuide(guideChecked)}
                  disabled={!guideChecked}
                  className="flex-[2] rounded-lg py-2.5 text-[13px] font-semibold text-white disabled:opacity-40"
                  style={{ background: guideChecked ? 'linear-gradient(135deg,#3b82f6,#2563eb)' : undefined, border: guideChecked ? 'none' : '1px solid var(--ci-line)' }}
                >
                  {guideChecked ? '이해했어요 — 자동매매 만들기 →' : '체크 후 진행할 수 있어요'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 생성 모달 */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => !creating && setShowCreate(false)}>
          <div
            className={`w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl ${isDark ? 'bg-[var(--wa-card-bg,#0f1b2d)] border border-white/10' : 'bg-white'}`}
            onClick={e => e.stopPropagation()}
          >
            <div className={`px-5 py-4 border-b ${isDark ? 'border-white/10' : 'border-gray-100'}`}>
              <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>새 자동매매 시작</h2>
              <p className={`text-xs mt-0.5 ${subText}`}>모의(가상자금) 자동매매입니다. 실계좌 매매는 준비 중입니다.</p>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div>
                <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>전략 *</label>
                <select
                  value={form.strategyId}
                  onChange={e => onSelectStrategy(e.target.value)}
                  className={`w-full rounded-lg border px-3 py-2 text-sm ${isDark ? 'bg-white/[0.04] border-white/10 text-white' : 'bg-white border-gray-300 text-gray-800'}`}
                >
                  <option value="">전략을 선택하세요</option>
                  <optgroup label="기본 제공 전략">
                    {PRESET_STRATEGIES.map(s => (
                      <option key={s.id} value={s.id}>{s.name}{s.difficulty ? ` · ${s.difficulty}` : ''}</option>
                    ))}
                  </optgroup>
                  {strategies.length > 0 && (
                    <optgroup label="내가 저장한 전략">
                      {strategies.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <p className={`text-[11px] mt-1 ${subText}`}>기본 제공 전략은 바로 가동할 수 있고, '전략' 페이지에서 만든 내 전략도 선택할 수 있어요.</p>
              </div>

              <div>
                <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>계좌 종류</label>
                <select
                  value={form.accountKind}
                  onChange={e => setForm(prev => ({ ...prev, accountKind: e.target.value }))}
                  className={`w-full rounded-lg border px-3 py-2 text-sm ${isDark ? 'bg-white/[0.04] border-white/10 text-white' : 'bg-white border-gray-300 text-gray-800'}`}
                >
                  <option value="PAPER">모의투자 (가상자금)</option>
                  <option value="KIS">KIS 모의투자 연동 (실제 자금 ❌)</option>
                </select>
                {form.accountKind === 'KIS' && (
                  <p className={`text-[11px] mt-1 ${subText}`}>
                    KIS <b>모의투자(VTS)</b> 서버에 연동해 주문합니다 — <b>실제 돈은 나가지 않습니다.</b>
                    거래소 연동에서 KIS 키를 먼저 등록하고, 대상 종목은 <b>국내주식 코드(예: 005930)</b>,
                    한국 장중에만 체결 · 비상 시 상단 킬스위치로 전체 정지.
                    <br />※ 실계좌(실제 자금) 자동매매는 자본시장법 검토 후 별도 제공 예정입니다.
                  </p>
                )}
              </div>

              <div>
                <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>대상 종목 (쉼표 구분)</label>
                <input
                  value={form.targetAssetsText}
                  onChange={e => setForm(prev => ({ ...prev, targetAssetsText: e.target.value }))}
                  placeholder="예: BTC, ETH 또는 005930, AAPL"
                  className={`w-full rounded-lg border px-3 py-2 text-sm ${isDark ? 'bg-white/[0.04] border-white/10 text-white placeholder-slate-500' : 'bg-white border-gray-300 text-gray-800'}`}
                />
                <p className={`text-[11px] mt-1 ${subText}`}>비워두면 전략의 기본 종목을 사용합니다.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>할당 금액 (원) *</label>
                  <input
                    type="number"
                    value={form.allocatedCash}
                    onChange={e => setForm(prev => ({ ...prev, allocatedCash: e.target.value }))}
                    className={`w-full rounded-lg border px-3 py-2 text-sm ${isDark ? 'bg-white/[0.04] border-white/10 text-white' : 'bg-white border-gray-300 text-gray-800'}`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>평가 주기</label>
                  <select
                    value={form.interval}
                    onChange={e => setForm(prev => ({ ...prev, interval: e.target.value }))}
                    className={`w-full rounded-lg border px-3 py-2 text-sm ${isDark ? 'bg-white/[0.04] border-white/10 text-white' : 'bg-white border-gray-300 text-gray-800'}`}
                  >
                    <option value="1h">1시간봉</option>
                    <option value="1d">일봉</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className={`block text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>리스크 관리 (%, 선택)</label>
                  <button type="button"
                    onClick={() => setForm(prev => ({ ...prev, stopLossPct: '5', takeProfitPct: '10' }))}
                    className={`text-[11px] font-semibold rounded-md px-2 py-1 ${isDark ? 'bg-blue-500/15 text-blue-300 hover:bg-blue-500/25' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}>
                    💡 초보자 추천값 (손절 5%·익절 10%)
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { k: 'stopLossPct', name: '손절', ph: '예: 5', max: 100 },
                    { k: 'takeProfitPct', name: '익절', ph: '예: 10', max: undefined },
                    { k: 'trailingStopPct', name: '트레일링', ph: '예: 3', max: 100 },
                  ] as const).map(f => (
                    <div key={f.k}>
                      <div className={`text-[10.5px] font-semibold text-center mb-0.5 ${subText}`}>{f.name}</div>
                      <input type="number" min={0} max={f.max} step="any" placeholder={f.ph} value={form[f.k]}
                        onChange={e => setForm(prev => ({ ...prev, [f.k]: e.target.value }))}
                        className={`w-full rounded-lg border px-2 py-2 text-sm text-center ${isDark ? 'bg-white/[0.04] border-white/10 text-white placeholder-slate-500' : 'bg-white border-gray-300 text-gray-800'}`} />
                    </div>
                  ))}
                </div>
                <div className={`mt-1.5 text-[11px] leading-relaxed ${subText}`}>
                  <b>손절</b> 5% = 매수가보다 5% 떨어지면 자동 매도(손실 제한) · <b>익절</b> 10% = 10% 오르면 차익실현 · <b>트레일링</b> = 최고가 대비 % 떨어지면 매도. 비워두면 미적용됩니다.
                </div>
              </div>

              <div>
                <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>일일 손실한도 (원, 선택)</label>
                <input type="number" placeholder="예: 100000" value={form.dailyLossLimit}
                  onChange={e => setForm(prev => ({ ...prev, dailyLossLimit: e.target.value }))}
                  className={`w-full rounded-lg border px-3 py-2 text-sm ${isDark ? 'bg-white/[0.04] border-white/10 text-white placeholder-slate-500' : 'bg-white border-gray-300 text-gray-800'}`} />
                <p className={`text-[11px] mt-1 ${subText}`}>오늘 실현손실이 이 금액에 도달하면 자동으로 일시정지됩니다.</p>
              </div>
            </div>

            <div className={`px-5 py-4 border-t flex justify-end gap-2 ${isDark ? 'border-white/10' : 'border-gray-100'}`}>
              <button onClick={() => setShowCreate(false)} disabled={creating}
                className={`px-4 py-2 rounded-lg text-sm font-semibold ${isDark ? 'text-slate-300 hover:bg-white/5' : 'text-gray-600 hover:bg-gray-100'}`}>
                취소
              </button>
              <button onClick={handleCreate} disabled={creating || !form.strategyId}
                className={`px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors ${primaryBtn}`}>
                {creating ? '시작 중...' : '자동매매 시작'}
              </button>
            </div>
          </div>
        </div>
      )}
    </HelmShell>
  );
};

export default AutoTradePage;
