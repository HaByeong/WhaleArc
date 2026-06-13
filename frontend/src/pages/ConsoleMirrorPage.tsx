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
/** 수익률(%) × 걸린 금액 → 실제 원화 임팩트(초보 친화: 숫자보다 '돈'이 와닿음). */
const wonOf = (pctVal: number, base: number) => {
  const v = (base * pctVal) / 100;
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  const abs = Math.abs(v);
  const s = abs >= 10000 ? `${(abs / 10000).toFixed(1)}만원` : `${Math.round(abs).toLocaleString('ko-KR')}원`;
  return `${sign}${s}`;
};
/** 부호 없는 금액 크기(원). '손해/아껴' 같은 단어가 방향을 담을 때. */
const wonMag = (krw: number) => {
  const abs = Math.abs(krw);
  return abs >= 10000 ? `${(abs / 10000).toFixed(1)}만원` : `${Math.round(abs).toLocaleString('ko-KR')}원`;
};

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
  const base = c.amountKrwAtEvent || 0;

  const Box = ({ label, val, chosen }: { label: string; val: number; chosen: boolean }) => (
    <div className="flex-1 rounded-xl px-3.5 py-3 text-center"
      style={{ background: chosen ? 'rgba(63,214,160,.08)' : CARD, border: `1px solid ${chosen ? 'rgba(63,214,160,.32)' : LINE}` }}>
      <div className="flex items-center justify-center gap-1.5 text-[11px]" style={{ color: INK3 }}>
        {chosen && <span style={{ color: GREEN }}>✓</span>}{label}
      </div>
      <div className="mt-1 font-mono text-[22px] font-bold tabular-nums" style={{ color: clr(val) }}>{pct(val)}</div>
      {base > 0 && <div className="mt-0.5 font-mono text-[11.5px]" style={{ color: clr(val) }}>약 {wonOf(val, base)}</div>}
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
        <p className="mt-1.5 text-center text-[12.5px]" style={{ color: cost >= 0 ? INK1 : GREEN }}>
          {cost >= 0
            ? <>충동을 따랐다면 <b style={{ color: UP }}>{base > 0 ? `약 ${wonMag(base * cost / 100)}` : `${cost.toFixed(1)}%p`}</b> 손해였어요</>
            : <>이번엔 충동이 <b style={{ color: GREEN }}>{base > 0 ? `약 ${wonMag(base * cost / 100)}` : `${Math.abs(cost).toFixed(1)}%p`}</b> 아껴줬어요</>}
          <span className="ml-1 text-[10.5px]" style={{ color: INK3 }}>(두 선택의 차이 {Math.abs(cost).toFixed(1)}%p)</span>
        </p>

        <p className="mt-2.5 text-[10.5px] leading-snug" style={{ color: INK3 }}>
          ℹ️ '충동=전량 현금화(가격 변동 0%)' 기준이에요 · 수수료·세금은 뺐어요(모의) · <b>한 번의 결과일 뿐</b>, 같은 선택을 여러 번 했을 때가 진짜 교훈이에요.
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

  // 감정 패턴 — 트리거별 '충동 실행률'(선택은 봉인 즉시 알 수 있어 미개봉도 포함)
  const patterns = useMemo(() => {
    const defs = [
      { key: 'PANIC_DROP', label: '공포의 파도', sub: '급락에 팔고 싶은 충동' },
      { key: 'FOMO_SPIKE', label: '탐욕의 파도', sub: '급등에 사고 싶은 충동' },
    ];
    return defs
      .map(d => {
        const items = list.filter(c => c.triggerType === d.key);
        const impulse = items.filter(c => c.userChoice === 'FOLLOW_IMPULSE').length;
        return { ...d, total: items.length, impulse, rate: items.length ? impulse / items.length : 0 };
      })
      .filter(p => p.total > 0);
  }, [list]);
  const weakest = useMemo(() => {
    const sorted = [...patterns].sort((a, b) => b.rate - a.rate);
    return sorted[0] && sorted[0].rate >= 0.5 ? sorted[0] : null;
  }, [patterns]);

  return (
    <HelmShell active="mirror" virt={isVirt} userName={userName} session="흔들린 순간">
      <div className="mx-auto flex max-w-[760px] flex-col gap-5 px-5 py-6">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight" style={{ color: INK0 }}>흔들린 순간 🐋</h1>
          <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: INK1 }}>
            <b style={{ color: INK0 }}>공포·탐욕의 파도</b>에 항로를 벗어날 뻔한 순간을 봉인했다가, 며칠 뒤 <b style={{ color: INK0 }}>휩쓸렸다면 vs 항로를 지켰다면</b>을 나란히 비춰요. 🐋 투기를 투자로, 감정을 데이터로.
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

        {/* 감정 패턴 — "당신은 ○○에 약하다" */}
        {list.length >= 2 && patterns.length > 0 && (
          <div style={{ ...panel, padding: '18px 20px' }} className="flex flex-col gap-3.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold tracking-[.16em]" style={{ color: SONAR }}>어떤 파도에 흔들리나</span>
            </div>
            {weakest && (
              <p className="text-[13.5px] leading-relaxed" style={{ color: INK0 }}>
                🐋 당신은 <b style={{ color: UP }}>{weakest.label}</b>에 더 약해요 —
                <b> {weakest.total}번 중 {weakest.impulse}번</b> 휩쓸렸어요.
              </p>
            )}
            <div className="flex flex-col gap-3">
              {patterns.map(p => {
                const weak = p.rate >= 0.5;
                return (
                  <div key={p.key}>
                    <div className="mb-1 flex items-center justify-between text-[12px]">
                      <span style={{ color: INK1 }}>
                        <b style={{ color: INK0 }}>{p.label}</b>
                        <span style={{ color: INK3 }}> · {p.total}번 중 {p.impulse}번 휩쓸림</span>
                      </span>
                      <span className="font-mono font-semibold" style={{ color: weak ? UP : GREEN }}>
                        {Math.round(p.rate * 100)}% {weak ? '약함' : '잘 버팀'}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--ci-chip)' }}>
                      <div className="h-full rounded-full" style={{ width: `${Math.max(4, p.rate * 100)}%`, background: weak ? UP : GREEN }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[10.5px]" style={{ color: INK3 }}>파도에 휩쓸린 비율이 높을수록 그 감정에 약한 거예요. 약점을 알면 다음엔 항로를 지킬 수 있어요.</p>
          </div>
        )}

        {loading ? (
          <div style={{ ...panel, padding: 48 }} className="text-center text-[13px]" >
            <span style={{ color: INK3 }}>불러오는 중…</span>
          </div>
        ) : list.length === 0 ? (
          <div style={{ ...panel, padding: '32px 28px' }} className="text-center">
            <div className="text-[34px]">🪞</div>
            <div className="mt-2 text-[15px] font-bold" style={{ color: INK0 }}>아직 봉인된 순간이 없어요</div>
            <div className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: INK2 }}>
              공포·탐욕의 파도에 <b style={{ color: INK1 }}>항로를 벗어날 뻔한 순간</b>을 잠가뒀다가, 며칠 뒤 결과를 비춰드려요.<br />
              충동대로 했을 때 vs 참았을 때를 <b style={{ color: INK1 }}>실제 숫자</b>로 보여줘요.
            </div>
            <div className="mx-auto mt-4 grid max-w-[460px] grid-cols-3 gap-2.5 text-left">
              {[
                { n: '1', t: '포착', d: '급락에 팔고 싶을 때 거울이 먼저 물어봐요' },
                { n: '2', t: '봉인', d: '판다 / 참는다, 그 선택을 잠가둬요' },
                { n: '3', t: '개봉', d: '며칠 뒤 "안 한 쪽 결과"를 나란히 비춰요' },
              ].map(s => (
                <div key={s.n} style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 12 }} className="px-3 py-3">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: 'var(--ci-sonar-dim)', color: SONAR }}>{s.n}</div>
                  <div className="mt-1.5 text-[12px] font-bold" style={{ color: INK0 }}>{s.t}</div>
                  <div className="mt-0.5 text-[11px] leading-snug" style={{ color: INK3 }}>{s.d}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 text-[11.5px]" style={{ color: INK3 }}>
              👉 <b style={{ color: INK2 }}>거래</b> 화면에서 급락 중인 보유 종목을 팔아보려 하면 거울이 나타나요.
            </div>
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
