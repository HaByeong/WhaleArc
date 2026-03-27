interface WhaleTailLogoProps {
  size?: number;
  showNav?: boolean;
  darkNav?: boolean;
}

const WhaleTailLogo = ({ size = 40, showNav = false, darkNav = false }: WhaleTailLogoProps) => {
  // non-Virt 다크 네비: 와이어프레임 캔들차트 로고
  if (darkNav) {
    const s = size * 2.3;
    return (
      <div className="wt-logo-wrap relative" style={{ width: s, height: s, overflow: 'visible', marginRight: -4, marginTop: -(s - size) / 2, marginBottom: -(s - size) / 2 }}>
        {/* 배경 글로우 */}
        <div className="wt-glow-pro" style={{ position: 'absolute', left: '-20%', right: '-20%', top: '-10%', bottom: '15%' }} />
        {/* 윤곽선 따라 흐르는 빛 + 바다 물결 */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" style={{ overflow: 'visible', pointerEvents: 'none' }}>
          {/* 흐르는 빛 */}
          <path
            d="M50,68 C46,58 35,48 22,38 C17,34 16,28 20,24 C24,20 28,22 33,27 C38,32 43,38 47,42 C49,44 50,42 50,40"
            fill="none" stroke="rgba(56,189,248,0.6)" strokeWidth="1.2" strokeLinecap="round"
            className="wt-trace-left"
          />
          <path
            d="M50,68 C54,58 65,48 78,38 C83,34 84,28 80,24 C76,20 72,22 67,27 C62,32 57,38 53,42 C51,44 50,42 50,40"
            fill="none" stroke="rgba(56,189,248,0.6)" strokeWidth="1.2" strokeLinecap="round"
            className="wt-trace-right"
          />
        </svg>
        {/* 로고 */}
        <img
          src="/tail-sample-2.png"
          alt=""
          className="absolute inset-0 w-full h-full object-contain"
          style={{
            filter: 'brightness(1.5) contrast(1.3) saturate(1.4) drop-shadow(0 0 10px rgba(56,189,248,0.5))',
          }}
        />
      </div>
    );
  }

  // Virt + 랜딩: 고래 꼬리 + 물결 + 물 흐름
  return (
    <div className="wt-logo-wrap relative" style={{ width: size, height: size, overflow: 'visible' }}>
      <div className="wt-glow" style={{ position: 'absolute', left: '-20%', right: '-20%', top: '-10%', bottom: '20%' }} />
      {/* 물이 꼬리를 타고 흐르는 라인 */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 40 40" style={{ overflow: 'visible', pointerEvents: 'none' }}>
        {/* 왼쪽 물줄기 */}
        <path d="M12,14 Q10,18 8,24 Q7,27 9,29" fill="none" stroke="rgba(74,144,226,0.3)" strokeWidth="0.8" strokeLinecap="round" className="wt-water-flow-1" />
        {/* 오른쪽 물줄기 */}
        <path d="M28,14 Q30,18 32,24 Q33,27 31,29" fill="none" stroke="rgba(74,144,226,0.3)" strokeWidth="0.8" strokeLinecap="round" className="wt-water-flow-2" />
      </svg>
      {/* 수면 파도 */}
      <div className="wt-wave wt-wave-1" style={{ position: 'absolute', left: '5%', right: '5%', height: '30%', top: '62%' }} />
      <div className="wt-wave wt-wave-2" style={{ position: 'absolute', left: '5%', right: '5%', height: '30%', top: '62%' }} />
      <div className="wt-wave wt-wave-3" style={{ position: 'absolute', left: '5%', right: '5%', height: '30%', top: '62%' }} />
      <div className="wt-wave wt-wave-4" style={{ position: 'absolute', left: '5%', right: '5%', height: '30%', top: '62%' }} />
      <img
        src="/tail.png"
        alt=""
        className="absolute inset-0 w-full h-full object-contain whale-logo-wag"
        style={{
          filter: showNav
            ? 'brightness(1.7) saturate(1.3) hue-rotate(-5deg) drop-shadow(0 0 4px rgba(74,144,226,0.5))'
            : 'brightness(1.8) saturate(1.2) hue-rotate(-5deg) drop-shadow(0 0 12px rgba(74,144,226,0.7))',
        }}
      />
    </div>
  );
};

export default WhaleTailLogo;
