import { useEffect, useState } from 'react';
import { strategyService, type Strategy, type Indicator, type Condition } from '../../services/strategyService';
import { marketService } from '../../services/marketService';
import { getErrorMessage } from '../../utils/api';
import { useModalChrome } from '../../hooks/useModalChrome';
import { UP, DOWN, SONAR as GLOW, INK1, INK2, INK3, LINE, LINE_STRONG as LINE_S } from '../console/format';
import { ACCENT, BT_GRAD, fieldStyle, PARAM_LABEL } from './shared';
import { Label } from './ui';

/* ────────────── 전략 빌더 (새 항로 만들기 / 항로 수정) ────────────── */

const INDICATOR_CATALOG: { type: Indicator['type']; label: string; params: Record<string, number> }[] = [
  { type: 'RSI', label: 'RSI', params: { period: 14 } },
  { type: 'MACD', label: 'MACD', params: { fast: 12, slow: 26, signal: 9 } },
  { type: 'MA', label: '이동평균 (MA)', params: { period: 20 } },
  { type: 'EMA', label: '지수이동평균 (EMA)', params: { period: 20 } },
  { type: 'BOLLINGER_BANDS', label: '볼린저밴드', params: { period: 20, stdDev: 2 } },
  { type: 'STOCHASTIC', label: '스토캐스틱', params: { kPeriod: 14, dPeriod: 3 } },
  { type: 'ATR', label: 'ATR', params: { period: 14 } },
  { type: 'CCI', label: 'CCI', params: { period: 20 } },
  { type: 'WILLIAMS_R', label: 'Williams %R', params: { period: 14 } },
  { type: 'OBV', label: 'OBV', params: {} },
  { type: 'DONCHIAN', label: '돈치안 채널', params: { period: 20 } },
  { type: 'ADX', label: 'ADX (추세강도)', params: { period: 14 } },
];
const COND_INDICATORS: [string, string][] = [
  ['PRICE', '현재가'], ['RSI', 'RSI'], ['MACD', 'MACD'], ['MACD_SIGNAL', 'MACD 시그널'], ['MACD_HISTOGRAM', 'MACD 히스토그램'],
  ['MA', '이동평균 (MA)'], ['EMA', '지수이동평균 (EMA)'], ['BOLLINGER_UPPER', '볼린저 상단'], ['BOLLINGER_MIDDLE', '볼린저 중간'],
  ['BOLLINGER_LOWER', '볼린저 하단'], ['BOLLINGER_PCT_B', '볼린저 %B'], ['STOCH_K', '스토캐스틱 %K'], ['STOCH_D', '스토캐스틱 %D'],
  ['ATR', 'ATR'], ['CCI', 'CCI'], ['WILLIAMS_R', 'Williams %R'], ['OBV', 'OBV'],
  ['ADX', 'ADX (추세강도)'], ['DONCHIAN_HIGH_100', '돈치안 상단(100)'], ['DONCHIAN_LOW_30', '돈치안 하단(30)'],
  ['MACD_CROSS_MACD_SIGNAL', 'MACD 골든크로스'], ['MACD_CROSSUNDER_MACD_SIGNAL', 'MACD 데드크로스'],
  ['STOCH_K_CROSS_STOCH_D', '스토캐스틱 골든크로스'], ['STOCH_K_CROSSUNDER_STOCH_D', '스토캐스틱 데드크로스'],
  ['EMA_CROSS_MA', 'EMA ↑ SMA 크로스'], ['EMA_CROSSUNDER_MA', 'EMA ↓ SMA 크로스'],
];
const OPERATORS: [Condition['operator'], string][] = [['GT', '>'], ['GTE', '≥'], ['LT', '<'], ['LTE', '≤'], ['EQ', '=']];
const ASSET_TYPES: [Strategy['assetType'], string][] = [['CRYPTO', '가상화폐'], ['STOCK', '주식'], ['US_STOCK', '미국주식'], ['MIXED', '혼합']];
const isCrossInd = (ind: string) => ind.includes('_CROSS_') || ind.includes('_CROSSUNDER_');

