import { useState, useEffect } from 'react';
import Header from '../components/Header';
import {
  quantStoreService,
  type QuantProduct,
  type ProductPurchase,
  type Category,
  CATEGORY_LABELS,
  RISK_LABELS,
  RISK_COLORS,
  cryptoDisplayName,
  formatQuantity,
} from '../services/quantStoreService';

const ALL_CATEGORIES: (Category | 'ALL')[] = [
  'ALL',
  'TREND_FOLLOWING',
  'MOMENTUM',
  'MEAN_REVERSION',
  'VOLATILITY',
  'ARBITRAGE',
  'MULTI_FACTOR',
];

const CATEGORY_TAB_LABELS: Record<string, string> = {
  ALL: '전체 항로',
  ...CATEGORY_LABELS,
};

const QuantStorePage = () => {
  const [products, setProducts] = useState<QuantProduct[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | 'ALL'>('ALL');
  const [selectedProduct, setSelectedProduct] = useState<QuantProduct | null>(null);
  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set());
  const [purchases, setPurchases] = useState<ProductPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);

  // 투자 금액 입력 모달
  const [investModal, setInvestModal] = useState<QuantProduct | null>(null);
  const [investmentAmount, setInvestmentAmount] = useState('');
  const [confirmStep, setConfirmStep] = useState(false);

  // 취소 확인 모달
  const [cancelTarget, setCancelTarget] = useState<ProductPurchase | null>(null);

  useEffect(() => {
    loadProducts();
    loadPurchases();
  }, []);

  useEffect(() => {
    loadProducts();
  }, [selectedCategory]);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const category = selectedCategory === 'ALL' ? undefined : selectedCategory;
      const data = await quantStoreService.getProducts(category);
      setProducts(data);
    } catch {
      setProducts(getDemoProducts());
    } finally {
      setLoading(false);
    }
  };

  const loadPurchases = async () => {
    try {
      const result = await quantStoreService.getMyPurchases();
      setPurchasedIds(new Set(result.purchasedProductIds));
      setPurchases(result.purchases.filter((p) => p.status === 'ACTIVE'));
    } catch {
      // 비로그인 상태
    }
  };

  const openInvestModal = (product: QuantProduct) => {
    if (purchasedIds.has(product.id)) return;
    setInvestModal(product);
    setInvestmentAmount('');
    setConfirmStep(false);
  };

  const goToConfirmStep = () => {
    const amount = Number(investmentAmount.replace(/,/g, ''));
    if (!amount || amount <= 0) {
      alert('투자 금액을 입력해주세요.');
      return;
    }
    setConfirmStep(true);
  };

  const handlePurchase = async () => {
    if (!investModal) return;
    const amount = Number(investmentAmount.replace(/,/g, ''));

    setPurchasing(true);
    try {
      await quantStoreService.purchaseProduct(investModal.id, amount);
      setPurchasedIds((prev) => new Set(prev).add(investModal.id));
      setInvestModal(null);
      setConfirmStep(false);
      setSelectedProduct(null);
      await loadPurchases();
    } catch (err: any) {
      alert(err.response?.data?.message || '항로 구매에 실패했습니다.');
    } finally {
      setPurchasing(false);
    }
  };

  const openCancelModal = (purchase: ProductPurchase) => {
    setCancelTarget(purchase);
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;

    setCancelling(cancelTarget.id);
    try {
      await quantStoreService.cancelPurchase(cancelTarget.id);
      setPurchasedIds((prev) => {
        const next = new Set(prev);
        next.delete(cancelTarget.productId);
        return next;
      });
      setCancelTarget(null);
      await loadPurchases();
    } catch (err: any) {
      alert(err.response?.data?.message || '취소에 실패했습니다.');
    } finally {
      setCancelling(null);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', minimumFractionDigits: 0 }).format(value);

  const formatPercent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

  const formatInputAmount = (raw: string) => {
    const num = raw.replace(/[^0-9]/g, '');
    if (!num) return '';
    return Number(num).toLocaleString('ko-KR');
  };

  const QUICK_AMOUNTS = [1000000, 3000000, 5000000, 10000000];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header showNav={true} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <img src="/whales/narwhal.png" alt="" className="w-10 h-10 object-contain" />
            <h1 className="text-3xl font-bold text-whale-dark">항로 상점</h1>
          </div>
          <p className="text-gray-600 ml-13 leading-relaxed">
            고래가 바다를 건널 때, 본능이 아닌 검증된 경로를 따릅니다.<br />
            <strong className="text-whale-dark">항로</strong>는 과거 시장 데이터로 백테스트를 거친 퀀트 트레이딩 전략입니다.<br />
            원하는 항로를 구매하고, 내 포트폴리오에 적용해 수익의 바다를 항해하세요.
          </p>
        </div>

        {/* 내 항해 현황 */}
        {purchases.length > 0 && (
          <div className="mb-8 bg-white rounded-xl border border-whale-light/20 p-5">
            <h2 className="text-lg font-bold text-whale-dark mb-3">내 항해 현황</h2>
            <div className="space-y-3">
              {purchases.map((p) => (
                <div key={p.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
                  <div>
                    <div className="font-semibold text-whale-dark">{p.productName}</div>
                    <div className="text-sm text-gray-500">
                      투자 금액: {formatCurrency(p.investmentAmount)} · 자산: {p.purchasedAssets?.map(a => `${cryptoDisplayName(a.code)} ${formatQuantity(a.quantity)}개`).join(', ') || '-'}
                    </div>
                  </div>
                  <button
                    onClick={() => openCancelModal(p)}
                    disabled={cancelling === p.id}
                    className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {cancelling === p.id ? '취소 중...' : '항해 취소'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 카테고리 필터 */}
        <div className="flex flex-wrap gap-2 mb-6">
          {ALL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                selectedCategory === cat
                  ? 'bg-whale-light text-white shadow-md'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {CATEGORY_TAB_LABELS[cat]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-3/4 mb-4" />
                <div className="h-4 bg-gray-200 rounded w-full mb-2" />
                <div className="h-4 bg-gray-200 rounded w-2/3 mb-6" />
                <div className="h-10 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => {
              const isPurchased = purchasedIds.has(product.id);
              return (
                <div
                  key={product.id}
                  className={`card cursor-pointer transition-all hover:shadow-xl hover:-translate-y-1 relative ${
                    selectedProduct?.id === product.id ? 'ring-2 ring-whale-light' : ''
                  } ${product.price > 0 ? 'ring-1 ring-amber-200' : ''}`}
                  onClick={() => setSelectedProduct(selectedProduct?.id === product.id ? null : product)}
                >
                  {product.strategyType === 'TURTLE' ? (
                    <div className="absolute -top-2 -right-2 px-2.5 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold rounded-full shadow-sm">
                      WhaleArc 독점
                    </div>
                  ) : product.price > 0 ? (
                    <div className="absolute -top-2 -right-2 px-2.5 py-1 bg-amber-400 text-white text-[10px] font-bold rounded-full shadow-sm">
                      PREMIUM
                    </div>
                  ) : null}
                  {/* 상단 뱃지 */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-whale-light/10 text-whale-light">
                      {CATEGORY_LABELS[product.category]}
                    </span>
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${RISK_COLORS[product.riskLevel]}`}>
                      {RISK_LABELS[product.riskLevel]}
                    </span>
                  </div>

                  {/* 상품명 & 설명 */}
                  <h3 className="text-lg font-bold text-whale-dark mb-2">{product.name}</h3>
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">{product.description}</p>

                  {/* 성과 지표 */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                      <div className="text-xs text-gray-500 mb-0.5">기대 수익률</div>
                      <div className={`text-sm font-bold ${product.expectedReturn >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                        {formatPercent(product.expectedReturn)}
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                      <div className="text-xs text-gray-500 mb-0.5">최대 파고</div>
                      <div className="text-sm font-bold text-blue-600">
                        {formatPercent(product.maxDrawdown)}
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                      <div className="text-xs text-gray-500 mb-0.5">승률</div>
                      <div className="text-sm font-bold text-whale-dark">{product.winRate.toFixed(1)}%</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                      <div className="text-xs text-gray-500 mb-0.5">샤프 비율</div>
                      <div className="text-sm font-bold text-whale-dark">{product.sharpeRatio.toFixed(2)}</div>
                    </div>
                  </div>

                  {/* 대상 자산 */}
                  <div className="flex flex-wrap gap-1 mb-4">
                    {product.targetAssets.map((asset) => (
                      <span key={asset} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                        {cryptoDisplayName(asset)}
                      </span>
                    ))}
                  </div>

                  {/* 가격 & 구매 */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div>
                      {product.price === 0 ? (
                        <div className="text-xl font-bold text-green-600">무료</div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-400 text-white rounded">PREMIUM</span>
                          <span className="text-xl font-bold text-whale-dark">{formatCurrency(product.price)}</span>
                        </div>
                      )}
                      <div className="text-xs text-gray-400">{product.subscribers}척 항해 중</div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isPurchased) return;
                        openInvestModal(product);
                      }}
                      disabled={isPurchased || purchasing}
                      className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                        isPurchased
                          ? 'bg-green-100 text-green-700 cursor-default'
                          : product.price === 0
                            ? 'bg-green-500 hover:bg-green-600 text-white'
                            : 'btn-primary'
                      }`}
                    >
                      {isPurchased ? '항해 중' : product.price === 0 ? '무료 사용' : '항로 구매'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 상세 모달 */}
        {selectedProduct && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedProduct(null)}>
            <div
              className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <span className="px-3 py-1 text-sm font-semibold rounded-full bg-whale-light/10 text-whale-light">
                    {CATEGORY_LABELS[selectedProduct.category]}
                  </span>
                  <span className={`px-3 py-1 text-sm font-semibold rounded-full ${RISK_COLORS[selectedProduct.riskLevel]}`}>
                    {RISK_LABELS[selectedProduct.riskLevel]}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="닫기"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <h2 className="text-2xl font-bold text-whale-dark mb-3">{selectedProduct.name}</h2>
              <p className="text-gray-600 mb-6">{selectedProduct.description}</p>

              {/* WhaleArc 자체 알고리즘 뱃지 (터틀) */}
              {selectedProduct.strategyType === 'TURTLE' && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5 mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2.5 py-1 text-xs font-bold bg-amber-500 text-white rounded-full">WhaleArc 독점</span>
                    <h3 className="text-sm font-bold text-amber-900">자체 개발 알고리즘</h3>
                  </div>
                  <p className="text-sm text-amber-800 leading-relaxed mb-3">
                    WhaleArc 팀이 직접 개발하고 최적화한 <strong>터틀 트레이딩 알고리즘</strong>입니다.
                    리처드 데니스의 전설적인 터틀 전략을 암호화폐 시장에 맞게 재설계하였으며,
                    BTC 1시간봉 기준 백테스트에서 검증된 파라미터를 사용합니다.
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white/70 rounded-lg p-2.5">
                      <span className="text-amber-600 font-semibold">진입</span>
                      <p className="text-amber-900 mt-0.5">100시간 Donchian 채널 상단 돌파 + ADX(14) {'>'} 15</p>
                    </div>
                    <div className="bg-white/70 rounded-lg p-2.5">
                      <span className="text-amber-600 font-semibold">청산</span>
                      <p className="text-amber-900 mt-0.5">30시간 채널 하단 이탈 또는 4% 트레일링 스탑</p>
                    </div>
                    <div className="bg-white/70 rounded-lg p-2.5">
                      <span className="text-amber-600 font-semibold">포지션 사이징</span>
                      <p className="text-amber-900 mt-0.5">ATR 기반 4% 리스크, 1.75 ATR 손절</p>
                    </div>
                    <div className="bg-white/70 rounded-lg p-2.5">
                      <span className="text-amber-600 font-semibold">피라미딩</span>
                      <p className="text-amber-900 mt-0.5">최대 5단계 불타기, 1 ATR 간격 추가 진입</p>
                    </div>
                  </div>
                  <p className="text-xs text-amber-600 mt-3 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    알고리즘 파라미터는 서버에서만 관리되며 외부에 공개되지 않습니다.
                  </p>
                </div>
              )}

              {/* 항로 로직 */}
              <div className="bg-gray-50 rounded-xl p-5 mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">항로 로직</h3>
                <code className="text-sm text-whale-dark font-mono">{selectedProduct.strategyLogic}</code>
              </div>

              {/* 항로 성과 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-3 bg-red-50 rounded-xl">
                  <div className="text-xs text-gray-500 mb-1">기대 수익률</div>
                  <div className={`text-lg font-bold ${selectedProduct.expectedReturn >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                    {formatPercent(selectedProduct.expectedReturn)}
                  </div>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-xl">
                  <div className="text-xs text-gray-500 mb-1">최대 파고</div>
                  <div className="text-lg font-bold text-blue-600">{formatPercent(selectedProduct.maxDrawdown)}</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-xl">
                  <div className="text-xs text-gray-500 mb-1">승률</div>
                  <div className="text-lg font-bold text-green-600">{selectedProduct.winRate.toFixed(1)}%</div>
                </div>
                <div className="text-center p-3 bg-yellow-50 rounded-xl">
                  <div className="text-xs text-gray-500 mb-1">샤프 비율</div>
                  <div className="text-lg font-bold text-yellow-700">{selectedProduct.sharpeRatio.toFixed(2)}</div>
                </div>
              </div>

              {/* 태그 */}
              <div className="flex flex-wrap gap-2 mb-6">
                {selectedProduct.tags.map((tag) => (
                  <span key={tag} className="px-3 py-1 text-sm bg-whale-light/10 text-whale-light rounded-full font-medium">
                    #{tag}
                  </span>
                ))}
              </div>

              {/* 항해 대상 */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">항해 대상</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedProduct.targetAssets.map((asset) => (
                    <span key={asset} className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg font-medium">
                      {cryptoDisplayName(asset)}
                    </span>
                  ))}
                </div>
              </div>

              {/* 구매 영역 */}
              <div className={`flex items-center justify-between p-5 rounded-xl border ${
                selectedProduct.price > 0
                  ? 'bg-gradient-to-r from-amber-50 to-amber-100/50 border-amber-200'
                  : 'bg-gradient-to-r from-whale-light/5 to-whale-accent/5 border-whale-light/20'
              }`}>
                <div>
                  {selectedProduct.price === 0 ? (
                    <div className="text-2xl font-bold text-green-600">무료</div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 text-xs font-bold bg-amber-400 text-white rounded">PREMIUM</span>
                      <span className="text-2xl font-bold text-whale-dark">{formatCurrency(selectedProduct.price)}</span>
                    </div>
                  )}
                  <div className="text-sm text-gray-500">
                    {selectedProduct.subscribers}척 항해 중 · {selectedProduct.creatorName}
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (!purchasedIds.has(selectedProduct.id)) {
                      openInvestModal(selectedProduct);
                    }
                  }}
                  disabled={purchasedIds.has(selectedProduct.id) || purchasing}
                  className={`px-8 py-3 rounded-xl text-base font-semibold transition-all ${
                    purchasedIds.has(selectedProduct.id)
                      ? 'bg-green-100 text-green-700 cursor-default'
                      : selectedProduct.price === 0
                        ? 'bg-green-500 hover:bg-green-600 text-white'
                        : 'btn-primary'
                  }`}
                >
                  {purchasedIds.has(selectedProduct.id) ? '항해 중' : selectedProduct.price === 0 ? '무료 사용' : '항로 구매'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 투자 금액 입력 모달 */}
        {investModal && !confirmStep && (
          <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={() => setInvestModal(null)}>
            <div
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-whale-dark mb-1">투자 금액 설정</h3>
              <p className="text-sm text-gray-500 mb-5">
                "{investModal.name}" 항로에 투자할 금액을 입력하세요.
                <br />
                <span className="text-xs text-gray-400">
                  투자 금액이 {investModal.targetAssets.length}개 자산({investModal.targetAssets.map(cryptoDisplayName).join(', ')})에 균등 분배됩니다.
                </span>
              </p>

              {/* 금액 입력 */}
              <div className="relative mb-4">
                <input
                  type="text"
                  value={investmentAmount}
                  onChange={(e) => setInvestmentAmount(formatInputAmount(e.target.value))}
                  placeholder="0"
                  className="w-full text-2xl font-bold text-right pr-10 pl-4 py-3 border-2 border-gray-200 rounded-xl focus:border-whale-light focus:ring-2 focus:ring-whale-light/20 outline-none"
                  autoFocus
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">원</span>
              </div>

              {/* 빠른 금액 버튼 */}
              <div className="grid grid-cols-4 gap-2 mb-6">
                {QUICK_AMOUNTS.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setInvestmentAmount(amount.toLocaleString('ko-KR'))}
                    className="py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-whale-light/10 hover:text-whale-light rounded-lg transition-colors"
                  >
                    {amount >= 10000000 ? `${amount / 10000000}천만` : `${amount / 10000}만`}
                  </button>
                ))}
              </div>

              {investModal.price > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-800">
                  전략 이용료: {formatCurrency(investModal.price)} (별도)
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setInvestModal(null)}
                  className="flex-1 py-3 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={goToConfirmStep}
                  disabled={!investmentAmount}
                  className="flex-1 py-3 bg-whale-light hover:bg-whale-dark text-white rounded-xl font-semibold transition-colors disabled:opacity-50"
                >
                  다음
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 구매 최종 확인 모달 */}
        {investModal && confirmStep && (
          <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-full bg-whale-light/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-whale-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-whale-dark">주문 확인</h3>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">항로</span>
                  <span className="text-sm font-semibold text-whale-dark">{investModal.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">총 투자 금액</span>
                  <span className="text-sm font-bold text-whale-dark">{investmentAmount}원</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">투자 대상</span>
                  <span className="text-sm font-medium text-gray-700">{investModal.targetAssets.map(cryptoDisplayName).join(', ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">자산당 배분</span>
                  <span className="text-sm font-medium text-gray-700">
                    ~{formatCurrency(Math.floor(Number(investmentAmount.replace(/,/g, '')) / investModal.targetAssets.length))}
                  </span>
                </div>
                {investModal.price > 0 && (
                  <div className="flex justify-between pt-2 border-t border-gray-200">
                    <span className="text-sm text-amber-700">전략 이용료</span>
                    <span className="text-sm font-bold text-amber-700">{formatCurrency(investModal.price)}</span>
                  </div>
                )}
              </div>

              <div className={`border rounded-lg p-3 mb-5 ${
                investModal.strategyType === 'TURTLE'
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-blue-50 border-blue-200'
              }`}>
                <div className="flex gap-2">
                  <svg className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                    investModal.strategyType === 'TURTLE' ? 'text-amber-500' : 'text-blue-500'
                  }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {investModal.strategyType === 'TURTLE' ? (
                    <div className="text-sm text-amber-800">
                      <p className="font-medium mb-1">시그널 기반 자동매매</p>
                      <p className="text-xs text-amber-600">
                        투자 금액이 각 자산에 배분되며, 즉시 매수하지 않습니다.
                        매 시간 알고리즘이 시그널을 분석하여 최적의 타이밍에 자동으로 진입/청산합니다.
                        포지션이 없는 동안에는 현금으로 대기합니다.
                      </p>
                    </div>
                  ) : (
                    <div className="text-sm text-blue-800">
                      <p className="font-medium mb-1">시장가 즉시 매수</p>
                      <p className="text-xs text-blue-600">
                        현재 시장가로 각 자산이 즉시 매수되며, 포트폴리오에 반영됩니다.
                        실제 체결 금액은 시장 상황에 따라 다를 수 있습니다.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmStep(false)}
                  className="flex-1 py-3 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors"
                >
                  이전
                </button>
                <button
                  onClick={handlePurchase}
                  disabled={purchasing}
                  className="flex-1 py-3 bg-whale-light hover:bg-whale-dark text-white rounded-xl font-semibold transition-colors disabled:opacity-50"
                >
                  {purchasing ? '매수 진행 중...' : '확인, 항해 시작'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 취소 확인 모달 */}
        {cancelTarget && (
          <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-red-700">항해 취소</h3>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">항로</span>
                  <span className="text-sm font-semibold text-whale-dark">{cancelTarget.productName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">투자 금액</span>
                  <span className="text-sm font-bold">{formatCurrency(cancelTarget.investmentAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">보유 자산</span>
                  <span className="text-sm font-medium">{cancelTarget.purchasedAssets?.map(a => `${cryptoDisplayName(a.code)} ${formatQuantity(a.quantity)}개`).join(', ') || '-'}</span>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-5">
                <div className="flex gap-2">
                  <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div className="text-sm text-red-800">
                    <p className="font-semibold mb-1">이 작업은 되돌릴 수 없습니다</p>
                    <p className="text-xs text-red-600">
                      항해를 취소하면 이 항로로 매수한 수량만 <strong>현재 시장가로 즉시 매도</strong>됩니다.
                      개인적으로 추가 매수한 수량은 영향받지 않습니다.
                      시장 상황에 따라 투자 원금보다 손실이 발생할 수 있습니다.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setCancelTarget(null)}
                  className="flex-1 py-3 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors"
                >
                  돌아가기
                </button>
                <button
                  onClick={handleCancel}
                  disabled={cancelling === cancelTarget.id}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-colors disabled:opacity-50"
                >
                  {cancelling === cancelTarget.id ? '매도 진행 중...' : '취소 및 전량 매도'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 빈 상태 */}
        {!loading && products.length === 0 && (
          <div className="text-center py-16">
            <img src="/whales/gray-whale.png" alt="" className="w-20 h-20 object-contain mx-auto mb-4 opacity-60" />
            <div className="text-gray-500 font-medium text-lg">이 해역에 등록된 항로가 없습니다</div>
            <div className="text-sm text-gray-400 mt-1">다른 해역을 탐색해보세요</div>
          </div>
        )}
      </div>
    </div>
  );
};

// 데모 데이터 (백엔드 미연결 시)
function getDemoProducts(): QuantProduct[] {
  return [
    {
      id: 'demo-1', name: '골든크로스 추종 전략',
      description: '20일/60일 이동평균선 골든크로스 발생 시 매수, 데드크로스 시 매도하는 추세추종 전략입니다.',
      creatorId: 'system', creatorName: 'WhaleArc',
      category: 'TREND_FOLLOWING', riskLevel: 'MEDIUM',
      price: 0, expectedReturn: 18.5, maxDrawdown: -12.3,
      sharpeRatio: 1.45, winRate: 58.2, totalTrades: 0, subscribers: 127,
      tags: ['추세추종', '이동평균', '무료'], targetAssets: ['BTC', 'ETH', 'SOL'],
      strategyLogic: 'MA(20) > MA(60) → 매수 / MA(20) < MA(60) → 매도', strategyType: 'SIMPLE' as const,
      active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    },
    {
      id: 'demo-2', name: 'RSI 반전 스캘핑',
      description: 'RSI 과매도 구간 진입 후 반등 시 매수, 과매수 구간 도달 시 매도.',
      creatorId: 'system', creatorName: 'WhaleArc',
      category: 'MEAN_REVERSION', riskLevel: 'HIGH',
      price: 0, expectedReturn: 32.1, maxDrawdown: -18.7,
      sharpeRatio: 1.82, winRate: 64.8, totalTrades: 0, subscribers: 89,
      tags: ['RSI', '스캘핑', '무료'], targetAssets: ['BTC', 'ETH', 'XRP'],
      strategyLogic: 'RSI(14) < 30 → 매수 / RSI(14) > 70 → 매도', strategyType: 'SIMPLE' as const,
      active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    },
    {
      id: 'demo-3', name: '안전 자산 리밸런싱',
      description: 'BTC 60% + ETH 30% + 현금 10% 비율을 매주 리밸런싱하는 보수적 전략.',
      creatorId: 'system', creatorName: 'WhaleArc',
      category: 'MULTI_FACTOR', riskLevel: 'LOW',
      price: 0, expectedReturn: 12.8, maxDrawdown: -8.2,
      sharpeRatio: 1.15, winRate: 72.3, totalTrades: 0, subscribers: 234,
      tags: ['리밸런싱', '안전', '무료'], targetAssets: ['BTC', 'ETH'],
      strategyLogic: '주간 리밸런싱: BTC 60% / ETH 30% / 현금 10%', strategyType: 'SIMPLE' as const,
      active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    },
    {
      id: 'demo-4', name: '터틀 트레이딩',
      description: '리처드 데니스의 전설적인 터틀 트레이딩 전략을 암호화폐 시장에 최적화. 20일 고가 돌파 진입, ATR 기반 포지션 사이징과 피라미딩으로 추세에서 최대 수익을 추구합니다.',
      creatorId: 'system', creatorName: 'WhaleArc',
      category: 'TREND_FOLLOWING', riskLevel: 'MEDIUM',
      price: 500000, expectedReturn: 35.6, maxDrawdown: -14.8,
      sharpeRatio: 2.12, winRate: 42.5, totalTrades: 0, subscribers: 67,
      tags: ['터틀', '돌파', 'ATR', '피라미딩', '프리미엄'], targetAssets: ['BTC', 'ETH', 'SOL', 'AVAX', 'LINK'],
      strategyLogic: '진입: 100h Donchian 상단 돌파 + ADX(14) > 15 / 청산: 30h 채널 이탈 or 트레일링 스탑 4% / 최대 5유닛 피라미딩',
      strategyType: 'TURTLE' as const,
      active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    },
  ];
}

export default QuantStorePage;
