import { useState, useEffect, useCallback } from 'react';

export interface TourStep {
  target: string;       // data-tour 속성값
  title: string;
  description: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

interface GuideTourProps {
  steps: TourStep[];
  isActive: boolean;
  onFinish: () => void;
}

const GuideTour = ({ steps, isActive, onFinish }: GuideTourProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlight, setSpotlight] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [placement, setPlacement] = useState<'top' | 'bottom'>('bottom');
  const [animating, setAnimating] = useState(false);

  const step = steps[currentStep];

  const updatePosition = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const pad = 8;
    setSpotlight({
      top: rect.top - pad,
      left: rect.left - pad,
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
    });

    // 툴팁은 강조 영역을 가리지 않게 화면 상/하단 중앙에 크게 고정 (항상 잘 보이게)
    const spotCenterY = rect.top + rect.height / 2;
    setPlacement(spotCenterY < window.innerHeight * 0.52 ? 'bottom' : 'top');
  }, [step, currentStep]);

  useEffect(() => {
    if (!isActive) { setCurrentStep(0); return; }
    setAnimating(true);
    const t = setTimeout(() => { updatePosition(); setAnimating(false); }, 150);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => { clearTimeout(t); window.removeEventListener('resize', updatePosition); window.removeEventListener('scroll', updatePosition, true); };
  }, [isActive, currentStep, updatePosition]);

  if (!isActive || !step || !spotlight) return null;

  const isLast = currentStep === steps.length - 1;

  const handleNext = () => {
    if (isLast) { onFinish(); return; }
    setAnimating(true);
    setCurrentStep(prev => prev + 1);
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setAnimating(true);
      setCurrentStep(prev => prev - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-[9990]" onClick={onFinish}>
      {/* 어두운 오버레이 + 스포트라이트 컷아웃 */}
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
        <defs>
          <mask id="tour-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect
              x={spotlight.left}
              y={spotlight.top}
              width={spotlight.width}
              height={spotlight.height}
              rx="12"
              fill="black"
              className="transition-all duration-300 ease-out"
            />
          </mask>
        </defs>
        <rect
          x="0" y="0" width="100%" height="100%"
          fill="rgba(0,0,0,0.82)"
          mask="url(#tour-mask)"
          style={{ pointerEvents: 'auto' }}
        />
      </svg>

      {/* 스포트라이트 보더 */}
      <div
        className="fixed rounded-xl border-2 border-whale-light shadow-[0_0_0_4px_rgba(74,144,226,0.2)] transition-all duration-300 ease-out pointer-events-none"
        style={{
          top: spotlight.top,
          left: spotlight.left,
          width: spotlight.width,
          height: spotlight.height,
        }}
      />

      {/* 툴팁 — 강조 영역을 가리지 않게 화면 상/하단 중앙에 크게 고정 */}
      <div
        style={{
          position: 'fixed',
          left: '50%',
          transform: 'translateX(-50%)',
          ...(placement === 'bottom' ? { bottom: 40 } : { top: 40 }),
          width: 'min(560px, calc(100vw - 32px))',
          background: '#ffffff',
          boxShadow: '0 30px 80px -16px rgba(0,0,0,.8), 0 0 0 1px rgba(0,0,0,.08)',
        }}
        onClick={(e) => e.stopPropagation()}
        className={`z-[9999] rounded-2xl border border-gray-200 p-7 transition-all duration-300 ${animating ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}
      >
        {/* 스텝 카운터 */}
        <div className="flex items-center gap-1.5 mb-4">
          {steps.map((_, i) => (
            <div key={i} className={`h-2 rounded-full transition-all duration-300 ${
              i === currentStep ? 'w-7 bg-whale-light' : i < currentStep ? 'w-3 bg-whale-light/40' : 'w-3 bg-gray-200'
            }`} />
          ))}
          <span className="ml-auto rounded-full bg-gray-100 px-2.5 py-1 text-[12.5px] font-bold text-gray-500">{currentStep + 1} / {steps.length}</span>
        </div>

        {/* 내용 */}
        <h4 className="mb-2.5 text-[23px] font-extrabold leading-tight" style={{ color: '#0f172a' }}>{step.title}</h4>
        <div className="mb-6 whitespace-pre-line text-[16px] font-medium leading-relaxed" style={{ color: '#334155' }}>{step.description}</div>

        {/* 버튼 */}
        <div className="flex items-center justify-between">
          <button
            onClick={(e) => { e.stopPropagation(); onFinish(); }}
            className="text-[14px] font-semibold text-gray-400 hover:text-gray-600 transition-colors"
          >
            건너뛰기
          </button>
          <div className="flex items-center gap-2.5">
            {currentStep > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                className="rounded-xl px-5 py-2.5 text-[15px] font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                이전
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); handleNext(); }}
              className="rounded-xl px-6 py-2.5 text-[15px] font-bold text-white bg-whale-light hover:bg-whale-dark transition-colors shadow-md"
            >
              {isLast ? '시작하기 →' : '다음 →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuideTour;
