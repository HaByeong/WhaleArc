import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRoutePrefix } from '../hooks/useRoutePrefix';
import HelmShell from '../components/HelmShell';
import { rankingService, type RankingEntry, type RankingType } from '../services/rankingService';

/* ────────────────────────────────────────────────────────────
   ConsoleStatusPage — 투자 현황(항해사 랭킹) 실데이터 배선
   rankingService.getRankings(대표 포트폴리오 수익률 글로벌 리더보드) + getMyRanking(내 순위).
   ※ 모드 무관(페이퍼 수익률 기준 단일 랭킹). API에 승률·팔로워 없음 → 순위변동·총자산으로 대체.
   ──────────────────────────────────────────────────────────── */

const UP = '#ef4d4d', DOWN = '#4d8aff', SONAR = 'var(--ci-sonar)';
const INK1 = 'var(--ci-ink1)', INK2 = 'var(--ci-ink2)', INK3 = 'var(--ci-ink3)';
const HAIR = 'var(--ci-line)', HAIR_S = 'var(--ci-line-strong)';
const ABYSS0 = '#060b1f', ABYSS1 = 'var(--ci-card)', SONAR_DIM = 'rgba(91,157,255,.10)';
const panel: React.CSSProperties = { background: 'var(--ci-panel)', border: `1px solid ${HAIR}`, borderRadius: 16, boxShadow: 'var(--ci-panel-shadow)' };
const won = (n: number) => '₩' + Math.round(n).toLocaleString('ko-KR');
const Tri = ({ up }: { up: boolean }) => <svg width="9" height="9" viewBox="0 0 10 10" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 2 }}><path d={up ? 'M5 1l4 7H1z' : 'M5 9L1 2h8z'} fill={up ? UP : DOWN} /></svg>;
const PERIODS: { label: string; type: RankingType }[] = [{ label: '일간', type: 'daily' }, { label: '주간', type: 'weekly' }, { label: '월간', type: 'monthly' }, { label: '전체', type: 'all' }];
const PAGE_SIZE = 20;
// 현재 페이지 주변 페이지 번호 윈도(최대 7개)
const pageWindow = (page: number, total: number) => {
  const max = Math.min(7, total); let start = Math.max(0, page - 3);
  if (start + max > total) start = Math.max(0, total - max);
  return Array.from({ length: max }, (_, i) => start + i);
};

// 고래 등급 = 대표 수익률 기준 (API 미제공 → 파생)
const TIERS: Record<string, { label: string; c: string }> = { blue: { label: '대왕고래', c: '#5b9dff' }, humpback: { label: '혹등고래', c: '#ef4d4d' }, orca: { label: '범고래', c: '#cfa14b' }, beluga: { label: '흰고래', c: '#9aa7c7' } };
const tierOf = (ret: number) => (ret >= 100 ? 'blue' : ret >= 50 ? 'humpback' : ret >= 20 ? 'orca' : 'beluga');
const Avatar = ({ name, c, size = 36 }: { name: string; c: string; size?: number }) => (
  <span className="flex shrink-0 items-center justify-center font-bold" style={{ width: size, height: size, borderRadius: 11, background: `linear-gradient(135deg, ${c}, ${c}88)`, color: ABYSS0, fontSize: size * 0.4 }}>{name.slice(0, 1)}</span>
);

type Row = { rank: number; name: string; tier: string; strat: string; ret: number; total: number; change: number; portfolioId: string; me?: boolean };
const toRow = (e: RankingEntry): Row => ({ rank: e.rank, name: e.nickname || '익명 항해사', tier: tierOf(e.totalReturn), strat: e.routeName || e.portfolioName || '대표 항로 없음', ret: e.totalReturn, total: e.totalValue, change: e.rankChange, portfolioId: e.portfolioId, me: e.isMyRanking });