const SectionNum = ({ n, title, sub, active }: { n: number; title: string; sub?: string; active?: boolean }) => (
  <div className="flex items-center gap-2.5">
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono text-[13px] font-bold" style={{ background: active ? 'rgba(91,157,255,.18)' : 'var(--ci-card)', color: active ? GLOW : INK2, border: `1px solid ${active ? 'rgba(91,157,255,.32)' : LINE}` }}>{n}</span>
    <div className="min-w-0"><div className="text-[14.5px] font-bold">{title}</div>{sub && <div className="text-[12px]" style={{ color: INK3 }}>{sub}</div>}</div>
  </div>
);

const ConditionEditor = ({ title, accent, conds, setConds, addDefault }: { title: string; accent: string; conds: Condition[]; setConds: (c: Condition[]) => void; addDefault: Condition }) => (
  <div>
    <div className="flex items-center justify-between">
      <span className="text-[13.5px] font-bold" style={{ color: accent }}>{title}</span>
      <button onClick={() => setConds([...conds, { ...addDefault }])} className="rounded-md px-2 py-1 text-[12.5px] font-semibold" style={{ border: `1px solid ${LINE}`, color: accent }}>+ 조건 추가</button>
    </div>
    <div className="mt-2 flex flex-col gap-1.5">
      {conds.length === 0 && <div className="text-[12.5px]" style={{ color: INK3 }}>조건이 없습니다. + 조건 추가를 눌러주세요.</div>}
      {conds.map((c, idx) => {
        const cross = isCrossInd(c.indicator);
        const upd = (patch: Partial<Condition>) => { const u = [...conds]; u[idx] = { ...c, ...patch }; setConds(u); };
        return (
          <div key={idx} className="flex items-center gap-1.5">
            {idx > 0 ? (
              <select value={c.logic} onChange={e => upd({ logic: e.target.value as Condition['logic'] })} className="shrink-0 rounded px-1 py-1.5 text-[12px] outline-none" style={fieldStyle}><option value="AND">AND</option><option value="OR">OR</option></select>
            ) : <span className="w-[44px] shrink-0" />}
            <select value={c.indicator} onChange={e => upd({ indicator: e.target.value })} className={`${cross ? 'flex-[2]' : 'flex-1'} min-w-0 rounded px-1.5 py-1.5 text-[13px] outline-none`} style={fieldStyle}>
              {COND_INDICATORS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {!cross && <>
              <select value={c.operator} onChange={e => upd({ operator: e.target.value as Condition['operator'] })} className="w-12 shrink-0 rounded px-1 py-1.5 text-[13px] outline-none" style={fieldStyle}>
                {OPERATORS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <input type="number" value={c.value} onChange={e => upd({ value: parseFloat(e.target.value) || 0 })} className="w-16 shrink-0 rounded px-1.5 py-1.5 text-right text-[13px] outline-none" style={fieldStyle} />
            </>}
            <button onClick={() => setConds(conds.filter((_, i) => i !== idx))} title="삭제" className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[16px] hover:bg-white/10" style={{ color: INK3 }}>×</button>
          </div>
        );
      })}
    </div>
  </div>
);

const BuilderModal = ({ mode, initial, onClose, onSaved }: { mode: 'create' | 'edit'; initial?: Strategy; onClose: () => void; onSaved: (msg: string) => void }) => {
  const [name, setName] = useState(initial?.name || '');
  const [desc, setDesc] = useState(initial?.description || '');
  const [logic, setLogic] = useState(initial?.strategyLogic || '');
  const [assetType, setAssetType] = useState<Strategy['assetType']>(initial?.assetType || 'CRYPTO');
  const [assets, setAssets] = useState<string[]>(initial?.targetAssets || []);
  const [nameCache, setNameCache] = useState<Record<string, string>>(initial?.targetAssetNames || {});
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ code: string; name: string }[]>([]);
  const [cryptoList, setCryptoList] = useState<{ code: string; name: string }[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>(initial?.indicators || []);
  const [entry, setEntry] = useState<Condition[]>(initial?.entryConditions || []);
  const [exitC, setExitC] = useState<Condition[]>(initial?.exitConditions || []);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useModalChrome(onClose);

  useEffect(() => { marketService.getPrices('CRYPTO').then(ps => setCryptoList(ps.map(p => ({ code: p.symbol, name: p.name })))).catch(() => {}); }, []);

  useEffect(() => {
    const q = query.trim();
    const cryptoMatch = () => cryptoList.filter(c => c.code.toLowerCase().includes(q.toLowerCase()) || c.name.includes(q));
    if (assetType === 'CRYPTO') { setResults(cryptoMatch().slice(0, 50)); return; }
    if (q.length < 1) { setResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const out: { code: string; name: string }[] = [];
        if (assetType === 'STOCK' || assetType === 'MIXED') (await marketService.searchStocks(q)).forEach(r => out.push({ code: r.code, name: r.name }));
        if (assetType === 'US_STOCK' || assetType === 'MIXED') (await marketService.searchUsStocks(q)).forEach(r => out.push({ code: r.code, name: r.name }));
        if (assetType === 'MIXED') cryptoMatch().forEach(c => out.push(c));
        setResults(out.slice(0, 50));
      } catch { setResults([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [query, assetType, cryptoList]);

  const assetName = (code: string) => nameCache[code] || cryptoList.find(c => c.code === code)?.name || code;
  const addAsset = (code: string, nm: string) => { if (!assets.includes(code)) { setAssets([...assets, code]); setNameCache(c => ({ ...c, [code]: nm })); } setQuery(''); setResults([]); };
  const removeAsset = (code: string) => setAssets(assets.filter(a => a !== code));

  const addIndicator = (type: string) => {
    if (!type || indicators.some(i => i.type === type)) return;
    const def = INDICATOR_CATALOG.find(i => i.type === type);
    setIndicators([...indicators, { type: type as Indicator['type'], parameters: { ...(def?.params || {}) } }]);
  };
  const updIndParam = (idx: number, key: string, val: number) => { const u = [...indicators]; u[idx] = { ...u[idx], parameters: { ...u[idx].parameters, [key]: val } }; setIndicators(u); };
  const removeIndicator = (idx: number) => setIndicators(indicators.filter((_, i) => i !== idx));

  const applyPreset = (kind: 'rsi' | 'macd') => {
    if (kind === 'rsi') { setIndicators([{ type: 'RSI', parameters: { period: 14 } }]); setEntry([{ indicator: 'RSI', operator: 'LT', value: 30, logic: 'AND' }]); setExitC([{ indicator: 'RSI', operator: 'GT', value: 70, logic: 'AND' }]); }
    else { setIndicators([{ type: 'MACD', parameters: { fast: 12, slow: 26, signal: 9 } }]); setEntry([{ indicator: 'MACD_HISTOGRAM', operator: 'GT', value: 0, logic: 'AND' }]); setExitC([{ indicator: 'MACD_HISTOGRAM', operator: 'LT', value: 0, logic: 'AND' }]); }
  };

  const canSave = name.trim().length > 0 && assets.length > 0;
  const empty = indicators.length === 0 && entry.length === 0 && exitC.length === 0;
  const seg = (on: boolean): React.CSSProperties => ({ border: on ? '1px solid rgba(91,157,255,.32)' : `1px solid ${LINE}`, background: on ? 'rgba(91,157,255,.14)' : 'var(--ci-card)', color: on ? GLOW : INK1 });

  const save = async () => {
    if (!name.trim()) { setErr('항로 이름을 입력해주세요.'); return; }
    if (assets.length === 0) { setErr('투자 대상 자산을 1개 이상 선택해주세요.'); return; }
    const targetAssetNames: Record<string, string> = {};
    assets.forEach(code => { const nm = assetName(code); if (nm !== code) targetAssetNames[code] = nm; });
    const payload = { name: name.trim(), description: desc, indicators, entryConditions: entry, exitConditions: exitC, targetAssets: assets, targetAssetNames, assetType, strategyLogic: logic };
    setSaving(true); setErr(null);
    try {
      if (mode === 'edit' && initial) await strategyService.updateStrategy(initial.id, payload);
      else await strategyService.createStrategy(payload);
      onSaved(mode === 'edit' ? '항로가 수정되었습니다.' : '항로가 생성되었습니다.');
    } catch (e) {
      setErr(getErrorMessage(e, '저장에 실패했습니다.'));
    } finally { setSaving(false); }
  };

  return (
    <div onClick={onClose} className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto px-6 py-10" style={{ background: 'rgba(6,11,31,.72)', backdropFilter: 'blur(6px)', animation: 'backdrop-in .2s ease' }}>
      <div onClick={e => e.stopPropagation()} className="relative w-full max-w-[760px] rounded-[18px]" style={{ background: 'var(--ci-overlay)', border: `1px solid ${LINE_S}`, boxShadow: 'var(--ci-panel-shadow)', animation: 'modal-in .25s cubic-bezier(.2,.8,.2,1)' }}>
        <div className="wa-force-dark flex items-center justify-between rounded-t-[18px] px-6 py-4 text-white" style={{ background: BT_GRAD, borderBottom: '1px solid rgba(255,255,255,.14)' }}>
          <div><h3 className="text-[17.5px] font-bold">{mode === 'edit' ? '항로 수정' : '새 항로 만들기'}</h3><p className="text-[13px] text-white/70">나만의 매매 조건으로 항로를 설계하세요.</p></div>
          <button onClick={onClose} title="닫기" className="flex h-8 w-8 items-center justify-center rounded-lg text-[16px]" style={{ border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.08)' }}>✕</button>
        </div>
        <div className="flex flex-col gap-5 p-6">
          <section className="flex flex-col gap-2.5">
            <SectionNum n={1} title="기본 정보" active />
            <input value={name} onChange={e => setName(e.target.value)} placeholder="항로 이름 (예: BTC+ETH 균등 투자)" className="w-full rounded-lg px-3 py-2.5 text-[15px] outline-none" style={fieldStyle} />
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} placeholder="설명 (선택)" className="w-full resize-none rounded-lg px-3 py-2.5 text-[14px] outline-none" style={fieldStyle} />
            <textarea value={logic} onChange={e => setLogic(e.target.value)} rows={2} placeholder="항로 로직 (예: 균등 분배 매수 후 장기 보유, RSI 30 이하 추가매수)" className="w-full resize-none rounded-lg px-3 py-2.5 text-[14px] outline-none" style={fieldStyle} />
          </section>
          <section className="flex flex-col gap-2.5">
            <SectionNum n={2} title="자산 유형" active />
            <div className="grid grid-cols-4 gap-2">
              {ASSET_TYPES.map(([v, l]) => <button key={v} onClick={() => { setAssetType(v); setAssets([]); setResults([]); setQuery(''); }} className="rounded-lg py-2.5 text-[14px] font-semibold" style={seg(assetType === v)}>{l}</button>)}
            </div>
          </section>
          <section className="flex flex-col gap-2.5">
            <SectionNum n={3} title="투자 대상 자산" sub={`${assets.length}개 선택됨`} active={assets.length > 0} />
            {assets.length > 0 && <div className="flex flex-wrap gap-1.5">
              {assets.map(code => <span key={code} className="flex items-center gap-1 rounded-md px-2 py-1 text-[13px] font-semibold" style={{ background: 'rgba(91,157,255,.12)', color: GLOW }}>{assetName(code)}<button onClick={() => removeAsset(code)} aria-label={`${assetName(code)} 제거`} className="ml-0.5 text-[14px]"><span aria-hidden>×</span></button></span>)}
            </div>}
            <input value={query} onChange={e => setQuery(e.target.value)} aria-label="종목 검색" placeholder={assetType === 'CRYPTO' ? '코인 검색 (예: BTC, 이더리움)' : '종목 검색 (예: 삼성, AAPL)'} className="w-full rounded-lg px-3 py-2.5 text-[14px] outline-none" style={fieldStyle} />
            {results.length > 0 && <div className="no-scrollbar flex max-h-[170px] flex-col gap-0.5 overflow-y-auto rounded-lg p-1" style={{ border: `1px solid ${LINE}`, background: 'var(--ci-card)' }}>
              {results.filter(r => !assets.includes(r.code)).map(r => <button key={r.code} onClick={() => addAsset(r.code, r.name)} className="flex items-center justify-between rounded px-2.5 py-1.5 text-left text-[13.5px] hover:bg-white/5"><span className="font-semibold">{r.name}</span><span style={{ color: INK3 }}>{r.code}</span></button>)}
            </div>}
          </section>
          <section className="flex flex-col gap-3">
            <SectionNum n={4} title="매매 조건" sub="백테스팅에 사용" active={!empty} />
            <div>
              <div className="flex items-center justify-between">
                <Label>사용 지표</Label>
                <select value="" onChange={e => addIndicator(e.target.value)} className="rounded-md px-2 py-1 text-[13px] outline-none" style={fieldStyle}>
                  <option value="">+ 지표 추가</option>
                  {INDICATOR_CATALOG.filter(i => !indicators.some(x => x.type === i.type)).map(i => <option key={i.type} value={i.type}>{i.label}</option>)}
                </select>
              </div>
              <div className="mt-2 flex flex-col gap-1.5">
                {indicators.length === 0 && <div className="text-[12.5px]" style={{ color: INK3 }}>지표를 추가하면 매매 조건에서 활용할 수 있어요.</div>}
                {indicators.map((ind, idx) => {
                  const meta = INDICATOR_CATALOG.find(i => i.type === ind.type);
                  return (
                    <div key={idx} className="flex flex-wrap items-center gap-2 rounded-lg px-2.5 py-2" style={{ background: 'var(--ci-card)', border: `1px solid ${LINE}` }}>
                      <span className="text-[13.5px] font-bold" style={{ color: GLOW }}>{meta?.label || ind.type}</span>
                      {Object.entries(ind.parameters).map(([k, v]) => <span key={k} className="flex items-center gap-1 text-[12px]" style={{ color: INK2 }}>{PARAM_LABEL[k] || k}<input type="number" value={v} onChange={e => updIndParam(idx, k, Number(e.target.value))} className="w-14 rounded px-1.5 py-1 text-right text-[13px] outline-none" style={fieldStyle} /></span>)}
                      <button onClick={() => removeIndicator(idx)} title="제거" className="ml-auto text-[16px] hover:opacity-80" style={{ color: INK3 }}>×</button>
                    </div>
                  );
                })}
              </div>
            </div>
            <ConditionEditor title="매수 조건 (진입)" accent={UP} conds={entry} setConds={setEntry} addDefault={{ indicator: 'RSI', operator: 'LT', value: 30, logic: 'AND' }} />
            <ConditionEditor title="매도 조건 (청산)" accent={DOWN} conds={exitC} setConds={setExitC} addDefault={{ indicator: 'RSI', operator: 'GT', value: 70, logic: 'AND' }} />
            {empty && <div className="flex flex-col gap-1.5">
              <Label>빠른 설정 (프리셋)</Label>
              <div className="flex gap-2">
                <button onClick={() => applyPreset('rsi')} className="flex-1 rounded-lg py-2 text-[13px] font-semibold" style={{ border: `1px solid ${LINE}`, background: 'var(--ci-card)', color: INK1 }}>RSI 과매수/과매도</button>
                <button onClick={() => applyPreset('macd')} className="flex-1 rounded-lg py-2 text-[13px] font-semibold" style={{ border: `1px solid ${LINE}`, background: 'var(--ci-card)', color: INK1 }}>MACD 골든/데드크로스</button>
              </div>
            </div>}
          </section>
          {err && <div className="rounded-lg px-3 py-2 text-[13.5px]" style={{ background: 'rgba(239,77,77,.1)', border: '1px solid rgba(239,77,77,.25)', color: '#fca5a5' }}>{err}</div>}
        </div>
        <div className="flex items-center gap-3 px-6 py-4" style={{ borderTop: `1px solid ${LINE}` }}>
          <button onClick={onClose} className="rounded-lg px-4 py-2.5 text-[14px] font-semibold" style={{ border: `1px solid ${LINE}`, background: 'var(--ci-card)', color: INK1 }}>취소</button>
          <button onClick={save} disabled={!canSave || saving} className="flex-1 rounded-lg py-2.5 text-[15px] font-bold text-white disabled:cursor-not-allowed" style={canSave && !saving ? { background: `linear-gradient(180deg, ${GLOW}, ${ACCENT})`, boxShadow: '0 10px 24px -10px rgba(60,120,255,.5)' } : { background: 'var(--ci-card)', color: INK3 }}>
            {saving ? '저장 중…' : `${mode === 'edit' ? '항로 수정하기' : '항로 생성하기'} (${assets.length}개 자산)`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BuilderModal;
