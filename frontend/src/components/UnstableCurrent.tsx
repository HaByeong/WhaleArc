const UnstableCurrent = ({ message = '해류가 불안정합니다', sub = '데이터를 다시 불러오고 있어요...' }: { message?: string; sub?: string }) => (
  <div className="relative overflow-hidden rounded-xl py-12 px-6 text-center">
    {/* 해류 웨이브 배경 */}
    <svg className="absolute inset-0 w-full h-full opacity-30" preserveAspectRatio="none" viewBox="0 0 400 120">
      <path className="wt-current-wave-1" d="M0,60 Q50,40 100,60 Q150,80 200,60 Q250,40 300,60 Q350,80 400,60 V120 H0 Z" fill="rgba(56,189,248,0.08)" />
      <path className="wt-current-wave-2" d="M0,70 Q50,50 100,70 Q150,90 200,70 Q250,50 300,70 Q350,90 400,70 V120 H0 Z" fill="rgba(56,189,248,0.05)" />
      <path className="wt-current-wave-3" d="M0,80 Q50,65 100,80 Q150,95 200,80 Q250,65 300,80 Q350,95 400,80 V120 H0 Z" fill="rgba(56,189,248,0.03)" />
    </svg>
    {/* 물결 파티클 */}
    <div className="absolute top-1/3 left-[15%] w-1 h-1 bg-cyan-400/30 rounded-full wt-drift-particle-1" />
    <div className="absolute top-1/2 left-[45%] w-0.5 h-0.5 bg-cyan-300/20 rounded-full wt-drift-particle-2" />
    <div className="absolute top-1/3 right-[20%] w-1 h-1 bg-blue-400/25 rounded-full wt-drift-particle-3" />
    {/* 컨텐츠 */}
    <div className="relative z-10">
      <div className="flex justify-center mb-3">
        <svg className="w-10 h-10 text-cyan-400/40 wt-current-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2 12c1.5-2 3.5-3 5.5-1s4 1 5.5-1 3.5-3 5.5-1 3.5 3 5.5 1" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M2 16c1.5-2 3.5-3 5.5-1s4 1 5.5-1 3.5-3 5.5-1 3.5 3 5.5 1" opacity="0.5" />
        </svg>
      </div>
      <p className="text-sm font-medium text-slate-400">{message}</p>
      <p className="text-xs text-slate-600 mt-1">{sub}</p>
    </div>
  </div>
);

export default UnstableCurrent;
