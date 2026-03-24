import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import {
  quantStoreService,
  type QuantProduct,
  type ProductPurchase,
  type Category,
  CATEGORY_LABELS,
  cryptoDisplayName,
  assetDisplayName,
  formatQuantity,
} from '../services/quantStoreService';

// ═══════════════════════════════════════
//  교육 콘텐츠 데이터
// ═══════════════════════════════════════

interface StrategyEdu {
  simpleExplain: string;
  analogy: string;
  howItWorks: string[];
  risk: string;
  bestFor: string;
}

const DIFFICULTY_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
  LOW: { label: '초급', color: 'bg-emerald-100 text-emerald-700', emoji: '🌱' },
  MEDIUM: { label: '중급', color: 'bg-amber-100 text-amber-700', emoji: '🌿' },
  HIGH: { label: '고급', color: 'bg-rose-100 text-rose-700', emoji: '🌳' },
};

const CATEGORY_WHALE: Record<string, { image: string; name: string }> = {
  TREND_FOLLOWING: { image: '/whales/narwhal.png', name: '나르' },
  MOMENTUM: { image: '/whales/dolphin.png', name: '돌핀' },
  MEAN_REVERSION: { image: '/whales/beluga.png', name: '벨루' },
  VOLATILITY: { image: '/whales/orca.png', name: '오르카' },
  ARBITRAGE: { image: '/whales/spotted-dolphin.png', name: '스팟' },
  MULTI_FACTOR: { image: '/whales/blue-whale.png', name: '블루' },
};

const CATEGORY_SIMPLE: Record<string, string> = {
  TREND_FOLLOWING: '가격의 흐름을 따라가는 전략',
  MOMENTUM: '잘 나가는 종목에 올라타는 전략',
  MEAN_REVERSION: '가격이 평균으로 돌아오는 성질을 이용하는 전략',
  VOLATILITY: '가격 변동을 이용해 수익을 내는 전략',
  ARBITRAGE: '가격 차이를 이용해 안전하게 수익을 내는 전략',
  MULTI_FACTOR: '여러 조건을 종합적으로 분석하는 전략',
};