const COLS = '48px auto 1fr 78px 110px auto';
const ChangeCell = ({ c }: { c: number }) => (
  <div className="text-right">
    <div className="text-[11px]" style={{ color: INK3 }}>변동</div>
    {c === 0 ? <div className="font-mono text-[13px] font-semibold" style={{ color: INK3 }}>—</div>
      : <div className="font-mono text-[13px] font-semibold" style={{ color: c > 0 ? UP : DOWN }}>{c > 0 ? '▲' : '▼'}{Math.abs(c)}</div>}
  </div>
);
const Rrow = ({ t, onRoute }: { t: Row; onRoute: (id: string) => void }) => {
  const tier = TIERS[t.tier], up = t.ret >= 0;
  return (
    <div className="grid items-center gap-3.5 px-5 py-3.5" style={{ gridTemplateColumns: COLS, background: t.me ? SONAR_DIM : 'transparent', borderTop: `1px solid ${HAIR}`, borderLeft: t.me ? `2px solid ${SONAR}` : '2px solid transparent' }}>
      <span className="text-center font-mono text-[16px] font-bold" style={{ color: t.me ? SONAR : INK2 }}>{t.rank}</span>
      <Avatar name={t.name} c={tier.c} />
      <div className="min-w-0">
        <div className="flex items-center gap-2"><span className="truncate text-[14px] font-semibold">{t.name}</span>{t.me && <span className="rounded px-1.5 py-px text-[10px] font-bold text-white" style={{ background: SONAR }}>나</span>}</div>
        <div className="mt-0.5 truncate text-[11.5px] font-semibold" style={{ color: tier.c }}>{tier.label} · {t.strat}</div>
      </div>
      <ChangeCell c={t.change} />
      <div className="text-right"><div className="font-mono text-[17px] font-bold" style={{ color: up ? UP : DOWN }}><Tri up={up} />{up ? '+' : ''}{t.ret.toFixed(1)}%</div><div className="mt-0.5 font-mono text-[11px]" style={{ color: INK3 }}>{won(t.total)}</div></div>
      <button onClick={() => onRoute(t.portfolioId)} className="whitespace-nowrap rounded-lg px-3.5 py-2 text-[12.5px] font-semibold" style={t.me ? { border: `1px solid ${HAIR_S}`, background: 'transparent', color: INK1 } : { border: '1px solid rgba(91,157,255,.32)', background: SONAR_DIM, color: SONAR }}>{t.me ? '내 프로필' : '항로 보기'}</button>
    </div>
  );
};

