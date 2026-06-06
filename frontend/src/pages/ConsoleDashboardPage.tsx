import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRoutePrefix } from '../hooks/useRoutePrefix';
import { usePolling } from '../hooks/usePolling';
import { userService } from '../services/userService';
import { exchangeService, type ExchangeType, type ExchangeAccount, type ExchangePortfolio } from '../services/exchangeService';
import { tradeService, type Portfolio } from '../services/tradeService';
import { marketService, type MarketPrice } from '../services/marketService';
import { useRealtimePrice } from '../hooks/useRealtimePrice';
import ExchangeConnectModal from '../components/ExchangeConnectModal';
import apiClient from '../utils/api';
import HelmShell from '../components/HelmShell';
import GuideTour, { type TourStep } from '../components/GuideTour';

/* 신규 사용자 가이드 투어 (옛 Dashboard 복원) — 실계좌 홈 4스텝 */
const DASH_TOUR: TourStep[] = [
  { target: 'source', title: '자산 소스', description: '거래소(KIS·업비트·비트겟) 계좌를 연결하면 실제 포트폴리오가 여기에 표시됩니다.', position: 'bottom' },
  { target: 'summary', title: '포트폴리오 요약', description: '총자산·손익·수익률과 보유 종목을 한눈에 확인할 수 있어요.', position: 'right' },
  { target: 'watchlist', title: '관심 종목', description: '시세 페이지에서 ★로 등록한 종목의 시세가 여기 모입니다.', position: 'left' },
  { target: 'quick', title: '빠른 항해', description: '시세·거래·전략·학습 등 자주 가는 화면으로 바로 이동하세요.', position: 'left' },
];

/* ────────────────────────────────────────────────────────────
   ConsoleDashboardPage — "내 투자" 홈 (isVirt 분기)
   non-virt = 실계좌 홈 (exchangeService: KIS/업비트/비트겟 연결·자산)
   virt     = 모의투자 홈 (tradeService 페이퍼 포트폴리오 ₩1,000만)
   ──────────────────────────────────────────────────────────── */

const SONAR = 'var(--ci-sonar)';
const UP = '#ef4d4d', DOWN = '#4d8aff', COMPASS = '#f5d061';
const won = (n: number) => '₩' + Math.round(n).toLocaleString('ko-KR');
const stripZeros = (s: string) => s.replace(/\.?0+$/, '') || '0';
const fmtQty = (n: number, stockLike: boolean) => (stockLike ? `${Math.floor(n).toLocaleString('ko-KR')}주` : `${stripZeros(n.toFixed(8))}개`);
const stockLikeOf = (at?: string) => at === 'STOCK' || at === 'US_STOCK' || at === 'ETF';

const panel: React.CSSProperties = { background: 'var(--ci-panel)', border: '1px solid var(--ci-line)', borderRadius: 16, boxShadow: 'var(--ci-panel-shadow)' };
const Panel = ({ children, style }: { children: ReactNode; style?: React.CSSProperties }) => <div style={{ ...panel, ...style }}>{children}</div>;
const PanelHead = ({ kicker, title, right }: { kicker?: string; title: string; right?: ReactNode }) => (
  <div className="wa-force-dark flex items-center justify-between px-[22px] py-[15px] text-white" style={{ background: 'linear-gradient(105deg,#142647 0%,#1d3c7a 52%,#2c6fe6 100%)', borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
    <div>{kicker && <div className="text-[10.5px] font-bold tracking-[.22em] text-white/70">{kicker}</div>}<div className="text-[16px] font-bold">{title}</div></div>
    {right}
  </div>
);
const Tri = ({ up }: { up: boolean }) => <svg width="9" height="9" viewBox="0 0 10 10" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 2 }}><path d={up ? 'M5 1l4 7H1z' : 'M5 9L1 2h8z'} fill={up ? UP : DOWN} /></svg>;

