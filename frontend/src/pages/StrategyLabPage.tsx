import { useState, useEffect, useRef, useCallback } from 'react';
import Header from '../components/Header';
import { strategyService, type Strategy, type BacktestRequest, type BacktestResult, type IndicatorData, type Indicator, type Condition } from '../services/strategyService';
import { tradeService, type StockPrice } from '../services/tradeService';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, ComposedChart, Bar, ReferenceLine } from 'recharts';

// ── 프리셋 전략 (교육용) ──
const PRESETS = [
  { id: 'p-golden', name: '골든크로스 추종', category: '추세추종', difficulty: '초급',
    description: '20일 이동평균선이 60일 이동평균선을 상향 돌파할 때 매수, 데드크로스 시 매도하는 전략입니다.',
    longDescription: '골든크로스는 단기 이동평균선이 장기 이동평균선을 아래에서 위로 관통하는 시점을 의미합니다. 이 신호는 상승 추세의 시작을 알려주는 대표적인 기술적 지표입니다. 반대로 데드크로스는 하락 추세의 시작을 의미하며, 이 두 신호를 활용해 추세를 따라가는 것이 핵심입니다.',
    logic: 'MA(20) > MA(60) → 매수 / MA(20) < MA(60) → 매도', indicators: ['MA(20)', 'MA(60)'],
    assetTypes: ['주식', '가상화폐'], videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    videoTitle: '이동평균선 완벽 가이드', metrics: { returnRate: 18.5, maxDrawdown: -12.3, winRate: 58.2, sharpe: 1.45 },
    tags: ['비트코인(BTC)', '이더리움(ETH)', '리플(XRP)'], isPremium: false },
  { id: 'p-rsi', name: 'RSI 과매도 반전', category: '역추세', difficulty: '초급',
    description: 'RSI가 30 이하로 떨어졌다가 다시 올라올 때 매수, 70 이상에서 매도하는 평균회귀 전략입니다.',
    longDescription: 'RSI(상대강도지수)는 0~100 사이의 값으로, 30 이하는 과매도(지나치게 팔림), 70 이상은 과매수(지나치게 사들임) 상태를 나타냅니다. 과매도 구간에서 반등 시 매수하면 평균으로 회귀하는 가격 움직임에서 수익을 얻을 수 있습니다.',
    logic: 'RSI(14) < 30 → 매수 / RSI(14) > 70 → 매도', indicators: ['RSI(14)'],
    assetTypes: ['주식', '가상화폐'], videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    videoTitle: 'RSI 지표 100% 활용법', metrics: { returnRate: 15.2, maxDrawdown: -8.1, winRate: 62.5, sharpe: 1.72 },
    tags: ['삼성전자', 'SK하이닉스'], isPremium: false },
  { id: 'p-bb', name: '볼린저밴드 스퀴즈', category: '변동성', difficulty: '중급',
    description: '볼린저밴드가 좁아진 후 상단 돌파 시 매수, 하단 이탈 시 매도하는 변동성 돌파 전략입니다.',
    longDescription: '볼린저밴드 스퀴즈는 밴드 폭이 극도로 좁아지는 현상으로, 큰 가격 변동이 임박했음을 시사합니다. 스퀴즈 후 상단 밴드를 돌파하면 강한 상승, 하단 이탈 시 하락이 예상됩니다.',
    logic: 'Price > Upper Band → 매수 / Price < Lower Band → 매도', indicators: ['Bollinger(20,2)'],
    assetTypes: ['주식', '가상화폐'], videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    videoTitle: '볼린저밴드 스퀴즈 전략', metrics: { returnRate: 22.8, maxDrawdown: -15.6, winRate: 51.3, sharpe: 1.31 },
    tags: ['비트코인(BTC)', '테슬라(TSLA)'], isPremium: false },
  { id: 'p-macd', name: 'MACD 다이버전스', category: '추세추종', difficulty: '중급',
    description: 'MACD 시그널 크로스와 히스토그램 전환을 활용한 추세 전환 포착 전략입니다.',
    longDescription: 'MACD는 두 이동평균선의 차이를 이용한 지표입니다. MACD 선이 시그널 선을 상향 돌파하면 매수, 하향 돌파하면 매도합니다. 가격과 MACD가 반대 방향으로 움직이는 다이버전스는 강력한 전환 신호입니다.',
    logic: 'MACD > Signal → 매수 / MACD < Signal → 매도', indicators: ['MACD(12,26,9)'],
    assetTypes: ['주식', '가상화폐'], videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    videoTitle: 'MACD 다이버전스 완벽 정리', metrics: { returnRate: 20.1, maxDrawdown: -11.7, winRate: 55.8, sharpe: 1.55 },
    tags: ['카카오', 'LG에너지솔루션'], isPremium: true },
  { id: 'p-rebal', name: '안전 자산 리밸런싱', category: '자산배분', difficulty: '초급',
    description: 'BTC 60% + ETH 30% + 스테이블 10% 비율을 매월 리밸런싱하는 보수적 전략입니다.',
    longDescription: '자산 배분 리밸런싱은 정해진 비율로 자산을 나눠 보유하고, 주기적으로 원래 비율로 맞추는 전략입니다. 가격이 오른 자산은 일부 매도, 떨어진 자산은 추가 매수하여 장기적으로 안정적인 수익을 추구합니다.',
    logic: 'BTC 60% / ETH 30% / USDT 10% 월별 리밸런싱', indicators: [],
    assetTypes: ['가상화폐'], videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    videoTitle: '자산 리밸런싱이란?', metrics: { returnRate: 12.8, maxDrawdown: -6.2, winRate: 72.3, sharpe: 1.95 },
    tags: ['비트코인(BTC)', '이더리움(ETH)'], isPremium: false },
];
type Preset = typeof PRESETS[0];

const genChart = (seed: number, days = 90) => {
  const d = []; let p = 50000 + seed * 10000;
  for (let i = 0; i < days; i++) {
    p += (Math.random() - 0.48) * p * 0.03;
    const dt = new Date(); dt.setDate(dt.getDate() - (days - i));
    d.push({ date: `${dt.getMonth()+1}/${dt.getDate()}`, price: Math.round(p),
      ma20: Math.round(p*(1+(Math.random()-0.5)*0.02)), ma60: Math.round(p*(1+(Math.random()-0.5)*0.01)) });
  } return d;
};
const CHART_CACHE: Record<string, ReturnType<typeof genChart>> = {};
PRESETS.forEach((s,i) => { CHART_CACHE[s.id] = genChart(i); });

