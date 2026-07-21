import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { marketService, type MarketPrice, type AssetType } from '../services/marketService';
import { useRealtimePrice } from './useRealtimePrice';
import { ASSET_CLASSES } from '../lib/marketUi';

/* ────────────────────────────────────────────────────────────
   useMarketFeed — 시세 상태 머신 단일 소스.
   기존 ConsoleMarketsPage / ConsoleTradePage 양쪽에 문자 단위로 복제돼 있던
   시세 로드+10초 폴링+stale-while-revalidate 캐시+3회 실패 승격+탭별 선택 기억
   +크립토 실시간 병합+검색 디바운스+딥링크 주입을 하나로 통합.
   ※ 거래 페이지의 성숙한 로직을 정본으로 채택(selClassRef 캐시 오염 가드,
     딥링크 목록-커밋 대기 조건) — 시세 페이지에 잠재했던 캐시 오염 버그도 함께 해소.
   ──────────────────────────────────────────────────────────── */

const RECENT_KEY = 'whalearc_recent_stocks';
export type RecentStock = { stockCode: string; stockName: string; assetType: string };
export type SearchResult = { code: string; name: string; market: string };

const klassOfType = (type?: string | null) => ASSET_CLASSES.find(c => c.type === type)?.key ?? 'stock';
const typeOfKlass = (klass: string): AssetType => (ASSET_CLASSES.find(c => c.key === klass) ?? ASSET_CLASSES[0]).type;
const priceFetcher = (type: AssetType) =>
  type === 'US_STOCK' ? marketService.getUsStockPrice
    : type === 'ETF' ? marketService.getEtfPrice
      : marketService.getStockPrice;
const searchFetcher = (type: AssetType) =>
  type === 'US_STOCK' ? marketService.searchUsStocks
    : type === 'ETF' ? marketService.searchEtfs
      : marketService.searchStocks;