const QIcon = ({ kind }: { kind: string }) => {
  const c = { width: 18, height: 18, viewBox: '0 0 22 22', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (kind === 'sonar') return <svg {...c}><circle cx="11" cy="11" r="2.5" /><path d="M5.5 11a5.5 5.5 0 0 1 11 0M2 11a9 9 0 0 1 18 0" /></svg>;
  if (kind === 'pie') return <svg {...c}><path d="M11 3a8 8 0 1 0 8 8h-8z" /><path d="M11 3v8h8a8 8 0 0 0-8-8z" /></svg>;
  if (kind === 'route') return <svg {...c}><circle cx="5" cy="17" r="2.5" /><circle cx="17" cy="5" r="2.5" /><path strokeDasharray="2 2" d="M6.5 15C12 10 9 8 15.5 6.5" /></svg>;
  return <svg {...c}><path d="M11 5C9 3.5 5.5 3.5 3.5 4.5v12C5.5 15.5 9 15.5 11 17M11 5c2-1.5 5.5-1.5 7.5-.5v12c-2-1-5.5-1-7.5.5M11 5v12" /></svg>;
};

const MiniSonar = ({ blips }: { blips: { sym: string; x: number; y: number; up: boolean }[] }) => (
  <div className="relative" style={{ width: 210, height: 210 }}>
    <svg viewBox="0 0 200 200" width="100%" height="100%">
      <defs>
        <radialGradient id="ms-g" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="rgba(124,196,255,.18)" /><stop offset="60%" stopColor="rgba(91,157,255,.06)" /><stop offset="100%" stopColor="rgba(91,157,255,0)" /></radialGradient>
        <linearGradient id="ms-sweep" x1="1" x2="0" y1="0" y2="0.35"><stop offset="0%" stopColor="rgba(124,196,255,.55)" /><stop offset="55%" stopColor="rgba(124,196,255,.12)" /><stop offset="100%" stopColor="rgba(124,196,255,0)" /></linearGradient>
      </defs>
      <circle cx="100" cy="100" r="94" fill="url(#ms-g)" />
      {[32, 60, 88].map((r, i) => <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="rgba(160,200,255,.18)" strokeWidth="1" strokeDasharray={i === 2 ? '2 4' : undefined} />)}
      <circle cx="100" cy="100" r="94" fill="none" stroke="rgba(160,200,255,.28)" strokeWidth="1" />
      {Array.from({ length: 24 }).map((_, i) => { const a = (i / 24) * Math.PI * 2, r1 = 88, r2 = i % 6 === 0 ? 80 : 85; return <line key={i} x1={100 + Math.cos(a) * r1} y1={100 + Math.sin(a) * r1} x2={100 + Math.cos(a) * r2} y2={100 + Math.sin(a) * r2} stroke="rgba(160,200,255,.3)" strokeWidth={i % 6 === 0 ? 1.4 : 0.8} />; })}
      <line x1="12" y1="100" x2="188" y2="100" stroke="rgba(160,200,255,.12)" /><line x1="100" y1="12" x2="100" y2="188" stroke="rgba(160,200,255,.12)" />
    </svg>
    <div className="absolute inset-0 animate-sonar-sweep">
      <svg viewBox="0 0 200 200" width="100%" height="100%"><path d="M100 100 L100 6 A94 94 0 0 1 175 40 Z" fill="url(#ms-sweep)" /><line x1="100" y1="100" x2="100" y2="6" stroke="#bfe0ff" strokeWidth="1.5" style={{ filter: 'drop-shadow(0 0 4px rgba(124,196,255,.9))' }} /></svg>
    </div>
    <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: '#bfe0ff', boxShadow: '0 0 10px rgba(124,196,255,.9)' }} />
    {blips.map((b, i) => (
      <div key={b.sym + i} className="absolute" style={{ left: `${b.x}%`, top: `${b.y}%`, transform: 'translate(-50%,-50%)' }}>
        <span className="absolute left-1/2 top-1/2 h-[18px] w-[18px] rounded-full" style={{ border: `1px solid ${b.up ? UP : DOWN}`, animation: `pulse-ring 2.6s ease-out ${i * 0.5}s infinite` }} />
        <span className="block h-[7px] w-[7px] rounded-full" style={{ background: b.up ? UP : DOWN, boxShadow: `0 0 8px ${b.up ? UP : DOWN}` }} />
        <span className="absolute left-1/2 top-[9px] -translate-x-1/2 whitespace-nowrap font-mono text-[8.5px] tracking-wide text-white/60">{b.sym}</span>
      </div>
    ))}
  </div>
);
type IdxRow = [string, string, string, boolean];
const INDICES_FALLBACK: IdxRow[] = [
  ['KOSPI', '—', '', true], ['KOSDAQ', '—', '', false],
  ['BTC/KRW', '—', '', true], ['USD/KRW', '—', '', true],
];
const fmtBtc = (n: number) => (n >= 1e8 ? (n / 1e8).toFixed(2) + '억' : (n / 1e6).toFixed(1) + 'M');
// 지수 스트립 실데이터 (공개 API: BTC/USD 실시간, KOSPI/KOSDAQ는 KIS 설정 시) — 비로그인에서도 동작
function useIndices(): IdxRow[] {
  const [rows, setRows] = useState<IdxRow[]>(INDICES_FALLBACK);
  useEffect(() => {
    Promise.all([
      marketService.getPrices('CRYPTO').catch(() => []),
      marketService.getExchangeRate().catch(() => null),
      apiClient.get<{ code: string; name: string; price: number; changeRate: number }[]>('/api/market/indices').then(r => r.data).catch(() => []),
    ]).then(([crypto, fx, idx]) => {
      const next: IdxRow[] = [...INDICES_FALLBACK.map(r => [...r] as IdxRow)];
      const findIdx = (kw: string) => Array.isArray(idx) ? idx.find(i => i.name?.includes(kw) || i.code === (kw === 'KOSPI' ? '0001' : '1001')) : undefined;
      const kospi = findIdx('KOSPI'), kosdaq = findIdx('KOSDAQ');
      if (kospi) next[0] = ['KOSPI', kospi.price.toLocaleString('ko-KR', { maximumFractionDigits: 2 }), `${kospi.changeRate >= 0 ? '+' : ''}${kospi.changeRate.toFixed(2)}%`, kospi.changeRate >= 0];
      if (kosdaq) next[1] = ['KOSDAQ', kosdaq.price.toLocaleString('ko-KR', { maximumFractionDigits: 2 }), `${kosdaq.changeRate >= 0 ? '+' : ''}${kosdaq.changeRate.toFixed(2)}%`, kosdaq.changeRate >= 0];
      const btc = Array.isArray(crypto) ? crypto.find(c => c.symbol === 'BTC') : undefined;
      if (btc) next[2] = ['BTC/KRW', fmtBtc(btc.price), `${btc.changeRate >= 0 ? '+' : ''}${btc.changeRate.toFixed(2)}%`, btc.changeRate >= 0];
      if (fx?.usdKrw) next[3] = ['USD/KRW', fx.usdKrw.toLocaleString('ko-KR', { maximumFractionDigits: 1 }), '', true];
      setRows(next);
    });
  }, []);
  return rows;
}

const EXCHANGES: { key: ExchangeType; label: string; badge: string; name: string; devel: string }[] = [
  { key: 'KIS', label: '주식', badge: 'KIS', name: 'KIS (한국투자증권)', devel: 'KIS Developers' },
  { key: 'UPBIT', label: '코인', badge: 'Upbit', name: '업비트', devel: '업비트 Open API' },
  { key: 'BITGET', label: '코인', badge: 'Bitget', name: '비트겟', devel: 'Bitget API' },
];

const Step = ({ n, t, s, active }: { n: string; t: string; s: string; active?: boolean }) => (
  <div className="rounded-xl p-[18px]" style={{ background: active ? 'rgba(91,157,255,.10)' : 'var(--ci-inset)', border: active ? '1px solid rgba(91,157,255,.28)' : '1px solid var(--ci-line)' }}>
    <div className="mb-1.5 font-mono text-[11px] font-bold tracking-[.1em]" style={{ color: active ? SONAR : 'var(--ci-ink3)' }}>{n}</div>
    <div className="mb-1 text-[14.5px] font-semibold">{t}</div><div className="text-[12.5px] leading-snug text-white/45">{s}</div>
  </div>
);
const ArrowMini = () => <div className="flex items-center justify-center text-white/30"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7H12 M8 3 L12 7 L8 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg></div>;

