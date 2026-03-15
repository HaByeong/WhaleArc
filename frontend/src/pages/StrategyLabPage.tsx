import { useState, useEffect, useRef, useCallback } from 'react';
import Header from '../components/Header';
import { strategyService, type Strategy, type BacktestRequest, type BacktestResult, type IndicatorData, type Indicator, type Condition } from '../services/strategyService';
import { tradeService, type StockPrice } from '../services/tradeService';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, ComposedChart, Bar, ReferenceLine } from 'recharts';

// ── 프리셋 전략 (교육용) ──
const PRESETS = [
  { id: 'p-golden', name: '골든크로스 추종', category: '추세추종', difficulty: '초급',
    description: '20일 이동평균선이 60일 이동평균선을 상향 돌파할 때 매수, 데드크로스 시 매도하는 전략입니다.',
    longDescription: '골든크로스는 단기 이동평균선이 장기 이동평균선을 아래에서 위로 관통하는 시점을 의미합니다. 이 신호는 상승 추세의 시작을 알려주는 대표적인 기술적 지표입니다.',
    logic: 'MA(20) > MA(60) → 매수 / MA(20) < MA(60) → 매도', indicators: ['MA(20)', 'MA(60)'],
    assetTypes: ['주식', '가상화폐'], videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    videoTitle: '이동평균선 완벽 가이드', metrics: { returnRate: 18.5, maxDrawdown: -12.3, winRate: 58.2, sharpe: 1.45 },
    tags: ['비트코인(BTC)', '이더리움(ETH)', '리플(XRP)'], isPremium: false },
  { id: 'p-rsi', name: 'RSI 과매도 반전', category: '역추세', difficulty: '초급',
    description: 'RSI가 30 이하로 떨어졌다가 다시 올라올 때 매수, 70 이상에서 매도하는 평균회귀 전략입니다.',
    longDescription: 'RSI(상대강도지수)는 0~100 사이의 값으로, 30 이하는 과매도, 70 이상은 과매수 상태를 나타냅니다.',
    logic: 'RSI(14) < 30 → 매수 / RSI(14) > 70 → 매도', indicators: ['RSI(14)'],
    assetTypes: ['주식', '가상화폐'], videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    videoTitle: 'RSI 지표 100% 활용법', metrics: { returnRate: 15.2, maxDrawdown: -8.1, winRate: 62.5, sharpe: 1.72 },
    tags: ['삼성전자', 'SK하이닉스'], isPremium: false },
  { id: 'p-bb', name: '볼린저밴드 스퀴즈', category: '변동성', difficulty: '중급',
    description: '볼린저밴드가 좁아진 후 상단 돌파 시 매수, 하단 이탈 시 매도하는 변동성 돌파 전략입니다.',
    longDescription: '볼린저밴드 스퀴즈는 밴드 폭이 극도로 좁아지는 현상으로, 큰 가격 변동이 임박했음을 시사합니다.',
    logic: 'Price > Upper Band → 매수 / Price < Lower Band → 매도', indicators: ['Bollinger(20,2)'],
    assetTypes: ['주식', '가상화폐'], videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    videoTitle: '볼린저밴드 스퀴즈 전략', metrics: { returnRate: 22.8, maxDrawdown: -15.6, winRate: 51.3, sharpe: 1.31 },
    tags: ['비트코인(BTC)', '테슬라(TSLA)'], isPremium: false },
  { id: 'p-macd', name: 'MACD 다이버전스', category: '추세추종', difficulty: '중급',
    description: 'MACD 시그널 크로스와 히스토그램 전환을 활용한 추세 전환 포착 전략입니다.',
    longDescription: 'MACD는 두 이동평균선의 차이를 이용한 지표입니다. 시그널 선과의 교차로 매매 시점을 판단합니다.',
    logic: 'MACD > Signal → 매수 / MACD < Signal → 매도', indicators: ['MACD(12,26,9)'],
    assetTypes: ['주식', '가상화폐'], videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    videoTitle: 'MACD 다이버전스 완벽 정리', metrics: { returnRate: 20.1, maxDrawdown: -11.7, winRate: 55.8, sharpe: 1.55 },
    tags: ['카카오', 'LG에너지솔루션'], isPremium: true },
  { id: 'p-rebal', name: '안전 자산 리밸런싱', category: '자산배분', difficulty: '초급',
    description: 'BTC 60% + ETH 30% + 스테이블 10% 비율을 매월 리밸런싱하는 보수적 전략입니다.',
    longDescription: '자산 배분 리밸런싱은 정해진 비율로 자산을 나눠 보유하고, 주기적으로 원래 비율로 맞추는 전략입니다.',
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
  const c: Record<string,string> = { '초급':'bg-green-100 text-green-700','중급':'bg-yellow-100 text-yellow-700','고급':'bg-red-100 text-red-700' };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c[level]||'bg-gray-100 text-gray-600'}`}>{level}</span>;
};

const Metric = ({ label, value, suffix='%' }: { label:string; value:number; suffix?:string }) => (
  <div className="flex items-center justify-between text-sm">
    <span className="text-gray-500">{label}</span>
    <span className={`font-semibold ${value>=0?'text-green-600':'text-red-500'}`}>{value>0?'+':''}{value}{suffix}</span>
  </div>
);

const MetricGrid = ({ m }: { m: Preset['metrics'] }) => (
  <div className="grid grid-cols-4 gap-3">
    {[{l:'기준 수익률',v:m.returnRate,c:'green'},{l:'최대 낙폭',v:m.maxDrawdown,c:'red'},{l:'승률',v:m.winRate,c:'blue'},{l:'샤프 비율',v:m.sharpe,c:'purple',s:''}].map(x=>(
      <div key={x.l} className={`bg-${x.c}-50 rounded-xl p-3 text-center`}>
        <div className="text-xs text-gray-500 mb-1">{x.l}</div>
        <div className={`text-lg font-bold text-${x.c}-600`}>{x.v>0&&x.c==='green'?'+':''}{x.v}{x.s!==undefined?x.s:'%'}</div>
      </div>
    ))}
  </div>
);

const MiniChart = ({ data, height=120 }: { data: typeof CHART_CACHE[''], height?:number }) => (
  <ResponsiveContainer width="100%" height={height}>
    <AreaChart data={data}>
      <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0C4B3E" stopOpacity={0.3}/><stop offset="100%" stopColor="#0C4B3E" stopOpacity={0}/></linearGradient></defs>
      <XAxis dataKey="date" tick={{fontSize:10,fill:'#9ca3af'}} tickLine={false} axisLine={false} interval={Math.floor(data.length/5)}/>
      <YAxis hide domain={['dataMin','dataMax']}/><Tooltip contentStyle={{background:'#1f2937',border:'none',borderRadius:8,fontSize:12,color:'#fff'}} formatter={(v:number)=>[`₩${v.toLocaleString()}`,'가격']}/>
      <Area type="monotone" dataKey="price" stroke="#0C4B3E" fill="url(#cg)" strokeWidth={2} dot={false}/>
    </AreaChart>
  </ResponsiveContainer>
);

const DetailChart = ({ data }: { data: typeof CHART_CACHE[''] }) => (
  <ResponsiveContainer width="100%" height={300}>
    <LineChart data={data}>
      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
      <XAxis dataKey="date" tick={{fontSize:11,fill:'#9ca3af'}} tickLine={false} interval={Math.floor(data.length/6)}/>
      <YAxis tick={{fontSize:11,fill:'#9ca3af'}} tickLine={false} axisLine={false} domain={['dataMin','dataMax']} tickFormatter={v=>`${(v/10000).toFixed(0)}만`}/>
      <Tooltip contentStyle={{background:'#1f2937',border:'none',borderRadius:8,fontSize:12,color:'#fff'}} formatter={(v:number)=>[`₩${v.toLocaleString()}`,'']}/>
      <Line type="monotone" dataKey="price" stroke="#0C4B3E" strokeWidth={2} dot={false} name="가격"/>
      <Line type="monotone" dataKey="ma20" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="MA(20)" strokeDasharray="4 2"/>
      <Line type="monotone" dataKey="ma60" stroke="#ef4444" strokeWidth={1.5} dot={false} name="MA(60)" strokeDasharray="4 2"/>
    </LineChart>
  </ResponsiveContainer>
);

// ── StrategyCardMini ──
const StrategyCardMini = ({ s, selected, onSelect }: { s:Preset; selected:boolean; onSelect:()=>void }) => (
  <div onClick={onSelect} className={`bg-white rounded-2xl shadow-sm border p-4 cursor-pointer transition-all hover:shadow-md ${selected?'border-[#0C4B3E] ring-1 ring-[#0C4B3E]/20':'border-gray-100'}`}>
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-1.5">
        <span className="text-xs px-2 py-0.5 rounded-full bg-[#0C4B3E]/10 text-[#0C4B3E] font-medium">{s.category}</span>
        <Badge level={s.difficulty}/>
      </div>
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.isPremium?'bg-amber-100 text-amber-700':'bg-green-100 text-green-700'}`}>{s.isPremium?'프리미엄':'무료'}</span>
    </div>
    <h4 className="font-semibold text-gray-900 mb-1">{s.name}</h4>
    <p className="text-xs text-gray-500 mb-3 line-clamp-2">{s.description}</p>
    <MiniChart data={CHART_CACHE[s.id]||[]} height={80}/>
    <div className="grid grid-cols-2 gap-2 mt-3">
      <Metric label="수익률" value={s.metrics.returnRate}/><Metric label="최대 낙폭" value={s.metrics.maxDrawdown}/>
      <Metric label="승률" value={s.metrics.winRate}/><Metric label="샤프" value={s.metrics.sharpe} suffix=""/>
    </div>
    <div className="flex flex-wrap gap-1 mt-3">{s.tags.slice(0,3).map(t=><span key={t} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">{t}</span>)}</div>
  </div>
);

// ── StrategyDetail ──
const StrategyDetail = ({ s, showVideo, setShowVideo }: { s:Preset; showVideo:boolean; setShowVideo:(v:boolean)=>void }) => (
  <>
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#0C4B3E]/10 text-[#0C4B3E] font-medium">{s.category}</span>
            <Badge level={s.difficulty}/>{s.isPremium&&<span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">프리미엄</span>}
          </div>
          <h2 className="text-2xl font-bold text-gray-900">{s.name}</h2>
          <p className="text-gray-500 mt-1 text-sm">{s.description}</p>
        </div>
        <button className="bg-[#0C4B3E] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0a3d33]">{s.isPremium?'구매하기':'무료 사용'}</button>
      </div>
      <div className="bg-gray-50 rounded-xl p-4 mb-4">
        <div className="text-xs text-gray-500 mb-1 font-medium">매매 로직</div>
        <code className="text-sm text-[#0C4B3E] font-mono">{s.logic}</code>
      </div>
      <MetricGrid m={s.metrics}/>
    </div>
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
      <h3 className="font-semibold text-gray-900 mb-4">전략 시뮬레이션 차트</h3>
      <DetailChart data={CHART_CACHE[s.id]||[]}/>
    </div>
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h3 className="font-semibold text-gray-900 mb-3">이 전략 이해하기</h3>
      <p className="text-gray-600 text-sm leading-relaxed mb-4">{s.longDescription}</p>
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center"><svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20"><polygon points="8,5 15,10 8,15"/></svg></div>
            <div><div className="text-sm font-medium text-gray-900">{s.videoTitle}</div><div className="text-xs text-gray-400">참고 영상</div></div>
          </div>
          <button onClick={()=>setShowVideo(!showVideo)} className="text-[#0C4B3E] text-sm font-medium hover:underline">{showVideo?'접기':'영상 보기'}</button>
        </div>
        {showVideo&&<div className="aspect-video rounded-lg overflow-hidden bg-black"><iframe src={s.videoUrl} className="w-full h-full" allow="autoplay; encrypted-media" allowFullScreen title="video"/></div>}
      </div>
      {s.indicators.length>0&&<div className="mt-4"><div className="text-sm font-medium text-gray-700 mb-2">사용된 기술 지표</div><div className="flex gap-2">{s.indicators.map(i=><span key={i} className="px-3 py-1 bg-[#0C4B3E]/10 text-[#0C4B3E] rounded-full text-sm font-medium">{i}</span>)}</div></div>}
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

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h3 className="font-semibold text-gray-900 mb-4">백테스팅</h3>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">전략 선택</label>
          <select value={selectedStrategyId} onChange={e=>setSelectedStrategyId(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="">전략을 선택하세요</option>
            {strategies.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="relative">
          <label className="text-xs text-gray-500 mb-1 block">종목 검색</label>
          <input value={stockSearch} onChange={e=>handleSearch(e.target.value)} placeholder="종목명 검색" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"/>
          {selectedStock&&<div className="text-xs text-[#0C4B3E] mt-1">{selectedStock.name} ({selectedStock.code})</div>}
          {stockResults.length>0&&<div className="absolute z-10 top-full left-0 right-0 bg-white border rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
            {stockResults.map(r=><div key={r.code} onClick={()=>{setSelectedStock(r);setStockSearch(r.name);setStockResults([]);}} className="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer">{r.name} <span className="text-gray-400">{r.code}</span></div>)}
          </div>}
        </div>
        <div><label className="text-xs text-gray-500 mb-1 block">시작일</label><input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"/></div>
        <div><label className="text-xs text-gray-500 mb-1 block">종료일</label><input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"/></div>
        <div><label className="text-xs text-gray-500 mb-1 block">초기 자본</label><input type="number" value={capital} onChange={e=>setCapital(Number(e.target.value))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"/></div>
        <div className="flex items-end"><button onClick={runBacktest} disabled={loading||!selectedStock||!selectedStrategyId} className="w-full bg-[#0C4B3E] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#0a3d33] disabled:opacity-40">{loading?'실행 중...':'백테스트 실행'}</button></div>
      </div>
      {result&&<div className="border-t border-gray-100 pt-4 mt-2">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">결과: {result.stockName}</h4>
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[{l:'총 수익률',v:`${result.totalReturnRate>0?'+':''}${result.totalReturnRate.toFixed(1)}%`,c:result.totalReturnRate>=0?'text-green-600':'text-red-500'},
            {l:'최대 낙폭',v:`${result.maxDrawdown.toFixed(1)}%`,c:'text-red-500'},{l:'승률',v:`${result.winRate.toFixed(1)}%`,c:'text-blue-600'},
            {l:'총 거래',v:`${result.totalTrades}회`,c:'text-gray-900'}].map(x=>(
            <div key={x.l} className="bg-gray-50 rounded-lg p-2 text-center"><div className="text-[10px] text-gray-400">{x.l}</div><div className={`text-sm font-bold ${x.c}`}>{x.v}</div></div>
          ))}
        </div>
        {result.equityCurve&&result.equityCurve.length>0&&<ResponsiveContainer width="100%" height={200}>
          <AreaChart data={result.equityCurve}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
            <XAxis dataKey="date" tick={{fontSize:10}} tickLine={false} interval={Math.floor(result.equityCurve.length/5)}/>
            <YAxis tick={{fontSize:10}} tickLine={false} axisLine={false} tickFormatter={v=>`${(v/10000).toFixed(0)}만`}/>
            <Tooltip contentStyle={{background:'#1f2937',border:'none',borderRadius:8,fontSize:12,color:'#fff'}}/>
            <Area type="monotone" dataKey="value" stroke="#0C4B3E" fill="url(#cg)" strokeWidth={2} dot={false}/>
          </AreaChart>
        </ResponsiveContainer>}
      </div>}
    </div>
  );
};

// ── IndicatorPanel ──
const IndicatorPanel = () => {
  const INDICATORS = ['RSI','MACD','MA','EMA','BOLLINGER_BANDS','STOCHASTIC','ATR'];
  const [selected, setSelected] = useState('RSI');
  const [stockCode, setStockCode] = useState('BTC_KRW');
  const [data, setData] = useState<IndicatorData[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const r = await strategyService.getIndicatorData(stockCode, selected, 'CRYPTO'); setData(r.slice(-60)); } catch {} finally { setLoading(false); }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 overflow-hidden">
      <h3 className="font-semibold text-gray-900 mb-3 text-sm">지표 분석</h3>
      <div className="flex gap-1.5 mb-3 flex-wrap">
        {INDICATORS.map(i=><button key={i} onClick={()=>setSelected(i)} className={`px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${selected===i?'bg-[#0C4B3E] text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{i.replace('_BANDS','')}</button>)}
      </div>
      <div className="mb-4">
        <input value={stockCode} onChange={e=>setStockCode(e.target.value)} placeholder="종목코드 (예: BTC_KRW)" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2"/>
        <button onClick={load} disabled={loading} className="w-full bg-[#0C4B3E] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#0a3d33] disabled:opacity-40">{loading?'로딩...':'조회'}</button>
      </div>
      {data.length>0&&<ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
          <XAxis dataKey="date" tick={{fontSize:10}} tickLine={false} interval={Math.floor(data.length/5)}/>
          <YAxis yAxisId="price" orientation="right" tick={{fontSize:10}} tickLine={false} axisLine={false}/>
          <YAxis yAxisId="ind" orientation="left" tick={{fontSize:10}} tickLine={false} axisLine={false}/>
          <Tooltip contentStyle={{background:'#1f2937',border:'none',borderRadius:8,fontSize:11,color:'#fff'}}/>
          <Line yAxisId="price" type="monotone" dataKey="price" stroke="#94a3b8" strokeWidth={1} dot={false} name="가격"/>
          <Line yAxisId="ind" type="monotone" dataKey="value" stroke="#0C4B3E" strokeWidth={2} dot={false} name={selected}/>
          {data[0]?.value2!==undefined&&<Line yAxisId="ind" type="monotone" dataKey="value2" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="Signal"/>}
          {selected==='RSI'&&<><ReferenceLine yAxisId="ind" y={70} stroke="#ef4444" strokeDasharray="3 3"/><ReferenceLine yAxisId="ind" y={30} stroke="#22c55e" strokeDasharray="3 3"/></>}
        </ComposedChart>
      </ResponsiveContainer>}
    </div>
  );
};

// ── StrategyCreateModal (4-step wizard) ──
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

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">전략 생성</h3><button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div className="flex gap-2 mb-6">{STEPS.map((s,i)=><div key={i} className={`flex-1 h-1.5 rounded-full ${i<=step?'bg-[#0C4B3E]':'bg-gray-200'}`}/>)}</div>
        <div className="text-sm font-medium text-gray-500 mb-4">{step+1}단계: {STEPS[step]}</div>
        {step===0&&<div className="space-y-3">
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="전략 이름" className="w-full border rounded-lg px-3 py-2 text-sm"/>
          <textarea value={desc} onChange={e=>setDesc(e.target.value)} placeholder="전략 설명" className="w-full border rounded-lg px-3 py-2 text-sm" rows={3}/>
          <select value={assetType} onChange={e=>setAssetType(e.target.value as any)} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="CRYPTO">가상화폐</option><option value="STOCK">주식</option>
          </select>
        </div>}
        {step===1&&<div className="space-y-3">
          {indicators.map((ind,i)=><div key={i} className="flex gap-2">
            <select value={ind.type} onChange={e=>{const n=[...indicators];n[i]={...n[i],type:e.target.value as any};setIndicators(n);}} className="flex-1 border rounded-lg px-3 py-2 text-sm">
              {['RSI','MACD','MA','EMA','BOLLINGER_BANDS','STOCHASTIC','ATR'].map(t=><option key={t} value={t}>{t}</option>)}
            </select>
            <button onClick={()=>setIndicators(indicators.filter((_,j)=>j!==i))} className="text-red-400 hover:text-red-600 px-2">&times;</button>
          </div>)}
          <button onClick={()=>setIndicators([...indicators,{type:'MA',parameters:{period:20}}])} className="text-[#0C4B3E] text-sm font-medium">+ 지표 추가</button>
        </div>}
        {step===2&&<div className="space-y-4">
          <div><div className="text-xs font-medium text-gray-700 mb-2">매수 조건</div>
            {entry.map((c,i)=><div key={i} className="flex gap-2 mb-2">
              <input value={c.indicator} onChange={e=>{const n=[...entry];n[i]={...n[i],indicator:e.target.value};setEntry(n);}} className="flex-1 border rounded-lg px-2 py-1 text-sm" placeholder="지표"/>
              <select value={c.operator} onChange={e=>{const n=[...entry];n[i]={...n[i],operator:e.target.value as any};setEntry(n);}} className="border rounded-lg px-2 py-1 text-sm">
                {['GT','LT','GTE','LTE','EQ'].map(o=><option key={o} value={o}>{o}</option>)}
              </select>
              <input type="number" value={c.value} onChange={e=>{const n=[...entry];n[i]={...n[i],value:Number(e.target.value)};setEntry(n);}} className="w-20 border rounded-lg px-2 py-1 text-sm"/>
            </div>)}
          </div>
          <div><div className="text-xs font-medium text-gray-700 mb-2">매도 조건</div>
            {exit.map((c,i)=><div key={i} className="flex gap-2 mb-2">
              <input value={c.indicator} onChange={e=>{const n=[...exit];n[i]={...n[i],indicator:e.target.value};setExit(n);}} className="flex-1 border rounded-lg px-2 py-1 text-sm" placeholder="지표"/>
              <select value={c.operator} onChange={e=>{const n=[...exit];n[i]={...n[i],operator:e.target.value as any};setExit(n);}} className="border rounded-lg px-2 py-1 text-sm">
                {['GT','LT','GTE','LTE','EQ'].map(o=><option key={o} value={o}>{o}</option>)}
              </select>
              <input type="number" value={c.value} onChange={e=>{const n=[...exit];n[i]={...n[i],value:Number(e.target.value)};setExit(n);}} className="w-20 border rounded-lg px-2 py-1 text-sm"/>
            </div>)}
          </div>
        </div>}
        {step===3&&<div className="bg-gray-50 rounded-xl p-4 text-sm space-y-2">
          <div><span className="text-gray-500">이름:</span> {name}</div>
          <div><span className="text-gray-500">자산:</span> {assetType}</div>
          <div><span className="text-gray-500">지표:</span> {indicators.map(i=>i.type).join(', ')}</div>
          <div><span className="text-gray-500">매수:</span> {entry.map(c=>`${c.indicator} ${c.operator} ${c.value}`).join(', ')}</div>
          <div><span className="text-gray-500">매도:</span> {exit.map(c=>`${c.indicator} ${c.operator} ${c.value}`).join(', ')}</div>
        </div>}
        <div className="flex justify-between mt-6">
          <button onClick={()=>setStep(Math.max(0,step-1))} disabled={step===0} className="px-4 py-2 text-sm text-gray-500 disabled:opacity-30">이전</button>
          {step<3?<button onClick={()=>setStep(step+1)} className="px-4 py-2 text-sm bg-[#0C4B3E] text-white rounded-lg">다음</button>
            :<button onClick={create} disabled={loading||!name} className="px-4 py-2 text-sm bg-[#0C4B3E] text-white rounded-lg disabled:opacity-40">{loading?'생성 중...':'전략 생성'}</button>}
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
  const apply = async () => {
    setLoading(true);
    try { await strategyService.applyStrategy(strategyId, amount); onClose(); } catch {} finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={e=>e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-4">전략 적용</h3>
        <label className="text-xs text-gray-500 mb-1 block">투자 금액 (원)</label>
        <input type="number" value={amount} onChange={e=>setAmount(Number(e.target.value))} className="w-full border rounded-lg px-3 py-2 text-sm mb-4"/>
        <div className="flex gap-2"><button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm bg-gray-100 text-gray-700">취소</button>
          <button onClick={apply} disabled={loading} className="flex-1 py-2 rounded-lg text-sm bg-[#0C4B3E] text-white disabled:opacity-40">{loading?'적용 중...':'적용하기'}</button></div>
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

  const deleteStrategy = async (id: string) => {
    try { await strategyService.deleteStrategy(id); setUserStrategies(prev=>prev.filter(s=>s.id!==id)); } catch {}
  };

  const selectPreset = (s: Preset) => { setSelectedPreset(s); setShowVideo(false); };

  // ── User Strategies List (shared) ──
  const UserStrategiesList = () => userStrategies.length>0 ? (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
      <h4 className="text-sm font-semibold text-gray-900 mb-3">내 전략</h4>
      <div className="space-y-2">{userStrategies.map(s=>(
        <div key={s.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
          <div><div className="text-sm font-medium">{s.name}</div><div className="text-xs text-gray-400">{s.assetType} · {s.indicators.map(i=>i.type).join(', ')}</div></div>
          <div className="flex gap-1">
            <button onClick={()=>setApplyTarget(s.id)} className="text-xs px-2 py-1 bg-[#0C4B3E] text-white rounded">{s.applied?'적용됨':'적용'}</button>
            <button onClick={()=>deleteStrategy(s.id)} className="text-xs px-2 py-1 bg-red-50 text-red-500 rounded">삭제</button>
          </div>
        </div>
      ))}</div>
    </div>
  ) : null;

  // ━━ Design A: 카드 라이브러리 ━━
  const DesignA = () => (
    <div className="flex gap-6 mt-6">
      <div className="flex-[6] min-w-0">
        <StrategyDetail s={selectedPreset} showVideo={showVideo} setShowVideo={setShowVideo}/>
        <div className="mt-4"><BacktestPanel strategies={userStrategies}/></div>
        <div className="mt-4"><IndicatorPanel/></div>
      </div>
      <div className="w-80 flex-shrink-0">
        <button onClick={()=>setShowCreate(true)} className="w-full mb-3 py-2 rounded-xl text-sm font-medium border-2 border-dashed border-[#0C4B3E]/30 text-[#0C4B3E] hover:bg-[#0C4B3E]/5">+ 새 전략 만들기</button>
        <UserStrategiesList/>
        <div className="flex gap-1.5 mb-3 flex-wrap">
          {categories.map(c=><button key={c} onClick={()=>setFilterCat(c)} className={`px-3 py-1 rounded-full text-xs font-medium ${filterCat===c?'bg-[#0C4B3E] text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{c}</button>)}
        </div>
        <div className="space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
          {filtered.map(s=><StrategyCardMini key={s.id} s={s} selected={selectedPreset.id===s.id} onSelect={()=>selectPreset(s)}/>)}
        </div>
      </div>
    </div>
  );

  // ━━ Design B: 단계별 학습 ━━
  const STEPS = [
    { title:'개념 이해', icon:'📖' }, { title:'지표 학습', icon:'📊' },
    { title:'시뮬레이션', icon:'📈' }, { title:'적용', icon:'🚀' },
  ];

  const DesignB = () => (
    <div className="mt-6 grid grid-cols-12 gap-6">
      <div className="col-span-8">
        <div className="bg-gradient-to-r from-[#0C4B3E] to-[#1a7a66] rounded-2xl p-6 text-white mb-4">
          <div className="flex items-center gap-2 mb-1"><Badge level={selectedPreset.difficulty}/><span className="text-white/70 text-xs">{selectedPreset.category}</span></div>
          <h2 className="text-2xl font-bold mb-2">{selectedPreset.name}</h2>
          <p className="text-white/80 text-sm">{selectedPreset.description}</p>
          <code className="inline-block mt-3 px-3 py-1.5 bg-white/10 rounded-lg text-sm font-mono text-white/90">{selectedPreset.logic}</code>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
          <div className="flex items-center justify-between mb-6">
            {STEPS.map((st,i)=>(
              <div key={i} className="flex items-center">
                <button onClick={()=>setLearningStep(i)} className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${learningStep===i?'bg-[#0C4B3E] text-white shadow-lg':learningStep>i?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>
                  <span>{st.icon}</span><span className="hidden md:inline">{st.title}</span>
                </button>
                {i<STEPS.length-1&&<div className={`w-8 h-0.5 mx-1 ${learningStep>i?'bg-green-400':'bg-gray-200'}`}/>}
              </div>
            ))}
          </div>
          {learningStep===0&&<div>
            <h3 className="text-lg font-bold text-gray-900 mb-3">전략 개념 이해하기</h3>
            <p className="text-gray-600 leading-relaxed mb-4">{selectedPreset.longDescription}</p>
            <div className="bg-gray-50 rounded-xl p-4"><div className="aspect-video rounded-lg overflow-hidden bg-black"><iframe src={selectedPreset.videoUrl} className="w-full h-full" allow="autoplay; encrypted-media" allowFullScreen title="video"/></div></div>
          </div>}
          {learningStep===1&&<div>
            <h3 className="text-lg font-bold text-gray-900 mb-3">사용되는 기술적 지표</h3>
            {selectedPreset.indicators.length>0?selectedPreset.indicators.map(ind=>(
              <div key={ind} className="bg-gray-50 rounded-xl p-4 mb-3">
                <div className="flex items-center gap-2 mb-2"><span className="w-8 h-8 bg-[#0C4B3E] rounded-lg flex items-center justify-center text-white text-sm font-bold">{ind.charAt(0)}</span><div className="font-semibold text-gray-900">{ind}</div></div>
                <p className="text-sm text-gray-600">{ind.includes('MA')&&'이동평균선은 일정 기간 동안의 평균 가격을 연결한 선으로, 추세를 파악하는 데 사용됩니다.'}{ind.includes('RSI')&&'RSI는 가격 변동의 강도를 0~100 사이로 표현합니다.'}{ind.includes('Bollinger')&&'볼린저밴드는 이동평균선 중심으로 표준편차 밴드를 그립니다.'}{ind.includes('MACD')&&'MACD는 12일 EMA와 26일 EMA의 차이를 이용한 지표입니다.'}</p>
              </div>
            )):<div className="bg-gray-50 rounded-xl p-4"><p className="text-sm text-gray-600">이 전략은 자산배분 방식을 사용합니다.</p></div>}
            <div className="mt-4"><IndicatorPanel/></div>
          </div>}
          {learningStep===2&&<div>
            <h3 className="text-lg font-bold text-gray-900 mb-3">과거 성과 시뮬레이션</h3>
            <DetailChart data={CHART_CACHE[selectedPreset.id]||[]}/><MetricGrid m={selectedPreset.metrics}/>
            <div className="mt-4"><BacktestPanel strategies={userStrategies}/></div>
          </div>}
          {learningStep===3&&<div className="text-center py-8">
            <div className="text-5xl mb-4">🎉</div><h3 className="text-xl font-bold text-gray-900 mb-2">전략 학습 완료!</h3>
            <p className="text-gray-500 mb-6">이제 이 전략을 내 포트폴리오에 적용해보세요.</p>
            <div className="flex items-center justify-center gap-3">
              <button onClick={()=>setShowCreate(true)} className="bg-[#0C4B3E] text-white px-6 py-3 rounded-xl font-medium hover:bg-[#0a3d33]">새 전략 만들기</button>
            </div>
          </div>}
          <div className="flex justify-between mt-6 pt-4 border-t border-gray-100">
            <button onClick={()=>setLearningStep(Math.max(0,learningStep-1))} disabled={learningStep===0} className="px-4 py-2 text-sm text-gray-500 disabled:opacity-30">← 이전</button>
            <button onClick={()=>setLearningStep(Math.min(3,learningStep+1))} disabled={learningStep===3} className="px-4 py-2 text-sm bg-[#0C4B3E] text-white rounded-lg disabled:opacity-30">다음 →</button>
          </div>
        </div>
      </div>
      <div className="col-span-4">
        <div className="sticky top-4">
          <button onClick={()=>setShowCreate(true)} className="w-full mb-3 py-2 rounded-xl text-sm font-medium border-2 border-dashed border-[#0C4B3E]/30 text-[#0C4B3E] hover:bg-[#0C4B3E]/5">+ 새 전략 만들기</button>
          <UserStrategiesList/>
          <h3 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">프리셋 전략</h3>
          <div className="space-y-2 max-h-[calc(100vh-260px)] overflow-y-auto pr-1">
            {PRESETS.map(s=>(
              <div key={s.id} onClick={()=>{selectPreset(s);setLearningStep(0);}} className={`bg-white rounded-xl border p-3 cursor-pointer hover:shadow-sm ${selectedPreset.id===s.id?'border-[#0C4B3E] bg-[#0C4B3E]/5':'border-gray-100'}`}>
                <div className="flex items-center justify-between mb-1"><span className="font-semibold text-sm">{s.name}</span><Badge level={s.difficulty}/></div>
                <p className="text-xs text-gray-400 line-clamp-1 mb-2">{s.description}</p>
                <MiniChart data={CHART_CACHE[s.id]||[]} height={50}/>
                <div className="flex items-center justify-between mt-2 text-xs"><span className="text-green-600 font-medium">+{s.metrics.returnRate}%</span><span className="text-gray-400">승률 {s.metrics.winRate}%</span></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // ━━ Design C: 전략 워크샵 ━━
  const DesignC = () => (
    <div className="mt-6">
      <div className="flex gap-3 overflow-x-auto pb-3 mb-6 scrollbar-thin">
        {PRESETS.map(s=>(
          <div key={s.id} onClick={()=>selectPreset(s)} className={`flex-shrink-0 w-56 rounded-2xl border p-4 cursor-pointer transition-all hover:shadow-md ${selectedPreset.id===s.id?'border-[#0C4B3E] bg-[#0C4B3E] text-white shadow-lg':'bg-white border-gray-100'}`}>
            <div className="flex items-center justify-between mb-2"><Badge level={s.difficulty}/>{!s.isPremium&&<span className={`text-[10px] px-1.5 py-0.5 rounded-full ${selectedPreset.id===s.id?'bg-white/20 text-white':'bg-green-100 text-green-700'}`}>무료</span>}</div>
            <h4 className={`font-bold text-sm mb-1 ${selectedPreset.id===s.id?'text-white':'text-gray-900'}`}>{s.name}</h4>
            <p className={`text-xs mb-2 line-clamp-1 ${selectedPreset.id===s.id?'text-white/70':'text-gray-400'}`}>{s.category}</p>
            <div className="flex items-center justify-between text-xs">
              <span className={selectedPreset.id===s.id?'text-green-300':'text-green-600'}>+{s.metrics.returnRate}%</span>
              <span className={selectedPreset.id===s.id?'text-white/60':'text-gray-400'}>승률 {s.metrics.winRate}%</span>
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-12 gap-4">
        {/* Left: description + video */}
        <div className="col-span-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4">
            <div className="flex items-center gap-2 mb-3"><span className="text-xs px-2 py-0.5 rounded-full bg-[#0C4B3E]/10 text-[#0C4B3E] font-medium">{selectedPreset.category}</span><Badge level={selectedPreset.difficulty}/></div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">{selectedPreset.name}</h2>
            <p className="text-sm text-gray-500 leading-relaxed mb-4">{selectedPreset.longDescription}</p>
            <div className="bg-gray-50 rounded-xl p-3 mb-4"><div className="text-xs text-gray-400 mb-1">매매 로직</div><code className="text-sm text-[#0C4B3E] font-mono">{selectedPreset.logic}</code></div>
            <div className="flex flex-wrap gap-1.5 mb-4">{selectedPreset.indicators.map(i=><span key={i} className="px-2 py-1 bg-[#0C4B3E]/10 text-[#0C4B3E] rounded-lg text-xs font-medium">{i}</span>)}</div>
            <button onClick={()=>setShowCreate(true)} className="w-full bg-[#0C4B3E] text-white py-2.5 rounded-xl text-sm font-medium hover:bg-[#0a3d33]">내 전략 만들기</button>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-3 text-sm">참고 영상</h3>
            <div className="aspect-video rounded-lg overflow-hidden bg-black mb-3"><iframe src={selectedPreset.videoUrl} className="w-full h-full" allow="autoplay; encrypted-media" allowFullScreen title="video"/></div>
            <p className="text-xs text-gray-500">{selectedPreset.videoTitle}</p>
          </div>
          <div className="mt-4"><UserStrategiesList/></div>
        </div>
        {/* Center: chart + backtest */}
        <div className="col-span-5">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4">
            <div className="flex items-center justify-between mb-4"><h3 className="font-semibold text-gray-900">전략 시뮬레이션</h3></div>
            <DetailChart data={CHART_CACHE[selectedPreset.id]||[]}/>
            <div className="mt-4 pt-4 border-t border-gray-100"><div className="text-xs text-gray-400 mb-2">대상 자산</div><div className="flex flex-wrap gap-1.5">{selectedPreset.tags.map(t=><span key={t} className="px-2 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs">{t}</span>)}</div></div>
          </div>
          <BacktestPanel strategies={userStrategies}/>
        </div>
        {/* Right: metrics + indicators */}
        <div className="col-span-3">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4">
            <h3 className="font-semibold text-gray-900 mb-4 text-sm">성과 지표</h3>
            <div className="space-y-4">
              {[{l:'기준 수익률',v:selectedPreset.metrics.returnRate,c:'green'},{l:'최대 낙폭',v:selectedPreset.metrics.maxDrawdown,c:'red'},{l:'승률',v:selectedPreset.metrics.winRate,c:'blue'},{l:'샤프 비율',v:selectedPreset.metrics.sharpe,c:'purple'}].map(x=>(
                <div key={x.l}><div className="flex justify-between text-sm mb-1"><span className="text-gray-500">{x.l}</span><span className={`font-bold text-${x.c}-600`}>{x.v>0&&x.c==='green'?'+':''}{x.v}{x.c==='purple'?'':'%'}</span></div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full bg-${x.c}-500 rounded-full`} style={{width:`${Math.min(100,Math.abs(x.v)*3)}%`}}/></div></div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4">
            <h3 className="font-semibold text-gray-900 mb-3 text-sm">위험도 분석</h3>
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 h-3 bg-gradient-to-r from-green-400 via-yellow-400 to-red-400 rounded-full relative">
                <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-gray-800 rounded-full shadow" style={{left:`${Math.abs(selectedPreset.metrics.maxDrawdown)*3}%`}}/>
              </div>
            </div>
            <div className="flex justify-between text-[10px] text-gray-400"><span>낮음</span><span>보통</span><span>높음</span></div>
          </div>
          <IndicatorPanel/>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Header showNav/>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-2">
          <div><h1 className="text-2xl font-bold text-gray-900">전략 라이브러리</h1><p className="text-sm text-gray-500 mt-1">검증된 투자 전략을 학습하고, 내 포트폴리오에 적용해보세요</p></div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-1 inline-flex gap-1 mb-4">
          {(['A','B','C'] as DesignVariant[]).map(v=>(
            <button key={v} onClick={()=>setDesign(v)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${design===v?'bg-[#0C4B3E] text-white':'text-gray-500 hover:bg-gray-100'}`}>
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
