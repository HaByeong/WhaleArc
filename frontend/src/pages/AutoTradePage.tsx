import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import HelmShell from '../components/HelmShell';
import FunnelSteps from '../components/FunnelSteps';
import Toast, { type ToastItem } from '../components/Toast';
import { useRoutePrefix } from '../hooks/useRoutePrefix';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { strategyService, type Strategy, type BacktestHistoryItem } from '../services/strategyService';
import { PRESET_STRATEGIES, type PresetStrategy, TURTLE_PRESET_ID, TURTLE_DEFAULTS, buildTurtleConditions, type TurtleParams } from '../data/presetStrategies';
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

/* ── 디자인 개편: 시안(auto-app.jsx) 비주얼 프리미티브 ── */
const GREEN = '#3fd6a0';   // 가동 중(상승 아님) 표시용 청록
const UP = '#ef4d4d';      // 수익(한국식 빨강)
const DOWN = '#4d8aff';    // 손실(파랑)

// 종목 심볼 배지 (코인=풀심볼, 주식=앞 2자)
const SymBadge = ({ sym }: { sym: string }) => {
  const isCrypto = /^[A-Z]{2,5}$/.test(sym) && !/^\d/.test(sym);
  return (
    <span style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: sym.length > 4 ? 11 : 13, fontWeight: 700, letterSpacing: '.02em',
      fontFamily: "'JetBrains Mono',ui-monospace,monospace",
      background: 'linear-gradient(135deg, rgba(91,157,255,.22), rgba(44,111,230,.10))',
      border: '1px solid rgba(91,157,255,.28)', color: 'var(--ci-sonar)' }}>
      {isCrypto ? sym : sym.slice(0, 2)}
    </span>
  );
};

// 상태 pill (가동 중·일시정지·정지됨·오류)
const STATUS_PILL: Record<DeploymentStatus, { t: string; c: string; bg: string; bd: string; pulse: boolean }> = {
  RUNNING: { t: '가동 중', c: GREEN, bg: 'rgba(63,214,160,.12)', bd: 'rgba(63,214,160,.30)', pulse: true },
  PAUSED: { t: '일시정지', c: '#f5d061', bg: 'rgba(245,208,97,.12)', bd: 'rgba(245,208,97,.32)', pulse: false },
  STOPPED: { t: '정지됨', c: 'var(--ci-ink2)', bg: 'rgba(255,255,255,.05)', bd: 'var(--ci-line)', pulse: false },
  ERROR: { t: '오류', c: '#ff8a8a', bg: 'rgba(239,77,77,.12)', bd: 'rgba(239,77,77,.32)', pulse: false },
};
const StatusPill = ({ status }: { status: DeploymentStatus }) => {
  const m = STATUS_PILL[status];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 11px', borderRadius: 999,
      fontSize: 11.5, fontWeight: 700, color: m.c, background: m.bg, border: `1px solid ${m.bd}`, whiteSpace: 'nowrap' }}>
      <span className={m.pulse ? 'animate-pulse-dot' : ''} style={{ width: 6, height: 6, borderRadius: '50%', background: m.c, boxShadow: `0 0 8px ${m.c}` }} />
      {m.t}
    </span>
  );
};

// 메타 칩
const Chip = ({ children }: { children: ReactNode }) => (
  <span style={{ padding: '4px 10px', borderRadius: 8, fontSize: 11.5, fontWeight: 600, color: 'var(--ci-ink1)',
    background: 'var(--ci-chip)', border: '1px solid var(--ci-line)' }}>{children}</span>
);

// 관제 덱 통계 셀
const DeckStat = ({ label, value, color, mono }: { label: string; value: string; color?: string; mono?: boolean }) => (
  <div style={{ padding: '13px 14px', borderRadius: 12, background: 'var(--ci-card)', border: '1px solid var(--ci-line)' }}>
    <div style={{ fontSize: 10.5, letterSpacing: '.1em', color: 'var(--ci-ink3)', fontWeight: 600 }}>{label}</div>
    <div className={mono ? 'font-mono' : ''} style={{ marginTop: 6, fontSize: 18, fontWeight: 700, letterSpacing: '-.01em', color: color || 'var(--ci-ink0)' }}>{value}</div>
  </div>
);