/* 미연결 — 온보딩 (→ 포트폴리오 페이지에서 연결) */
const OnboardingCard = ({ ex, onSetup }: { ex: typeof EXCHANGES[number]; onSetup: () => void }) => (
  <Panel style={{ padding: '28px 30px' }}>
    <div className="mb-1.5 flex items-center justify-between">
      <span className="text-[11px] font-semibold tracking-[.18em]" style={{ color: 'var(--ci-sonar)' }}>STEP 1 · 계좌 연결</span>
      <span className="rounded px-2 py-[3px] text-[11px] font-bold tracking-[.06em]" style={{ background: 'rgba(245,208,97,.12)', color: COMPASS, border: '1px solid rgba(245,208,97,.3)' }}>미연결</span>
    </div>
    <h3 className="my-2 text-[22px] font-bold">{ex.name} 키를 등록해주세요</h3>
    <p className="m-0 max-w-[540px] text-[14.5px] leading-relaxed text-white/70">API 키를 등록하면 보유 종목과 잔고가 실시간으로 갱신됩니다. 키는 AES로 암호화되어 안전하게 보관돼요.</p>
    <div className="mt-7 grid items-stretch gap-2 sm:gap-0 grid-cols-1 sm:grid-cols-[1fr_22px_1fr_22px_1fr]">
      <Step n="01" t="API 키 발급" s={`${ex.devel}에서 발급`} />
      <ArrowMini /><Step n="02" t="WhaleArc에 등록" s="2분 안에 완료 · 암호화 저장" />
      <ArrowMini /><Step n="03" t="자동 동기화" s="실시간 시세 + 잔고" active />
    </div>
    <div className="mt-6 flex flex-wrap items-center gap-3.5">
      <button onClick={onSetup} className="inline-flex items-center gap-2.5 rounded-xl px-6 py-[15px] text-[14.5px] font-semibold text-white" style={{ border: '1px solid rgba(140,190,255,.5)', background: 'linear-gradient(180deg,#4d8aff 0%,#2c6fe6 62%,#2257c8 100%)', boxShadow: '0 12px 28px -12px rgba(44,111,230,.7), inset 0 1px 0 rgba(255,255,255,.38)' }}>API 키 등록하기<span className="flex h-5 w-5 items-center justify-center rounded-full text-[12px]" style={{ background: 'rgba(255,255,255,.18)' }}>→</span></button>
      <span className="ml-auto text-[12px] text-white/45">🔒 AES 암호화 · 읽기 전용 권한</span>
    </div>
  </Panel>
);
const LoadingCard = () => (
  <Panel style={{ padding: '60px 30px' }}>
    <div className="flex flex-col items-center gap-3 text-white/50">
      <span className="h-8 w-8 animate-spin rounded-full" style={{ border: '3px solid rgba(91,157,255,.25)', borderTopColor: SONAR }} />
      <span className="text-[13px]">불러오는 중…</span>
    </div>
  </Panel>
);
const ErrorCard = ({ onRetry }: { onRetry: () => void }) => (
  <Panel style={{ padding: '40px 30px', textAlign: 'center' }}>
    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: 'rgba(245,208,97,.12)', border: '1px solid rgba(245,208,97,.3)' }}>
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke={COMPASS} strokeWidth="1.6"><path d="M11 3L20 19H2z" strokeLinejoin="round" /><path d="M11 9v4M11 16v.4" strokeLinecap="round" /></svg>
    </div>
    <h3 className="text-[17px] font-bold">자산 정보를 불러오지 못했어요</h3>
    <p className="mx-auto mt-2 max-w-[360px] text-[13.5px] text-white/55">잠시 후 다시 시도해주세요. 문제가 계속되면 거래소 연결 상태를 확인해주세요.</p>
    <button onClick={onRetry} className="mt-4 rounded-[10px] px-5 py-2.5 text-[13.5px] font-semibold" style={{ border: '1px solid rgba(91,157,255,.32)', background: 'rgba(91,157,255,.10)', color: SONAR }}>다시 시도 ↻</button>
  </Panel>
);

/* 자산 요약 카드 (실계좌·페이퍼 공용 — 정규화된 props) */
type SumHolding = { name: string; sub: string; value: number; rate: number };
const SummaryCard = ({ kicker, title, total, pnl, returnRate, cash, equity, holdings, onAll, allLabel = '포트폴리오 →' }: {
  kicker: string; title: string; total: number; pnl: number; returnRate: number; cash: number; equity: number; holdings: SumHolding[]; onAll: () => void; allLabel?: string;
}) => {
  const sign = pnl > 0 ? 1 : pnl < 0 ? -1 : 0; // 손익 0은 이득이 아닌 '변동 없음'(중립)으로 표시
  return (
    <Panel style={{ padding: 0 }}>
      <PanelHead kicker={kicker} title={title} right={<button onClick={onAll} className="text-[12.5px]" style={{ color: '#cfe1ff' }}>{allLabel}</button>} />
      <div className="px-7 py-6">
        <div className="text-[10.5px] font-semibold tracking-[.2em]" style={{ color: SONAR }}>총 자산</div>
        <div className="mt-1.5 font-mono text-[38px] font-bold leading-none tracking-tight">{won(total)}</div>
        <div className="mt-2.5 font-mono text-[15px] font-semibold" style={{ color: sign < 0 ? DOWN : sign > 0 ? UP : 'var(--ci-ink1)' }}>
          {sign !== 0 && <Tri up={sign > 0} />}{pnl > 0 ? '+' : ''}{Math.round(pnl).toLocaleString('ko-KR')} ({returnRate >= 0 ? '+' : ''}{returnRate.toFixed(2)}%)
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3.5">
          {[['현금', cash], ['보유 평가', equity]].map(([l, v]) => (
            <div key={l as string} className="rounded-xl px-4 py-3.5" style={{ background: 'var(--ci-inset)', border: '1px solid var(--ci-line)' }}>
              <div className="text-[11px] text-white/45">{l}</div><div className="mt-1.5 font-mono text-[17px] font-semibold">{won(v as number)}</div>
            </div>
          ))}
        </div>
        {holdings.length > 0 && (
          <div className="mt-5">
            <div className="mb-1 grid grid-cols-[1fr_auto_70px] gap-2 px-1 pb-2 text-[10.5px] uppercase tracking-[.08em] text-white/30" style={{ borderBottom: '1px solid var(--ci-line)' }}><span>종목</span><span className="text-right">평가액</span><span className="text-right">수익률</span></div>
            {holdings.map((h, i) => { const up = h.rate >= 0; return (
              <div key={h.name + i} className="grid grid-cols-[1fr_auto_70px] items-center gap-2 px-1 py-2.5 text-[13px]" style={{ borderBottom: '1px solid var(--ci-line)' }}>
                <span className="truncate font-semibold">{h.name} <span className="font-mono text-[11px] text-white/35">{h.sub}</span></span>
                <span className="text-right font-mono">{won(h.value)}</span>
                <span className="text-right font-mono font-semibold" style={{ color: up ? UP : DOWN }}><Tri up={up} />{up ? '+' : ''}{h.rate.toFixed(2)}%</span>
              </div>
            ); })}
          </div>
        )}
      </div>
    </Panel>
  );
};

