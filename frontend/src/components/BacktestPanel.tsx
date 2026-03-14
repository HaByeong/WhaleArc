import { useState, useEffect, useRef } from 'react';
import {
  strategyService,
  type Strategy,
  type BacktestResult,
} from '../services/strategyService';
import { tradeService, type StockPrice } from '../services/tradeService';

/* 숫자 포맷 */
const fmtPct  = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
const fmtCur  = (v: number) => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', minimumFractionDigits: 0 }).format(v);

/* ── KPI 카드 ── */
function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-2.5 text-center">
      <div className="text-[10px] text-gray-400 mb-0.5">{label}</div>
      <div className={`text-xs font-bold ${color ?? 'text-gray-800'}`}>{value}</div>
      {sub && <div className="text-[10px] text-gray-400 mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

/* ── 메인 컴포넌트 ── */
export default function BacktestPanel({ onResult }: { onResult?: (result: BacktestResult) => void } = {}) {
  /* 항로 선택 */
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [selectedStrategyId, setSelectedStrategyId] = useState('');

  /* 종목 검색 */
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ code: string; name: string; market: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [stockCode, setStockCode] = useState('');
  const [stockName, setStockName] = useState('');
  const [assetType, setAssetType] = useState('CRYPTO');
  const [cryptoList, setCryptoList] = useState<StockPrice[]>([]);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  /* 기간 & 자본 */
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 6); return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [capital, setCapital] = useState('10000000');

  /* 리스크 관리 & 고급 설정 */
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [stopLossPercent, setStopLossPercent] = useState('');
  const [takeProfitPercent, setTakeProfitPercent] = useState('');
  const [trailingStopPercent, setTrailingStopPercent] = useState('');
  const [slippagePercent, setSlippagePercent] = useState('0.1');
  const [commissionRate, setCommissionRate] = useState('');
  const [tradeDirection, setTradeDirection] = useState<'LONG_ONLY' | 'SHORT_ONLY' | 'LONG_SHORT'>('LONG_ONLY');
  const [maxPositions, setMaxPositions] = useState('1');
  const [positionSizing, setPositionSizing] = useState('ALL_IN');
  const [positionValue, setPositionValue] = useState('');

  /* 실행 & 결과 */
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  /* 초기 데이터 로드 */
  useEffect(() => {
    strategyService.getStrategies().then(setStrategies).catch(() => {});
    tradeService.getStockList().then(setCryptoList).catch(() => {});
  }, []);

  /* 드롭다운 외부 클릭 닫기 */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setShowDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* 종목 검색 */
  const handleSearch = (q: string) => {
    setSearchQuery(q);
    setStockCode(''); setStockName('');
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!q.trim()) { setSearchResults([]); setShowDropdown(false); return; }
    setIsSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const crypto = cryptoList
          .filter(s => s.stockName.includes(q) || s.stockCode.toLowerCase().includes(q.toLowerCase()))
          .slice(0, 8)
          .map(s => ({ code: s.stockCode, name: s.stockName, market: 'CRYPTO' }));
        const krx = await tradeService.searchKrxStocks(q).catch(() => []);
        const mapped = krx.slice(0, 8).map((s: any) => ({ code: s.code || s.stockCode, name: s.name || s.stockName, market: 'STOCK' }));
        setSearchResults([...crypto, ...mapped]);
        setShowDropdown(true);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  const selectStock = (code: string, name: string, market: string) => {
    setStockCode(code); setStockName(name); setAssetType(market);
    setSearchQuery(name); setShowDropdown(false); setSearchResults([]);
  };

  /* 실행 */
  const handleRun = async () => {
    if (!stockCode) { setErrorMsg('종목을 선택해주세요.'); return; }
    if (!selectedStrategyId) { setErrorMsg('항로를 선택해주세요.'); return; }
    setErrorMsg(''); setRunning(true); setResult(null);
    try {
      const req: any = {
        stockCode, stockName: stockName || stockCode,
        startDate, endDate,
        initialCapital: parseInt(capital),
        assetType,
        strategyId: selectedStrategyId,
      };
      // 리스크 관리 파라미터
      if (stopLossPercent) req.stopLossPercent = parseFloat(stopLossPercent);
      if (takeProfitPercent) req.takeProfitPercent = parseFloat(takeProfitPercent);
      if (trailingStopPercent) req.trailingStopPercent = parseFloat(trailingStopPercent);
      if (slippagePercent) req.slippagePercent = parseFloat(slippagePercent);
      if (commissionRate) req.commissionRate = parseFloat(commissionRate);
      if (tradeDirection !== 'LONG_ONLY') req.tradeDirection = tradeDirection;
      if (maxPositions !== '1') req.maxPositions = parseInt(maxPositions);
      if (positionSizing !== 'ALL_IN') {
        req.positionSizing = positionSizing;
        if (positionValue) req.positionValue = parseFloat(positionValue);
      }
      const res = await strategyService.runBacktest(req);
      setResult(res);
      onResult?.(res);
    } catch (e: any) {
      setErrorMsg(e.response?.data?.error || e.response?.data?.message || '백테스트 실행에 실패했습니다.');
    } finally {
      setRunning(false);
    }
  };

  const selectedStrategy = strategies.find(s => s.id === selectedStrategyId);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h2 className="text-base font-bold text-gray-800">항로 백테스트</h2>
      </div>

      <div className="space-y-3">
        {/* 항로 선택 */}
        <div>
          <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">항로 선택</label>
          <select value={selectedStrategyId} onChange={e => setSelectedStrategyId(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-400 focus:border-blue-400 outline-none appearance-none">
            <option value="">항로를 선택하세요</option>
            {strategies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {selectedStrategy && (
            <div className="mt-1 text-[10px] text-gray-400">
              진입 {selectedStrategy.entryConditions?.length ?? 0}개 · 청산 {selectedStrategy.exitConditions?.length ?? 0}개 조건
            </div>
          )}
        </div>

        {/* 종목 검색 */}
        <div ref={dropdownRef} className="relative">
          <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">종목 검색</label>
          <div className="relative">
            <input
              type="text" value={searchQuery} onChange={e => handleSearch(e.target.value)}
              onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
              placeholder="BTC, 삼성전자, AAPL…"
              className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-400 focus:border-blue-400 outline-none pr-8"
            />
            {isSearching && (
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {!isSearching && stockCode && (
              <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          {showDropdown && searchResults.length > 0 && (
            <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
              {searchResults.map(r => (
                <button key={`${r.market}-${r.code}`} type="button" onClick={() => selectStock(r.code, r.name, r.market)}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 text-xs flex items-center justify-between transition-colors first:rounded-t-xl last:rounded-b-xl">
                  <span className="font-medium text-gray-800 truncate">{r.name} <span className="text-gray-400">({r.code})</span></span>
                  <span className={`ml-2 flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${r.market === 'STOCK' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                    {r.market === 'STOCK' ? '주식' : '코인'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 날짜 */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">시작일</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} max={endDate}
              className="w-full px-2 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-400 outline-none" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">종료일</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate} max={new Date().toISOString().slice(0,10)}
              className="w-full px-2 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-400 outline-none" />
          </div>
        </div>

        {/* 초기 자본 */}
        <div>
          <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">초기 투자금 (원)</label>
          <input type="number" value={capital} onChange={e => setCapital(e.target.value)} placeholder="10000000"
            className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-400 outline-none" />
        </div>

        {/* 리스크 관리 & 고급 설정 토글 */}
        <div>
          <button onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 hover:text-gray-600 transition-colors">
            <svg className={`w-3 h-3 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            리스크 관리 & 고급 설정
          </button>
          {showAdvanced && (
            <div className="mt-2 space-y-2.5 p-3 bg-gray-50/80 rounded-xl border border-gray-100">
              {/* 손절 / 익절 */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">손절 (%)</label>
                  <input type="number" value={stopLossPercent} onChange={e => setStopLossPercent(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs" placeholder="5" step="0.5" min="0" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">익절 (%)</label>
                  <input type="number" value={takeProfitPercent} onChange={e => setTakeProfitPercent(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs" placeholder="10" step="0.5" min="0" />
                </div>
              </div>
              {/* 트레일링 / 슬리피지 */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">트레일링 스탑 (%)</label>
                  <input type="number" value={trailingStopPercent} onChange={e => setTrailingStopPercent(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs" placeholder="5" step="0.5" min="0" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">슬리피지 (%)</label>
                  <input type="number" value={slippagePercent} onChange={e => setSlippagePercent(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs" placeholder="0.1" step="0.05" min="0" />
                </div>
              </div>
              {/* 매매 방향 / 최대 포지션 */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">매매 방향</label>
                  <select value={tradeDirection} onChange={e => setTradeDirection(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs appearance-none">
                    <option value="LONG_ONLY">롱 (매수만)</option>
                    <option value="SHORT_ONLY">숏 (공매도)</option>
                    <option value="LONG_SHORT">양방향</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">최대 포지션</label>
                  <select value={maxPositions} onChange={e => setMaxPositions(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs appearance-none">
                    <option value="1">1 (단일)</option>
                    <option value="2">2 (분할)</option>
                    <option value="3">3</option>
                    <option value="5">5</option>
                  </select>
                </div>
              </div>
              {/* 수수료 / 포지션 사이징 */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">수수료율 (%)</label>
                  <input type="number" value={commissionRate} onChange={e => setCommissionRate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs" placeholder="0.1" step="0.01" min="0" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">포지션 사이징</label>
                  <select value={positionSizing} onChange={e => setPositionSizing(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs appearance-none">
                    <option value="ALL_IN">전액 투자</option>
                    <option value="PERCENT">자본 비율</option>
                    <option value="FIXED_AMOUNT">고정 금액</option>
                  </select>
                </div>
              </div>
              {/* 포지션 값 (ALL_IN이 아닐 때) */}
              {positionSizing !== 'ALL_IN' && (
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">
                    {positionSizing === 'PERCENT' ? '투자 비율 (%)' : '투자 금액 (원)'}
                  </label>
                  <input type="number" value={positionValue} onChange={e => setPositionValue(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs"
                    placeholder={positionSizing === 'PERCENT' ? '50' : '5000000'} min="0" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* 에러 */}
        {errorMsg && (
          <div className="text-[11px] text-red-500 bg-red-50 rounded-lg px-3 py-2">{errorMsg}</div>
        )}

        {/* 실행 버튼 */}
        <button onClick={handleRun} disabled={running}
          className="w-full py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
          {running ? (
            <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />분석 중…</>
          ) : (
            <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>백테스트 실행</>
          )}
        </button>

        {/* 실행 완료 표시 */}
        {result && (
          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2 text-xs text-green-600 font-medium">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              실행 완료 — 좌측에서 결과 확인
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
