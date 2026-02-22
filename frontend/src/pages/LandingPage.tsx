import { Link, useNavigate } from 'react-router-dom';

const LandingPage = () => {
  const navigate = useNavigate();

  const handleFeatureClick = (path: string) => {
    // 로그인 상태 확인 (localStorage 직접 확인)
    const accessToken = localStorage.getItem('accessToken');
    const isAuthenticated = !!accessToken;
    
    // 로그인하지 않은 경우 무조건 로그인 페이지로 이동
    if (!isAuthenticated) {
      navigate('/login', { 
        state: { 
          from: path, 
          message: '로그인이 필요한 기능입니다. 로그인해주세요.' 
        } 
      });
      return;
    }
    
    // 로그인한 경우에만 해당 페이지로 이동
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
              <div className="relative">
                <div className="absolute inset-0 bg-whale-light opacity-30 rounded-full blur-lg scale-150"></div>
                <img 
                  src="/whale-tail-logo.png" 
                  alt="WhaleArc Logo" 
                  className="relative w-10 h-10 object-contain"
                  style={{
                    filter: 'brightness(1.8) contrast(1.5) drop-shadow(0 0 12px rgba(74, 144, 226, 0.8)) drop-shadow(0 0 20px rgba(91, 163, 245, 0.5))',
                  }}
                />
              </div>
              <span className="text-white font-bold text-xl drop-shadow-lg">WHALEARC</span>
            </Link>
            
            {/* Sign Up Button */}
            <Link 
              to="/login" 
              className="px-6 py-2 bg-whale-light border border-whale-light text-white font-semibold rounded-lg hover:bg-whale-accent transition-colors"
            >
              Sign Up
            </Link>
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
                실시간 주가 데이터와 전략 분석으로<br />
                나만의 투자 전략을 실험해보세요
              </p>
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
                실시간 주가 데이터와 전략 분석으로<br />
                나만의 투자 전략을 실험해보세요
              </p>
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
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Card 1 - 실시간 주가 확인 */}
            <div 
              onClick={() => handleFeatureClick('/market')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleFeatureClick('/market');
                }
              }}
              role="button"
              tabIndex={0}
              className="group card text-center cursor-pointer hover:shadow-xl hover:-translate-y-2 transition-all duration-300 border border-gray-100 hover:border-whale-light"
            >
              <div className="w-20 h-20 bg-gradient-to-br from-whale-light to-whale-accent rounded-xl mx-auto mb-6 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  {/* 실시간 라인 차트 */}
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 18l6-6 4 4 8-8" strokeWidth={2.5} />
                  {/* 실시간 표시 원 */}
                  <circle cx="3" cy="18" r="2" fill="currentColor" />
                  <circle cx="9" cy="12" r="2" fill="currentColor" />
                  <circle cx="13" cy="16" r="2" fill="currentColor" />
                  <circle cx="21" cy="10" r="2" fill="currentColor" />
                  {/* 실시간 깜빡임 표시 */}
                  <circle cx="21" cy="10" r="3" fill="currentColor" opacity="0.3" className="animate-ping" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-whale-dark mb-2 group-hover:text-whale-light transition-colors">
                실시간 주가 확인
              </h3>
              <p className="text-gray-600 text-sm">
                실시간으로 변동하는 주가를 즉시 확인하고 분석하세요
              </p>
            </div>

            {/* Card 2 - 모의투자 체험 */}
            <div 
              onClick={() => handleFeatureClick('/trade')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleFeatureClick('/trade');
                }
              }}
              role="button"
              tabIndex={0}
              className="group card text-center cursor-pointer hover:shadow-xl hover:-translate-y-2 transition-all duration-300 border border-gray-100 hover:border-whale-light"
            >
              <div className="w-20 h-20 bg-gradient-to-br from-whale-light to-whale-accent rounded-xl mx-auto mb-6 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  {/* 게임 컨트롤러/체험 아이콘 */}
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  {/* 체험/플레이 표시 */}
                  <circle cx="8" cy="12" r="1.5" fill="currentColor" />
                  <circle cx="16" cy="12" r="1.5" fill="currentColor" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-whale-dark mb-2 group-hover:text-whale-light transition-colors">
                모의투자 체험
              </h3>
              <p className="text-gray-600 text-sm">
                실제 돈 없이 안전하게 투자 전략을 실험해보세요
              </p>
            </div>

            {/* Card 3 - 전략 분석 및 백테스트 */}
            <div 
              onClick={() => handleFeatureClick('/strategy')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleFeatureClick('/strategy');
                }
              }}
              role="button"
              tabIndex={0}
              className="group card text-center cursor-pointer hover:shadow-xl hover:-translate-y-2 transition-all duration-300 border border-gray-100 hover:border-whale-light"
            >
              <div className="w-20 h-20 bg-gradient-to-br from-whale-light to-whale-accent rounded-xl mx-auto mb-6 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  {/* 문서와 차트 아이콘 */}
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  {/* 차트 라인 */}
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16l4-4 4 4" strokeWidth={2.5} />
                  {/* 체크마크 (검증) */}
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l3 3 7-7" strokeWidth={2.5} />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-whale-dark mb-2 group-hover:text-whale-light transition-colors">
                전략 분석 및 백테스트
              </h3>
              <p className="text-gray-600 text-sm">
                과거 데이터로 전략을 검증하고 수익률을 분석하세요
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;

