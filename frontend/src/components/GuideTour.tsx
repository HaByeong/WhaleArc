import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../contexts/ThemeContext';

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

// 툴팁 팔레트 — 사이트 기본은 다크. 사용자가 라이트로 토글했을 때만 라이트.
const PALETTE = {
  dark: { bg: 'linear-gradient(180deg,#16233f,#0c1530)', border: 'rgba(255,255,255,.14)', title: '#f1f5f9', desc: 'rgba(255,255,255,.74)',
    chip: 'rgba(255,255,255,.08)', chipText: 'rgba(255,255,255,.6)', prevBg: 'rgba(255,255,255,.08)', prevText: '#e2e8f0',
    dotIdle: 'rgba(255,255,255,.18)', dotDone: 'rgba(91,157,255,.45)', skip: 'rgba(255,255,255,.45)' },
  light: { bg: '#ffffff', border: 'rgba(0,0,0,.08)', title: '#0f172a', desc: '#334155',
    chip: '#f3f4f6', chipText: '#6b7280', prevBg: '#f3f4f6', prevText: '#374151',
    dotIdle: '#e5e7eb', dotDone: 'rgba(74,144,226,.4)', skip: '#9ca3af' },
};

const GuideTour = ({ steps, isActive, onFinish }: GuideTourProps) => {
  const { isDark } = useTheme();
  const t = isDark ? PALETTE.dark : PALETTE.light;
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
    // 콘솔 본문(.wa-console-dense)의 zoom 보정 — 타깃은 zoom 안, 스포트라이트는 body 포털(시각 뷰포트)이라
    // 좌표계를 맞춰야 정렬된다. Chrome 버전마다 getBoundingClientRect가 zoom을 반영(시각좌표)하거나 안 함(CSS좌표)이라,
    // 프로브로 판별 → CSS좌표면 zoom 원점(zoomEl 좌상단) 기준으로 시각좌표로 변환한다.
    let sp = { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
    const zoomEl = (el as HTMLElement).closest('.wa-console-dense') as HTMLElement | null;
    if (zoomEl) {
      const zoom = parseFloat(getComputedStyle(zoomEl).zoom) || 1;
      if (zoom && zoom !== 1) {
        const probe = document.createElement('div');
        probe.style.cssText = 'position:absolute;left:0;top:0;width:1000px;height:0;visibility:hidden;pointer-events:none;';
        zoomEl.appendChild(probe);
        const grcFactor = (probe.getBoundingClientRect().width || 1000) / 1000; // ≈zoom이면 grc=시각좌표, ≈1이면 grc=CSS좌표
        zoomEl.removeChild(probe);
        if (Math.abs(grcFactor - 1) < 0.02) {
          const base = zoomEl.getBoundingClientRect(); // 같은 CSS좌표계의 zoom 원점
          sp = {
            left: base.left + (rect.left - base.left) * zoom,
            top: base.top + (rect.top - base.top) * zoom,
            width: rect.width * zoom,
            height: rect.height * zoom,
          };
        }
        // grcFactor≈zoom이면 grc가 이미 시각좌표 → 변환 불필요
      }
    }

    const pad = 8;
    setSpotlight({ top: sp.top - pad, left: sp.left - pad, width: sp.width + pad * 2, height: sp.height + pad * 2 });

    // 툴팁은 강조 영역을 가리지 않게 화면 상/하단 중앙에 크게 고정 (항상 잘 보이게)
    const spotCenterY = sp.top + sp.height / 2;
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

  // body로 포털 — 콘솔 본문(.wa-console-dense)의 zoom 밖에서 렌더해야
  // getBoundingClientRect(시각좌표)와 position:fixed 좌표계가 일치한다(스포트라이트 정렬).
  return createPortal((
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
          background: t.bg,
          border: `1px solid ${t.border}`,
          boxShadow: '0 30px 80px -16px rgba(0,0,0,.8), 0 0 0 1px rgba(0,0,0,.08)',
        }}
        onClick={(e) => e.stopPropagation()}
        className={`z-[9999] rounded-2xl p-7 transition-all duration-300 ${animating ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}
      >
        {/* 스텝 카운터 */}
        <div className="flex items-center gap-1.5 mb-4">
          {steps.map((_, i) => (
            <div key={i} className="h-2 rounded-full transition-all duration-300" style={{
              width: i === currentStep ? 28 : 12,
              background: i === currentStep ? '#4a90e2' : i < currentStep ? t.dotDone : t.dotIdle,
            }} />
          ))}
          <span className="ml-auto rounded-full px-2.5 py-1 text-[12.5px] font-bold" style={{ background: t.chip, color: t.chipText }}>{currentStep + 1} / {steps.length}</span>
        </div>

        {/* 내용 */}
        <h4 className="mb-2.5 text-[23px] font-extrabold leading-tight" style={{ color: t.title }}>{step.title}</h4>
        <div className="mb-6 whitespace-pre-line text-[16px] font-medium leading-relaxed" style={{ color: t.desc }}>{step.description}</div>

        {/* 버튼 */}
        <div className="flex items-center justify-between">
          <button
            onClick={(e) => { e.stopPropagation(); onFinish(); }}
            className="text-[14px] font-semibold transition-colors hover:opacity-80"
            style={{ color: t.skip }}
          >
            건너뛰기
          </button>
          <div className="flex items-center gap-2.5">
            {currentStep > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                className="rounded-xl px-5 py-2.5 text-[15px] font-bold transition-colors hover:opacity-85"
                style={{ background: t.prevBg, color: t.prevText }}
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
  ), document.body);
};

export default GuideTour;
