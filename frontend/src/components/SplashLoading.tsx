const SplashLoading = ({ message = '불러오는 중...' }: { message?: string }) => (
  <div className="min-h-screen w-full bg-[#060d18] flex items-center justify-center overflow-hidden">
    <div className="text-center">
      <div className="relative w-52 h-52 mx-auto mb-7">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-3/4 h-3/4 bg-cyan-500/[0.06] rounded-full blur-[60px] animate-pulse" style={{ animationDuration: '3s' }} />
        </div>
        <img
          src="/brand-whale.png"
          alt=""
          className="relative w-full h-full object-contain"
          style={{ filter: 'drop-shadow(0 0 28px rgba(91,157,255,0.5))' }}
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
