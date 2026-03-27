const SplashLoading = ({ message = '불러오는 중...' }: { message?: string }) => (
  <div className="min-h-screen w-full bg-[#060d18] flex items-center justify-center overflow-hidden">
    <div className="text-center">
      <div className="relative w-72 h-72 mx-auto mb-8">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-3/4 h-3/4 bg-cyan-500/[0.06] rounded-full blur-[60px] animate-pulse" style={{ animationDuration: '3s' }} />
        </div>
        <img
          src="/tail-sample-2.png"
          alt=""
          className="relative w-full h-full object-contain"
          style={{ filter: 'brightness(1.5) contrast(1.3) saturate(1.4) drop-shadow(0 0 20px rgba(56,189,248,0.4))' }}
        />
      </div>
      <div className="flex items-center justify-center gap-1.5 mb-4">
        <span className="whalearc-text text-2xl">WHALEARC</span>
      </div>
      <div className="w-48 h-0.5 bg-white/[0.06] rounded-full mx-auto overflow-hidden">
        <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full animate-loading-bar" />
      </div>
      <p className="text-slate-600 text-xs mt-4">{message}</p>
    </div>
  </div>
);

export default SplashLoading;