/** 전략 이름 키워드로 교육 콘텐츠 매칭 */
function getStrategyEducation(name: string): StrategyEdu {
  if (name.includes('골든크로스')) return {
    simpleExplain: '단기 이동평균선이 장기 이동평균선을 위로 뚫고 올라갈 때 사는 전략이에요!',
    analogy: '마라톤에서 뒤처졌던 선수가 앞 선수를 추월하는 순간을 포착하는 거예요. 추월하면 그 힘으로 계속 달릴 가능성이 높거든요!',
    howItWorks: [
      '20일 평균 가격과 60일 평균 가격을 매일 비교해요',
      '20일선이 60일선 위로 올라가면 → 매수 신호!',
      '20일선이 60일선 아래로 내려가면 → 매도 신호!',
    ],
    risk: '가짜 교차 신호에 속을 수 있어요. 잠깐 올라갔다 바로 내려가면 손해를 볼 수 있죠.',
    bestFor: '투자를 처음 시작하는 분, 단순하고 명확한 규칙을 좋아하는 분',
  };

  if (name.includes('RSI') && name.includes('반전')) return {
    simpleExplain: 'RSI라는 지표로 "너무 싸졌을 때" 사고 "너무 비싸졌을 때" 파는 전략이에요!',
    analogy: '고무줄을 생각해보세요. 너무 늘리면 다시 줄어들고, 너무 줄이면 다시 늘어나죠. 가격도 똑같아요!',
    howItWorks: [
      'RSI는 0~100 사이 숫자로 가격의 힘을 측정해요',
      'RSI가 30 아래로 떨어지면 → 과매도! → 매수 신호!',
      'RSI가 70 위로 올라가면 → 과매수! → 매도 신호!',
    ],
    risk: '강한 하락장에서는 RSI가 30 아래에서 계속 머물 수 있어요. 떨어지는 칼날을 잡는 격이 될 수 있죠.',
    bestFor: '단기 매매에 관심있는 분, 숫자로 판단하는 것을 좋아하는 분',
  };

  if (name.includes('볼린저')) return {
    simpleExplain: '가격이 좁은 범위에서 움직이다가 갑자기 터져 나올 때 따라가는 전략이에요!',
    analogy: '압력밥솥을 생각해보세요. 오래 눌러놓으면 뚜껑을 열 때 "펑!" 하고 터지죠. 가격도 눌려있다가 폭발해요!',
    howItWorks: [
      '볼린저 밴드가 좁아지는 구간을 찾아요 (수축 구간)',
      '가격이 상단 밴드를 돌파하면 → 매수 신호!',
      '밴드가 좁을수록 돌파 시 큰 움직임이 나와요',
    ],
    risk: '돌파가 가짜일 수 있어요. 잠깐 나갔다 다시 들어오면 손실이 발생해요.',
    bestFor: '큰 움직임을 기다릴 수 있는 인내심 있는 분',
  };

  if (name.includes('리밸런싱') || name.includes('안전')) return {
    simpleExplain: '비트코인과 이더리움을 정해진 비율로 나눠 담고, 주기적으로 비율을 맞춰주는 전략이에요!',
    analogy: '피자를 6:3:1로 나눠 먹기로 했는데, 누가 한 조각 더 먹었으면 다시 원래 비율로 맞추는 거예요!',
    howItWorks: [
      'BTC 60%, ETH 30%, 현금 10%으로 비율을 정해요',
      '매주 비율이 맞는지 확인해요',
      '비율이 틀어졌으면 다시 맞춰요 (리밸런싱)',
    ],
    risk: '급등하는 자산의 비중을 줄이게 되어, 로켓처럼 오르는 수익을 다 못 먹을 수 있어요.',
    bestFor: '안정적인 투자를 원하는 분, 매일 시장을 확인하기 어려운 분',
  };

  if (name.includes('모멘텀 스코어') || name.includes('모멘텀') && !name.includes('듀얼')) return {
    simpleExplain: '최근에 가장 잘 나가는 종목을 찾아서 올라타는 전략이에요!',
    analogy: '학교에서 1등 하는 친구의 공부법을 따라하면 성적이 오르듯, 잘 나가는 종목을 따라가면 수익이 오를 확률이 높아요!',
    howItWorks: [
      '7일, 30일, 90일 수익률을 각각 계산해요',
      '점수가 가장 높은 종목을 선택해요',
      '주기적으로 순위를 다시 매겨서 교체해요',
    ],
    risk: '이미 많이 오른 뒤에 올라타면 고점에 물릴 수 있어요.',
    bestFor: '트렌드를 따라가는 것을 좋아하는 분, 적극적인 투자자',
  };

  if (name.includes('김프') || name.includes('차익거래')) return {
    simpleExplain: '한국 거래소와 해외 거래소의 가격 차이로 수익을 내는 전략이에요!',
    analogy: '같은 운동화가 미국에서 10만원, 한국에서 12만원이면 미국에서 사서 한국에서 파는 것과 같아요!',
    howItWorks: [
      '국내 거래소와 해외 거래소 가격을 실시간 비교해요',
      '가격 차이(김프)가 일정 수준 이상이면 거래!',
      '차이가 줄어들면 수익 확정!',
    ],
    risk: '환율 변동, 송금 시간, 거래 수수료를 고려해야 해요.',
    bestFor: '안정적인 수익을 원하는 분, 위험을 최소화하고 싶은 분',
  };

  if (name.includes('MACD')) return {
    simpleExplain: '가격은 내려가는데 MACD 지표는 올라갈 때, 곧 반등한다고 보고 매수하는 전략이에요!',
    analogy: '공을 바닥에 던지면 점점 약하게 튀다가 멈추죠? 가격도 그렇게 약해지면 곧 방향이 바뀔 거라고 예측해요!',
    howItWorks: [
      '가격의 움직임과 MACD 지표의 움직임을 비교해요',
      '둘이 반대로 움직이면 → 다이버전스 발생!',
      '다이버전스가 나타나면 추세 반전을 예상하고 진입해요',
    ],
    risk: '다이버전스가 나타나도 추세가 계속 이어질 수 있어요. 타이밍이 중요해요.',
    bestFor: '차트 분석에 관심있는 분, 반전 타이밍을 잡고 싶은 분',
  };

  if (name.includes('래리 코너스') || name.includes('RSI(2)')) return {
    simpleExplain: '2일이라는 아주 짧은 기간의 RSI를 사용해서 빠르게 사고파는 전략이에요!',
    analogy: '서핑에서 작은 파도를 빠르게 타고 내리는 것처럼, 짧은 가격 변동을 재빠르게 잡는 거예요!',
    howItWorks: [
      '200일 이동평균 위에 있는 종목만 골라요 (상승 추세 확인)',
      'RSI(2)가 5 이하로 떨어지면 → 매수!',
      'RSI(2)가 다시 올라오면 → 매도!',
    ],
    risk: '매우 짧은 기간의 매매라 거래 수수료가 수익을 깎을 수 있어요.',
    bestFor: '빠른 매매를 좋아하는 분, 단기 수익에 관심있는 분',
  };

  if (name.includes('래리 윌리엄스') || name.includes('변동성 돌파')) return {
    simpleExplain: '전날의 가격 변동폭을 이용해서, 오늘 가격이 일정 이상 오르면 바로 사는 전략이에요!',
    analogy: '어제 파도가 1미터였으면, 오늘 파도가 0.5미터 이상 올라오면 올라타는 거예요!',
    howItWorks: [
      '전날의 고가 - 저가 = 변동폭을 계산해요',
      '오늘 시가 + (변동폭 × k) 이상 오르면 → 매수!',
      '다음날 시가에 무조건 매도해요',
    ],
    risk: '매일 매매하므로 수수료가 쌓일 수 있고, 횡보장에서 수익이 적어요.',
    bestFor: '매일 적극적으로 매매하고 싶은 분, 규칙적인 매매를 좋아하는 분',
  };

  if (name.includes('듀얼 모멘텀')) return {
    simpleExplain: '절대 모멘텀과 상대 모멘텀, 두 가지를 동시에 체크하는 전략이에요!',
    analogy: '시험 점수가 지난번보다 올랐는지(절대), 반 평균보다 높은지(상대) 두 가지를 다 확인하는 거예요!',
    howItWorks: [
      '절대 모멘텀: 지난달보다 올랐는지 확인해요',
      '상대 모멘텀: 다른 종목보다 더 올랐는지 비교해요',
      '둘 다 통과한 종목만 투자해요!',
    ],
    risk: '추세 전환이 늦게 감지되어 초반 손실이 있을 수 있어요.',
    bestFor: '체계적이고 규칙적인 투자를 원하는 분',
  };

  if (name.includes('미너비니') || name.includes('트렌드 템플릿')) return {
    simpleExplain: '강한 상승 추세에 있으면서 변동성이 줄어드는 종목을 찾아 투자하는 전략이에요!',
    analogy: '스프링이 점점 압축되다가 "펑!" 하고 튀어오르는 순간을 잡는 거예요!',
    howItWorks: [
      '150일, 200일 이동평균 위에 있는 종목을 찾아요',
      '52주 최고가에 근접한 종목을 골라요',
      '변동성이 줄어드는(VCP) 패턴이 나타나면 → 매수!',
    ],
    risk: '패턴을 정확히 판별하기 어렵고, 돌파 실패 시 손실이 커요.',
    bestFor: '성장주 투자에 관심있는 분, 차트 패턴 분석을 좋아하는 분',
  };

  if (name.includes('터틀') || name.includes('Turtle') || name.includes('turtle')) return {
    simpleExplain: '전설적인 터틀 트레이딩을 암호화폐에 맞게 개량한 WhaleArc만의 독점 전략이에요!',
    analogy: '100일 동안의 최고가를 넘어서면 큰 파도가 온다고 보고 올라타는 거예요. 거북이처럼 느리지만 확실하게!',
    howItWorks: [
      '100시간 동안의 최고가를 돌파하면 → 매수 신호!',
      'ADX 지표로 추세의 강도도 확인해요',
      '최대 5번까지 추가 매수(피라미딩)할 수 있어요',
      '30시간 최저가를 깨면 → 자동 매도!',
    ],
    risk: '추세가 없는 횡보장에서는 잦은 손절이 발생할 수 있어요.',
    bestFor: '장기적 추세를 따라가고 싶은 분, WhaleArc 독점 전략을 경험하고 싶은 분',
  };

  // 기본 fallback
  return {
    simpleExplain: '데이터를 분석해서 최적의 매매 타이밍을 찾는 퀀트 전략이에요!',
    analogy: '날씨 예보처럼, 과거 데이터 패턴을 분석해서 미래 가격 움직임을 예측하는 거예요!',
    howItWorks: [
      '과거 가격 데이터를 분석해요',
      '특정 조건이 충족되면 매수 또는 매도해요',
      '감정이 아닌 규칙에 따라 투자해요',
    ],
    risk: '과거 성과가 미래를 보장하지 않아요. 시장 환경이 변하면 전략도 안 통할 수 있어요.',
    bestFor: '감정적 투자에서 벗어나고 싶은 분',
  };
}

