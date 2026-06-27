import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import HelmShell from '../components/HelmShell';
import ExchangeConnectModal from '../components/ExchangeConnectModal';
import { exchangeService, type ExchangeType, type ExchangeAccount, type ExchangePortfolio, type ExchangeTransaction } from '../services/exchangeService';
import { userService } from '../services/userService';

/* ────────────────────────────────────────────────────────────
   ConsoleExchangePage — /api-setting (거래소 연결 관리) · exchangeService
   연결 관리 + 보유 종목/체결 내역 탭 + 연결 테스트 + 10초 폴링 + 키발급 가이드.
   ──────────────────────────────────────────────────────────── */

const SONAR = 'var(--ci-sonar)';
const UP = '#ef4d4d', DOWN = '#4d8aff', GOOD = '#3fd6a0';
const INK1 = 'var(--ci-ink1)', INK2 = 'var(--ci-ink2)', INK3 = 'var(--ci-ink3)';
const LINE = 'var(--ci-line)';
const panel: React.CSSProperties = { background: 'var(--ci-panel)', border: `1px solid ${LINE}`, borderRadius: 16, boxShadow: 'var(--ci-panel-shadow)' };
const fmtKRW = (n: number) => '₩' + Math.round(n || 0).toLocaleString('ko-KR');
// 보유종목 단가/평가는 표시 통화로(해외주식=USD는 $, 그 외 ₩). 합계는 항상 ₩(서버가 KRW 환산).
const fmtMoney = (n: number, cur?: string) => cur === 'USD'
  ? '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  : fmtKRW(n);
const fmtQty = (n: number) => (Number.isInteger(n) ? n.toLocaleString('ko-KR') : n.toLocaleString('ko-KR', { maximumFractionDigits: 4 }));
// KIS 체결시각 "20260604 153012" → "06-04 15:30"
const fmtExecAt = (s: string) => {
  const [d, t] = (s || '').trim().split(/\s+/);
  if (!d || d.length < 8) return s || '-';
  const hm = t && t.length >= 4 ? ` ${t.slice(0, 2)}:${t.slice(2, 4)}` : '';
  return `${d.slice(4, 6)}-${d.slice(6, 8)}${hm}`;
};

const EXCHANGES: { key: ExchangeType; name: string; devel: string; guide: string; steps: string[] }[] = [
  { key: 'KIS', name: 'KIS (한국투자증권)', devel: 'KIS Developers', guide: 'KIS Developers에서 앱키·앱시크릿·계좌번호를 발급받아 입력하세요.',
    steps: ['KIS Developers(apiportal.koreainvestment.com) 로그인', 'My Page → 앱(App) 등록 → 모의/실전 선택', '발급된 App Key · App Secret 복사', '계좌번호(예: 50123456-01) 확인 후 입력', '※ 권한은 “시세조회·잔고조회” 등 읽기 전용만 권장'] },
  { key: 'UPBIT', name: '업비트', devel: '업비트 Open API', guide: '업비트 Open API에서 Access/Secret Key를 발급받아 입력하세요.',
    steps: ['업비트 → 고객센터 → Open API 안내 → API Key 발급', '자산조회 권한만 체크 (주문·출금 권한 해제)', '발급된 Access Key · Secret Key 복사', '허용 IP는 비워두거나 서버 IP만 등록'] },
  { key: 'BITGET', name: '비트겟', devel: 'Bitget API', guide: 'Bitget API에서 API Key·Secret을 발급받아 입력하세요.',
    steps: ['Bitget → API Management → Create API', 'Read-only 권한만 선택 (Trade·Withdraw 해제)', 'API Key · Secret Key · Passphrase 복사', '바인딩 IP 설정(선택)'] },
];

const Toast = ({ msg, type }: { msg: string; type: 'success' | 'error' }) => (
  <div className="fixed bottom-6 left-1/2 z-[130] -translate-x-1/2 rounded-xl px-5 py-3 text-[14px] font-semibold text-white" style={{ background: type === 'error' ? 'linear-gradient(180deg,#e0524f,#c23b38)' : 'linear-gradient(180deg,#2f9e6e,#1f7d57)', boxShadow: '0 14px 32px -10px rgba(0,0,0,.55)', animation: 'message-in .25s ease' }}>{msg}</div>
);