const Podium = ({ top, onRoute }: { top: Row[]; onRoute: (id: string) => void }) => {
  const order = [top[1], top[0], top[2]].filter(Boolean); const htMap: Record<number, number> = { 1: 132, 2: 104, 3: 88 };
  return (
    <div className="grid grid-cols-3 items-end gap-3.5">
      {order.map(t => {
        const tier = TIERS[t.tier], first = t.rank === 1, up = t.ret >= 0;
        return (
          <button key={t.rank} onClick={() => onRoute(t.portfolioId)} className="min-w-0 overflow-hidden text-center" style={{ ...panel, padding: '18px 10px', border: first ? '1px solid rgba(91,157,255,.4)' : `1px solid ${HAIR}`, background: first ? 'linear-gradient(180deg, rgba(91,157,255,.12), rgba(14,40,56,.4))' : undefined }}>
            <div className="mb-2" style={{ fontSize: first ? 22 : 18 }}>{first ? '🐋' : t.rank === 2 ? '🥈' : '🥉'}</div>
            <div className="mb-2.5 flex justify-center"><Avatar name={t.name} c={tier.c} size={first ? 52 : 42} /></div>
            <div className="truncate text-[14px] font-bold">{t.name}</div>
            <div className="mt-0.5 text-[11px] font-semibold" style={{ color: tier.c }}>{tier.label}</div>
            <div className="mt-2.5 truncate font-mono font-bold" style={{ fontSize: first ? 'clamp(20px,5.5vw,34px)' : 'clamp(16px,4.5vw,23px)', color: up ? UP : DOWN }}>{up ? '+' : ''}{t.ret.toFixed(1)}%</div>
            <div className="mt-3 flex items-start justify-center pt-2" style={{ height: htMap[t.rank] - 70, borderRadius: '8px 8px 0 0', background: first ? 'linear-gradient(180deg, rgba(91,157,255,.3), transparent)' : 'linear-gradient(180deg, rgba(255,255,255,.06), transparent)' }}>
              <span className="font-mono text-[18px] font-bold" style={{ color: first ? SONAR : INK2 }}>{t.rank}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
};

const ConsoleStatusPage = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { isVirt, prefix } = useRoutePrefix();
  const userName = session?.user?.email ? session.user.email.split('@')[0] : '항해사';
  const [period, setPeriod] = useState('전체');
  const [page, setPage] = useState(0);
  const [entries, setEntries] = useState<RankingEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState<{ avgReturn: number; positiveCount: number; negativeCount: number } | null>(null);
  const [my, setMy] = useState<{ currentRank: number; previousRank: number; totalReturn: number; totalValue: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const isPreview = import.meta.env.DEV && window.location.pathname.startsWith('/preview');

  const load = useCallback(() => {
    if (isPreview) { setLoading(false); return; }
    setLoading(true);
    const type = PERIODS.find(p => p.label === period)?.type || 'all';
    Promise.all([rankingService.getRankings(type, page, PAGE_SIZE).catch(() => null), rankingService.getMyRanking().catch(() => null)])
      .then(([r, m]) => {
        if (r) {
          setEntries(r.rankings || []);
          setTotalCount(r.totalCount || (r.rankings?.length ?? 0));
          setTotalPages(Math.max(1, r.totalPages || 1));
          setStats({ avgReturn: r.avgReturn ?? 0, positiveCount: r.positiveCount ?? 0, negativeCount: r.negativeCount ?? 0 });
        }
        setMy(m); setError(!r);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [isPreview, period, page]);
  useEffect(() => { load(); }, [load]);
  const changePeriod = (p: string) => { setPeriod(p); setPage(0); };

  const rows = useMemo(() => entries.map(toRow), [entries]);
  const onRoute = (id: string) => navigate(`${prefix}/portfolio/${id}`);
  const myEntry = rows.find(r => r.me);
  const myTier = TIERS[tierOf(my?.totalReturn ?? 0)];
  const myChange = my ? my.previousRank - my.currentRank : 0;
  const topPct = my && totalCount > 0 ? Math.max(1, Math.round((my.currentRank / totalCount) * 100)) : null;

  return (
    <HelmShell active="status" virt={isVirt} userName={userName} session="랭킹 갱신 매일 00:00">
      <div className="mx-auto flex max-w-[1560px] flex-col gap-[18px]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0"><h1 className="text-[26px] font-bold">항해사 랭킹</h1><p className="mt-2 text-[13.5px]" style={{ color: INK1 }}>각 항해사의 대표 포트폴리오 수익률로 매기는 순위. 마음에 드는 항로는 따라가 보세요.</p></div>
          <div className="flex gap-[3px] rounded-[9px] p-[3px]" style={{ background: ABYSS1, border: `1px solid ${HAIR}` }}>
            {PERIODS.map(p => <button key={p.label} onClick={() => changePeriod(p.label)} className="rounded-md px-3.5 py-1.5 text-[12px] font-semibold" style={{ background: period === p.label ? SONAR_DIM : 'transparent', color: period === p.label ? SONAR : INK2 }}>{p.label}</button>)}
          </div>
        </div>

        {loading ? (
          <div style={{ ...panel, padding: '60px 30px' }} className="flex flex-col items-center gap-3"><span className="h-8 w-8 animate-spin rounded-full" style={{ border: `3px solid rgba(91,157,255,.25)`, borderTopColor: SONAR }} /><span className="text-[13px]" style={{ color: INK2 }}>랭킹을 불러오는 중…</span></div>
        ) : error || rows.length === 0 ? (
          <div style={{ ...panel, padding: '60px 30px', textAlign: 'center' }}>
            <div className="mb-1 text-[28px]">{error ? '🧭' : '🌊'}</div>
            <div className="text-[15px] font-semibold">{error ? '랭킹을 불러오지 못했습니다.' : '아직 랭킹 데이터가 없습니다.'}</div>
            <p className="mt-2 text-[13px]" style={{ color: INK3 }}>{error ? '잠시 후 다시 시도해주세요.' : '모의투자로 첫 항해를 시작하면 이곳 순위에 등록됩니다. 가상돈 ₩10,000,000으로 부담 없이 시작해보세요.'}</p>
            {error
              ? <button onClick={load} className="mt-4 rounded-[10px] px-5 py-2.5 text-[13.5px] font-semibold" style={{ border: '1px solid rgba(91,157,255,.32)', background: SONAR_DIM, color: SONAR }}>다시 시도 ↻</button>
              : <div className="mt-5 flex flex-col items-center gap-2.5 sm:flex-row sm:justify-center">
                  <button onClick={() => navigate('/virt/dashboard')} className="w-full rounded-[10px] px-5 py-2.5 text-[13.5px] font-bold text-white sm:w-auto" style={{ border: '1px solid rgba(140,190,255,.5)', background: 'linear-gradient(180deg,#4d8aff 0%,#2c6fe6 62%,#2257c8 100%)' }}>모의투자 시작하기 →</button>
                  <button onClick={() => navigate(`${prefix}/store`)} className="w-full rounded-[10px] px-5 py-2.5 text-[13.5px] font-semibold sm:w-auto" style={{ border: '1px solid rgba(91,157,255,.32)', background: SONAR_DIM, color: SONAR }}>전략 학습 둘러보기</button>
                </div>}
          </div>
        ) : (
          <>
            {page === 0 && rows.length >= 3 && <Podium top={rows.slice(0, 3)} onRoute={onRoute} />}

            {/* 기간별 통계 */}
            {stats && (
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                {[
                  { l: '참여 항해사', v: `${totalCount}명`, c: 'var(--ci-ink0)' },
                  { l: '평균 수익률', v: `${stats.avgReturn >= 0 ? '+' : ''}${stats.avgReturn.toFixed(2)}%`, c: stats.avgReturn >= 0 ? UP : DOWN },
                  { l: '수익 항해사', v: `${stats.positiveCount}명`, c: UP },
                  { l: '손실 항해사', v: `${stats.negativeCount}명`, c: DOWN },
                ].map(s => (
                  <div key={s.l} style={{ ...panel, padding: '14px 18px' }}>
                    <div className="text-[11px] tracking-[.08em]" style={{ color: INK2 }}>{s.l}</div>
                    <div className="mt-1 font-mono text-[20px] font-bold" style={{ color: s.c }}>{s.v}</div>
                  </div>
                ))}
              </div>
            )}

            {/* 내 순위 */}
            {my && (
              <div style={{ ...panel, padding: '18px 22px', background: 'linear-gradient(135deg, rgba(91,157,255,.12), rgba(14,40,56,.4))', border: '1px solid rgba(91,157,255,.32)' }}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="text-center"><div className="text-[10.5px] tracking-[.1em]" style={{ color: INK2 }}>내 순위</div><div className="font-mono text-[36px] font-bold leading-none">#{my.currentRank}</div></div>
                    <Avatar name={myEntry?.name || userName} c={myTier.c} size={44} />
                    <div><div className="text-[15px] font-bold">{myEntry?.name || userName}</div><div className="mt-0.5 text-[12px] font-semibold" style={{ color: myTier.c }}>{myTier.label} · {myEntry?.strat || '대표 항로 없음'}</div></div>
                  </div>
                  <div className="flex flex-wrap items-center gap-7">
                    <div className="text-right"><div className="text-[11px]" style={{ color: INK3 }}>대표 수익률</div><div className="font-mono text-[26px] font-bold" style={{ color: my.totalReturn >= 0 ? UP : DOWN }}><Tri up={my.totalReturn >= 0} />{my.totalReturn >= 0 ? '+' : ''}{my.totalReturn.toFixed(2)}%</div></div>
                    <div className="text-right"><div className="text-[11px]" style={{ color: INK3 }}>순위 변동</div><div className="font-mono text-[16px] font-semibold" style={{ color: myChange > 0 ? UP : myChange < 0 ? DOWN : INK2 }}>{myChange === 0 ? '—' : `${myChange > 0 ? '▲' : '▼'}${Math.abs(myChange)}`}</div></div>
                    {topPct != null && <div className="text-right"><div className="text-[11px]" style={{ color: INK3 }}>상위</div><div className="font-mono text-[16px] font-semibold">{topPct}%</div></div>}
                  </div>
                </div>
              </div>
            )}

            {/* 전체 랭킹 */}
            <div style={{ ...panel, padding: 0 }}>
              <div className="flex flex-wrap items-center justify-between gap-3 px-[22px] py-[18px]" style={{ borderBottom: `1px solid ${HAIR}` }}>
                <div><div className="mb-1 text-[10.5px] font-semibold tracking-[.2em]" style={{ color: SONAR }}>LEADERBOARD</div><h3 className="text-[15.5px] font-bold">전체 랭킹 <span className="font-mono text-[12px] font-medium" style={{ color: INK3 }}>{totalCount}명</span></h3></div>
                <span className="font-mono text-[11.5px]" style={{ color: INK3 }}>{period} 수익률 기준</span>
              </div>
              {/* 좁은 화면에서는 고정 6열 테이블을 가로 스크롤로(페이지 가로 넘침 방지) */}
              <div className="overflow-x-auto">
                <div className="min-w-[560px]">
                  <div className="grid gap-3.5 px-5 py-2.5 text-[10.5px] font-semibold uppercase tracking-[.1em]" style={{ gridTemplateColumns: COLS, color: INK3 }}>
                    <span className="text-center">순위</span><span /><span>항해사 · 대표 항로</span><span className="text-right">변동</span><span className="text-right">수익률 · 총자산</span><span />
                  </div>
                  {rows.map(t => <Rrow key={t.portfolioId} t={t} onRoute={onRoute} />)}
                </div>
              </div>
              {totalPages > 1 && (
                <div className="flex flex-wrap items-center justify-center gap-1.5 px-5 py-4" style={{ borderTop: `1px solid ${HAIR}` }}>
                  <button disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))} className="rounded-lg px-3 py-1.5 text-[12.5px] font-semibold disabled:opacity-35" style={{ border: `1px solid ${HAIR_S}`, background: 'transparent', color: INK1 }}>← 이전</button>
                  {pageWindow(page, totalPages).map(n => (
                    <button key={n} onClick={() => setPage(n)} className="min-w-[34px] rounded-lg px-2.5 py-1.5 font-mono text-[12.5px] font-bold" style={n === page ? { background: SONAR, color: '#fff', border: `1px solid ${SONAR}` } : { border: `1px solid ${HAIR}`, background: 'transparent', color: INK1 }}>{n + 1}</button>
                  ))}
                  <button disabled={page >= totalPages - 1} onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} className="rounded-lg px-3 py-1.5 text-[12.5px] font-semibold disabled:opacity-35" style={{ border: `1px solid ${HAIR_S}`, background: 'transparent', color: INK1 }}>다음 →</button>
                  <span className="ml-2 font-mono text-[11.5px]" style={{ color: INK3 }}>{page + 1} / {totalPages}</span>
                </div>
              )}
            </div>
          </>
        )}

        <footer className="mt-2 flex flex-col gap-1 pt-5 sm:flex-row sm:flex-wrap sm:justify-between sm:gap-3" style={{ borderTop: `1px solid ${HAIR}` }}>
          <span className="font-mono text-[11.5px]" style={{ color: INK3 }}>© 2026 WHALEARC · 랭킹은 대표 포트폴리오 수익률 기준 · 투자 권유가 아닙니다.</span>
          <span className="text-[11.5px]" style={{ color: INK3 }}>Built quietly, beneath the surface.</span>
        </footer>
      </div>
    </HelmShell>
  );
};

export default ConsoleStatusPage;
