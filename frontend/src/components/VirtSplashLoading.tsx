const VirtSplashLoading = ({ message = '불러오는 중...' }: { message?: string }) => (
  <div className="min-h-screen w-full bg-gray-50 flex items-center justify-center overflow-hidden">
    <div className="text-center">
      {/* 고래 꼬리 로고 + 물결 */}
      <div className="relative w-32 h-32 mx-auto mb-6">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-3/4 h-3/4 bg-whale-light/10 rounded-full blur-[40px] animate-pulse" style={{ animationDuration: '3s' }} />
        </div>
        {/* 수면 파도 */}
        <div className="wt-wave wt-wave-1" style={{ position: 'absolute', left: '5%', right: '5%', height: '30%', top: '62%' }} />
        <div className="wt-wave wt-wave-2" style={{ position: 'absolute', left: '5%', right: '5%', height: '30%', top: '62%' }} />
        <div className="wt-wave wt-wave-3" style={{ position: 'absolute', left: '5%', right: '5%', height: '30%', top: '62%' }} />
        <img
          src="/tail.png"
          alt=""
          className="relative w-full h-full object-contain whale-logo-wag"
          style={{
            filter: 'brightness(1.7) saturate(1.3) hue-rotate(-5deg) drop-shadow(0 0 12px rgba(74,144,226,0.5))',
          }}
        />
      </div>
      {/* 텍스트 */}
      <div className="flex items-center justify-center mb-4">
        <span className="whalearc-text-nav text-2xl">WHALEARC<span>-VIRT</span></span>
      </div>
      {/* 로딩 바 */}
      <div className="w-48 h-0.5 bg-whale-light/10 rounded-full mx-auto overflow-hidden">
        <div className="h-full bg-gradient-to-r from-whale-light to-whale-accent rounded-full animate-loading-bar" />
      </div>
      <p className="text-gray-400 text-xs mt-4">{message}</p>
    </div>
  </div>
);

export default VirtSplashLoading;
