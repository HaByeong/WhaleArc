import { useState, useEffect } from 'react';
import Header from '../components/Header';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import {
  tradeService,
  type StockPrice,
  type OrderRequest,
  type Order,
  type Trade,
  type Portfolio,
} from '../services/tradeService';

// Holding 타입을 여기에 직접 정의 (import 문제 해결)
export interface Holding {
  stockCode: string;
  stockName: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  marketValue: number;
  profitLoss: number;
  returnRate: number;
}
import {
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  AreaChart,
  Area,
} from 'recharts';

const TradePage = () => {
  // 상태 관리
  const [selectedStock, setSelectedStock] = useState<StockPrice | null>(null);
  const [stockList, setStockList] = useState<StockPrice[]>([]);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [priceHistory, setPriceHistory] = useState<{ time: string; price: number }[]>([]);

  // 주문 폼 상태
  const [orderType, setOrderType] = useState<'BUY' | 'SELL'>('BUY');
  const [orderMethod, setOrderMethod] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [quantity, setQuantity] = useState<string>('');
  const [limitPrice, setLimitPrice] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 탭 상태
  const [activeTab, setActiveTab] = useState<'order' | 'orders' | 'trades' | 'portfolio'>('order');
  
  // 로딩 및 에러 상태
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 데이터 로드
  useEffect(() => {
    loadInitialData();
  }, []);

  // 실시간 업데이트
  useEffect(() => {
    // 실시간 주가 업데이트 (5초마다)
    const interval = setInterval(() => {
      if (selectedStock) {
        loadStockPrice(selectedStock.stockCode);
      }
      loadPortfolioData();
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedStock]);

  // 데모 데이터
  const getDemoData = () => {
    const baseDate = new Date().toISOString();
    const demoStocks: StockPrice[] = [
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
    ];

    const demoPortfolio: Portfolio = {
      id: 'demo-1',
      userId: 'demo-user',
      cashBalance: 5000000,
      totalValue: 12500000,
      returnRate: 25.0,
      holdings: [
        {
          stockCode: '005930',
          stockName: '삼성전자',
          quantity: 100,
          averagePrice: 60000,
          currentPrice: 75000,
          marketValue: 7500000,
          profitLoss: 1500000,
          returnRate: 25.0,
        },
      ],
    };

    const demoOrders: Order[] = [
      {
        id: 'order-1',
        userId: 'demo-user',
        stockCode: '005930',
        stockName: '삼성전자',
        orderType: 'BUY',
        orderMethod: 'MARKET',
        quantity: 10,
        price: 75000,
        status: 'FILLED',
        filledQuantity: 10,
        filledPrice: 75000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const demoTrades: Trade[] = [
      {
        id: 'trade-1',
        orderId: 'order-1',
        stockCode: '005930',
        stockName: '삼성전자',
        orderType: 'BUY',
        quantity: 10,
        price: 75000,
        totalAmount: 750000,
        commission: 750,
        netAmount: 749250,
        executedAt: new Date().toISOString(),
      },
    ];

    return { demoStocks, demoPortfolio, demoOrders, demoTrades };
  };

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [stocks, portfolioData, ordersData, tradesData] = await Promise.all([
        tradeService.getStockList().catch(() => {
          const { demoStocks } = getDemoData();
          return demoStocks;
        }),
        tradeService.getPortfolio().catch(() => {
          const { demoPortfolio } = getDemoData();
          return demoPortfolio;
        }),
        tradeService.getOrders().catch(() => {
          const { demoOrders } = getDemoData();
          return demoOrders;
        }),
        tradeService.getTrades().catch(() => {
          const { demoTrades } = getDemoData();
          return demoTrades;
        }),
      ]);

      setStockList(stocks);
      setPortfolio(portfolioData);
      setOrders(ordersData);
      setTrades(tradesData);

      if (stocks.length > 0 && !selectedStock) {
        setSelectedStock(stocks[0]);
        loadStockPrice(stocks[0].stockCode);
      }
    } catch (err: any) {
      // 에러 발생 시에도 데모 데이터 표시
      const { demoStocks, demoPortfolio, demoOrders, demoTrades } = getDemoData();
      setStockList(demoStocks);
      setPortfolio(demoPortfolio);
      setOrders(demoOrders);
      setTrades(demoTrades);
      if (demoStocks.length > 0 && !selectedStock) {
        setSelectedStock(demoStocks[0]);
      }
    } finally {
      setLoading(false);
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
      setSelectedStock(price);

      // 가격 히스토리 업데이트
      setPriceHistory((prev) => {
        const newHistory = [
          ...prev,
          {
            time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            price: price.currentPrice,
          },
        ];
        // 최대 30개까지만 유지
        return newHistory.slice(-30);
      });
    } catch (error) {
      console.error('주가 조회 실패:', error);
    }
  };

  const loadPortfolioData = async () => {
    try {
      const portfolioData = await tradeService.getPortfolio();
      setPortfolio(portfolioData);
    } catch (error) {
      console.error('포트폴리오 조회 실패:', error);
    }
  };

  const handleStockSelect = (stock: StockPrice) => {
    setSelectedStock(stock);
    setPriceHistory([]);
    loadStockPrice(stock.stockCode);
  };

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedStock || !quantity || quantity === '0') {
      alert('종목과 수량을 입력해주세요.');
      return;
    }

    if (orderMethod === 'LIMIT' && (!limitPrice || limitPrice === '0')) {
      alert('지정가 주문은 가격을 입력해주세요.');
      return;
    }

    setIsSubmitting(true);

    try {
      const orderRequest: OrderRequest = {
        stockCode: selectedStock.stockCode,
        stockName: selectedStock.stockName,
        orderType,
        orderMethod,
        quantity: parseInt(quantity),
        price: orderMethod === 'LIMIT' ? parseFloat(limitPrice) : undefined,
      };

      await tradeService.createOrder(orderRequest);

      // 폼 초기화
      setQuantity('');
      setLimitPrice('');

      // 데이터 새로고침
      await loadInitialData();

      alert('주문이 성공적으로 접수되었습니다.');
      setActiveTab('orders');
    } catch (error: any) {
      alert(error.response?.data?.message || '주문 접수에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm('정말 이 주문을 취소하시겠습니까?')) return;

    try {
      await tradeService.cancelOrder(orderId);
      await loadInitialData();
      alert('주문이 취소되었습니다.');
    } catch (error: any) {
      alert(error.response?.data?.message || '주문 취소에 실패했습니다.');
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

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('ko-KR').format(value);
  };

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'FILLED':
        return 'text-green-600 bg-green-50';
      case 'PENDING':
        return 'text-yellow-600 bg-yellow-50';
      case 'CANCELLED':
        return 'text-gray-600 bg-gray-50';
      case 'PARTIALLY_FILLED':
        return 'text-blue-600 bg-blue-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getAvailableQuantity = (stockCode: string): number => {
    if (!portfolio) return 0;
    const holding = portfolio.holdings.find((h) => h.stockCode === stockCode);
    return holding?.quantity || 0;
  };

  if (loading && stockList.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header showNav={true} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingSpinner fullScreen={false} message="데이터를 불러오는 중..." />
        </div>
      </div>
    );
  }

  if (error && stockList.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header showNav={true} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <ErrorMessage message={error} onRetry={loadInitialData} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header showNav={true} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 좌측: 종목 목록 & 주문 폼 */}
          <div className="lg:col-span-1 space-y-6">
            {/* 종목 목록 */}
            <div className="card">
              <h2 className="text-xl font-bold text-whale-dark mb-4">종목 목록</h2>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {stockList.map((stock) => (
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
                            stock.change >= 0 ? 'price-up' : 'price-down'
                          }`}
                        >
                          {stock.change >= 0 ? '+' : ''}
                          {stock.changeRate.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 주문 폼 */}
            {selectedStock && (
              <div className="card">
                <h2 className="text-xl font-bold text-whale-dark mb-4">주문하기</h2>
                <form onSubmit={handleOrderSubmit} className="space-y-4">
                  {/* 매수/매도 선택 */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setOrderType('BUY')}
                      className={`flex-1 py-3 rounded-lg font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 min-h-[44px] ${
                        orderType === 'BUY'
                          ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-md scale-105'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      aria-label="매수 주문"
                      aria-pressed={orderType === 'BUY'}
                    >
                      매수
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderType('SELL')}
                      className={`flex-1 py-3 rounded-lg font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 min-h-[44px] ${
                        orderType === 'SELL'
                          ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md scale-105'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      aria-label="매도 주문"
                      aria-pressed={orderType === 'SELL'}
                    >
                      매도
                    </button>
                  </div>

                  {/* 시장가/지정가 선택 */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setOrderMethod('MARKET')}
                      className={`flex-1 py-2 rounded-lg font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-whale-light focus:ring-offset-2 min-h-[44px] ${
                        orderMethod === 'MARKET'
                          ? 'bg-whale-light text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      aria-label="시장가 주문"
                      aria-pressed={orderMethod === 'MARKET'}
                    >
                      시장가
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderMethod('LIMIT')}
                      className={`flex-1 py-2 rounded-lg font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-whale-light focus:ring-offset-2 min-h-[44px] ${
                        orderMethod === 'LIMIT'
                          ? 'bg-whale-light text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      aria-label="지정가 주문"
                      aria-pressed={orderMethod === 'LIMIT'}
                    >
                      지정가
                    </button>
                  </div>

                  {/* 현재가 표시 */}
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">현재가</div>
                    <div className="text-2xl font-bold text-whale-dark">
                      {formatCurrency(selectedStock.currentPrice)}
                    </div>
                    {orderType === 'SELL' && (
                      <div className="text-sm text-gray-600 mt-2">
                        보유 수량: {getAvailableQuantity(selectedStock.stockCode)}주
                      </div>
                    )}
                  </div>

                  {/* 지정가 가격 입력 */}
                  {orderMethod === 'LIMIT' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        지정가격
                      </label>
                      <input
                        type="number"
                        value={limitPrice}
                        onChange={(e) => setLimitPrice(e.target.value)}
                        className="input-field"
                        placeholder="가격 입력"
                        step="1"
                      />
                    </div>
                  )}

                  {/* 수량 입력 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">수량</label>
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="input-field"
                      placeholder="수량 입력"
                      min="1"
                      step="1"
                      required
                    />
                  </div>

                  {/* 예상 금액 */}
                  {quantity && (
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <div className="text-sm text-gray-600 mb-1">예상 금액</div>
                      <div className="text-xl font-bold text-whale-dark">
                        {formatCurrency(
                          (orderMethod === 'MARKET' ? selectedStock.currentPrice : parseFloat(limitPrice) || 0) *
                            parseInt(quantity || '0')
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        (수수료 0.015% 별도)
                      </div>
                    </div>
                  )}

                  {/* 주문 버튼 */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`w-full py-3 rounded-lg font-semibold text-white transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${
                      orderType === 'BUY'
                        ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
                        : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700'
                    }`}
                  >
                    {isSubmitting ? '처리 중...' : orderType === 'BUY' ? '매수 주문' : '매도 주문'}
                  </button>
                </form>
              </div>
            )}

            {/* 포트폴리오 요약 */}
            {portfolio && (
              <div className="card">
                <h2 className="text-xl font-bold text-whale-dark mb-4">포트폴리오</h2>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">총 자산</span>
                    <span className="text-xl font-bold text-whale-dark">
                      {formatCurrency(portfolio.totalValue)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">현금</span>
                    <span className="font-semibold">{formatCurrency(portfolio.cashBalance)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">수익률</span>
                    <span
                      className={`font-semibold ${
                        portfolio.returnRate >= 0 ? 'text-red-600' : 'text-blue-600'
                      }`}
                    >
                      {portfolio.returnRate >= 0 ? '+' : ''}
                      {portfolio.returnRate.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 우측: 차트 & 주문 내역 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 탭 메뉴 */}
            <div className="flex space-x-4 border-b border-gray-200">
              <button
                onClick={() => setActiveTab('order')}
                className={`pb-3 px-4 font-semibold transition-colors ${
                  activeTab === 'order'
                    ? 'text-whale-light border-b-2 border-whale-light'
                    : 'text-gray-500 hover:text-whale-light'
                }`}
              >
                실시간 차트
              </button>
              <button
                onClick={() => setActiveTab('orders')}
                className={`pb-3 px-4 font-semibold transition-colors ${
                  activeTab === 'orders'
                    ? 'text-whale-light border-b-2 border-whale-light'
                    : 'text-gray-500 hover:text-whale-light'
                }`}
              >
                주문 내역 ({orders.length})
              </button>
              <button
                onClick={() => setActiveTab('trades')}
                className={`pb-3 px-4 font-semibold transition-colors ${
                  activeTab === 'trades'
                    ? 'text-whale-light border-b-2 border-whale-light'
                    : 'text-gray-500 hover:text-whale-light'
                }`}
              >
                체결 내역 ({trades.length})
              </button>
              <button
                onClick={() => setActiveTab('portfolio')}
                className={`pb-3 px-4 font-semibold transition-colors ${
                  activeTab === 'portfolio'
                    ? 'text-whale-light border-b-2 border-whale-light'
                    : 'text-gray-500 hover:text-whale-light'
                }`}
              >
                보유 종목
              </button>
            </div>

            {/* 실시간 차트 */}
            {activeTab === 'order' && selectedStock && (
              <div className="card">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-whale-dark">{selectedStock.stockName}</h2>
                  <div className="text-gray-500">{selectedStock.stockCode}</div>
                </div>

                {priceHistory.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
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
                        fillOpacity={1}
                        fill="url(#colorPrice)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-96 flex items-center justify-center text-gray-500">
                    실시간 가격 데이터를 불러오는 중...
                  </div>
                )}

                {/* 주가 정보 */}
                <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-200">
                  <div>
                    <div className="text-sm text-gray-600 mb-1">현재가</div>
                    <div className="text-xl font-bold text-whale-dark">
                      {formatCurrency(selectedStock.currentPrice)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 mb-1">전일대비</div>
                    <div
                      className={`text-xl font-bold ${
                        selectedStock.change >= 0 ? 'text-red-600' : 'text-blue-600'
                      }`}
                    >
                      {selectedStock.change >= 0 ? '+' : ''}
                      {formatCurrency(selectedStock.change)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 mb-1">변동률</div>
                    <div
                      className={`text-xl font-bold ${
                        selectedStock.changeRate >= 0 ? 'text-red-600' : 'text-blue-600'
                      }`}
                    >
                      {selectedStock.changeRate >= 0 ? '+' : ''}
                      {selectedStock.changeRate.toFixed(2)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 mb-1">거래량</div>
                    <div className="text-xl font-bold text-whale-dark">
                      {formatNumber(selectedStock.volume)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 주문 내역 */}
            {activeTab === 'orders' && (
              <div className="card">
                <h2 className="text-xl font-bold text-whale-dark mb-4">주문 내역</h2>
                {orders.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-4xl mb-3">📋</div>
                    <div className="text-gray-500 font-medium">주문 내역이 없습니다</div>
                    <div className="text-sm text-gray-400 mt-1">주문을 실행하면 내역이 표시됩니다</div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">종목</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">구분</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">가격</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">수량</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">상태</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">시간</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">액션</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {orders.map((order) => (
                          <tr key={order.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="font-semibold">{order.stockName}</div>
                              <div className="text-sm text-gray-500">{order.stockCode}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`px-2 py-1 rounded text-sm font-semibold ${
                                  order.orderType === 'BUY'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-blue-100 text-blue-700'
                                }`}
                              >
                                {order.orderType === 'BUY' ? '매수' : '매도'}
                              </span>
                              <div className="text-xs text-gray-500 mt-1">
                                {order.orderMethod === 'MARKET' ? '시장가' : '지정가'}
                              </div>
                            </td>
                            <td className="px-4 py-3 font-semibold">
                              {formatCurrency(order.price)}
                            </td>
                            <td className="px-4 py-3">{order.quantity}주</td>
                            <td className="px-4 py-3">
                              <span
                                className={`px-2 py-1 rounded text-sm font-semibold ${getStatusColor(
                                  order.status
                                )}`}
                              >
                                {order.status === 'PENDING'
                                  ? '대기'
                                  : order.status === 'FILLED'
                                  ? '체결'
                                  : order.status === 'PARTIALLY_FILLED'
                                  ? '부분체결'
                                  : '취소'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {new Date(order.createdAt).toLocaleString('ko-KR')}
                            </td>
                            <td className="px-4 py-3">
                              {order.status === 'PENDING' && (
                                <button
                                  onClick={() => handleCancelOrder(order.id)}
                                  className="text-red-600 hover:text-red-800 text-sm font-semibold"
                                >
                                  취소
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* 체결 내역 */}
            {activeTab === 'trades' && (
              <div className="card">
                <h2 className="text-xl font-bold text-whale-dark mb-4">체결 내역</h2>
                {trades.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">체결 내역이 없습니다.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">종목</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">구분</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">체결가</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">수량</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">금액</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">수수료</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">체결시간</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {trades.map((trade) => (
                          <tr key={trade.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="font-semibold">{trade.stockName}</div>
                              <div className="text-sm text-gray-500">{trade.stockCode}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`px-2 py-1 rounded text-sm font-semibold ${
                                  trade.orderType === 'BUY'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-blue-100 text-blue-700'
                                }`}
                              >
                                {trade.orderType === 'BUY' ? '매수' : '매도'}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-semibold">
                              {formatCurrency(trade.price)}
                            </td>
                            <td className="px-4 py-3">{trade.quantity}주</td>
                            <td className="px-4 py-3">{formatCurrency(trade.totalAmount)}</td>
                            <td className="px-4 py-3 text-gray-600">
                              {formatCurrency(trade.commission)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {new Date(trade.executedAt).toLocaleString('ko-KR')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* 보유 종목 */}
            {activeTab === 'portfolio' && portfolio && (
        <div className="card">
                <h2 className="text-xl font-bold text-whale-dark mb-4">보유 종목</h2>
                {portfolio.holdings.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">보유 종목이 없습니다.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">종목</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">보유 수량</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">평균 매수가</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">현재가</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">평가금액</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">평가손익</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">수익률</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {portfolio.holdings.map((holding) => (
                          <tr key={holding.stockCode} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="font-semibold">{holding.stockName}</div>
                              <div className="text-sm text-gray-500">{holding.stockCode}</div>
                            </td>
                            <td className="px-4 py-3">{holding.quantity}주</td>
                            <td className="px-4 py-3">{formatCurrency(holding.averagePrice)}</td>
                            <td className="px-4 py-3 font-semibold">
                              {formatCurrency(holding.currentPrice)}
                            </td>
                            <td className="px-4 py-3 font-semibold">
                              {formatCurrency(holding.marketValue)}
                            </td>
                            <td
                              className={`px-4 py-3 font-semibold ${
                                holding.profitLoss >= 0 ? 'text-red-600' : 'text-blue-600'
                              }`}
                            >
                              {holding.profitLoss >= 0 ? '+' : ''}
                              {formatCurrency(holding.profitLoss)}
                            </td>
                            <td
                              className={`px-4 py-3 font-semibold ${
                                holding.returnRate >= 0 ? 'text-red-600' : 'text-blue-600'
                              }`}
                            >
                              {holding.returnRate >= 0 ? '+' : ''}
                              {holding.returnRate.toFixed(2)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TradePage;
