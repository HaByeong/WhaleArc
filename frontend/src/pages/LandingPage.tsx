import { Link, useNavigate } from 'react-router-dom';
import WhaleTailLogo from '../components/WhaleTailLogo';
import { useAuth } from '../contexts/AuthContext';

const LandingPage = () => {
  const navigate = useNavigate();
  const { session } = useAuth();

  const handleFeatureClick = (path: string) => {
    if (!session) {
      navigate('/login', {
        state: {
          from: path,
          message: '항해를 시작하려면 먼저 로그인해주세요.'
        }
      });
      return;
    }
    navigate(path);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-whale-dark">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-2">
              <WhaleTailLogo size={40} />
              <span className="text-xl ml-1 whalearc-text">WHALEARC</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-400 text-white">BETA</span>
            </Link>
            
            {session ? (
              <Link
                to="/dashboard"
                className="px-6 py-2 bg-whale-light border border-whale-light text-white font-semibold rounded-lg hover:bg-whale-accent transition-colors"
              >
                대시보드
              </Link>
            ) : (
              <Link
                to="/login"
                className="px-6 py-2 bg-whale-light border border-whale-light text-white font-semibold rounded-lg hover:bg-whale-accent transition-colors"
              >
                시작하기
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="relative bg-whale-dark text-white min-h-[75vh] flex items-center overflow-hidden">
        {/* 배경 그라데이션 효과 */}
        <div className="absolute inset-0 bg-gradient-to-br from-whale-dark via-blue-900 to-whale-dark opacity-90"></div>
        
        {/* 배경 장식 요소 */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-whale-light opacity-5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-whale-accent opacity-5 rounded-full blur-3xl"></div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-12 lg:py-20">
          {/* 모바일: 세로 배치 (텍스트 위, 고래 아래) */}
          <div className="flex flex-col lg:hidden items-center text-center space-y-8">
            {/* Text */}
            <div className="space-y-6 w-full">
              <h1 className="text-4xl sm:text-5xl font-bold leading-tight animate-fade-in" style={{ fontFamily: "'Quicksand', sans-serif" }}>
                고래처럼,<br />
                <span className="text-whale-light">시장을 유영하듯</span>
              </h1>
              <p className="text-lg sm:text-xl text-blue-200">
                실시간 시세 데이터와 포트폴리오 분석으로<br />
                나만의 투자 전략을 실험해보세요
              </p>
              <button
                onClick={() => handleFeatureClick('/dashboard')}
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-whale-light text-white font-bold text-lg rounded-xl hover:bg-whale-accent transition-all duration-300 shadow-lg hover:shadow-whale-light/30 hover:-translate-y-0.5"
              >
                항해 시작하기
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            </div>
            
            {/* Whale Illustration - 모바일에서 적당한 크기 */}
            <div className="flex justify-center items-center w-full mt-4">
              <div className="relative w-full max-w-xs">
                {/* 더 강한 글로우 효과 - 여러 색상 레이어 */}
                <div className="absolute inset-0 bg-whale-light opacity-20 rounded-full blur-3xl animate-pulse scale-150" style={{ willChange: 'opacity' }}></div>
                <div className="absolute inset-0 bg-whale-accent opacity-12 rounded-full blur-2xl animate-pulse scale-125" style={{ animationDelay: '0.5s', willChange: 'opacity' }}></div>
                <img
                  src="/whale-hero.png"
                  alt="WhaleArc Whale Illustration"
                  className="relative w-full h-auto object-contain animate-whale-swim"
                  style={{
                    filter: 'drop-shadow(0 0 25px rgba(74, 144, 226, 0.35)) drop-shadow(0 0 50px rgba(74, 144, 226, 0.15))',
                    transformOrigin: 'center center',
                    willChange: 'transform',
                    backfaceVisibility: 'hidden',
                  }}
                />
              </div>
            </div>
          </div>

          {/* 데스크톱: 가로 배치 (텍스트 왼쪽, 고래 오른쪽) - 기존 유지 */}
          <div className="hidden lg:flex items-center justify-between gap-12">
            {/* Left: Text */}
            <div className="flex-1 space-y-6">
              <h1 className="text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold leading-tight animate-fade-in" style={{ fontFamily: "'Quicksand', sans-serif" }}>
                고래처럼,<br />
                <span className="text-whale-light whitespace-nowrap">시장을 유영하듯</span>
              </h1>
              <p className="text-xl md:text-2xl text-blue-200 max-w-2xl">
                실시간 시세 데이터와 포트폴리오 분석으로<br />
                나만의 투자 전략을 실험해보세요
              </p>
              <button
                onClick={() => handleFeatureClick('/dashboard')}
                className="inline-flex items-center gap-2 px-10 py-4 bg-whale-light text-white font-bold text-lg rounded-xl hover:bg-whale-accent transition-all duration-300 shadow-lg hover:shadow-whale-light/30 hover:-translate-y-0.5"
              >
                항해 시작하기
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            </div>
            
            {/* Right: Whale Illustration */}
            <div className="flex-1 flex justify-center items-center">
              <div className="relative w-full">
                {/* 더 강한 글로우 효과 - 여러 색상 레이어 */}
                <div className="absolute inset-0 bg-whale-light opacity-20 rounded-full blur-3xl animate-pulse scale-150" style={{ willChange: 'opacity' }}></div>
                <div className="absolute inset-0 bg-whale-accent opacity-12 rounded-full blur-2xl animate-pulse scale-125" style={{ animationDelay: '0.5s', willChange: 'opacity' }}></div>
                <img
                  src="/whale-hero.png"
                  alt="WhaleArc Whale Illustration"
                  className="relative w-full max-w-3xl h-auto object-contain animate-whale-swim hover:scale-105 transition-transform duration-500"
                  style={{
                    filter: 'drop-shadow(0 0 25px rgba(74, 144, 226, 0.35)) drop-shadow(0 0 50px rgba(74, 144, 226, 0.15))',
                    transformOrigin: 'center center',
                    willChange: 'transform',
                    backfaceVisibility: 'hidden',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Cards Section */}
      <div className="bg-gradient-to-b from-white to-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-whale-dark mb-4">
              핵심 기능
            </h2>
            <p className="text-gray-600 text-lg">
              WhaleArc의 강력한 기능들을 경험해보세요
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: '실시간 시세',
                desc: '실시간 시세 데이터를 한눈에 확인',
                icon: (
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 18l6-6 4 4 8-8" strokeWidth={2.5} />
                    <circle cx="21" cy="10" r="2" fill="currentColor" />
                  </svg>
                ),
              },
              {
                title: '모의투자 거래',
                desc: '실제 돈 없이 매수·매도를 체험',
                icon: (
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                ),
              },
              {
                title: '항로 상점',
                desc: '검증된 퀀트 전략을 구매하고 자동 투자',
                icon: (
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                ),
              },
              {
                title: '포트폴리오 관리',
                desc: '자산 배분, 수익률, 항로 성과를 한눈에',
                icon: (
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                  </svg>
                ),
              },
              {
                title: '투자 현황',
                desc: '다른 투자자의 대표 항로와 수익률 비교',
                icon: (
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                ),
              },
              {
                title: '전략 백테스트',
                desc: '과거 데이터로 전략 검증 및 수익률 분석',
                icon: (
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                ),
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="group card text-center hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 border border-gray-100 hover:border-whale-light"
              >
                <div className="w-16 h-16 bg-gradient-to-br from-whale-light to-whale-accent rounded-xl mx-auto mb-4 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-bold text-whale-dark mb-1.5 group-hover:text-whale-light transition-colors">
                  {feature.title}
                </h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 용어 가이드 섹션 */}
      <div className="bg-whale-dark text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-3" style={{ fontFamily: "'Quicksand', sans-serif" }}>
              <span className="text-whale-light">WhaleArc</span> 용어 가이드
            </h2>
            <p className="text-blue-200 text-lg">
              투자의 세계를 고래의 항해에 빗대어 표현합니다
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: '/whales/narwhal.png',
                term: '항로',
                meaning: '퀀트 트레이딩 전략',
                desc: '과거 데이터로 백테스트를 거친 검증된 자동 투자 전략. 항로를 따라가면 전략대로 자동 매매됩니다.',
              },
              {
                icon: '/whales/sperm-whale.png',
                term: '항해',
                meaning: '전략 기반 투자 실행',
                desc: '항로를 구매하고 투자금을 설정하면 항해가 시작됩니다. 항해 중 = 전략 운용 중.',
              },
              {
                icon: '/whales/humpback.png',
                term: '파고',
                meaning: '최대 낙폭 (MDD)',
                desc: '항해 중 만날 수 있는 가장 큰 파도. 최고점 대비 최대 하락 폭입니다.',
              },
              {
                icon: '/whales/blue-whale.png',
                term: '유영',
                meaning: '시장 탐색 · 분석',
                desc: '실시간 시세를 확인하고 시장 흐름을 분석하는 과정. 시세 페이지에서 유영할 수 있습니다.',
              },
              {
                icon: '/whales/dolphin.png',
                term: '항로 상점',
                meaning: '전략 마켓플레이스',
                desc: '다양한 퀀트 전략(항로)을 탐색하고 구매할 수 있는 공간입니다.',
              },
              {
                icon: '/whales/orca.png',
                term: '항해 중',
                meaning: '전략 운용 상태',
                desc: '구매한 항로가 활성화되어 자동 매매가 진행되고 있는 상태입니다.',
              },
              {
                icon: '/whales/beluga.png',
                term: '포트폴리오',
                meaning: '나의 투자 현황',
                desc: '보유 자산, 수익률, 현금 잔고 등 전체 투자 현황을 한눈에 볼 수 있습니다.',
              },
              {
                icon: '/whales/risso-dolphin.png',
                term: '선원',
                meaning: 'WhaleArc 사용자',
                desc: '바다 위의 투자자. 회원가입하면 선원이 되어 항해를 시작할 수 있습니다.',
              },
              {
                icon: '/whales/gray-whale.png',
                term: '해류',
                meaning: '시장 추세 · 흐름',
                desc: '시장의 전체적인 방향성. 해류를 읽어야 좋은 항로를 선택할 수 있습니다.',
              },
            ].map((item) => (
              <div
                key={item.term}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-3 mb-3">
                  <img src={item.icon} alt={item.term} className="w-10 h-10 object-contain"
/>
                  <div>
                    <span className="text-lg font-bold text-white">{item.term}</span>
                    <span className="mx-2 text-white/30">=</span>
                    <span className="text-sm font-medium text-whale-light">{item.meaning}</span>
                  </div>
                </div>
                <p className="text-sm text-blue-200/80 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;