export function useMarketFeed() {
  // klass 초기값: URL ?type=(딥링크) → 없으면 주식
  const [klass, setKlass] = useState(() => klassOfType(new URLSearchParams(window.location.search).get('type')));
  const assetType = typeOfKlass(klass);
  const canSearch = assetType !== 'CRYPTO';

  const [assetList, setAssetList] = useState<MarketPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSym, setActiveSym] = useState('');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [recent, setRecent] = useState<RecentStock[]>([]);

  const extraRef = useRef<MarketPrice[]>([]);          // 검색으로 주입한 종목(서버 목록에 없을 수 있음)
  const assetCacheRef = useRef<Record<AssetType, MarketPrice[]>>({ STOCK: [], CRYPTO: [], US_STOCK: [], ETF: [] });
  const selectionCacheRef = useRef<Record<AssetType, string>>({ STOCK: '', CRYPTO: '', US_STOCK: '', ETF: '' });
  const failRef = useRef(0);
  const deepLinkRef = useRef<{ code: string; type: AssetType } | null>(null);
  const selClassRef = useRef<AssetType>(assetType);    // activeSym이 속한 자산클래스 추적(탭 전환 캐시 오염 방지)
  const klassRef = useRef(klass);
  useEffect(() => { klassRef.current = klass; }, [klass]);

  // 초기 딥링크 ?code= — 첫 로드 시 해당 종목 자동 선택(로드 완료 후 resolution 이펙트가 소비)
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const code = sp.get('code'); const type = sp.get('type');
    if (!code) return;
    const cls = ASSET_CLASSES.find(c => c.type === type) ?? ASSET_CLASSES[0];
    deepLinkRef.current = { code, type: cls.type };
    selectionCacheRef.current[cls.type] = code;
  }, []);

  // 실시간(크립토)
  const { prices: realtimePrices, connected: wsConnected } = useRealtimePrice({ enabled: assetType === 'CRYPTO' });

  // 시세 로드 + 폴링 (stale-while-revalidate 캐시 + 탭별 선택 복원 + 3회 연속 실패 승격)
  useEffect(() => {
    let alive = true;
    extraRef.current = [];
    failRef.current = 0;
    const cached = assetCacheRef.current[assetType];
    if (cached.length > 0) { setAssetList(cached); setActiveSym(selectionCacheRef.current[assetType] || cached[0].symbol); }
    else { setAssetList([]); setActiveSym(''); setLoading(true); }
    const fetchPrices = async (isPoll: boolean) => {
      try {
        const prices = await marketService.getPrices(assetType);
        if (!alive) return;
        assetCacheRef.current[assetType] = prices;
        const server = new Set(prices.map(p => p.symbol));
        setAssetList([...extraRef.current.filter(a => !server.has(a.symbol)), ...prices]);
        setActiveSym(prev => prev || selectionCacheRef.current[assetType] || prices[0]?.symbol || '');
        failRef.current = 0; setError(null);
      } catch {
        if (!alive) return;
        failRef.current += 1;
        if (assetCacheRef.current[assetType].length === 0) setError('시세 데이터를 불러오지 못했습니다.');
        else if (failRef.current >= 3) setError('시세 갱신에 실패하고 있습니다. 네트워크 상태를 확인해주세요.');
      } finally { if (alive && !isPoll) setLoading(false); }
    };
    fetchPrices(false);
    let timer: ReturnType<typeof setInterval> | undefined;
    if (assetType !== 'CRYPTO') timer = setInterval(() => fetchPrices(true), 10_000);
    return () => { alive = false; if (timer) clearInterval(timer); };
  }, [assetType]);

  // 탭별 선택 기억 — 클래스 일치 시에만 기록(탭 전환 직후 이전 클래스 심볼이 새 슬롯 덮어쓰기 방지)
  useEffect(() => {
    if (activeSym && selClassRef.current === assetType) selectionCacheRef.current[assetType] = activeSym;
    selClassRef.current = assetType;
  }, [activeSym, assetType]);

  // 검색 (디바운스 300ms, 주식/미국/ETF만 — 크립토는 호출부 로컬 필터)
  useEffect(() => {
    if (!canSearch || query.trim().length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      try { setSearchResults((await searchFetcher(assetType)(query.trim())).slice(0, 12)); }
      catch { setSearchResults([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [query, assetType, canSearch]);

  // 실시간 병합(크립토)
  const mergedList = useMemo(() => {
    if (assetType !== 'CRYPTO' || realtimePrices.size === 0) return assetList;
    return assetList.map(a => realtimePrices.get(a.symbol) ?? a);
  }, [assetList, realtimePrices, assetType]);

  const sel = useMemo(() => mergedList.find(a => a.symbol === activeSym) || mergedList[0] || null, [mergedList, activeSym]);
  const rtPrice = useMemo(() => (assetType === 'CRYPTO' && sel ? realtimePrices.get(sel.symbol)?.price ?? null : null), [assetType, sel, realtimePrices]);

  // 최근 본 종목 (localStorage 공유 키) — 선택 종목 변경 시 자동 기록
  useEffect(() => { try { const s = localStorage.getItem(RECENT_KEY); if (s) setRecent(JSON.parse(s)); } catch { /* ignore */ } }, []);
  useEffect(() => {
    if (!sel) return;
    try {
      const saved = localStorage.getItem(RECENT_KEY);
      const prev: RecentStock[] = saved ? JSON.parse(saved) : [];
      const next = [{ stockCode: sel.symbol, stockName: sel.name, assetType: sel.assetType }, ...prev.filter(r => r.stockCode !== sel.symbol)].slice(0, 8);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      setRecent(next);
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel?.symbol]);

  // 검색 결과 선택 → 단건 시세 조회 후 목록 상단 주입
  const onSearchPick = useCallback(async (r: SearchResult) => {
    try {
      const price = await priceFetcher(assetType)(r.code);
      extraRef.current = [price, ...extraRef.current.filter(a => a.symbol !== price.symbol)];
      setAssetList(prev => [price, ...prev.filter(a => a.symbol !== price.symbol)]);
      setActiveSym(price.symbol);
      setQuery(''); setSearchResults([]);
    } catch { setError('종목 시세 조회에 실패했습니다.'); }
  }, [assetType]);

  // 종목 선택 요청(딥링크/최근/보유 클릭) — 다른 자산클래스면 탭 전환 후 로드 완료 시 선택
  const requestSymbol = useCallback((code: string, at?: string) => {
    const cls = ASSET_CLASSES.find(c => c.type === at);
    if (cls && cls.key !== klassRef.current) {
      deepLinkRef.current = { code, type: cls.type };
      selectionCacheRef.current[cls.type] = code;
      setKlass(cls.key);
    } else {
      setActiveSym(code);
    }
  }, []);

  // 딥링크 종목이 목록에 없으면 단건 시세 조회 후 주입 (자산클래스 로드 완료 대기)
  useEffect(() => {
    const dl = deepLinkRef.current;
    if (!dl || loading || assetType !== dl.type) return;
    // 새 클래스 목록이 아직 커밋되지 않았으면(이전 클래스 목록 잔존) 대기 — 다음 커밋에서 재시도
    if (mergedList.length > 0 && mergedList[0].assetType !== assetType) return;
    if (mergedList.some(a => a.symbol === dl.code)) { setActiveSym(dl.code); deepLinkRef.current = null; return; }
    if (dl.type !== 'CRYPTO') {
      priceFetcher(dl.type)(dl.code).then(price => {
        extraRef.current = [price, ...extraRef.current.filter(a => a.symbol !== price.symbol)];
        setAssetList(prev => [price, ...prev.filter(a => a.symbol !== price.symbol)]);
        setActiveSym(price.symbol);
      }).catch(() => {});
    }
    deepLinkRef.current = null;
  }, [loading, assetType, mergedList]);

  // 자산클래스 탭 전환 (검색 상태 초기화 — 목록 필터 등 화면 상태는 호출부가 별도 처리)
  const changeKlass = useCallback((k: string) => { setKlass(k); setQuery(''); setSearchResults([]); }, []);

  return {
    klass, setKlass: changeKlass, assetType, canSearch,
    mergedList, sel, activeSym, setActiveSym,
    loading, error, wsConnected, rtPrice,
    query, setQuery, searchResults, onSearchPick,
    requestSymbol, recent,
  };
}