// 그라데이션 프라이머리 버튼 (＋ 새 자동매매)
const PrimaryBtn = ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
  <button onClick={onClick} style={{ position: 'relative', padding: '12px 18px', borderRadius: 13, cursor: 'pointer',
    fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, letterSpacing: '-.01em',
    border: '1px solid rgba(165,200,255,.6)', color: 'rgba(255,255,255,.98)',
    background: 'linear-gradient(180deg, #5690f2 0%, #3673e2 100%)',
    boxShadow: '0 14px 26px -14px rgba(43,110,230,.6), inset 0 1px 0 rgba(255,255,255,.4)',
    display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
    <span style={{ fontSize: 16, lineHeight: 0, marginTop: -1 }}>＋</span>{children}
  </button>
);

// 손익 스파크라인 (시안 auto-app.jsx의 Spark) — equitySpark(%) 시계열을 SVG 라인+영역으로
const Spark = ({ data, up, idKey }: { data: number[]; up: boolean; idKey: string }) => {
  const w = 100, h = 34;
  const min = Math.min(...data), max = Math.max(...data), rng = (max - min) || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 3 - ((v - min) / rng) * (h - 6)] as const);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = `${line} L${w} ${h} L0 ${h} Z`;
  const col = up ? UP : DOWN;
  const gid = `spark-${idKey}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={col} stopOpacity={0.26} />
          <stop offset="100%" stopColor={col} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={col} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

// '최근 신호' 포맷 헬퍼
const sideKr = (s?: string) => (s === 'BUY' ? '매수' : s === 'SELL' ? '매도' : '');
const orderStatusKr = (s?: string) => (s === 'FILLED' ? '체결' : s === 'REJECTED' ? '거부' : s === 'SUBMITTED' ? '접수' : '');
const relTime = (iso?: string) => {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (isNaN(t)) return '';
  const m = Math.floor((Date.now() - t) / 60_000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
};

const REASON_LABEL: Record<string, string> = {
  ENTRY: '진입 신호',
  STOP: '손절',
  TAKE_PROFIT: '익절',
  EXIT_SIGNAL: '청산 신호',
  TRAILING_STOP: '트레일링 손절',
  MANUAL: '수동 청산',
};

const AutoTradePage = () => {
  const navigate = useNavigate();
  const { isVirt } = useRoutePrefix();
  const isLive = !isVirt;                 // 일반 섹션=실거래(실제 돈), /virt=모의(가상자금)
  const modeLabel = isLive ? '실거래' : '모의';
  const { isDark } = useTheme();
  const { session, canAutoTrade, onboardingDone } = useAuth();
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
    brokerType: 'KIS',          // 실거래 브로커 (KIS 국내·미국주식 / BITGET 코인). 모의는 항상 MOCK.
    marketType: 'SPOT',         // Bitget 전용: SPOT(현물) / FUTURES(선물·레버리지)
    leverage: '5',              // 선물 레버리지 배수
    allocatedCash: '1000000',
    targetAssetsText: '',
    assetType: '',
    interval: '1h',
    stopLossPct: '',
    takeProfitPct: '',
    trailingStopPct: '',
    dailyLossLimit: '',
  });
  const [turtle, setTurtle] = useState<TurtleParams>(TURTLE_DEFAULTS); // 터틀 전용 설정(채널 기간·ADX·유닛)

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

  // 백테스트 → "자동매매 시작" 딥링크(?deploy=<전략id>): 그 전략이 선택된 채로 생성 모달 자동 오픈
  useEffect(() => {
    const deployId = new URLSearchParams(window.location.search).get('deploy');
    if (!deployId) return;
    (async () => {
      let strats = strategies;
      if (strats.length === 0) {
        try { strats = await strategyService.getStrategies(); setStrategies(strats); } catch { /* 전략 로드 실패 시 빈 선택으로라도 모달은 연다 */ }
      }
      const s = [...PRESET_STRATEGIES, ...strats].find(st => st.id === deployId);
      // 전략을 찾았을 때만 선택 세팅(없으면 빈 모달 — 잘못된 id로 배포 시도 방지)
      if (s) setForm(prev => ({
        ...prev,
        strategyId: deployId,
        targetAssetsText: s.targetAssets.join(', '),
        assetType: s.assetType === 'MIXED' ? '' : s.assetType,
      }));
      setShowCreate(true);
      window.history.replaceState({}, '', window.location.pathname);   // 새로고침 시 재오픈 방지
    })();
    // 마운트 시 1회만 (deploy 파라미터 처리)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // 모의/실거래 별도 키 — 모의에서 '다시 보지 않기' 해도 실거래 경고는 따로 노출
    const guideKey = `wa_autotrade_guide_${isLive ? 'live' : 'paper'}`;
    const guideSeen = (() => { try { return localStorage.getItem(guideKey) === '1'; } catch { return false; } })();
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
    if (neverAgain) { try { localStorage.setItem(`wa_autotrade_guide_${isLive ? 'live' : 'paper'}`, '1'); } catch { /* localStorage 미지원 시 무시 */ } }
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

    // 선물 레버리지 검증 (Bitget 선물에서만)
    if (isLive && form.brokerType === 'BITGET' && form.marketType === 'FUTURES') {
      const lev = Number(form.leverage);
      if (!Number.isInteger(lev) || lev < 1 || lev > 10) {
        pushToast('error', '레버리지 확인', '레버리지는 1~10배의 정수로 입력해주세요.');
        return;
      }
    }

    const selected = allStrategies.find(s => s.id === form.strategyId);
    const isPreset = form.strategyId.startsWith('preset-');
    const typedAssets = form.targetAssetsText.split(',').map(s => s.trim()).filter(Boolean);
    const targetAssets = typedAssets.length ? typedAssets : (isPreset ? (selected?.targetAssets ?? []) : []);

    setCreating(true);
    try {
      const presetSel = selected as PresetStrategy | undefined;
      // 터틀이면 설정 패널 파라미터로 지표·조건을 즉석 생성(채널 기간·ADX). 그 외 프리셋은 정의값 그대로.
      const isTurtle = isPreset && form.strategyId === TURTLE_PRESET_ID;
      const turtleCond = isTurtle ? buildTurtleConditions(turtle) : null;
      await liveTradeService.createDeployment({
        ...(isPreset
          ? {
              strategyName: selected?.name,
              indicators: turtleCond?.indicators ?? selected?.indicators,
              entryConditions: turtleCond?.entryConditions ?? selected?.entryConditions,
              exitConditions: turtleCond?.exitConditions ?? selected?.exitConditions,
              // 독립 양방향(터틀)·피라미딩 권장값 전달. 숏은 백엔드에서 Bitget 선물/MOCK만 허용.
              shortEntryConditions: turtleCond?.shortEntryConditions ?? presetSel?.shortEntryConditions,
              shortExitConditions: turtleCond?.shortExitConditions ?? presetSel?.shortExitConditions,
              tradeDirection: presetSel?.tradeDirection,
              maxUnits: isTurtle ? turtle.maxUnits : presetSel?.maxPositions,
              pyramidMode: presetSel?.pyramidMode,
            }
          : { strategyId: form.strategyId }),
        allocatedCash,
        targetAssets: targetAssets.length ? targetAssets : undefined,
        assetType: form.assetType || undefined,
        interval: form.interval,
        accountMode: isLive ? 'LIVE' : 'PAPER',   // 섹션으로 고정 (일반=실거래, /virt=모의)
        brokerType: isLive ? (form.brokerType as 'KIS' | 'BITGET') : 'MOCK',
        ...(isLive && form.brokerType === 'BITGET'
          ? {
              marketType: form.marketType as 'SPOT' | 'FUTURES',
              ...(form.marketType === 'FUTURES' ? { leverage: Number(form.leverage) } : {}),
            }
          : {}),
        stopLossPct: form.stopLossPct ? Number(form.stopLossPct) : undefined,
        takeProfitPct: form.takeProfitPct ? Number(form.takeProfitPct) : undefined,
        trailingStopPct: form.trailingStopPct ? Number(form.trailingStopPct) : undefined,
        dailyLossLimit: form.dailyLossLimit ? Number(form.dailyLossLimit) : undefined,
      });
      pushToast('success', '자동매매 시작', `${modeLabel} 자동매매가 가동되었습니다.`);
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

  const handleDelete = async (d: Deployment) => {
    if (!window.confirm(
      `'${d.strategyName}' 자동매매를 삭제할까요?\n\n` +
      `주의: 거래소에 열린 포지션이 있으면 앱에서 더 이상 추적되지 않습니다. 잔여 포지션은 거래소에서 직접 확인·정리하세요.`
    )) return;
    setBusyId(d.id);
    try {
      await liveTradeService.deleteDeployment(d.id);
      setDeployments(prev => prev.filter(x => x.id !== d.id));
      pushToast('success', '삭제됨', `'${d.strategyName}' 자동매매를 삭제했습니다.`);
    } catch (e) {
      pushToast('error', '삭제 실패', errMsg(e));
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

  const closeNow = async (d: Deployment) => {
    const hasPosition = (d.positions || []).some(p => p.direction !== 'NONE');   // 롱·숏 모두
    if (!hasPosition) { pushToast('error', '청산 불가', '보유 중인 포지션이 없습니다.'); return; }
    if (!window.confirm(`'${d.strategyName}'의 보유 포지션을 지금 시장가로 청산할까요?`)) return;
    setBusyId(d.id);
    try {
      const updated = await liveTradeService.closeNow(d.id);
      setDeployments(prev => prev.map(x => (x.id === d.id ? updated : x)));
      pushToast('success', '청산 완료', `'${d.strategyName}' 포지션을 청산했습니다.`);
      // 캐시된 실행 로그 무효화 — 다음에 펼칠 때 청산 주문이 반영되도록
      setOrderLogs(prev => { const n = { ...prev }; delete n[d.id]; return n; });
    } catch (e) {
      pushToast('error', '청산 실패', errMsg(e));
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
  // 이 섹션의 배포만 표시 (일반=실거래 LIVE, /virt=모의 PAPER) — 두 모드 섞임 방지
  const sectionDeployments = deployments.filter(d => (isLive ? d.accountMode === 'LIVE' : d.accountMode === 'PAPER'));
  // AUTOPILOT 관제 덱 집계 (이 섹션 기준)
  const runningCount = sectionDeployments.filter(d => d.status === 'RUNNING').length;
  const totalAlloc = sectionDeployments.reduce((a, d) => a + (d.allocatedCash || 0), 0) || 1;
  const totalPnl = sectionDeployments.reduce((a, d) => a + (d.realizedPnl || 0), 0);
  const aggPct = (totalPnl / totalAlloc) * 100;          // 할당금 가중 평가손익률
  const todayFills = sectionDeployments.reduce((a, d) => a + (d.todayFilledCount || 0), 0);  // 오늘(KST) 체결 수 합

  if (pageLoading) {
    return (
      <HelmShell active="autotrade" virt={isVirt} userName={userName} session={`${modeLabel} 자동매매`}>
        <div className={`py-24 text-center text-sm ${subText}`}>자동매매 정보를 불러오는 중...</div>
      </HelmShell>
    );
  }

  // 등급 게이팅: 실거래(일반 섹션)만 BASIC 이상(또는 ADMIN) 전용. 모의(/virt)는 누구나 가능.
  // 등급 확인 전엔 로딩으로(관리자 잠금화면 깜빡임 방지).
  if (isLive && onboardingDone === null) {
    return (
      <HelmShell active="autotrade" virt={isVirt} userName={userName} session={`${modeLabel} 자동매매`}>
        <div className={`py-24 text-center text-sm ${subText}`}>등급 정보를 확인하는 중...</div>
      </HelmShell>
    );
  }
  if (isLive && !canAutoTrade) {
    return (
      <HelmShell active="autotrade" virt={isVirt} userName={userName} session="자동매매 · 잠김">
        <div className="mx-auto max-w-md py-20 text-center">
          <div className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl ${isDark ? 'bg-white/[0.04]' : 'bg-gray-100'}`}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={isDark ? 'text-slate-300' : 'text-gray-500'}>
              <rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
          </div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-whale-dark'}`}>실거래 자동매매는 Basic 이상 전용</h1>
          <p className={`mt-3 text-sm leading-relaxed ${subText}`}>
            실제 자금으로 매매하는 <b>실거래 자동매매</b>는 <b>Basic 이상 등급</b>에서 이용할 수 있어요.
            <br /><b>모의 자동매매(가상자금)는 무료</b>이니 먼저 연습해보세요.
          </p>
          <div className="mt-6 flex items-center justify-center gap-2.5">
            <button onClick={() => navigate('/virt/auto-trade')} className={`rounded-xl px-5 py-3 text-sm font-semibold ${isDark ? 'bg-white/[0.06] text-white hover:bg-white/[0.1]' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}>
              모의로 연습하기
            </button>
            <button onClick={() => navigate('/billing')} className={`rounded-xl px-5 py-3 text-sm font-semibold ${primaryBtn}`}>
              요금제 보기 →
            </button>
          </div>
        </div>
      </HelmShell>
    );
  }

  return (
    <HelmShell active="autotrade" virt={isVirt} userName={userName} session={`${modeLabel} 자동매매`}>
      <Toast toasts={toasts} onDismiss={dismissToast} />
      <div className="mx-auto max-w-6xl">
        {/* 헤더 */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-5">
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-.02em', color: 'var(--ci-ink0)' }}>
              {modeLabel} 자동매매{isLive && <span className="ml-2 align-middle text-sm font-bold text-amber-500">⚠️ 실제 자금</span>}
            </h1>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--ci-ink1)', maxWidth: 620 }}>
              {`백테스트한 전략을 ${isLive ? '실제 자금으로' : '모의(가상) 자금으로'} 자동 매매합니다. 봉 단위(시간·일)로 신호를 평가해 주문합니다.`}
            </p>
          </div>
          <PrimaryBtn onClick={openCreate}>새 자동매매 시작</PrimaryBtn>
        </div>

        {isVirt && <div className="mb-5"><FunnelSteps current={3} /></div>}

        {/* AUTOPILOT 관제 덱 (좌: 상태·요약 / 우: 전역 킬스위치) */}
        <section style={{ position: 'relative', overflow: 'hidden', background: 'var(--ci-panel)', border: '1px solid var(--ci-line)', borderRadius: 16, boxShadow: 'var(--ci-panel-shadow)', marginBottom: 20 }}>
          <span aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: killSwitch ? 0.25 : 0.6, background: 'radial-gradient(120% 140% at 88% -20%, rgba(91,157,255,.16), transparent 55%)' }} />
          <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr]" style={{ position: 'relative' }}>
            {/* 좌 — 상태 + 요약 */}
            <div className="border-b md:border-b-0 md:border-r" style={{ padding: '24px 26px', borderColor: 'var(--ci-line)' }}>
              <div className="mb-3 flex items-center gap-2.5">
                <span className={killSwitch ? '' : 'animate-pulse-dot'} style={{ width: 8, height: 8, borderRadius: '50%', background: killSwitch ? 'var(--ci-ink3)' : GREEN, boxShadow: killSwitch ? 'none' : `0 0 10px ${GREEN}` }} />
                <span style={{ fontSize: 10.5, letterSpacing: '.2em', fontWeight: 700, color: killSwitch ? 'var(--ci-ink2)' : GREEN }}>AUTOPILOT · 자동 항해 관제</span>
              </div>
              <h2 style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-.02em', color: 'var(--ci-ink0)' }}>
                {killSwitch ? '전체 정지됨' : (runningCount ? `${runningCount}개 전략 가동 중` : '대기 중')}
              </h2>
              <p style={{ margin: '7px 0 20px', fontSize: 13, color: 'var(--ci-ink2)' }}>
                {killSwitch ? '킬스위치가 작동했습니다. 모든 자동매매가 멈췄습니다.' : `${isLive ? '실제' : '모의'} 자금으로 신호를 자동 평가·주문하고 있습니다.`}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                <DeckStat label="가동 중" value={`${runningCount}개`} />
                <DeckStat label={isLive ? '실현손익' : '모의 실현손익'} value={`${aggPct >= 0 ? '+' : ''}${aggPct.toFixed(2)}%`} color={killSwitch ? undefined : (aggPct > 0 ? UP : aggPct < 0 ? DOWN : undefined)} mono />
                <DeckStat label="오늘 체결" value={`${todayFills}회`} mono />
              </div>
            </div>
            {/* 우 — 전역 킬스위치 */}
            <div style={{ padding: '24px 26px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14 }}>
              <div className="flex items-center gap-2.5">
                <span style={{ fontSize: 15 }}>🛑</span>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ci-ink0)' }}>전역 킬스위치 {killSwitch ? '(작동 중)' : ''}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ci-ink2)', marginTop: 1 }}>{killSwitch ? '모든 자동매매가 정지되어 신호 평가를 건너뜁니다.' : '비상 시 모든 자동매매를 한 번에 멈춥니다.'}</div>
                </div>
              </div>
              {!killSwitch ? (
                <button onClick={toggleKillSwitch} className="flex items-center justify-center gap-2.5" style={{ padding: '15px 18px', borderRadius: 14, fontFamily: 'inherit', fontSize: 15, fontWeight: 700, letterSpacing: '-.01em', cursor: 'pointer', color: '#ff8a8a', background: 'rgba(239,77,77,.10)', border: '1px solid rgba(239,77,77,.45)', boxShadow: '0 14px 30px -16px rgba(239,77,77,.6), inset 0 1px 0 rgba(255,255,255,.06)' }}>
                  <span className="animate-pulse-dot" style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4d4d', boxShadow: '0 0 10px #ef4d4d' }} />
                  전체 정지
                </button>
              ) : (
                <button onClick={toggleKillSwitch} className="flex items-center justify-center gap-2.5" style={{ padding: '15px 18px', borderRadius: 14, fontFamily: 'inherit', fontSize: 15, fontWeight: 700, letterSpacing: '-.01em', cursor: 'pointer', color: 'rgba(255,255,255,.98)', border: '1px solid rgba(165,200,255,.6)', background: 'linear-gradient(180deg, #5690f2, #3673e2)', boxShadow: '0 14px 30px -16px rgba(43,110,230,.6), inset 0 1px 0 rgba(255,255,255,.4)' }}>
                  ↻ 전체 재가동
                </button>
              )}
            </div>
          </div>
        </section>

        {/* 가동 중인 자동매매 목록 헤더 */}
        <div className="mb-3 flex items-center justify-between" style={{ marginTop: 4 }}>
          <h2 className="flex items-center gap-2.5" style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-.01em', color: 'var(--ci-ink0)' }}>
            가동 중인 자동매매
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ci-sonar)', padding: '2px 9px', borderRadius: 999, background: 'var(--ci-sonar-dim)', border: '1px solid rgba(91,157,255,.28)' }}>{sectionDeployments.length}</span>
          </h2>
        </div>

        {/* 배포 목록 */}
        {sectionDeployments.length === 0 ? (
          <div className={`rounded-2xl border p-12 text-center ${card}`}>
            <p className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-700'}`}>가동 중인 자동매매가 없습니다</p>
            <p className={`mt-1 text-sm ${subText}`}>{`전략을 골라 ${modeLabel} 자동매매를 시작해보세요.`}</p>
            <button onClick={openCreate} className={`mt-4 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${primaryBtn}`}>
              + 새 자동매매 시작
            </button>
          </div>
        ) : (
          <div className="grid gap-[18px]" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
            {sectionDeployments.map(d => {
              const pnlPositive = (d.realizedPnl ?? 0) > 0;
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
              const firstSym = (d.targetAssets || [])[0] || d.strategyName.slice(0, 3);
              const dim = killSwitch || d.status === 'STOPPED';
              const nextLbl = nextEvalLabel(d);
              const hasSpark = (d.equitySpark?.length ?? 0) >= 2;
              const lo = d.lastOrder;
              const signalText = dim ? '정지됨'
                : (lo ? `${sideKr(lo.side)} ${orderStatusKr(lo.status)} · ${relTime(lo.createdAt)}` : '관망 · 신호 대기');
              const modeBadge = d.accountMode === 'LIVE'
                ? (d.brokerType === 'BITGET'
                    ? `Bitget ${d.marketType === 'FUTURES' ? `선물 ${d.leverage ?? ''}x` : '현물'}`
                    : 'KIS 실거래')
                : '모의';
              return (
                <div key={d.id} style={{ background: 'var(--ci-panel)', border: '1px solid var(--ci-line)', borderRadius: 16, boxShadow: 'var(--ci-panel-shadow)', display: 'flex', flexDirection: 'column', opacity: dim ? 0.66 : 1, transition: 'opacity .25s' }}>
                  <div style={{ padding: '18px 20px 16px', display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
                    {/* 헤더: 심볼 배지 + 전략명 + 상태 pill */}
                    <div className="flex items-center gap-3">
                      <SymBadge sym={firstSym} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate" style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-.01em', color: 'var(--ci-ink0)' }}>{d.strategyName}</div>
                        <div className="mt-0.5 truncate" style={{ fontSize: 12, color: 'var(--ci-ink2)' }}>
                          {(d.targetAssets || []).join(', ') || '기본 종목'}
                        </div>
                      </div>
                      <StatusPill status={d.status} />
                    </div>

                    {/* 메타 칩 */}
                    <div className="flex flex-wrap gap-1.5">
                      <Chip>{INTERVAL_LABELS[d.interval] ?? d.interval}</Chip>
                      <Chip>{isLive ? '실거래' : '모의'} {formatKRW(d.allocatedCash)}</Chip>
                      {isLive && <Chip>{modeBadge}</Chip>}
                      {d.assetType && <Chip>{d.assetType}</Chip>}
                    </div>

                    {/* 평가손익 + 손익 스파크라인 */}
                    <div style={{ display: 'grid', gridTemplateColumns: hasSpark ? '1fr 116px' : '1fr', gap: 14, alignItems: 'flex-end' }}>
                      <div>
                        <div style={{ fontSize: 10.5, letterSpacing: '.14em', color: 'var(--ci-ink3)', fontWeight: 600, marginBottom: 4 }}>{isLive ? '실현손익' : '모의 실현손익'}</div>
                        <div className="font-mono" style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', color: dim ? 'var(--ci-ink2)' : (liveReturn > 0 ? UP : liveReturn < 0 ? DOWN : 'var(--ci-ink0)') }}>
                          {liveReturn >= 0 ? '+' : ''}{liveReturn.toFixed(2)}%
                        </div>
                        <div className="font-mono" style={{ fontSize: 12, color: 'var(--ci-ink2)', marginTop: 2 }}>
                          {pnlPositive ? '+' : ''}{formatKRW(d.realizedPnl)}
                        </div>
                      </div>
                      {hasSpark && (
                        <div style={{ paddingBottom: 4, opacity: dim ? 0.5 : 1 }}>
                          <Spark data={d.equitySpark as number[]} up={liveReturn >= 0} idKey={d.id} />
                        </div>
                      )}
                    </div>

                    {/* 신호 행: 최근 평가 / 다음 평가 */}
                    <div className="flex items-center justify-between gap-3" style={{ padding: '11px 13px', borderRadius: 11, background: 'var(--ci-card)', border: '1px solid var(--ci-line)' }}>
                      <div className="min-w-0">
                        <div style={{ fontSize: 10.5, letterSpacing: '.12em', color: 'var(--ci-ink3)', fontWeight: 600 }}>최근 신호</div>
                        <div className="truncate" style={{ fontSize: 12.5, color: 'var(--ci-ink1)', marginTop: 3 }}>{signalText}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div style={{ fontSize: 10.5, letterSpacing: '.12em', color: 'var(--ci-ink3)', fontWeight: 600 }}>다음 평가</div>
                        <div className="font-mono" style={{ fontSize: 12.5, color: dim ? 'var(--ci-ink2)' : GREEN, marginTop: 3 }}>{dim ? '—' : (nextLbl || '대기')}</div>
                      </div>
                    </div>

                    {/* 체결 / 승 */}
                    <div className="flex items-center gap-4" style={{ fontSize: 12, color: 'var(--ci-ink2)' }}>
                      <span>거래 <b className="font-mono" style={{ color: 'var(--ci-ink0)', fontWeight: 700 }}>{d.tradeCount}</b>회</span>
                      <span style={{ width: 1, height: 11, background: 'var(--ci-line-strong)' }} />
                      <span>승 <b className="font-mono" style={{ color: 'var(--ci-ink0)', fontWeight: 700 }}>{d.winCount}</b>회{liveWinRate != null ? ` · 승률 ${liveWinRate.toFixed(0)}%` : ''}</span>
                    </div>

                  {/* 일일 손실한도 */}
                  {d.dailyLossLimit != null && d.dailyLossLimit > 0 && (() => {
                    const today = d.todayRealizedPnl ?? 0;
                    const ratio = Math.min(1, Math.max(0, -today) / d.dailyLossLimit);
                    const near = ratio >= 0.8;
                    return (
                      <div>
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

                  {/* 포지션 (감시 중인 종목 — 보유/대기) */}
                  {(d.positions || []).length > 0 && (
                  <div className={`rounded-lg border divide-y ${divBorder} ${divideY}`}>
                    {(d.positions || []).map(p => (
                      <div key={p.symbol} className="flex items-center justify-between px-3 py-2 text-xs">
                        <span className={`font-medium ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>{p.symbol}</span>
                        <span className="flex items-center gap-2">
                          {p.direction === 'NONE' ? (
                            <span className={subText}>대기</span>
                          ) : (
                            <>
                              <span className={`px-1.5 py-0.5 rounded font-bold ${
                                p.direction === 'SHORT'
                                  ? (isDark ? 'bg-blue-500/15 text-blue-400' : 'bg-blue-50 text-blue-600')
                                  : (isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-600')
                              }`}>{p.direction === 'SHORT' ? '숏 보유' : '보유'}</span>
                              <span className={subText}>{formatNum(p.quantity)}주 @ {formatNum(p.avgPrice, 2)}</span>
                            </>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                  )}

                  {/* ── 백테스트 vs 실전 비교 ── */}
                  {matchedBt && (
                    <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-white/[0.08]' : 'border-gray-100'}`}>
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
                  <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-white/[0.08]' : 'border-gray-100'}`}>
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

                  </div>

                  {/* 액션 버튼 (카드 푸터) */}
                  <div className="flex flex-wrap items-center gap-2" style={{ padding: '12px 14px', borderTop: '1px solid var(--ci-line)' }}>
                    {d.status === 'RUNNING' && (
                      <button disabled={busyId === d.id || killSwitch} onClick={() => evaluateNow(d)}
                        title={killSwitch ? '전역 킬스위치가 켜져 있어 평가할 수 없습니다.' : undefined}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed ${isDark ? 'bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}>
                        지금 평가
                      </button>
                    )}
                    {/* 지금 청산 — 보유 포지션(롱·숏)이 있을 때(신호/익절손절 안 기다리고 즉시 시장가 청산) */}
                    {(d.positions || []).some(p => p.direction !== 'NONE') && (
                      <button disabled={busyId === d.id} onClick={() => closeNow(d)}
                        title="보유 포지션 전부 시장가 청산"
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${isDark ? 'bg-orange-500/15 text-orange-300 hover:bg-orange-500/25' : 'bg-orange-50 text-orange-700 hover:bg-orange-100'}`}>
                        지금 청산
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
                    {/* 삭제 — 가동 중이 아니고 + 열린 포지션(롱·숏)이 없을 때만(있으면 먼저 '지금 청산') */}
                    {d.status !== 'RUNNING' && !(d.positions || []).some(p => p.direction !== 'NONE') && (
                      <button disabled={busyId === d.id} onClick={() => handleDelete(d)}
                        title="자동매매 카드 삭제 (거래소 포지션은 직접 정리 필요)"
                        className={`ml-auto px-3 py-1.5 rounded-lg text-xs font-semibold ${isDark ? 'bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-red-300' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-red-600'}`}>
                        삭제
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
            className={`w-full max-w-md rounded-2xl shadow-2xl border ${isDark ? 'border-white/10' : 'border-gray-200'}`}
            style={{ background: 'var(--ci-overlay)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className={`px-6 py-5 border-b ${isDark ? 'border-white/10' : 'border-gray-100'}`}>
              <div className={`text-[10.5px] font-bold tracking-[.18em] mb-1 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>BEFORE YOU START</div>
              <h2 className={`text-[18px] font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>자동매매, 이것만 알고 시작해요</h2>
              <p className={`text-[12px] mt-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{isLive ? '3분이면 충분합니다. 실제 자금이 오가니 꼭 확인하세요.' : '3분이면 충분합니다. 모의투자라 돈 걱정은 없어요.'}</p>
            </div>
            <div className="px-6 py-4 space-y-3.5">
              {[
                isLive
                  ? {
                      icon: '💸',
                      title: '실제 자금이 거래됩니다',
                      body: '주문이 체결되면 진짜 내 돈이 사고팔립니다. 손실도 실제예요 — 소액으로 시작하고 손절·일일 손실한도를 꼭 설정하세요.',
                    }
                  : {
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
            className={`w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl border ${isDark ? 'border-white/10' : 'border-gray-200'}`}
            style={{ background: 'var(--ci-overlay)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ position: 'relative', overflow: 'hidden', padding: '20px 24px', background: 'linear-gradient(105deg, #142647 0%, #1d3c7a 52%, #2c6fe6 100%)', borderBottom: '1px solid rgba(255,255,255,.14)' }}>
              <span aria-hidden style={{ position: 'absolute', right: -30, top: -40, width: 150, height: 150, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,.14), transparent 70%)' }} />
              <div style={{ position: 'relative' }}>
                <div style={{ fontSize: 10.5, letterSpacing: '.2em', color: 'rgba(255,255,255,.8)', fontWeight: 700 }}>NEW AUTOPILOT</div>
                <h2 style={{ margin: '5px 0 0', fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,.97)' }}>새 {modeLabel} 자동매매 시작</h2>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'rgba(255,255,255,.75)' }}>{isLive ? '실전 계좌(KIS·Bitget)에 직접 주문하는 실거래입니다 (실제 자금 ⚠️).' : '가상자금으로 안전하게 연습하는 모의 자동매매입니다. 실제 돈은 나가지 않습니다.'}</p>
              </div>
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

              {/* 터틀 전용 설정 — 채널 기간·ADX·유닛 (종목별로 조정) */}
              {form.strategyId === TURTLE_PRESET_ID && (
                <div className={`rounded-lg border p-3 ${isDark ? 'border-sky-400/30 bg-sky-400/[0.06]' : 'border-sky-300 bg-sky-50'}`}>
                  <div className={`text-xs font-bold mb-2 ${isDark ? 'text-sky-300' : 'text-sky-700'}`}>🐢 터틀 설정 (종목별로 조정)</div>
                  <div className="grid grid-cols-2 gap-2">
                    {([['entryPeriod', '진입 채널', 5], ['exitPeriod', '청산 채널', 2], ['adxThreshold', 'ADX 임계', 0], ['maxUnits', '최대 유닛', 1]] as const).map(([k, label, min]) => (
                      <label key={k} className="flex flex-col gap-1">
                        <span className={`text-[10.5px] ${subText}`}>{label}</span>
                        <input type="number" min={min} step={1} value={turtle[k]}
                          onChange={e => setTurtle({ ...turtle, [k]: Number(e.target.value) || min })}
                          className={`rounded-lg border px-2 py-1.5 text-sm ${isDark ? 'bg-white/[0.04] border-white/10 text-white' : 'bg-white border-gray-300 text-gray-800'}`} />
                      </label>
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button type="button" onClick={() => setTurtle({ ...turtle, entryPeriod: 100, exitPeriod: 30, adxThreshold: 15, maxUnits: 5 })} className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${isDark ? 'border-white/10 text-slate-200' : 'border-gray-300 text-gray-700'}`}>BTC (100/30·ADX15·5유닛)</button>
                    <button type="button" onClick={() => setTurtle({ ...turtle, entryPeriod: 80, exitPeriod: 40, adxThreshold: 25, maxUnits: 4 })} className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${isDark ? 'border-white/10 text-slate-200' : 'border-gray-300 text-gray-700'}`}>ETH (80/40·ADX25·4유닛)</button>
                  </div>
                  <p className={`text-[10.5px] mt-1.5 ${subText}`}>롱·숏 양방향 + 피라미딩 자동 구성. 레버리지·트레일링·손절은 아래 항목에서 설정하세요. 숏은 Bitget 선물(FUTURES)에서만 동작합니다.</p>
                </div>
              )}

              <div>
                <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>{isLive ? '거래소 (브로커)' : '계좌'}</label>
                {isLive ? (
                  <>
                    <select
                      value={form.brokerType}
                      onChange={e => setForm(prev => ({ ...prev, brokerType: e.target.value }))}
                      className={`w-full rounded-lg border px-3 py-2 text-sm font-semibold ${isDark ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-700'}`}
                    >
                      <option value="KIS">KIS 한국투자증권 — 국내·미국주식 (실제 자금 ⚠️)</option>
                      <option value="BITGET">Bitget — 코인 현물·선물 (실제 자금 ⚠️)</option>
                    </select>
                    {form.brokerType === 'KIS' ? (
                      <p className={`text-[11px] mt-1 ${isDark ? 'text-amber-300/90' : 'text-amber-700'}`}>
                        ⚠️ KIS <b>실전 계좌</b>에 직접 주문합니다 — <b>실제 돈이 나갑니다.</b>
                        거래소 연동에서 KIS 키를 먼저 등록하세요. <b>국내주식(예: 005930)</b>과 <b>미국주식(예: JOBY)</b> 모두 가능하며,
                        미국주식은 <b>미국 장중(22:30~05:00 KST)</b>에만 체결됩니다(시장가 없어 현재가 지정가로 발주).
                        안전장치로 <b>1건당 10만원 상한</b>이 걸려 있고, 비상 시 상단 킬스위치로 전체 정지하세요.
                        <b>처음엔 1주 극소액으로 검증</b>하길 권장합니다.
                      </p>
                    ) : (
                      <p className={`text-[11px] mt-1 ${isDark ? 'text-amber-300/90' : 'text-amber-700'}`}>
                        ⚠️ Bitget <b>현물(Spot) 계좌</b>에 직접 주문합니다 — <b>실제 돈이 나갑니다.</b>
                        거래소 연동에서 Bitget 키(<b>apiKey·secretKey·passphrase</b>)를 먼저 등록하세요. <b>코인(예: BTC, ETH)</b>만 거래하며
                        가격·신호는 <b>Bitget USDT 시세</b> 기준입니다. 할당 금액(원)은 <b>USDT로 환산</b>되어 주문되고,
                        최소 주문금액(보통 5 USDT) 이상이어야 합니다. 안전장치로 <b>1건당 10만원 상한</b>이 걸려 있습니다.
                        <b>처음엔 극소액으로 검증</b>하길 권장합니다.
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <div className={`rounded-lg border px-3 py-2 text-sm font-semibold ${isDark ? 'bg-blue-500/10 border-blue-500/30 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
                      모의투자 (가상자금)
                    </div>
                    <p className={`text-[11px] mt-1 ${subText}`}>가상자금으로 안전하게 연습하는 자동매매입니다. <b>실제 돈은 나가지 않습니다.</b> 실거래는 일반(실계좌) 모드의 자동매매에서 진행하세요.</p>
                  </>
                )}
              </div>

              {/* Bitget 전용: 현물/선물 + 레버리지 */}
              {isLive && form.brokerType === 'BITGET' && (
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>거래 시장</label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { v: 'SPOT', label: '현물 (Spot)', desc: '레버리지 없음' },
                      { v: 'FUTURES', label: '선물 (Futures)', desc: '레버리지 ⚠️' },
                    ] as const).map(m => {
                      const active = form.marketType === m.v;
                      return (
                        <button key={m.v} type="button"
                          onClick={() => setForm(prev => ({ ...prev, marketType: m.v }))}
                          className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                            active
                              ? (isDark ? 'bg-amber-500/15 border-amber-500/40 text-amber-200' : 'bg-amber-50 border-amber-300 text-amber-700')
                              : (isDark ? 'bg-white/[0.04] border-white/10 text-slate-300' : 'bg-white border-gray-300 text-gray-700')
                          }`}>
                          <div className="text-sm font-semibold">{m.label}</div>
                          <div className={`text-[10.5px] ${active ? '' : subText}`}>{m.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                  {form.marketType === 'FUTURES' && (
                    <div className="mt-2">
                      <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>레버리지 (배)</label>
                      <input type="number" min={1} max={10} step={1} value={form.leverage}
                        onChange={e => setForm(prev => ({ ...prev, leverage: e.target.value }))}
                        className={`w-full rounded-lg border px-3 py-2 text-sm ${isDark ? 'bg-white/[0.04] border-white/10 text-white' : 'bg-white border-gray-300 text-gray-800'}`} />
                      <p className={`text-[11px] mt-1 ${isDark ? 'text-amber-300/90' : 'text-amber-700'}`}>
                        ⚠️ 레버리지 {form.leverage || '?'}배 — 손익이 {form.leverage || '?'}배로 증폭됩니다. 청산(원금 전액 손실) 위험이 커지니
                        <b> 반드시 손절을 설정</b>하고 <b>극소액</b>으로 시작하세요. (1~10배, isolated 마진)
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>자산 유형</label>
                <select
                  value={form.assetType}
                  onChange={e => setForm(prev => ({ ...prev, assetType: e.target.value }))}
                  className={`w-full rounded-lg border px-3 py-2 text-sm ${isDark ? 'bg-white/[0.04] border-white/10 text-white' : 'bg-white border-gray-300 text-gray-800'}`}
                >
                  <option value="">자동 (종목 코드로 판별)</option>
                  <option value="STOCK">국내주식</option>
                  <option value="US_STOCK">미국주식 (예: JOBY)</option>
                  <option value="ETF">미국 ETF</option>
                  <option value="CRYPTO">코인</option>
                </select>
                <p className={`text-[11px] mt-1 ${subText}`}>미국주식(JOBY 등)은 <b>미국주식</b>으로 지정하세요. 비워두면 종목 코드로 자동 판별합니다.</p>
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
                style={{ padding: '12px 22px', borderRadius: 13, fontFamily: 'inherit', fontSize: 14, fontWeight: 700, letterSpacing: '-.01em',
                  cursor: creating || !form.strategyId ? 'default' : 'pointer', opacity: creating || !form.strategyId ? 0.5 : 1,
                  color: 'rgba(255,255,255,.98)', border: '1px solid rgba(165,200,255,.6)',
                  background: 'linear-gradient(180deg, #5690f2 0%, #3673e2 100%)',
                  boxShadow: '0 14px 26px -14px rgba(43,110,230,.6), inset 0 1px 0 rgba(255,255,255,.4)' }}>
                {creating ? '시작 중...' : '자동 항해 시작 →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </HelmShell>
  );
};

export default AutoTradePage;
