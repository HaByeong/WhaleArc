import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRoutePrefix } from '../hooks/useRoutePrefix';
import HelmShell from '../components/HelmShell';
import { mirrorService, type MirrorCapture } from '../services/mirrorService';

/* 감정 거울(Emotion Mirror) — 흔들린 순간의 봉인을 모아 보여주고, 개봉되면 "충동 vs 항로"를 대조한다.
   판단은 사용자가, 시스템은 사실만 비춘다. 충동이 옳았던 날도 정직하게. */

const UP = '#ef4d4d', DOWN = '#4d8aff', GREEN = '#3fd6a0';
const INK0 = 'var(--ci-ink0)', INK1 = 'var(--ci-ink1)', INK2 = 'var(--ci-ink2)', INK3 = 'var(--ci-ink3)';
const LINE = 'var(--ci-line)', CARD = 'var(--ci-card)', SONAR = 'var(--ci-sonar)';
const panel: React.CSSProperties = { background: 'var(--ci-panel)', border: `1px solid ${LINE}`, borderRadius: 16, boxShadow: 'var(--ci-panel-shadow)' };
const pct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
const clr = (v: number) => (v > 0 ? UP : v < 0 ? DOWN : INK2);

/** 이벤트→개봉 경로 스파크라인. 고정 horizon 체리피킹 방지용. */
const PathSpark = ({ data, w = 220, h = 44 }: { data: number[]; w?: number; h?: number }) => {
  if (!data || data.length < 2) return null;
  const min = Math.min(0, ...data), max = Math.max(0, ...data), span = max - min || 1;
  const x = (i: number) => (i / (data.length - 1)) * w;
  const y = (v: number) => h - ((v - min) / span) * h;
  const pts = data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const last = data[data.length - 1];
  const zeroY = y(0);
  return (
    <svg width={w} height={h} className="overflow-visible">
      <line x1={0} y1={zeroY} x2={w} y2={zeroY} stroke="var(--ci-line-strong)" strokeWidth={1} strokeDasharray="3 3" />
      <polyline points={pts} fill="none" stroke={clr(last)} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

function toneMessage(c: MirrorCapture): string {
  const ruleKept = c.userChoice === 'FOLLOW_RULE';
  const impulseRight = !!c.impulseWasRight;
  if (ruleKept && !impulseRight) return '참길 잘했어요. 항로가 옳았습니다. 🐋';
  if (ruleKept && impulseRight) return '이번엔 충동이 맞았네요. 그래도 같은 선택 10번 중 몇 번이 맞을지 생각해봐요.';
  if (!ruleKept && impulseRight) return '운이 좋았어요. 같은 선택 10번이면 몇 번 맞을까요?';
  return '그때 흔들렸죠. 다음엔 한 박자 쉬어볼까요?';
}

const RevealCard = ({ c }: { c: MirrorCapture }) => {
  const isSell = c.impulseSide !== 'BUY';
  const impulseLabel = isSell ? '충동대로 팔았다면' : '충동대로 샀다면';
  const ruleLabel = isSell ? '항로대로 버텼다' : '항로대로 관망했다';
  const impulse = c.impulseOutcomePct ?? 0, rule = c.ruleOutcomePct ?? 0;
  const cost = c.emotionCostPct ?? (rule - impulse);
  const ruleChosen = c.userChoice === 'FOLLOW_RULE';

  const Box = ({ label, val, chosen }: { label: string; val: number; chosen: boolean }) => (
    <div className="flex-1 rounded-xl px-3.5 py-3 text-center"
      style={{ background: chosen ? 'rgba(63,214,160,.08)' : CARD, border: `1px solid ${chosen ? 'rgba(63,214,160,.32)' : LINE}` }}>
      <div className="flex items-center justify-center gap-1.5 text-[11px]" style={{ color: INK3 }}>
        {chosen && <span style={{ color: GREEN }}>✓</span>}{label}
      </div>
      <div className="mt-1 font-mono text-[22px] font-bold tabular-nums" style={{ color: clr(val) }}>{pct(val)}</div>
    </div>
  );

  return (
    <div style={{ ...panel, overflow: 'hidden' }}>
      <div className="flex items-center gap-2 px-5 pt-4">
        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold"
          style={{ background: 'rgba(91,157,255,.12)', color: SONAR, border: '1px solid rgba(91,157,255,.28)' }}>🔓 봉인이 열렸습니다</span>
        <span className="text-[11.5px]" style={{ color: INK3 }}>
          {new Date(c.capturedAt).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })} · 급락 공포
        </span>
      </div>

      <div className="px-5 pb-4 pt-2.5">
        {c.emotionNote && <p className="text-[13px]" style={{ color: INK1 }}>"{c.emotionNote}" <span style={{ color: INK3 }}>(강도 {c.emotionIntensity}/5)</span></p>}
        <p className="mt-1 text-[12px]" style={{ color: INK2 }}>당신의 선택: <b style={{ color: ruleChosen ? GREEN : UP }}>{ruleChosen ? '🧭 항로를 지켰다' : '😰 충동을 따랐다'}</b></p>

        <div className="mt-3 flex gap-2.5">
          <Box label={impulseLabel} val={impulse} chosen={!ruleChosen} />
          <Box label={ruleLabel} val={rule} chosen={ruleChosen} />
        </div>

        {c.pathPct && c.pathPct.length >= 2 && (
          <div className="mt-3 rounded-xl px-3.5 py-2.5" style={{ background: CARD, border: `1px solid ${LINE}` }}>
            <div className="mb-1 text-[10px]" style={{ color: INK3 }}>봉인 이후 가격 경로 (체리피킹 아님)</div>
            <PathSpark data={c.pathPct} />
          </div>
        )}

        <p className="mt-3 text-center text-[13px] font-semibold" style={{ color: INK0 }}>{toneMessage(c)}</p>
        <p className="mt-1.5 text-center text-[12px]" style={{ color: cost >= 0 ? INK2 : GREEN }}>
          {cost >= 0
            ? <>감정이 당신에게 청구한 비용: <b style={{ color: UP }}>{cost.toFixed(1)}%p</b></>
            : <>이번엔 충동이 아껴준 비용: <b style={{ color: GREEN }}>{Math.abs(cost).toFixed(1)}%p</b></>}
        </p>

        <p className="mt-2.5 text-[10.5px] leading-snug" style={{ color: INK3 }}>
          충동=전량 현금화(0%) 기준 · 수수료·세금 제외(모의) · 한 번의 결과일 뿐, 같은 선택의 기대값이 진짜 교훈이에요.
        </p>
      </div>
    </div>
  );
};