const QUICK: [string, string, string][] = [['시세 확인하기', '실시간 시세 조회', 'sonar'], ['내 포트폴리오', '잔고·수익률 한눈에', 'pie'], ['전략 백테스트', '과거 데이터로 시뮬레이션', 'route'], ['전략 학습', '검증된 전략을 단계별로', 'book']];
const QUICK_PATH = ['/market', '/my-portfolio', '/strategy', '/store'];
// 정적 투자 원칙(교육용) — 가짜 시세 시그널 대신 정직한 가이드
const SIGNALS: [string, string, string, string][] = [['원칙', '분산 투자', '한 자산에 몰빵하지 않으면 변동성이 줄어듭니다', SONAR], ['원칙', '손절 규칙', '미리 정한 손실 한계를 지키면 큰 손실을 막아요', COMPASS], ['원칙', '장기 관점', '잦은 매매보다 검증된 전략을 꾸준히', UP]];

const WelcomeBanner = ({ name, blips }: { name: string; blips: { sym: string; x: number; y: number; up: boolean }[] }) => {
  const indices = useIndices();
  return (
  <section className="wa-force-dark relative overflow-hidden rounded-[18px] text-white" style={{ background: 'radial-gradient(120% 100% at 80% 20%, #1d3a7a 0%, #0e1a3d 55%, #0a1230 100%)', border: '1px solid rgba(255,255,255,.18)' }}>
    <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(40% 60% at 20% 90%, rgba(80,140,255,.18), transparent 70%)' }} />
    <div className="relative grid items-center gap-6 p-7 md:grid-cols-[1fr_auto] md:p-9">
      <div>
        <div className="mb-3.5 flex items-center gap-2.5"><span className="h-1.5 w-1.5 rounded-full animate-pulse-dot" style={{ background: SONAR, boxShadow: `0 0 8px ${SONAR}` }} /><span className="text-[11.5px] font-semibold tracking-[.18em]" style={{ color: '#9cc1ff' }}>TODAY · 오늘의 항해</span></div>
        <h1 className="text-[32px] font-bold leading-tight tracking-tight">{name}님, 다시 바다에 오셨군요.</h1>
        <p className="mt-2.5 text-[15px] text-white/70">오늘도 시장의 바다를 유영해볼까요?</p>
        <div className="mt-6 flex max-w-[520px] flex-wrap items-center gap-x-8 gap-y-3 border-t border-white/10 pt-[18px]">
          {indices.map(([n, v, d, u]) => (
            <div key={n} className="flex flex-col gap-0.5"><span className="text-[10.5px] font-semibold tracking-[.12em] text-white/45">{n}</span><span className="font-mono text-[14px] font-semibold">{v}</span>{d && <span className="font-mono text-[11px] font-semibold" style={{ color: u ? UP : DOWN }}>{d}</span>}</div>
          ))}
        </div>
      </div>
      <div className="hidden flex-col items-center gap-2 md:flex"><MiniSonar blips={blips} /><span className="text-[10.5px] font-semibold tracking-[.16em] text-white/45">포지션 소나</span></div>
    </div>
  </section>
  );
};

