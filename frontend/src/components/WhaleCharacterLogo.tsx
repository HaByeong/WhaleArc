interface WhaleCharacterLogoProps {
  size?: number;
  showText?: boolean;
  animate?: boolean;
  className?: string;
}

const WhaleCharacterLogo = ({ size = 120, showText = false, animate = true, className = '' }: WhaleCharacterLogoProps) => {
  const w = size;
  const h = size * 0.85;

  return (
    <div className={`inline-flex flex-col items-center gap-1 ${className}`}>
      <svg
        width={w}
        height={h}
        viewBox="0 0 200 170"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={animate ? 'whale-character-float' : ''}
      >
        <defs>
          {/* 몸체 그라데이션 */}
          <linearGradient id="wc-body" x1="40" y1="30" x2="160" y2="130" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7bb8f0" />
            <stop offset="50%" stopColor="#4a90e2" />
            <stop offset="100%" stopColor="#3a7bd5" />
          </linearGradient>
          {/* 배 그라데이션 */}
          <linearGradient id="wc-belly" x1="70" y1="75" x2="130" y2="120" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#e8f4fd" />
            <stop offset="100%" stopColor="#cce5f8" />
          </linearGradient>
          {/* 지느러미 그라데이션 */}
          <linearGradient id="wc-fin" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#5ba3f5" />
            <stop offset="100%" stopColor="#3a7bd5" />
          </linearGradient>
          {/* 꼬리 그라데이션 */}
          <linearGradient id="wc-tail" x1="150" y1="55" x2="195" y2="90" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#5ba3f5" />
            <stop offset="100%" stopColor="#4a90e2" />
          </linearGradient>
          {/* 캔들스틱 배경 그라데이션 */}
          <linearGradient id="wc-candle-bg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4a90e2" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#4a90e2" stopOpacity="0" />
          </linearGradient>
          {/* 그림자 */}
          <filter id="wc-shadow" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#1a2b4d" floodOpacity="0.15" />
          </filter>
          <filter id="wc-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* 배경 캔들스틱 차트 (투명하게) */}
        <g opacity="0.2">
          {/* 상승 캔들 */}
          <line x1="25" y1="20" x2="25" y2="50" stroke="#4a90e2" strokeWidth="1" />
          <rect x="22" y="25" width="6" height="15" rx="1" fill="#4a90e2" />
          {/* 하락 캔들 */}
          <line x1="38" y1="30" x2="38" y2="55" stroke="#4a90e2" strokeWidth="1" />
          <rect x="35" y="32" width="6" height="12" rx="1" fill="none" stroke="#4a90e2" strokeWidth="1" />
          {/* 상승 캔들 */}
          <line x1="51" y1="15" x2="51" y2="48" stroke="#4a90e2" strokeWidth="1" />
          <rect x="48" y="20" width="6" height="18" rx="1" fill="#4a90e2" />
          {/* 상승 캔들 (큰) */}
          <line x1="64" y1="8" x2="64" y2="45" stroke="#4a90e2" strokeWidth="1" />
          <rect x="61" y="12" width="6" height="22" rx="1" fill="#4a90e2" />
        </g>

        {/* === 고래 본체 === */}
        <g filter="url(#wc-shadow)">
          {/* 꼬리 */}
          <path
            d="M155 72 C165 58, 190 45, 195 38 C192 48, 188 55, 175 65 C188 68, 195 82, 198 95 C190 85, 178 78, 165 78 Z"
            fill="url(#wc-tail)"
            className={animate ? 'whale-character-tail' : ''}
          />

          {/* 몸체 - 둥글고 귀여운 형태 */}
          <ellipse cx="95" cy="82" rx="68" ry="52" fill="url(#wc-body)" />

          {/* 배 - 밝은 부분 */}
          <ellipse cx="88" cy="95" rx="45" ry="30" fill="url(#wc-belly)" />

          {/* 등 지느러미 */}
          <path
            d="M108 32 C112 22, 118 18, 120 15 C121 20, 119 28, 115 35 Z"
            fill="url(#wc-fin)"
          />

          {/* 가슴 지느러미 */}
          <path
            d="M62 88 C55 95, 42 105, 38 112 C40 108, 48 98, 58 92 Z"
            fill="#3a7bd5"
            opacity="0.8"
          />

          {/* 입 라인 */}
          <path
            d="M32 82 C36 88, 42 90, 48 88"
            fill="none"
            stroke="#2a6cc4"
            strokeWidth="1.5"
            strokeLinecap="round"
          />

          {/* 미소 */}
          <path
            d="M36 85 C40 90, 46 91, 50 89"
            fill="none"
            stroke="#1a2b4d"
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity="0.3"
          />

          {/* 눈 - 오른쪽 (큰 눈) */}
          <ellipse cx="48" cy="68" rx="8" ry="9" fill="white" />
          <ellipse cx="50" cy="68" rx="5" ry="6" fill="#1a2b4d" />
          <circle cx="52" cy="65" r="2" fill="white" />
          <circle cx="48" cy="70" r="1" fill="white" opacity="0.5" />

          {/* 눈썹 (살짝) */}
          <path
            d="M40 58 C44 56, 50 56, 56 58"
            fill="none"
            stroke="#2a6cc4"
            strokeWidth="1"
            strokeLinecap="round"
            opacity="0.4"
          />

          {/* 볼 터치 (블러셔) */}
          <circle cx="38" cy="82" r="5" fill="#f8a4b8" opacity="0.25" />

          {/* 물줄기 */}
          <g opacity="0.5" className={animate ? 'whale-character-spout' : ''}>
            <ellipse cx="72" cy="22" rx="3" ry="5" fill="#b8dcf8" />
            <ellipse cx="80" cy="16" rx="2.5" ry="4" fill="#b8dcf8" />
            <ellipse cx="76" cy="10" rx="2" ry="3.5" fill="#b8dcf8" />
          </g>
        </g>

        {/* 나침반 (목에 걸린) */}
        <g transform="translate(55, 100)" filter="url(#wc-glow)">
          <circle cx="0" cy="0" r="8" fill="#f5f0e0" stroke="#c4a44a" strokeWidth="1.2" />
          <circle cx="0" cy="0" r="6" fill="white" stroke="#d4b45a" strokeWidth="0.5" />
          {/* 나침반 바늘 */}
          <polygon points="0,-4 1.2,0 0,1.5 -1.2,0" fill="#e74c3c" />
          <polygon points="0,4 1.2,0 0,-1.5 -1.2,0" fill="#1a2b4d" />
          <circle cx="0" cy="0" r="1" fill="#c4a44a" />
          {/* N 표시 */}
          <text x="0" y="-5.5" textAnchor="middle" fill="#c4a44a" fontSize="3" fontWeight="bold">N</text>
        </g>

        {/* 작은 차트 아이콘 (오른쪽 위) */}
        <g transform="translate(148, 25)" opacity="0.35">
          <rect x="0" y="0" width="28" height="20" rx="3" fill="white" stroke="#4a90e2" strokeWidth="0.8" />
          <polyline
            points="4,14 9,10 14,12 19,6 24,8"
            fill="none"
            stroke="#4a90e2"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="19" cy="6" r="1.5" fill="#4a90e2" />
        </g>

        {/* 물결 (하단) */}
        <g opacity="0.15">
          <path
            d="M10 145 C30 138, 50 148, 70 142 C90 136, 110 146, 130 140 C150 134, 170 144, 190 138"
            fill="none"
            stroke="#4a90e2"
            strokeWidth="1.5"
            strokeLinecap="round"
            className={animate ? 'whale-character-wave' : ''}
          />
          <path
            d="M5 155 C25 148, 45 158, 65 152 C85 146, 105 156, 125 150 C145 144, 165 154, 195 148"
            fill="none"
            stroke="#4a90e2"
            strokeWidth="1"
            strokeLinecap="round"
            className={animate ? 'whale-character-wave-2' : ''}
          />
        </g>
      </svg>

      {showText && (
        <div className="text-center">
          <div className="text-lg font-bold tracking-wider" style={{ color: '#1a2b4d' }}>WHALEARC</div>
          <div className="text-[10px] text-gray-400 tracking-wide">고래처럼, 시장을 유영하듯</div>
        </div>
      )}

      <style>{`
        @keyframes wc-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
        }
        @keyframes wc-tail-wag {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(3deg); }
          75% { transform: rotate(-3deg); }
        }
        @keyframes wc-spout {
          0%, 100% { opacity: 0.5; transform: translateY(0); }
          50% { opacity: 0.8; transform: translateY(-3px); }
        }
        @keyframes wc-wave {
          0% { transform: translateX(0); }
          100% { transform: translateX(-20px); }
        }
        .whale-character-float {
          animation: wc-float 3s ease-in-out infinite;
        }
        .whale-character-tail {
          transform-origin: 155px 75px;
          animation: wc-tail-wag 2s ease-in-out infinite;
        }
        .whale-character-spout {
          animation: wc-spout 2.5s ease-in-out infinite;
        }
        .whale-character-wave {
          animation: wc-wave 4s linear infinite;
        }
        .whale-character-wave-2 {
          animation: wc-wave 5s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default WhaleCharacterLogo;