const SealedCard = ({ c }: { c: MirrorCapture }) => {
  const days = Math.max(0, Math.ceil((new Date(c.revealAt).getTime() - Date.now()) / 86_400_000));
  return (
    <div style={{ ...panel, padding: '16px 18px' }} className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold"
            style={{ background: 'var(--ci-chip)', color: INK2, border: `1px solid ${LINE}` }}>🔒 봉인됨</span>
          <span className="truncate text-[13px] font-bold" style={{ color: INK0 }}>{c.assetName || c.assetSymbol}</span>
          <span className="font-mono text-[11.5px]" style={{ color: DOWN }}>{c.changeRateAtEvent.toFixed(1)}%</span>
        </div>
        {c.emotionNote && <p className="mt-1 truncate text-[12px]" style={{ color: INK2 }}>"{c.emotionNote}" <span style={{ color: INK3 }}>·강도 {c.emotionIntensity}/5</span></p>}
        <p className="mt-0.5 text-[11.5px]" style={{ color: INK3 }}>선택: {c.userChoice === 'FOLLOW_RULE' ? '항로를 지켰다' : '충동을 따랐다'}</p>
      </div>
      <div className="shrink-0 text-right">
        <div className="font-mono text-[18px] font-bold" style={{ color: SONAR }}>{days === 0 ? '곧' : `D-${days}`}</div>
        <div className="text-[10.5px]" style={{ color: INK3 }}>개봉까지</div>
      </div>
    </div>
  );
};