/* 관심 종목 — userService.favoriteAssets + 실시세 (옛 Dashboard 복원) */
const wlPrice = (s: MarketPrice) => (s.currency === 'USD' ? '$' + s.price.toLocaleString('ko-KR', { maximumFractionDigits: 2 }) : '₩' + Math.round(s.price).toLocaleString('ko-KR'));
const WatchlistPanel = ({ go }: { go: (path: string) => void }) => {
  const [items, setItems] = useState<MarketPrice[]>([]);
  const [loaded, setLoaded] = useState(false);
  const isPreview = import.meta.env.DEV && window.location.pathname.startsWith('/preview');
  // 크립토 실시간(WebSocket) — 관심 종목 시세 즉시 반영
  const { prices: rt } = useRealtimePrice({ enabled: !isPreview });
  useEffect(() => {
    if (isPreview) { setLoaded(true); return; }
    let alive = true;
    const fetchFavs = async () => {
      const profile = await userService.getProfile().catch(() => null);
      const favs = profile?.favoriteAssets || [];
      if (!alive) return;
      if (favs.length === 0) { setItems([]); setLoaded(true); return; }
      const [crypto, stock] = await Promise.all([marketService.getPrices('CRYPTO').catch(() => []), marketService.getPrices('STOCK').catch(() => [])]);
      if (!alive) return;
      const favSet = new Set(favs);
      setItems([...crypto, ...stock].filter(p => favSet.has(p.symbol) || favSet.has(p.name)).slice(0, 8));
      setLoaded(true);
    };
    fetchFavs();
    const id = setInterval(fetchFavs, 15000); // 15초 폴링(주식 시세 갱신)
    return () => { alive = false; clearInterval(id); };
  }, [isPreview]);
  // 크립토 항목은 실시간 가격으로 병합
  const merged = useMemo(() => (rt.size === 0 ? items : items.map(s => (s.assetType === 'CRYPTO' ? (rt.get(s.symbol) ?? s) : s))), [items, rt]);
  return (
    <Panel style={{ padding: 0 }}>
      <div data-tour="watchlist">
        <PanelHead title="관심 종목" right={<button onClick={() => go('/market')} className="text-[11px] font-semibold" style={{ color: SONAR }}>관리 →</button>} />
        <div className="px-2.5 pb-3 pt-1">
          {!loaded ? <div className="px-3 py-6 text-center text-[12px] text-white/40">불러오는 중…</div>
            : merged.length === 0 ? <div className="px-3 py-6 text-center text-[12px] leading-relaxed text-white/40">시세 페이지에서 ★를 눌러<br />관심 종목을 등록해보세요.</div>
              : merged.map(s => { const up = s.changeRate >= 0; return (
                <button key={s.symbol} onClick={() => go(`/trade?code=${s.symbol}&type=${s.assetType}`)} className="grid w-full grid-cols-[1fr_auto] items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-white/[0.03]">
                  <div className="min-w-0"><div className="truncate text-[13px] font-semibold">{s.name}</div><div className="font-mono text-[11px] text-white/40">{s.symbol}</div></div>
                  <div className="text-right"><div className="font-mono text-[12.5px] font-semibold">{wlPrice(s)}</div><div className="font-mono text-[11px] font-semibold" style={{ color: up ? UP : DOWN }}>{up ? '+' : ''}{s.changeRate.toFixed(2)}%</div></div>
                </button>
              ); })}
        </div>
      </div>
    </Panel>
  );
};

/* 목표 수익률 위젯 — localStorage 저장, 현재 수익률 대비 진행도 (옛 Dashboard 복원) */
const GOAL_KEY = 'whalearc_target_return';
const GoalPanel = ({ returnRate }: { returnRate: number | null }) => {
  const [target, setTarget] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('10');
  useEffect(() => { try { const v = localStorage.getItem(GOAL_KEY); if (v != null) { const n = Number(v); if (Number.isFinite(n) && n > 0) { setTarget(n); setDraft(v); } } } catch { /* ignore */ } }, []);
  const draftNum = Number(draft);
  const draftValid = Number.isFinite(draftNum) && draftNum > 0;
  const save = () => { if (!draftValid) return; setTarget(draftNum); try { localStorage.setItem(GOAL_KEY, String(draftNum)); } catch { /* ignore */ } setEditing(false); };
  const cur = returnRate ?? 0;
  const pct = target ? Math.max(0, Math.min(100, (cur / target) * 100)) : 0;
  const reached = target != null && cur >= target; // 목표 수익률은 양수 전용
  return (
    <Panel style={{ padding: 0 }}>
      <PanelHead title="목표 수익률" right={target != null && !editing ? <button onClick={() => setEditing(true)} className="text-[11px] font-semibold" style={{ color: SONAR }}>수정</button> : undefined} />
      <div className="px-[22px] pb-[18px] pt-3">
        {target == null || editing ? (
          <div>
            <div className="mb-2 text-[12.5px] text-white/55">달성하고 싶은 목표 수익률(%)을 정해보세요. (0보다 큰 값)</div>
            <div className="flex gap-2">
              <input type="number" min={0} step="0.1" value={draft} onChange={e => setDraft(e.target.value)} placeholder="예: 10" className="w-full rounded-lg px-3 py-2 text-right font-mono text-[14px] outline-none" style={{ border: '1px solid var(--ci-line)', background: 'var(--ci-card)', color: 'var(--ci-ink0)' }} />
              <button onClick={save} disabled={!draftValid} className="shrink-0 rounded-lg px-4 text-[13px] font-bold text-white disabled:opacity-40" style={{ background: `linear-gradient(180deg, ${SONAR}, #2c6fe6)` }}>저장</button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-[24px] font-bold" style={{ color: cur >= 0 ? UP : DOWN }}>{cur >= 0 ? '+' : ''}{cur.toFixed(2)}%</span>
              <span className="text-[12.5px] text-white/55">목표 <span className="font-mono font-bold text-white">{target > 0 ? '+' : ''}{target}%</span></span>
            </div>
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--ci-card)' }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: reached ? 'linear-gradient(90deg,#3fd6a0,#2f9e6e)' : `linear-gradient(90deg, ${SONAR}, #2c6fe6)`, transition: 'width .4s' }} />
            </div>
            <div className="mt-2 text-[12px]" style={{ color: reached ? '#3fd6a0' : 'var(--ci-ink2)' }}>{reached ? '🎉 목표 달성! 새 목표를 세워보세요.' : `목표까지 ${Math.abs(target - cur).toFixed(2)}%p 남았어요.`}</div>
          </>
        )}
      </div>
    </Panel>
  );
};

