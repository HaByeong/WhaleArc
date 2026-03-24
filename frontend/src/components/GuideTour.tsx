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
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [arrowDir, setArrowDir] = useState<'top' | 'bottom' | 'left' | 'right'>('bottom');
  const [animating, setAnimating] = useState(false);

  const step = steps[currentStep];

  const updatePosition = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const pad = 8;
    const s = {
      top: rect.top - pad,
      left: rect.left - pad,
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
    };
    setSpotlight(s);

    // 툴팁 위치 계산
    const tooltipW = 340;
    const tooltipH = 260;
    const pos = step.position || 'bottom';
    let tt: React.CSSProperties = {};
    let arrow: 'top' | 'bottom' | 'left' | 'right' = 'top';

    const clampTop = (v: number) => Math.max(12, Math.min(v, window.innerHeight - tooltipH - 12));
    const clampLeft = (v: number) => Math.max(12, Math.min(v, window.innerWidth - tooltipW - 12));

    if (pos === 'bottom' || (!step.position && s.top + s.height + tooltipH + 20 < window.innerHeight)) {
      tt = { top: s.top + s.height + 12, left: clampLeft(s.left + s.width / 2 - tooltipW / 2) };
      arrow = 'top';
    } else if (pos === 'top' || (!step.position && s.top - tooltipH - 20 > 0)) {
      tt = { top: s.top - tooltipH - 12, left: clampLeft(s.left + s.width / 2 - tooltipW / 2) };
      arrow = 'bottom';
    } else if (pos === 'right') {
      tt = { top: clampTop(s.top + s.height / 2 - tooltipH / 2), left: clampLeft(s.left + s.width + 12) };
      arrow = 'left';
    } else {
      tt = { top: clampTop(s.top + s.height / 2 - tooltipH / 2), left: Math.max(12, s.left - tooltipW - 12) };
      arrow = 'right';
    }

    setTooltipStyle({ ...tt, width: tooltipW, position: 'fixed' });
    setArrowDir(arrow);
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
          fill="rgba(0,0,0,0.6)"
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

      {/* 툴팁 */}
      <div
        style={tooltipStyle}
        onClick={(e) => e.stopPropagation()}
        className={`z-[9999] bg-white rounded-2xl shadow-2xl border border-gray-200 p-5 transition-all duration-300 ${animating ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}
      >
        {/* 화살표 */}
        <div className={`absolute w-3 h-3 bg-white border-gray-200 rotate-45 ${
          arrowDir === 'top' ? '-top-1.5 left-1/2 -translate-x-1/2 border-l border-t' :
          arrowDir === 'bottom' ? '-bottom-1.5 left-1/2 -translate-x-1/2 border-r border-b' :
          arrowDir === 'left' ? 'top-1/2 -left-1.5 -translate-y-1/2 border-l border-b' :
          'top-1/2 -right-1.5 -translate-y-1/2 border-r border-t'
        }`} />

        {/* 스텝 카운터 */}
        <div className="flex items-center gap-1.5 mb-3">
          {steps.map((_, i) => (
            <div key={i} className={`h-1 rounded-full transition-all duration-300 ${
              i === currentStep ? 'w-5 bg-whale-light' : i < currentStep ? 'w-2 bg-whale-light/40' : 'w-2 bg-gray-200'
            }`} />
          ))}
          <span className="ml-auto text-[10px] text-gray-400">{currentStep + 1}/{steps.length}</span>
        </div>

        {/* 내용 */}
        <h4 className="text-sm font-bold text-whale-dark mb-1.5">{step.title}</h4>
        <div className="text-xs text-gray-500 leading-relaxed mb-4 whitespace-pre-line">{step.description}</div>

        {/* 버튼 */}
        <div className="flex items-center justify-between">
          <button
            onClick={(e) => { e.stopPropagation(); onFinish(); }}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            건너뛰기
          </button>
          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                이전
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); handleNext(); }}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-whale-light hover:bg-whale-dark transition-colors shadow-sm"
            >
              {isLast ? '시작하기' : '다음'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuideTour;