const ConsoleMirrorPage = () => {
  const { session } = useAuth();
  const { isVirt } = useRoutePrefix();
  const userName = session?.user?.email ? session.user.email.split('@')[0] : '항해사';
  const [list, setList] = useState<MirrorCapture[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { mirrorService.list().then(setList).catch(() => setList([])).finally(() => setLoading(false)); }, []);

  const revealed = useMemo(() => list.filter(c => c.revealed), [list]);
  const sealed = useMemo(() => list.filter(c => !c.revealed), [list]);
  const stats = useMemo(() => {
    const ruleWins = revealed.filter(c => !c.impulseWasRight).length;
    const totalCost = revealed.reduce((s, c) => s + (c.emotionCostPct ?? 0), 0);
    return { shaken: list.length, ruleWins, impulseWins: revealed.length - ruleWins, totalCost };
  }, [list, revealed]);

  return (
    <HelmShell active="mirror" virt={isVirt} userName={userName} session="감정 거울">
      <div className="mx-auto flex max-w-[760px] flex-col gap-5 px-5 py-6">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight" style={{ color: INK0 }}>감정 거울 🐋</h1>
          <p className="mt-1.5 text-[13.5px]" style={{ color: INK1 }}>
            투기를 투자로, 감정을 데이터로. 흔들린 순간을 봉인하고, 며칠 뒤 <b style={{ color: INK0 }}>충동대로 vs 항로대로</b>의 결과를 나란히 비춥니다.
          </p>
        </div>

        {/* 누적 거울 */}
        {revealed.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { v: `${stats.shaken}`, l: '흔들린 횟수' },
              { v: `${stats.ruleWins} : ${stats.impulseWins}`, l: '항로 옳음 : 충동 옳음' },
              { v: `${stats.totalCost >= 0 ? '−' : '+'}${Math.abs(stats.totalCost).toFixed(0)}%p`, l: '감정이 청구한 비용', c: stats.totalCost >= 0 ? UP : GREEN },
            ].map((s, i) => (
              <div key={i} style={{ ...panel, padding: '16px 14px' }} className="text-center">
                <div className="font-mono text-[22px] font-bold tabular-nums" style={{ color: s.c || INK0 }}>{s.v}</div>
                <div className="mt-1 text-[11px]" style={{ color: INK3 }}>{s.l}</div>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div style={{ ...panel, padding: 48 }} className="text-center text-[13px]" >
            <span style={{ color: INK3 }}>거울을 불러오는 중…</span>
          </div>
        ) : list.length === 0 ? (
          <div style={{ ...panel, padding: 48 }} className="text-center">
            <div className="text-[30px]">🪞</div>
            <div className="mt-2 text-[14px] font-semibold" style={{ color: INK0 }}>아직 봉인된 순간이 없어요.</div>
            <div className="mt-1 text-[12.5px]" style={{ color: INK3 }}>급락에 팔고 싶어 흔들릴 때, 거울이 먼저 물어볼게요.</div>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {revealed.length > 0 && (
              <div className="flex flex-col gap-3.5">
                <div className="text-[11px] font-semibold tracking-[.16em]" style={{ color: SONAR }}>🔓 개봉됨</div>
                {revealed.map(c => <RevealCard key={c.id} c={c} />)}
              </div>
            )}
            {sealed.length > 0 && (
              <div className="flex flex-col gap-3">
                <div className="text-[11px] font-semibold tracking-[.16em]" style={{ color: INK3 }}>🔒 봉인 대기</div>
                {sealed.map(c => <SealedCard key={c.id} c={c} />)}
              </div>
            )}
          </div>
        )}
      </div>
    </HelmShell>
  );
};

export default ConsoleMirrorPage;
