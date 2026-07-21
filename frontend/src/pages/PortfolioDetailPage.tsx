import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRoutePrefix } from '../hooks/useRoutePrefix';
import { useAuth } from '../contexts/AuthContext';
import HelmShell from '../components/HelmShell';
import SplashLoading from '../components/SplashLoading';
import VirtSplashLoading from '../components/VirtSplashLoading';
import apiClient, { getErrorMessage } from '../utils/api';

/* ────────────────────────────────────────────────────────────
   PortfolioDetailPage — 「디자인 개편」 톤. 공개 포트폴리오 상세(투자 현황 진입).
   HelmShell + 목업 다크 패널. 데이터 로딩 로직 보존.
   ──────────────────────────────────────────────────────────── */

const UP = '#ef4d4d', DOWN = '#4d8aff', SONAR = '#5b9dff';
const INK1 = 'rgba(255,255,255,.72)', INK2 = 'rgba(255,255,255,.48)', INK3 = 'rgba(255,255,255,.28)';
const HAIR = 'rgba(255,255,255,.10)';
const panel: React.CSSProperties = { background: 'linear-gradient(180deg,rgba(20,34,62,.6),rgba(9,17,38,.55))', border: `1px solid ${HAIR}`, borderRadius: 16, boxShadow: '0 1px 0 rgba(255,255,255,.05) inset, 0 10px 28px -18px rgba(0,0,0,.6)' };
const retColor = (v: number) => (v > 0 ? UP : v < 0 ? DOWN : INK2);

interface PortfolioSummary {
  portfolioId: string;
  portfolioName: string;
  nickname: string;
  currentRank: number;
  totalReturn: number;
  totalReturnAmount: number;
  initialCapital: number;
  totalValue: number;
  stockCount: number;
  cryptoCount: number;
  routeName?: string | null;
  routeStrategyType?: string | null;
  routeReturnRate?: number | null;
  routeDescription?: string | null;
}