type DesignVariant = 'A' | 'B' | 'C';

// ━━━━━━━━━━━━━━━━━━━━━━━━
// Shared Sub-Components
// ━━━━━━━━━━━━━━━━━━━━━━━━
const Badge = ({ level }: { level: string }) => {
  const styles: Record<string,string> = {
    '초급': 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    '중급': 'bg-amber-100 text-amber-700 border border-amber-200',
    '고급': 'bg-rose-100 text-rose-700 border border-rose-200',
  };
  return <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${styles[level]||'bg-gray-100 text-gray-600'}`}>{level}</span>;
};

const MetricGrid = ({ m }: { m: Preset['metrics'] }) => (
  <div className="grid grid-cols-4 gap-3">
    <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
      <div className="text-[11px] text-gray-500 mb-1">기준 수익률</div>
      <div className="text-lg font-bold text-emerald-600">+{m.returnRate}%</div>
    </div>
    <div className="bg-rose-50 rounded-xl p-3 text-center border border-rose-100">
      <div className="text-[11px] text-gray-500 mb-1">최대 낙폭</div>
      <div className="text-lg font-bold text-rose-500">{m.maxDrawdown}%</div>
    </div>
    <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
      <div className="text-[11px] text-gray-500 mb-1">승률</div>
      <div className="text-lg font-bold text-blue-600">{m.winRate}%</div>
    </div>
    <div className="bg-violet-50 rounded-xl p-3 text-center border border-violet-100">
      <div className="text-[11px] text-gray-500 mb-1">샤프 비율</div>
      <div className="text-lg font-bold text-violet-600">{m.sharpe}</div>
    </div>
  </div>
);

const MiniChart = ({ data, height=120 }: { data: typeof CHART_CACHE['']; height?:number }) => (
  <ResponsiveContainer width="100%" height={height}>
    <AreaChart data={data}>
      <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#13395e" stopOpacity={0.25}/><stop offset="100%" stopColor="#13395e" stopOpacity={0}/></linearGradient></defs>
      <XAxis dataKey="date" tick={{fontSize:9,fill:'#b0b0b0'}} tickLine={false} axisLine={false} interval={Math.floor(data.length/4)}/>
      <YAxis hide domain={['dataMin','dataMax']}/>
      <Tooltip contentStyle={{background:'#1a1a2e',border:'none',borderRadius:10,fontSize:11,color:'#fff',boxShadow:'0 4px 20px rgba(0,0,0,0.3)'}} formatter={(v:number)=>[`₩${v.toLocaleString()}`,'가격']}/>
      <Area type="monotone" dataKey="price" stroke="#13395e" fill="url(#cg)" strokeWidth={2} dot={false}/>
    </AreaChart>
  </ResponsiveContainer>
);

const DetailChart = ({ data }: { data: typeof CHART_CACHE[''] }) => (
  <ResponsiveContainer width="100%" height={300}>
    <LineChart data={data}>
      <defs>
        <linearGradient id="dcBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f8fafc" stopOpacity={1}/><stop offset="100%" stopColor="#fff" stopOpacity={1}/></linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5}/>
      <XAxis dataKey="date" tick={{fontSize:11,fill:'#9ca3af'}} tickLine={false} interval={Math.floor(data.length/6)}/>
      <YAxis tick={{fontSize:11,fill:'#9ca3af'}} tickLine={false} axisLine={false} domain={['dataMin','dataMax']} tickFormatter={v=>`${(v/10000).toFixed(0)}만`}/>
      <Tooltip contentStyle={{background:'#1a1a2e',border:'none',borderRadius:10,fontSize:12,color:'#fff',boxShadow:'0 4px 20px rgba(0,0,0,0.3)'}} formatter={(v:number)=>[`₩${v.toLocaleString()}`,'']}/>
      <Line type="monotone" dataKey="price" stroke="#13395e" strokeWidth={2.5} dot={false} name="가격"/>
      <Line type="monotone" dataKey="ma20" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="MA(20)" strokeDasharray="6 3"/>
      <Line type="monotone" dataKey="ma60" stroke="#ef4444" strokeWidth={1.5} dot={false} name="MA(60)" strokeDasharray="6 3"/>
    </LineChart>
  </ResponsiveContainer>
);

// ── StrategyCardMini ──
const StrategyCardMini = ({ s, selected, onSelect }: { s:Preset; selected:boolean; onSelect:()=>void }) => (
  <div onClick={onSelect} className={`rounded-2xl p-4 cursor-pointer transition-all duration-300 ${selected ? 'bg-gradient-to-br from-[#13395e] to-[#1e6091] text-white shadow-lg shadow-[#13395e]/20 scale-[1.02]' : 'bg-white border border-gray-100 hover:border-[#13395e]/30 hover:shadow-md'}`}>
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-1.5">
        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${selected ? 'bg-white/20 text-white' : 'bg-[#13395e]/10 text-[#13395e]'}`}>{s.category}</span>
        {!selected && <Badge level={s.difficulty}/>}
      </div>
      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${selected ? 'bg-white/20 text-white' : s.isPremium ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{s.isPremium?'PRO':'FREE'}</span>
    </div>
    <h4 className={`font-bold text-sm mb-1 ${selected?'text-white':'text-gray-900'}`}>{s.name}</h4>
    <p className={`text-xs mb-3 line-clamp-2 ${selected?'text-white/70':'text-gray-400'}`}>{s.description}</p>
    <MiniChart data={CHART_CACHE[s.id]||[]} height={70}/>
    <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-3">
      {[{l:'수익률',v:`+${s.metrics.returnRate}%`},{l:'낙폭',v:`${s.metrics.maxDrawdown}%`},{l:'승률',v:`${s.metrics.winRate}%`},{l:'샤프',v:`${s.metrics.sharpe}`}].map(x=>(
        <div key={x.l} className="flex justify-between text-[11px]">
          <span className={selected?'text-white/50':'text-gray-400'}>{x.l}</span>
          <span className={`font-semibold ${selected?'text-white':x.l==='낙폭'?'text-rose-500':'text-gray-700'}`}>{x.v}</span>
        </div>
      ))}
    </div>
    <div className="flex flex-wrap gap-1 mt-2.5">{s.tags.slice(0,3).map(t=><span key={t} className={`text-[10px] px-1.5 py-0.5 rounded ${selected?'bg-white/15 text-white/80':'bg-gray-100 text-gray-500'}`}>{t}</span>)}</div>
  </div>
);