// ═══════════════════════════════════════
//  컴포넌트
// ═══════════════════════════════════════

const ALL_CATEGORIES: (Category | 'ALL')[] = [
  'ALL', 'TREND_FOLLOWING', 'MOMENTUM', 'MEAN_REVERSION', 'VOLATILITY', 'ARBITRAGE', 'MULTI_FACTOR',
];

const CATEGORY_TAB_LABELS: Record<string, string> = {
  ALL: '전체',
  TREND_FOLLOWING: '추세추종',
  MOMENTUM: '모멘텀',
  MEAN_REVERSION: '평균회귀',
  VOLATILITY: '변동성',
  ARBITRAGE: '차익거래',
  MULTI_FACTOR: '멀티팩터',
};

const QuantStorePage = () => {
  const navigate = useNavigate();
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

  useEffect(() => { loadProducts(); loadPurchases(); }, []);
  useEffect(() => { loadProducts(); }, [selectedCategory]);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const category = selectedCategory === 'ALL' ? undefined : selectedCategory;
      const data = await quantStoreService.getProducts(category);
      setProducts(data);
    } catch { setProducts([]); }
    finally { setLoading(false); }
  };

  const loadPurchases = async () => {
    try {
      const result = await quantStoreService.getMyPurchases();
      setPurchasedIds(new Set(result.purchasedProductIds));
      setPurchases(result.purchases.filter((p) => p.status === 'ACTIVE'));
    } catch { /* 비로그인 */ }
  };

  const openInvestModal = (product: QuantProduct) => {
    if (purchasedIds.has(product.id)) return;
    setInvestModal(product);
    setInvestmentAmount('');
    setConfirmStep(false);
  };

  const goToConfirmStep = () => {
    const amount = Number(investmentAmount.replace(/,/g, ''));
    if (!amount || amount <= 0) { alert('투자 금액을 입력해주세요.'); return; }
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
    } finally { setPurchasing(false); }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(cancelTarget.id);
    try {
      await quantStoreService.cancelPurchase(cancelTarget.id);
      setPurchasedIds((prev) => { const next = new Set(prev); next.delete(cancelTarget.productId); return next; });
      setCancelTarget(null);
      await loadPurchases();
    } catch (err: any) {
      alert(err.response?.data?.message || '취소에 실패했습니다.');
    } finally { setCancelling(null); }
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', minimumFractionDigits: 0 }).format(v);

  const formatInputAmount = (raw: string) => {
    const num = raw.replace(/[^0-9]/g, '');
    if (!num) return '';
    return Number(num).toLocaleString('ko-KR');
  };

  const QUICK_AMOUNTS = [1000000, 3000000, 5000000, 10000000];

  // ── 말풍선 컴포넌트 ──
  const WhaleBubble = ({ whale, name, children, size = 'md' }: {
    whale: string; name: string; children: React.ReactNode; size?: 'sm' | 'md';
  }) => (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 flex flex-col items-center">
        <div className={`${size === 'sm' ? 'w-10 h-10' : 'w-12 h-12'} rounded-full bg-gradient-to-br from-sky-50 to-blue-100 p-1.5 shadow-sm border border-sky-200`}>
          <img src={whale} alt={name} className="w-full h-full object-contain" />
        </div>
        <span className="text-[10px] text-gray-400 mt-0.5 font-medium">{name}</span>
      </div>
      <div className="relative bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm max-w-[calc(100%-4rem)]">
        <div className="absolute -left-[7px] top-3 w-0 h-0 border-t-[6px] border-t-transparent border-r-[7px] border-r-gray-200 border-b-[6px] border-b-transparent" />
        <div className="absolute -left-[5px] top-[13px] w-0 h-0 border-t-[5px] border-t-transparent border-r-[6px] border-r-white border-b-[5px] border-b-transparent" />
        {children}
      </div>
    </div>
  );

  const QuestionBubble = ({ children }: { children: React.ReactNode }) => (
    <div className="flex justify-end">
      <div className="bg-gradient-to-r from-whale-light to-whale-dark text-white rounded-2xl rounded-tr-sm px-4 py-2.5 shadow-sm max-w-[80%]">
        <p className="text-sm font-medium">{children}</p>
      </div>
    </div>
  );

  const getWhale = (product: QuantProduct) =>
    CATEGORY_WHALE[product.category] || { image: '/whales/narwhal.png', name: '나르' };

  // ═══════════════════════════════════════
  //  렌더링
  // ═══════════════════════════════════════

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50/50 via-white to-sky-50/30">
      <Header showNav={true} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ── 헤더 ── */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-sky-100 to-blue-200 p-2 shadow-md">
              <img src="/whales/narwhal.png" alt="" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-whale-dark">항로 교실</h1>
          </div>
          <p className="text-gray-500 text-sm md:text-base max-w-xl mx-auto leading-relaxed">
            각 전략을 고래 선생님이 쉽게 알려드려요!<br className="hidden md:inline" />
            마음에 드는 전략이 있다면 직접 항해도 시작할 수 있어요.
          </p>
        </div>

        {/* ── 내 항해 현황 ── */}
        {purchases.length > 0 && (
          <div className="mb-8 bg-white rounded-xl border border-sky-100 p-5 shadow-sm">
            <h2 className="text-base font-bold text-whale-dark mb-3 flex items-center gap-2">
              <span className="text-lg">⛵</span> 내 항해 현황
            </h2>
            <div className="space-y-2">
              {purchases.map((p) => (
                <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-sky-50/50 rounded-lg p-3 gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-whale-dark text-sm">{p.productName}</div>
                    <div className="text-xs text-gray-500 truncate">
                      투자: {formatCurrency(p.investmentAmount)} · {p.purchasedAssets?.map(a => `${cryptoDisplayName(a.code)} ${formatQuantity(a.quantity)}개`).join(', ') || '-'}
                    </div>
                  </div>
                  <button
                    onClick={() => setCancelTarget(p)}
                    disabled={cancelling === p.id}
                    className="px-4 py-2 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {cancelling === p.id ? '취소 중...' : '항해 취소'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 카테고리 필터 ── */}
        <div className="flex flex-wrap gap-2 mb-8 justify-center">
          {ALL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                selectedCategory === cat
                  ? 'bg-whale-light text-white shadow-md scale-105'
                  : 'bg-white text-gray-500 hover:bg-sky-50 border border-gray-200 hover:border-sky-300'
              }`}
            >
              {CATEGORY_TAB_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* ── 카테고리 설명 ── */}
        {selectedCategory !== 'ALL' && (
          <div className="mb-6 flex justify-center">
            <div className="inline-flex items-center gap-2 bg-white border border-sky-100 rounded-full px-5 py-2 shadow-sm">
              <img src={CATEGORY_WHALE[selectedCategory]?.image} alt="" className="w-6 h-6 object-contain" />
              <span className="text-sm text-gray-600">{CATEGORY_SIMPLE[selectedCategory]}</span>
            </div>
          </div>
        )}

        {/* ── 카드 그리드 ── */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-6 animate-pulse shadow-sm border border-gray-100">
                <div className="h-5 bg-gray-200 rounded-full w-1/3 mb-4" />
                <div className="h-6 bg-gray-200 rounded w-3/4 mb-4" />
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 bg-gray-200 rounded-full" />
                  <div className="flex-1 bg-gray-100 rounded-2xl h-16" />
                </div>
                <div className="h-10 bg-gray-200 rounded-xl" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => {
              const whale = getWhale(product);
              const edu = getStrategyEducation(product.name);
              const diff = DIFFICULTY_CONFIG[product.riskLevel] || DIFFICULTY_CONFIG.MEDIUM;
              const isPurchased = purchasedIds.has(product.id);

              return (
                <div
                  key={product.id}
                  className="group bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-lg hover:border-sky-200 hover:-translate-y-1 transition-all cursor-pointer relative"
                  onClick={() => setSelectedProduct(product)}
                >
                  {/* 뱃지 */}
                  <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                    <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${diff.color}`}>
                      {diff.emoji} {diff.label}
                    </span>
                    <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-sky-50 text-sky-600">
                      {CATEGORY_LABELS[product.category]}
                    </span>
                    {product.assetType === 'STOCK' ? (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-50 text-indigo-500">주식</span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-50 text-emerald-500">가상화폐</span>
                    )}
                    {product.strategyType === 'TURTLE' && (
                      <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-gradient-to-r from-amber-400 to-orange-400 text-white">독점</span>
                    )}
                  </div>

                  {/* 전략명 */}
                  <h3 className="text-lg font-bold text-whale-dark mb-3 group-hover:text-whale-light transition-colors">
                    {product.name}
                  </h3>

                  {/* 고래 말풍선 */}
                  <div className="mb-4">
                    <WhaleBubble whale={whale.image} name={whale.name} size="sm">
                      <p className="text-sm text-gray-700 leading-relaxed">{edu.simpleExplain}</p>
                    </WhaleBubble>
                  </div>

                  {/* 대상 자산 */}
                  <div className="flex flex-wrap gap-1 mb-4">
                    {product.targetAssets.map((asset) => (
                      <span key={asset} className="px-2 py-0.5 text-xs bg-gray-50 text-gray-500 rounded-md">
                        {assetDisplayName(asset, product.assetType)}
                      </span>
                    ))}
                  </div>

                  {/* 버튼 */}
                  <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedProduct(product); }}
                      className="flex-1 py-2.5 text-sm font-semibold text-whale-light bg-sky-50 hover:bg-sky-100 rounded-xl transition-colors"
                    >
                      📚 알아보기
                    </button>
                    {isPurchased ? (
                      <span className="px-4 py-2.5 text-sm font-semibold text-emerald-600 bg-emerald-50 rounded-xl">
                        항해 중 ⛵
                      </span>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); openInvestModal(product); }}
                        className="px-4 py-2.5 text-sm font-semibold text-white bg-whale-light hover:bg-whale-dark rounded-xl transition-colors"
                      >
                        항해하기
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ═══ 교육 상세 모달 ═══ */}
        {selectedProduct && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedProduct(null)}>
            <div
              className="bg-gradient-to-b from-sky-50 to-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 모달 헤더 */}
              <div className="sticky top-0 bg-gradient-to-b from-sky-50 to-sky-50/80 backdrop-blur-sm px-5 pt-5 pb-3 z-10">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${(DIFFICULTY_CONFIG[selectedProduct.riskLevel] || DIFFICULTY_CONFIG.MEDIUM).color}`}>
                      {(DIFFICULTY_CONFIG[selectedProduct.riskLevel] || DIFFICULTY_CONFIG.MEDIUM).emoji}{' '}
                      {(DIFFICULTY_CONFIG[selectedProduct.riskLevel] || DIFFICULTY_CONFIG.MEDIUM).label}
                    </span>
                    <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-sky-100 text-sky-600">
                      {CATEGORY_LABELS[selectedProduct.category]}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedProduct(null)}
                    className="p-2 hover:bg-white/80 rounded-full transition-colors"
                    aria-label="닫기"
                  >
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <h2 className="text-xl font-bold text-whale-dark">{selectedProduct.name}</h2>
              </div>

              {/* 대화형 교육 콘텐츠 */}
              <div className="px-5 pb-5 space-y-4">
                {(() => {
                  const whale = getWhale(selectedProduct);
                  const edu = getStrategyEducation(selectedProduct.name);

                  return (
                    <>
                      {/* 인사 */}
                      <WhaleBubble whale={whale.image} name={whale.name}>
                        <p className="text-sm text-gray-700">
                          안녕! 나는 <strong className="text-whale-light">{whale.name}</strong>이야. 이 전략에 대해 쉽게 알려줄게! 😊
                        </p>
                      </WhaleBubble>

                      {/* Q1: 이 전략이 뭐예요? */}
                      <QuestionBubble>이 전략이 뭐예요? 🤔</QuestionBubble>
                      <WhaleBubble whale={whale.image} name={whale.name}>
                        <p className="text-sm text-gray-700 leading-relaxed">{edu.simpleExplain}</p>
                      </WhaleBubble>

                      {/* Q2: 쉽게 설명해주세요 */}
                      <QuestionBubble>좀 더 쉽게 설명해주세요!</QuestionBubble>
                      <WhaleBubble whale={whale.image} name={whale.name}>
                        <p className="text-sm text-gray-700 leading-relaxed">💡 {edu.analogy}</p>
                      </WhaleBubble>

                      {/* Q3: 어떻게 작동해요? */}
                      <QuestionBubble>구체적으로 어떻게 작동해요?</QuestionBubble>
                      <WhaleBubble whale={whale.image} name={whale.name}>
                        <div className="space-y-2">
                          {edu.howItWorks.map((step, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-sky-100 text-sky-600 text-xs font-bold flex items-center justify-center mt-0.5">
                                {i + 1}
                              </span>
                              <p className="text-sm text-gray-700">{step}</p>
                            </div>
                          ))}
                        </div>
                      </WhaleBubble>

                      {/* Q4: 위험한 건 없어요? */}
                      <QuestionBubble>위험한 건 없어요? 😥</QuestionBubble>
                      <WhaleBubble whale={whale.image} name={whale.name}>
                        <div className="bg-rose-50 rounded-lg p-3 border border-rose-100">
                          <p className="text-sm text-rose-700 leading-relaxed">⚠️ {edu.risk}</p>
                        </div>
                      </WhaleBubble>

                      {/* Q5: 어떤 분에게 맞아요? */}
                      <QuestionBubble>어떤 사람에게 맞는 전략이에요?</QuestionBubble>
                      <WhaleBubble whale={whale.image} name={whale.name}>
                        <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                          <p className="text-sm text-emerald-700 leading-relaxed">🎯 {edu.bestFor}</p>
                        </div>
                      </WhaleBubble>

                      {/* 대상 자산 */}
                      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">투자 대상</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedProduct.targetAssets.map((asset) => (
                            <span key={asset} className="px-3 py-1 text-sm bg-gray-50 text-gray-700 rounded-lg font-medium border border-gray-100">
                              {assetDisplayName(asset, selectedProduct.assetType)}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* 태그 */}
                      {selectedProduct.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {selectedProduct.tags.map((tag) => (
                            <span key={tag} className="px-2.5 py-1 text-xs bg-sky-50 text-sky-500 rounded-full font-medium">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* 하단 CTA */}
                      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm space-y-3">
                        {/* 백테스트 유도 */}
                        <button
                          onClick={() => { setSelectedProduct(null); navigate('/strategy'); }}
                          className="w-full py-3 text-sm font-semibold text-sky-600 bg-sky-50 hover:bg-sky-100 rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          이 전략으로 백테스트 해보기
                        </button>

                        {/* 항해 시작 */}
                        {purchasedIds.has(selectedProduct.id) ? (
                          <div className="w-full py-3 text-sm font-semibold text-center text-emerald-600 bg-emerald-50 rounded-xl">
                            ⛵ 이미 항해 중인 전략이에요!
                          </div>
                        ) : (
                          <button
                            onClick={() => openInvestModal(selectedProduct)}
                            className="w-full py-3 text-sm font-semibold text-white bg-gradient-to-r from-whale-light to-whale-dark hover:opacity-90 rounded-xl transition-all shadow-md"
                          >
                            이 전략으로 항해 시작하기 🚀
                          </button>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* ═══ 투자 금액 입력 모달 ═══ */}
        {investModal && !confirmStep && (
          <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={() => setInvestModal(null)}>
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-xl font-bold text-whale-dark mb-1">투자 금액 설정</h3>
              <p className="text-sm text-gray-500 mb-5">
                "{investModal.name}" 항로에 투자할 금액을 입력하세요.
                <br />
                <span className="text-xs text-gray-400">
                  투자 금액이 {investModal.targetAssets.length}개 자산({investModal.targetAssets.map(cryptoDisplayName).join(', ')})에 균등 분배됩니다.
                </span>
              </p>

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

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
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
                <button onClick={() => setInvestModal(null)} className="flex-1 py-3 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors">
                  취소
                </button>
                <button onClick={goToConfirmStep} disabled={!investmentAmount} className="flex-1 py-3 bg-whale-light hover:bg-whale-dark text-white rounded-xl font-semibold transition-colors disabled:opacity-50">
                  다음
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ 구매 최종 확인 모달 ═══ */}
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

              <div className={`border rounded-lg p-3 mb-5 ${investModal.strategyType === 'TURTLE' ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
                <div className="flex gap-2">
                  <svg className={`w-5 h-5 flex-shrink-0 mt-0.5 ${investModal.strategyType === 'TURTLE' ? 'text-amber-500' : 'text-blue-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {investModal.strategyType === 'TURTLE' ? (
                    <div className="text-sm text-amber-800">
                      <p className="font-medium mb-1">시그널 기반 자동매매</p>
                      <p className="text-xs text-amber-600">
                        투자 금액이 각 자산에 배분되며, 즉시 매수하지 않습니다.
                        매 시간 알고리즘이 시그널을 분석하여 최적의 타이밍에 자동으로 진입/청산합니다.
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
                <button onClick={() => setConfirmStep(false)} className="flex-1 py-3 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors">이전</button>
                <button onClick={handlePurchase} disabled={purchasing} className="flex-1 py-3 bg-whale-light hover:bg-whale-dark text-white rounded-xl font-semibold transition-colors disabled:opacity-50">
                  {purchasing ? '매수 진행 중...' : '확인, 항해 시작'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ 취소 확인 모달 ═══ */}
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
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setCancelTarget(null)} className="flex-1 py-3 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors">돌아가기</button>
                <button onClick={handleCancel} disabled={cancelling === cancelTarget.id} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-colors disabled:opacity-50">
                  {cancelling === cancelTarget.id ? '매도 진행 중...' : '취소 및 전량 매도'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── 빈 상태 ── */}
        {!loading && products.length === 0 && (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-full bg-sky-50 mx-auto mb-4 flex items-center justify-center">
              <img src="/whales/gray-whale.png" alt="" className="w-14 h-14 object-contain opacity-60" />
            </div>
            <div className="text-gray-500 font-medium text-lg">이 카테고리에 등록된 전략이 없어요</div>
            <div className="text-sm text-gray-400 mt-1">다른 카테고리를 탐색해보세요!</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuantStorePage;