const RightRail = ({ go, returnRate = null }: { go: (path: string) => void; returnRate?: number | null }) => (
  <div className="flex flex-col gap-5 lg:sticky lg:top-[88px]">
    <GoalPanel returnRate={returnRate} />
    <Panel style={{ padding: 0 }}>
      <div data-tour="quick">
      <PanelHead kicker="QUICK BEARINGS" title="어디로 항해할까요?" />
      <ul className="m-0 list-none py-2.5">
        {QUICK.map(([t, s, ic], i) => (
          <li key={t}><button onClick={() => go(QUICK_PATH[i])} className="grid w-full grid-cols-[38px_1fr_auto] items-center gap-3.5 px-[22px] py-3 text-left transition-colors hover:bg-white/[0.03]">
            <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px]" style={{ background: 'rgba(91,157,255,.10)', color: SONAR, border: '1px solid rgba(91,157,255,.22)' }}><QIcon kind={ic} /></span>
            <span><span className="block text-[14px] font-semibold">{t}</span><span className="mt-0.5 block text-[12px] text-white/45">{s}</span></span><span className="text-white/30">→</span>
          </button></li>
        ))}
      </ul>
      </div>
    </Panel>
    <WatchlistPanel go={go} />
    <Panel style={{ padding: 0 }}>
      <PanelHead title="투자 원칙" right={<span className="text-[11px] text-white/30">항해 수칙</span>} />
      <div className="px-[22px] pb-[18px] pt-1">
        {SIGNALS.map(([tag, t, s, c]) => (
          <div key={t} className="border-t border-white/10 py-3 first:border-t-0"><span className="rounded px-1.5 py-0.5 text-[10px] font-bold tracking-[.08em]" style={{ background: 'var(--ci-chip)', color: c }}>{tag}</span><div className="my-[7px] mb-1 text-[13.5px] font-semibold">{t}</div><div className="text-[12px] text-white/45">{s}</div></div>
        ))}
      </div>
    </Panel>
  </div>
);
const Footer = () => (
  <footer className="mt-2 flex flex-wrap justify-between gap-3 border-t border-white/10 pt-5">
    <span className="font-mono text-[11.5px] text-white/30">© 2026 WHALEARC · 모든 항해는 사용자의 책임 아래 진행됩니다.</span>
    <span className="text-[11.5px] text-white/30">Built quietly, beneath the surface.</span>
  </footer>
);
// 보유 종목이 없으면 빈 소나(가짜 포지션 표시 안 함)
const blipsFrom = (hs: { name: string; rate: number }[]) => hs.length === 0 ? []
  : [...hs].sort((a, b) => b.rate - a.rate).slice(0, 3).map((h, i) => ({ sym: h.name.replace(/^KRW-/, '').slice(0, 4), x: [64, 38, 62][i] ?? 50, y: [34, 60, 68][i] ?? 50, up: h.rate >= 0 }));

/* ── 실계좌 홈 (non-virt, exchangeService) ── */
const RealDashboard = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const fallbackName = session?.user?.email ? session.user.email.split('@')[0] : '항해사';
  const [name, setName] = useState(fallbackName);
  const [accounts, setAccounts] = useState<ExchangeAccount[]>([]);
  const [ports, setPorts] = useState<Partial<Record<ExchangeType, ExchangePortfolio | null>>>({});
  const [src, setSrc] = useState<ExchangeType>('KIS');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false); // 계좌 조회 실패 — '미연결'과 구분해 에러 UI 표시
  const [setup, setSetup] = useState<ExchangeType | null>(null);
  const [tour, setTour] = useState(false);
  const isPreview = import.meta.env.DEV && window.location.pathname.startsWith('/preview');

  const loadData = useCallback(async () => {
    if (isPreview) { setLoading(false); return; } // 프리뷰(비로그인) 401 리다이렉트 방지
    try {
      setError(false);
      const profile = await userService.getProfile().catch(() => null);
      if (profile?.name) setName(profile.name);
      const accs = await exchangeService.getAccounts(); // 실패 시 throw → '미연결'이 아닌 에러 UI로 구분
      setAccounts(accs);
      const p: Partial<Record<ExchangeType, ExchangePortfolio | null>> = {};
      await Promise.all(accs.filter(a => a.connected).map(a =>
        exchangeService.getPortfolio(a.exchangeType).then(r => { p[a.exchangeType] = r; }).catch(() => { p[a.exchangeType] = null; })));
      setPorts(p);
    } catch { setError(true); }
    finally { setLoading(false); }
  }, [isPreview]);
  useEffect(() => { loadData(); }, [loadData]);
  usePolling(loadData, 30000); // 안정적 콜백(useCallback) 전달 — 매 렌더 재구독 방지
  // 첫 방문 시 가이드 투어 자동 시작 (완료하면 localStorage에 기록)
  useEffect(() => {
    if (isPreview || loading) return;
    try { if (localStorage.getItem('whalearc_dash_tour') !== 'done') setTour(true); } catch { /* ignore */ }
  }, [loading, isPreview]);

  const isConn = (t: ExchangeType) => accounts.some(a => a.exchangeType === t && a.connected);
  const selectedConnected = isConn(src);
  const selectedPort = ports[src] || null;
  const meta = EXCHANGES.find(e => e.key === src)!;
  const equity = selectedPort ? selectedPort.holdings.reduce((s, h) => s + h.marketValue, 0) : 0;
  const holdings: SumHolding[] = selectedPort ? [...selectedPort.holdings].sort((a, b) => b.marketValue - a.marketValue).slice(0, 5).map(h => ({ name: h.assetName, sub: fmtQty(h.quantity, src === 'KIS'), value: h.marketValue, rate: h.returnRate })) : [];
  const blips = useMemo(() => blipsFrom((selectedPort?.holdings ?? []).map(h => ({ name: h.assetName, rate: h.returnRate }))), [selectedPort]);
  const goConnect = () => setSetup(src); // 1스텝: 대시보드에서 바로 연결 모달

  return (
    <HelmShell active="home" virt={false} userName={name} session="실계좌 · 거래소 연동">
      <div className="mx-auto flex max-w-[1560px] flex-col gap-5">
        <WelcomeBanner name={name} blips={blips} />
        {/* 자산 소스 탭 (실 연결상태) */}
        <div className="flex flex-wrap items-center gap-2" data-tour="source">
          {EXCHANGES.map(e => { const on = src === e.key, c = isConn(e.key); return (
            <button key={e.key} onClick={() => setSrc(e.key)} className="inline-flex items-center gap-2 rounded-[10px] px-4 py-[9px] text-[14px] font-semibold" style={{ border: on ? '1px solid rgba(91,157,255,.35)' : '1px solid var(--ci-line)', background: on ? 'rgba(91,157,255,.10)' : 'var(--ci-inset)' }}>
              {e.label}<span className="rounded px-1.5 py-0.5 text-[11px] font-bold" style={{ background: on ? 'rgba(91,157,255,.22)' : 'var(--ci-chip)', color: on ? '#cfe1ff' : 'var(--ci-ink1)' }}>{e.badge}</span>
              <span className="text-[11px]" style={{ color: c ? '#3fd6a0' : 'var(--ci-ink3)' }}>· {c ? '연결됨' : '미연결'}</span>
            </button>
          ); })}
          <button onClick={goConnect} className="rounded-[10px] px-3.5 py-[9px] text-[13.5px] font-medium text-white/70" style={{ border: '1px dashed var(--ci-line-strong)' }}>+ {meta.name.split(' ')[0]} 연결</button>
          <button onClick={() => setTour(true)} className="ml-auto rounded-[10px] px-3 py-[9px] text-[13px] text-white/55" style={{ border: '1px solid var(--ci-line)', background: 'var(--ci-inset)' }} title="가이드 다시 보기">? 가이드</button>
          <button onClick={() => loadData()} className="rounded-[10px] px-3 py-[9px] text-[13px] text-white/55" style={{ border: '1px solid var(--ci-line)', background: 'var(--ci-inset)' }} title="새로고침">↻ 새로고침</button>
        </div>
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]">
          <div className="flex flex-col gap-5" data-tour="summary">
            {loading ? <LoadingCard />
              : error ? <ErrorCard onRetry={() => loadData()} />
              : selectedConnected
                ? ((selectedPort && selectedPort.fetchOk !== false)
                    ? <SummaryCard kicker={meta.badge.toUpperCase()} title={`${meta.name} 포트폴리오`} total={selectedPort.totalValue} pnl={selectedPort.totalProfitLoss} returnRate={selectedPort.totalReturnRate} cash={selectedPort.cashBalance} equity={equity} holdings={holdings} onAll={() => navigate('/my-portfolio')} />
                    : <ErrorCard onRetry={() => loadData()} />)
                : <OnboardingCard ex={meta} onSetup={goConnect} />}
            {/* VIRT 체험 카드 */}
            <Panel style={{ padding: '26px 30px', background: 'linear-gradient(135deg, rgba(91,157,255,.14), rgba(91,157,255,.03) 60%, transparent)', border: '1px solid rgba(91,157,255,.28)' }}>
              <div className="mb-2 flex items-center gap-2.5"><span className="rounded px-2 py-[3px] text-[10.5px] font-bold tracking-[.06em] text-white" style={{ background: SONAR }}>VIRT</span><span className="text-[11px] font-semibold tracking-[.18em]" style={{ color: 'var(--ci-sonar)' }}>가상 항해 · 체험하기</span></div>
              <h3 className="my-1 text-[21px] font-bold">먼저 가상으로, 안전하게 연습해보세요.</h3>
              <p className="m-0 text-[14.5px] leading-relaxed text-white/70">가상돈 <span className="font-mono font-bold text-white">₩10,000,000</span>으로 주식·코인 매매를 실험할 수 있어요.</p>
              <button onClick={() => navigate('/virt/dashboard')} className="mt-5 inline-flex items-center gap-2.5 rounded-xl px-6 py-3.5 text-[14px] font-semibold text-white" style={{ border: '1px solid rgba(140,190,255,.5)', background: 'linear-gradient(180deg,#4d8aff 0%,#2c6fe6 62%,#2257c8 100%)', boxShadow: '0 12px 28px -12px rgba(44,111,230,.7), inset 0 1px 0 rgba(255,255,255,.38)' }}>VIRT 모드 시작하기<span className="flex h-5 w-5 items-center justify-center rounded-full text-[12px]" style={{ background: 'rgba(255,255,255,.18)' }}>→</span></button>
            </Panel>
          </div>
          <RightRail go={p => navigate(p)} returnRate={selectedConnected ? (selectedPort?.totalReturnRate ?? null) : null} />
        </div>
        <Footer />
      </div>
      {setup && <ExchangeConnectModal exchangeType={setup} account={accounts.find(a => a.exchangeType === setup)} onClose={() => setSetup(null)} onSaved={() => loadData()} />}
      <GuideTour steps={DASH_TOUR} isActive={tour} onFinish={() => { setTour(false); try { localStorage.setItem('whalearc_dash_tour', 'done'); } catch { /* ignore */ } }} />
    </HelmShell>
  );
};

