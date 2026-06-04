import { useState, useEffect, useCallback } from 'react';
import Header from '../components/Header';
import SplashLoading from '../components/SplashLoading';
import VirtSplashLoading from '../components/VirtSplashLoading';
import Toast, { type ToastItem } from '../components/Toast';
import { useRoutePrefix } from '../hooks/useRoutePrefix';
import { useTheme } from '../contexts/ThemeContext';
import { strategyService, type Strategy } from '../services/strategyService';
import { PRESET_STRATEGIES } from '../data/presetStrategies';
import {
  liveTradeService,
  type Deployment,
  type DeploymentStatus,
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

const AutoTradePage = () => {
  const { isVirt } = useRoutePrefix();
  const { isDark } = useTheme();

  const [pageLoading, setPageLoading] = useState(true);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [killSwitch, setKillSwitch] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // 생성 모달
  const [showCreate, setShowCreate] = useState(false);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    strategyId: '',
    allocatedCash: '1000000',
    targetAssetsText: '',
    assetType: '',
    interval: '1h',
    stopLossPct: '',
    takeProfitPct: '',
    trailingStopPct: '',
    dailyLossLimit: '',
  });

  // 토스트
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const pushToast = useCallback((type: ToastItem['type'], title: string, message = '') => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);
  const dismissToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

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
    // 30초마다 갱신 (스케줄러 평가 반영)
    const timer = setInterval(loadData, 30_000);
    return () => clearInterval(timer);
  }, [loadData]);

  const openCreate = async () => {
    setShowCreate(true);
    if (strategies.length === 0) {
      try {
        setStrategies(await strategyService.getStrategies());
      } catch (e) {
        pushToast('error', '전략 목록 실패', errMsg(e));
      }
    }
  };

  // 프리셋(기본 제공) + 내가 저장한 전략 모두 선택 가능
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
    const targetAssets = form.targetAssetsText.split(',').map(s => s.trim()).filter(Boolean);

    const selected = allStrategies.find(s => s.id === form.strategyId);
    const isPreset = form.strategyId.startsWith('preset-');

    setCreating(true);
    try {
      await liveTradeService.createDeployment({
        // 프리셋은 DB에 없으므로 조건을 직접 전송, 저장 전략은 strategyId로
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
        accountMode: 'PAPER',
        brokerType: 'MOCK',
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
    } catch (e) {
      pushToast('error', '킬스위치 실패', errMsg(e));
    }
  };

  if (pageLoading && isDark) return <SplashLoading message="자동매매 정보를 불러오는 중..." />;
  if (pageLoading && isVirt) return <VirtSplashLoading message="자동매매 정보를 불러오는 중..." />;
  if (pageLoading) return <SplashLoading message="자동매매 정보를 불러오는 중..." />;

  const card = isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-white border-gray-200';
  const subText = isDark ? 'text-slate-400' : 'text-gray-500';
  const primaryBtn = isDark
    ? 'bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/30'
    : 'bg-whale-light text-white hover:bg-blue-600';

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[var(--wa-page-bg)] text-white' : 'bg-gray-50'}`}>
      <Toast toasts={toasts} onDismiss={dismissToast} />
      <Header showNav={true} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
              return (
                <div key={d.id} className={`rounded-2xl border p-5 ${card}`}>
                  {/* 카드 헤더 */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={`text-base font-bold truncate ${isDark ? 'text-white' : 'text-gray-800'}`}>{d.strategyName}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          d.accountMode === 'LIVE'
                            ? (isDark ? 'bg-red-500/15 text-red-400' : 'bg-red-50 text-red-600')
                            : (isDark ? 'bg-blue-500/15 text-blue-300' : 'bg-blue-50 text-blue-600')
                        }`}>
                          {d.accountMode === 'LIVE' ? '실계좌' : '모의'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${isDark ? sm.dark : sm.light}`}>{sm.label}</span>
                      </div>
                      <p className={`mt-1 text-xs ${subText}`}>
                        {(d.targetAssets || []).join(', ')} · {d.assetType || '-'} · {d.interval} · 마지막 평가 {formatTime(d.lastEvaluatedAt)}
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

                  {/* 포지션 */}
                  <div className={`rounded-lg border divide-y ${isDark ? 'border-white/[0.06] divide-white/[0.06]' : 'border-gray-100 divide-gray-100'} mb-3`}>
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

                  {/* 액션 */}
                  <div className="flex items-center gap-2">
                    {d.status === 'RUNNING' && (
                      <button disabled={busyId === d.id} onClick={() => evaluateNow(d)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${isDark ? 'bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}>
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
              {/* 전략 선택 */}
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

              {/* 대상 종목 */}
              <div>
                <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>대상 종목 (쉼표 구분)</label>
                <input
                  value={form.targetAssetsText}
                  onChange={e => setForm(prev => ({ ...prev, targetAssetsText: e.target.value }))}
                  placeholder="예: BTC, ETH 또는 005930, AAPL"
                  className={`w-full rounded-lg border px-3 py-2 text-sm ${isDark ? 'bg-white/[0.04] border-white/10 text-white placeholder-slate-500' : 'bg-white border-gray-300 text-gray-800'}`}
                />
                <p className={`text-[11px] mt-1 ${subText}`}>비워두면 전략의 기본 종목을 사용합니다. 자산군은 자동 판별됩니다.</p>
              </div>

              {/* 금액 / 인터벌 */}
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

              {/* 리스크 관리 (선택) */}
              <div>
                <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>리스크 관리 (%, 선택)</label>
                <div className="grid grid-cols-3 gap-2">
                  <input type="number" placeholder="손절" value={form.stopLossPct}
                    onChange={e => setForm(prev => ({ ...prev, stopLossPct: e.target.value }))}
                    className={`w-full rounded-lg border px-2 py-2 text-sm ${isDark ? 'bg-white/[0.04] border-white/10 text-white placeholder-slate-500' : 'bg-white border-gray-300 text-gray-800'}`} />
                  <input type="number" placeholder="익절" value={form.takeProfitPct}
                    onChange={e => setForm(prev => ({ ...prev, takeProfitPct: e.target.value }))}
                    className={`w-full rounded-lg border px-2 py-2 text-sm ${isDark ? 'bg-white/[0.04] border-white/10 text-white placeholder-slate-500' : 'bg-white border-gray-300 text-gray-800'}`} />
                  <input type="number" placeholder="트레일링" value={form.trailingStopPct}
                    onChange={e => setForm(prev => ({ ...prev, trailingStopPct: e.target.value }))}
                    className={`w-full rounded-lg border px-2 py-2 text-sm ${isDark ? 'bg-white/[0.04] border-white/10 text-white placeholder-slate-500' : 'bg-white border-gray-300 text-gray-800'}`} />
                </div>
                <p className={`text-[11px] mt-1 ${subText}`}>손절·트레일링은 0~100% 사이로 입력하세요.</p>
              </div>

              {/* 일일 손실한도 (선택) */}
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
    </div>
  );
};

export default AutoTradePage;