const PortfolioDetailPage = () => {
  const { portfolioId } = useParams<{ portfolioId: string }>();
  const { prefix, isVirt } = useRoutePrefix();
  const { profileName } = useAuth();
  const navigate = useNavigate();
  // 표시명은 DB 닉네임(profileName) 단일 소스 — 대시보드·포트폴리오와 동일(이메일 ID 노출 방지)
  const userName = profileName || '항해사';
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (portfolioId) loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolioId]);

  const loadDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get(`/api/rankings/portfolios/${portfolioId}`);
      setPortfolio(res.data.data);
    } catch (err) {
      setError(getErrorMessage(err, '포트폴리오 정보를 불러오는데 실패했습니다.'));
    } finally {
      setLoading(false);
    }
  };

  const signPrefix = (v: number) => (v > 0 ? '+' : '');
  const fmt = (amount: number) =>
    new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
  const fmtCompact = (amount: number) => {
    const abs = Math.abs(amount);
    if (abs >= 1_0000_0000) return `${(amount / 1_0000_0000).toFixed(1)}억`;
    if (abs >= 1_0000) return `${(amount / 1_0000).toFixed(0)}만`;
    return fmt(amount);
  };

  const BackLink = () => (
    <button onClick={() => navigate(`${prefix}/ranking`)} className="inline-flex items-center gap-1 text-[14px] transition-colors" style={{ color: INK2 }}>
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
      투자 현황
    </button>
  );

  if (loading) {
    if (!isVirt) return <SplashLoading message="포트폴리오 정보를 불러오는 중..." />;
    return <VirtSplashLoading message="포트폴리오 정보를 불러오는 중..." />;
  }

  if (error || !portfolio) {
    return (
      <HelmShell active="status" virt={isVirt} userName={userName}>
        <div className="mx-auto max-w-[760px]">
          <BackLink />
          <div className="mt-6 text-center" style={{ ...panel, padding: '48px 24px' }}>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'rgba(239,77,77,.12)', border: '1px solid rgba(239,77,77,.28)' }}>
              <svg className="w-7 h-7" style={{ color: UP }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h2 className="text-[19.5px] font-bold">데이터를 불러오지 못했어요</h2>
            <p className="mt-2 text-[14px]" style={{ color: INK2 }}>{error || '포트폴리오를 찾을 수 없습니다.'}</p>
            <button onClick={loadDetail} className="mt-5 rounded-lg px-5 py-2.5 text-[14px] font-semibold" style={{ background: 'rgba(91,157,255,.12)', border: '1px solid rgba(91,157,255,.32)', color: SONAR }}>다시 시도</button>
          </div>
        </div>
      </HelmShell>
    );
  }

  const rankBadge = portfolio.currentRank <= 3
    ? ['', '/whales/blue-whale.png', '/whales/narwhal.png', '/whales/dolphin.png'][portfolio.currentRank]
    : null;
  const totalHoldings = portfolio.stockCount + portfolio.cryptoCount;
  const up = portfolio.totalReturn >= 0;

  const StatTile = ({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) => (
    <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,.03)', border: `1px solid ${HAIR}` }}>
      <div className="text-[12px]" style={{ color: INK3 }}>{label}</div>
      <div className="mt-1 font-mono text-[21.5px] font-bold md:text-[24px]" style={{ color: color || '#fff' }}>{value}</div>
      {sub && <div className="mt-1 font-mono text-[12px]" style={{ color: INK3 }}>{sub}</div>}
    </div>
  );

  return (
    <HelmShell active="status" virt={isVirt} userName={userName}>
      <div className="mx-auto flex max-w-[820px] flex-col gap-[18px]">
        <BackLink />

        {/* 헤더 카드 */}
        <div style={{ ...panel, padding: '24px', background: 'linear-gradient(135deg, rgba(91,157,255,.14), rgba(14,40,56,.4))', border: '1px solid rgba(91,157,255,.28)' }}>
          <div className="mb-6 flex items-center gap-3">
            {rankBadge ? (
              <img src={rankBadge} alt="" className="h-11 w-11 object-contain" />
            ) : (
              <span className="flex h-11 w-11 items-center justify-center rounded-full text-[19.5px] font-bold" style={{ background: 'rgba(255,255,255,.10)', color: '#fff' }}>{portfolio.currentRank}</span>
            )}
            <div>
              <h1 className="text-[26px] font-bold md:text-[30px]">{portfolio.portfolioName}</h1>
              <p className="mt-0.5 text-[14px]" style={{ color: INK1 }}>{portfolio.nickname} · {portfolio.currentRank}위</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="총 수익률" value={`${signPrefix(portfolio.totalReturn)}${portfolio.totalReturn.toFixed(2)}%`} sub={`${signPrefix(portfolio.totalReturnAmount)}${fmt(Math.round(portfolio.totalReturnAmount))}`} color={up ? UP : DOWN} />
            <StatTile label="총 자산" value={fmtCompact(portfolio.totalValue)} />
            <StatTile label="초기 자본" value={fmtCompact(portfolio.initialCapital)} />
            <StatTile label="보유 종목" value={`${totalHoldings}종목`} />
          </div>
        </div>

        {/* 투자 요약 */}
        <div style={{ ...panel, padding: '22px' }}>
          <h2 className="mb-4 text-[16.5px] font-bold">투자 요약</h2>
          <div className="space-y-3">
            {portfolio.stockCount > 0 && (
              <div className="flex items-center justify-between text-[14.5px]">
                <span className="flex items-center gap-2" style={{ color: INK1 }}>
                  <img src="/whales/spotted-dolphin.png" alt="" className="h-5 w-5 object-contain" />주식
                </span>
                <span className="font-semibold" style={{ color: SONAR }}>{portfolio.stockCount}종목</span>
              </div>
            )}
            {portfolio.cryptoCount > 0 && (
              <div className="flex items-center justify-between text-[14.5px]">
                <span className="flex items-center gap-2" style={{ color: INK1 }}>
                  <img src="/whales/wild-cat-whale.png" alt="" className="h-5 w-5 object-contain" />가상화폐
                </span>
                <span className="font-semibold" style={{ color: '#5fd0a8' }}>{portfolio.cryptoCount}종목</span>
              </div>
            )}
            {totalHoldings === 0 && <p className="py-4 text-center text-[14px]" style={{ color: INK3 }}>아직 보유 종목이 없습니다</p>}
          </div>
        </div>

        {/* 대표 항로 */}
        {portfolio.routeName && (
          <div style={{ ...panel, padding: '22px' }}>
            <div className="mb-4 flex items-center gap-2">
              <svg className="h-5 w-5" style={{ color: '#f5d061' }} fill="currentColor" viewBox="0 0 24 24"><path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
              <h2 className="text-[16.5px] font-bold">대표 항로</h2>
            </div>
            <div className="rounded-xl p-5" style={{ background: 'rgba(91,157,255,.06)', border: `1px solid ${HAIR}` }}>
              <div className="mb-3 flex items-center gap-2">
                <span className="text-[18.5px] font-bold">{portfolio.routeName}</span>
                {portfolio.routeStrategyType === 'TURTLE' && (
                  <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: 'rgba(245,208,97,.16)', color: '#f5d061', border: '1px solid rgba(245,208,97,.3)' }}>WhaleArc 독점</span>
                )}
              </div>
              {portfolio.routeReturnRate != null && (
                <div className="mb-4 flex items-baseline gap-2">
                  <span className="font-mono text-[32.5px] font-bold" style={{ color: retColor(portfolio.routeReturnRate) }}>{signPrefix(portfolio.routeReturnRate)}{portfolio.routeReturnRate.toFixed(2)}%</span>
                  <span className="text-[12px]" style={{ color: INK3 }}>항로 수익률</span>
                </div>
              )}
              <div className="space-y-2 border-t pt-3" style={{ borderColor: HAIR }}>
                <div className="flex justify-between text-[14px]">
                  <span style={{ color: INK2 }}>전략 유형</span>
                  <span className="font-medium" style={{ color: INK1 }}>{portfolio.routeStrategyType === 'TURTLE' ? '터틀 트레이딩' : '일반'}</span>
                </div>
                <div className="flex justify-between text-[14px]">
                  <span style={{ color: INK2 }}>포트폴리오 수익률</span>
                  <span className="font-medium" style={{ color: retColor(portfolio.totalReturn) }}>{signPrefix(portfolio.totalReturn)}{portfolio.totalReturn.toFixed(2)}%</span>
                </div>
              </div>
              {portfolio.routeDescription && (
                <div className="mt-4 border-t pt-3" style={{ borderColor: HAIR }}>
                  <p className="mb-1 text-[12px]" style={{ color: INK3 }}>전략 로직</p>
                  <p className="text-[14px] leading-relaxed" style={{ color: INK1 }}>{portfolio.routeDescription}</p>
                </div>
              )}
            </div>
          </div>
        )}

        <p className="text-center text-[12px]" style={{ color: INK3 }}>개인정보 보호를 위해 보유종목 상세 및 거래 내역은 비공개입니다</p>
      </div>
    </HelmShell>
  );
};

export default PortfolioDetailPage;
