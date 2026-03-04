interface WhaleTailLogoProps {
  size?: number;
  showNav?: boolean;
}

const WhaleTailLogo = ({ size = 40, showNav = false }: WhaleTailLogoProps) => (
  <div className="relative" style={{ width: size, height: size, overflow: 'visible' }}>
    {/* 수면 파도 */}
    <div className="wt-wave wt-wave-1" style={{ position: 'absolute', left: '5%', right: '5%', height: '30%', top: '62%' }} />
    <div className="wt-wave wt-wave-2" style={{ position: 'absolute', left: '5%', right: '5%', height: '30%', top: '62%' }} />
    <div className="wt-wave wt-wave-3" style={{ position: 'absolute', left: '5%', right: '5%', height: '30%', top: '62%' }} />
    {/* 고래 꼬리 로고 */}
    <img
      src="/tail.png"
      alt=""
      className="absolute inset-0 w-full h-full object-contain whale-logo-wag"
      style={{
        filter: showNav
          ? 'brightness(1.7) saturate(1.3) hue-rotate(-5deg) drop-shadow(0 0 3px rgba(74,144,226,0.6))'
          : 'brightness(1.8) saturate(1.2) hue-rotate(-5deg) drop-shadow(0 0 10px rgba(74,144,226,0.8))',
      }}
    />
  </div>
);

export default WhaleTailLogo;