/* ── 모의투자 홈 (virt, tradeService 페이퍼) ── */
// 첫 항해 퀵매수 — 빈 포트폴리오 신규 사용자용 (시장가 매수)
const FIRST_BUYS: { stockCode: string; stockName: string; quantity: number; assetType: 'STOCK' | 'CRYPTO'; label: string }[] = [
  { stockCode: '005930', stockName: '삼성전자', quantity: 1, assetType: 'STOCK', label: '삼성전자 1주' },
  { stockCode: 'BTC', stockName: '비트코인', quantity: 0.0001, assetType: 'CRYPTO', label: '비트코인 0.0001개' },
];

const VirtDashboard = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const fallbackName = session?.user?.email ? session.user.email.split('@')[0] : '항해사';
  const [name, setName] = useState(fallbackName);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [qbBusy, setQbBusy] = useState<string | null>(null);
  const [qbMsg, setQbMsg] = useState<{ msg: string; ok: boolean } | null>(null);
  const qbTimer = useRef<number | null>(null);
  useEffect(() => () => { if (qbTimer.current) clearTimeout(qbTimer.current); }, []);
  const isPreview = import.meta.env.DEV && window.location.pathname.startsWith('/preview');

  const loadData = useCallback(async () => {
    if (isPreview) { setLoading(false); return; } // 프리뷰(비로그인) 401 리다이렉트 방지
    userService.getProfile().then(p => { if (p?.name) setName(p.name); }).catch(() => {});
    try { setPortfolio(await tradeService.getPortfolio()); setError(false); }
    catch { setError(true); }
    finally { setLoading(false); }
  }, [isPreview]);
  useEffect(() => { loadData(); }, [loadData]);
  usePolling(() => { if (!isPreview) loadData(); }, 30000);

  const quickBuy = async (o: typeof FIRST_BUYS[number]) => {
    if (qbBusy) return;
    setQbBusy(o.stockCode);
    try {
      await tradeService.createOrder({ stockCode: o.stockCode, stockName: o.stockName, orderType: 'BUY', orderMethod: 'MARKET', quantity: o.quantity, assetType: o.assetType });
      setQbMsg({ msg: `${o.stockName} 매수 완료! 첫 항해를 시작했어요. ⚓`, ok: true });
      loadData();
    } catch (e: any) {
      setQbMsg({ msg: e?.response?.data?.message || '매수에 실패했습니다. 잠시 후 다시 시도해주세요.', ok: false });
    } finally {
      setQbBusy(null);
      if (qbTimer.current) clearTimeout(qbTimer.current);
      qbTimer.current = window.setTimeout(() => setQbMsg(null), 3000);
    }
  };

  const initialCash = portfolio?.initialCash || 10_000_000;
  const total = portfolio?.totalValue ?? 0;
  const equity = portfolio ? portfolio.holdings.reduce((s, h) => s + h.marketValue, 0) : 0;
  const pnl = total - initialCash;
  const holdings: SumHolding[] = portfolio ? [...portfolio.holdings].sort((a, b) => b.marketValue - a.marketValue).slice(0, 5).map(h => ({ name: h.stockName, sub: fmtQty(h.quantity, stockLikeOf(h.assetType)), value: h.marketValue, rate: h.returnRate })) : [];
  const blips = useMemo(() => blipsFrom((portfolio?.holdings ?? []).map(h => ({ name: h.stockName, rate: h.returnRate }))), [portfolio]);

  return (
    <HelmShell active="home" virt={true} userName={name} session="모의투자 · 가상 항해">
      <div className="mx-auto flex max-w-[1560px] flex-col gap-5">
        <WelcomeBanner name={name} blips={blips} />
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]">
          <div className="flex flex-col gap-5">
            {loading ? <LoadingCard />
              : error ? <ErrorCard onRetry={() => loadData()} />
                : <SummaryCard kicker="VIRT" title="모의투자 포트폴리오" total={total} pnl={pnl} returnRate={portfolio?.returnRate ?? 0} cash={portfolio?.cashBalance ?? 0} equity={equity} holdings={holdings} onAll={() => navigate('/virt/my-portfolio')} />}
            {/* 첫 항해 퀵매수 — 보유 종목이 없을 때만 */}
            {!loading && !error && portfolio && portfolio.holdings.length === 0 && (
              <Panel style={{ padding: '22px 26px', border: '1px solid rgba(91,157,255,.28)', background: 'linear-gradient(135deg, rgba(91,157,255,.10), transparent 60%)' }}>
                <div className="mb-1 text-[11px] font-semibold tracking-[.18em]" style={{ color: SONAR }}>FIRST VOYAGE</div>
                <h3 className="text-[18px] font-bold">첫 항해, 한 번에 시작해보세요</h3>
                <p className="mt-1 text-[13px] text-white/60">버튼 한 번이면 모의 매수로 첫 거래를 경험할 수 있어요. (가상돈 ₩1,000만 · 시장가 체결)</p>
                <div className="mt-3.5 flex flex-wrap gap-2.5">
                  {FIRST_BUYS.map(o => (
                    <button key={o.stockCode} onClick={() => quickBuy(o)} disabled={qbBusy != null} className="rounded-[10px] px-4 py-2.5 text-[13px] font-semibold disabled:opacity-50" style={{ border: '1px solid rgba(91,157,255,.32)', background: 'rgba(91,157,255,.1)', color: SONAR }}>{qbBusy === o.stockCode ? '매수 중…' : `⚡ ${o.label} 사보기`}</button>
                  ))}
                  <button onClick={() => navigate('/virt/trade')} className="rounded-[10px] px-4 py-2.5 text-[13px] font-semibold text-white/70" style={{ border: '1px solid var(--ci-line-strong)' }}>직접 골라 매수 →</button>
                </div>
                {qbMsg && <div className="mt-3 rounded-lg px-3.5 py-2.5 text-[12.5px] font-semibold" style={qbMsg.ok ? { background: 'rgba(63,214,160,.1)', border: '1px solid rgba(63,214,160,.28)', color: '#3fd6a0' } : { background: 'rgba(239,77,77,.1)', border: '1px solid rgba(239,77,77,.25)', color: '#fca5a5' }}>{qbMsg.msg}</div>}
              </Panel>
            )}
            {/* 실전 모드 카드 */}
            <Panel style={{ padding: '26px 30px', background: 'linear-gradient(135deg, rgba(245,208,97,.12), rgba(245,208,97,.02) 60%, transparent)', border: '1px solid rgba(245,208,97,.26)' }}>
              <div className="mb-2 flex items-center gap-2.5"><span className="rounded px-2 py-[3px] text-[10.5px] font-bold tracking-[.06em]" style={{ background: COMPASS, color: '#0a1230' }}>LIVE</span><span className="text-[11px] font-semibold tracking-[.18em]" style={{ color: COMPASS }}>실전 항해 · 거래소 연동</span></div>
              <h3 className="my-1 text-[21px] font-bold">준비됐다면 실계좌로 항해하세요.</h3>
              <p className="m-0 text-[14.5px] leading-relaxed text-white/70">KIS·업비트·비트겟 API를 연결하면 실제 보유 자산을 한 곳에서 관리할 수 있어요.</p>
              <button onClick={() => navigate('/dashboard')} className="mt-5 inline-flex items-center gap-2.5 rounded-xl px-6 py-3.5 text-[14px] font-semibold" style={{ border: '1px solid rgba(245,208,97,.5)', background: 'linear-gradient(180deg,#f5d061 0%,#e3b73e 100%)', color: '#0a1230', boxShadow: '0 12px 28px -12px rgba(245,208,97,.5)' }}>실전 모드로 →</button>
            </Panel>
          </div>
          <RightRail go={p => navigate(`/virt${p}`)} returnRate={portfolio?.returnRate ?? null} />
        </div>
        <Footer />
      </div>
    </HelmShell>
  );
};

/* non-virt = 실계좌, virt = 모의투자 */
const ConsoleDashboardPage = () => {
  const { isVirt } = useRoutePrefix();
  return isVirt ? <VirtDashboard /> : <RealDashboard />;
};

export default ConsoleDashboardPage;