const ConsoleExchangePage = () => {
  const { session } = useAuth();
  const fallbackName = session?.user?.email ? session.user.email.split('@')[0] : '항해사';
  const [name, setName] = useState(fallbackName);
  const [accounts, setAccounts] = useState<ExchangeAccount[]>([]);
  const [ports, setPorts] = useState<Partial<Record<ExchangeType, ExchangePortfolio | null>>>({});
  const [txns, setTxns] = useState<Partial<Record<ExchangeType, ExchangeTransaction[]>>>({});
  const [selectedEx, setSelectedEx] = useState<ExchangeType | null>(null);
  const [detailTab, setDetailTab] = useState<'holdings' | 'trades'>('holdings');
  const [guideOpen, setGuideOpen] = useState<ExchangeType | null>(null);
  const [testing, setTesting] = useState<ExchangeType | null>(null);
  const [loading, setLoading] = useState(true);
  const [setup, setSetup] = useState<ExchangeType | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const toastTimer = useRef<number | null>(null);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);
  const isPreview = import.meta.env.DEV && window.location.pathname.startsWith('/preview');

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => { setToast({ msg, type }); if (toastTimer.current) clearTimeout(toastTimer.current); toastTimer.current = window.setTimeout(() => setToast(null), 2800); };

  const load = useCallback(async (silent = false) => {
    if (isPreview) { setLoading(false); return; }
    if (!silent) setLoading(true);
    try {
      userService.getProfile().then(p => { if (p?.name) setName(p.name); }).catch(() => {});
      const accs = await exchangeService.getAccounts().catch(() => [] as ExchangeAccount[]);
      setAccounts(accs);
      const connected = accs.filter(a => a.connected);
      const p: Partial<Record<ExchangeType, ExchangePortfolio | null>> = {};
      const t: Partial<Record<ExchangeType, ExchangeTransaction[]>> = {};
      await Promise.all(connected.map(async a => {
        await exchangeService.getPortfolio(a.exchangeType).then(r => { p[a.exchangeType] = r; }).catch(() => { p[a.exchangeType] = null; });
        if (a.exchangeType === 'KIS') await exchangeService.getTransactions('KIS').then(r => { t['KIS'] = r; }).catch(() => { t['KIS'] = []; });
      }));
      setPorts(p);
      setTxns(t);
      // 최초/선택 거래소가 끊겼으면 첫 연결 거래소 자동 선택
      setSelectedEx(prev => (prev && connected.some(a => a.exchangeType === prev)) ? prev : (connected[0]?.exchangeType ?? null));
    } finally { if (!silent) setLoading(false); }
  }, [isPreview]);
  useEffect(() => { load(); }, [load]);
  // 10초 자동 갱신 (조용히)
  useEffect(() => {
    if (isPreview) return;
    const id = setInterval(() => load(true), 10_000);
    return () => clearInterval(id);
  }, [isPreview, load]);

  const accOf = (t: ExchangeType) => accounts.find(a => a.exchangeType === t);
  const connectedList = useMemo(() => EXCHANGES.filter(e => accounts.find(a => a.exchangeType === e.key)?.connected), [accounts]);

  const testConnection = async (ex: ExchangeType) => {
    setTesting(ex);
    try {
      const port = await exchangeService.getPortfolio(ex);
      setPorts(prev => ({ ...prev, [ex]: port }));
      if (ex === 'KIS') exchangeService.getTransactions('KIS').then(r => setTxns(prev => ({ ...prev, KIS: r }))).catch(() => {});
      if (!port?.connected) showToast('미연결 상태입니다. API 키를 먼저 등록하세요.', 'error');
      else if ((port.holdings?.length ?? 0) > 0 || port.cashBalance > 0) showToast(`연결 성공 · 보유 ${port.holdings.length}종목 · 평가 ${fmtKRW(port.totalValue)}`, 'success');
      else showToast('응답은 받았으나 자산이 0입니다. 키 권한·계좌번호를 확인하세요.', 'error');
    } catch {
      showToast('연결 테스트에 실패했습니다. 잠시 후 다시 시도하세요.', 'error');
    } finally { setTesting(null); }
  };

  const detailPort = selectedEx ? ports[selectedEx] : null;
  const detailTxns = selectedEx === 'KIS' ? (txns.KIS ?? []) : [];

  return (
    <HelmShell active="" virt={false} userName={name} session="거래소 연결 관리">
      <div className="mx-auto flex max-w-[1120px] flex-col gap-5">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">거래소 연결 관리</h1>
          <p className="mt-1.5 text-[14.5px] leading-relaxed" style={{ color: INK1 }}>실계좌 거래소 API 키를 연결하면 대시보드·포트폴리오에 실제 자산이 표시됩니다. 키는 <span style={{ color: 'var(--ci-ink0)' }}>AES 암호화</span>로 저장되며 <span style={{ color: 'var(--ci-ink0)' }}>읽기 전용 권한</span>만 사용합니다.</p>
        </div>

        {/* 최초 로드 중에는 상단에 표시 (예전엔 본문 맨 아래에 떠 초기 빈 화면처럼 보였음) */}
        {loading && accounts.length === 0 && <div className="py-2 text-center text-[14px]" style={{ color: INK3 }}>불러오는 중…</div>}

        {/* 연결 카드 */}
        <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))' }}>
          {EXCHANGES.map(e => {
            const acc = accOf(e.key); const conn = !!acc?.connected; const port = ports[e.key]; const open = guideOpen === e.key;
            return (
              <div key={e.key} style={{ ...panel, padding: '22px 24px' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><div className="text-[17.5px] font-bold">{e.name}</div><div className="mt-0.5 text-[12.5px]" style={{ color: INK3 }}>{e.devel}</div></div>
                  <span className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold" style={conn ? { background: 'rgba(63,214,160,.14)', color: GOOD, border: '1px solid rgba(63,214,160,.3)' } : { background: 'var(--ci-card)', color: INK3, border: `1px solid ${LINE}` }}>{conn ? '● 연결됨' : '미연결'}</span>
                </div>
                {conn && port ? (
                  <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                    <div><div className="text-[11.5px] tracking-[.06em]" style={{ color: INK2 }}>총 평가금액</div><div className="mt-0.5 font-mono text-[17.5px] font-bold">{fmtKRW(port.totalValue)}</div></div>
                    <div><div className="text-[11.5px] tracking-[.06em]" style={{ color: INK2 }}>평가 손익</div><div className="mt-0.5 font-mono text-[17.5px] font-bold" style={{ color: port.totalProfitLoss >= 0 ? UP : DOWN }}>{port.totalProfitLoss >= 0 ? '+' : ''}{port.totalReturnRate.toFixed(2)}%</div></div>
                    <div className="col-span-2"><div className="text-[11.5px] tracking-[.06em]" style={{ color: INK2 }}>보유 종목</div><div className="mt-0.5 text-[14px]" style={{ color: INK1 }}>{port.holdings.length}개 · 현금 <span className="font-mono">{fmtKRW(port.cashBalance)}</span></div></div>
                  </div>
                ) : (
                  <p className="mt-3 text-[13.5px] leading-relaxed" style={{ color: INK2 }}>{e.guide}</p>
                )}

                {/* 키 발급 가이드 */}
                <button onClick={() => setGuideOpen(open ? null : e.key)} className="mt-3 flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: SONAR }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}><path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  키 발급 방법
                </button>
                {open && (
                  <ol className="mt-2 flex flex-col gap-1.5 rounded-lg px-3.5 py-3 text-[13px] leading-relaxed" style={{ background: 'var(--ci-card)', border: `1px solid ${LINE}`, color: INK1, listStyle: 'none', counterReset: 'g' }}>
                    {e.steps.map((s, i) => <li key={i} className="flex gap-2"><span className="font-mono font-bold" style={{ color: SONAR }}>{i + 1}.</span><span>{s}</span></li>)}
                  </ol>
                )}

                <div className="mt-4 flex gap-2">
                  <button onClick={() => setSetup(e.key)} className="flex-1 rounded-lg py-2.5 text-[14.5px] font-bold" style={conn ? { background: 'var(--ci-card)', color: INK1, border: `1px solid ${LINE}` } : { background: `linear-gradient(180deg, ${SONAR}, #2c6fe6)`, color: '#fff' }}>{conn ? '키 수정 / 해제' : '연결하기'}</button>
                  {conn && <button onClick={() => testConnection(e.key)} disabled={testing === e.key} className="rounded-lg px-3.5 py-2.5 text-[14px] font-semibold disabled:opacity-50" style={{ border: '1px solid rgba(91,157,255,.32)', background: 'rgba(91,157,255,.1)', color: SONAR }}>{testing === e.key ? '확인 중…' : '연결 테스트'}</button>}
                </div>
              </div>
            );
          })}
        </div>

        {/* 보유 종목 · 체결 내역 */}
        {connectedList.length > 0 && (
          <div style={{ ...panel, padding: 0 }}>
            <div className="flex flex-wrap items-center justify-between gap-3 px-[22px] py-4" style={{ borderBottom: `1px solid ${LINE}` }}>
              <div className="flex flex-wrap gap-1.5">
                {connectedList.map(e => { const on = selectedEx === e.key; return (
                  <button key={e.key} onClick={() => { setSelectedEx(e.key); setDetailTab('holdings'); }} className="rounded-lg px-3.5 py-1.5 text-[13.5px] font-semibold" style={{ border: on ? '1px solid rgba(91,157,255,.35)' : `1px solid ${LINE}`, background: on ? 'rgba(91,157,255,.12)' : 'transparent', color: on ? 'var(--ci-ink0)' : INK1 }}>{e.name.split(' ')[0]}</button>
                ); })}
              </div>
              <span className="font-mono text-[12px]" style={{ color: INK3 }}>10초 자동 갱신</span>
            </div>

            {detailPort && (
              <div className="grid gap-3 px-[22px] py-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', borderBottom: `1px solid ${LINE}` }}>
                {[
                  { l: '총 평가금액', v: fmtKRW(detailPort.totalValue), c: 'var(--ci-ink0)' },
                  { l: '평가 손익', v: `${detailPort.totalProfitLoss >= 0 ? '+' : ''}${fmtKRW(detailPort.totalProfitLoss)}`, c: detailPort.totalProfitLoss >= 0 ? UP : DOWN },
                  { l: '수익률', v: `${detailPort.totalReturnRate >= 0 ? '+' : ''}${detailPort.totalReturnRate.toFixed(2)}%`, c: detailPort.totalReturnRate >= 0 ? UP : DOWN },
                  { l: selectedEx === 'KIS' ? '예수금' : 'KRW 잔고', v: fmtKRW(detailPort.cashBalance), c: 'var(--ci-ink0)' },
                ].map(s => <div key={s.l}><div className="text-[11.5px] tracking-[.06em]" style={{ color: INK2 }}>{s.l}</div><div className="mt-0.5 font-mono text-[17.5px] font-bold" style={{ color: s.c }}>{s.v}</div></div>)}
              </div>
            )}
            {selectedEx === 'BITGET' && detailPort && (detailPort.usdtKrwRate ?? 0) > 0 && (
              <div className="px-[22px] pb-3 pt-1 text-[12.5px]" style={{ color: INK3 }}>※ USDT 자산은 실시간 환율 <span className="font-mono" style={{ color: INK1 }}>1 USDT ≈ ₩{Math.round(detailPort.usdtKrwRate!).toLocaleString('ko-KR')}</span> 로 원화 환산해 표시합니다.</div>
            )}

            {/* 탭 */}
            <div className="flex gap-1 px-[22px] pt-3">
              {([['holdings', `보유 ${selectedEx === 'KIS' ? '종목' : '코인'} (${detailPort?.holdings.length ?? 0})`], ['trades', `체결 내역${selectedEx === 'KIS' ? ` (${detailTxns.length})` : ''}`]] as const).map(([k, l]) => {
                const on = detailTab === k;
                return <button key={k} onClick={() => setDetailTab(k)} className="relative px-3.5 py-2.5 text-[14px]" style={{ color: on ? 'var(--ci-ink0)' : INK2, fontWeight: on ? 700 : 500 }}>{l}{on && <span className="absolute bottom-[-1px] left-2 right-2 h-0.5 rounded" style={{ background: SONAR }} />}</button>;
              })}
            </div>
            <div className="px-[22px] pb-5 pt-2">
              {detailTab === 'holdings' ? (
                !detailPort || detailPort.holdings.length === 0 ? (
                  <div className="py-14 text-center text-[14px]" style={{ color: INK3 }}>보유 종목이 없습니다</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[14px]">
                      <thead><tr className="text-[11.5px] uppercase tracking-[.08em]" style={{ color: INK3 }}>
                        <th className="px-2 py-2 text-left font-semibold">종목</th><th className="px-2 py-2 text-right font-semibold">수량</th><th className="px-2 py-2 text-right font-semibold">평균가</th><th className="px-2 py-2 text-right font-semibold">현재가</th><th className="px-2 py-2 text-right font-semibold">평가금액</th><th className="px-2 py-2 text-right font-semibold">손익</th>
                      </tr></thead>
                      <tbody>{detailPort.holdings.map((h, i) => (
                        <tr key={h.assetCode + i} style={{ borderTop: `1px solid ${LINE}` }}>
                          <td className="px-2 py-2.5"><div className="font-semibold">{h.assetName || h.assetCode}{h.currency === 'USD' && <span className="ml-1.5 rounded px-1 py-0.5 text-[10px] font-bold align-middle" style={{ background: 'rgba(91,157,255,.16)', color: SONAR }}>USD</span>}</div><div className="font-mono text-[12px]" style={{ color: INK3 }}>{h.assetCode}</div></td>
                          <td className="px-2 py-2.5 text-right font-mono">{fmtQty(h.quantity)}</td>
                          <td className="px-2 py-2.5 text-right font-mono">{fmtMoney(h.averagePrice, h.currency)}</td>
                          <td className="px-2 py-2.5 text-right font-mono">{fmtMoney(h.currentPrice, h.currency)}</td>
                          <td className="px-2 py-2.5 text-right font-mono font-semibold">{fmtMoney(h.marketValue, h.currency)}</td>
                          <td className="px-2 py-2.5 text-right font-mono font-semibold" style={{ color: h.profitLoss >= 0 ? UP : DOWN }}>{h.profitLoss >= 0 ? '+' : ''}{h.returnRate.toFixed(2)}%</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )
              ) : selectedEx !== 'KIS' ? (
                <div className="py-14 text-center text-[14px]" style={{ color: INK3 }}>코인 체결 내역은 지원 예정입니다</div>
              ) : detailTxns.length === 0 ? (
                <div className="py-14 text-center text-[14px]" style={{ color: INK3 }}>최근 30일 체결 내역이 없습니다</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[14px]">
                    <thead><tr className="text-[11.5px] uppercase tracking-[.08em]" style={{ color: INK3 }}>
                      <th className="px-2 py-2 text-left font-semibold">체결시각</th><th className="px-2 py-2 text-left font-semibold">종목</th><th className="px-2 py-2 text-center font-semibold">구분</th><th className="px-2 py-2 text-right font-semibold">수량</th><th className="px-2 py-2 text-right font-semibold">체결가</th><th className="px-2 py-2 text-right font-semibold">금액</th>
                    </tr></thead>
                    <tbody>{detailTxns.map((t, i) => (
                      <tr key={t.orderId + i} style={{ borderTop: `1px solid ${LINE}` }}>
                        <td className="px-2 py-2.5 font-mono text-[13px]" style={{ color: INK1 }}>{fmtExecAt(t.executedAt)}</td>
                        <td className="px-2 py-2.5"><div className="font-semibold">{t.stockName || t.stockCode}</div><div className="font-mono text-[12px]" style={{ color: INK3 }}>{t.stockCode}</div></td>
                        <td className="px-2 py-2.5 text-center"><span className="rounded px-1.5 py-0.5 text-[12px] font-bold" style={t.side === 'BUY' ? { background: 'rgba(239,77,77,.12)', color: UP } : { background: 'rgba(77,138,255,.12)', color: DOWN }}>{t.side === 'BUY' ? '매수' : '매도'}</span></td>
                        <td className="px-2 py-2.5 text-right font-mono">{fmtQty(t.quantity)}</td>
                        <td className="px-2 py-2.5 text-right font-mono">{fmtKRW(t.price)}</td>
                        <td className="px-2 py-2.5 text-right font-mono font-semibold">{fmtKRW(t.totalAmount)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        <p className="text-[12.5px]" style={{ color: INK3 }}>🔒 WhaleArc는 거래 권한 없는 읽기 전용 키만 사용합니다. 출금·주문 권한이 포함된 키는 등록하지 마세요. 체결 내역은 KIS(주식) 최근 30일 기준입니다.</p>
      </div>
      {setup && <ExchangeConnectModal exchangeType={setup} account={accOf(setup)} onClose={() => setSetup(null)} onSaved={(msg, type) => { showToast(msg, type); load(); }} />}
      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </HelmShell>
  );
};

export default ConsoleExchangePage;
