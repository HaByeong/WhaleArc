import { useState, useEffect } from 'react';
import Header from '../components/Header';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import { tradeService, type StockPrice } from '../services/tradeService';
import { XAxis, YAxis, ResponsiveContainer, Tooltip, AreaChart, Area } from 'recharts';

/**
 * 시장 페이지 - 전체 시장 종목 목록과 실시간 주가 정보
 */
const MarketPage = () => {
  const [selectedStock, setSelectedStock] = useState<StockPrice | null>(null);
  const [stockList, setStockList] = useState<StockPrice[]>([]);
  const [priceHistory, setPriceHistory] = useState<{ time: string; price: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'change'>('name');
  const [filterText, setFilterText] = useState('');

  useEffect(() => {
    loadData();
    // 실시간 주가 업데이트 (10초마다)
    const interval = setInterval(() => {
      if (selectedStock) {
        loadStockPrice(selectedStock.stockCode);
      }
      loadStockList();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedStock) {
      loadStockPrice(selectedStock.stockCode);
    }
  }, [selectedStock]);

  // 데모 종목 데이터
  const getDemoStocks = (): StockPrice[] => {
    const baseDate = new Date().toISOString();
    return [
      {
        stockCode: '005930',
        stockName: '삼성전자',
        currentPrice: 75000,
        change: 1500,
        changeRate: 2.04,
        volume: 12500000,
        high: 76000,
        low: 74000,
        open: 74500,
        previousClose: 73500,
        timestamp: baseDate,
      },
      {
        stockCode: '000660',
        stockName: 'SK하이닉스',
        currentPrice: 145000,
        change: -2000,
        changeRate: -1.36,
        volume: 3500000,
        high: 147000,
        low: 143000,
        open: 146000,
        previousClose: 147000,
        timestamp: baseDate,
      },
      {
        stockCode: '035420',
        stockName: 'NAVER',
        currentPrice: 185000,
        change: 3000,
        changeRate: 1.65,
        volume: 1200000,
        high: 186000,
        low: 183000,
        open: 183500,
        previousClose: 182000,
        timestamp: baseDate,
      },
      {
        stockCode: '035720',
        stockName: '카카오',
        currentPrice: 52000,
        change: -500,
        changeRate: -0.95,
        volume: 2500000,
        high: 52500,
        low: 51800,
        open: 52300,
        previousClose: 52500,
        timestamp: baseDate,
      },
    ];
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const stocks = await tradeService.getStockList().catch(() => {
        // API 실패 시 데모 데이터 사용
        return getDemoStocks();
      });

      setStockList(stocks);

      if (stocks.length > 0 && !selectedStock) {
        setSelectedStock(stocks[0]);
      }
    } catch (err: any) {
      // 에러 발생 시에도 데모 데이터 표시
      const demoStocks = getDemoStocks();
      setStockList(demoStocks);
      if (demoStocks.length > 0 && !selectedStock) {
        setSelectedStock(demoStocks[0]);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadStockList = async () => {
    try {
      const stocks = await tradeService.getStockList().catch(() => {
        // API 실패 시 데모 데이터 사용
        return getDemoStocks();
      });
      setStockList(stocks);
      
      // 선택된 종목 정보도 업데이트
      if (selectedStock) {
        const updated = stocks.find(s => s.stockCode === selectedStock.stockCode);
        if (updated) {
          setSelectedStock(updated);
        }
      }
    } catch (err) {
      console.error('종목 목록 업데이트 실패:', err);
    }
  };

  const loadStockPrice = async (stockCode: string) => {
    try {
      const price = await tradeService.getStockPrice(stockCode).catch(() => {
        // API 실패 시 데모 데이터
        const stock = stockList.find(s => s.stockCode === stockCode);
        const baseDate = new Date().toISOString();
        return stock || {
          stockCode: '005930',
          stockName: '삼성전자',
          currentPrice: 75000,
          change: 1500,
          changeRate: 2.04,
          volume: 12500000,
          high: 76000,
          low: 74000,
          open: 74500,
          previousClose: 73500,
          timestamp: baseDate,
        };
      });
      if (price) {
        setPriceHistory((prev) => {
          const newHistory = [...prev, { time: new Date().toLocaleTimeString(), price: price.currentPrice }];
          return newHistory.slice(-20); // 최근 20개만 유지
        });
      }
    } catch (err) {
      console.error('주가 조회 실패:', err);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleStockSelect = (stock: StockPrice) => {
    setSelectedStock(stock);
    setPriceHistory([]); // 새로운 종목 선택 시 히스토리 초기화
  };

  // 필터링 및 정렬된 종목 목록
  const filteredAndSortedStocks = stockList
    .filter((stock) => 
      stock.stockName.toLowerCase().includes(filterText.toLowerCase()) ||
      stock.stockCode.toLowerCase().includes(filterText.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.stockName.localeCompare(b.stockName);
        case 'price':
          return b.currentPrice - a.currentPrice;
        case 'change':
          return b.changeRate - a.changeRate;
        default:
          return 0;
      }
    });

  if (loading && stockList.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header showNav={true} />
        <LoadingSpinner fullScreen={false} message="시장 데이터를 불러오는 중..." />
      </div>
    );
  }

  if (error && stockList.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header showNav={true} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <ErrorMessage message={error} onRetry={loadData} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header showNav={true} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-whale-dark mb-2">시장 현황</h1>
          <p className="text-gray-600">전체 종목의 실시간 주가 정보를 확인하세요</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 좌측: 종목 목록 */}
          <div className="lg:col-span-1 space-y-4">
            <div className="card">
              <h2 className="text-xl font-bold text-whale-dark mb-4">종목 목록</h2>
              
              {/* 검색 및 정렬 */}
              <div className="mb-4 space-y-3">
                <input
                  type="text"
                  placeholder="종목명 또는 코드 검색..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  className="input-field"
                />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'name' | 'price' | 'change')}
                  className="input-field bg-white"
                >
                  <option value="name">이름순</option>
                  <option value="price">가격순</option>
                  <option value="change">등락률순</option>
                </select>
              </div>

              {/* 종목 목록 */}
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {filteredAndSortedStocks.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-4xl mb-3">🔍</div>
                    <div className="text-gray-500 font-medium">검색 결과가 없습니다</div>
                  </div>
                ) : (
                  filteredAndSortedStocks.map((stock) => (
                    <div
                      key={stock.stockCode}
                      onClick={() => handleStockSelect(stock)}
                      className={
                        selectedStock?.stockCode === stock.stockCode
                          ? 'stock-item-selected'
                          : 'stock-item-default'
                      }
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold text-whale-dark">{stock.stockName}</div>
                          <div className="text-sm text-gray-500">{stock.stockCode}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-whale-dark">
                            {formatCurrency(stock.currentPrice)}
                          </div>
                          <div
                            className={`text-sm font-semibold ${
                              stock.changeRate >= 0 ? 'price-up' : 'price-down'
                            }`}
                          >
                            {stock.changeRate >= 0 ? '+' : ''}
                            {stock.changeRate.toFixed(2)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 우측: 선택된 종목 상세 정보 및 차트 */}
          <div className="lg:col-span-2 space-y-6">
            {selectedStock ? (
              <>
                {/* 종목 정보 카드 */}
                <div className="card">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-whale-dark">{selectedStock.stockName}</h2>
                      <p className="text-gray-500">{selectedStock.stockCode}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-whale-dark mb-1">
                        {formatCurrency(selectedStock.currentPrice)}
                      </div>
                      <div
                        className={`text-lg font-semibold ${
                          selectedStock.changeRate >= 0 ? 'price-up' : 'price-down'
                        }`}
                      >
                        {selectedStock.change >= 0 ? '+' : ''}
                        {formatCurrency(selectedStock.change)} ({selectedStock.changeRate >= 0 ? '+' : ''}
                        {selectedStock.changeRate.toFixed(2)}%)
                      </div>
                    </div>
                  </div>

                  {/* 실시간 가격 차트 */}
                  {priceHistory.length > 0 && (
                    <div className="mt-6">
                      <h3 className="text-lg font-semibold text-whale-dark mb-3">실시간 가격 추이</h3>
                      <ResponsiveContainer width="100%" height={250}>
                        <AreaChart data={priceHistory}>
                          <defs>
                            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#4a90e2" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#4a90e2" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="time" />
                          <YAxis domain={['auto', 'auto']} />
                          <Tooltip
                            formatter={(value: number) => formatCurrency(value)}
                            labelFormatter={(label) => `시간: ${label}`}
                          />
                          <Area
                            type="monotone"
                            dataKey="price"
                            stroke="#4a90e2"
                            strokeWidth={2}
                            fill="url(#colorPrice)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* 시장 통계 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="card text-center">
                    <div className="text-sm text-gray-600 mb-1">전일 종가</div>
                    <div className="text-xl font-bold text-whale-dark">
                      {formatCurrency(selectedStock.currentPrice - selectedStock.change)}
                    </div>
                  </div>
                  <div className="card text-center">
                    <div className="text-sm text-gray-600 mb-1">등락률</div>
                    <div
                      className={`text-xl font-bold ${
                        selectedStock.changeRate >= 0 ? 'price-up' : 'price-down'
                      }`}
                    >
                      {selectedStock.changeRate >= 0 ? '+' : ''}
                      {selectedStock.changeRate.toFixed(2)}%
                    </div>
                  </div>
                  <div className="card text-center">
                    <div className="text-sm text-gray-600 mb-1">등락액</div>
                    <div
                      className={`text-xl font-bold ${
                        selectedStock.change >= 0 ? 'price-up' : 'price-down'
                      }`}
                    >
                      {selectedStock.change >= 0 ? '+' : ''}
                      {formatCurrency(selectedStock.change)}
                    </div>
                  </div>
                  <div className="card text-center">
                    <div className="text-sm text-gray-600 mb-1">총 종목 수</div>
                    <div className="text-xl font-bold text-whale-dark">{stockList.length}개</div>
                  </div>
                </div>
              </>
            ) : (
              <div className="card text-center py-12">
                <div className="text-4xl mb-3">📊</div>
                <div className="text-gray-500 font-medium">종목을 선택하세요</div>
                <div className="text-sm text-gray-400 mt-1">좌측 목록에서 종목을 클릭하여 상세 정보를 확인하세요</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketPage;