// ── StrategyDetail ──
const StrategyDetail = ({ s, showVideo, setShowVideo }: { s:Preset; showVideo:boolean; setShowVideo:(v:boolean)=>void }) => (
  <>
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#13395e]/10 text-[#13395e] font-semibold">{s.category}</span>
            <Badge level={s.difficulty}/>
            {s.isPremium&&<span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 border border-amber-200">PRO</span>}
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900">{s.name}</h2>
          <p className="text-gray-500 mt-1.5 text-sm leading-relaxed">{s.description}</p>
        </div>
        <button className="bg-gradient-to-r from-[#13395e] to-[#1e6091] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-[#13395e]/25 transition-all duration-300 hover:-translate-y-0.5">
          {s.isPremium?'구매하기':'무료 사용'}
        </button>
      </div>
      <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl p-4 mb-5 border border-gray-100">
        <div className="text-[11px] text-gray-400 mb-1 font-semibold uppercase tracking-wider">Trading Logic</div>
        <code className="text-sm text-[#13395e] font-mono font-semibold">{s.logic}</code>
      </div>
      <MetricGrid m={s.metrics}/>
    </div>
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
      <h3 className="font-bold text-gray-900 mb-4">전략 시뮬레이션 차트</h3>
      <DetailChart data={CHART_CACHE[s.id]||[]}/>
      <div className="flex items-center gap-5 mt-3 text-xs text-gray-400">
        <span className="flex items-center gap-1.5"><span className="w-4 h-[3px] bg-[#13395e] rounded-full inline-block"/> 가격</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-[2px] bg-amber-500 rounded-full inline-block" style={{borderTop:'2px dashed #f59e0b'}}/> MA(20)</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-[2px] bg-red-500 rounded-full inline-block" style={{borderTop:'2px dashed #ef4444'}}/> MA(60)</span>
      </div>
    </div>
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h3 className="font-bold text-gray-900 mb-3">이 전략 이해하기</h3>
      <p className="text-gray-600 text-sm leading-relaxed mb-5">{s.longDescription}</p>
      <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-xl p-4 border border-red-100/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/30"><svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20"><polygon points="8,5 15,10 8,15"/></svg></div>
            <div><div className="text-sm font-semibold text-gray-900">{s.videoTitle}</div><div className="text-xs text-gray-400">참고 학습 영상</div></div>
          </div>
          <button onClick={()=>setShowVideo(!showVideo)} className="text-red-500 text-sm font-semibold hover:text-red-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50">{showVideo?'접기':'영상 보기'}</button>
        </div>
        {showVideo&&<div className="aspect-video rounded-xl overflow-hidden bg-black shadow-lg"><iframe src={s.videoUrl} className="w-full h-full" allow="autoplay; encrypted-media" allowFullScreen title="video"/></div>}
      </div>
      {s.indicators.length>0&&<div className="mt-5"><div className="text-sm font-semibold text-gray-700 mb-2">사용된 기술 지표</div><div className="flex gap-2">{s.indicators.map(i=><span key={i} className="px-3 py-1.5 bg-gradient-to-r from-[#13395e]/10 to-[#1e6091]/10 text-[#13395e] rounded-lg text-sm font-semibold border border-[#13395e]/15">{i}</span>)}</div></div>}
    </div>
  </>
);

// ── BacktestPanel ──
const BacktestPanel = ({ strategies }: { strategies: Strategy[] }) => {
  const [stockSearch, setStockSearch] = useState('');
  const [stockResults, setStockResults] = useState<{code:string;name:string}[]>([]);
  const [selectedStock, setSelectedStock] = useState<{code:string;name:string}|null>(null);
  const [startDate, setStartDate] = useState('2025-01-01');
  const [endDate, setEndDate] = useState('2025-12-31');
  const [capital, setCapital] = useState(10000000);
  const [selectedStrategyId, setSelectedStrategyId] = useState('');
  const [result, setResult] = useState<BacktestResult|null>(null);
  const [loading, setLoading] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout>|null>(null);

  const handleSearch = useCallback((q: string) => {
    setStockSearch(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.length < 1) { setStockResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      try { const r = await tradeService.searchKrxStocks(q); setStockResults(r.slice(0,8)); } catch {}
    }, 300);
  }, []);

  const runBacktest = async () => {
    if (!selectedStock || !selectedStrategyId) return;
    setLoading(true);
    try {
      const req: BacktestRequest = { strategyId: selectedStrategyId, stockCode: selectedStock.code, stockName: selectedStock.name, startDate, endDate, initialCapital: capital };
      const res = await strategyService.runBacktest(req);
      setResult(res);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const inputClass = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#13395e]/20 focus:border-[#13395e]/40 outline-none transition-all";

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center"><svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg></div>
        <h3 className="font-bold text-gray-900">백테스팅</h3>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="text-[11px] text-gray-400 mb-1 block font-semibold uppercase tracking-wider">전략 선택</label>
          <select value={selectedStrategyId} onChange={e=>setSelectedStrategyId(e.target.value)} className={inputClass}>
            <option value="">전략을 선택하세요</option>
            {strategies.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="relative">
          <label className="text-[11px] text-gray-400 mb-1 block font-semibold uppercase tracking-wider">종목 검색</label>
          <input value={stockSearch} onChange={e=>handleSearch(e.target.value)} placeholder="종목명 검색" className={inputClass}/>
          {selectedStock&&<div className="text-xs text-[#13395e] mt-1 font-medium">{selectedStock.name} ({selectedStock.code})</div>}
          {stockResults.length>0&&<div className="absolute z-10 top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-xl mt-1 max-h-40 overflow-y-auto">
            {stockResults.map(r=><div key={r.code} onClick={()=>{setSelectedStock(r);setStockSearch(r.name);setStockResults([]);}} className="px-3 py-2.5 text-sm hover:bg-[#13395e]/5 cursor-pointer transition-colors">{r.name} <span className="text-gray-400">{r.code}</span></div>)}
          </div>}
        </div>
        <div><label className="text-[11px] text-gray-400 mb-1 block font-semibold uppercase tracking-wider">시작일</label><input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className={inputClass}/></div>
        <div><label className="text-[11px] text-gray-400 mb-1 block font-semibold uppercase tracking-wider">종료일</label><input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className={inputClass}/></div>
        <div><label className="text-[11px] text-gray-400 mb-1 block font-semibold uppercase tracking-wider">초기 자본</label><input type="number" value={capital} onChange={e=>setCapital(Number(e.target.value))} className={inputClass}/></div>
        <div className="flex items-end">
          <button onClick={runBacktest} disabled={loading||!selectedStock||!selectedStrategyId}
            className="w-full bg-gradient-to-r from-[#13395e] to-[#1e6091] text-white py-2.5 rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-[#13395e]/25 disabled:opacity-40 disabled:hover:shadow-none transition-all duration-300">
            {loading?<span className="flex items-center justify-center gap-2"><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>실행 중...</span>:'백테스트 실행'}
          </button>
        </div>
      </div>
      {result&&<div className="border-t border-gray-100 pt-5 mt-2">
        <h4 className="text-sm font-bold text-gray-900 mb-3">결과: {result.stockName}</h4>
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className={`rounded-xl p-3 text-center ${result.totalReturnRate>=0?'bg-emerald-50 border border-emerald-100':'bg-rose-50 border border-rose-100'}`}>
            <div className="text-[10px] text-gray-400 font-medium">총 수익률</div>
            <div className={`text-sm font-bold ${result.totalReturnRate>=0?'text-emerald-600':'text-rose-500'}`}>{result.totalReturnRate>0?'+':''}{result.totalReturnRate.toFixed(1)}%</div>
          </div>
          <div className="bg-rose-50 rounded-xl p-3 text-center border border-rose-100"><div className="text-[10px] text-gray-400 font-medium">최대 낙폭</div><div className="text-sm font-bold text-rose-500">{result.maxDrawdown.toFixed(1)}%</div></div>
          <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100"><div className="text-[10px] text-gray-400 font-medium">승률</div><div className="text-sm font-bold text-blue-600">{result.winRate.toFixed(1)}%</div></div>
          <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100"><div className="text-[10px] text-gray-400 font-medium">총 거래</div><div className="text-sm font-bold text-gray-900">{result.totalTrades}회</div></div>
        </div>
        {result.equityCurve&&result.equityCurve.length>0&&<ResponsiveContainer width="100%" height={200}>
          <AreaChart data={result.equityCurve}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5}/>
            <XAxis dataKey="date" tick={{fontSize:10}} tickLine={false} interval={Math.floor(result.equityCurve.length/5)}/>
            <YAxis tick={{fontSize:10}} tickLine={false} axisLine={false} tickFormatter={v=>`${(v/10000).toFixed(0)}만`}/>
            <Tooltip contentStyle={{background:'#1a1a2e',border:'none',borderRadius:10,fontSize:12,color:'#fff'}}/>
            <Area type="monotone" dataKey="value" stroke="#13395e" fill="url(#cg)" strokeWidth={2} dot={false}/>
          </AreaChart>
        </ResponsiveContainer>}
      </div>}
    </div>
  );
};

// ── IndicatorPanel ──
const IndicatorPanel = () => {
  const INDICATORS = ['RSI','MACD','MA','EMA','BOLLINGER','STOCHASTIC','ATR'];
  const INDICATOR_MAP: Record<string,string> = { 'BOLLINGER': 'BOLLINGER_BANDS' };
  const [selected, setSelected] = useState('RSI');
  const [stockCode, setStockCode] = useState('BTC_KRW');
  const [data, setData] = useState<IndicatorData[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const apiKey = INDICATOR_MAP[selected] || selected;
    try { const r = await strategyService.getIndicatorData(stockCode, apiKey, 'CRYPTO'); setData(r.slice(-60)); } catch {} finally { setLoading(false); }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 overflow-hidden">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center"><svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"/></svg></div>
        <h3 className="font-bold text-gray-900 text-sm">지표 분석</h3>
      </div>
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {INDICATORS.map(i=>(
          <button key={i} onClick={()=>setSelected(i)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all duration-200 ${selected===i?'bg-gradient-to-r from-[#13395e] to-[#1e6091] text-white shadow-sm':'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            {i}
          </button>
        ))}
      </div>
      <div className="mb-4">
        <input value={stockCode} onChange={e=>setStockCode(e.target.value)} placeholder="종목코드 (예: BTC_KRW)"
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mb-2 focus:ring-2 focus:ring-[#13395e]/20 focus:border-[#13395e]/40 outline-none transition-all"/>
        <button onClick={load} disabled={loading}
          className="w-full bg-gradient-to-r from-[#13395e] to-[#1e6091] text-white py-2 rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-[#13395e]/20 disabled:opacity-40 transition-all duration-300">
          {loading?'로딩...':'조회'}
        </button>
      </div>
      {data.length>0&&<ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5}/>
          <XAxis dataKey="date" tick={{fontSize:9}} tickLine={false} interval={Math.floor(data.length/4)}/>
          <YAxis yAxisId="price" orientation="right" tick={{fontSize:9}} tickLine={false} axisLine={false}/>
          <YAxis yAxisId="ind" orientation="left" tick={{fontSize:9}} tickLine={false} axisLine={false}/>
          <Tooltip contentStyle={{background:'#1a1a2e',border:'none',borderRadius:10,fontSize:11,color:'#fff'}}/>
          <Line yAxisId="price" type="monotone" dataKey="price" stroke="#94a3b8" strokeWidth={1} dot={false} name="가격"/>
          <Line yAxisId="ind" type="monotone" dataKey="value" stroke="#13395e" strokeWidth={2} dot={false} name={selected}/>
          {data[0]?.value2!==undefined&&<Line yAxisId="ind" type="monotone" dataKey="value2" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="Signal"/>}
          {selected==='RSI'&&<><ReferenceLine yAxisId="ind" y={70} stroke="#ef4444" strokeDasharray="3 3"/><ReferenceLine yAxisId="ind" y={30} stroke="#22c55e" strokeDasharray="3 3"/></>}
        </ComposedChart>
      </ResponsiveContainer>}
    </div>
  );
};

// ── StrategyCreateModal ──
const StrategyCreateModal = ({ open, onClose, onCreated }: { open:boolean; onClose:()=>void; onCreated:(s:Strategy)=>void }) => {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(''); const [desc, setDesc] = useState('');
  const [assetType, setAssetType] = useState<'CRYPTO'|'STOCK'>('CRYPTO');
  const [indicators, setIndicators] = useState<Indicator[]>([{ type:'RSI', parameters:{period:14} }]);
  const [entry, setEntry] = useState<Condition[]>([{ indicator:'RSI', operator:'LT', value:30, logic:'AND' }]);
  const [exit, setExit] = useState<Condition[]>([{ indicator:'RSI', operator:'GT', value:70, logic:'AND' }]);
  const [loading, setLoading] = useState(false);
  if (!open) return null;
  const STEPS = ['기본 정보','지표 설정','매매 조건','확인 및 생성'];
  const create = async () => {
    setLoading(true);
    try {
      const s = await strategyService.createStrategy({ name, description: desc, indicators, entryConditions: entry, exitConditions: exit, targetAssets: [], assetType, strategyLogic: `${entry.map(c=>`${c.indicator} ${c.operator} ${c.value}`).join(' & ')} → 매수` });
      onCreated(s); onClose();
    } catch {} finally { setLoading(false); }
  };
  const inputClass = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#13395e]/20 focus:border-[#13395e]/40 outline-none transition-all";
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-extrabold text-gray-900">전략 생성</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">&times;</button>
        </div>
        <div className="flex gap-2 mb-6">{STEPS.map((s,i)=><div key={i} className={`flex-1 h-2 rounded-full transition-all duration-500 ${i<=step?'bg-gradient-to-r from-[#13395e] to-[#1e6091]':'bg-gray-200'}`}/>)}</div>
        <div className="text-xs font-semibold text-gray-400 mb-4 uppercase tracking-wider">{step+1}/{STEPS.length} — {STEPS[step]}</div>
        {step===0&&<div className="space-y-3">
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="전략 이름" className={inputClass}/>
          <textarea value={desc} onChange={e=>setDesc(e.target.value)} placeholder="전략 설명" className={inputClass} rows={3}/>
          <select value={assetType} onChange={e=>setAssetType(e.target.value as any)} className={inputClass}>
            <option value="CRYPTO">가상화폐</option><option value="STOCK">주식</option>
          </select>
        </div>}
        {step===1&&<div className="space-y-3">
          {indicators.map((ind,i)=><div key={i} className="flex gap-2">
            <select value={ind.type} onChange={e=>{const n=[...indicators];n[i]={...n[i],type:e.target.value as any};setIndicators(n);}} className={`flex-1 ${inputClass}`}>
              {['RSI','MACD','MA','EMA','BOLLINGER_BANDS','STOCHASTIC','ATR'].map(t=><option key={t} value={t}>{t}</option>)}
            </select>
            <button onClick={()=>setIndicators(indicators.filter((_,j)=>j!==i))} className="w-10 h-10 rounded-xl bg-rose-50 text-rose-400 hover:bg-rose-100 hover:text-rose-600 flex items-center justify-center transition-colors">&times;</button>
          </div>)}
          <button onClick={()=>setIndicators([...indicators,{type:'MA',parameters:{period:20}}])} className="text-[#13395e] text-sm font-semibold hover:underline">+ 지표 추가</button>
        </div>}
        {step===2&&<div className="space-y-4">
          <div><div className="text-xs font-semibold text-emerald-600 mb-2 uppercase tracking-wider">매수 조건 (진입)</div>
            {entry.map((c,i)=><div key={i} className="flex gap-2 mb-2">
              <input value={c.indicator} onChange={e=>{const n=[...entry];n[i]={...n[i],indicator:e.target.value};setEntry(n);}} className={`flex-1 ${inputClass}`} placeholder="지표"/>
              <select value={c.operator} onChange={e=>{const n=[...entry];n[i]={...n[i],operator:e.target.value as any};setEntry(n);}} className={`w-20 ${inputClass}`}>
                {['GT','LT','GTE','LTE','EQ'].map(o=><option key={o} value={o}>{({'GT':'>','LT':'<','GTE':'≥','LTE':'≤','EQ':'='} as any)[o]}</option>)}
              </select>
              <input type="number" value={c.value} onChange={e=>{const n=[...entry];n[i]={...n[i],value:Number(e.target.value)};setEntry(n);}} className={`w-24 ${inputClass}`}/>
            </div>)}
          </div>
          <div><div className="text-xs font-semibold text-blue-600 mb-2 uppercase tracking-wider">매도 조건 (청산)</div>
            {exit.map((c,i)=><div key={i} className="flex gap-2 mb-2">
              <input value={c.indicator} onChange={e=>{const n=[...exit];n[i]={...n[i],indicator:e.target.value};setExit(n);}} className={`flex-1 ${inputClass}`} placeholder="지표"/>
              <select value={c.operator} onChange={e=>{const n=[...exit];n[i]={...n[i],operator:e.target.value as any};setExit(n);}} className={`w-20 ${inputClass}`}>
                {['GT','LT','GTE','LTE','EQ'].map(o=><option key={o} value={o}>{({'GT':'>','LT':'<','GTE':'≥','LTE':'≤','EQ':'='} as any)[o]}</option>)}
              </select>
              <input type="number" value={c.value} onChange={e=>{const n=[...exit];n[i]={...n[i],value:Number(e.target.value)};setExit(n);}} className={`w-24 ${inputClass}`}/>
            </div>)}
          </div>
        </div>}
        {step===3&&<div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl p-5 text-sm space-y-2.5 border border-gray-100">
          <div className="flex items-center gap-2"><span className="text-gray-400 w-12">이름</span><span className="font-semibold text-gray-900">{name}</span></div>
          <div className="flex items-center gap-2"><span className="text-gray-400 w-12">자산</span><span className="font-semibold text-gray-900">{assetType==='CRYPTO'?'가상화폐':'주식'}</span></div>
          <div className="flex items-center gap-2"><span className="text-gray-400 w-12">지표</span><div className="flex gap-1">{indicators.map((i,idx)=><span key={idx} className="px-2 py-0.5 bg-[#13395e]/10 text-[#13395e] rounded text-xs font-medium">{i.type}</span>)}</div></div>
          <div className="flex items-start gap-2"><span className="text-emerald-500 w-12">매수</span><span className="text-gray-700">{entry.map(c=>`${c.indicator} ${({'GT':'>','LT':'<','GTE':'≥','LTE':'≤','EQ':'='} as any)[c.operator]} ${c.value}`).join(', ')}</span></div>
          <div className="flex items-start gap-2"><span className="text-blue-500 w-12">매도</span><span className="text-gray-700">{exit.map(c=>`${c.indicator} ${({'GT':'>','LT':'<','GTE':'≥','LTE':'≤','EQ':'='} as any)[c.operator]} ${c.value}`).join(', ')}</span></div>
        </div>}
        <div className="flex justify-between mt-6">
          <button onClick={()=>setStep(Math.max(0,step-1))} disabled={step===0} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors">← 이전</button>
          {step<3?<button onClick={()=>setStep(step+1)} className="px-5 py-2.5 text-sm bg-gradient-to-r from-[#13395e] to-[#1e6091] text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-[#13395e]/20 transition-all">다음 →</button>
            :<button onClick={create} disabled={loading||!name} className="px-5 py-2.5 text-sm bg-gradient-to-r from-[#13395e] to-[#1e6091] text-white rounded-xl font-semibold hover:shadow-lg disabled:opacity-40 transition-all">{loading?'생성 중...':'전략 생성'}</button>}
        </div>
      </div>
    </div>
  );
};

// ── ApplyModal ──
const ApplyModal = ({ open, onClose, strategyId }: { open:boolean; onClose:()=>void; strategyId:string }) => {
  const [amount, setAmount] = useState(1000000);
  const [loading, setLoading] = useState(false);
  if (!open) return null;
  const apply = async () => { setLoading(true); try { await strategyService.applyStrategy(strategyId, amount); onClose(); } catch {} finally { setLoading(false); } };
  const QUICK = [100000, 500000, 1000000, 5000000];
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e=>e.stopPropagation()}>
        <h3 className="text-lg font-extrabold text-gray-900 mb-5">포트폴리오에 적용</h3>
        <label className="text-[11px] text-gray-400 mb-1 block font-semibold uppercase tracking-wider">투자 금액 (원)</label>
        <input type="number" value={amount} onChange={e=>setAmount(Number(e.target.value))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-3 focus:ring-2 focus:ring-[#13395e]/20 outline-none"/>
        <div className="flex gap-2 mb-5">{QUICK.map(q=><button key={q} onClick={()=>setAmount(q)} className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${amount===q?'bg-[#13395e] text-white':'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{q>=1000000?`${q/10000}만`:`${q/10000}만`}</button>)}</div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">취소</button>
          <button onClick={apply} disabled={loading} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-[#13395e] to-[#1e6091] text-white hover:shadow-lg disabled:opacity-40 transition-all">{loading?'적용 중...':'적용하기'}</button>
        </div>
      </div>
    </div>
  );
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Main Page Component
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const StrategyLabPage = () => {
  const [design, setDesign] = useState<DesignVariant>('A');
  const [selectedPreset, setSelectedPreset] = useState(PRESETS[0]);
  const [userStrategies, setUserStrategies] = useState<Strategy[]>([]);
  const [filterCat, setFilterCat] = useState('전체');
  const [showVideo, setShowVideo] = useState(false);
  const [learningStep, setLearningStep] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [applyTarget, setApplyTarget] = useState<string|null>(null);

  useEffect(() => { strategyService.getStrategies().then(setUserStrategies).catch(()=>{}); }, []);

  const categories = ['전체', ...new Set(PRESETS.map(s=>s.category))];
  const filtered = PRESETS.filter(s => filterCat==='전체'||s.category===filterCat);
  const deleteStrategy = async (id: string) => { try { await strategyService.deleteStrategy(id); setUserStrategies(prev=>prev.filter(s=>s.id!==id)); } catch {} };
  const selectPreset = (s: Preset) => { setSelectedPreset(s); setShowVideo(false); };

  const UserStrategiesList = () => userStrategies.length>0 ? (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
      <h4 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider">내 전략</h4>
      <div className="space-y-2">{userStrategies.map(s=>(
        <div key={s.id} className="flex items-center justify-between bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl p-3 border border-gray-100">
          <div><div className="text-sm font-semibold text-gray-900">{s.name}</div><div className="text-[11px] text-gray-400">{s.assetType==='CRYPTO'?'가상화폐':'주식'} · {s.indicators.map(i=>i.type).join(', ')}</div></div>
          <div className="flex gap-1.5">
            <button onClick={()=>setApplyTarget(s.id)} className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition-all ${s.applied?'bg-emerald-100 text-emerald-700':'bg-gradient-to-r from-[#13395e] to-[#1e6091] text-white hover:shadow-sm'}`}>{s.applied?'적용됨':'적용'}</button>
            <button onClick={()=>deleteStrategy(s.id)} className="text-[11px] px-2.5 py-1 bg-rose-50 text-rose-500 rounded-lg font-medium hover:bg-rose-100 transition-colors">삭제</button>
          </div>
        </div>
      ))}</div>
    </div>
  ) : null;

  // ━━ Design A ━━
  const DesignA = () => (
    <div className="flex gap-6 mt-6">
      <div className="flex-[6] min-w-0 space-y-4">
        <StrategyDetail s={selectedPreset} showVideo={showVideo} setShowVideo={setShowVideo}/>
        <BacktestPanel strategies={userStrategies}/>
        <IndicatorPanel/>
      </div>
      <div className="w-[340px] flex-shrink-0">
        <button onClick={()=>setShowCreate(true)} className="w-full mb-3 py-3 rounded-xl text-sm font-semibold border-2 border-dashed border-[#13395e]/30 text-[#13395e] hover:bg-[#13395e]/5 hover:border-[#13395e]/50 transition-all duration-300">+ 새 전략 만들기</button>
        <UserStrategiesList/>
        <div className="flex gap-1.5 mb-4 flex-wrap">
          {categories.map(c=><button key={c} onClick={()=>setFilterCat(c)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${filterCat===c?'bg-gradient-to-r from-[#13395e] to-[#1e6091] text-white shadow-sm':'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{c}</button>)}
        </div>
        <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto pr-1 scrollbar-thin">
          {filtered.map(s=><StrategyCardMini key={s.id} s={s} selected={selectedPreset.id===s.id} onSelect={()=>selectPreset(s)}/>)}
        </div>
      </div>
    </div>
  );

  // ━━ Design B ━━
  const STEPS = [{ title:'개념 이해', icon:'📖' },{ title:'지표 학습', icon:'📊' },{ title:'시뮬레이션', icon:'📈' },{ title:'적용', icon:'🚀' }];

  const DesignB = () => (
    <div className="mt-6 grid grid-cols-12 gap-6">
      <div className="col-span-8">
        <div className="bg-gradient-to-br from-[#13395e] via-[#174f7a] to-[#1e6091] rounded-2xl p-7 text-white mb-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"/>
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"/>
          <div className="relative">
            <div className="flex items-center gap-2 mb-2"><Badge level={selectedPreset.difficulty}/><span className="text-white/60 text-xs font-medium">{selectedPreset.category}</span></div>
            <h2 className="text-2xl font-extrabold mb-2">{selectedPreset.name}</h2>
            <p className="text-white/75 text-sm leading-relaxed">{selectedPreset.description}</p>
            <code className="inline-block mt-3 px-4 py-2 bg-white/10 backdrop-blur rounded-xl text-sm font-mono text-white/90 border border-white/10">{selectedPreset.logic}</code>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
          <div className="flex items-center justify-between mb-6">
            {STEPS.map((st,i)=>(
              <div key={i} className="flex items-center">
                <button onClick={()=>setLearningStep(i)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${learningStep===i?'bg-gradient-to-r from-[#13395e] to-[#1e6091] text-white shadow-lg shadow-[#13395e]/20':learningStep>i?'bg-emerald-100 text-emerald-700':'bg-gray-100 text-gray-400'}`}>
                  <span>{st.icon}</span><span className="hidden md:inline">{st.title}</span>
                </button>
                {i<STEPS.length-1&&<div className={`w-8 h-0.5 mx-1 rounded-full transition-colors ${learningStep>i?'bg-emerald-400':'bg-gray-200'}`}/>}
              </div>
            ))}
          </div>
          {learningStep===0&&<div>
            <h3 className="text-lg font-extrabold text-gray-900 mb-3">전략 개념 이해하기</h3>
            <p className="text-gray-600 leading-relaxed mb-5">{selectedPreset.longDescription}</p>
            <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-xl p-4 border border-red-100/50"><div className="aspect-video rounded-xl overflow-hidden bg-black shadow-lg"><iframe src={selectedPreset.videoUrl} className="w-full h-full" allow="autoplay; encrypted-media" allowFullScreen title="video"/></div></div>
          </div>}
          {learningStep===1&&<div>
            <h3 className="text-lg font-extrabold text-gray-900 mb-3">사용되는 기술적 지표</h3>
            {selectedPreset.indicators.length>0?selectedPreset.indicators.map(ind=>(
              <div key={ind} className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl p-4 mb-3 border border-gray-100">
                <div className="flex items-center gap-2 mb-2"><span className="w-9 h-9 bg-gradient-to-br from-[#13395e] to-[#1e6091] rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-[#13395e]/20">{ind.charAt(0)}</span><div className="font-bold text-gray-900">{ind}</div></div>
                <p className="text-sm text-gray-600 leading-relaxed">{ind.includes('MA')&&'이동평균선은 일정 기간 동안의 평균 가격을 연결한 선으로, 추세를 파악하는 데 사용됩니다.'}{ind.includes('RSI')&&'RSI는 가격 변동의 강도를 0~100 사이로 표현합니다.'}{ind.includes('Bollinger')&&'볼린저밴드는 이동평균선 중심으로 표준편차 밴드를 그립니다.'}{ind.includes('MACD')&&'MACD는 12일 EMA와 26일 EMA의 차이를 이용한 지표입니다.'}</p>
              </div>
            )):<div className="bg-gray-50 rounded-xl p-4 border border-gray-100"><p className="text-sm text-gray-600">이 전략은 자산배분 방식을 사용합니다.</p></div>}
            <div className="mt-4"><IndicatorPanel/></div>
          </div>}
          {learningStep===2&&<div>
            <h3 className="text-lg font-extrabold text-gray-900 mb-3">과거 성과 시뮬레이션</h3>
            <DetailChart data={CHART_CACHE[selectedPreset.id]||[]}/><div className="mt-4"><MetricGrid m={selectedPreset.metrics}/></div>
            <div className="mt-4"><BacktestPanel strategies={userStrategies}/></div>
          </div>}
          {learningStep===3&&<div className="text-center py-10">
            <div className="text-6xl mb-5">🎉</div><h3 className="text-2xl font-extrabold text-gray-900 mb-2">전략 학습 완료!</h3>
            <p className="text-gray-500 mb-8">이제 이 전략을 내 포트폴리오에 적용해보세요.</p>
            <button onClick={()=>setShowCreate(true)} className="bg-gradient-to-r from-[#13395e] to-[#1e6091] text-white px-8 py-3.5 rounded-xl font-semibold hover:shadow-xl hover:shadow-[#13395e]/25 transition-all duration-300 hover:-translate-y-0.5">새 전략 만들기</button>
          </div>}
          <div className="flex justify-between mt-6 pt-4 border-t border-gray-100">
            <button onClick={()=>setLearningStep(Math.max(0,learningStep-1))} disabled={learningStep===0} className="px-4 py-2 text-sm text-gray-400 disabled:opacity-30 hover:text-gray-600 transition-colors">← 이전</button>
            <button onClick={()=>setLearningStep(Math.min(3,learningStep+1))} disabled={learningStep===3} className="px-5 py-2.5 text-sm bg-gradient-to-r from-[#13395e] to-[#1e6091] text-white rounded-xl font-semibold disabled:opacity-30 hover:shadow-lg transition-all">다음 →</button>
          </div>
        </div>
      </div>
      <div className="col-span-4">
        <div className="sticky top-4">
          <button onClick={()=>setShowCreate(true)} className="w-full mb-3 py-3 rounded-xl text-sm font-semibold border-2 border-dashed border-[#13395e]/30 text-[#13395e] hover:bg-[#13395e]/5 transition-all">+ 새 전략 만들기</button>
          <UserStrategiesList/>
          <h3 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider">프리셋 전략</h3>
          <div className="space-y-2 max-h-[calc(100vh-260px)] overflow-y-auto pr-1">
            {PRESETS.map(s=>(
              <div key={s.id} onClick={()=>{selectPreset(s);setLearningStep(0);}} className={`rounded-xl border p-3.5 cursor-pointer transition-all duration-300 ${selectedPreset.id===s.id?'border-[#13395e] bg-[#13395e]/5 shadow-sm':'border-gray-100 bg-white hover:border-[#13395e]/30'}`}>
                <div className="flex items-center justify-between mb-1"><span className="font-bold text-sm text-gray-900">{s.name}</span><Badge level={s.difficulty}/></div>
                <p className="text-xs text-gray-400 line-clamp-1 mb-2">{s.description}</p>
                <MiniChart data={CHART_CACHE[s.id]||[]} height={45}/>
                <div className="flex items-center justify-between mt-2 text-xs"><span className="text-emerald-600 font-semibold">+{s.metrics.returnRate}%</span><span className="text-gray-400">승률 {s.metrics.winRate}%</span></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // ━━ Design C ━━
  const DesignC = () => (
    <div className="mt-6">
      <div className="flex gap-3 overflow-x-auto pb-4 mb-6 scrollbar-thin">
        {PRESETS.map(s=>(
          <div key={s.id} onClick={()=>selectPreset(s)} className={`flex-shrink-0 w-52 rounded-2xl p-4 cursor-pointer transition-all duration-300 ${selectedPreset.id===s.id?'bg-gradient-to-br from-[#13395e] to-[#1e6091] text-white shadow-xl shadow-[#13395e]/25 scale-105':'bg-white border border-gray-100 hover:shadow-md hover:border-[#13395e]/20'}`}>
            <div className="flex items-center justify-between mb-2"><Badge level={s.difficulty}/>{!s.isPremium&&<span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${selectedPreset.id===s.id?'bg-white/20 text-white':'bg-emerald-100 text-emerald-700'}`}>FREE</span>}</div>
            <h4 className={`font-bold text-sm mb-1 ${selectedPreset.id===s.id?'text-white':'text-gray-900'}`}>{s.name}</h4>
            <p className={`text-xs mb-2 line-clamp-1 ${selectedPreset.id===s.id?'text-white/60':'text-gray-400'}`}>{s.category}</p>
            <div className="flex items-center justify-between text-xs">
              <span className={`font-semibold ${selectedPreset.id===s.id?'text-emerald-300':'text-emerald-600'}`}>+{s.metrics.returnRate}%</span>
              <span className={selectedPreset.id===s.id?'text-white/50':'text-gray-400'}>승률 {s.metrics.winRate}%</span>
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-4 space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-3"><span className="text-xs px-2.5 py-0.5 rounded-full bg-[#13395e]/10 text-[#13395e] font-semibold">{selectedPreset.category}</span><Badge level={selectedPreset.difficulty}/></div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-2">{selectedPreset.name}</h2>
            <p className="text-sm text-gray-500 leading-relaxed mb-4">{selectedPreset.longDescription}</p>
            <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl p-3 mb-4 border border-gray-100"><div className="text-[11px] text-gray-400 mb-1 font-semibold uppercase tracking-wider">Trading Logic</div><code className="text-sm text-[#13395e] font-mono font-semibold">{selectedPreset.logic}</code></div>
            <div className="flex flex-wrap gap-1.5 mb-4">{selectedPreset.indicators.map(i=><span key={i} className="px-2.5 py-1 bg-[#13395e]/10 text-[#13395e] rounded-lg text-xs font-semibold border border-[#13395e]/15">{i}</span>)}</div>
            <button onClick={()=>setShowCreate(true)} className="w-full bg-gradient-to-r from-[#13395e] to-[#1e6091] text-white py-3 rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-[#13395e]/20 transition-all duration-300">내 전략 만들기</button>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-bold text-gray-900 mb-3 text-sm">참고 영상</h3>
            <div className="aspect-video rounded-xl overflow-hidden bg-black mb-3 shadow-lg"><iframe src={selectedPreset.videoUrl} className="w-full h-full" allow="autoplay; encrypted-media" allowFullScreen title="video"/></div>
            <p className="text-xs text-gray-500">{selectedPreset.videoTitle}</p>
          </div>
          <UserStrategiesList/>
        </div>
        <div className="col-span-5 space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-bold text-gray-900 mb-4">전략 시뮬레이션</h3>
            <DetailChart data={CHART_CACHE[selectedPreset.id]||[]}/>
            <div className="mt-4 pt-4 border-t border-gray-100"><div className="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-wider">대상 자산</div><div className="flex flex-wrap gap-1.5">{selectedPreset.tags.map(t=><span key={t} className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium">{t}</span>)}</div></div>
          </div>
          <BacktestPanel strategies={userStrategies}/>
        </div>
        <div className="col-span-3 space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-bold text-gray-900 mb-4 text-sm">성과 지표</h3>
            <div className="space-y-4">
              <div><div className="flex justify-between text-sm mb-1.5"><span className="text-gray-500">기준 수익률</span><span className="font-bold text-emerald-600">+{selectedPreset.metrics.returnRate}%</span></div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500" style={{width:`${Math.min(100,selectedPreset.metrics.returnRate*3)}%`}}/></div></div>
              <div><div className="flex justify-between text-sm mb-1.5"><span className="text-gray-500">최대 낙폭</span><span className="font-bold text-rose-500">{selectedPreset.metrics.maxDrawdown}%</span></div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-rose-400 to-rose-500 rounded-full transition-all duration-500" style={{width:`${Math.abs(selectedPreset.metrics.maxDrawdown)*3}%`}}/></div></div>
              <div><div className="flex justify-between text-sm mb-1.5"><span className="text-gray-500">승률</span><span className="font-bold text-blue-600">{selectedPreset.metrics.winRate}%</span></div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-blue-400 to-blue-500 rounded-full transition-all duration-500" style={{width:`${selectedPreset.metrics.winRate}%`}}/></div></div>
              <div><div className="flex justify-between text-sm mb-1.5"><span className="text-gray-500">샤프 비율</span><span className="font-bold text-violet-600">{selectedPreset.metrics.sharpe}</span></div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-violet-400 to-violet-500 rounded-full transition-all duration-500" style={{width:`${selectedPreset.metrics.sharpe*40}%`}}/></div></div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-bold text-gray-900 mb-3 text-sm">위험도</h3>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1 h-3.5 bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-400 rounded-full relative shadow-inner">
                <div className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white border-2 border-gray-700 rounded-full shadow-lg transition-all duration-500" style={{left:`${Math.abs(selectedPreset.metrics.maxDrawdown)*3}%`}}/>
              </div>
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 font-medium"><span>안전</span><span>보통</span><span>위험</span></div>
          </div>
          <IndicatorPanel/>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/50">
      <Header showNav/>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">전략 라이브러리</h1>
            <p className="text-sm text-gray-500 mt-1">검증된 투자 전략을 학습하고, 내 포트폴리오에 적용해보세요</p>
          </div>
        </div>
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200/50 p-1 inline-flex gap-1 mb-4">
          {(['A','B','C'] as DesignVariant[]).map(v=>(
            <button key={v} onClick={()=>setDesign(v)} className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${design===v?'bg-gradient-to-r from-[#13395e] to-[#1e6091] text-white shadow-lg shadow-[#13395e]/20':'text-gray-500 hover:bg-gray-100'}`}>
              {v==='A'?'카드 라이브러리':v==='B'?'단계별 학습':'전략 워크샵'}
            </button>
          ))}
        </div>
        {design==='A'&&<DesignA/>}{design==='B'&&<DesignB/>}{design==='C'&&<DesignC/>}
      </div>
      <StrategyCreateModal open={showCreate} onClose={()=>setShowCreate(false)} onCreated={s=>setUserStrategies(prev=>[...prev,s])}/>
      <ApplyModal open={!!applyTarget} onClose={()=>setApplyTarget(null)} strategyId={applyTarget||''}/>
    </div>
  );
};

export default StrategyLabPage;
